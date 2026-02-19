const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { verifyOwnerToken } = require('./_lib/owner-token');
const { readUsage, readFreeUsage, MAX_MONTHLY_QUERIES, FREE_TRIAL_QUERIES, parseCookies } = require('./_lib/usage');

function verifySubToken(cookieValue, secret) {
  try {
    const decoded = JSON.parse(Buffer.from(cookieValue, 'base64').toString());
    const { token, subId, custId } = decoded;
    if (!token || !subId || !custId) return null;
    const expected = crypto.createHmac('sha256', secret).update(subId + ':' + custId).digest('hex');
    if (Buffer.byteLength(token) === Buffer.byteLength(expected) &&
        crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return { subId, custId, email: decoded.email };
    }
    return null;
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`check-tier:${ip}`, 30, 60000); // 30 requests/min
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' });

  const cookies = parseCookies(req.headers.cookie || '');
  const subSecret = process.env.SUBSCRIPTION_SECRET;
  const ownerKey = process.env.OWNER_KEY;

  if (ownerKey && cookies.sw_owner) {
    if (verifyOwnerToken(cookies.sw_owner, ownerKey)) {
      return res.status(200).json({ tier: 'owner' });
    }
  }

  if (subSecret && cookies.sw_sub) {
    const sub = verifySubToken(cookies.sw_sub, subSecret);
    if (sub) {
      // Periodically re-validate subscription with LS API
      // Use sw_revalidated cookie to throttle (once per 24h)
      const lsApiKey = process.env.LEMONSQUEEZY_API_KEY;
      const needsRevalidation = lsApiKey && !cookies.sw_revalidated;
      const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

      if (needsRevalidation) {
        try {
          const orderRes = await fetch(`https://api.lemonsqueezy.com/v1/orders/${sub.subId}`, {
            headers: { 'Authorization': `Bearer ${lsApiKey}`, 'Accept': 'application/vnd.api+json' }
          });
          if (orderRes.ok) {
            const orderData = await orderRes.json();
            const orderAttrs = orderData.data?.attributes;
            const status = orderAttrs?.status;
            const expectedProductId = process.env.LEMONSQUEEZY_PRODUCT_ID || '840512';
            if (expectedProductId && String(orderAttrs?.first_order_item?.product_id) !== expectedProductId) {
              // Order doesn't belong to our product — clear cookie
              res.setHeader('Set-Cookie', [`sw_sub=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? '; Secure' : ''}`]);
              return res.status(200).json({ tier: 'free' });
            }
            if (status === 'refunded' || status === 'paused' || status === 'expired') {
              // Subscription no longer active — clear cookie
              res.setHeader('Set-Cookie', [`sw_sub=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? '; Secure' : ''}`]);
              return res.status(200).json({ tier: 'free' });
            }
          }
          // Set revalidation throttle cookie (24h)
          const existing = res.getHeader('Set-Cookie') || [];
          const setCookies = Array.isArray(existing) ? [...existing] : [existing];
          setCookies.push(`sw_revalidated=1; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${isProduction ? '; Secure' : ''}`);
          res.setHeader('Set-Cookie', setCookies);
        } catch (err) {
          // LS API unreachable — trust the local cookie, don't block the user
          console.error('LS revalidation error:', err.message);
        }
      }

      const usage = readUsage(req, sub.custId, subSecret);
      return res.status(200).json({
        tier: 'premium',
        email: sub.email,
        usage: usage.count,
        limit: MAX_MONTHLY_QUERIES
      });
    }
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [`sw_sub=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? '; Secure' : ''}`]);
  }

  // Return free trial usage for anonymous users
  const trialSecret = process.env.SUBSCRIPTION_SECRET || process.env.OWNER_KEY;
  if (trialSecret) {
    const freeUsage = await readFreeUsage(req, ip, trialSecret);
    return res.status(200).json({
      tier: 'free',
      freeUsed: freeUsage.count,
      freeLimit: FREE_TRIAL_QUERIES
    });
  }

  return res.status(200).json({ tier: 'free', freeUsed: 0, freeLimit: FREE_TRIAL_QUERIES });
};
