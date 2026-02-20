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

  let { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
  if (typeof orderId !== 'string') return res.status(400).json({ error: 'Invalid order ID format' });
  // Sanitize: strip #, spaces, and non-numeric characters
  orderId = orderId.trim().replace(/^#/, '').replace(/[^\d]/g, '');
  if (!orderId || orderId.length > 20) {
    return res.status(400).json({ error: 'Invalid order ID format. Enter the numeric order number (e.g. 2944561).' });
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
    const lsHeaders = {
      'Authorization': `Bearer ${lsApiKey}`,
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json'
    };

    let orderData = null;

    // First, try direct lookup by API id
    const orderRes = await fetch(`https://api.lemonsqueezy.com/v1/orders/${orderId}`, {
      headers: lsHeaders
    });

    if (orderRes.ok) {
      orderData = await orderRes.json();
    } else if (orderRes.status === 401 || orderRes.status === 403) {
      const errBody = await orderRes.text().catch(() => '');
      console.error(`LS API auth error: ${orderRes.status} — ${errBody}`);
      return res.status(502).json({ error: 'Subscription service authentication failed. The site owner needs to check the LEMONSQUEEZY_API_KEY setting.' });
    } else {
      // ID lookup failed — try searching by order_number as fallback
      // (customers often enter their order_number from confirmation emails)
      const errBody = await orderRes.text().catch(() => '');
      console.error(`LS API order-by-id miss: ${orderRes.status} for ${orderId} — ${errBody}`);

      let searchUrl = `https://api.lemonsqueezy.com/v1/orders?sort=-createdAt&page[size]=25`;
      if (expectedStoreId) searchUrl += `&filter[store_id]=${expectedStoreId}`;

      const listRes = await fetch(searchUrl, { headers: lsHeaders });
      if (listRes.ok) {
        const listData = await listRes.json();
        const match = (listData.data || []).find(o =>
          String(o.attributes.order_number) === orderId
        );
        if (match) orderData = { data: match };
      }
    }

    if (!orderData) {
      return res.status(400).json({ error: 'Order not found. Please check your order number and try again, or log in with your email.' });
    }

    const order = orderData.data?.attributes;

    if (!order || order.status === 'refunded') {
      return res.status(400).json({ error: 'This order is not valid or has been refunded. Please contact support if you believe this is an error.' });
    }

    // Validate order belongs to our store
    if (expectedStoreId && String(order.store_id) !== expectedStoreId) {
      console.error(`Order store_id mismatch: ${order.store_id}`);
      return res.status(400).json({ error: 'This order ID does not belong to ScentWise. Please check your order number and try again.' });
    }

    // Validate order is for our product
    if (expectedProductId && String(order.first_order_item?.product_id) !== expectedProductId) {
      console.error(`Order product_id mismatch: ${order.first_order_item?.product_id}`);
      return res.status(400).json({ error: 'This order is for a different product. Please use your ScentWise order number.' });
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
      `sw_sub=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`
    ]);

    return res.status(200).json({ success: true, tier: 'premium', email: customerEmail });

  } catch (err) {
    console.error('Verify subscription error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
