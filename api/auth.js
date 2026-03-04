const crypto = require('crypto');
const { rateLimit, getClientIp } = require('../lib/rate-limit');
const { validateOrigin } = require('../lib/csrf');
const { makeOwnerToken } = require('../lib/owner-token');

function makeSubToken(subscriptionId, customerId, secret) {
  return crypto.createHmac('sha256', secret).update(subscriptionId + ':' + customerId).digest('hex');
}

// Combined handler for /api/login and /api/owner-auth
module.exports = async function handler(req, res) {
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

  // --- Logout (DELETE from owner-auth) ---
  if (req.method === 'DELETE') {
    if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
    res.setHeader('Set-Cookie', [
      `sw_owner=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`,
      `sw_sub=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`,
      `sw_usage=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`
    ]);
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  const body = req.body || {};

  // --- Owner auth (POST with key) ---
  if (body.key !== undefined) {
    const rl = await rateLimit(`owner-auth:${ip}`, 5, 60000);
    if (!rl.allowed) return res.status(429).json({ error: 'Too many attempts. Try again later.' });

    const { key } = body;
    const ownerKey = process.env.OWNER_KEY;

    if (!ownerKey) return res.status(500).json({ error: 'Server not configured' });
    if (!key || typeof key !== 'string' || Buffer.byteLength(key) !== Buffer.byteLength(ownerKey) ||
        !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ownerKey))) {
      return res.status(401).json({ error: 'Invalid key' });
    }

    const token = makeOwnerToken(ownerKey);
    const maxAge = 30 * 24 * 60 * 60;

    res.setHeader('Set-Cookie', [
      `sw_owner=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`
    ]);

    return res.status(200).json({ success: true, tier: 'owner' });
  }

  // --- Email login (POST with email) ---
  const rl = await rateLimit(`login:${ip}`, 5, 60000);
  if (!rl.allowed) return res.status(429).json({ error: 'Too many attempts. Try again later.' });

  const { email } = body;
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

  const lsHeaders = {
    'Authorization': `Bearer ${lsApiKey}`,
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json'
  };

  try {
    let customers = [];
    let custUrl = 'https://api.lemonsqueezy.com/v1/customers?page[size]=100';
    if (expectedStoreId) custUrl += `&filter[store_id]=${expectedStoreId}`;

    const MAX_PAGES = 10;
    let pageUrl = custUrl;

    for (let page = 0; page < MAX_PAGES; page++) {
      const custRes = await fetch(pageUrl, { headers: lsHeaders });

      if (!custRes.ok) {
        const errBody = await custRes.text().catch(() => '');
        console.error(`LS customers API error: ${custRes.status} — ${errBody}`);
        if (custRes.status === 401 || custRes.status === 403) {
          return res.status(502).json({ error: 'Subscription service authentication failed. The site owner needs to check the LEMONSQUEEZY_API_KEY setting.' });
        }
        return res.status(502).json({ error: 'Could not look up subscription. Please try again later.' });
      }

      const custData = await custRes.json();
      const matched = (custData.data || []).filter(c =>
        c.attributes.email && c.attributes.email.toLowerCase() === emailClean
      );
      customers.push(...matched);

      if (customers.length > 0) break;
      const nextUrl = custData.links?.next;
      if (!nextUrl) break;
      pageUrl = nextUrl;
    }

    if (customers.length === 0) {
      return res.status(404).json({ error: 'No active subscription found for this email. Please make sure you\'re using the same email address from your LemonSqueezy purchase.' });
    }

    const customerId = customers[0].id;

    const ordersRes = await fetch(`https://api.lemonsqueezy.com/v1/customers/${customerId}/orders`, {
      headers: lsHeaders
    });

    if (!ordersRes.ok) {
      const errBody = await ordersRes.text().catch(() => '');
      console.error(`LS customer orders API error: ${ordersRes.status} — ${errBody}`);
      return res.status(502).json({ error: `Could not retrieve orders (upstream HTTP ${ordersRes.status}). Please try again later.` });
    }

    const ordersData = await ordersRes.json();
    const orders = ordersData.data || [];

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
    const customerEmail = validOrder.attributes.user_email || emailClean;

    const token = makeSubToken(subscriptionId, String(customerId), subSecret);
    const cookieValue = Buffer.from(JSON.stringify({
      token, subId: subscriptionId, custId: String(customerId), email: customerEmail
    })).toString('base64');

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
