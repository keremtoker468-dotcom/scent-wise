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

// Atomic increment for free trial usage — prevents TOCTOU race conditions
// Returns the new count after increment, or null if Redis is unavailable
async function redisIncrFreeUsage(ip, month) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const key = `sw_free:${ip}:${month}`;
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, 33 * 24 * 60 * 60]
      ])
    });
    if (!resp.ok) return null;
    const results = await resp.json();
    const newCount = results[0]?.result;
    return typeof newCount === 'number' ? newCount : null;
  } catch {
    return null;
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
    return { count: redisCount, month, source: 'redis' };
  }

  // 2. Fallback to in-memory store (survives within a warm function instance)
  // Use the maximum of in-memory and cookie counts to prevent bypass
  const memCount = memoryGetFreeUsage(ip, month);
  const cookieCount = readCookieFreeUsage(req, ip, secret);
  const maxCount = Math.max(memCount, cookieCount);

  return { count: maxCount, month, source: maxCount > 0 ? 'fallback' : 'none' };
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

// ═══════════════ DEVICE-BOUND FREE TIER ═══════════════
// Free usage is now tracked per browser (via signed sw_device cookie) instead of
// per IP. This prevents CGNAT / shared-WiFi users from being locked out before
// they can send their first query. An optional daily-per-IP cap is applied as a
// light abuse guard (via the caller).

function makeDeviceId() {
  return crypto.randomBytes(16).toString('hex');
}

function signDeviceId(deviceId, secret) {
  return crypto.createHmac('sha256', deriveUsageKey(secret)).update('dev:' + deviceId).digest('hex').slice(0, 32);
}

// Read a valid device id from the sw_device cookie, or mint a fresh one and
// set the cookie on the response. Returns { deviceId, isNew }.
function readOrMintDeviceId(req, res, secret, isProduction) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies['sw_device'];
  if (raw) {
    try {
      const data = JSON.parse(Buffer.from(raw, 'base64').toString());
      const { d, s } = data;
      if (typeof d === 'string' && typeof s === 'string' && d.length === 32) {
        const expected = signDeviceId(d, secret);
        if (Buffer.byteLength(s) === Buffer.byteLength(expected) &&
            crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) {
          return { deviceId: d, isNew: false };
        }
      }
    } catch { /* fall through to mint */ }
  }
  const deviceId = makeDeviceId();
  const sig = signDeviceId(deviceId, secret);
  const value = Buffer.from(JSON.stringify({ d: deviceId, s: sig })).toString('base64');
  // 1-year cookie — device identity is long-lived
  const existing = res.getHeader('Set-Cookie') || [];
  const list = Array.isArray(existing) ? [...existing] : [existing];
  list.push(`sw_device=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${365 * 24 * 60 * 60}${isProduction ? '; Secure' : ''}`);
  res.setHeader('Set-Cookie', list);
  return { deviceId, isNew: true };
}

async function redisGetDeviceFreeUsage(deviceId, month) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const key = `sw_free:dev:${deviceId}:${month}`;
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

async function redisIncrDeviceFreeUsage(deviceId, month) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const key = `sw_free:dev:${deviceId}:${month}`;
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, 33 * 24 * 60 * 60]
      ])
    });
    if (!resp.ok) return null;
    const results = await resp.json();
    const newCount = results[0]?.result;
    return typeof newCount === 'number' ? newCount : null;
  } catch {
    return null;
  }
}

// Device-bound cookie counter (fallback when Redis is unavailable).
// Stored as sw_free_d cookie — signed with device id + secret.
function readCookieDeviceFreeUsage(req, deviceId, secret) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies['sw_free_d'];
  const month = getCurrentMonth();
  if (!raw) return 0;
  try {
    const data = JSON.parse(Buffer.from(raw, 'base64').toString());
    const { c, m, sig } = data;
    if (typeof c !== 'number' || !m || !sig) return 0;
    const expected = makeSig(secret, 'dev:' + deviceId, c, m);
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

function writeCookieDeviceFreeUsage(res, deviceId, count, secret, isProduction) {
  const month = getCurrentMonth();
  const sig = makeSig(secret, 'dev:' + deviceId, count, month);
  const value = Buffer.from(JSON.stringify({ c: count, m: month, sig })).toString('base64');
  const existing = res.getHeader('Set-Cookie') || [];
  const list = Array.isArray(existing) ? [...existing] : [existing];
  list.push(`sw_free_d=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${32 * 24 * 60 * 60}${isProduction ? '; Secure' : ''}`);
  res.setHeader('Set-Cookie', list);
}

async function readDeviceFreeUsage(req, deviceId, secret) {
  const month = getCurrentMonth();
  // Redis is authoritative when available
  const redisCount = await redisGetDeviceFreeUsage(deviceId, month);
  if (redisCount !== null) {
    return { count: redisCount, month, source: 'redis' };
  }
  // Fallback: signed cookie only (no IP store)
  const cookieCount = readCookieDeviceFreeUsage(req, deviceId, secret);
  return { count: cookieCount, month, source: cookieCount > 0 ? 'cookie' : 'none' };
}

// ═══════════════ ABUSE GUARD: per-IP daily soft cap ═══════════════
// Prevents a single IP from minting unlimited device cookies in a loop.
// Generous enough that no real user hits it (100 free AI queries per IP per day).
const IP_DAILY_FREE_CAP = 100;

function getCurrentDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function redisIncrIpDaily(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const key = `sw_ipday:${ip}:${getCurrentDay()}`;
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, 26 * 60 * 60]
      ])
    });
    if (!resp.ok) return null;
    const results = await resp.json();
    const newCount = results[0]?.result;
    return typeof newCount === 'number' ? newCount : null;
  } catch {
    return null;
  }
}

async function checkIpDailyCap(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { allowed: true, count: 0, cap: IP_DAILY_FREE_CAP };
  try {
    const key = `sw_ipday:${ip}:${getCurrentDay()}`;
    const resp = await fetch(`${url}/GET/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) return { allowed: true, count: 0, cap: IP_DAILY_FREE_CAP };
    const data = await resp.json();
    const count = parseInt(data.result, 10) || 0;
    return { allowed: count < IP_DAILY_FREE_CAP, count, cap: IP_DAILY_FREE_CAP };
  } catch {
    return { allowed: true, count: 0, cap: IP_DAILY_FREE_CAP };
  }
}

module.exports = {
  readUsage, writeUsage,
  readFreeUsage, writeFreeUsage, redisIncrFreeUsage,
  readOrMintDeviceId, readDeviceFreeUsage, redisIncrDeviceFreeUsage, writeCookieDeviceFreeUsage,
  checkIpDailyCap, redisIncrIpDaily, IP_DAILY_FREE_CAP,
  getCurrentMonth, MAX_MONTHLY_QUERIES, FREE_TRIAL_QUERIES, parseCookies
};
