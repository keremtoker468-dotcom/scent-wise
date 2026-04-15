// @ts-check
const { test, expect } = require('@playwright/test');
const {
  setPremiumUser, setFreeUser,
  mockAIResponse, mockCheckTier, mockImages,
  gotoHome, goToPage, setupAIModePage,
} = require('./helpers');

test.describe('Style Match Mode', () => {
  test.describe('Premium User', () => {
    test.beforeEach(async ({ page }) => {
      await setupAIModePage(page, 'style');
    });

    test('displays style page with header and input', async ({ page }) => {
      await expect(page.locator('#page-style h2')).toContainText('Style');
      await expect(page.locator('#page-style h2')).toContainText('Match');
      await expect(page.locator('#style-inp')).toBeVisible();
    });

    test('shows style preset cards', async ({ page }) => {
      const cards = page.locator('#page-style .card');
      expect(await cards.count()).toBeGreaterThan(5);
    });

    test('style cards have emoji, name, and description', async ({ page }) => {
      const firstCard = page.locator('#page-style .card').first();
      const text = await firstCard.textContent();
      expect(text.length).toBeGreaterThan(0);
    });

    test('clicking a style fetches recommendations', async ({ page }) => {
      const darkAcademia = page.locator('#page-style .card').filter({ hasText: 'Dark Academia' });
      if (await darkAcademia.count() > 0) {
        await darkAcademia.click();
      } else {
        await page.locator('#page-style .card').first().click();
      }

      // Loading state
      await expect(page.locator('#s-res').getByText(/Curating|wardrobe/i)).toBeVisible();

      await page.waitForSelector('#s-res .rbox', { timeout: 10000 });
      await expect(page.locator('#s-res .rbox')).toContainText('fragrance');
    });

    test('selected style has active styling', async ({ page }) => {
      await page.locator('#page-style .card').first().click();
      await page.waitForSelector('#s-res .rbox', { timeout: 10000 });

      const firstCard = page.locator('#page-style .card').first();
      const style = await firstCard.getAttribute('style');
      expect(style).toContain('border-color');
    });

    test('custom style input works', async ({ page }) => {
      await page.fill('#style-inp', 'streetwear with vintage touches');
      await page.locator('button').filter({ hasText: 'Match' }).click();

      await page.waitForSelector('#s-res .rbox', { timeout: 10000 });
      await expect(page.locator('#s-res .rbox')).toContainText('fragrance');
    });

    test('Enter key in custom input triggers match', async ({ page }) => {
      await page.fill('#style-inp', 'cottagecore');
      await page.keyboard.press('Enter');

      await page.waitForSelector('#s-res .rbox', { timeout: 10000 });
    });

    test('empty custom input does nothing', async ({ page }) => {
      await page.locator('button').filter({ hasText: 'Match' }).click();
      await expect(page.locator('#s-res .dot')).not.toBeVisible();
    });

    test('results show follow-up input', async ({ page }) => {
      await page.locator('#page-style .card').first().click();
      await page.waitForSelector('#s-res .rbox', { timeout: 10000 });

      await expect(page.locator('#sfu-inp')).toBeVisible();
    });

    test('results show feedback buttons', async ({ page }) => {
      await page.locator('#page-style .card').first().click();
      await page.waitForSelector('#s-res .rbox', { timeout: 10000 });

      expect(await page.locator('#s-res .fbtn').count()).toBeGreaterThanOrEqual(2);
    });

    test('results area has ARIA attributes', async ({ page }) => {
      await expect(page.locator('#s-res')).toHaveAttribute('role', 'region');
      await expect(page.locator('#s-res')).toHaveAttribute('aria-live', 'polite');
    });
  });

  test.describe('Follow-up Questions', () => {
    test('follow-up question works after style selection', async ({ page }) => {
      await setupAIModePage(page, 'style');
      await page.locator('#page-style .card').first().click();
      await page.waitForSelector('#s-res .rbox', { timeout: 10000 });

      await page.fill('#sfu-inp', 'Anything cheaper?');
      await page.keyboard.press('Enter');

      await page.waitForFunction(() => {
        const inputs = document.querySelectorAll('#s-res .cb-a, #s-res [style*="line-height"]');
        return inputs.length > 0;
      }, { timeout: 10000 });
    });
  });

  test.describe('Paywall', () => {
    test('shows paywall when free trial exhausted', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockImages(page);
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'style');

      await expect(page.locator('.paywall')).toBeVisible();
    });
  });
});
