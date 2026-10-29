// Refunded orders. The premium cookie is a signed, year-long token that only the
// HMAC check guards, so a buyer who copied it before a refund could keep using
// it. The refund webhook records the order here and every premium check reads it.

const KEY = (orderId) => `sw_revoked:${orderId}`;
const TTL = 400 * 24 * 60 * 60; // outlives the 365-day cookie

function redisCreds() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function revokeOrder(orderId) {
  const r = redisCreds();
  if (!r || !orderId) return false;
  try {
    const resp = await fetch(`${r.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${r.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', KEY(orderId), String(Date.now()), 'EX', TTL]])
    });
    return resp.ok;
  } catch { return false; }
}

// Fails open: if Redis is down, a paying customer keeps access rather than being
// locked out; check-tier's periodic Lemon Squeezy re-check still catches refunds.
async function isOrderRevoked(orderId) {
  const r = redisCreds();
  if (!r || !orderId) return false;
  try {
    const resp = await fetch(`${r.url}/GET/${encodeURIComponent(KEY(orderId))}`, {
      headers: { Authorization: `Bearer ${r.token}` }
    });
    if (!resp.ok) return false;
    const body = await resp.json();
    return !!body.result;
  } catch { return false; }
}

module.exports = { revokeOrder, isOrderRevoked };
