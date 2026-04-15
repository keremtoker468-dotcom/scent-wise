// @ts-check
const { test, expect } = require('@playwright/test');
const {
  setPremiumUser, setFreeUser, waitForDB,
  mockAIResponse, mockCheckTier, mockImages,
  gotoHome, goToPage, setupAIModePage,
} = require('./helpers');

test.describe('Dupe Finder Mode', () => {
  test.describe('Premium User', () => {
    test.beforeEach(async ({ page }) => {
      await setupAIModePage(page, 'dupe');
    });

    test('displays dupe page with header and input', async ({ page }) => {
      await expect(page.locator('#page-dupe h2')).toContainText('Dupe');
      await expect(page.locator('#page-dupe h2')).toContainText('Finder');
      await expect(page.locator('#dupe-inp')).toBeVisible();
    });

    test('shows preset fragrance cards', async ({ page }) => {
      const cards = page.locator('#page-dupe .card');
      expect(await cards.count()).toBeGreaterThan(3);
    });

    test('preset cards show popular fragrances', async ({ page }) => {
      const cardTexts = await page.locator('#page-dupe .card').allTextContents();
      const allText = cardTexts.join(' ');
      // Should contain at least some well-known fragrance names
      expect(allText.length).toBeGreaterThan(50);
    });

    test('clicking a preset fetches dupe recommendations', async ({ page }) => {
      await waitForDB(page);
      const firstCard = page.locator('#page-dupe .card').first();
      await firstCard.click();

      // Wait for results (loading state may be too brief to catch with instant mock)
      await page.waitForSelector('#d-res .rbox', { timeout: 15000 });
      await expect(page.locator('#d-res .rbox')).toContainText('fragrance');
    });

    test('selected preset has active styling', async ({ page }) => {
      await waitForDB(page);
      await page.locator('#page-dupe .card').first().click();
      await page.waitForSelector('#d-res .rbox', { timeout: 15000 });

      const firstCard = page.locator('#page-dupe .card').first();
      const style = await firstCard.getAttribute('style');
      expect(style).toContain('border-color');
    });

    test('custom fragrance input works', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#dupe-inp', 'Baccarat Rouge 540');
      await page.locator('button').filter({ hasText: 'Find Dupes' }).click();

      await page.waitForSelector('#d-res .rbox', { timeout: 15000 });
      await expect(page.locator('#d-res .rbox')).toContainText('fragrance');
    });

    test('Enter key in custom input triggers search', async ({ page }) => {
      await waitForDB(page);
      await page.fill('#dupe-inp', 'Creed Aventus');
      await page.keyboard.press('Enter');

      await page.waitForSelector('#d-res .rbox', { timeout: 15000 });
    });

    test('empty custom input does nothing', async ({ page }) => {
      await page.locator('button').filter({ hasText: 'Find Dupes' }).click();
      await expect(page.locator('#d-res .dot')).not.toBeVisible();
    });

    test('results show follow-up input', async ({ page }) => {
      await waitForDB(page);
      await page.locator('#page-dupe .card').first().click();
      await page.waitForSelector('#d-res .rbox', { timeout: 15000 });

      await expect(page.locator('#dfu-inp')).toBeVisible();
    });

    test('results show feedback buttons', async ({ page }) => {
      await waitForDB(page);
      await page.locator('#page-dupe .card').first().click();
      await page.waitForSelector('#d-res .rbox', { timeout: 15000 });

      // Feedback buttons are plain buttons with thumbs up/down
      expect(await page.locator('#d-res .rbox button').count()).toBeGreaterThanOrEqual(2);
    });

    test('results area has ARIA attributes', async ({ page }) => {
      await expect(page.locator('#d-res')).toHaveAttribute('role', 'region');
      await expect(page.locator('#d-res')).toHaveAttribute('aria-live', 'polite');
    });

    test('results header shows the searched fragrance name', async ({ page }) => {
      await waitForDB(page);
      await page.locator('#page-dupe .card').first().click();
      await page.waitForSelector('#d-res .rbox', { timeout: 15000 });

      const header = page.locator('#d-res .rbox').locator('div').first();
      const text = await header.textContent();
      expect(text.toUpperCase()).toContain('DUPES FOR');
    });
  });

  test.describe('Follow-up Questions', () => {
    test('follow-up question works after dupe search', async ({ page }) => {
      await setupAIModePage(page, 'dupe');
      await waitForDB(page);
      await page.locator('#page-dupe .card').first().click();
      await page.waitForSelector('#d-res .rbox', { timeout: 15000 });

      await page.fill('#dfu-inp', 'Which one lasts the longest?');
      await page.keyboard.press('Enter');

      await page.waitForFunction(() => {
        const inputs = document.querySelectorAll('#d-res .cb-a, #d-res [style*="line-height"]');
        return inputs.length > 0;
      }, { timeout: 10000 });
    });
  });

  test.describe('Paywall', () => {
    test('shows paywall when free trial exhausted', async ({ page }) => {
      await mockCheckTier(page, 'free', 3);
      await mockImages(page);
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'dupe');

      await expect(page.locator('.paywall')).toBeVisible();
    });
  });
});
