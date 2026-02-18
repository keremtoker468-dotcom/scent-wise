// Owner token with weekly rotation.
// Tokens are valid for the current + previous week period,
// so they naturally expire after ~2 weeks without key rotation.
const crypto = require('crypto');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getWeekPeriod() {
  return Math.floor(Date.now() / WEEK_MS);
}

function makeOwnerToken(ownerKey) {
  const period = getWeekPeriod();
  return crypto.createHmac('sha256', ownerKey)
    .update(`scentwise-owner-v2:${period}`).digest('hex');
}

function verifyOwnerToken(cookieValue, ownerKey) {
  if (!cookieValue || !ownerKey) return false;
  const currentPeriod = getWeekPeriod();

  // Check v2 tokens (current + previous period)
  for (const period of [currentPeriod, currentPeriod - 1]) {
    try {
      const expected = crypto.createHmac('sha256', ownerKey)
        .update(`scentwise-owner-v2:${period}`).digest('hex');
      if (Buffer.byteLength(cookieValue) === Buffer.byteLength(expected) &&
          crypto.timingSafeEqual(Buffer.from(cookieValue), Buffer.from(expected))) {
        return true;
      }
    } catch {}
  }

  // Accept legacy v1 token until 2026-04-01, then remove this block
  const V1_SUNSET = new Date('2026-04-01T00:00:00Z').getTime();
  if (Date.now() < V1_SUNSET) {
    try {
      const legacy = crypto.createHmac('sha256', ownerKey)
        .update('scentwise-owner-v1').digest('hex');
      if (Buffer.byteLength(cookieValue) === Buffer.byteLength(legacy) &&
          crypto.timingSafeEqual(Buffer.from(cookieValue), Buffer.from(legacy))) {
        return true;
      }
    } catch {}
  }

  return false;
}

module.exports = { makeOwnerToken, verifyOwnerToken };
