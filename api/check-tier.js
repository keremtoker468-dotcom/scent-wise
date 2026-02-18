const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { verifyOwnerToken } = require('./_lib/owner-token');
const { readUsage, MAX_MONTHLY_QUERIES, parseCookies } = require('./_lib/usage');

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
  const rl = rateLimit(`check-tier:${ip}`, 30, 60000); // 30 requests/min
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

  return res.status(200).json({ tier: 'free' });
};
