const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin } = require('./_lib/csrf');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`checkout:${ip}`, 5, 60000); // 5 attempts/min
  if (!rl.allowed) return res.status(429).json({ error: 'Too many attempts. Try again later.' });

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

  if (!apiKey || !storeId || !variantId) {
    console.error('Missing LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, or LEMONSQUEEZY_VARIANT_ID');
    return res.status(500).json({ error: 'Checkout not configured' });
  }

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
            checkout_options: {
              embed: true
            },
            checkout_data: {
              custom: {}
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
