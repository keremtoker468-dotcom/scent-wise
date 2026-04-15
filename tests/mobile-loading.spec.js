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

test.describe('Mobile Loading Performance', () => {

  test.describe('Homepage initial load', () => {

    test('homepage renders without waiting for DB files', async ({ page }) => {
      await mockAPIs(page);
      const dbRequests = [];
      page.on('request', req => {
        if (req.url().includes('perfumes.js') || req.url().includes('perfumes-rich.js')) {
          dbRequests.push(req.url());
        }
      });

      await page.goto('/');
      await expect(page.locator('#page-home')).toBeVisible();
    });

    test('app.js loads with defer attribute', async ({ page }) => {
      await mockAPIs(page);
      await page.goto('/');
      const scriptTag = page.locator('script[src*="app.js"]');
      await expect(scriptTag).toHaveAttribute('defer', '');
    });

    test('prefetch hints exist for DB files', async ({ page }) => {
      await mockAPIs(page);
      await page.goto('/');
      const prefetchPerfumes = page.locator('link[rel="prefetch"][href="/perfumes.js"]');
      const prefetchRich = page.locator('link[rel="prefetch"][href="/perfumes-rich.js"]');
      await expect(prefetchPerfumes).toBeAttached();
      await expect(prefetchRich).toBeAttached();
    });

    test('font loading uses non-blocking preload pattern', async ({ page }) => {
      await mockAPIs(page);
      // Read the raw HTML before JS modifies the DOM (preload onload changes rel to stylesheet)
      const html = await page.goto('/').then(r => r.text());
      expect(html).toContain('rel="preload"');
      expect(html).toContain('as="style"');
      expect(html).toContain('fonts.googleapis.com');
    });

    test('preconnect hints exist for external domains', async ({ page }) => {
      await mockAPIs(page);
      await page.goto('/');
      await expect(page.locator('link[rel="preconnect"][href="https://fonts.googleapis.com"]')).toBeAttached();
      await expect(page.locator('link[rel="preconnect"][href="https://fonts.gstatic.com"]')).toBeAttached();
    });
  });

  test.describe('Explore page loading', () => {

    test('shows loading state while DB loads', async ({ page }) => {
      await mockAPIs(page);
      // Block DB files but still fulfill them eventually to avoid page.goto timeout
      let resolvePerfumes, resolveRich;
      const perfumesP = new Promise(r => { resolvePerfumes = r; });
      const richP = new Promise(r => { resolveRich = r; });

      await page.route('**/perfumes.js', async route => {
        await perfumesP;
        await route.continue();
      });
      await page.route('**/perfumes-rich.js', async route => {
        await richP;
        await route.continue();
      });

      // Use waitUntil: 'domcontentloaded' so we don't wait for blocked scripts
      await page.goto('/?mode=explore', { waitUntil: 'domcontentloaded' });

      // Should show loading text
      await expect(page.locator('#page-explore')).toContainText('Loading fragrance database', { timeout: 10000 });

      // Release the DB files
      resolvePerfumes();
      resolveRich();

      // Eventually the search input should appear
      await expect(page.locator('#exp-inp')).toBeVisible({ timeout: 30000 });
    });

    test('loads and renders explore page after DB is ready', async ({ page }) => {
      await mockAPIs(page);
      await page.goto('/?mode=explore');

      const searchInput = page.locator('#exp-inp');
      await expect(searchInput).toBeVisible({ timeout: 30000 });

      const loadingText = page.getByText('Loading fragrance database...');
      await expect(loadingText).not.toBeVisible();
    });

    test('explore search works after DB load', async ({ page }) => {
      await mockAPIs(page);
      await page.goto('/?mode=explore');
      const searchInput = page.locator('#exp-inp');
      await expect(searchInput).toBeVisible({ timeout: 30000 });

      await searchInput.fill('Sauvage');
      await page.locator('#page-explore button:has-text("Search")').click();
      await page.waitForTimeout(500);

      // Perfume cards use .pcard class
      await expect(page.locator('#page-explore .pcard').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Celebrity page loading', () => {

    test('shows loading state while DB loads', async ({ page }) => {
      await mockAPIs(page);
      let resolvePerfumes, resolveRich;
      const perfumesP = new Promise(r => { resolvePerfumes = r; });
      const richP = new Promise(r => { resolveRich = r; });

      await page.route('**/perfumes.js', async route => {
        await perfumesP;
        await route.continue();
      });
      await page.route('**/perfumes-rich.js', async route => {
        await richP;
        await route.continue();
      });

      await page.goto('/?mode=celeb', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('#page-celeb')).toContainText('Loading fragrance data', { timeout: 10000 });

      resolvePerfumes();
      resolveRich();

      await expect(page.locator('#celeb-s')).toBeVisible({ timeout: 30000 });
    });

    test('loads and renders celebrity page after DB is ready', async ({ page }) => {
      await mockAPIs(page);
      await page.goto('/?mode=celeb');

      const searchInput = page.locator('#celeb-s');
      await expect(searchInput).toBeVisible({ timeout: 30000 });

      await expect(page.locator('#page-celeb')).toContainText('Celebrity');
    });
  });

  test.describe('Chat page loading', () => {

    test('chat page renders without blocking on DB', async ({ page }) => {
      await mockAPIs(page);
      await page.goto('/?mode=chat');

      const chatHeading = page.locator('#page-chat h2');
      await expect(chatHeading).toBeVisible({ timeout: 10000 });
      await expect(chatHeading).toContainText('AI');
    });

    test('chat shows suggestion cards on first visit', async ({ page }) => {
      await mockAPIs(page);
      await page.goto('/?mode=chat');
      await expect(page.locator('#page-chat h2')).toBeVisible({ timeout: 10000 });

      await expect(page.getByText('Best fragrances under $50')).toBeVisible();
      await expect(page.getByText('Dupe for Baccarat Rouge 540')).toBeVisible();
    });

    test('shows dot spinner while waiting for AI response', async ({ page }) => {
      // Mock check-tier to allow free trial
      await page.route('**/api/check-tier*', async route => {
        const url = route.request().url();
        if (url.includes('action=profile')) {
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ hasProfile: false }) });
        } else {
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tier: 'free', freeUsed: 0 }) });
        }
      });
      // Mock recommend with delay so spinner is visible
      await page.route('**/api/recommend', async route => {
        await new Promise(r => setTimeout(r, 2000));
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ result: 'Test response', freeUsed: 1 }),
        });
      });

      await page.goto('/?mode=chat');
      await expect(page.locator('#page-chat h2')).toBeVisible({ timeout: 10000 });

      const input = page.locator('#c-inp');
      await input.fill('Best office fragrance');
      await page.locator('#page-chat button:has-text("Send")').click();

      const dots = page.locator('#page-chat .cb-a .dot');
      await expect(dots.first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Init parallelization', () => {

    test('checkTier and loadScentProfile fire concurrently', async ({ page }) => {
      const apiCallTimestamps = [];

      await page.route('**/api/check-tier*', async route => {
        const url = route.request().url();
        apiCallTimestamps.push({
          url: url,
          time: Date.now(),
          hasProfile: url.includes('action=profile'),
        });
        if (url.includes('action=profile')) {
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ hasProfile: false }) });
        } else {
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tier: 'free', freeUsed: 0 }) });
        }
      });

      await page.goto('/');
      await page.waitForTimeout(3000);

      const tierCall = apiCallTimestamps.find(c => !c.hasProfile);
      const profileCall = apiCallTimestamps.find(c => c.hasProfile);

      expect(tierCall).toBeDefined();
      expect(profileCall).toBeDefined();

      if (tierCall && profileCall) {
        const gap = Math.abs(tierCall.time - profileCall.time);
        expect(gap).toBeLessThan(500);
      }
    });
  });

  test.describe('Idle prefetch', () => {

    test('DB files start loading during idle time', async ({ page }) => {
      await mockAPIs(page);
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

      const hasPerfumes = dbFileRequests.some(u => u.includes('perfumes.js') && !u.includes('perfumes-rich'));
      const hasRich = dbFileRequests.some(u => u.includes('perfumes-rich.js'));
      expect(hasPerfumes).toBe(true);
      expect(hasRich).toBe(true);
    });
  });

  test.describe('Navigation transitions', () => {

    test('home to explore transition shows loading then content', async ({ page }) => {
      await mockAPIs(page);
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

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#page-home')).toBeVisible();

      await page.evaluate(() => { window['go']('explore'); });

      // Should show loading text (DB not ready yet)
      await expect(page.locator('#page-explore')).toContainText('Loading fragrance database', { timeout: 5000 });

      resolveDb();

      await expect(page.locator('#exp-inp')).toBeVisible({ timeout: 30000 });
    });

    test('switching between pages preserves loaded DB', async ({ page }) => {
      await mockAPIs(page);
      await page.goto('/?mode=explore');
      await expect(page.locator('#exp-inp')).toBeVisible({ timeout: 30000 });

      await page.evaluate(() => { window['go']('celeb'); });
      const spinner = page.locator('#page-celeb .dot');
      await expect(page.locator('#celeb-s')).toBeVisible({ timeout: 3000 });
      await expect(spinner).not.toBeVisible();
    });
  });
});

test.describe('Mobile-specific loading', () => {

  test('mobile bottom nav is visible on non-home pages', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/?mode=explore');
    await expect(page.locator('#exp-inp')).toBeVisible({ timeout: 30000 });

    const mobNav = page.locator('.mob-nav');
    if (page.viewportSize()?.width && page.viewportSize().width < 768) {
      await expect(mobNav).toBeVisible();
    }
  });

  test('mobile nav is hidden on homepage', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
    await expect(page.locator('#page-home')).toBeVisible();

    const mobNav = page.locator('.mob-nav');
    await expect(mobNav).not.toBeVisible();
  });

  test('images use lazy loading attribute', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/?mode=explore');
    await expect(page.locator('#exp-inp')).toBeVisible({ timeout: 30000 });

    await page.locator('#exp-inp').fill('Chanel');
    await page.locator('#page-explore button:has-text("Search")').click();
    await page.waitForTimeout(1000);

    const images = page.locator('#page-explore img');
    const count = await images.count();
    if (count > 0) {
      const loadingAttr = await images.first().getAttribute('loading');
      expect(loadingAttr).toBe('lazy');
    }
  });
});
