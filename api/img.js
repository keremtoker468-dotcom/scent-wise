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

// Redis helpers for Bing image cache (persistent, no TTL)
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

// Bing Image Search
async function searchBing(query) {
  const key = process.env.BING_SEARCH_KEY;
  if (!key) return null;
  try {
    const url = `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(query)}&count=1&safeSearch=Strict&imageType=Photo`;
    const r = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': key }
    });
    if (!r.ok) return null;
    const body = await r.json();
    const img = body.value && body.value[0];
    if (!img) return null;
    return {
      u: img.contentUrl,
      t: img.thumbnailUrl,
      a: img.name || ''
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
  const rl = await rateLimit(`img:${ip}`, 15, 60000);
  if (!rl.allowed) return res.status(429).json([]);

  const name = (req.query.name || '').trim();
  const brand = (req.query.brand || '').trim();
  const q = (req.query.q || '').trim();
  const n = Math.min(Math.max(parseInt(req.query.n) || 1, 1), 5);

  // Mode 1: Fragrance-specific lookup (Bing → Unsplash fallback)
  if (name) {
    if (name.length > 200) return res.status(400).json([]);

    const redisKey = 'fi:' + (name + '|' + brand).toLowerCase();

    // Check Redis cache first
    const cached = await redisGet(redisKey);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).json([{ url: cached.u, thumb: cached.t, alt: cached.a }]);
    }

    // Try Bing Image Search
    const bingQuery = name + (brand ? ' ' + brand : '') + ' perfume bottle';
    const bingResult = await searchBing(bingQuery);
    if (bingResult) {
      // Cache permanently in Redis
      await redisSet(redisKey, bingResult);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).json([{ url: bingResult.u, thumb: bingResult.t, alt: bingResult.a }]);
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
