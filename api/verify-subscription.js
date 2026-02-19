const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin } = require('./_lib/csrf');

function makeToken(subscriptionId, customerId, secret) {
  return crypto.createHmac('sha256', secret).update(subscriptionId + ':' + customerId).digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`verify-sub:${ip}`, 10, 60000); // 10 attempts/min
  if (!rl.allowed) return res.status(429).json({ error: 'Too many attempts. Try again later.' });

  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
  if (typeof orderId !== 'string' || !/^\d{1,20}$/.test(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID format' });
  }

  const lsApiKey = process.env.LEMONSQUEEZY_API_KEY;
  const subSecret = process.env.SUBSCRIPTION_SECRET;
  const expectedStoreId = process.env.LEMONSQUEEZY_STORE_ID;
  const expectedProductId = process.env.LEMONSQUEEZY_PRODUCT_ID;

  if (!lsApiKey || !subSecret) {
    console.error('Missing LEMONSQUEEZY_API_KEY or SUBSCRIPTION_SECRET');
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    const orderRes = await fetch(`https://api.lemonsqueezy.com/v1/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${lsApiKey}`,
        'Accept': 'application/vnd.api+json'
      }
    });

    if (!orderRes.ok) {
      console.error(`LS API error: ${orderRes.status}`);
      return res.status(400).json({ error: 'Could not verify order' });
    }

    const orderData = await orderRes.json();
    const order = orderData.data?.attributes;

    if (!order || order.status === 'refunded') {
      return res.status(400).json({ error: 'Order not valid' });
    }

    // Validate order belongs to our store
    if (expectedStoreId && String(order.store_id) !== expectedStoreId) {
      console.error(`Order store_id mismatch: ${order.store_id}`);
      return res.status(400).json({ error: 'Order not valid' });
    }

    // Validate order is for our product
    if (expectedProductId && String(order.first_order_item?.product_id) !== expectedProductId) {
      console.error(`Order product_id mismatch: ${order.first_order_item?.product_id}`);
      return res.status(400).json({ error: 'Order not valid' });
    }

    const subscriptionId = String(orderData.data?.id || '');
    const customerId = String(order.customer_id || '');
    const customerEmail = order.user_email || '';

    if (!subscriptionId || !customerId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const token = makeToken(subscriptionId, customerId, subSecret);
    const cookieValue = Buffer.from(JSON.stringify({
      token, subId: subscriptionId, custId: customerId, email: customerEmail
    })).toString('base64');

    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    const maxAge = 30 * 24 * 60 * 60;

    res.setHeader('Set-Cookie', [
      `sw_sub=${cookieValue}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`
    ]);

    return res.status(200).json({ success: true, tier: 'premium', email: customerEmail });

  } catch (err) {
    console.error('Verify subscription error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
