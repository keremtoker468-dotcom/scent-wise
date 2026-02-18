// Server-side usage tracking via HMAC-signed cookie.
// Tracks monthly AI query count per user.
const crypto = require('crypto');

const MAX_MONTHLY_QUERIES = 500;

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function makeSig(secret, userId, count, month) {
  return crypto.createHmac('sha256', secret)
    .update(`usage:${userId}:${count}:${month}`).digest('hex');
}

function parseCookies(cookieHeader) {
  const cookies = {};
  (cookieHeader || '').split(';').forEach(part => {
    const [key, ...val] = part.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  return cookies;
}

function readUsage(req, userId, secret) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies['sw_usage'];
  const month = getCurrentMonth();
  if (!raw) return { count: 0, month };

  try {
    const data = JSON.parse(Buffer.from(raw, 'base64').toString());
    const { c, m, id, sig } = data;

    if (typeof c !== 'number' || !m || !id || !sig) return { count: 0, month };

    const expected = makeSig(secret, userId, c, m);
    if (Buffer.byteLength(sig) !== Buffer.byteLength(expected) ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { count: 0, month }; // tampered
    }

    if (id !== userId || m !== month) {
      return { count: 0, month }; // new month or different user
    }

    return { count: c, month: m };
  } catch {
    return { count: 0, month };
  }
}

function writeUsage(res, userId, count, secret, isProduction) {
  const month = getCurrentMonth();
  const sig = makeSig(secret, userId, count, month);
  const value = Buffer.from(JSON.stringify({ c: count, m: month, id: userId, sig })).toString('base64');

  const existing = res.getHeader('Set-Cookie') || [];
  const cookies = Array.isArray(existing) ? [...existing] : [existing];
  cookies.push(`sw_usage=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${32 * 24 * 60 * 60}${isProduction ? '; Secure' : ''}`);
  res.setHeader('Set-Cookie', cookies);
}

module.exports = { readUsage, writeUsage, MAX_MONTHLY_QUERIES, parseCookies };
