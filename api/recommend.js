const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin } = require('./_lib/csrf');
const { verifyOwnerToken } = require('./_lib/owner-token');
const { readUsage, writeUsage, readFreeUsage, writeFreeUsage, MAX_MONTHLY_QUERIES, FREE_TRIAL_QUERIES, parseCookies } = require('./_lib/usage');

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

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!geminiKey && !openaiKey && !anthropicKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { mode, model: requestedModel, messages, imageBase64, imageMime } = req.body;

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

    let systemText = '';
    if (mode === 'photo') {
      systemText = 'You are ScentWise — an expert fragrance consultant who matches scents to personal style. Analyze the uploaded photo focusing on clothing style, color palette, accessories and overall aesthetic. Recommend exactly 5 fragrances that match. For each include: **Fragrance Name** by Brand, key notes (top/heart/base), price range ($, $$, $$$), and why it matches. End with 2 budget alternatives.';
    } else {
      systemText = 'You are ScentWise AI — a world-class fragrance advisor with encyclopedic knowledge of perfumery including designer, niche, and artisanal fragrances. Provide specific, confident recommendations with fragrance names, brands, key notes, price ranges, and reasons. Format with **bold** for fragrance names. Be conversational and knowledgeable.';
    }

    const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1].content : '';
    const history = messages && messages.length > 1
      ? messages.slice(0, -1).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
      : '';

    // Route to the requested AI model
    const chosenModel = requestedModel || 'gemini-flash';
    let result;

    if (chosenModel === 'claude-haiku' && anthropicKey) {
      // Anthropic Claude Haiku
      const claudeMessages = [];
      if (mode === 'photo' && imageBase64) {
        claudeMessages.push({ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: imageMime || 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: 'Analyze this style and recommend matching fragrances.' }
        ]});
      } else {
        if (history) claudeMessages.push({ role: 'user', content: history });
        if (history) claudeMessages.push({ role: 'assistant', content: 'Understood, continuing our conversation.' });
        claudeMessages.push({ role: 'user', content: lastMsg });
      }
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1500, system: systemText, messages: claudeMessages })
      });
      if (!response.ok) { console.error(`Claude API error: ${response.status}`, await response.text()); return res.status(500).json({ error: 'AI service temporarily unavailable' }); }
      const data = await response.json();
      result = data.content?.[0]?.text || 'No response generated.';

    } else if (chosenModel === 'gpt-4o-mini' && openaiKey) {
      // OpenAI GPT-4o Mini
      const oaiMessages = [{ role: 'system', content: systemText }];
      if (mode === 'photo' && imageBase64) {
        oaiMessages.push({ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${imageMime || 'image/jpeg'};base64,${imageBase64}` } },
          { type: 'text', text: 'Analyze this style and recommend matching fragrances.' }
        ]});
      } else {
        if (history) oaiMessages.push({ role: 'user', content: history }, { role: 'assistant', content: 'Understood, continuing our conversation.' });
        oaiMessages.push({ role: 'user', content: lastMsg });
      }
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 1500, temperature: 0.8, messages: oaiMessages })
      });
      if (!response.ok) { console.error(`OpenAI API error: ${response.status}`, await response.text()); return res.status(500).json({ error: 'AI service temporarily unavailable' }); }
      const data = await response.json();
      result = data.choices?.[0]?.message?.content || 'No response generated.';

    } else {
      // Default: Gemini (flash or pro)
      if (!geminiKey) return res.status(500).json({ error: 'API key not configured' });
      const geminiModel = chosenModel === 'gemini-pro' ? 'gemini-2.0-flash' : 'gemini-2.0-flash';
      let parts = [];
      if (mode === 'photo' && imageBase64) {
        parts = [
          { inlineData: { mimeType: imageMime || 'image/jpeg', data: imageBase64 } },
          { text: systemText + '\n\nAnalyze this style and recommend matching fragrances.' }
        ];
      } else {
        parts = [{ text: systemText + (history ? '\n\nConversation so far:\n' + history : '') + '\n\nUser: ' + lastMsg }];
      }
      const temp = chosenModel === 'gemini-pro' ? 0.7 : 0.8;
      const maxTokens = chosenModel === 'gemini-pro' ? 2000 : 1500;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: { maxOutputTokens: maxTokens, temperature: temp } })
        }
      );
      if (!response.ok) { console.error(`Gemini API error: ${response.status}`, await response.text()); return res.status(500).json({ error: 'AI service temporarily unavailable' }); }
      const data = await response.json();
      result = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    }

    // Track usage after successful AI call
    usageCount++;
    if (isFreeTrialRequest && subSecret) {
      await writeFreeUsage(res, ip, usageCount, subSecret, isProduction);
    } else if (access.tier === 'premium' && subSecret) {
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
    return res.status(200).json(responseData);

  } catch (err) {
    console.error('Recommend error:', err);
    return res.status(500).json({ error: 'An internal error occurred. Please try again.' });
  }
};
