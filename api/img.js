const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin } = require('./_lib/csrf');

// In-memory cache for Unsplash queries (same as unsplash.js)
const unsplashCache = new Map();
const UNSPLASH_TTL = 3600000; // 1 hour

function cleanUnsplashCache() {
  const now = Date.now();
  for (const [k, v] of unsplashCache) {
    if (now - v.ts > UNSPLASH_TTL) unsplashCache.delete(k);
  }
}

// Redis helpers for image cache (persistent, no TTL)
async function redisGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(`${url}/GET/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return null;
    const body = await r.json();
    return body.result ? JSON.parse(body.result) : null;
  } catch { return null; }
}

async function redisSet(key, value) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    await fetch(`${url}/SET/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(value))
    });
  } catch {}
}

// Monthly Brave API quota cap (free tier: 1000 queries/month)
const BRAVE_MONTHLY_LIMIT = 1000;

function braveCountKey() {
  const d = new Date();
  return `brave_count:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function braveQuotaCheck() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true; // no Redis = no quota enforcement
  try {
    const r = await fetch(`${url}/GET/${encodeURIComponent(braveCountKey())}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return true;
    const body = await r.json();
    const count = parseInt(body.result) || 0;
    return count < BRAVE_MONTHLY_LIMIT;
  } catch { return true; }
}

async function braveIncrement() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  const key = braveCountKey();
  try {
    // INCR + set 35-day TTL for auto-cleanup
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, 3024000]])
    });
  } catch {}
}

// Brave Image Search (free tier: 1000 queries/month with quota cap)
async function searchBrave(query) {
  const key = process.env.BRAVE_SEARCH_KEY;
  if (!key) return null;
  try {
    const url = `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=1&safesearch=strict&spellcheck=false`;
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': key
      }
    });
    if (!r.ok) return null;
    const body = await r.json();
    const img = body.results && body.results[0];
    if (!img) return null;
    return {
      u: (img.properties && img.properties.url) || img.url || '',
      t: (img.thumbnail && img.thumbnail.src) || '',
      a: img.title || ''
    };
  } catch { return null; }
}

// Unsplash Image Search (same logic as unsplash.js)
async function searchUnsplash(query, n) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];

  const ck = query.toLowerCase() + ':' + n;
  cleanUnsplashCache();
  if (unsplashCache.has(ck)) return unsplashCache.get(ck).data;

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${n}&orientation=landscape`;
    const r = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}` }
    });
    if (!r.ok) return [];
    const body = await r.json();
    const imgs = (body.results || []).map(img => ({
      url: img.urls.regular,
      thumb: img.urls.small,
      alt: img.alt_description || ''
    }));
    unsplashCache.set(ck, { data: imgs, ts: Date.now() });
    return imgs;
  } catch { return []; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`img:${ip}`, 30, 60000);
  if (!rl.allowed) { res.setHeader('Retry-After', rl.retryAfter || 60); return res.status(429).json([]); }

  const name = (req.query.name || '').trim();
  const brand = (req.query.brand || '').trim();
  const q = (req.query.q || '').trim();
  const n = Math.min(Math.max(parseInt(req.query.n) || 1, 1), 5);

  // Mode 1: Fragrance-specific lookup (Brave → Unsplash fallback)
  if (name) {
    if (name.length > 200) return res.status(400).json([]);

    const redisKey = 'fi:' + (name + '|' + brand).toLowerCase();

    // Check Redis cache first
    const cached = await redisGet(redisKey);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).json([{ url: cached.u, thumb: cached.t, alt: cached.a }]);
    }

    // Try Brave Image Search (with monthly quota cap)
    const underQuota = await braveQuotaCheck();
    if (underQuota) {
      const braveQuery = name + (brand ? ' ' + brand : '') + ' perfume bottle';
      const braveResult = await searchBrave(braveQuery);
      if (braveResult && braveResult.t) {
        await braveIncrement();
        await redisSet(redisKey, braveResult);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).json([{ url: braveResult.u, thumb: braveResult.t, alt: braveResult.a }]);
      }
    }

    // Fallback to Unsplash
    const fallbackQuery = name + (brand ? ' ' + brand : '') + ' fragrance';
    const imgs = await searchUnsplash(fallbackQuery, 1);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(imgs);
  }

  // Mode 2: Generic query (Unsplash only — for hero images, categories, etc.)
  if (!q || q.length > 200) return res.status(400).json([]);

  const imgs = await searchUnsplash(q, n);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json(imgs);
};
