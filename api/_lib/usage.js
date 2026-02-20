// Server-side usage tracking via HMAC-signed cookie + server-side IP store.
// Premium users: cookie-based (tied to subscription identity).
// Free users: server-side IP tracking (Redis primary, in-memory fallback)
//   to prevent incognito/private-tab bypass. Cookie kept as secondary layer.
const crypto = require('crypto');

const MAX_MONTHLY_QUERIES = 500;
const FREE_TRIAL_QUERIES = 3;

// In-memory fallback store for free usage (survives within a single function instance)
const freeStore = new Map();
let freeStoreCleanup = Date.now();

function cleanupFreeStore() {
  const now = Date.now();
  if (now - freeStoreCleanup < 300000) return; // cleanup every 5 min
  freeStoreCleanup = now;
  const currentMonth = getCurrentMonth();
  for (const [key, entry] of freeStore) {
    if (entry.m !== currentMonth) freeStore.delete(key);
  }
}

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function deriveUsageKey(secret) {
  return crypto.createHmac('sha256', secret).update('sw-usage-key-v1').digest();
}

function makeSig(secret, userId, count, month) {
  return crypto.createHmac('sha256', deriveUsageKey(secret))
    .update(`${userId}:${count}:${month}`).digest('hex');
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
  cookies.push(`sw_usage=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${32 * 24 * 60 * 60}${isProduction ? '; Secure' : ''}`);
  res.setHeader('Set-Cookie', cookies);
}

// --- Free usage: server-side IP tracking (Redis + in-memory fallback) ---

async function redisGetFreeUsage(ip, month) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const key = `sw_free:${ip}:${month}`;
    const resp = await fetch(`${url}/GET/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const count = parseInt(data.result, 10);
    return isNaN(count) ? 0 : count;
  } catch {
    return null;
  }
}

async function redisSetFreeUsage(ip, month, count) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  try {
    const key = `sw_free:${ip}:${month}`;
    // SET with EX = 33 days (auto-expire after month rolls over)
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['SET', key, String(count)],
        ['EXPIRE', key, 33 * 24 * 60 * 60]
      ])
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function memoryGetFreeUsage(ip, month) {
  cleanupFreeStore();
  const key = `${ip}:${month}`;
  const entry = freeStore.get(key);
  if (!entry || entry.m !== month) return 0;
  return entry.c;
}

function memorySetFreeUsage(ip, month, count) {
  const key = `${ip}:${month}`;
  freeStore.set(key, { c: count, m: month });
}

function readCookieFreeUsage(req, ip, secret) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies['sw_free'];
  const month = getCurrentMonth();
  if (!raw) return 0;

  try {
    const data = JSON.parse(Buffer.from(raw, 'base64').toString());
    const { c, m, sig } = data;

    if (typeof c !== 'number' || !m || !sig) return 0;

    const expected = makeSig(secret, 'free:' + ip, c, m);
    if (Buffer.byteLength(sig) !== Buffer.byteLength(expected) ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return 0;
    }

    if (m !== month) return 0;
    return c;
  } catch {
    return 0;
  }
}

async function readFreeUsage(req, ip, secret) {
  const month = getCurrentMonth();

  // 1. Try Redis (persistent, survives across function instances and deploys)
  const redisCount = await redisGetFreeUsage(ip, month);
  if (redisCount !== null) {
    return { count: redisCount, month };
  }

  // 2. Fallback to in-memory store (survives within a warm function instance)
  const memCount = memoryGetFreeUsage(ip, month);
  if (memCount > 0) {
    return { count: memCount, month };
  }

  // 3. Final fallback: cookie (can be bypassed by incognito, but better than nothing)
  const cookieCount = readCookieFreeUsage(req, ip, secret);
  return { count: cookieCount, month };
}

async function writeFreeUsage(res, ip, count, secret, isProduction) {
  const month = getCurrentMonth();

  // Write to all layers for defense in depth
  // 1. Redis (primary persistent store)
  await redisSetFreeUsage(ip, month, count);

  // 2. In-memory (warm instance fallback)
  memorySetFreeUsage(ip, month, count);

  // 3. Cookie (client-side layer, helps across different serverless instances when Redis is down)
  const sig = makeSig(secret, 'free:' + ip, count, month);
  const value = Buffer.from(JSON.stringify({ c: count, m: month, sig })).toString('base64');

  const existing = res.getHeader('Set-Cookie') || [];
  const cookies = Array.isArray(existing) ? [...existing] : [existing];
  cookies.push(`sw_free=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${32 * 24 * 60 * 60}${isProduction ? '; Secure' : ''}`);
  res.setHeader('Set-Cookie', cookies);
}

module.exports = { readUsage, writeUsage, readFreeUsage, writeFreeUsage, MAX_MONTHLY_QUERIES, FREE_TRIAL_QUERIES, parseCookies };
