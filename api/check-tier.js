const crypto = require('crypto');

function verifySubToken(cookieValue, secret) {
  try {
    const decoded = JSON.parse(Buffer.from(cookieValue, 'base64').toString());
    const { token, subId, custId } = decoded;
    if (!token || !subId || !custId) return null;
    const expected = crypto.createHmac('sha256', secret).update(subId + ':' + custId).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return { subId, custId, email: decoded.email };
    }
    return null;
  } catch { return null; }
}

function verifyOwnerToken(cookieValue, ownerKey) {
  try {
    const expected = crypto.createHmac('sha256', ownerKey).update('scentwise-owner-v1').digest('hex');
    return crypto.timingSafeEqual(Buffer.from(cookieValue), Buffer.from(expected));
  } catch { return false; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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
    if (sub) return res.status(200).json({ tier: 'premium', email: sub.email });
    const isProduction = req.headers.host && !req.headers.host.includes('localhost');
    res.setHeader('Set-Cookie', [`sw_sub=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? '; Secure' : ''}`]);
  }

  return res.status(200).json({ tier: 'free' });
};

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach(part => {
    const [key, ...val] = part.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  return cookies;
}
