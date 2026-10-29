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
const { isOrderRevoked } = require('./_lib/revocation');

validateSecrets();

// Model selection. Gemini 2.5 reached its announced shutdown date (16 Oct 2026),
// so the default is the current Flash generation; GEMINI_MODEL overrides it and
// the chain below is tried in order whenever a model answers 404/400/5xx so a
// retired ID never takes the advisor down. The first model that answers is
// remembered for the life of the instance.
const DEFAULT_MODEL = 'gemini-3.5-flash';
const MODEL_CHAIN = Array.from(new Set([
  process.env.GEMINI_MODEL,
  DEFAULT_MODEL,
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash'
].filter(Boolean)));
let resolvedModel = null;
// Total time budget for the AI call; maxDuration below leaves headroom for the
// usage bookkeeping after it. The client waits 55s.
const GEN_DEADLINE_MS = 50000;

function generationConfig(model) {
  // Thinking tokens share maxOutputTokens with the visible answer, so a 3000
  // cap on a thinking model truncated replies mid-pick. 8192 leaves room for
  // five full picks plus the reasoning the model spends before writing.
  const cfg = { maxOutputTokens: 8192 };
  if (/^gemini-[3-9]/.test(model)) {
    // Gemini 3.x: thinking_level replaces thinking_budget; temperature is best left at default.
    cfg.thinkingConfig = { thinkingLevel: (process.env.GEMINI_THINKING_LEVEL || 'medium').toLowerCase() };
  } else {
    cfg.temperature = 0.5;
    cfg.thinkingConfig = { thinkingBudget: 1024 };
  }
  return cfg;
}

async function callModel(model, { systemText, contents, timeoutMs, apiKey }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents,
          generationConfig: generationConfig(model)
        }),
        signal: controller.signal
      }
    );
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      const err = new Error(`Gemini ${model} HTTP ${response.status}: ${errText.slice(0, 300)}`);
      err.status = response.status;
      // Auth problems are ours, not the model's — no point trying the next model.
      err.code = (response.status === 401 || response.status === 403) ? 'AUTH' : 'MODEL';
      throw err;
    }
    const data = await response.json();
    const cand = data.candidates && data.candidates[0];
    const blockReason = data.promptFeedback && data.promptFeedback.blockReason;
    if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT' || blockReason) {
      const err = new Error(`Gemini ${model} blocked: ${blockReason || (cand && cand.finishReason)}`);
      err.code = 'BLOCKED';
      throw err;
    }
    // Thinking models can return several parts (and thought parts when enabled) — join every visible text part.
    const text = (cand.content && cand.content.parts || [])
      .filter((p) => typeof p.text === 'string' && !p.thought)
      .map((p) => p.text).join('').trim();
    if (!text) {
      const err = new Error(`Gemini ${model} returned no text (finishReason=${cand.finishReason})`);
      err.code = 'MODEL';
      throw err;
    }
    return { text, model, truncated: cand.finishReason === 'MAX_TOKENS' };
  } catch (e) {
    if (e.name === 'AbortError') { const err = new Error('timeout'); err.code = 'TIMEOUT'; throw err; }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function generate({ systemText, contents, deadlineMs }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const deadline = Date.now() + deadlineMs;
  const order = resolvedModel ? [resolvedModel].concat(MODEL_CHAIN.filter((m) => m !== resolvedModel)) : MODEL_CHAIN;
  let lastErr = null;
  for (const model of order) {
    const remaining = deadline - Date.now();
    if (remaining < 8000) break;
    try {
      const out = await callModel(model, { systemText, contents, timeoutMs: remaining, apiKey });
      if (resolvedModel !== model) console.log(`Gemini model in use: ${model}`);
      resolvedModel = model;
      return out;
    } catch (e) {
      lastErr = e;
      if (e.code === 'TIMEOUT' || e.code === 'BLOCKED' || e.code === 'AUTH') throw e;
      console.error(`Gemini model ${model} failed, trying next:`, e.message);
      if (resolvedModel === model) resolvedModel = null;
    }
  }
  throw lastErr || Object.assign(new Error('no model available'), { code: 'MODEL' });
}

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
          return { authorized: true, tier: 'premium', userId: `${custId}`, subId: `${subId}` };
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

  let access = verifyAccess(req);
  if (access.tier === 'premium' && await isOrderRevoked(access.subId)) {
    access = { authorized: false, tier: 'free', userId: null };
  }
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

    const isDupe = mode === 'dupe';
    let contents = [];
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

ORDER & BRAND BALANCE:
- Picks #1, #2, #3 should lean designer or niche Western houses (Dior, YSL, Tom Ford, Versace, Chanel, Givenchy, Maison Margiela, Le Labo, Byredo, Maison Francis Kurkdjian, Diptyque, Creed, etc.).
- Picks #4 and #5 can include Middle-Eastern / attar houses (Al Haramain, Lattafa, Al-Rehab, Rasasi, Armaf) — at most 2 of these across the whole response, never more.
- Each pick from a different brand — no repeats in one response.

ACCURACY RULES (non-negotiable):
- Only name fragrances that really exist from the house you attribute them to. Never invent a name, a flanker or a brand. If you are not sure a fragrance exists, pick one you are sure about instead.
- Notes must be the real pyramid of that fragrance. If you don't know the notes with confidence, name only the 2-3 notes you are certain of rather than guessing.
- When the message includes database matches (notes, accords, ratings), treat them as ground truth: prefer those perfumes, use their listed notes, and never contradict them.
- Price tiers must be realistic for the house ($ under 60, $$ 60-150, $$$ over 150 for a full bottle).
- Prefer well-distributed, currently sold fragrances over discontinued or ultra-rare ones unless the user asks for them.
- Finish every pick completely. Never stop mid-sentence or mid-list; if you are running long, shorten the prose, not the number of picks.
- Answer questions directly. When the user asks a factual question (what are the notes of X, how long does X last, is X discontinued, which is better X or Y, what does ambroxan smell like), answer it plainly in a few sentences with **Name by Brand** bolding — do not force a list of five picks. Give picks only when the user asks for recommendations, alternatives or ideas.
- Keep the conversation. In a follow-up, honour everything said earlier in the thread (budget, dislikes, gender, occasion, picks already rejected) and never repeat a fragrance already recommended unless the user asks for it again.
- When the user writes in another language, answer in that language, keep fragrance and brand names in their original spelling, and still use the exact English section labels and the **Name by Brand** bold format so the interface can read them.

FOR EACH RECOMMENDATION, include:
1. **Fragrance Name** by Brand — key notes (top/heart/base), price range ($, $$, $$$)
2. WHY IT MATCHES YOU: 2-3 sentences of genuine, specific reasoning. Reference exact visual cues from the photo ("the cream knit and gold jewelry tell me you like warmth without loudness") and any profile data. Make them feel understood.
3. BLIND BUY RISK: One of — "Low-risk blind buy" / "Medium risk — only if you like [specific note]" / "Test first — polarizing"
4. SIMILAR TO: Compare to something well-known so they have a reference point. E.g. "Think YSL Libre but softer, like it was wrapped in a cashmere blanket"
5. SCORES: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5

End with 2 budget-friendly alternatives (same format, briefer) and a one-line send-off that feels human — a small note, a tip, or a "if you love this, also try ___".

STRICT OUTPUT FORMAT (the UI parser depends on this exact structure — failing it inserts links in the wrong places):
- Bold (the **...** markdown) is reserved for fragrance names — both your numbered picks AND any other fragrances you mention for comparison or context (in SIMILAR TO, in WHY IT MATCHES YOU, in budget alternatives, in send-off "also try" tips). Format every fragrance mention as **Name by Brand** so users can shop them. The word " by " must appear between name and brand inside the bold.
- Never bold section labels, notes, tips, headers, brand names alone, or anything that isn't a fragrance.
- Each numbered pick starts on its own line: **Fragrance Name by Brand** — top notes, heart, base
- Worked example of one pick:
    1. **Aventus by Creed** — pineapple, birch, oakmoss; price $$$
    WHY IT MATCHES YOU: This nails the "quiet confidence" you described — fruity opening, smoky dry-down, never loud.
    BLIND BUY RISK: Low-risk blind buy
    SIMILAR TO: A more wearable cousin of **Tom Ford Oud Wood by Tom Ford** — same warmth, less smoke.
    SCORES: Longevity: 4/5 | Projection: 4/5 | Uniqueness: 3/5 | Versatility: 5/5
- Use these section labels exactly (uppercase): WHY IT MATCHES YOU:, BLIND BUY RISK:, SIMILAR TO:, SCORES:
- SCORES line must read literally: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5
- Do NOT use markdown headers (# or ##), do NOT use nested bullets inside picks, do NOT bold notes or section labels.` + profileContext;
      const hint = messages && messages.length ? String(messages[messages.length - 1].content || '').slice(0, 2000) : '';
      contents = [{ role: 'user', parts: [
        { inlineData: { mimeType: imageMime || 'image/jpeg', data: imageBase64 } },
        { text: 'Analyze this style and recommend matching fragrances.' + (hint ? '\n\nUser note: ' + hint : '') }
      ] }];
      userTextForProfile = 'photo style scan';
    } else {
      const brandBalance = isDupe ? `DUPE MODE RULES (this request is a dupe / cheaper-alternative search — these override the usual brand balance):
- The user wants fragrances that SMELL LIKE the original. Similarity is the only ranking criterion; brand prestige, region and variety do not matter. Clone houses (Lattafa, Armaf, Al Haramain, Afnan, Rasasi, Maison Alhambra, Fragrance World, Zara, Dossier, ALT Fragrances, Dua, Oil Perfumery, Alexandria Fragrances, Ard Al Zaafaran, Paris Corner, Swiss Arabian) are welcome and may fill every slot when they are the closest matches.
- Each pick must share the original's main accords and at least two of its signature notes. Do not list a fragrance that merely shares one note or a general mood — if a pick is not a genuine scent match, replace it.
- Every pick must be cheaper than the original. Order from cheapest to most expensive, favour picks under $80.
- If the original is already budget (under $50) say so and offer the closest alternatives at any price under it.
- Head line: **Name by Brand** — the shared notes, then "~$price". WHY IT MATCHES YOU must say how close it is in honest words ("near clone", "85% there but lighter", "same DNA, sweeter dry-down") and name the main thing you lose (longevity, projection, a specific note). Never claim a 100% match.
` : `ORDER & BRAND BALANCE:
- Picks #1, #2, #3 should lean designer or niche Western houses (Dior, YSL, Tom Ford, Versace, Chanel, Givenchy, Maison Margiela, Le Labo, Byredo, Maison Francis Kurkdjian, Diptyque, Creed, etc.).
- Picks #4 and #5 can include Middle-Eastern / attar houses (Al Haramain, Lattafa, Al-Rehab, Rasasi, Armaf) — at most 2 of these across the whole response, never more.
- Each pick from a different brand — no repeats in one response.
`;
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

${brandBalance}
ACCURACY RULES (non-negotiable):
- Only name fragrances that really exist from the house you attribute them to. Never invent a name, a flanker or a brand. If you are not sure a fragrance exists, pick one you are sure about instead.
- Notes must be the real pyramid of that fragrance. If you don't know the notes with confidence, name only the 2-3 notes you are certain of rather than guessing.
- When the message includes database matches (notes, accords, ratings), treat them as ground truth: prefer those perfumes, use their listed notes, and never contradict them.
- Price tiers must be realistic for the house ($ under 60, $$ 60-150, $$$ over 150 for a full bottle).
- Prefer well-distributed, currently sold fragrances over discontinued or ultra-rare ones unless the user asks for them.
- Finish every pick completely. Never stop mid-sentence or mid-list; if you are running long, shorten the prose, not the number of picks.
- Answer questions directly. When the user asks a factual question (what are the notes of X, how long does X last, is X discontinued, which is better X or Y, what does ambroxan smell like), answer it plainly in a few sentences with **Name by Brand** bolding — do not force a list of five picks. Give picks only when the user asks for recommendations, alternatives or ideas.
- Keep the conversation. In a follow-up, honour everything said earlier in the thread (budget, dislikes, gender, occasion, picks already rejected) and never repeat a fragrance already recommended unless the user asks for it again.
- When the user writes in another language, answer in that language, keep fragrance and brand names in their original spelling, and still use the exact English section labels and the **Name by Brand** bold format so the interface can read them.

FOR EACH RECOMMENDATION, include:
1. **Fragrance Name** by Brand — key notes (top/heart/base), price range ($, $$, $$$)
2. WHY IT MATCHES YOU: 2-3 sentences of specific, human reasoning. Connect to their stated preferences, mood, memory, or scent profile. E.g. "You said you want something 'quiet but expensive-smelling' — this is exactly that. Soft iris powder, a whisper of leather, and it wears like a cashmere turtleneck."
3. BLIND BUY RISK: One of — "Low-risk blind buy" / "Medium risk — only if you like [specific note]" / "Test first — polarizing"
4. SIMILAR TO: Compare to a well-known reference. "Think Baccarat Rouge 540 but less loud and more wearable" / "Cousin to Aventus, same DNA but smokier"
5. SCORES: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5

End with a short, useful send-off — a wearing tip, a caveat, or "if this one lands, the natural next step is ___". One line, not a paragraph.

FEEDBACK HANDLING: When the user says "too sweet", "too mature", "hate rose", "love the dry-down", "not my style" — acknowledge it clearly ("noted — moving away from the gourmand lane"), briefly explain the shift, and pivot your picks. Treat every reaction as information. Never defensive, never dismissive.

If the user hasn't stated preferences yet, infer from their question, name your assumption out loud ("Reading this as date-night warmth — let me know if that's off") and give recs anyway.

STRICT OUTPUT FORMAT (the UI parser depends on this exact structure — failing it inserts links in the wrong places):
- Bold (the **...** markdown) is reserved for fragrance names — both your numbered picks AND any other fragrances you mention for comparison or context (in SIMILAR TO, in WHY IT MATCHES YOU, in budget alternatives, in send-off "also try" tips). Format every fragrance mention as **Name by Brand** so users can shop them. The word " by " must appear between name and brand inside the bold.
- Never bold section labels, notes, tips, headers, brand names alone, or anything that isn't a fragrance.
- Each numbered pick starts on its own line: **Fragrance Name by Brand** — top notes, heart, base
- Worked example of one pick:
    1. **Aventus by Creed** — pineapple, birch, oakmoss; price $$$
    WHY IT MATCHES YOU: This nails the "quiet confidence" you described — fruity opening, smoky dry-down, never loud.
    BLIND BUY RISK: Low-risk blind buy
    SIMILAR TO: A more wearable cousin of **Tom Ford Oud Wood by Tom Ford** — same warmth, less smoke.
    SCORES: Longevity: 4/5 | Projection: 4/5 | Uniqueness: 3/5 | Versatility: 5/5
- Use these section labels exactly (uppercase): WHY IT MATCHES YOU:, BLIND BUY RISK:, SIMILAR TO:, SCORES:
- SCORES line must read literally: Longevity: X/5 | Projection: X/5 | Uniqueness: X/5 | Versatility: X/5
- Do NOT use markdown headers (# or ##), do NOT use nested bullets inside picks, do NOT bold notes or section labels.` + profileContext;
      // Real conversation turns (user/model roles) keep the model grounded in the
      // thread instead of reading a flattened transcript inside one user message.
      const turns = (messages || []).filter((m) => m && typeof m.content === 'string' && m.content.trim());
      contents = turns.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 12000) }] }));
      // Gemini requires the thread to start with a user turn and alternate roles.
      while (contents.length && contents[0].role !== 'user') contents.shift();
      const lastMsg = turns.length ? turns[turns.length - 1].content : '';
      if (!contents.length) return res.status(400).json({ error: 'Empty message' });
      userTextForProfile = lastMsg;
    }

    const started = Date.now();
    let generated;
    try {
      generated = await generate({ systemText, contents, deadlineMs: GEN_DEADLINE_MS });
    } catch (genErr) {
      if (genErr.code === 'TIMEOUT') return res.status(504).json({ error: 'AI service took too long to respond. Please try again.' });
      if (genErr.code === 'BLOCKED') return res.status(400).json({ error: 'That request could not be processed. Please rephrase and try again.' });
      console.error('Gemini generate failed:', genErr.message);
      return res.status(500).json({ error: 'AI service temporarily unavailable' });
    }
    let result = generated.text;
    if (generated.truncated) result += '\n\nThat reply hit my length limit, so the last pick may be cut short. Ask me to continue and I will finish it.';
    console.log(`recommend ok model=${generated.model} mode=${mode || 'chat'} ms=${Date.now() - started} chars=${result.length}${generated.truncated ? ' truncated' : ''}`);

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

// Vercel's default function timeout is 10s on Hobby, which killed slower Gemini
// answers with a platform 504. Hobby allows up to 60s; the AI call itself is
// capped at GEN_DEADLINE_MS so a clean 504 is returned before this ceiling.
module.exports.config = { maxDuration: 60 };
