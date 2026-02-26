const crypto = require('crypto');

// Lemon Squeezy sends webhooks for subscription events.
// This endpoint logs events for monitoring; actual auth uses cookie-based verification.
// Set LEMONSQUEEZY_WEBHOOK_SECRET in Vercel env vars (from LS dashboard > Webhooks).

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
    // Body was pre-parsed by middleware — re-serialize (less reliable, but functional)
    rawBody = JSON.stringify(req.body);
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

  const expectedStoreId = process.env.LEMONSQUEEZY_STORE_ID;
  if (expectedStoreId && String(attrs.store_id) !== expectedStoreId) {
    console.error(`Webhook store_id mismatch: ${attrs.store_id}`);
    return res.status(200).json({ received: true }); // ACK but ignore
  }

  const expectedProductId = process.env.LEMONSQUEEZY_PRODUCT_ID;
  if (expectedProductId && String(attrs.first_order_item?.product_id) !== expectedProductId) {
    console.error(`Webhook product_id mismatch: ${attrs.first_order_item?.product_id}`);
    return res.status(200).json({ received: true }); // ACK but ignore
  }

  // Log the event for monitoring
  console.log(`[LS Webhook] ${eventName}`, {
    orderId: payload.data?.id,
    customerId: attrs.customer_id,
    email: attrs.user_email,
    status: attrs.status,
    storeId: attrs.store_id
  });

  // Handle relevant events
  switch (eventName) {
    case 'order_created':
      console.log(`[LS Webhook] New order: #${payload.data?.id} by ${attrs.user_email}`);
      break;

    case 'subscription_updated':
      console.log(`[LS Webhook] Subscription updated: customer ${attrs.customer_id}, status=${attrs.status}`);
      break;

    case 'subscription_cancelled':
      console.log(`[LS Webhook] Subscription cancelled: customer ${attrs.customer_id}`);
      break;

    case 'subscription_expired':
      console.log(`[LS Webhook] Subscription expired: customer ${attrs.customer_id}`);
      break;

    case 'subscription_paused':
      console.log(`[LS Webhook] Subscription paused: customer ${attrs.customer_id}`);
      break;

    case 'subscription_unpaused':
      console.log(`[LS Webhook] Subscription unpaused: customer ${attrs.customer_id}`);
      break;

    case 'subscription_resumed':
      console.log(`[LS Webhook] Subscription resumed: customer ${attrs.customer_id}`);
      break;

    case 'order_refunded':
      console.log(`[LS Webhook] Order refunded: #${payload.data?.id}`);
      break;

    default:
      console.log(`[LS Webhook] Unhandled event: ${eventName}`);
  }

  // Always ACK the webhook to prevent retries
  return res.status(200).json({ received: true });
};

// Disable Vercel's body parser so we receive the raw body for signature verification
module.exports.config = { api: { bodyParser: false } };
