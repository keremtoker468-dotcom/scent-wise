// @ts-check
const { test, expect } = require('@playwright/test');
const {
  gotoHome, goToPage, waitForDB,
  mockCheckTier, mockImages, expectToast,
} = require('./helpers');

test.describe('Compare Feature', () => {
  test.beforeEach(async ({ page }) => {
    await mockCheckTier(page, 'free');
    await mockImages(page);
    await gotoHome(page);
    // Dismiss cookie banner so it doesn't intercept clicks on compare bar
    const banner = page.locator('#cookie-banner');
    if (await banner.isVisible().catch(() => false)) {
      await banner.getByRole('button', { name: /Accept All/i }).click();
      await page.waitForTimeout(300);
    }
    await goToPage(page, 'explore');
    await waitForDB(page);
  });

  test.describe('Adding to Compare', () => {
    test('clicking compare button adds fragrance to compare bar', async ({ page }) => {
      await page.fill('#exp-inp', 'Sauvage');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const cmpBtn = page.locator('#exp-res .cmp-btn').first();
      await cmpBtn.click();

      // Compare bar should appear
      await expect(page.locator('#compare-bar')).toBeVisible();
      await expectToast(page, 'added to compare', 'success');
    });

    test('can add up to 3 fragrances', async ({ page }) => {
      await page.fill('#exp-inp', 'Dior');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const cmpBtns = page.locator('#exp-res .cmp-btn');
      await cmpBtns.nth(0).click();
      await page.waitForTimeout(300);
      await cmpBtns.nth(1).click();
      await page.waitForTimeout(300);
      await cmpBtns.nth(2).click();
      await page.waitForTimeout(300);

      // Compare bar should show 3 items
      const items = page.locator('#compare-bar').locator('span[style*="font-weight:600"]');
      expect(await items.count()).toBe(3);
    });

    test('adding more than 3 shows max limit toast', async ({ page }) => {
      await page.fill('#exp-inp', 'Versace');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const cmpBtns = page.locator('#exp-res .cmp-btn');
      for (let i = 0; i < 4; i++) {
        if (i < await cmpBtns.count()) {
          await cmpBtns.nth(i).click();
          await page.waitForTimeout(300);
        }
      }

      await expectToast(page, 'Max 3', 'info');
    });

    test('adding duplicate fragrance shows info toast', async ({ page }) => {
      await page.fill('#exp-inp', 'Sauvage');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const cmpBtn = page.locator('#exp-res .cmp-btn').first();
      await cmpBtn.click();
      await page.waitForTimeout(500);
      await cmpBtn.click();

      await expectToast(page, 'Already in compare', 'info');
    });
  });

  test.describe('Compare Bar', () => {
    test('compare bar shows fragrance names', async ({ page }) => {
      await page.fill('#exp-inp', 'Chanel');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      await page.locator('#exp-res .cmp-btn').first().click();
      await page.waitForTimeout(300);

      const bar = page.locator('#compare-bar');
      await expect(bar).toBeVisible();
      const nameEl = bar.locator('span[style*="font-weight:600"]').first();
      const text = await nameEl.textContent();
      expect(text.length).toBeGreaterThan(0);
    });

    test('remove button removes fragrance from compare bar', async ({ page }) => {
      await page.fill('#exp-inp', 'Tom Ford');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      await page.locator('#exp-res .cmp-btn').first().click();
      await page.waitForTimeout(300);

      // Click the remove (x) button in compare bar
      await page.locator('#compare-bar button').filter({ hasText: '×' }).first().click();
      await page.waitForTimeout(300);

      // Bar should be gone (0 items)
      await expect(page.locator('#compare-bar')).not.toBeVisible();
    });

    test('clear all button removes all items', async ({ page }) => {
      await page.fill('#exp-inp', 'Creed');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      await page.locator('#exp-res .cmp-btn').nth(0).click();
      await page.waitForTimeout(300);
      await page.locator('#exp-res .cmp-btn').nth(1).click();
      await page.waitForTimeout(300);

      // Click the clear all button (last × in the bar)
      await page.locator('#compare-bar button[title="Clear all"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('#compare-bar')).not.toBeVisible();
    });

    test('compare button is disabled with < 2 items', async ({ page }) => {
      await page.fill('#exp-inp', 'Sauvage');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      await page.locator('#exp-res .cmp-btn').first().click();
      await page.waitForTimeout(300);

      const compareBtn = page.locator('#compare-bar .btn');
      await expect(compareBtn).toBeDisabled();
    });

    test('compare button is enabled with 2+ items', async ({ page }) => {
      await page.fill('#exp-inp', 'Dior');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      await page.locator('#exp-res .cmp-btn').nth(0).click();
      await page.waitForTimeout(300);
      await page.locator('#exp-res .cmp-btn').nth(1).click();
      await page.waitForTimeout(300);

      const compareBtn = page.locator('#compare-bar .btn');
      await expect(compareBtn).not.toBeDisabled();
    });

    test('compare button shows count', async ({ page }) => {
      await page.fill('#exp-inp', 'Dior');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      await page.locator('#exp-res .cmp-btn').nth(0).click();
      await page.waitForTimeout(300);

      const compareBtn = page.locator('#compare-bar .btn');
      await expect(compareBtn).toContainText('Compare 1/3');

      await page.locator('#exp-res .cmp-btn').nth(1).click();
      await page.waitForTimeout(300);
      await expect(compareBtn).toContainText('Compare 2/3');
    });
  });

  test.describe('Comparison View', () => {
    test('clicking compare opens comparison overlay', async ({ page }) => {
      await page.fill('#exp-inp', 'Chanel');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      await page.locator('#exp-res .cmp-btn').nth(0).click();
      await page.waitForTimeout(300);
      await page.locator('#exp-res .cmp-btn').nth(1).click();
      await page.waitForTimeout(300);

      await page.locator('#compare-bar .btn').click();

      // Comparison overlay/modal should appear
      await page.waitForFunction(() => {
        const overlays = document.querySelectorAll('body > div[style]');
        for (const el of overlays) {
          if (el.style.position === 'fixed' && el.textContent.includes('Fragrance Comparison')) return true;
        }
        return false;
      }, { timeout: 5000 });
    });
  });
});
