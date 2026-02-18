const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin } = require('./_lib/csrf');
const { verifyOwnerToken } = require('./_lib/owner-token');
const { readUsage, writeUsage, MAX_MONTHLY_QUERIES, parseCookies } = require('./_lib/usage');

function verifyAccess(req) {
  const cookies = parseCookies(req.headers.cookie);
  const ownerKey = process.env.OWNER_KEY;
  if (ownerKey && cookies.sw_owner) {
    if (verifyOwnerToken(cookies.sw_owner, ownerKey)) {
      return { authorized: true, tier: 'owner', userId: 'owner' };
    }
  }
  const subSecret = process.env.SUBSCRIPTION_SECRET;
  if (subSecret && cookies.sw_sub) {
    try {
      const decoded = JSON.parse(Buffer.from(cookies.sw_sub, 'base64').toString());
      const { token, subId, custId } = decoded;
      if (token && subId && custId) {
        const expected = crypto.createHmac('sha256', subSecret).update(subId + ':' + custId).digest('hex');
        if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
          return { authorized: true, tier: 'premium', userId: `${custId}` };
        }
      }
    } catch {}
  }
  return { authorized: false, tier: 'free', userId: null };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  const rl = rateLimit(`recommend:${ip}`, 20, 60000); // 20 requests/min
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });

  const access = verifyAccess(req);
  if (!access.authorized) {
    return res.status(403).json({ error: 'Premium subscription required', tier: 'free' });
  }

  // Server-side usage enforcement for premium users
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const subSecret = process.env.SUBSCRIPTION_SECRET || process.env.OWNER_KEY;
  let usageCount = 0;

  if (access.tier === 'premium' && subSecret) {
    const usage = readUsage(req, access.userId, subSecret);
    usageCount = usage.count;
    if (usageCount >= MAX_MONTHLY_QUERIES) {
      return res.status(429).json({
        error: 'Monthly query limit reached (500/month). Resets next month.',
        usage: usageCount,
        limit: MAX_MONTHLY_QUERIES
      });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { mode, messages, imageBase64, imageMime } = req.body;
    let parts = [];
    let systemText = '';

    if (mode === 'photo') {
      systemText = 'You are ScentWise — an expert fragrance consultant who matches scents to personal style. Analyze the uploaded photo focusing on clothing style, color palette, accessories and overall aesthetic. Recommend exactly 5 fragrances that match. For each include: **Fragrance Name** by Brand, key notes (top/heart/base), price range ($, $$, $$$), and why it matches. End with 2 budget alternatives.';
      parts = [
        { inlineData: { mimeType: imageMime || 'image/jpeg', data: imageBase64 } },
        { text: systemText + '\n\nAnalyze this style and recommend matching fragrances.' }
      ];
    } else {
      systemText = 'You are ScentWise AI — a world-class fragrance advisor with encyclopedic knowledge of perfumery including designer, niche, and artisanal fragrances. Provide specific, confident recommendations with fragrance names, brands, key notes, price ranges, and reasons. Format with **bold** for fragrance names. Be conversational and knowledgeable.';
      const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1].content : '';
      const history = messages && messages.length > 1
        ? messages.slice(0, -1).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
        : '';
      parts = [{ text: systemText + (history ? '\n\nConversation so far:\n' + history : '') + '\n\nUser: ' + lastMsg }];
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.8 }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini API error: ${response.status}`, errText);
      return res.status(500).json({ error: 'AI service temporarily unavailable' });
    }

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

    // Track usage for premium users after successful AI call
    if (access.tier === 'premium' && subSecret) {
      usageCount++;
      writeUsage(res, access.userId, usageCount, subSecret, isProduction);
    }

    return res.status(200).json({
      result,
      usage: access.tier === 'premium' ? usageCount : undefined,
      limit: access.tier === 'premium' ? MAX_MONTHLY_QUERIES : undefined
    });

  } catch (err) {
    console.error('Recommend error:', err);
    return res.status(500).json({ error: 'An internal error occurred. Please try again.' });
  }
};
