const crypto = require('crypto');

// Test the pure functions from usage.js
// We import the module functions directly since they're CommonJS exports
const {
  parseCookies,
  getCurrentMonth,
  makeSig,
  readUsage,
  MAX_MONTHLY_QUERIES,
  FREE_TRIAL_QUERIES,
} = require('../api/_lib/usage');

const { verifyOwnerToken, makeOwnerToken } = require('../api/_lib/owner-token');

describe('parseCookies', () => {
  test('parses standard cookies', () => {
    const result = parseCookies('sw_sub=abc123; sw_usage=xyz456');
    expect(result.sw_sub).toBe('abc123');
    expect(result.sw_usage).toBe('xyz456');
  });

  test('handles empty string', () => {
    expect(parseCookies('')).toEqual({});
  });

  test('handles undefined', () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  test('handles cookies with = in values', () => {
    const result = parseCookies('token=abc=def=ghi');
    expect(result.token).toBe('abc=def=ghi');
  });

  test('trims key whitespace', () => {
    const result = parseCookies('key=value; other=val2');
    expect(result.key).toBe('value');
    expect(result.other).toBe('val2');
  });
});

describe('getCurrentMonth', () => {
  test('returns YYYY-MM format', () => {
    const month = getCurrentMonth();
    expect(month).toMatch(/^\d{4}-\d{2}$/);
  });

  test('month is current', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(getCurrentMonth()).toBe(expected);
  });
});

describe('HMAC signature (makeSig)', () => {
  const secret = 'test-secret-key';

  test('produces consistent signatures', () => {
    const sig1 = makeSig(secret, 'user1', 5, '2026-03');
    const sig2 = makeSig(secret, 'user1', 5, '2026-03');
    expect(sig1).toBe(sig2);
  });

  test('different inputs produce different signatures', () => {
    const sig1 = makeSig(secret, 'user1', 5, '2026-03');
    const sig2 = makeSig(secret, 'user2', 5, '2026-03');
    const sig3 = makeSig(secret, 'user1', 6, '2026-03');
    const sig4 = makeSig(secret, 'user1', 5, '2026-04');
    expect(sig1).not.toBe(sig2);
    expect(sig1).not.toBe(sig3);
    expect(sig1).not.toBe(sig4);
  });

  test('signature is hex string', () => {
    const sig = makeSig(secret, 'user1', 0, '2026-03');
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });
});

describe('readUsage', () => {
  const secret = 'test-subscription-secret';
  const userId = 'cust_12345';
  const month = getCurrentMonth();

  function makeValidCookie(count) {
    const sig = makeSig(secret, userId, count, month);
    return Buffer.from(JSON.stringify({ c: count, m: month, id: userId, sig })).toString('base64');
  }

  test('reads valid usage cookie', () => {
    const cookie = makeValidCookie(42);
    const req = { headers: { cookie: `sw_usage=${cookie}` } };
    const result = readUsage(req, userId, secret);
    expect(result.count).toBe(42);
    expect(result.month).toBe(month);
  });

  test('returns 0 for missing cookie', () => {
    const req = { headers: { cookie: '' } };
    const result = readUsage(req, userId, secret);
    expect(result.count).toBe(0);
  });

  test('returns 0 for tampered count', () => {
    const sig = makeSig(secret, userId, 5, month);
    // Tamper the count from 5 to 999
    const tampered = Buffer.from(JSON.stringify({ c: 999, m: month, id: userId, sig })).toString('base64');
    const req = { headers: { cookie: `sw_usage=${tampered}` } };
    const result = readUsage(req, userId, secret);
    expect(result.count).toBe(0); // Should reject tampered cookie
  });

  test('returns 0 for wrong user', () => {
    const cookie = makeValidCookie(10);
    const req = { headers: { cookie: `sw_usage=${cookie}` } };
    const result = readUsage(req, 'different_user', secret);
    expect(result.count).toBe(0);
  });

  test('returns 0 for corrupted cookie', () => {
    const req = { headers: { cookie: 'sw_usage=not-valid-base64!!!' } };
    const result = readUsage(req, userId, secret);
    expect(result.count).toBe(0);
  });
});

describe('Owner token verification', () => {
  const ownerKey = 'my-owner-key-2026';

  test('valid token verifies correctly', () => {
    const token = makeOwnerToken(ownerKey);
    expect(verifyOwnerToken(token, ownerKey)).toBe(true);
  });

  test('invalid token fails', () => {
    expect(verifyOwnerToken('bogus-token', ownerKey)).toBe(false);
  });

  test('empty token fails', () => {
    expect(verifyOwnerToken('', ownerKey)).toBe(false);
  });

  test('different key fails', () => {
    const token = makeOwnerToken(ownerKey);
    expect(verifyOwnerToken(token, 'wrong-key')).toBe(false);
  });
});

describe('Constants', () => {
  test('MAX_MONTHLY_QUERIES is 500', () => {
    expect(MAX_MONTHLY_QUERIES).toBe(500);
  });

  test('FREE_TRIAL_QUERIES is 3', () => {
    expect(FREE_TRIAL_QUERIES).toBe(3);
  });
});
