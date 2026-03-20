/**
 * Dynamic OG image generator — returns an SVG social card.
 * Works as a regular serverless function (no Edge runtime needed).
 *
 * Usage: /api/og?title=Dior+Sauvage&brand=Dior&rating=4.5&accords=Aromatic,Fresh
 */

module.exports = function handler(req, res) {
  const { title, brand, rating, accords, type } = req.query || {};
  const t = title || 'ScentWise';
  const b = brand || '';
  const r = rating || '';
  const a = accords ? accords.split(',').slice(0, 5) : [];
  const tp = type || 'perfume';

  const typeLabel = tp === 'brand' ? 'Brand Collection' : tp === 'note' ? 'Fragrance Note' : tp === 'blog' ? 'Blog' : 'Fragrance Profile';
  const fontSize = t.length > 40 ? 38 : 48;

  const accordTags = a.map((acc, i) =>
    `<rect x="${10 + i * 110}" y="520" width="100" height="28" rx="14" fill="rgba(201,169,110,0.12)" stroke="rgba(201,169,110,0.25)" stroke-width="1"/>
     <text x="${60 + i * 110}" y="538" text-anchor="middle" fill="#c9a96e" font-size="12" font-weight="500">${esc(acc.trim())}</text>`
  ).join('\n    ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#09090b"/>
      <stop offset="50%" stop-color="#16161a"/>
      <stop offset="100%" stop-color="#0f0f12"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.7" cy="0.3" r="0.5">
      <stop offset="0%" stop-color="rgba(201,169,110,0.08)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Logo -->
  <text x="60" y="70" fill="#c9a96e" font-family="Georgia,serif" font-size="24" font-weight="700" letter-spacing="0.5">ScentWise</text>
  <text x="200" y="70" fill="#a8a29e" font-family="sans-serif" font-size="14">${esc(typeLabel)}</text>

  <!-- Brand -->
  ${b ? `<text x="60" y="260" fill="#a8a29e" font-family="sans-serif" font-size="20">${esc(b)}</text>` : ''}

  <!-- Title -->
  <text x="60" y="${b ? 320 : 300}" fill="#f0ece4" font-family="Georgia,serif" font-size="${fontSize}" font-weight="700">${esc(t.length > 50 ? t.slice(0, 50) + '...' : t)}</text>

  <!-- Rating -->
  ${r ? `<text x="60" y="${b ? 370 : 350}" fill="#c9a96e" font-family="sans-serif" font-size="22" font-weight="700">${esc(r)}/5</text>
  <text x="120" y="${b ? 370 : 350}" fill="#a8a29e" font-family="sans-serif" font-size="16">Community Rating</text>` : ''}

  <!-- Accords -->
  ${a.length ? accordTags : `<text x="60" y="530" fill="#a8a29e" font-family="sans-serif" font-size="16">AI-Powered Fragrance Advisor — 75,000+ Perfumes</text>`}

  <!-- URL -->
  <text x="1140" y="590" text-anchor="end" fill="#a8a29e" font-family="sans-serif" font-size="16">scent-wise.com</text>

  <!-- Bottom line -->
  <rect x="60" y="580" width="200" height="2" rx="1" fill="rgba(201,169,110,0.2)"/>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
  return res.status(200).send(svg);
};

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
