const crypto = require('crypto');
const { rateLimit, getClientIp } = require('../lib/rate-limit');
const { validateOrigin } = require('../lib/csrf');
const { verifyOwnerToken } = require('../lib/owner-token');
const { readUsage, readFreeUsage, MAX_MONTHLY_QUERIES, FREE_TRIAL_QUERIES, parseCookies } = require('../lib/usage');

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

function makeToken(subscriptionId, customerId, secret) {
  return crypto.createHmac('sha256', secret).update(subscriptionId + ':' + customerId).digest('hex');
}

// Combined handler for /api/check-tier (GET) and /api/verify-subscription (POST)
module.exports = async function handler(req, res) {
  const ip = getClientIp(req);

  // --- Check tier (GET) ---
  if (req.method === 'GET') {
    const rl = await rateLimit(`check-tier:${ip}`, 30, 60000);
    if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' });

    const isSameOrigin = req.headers['sec-fetch-site'] === 'same-origin'
      || req.headers['x-requested-with'] === 'ScentWise';

    const cookies = parseCookies(req.headers.cookie || '');
    const subSecret = process.env.SUBSCRIPTION_SECRET;
    const ownerKey = process.env.OWNER_KEY;

    if (ownerKey && cookies.sw_owner) {
      if (verifyOwnerToken(cookies.sw_owner, ownerKey)) {
        return res.status(200).json({ tier: 'owner' });
      }
    }

    if (subSecret && cookies.sw_sub) {
      const sub = verifySubToken(cookies.sw_sub, subSecret);
      if (sub) {
        const lsApiKey = process.env.LEMONSQUEEZY_API_KEY;
        const needsRevalidation = lsApiKey && !cookies.sw_revalidated && isSameOrigin;
        const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

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
                res.setHeader('Set-Cookie', [`sw_sub=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`]);
                return res.status(200).json({ tier: 'free' });
              }
              if (status === 'refunded' || status === 'paused' || status === 'expired') {
                res.setHeader('Set-Cookie', [`sw_sub=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`]);
                return res.status(200).json({ tier: 'free' });
              }
            }
            const existing = res.getHeader('Set-Cookie') || [];
            const setCookies = Array.isArray(existing) ? [...existing] : [existing];
            setCookies.push(`sw_revalidated=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${isProduction ? '; Secure' : ''}`);
            res.setHeader('Set-Cookie', setCookies);
          } catch (err) {
            console.error('LS revalidation error:', err.message);
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
      if (isSameOrigin) {
        const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
        res.setHeader('Set-Cookie', [`sw_sub=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`]);
      }
    }

    const trialSecret = process.env.SUBSCRIPTION_SECRET || process.env.OWNER_KEY;
    if (trialSecret) {
      const freeUsage = await readFreeUsage(req, ip, trialSecret);
      return res.status(200).json({
        tier: 'free',
        freeUsed: freeUsage.count,
        freeLimit: FREE_TRIAL_QUERIES
      });
    }

    return res.status(200).json({ tier: 'free', freeUsed: 0, freeLimit: FREE_TRIAL_QUERIES });
  }

  // --- Verify subscription (POST) ---
  if (req.method === 'POST') {
    if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

    const rl = await rateLimit(`verify-sub:${ip}`, 10, 60000);
    if (!rl.allowed) return res.status(429).json({ error: 'Too many attempts. Try again later.' });

    let { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
    if (typeof orderId !== 'string') return res.status(400).json({ error: 'Invalid order ID format' });
    orderId = orderId.trim().replace(/^#/, '').replace(/[^\d]/g, '');
    if (!orderId || orderId.length > 20) {
      return res.status(400).json({ error: 'Invalid order ID format. Enter the numeric order number (e.g. 2944561).' });
    }

    const lsApiKey = process.env.LEMONSQUEEZY_API_KEY;
    const subSecret = process.env.SUBSCRIPTION_SECRET;
    const expectedStoreId = process.env.LEMONSQUEEZY_STORE_ID;
    const expectedProductId = process.env.LEMONSQUEEZY_PRODUCT_ID;

    if (!lsApiKey || !subSecret) {
      console.error('Missing LEMONSQUEEZY_API_KEY or SUBSCRIPTION_SECRET');
      return res.status(500).json({ error: 'Server not configured' });
    }

    try {
      const lsHeaders = {
        'Authorization': `Bearer ${lsApiKey}`,
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      };

      let orderData = null;

      const orderRes = await fetch(`https://api.lemonsqueezy.com/v1/orders/${orderId}`, {
        headers: lsHeaders
      });

      if (orderRes.ok) {
        orderData = await orderRes.json();
      } else if (orderRes.status === 401 || orderRes.status === 403) {
        const errBody = await orderRes.text().catch(() => '');
        console.error(`LS API auth error: ${orderRes.status} — ${errBody}`);
        return res.status(502).json({ error: 'Subscription service authentication failed. The site owner needs to check the LEMONSQUEEZY_API_KEY setting.' });
      } else {
        const errBody = await orderRes.text().catch(() => '');
        console.error(`LS API order-by-id miss: ${orderRes.status} for ${orderId} — ${errBody}`);

        const searchUrl = `https://api.lemonsqueezy.com/v1/orders?page[size]=25`;
        const listRes = await fetch(searchUrl, { headers: lsHeaders });
        if (listRes.ok) {
          const listData = await listRes.json();
          const match = (listData.data || []).find(o =>
            String(o.attributes.order_number) === orderId
          );
          if (match) orderData = { data: match };
        }
      }

      if (!orderData) {
        return res.status(400).json({ error: 'Order not found. Please check your order number and try again, or log in with your email.' });
      }

      const order = orderData.data?.attributes;

      if (!order || order.status === 'refunded') {
        return res.status(400).json({ error: 'This order is not valid or has been refunded. Please contact support if you believe this is an error.' });
      }

      if (expectedStoreId && String(order.store_id) !== expectedStoreId) {
        console.error(`Order store_id mismatch: ${order.store_id}`);
        return res.status(400).json({ error: 'This order ID does not belong to ScentWise. Please check your order number and try again.' });
      }

      if (expectedProductId && String(order.first_order_item?.product_id) !== expectedProductId) {
        console.error(`Order product_id mismatch: ${order.first_order_item?.product_id}`);
        return res.status(400).json({ error: 'This order is for a different product. Please use your ScentWise order number.' });
      }

      const subscriptionId = String(orderData.data?.id || '');
      const customerId = String(order.customer_id || '');
      const customerEmail = order.user_email || '';

      if (!subscriptionId || !customerId) {
        return res.status(400).json({ error: 'No subscription found' });
      }

      const token = makeToken(subscriptionId, customerId, subSecret);
      const cookieValue = Buffer.from(JSON.stringify({
        token, subId: subscriptionId, custId: customerId, email: customerEmail
      })).toString('base64');

      const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
      const maxAge = 30 * 24 * 60 * 60;

      res.setHeader('Set-Cookie', [
        `sw_sub=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`
      ]);

      return res.status(200).json({ success: true, tier: 'premium', email: customerEmail });

    } catch (err) {
      console.error('Verify subscription error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
