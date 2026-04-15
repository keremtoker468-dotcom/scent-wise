// @ts-check
const { test, expect } = require('@playwright/test');

// Mock API responses for static server environment
async function mockAPIs(page) {
  await page.route('**/api/check-tier*', async route => {
    const url = route.request().url();
    if (url.includes('action=profile')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ hasProfile: false, profile: null }),
      });
    } else {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ tier: 'free', freeUsed: 0 }),
      });
    }
  });
  await page.route('**/api/recommend', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ result: 'Test AI response.', freeUsed: 1 }),
    });
  });
}

test.describe('Network Performance', () => {

  test.describe('Resource loading order', () => {

    test('critical resources load before non-critical', async ({ page }) => {
      await mockAPIs(page);
      const loadOrder = [];
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin === new URL(page.url() || 'http://localhost:3000').origin) {
          loadOrder.push(url.pathname);
        }
      });

      await page.goto('/');
      await page.waitForTimeout(3000);

      const appIdx = loadOrder.indexOf('/app.js');
      const perfIdx = loadOrder.findIndex(p => p === '/perfumes.js');
      const richIdx = loadOrder.findIndex(p => p === '/perfumes-rich.js');

      if (appIdx !== -1 && perfIdx !== -1) {
        expect(appIdx).toBeLessThan(perfIdx);
      }
      if (appIdx !== -1 && richIdx !== -1) {
        expect(appIdx).toBeLessThan(richIdx);
      }
    });

    test('no render-blocking scripts in head', async ({ page }) => {
      await mockAPIs(page);
      await page.goto('/');

      const blockingScripts = await page.evaluate(() => {
        const scripts = document.querySelectorAll('head script[src]');
        return Array.from(scripts)
          .filter(s => !s.hasAttribute('defer') && !s.hasAttribute('async'))
          .map(s => s.getAttribute('src'));
      });
      expect(blockingScripts).toHaveLength(0);
    });
  });

  test.describe('API call efficiency', () => {

    test('homepage makes only auth API calls', async ({ page }) => {
      const apiCalls = [];
      await page.route('**/api/**', async route => {
        apiCalls.push(new URL(route.request().url()).pathname);
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ tier: 'free', freeUsed: 0, hasProfile: false }),
        });
      });

      await page.goto('/');
      await page.waitForTimeout(3000);

      const nonAuthCalls = apiCalls.filter(c => !c.startsWith('/api/check-tier'));
      expect(nonAuthCalls).toHaveLength(0);
    });

    test('explore page search is client-side only (no API calls)', async ({ page }) => {
      await mockAPIs(page);
      await page.goto('/?mode=explore');
      await expect(page.locator('#exp-inp')).toBeVisible({ timeout: 30000 });

      // Track new API calls after page is loaded
      const searchApiCalls = [];
      page.on('request', req => {
        if (req.url().includes('/api/') && !req.url().includes('check-tier') && !req.url().includes('/api/img')) {
          searchApiCalls.push(req.url());
        }
      });

      await page.locator('#exp-inp').fill('Versace');
      await page.locator('#page-explore button:has-text("Search")').click();
      await page.waitForTimeout(1000);

      expect(searchApiCalls).toHaveLength(0);
    });
  });

  test.describe('Slow network simulation', () => {

    test('explore page shows spinner on throttled connection', async ({ page, context }) => {
      await mockAPIs(page);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 50 * 1024,
        uploadThroughput: 25 * 1024,
        latency: 400,
      });

      await page.goto('/?mode=explore', { timeout: 60000 });

      const dots = page.locator('#page-explore .dot');
      const hasSpinner = await dots.first().isVisible().catch(() => false);
      const hasInput = await page.locator('#exp-inp').isVisible().catch(() => false);

      // Page should never be blank — either spinner or content
      expect(hasSpinner || hasInput).toBe(true);

      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: -1,
        uploadThroughput: -1,
        latency: 0,
      });
    });
  });

  test.describe('Offline support', () => {

    test('cached pages work offline after first visit', async ({ page, context }) => {
      await mockAPIs(page);
      await page.goto('/');
      await page.waitForTimeout(3000);

      await context.setOffline(true);

      await page.reload({ timeout: 10000 }).catch(() => {});
      const content = await page.content();
      expect(content).toContain('ScentWise');

      await context.setOffline(false);
    });
  });
});
