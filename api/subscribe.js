const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin, validateContentType, isBodyTooLarge } = require('./_lib/csrf');
const { readOrMintDeviceId, writeEmailFlag } = require('./_lib/usage');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Consent records are kept for 3 years after they lapse (Ticari İletişim Yönetmeliği), so 4 years from opt-in.
const EMAIL_TTL = 4 * 365 * 24 * 60 * 60;
// Bump when the opt-in wording next to the checkbox changes; it is stored with
// each consent so we can show what a subscriber agreed to (ETK 6563 m.6/m.10).
const CONSENT_VERSION = 'newsletter-v1-2026-10';

// Record a newsletter opt-in in Redis keyed by deviceId: who, when, from where
// and under which wording. Only called when the box was ticked; an unlock
// without consent stores nothing, since there is no purpose to keep it for.
// Non-blocking: if Redis is down, the HMAC cookie still unlocks the gate.
async function redisStoreGateEmail(deviceId, email) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !deviceId) return false;
  try {
    const key = `sw_email:${deviceId}`;
    const payload = JSON.stringify({ email, ts: Date.now(), consent: CONSENT_VERSION, source: 'gate' });
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['SET', key, payload],
        ['EXPIRE', key, EMAIL_TTL]
      ])
    });
    return resp.ok;
  } catch { return false; }
}

async function subscribeBeehiiv(cleanEmail, campaign) {
  const beehiivKey = process.env.BEEHIIV_API_KEY;
  const beehiivPub = process.env.BEEHIIV_PUBLICATION_ID;
  if (!beehiivKey || !beehiivPub) return;
  try {
    const r = await fetch(`https://api.beehiiv.com/v2/publications/${beehiivPub}/subscriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${beehiivKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        reactivate_existing: false,
        // Beehiiv handles the welcome email + List-Unsubscribe header end-to-end.
        // Configure the welcome automation in the Beehiiv dashboard, not here.
        send_welcome_email: true,
        utm_source: 'website',
        utm_medium: 'organic',
        utm_campaign: campaign
      })
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('Beehiiv subscribe error:', r.status, err);
    }
  } catch (err) { console.error('Beehiiv error:', err); }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
  if (!validateContentType(req)) return res.status(415).json({ error: 'Content-Type must be application/json' });
  if (isBodyTooLarge(req)) return res.status(413).json({ error: 'Request too large' });

  const body = req.body || {};
  const action = body.action === 'gate' ? 'gate' : 'newsletter';
  const ip = getClientIp(req);
  // Separate rate-limit buckets so the two flows don't starve each other.
  const rl = await rateLimit(`subscribe:${action}:${ip}`, action === 'gate' ? 5 : 3, 60000);
  if (!rl.allowed) { res.setHeader('Retry-After', rl.retryAfter || 60); return res.status(429).json({ error: 'Too many attempts. Please wait a moment.' }); }

  const { email } = body;
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  // Marketing email needs its own, freely given opt-in (ETK 6563 m.6, KVKK m.5):
  // it may not be the price of the free picks, so the box is separate and unticked.
  const marketing = body.marketing === true;

  // ── GATE path: set HMAC cookie so the frontend can unlock queries 2–3 ──
  if (action === 'gate') {
    const subSecret = process.env.SUBSCRIPTION_SECRET;
    if (!subSecret) {
      console.error('Missing SUBSCRIPTION_SECRET for gate flow');
      return res.status(500).json({ error: 'Server not configured' });
    }
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    const { deviceId } = readOrMintDeviceId(req, res, subSecret, isProduction);
    writeEmailFlag(res, deviceId, subSecret, isProduction);
    // Await side-effects so Vercel doesn't freeze the function before they run.
    // Gate unlock must succeed even if marketing infra is down, so each is guarded.
    if (marketing) {
      await redisStoreGateEmail(deviceId, cleanEmail).catch(() => {});
      await subscribeBeehiiv(cleanEmail, 'gate_unlock').catch(() => {});
    }
    return res.status(200).json({ success: true, emailGiven: true });
  }

  // ── Newsletter path: register with Beehiiv (which sends the welcome email) ──
  if (!marketing) return res.status(400).json({ error: 'Tick the box to agree to receive the newsletter.' });
  try {
    await subscribeBeehiiv(cleanEmail, 'newsletter_signup');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
