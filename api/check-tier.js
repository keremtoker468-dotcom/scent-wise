const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { verifyOwnerToken } = require('./_lib/owner-token');
const { readUsage, readDeviceFreeUsage, readFreeUsage, readOrMintDeviceId, readEmailFlag, MAX_MONTHLY_QUERIES, FREE_TRIAL_QUERIES, parseCookies } = require('./_lib/usage');
const { getProfile, saveProfile, deleteProfile, applyFeedback, emptyProfile } = require('./_lib/user-profile');

function verifySubToken(cookieValue, secret) {
  try {
    const decoded = JSON.parse(Buffer.from(cookieValue, 'base64').toString());
    const { token, subId, custId } = decoded;
    if (!token || !subId || !custId) return null;
    const expected = crypto.createHmac('sha256', secret).update(subId + ':' + custId).digest('hex');
    if (Buffer.byteLength(token) === Buffer.byteLength(expected) &&
        crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return { subId, custId, email: decoded.email };
    }
    return null;
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'DELETE' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`check-tier:${ip}`, 30, 60000); // 30 requests/min
  if (!rl.allowed) { res.setHeader('Retry-After', rl.retryAfter || 60); return res.status(429).json({ error: 'Too many requests' }); }

  // Handle scent profile actions via ?action=profile
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  // Handle scent profile requests
  if (action === 'profile') {
    // Use full CSRF validation for all profile requests (GET included — profile data is personal)
    const { validateOrigin, validateContentType, isBodyTooLarge } = require('./_lib/csrf');
    if (req.method === 'POST' || req.method === 'DELETE') {
      if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
      if (req.method === 'POST' && !validateContentType(req)) return res.status(415).json({ error: 'Content-Type must be application/json' });
      if (req.method === 'POST' && isBodyTooLarge(req)) return res.status(413).json({ error: 'Request too large' });
    } else {
      // GET profile: require same-origin via sec-fetch-site, X-Requested-With, or Origin/Referer match
      const isSameOriginProfile = req.headers['sec-fetch-site'] === 'same-origin'
        || req.headers['x-requested-with'] === 'ScentWise';
      if (!isSameOriginProfile) {
        // Fall back to Origin/Referer validation for broader browser support
        const profileOrigin = req.headers['origin'];
        const profileReferer = req.headers['referer'];
        const profileHost = req.headers['host'];
        let originMatch = false;
        if (profileHost) {
          try { if (profileOrigin && new URL(profileOrigin).host === profileHost) originMatch = true; } catch {}
          try { if (!originMatch && profileReferer && new URL(profileReferer).host === profileHost) originMatch = true; } catch {}
        }
        if (!originMatch) return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // Determine profile user ID from auth cookies
    const profileCookies = parseCookies(req.headers.cookie || '');
    const profileSubSecret = process.env.SUBSCRIPTION_SECRET;
    const profileOwnerKey = process.env.OWNER_KEY;
    let profileUserId = ip; // default: IP for free users

    if (profileOwnerKey && profileCookies.sw_owner && verifyOwnerToken(profileCookies.sw_owner, profileOwnerKey)) {
      profileUserId = 'owner';
    } else if (profileSubSecret && profileCookies.sw_sub) {
      const sub = verifySubToken(profileCookies.sw_sub, profileSubSecret);
      if (sub) profileUserId = sub.custId;
    }

    if (req.method === 'DELETE') {
      try {
        await deleteProfile(profileUserId);
        return res.status(200).json({ success: true, message: 'Scent profile reset successfully.' });
      } catch {
        return res.status(500).json({ error: 'Failed to reset profile.' });
      }
    }
    // POST feedback (like/dislike) or quiz data
    if (req.method === 'POST') {
      try {
        const body = req.body || {};

        // Handle scent profile quiz submission
        if (body.quiz && typeof body.quiz === 'object') {
          const quiz = body.quiz;
          const profile = await getProfile(profileUserId);
          // Validate and apply quiz fields
          const validTendencies = ['sweeter', 'sharper', 'powdery', 'stay-true', 'disappear-quickly'];
          const validClimates = ['hot-humid', 'hot-dry', 'temperate', 'cold'];
          const validLongevity = ['2-4-hours', '4-8-hours', '8-plus-hours', 'varies'];
          const validWearContext = ['compliment-getter', 'office-safe', 'date-night', 'signature-scent', 'everyday-casual'];
          const validIntensity = ['soft', 'moderate', 'strong'];

          const sc = {};
          if (validTendencies.includes(quiz.tendency)) sc.tendency = quiz.tendency;
          if (validClimates.includes(quiz.climate)) sc.climate = quiz.climate;
          if (validLongevity.includes(quiz.longevityOnSkin)) sc.longevityOnSkin = quiz.longevityOnSkin;
          if (Object.keys(sc).length) profile.skinChemistry = { ...(profile.skinChemistry || {}), ...sc };

          if (Array.isArray(quiz.wearContext)) {
            profile.wearContext = quiz.wearContext.filter(w => validWearContext.includes(w)).slice(0, 5);
          }
          if (validIntensity.includes(quiz.projectionPref)) {
            profile.intensityPref = quiz.projectionPref;
          }
          await saveProfile(profileUserId, profile);
          return res.status(200).json({ success: true, profile });
        }

        // Handle like/dislike feedback
        const { fragranceName, aiText, liked } = body;
        if (!fragranceName || typeof fragranceName !== 'string' || fragranceName.length > 200) {
          return res.status(400).json({ error: 'Invalid fragrance name' });
        }
        if (typeof liked !== 'boolean') {
          return res.status(400).json({ error: 'Missing liked field' });
        }
        // Limit aiText to prevent abuse
        const safeAiText = typeof aiText === 'string' ? aiText.slice(0, 3000) : '';
        const profile = await getProfile(profileUserId);
        applyFeedback(profile, fragranceName, safeAiText, liked);
        await saveProfile(profileUserId, profile);
        return res.status(200).json({ success: true, profile });
      } catch {
        return res.status(500).json({ error: 'Failed to save feedback.' });
      }
    }
    // GET profile
    try {
      const profile = await getProfile(profileUserId);
      return res.status(200).json({ profile, hasProfile: profile.queryCount > 0 });
    } catch {
      return res.status(200).json({ profile: emptyProfile(), hasProfile: false });
    }
  }

  // POST and DELETE only valid for profile actions
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Only allow cookie mutations (clearing invalid subscriptions, setting revalidation)
  // when the request comes from our own origin. This prevents cross-site requests
  // from triggering subscription cookie clearing via <img> or other GET vectors.
  // Check both sec-fetch-site and referer/origin for broader browser support.
  const originHeader = req.headers['origin'];
  const refererHeader = req.headers['referer'];
  const hostHeader = req.headers['host'];
  let isSameOrigin = req.headers['sec-fetch-site'] === 'same-origin'
    || req.headers['x-requested-with'] === 'ScentWise';
  if (!isSameOrigin && hostHeader) {
    try { if (originHeader && new URL(originHeader).host === hostHeader) isSameOrigin = true; } catch {}
    try { if (!isSameOrigin && refererHeader && new URL(refererHeader).host === hostHeader) isSameOrigin = true; } catch {}
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const subSecret = process.env.SUBSCRIPTION_SECRET;
  const ownerKey = process.env.OWNER_KEY;
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

  if (ownerKey && cookies.sw_owner) {
    if (verifyOwnerToken(cookies.sw_owner, ownerKey)) {
      return res.status(200).json({ tier: 'owner' });
    }
  }

  // Auto-bind subscription from device token (webhook wrote sw_devicesub:<deviceId>)
  // If user returns after checkout on same device, restore their sw_sub cookie.
  if (!cookies.sw_sub && subSecret && cookies.sw_device && isSameOrigin) {
    try {
      const { deviceId } = readOrMintDeviceId(req, res, subSecret, isProduction);
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (redisUrl && redisToken && deviceId) {
        const key = `sw_devicesub:${deviceId}`;
        const r = await fetch(`${redisUrl}/GET/${encodeURIComponent(key)}`, {
          headers: { Authorization: `Bearer ${redisToken}` }
        });
        if (r.ok) {
          const payload = await r.json();
          const raw = payload.result;
          if (raw) {
            const bind = JSON.parse(raw);
            if (bind && bind.subId && bind.custId) {
              const token = crypto.createHmac('sha256', subSecret).update(bind.subId + ':' + bind.custId).digest('hex');
              const cookieValue = Buffer.from(JSON.stringify({
                token, subId: bind.subId, custId: bind.custId, email: bind.email || ''
              })).toString('base64');
              const existing = res.getHeader('Set-Cookie') || [];
              const list = Array.isArray(existing) ? [...existing] : [existing];
              list.push(`sw_sub=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${isProduction ? '; Secure' : ''}`);
              res.setHeader('Set-Cookie', list);
              // Re-parse cookies so the downstream check picks it up
              cookies.sw_sub = cookieValue;
            }
          }
        }
      }
    } catch (err) {
      console.error('device auto-bind error:', err.message);
    }
  }

  if (subSecret && cookies.sw_sub) {
    const sub = verifySubToken(cookies.sw_sub, subSecret);
    if (sub) {
      // Periodically re-validate subscription with LS API
      // Use sw_revalidated cookie to throttle (once per 24h)
      const lsApiKey = process.env.LEMONSQUEEZY_API_KEY;
      const needsRevalidation = lsApiKey && !cookies.sw_revalidated && isSameOrigin;
      if (needsRevalidation) {
        try {
          const orderRes = await fetch(`https://api.lemonsqueezy.com/v1/orders/${sub.subId}`, {
            headers: { 'Authorization': `Bearer ${lsApiKey}`, 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' }
          });
          if (orderRes.ok) {
            const orderData = await orderRes.json();
            const orderAttrs = orderData.data?.attributes;
            const status = orderAttrs?.status;
            const expectedProductId = process.env.LEMONSQUEEZY_PRODUCT_ID;
            if (expectedProductId && String(orderAttrs?.first_order_item?.product_id) !== expectedProductId) {
              // Order doesn't belong to our product — clear cookie
              res.setHeader('Set-Cookie', [`sw_sub=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`]);
              return res.status(200).json({ tier: 'free' });
            }
            if (status === 'refunded' || status === 'paused' || status === 'expired') {
              // Subscription no longer active — clear cookie
              res.setHeader('Set-Cookie', [`sw_sub=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`]);
              return res.status(200).json({ tier: 'free' });
            }
          }
          // Set revalidation throttle cookie (24h)
          const existing = res.getHeader('Set-Cookie') || [];
          const setCookies = Array.isArray(existing) ? [...existing] : [existing];
          setCookies.push(`sw_revalidated=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${isProduction ? '; Secure' : ''}`);
          res.setHeader('Set-Cookie', setCookies);
        } catch (err) {
          // LS API unreachable — trust the local cookie, don't block the user
          // Still set throttle cookie to avoid hammering LS API on every request
          console.error('LS revalidation error:', err.message);
          const existing = res.getHeader('Set-Cookie') || [];
          const setCookies = Array.isArray(existing) ? [...existing] : [existing];
          setCookies.push(`sw_revalidated=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${isProduction ? '; Secure' : ''}`);
          res.setHeader('Set-Cookie', setCookies);
        }
      }

      const usage = readUsage(req, sub.custId, subSecret);
      return res.status(200).json({
        tier: 'premium',
        email: sub.email,
        usage: usage.count,
        limit: MAX_MONTHLY_QUERIES
      });
    }
    // Invalid subscription token — only clear cookie if same-origin request
    if (isSameOrigin) {
      res.setHeader('Set-Cookie', [`sw_sub=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`]);
    }
  }

  // Return free trial usage for anonymous users — tracked per browser (device cookie)
  // AND per client IP (monthly). Using MAX(device, ip) prevents incognito / private-tab
  // bypass where a fresh cookie jar would otherwise grant a brand-new quota.
  const trialSecret = process.env.SUBSCRIPTION_SECRET || process.env.OWNER_KEY;
  if (trialSecret) {
    const { deviceId } = readOrMintDeviceId(req, res, trialSecret, isProduction);
    const [freeUsage, ipUsage] = await Promise.all([
      readDeviceFreeUsage(req, deviceId, trialSecret),
      readFreeUsage(req, ip, trialSecret)
    ]);
    const freeUsed = Math.max(freeUsage.count, ipUsage.count);
    const emailGiven = readEmailFlag(req, deviceId, trialSecret);
    return res.status(200).json({
      tier: 'free',
      freeUsed,
      freeLimit: FREE_TRIAL_QUERIES,
      emailGiven
    });
  }

  return res.status(200).json({ tier: 'free', freeUsed: 0, freeLimit: FREE_TRIAL_QUERIES, emailGiven: false });
};
