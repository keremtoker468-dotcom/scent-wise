// GA4 Measurement Protocol — server-side conversion tracking.
//
// Checkout completes on Lemon Squeezy's domain, so the browser never reaches a
// confirmation page we control: ad blockers, closed tabs and mobile app
// switches all lose a client-side purchase event. The Lemon Squeezy webhook is
// the only signal that fires for every sale, so GA4 conversions are reported
// from there instead.
//
// GA4 can only credit the sale to the right session — and therefore to the
// Google Ads click that paid for it — when the event carries the visitor's
// client_id and session_id, which live in the browser's _ga cookies.
// api/create-checkout.js captures them into the checkout's custom data and
// Lemon Squeezy hands them back untouched in the webhook payload.

const crypto = require('crypto');

const MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
// Same payload, but returns validationMessages instead of swallowing errors.
const MP_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';
const SEND_TIMEOUT_MS = 3000;                 // never let Google stall the webhook ACK
const MAX_BACKDATE_MS = 71 * 60 * 60 * 1000;  // GA4 drops events older than 72h

const CONVERSION_PREFIX = 'sw_conv:';
const CONVERSION_INDEX = 'sw_conv_index';
const CONVERSION_INDEX_MAX = 500;
const CONVERSION_TTL = 90 * 24 * 60 * 60;     // Google Ads offline upload window

// _ga=GA1.<domain depth>.<client id>, where the client id is itself
// "<random>.<first seen>" — that pair is what the Measurement Protocol wants.
const CLIENT_ID_RE = /^\d{1,20}\.\d{1,20}$/;
const SESSION_ID_RE = /^\d{6,20}$/;
const CLICK_ID_RE = /^[A-Za-z0-9._-]{1,200}$/;

const cleanClientId = (v) => (typeof v === 'string' && CLIENT_ID_RE.test(v) ? v : '');
const cleanSessionId = (v) => (typeof v === 'string' && SESSION_ID_RE.test(v) ? v : '');
const cleanClickId = (v) => (typeof v === 'string' && CLICK_ID_RE.test(v) ? v : '');

// --- Browser ids ---

// The _ga cookies are first-party and not HttpOnly, so they reach the server on
// every request. Reading them here is the fallback for when the client could
// not (private mode, script error) send the ids itself.
function gaIdsFromCookies(cookieHeader) {
  const raw = String(cookieHeader || '');
  const out = { clientId: '', sessionId: '' };

  const client = raw.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/);
  if (client) out.clientId = cleanClientId(client[1]);

  // Per-stream session cookie: _ga_<measurement id without the "G-" prefix>.
  // Two formats are live in the wild — GS1.1.<session id>.<hits>… and the newer
  // GS2.1.s<session id>$o<n>$g<n>… — so match the session id in either.
  const session = raw.match(/(?:^|;\s*)_ga_[A-Z0-9]+=GS\d+\.\d+\.s?(\d{6,20})/);
  if (session) out.sessionId = cleanSessionId(session[1]);

  return out;
}

// Set by Google's conversion linker when a visitor lands with ?gclid=…
// Format: _gcl_aw=GCL.<timestamp>.<click id>
function gclidFromCookies(cookieHeader) {
  const m = String(cookieHeader || '').match(/(?:^|;\s*)_gcl_aw=GCL\.\d+\.([A-Za-z0-9._-]+)/);
  return m ? cleanClickId(m[1]) : '';
}

// A sale with no client_id still carries its revenue, so fall back to an id
// derived from the device token: stable per device (a second purchase from the
// same browser stays one GA4 user) but not linkable to a real session.
function fallbackClientId(seed) {
  const hash = crypto.createHash('sha256').update(String(seed || 'anonymous')).digest();
  return `${hash.readUInt32BE(0)}.${hash.readUInt32BE(4)}`;
}

// --- Measurement Protocol ---

function ga4Configured() {
  return Boolean(process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET);
}

async function postToGa4(payload) {
  const debug = process.env.GA4_DEBUG === '1';
  const endpoint = debug ? MP_DEBUG_ENDPOINT : MP_ENDPOINT;
  const url = `${endpoint}?measurement_id=${encodeURIComponent(process.env.GA4_MEASUREMENT_ID)}`
    + `&api_secret=${encodeURIComponent(process.env.GA4_API_SECRET)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (debug) {
      // The live endpoint answers 204 to malformed payloads too; only the debug
      // endpoint says what is wrong, so surface it verbatim while testing.
      console.log('[ga4] debug response:', resp.status, await resp.text());
      return true;
    }
    if (resp.status !== 204 && resp.status !== 200) {
      console.error('[ga4] Measurement Protocol returned', resp.status);
      return false;
    }
    return true;
  } catch (err) {
    const reason = err?.name === 'AbortError' ? `timed out after ${SEND_TIMEOUT_MS}ms` : err?.message;
    console.error('[ga4] send failed:', reason);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Sends a GA4 ecommerce event ('purchase' or 'refund').
// order: { transactionId, value, currency, tax, clientId, sessionId,
//          adsConsent, timestampMs, fallbackSeed, itemId, itemName }
async function sendGa4Ecommerce(eventName, order) {
  if (!ga4Configured()) {
    console.warn(`[ga4] GA4_MEASUREMENT_ID / GA4_API_SECRET not set — ${eventName} not sent`);
    return false;
  }

  const transactionId = String(order.transactionId || '');
  if (!transactionId) {
    console.error(`[ga4] ${eventName} has no transaction_id — refusing to send`);
    return false;
  }

  const clientId = cleanClientId(order.clientId)
    || fallbackClientId(order.fallbackSeed || transactionId);
  const value = Math.round((Number(order.value) || 0) * 100) / 100;
  const currency = String(order.currency || 'USD').toUpperCase().slice(0, 3);

  const params = {
    transaction_id: transactionId,
    currency,
    value,
    // MP events with no engagement time are left out of the session's
    // engagement math; 1ms is the documented minimum.
    engagement_time_msec: 1,
    items: [{
      item_id: order.itemId || 'scentwise-lifetime',
      item_name: order.itemName || 'ScentWise Lifetime',
      item_category: 'Digital',
      price: value,
      quantity: 1
    }]
  };
  const sessionId = cleanSessionId(order.sessionId);
  if (sessionId) params.session_id = sessionId;
  const tax = Number(order.tax);
  if (tax > 0) params.tax = Math.round(tax * 100) / 100;

  // The cookie banner defaults to denied, so treat anything but an explicit
  // grant as denied — GA4 then models the sale instead of using it for ads.
  const adsGranted = order.adsConsent === 'granted';
  const payload = {
    client_id: clientId,
    non_personalized_ads: !adsGranted,
    consent: {
      ad_user_data: adsGranted ? 'GRANTED' : 'DENIED',
      ad_personalization: adsGranted ? 'GRANTED' : 'DENIED'
    },
    events: [{ name: eventName, params }]
  };

  // Backdate to the order time so the event lands in the session it belongs to.
  // A retry that arrives past GA4's 72h window would be dropped outright, so
  // those fall back to ingest time instead.
  const ts = Number(order.timestampMs) || 0;
  const age = Date.now() - ts;
  if (ts > 0 && age >= 0 && age < MAX_BACKDATE_MS) payload.timestamp_micros = ts * 1000;

  const ok = await postToGa4(payload);
  console.log(`[ga4] ${eventName} ${ok ? 'sent' : 'failed'}`, {
    transactionId,
    value,
    currency,
    attributed: Boolean(cleanClientId(order.clientId)),
    session: Boolean(sessionId)
  });
  return ok;
}

// --- Conversion store (Upstash Redis) ---
//
// GA4 can only join the sale to a Google Ads click through client_id, which is
// lost when the buyer clears cookies or pays on another device. Keeping the
// click id next to the order means those sales can still be recovered as a
// Google Ads offline conversion upload — api/conversions-export.js serves them
// as CSV.

function redisCreds() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redisPipeline(commands) {
  const creds = redisCreds();
  if (!creds) return null;
  try {
    const resp = await fetch(`${creds.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands)
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// Cross-instance send guard. Serverless instances share no memory, so a Lemon
// Squeezy retry landing on a cold one would report the same sale twice.
// SET NX makes the first caller the only one. Without Redis — or when Redis is
// unreachable — this allows the send: a missing conversion is worse than a
// duplicate, and webhook.js still holds an in-memory guard.
async function claimOnce(key, ttlSeconds) {
  if (!redisCreds()) return true;
  const results = await redisPipeline([['SET', key, '1', 'NX', 'EX', String(ttlSeconds)]]);
  if (!results) return true;
  return results[0]?.result === 'OK';
}

async function rememberConversion(record) {
  const id = String(record?.transactionId || '');
  if (!id || !redisCreds()) return false;
  const results = await redisPipeline([
    ['SET', `${CONVERSION_PREFIX}${id}`, JSON.stringify(record), 'EX', String(CONVERSION_TTL)],
    ['LPUSH', CONVERSION_INDEX, id],
    ['LTRIM', CONVERSION_INDEX, '0', String(CONVERSION_INDEX_MAX - 1)],
    ['EXPIRE', CONVERSION_INDEX, String(CONVERSION_TTL)]
  ]);
  return Boolean(results);
}

async function getConversion(id) {
  if (!id || !redisCreds()) return null;
  const results = await redisPipeline([['GET', `${CONVERSION_PREFIX}${id}`]]);
  const raw = results?.[0]?.result;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Called on refund so the sale is never uploaded to Google Ads as a conversion.
// The index keeps the id; listConversions skips ids whose record is gone.
async function forgetConversion(id) {
  if (!id || !redisCreds()) return false;
  const results = await redisPipeline([['DEL', `${CONVERSION_PREFIX}${id}`]]);
  return Boolean(results);
}

// Returns newest-first records, [] when none are stored, or null when Redis is
// not configured (so callers can tell "nothing yet" from "no store").
async function listConversions(limit) {
  if (!redisCreds()) return null;
  const requested = Number(limit) || CONVERSION_INDEX_MAX;
  const max = Math.min(Math.max(requested, 1), CONVERSION_INDEX_MAX);

  const index = await redisPipeline([['LRANGE', CONVERSION_INDEX, '0', String(max - 1)]]);
  const ids = index?.[0]?.result;
  if (!Array.isArray(ids) || !ids.length) return [];

  const keys = [...new Set(ids.map(String))].map((id) => `${CONVERSION_PREFIX}${id}`);
  const values = await redisPipeline([['MGET', ...keys]]);
  const rows = values?.[0]?.result;
  if (!Array.isArray(rows)) return [];

  return rows
    .filter(Boolean)
    .map((raw) => { try { return JSON.parse(raw); } catch { return null; } })
    .filter(Boolean);
}

module.exports = {
  cleanClientId,
  cleanSessionId,
  cleanClickId,
  gaIdsFromCookies,
  gclidFromCookies,
  fallbackClientId,
  ga4Configured,
  sendGa4Ecommerce,
  claimOnce,
  rememberConversion,
  getConversion,
  forgetConversion,
  listConversions
};
