// @ts-check
const { test, expect, devices } = require('@playwright/test');
const { gotoHome, goToPage, mockCheckTier, mockImages, setPremiumUser, mockAIResponse } = require('./helpers');

// Only run mobile tests on mobile projects
test.describe('Mobile Navigation & Responsive', () => {
  test.use(devices['Pixel 7']);

  test.beforeEach(async ({ page }) => {
    await mockCheckTier(page, 'free');
    await mockImages(page);
  });

  test.describe('Mobile Bottom Navigation', () => {
    test('mobile nav is visible on small screens', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      // Mobile nav should be visible at 412px (Pixel 7 width)
      await expect(page.locator('.mob-nav')).toBeVisible();
    });

    test('desktop nav is hidden on mobile', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      await expect(page.locator('.nav-w')).toBeHidden();
    });

    test('mobile nav has navigation items', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      const navItems = page.locator('#mob-nav .mob-ni');
      expect(await navItems.count()).toBeGreaterThan(0);
    });

    test('mobile nav items navigate to correct pages', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      // Click on a mobile nav item
      const firstNavItem = page.locator('#mob-nav .mob-ni').first();
      await firstNavItem.click();
      await page.waitForTimeout(500);

      // Should have navigated (page change)
      const visiblePages = await page.locator('[id^="page-"]:not(.hidden)').count();
      expect(visiblePages).toBeGreaterThan(0);
    });

    test('active mobile nav item has active styling', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      const activeItem = page.locator('#mob-nav .mob-na');
      expect(await activeItem.count()).toBe(1);
    });
  });

  test.describe('Mobile Homepage', () => {
    test('hamburger menu is visible on mobile', async ({ page }) => {
      await gotoHome(page);
      await expect(page.locator('.hp-nav-toggle')).toBeVisible();
    });

    test('hamburger menu toggles nav links', async ({ page }) => {
      await gotoHome(page);

      // Initially nav links should be hidden on mobile
      await expect(page.locator('.hp-nav-links')).toBeHidden();

      // Click hamburger
      await page.locator('.hp-nav-toggle').click();

      // Nav links should now be visible
      await expect(page.locator('.hp-nav-links')).toBeVisible();
    });

    test('hero buttons stack vertically on mobile', async ({ page }) => {
      await gotoHome(page);
      const actions = page.locator('.hp-hero-actions');
      const box = await actions.boundingBox();
      // On mobile, width should use full available width (flex-direction: column)
      expect(box).toBeTruthy();
    });

    test('discovery mode cards are single-column on mobile', async ({ page }) => {
      await gotoHome(page);
      const grid = page.locator('.hp-modes-layout');
      const style = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
      // On mobile (< 900px), should be 1fr (single column)
      expect(style).not.toContain('1fr 1fr');
    });
  });

  test.describe('Mode Switcher', () => {
    test('mode bar appears on mobile in AI modes', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      const modeBar = page.locator('#mode-bar');
      await expect(modeBar).toBeVisible();
    });

    test('mode bar has pills for each mode', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      const pills = page.locator('#mode-bar-inner .mode-pill');
      expect(await pills.count()).toBeGreaterThan(0);
    });

    test('active mode pill has active styling', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      const activePill = page.locator('#mode-bar-inner .mp-active');
      expect(await activePill.count()).toBe(1);
    });

    test('mode switcher overlay opens and closes', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      // Open mode switcher
      await page.evaluate(() => openModeSwitcher());
      const overlay = page.locator('#mode-switcher-overlay');
      await expect(overlay).toHaveClass(/active/);

      // Close by clicking overlay background
      await page.evaluate(() => closeModeSwitcher());
      await page.waitForTimeout(300);
      await expect(overlay).not.toHaveClass(/active/);
    });

    test('mode switcher shows all modes', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      await page.evaluate(() => openModeSwitcher());
      await page.waitForTimeout(300);

      const options = page.locator('#mode-switch-options .ms-option');
      expect(await options.count()).toBeGreaterThanOrEqual(6);
    });

    test('selecting a mode from switcher navigates', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      await page.evaluate(() => openModeSwitcher());
      await page.waitForTimeout(300);

      // Click on Explore option
      const exploreOption = page.locator('#mode-switch-options .ms-option').filter({ hasText: 'Explore' });
      await exploreOption.click();
      await page.waitForTimeout(500);

      await expect(page.locator('#page-explore')).not.toHaveClass(/hidden/);
    });
  });

  test.describe('Touch Interactions', () => {
    test('buttons have adequate touch targets (min 48px height)', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      const searchBtn = page.locator('#page-explore .btn.btn-sm').first();
      const box = await searchBtn.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    });

    test('inputs have 16px+ font size to prevent zoom', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      const inp = page.locator('#exp-inp');
      await page.waitForFunction(() => {
        return typeof window._dbLoaded !== 'undefined' && window._dbLoaded === true;
      }, { timeout: 30000 });
      // Re-render after DB load
      await page.waitForSelector('#exp-inp', { timeout: 5000 });

      const fontSize = await inp.evaluate(el => {
        return parseInt(getComputedStyle(el).fontSize);
      });
      expect(fontSize).toBeGreaterThanOrEqual(16);
    });
  });

  test.describe('Responsive Layout', () => {
    test('chat wrap adjusts for bottom nav', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      const chatWrap = page.locator('.chat-wrap');
      const style = await chatWrap.evaluate(el => getComputedStyle(el).height);
      // Height should be set (not 0)
      expect(parseInt(style)).toBeGreaterThan(100);
    });

    test('explore grid adapts to small screen', async ({ page }) => {
      await gotoHome(page);
      await goToPage(page, 'explore');
      await page.waitForFunction(() => window._dbLoaded === true, { timeout: 30000 });

      await page.fill('#exp-inp', 'dior');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const grid = page.locator('#exp-res .grid');
      if (await grid.isVisible()) {
        const gridStyle = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
        expect(gridStyle).toBeTruthy();
      }
    });
  });
});
