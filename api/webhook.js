const crypto = require('crypto');
const {
  sendGa4Ecommerce,
  claimOnce,
  rememberConversion,
  getConversion,
  forgetConversion,
  cleanClientId,
  cleanSessionId,
  cleanClickId
} = require('./_lib/ga4');

// Lemon Squeezy sends webhooks for order (one-time purchase) and subscription events.
// This endpoint logs events for monitoring; actual auth uses cookie-based verification.
// Set LEMONSQUEEZY_WEBHOOK_SECRET in Vercel env vars (from LS dashboard > Webhooks).

// In-memory idempotency cache (event_id → timestamp). TTL: 10 minutes.
const _processedEvents = new Map();
const IDEMPOTENCY_TTL = 10 * 60 * 1000;

function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (Buffer.byteLength(hmac) !== Buffer.byteLength(signature)) return false;
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  // Stream the raw bytes directly. Works whether Vercel's parser ran or not —
  // if it ran, req has usually been fully consumed and this yields '', which
  // then fails signature check cleanly. If parser is disabled, we get the
  // original bytes needed for HMAC verification.
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function sendTikTokConversion(eventName, eventData) {
  const PIXEL_ID = process.env.TIKTOK_PIXEL_ID;
  const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;

  // Step 1: env var kontrol
  console.log('[tiktok-debug] PIXEL_ID present:', !!PIXEL_ID);
  console.log('[tiktok-debug] ACCESS_TOKEN present:', !!ACCESS_TOKEN);
  console.log('[tiktok-debug] ACCESS_TOKEN length:', ACCESS_TOKEN?.length);

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.error('[tiktok-debug] MISSING ENV VARS — aborting');
    return;
  }

  const sha256 = (s) => crypto.createHash('sha256')
    .update(String(s).trim().toLowerCase()).digest('hex');

  const payload = {
    event_source: 'web',
    event_source_id: PIXEL_ID,
    data: [{
      event: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: String(eventData.event_id),
      user: {
        email: eventData.email ? sha256(eventData.email) : undefined,
        ttclid: eventData.ttclid || undefined,
        ttp: eventData.ttp || undefined,
        ip: eventData.ip || undefined,
        user_agent: eventData.user_agent || undefined,
      },
      properties: {
        currency: eventData.currency || 'USD',
        value: Number(eventData.value || 0),
        contents: [{
          content_id: eventData.content_id || 'scentwise-premium',
          content_type: 'product',
          content_name: 'ScentWise Premium',
          quantity: 1,
          price: Number(eventData.value || 0),
        }],
      },
      page: { url: eventData.page_url || 'https://scent-wise.com/' },
    }],
  };

  console.log('[tiktok-debug] Payload prepared. Event:', eventName, 'EventID:', eventData.event_id);
  console.log('[tiktok-debug] About to call fetch()...');

  try {
    const startTime = Date.now();
    const response = await fetch(
      'https://business-api.tiktok.com/open_api/v1.3/event/track/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': ACCESS_TOKEN,
        },
        body: JSON.stringify(payload),
      }
    );
    const elapsed = Date.now() - startTime;
    console.log('[tiktok-debug] fetch() returned in', elapsed, 'ms. HTTP status:', response.status);

    const text = await response.text();
    console.log('[tiktok-debug] Response body (raw):', text);

    let json;
    try { json = JSON.parse(text); }
    catch (e) {
      console.error('[tiktok-debug] Response is NOT valid JSON');
      return;
    }

    if (json.code === 0) {
      console.log('[tiktok-debug] ✓ SUCCESS — TikTok accepted event. request_id:', json.request_id);
    } else {
      console.error('[tiktok-debug] ✗ TikTok API error. code:', json.code, 'message:', json.message);
    }
  } catch (err) {
    console.error('[tiktok-debug] ✗ fetch THREW an error:', err?.message, err?.stack);
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Missing LEMONSQUEEZY_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Server not configured' });
  }

  const rawBody = await readRawBody(req);
  if (!rawBody) {
    console.error('Webhook received empty body — bodyParser may have consumed it');
    return res.status(400).json({ error: 'Empty request body' });
  }

  const signature = req.headers['x-signature'];
  if (!verifySignature(rawBody, signature, webhookSecret)) {
    console.error('Webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  const eventName = payload.meta?.event_name;
  const customData = payload.meta?.custom_data || {};
  const attrs = payload.data?.attributes || {};

  // Idempotency: webhook_id is the endpoint ID — identical for every event, so
  // using it as the key would collapse every delivery after the first into a
  // duplicate. Use resource id + timestamp so retries of the same event dedupe
  // but distinct updates of the same subscription process independently.
  const resourceId = payload.data?.id;
  const eventTs = attrs.updated_at || attrs.created_at || '';
  const idempKey = resourceId ? `${eventName}:${resourceId}:${eventTs}` : null;
  if (idempKey) {
    if (_processedEvents.has(idempKey)) {
      return res.status(200).json({ received: true, duplicate: true });
    }
    _processedEvents.set(idempKey, Date.now());
    // Prune old entries
    if (_processedEvents.size > 500) {
      const now = Date.now();
      for (const [k, t] of _processedEvents) {
        if (now - t > IDEMPOTENCY_TTL) _processedEvents.delete(k);
      }
    }
  }

  const expectedStoreId = process.env.LEMONSQUEEZY_STORE_ID;
  if (expectedStoreId && String(attrs.store_id) !== expectedStoreId) {
    console.error(`Webhook store_id mismatch: ${attrs.store_id}`);
    return res.status(200).json({ received: true }); // ACK but ignore
  }

  // Product ID check is required — without it, any purchase in the same store
  // (including unrelated products) would unlock Premium.
  const expectedProductId = process.env.LEMONSQUEEZY_PRODUCT_ID;
  if (!expectedProductId) {
    console.error('Missing LEMONSQUEEZY_PRODUCT_ID — refusing to trust webhook');
    return res.status(500).json({ error: 'Server not configured' });
  }
  if (String(attrs.first_order_item?.product_id) !== expectedProductId) {
    console.error(`Webhook product_id mismatch: ${attrs.first_order_item?.product_id}`);
    return res.status(200).json({ received: true }); // ACK but ignore
  }

  // Log the event for monitoring (no PII — omit emails and customer IDs)
  console.log(`[LS Webhook] ${eventName}`, {
    status: attrs.status,
    storeId: attrs.store_id
  });

  // Persist device_id → subscription mapping so the paying device auto-unlocks
  // on its next visit (no manual order-number entry needed).
  async function bindDeviceToOrder() {
    const deviceId = typeof customData.device_id === 'string' ? customData.device_id : null;
    if (!deviceId || !/^[a-f0-9]{32}$/.test(deviceId)) return;
    const subId = String(payload.data?.id || '');
    const custId = String(attrs.customer_id || '');
    const email = attrs.user_email || '';
    if (!subId || !custId) return;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      console.warn('[LS Webhook] No Redis — cannot persist device binding');
      return;
    }
    try {
      const key = `sw_devicesub:${deviceId}`;
      const value = JSON.stringify({ subId, custId, email, boundAt: Date.now() });
      // 365 days — Premium is a one-time lifetime purchase, so keep the device
      // binding around long enough to auto-unlock returning buyers for a year.
      await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['SET', key, value],
          ['EXPIRE', key, 365 * 24 * 60 * 60]
        ])
      });
    } catch (err) {
      console.error('[LS Webhook] Failed to persist device binding:', err.message);
    }
  }

  // Checkout custom data comes back on the webhook, but Lemon Squeezy has put it
  // in different places over time. Merge every spot rather than picking the
  // first one present — an empty object in an earlier spot would otherwise mask
  // the real data — and let meta.custom_data, the documented location, win.
  function attributionData() {
    const sources = [
      attrs.first_order_item?.product_options?.custom,
      attrs.custom_data,
      customData
    ].filter((src) => src && typeof src === 'object' && !Array.isArray(src));
    return Object.assign({}, ...sources);
  }

  // GA4 conversion. The browser never witnesses the purchase (checkout finishes
  // on Lemon Squeezy), so this webhook is the only reliable source for it.
  async function reportPurchaseToGa4() {
    const orderId = String(payload.data?.id || '');
    if (!orderId) return;
    // Redis SET NX: a retry landing on a cold instance must not report the same
    // sale twice — the in-memory guard above only covers one instance.
    if (!(await claimOnce(`sw_ga4sent:${orderId}`, 30 * 24 * 60 * 60))) {
      console.log('[ga4] purchase already reported for order', orderId);
      return;
    }

    const custom = attributionData();
    // attrs.total is in cents of attrs.currency; total_usd covers orders that
    // report only the converted amount.
    const value = (Number(attrs.total || 0) / 100) || (Number(attrs.total_usd || 0) / 100);
    const currency = attrs.total ? (attrs.currency || 'USD') : 'USD';
    const createdAt = Date.parse(attrs.created_at || '') || Date.now();
    const clientId = cleanClientId(custom.ga_client_id);
    const gclid = cleanClickId(custom.gclid);

    await sendGa4Ecommerce('purchase', {
      transactionId: orderId,
      value,
      currency,
      tax: Number(attrs.tax || 0) / 100,
      clientId,
      sessionId: cleanSessionId(custom.ga_session_id),
      adsConsent: custom.ga_consent,
      timestampMs: createdAt,
      fallbackSeed: custom.device_id || orderId
    });

    // Kept for 90 days so a sale GA4 could not attribute (cookies cleared, paid
    // on another device) can still be uploaded to Google Ads by hand.
    if (gclid) {
      await rememberConversion({
        transactionId: orderId,
        gclid,
        clientId,
        value,
        currency,
        createdAt: new Date(createdAt).toISOString()
      });
    }
  }

  async function reportRefundToGa4() {
    const orderId = String(payload.data?.id || '');
    if (!orderId) return;
    if (!(await claimOnce(`sw_ga4refund:${orderId}`, 30 * 24 * 60 * 60))) return;

    const custom = attributionData();
    // Refund payloads often arrive without the original checkout custom data,
    // so fall back to the client_id captured when the order was placed.
    const stored = await getConversion(orderId);
    const refunded = Number(attrs.refunded_amount || attrs.total || 0) / 100;

    await sendGa4Ecommerce('refund', {
      transactionId: orderId,
      value: refunded,
      currency: attrs.currency || 'USD',
      clientId: cleanClientId(custom.ga_client_id) || (stored?.clientId || ''),
      sessionId: cleanSessionId(custom.ga_session_id),
      adsConsent: custom.ga_consent,
      timestampMs: Date.parse(attrs.refunded_at || attrs.updated_at || '') || Date.now(),
      fallbackSeed: custom.device_id || orderId
    });

    // Drop it from the manual-upload queue — a refunded sale is not a conversion.
    await forgetConversion(orderId);
  }

  // Handle relevant events
  switch (eventName) {
    case 'order_created': {
      console.log(`[LS Webhook] New order received`);
      await bindDeviceToOrder();
      const tiktokCustom = payload.data?.attributes?.first_order_item?.product_options?.custom
                        || payload.data?.attributes?.custom_data
                        || customData
                        || {};
      const totalUsd = Number(payload.data?.attributes?.total_usd || payload.data?.attributes?.total || 0) / 100;
      await sendTikTokConversion('CompletePayment', {
        event_id: payload.data.id,
        email: payload.data?.attributes?.user_email,
        value: totalUsd || 10,
        currency: payload.data?.attributes?.currency || 'USD',
        ttclid: tiktokCustom.ttclid,
        ttp: tiktokCustom.ttp,
        ip: tiktokCustom.ip,
        user_agent: tiktokCustom.user_agent,
        page_url: 'https://scent-wise.com/',
        content_id: 'scentwise-premium',
      });
      await reportPurchaseToGa4();
      break;
    }

    case 'subscription_created': {
      console.log(`[LS Webhook] Subscription created`);
      await bindDeviceToOrder();
      const tiktokCustom = payload.data?.attributes?.first_order_item?.product_options?.custom
                        || payload.data?.attributes?.custom_data
                        || customData
                        || {};
      const totalUsd = Number(payload.data?.attributes?.total_usd || payload.data?.attributes?.total || 0) / 100;
      await sendTikTokConversion('CompletePayment', {
        event_id: payload.data.id,
        email: payload.data?.attributes?.user_email,
        value: totalUsd || 10,
        currency: payload.data?.attributes?.currency || 'USD',
        ttclid: tiktokCustom.ttclid,
        ttp: tiktokCustom.ttp,
        ip: tiktokCustom.ip,
        user_agent: tiktokCustom.user_agent,
        page_url: 'https://scent-wise.com/',
        content_id: 'scentwise-premium',
      });
      break;
    }

    case 'subscription_updated':
      console.log(`[LS Webhook] Subscription updated: status=${attrs.status}`);
      break;

    case 'subscription_cancelled':
      console.log(`[LS Webhook] Subscription cancelled`);
      break;

    case 'subscription_expired':
      console.log(`[LS Webhook] Subscription expired`);
      break;

    case 'subscription_paused':
      console.log(`[LS Webhook] Subscription paused`);
      break;

    case 'subscription_unpaused':
      console.log(`[LS Webhook] Subscription unpaused`);
      break;

    case 'subscription_resumed':
      console.log(`[LS Webhook] Subscription resumed`);
      break;

    case 'order_refunded':
      console.log(`[LS Webhook] Order refunded`);
      await reportRefundToGa4();
      break;

    default:
      console.log(`[LS Webhook] Unhandled event: ${eventName}`);
  }

  // Always ACK the webhook to prevent retries
  return res.status(200).json({ received: true });
}

// Disable Vercel's body parser so we receive the raw body for signature verification.
// Attach config BEFORE the export so Vercel reliably detects it at build time.
handler.config = { api: { bodyParser: false } };
module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
