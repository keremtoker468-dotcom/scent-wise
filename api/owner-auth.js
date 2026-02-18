const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // --- Login ---
  if (req.method === 'POST') {
    const { key } = req.body || {};
    const ownerKey = process.env.OWNER_KEY;

    if (!ownerKey) return res.status(500).json({ error: 'Server not configured' });
    if (!key || typeof key !== 'string' || Buffer.byteLength(key) !== Buffer.byteLength(ownerKey) ||
        !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ownerKey))) {
      return res.status(401).json({ error: 'Invalid key' });
    }

    const token = crypto.createHmac('sha256', ownerKey).update('scentwise-owner-v1').digest('hex');
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
      `sw_sub=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? '; Secure' : ''}`
    ]);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
