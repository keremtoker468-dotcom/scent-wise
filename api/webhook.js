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

  // Read raw body for signature verification
  let rawBody;
  if (typeof req.body === 'string') {
    rawBody = req.body;
  } else if (Buffer.isBuffer(req.body)) {
    rawBody = req.body.toString('utf8');
  } else {
    rawBody = JSON.stringify(req.body);
  }

  const signature = req.headers['x-signature'];
  if (!verifySignature(rawBody, signature, webhookSecret)) {
    console.error('Webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
  const eventName = payload.meta?.event_name;
  const customData = payload.meta?.custom_data || {};
  const attrs = payload.data?.attributes || {};

  const expectedStoreId = process.env.LEMONSQUEEZY_STORE_ID;
  if (expectedStoreId && String(attrs.store_id) !== expectedStoreId) {
    console.error(`Webhook store_id mismatch: ${attrs.store_id}`);
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
      // Order completed — user should be redirected back with ?order_id automatically
      // This log helps verify the flow is working
      console.log(`[LS Webhook] New order: #${payload.data?.id} by ${attrs.user_email}`);
      break;

    case 'subscription_cancelled':
      console.log(`[LS Webhook] Subscription cancelled: customer ${attrs.customer_id}`);
      break;

    case 'subscription_expired':
      console.log(`[LS Webhook] Subscription expired: customer ${attrs.customer_id}`);
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
