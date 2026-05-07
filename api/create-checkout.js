const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin, validateContentType, isBodyTooLarge } = require('./_lib/csrf');
const { readOrMintDeviceId } = require('./_lib/usage');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
  if (!validateContentType(req)) return res.status(415).json({ error: 'Content-Type must be application/json' });
  if (isBodyTooLarge(req)) return res.status(413).json({ error: 'Request too large' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`checkout:${ip}`, 5, 60000); // 5 attempts/min
  if (!rl.allowed) { res.setHeader('Retry-After', rl.retryAfter || 60); return res.status(429).json({ error: 'Too many attempts. Try again later.' }); }

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
  const cookies = req.cookies || (() => {
    const out = {};
    const raw = req.headers.cookie;
    if (!raw) return out;
    for (const part of raw.split('; ')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      out[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
    }
    return out;
  })();
  const ttclid = cookies.ttclid || '';
  const ttp = cookies._ttp || '';
  const userAgent = req.headers['user-agent'] || '';
  const tiktokIp = (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() || '';

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
              custom: {
                ...(deviceId ? { device_id: deviceId } : {}),
                ttclid,
                ttp,
                user_agent: userAgent,
                ip: tiktokIp
              }
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
