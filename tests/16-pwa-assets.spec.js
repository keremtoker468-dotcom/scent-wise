// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoHome, mockCheckTier, mockImages } = require('./helpers');

test.describe('PWA & Static Assets', () => {
  test.beforeEach(async ({ page }) => {
    await mockCheckTier(page, 'free');
    await mockImages(page);
  });

  test.describe('PWA Manifest', () => {
    test('manifest.json is linked in HTML', async ({ page }) => {
      await gotoHome(page);
      const manifest = page.locator('link[rel="manifest"]');
      await expect(manifest).toBeAttached();
      const href = await manifest.getAttribute('href');
      expect(href).toContain('manifest.json');
    });

    test('manifest.json is accessible', async ({ page }) => {
      const response = await page.goto('/manifest.json');
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.name).toBeTruthy();
    });
  });

  test.describe('Service Worker', () => {
    test('sw.js is accessible', async ({ page }) => {
      const response = await page.goto('/sw.js');
      expect(response.status()).toBe(200);
      const text = await response.text();
      expect(text).toContain('self');
    });
  });

  test.describe('Static Files', () => {
    test('app.js loads successfully', async ({ page }) => {
      const response = await page.goto('/app.js');
      expect(response.status()).toBe(200);
    });

    test('perfumes.js loads successfully', async ({ page }) => {
      const response = await page.goto('/perfumes.js');
      expect(response.status()).toBe(200);
    });

    test('perfumes-rich.js loads successfully', async ({ page }) => {
      const response = await page.goto('/perfumes-rich.js');
      expect(response.status()).toBe(200);
    });

    test('robots.txt is accessible', async ({ page }) => {
      const response = await page.goto('/robots.txt');
      expect(response.status()).toBe(200);
    });

    test('sitemap.xml is accessible', async ({ page }) => {
      const response = await page.goto('/sitemap.xml');
      expect(response.status()).toBe(200);
    });

    test('ads.txt is accessible', async ({ page }) => {
      const response = await page.goto('/ads.txt');
      expect(response.status()).toBe(200);
    });

    test('llms.txt is accessible', async ({ page }) => {
      const response = await page.goto('/llms.txt');
      expect(response.status()).toBe(200);
    });

    test('privacy.html is accessible', async ({ page }) => {
      const response = await page.goto('/privacy.html');
      expect(response.status()).toBe(200);
    });

    test('terms.html is accessible', async ({ page }) => {
      const response = await page.goto('/terms.html');
      expect(response.status()).toBe(200);
    });

    test('refund.html is accessible', async ({ page }) => {
      const response = await page.goto('/refund.html');
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Meta Tags for PWA', () => {
    test('has apple-mobile-web-app-capable meta', async ({ page }) => {
      await gotoHome(page);
      await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    });

    test('has theme-color meta', async ({ page }) => {
      await gotoHome(page);
      const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
      expect(themeColor).toBeTruthy();
    });

    test('has apple-touch-icon', async ({ page }) => {
      await gotoHome(page);
      const icon = page.locator('link[rel="apple-touch-icon"]');
      await expect(icon).toBeAttached();
    });
  });

  test.describe('Page Load Performance', () => {
    test('index.html loads in under 5 seconds', async ({ page }) => {
      const start = Date.now();
      await gotoHome(page);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000);
    });

    test('no JavaScript console errors on load', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      await gotoHome(page);
      await page.waitForTimeout(2000);

      // Filter out expected errors (like network mocks, missing static resources)
      const realErrors = errors.filter(e =>
        !e.includes('ERR_FAILED') &&
        !e.includes('net::') &&
        !e.includes('favicon') &&
        !e.includes('google') &&
        !e.includes('plausible') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource')
      );
      expect(realErrors).toHaveLength(0);
    });

    test('database scripts are prefetched', async ({ page }) => {
      await gotoHome(page);
      const prefetchPerfumes = page.locator('link[rel="prefetch"][href*="perfumes.js"]');
      await expect(prefetchPerfumes).toBeAttached();

      const prefetchRich = page.locator('link[rel="prefetch"][href*="perfumes-rich.js"]');
      await expect(prefetchRich).toBeAttached();
    });

    test('app.js is preloaded', async ({ page }) => {
      await gotoHome(page);
      const preload = page.locator('link[rel="preload"][href*="app.js"]');
      await expect(preload).toBeAttached();
    });
  });

  test.describe('URL Routing', () => {
    test('?mode=explore navigates to explore', async ({ page }) => {
      await page.goto('/?mode=explore');
      await page.waitForSelector('#page-explore:not(.hidden)', { timeout: 10000 });
    });

    test('?mode=chat navigates to chat', async ({ page }) => {
      await page.goto('/?mode=chat');
      await page.waitForSelector('#page-chat:not(.hidden)', { timeout: 10000 });
    });

    test('?admin navigates to admin page', async ({ page }) => {
      await page.goto('/?admin');
      await page.waitForSelector('#page-admin:not(.hidden)', { timeout: 10000 });
    });

    test('root URL loads homepage', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#page-home:not(.hidden)', { timeout: 10000 });
    });
  });
});
