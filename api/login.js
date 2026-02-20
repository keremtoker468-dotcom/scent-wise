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
  const rl = await rateLimit(`login:${ip}`, 5, 60000); // 5 attempts/min
  if (!rl.allowed) return res.status(429).json({ error: 'Too many attempts. Try again later.' });

  const { email } = req.body;
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Missing email' });

  const emailClean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
    return res.status(400).json({ error: 'Invalid email format' });
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
    let url = `https://api.lemonsqueezy.com/v1/orders?filter[user_email]=${encodeURIComponent(emailClean)}`;
    if (expectedStoreId) url += `&filter[store_id]=${expectedStoreId}`;
    url += '&sort=-created_at&page[size]=10';

    const ordersRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${lsApiKey}`,
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      }
    });

    if (!ordersRes.ok) {
      const errBody = await ordersRes.text().catch(() => '');
      console.error(`LS orders API error: ${ordersRes.status} — ${errBody}`);
      if (ordersRes.status === 401 || ordersRes.status === 403) {
        return res.status(502).json({ error: 'Subscription service authentication failed. The site owner needs to check the LEMONSQUEEZY_API_KEY setting.' });
      }
      return res.status(502).json({ error: `Could not look up subscription (upstream HTTP ${ordersRes.status}). Please try again later.` });
    }

    const ordersData = await ordersRes.json();
    const orders = ordersData.data || [];

    // Find the first valid order for our product
    const validOrder = orders.find(order => {
      const attrs = order.attributes;
      if (attrs.status === 'refunded') return false;
      if (expectedProductId && String(attrs.first_order_item?.product_id) !== expectedProductId) return false;
      return true;
    });

    if (!validOrder) {
      return res.status(404).json({ error: 'No active subscription found for this email. Please make sure you\'re using the same email address from your LemonSqueezy purchase.' });
    }

    const subscriptionId = String(validOrder.id);
    const customerId = String(validOrder.attributes.customer_id);
    const customerEmail = validOrder.attributes.user_email || emailClean;

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
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
