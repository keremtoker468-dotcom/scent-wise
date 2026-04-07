const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin, validateContentType, isBodyTooLarge } = require('./_lib/csrf');
const { verifyOwnerToken } = require('./_lib/owner-token');
const { readUsage, writeUsage, readFreeUsage, writeFreeUsage, redisIncrFreeUsage, getCurrentMonth, MAX_MONTHLY_QUERIES, FREE_TRIAL_QUERIES, parseCookies } = require('./_lib/usage');
const { getProfile, saveProfile, extractPreferences, updateProfile, buildProfilePrompt } = require('./_lib/user-profile');

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
        if (Buffer.byteLength(token) === Buffer.byteLength(expected) &&
            crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
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
  if (!validateContentType(req)) return res.status(415).json({ error: 'Content-Type must be application/json' });
  if (isBodyTooLarge(req, 10 * 1024 * 1024)) return res.status(413).json({ error: 'Request too large' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`recommend:${ip}`, 20, 60000); // 20 requests/min
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });

  const access = verifyAccess(req);
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const subSecret = process.env.SUBSCRIPTION_SECRET || process.env.OWNER_KEY;
  let usageCount = 0;
  let isFreeTrialRequest = false;

  if (!access.authorized) {
    // Free trial: allow a few queries so users can experience the AI
    if (subSecret) {
      const freeUsage = await readFreeUsage(req, ip, subSecret);
      if (freeUsage.count >= FREE_TRIAL_QUERIES) {
        return res.status(403).json({
          error: 'Free trial queries used. Subscribe for unlimited access!',
          tier: 'free',
          freeUsed: freeUsage.count,
          freeLimit: FREE_TRIAL_QUERIES
        });
      }
      usageCount = freeUsage.count;
      isFreeTrialRequest = true;
    } else {
      return res.status(403).json({ error: 'Premium subscription required', tier: 'free' });
    }
  }

  // Server-side usage enforcement for premium users
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

    // Input validation
    if (mode === 'photo' && imageBase64 && imageBase64.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large (max 10MB)' });
    }
    if (messages && (!Array.isArray(messages) || messages.length > 50)) {
      return res.status(400).json({ error: 'Invalid messages' });
    }
    if (imageMime && !/^image\/(jpeg|png|gif|webp|heic|heif)$/.test(imageMime)) {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    // Load user scent profile for personalized recommendations
    const profileUserId = access.authorized ? access.userId : ip;
    let profile = null;
    try {
      profile = await getProfile(profileUserId);
    } catch { /* profile loading is non-blocking */ }
    const profileContext = profile ? buildProfilePrompt(profile) : '';

    let parts = [];
    let systemText = '';
    let userTextForProfile = ''; // track user input for profile extraction

    if (mode === 'photo') {
      systemText = `You are ScentWise — an expert fragrance consultant who matches scents to personal style. Analyze the uploaded photo focusing on clothing style, color palette, accessories and overall aesthetic. Recommend exactly 5 fragrances that match.

FOR EACH RECOMMENDATION, include:
1. **Fragrance Name** by Brand — key notes (top/heart/base), price range ($, $$, $$$)
2. WHY IT MATCHES YOU: 1-2 sentences explaining why this suits the user's style, aesthetic, or known preferences. Reference specific visual cues from the photo and any profile data.
3. BLIND BUY RISK: One of — "Low-risk blind buy" / "Medium risk — only if you like [specific note]" / "Test first — polarizing"
4. SIMILAR TO: Compare to a well-known fragrance. E.g. "Similar to Libre but softer and creamier"
5. SCORES: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5

End with 2 budget-friendly alternatives (same format but briefer).` + profileContext;
      parts = [
        { inlineData: { mimeType: imageMime || 'image/jpeg', data: imageBase64 } },
        { text: systemText + '\n\nAnalyze this style and recommend matching fragrances.' }
      ];
      userTextForProfile = 'photo style scan';
    } else {
      systemText = `You are ScentWise AI — a world-class fragrance advisor with encyclopedic knowledge of perfumery including designer, niche, and artisanal fragrances. Be conversational, specific, and confident.

FORMAT RULES: Use **bold** for fragrance names. Be concise but thorough.

FOR EACH RECOMMENDATION, include:
1. **Fragrance Name** by Brand — key notes (top/heart/base), price range ($, $$, $$$)
2. WHY IT MATCHES YOU: 1-2 sentences explaining why this suits the user based on their stated preferences, conversation context, or scent profile. E.g. "Recommended because you enjoy warm-sweet profiles and your style leans elegant."
3. BLIND BUY RISK: One of — "Low-risk blind buy" / "Medium risk — only if you like [specific note]" / "Test first — polarizing"
4. SIMILAR TO: Compare to a well-known fragrance. E.g. "Similar to Libre but softer and creamier"
5. SCORES: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5

FEEDBACK HANDLING: When the user says things like "too sweet", "too mature", "hate rose", "love the dry-down", or "not my style" — acknowledge their feedback immediately, explain what you'll adjust, and shift recommendations accordingly. Treat every reaction as a learning signal.

If the user hasn't stated preferences yet, infer from their questions and still explain your reasoning.` + profileContext;
      const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1].content : '';
      const history = messages && messages.length > 1
        ? messages.slice(0, -1).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
        : '';
      parts = [{ text: systemText + (history ? '\n\nConversation so far:\n' + history : '') + '\n\nUser: ' + lastMsg }];
      userTextForProfile = lastMsg;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { maxOutputTokens: 2500, temperature: 0.8 }
          }),
          signal: controller.signal
        }
      );
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr.name === 'AbortError') {
        return res.status(504).json({ error: 'AI service took too long to respond. Please try again.' });
      }
      throw fetchErr;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini API error: ${response.status}`, errText);
      return res.status(500).json({ error: 'AI service temporarily unavailable' });
    }

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

    // Update user scent profile with preferences from this interaction (non-blocking)
    if (profile) {
      try {
        const prefs = extractPreferences(userTextForProfile, result);
        updateProfile(profile, prefs);
        saveProfile(profileUserId, profile).catch(() => {});
      } catch { /* profile update is non-blocking */ }
    }

    // Track usage after successful AI call
    if (isFreeTrialRequest && subSecret) {
      // Use atomic Redis INCR to prevent TOCTOU race conditions
      const atomicCount = await redisIncrFreeUsage(ip, getCurrentMonth());
      if (atomicCount !== null) {
        usageCount = atomicCount;
      } else {
        // Fallback: non-atomic increment when Redis is unavailable
        usageCount++;
        await writeFreeUsage(res, ip, usageCount, subSecret, isProduction);
      }
    } else if (access.tier === 'premium' && subSecret) {
      usageCount++;
      writeUsage(res, access.userId, usageCount, subSecret, isProduction);
    }

    const responseData = { result };
    if (isFreeTrialRequest) {
      responseData.freeUsed = usageCount;
      responseData.freeLimit = FREE_TRIAL_QUERIES;
      responseData.tier = 'free';
    } else if (access.tier === 'premium') {
      responseData.usage = usageCount;
      responseData.limit = MAX_MONTHLY_QUERIES;
    }
    // Include profile learning status
    if (profile && profile.queryCount > 0) {
      responseData.profileActive = true;
      responseData.profileQueryCount = profile.queryCount;
    }
    return res.status(200).json(responseData);

  } catch (err) {
    console.error('Recommend error:', err);
    return res.status(500).json({ error: 'An internal error occurred. Please try again.' });
  }
};
