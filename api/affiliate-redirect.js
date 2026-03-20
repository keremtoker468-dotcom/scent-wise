const { rateLimit, getClientIp } = require('./_lib/rate-limit');

/**
 * Affiliate redirect endpoint — tracks clicks and redirects to retailer.
 *
 * Usage: /api/affiliate-redirect?retailer=fragrancex&product=dior-sauvage
 *
 * Supported retailers: fragrancex, sephora, amazon
 * All links include rel="sponsored" guidance and proper tracking.
 */

// Affiliate tag configuration — update with real affiliate IDs when approved
const RETAILERS = {
  fragrancex: {
    name: 'FragranceX',
    baseUrl: 'https://www.fragrancex.com/products/_cid_cologne-am-lid_',
    affiliateParam: 'sid',
    affiliateId: process.env.FRAGRANCEX_AFF_ID || '',
    searchUrl: 'https://www.fragrancex.com/search?q='
  },
  sephora: {
    name: 'Sephora',
    baseUrl: 'https://www.sephora.com/search?keyword=',
    affiliateParam: 'om_mmc',
    affiliateId: process.env.SEPHORA_AFF_ID || '',
    searchUrl: 'https://www.sephora.com/search?keyword='
  },
  amazon: {
    name: 'Amazon',
    baseUrl: 'https://www.amazon.com/s?k=',
    affiliateParam: 'tag',
    affiliateId: process.env.AMAZON_AFF_ID || '',
    searchUrl: 'https://www.amazon.com/s?k='
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rl = await rateLimit(`aff:${ip}`, 30, 60000);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { retailer, product, perfume, brand } = req.query;
  const productName = product || (perfume && brand ? `${perfume} ${brand}` : perfume) || '';

  if (!retailer || !productName) {
    return res.status(400).json({ error: 'Missing retailer or product parameter' });
  }

  const config = RETAILERS[retailer.toLowerCase()];
  if (!config) {
    return res.status(400).json({ error: 'Unknown retailer. Supported: ' + Object.keys(RETAILERS).join(', ') });
  }

  // Build redirect URL
  const searchTerm = encodeURIComponent(productName.replace(/-/g, ' '));
  let redirectUrl = config.searchUrl + searchTerm;

  // Append affiliate ID if configured
  if (config.affiliateId) {
    const separator = redirectUrl.includes('?') ? '&' : '?';
    redirectUrl += separator + config.affiliateParam + '=' + encodeURIComponent(config.affiliateId);
  }

  // Log click for analytics (non-blocking)
  // Uses Upstash Redis if available, otherwise silent
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const today = new Date().toISOString().split('T')[0];
      const key = `aff:clicks:${retailer}:${today}`;
      fetch(`${process.env.UPSTASH_REDIS_REST_URL}/INCR/${key}`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
      }).catch(() => {});
      // Also track per-product clicks
      const prodKey = `aff:clicks:${retailer}:${product}:${today}`;
      fetch(`${process.env.UPSTASH_REDIS_REST_URL}/INCR/${prodKey}`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
      }).catch(() => {});
    }
  } catch (e) {
    // Non-blocking — tracking failure shouldn't break redirect
  }

  // 302 redirect to retailer
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', redirectUrl);
  return res.status(302).end();
};
