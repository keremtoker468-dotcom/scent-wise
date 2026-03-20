const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin } = require('./_lib/csrf');
const { verifyOwnerToken } = require('./_lib/owner-token');
const { parseCookies } = require('./_lib/usage');

// In-memory fallback for feedback storage
const feedbackStore = [];

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
  const ip = getClientIp(req);

  // POST — submit feedback
  if (req.method === 'POST') {
    if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

    const rl = await rateLimit(`feedback:${ip}`, 10, 60000); // 10/min
    if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' });

    const { helpful, text, mode } = req.body || {};
    if (typeof helpful !== 'boolean') {
      return res.status(400).json({ error: 'Missing "helpful" field (boolean)' });
    }
    if (text && (typeof text !== 'string' || text.length > 500)) {
      return res.status(400).json({ error: 'Feedback text must be a string under 500 chars' });
    }

    const entry = {
      helpful,
      text: text ? text.trim().slice(0, 500) : '',
      mode: typeof mode === 'string' ? mode.slice(0, 20) : '',
      ts: Date.now()
    };

    // Store in Redis list (capped at 1000 entries)
    const saved = await redisCmd('POST', '/', ['LPUSH', 'sw:feedback', JSON.stringify(entry)]);
    if (saved) {
      await redisCmd('POST', '/', ['LTRIM', 'sw:feedback', '0', '999']);
    } else {
      // In-memory fallback
      feedbackStore.unshift(entry);
      if (feedbackStore.length > 200) feedbackStore.length = 200;
    }

    return res.status(200).json({ ok: true });
  }

  // GET — retrieve feedback (owner-only for full list, public for stats + top testimonials)
  if (req.method === 'GET') {
    const rl = await rateLimit(`feedback-read:${ip}`, 30, 60000);
    if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' });

    // Check if owner for full list access
    const cookies = parseCookies(req.headers.cookie || '');
    const ownerKey = process.env.OWNER_KEY;
    const isOwner = ownerKey && cookies.sw_owner && verifyOwnerToken(cookies.sw_owner, ownerKey);

    let entries = [];
    const redisResult = await redisCmd('POST', '/', ['LRANGE', 'sw:feedback', '0', '199']);
    if (redisResult && redisResult.result) {
      entries = redisResult.result.map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
    } else {
      entries = feedbackStore.slice(0, 200);
    }

    if (isOwner) {
      return res.status(200).json({ entries });
    }

    // Public: return aggregate stats + top positive testimonials (with text)
    const total = entries.length;
    const positive = entries.filter(e => e.helpful).length;
    const testimonials = entries
      .filter(e => e.helpful && e.text && e.text.length >= 10)
      .slice(0, 5)
      .map(e => ({ text: e.text, mode: e.mode }));

    // Also return total discovery count from Redis counter
    let discoveryCount = 0;
    const countResult = await redisCmd('POST', '/', ['GET', 'sw:discovery_count']);
    if (countResult && countResult.result) discoveryCount = parseInt(countResult.result, 10) || 0;

    return res.status(200).json({ total, positive, testimonials, discoveryCount });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
