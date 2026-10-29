const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin, validateContentType, isBodyTooLarge } = require('./_lib/csrf');

function makeToken(subscriptionId, customerId, secret) {
  return crypto.createHmac('sha256', secret).update(subscriptionId + ':' + customerId).digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
  if (!validateContentType(req)) return res.status(415).json({ error: 'Content-Type must be application/json' });
  if (isBodyTooLarge(req)) return res.status(413).json({ error: 'Request too large' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`verify-sub:${ip}`, 10, 60000); // 10 attempts/min
  if (!rl.allowed) { res.setHeader('Retry-After', rl.retryAfter || 60); return res.status(429).json({ error: 'Too many attempts. Try again later.' }); }

  // Both the order number and the checkout email are required. Order numbers are
  // sequential and emails are often public, so either one alone would let anyone
  // claim someone else's purchase (and learn the buyer's email from the response).
  let { orderId, email } = req.body || {};
  if (typeof orderId !== 'string' || typeof email !== 'string') {
    return res.status(400).json({ error: 'Enter the email you used at checkout and the order number from your receipt.' });
  }
  // Sanitize: strip #, spaces, and non-numeric characters
  orderId = orderId.trim().replace(/^#/, '').replace(/[^\d]/g, '');
  if (!orderId || orderId.length > 20) {
    return res.status(400).json({ error: 'Invalid order ID format. Enter the numeric order number (e.g. 2944561).' });
  }
  const emailClean = email.trim().toLowerCase();
  if (emailClean.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const lsApiKey = process.env.LEMONSQUEEZY_API_KEY;
  const subSecret = process.env.SUBSCRIPTION_SECRET;
  const expectedStoreId = process.env.LEMONSQUEEZY_STORE_ID;
  const expectedProductId = process.env.LEMONSQUEEZY_PRODUCT_ID;

  if (!lsApiKey || !subSecret) {
    console.error('Missing LEMONSQUEEZY_API_KEY or SUBSCRIPTION_SECRET');
    return res.status(500).json({ error: 'Server not configured' });
  }
  // Required — without it any order in the store would unlock Premium.
  if (!expectedProductId) {
    console.error('Missing LEMONSQUEEZY_PRODUCT_ID');
    return res.status(500).json({ error: 'Server not configured' });
  }

  // One answer for every mismatch, so the endpoint can't be used to check
  // whether an email or an order number belongs to a buyer.
  const NOT_FOUND = { error: 'No paid ScentWise order matches that email and order number. Check both against your receipt, or contact scentwise.com@gmail.com.' };

  try {
    const lsHeaders = {
      'Authorization': `Bearer ${lsApiKey}`,
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json'
    };

    // The customer's own orders, matched on either the API id or the receipt's order number.
    let listUrl = `https://api.lemonsqueezy.com/v1/orders?page[size]=50&filter[user_email]=${encodeURIComponent(emailClean)}`;
    if (expectedStoreId) listUrl += `&filter[store_id]=${encodeURIComponent(expectedStoreId)}`;
    const listRes = await fetch(listUrl, { headers: lsHeaders });
    if (listRes.status === 401 || listRes.status === 403) {
      console.error(`LS API auth error: ${listRes.status}`);
      return res.status(502).json({ error: 'Subscription service authentication failed. The site owner needs to check the LEMONSQUEEZY_API_KEY setting.' });
    }
    if (!listRes.ok) {
      console.error(`LS orders lookup failed: ${listRes.status}`);
      return res.status(502).json({ error: 'Could not look up your order. Please try again later.' });
    }
    const listData = await listRes.json();
    const match = (listData.data || []).find(o =>
      String(o.id) === orderId || String(o.attributes?.order_number) === orderId
    );
    const orderData = match ? { data: match } : null;
    const order = orderData?.data?.attributes;

    // LS filters by email already; re-check locally in case the filter is ignored.
    if (!order || String(order.user_email || '').toLowerCase() !== emailClean) {
      return res.status(404).json(NOT_FOUND);
    }
    // Only a settled payment unlocks Premium: pending, failed, refunded and
    // partially refunded orders do not.
    if (order.status !== 'paid') {
      return res.status(404).json(NOT_FOUND);
    }
    if (expectedStoreId && String(order.store_id) !== expectedStoreId) {
      console.error(`Order store_id mismatch: ${order.store_id}`);
      return res.status(404).json(NOT_FOUND);
    }
    if (String(order.first_order_item?.product_id) !== expectedProductId) {
      console.error(`Order product_id mismatch: ${order.first_order_item?.product_id}`);
      return res.status(404).json(NOT_FOUND);
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
    const maxAge = 365 * 24 * 60 * 60; // one-time lifetime purchase

    res.setHeader('Set-Cookie', [
      `sw_sub=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`
    ]);

    return res.status(200).json({ success: true, tier: 'premium', email: customerEmail });

  } catch (err) {
    console.error('Verify subscription error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
