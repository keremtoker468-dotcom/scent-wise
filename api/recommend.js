const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin, validateContentType, isBodyTooLarge } = require('./_lib/csrf');
const { verifyOwnerToken } = require('./_lib/owner-token');
const {
  readUsage, writeUsage,
  readDeviceFreeUsage, redisIncrDeviceFreeUsage, writeCookieDeviceFreeUsage, readOrMintDeviceId,
  readFreeUsage, redisIncrFreeUsage, writeCookieFreeUsage,
  readEmailFlag,
  checkIpDailyCap, redisIncrIpDaily, IP_DAILY_FREE_CAP,
  getCurrentMonth, MAX_MONTHLY_QUERIES, FREE_TRIAL_QUERIES, parseCookies
} = require('./_lib/usage');
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

  let freeDeviceId = null;
  let emailGiven = false;
  if (!access.authorized) {
    // Free trial: allow a few queries so users can experience the AI
    if (subSecret) {
      const { deviceId } = readOrMintDeviceId(req, res, subSecret, isProduction);
      freeDeviceId = deviceId;
      emailGiven = readEmailFlag(req, deviceId, subSecret);

      // Abuse guard: per-IP soft daily cap so a single IP can't mint unlimited
      // device cookies in a loop. Returns a distinct reason so the client can
      // show a shared-IP-friendly message instead of the usual paywall.
      const ipCap = await checkIpDailyCap(ip);
      if (!ipCap.allowed) {
        return res.status(429).json({
          error: 'This network has been very busy today. Please try again later, or subscribe to continue.',
          tier: 'free',
          reason: 'ip_daily_cap',
          ipDaily: ipCap.count,
          ipDailyCap: ipCap.cap
        });
      }

      // Count against BOTH the device cookie and the client IP (monthly).
      // Incognito / private tabs mint a fresh device id, so device-only tracking
      // could be bypassed by reopening a private window. IP tracking closes that
      // loophole: MAX(device, ip) is what we enforce against FREE_TRIAL_QUERIES.
      const [freeUsage, ipUsage] = await Promise.all([
        readDeviceFreeUsage(req, deviceId, subSecret),
        readFreeUsage(req, ip, subSecret)
      ]);
      const effectiveUsed = Math.max(freeUsage.count, ipUsage.count);
      if (effectiveUsed >= FREE_TRIAL_QUERIES) {
        return res.status(403).json({
          error: 'Free trial queries used. Subscribe for unlimited access!',
          tier: 'free',
          freeUsed: effectiveUsed,
          freeLimit: FREE_TRIAL_QUERIES
        });
      }
      usageCount = effectiveUsed;
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
      systemText = `You are ScentWise — a world-class fragrance advisor with the warmth of a friend who genuinely loves this stuff. You know the field deeply (designer, niche, artisanal, attars, vintage), and you share recommendations with confidence, not showmanship. Analyze the uploaded photo focusing on clothing style, color palette, accessories, and overall aesthetic.

VOICE & TONE:
- Confident and warm. Expert-first: your authority is earned, not performed. Skip hype and catchphrases.
- Sensory language should be precise, not cinematic: "warm cedar with a touch of honey" over "like vanilla ice cream melting on cedar."
- A light sprinkle of insider context when genuinely useful ("a quiet favourite in the niche world") — never forced.
- When you use a niche term (ambroxan, iso E super, oud, civet, oakmoss), translate inline in plain English: "ambroxan (the clean, magnetic skin-musk in most modern colognes)".
- Speak like a knowledgeable friend — not a marketer, not a collector bragging. Normal people should understand every rec.

Open with 1-2 sentences reading the vibe from the photo so the user feels seen. Then recommend exactly 5 fragrances.

FOR EACH RECOMMENDATION, include:
1. **Fragrance Name** by Brand — key notes (top/heart/base), price range ($, $$, $$$)
2. WHY IT MATCHES YOU: 2-3 sentences of genuine, specific reasoning. Reference exact visual cues from the photo ("the cream knit and gold jewelry tell me you like warmth without loudness") and any profile data. Make them feel understood.
3. BLIND BUY RISK: One of — "Low-risk blind buy" / "Medium risk — only if you like [specific note]" / "Test first — polarizing"
4. SIMILAR TO: Compare to something well-known so they have a reference point. E.g. "Think YSL Libre but softer, like it was wrapped in a cashmere blanket"
5. SCORES: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5

End with 2 budget-friendly alternatives (same format, briefer) and a one-line send-off that feels human — a small note, a tip, or a "if you love this, also try ___".

STRICT OUTPUT FORMAT (the UI parser depends on this exact structure):
- Start each pick on its own line with: **Fragrance Name by Brand** — both the name AND "by Brand" must be inside the bold markers.
- Example header: **Aventus by Creed** — pineapple, birch, oakmoss
- Section labels must match exactly (uppercase): WHY IT MATCHES YOU:, BLIND BUY RISK:, SIMILAR TO:, SCORES:
- SCORES line must read: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5
- No extra preamble, no closing summary, no nested bullets inside picks.` + profileContext;
      parts = [
        { inlineData: { mimeType: imageMime || 'image/jpeg', data: imageBase64 } },
        { text: systemText + '\n\nAnalyze this style and recommend matching fragrances.' }
      ];
      userTextForProfile = 'photo style scan';
    } else {
      systemText = `You are ScentWise AI — a world-class fragrance advisor with the warmth of a friend who genuinely loves this world. You have deep working knowledge of designer, niche, artisanal, vintage, Middle-Eastern attar and indie houses, and you give recommendations with calm confidence. Think: a trusted advisor who happens to be a fragrance lover — expert first, enthusiast second.

VOICE & TONE:
- Confident, warm, specific. Authority carried lightly — no performative hype, no catchphrases, no "trust me"s.
- Precise sensory language over theatrical metaphors: "pink pepper over smoky oud" is fine; "vanilla ice cream melting on a cedar plank" is too much.
- Natural phrasing when it fits: "beautiful for autumn", "the dry-down is where this one earns it", "opens sharp and softens into something refined".
- Drop insider context only when it genuinely helps the user decide: "a long-standing favourite in niche circles", "often compared to X but more restrained".
- When you use niche terms (ambroxan, iso E super, oud, civet, aldehydes, oakmoss), translate inline in plain English — "ambroxan (the clean, magnetic skin-musk in most modern men's scents)".
- Normal people should understand every rec. No gatekeeping, no watering down. You're a friendly guide, not a flex.
- Never robotic. Never clinical. Never over-the-top.

FORMAT: Use **bold** for fragrance names. Open with 1 short sentence acknowledging the user's vibe/request so they feel heard. Then deliver picks.

FOR EACH RECOMMENDATION, include:
1. **Fragrance Name** by Brand — key notes (top/heart/base), price range ($, $$, $$$)
2. WHY IT MATCHES YOU: 2-3 sentences of specific, human reasoning. Connect to their stated preferences, mood, memory, or scent profile. E.g. "You said you want something 'quiet but expensive-smelling' — this is exactly that. Soft iris powder, a whisper of leather, and it wears like a cashmere turtleneck."
3. BLIND BUY RISK: One of — "Low-risk blind buy" / "Medium risk — only if you like [specific note]" / "Test first — polarizing"
4. SIMILAR TO: Compare to a well-known reference. "Think Baccarat Rouge 540 but less loud and more wearable" / "Cousin to Aventus, same DNA but smokier"
5. SCORES: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5

End with a short, useful send-off — a wearing tip, a caveat, or "if this one lands, the natural next step is ___". One line, not a paragraph.

FEEDBACK HANDLING: When the user says "too sweet", "too mature", "hate rose", "love the dry-down", "not my style" — acknowledge it clearly ("noted — moving away from the gourmand lane"), briefly explain the shift, and pivot your picks. Treat every reaction as information. Never defensive, never dismissive.

If the user hasn't stated preferences yet, infer from their question, name your assumption out loud ("Reading this as date-night warmth — let me know if that's off") and give recs anyway.

STRICT OUTPUT FORMAT (the UI parser depends on this exact structure):
- Start each pick on its own line with: **Fragrance Name by Brand** — both the name AND "by Brand" must be inside the bold markers.
- Example header: **Aventus by Creed** — pineapple, birch, oakmoss
- Section labels must match exactly (uppercase): WHY IT MATCHES YOU:, BLIND BUY RISK:, SIMILAR TO:, SCORES:
- SCORES line must read: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5
- No extra preamble, no closing summary, no nested bullets inside picks.` + profileContext;
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
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { maxOutputTokens: 6000, temperature: 0.8 }
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
    if (isFreeTrialRequest && subSecret && freeDeviceId) {
      // Atomic Redis INCR on both device-bound AND IP-bound keys (prevents
      // TOCTOU and closes the incognito bypass: a new private tab gets a fresh
      // device id, but the IP counter survives across tabs).
      const month = getCurrentMonth();
      const [atomicDevice, atomicIp] = await Promise.all([
        redisIncrDeviceFreeUsage(freeDeviceId, month),
        redisIncrFreeUsage(ip, month)
      ]);
      const nextDevice = atomicDevice !== null ? atomicDevice : usageCount + 1;
      const nextIp = atomicIp !== null ? atomicIp : usageCount + 1;
      usageCount = Math.max(nextDevice, nextIp);
      // Signed cookie fallbacks (only layer when Redis is down).
      writeCookieDeviceFreeUsage(res, freeDeviceId, nextDevice, subSecret, isProduction);
      writeCookieFreeUsage(res, ip, nextIp, subSecret, isProduction);
      // Light per-IP abuse counter — bumps even for legit free users, but the
      // cap (100/day) is generous enough that real users never hit it.
      redisIncrIpDaily(ip).catch(() => {});
    } else if (access.tier === 'premium' && subSecret) {
      usageCount++;
      writeUsage(res, access.userId, usageCount, subSecret, isProduction);
    }

    const responseData = { result };
    if (isFreeTrialRequest) {
      responseData.freeUsed = usageCount;
      responseData.freeLimit = FREE_TRIAL_QUERIES;
      responseData.tier = 'free';
      responseData.emailGiven = emailGiven;
      // After query 1, if the user skipped the email gate, mark the response
      // as a teaser so the client blurs everything past the first 2 picks.
      if (!emailGiven && usageCount > 1) responseData.teaser = true;
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
