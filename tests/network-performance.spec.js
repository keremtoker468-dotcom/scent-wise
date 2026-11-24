// @ts-check
const { test, expect } = require('@playwright/test');
const { mockAPIs } = require('./helpers');

test('no render-blocking scripts in head', async ({ page }) => {
  await mockAPIs(page);
  await page.goto('/');
  const blocking = await page.evaluate(() => Array.from(document.querySelectorAll('head script[src]')).filter((s) => !s.defer && !s.async).map((s) => s.getAttribute('src')));
  // consent.js must run first (Consent Mode defaults before any Google tag), so it is allowed.
  expect(blocking.filter((s) => !/consent\.js/.test(s || ''))).toEqual([]);
});

test('home page only calls the tier API', async ({ page }) => {
  const calls = [];
  await page.route('**/api/**', (route) => { calls.push(new URL(route.request().url()).pathname); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tier: 'free', freeUsed: 0, hasProfile: false }) }); });
  await page.goto('/');
  await page.waitForTimeout(2000);
  expect(calls.filter((c) => !c.startsWith('/api/check-tier') && !c.startsWith('/api/img'))).toEqual([]);
});

// Plausible is cookieless and listed in privacy.html, so it may load before consent; Google may not.
test('no Google or other third-party requests before cookie consent', async ({ page }) => {
  await mockAPIs(page);
  const external = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1', 'plausible.io'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(u.hostname); });
  await page.goto('/');
  await page.waitForTimeout(2000);
  expect(external).toEqual([]);
});

test('the perfume database loads when the advisor opens', async ({ page }) => {
  await mockAPIs(page);
  const db = [];
  page.on('request', (r) => { if (/\/perfumes(-rich)?\.js/.test(r.url())) db.push(r.url()); });
  await page.goto('/advisor?mode=dupe');
  await expect.poll(() => db.length, { timeout: 10000 }).toBeGreaterThanOrEqual(2);
});
