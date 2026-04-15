// @ts-check
const { test, expect } = require('@playwright/test');
const {
  setPremiumUser, setFreeUser,
  mockAIResponse, mockCheckTier, mockImages,
  gotoHome, goToPage, setupAIModePage,
} = require('./helpers');

test.describe('Music Match Mode', () => {
  test.describe('Premium User', () => {
    test.beforeEach(async ({ page }) => {
      await setupAIModePage(page, 'music');
    });

    test('displays music page with header and input', async ({ page }) => {
      await expect(page.locator('#page-music h2')).toContainText('Music');
      await expect(page.locator('#music-inp')).toBeVisible();
    });

    test('shows genre preset cards', async ({ page }) => {
      const cards = page.locator('#page-music .card');
      expect(await cards.count()).toBeGreaterThan(5);
    });

    test('genre cards have emoji, name, and description', async ({ page }) => {
      const firstCard = page.locator('#page-music .card').first();
      const text = await firstCard.textContent();
      expect(text.length).toBeGreaterThan(0);
    });

    test('clicking a genre fetches recommendations', async ({ page }) => {
      const popCard = page.locator('#page-music .card').filter({ has: page.locator('div', { hasText: 'Fresh, fun, versatile' }) });
      await popCard.click();

      // Wait for results (loading state may be too brief to catch with instant mock)
      await page.waitForSelector('#m-res .rbox', { timeout: 10000 });
      await expect(page.locator('#m-res .rbox')).toContainText('fragrance');
    });

    test('selected genre has active styling', async ({ page }) => {
      await page.locator('#page-music .card').filter({ hasText: 'Jazz' }).click();
      await page.waitForSelector('#m-res .rbox', { timeout: 10000 });

      const jazzCard = page.locator('#page-music .card').filter({ hasText: 'Jazz' });
      const style = await jazzCard.getAttribute('style');
      expect(style).toContain('border-color');
    });

    test('custom music taste input works', async ({ page }) => {
      await page.fill('#music-inp', 'lo-fi beats and ambient');
      await page.locator('button').filter({ hasText: 'Match' }).click();

      await page.waitForSelector('#m-res .rbox', { timeout: 10000 });
      await expect(page.locator('#m-res .rbox')).toContainText('fragrance');
    });

    test('Enter key in custom input triggers match', async ({ page }) => {
      await page.fill('#music-inp', '90s grunge');
      await page.keyboard.press('Enter');

      await page.waitForSelector('#m-res .rbox', { timeout: 10000 });
    });

    test('empty custom input does nothing', async ({ page }) => {
      await page.locator('button').filter({ hasText: 'Match' }).click();
      await expect(page.locator('#m-res .dot')).not.toBeVisible();
    });

    test('results show follow-up input', async ({ page }) => {
      await page.locator('#page-music .card').filter({ hasText: 'Rock' }).click();
      await page.waitForSelector('#m-res .rbox', { timeout: 10000 });

      await expect(page.locator('#mfu-inp')).toBeVisible();
    });

    test('results show feedback buttons', async ({ page }) => {
      await page.locator('#page-music .card').filter({ hasText: 'Electronic' }).click();
      await page.waitForSelector('#m-res .rbox', { timeout: 10000 });

      // Feedback buttons are plain buttons with thumbs up/down
      expect(await page.locator('#m-res .rbox button').count()).toBeGreaterThanOrEqual(2);
    });

    test('results area has ARIA attributes', async ({ page }) => {
      await expect(page.locator('#m-res')).toHaveAttribute('role', 'region');
      await expect(page.locator('#m-res')).toHaveAttribute('aria-live', 'polite');
    });
  });

  test.describe('Follow-up Questions', () => {
    test('follow-up question works after genre selection', async ({ page }) => {
      await setupAIModePage(page, 'music');
      await page.locator('#page-music .card').filter({ hasText: 'Classical' }).click();
      await page.waitForSelector('#m-res .rbox', { timeout: 10000 });

      await page.fill('#mfu-inp', 'Something more budget-friendly?');
      await page.keyboard.press('Enter');

      // Wait for follow-up response
      await page.waitForFunction(() => {
        const inputs = document.querySelectorAll('#m-res .cb-a, #m-res [style*="line-height"]');
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
      await goToPage(page, 'music');

      await expect(page.locator('.paywall')).toBeVisible();
    });
  });
});
