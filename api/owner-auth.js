const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin } = require('./_lib/csrf');
const { makeOwnerToken } = require('./_lib/owner-token');

module.exports = async function handler(req, res) {
  // --- Login ---
  if (req.method === 'POST') {
    if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

    const ip = getClientIp(req);
    const rl = rateLimit(`owner-auth:${ip}`, 5, 60000); // 5 attempts/min
    if (!rl.allowed) return res.status(429).json({ error: 'Too many attempts. Try again later.' });

    const { key } = req.body || {};
    const ownerKey = process.env.OWNER_KEY;

    if (!ownerKey) return res.status(500).json({ error: 'Server not configured' });
    if (!key || typeof key !== 'string' || Buffer.byteLength(key) !== Buffer.byteLength(ownerKey) ||
        !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ownerKey))) {
      return res.status(401).json({ error: 'Invalid key' });
    }

    const token = makeOwnerToken(ownerKey);
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    const maxAge = 30 * 24 * 60 * 60;

    res.setHeader('Set-Cookie', [
      `sw_owner=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`
    ]);

    return res.status(200).json({ success: true, tier: 'owner' });
  }

  // --- Logout ---
  if (req.method === 'DELETE') {
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
      `sw_owner=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? '; Secure' : ''}`,
      `sw_sub=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? '; Secure' : ''}`,
      `sw_usage=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? '; Secure' : ''}`
    ]);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
