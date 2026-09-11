const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin, validateContentType } = require('./_lib/csrf');
const { makeOwnerToken, verifyOwnerToken } = require('./_lib/owner-token');
const { listConversions, sendGa4Ping } = require('./_lib/ga4');

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
  // --- Login ---
  if (req.method === 'POST') {
    if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
    if (!validateContentType(req)) return res.status(415).json({ error: 'Content-Type must be application/json' });

    const ip = getClientIp(req);
    const rl = await rateLimit(`owner-auth:${ip}`, 5, 60000); // 5 attempts/min
    if (!rl.allowed) { res.setHeader('Retry-After', rl.retryAfter || 60); return res.status(429).json({ error: 'Too many attempts. Try again later.' }); }

    const { key } = req.body || {};
    const ownerKey = process.env.OWNER_KEY;

    if (!ownerKey) return res.status(500).json({ error: 'Server not configured' });
    if (!key || typeof key !== 'string' || Buffer.byteLength(key) !== Buffer.byteLength(ownerKey) ||
        !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ownerKey))) {
      return res.status(401).json({ error: 'Invalid key' });
    }

    const token = makeOwnerToken(ownerKey);
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    const maxAge = 30 * 24 * 60 * 60;

    res.setHeader('Set-Cookie', [
      `sw_owner=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`
    ]);

    return res.status(200).json({ success: true, tier: 'owner' });
  }

  // --- Logout ---
  if (req.method === 'DELETE') {
    if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
      `sw_owner=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`,
      `sw_sub=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`,
      `sw_usage=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`
    ]);
    return res.status(200).json({ success: true });
  }

  // --- Owner-only conversion export ---
  // GA4 can only tie a sale to a Google Ads click through the client_id in the
  // buyer's _ga cookie. When that is gone (cookies cleared, paid on another
  // device) the sale is invisible to Ads even though api/webhook.js still saw
  // the click ID. Those orders are kept for 90 days (see _lib/ga4.js) and handed
  // over here as the CSV Google Ads expects at
  // Tools > Data manager > Conversions > Upload.
  //
  // This rides on the owner endpoint rather than getting a file of its own
  // because the Hobby plan caps a deployment at 12 Serverless Functions, and
  // api/ is already at the limit.
  if (req.method === 'GET') {
    const wantsExport = req.query?.export === 'conversions';
    const wantsPing = req.query?.ga4ping === '1';
    if (!wantsExport && !wantsPing) return res.status(400).json({ error: 'Unknown request' });

    const ip = getClientIp(req);
    const rl = await rateLimit(`owner-export:${ip}`, 10, 60000);
    if (!rl.allowed) { res.setHeader('Retry-After', rl.retryAfter || 60); return res.status(429).json({ error: 'Too many requests' }); }

    const ownerKey = process.env.OWNER_KEY;
    const cookies = parseCookies(req.headers.cookie);
    if (!ownerKey || !verifyOwnerToken(cookies.sw_owner, ownerKey)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.setHeader('Cache-Control', 'no-store');

    // Fires a throwaway event at GA4 using this deployment's own credentials,
    // so the Measurement Protocol wiring can be proven before a sale depends
    // on it. See sendGa4Ping in _lib/ga4.js.
    if (wantsPing) {
      const result = await sendGa4Ping();
      return res.status(result.configured ? 200 : 503).json({
        ...result,
        // GA4 accepts events signed with a wrong api_secret and answers 204 all
        // the same, so the response cannot be the proof — Realtime is.
        next: `Open GA4 > Reports > Realtime and look for the "${result.eventName || 'server_ping'}" event. `
            + 'If it does not appear within a minute, GA4_API_SECRET on this deployment is wrong.'
      });
    }

    const rows = await listConversions(req.query.limit);
    if (rows === null) {
      return res.status(503).json({ error: 'No conversion store — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN' });
    }

    if (req.query.format === 'json') return res.status(200).json({ count: rows.length, conversions: rows });

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
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
