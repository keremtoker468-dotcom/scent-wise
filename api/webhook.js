const crypto = require('crypto');

// Lemon Squeezy sends webhooks for subscription events.
// This endpoint logs events for monitoring; actual auth uses cookie-based verification.
// Set LEMONSQUEEZY_WEBHOOK_SECRET in Vercel env vars (from LS dashboard > Webhooks).

// In-memory idempotency cache (event_id → timestamp). TTL: 10 minutes.
const _processedEvents = new Map();
const IDEMPOTENCY_TTL = 10 * 60 * 1000;

function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (Buffer.byteLength(hmac) !== Buffer.byteLength(signature)) return false;
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Missing LEMONSQUEEZY_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Server not configured' });
  }

  // Read raw body for signature verification.
  // With bodyParser disabled (see config export below), req.body is a Buffer/stream.
  // Fallback handles cases where body may already be parsed.
  let rawBody;
  if (Buffer.isBuffer(req.body)) {
    rawBody = req.body.toString('utf8');
  } else if (typeof req.body === 'string') {
    rawBody = req.body;
  } else if (req.body && typeof req.body === 'object') {
    // Body was pre-parsed — reject since re-serialization may differ from original
    console.error('Webhook received pre-parsed body — signature verification unreliable');
    return res.status(400).json({ error: 'Invalid request body format' });
  } else {
    // Body parser is disabled — read from stream
    const chunks = [];
    for await (const chunk of req) { chunks.push(chunk); }
    rawBody = Buffer.concat(chunks).toString('utf8');
  }

  const signature = req.headers['x-signature'];
  if (!verifySignature(rawBody, signature, webhookSecret)) {
    console.error('Webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)
      ? req.body
      : JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  const eventName = payload.meta?.event_name;
  const customData = payload.meta?.custom_data || {};
  const attrs = payload.data?.attributes || {};

  // Idempotency: webhook_id is the endpoint ID — identical for every event, so
  // using it as the key would collapse every delivery after the first into a
  // duplicate. Use resource id + timestamp so retries of the same event dedupe
  // but distinct updates of the same subscription process independently.
  const resourceId = payload.data?.id;
  const eventTs = attrs.updated_at || attrs.created_at || '';
  const idempKey = resourceId ? `${eventName}:${resourceId}:${eventTs}` : null;
  if (idempKey) {
    if (_processedEvents.has(idempKey)) {
      return res.status(200).json({ received: true, duplicate: true });
    }
    _processedEvents.set(idempKey, Date.now());
    // Prune old entries
    if (_processedEvents.size > 500) {
      const now = Date.now();
      for (const [k, t] of _processedEvents) {
        if (now - t > IDEMPOTENCY_TTL) _processedEvents.delete(k);
      }
    }
  }

  const expectedStoreId = process.env.LEMONSQUEEZY_STORE_ID;
  if (expectedStoreId && String(attrs.store_id) !== expectedStoreId) {
    console.error(`Webhook store_id mismatch: ${attrs.store_id}`);
    return res.status(200).json({ received: true }); // ACK but ignore
  }

  // Product ID check is required — without it, any purchase in the same store
  // (including unrelated products) would unlock Premium.
  const expectedProductId = process.env.LEMONSQUEEZY_PRODUCT_ID;
  if (!expectedProductId) {
    console.error('Missing LEMONSQUEEZY_PRODUCT_ID — refusing to trust webhook');
    return res.status(500).json({ error: 'Server not configured' });
  }
  if (String(attrs.first_order_item?.product_id) !== expectedProductId) {
    console.error(`Webhook product_id mismatch: ${attrs.first_order_item?.product_id}`);
    return res.status(200).json({ received: true }); // ACK but ignore
  }

  // Log the event for monitoring (no PII — omit emails and customer IDs)
  console.log(`[LS Webhook] ${eventName}`, {
    status: attrs.status,
    storeId: attrs.store_id
  });

  // Persist device_id → subscription mapping so the paying device auto-unlocks
  // on its next visit (no manual order-number entry needed).
  async function bindDeviceToOrder() {
    const deviceId = typeof customData.device_id === 'string' ? customData.device_id : null;
    if (!deviceId || !/^[a-f0-9]{32}$/.test(deviceId)) return;
    const subId = String(payload.data?.id || '');
    const custId = String(attrs.customer_id || '');
    const email = attrs.user_email || '';
    if (!subId || !custId) return;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      console.warn('[LS Webhook] No Redis — cannot persist device binding');
      return;
    }
    try {
      const key = `sw_devicesub:${deviceId}`;
      const value = JSON.stringify({ subId, custId, email, boundAt: Date.now() });
      // 60 days — long enough to survive typical return-to-site latency,
      // short enough to drop stale bindings if a device is sold/wiped.
      await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['SET', key, value],
          ['EXPIRE', key, 60 * 24 * 60 * 60]
        ])
      });
    } catch (err) {
      console.error('[LS Webhook] Failed to persist device binding:', err.message);
    }
  }

  // Handle relevant events
  switch (eventName) {
    case 'order_created':
      console.log(`[LS Webhook] New order received`);
      await bindDeviceToOrder();
      break;

    case 'subscription_created':
      console.log(`[LS Webhook] Subscription created`);
      await bindDeviceToOrder();
      break;

    case 'subscription_updated':
      console.log(`[LS Webhook] Subscription updated: status=${attrs.status}`);
      break;

    case 'subscription_cancelled':
      console.log(`[LS Webhook] Subscription cancelled`);
      break;

    case 'subscription_expired':
      console.log(`[LS Webhook] Subscription expired`);
      break;

    case 'subscription_paused':
      console.log(`[LS Webhook] Subscription paused`);
      break;

    case 'subscription_unpaused':
      console.log(`[LS Webhook] Subscription unpaused`);
      break;

    case 'subscription_resumed':
      console.log(`[LS Webhook] Subscription resumed`);
      break;

    case 'order_refunded':
      console.log(`[LS Webhook] Order refunded`);
      break;

    default:
      console.log(`[LS Webhook] Unhandled event: ${eventName}`);
  }

  // Always ACK the webhook to prevent retries
  return res.status(200).json({ received: true });
};

// Disable Vercel's body parser so we receive the raw body for signature verification
module.exports.config = { api: { bodyParser: false } };
