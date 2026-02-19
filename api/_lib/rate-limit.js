// Persistent rate limiter with Upstash Redis fallback to in-memory.
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars to enable Redis.

const store = new Map();
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60000) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now - entry.start > 600000) store.delete(key);
  }
}

function memoryRateLimit(key, max, windowMs) {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.start > windowMs) {
    store.set(key, { count: 1, start: now });
    return { allowed: true, remaining: max - 1 };
  }

  entry.count++;
  if (entry.count > max) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: max - entry.count };
}

// Upstash Redis REST API rate limiter (sliding window)
async function redisRateLimit(key, max, windowMs) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    const now = Date.now();
    const windowKey = `rl:${key}:${Math.floor(now / windowMs)}`;

    // INCR + EXPIRE in a pipeline
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['INCR', windowKey],
        ['PEXPIRE', windowKey, windowMs]
      ])
    });

    if (!resp.ok) throw new Error('Redis error');

    const results = await resp.json();
    const count = results[0]?.result || 0;

    if (count > max) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: max - count };
  } catch (e) {
    // Fall back to in-memory on Redis failure
    console.warn('Redis rate limit failed, using in-memory:', e.message);
    return memoryRateLimit(key, max, windowMs);
  }
}

function rateLimit(key, max, windowMs) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return redisRateLimit(key, max, windowMs);
  }
  return memoryRateLimit(key, max, windowMs);
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';
}

module.exports = { rateLimit, getClientIp };
