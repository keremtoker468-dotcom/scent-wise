const path = require('path');
const fs = require('fs');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');

let cachedData = null;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit to prevent scraping (5 requests/min per IP)
  const ip = getClientIp(req);
  const rl = await rateLimit(`perfumes:${ip}`, 5, 60000);
  if (!rl.allowed) { res.setHeader('Retry-After', rl.retryAfter || 60); return res.status(429).json({ error: 'Too many requests' }); }

  // Cache the file read in memory across warm invocations
  if (!cachedData) {
    const filePath = path.join(process.cwd(), 'public', 'perfumes.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    // Extract the array from "const SI=[...];"
    const match = content.match(/const SI\s*=\s*(\[[\s\S]*\]);?/);
    if (match) {
      cachedData = match[1];
    }
  }

  if (!cachedData) {
    return res.status(500).json({ error: 'Perfume data not found' });
  }

  // Immutable cache for 1 day (data rarely changes)
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).end(cachedData);
};
