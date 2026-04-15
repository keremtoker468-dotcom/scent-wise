// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Mobile Loading Performance', () => {

  test.describe('Homepage initial load', () => {

    test('homepage renders without waiting for DB files', async ({ page }) => {
      // DB files should NOT block initial homepage render
      const dbRequests = [];
      page.on('request', req => {
        if (req.url().includes('perfumes.js') || req.url().includes('perfumes-rich.js')) {
          dbRequests.push(req.url());
        }
      });

      await page.goto('/');
      // Homepage should be visible immediately
      await expect(page.locator('#page-home')).toBeVisible();
      // DB files may start prefetching via idle callback, but homepage didn't block on them
    });

    test('app.js loads with defer attribute', async ({ page }) => {
      await page.goto('/');
      const scriptTag = page.locator('script[src*="app.js"]');
      await expect(scriptTag).toHaveAttribute('defer', '');
    });

    test('prefetch hints exist for DB files', async ({ page }) => {
      await page.goto('/');
      const prefetchPerfumes = page.locator('link[rel="prefetch"][href="/perfumes.js"]');
      const prefetchRich = page.locator('link[rel="prefetch"][href="/perfumes-rich.js"]');
      await expect(prefetchPerfumes).toBeAttached();
      await expect(prefetchRich).toBeAttached();
    });

    test('font loading uses non-blocking preload pattern', async ({ page }) => {
      await page.goto('/');
      // Font stylesheet should use preload with onload swap trick
      const fontLink = page.locator('link[rel="preload"][as="style"][href*="fonts.googleapis.com"]');
      await expect(fontLink).toBeAttached();
    });

    test('preconnect hints exist for external domains', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('link[rel="preconnect"][href="https://fonts.googleapis.com"]')).toBeAttached();
      await expect(page.locator('link[rel="preconnect"][href="https://fonts.gstatic.com"]')).toBeAttached();
    });
  });

  test.describe('Explore page loading', () => {

    test('shows animated spinner while DB loads', async ({ page }) => {
      // Block DB files to simulate slow network
      await page.route('**/perfumes.js', route => {
        // Hold the request indefinitely to keep loading state visible
        // (never resolve — we just want to see the spinner)
      });
      await page.route('**/perfumes-rich.js', route => {
        // Same — hold request
      });

      await page.goto('/?mode=explore');

      // Should show animated dots spinner, not just static text
      const spinner = page.locator('#page-explore .dot');
      await expect(spinner.first()).toBeVisible({ timeout: 5000 });

      // Should have at least 3 dot elements (the pulse animation dots)
      const dotCount = await page.locator('#page-explore .dot').count();
      expect(dotCount).toBeGreaterThanOrEqual(3);

      // Should also show "Loading fragrance database..." text
      await expect(page.locator('#page-explore')).toContainText('Loading fragrance database...');
    });

    test('loads and renders explore page after DB is ready', async ({ page }) => {
      await page.goto('/?mode=explore');

      // Wait for explore page to fully load with search input
      const searchInput = page.locator('#exp-inp');
      await expect(searchInput).toBeVisible({ timeout: 30000 });

      // Spinner should be gone
      const loadingText = page.getByText('Loading fragrance database...');
      await expect(loadingText).not.toBeVisible();

      // Search button should be visible
      await expect(page.locator('#page-explore button:has-text("Search")')).toBeVisible();
    });

    test('explore search works after DB load', async ({ page }) => {
      await page.goto('/?mode=explore');
      const searchInput = page.locator('#exp-inp');
      await expect(searchInput).toBeVisible({ timeout: 30000 });

      await searchInput.fill('Sauvage');
      await page.locator('#page-explore button:has-text("Search")').click();

      // Should show results
      await expect(page.locator('#page-explore .pc')).not.toHaveCount(0, { timeout: 5000 });
    });
  });

  test.describe('Celebrity page loading', () => {

    test('shows animated spinner while DB loads', async ({ page }) => {
      await page.route('**/perfumes.js', route => { /* hold */ });
      await page.route('**/perfumes-rich.js', route => { /* hold */ });

      await page.goto('/?mode=celeb');

      const spinner = page.locator('#page-celeb .dot');
      await expect(spinner.first()).toBeVisible({ timeout: 5000 });

      const dotCount = await page.locator('#page-celeb .dot').count();
      expect(dotCount).toBeGreaterThanOrEqual(3);

      await expect(page.locator('#page-celeb')).toContainText('Loading fragrance data...');
    });

    test('loads and renders celebrity page after DB is ready', async ({ page }) => {
      await page.goto('/?mode=celeb');

      // Wait for celebrity search to appear
      const searchInput = page.locator('#celeb-s');
      await expect(searchInput).toBeVisible({ timeout: 30000 });

      // Should show celebrity heading
      await expect(page.locator('#page-celeb')).toContainText('Celebrity');
    });
  });

  test.describe('Chat page loading', () => {

    test('chat page renders without blocking on DB', async ({ page }) => {
      await page.goto('/?mode=chat');

      // Chat page should show immediately (DB loads in background on send)
      const chatHeading = page.locator('#page-chat h2');
      await expect(chatHeading).toBeVisible({ timeout: 10000 });
      await expect(chatHeading).toContainText('AI');
    });

    test('chat shows suggestion cards on first visit', async ({ page }) => {
      await page.goto('/?mode=chat');
      await expect(page.locator('#page-chat h2')).toBeVisible({ timeout: 10000 });

      // Should show suggestion cards
      await expect(page.getByText('Best fragrances under $50')).toBeVisible();
      await expect(page.getByText('Dupe for Baccarat Rouge 540')).toBeVisible();
    });

    test('shows dot spinner while waiting for AI response', async ({ page }) => {
      // Mock the recommend API to delay response
      await page.route('**/api/recommend', async route => {
        // Hold for a bit so we can see the spinner
        await new Promise(r => setTimeout(r, 2000));
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ result: 'Test response', freeUsed: 1 }),
        });
      });
      // Mock check-tier to allow free trial
      await page.route('**/api/check-tier*', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ tier: 'free', freeUsed: 0 }),
        });
      });

      await page.goto('/?mode=chat');
      await expect(page.locator('#page-chat h2')).toBeVisible({ timeout: 10000 });

      // Type and send a message
      const input = page.locator('#c-inp');
      await input.fill('Best office fragrance');
      await page.locator('#page-chat button:has-text("Send")').click();

      // Should show loading dots while waiting for API
      const dots = page.locator('#page-chat .cb-a .dot');
      await expect(dots.first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Service Worker', () => {

    test('service worker registers successfully', async ({ page }) => {
      await page.goto('/');

      const swRegistered = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return false;
        const reg = await navigator.serviceWorker.getRegistration();
        return !!reg;
      });
      expect(swRegistered).toBe(true);
    });

    test('service worker caches app shell on install', async ({ page }) => {
      await page.goto('/');
      // Wait for SW to activate
      await page.waitForTimeout(2000);

      const cachedUrls = await page.evaluate(async () => {
        const cache = await caches.open('sw-v6');
        const keys = await cache.keys();
        return keys.map(r => new URL(r.url).pathname);
      });

      expect(cachedUrls).toContain('/');
      expect(cachedUrls).toContain('/app.js');
      expect(cachedUrls).toContain('/manifest.json');
    });
  });

  test.describe('Init parallelization', () => {

    test('checkTier and loadScentProfile fire concurrently', async ({ page }) => {
      const apiCallTimestamps = [];

      page.on('request', req => {
        const url = req.url();
        if (url.includes('/api/check-tier')) {
          apiCallTimestamps.push({
            url: url,
            time: Date.now(),
            hasProfile: url.includes('action=profile'),
          });
        }
      });

      await page.goto('/');
      // Wait for both calls to fire
      await page.waitForTimeout(3000);

      // Both calls should have fired
      const tierCall = apiCallTimestamps.find(c => !c.hasProfile);
      const profileCall = apiCallTimestamps.find(c => c.hasProfile);

      expect(tierCall).toBeDefined();
      expect(profileCall).toBeDefined();

      // They should fire within a short window of each other (parallel, not sequential)
      // Allow 500ms window — sequential would be >500ms apart due to network RTT
      if (tierCall && profileCall) {
        const gap = Math.abs(tierCall.time - profileCall.time);
        expect(gap).toBeLessThan(500);
      }
    });
  });

  test.describe('Idle prefetch', () => {

    test('DB files start loading during idle time', async ({ page }) => {
      const dbFileRequests = [];
      page.on('request', req => {
        const url = req.url();
        if (url.includes('perfumes.js') || url.includes('perfumes-rich.js')) {
          dbFileRequests.push(url);
        }
      });

      await page.goto('/');
      // Wait for idle callback to fire (timeout is 5000ms max)
      await page.waitForTimeout(6000);

      // Both DB files should have been requested via idle prefetch
      const hasPerfumes = dbFileRequests.some(u => u.includes('perfumes.js') && !u.includes('perfumes-rich'));
      const hasRich = dbFileRequests.some(u => u.includes('perfumes-rich.js'));
      expect(hasPerfumes).toBe(true);
      expect(hasRich).toBe(true);
    });
  });

  test.describe('Navigation transitions', () => {

    test('home to explore transition shows spinner then content', async ({ page }) => {
      // Slow down DB file delivery
      let resolveDb;
      const dbPromise = new Promise(r => { resolveDb = r; });

      await page.route('**/perfumes.js', async route => {
        await dbPromise;
        await route.continue();
      });
      await page.route('**/perfumes-rich.js', async route => {
        await dbPromise;
        await route.continue();
      });

      await page.goto('/');
      await expect(page.locator('#page-home')).toBeVisible();

      // Navigate to explore
      await page.evaluate(() => { window['go']('explore'); });

      // Should show spinner
      await expect(page.locator('#page-explore .dot').first()).toBeVisible({ timeout: 3000 });

      // Release DB files
      resolveDb();

      // Should eventually show search input
      await expect(page.locator('#exp-inp')).toBeVisible({ timeout: 30000 });
    });

    test('switching between pages preserves loaded DB', async ({ page }) => {
      // Load explore first (loads DB)
      await page.goto('/?mode=explore');
      await expect(page.locator('#exp-inp')).toBeVisible({ timeout: 30000 });

      // Switch to celeb — should NOT show spinner since DB is already loaded
      await page.evaluate(() => { window['go']('celeb'); });
      const spinner = page.locator('#page-celeb .dot');
      // Spinner should NOT appear (DB already loaded)
      await expect(page.locator('#celeb-s')).toBeVisible({ timeout: 3000 });
      await expect(spinner).not.toBeVisible();
    });
  });
});

test.describe('Mobile-specific loading', () => {

  test('mobile bottom nav is visible on non-home pages', async ({ page }) => {
    await page.goto('/?mode=explore');
    await expect(page.locator('#exp-inp')).toBeVisible({ timeout: 30000 });

    const mobNav = page.locator('.mob-nav');
    // On mobile viewport, mob-nav should be visible
    const isVisible = await mobNav.isVisible();
    // This depends on viewport — mobile project should see it
    if (page.viewportSize()?.width && page.viewportSize().width < 768) {
      expect(isVisible).toBe(true);
    }
  });

  test('mobile nav is hidden on homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#page-home')).toBeVisible();

    const mobNav = page.locator('.mob-nav');
    await expect(mobNav).not.toBeVisible();
  });

  test('images use lazy loading attribute', async ({ page }) => {
    await page.goto('/?mode=explore');
    await expect(page.locator('#exp-inp')).toBeVisible({ timeout: 30000 });

    // Search for something to trigger result images
    await page.locator('#exp-inp').fill('Chanel');
    await page.locator('#page-explore button:has-text("Search")').click();
    await page.waitForTimeout(1000);

    // Check that rendered images have loading="lazy"
    const images = page.locator('#page-explore img');
    const count = await images.count();
    if (count > 0) {
      const loadingAttr = await images.first().getAttribute('loading');
      expect(loadingAttr).toBe('lazy');
    }
  });
});
