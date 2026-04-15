// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoHome, goToPage, waitForDB, mockCheckTier, mockImages } = require('./helpers');

test.describe('Celebrity Collections', () => {
  test.beforeEach(async ({ page }) => {
    await mockCheckTier(page, 'free');
    await mockImages(page);
    await gotoHome(page);
    await goToPage(page, 'celeb');
  });

  test.describe('Page Structure', () => {
    test('displays celebrity page with header', async ({ page }) => {
      await waitForDB(page);
      await expect(page.locator('#page-celeb h2')).toContainText('Celebrity');
      await expect(page.locator('#page-celeb')).toContainText('Fragrances');
    });

    test('shows loading state before DB is ready', async ({ page }) => {
      const isLoaded = await page.evaluate(() => window._dbLoaded);
      if (!isLoaded) {
        await expect(page.locator('#page-celeb')).toContainText('Loading fragrance data');
      }
      await waitForDB(page);
      await expect(page.locator('#celeb-s')).toBeVisible();
    });

    test('displays celebrity count in subtitle', async ({ page }) => {
      await waitForDB(page);
      const subtitle = page.locator('#page-celeb .sec-header p');
      const text = await subtitle.textContent();
      expect(text).toMatch(/\d+ celebrities/);
    });
  });

  test.describe('Search', () => {
    test('search input is visible', async ({ page }) => {
      await waitForDB(page);
      await expect(page.locator('#celeb-s')).toBeVisible();
      await expect(page.locator('#celeb-s')).toHaveAttribute('placeholder', /Search celebrities/);
    });

    test('searching filters celebrities by name', async ({ page }) => {
      await waitForDB(page);
      const allCards = await page.locator('#page-celeb .pcard').count();

      await page.fill('#celeb-s', 'Timothée');
      await page.waitForTimeout(300);

      const filteredCards = await page.locator('#page-celeb .pcard').count();
      expect(filteredCards).toBeLessThan(allCards);
      expect(filteredCards).toBeGreaterThan(0);
    });

    test('search with no match shows "No match" message', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#celeb-s', 'xyznonexistentceleb123');
      await page.waitForTimeout(300);

      await expect(page.locator('#page-celeb')).toContainText('No match');
    });

    test('clearing search shows all celebrities again', async ({ page }) => {
      await waitForDB(page);
      const allCards = await page.locator('#page-celeb .pcard').count();

      await page.fill('#celeb-s', 'Rihanna');
      await page.waitForTimeout(300);

      await page.fill('#celeb-s', '');
      await page.waitForTimeout(300);

      const restoredCards = await page.locator('#page-celeb .pcard').count();
      expect(restoredCards).toBe(allCards);
    });
  });

  test.describe('Celebrity Cards', () => {
    test('each card shows celebrity name and emoji', async ({ page }) => {
      await waitForDB(page);
      const firstCard = page.locator('#page-celeb .pcard').first();
      await expect(firstCard).toBeVisible();
      const name = firstCard.locator('h3');
      await expect(name).toBeVisible();
      const text = await name.textContent();
      expect(text.length).toBeGreaterThan(0);
    });

    test('celebrity cards show fragrance names', async ({ page }) => {
      await waitForDB(page);
      const firstCard = page.locator('#page-celeb .pcard').first();
      const fragrances = firstCard.locator('strong');
      expect(await fragrances.count()).toBeGreaterThan(0);
    });

    test('celebrity cards have "Shop on Amazon" links', async ({ page }) => {
      await waitForDB(page);
      const amazonLinks = page.locator('#page-celeb a').filter({ hasText: 'Shop on Amazon' });
      expect(await amazonLinks.count()).toBeGreaterThan(0);

      const firstLink = amazonLinks.first();
      const href = await firstLink.getAttribute('href');
      expect(href).toContain('amazon');
    });

    test('Amazon links open in new tab', async ({ page }) => {
      await waitForDB(page);
      const amazonLink = page.locator('#page-celeb a').filter({ hasText: 'Shop on Amazon' }).first();
      await expect(amazonLink).toHaveAttribute('target', '_blank');
      await expect(amazonLink).toHaveAttribute('rel', /noopener/);
    });

    test('fragrance details show accords when available', async ({ page }) => {
      await waitForDB(page);
      // Look for accords text in cards
      const accordsText = page.locator('#page-celeb .note').filter({ hasText: 'Accords:' });
      // At least some celebrities should have fragrance details
      expect(await accordsText.count()).toBeGreaterThan(0);
    });

    test('fragrance details show rating when available', async ({ page }) => {
      await waitForDB(page);
      const ratings = page.locator('#page-celeb').getByText('★', { exact: false });
      expect(await ratings.count()).toBeGreaterThan(0);
    });
  });

  test.describe('No Subscription Required', () => {
    test('celebrity page is accessible without premium', async ({ page }) => {
      await waitForDB(page);
      // Should NOT show paywall
      await expect(page.locator('.paywall')).not.toBeVisible();
      // Should show celebrities
      expect(await page.locator('#page-celeb .pcard').count()).toBeGreaterThan(0);
    });
  });

  test.describe('Grid Layout', () => {
    test('celebrities are displayed in a responsive grid', async ({ page }) => {
      await waitForDB(page);
      const grid = page.locator('#page-celeb .grid');
      await expect(grid).toBeVisible();
      const gridStyle = await grid.getAttribute('style');
      expect(gridStyle).toContain('grid-template-columns');
    });
  });
});
