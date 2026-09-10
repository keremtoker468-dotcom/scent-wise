// Owner-only export of stored purchase attribution, ready for Google Ads'
// offline conversion import.
//
// GA4 can only tie a sale to a Google Ads click through the client_id that
// lives in the buyer's _ga cookie. When that is gone — cookies cleared, paid on
// another device, analytics consent declined — the sale is invisible to Ads
// even though api/webhook.js still saw the click id. Those orders are kept for
// 90 days (see api/_lib/ga4.js) and this endpoint hands them over as the CSV
// Google Ads expects at Tools > Data manager > Conversions > Upload.

const { verifyOwnerToken } = require('./_lib/owner-token');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { listConversions } = require('./_lib/ga4');

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
};

// Google Ads wants "yyyy-MM-dd HH:mm:ss" alongside the TimeZone parameter row.
function formatConversionTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const csvCell = (v) => {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`convexport:${ip}`, 10, 60000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', rl.retryAfter || 60);
    return res.status(429).json({ error: 'Too many requests' });
  }

  const ownerKey = process.env.OWNER_KEY;
  const cookies = parseCookies(req.headers.cookie);
  if (!ownerKey || !verifyOwnerToken(cookies.sw_owner, ownerKey)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const rows = await listConversions(req.query?.limit);
  if (rows === null) {
    return res.status(503).json({ error: 'No conversion store — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN' });
  }

  res.setHeader('Cache-Control', 'no-store');

  if (req.query?.format === 'json') {
    return res.status(200).json({ count: rows.length, conversions: rows });
  }

  const conversionName = process.env.GOOGLE_ADS_CONVERSION_NAME || 'ScentWise Purchase';
  const lines = [
    'Parameters:TimeZone=UTC',
    'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency'
  ];
  for (const row of rows) {
    const time = formatConversionTime(row.createdAt);
    if (!row.gclid || !time) continue;  // unusable in an upload
    lines.push([
      row.gclid,
      conversionName,
      time,
      Number(row.value) || 0,
      (row.currency || 'USD').toUpperCase()
    ].map(csvCell).join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="scentwise-conversions-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.status(200).send(lines.join('\n') + '\n');
};
