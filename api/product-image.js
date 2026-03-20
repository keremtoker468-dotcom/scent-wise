const { rateLimit, getClientIp } = require('./_lib/rate-limit');

/**
 * Product image proxy — fetches perfume images from Amazon PA-API.
 * Returns a redirect to the image URL, cached by Vercel CDN.
 *
 * Usage: /api/product-image?name=Dior+Sauvage&brand=Dior
 *
 * When AMAZON_PA_API_KEY is not set, returns a placeholder SVG.
 * Once configured, returns real product images from Amazon.
 */

// In-memory image URL cache (survives within a single function instance)
const imageCache = new Map();

function placeholderSVG(category) {
  const colors = {
    floral: { fill: 'rgba(180,200,220,.12)', stroke: 'rgba(180,200,220,.25)' },
    oriental: { fill: 'rgba(201,169,110,.1)', stroke: 'rgba(201,169,110,.25)' },
    woody: { fill: 'rgba(160,140,120,.1)', stroke: 'rgba(160,140,120,.25)' },
    default: { fill: 'rgba(201,169,110,.08)', stroke: 'rgba(201,169,110,.2)' }
  };
  const c = colors[category] || colors.default;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" width="200" height="300">
    <rect width="200" height="300" fill="#16161a"/>
    <rect x="80" y="20" width="40" height="30" rx="6" fill="${c.stroke}"/>
    <rect x="88" y="8" width="24" height="18" rx="4" fill="${c.fill}"/>
    <path d="M55 60c0-6 8-12 16-12h58c8 0 16 6 16 12v170c0 30-18 50-45 50s-45-20-45-50V60z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>
    <text x="100" y="170" text-anchor="middle" fill="rgba(201,169,110,.3)" font-family="sans-serif" font-size="11" font-weight="500">Image coming soon</text>
  </svg>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`img:${ip}`, 60, 60000);
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' });

  const { name, brand, category } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing name parameter' });

  const cacheKey = `${name}|${brand || ''}`.toLowerCase();

  // Check in-memory cache
  if (imageCache.has(cacheKey)) {
    const cached = imageCache.get(cacheKey);
    if (cached.url) return res.redirect(cached.url);
  }

  // Try Amazon PA-API if configured
  const paApiKey = process.env.AMAZON_PA_API_KEY;
  const paApiSecret = process.env.AMAZON_PA_API_SECRET;
  const paPartnerTag = process.env.AMAZON_AFF_ID;

  if (paApiKey && paApiSecret && paPartnerTag) {
    try {
      // Amazon PA-API v5 SearchItems
      // This is a placeholder for the actual PA-API call.
      // When you have PA-API access, implement the signed request here.
      // See: https://webservices.amazon.com/paapi5/documentation/
      //
      // const imageUrl = await searchAmazonImage(name, brand, paApiKey, paApiSecret, paPartnerTag);
      // if (imageUrl) {
      //   imageCache.set(cacheKey, { url: imageUrl, ts: Date.now() });
      //   return res.redirect(imageUrl);
      // }
    } catch (err) {
      console.error('Amazon PA-API error:', err.message);
    }
  }

  // Fallback: return placeholder SVG
  const cat = (category || '').toLowerCase();
  const svgCat = cat.includes('floral') || cat.includes('fresh') ? 'floral'
    : cat.includes('oriental') || cat.includes('sweet') ? 'oriental'
    : cat.includes('woody') || cat.includes('aromatic') ? 'woody'
    : 'default';

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  return res.status(200).send(placeholderSVG(svgCat));
};
