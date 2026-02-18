// In-memory rate limiter for Vercel serverless functions.
// Provides protection within a container's warm lifecycle (~5-15 min).
// For production-grade rate limiting, consider Vercel KV or Upstash Redis.
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

function rateLimit(key, max, windowMs) {
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

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';
}

module.exports = { rateLimit, getClientIp };
