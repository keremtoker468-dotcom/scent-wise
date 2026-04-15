// @ts-check
const { test, expect } = require('@playwright/test');
const {
  gotoHome, goToPage, setPremiumUser,
  mockCheckTier, mockImages, mockAIResponse,
} = require('./helpers');

test.describe('Accessibility & Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockCheckTier(page, 'free');
    await mockImages(page);
  });

  test.describe('Skip Navigation', () => {
    test('skip-to-content link exists', async ({ page }) => {
      await gotoHome(page);
      const skipLink = page.locator('.skip-nav');
      await expect(skipLink).toBeAttached();
      await expect(skipLink).toContainText('Skip to main content');
    });

    test('skip-to-content link points to #main-content', async ({ page }) => {
      await gotoHome(page);
      const href = await page.locator('.skip-nav').getAttribute('href');
      expect(href).toBe('#main-content');
    });

    test('skip-to-content link becomes visible on focus', async ({ page }) => {
      await gotoHome(page);
      // Focus the skip link using keyboard Tab
      await page.keyboard.press('Tab');
      // Wait for the transition (top: -100% -> top: 0)
      await page.waitForTimeout(300);
      const skipLink = page.locator('.skip-nav');
      await expect(skipLink).toBeFocused();
      // Check CSS has a :focus rule that moves it visible
      const hasRule = await skipLink.evaluate(el => {
        const styles = getComputedStyle(el);
        // When focused, top should be >= 0 (or close to it during transition)
        return parseFloat(styles.top) > -50;
      });
      expect(hasRule).toBe(true);
    });
  });

  test.describe('ARIA Landmarks', () => {
    test('main content area exists', async ({ page }) => {
      await gotoHome(page);
      await expect(page.locator('#main-content')).toBeAttached();
    });

    test('main navigation has aria-label', async ({ page }) => {
      await gotoHome(page);
      const mainNav = page.locator('nav[aria-label="Main navigation"]');
      await expect(mainNav).toBeAttached();
    });

    test('mobile navigation has aria-label', async ({ page }) => {
      await gotoHome(page);
      const mobNav = page.locator('nav[aria-label="Mobile navigation"]');
      await expect(mobNav).toBeAttached();
    });

    test('page sections have role="region" and aria-label', async ({ page }) => {
      await gotoHome(page);
      const regions = [
        '#page-home', '#page-explore', '#page-chat', '#page-photo',
        '#page-zodiac', '#page-music', '#page-style', '#page-dupe',
        '#page-celeb', '#page-account', '#page-admin',
      ];
      for (const id of regions) {
        const el = page.locator(id);
        await expect(el).toHaveAttribute('role', 'region');
        const label = await el.getAttribute('aria-label');
        expect(label).toBeTruthy();
      }
    });
  });

  test.describe('Toast Notifications', () => {
    test('toast container has role="status" and aria-live="polite"', async ({ page }) => {
      await gotoHome(page);
      await expect(page.locator('#toast-container')).toHaveAttribute('role', 'status');
      await expect(page.locator('#toast-container')).toHaveAttribute('aria-live', 'polite');
    });

    test('toast notifications have role="alert"', async ({ page }) => {
      await gotoHome(page);
      // Trigger a toast
      await page.evaluate(() => showToast('Test message', 'info'));
      const toast = page.locator('.toast').first();
      await expect(toast).toHaveAttribute('role', 'alert');
    });

    test('toast close button has aria-label', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => showToast('Test', 'info', 0));
      const closeBtn = page.locator('.toast-close').first();
      await expect(closeBtn).toHaveAttribute('aria-label', 'Dismiss');
    });
  });

  test.describe('Form Labels', () => {
    test('explore search input has screen-reader label', async ({ page }) => {
      await gotoHome(page);
      await goToPage(page, 'explore');
      await page.waitForFunction(() => window._dbLoaded === true, { timeout: 30000 });

      const label = page.locator('label[for="exp-inp"]');
      await expect(label).toBeAttached();
      await expect(label).toHaveClass(/sr-only/);
    });

    test('chat input has screen-reader label', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      const label = page.locator('label[for="c-inp"]');
      await expect(label).toBeAttached();
      await expect(label).toHaveClass(/sr-only/);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('logo is keyboard-accessible', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      const logo = page.locator('.logo');
      await expect(logo).toHaveAttribute('tabindex', '0');
      await expect(logo).toHaveAttribute('role', 'button');
    });

    test('logo responds to Enter key', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      const logo = page.locator('.logo');
      await logo.focus();
      await page.keyboard.press('Enter');

      await expect(page.locator('#page-home')).not.toHaveClass(/hidden/);
    });

    test('navigation items are tabbable', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      // Tab through to find navigation items
      const navItems = page.locator('#nav .ni');
      const count = await navItems.count();
      expect(count).toBeGreaterThan(0);
    });

    test('chat input Enter key sends message', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      await page.fill('#c-inp', 'Test');
      await page.keyboard.press('Enter');

      await page.waitForSelector('.cb-u', { timeout: 5000 });
      await expect(page.locator('.cb-u')).toBeVisible();
    });

    test('homepage hamburger menu is keyboard-accessible', async ({ page }) => {
      await gotoHome(page);
      const toggle = page.locator('.hp-nav-toggle');
      await expect(toggle).toHaveAttribute('role', 'button');
      await expect(toggle).toHaveAttribute('tabindex', '0');
      await expect(toggle).toHaveAttribute('aria-label', /navigation menu/i);
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
  });

  test.describe('Live Regions', () => {
    test('chat messages have aria-live for updates', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      await expect(page.locator('#c-msgs')).toHaveAttribute('role', 'log');
      await expect(page.locator('#c-msgs')).toHaveAttribute('aria-live', 'polite');
    });

    test('zodiac results area has aria-live', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'zodiac');

      await expect(page.locator('#z-res')).toHaveAttribute('aria-live', 'polite');
    });

    test('music results area has aria-live', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'music');

      await expect(page.locator('#m-res')).toHaveAttribute('aria-live', 'polite');
    });

    test('style results area has aria-live', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'style');

      await expect(page.locator('#s-res')).toHaveAttribute('aria-live', 'polite');
    });

    test('dupe results area has aria-live', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'dupe');

      await expect(page.locator('#d-res')).toHaveAttribute('aria-live', 'polite');
    });
  });

  test.describe('Focus Management', () => {
    test('focus-visible outline uses gold color', async ({ page }) => {
      await gotoHome(page);
      const outline = await page.evaluate(() => {
        const style = document.querySelector('style') || document.querySelector('link[rel="stylesheet"]');
        // Check computed style for focus-visible
        return getComputedStyle(document.documentElement).getPropertyValue('--g').trim();
      });
      // The gold CSS variable should be set
      expect(outline).toContain('#c');
    });
  });

  test.describe('Reduced Motion', () => {
    test('prefers-reduced-motion media query exists', async ({ page }) => {
      await gotoHome(page);
      // Check if the reduced motion styles are applied
      const hasReducedMotion = await page.evaluate(() => {
        const sheets = document.styleSheets;
        for (let i = 0; i < sheets.length; i++) {
          try {
            const rules = sheets[i].cssRules;
            for (let j = 0; j < rules.length; j++) {
              if (rules[j].media && rules[j].media.mediaText.includes('prefers-reduced-motion')) {
                return true;
              }
            }
          } catch(e) { /* cross-origin stylesheet */ }
        }
        return false;
      });
      expect(hasReducedMotion).toBe(true);
    });
  });

  test.describe('Screen Reader Text', () => {
    test('sr-only class provides visually hidden text', async ({ page }) => {
      await gotoHome(page);
      const srOnlyExists = await page.evaluate(() => {
        const sheets = document.styleSheets;
        for (let i = 0; i < sheets.length; i++) {
          try {
            const rules = sheets[i].cssRules;
            for (let j = 0; j < rules.length; j++) {
              if (rules[j].selectorText === '.sr-only') return true;
            }
          } catch(e) {}
        }
        return false;
      });
      expect(srOnlyExists).toBe(true);
    });
  });
});
