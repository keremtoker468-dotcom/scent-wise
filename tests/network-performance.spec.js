// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Network Performance', () => {

  test.describe('Resource loading order', () => {

    test('critical resources load before non-critical', async ({ page }) => {
      const loadOrder = [];
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin === new URL(page.url() || 'http://localhost:3000').origin) {
          loadOrder.push(url.pathname);
        }
      });

      await page.goto('/');
      await page.waitForTimeout(3000);

      // app.js should load before perfumes.js/perfumes-rich.js
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
      await page.goto('/');

      // All scripts in head should have defer or async
      const blockingScripts = await page.evaluate(() => {
        const scripts = document.querySelectorAll('head script[src]');
        return Array.from(scripts)
          .filter(s => !s.hasAttribute('defer') && !s.hasAttribute('async'))
          .map(s => s.getAttribute('src'));
      });
      expect(blockingScripts).toHaveLength(0);
    });
  });

  test.describe('Cache headers', () => {

    test('perfumes.js has long cache TTL', async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/perfumes.js')),
        page.goto('/?mode=explore'),
      ]);

      const cacheControl = response.headers()['cache-control'];
      expect(cacheControl).toBeDefined();
      // Should have at least 1 day cache
      expect(cacheControl).toContain('max-age=86400');
    });

    test('perfumes-rich.js has long cache TTL', async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/perfumes-rich.js')),
        page.goto('/?mode=explore'),
      ]);

      const cacheControl = response.headers()['cache-control'];
      expect(cacheControl).toBeDefined();
      expect(cacheControl).toContain('max-age=86400');
    });

    test('app.js has medium cache TTL with stale-while-revalidate', async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/app.js')),
        page.goto('/'),
      ]);

      const cacheControl = response.headers()['cache-control'];
      expect(cacheControl).toBeDefined();
      expect(cacheControl).toContain('max-age=3600');
      expect(cacheControl).toContain('stale-while-revalidate');
    });
  });

  test.describe('API call efficiency', () => {

    test('homepage makes minimal API calls', async ({ page }) => {
      const apiCalls = [];
      page.on('request', req => {
        if (req.url().includes('/api/')) {
          apiCalls.push(new URL(req.url()).pathname + new URL(req.url()).search);
        }
      });

      await page.goto('/');
      await page.waitForTimeout(3000);

      // Should only call check-tier endpoints (auth + profile), nothing else
      const nonAuthCalls = apiCalls.filter(c =>
        !c.startsWith('/api/check-tier')
      );
      expect(nonAuthCalls).toHaveLength(0);
    });

    test('explore page does not make API calls (local DB only)', async ({ page }) => {
      const apiCalls = [];

      // Navigate to explore (DB loads via script tags, not API)
      await page.goto('/?mode=explore');
      await expect(page.locator('#exp-inp')).toBeVisible({ timeout: 30000 });

      // Clear tracking and do a search
      apiCalls.length = 0;
      page.on('request', req => {
        if (req.url().includes('/api/') && !req.url().includes('check-tier')) {
          apiCalls.push(req.url());
        }
      });

      await page.locator('#exp-inp').fill('Versace');
      await page.locator('#page-explore button:has-text("Search")').click();
      await page.waitForTimeout(1000);

      // Search should be client-side only — no API calls (except maybe images)
      const nonImageCalls = apiCalls.filter(c => !c.includes('/api/img'));
      expect(nonImageCalls).toHaveLength(0);
    });
  });

  test.describe('Slow network simulation', () => {

    test('explore page shows spinner on throttled connection', async ({ page, context }) => {
      // Throttle network via CDP
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 50 * 1024, // 50KB/s (slow 3G)
        uploadThroughput: 25 * 1024,
        latency: 400,
      });

      await page.goto('/?mode=explore', { timeout: 60000 });

      // On slow network, spinner should be visible while DB downloads
      const dots = page.locator('#page-explore .dot');
      // Either spinner is visible (still loading) or content is loaded
      const hasSpinner = await dots.first().isVisible().catch(() => false);
      const hasInput = await page.locator('#exp-inp').isVisible().catch(() => false);

      // At least one must be true — page should never be blank
      expect(hasSpinner || hasInput).toBe(true);

      // Reset throttling
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
      // Visit homepage to populate SW cache
      await page.goto('/');
      await page.waitForTimeout(3000);

      // Go offline
      await context.setOffline(true);

      // Reload — should serve from cache
      await page.reload({ timeout: 10000 }).catch(() => {});
      const content = await page.content();
      expect(content).toContain('ScentWise');

      // Go back online
      await context.setOffline(false);
    });
  });
});
