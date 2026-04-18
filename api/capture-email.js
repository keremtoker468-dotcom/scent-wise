// Email capture endpoint — stores user email in Redis (keyed by device ID)
// and sets a signed cookie `sw_email` so the client can unlock queries 2–3
// in full. No password, no account — just an email handshake.
const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin, validateContentType, isBodyTooLarge } = require('./_lib/csrf');
const { readOrMintDeviceId } = require('./_lib/usage');

const EMAIL_TTL = 365 * 24 * 60 * 60; // 1 year
const MAX_EMAIL_LEN = 160;

function signEmailFlag(deviceId, secret) {
  return crypto.createHmac('sha256', secret).update('sw-email:' + deviceId).digest('hex');
}

async function redisSetEmail(deviceId, email) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  try {
    const key = `sw_email:${deviceId}`;
    const payload = JSON.stringify({ email, ts: Date.now() });
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['SET', key, payload],
        ['EXPIRE', key, EMAIL_TTL]
      ])
    });
    return resp.ok;
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
  if (!validateContentType(req)) return res.status(415).json({ error: 'Content-Type must be application/json' });
  if (isBodyTooLarge(req)) return res.status(413).json({ error: 'Request too large' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`email-capture:${ip}`, 5, 60000); // 5/min
  if (!rl.allowed) {
    res.setHeader('Retry-After', rl.retryAfter || 60);
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const subSecret = process.env.SUBSCRIPTION_SECRET;
  if (!subSecret) {
    console.error('Missing SUBSCRIPTION_SECRET');
    return res.status(500).json({ error: 'Server not configured' });
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Missing email' });

  const clean = email.trim().toLowerCase();
  if (clean.length > MAX_EMAIL_LEN) return res.status(400).json({ error: 'Email too long' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const { deviceId } = readOrMintDeviceId(req, res, subSecret, isProduction);
  await redisSetEmail(deviceId, clean).catch(() => {});

  const sig = signEmailFlag(deviceId, subSecret);
  const cookieVal = '1.' + sig;

  const existing = res.getHeader('Set-Cookie') || [];
  const existingArr = Array.isArray(existing) ? existing : [existing].filter(Boolean);
  existingArr.push(`sw_email=${cookieVal}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${EMAIL_TTL}${isProduction ? '; Secure' : ''}`);
  res.setHeader('Set-Cookie', existingArr);

  return res.status(200).json({ success: true, emailGiven: true });
};
