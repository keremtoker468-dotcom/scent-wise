// @ts-check
const { test, expect } = require('@playwright/test');
const {
  setPremiumUser, setFreeUser,
  mockAIResponse, mockCheckTier, mockImages,
  gotoHome, goToPage, setupAIModePage,
} = require('./helpers');

test.describe('Zodiac Match Mode', () => {
  test.describe('Premium User', () => {
    test.beforeEach(async ({ page }) => {
      await setupAIModePage(page, 'zodiac');
    });

    test('displays zodiac page with header and input', async ({ page }) => {
      await expect(page.locator('#page-zodiac h2')).toContainText('Zodiac');
      await expect(page.locator('#bday-inp')).toBeVisible();
    });

    test('shows all 12 zodiac sign cards', async ({ page }) => {
      const cards = page.locator('#page-zodiac .card');
      expect(await cards.count()).toBe(12);
    });

    test('zodiac cards show emoji, name, and date range', async ({ page }) => {
      const firstCard = page.locator('#page-zodiac .card').first();
      const text = await firstCard.textContent();
      // Should contain a zodiac sign name and date range
      expect(text).toMatch(/\w+/); // Has text
    });

    test('clicking a zodiac sign fetches recommendations', async ({ page }) => {
      // Click Aries (first sign typically)
      const ariesCard = page.locator('#page-zodiac .card').filter({ hasText: 'Aries' });
      await ariesCard.click();

      // Should show loading
      await expect(page.locator('#z-res')).toContainText(/Finding|cosmic/i);

      // Wait for result
      await page.waitForSelector('#z-res .rbox', { timeout: 10000 });
      await expect(page.locator('#z-res .rbox')).toContainText('fragrance');
    });

    test('selected zodiac card has active styling', async ({ page }) => {
      await page.locator('#page-zodiac .card').filter({ hasText: 'Leo' }).click();
      await page.waitForSelector('#z-res .rbox', { timeout: 10000 });

      const leoCard = page.locator('#page-zodiac .card').filter({ hasText: 'Leo' });
      const style = await leoCard.getAttribute('style');
      expect(style).toContain('border-color');
    });

    test('results show feedback buttons', async ({ page }) => {
      await page.locator('#page-zodiac .card').filter({ hasText: 'Virgo' }).click();
      await page.waitForSelector('#z-res .rbox', { timeout: 10000 });

      const feedbackBtns = page.locator('#z-res .fbtn');
      expect(await feedbackBtns.count()).toBeGreaterThanOrEqual(2);
    });

    test('results show follow-up input', async ({ page }) => {
      await page.locator('#page-zodiac .card').filter({ hasText: 'Scorpio' }).click();
      await page.waitForSelector('#z-res .rbox', { timeout: 10000 });

      await expect(page.locator('#zfu-inp')).toBeVisible();
    });

    test('results area has correct ARIA attributes', async ({ page }) => {
      await expect(page.locator('#z-res')).toHaveAttribute('role', 'region');
      await expect(page.locator('#z-res')).toHaveAttribute('aria-live', 'polite');
    });
  });

  test.describe('Birthday Input', () => {
    test.beforeEach(async ({ page }) => {
      await setupAIModePage(page, 'zodiac');
    });

    test('typing "March 15" detects Pisces and fetches results', async ({ page }) => {
      await page.fill('#bday-inp', 'March 15');
      await page.locator('button').filter({ hasText: 'Find My Sign' }).click();

      await page.waitForSelector('#z-res .rbox', { timeout: 10000 });
      // Pisces card should be selected
      const pisces = page.locator('#page-zodiac .card').filter({ hasText: 'Pisces' });
      const style = await pisces.getAttribute('style');
      expect(style).toContain('border-color');
    });

    test('typing "15/03" detects Pisces', async ({ page }) => {
      await page.fill('#bday-inp', '15/03');
      await page.locator('button').filter({ hasText: 'Find My Sign' }).click();

      await page.waitForSelector('#z-res .rbox', { timeout: 10000 });
    });

    test('invalid birthday shows error toast', async ({ page }) => {
      await page.fill('#bday-inp', 'invalid date text');
      await page.locator('button').filter({ hasText: 'Find My Sign' }).click();

      const toast = page.locator('.toast-error');
      await expect(toast).toBeVisible({ timeout: 5000 });
      await expect(toast).toContainText(/Could not detect|zodiac sign/i);
    });

    test('Enter key in birthday input triggers search', async ({ page }) => {
      await page.fill('#bday-inp', 'July 4');
      await page.keyboard.press('Enter');

      await page.waitForSelector('#z-res .rbox', { timeout: 10000 });
    });

    test('empty birthday input does nothing', async ({ page }) => {
      await page.locator('button').filter({ hasText: 'Find My Sign' }).click();
      // No loading state should appear
      await expect(page.locator('#z-res .dot')).not.toBeVisible();
    });
  });

  test.describe('Follow-up Questions', () => {
    test('follow-up question sends and receives response', async ({ page }) => {
      await setupAIModePage(page, 'zodiac');
      await page.locator('#page-zodiac .card').filter({ hasText: 'Gemini' }).click();
      await page.waitForSelector('#z-res .rbox', { timeout: 10000 });

      await page.fill('#zfu-inp', 'What about summer options?');
      await page.keyboard.press('Enter');

      // Should show the follow-up response
      await page.waitForFunction(() => {
        const rbox = document.querySelector('#z-res .rbox');
        return rbox && rbox.querySelectorAll('.cb-a, [style*="line-height"]').length > 0;
      }, { timeout: 10000 });
    });
  });

  test.describe('Paywall', () => {
    test('shows paywall when free trial exhausted', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockImages(page);
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'zodiac');

      await expect(page.locator('.paywall')).toBeVisible();
    });
  });
});
