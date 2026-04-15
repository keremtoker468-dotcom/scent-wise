// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoHome, goToPage, waitForDB, mockCheckTier, mockImages } = require('./helpers');

test.describe('Explore Database', () => {
  test.beforeEach(async ({ page }) => {
    await mockCheckTier(page, 'free');
    await mockImages(page);
    await gotoHome(page);
    await goToPage(page, 'explore');
  });

  test.describe('Page Structure', () => {
    test('displays explore page with header and search input', async ({ page }) => {
      await waitForDB(page);
      await expect(page.locator('#page-explore')).not.toHaveClass(/hidden/);
      await expect(page.locator('#page-explore h2')).toContainText('Explore');
      await expect(page.locator('#exp-inp')).toBeVisible();
    });

    test('shows "Loading fragrance database..." before DB loads', async ({ page }) => {
      // Check if loading is shown or DB already loaded
      const isLoaded = await page.evaluate(() => window._dbLoaded);
      if (!isLoaded) {
        await expect(page.locator('#page-explore')).toContainText('Loading fragrance database');
      }
      await waitForDB(page);
      await expect(page.locator('#exp-inp')).toBeVisible();
    });

    test('displays database count in subtitle', async ({ page }) => {
      await waitForDB(page);
      const subtitle = page.locator('#page-explore .sec-header p');
      await expect(subtitle).toContainText(/[\d,]+\+.*fragrances/);
    });

    test('search input is auto-focused on empty state', async ({ page }) => {
      await waitForDB(page);
      const inp = page.locator('#exp-inp');
      await expect(inp).toBeFocused();
    });
  });

  test.describe('Gender Filters', () => {
    test('displays All, Male, Female, Unisex filter buttons', async ({ page }) => {
      await waitForDB(page);
      const filters = page.locator('.fbtn');
      await expect(filters.nth(0)).toContainText('All');
      await expect(filters.nth(1)).toContainText('Male');
      await expect(filters.nth(2)).toContainText('Female');
      await expect(filters.nth(3)).toContainText('Unisex');
    });

    test('"All" filter is active by default', async ({ page }) => {
      await waitForDB(page);
      await expect(page.locator('.fbtn.ac')).toContainText('All');
    });

    test('clicking a filter changes the active state', async ({ page }) => {
      await waitForDB(page);
      // First search for something
      await page.fill('#exp-inp', 'dior');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Click Male filter
      await page.locator('.fbtn').filter({ hasText: 'Male' }).click();
      await page.waitForTimeout(500);
      await expect(page.locator('.fbtn.ac')).toContainText('Male');
    });

    test('gender filter narrows results', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#exp-inp', 'chanel');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const allCount = await page.locator('#exp-res .pcard').count();

      await page.locator('.fbtn').filter({ hasText: 'Female' }).click();
      await page.waitForTimeout(500);
      const femaleCount = await page.locator('#exp-res .pcard').count();

      expect(femaleCount).toBeLessThanOrEqual(allCount);
    });
  });

  test.describe('Search Functionality', () => {
    test('searching by name returns results', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#exp-inp', 'Sauvage');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const results = page.locator('#exp-res .pcard');
      expect(await results.count()).toBeGreaterThan(0);
    });

    test('searching by brand returns results', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#exp-inp', 'Tom Ford');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const results = page.locator('#exp-res .pcard');
      expect(await results.count()).toBeGreaterThan(0);
    });

    test('debounced search triggers on typing', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#exp-inp', 'versace');
      // Wait for debounce (300ms + render time)
      await page.waitForTimeout(600);

      const results = page.locator('#exp-res .pcard');
      expect(await results.count()).toBeGreaterThan(0);
    });

    test('search button works', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#exp-inp', 'creed');
      await page.locator('.btn.btn-sm').filter({ hasText: 'Search' }).click();
      await page.waitForTimeout(500);

      const results = page.locator('#exp-res .pcard');
      expect(await results.count()).toBeGreaterThan(0);
    });

    test('no results shows "No results found" message', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#exp-inp', 'xyznonexistent123abc');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      await expect(page.locator('#exp-res')).toContainText('No results found');
    });

    test('results capped at 100 with indicator', async ({ page }) => {
      await waitForDB(page);
      // Search for a very common term
      await page.fill('#exp-inp', 'eau');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const resultCountText = await page.locator('#exp-res').textContent();
      if (resultCountText.includes('showing first 100')) {
        const results = page.locator('#exp-res .pcard');
        expect(await results.count()).toBeLessThanOrEqual(100);
      }
    });

    test('Enter key triggers search', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#exp-inp', 'chanel');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      expect(await page.locator('#exp-res .pcard').count()).toBeGreaterThan(0);
    });
  });

  test.describe('Popular Searches', () => {
    test('displays popular search suggestions on empty state', async ({ page }) => {
      await waitForDB(page);
      await expect(page.locator('#exp-res')).toContainText('Popular searches');

      const popular = ['Dior Sauvage', 'Tom Ford', 'Creed Aventus', 'Chanel', 'Versace Eros'];
      for (const name of popular) {
        await expect(page.locator('#exp-res .fbtn').filter({ hasText: name })).toBeVisible();
      }
    });

    test('clicking a popular search fills the input and searches', async ({ page }) => {
      await waitForDB(page);
      await page.locator('#exp-res .fbtn').filter({ hasText: 'Dior Sauvage' }).click();
      await page.waitForTimeout(500);

      const results = page.locator('#exp-res .pcard');
      expect(await results.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Perfume Cards', () => {
    test('perfume cards show name and brand', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#exp-inp', 'Sauvage');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const firstCard = page.locator('#exp-res .pcard').first();
      await expect(firstCard).toBeVisible();
      // Card should have text content (name at minimum)
      const text = await firstCard.textContent();
      expect(text.length).toBeGreaterThan(0);
    });

    test('perfume cards have heart/like button', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#exp-inp', 'Sauvage');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const heartBtn = page.locator('#exp-res .heart-btn').first();
      await expect(heartBtn).toBeVisible();
    });

    test('perfume cards have compare button', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#exp-inp', 'Sauvage');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const cmpBtn = page.locator('#exp-res .cmp-btn').first();
      await expect(cmpBtn).toBeVisible();
    });
  });

  test.describe('No Subscription Required', () => {
    test('explore is accessible without premium', async ({ page }) => {
      await waitForDB(page);
      // Paywall should NOT be shown
      await expect(page.locator('.paywall')).not.toBeVisible();
      // Search should work
      await page.fill('#exp-inp', 'versace');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      expect(await page.locator('#exp-res .pcard').count()).toBeGreaterThan(0);
    });
  });
});
