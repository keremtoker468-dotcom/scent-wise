const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin } = require('./_lib/csrf');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function redisCmd(method, path, body) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`capture-email:${ip}`, 5, 60000); // 5/min
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' });

  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const clean = email.trim().toLowerCase().slice(0, 254);

  // Check for duplicate before adding
  const exists = await redisCmd('POST', '/', ['SISMEMBER', 'sw:emails', clean]);
  if (exists && exists.result === 1) {
    return res.status(200).json({ ok: true, message: 'You\'re already on the list!' });
  }

  // Add to Redis set (deduped) and list (ordered)
  const saved = await redisCmd('POST', '/pipeline', [
    ['SADD', 'sw:emails', clean],
    ['LPUSH', 'sw:email_list', JSON.stringify({ email: clean, ts: Date.now(), ip: ip.slice(0, 8) + '***' })]
  ]);

  if (!saved) {
    return res.status(500).json({ error: 'Could not save email. Please try again.' });
  }

  // Forward to Listmonk if configured (non-blocking)
  const listmonkUrl = process.env.LISTMONK_URL;
  const listmonkUser = process.env.LISTMONK_API_USER || 'admin';
  const listmonkPass = process.env.LISTMONK_API_PASS;
  const listmonkListId = parseInt(process.env.LISTMONK_LIST_ID, 10) || 1;

  if (listmonkUrl && listmonkPass) {
    try {
      await fetch(`${listmonkUrl}/api/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${listmonkUser}:${listmonkPass}`).toString('base64')
        },
        body: JSON.stringify({
          email: clean,
          name: '',
          status: 'enabled',
          lists: [listmonkListId],
          attribs: { source: 'paywall_capture', signed_up: new Date().toISOString() }
        })
      });
    } catch (err) {
      console.error('Listmonk subscriber creation failed:', err.message);
    }
  }

  return res.status(200).json({ ok: true, message: 'You\'re on the list! We\'ll send your matches soon.' });
};
