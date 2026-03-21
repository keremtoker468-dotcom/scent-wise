const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin } = require('./_lib/csrf');

// In-memory cache: key → { data, ts }
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour

function cleanCache() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.ts > CACHE_TTL) cache.delete(k);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`unsplash:${ip}`, 10, 60000); // 10 req/min per IP
  if (!rl.allowed) return res.status(429).json([]);

  const q = (req.query.q || '').trim();
  const n = Math.min(Math.max(parseInt(req.query.n) || 1, 1), 5);

  if (!q || q.length > 200) return res.status(400).json([]);

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return res.status(200).json([]); // graceful fallback if no key configured

  // Check cache
  const ck = q.toLowerCase() + ':' + n;
  cleanCache();
  if (cache.has(ck)) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(cache.get(ck).data);
  }

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${n}&orientation=landscape`;
    const r = await fetch(url, {
      headers: { 'Authorization': `Client-ID ${key}` }
    });

    if (!r.ok) return res.status(200).json([]); // graceful fallback

    const body = await r.json();
    const imgs = (body.results || []).map(img => ({
      url: img.urls.regular,
      thumb: img.urls.small,
      alt: img.alt_description || ''
    }));

    cache.set(ck, { data: imgs, ts: Date.now() });

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(imgs);
  } catch {
    return res.status(200).json([]); // graceful fallback on any error
  }
};
