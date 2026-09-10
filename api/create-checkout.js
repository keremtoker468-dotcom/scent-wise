const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin, validateContentType, isBodyTooLarge } = require('./_lib/csrf');
const { readOrMintDeviceId } = require('./_lib/usage');
const { gaIdsFromCookies, gclidFromCookies, cleanClientId, cleanSessionId, cleanClickId } = require('./_lib/ga4');

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
  if (!validateContentType(req)) return res.status(415).json({ error: 'Content-Type must be application/json' });
  if (isBodyTooLarge(req)) return res.status(413).json({ error: 'Request too large' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`checkout:${ip}`, 5, 60000); // 5 attempts/min
  if (!rl.allowed) { res.setHeader('Retry-After', rl.retryAfter || 60); return res.status(429).json({ error: 'Too many attempts. Try again later.' }); }

  // The client posts the analytics ids it can read from document.cookie; every
  // one of them is re-validated below and falls back to the request cookies.
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

  if (!apiKey || !storeId || !variantId) {
    console.error('Missing LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, or LEMONSQUEEZY_VARIANT_ID');
    return res.status(500).json({ error: 'Checkout not configured' });
  }

  // Determine redirect URL — only allow our own domains to prevent open redirect
  const ALLOWED_ORIGINS = ['https://scent-wise.com', 'https://www.scent-wise.com'];
  if (process.env.VERCEL_URL) ALLOWED_ORIGINS.push(`https://${process.env.VERCEL_URL}`);
  const rawOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null) || '';
  const siteUrl = ALLOWED_ORIGINS.includes(rawOrigin.replace(/\/+$/, '')) ? rawOrigin.replace(/\/+$/, '') : 'https://scent-wise.com';

  // Device-token binding: mint/read the device cookie and pass it as custom_data
  // so the webhook can map subscription → device and auto-unlock on return.
  const subSecret = process.env.SUBSCRIPTION_SECRET;
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  let deviceId = null;
  if (subSecret) {
    try {
      const mint = readOrMintDeviceId(req, res, subSecret, isProduction);
      deviceId = mint.deviceId;
    } catch { /* best-effort */ }
  }

  // TikTok attribution — capture click ID + browser pixel ID at checkout time so
  // the webhook can forward them to the Events API for Conversion optimization.
  const cookies = parseCookies(req.headers.cookie);
  const ttclid = cookies.ttclid || req.query?.ttclid || null;
  const ttp = cookies._ttp || null;
  const userAgent = req.headers['user-agent'] || null;
  const tiktokIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || null;

  // Google attribution — the purchase itself is reported to GA4 from the webhook
  // (see api/_lib/ga4.js), which only fires after the buyer has left the site.
  // Carry the ids GA4 needs to credit the sale to the right session, and the
  // Google Ads click id as a manual-upload fallback, through the checkout.
  const gaFromCookies = gaIdsFromCookies(req.headers.cookie);
  const gaClientId = cleanClientId(body.gaClientId) || gaFromCookies.clientId;
  const gaSessionId = cleanSessionId(body.gaSessionId) || gaFromCookies.sessionId;
  const gclid = cleanClickId(body.gclid) || gclidFromCookies(req.headers.cookie);
  // Consent Mode defaults to denied, so only an explicit grant counts as one.
  const adsConsent = body.adsConsent === 'granted' ? 'granted' : 'denied';

  // LemonSqueezy rejects null/undefined values in checkout_data.custom with a
  // 422 ("must be a string"). Only include fields that are actual strings.
  const customData = { device_id: String(deviceId || '') };
  if (ttclid && typeof ttclid === 'string') customData.ttclid = ttclid;
  if (ttp && typeof ttp === 'string') customData.ttp = ttp;
  if (userAgent && typeof userAgent === 'string') customData.user_agent = userAgent;
  if (tiktokIp && typeof tiktokIp === 'string') customData.ip = tiktokIp;
  if (gaClientId) customData.ga_client_id = gaClientId;
  if (gaSessionId) customData.ga_session_id = gaSessionId;
  if (gclid) customData.gclid = gclid;
  customData.ga_consent = adsConsent;

  try {
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            product_options: {
              // {order_id} is substituted by Lemon Squeezy on redirect so the
              // frontend's ?order_id= handler can auto-activate the subscription
              // even when the LS overlay script is blocked (ad-blockers).
              redirect_url: siteUrl + '/?order_id={order_id}',
              receipt_button_text: 'Go to ScentWise',
              receipt_link_url: siteUrl + '/'
            },
            checkout_data: {
              custom: customData
            }
          },
          relationships: {
            store: {
              data: { type: 'stores', id: storeId }
            },
            variant: {
              data: { type: 'variants', id: variantId }
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Lemon Squeezy checkout creation failed:', response.status, errText);
      return res.status(502).json({ error: 'Could not create checkout' });
    }

    const data = await response.json();
    const checkoutUrl = data.data?.attributes?.url;

    if (!checkoutUrl) {
      console.error('No checkout URL in Lemon Squeezy response');
      return res.status(502).json({ error: 'Could not create checkout' });
    }

    return res.status(200).json({ url: checkoutUrl });

  } catch (err) {
    console.error('Create checkout error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
