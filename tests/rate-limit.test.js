// Test rate limiter pure functions (in-memory fallback, no Redis needed)
// We test the exported rateLimit with no Redis env vars set

// Ensure no Redis env vars are set for these tests
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { rateLimit, getClientIp } = require('../api/_lib/rate-limit');

describe('rateLimit (in-memory fallback)', () => {
  test('allows requests under the limit', async () => {
    const result = await rateLimit('test-key-1', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test('counts requests correctly', async () => {
    const key = 'test-count-' + Date.now();
    const r1 = await rateLimit(key, 3, 60000);
    expect(r1.remaining).toBe(2);
    const r2 = await rateLimit(key, 3, 60000);
    expect(r2.remaining).toBe(1);
    const r3 = await rateLimit(key, 3, 60000);
    expect(r3.remaining).toBe(0);
  });

  test('blocks requests over the limit', async () => {
    const key = 'test-block-' + Date.now();
    await rateLimit(key, 2, 60000);
    await rateLimit(key, 2, 60000);
    const r3 = await rateLimit(key, 2, 60000);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });
});

describe('getClientIp', () => {
  test('extracts from x-real-ip', () => {
    const req = { headers: { 'x-real-ip': '1.2.3.4' }, socket: { remoteAddress: '127.0.0.1' } };
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  test('extracts last IP from x-forwarded-for (most trusted)', () => {
    const req = { headers: { 'x-forwarded-for': '5.6.7.8, 10.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } };
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  test('falls back to socket', () => {
    const req = { headers: {}, socket: { remoteAddress: '192.168.1.1' } };
    expect(getClientIp(req)).toBe('192.168.1.1');
  });

  test('prefers x-real-ip over x-forwarded-for', () => {
    const req = {
      headers: { 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' },
      socket: { remoteAddress: '3.3.3.3' }
    };
    expect(getClientIp(req)).toBe('1.1.1.1');
  });
});
