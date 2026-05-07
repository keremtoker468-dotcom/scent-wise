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

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  // Stream the raw bytes directly. Works whether Vercel's parser ran or not —
  // if it ran, req has usually been fully consumed and this yields '', which
  // then fails signature check cleanly. If parser is disabled, we get the
  // original bytes needed for HMAC verification.
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Missing LEMONSQUEEZY_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Server not configured' });
  }

  const rawBody = await readRawBody(req);
  if (!rawBody) {
    console.error('Webhook received empty body — bodyParser may have consumed it');
    return res.status(400).json({ error: 'Empty request body' });
  }

  const signature = req.headers['x-signature'];
  if (!verifySignature(rawBody, signature, webhookSecret)) {
    console.error('Webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
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

  // Send a CompletePayment conversion event to TikTok Events API so ad
  // campaigns can optimize for purchases (browser pixel alone misses
  // post-redirect conversions and is blocked by trackers).
  async function sendTikTokConversion() {
    const pixelId = process.env.TIKTOK_PIXEL_ID;
    const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
    if (!pixelId || !accessToken) {
      console.warn('[TikTok] Missing TIKTOK_PIXEL_ID or TIKTOK_ACCESS_TOKEN — skipping');
      return;
    }

    const orderId = String(payload.data?.id || '');
    const email = attrs.user_email || '';
    const totalAmount = Number(attrs.total) ? Number(attrs.total) / 100 : 2.99;
    const currency = attrs.currency || 'USD';
    const ttclid = customData.ttclid;
    const ttp = customData.ttp;
    const userAgent = customData.user_agent;
    const ipAddress = customData.ip;

    const emailHash = email
      ? crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex')
      : '';

    const user = {};
    if (emailHash) user.email = emailHash;
    if (ttclid) user.ttclid = ttclid;
    if (ttp) user.ttp = ttp;
    if (userAgent) user.user_agent = userAgent;
    if (ipAddress) user.ip = ipAddress;

    const body = {
      event_source: 'web',
      event_source_id: pixelId,
      data: [{
        event: 'CompletePayment',
        event_time: Math.floor(Date.now() / 1000),
        event_id: `ls_${orderId}`,
        user,
        properties: {
          currency,
          value: totalAmount,
          content_type: 'product',
          content_id: 'scentwise_premium',
          content_name: 'ScentWise Premium',
          order_id: orderId
        }
      }]
    };

    try {
      const resp = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
        method: 'POST',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const result = await resp.json();
      if (result.code !== 0) {
        console.error(`[TikTok] Event API error: ${result.message}`);
      } else {
        console.log(`[TikTok] CompletePayment event sent for order ${orderId}`);
      }
    } catch (err) {
      console.error(`[TikTok] Failed to send event: ${err.message}`);
    }
  }

  // Handle relevant events
  switch (eventName) {
    case 'order_created':
      console.log(`[LS Webhook] New order received`);
      await bindDeviceToOrder();
      await sendTikTokConversion();
      break;

    case 'subscription_created':
      console.log(`[LS Webhook] Subscription created`);
      await bindDeviceToOrder();
      await sendTikTokConversion();
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
}

// Disable Vercel's body parser so we receive the raw body for signature verification.
// Attach config BEFORE the export so Vercel reliably detects it at build time.
handler.config = { api: { bodyParser: false } };
module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
