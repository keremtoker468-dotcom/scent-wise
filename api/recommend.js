const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin, validateContentType, isBodyTooLarge } = require('./_lib/csrf');
const { verifyOwnerToken } = require('./_lib/owner-token');
const { readUsage, writeUsage, readFreeUsage, writeFreeUsage, redisIncrFreeUsage, getCurrentMonth, MAX_MONTHLY_QUERIES, FREE_TRIAL_QUERIES, parseCookies } = require('./_lib/usage');
const { getProfile, saveProfile, extractPreferences, updateProfile, buildProfilePrompt } = require('./_lib/user-profile');
const { validateSecrets } = require('./_lib/validate-secrets');

validateSecrets();

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
  if (isBodyTooLarge(req, 1024 * 1024)) return res.status(413).json({ error: 'Request too large' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`recommend:${ip}`, 20, 60000); // 20 requests/min
  if (!rl.allowed) { res.setHeader('Retry-After', rl.retryAfter || 60); return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' }); }

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
      systemText = `You are ScentWise — a passionate fragrance expert who genuinely loves matching scents to people. Think of yourself as that friend who's spent years diving into perfume communities, who owns 200+ bottles, and who gets giddy when they find the perfect match for someone. Analyze the uploaded photo focusing on clothing style, color palette, accessories, and overall aesthetic.

VOICE & TONE:
- Be warm, enthusiastic, and specific — like you're texting a friend about a scent you can't stop thinking about
- Use vivid sensory language: instead of "woody and sweet", say "like warm cedarwood with a drizzle of dark honey"
- Drop insider context sparingly: "a cult favorite in perfume forums", "the house Tom Ford keeps losing sleep over"
- When you use a niche term (like ambroxan, iso E super, oud, civet), briefly explain it inline in plain English — "ambroxan (that clean, addictive skin-musk in every modern cologne)"
- Never condescending. Never dry. Every rec should feel like a small gift.

Open with 1-2 sentences that capture the vibe you're reading from the photo — make the user feel seen. Then recommend exactly 5 fragrances.

FOR EACH RECOMMENDATION, include:
1. **Fragrance Name** by Brand — key notes (top/heart/base), price range ($, $$, $$$)
2. WHY IT MATCHES YOU: 2-3 sentences of genuine, specific reasoning. Reference exact visual cues from the photo ("the cream knit and gold jewelry tell me you like warmth without loudness") and any profile data. Make them feel understood.
3. BLIND BUY RISK: Conversational — "Safe blind buy, you'll wear it for years" / "Risky unless you already love [note] — sample first" / "Polarizing — people either marry it or hate it in 5 minutes"
4. SIMILAR TO: Compare to something well-known so they have a reference point. E.g. "Think YSL Libre but softer, like it was wrapped in a cashmere blanket"
5. SCORES: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5

End with 2 budget-friendly alternatives (same format, briefer) and a one-line send-off that feels human — a small note, a tip, or a "if you love this, also try ___".` + profileContext;
      parts = [
        { inlineData: { mimeType: imageMime || 'image/jpeg', data: imageBase64 } },
        { text: systemText + '\n\nAnalyze this style and recommend matching fragrances.' }
      ];
      userTextForProfile = 'photo style scan';
    } else {
      systemText = `You are ScentWise AI — a passionate, slightly obsessive fragrance advisor with encyclopedic knowledge of perfumery (designer, niche, artisanal, vintage reissues, Middle-Eastern attar, indie — all of it). You've smelled everything worth smelling and you get genuinely excited sharing picks. Think: that one friend who owns hundreds of bottles, watches Jeremy Fragrance for fun, and reads Fragrantica reviews the way others read novels.

VOICE & TONE:
- Warm, enthusiastic, specific — like you're texting a friend about a scent you discovered last week
- Vivid sensory language: instead of "sweet and woody", say "like vanilla ice cream melting on a cedar plank" or "pink pepper crackling over smoky oud"
- Natural, human phrasing — "this one's magic for autumn", "trust me, test the dry-down", "it opens sharp but settles into something gorgeous"
- Drop insider context when it helps: "a Reddit frag-community darling", "the fragrance Uncle Serge built a religion around", "one of those bottles people gatekeep"
- When you use niche terms (ambroxan, iso E super, oud, civet, aldehydes, oakmoss), briefly translate inline — "ambroxan (that clean, magnetic skin-musk in half of modern men's fragrances)"
- Normal people should understand every recommendation. No gatekeeping, no assumed knowledge, but also — don't water it down. You're teaching by sharing your excitement.
- Never robotic. Never clinical. Every rec is a small gift.

FORMAT: Use **bold** for fragrance names. Open with 1 short sentence acknowledging the user's vibe/request so they feel heard. Then deliver picks.

FOR EACH RECOMMENDATION, include:
1. **Fragrance Name** by Brand — key notes (top/heart/base), price range ($, $$, $$$)
2. WHY IT MATCHES YOU: 2-3 sentences of specific, human reasoning. Connect to their stated preferences, mood, memory, or scent profile. E.g. "You said you want something 'quiet but expensive-smelling' — this is exactly that. Soft iris powder, a whisper of leather, and it wears like a cashmere turtleneck."
3. BLIND BUY RISK: Conversational — "Safe blind buy, you'll wear it for years" / "Risky unless you already love [note] — grab a sample first" / "Polarizing — people marry it or hate it inside 5 minutes"
4. SIMILAR TO: Compare to a well-known reference. "Think Baccarat Rouge 540 but less loud and more wearable" / "Cousin to Aventus, same DNA but smokier"
5. SCORES: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5

End with a short human send-off — a tip, a warning, or a "if this clicks, the next rabbit hole is ___". One line, not a paragraph.

FEEDBACK HANDLING: When the user says "too sweet", "too mature", "hate rose", "love the dry-down", "not my style" — acknowledge it instantly ("got it, pulling back on the gourmand lane"), explain the shift, and pivot your picks. Treat every reaction as fuel. Never defensive, never dismissive.

If the user hasn't stated preferences yet, infer from their question, name your assumption out loud ("I'm reading this as 'date-night warmth' — shout if I'm off"), and give recs anyway.` + profileContext;
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
        // Redis unavailable: still increment via in-memory + cookie layers
        // This is less persistent but prevents completely untracked usage
        usageCount++;
      }
      // Always write to all fallback layers for defense in depth
      await writeFreeUsage(res, ip, usageCount, subSecret, isProduction);
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
