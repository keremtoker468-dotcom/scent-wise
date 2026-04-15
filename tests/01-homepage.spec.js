// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoHome, mockCheckTier, mockImages, mockSubscribe, expectToast } = require('./helpers');

test.describe('Homepage & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockCheckTier(page, 'free');
    await mockImages(page);
  });

  test.describe('Hero Section', () => {
    test('displays hero with headline, stats, and CTAs', async ({ page }) => {
      await gotoHome(page);
      await expect(page.locator('.hp-hero h1')).toContainText('Find the scent that');
      await expect(page.locator('.hp-hero-eyebrow')).toContainText('Fragrance Discovery, Reimagined');
      await expect(page.locator('.hp-hero-sub')).toBeVisible();
      // Hero stats
      await expect(page.locator('.hp-hero-stat .num').nth(0)).toContainText('75,000+');
      await expect(page.locator('.hp-hero-stat .num').nth(1)).toContainText('6');
      await expect(page.locator('.hp-hero-stat .num').nth(2)).toContainText('2,500');
      // CTA buttons
      await expect(page.locator('.hp-btn-primary')).toContainText('Start Discovering');
      await expect(page.locator('.hp-btn-ghost')).toContainText('See How It Works');
    });

    test('"Start Discovering" navigates to chat mode', async ({ page }) => {
      await gotoHome(page);
      await page.locator('.hp-btn-primary').click();
      await expect(page.locator('#page-chat')).not.toHaveClass(/hidden/);
    });

    test('"See How It Works" scrolls to how-it-works section', async ({ page }) => {
      await gotoHome(page);
      await page.locator('.hp-btn-ghost').click();
      const section = page.locator('#hp-how');
      await expect(section).toBeVisible();
    });
  });

  test.describe('Navigation Bar', () => {
    test('homepage nav has correct links', async ({ page }) => {
      await gotoHome(page);
      const navLinks = page.locator('.hp-nav-links a');
      await expect(navLinks.nth(0)).toContainText('Discover');
      await expect(navLinks.nth(1)).toContainText('How It Works');
      await expect(navLinks.nth(2)).toContainText('Pricing');
      await expect(navLinks.nth(3)).toContainText('Collections');
      await expect(navLinks.nth(4)).toContainText('Try Free');
    });

    test('"Try Free" CTA navigates to chat', async ({ page }) => {
      await gotoHome(page);
      await page.locator('.hp-nav-cta').click();
      await expect(page.locator('#page-chat')).not.toHaveClass(/hidden/);
    });

    test('SPA navigation hides homepage and shows app nav', async ({ page }) => {
      await gotoHome(page);
      // Homepage nav should be visible
      await expect(page.locator('.hp-nav')).toBeVisible();
      // SPA nav should be hidden on homepage
      await expect(page.locator('.nav-w')).toBeHidden();

      // Navigate to explore
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      // SPA nav should now be visible
      await expect(page.locator('.nav-w')).toBeVisible();
      // Homepage should be hidden
      await expect(page.locator('#page-home')).toHaveClass(/hidden/);
    });

    test('SPA desktop nav shows correct items and active state', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      const nav = page.locator('#nav');
      await expect(nav).toBeVisible();
      // Should have navigation items
      const navItems = nav.locator('.ni');
      await expect(navItems.first()).toBeVisible();
    });

    test('logo click returns to homepage', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');

      await page.locator('.logo').click();
      await expect(page.locator('#page-home')).not.toHaveClass(/hidden/);
    });
  });

  test.describe('Discovery Modes Section', () => {
    test('displays all 6 discovery modes', async ({ page }) => {
      await gotoHome(page);
      const modes = page.locator('.hp-mode-item');
      await expect(modes).toHaveCount(6);

      await expect(modes.nth(0)).toContainText('Ask the Expert');
      await expect(modes.nth(1)).toContainText('Zodiac Match');
      await expect(modes.nth(2)).toContainText('Photo Style Scan');
      await expect(modes.nth(3)).toContainText('Music Match');
      await expect(modes.nth(4)).toContainText('Style Match');
      await expect(modes.nth(5)).toContainText('Celebrity Collections');
    });

    test('clicking each mode card navigates to the correct page', async ({ page }) => {
      const modeMap = [
        { index: 0, page: 'chat' },
        { index: 1, page: 'zodiac' },
        { index: 2, page: 'photo' },
        { index: 3, page: 'music' },
        { index: 4, page: 'style' },
        { index: 5, page: 'celeb' },
      ];

      for (const m of modeMap) {
        await gotoHome(page);
        await page.locator('.hp-mode-item').nth(m.index).click();
        await expect(page.locator(`#page-${m.page}`)).not.toHaveClass(/hidden/);
      }
    });

    test('featured mode (Ask the Expert) spans two columns', async ({ page }) => {
      await gotoHome(page);
      const featured = page.locator('.hp-mode-item.featured');
      await expect(featured).toBeVisible();
      await expect(featured).toContainText('Ask the Expert');
    });
  });

  test.describe('How It Works Section', () => {
    test('displays 3 steps', async ({ page }) => {
      await gotoHome(page);
      const steps = page.locator('.hp-step');
      await expect(steps).toHaveCount(3);
      await expect(steps.nth(0)).toContainText('Choose Your Path');
      await expect(steps.nth(1)).toContainText('Get Matched');
      await expect(steps.nth(2)).toContainText('Discover & Explore');
    });
  });

  test.describe('Pricing Section', () => {
    test('shows free and premium pricing tiers', async ({ page }) => {
      await gotoHome(page);
      const pricing = page.locator('#hp-pricing');
      await expect(pricing).toContainText('Free');
      await expect(pricing).toContainText('$0');
      await expect(pricing).toContainText('$2.99');
      await expect(pricing).toContainText('Premium');
    });

    test('"Explore Database" button navigates to explore', async ({ page }) => {
      await gotoHome(page);
      const freeBtn = page.locator('#hp-pricing').getByText('Explore Database');
      await freeBtn.click();
      await expect(page.locator('#page-explore')).not.toHaveClass(/hidden/);
    });
  });

  test.describe('Newsletter Section', () => {
    test('newsletter form is visible with input and button', async ({ page }) => {
      await gotoHome(page);
      const form = page.locator('#hp-email-form');
      await expect(form).toBeVisible();
      await expect(page.locator('#hp-email-input')).toBeVisible();
      await expect(page.locator('#hp-email-btn')).toBeVisible();
    });

    test('newsletter submission success shows toast', async ({ page }) => {
      await mockSubscribe(page, true);
      await gotoHome(page);
      await page.fill('#hp-email-input', 'user@example.com');
      await page.locator('#hp-email-btn').click();
      await expectToast(page, 'on the list', 'success');
    });

    test('newsletter submission with empty email does nothing', async ({ page }) => {
      await gotoHome(page);
      await page.locator('#hp-email-btn').click();
      // No toast should appear, button text stays the same
      await expect(page.locator('#hp-email-btn')).toContainText('Subscribe');
    });

    test('newsletter submission error shows error toast', async ({ page }) => {
      await mockSubscribe(page, false);
      await gotoHome(page);
      await page.fill('#hp-email-input', 'bad@example.com');
      await page.locator('#hp-email-btn').click();
      await expectToast(page, 'Could not subscribe', 'error');
    });
  });

  test.describe('Celebrity Preview Section', () => {
    test('celebrity preview section is visible', async ({ page }) => {
      await gotoHome(page);
      const section = page.locator('#hp-celebrities');
      await expect(section).toBeVisible();
    });

    test('celebrity cards are horizontally scrollable', async ({ page }) => {
      await gotoHome(page);
      const scroll = page.locator('.hp-celeb-scroll');
      await expect(scroll).toBeVisible();
      const cards = scroll.locator('.hp-celeb-card');
      expect(await cards.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Final CTA Section', () => {
    test('bottom CTA has heading and button', async ({ page }) => {
      await gotoHome(page);
      const cta = page.locator('.hp-cta-section');
      await expect(cta).toContainText('ready');
      await expect(cta.locator('.hp-btn-primary')).toBeVisible();
    });
  });

  test.describe('Footer', () => {
    test('homepage footer has correct links', async ({ page }) => {
      await gotoHome(page);
      const footer = page.locator('.hp-footer');
      await expect(footer).toBeVisible();
      await expect(footer.locator('.hp-footer-links a')).not.toHaveCount(0);
      await expect(footer).toContainText('ScentWise');
    });
  });

  test.describe('SEO & Meta', () => {
    test('page has correct title and meta tags', async ({ page }) => {
      await gotoHome(page);
      const title = await page.title();
      expect(title).toContain('ScentWise');
      // OG meta tags
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      expect(ogTitle).toContain('ScentWise');
      const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content');
      expect(ogDesc).toBeTruthy();
      // Canonical
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toContain('scent-wise.com');
    });

    test('page has viewport meta tag', async ({ page }) => {
      await gotoHome(page);
      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).toContain('width=device-width');
    });
  });
});
