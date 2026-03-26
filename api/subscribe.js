const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin } = require('./_lib/csrf');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`subscribe:${ip}`, 3, 60000); // 3 attempts/min per IP
  if (!rl.allowed) return res.status(429).json({ error: 'Too many attempts. Please wait a moment.' });

  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Graceful fallback: log and return success so UX isn't broken
    console.error('RESEND_API_KEY not configured');
    return res.status(200).json({ ok: true });
  }

  try {
    // Add contact to Resend Audience
    const audienceId = process.env.RESEND_AUDIENCE_ID;

    if (audienceId) {
      // Add to audience (for newsletters/broadcasts)
      const r = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: cleanEmail,
          unsubscribed: false
        })
      });

      if (!r.ok && r.status !== 409) { // 409 = already exists, that's fine
        const err = await r.text();
        console.error('Resend audience error:', r.status, err);
        return res.status(502).json({ error: 'Could not subscribe. Please try again.' });
      }
    }

    // Send welcome email via Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'ScentWise <newsletter@scent-wise.com>';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [cleanEmail],
        subject: 'Welcome to ScentWise — Your Fragrance Journey Begins',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'DM Sans',Arial,sans-serif;color:#f0ece4">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#111;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden">
        <tr><td style="padding:40px 40px 32px;text-align:center;border-bottom:1px solid #1a1a1a">
          <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#c9a96e">ScentWise</p>
          <h1 style="margin:0;font-size:28px;font-weight:600;color:#f0ece4;line-height:1.3">Welcome to the list</h1>
        </td></tr>
        <tr><td style="padding:32px 40px">
          <p style="margin:0 0 20px;font-size:15px;color:#c8bfb0;line-height:1.8">
            You're in. Every week we'll send you curated fragrance picks, trend breakdowns, and the stuff the department store won't tell you.
          </p>
          <p style="margin:0 0 32px;font-size:15px;color:#c8bfb0;line-height:1.8">
            In the meantime, our AI advisor is waiting — describe a mood, an occasion, or just ask "what should I wear tonight?" and get personalized recommendations from 75,000+ fragrances.
          </p>
          <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <a href="https://scent-wise.com" style="display:inline-block;background:linear-gradient(135deg,#c9a96e,#b8944f);color:#0a0a0a;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 36px;font-size:15px">Try AI Advisor Free</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #1a1a1a;text-align:center">
          <p style="margin:0;font-size:12px;color:#4a4542">
            You're receiving this because you subscribed at scent-wise.com.<br>
            <a href="https://scent-wise.com" style="color:#c9a96e;text-decoration:none">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
      })
    });
    // We don't fail if welcome email errors — contact is already saved

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
