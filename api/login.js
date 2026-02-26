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

  const lsHeaders = {
    'Authorization': `Bearer ${lsApiKey}`,
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json'
  };

  try {
    // Step 1: Find customer by email
    // We fetch customers by store_id and match email locally with pagination,
    // because filter[email] returns HTTP 400 on the LemonSqueezy API.
    let customers = [];
    let custUrl = 'https://api.lemonsqueezy.com/v1/customers?page[size]=100';
    if (expectedStoreId) custUrl += `&filter[store_id]=${expectedStoreId}`;

    const MAX_PAGES = 10; // Safety limit to prevent infinite loops
    let pageUrl = custUrl;

    for (let page = 0; page < MAX_PAGES; page++) {
      const custRes = await fetch(pageUrl, { headers: lsHeaders });

      if (!custRes.ok) {
        const errBody = await custRes.text().catch(() => '');
        console.error(`LS customers API error: ${custRes.status} — ${errBody}`);
        let detail = '';
        try { detail = JSON.parse(errBody).errors?.[0]?.detail || ''; } catch {}
        if (custRes.status === 401 || custRes.status === 403) {
          return res.status(502).json({ error: 'Subscription service authentication failed. The site owner needs to check the LEMONSQUEEZY_API_KEY setting.' });
        }
        return res.status(502).json({ error: 'Could not look up subscription. Please try again later.' });
      }

      const custData = await custRes.json();
      // Filter by email locally since the API filter[email] param is unreliable
      const matched = (custData.data || []).filter(c =>
        c.attributes.email && c.attributes.email.toLowerCase() === emailClean
      );
      customers.push(...matched);

      // Stop paginating once we found a match or there are no more pages
      if (customers.length > 0) break;
      const nextUrl = custData.links?.next;
      if (!nextUrl) break;
      pageUrl = nextUrl;
    }

    if (customers.length === 0) {
      return res.status(404).json({ error: 'No active subscription found for this email. Please make sure you\'re using the same email address from your LemonSqueezy purchase.' });
    }

    // Step 2: Get orders for this customer via the relationship endpoint
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
    const customerEmail = validOrder.attributes.user_email || emailClean;

    const token = makeToken(subscriptionId, String(customerId), subSecret);
    const cookieValue = Buffer.from(JSON.stringify({
      token, subId: subscriptionId, custId: String(customerId), email: customerEmail
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
