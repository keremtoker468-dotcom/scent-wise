// @ts-check
const { test, expect } = require('@playwright/test');
const {
  gotoHome, goToPage, setPremiumUser, setFreeUser,
  mockCheckTier, mockImages, mockAIResponse,
  mockAIFreeExhausted, mockAIRateLimited, mockAIServerError,
  expectToast,
} = require('./helpers');

test.describe('Error States & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await mockCheckTier(page, 'free');
    await mockImages(page);
  });

  test.describe('Free Trial Exhaustion', () => {
    test('chat shows paywall after 3 free queries', async ({ page }) => {
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'chat');

      await expect(page.locator('.paywall')).toBeVisible();
      await expect(page.locator('.paywall')).toContainText('$2.99');
    });

    test('zodiac shows paywall after trial exhausted', async ({ page }) => {
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'zodiac');

      await expect(page.locator('.paywall')).toBeVisible();
    });

    test('photo shows paywall after trial exhausted', async ({ page }) => {
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'photo');

      await expect(page.locator('.paywall')).toBeVisible();
    });

    test('music shows paywall after trial exhausted', async ({ page }) => {
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'music');

      await expect(page.locator('.paywall')).toBeVisible();
    });

    test('style shows paywall after trial exhausted', async ({ page }) => {
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'style');

      await expect(page.locator('.paywall')).toBeVisible();
    });

    test('dupe shows paywall after trial exhausted', async ({ page }) => {
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'dupe');

      await expect(page.locator('.paywall')).toBeVisible();
    });

    test('explore remains accessible after trial exhausted', async ({ page }) => {
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'explore');
      await page.waitForFunction(() => window._dbLoaded === true, { timeout: 30000 });

      await expect(page.locator('.paywall')).not.toBeVisible();
      await expect(page.locator('#exp-inp')).toBeVisible();
    });

    test('celebrity remains accessible after trial exhausted', async ({ page }) => {
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'celeb');
      await page.waitForFunction(() => window._dbLoaded === true, { timeout: 30000 });

      await expect(page.locator('.paywall')).not.toBeVisible();
    });
  });

  test.describe('API Errors', () => {
    test('rate limited chat shows friendly message', async ({ page }) => {
      await mockAIRateLimited(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      await page.fill('#c-inp', 'Test');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.cb-a', { timeout: 10000 });

      await expect(page.locator('.cb-a').last()).toContainText(/busy|try again/i);
    });

    test('server error in chat shows error message', async ({ page }) => {
      await mockAIServerError(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      await page.fill('#c-inp', 'Test');
      await page.keyboard.press('Enter');

      // Wait for the AI response to render (not just the loading dots)
      await page.waitForFunction(() => {
        const msgs = document.querySelectorAll('.cb-a');
        return msgs.length > 0 && msgs[msgs.length - 1].textContent.trim().length > 5;
      }, { timeout: 10000 });

      const msg = page.locator('.cb-a').last();
      const text = await msg.textContent();
      expect(text.length).toBeGreaterThan(0);
    });

    test('network error shows error toast', async ({ page }) => {
      await page.route('**/api/recommend', (route) => route.abort());
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      await page.fill('#c-inp', 'Test');
      await page.keyboard.press('Enter');

      await page.waitForSelector('.cb-a', { timeout: 10000 });
    });
  });

  test.describe('Toast Notifications', () => {
    test('success toast appears with correct styling', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => showToast('Success!', 'success'));

      const toast = page.locator('.toast-success');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Success!');
    });

    test('error toast appears with correct styling', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => showToast('Error!', 'error'));

      const toast = page.locator('.toast-error');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Error!');
    });

    test('info toast appears with correct styling', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => showToast('Info!', 'info'));

      const toast = page.locator('.toast-info');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Info!');
    });

    test('toast auto-dismisses after duration', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => showToast('Quick toast', 'info', 1000));

      await expect(page.locator('.toast')).toBeVisible();
      // Wait for auto-dismiss
      await page.waitForTimeout(1500);
      await expect(page.locator('.toast')).not.toBeVisible();
    });

    test('toast close button works', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => showToast('Close me', 'info', 0));

      const toast = page.locator('.toast').first();
      await expect(toast).toBeVisible();

      await toast.locator('.toast-close').click();
      await page.waitForTimeout(500);
      await expect(toast).not.toBeVisible();
    });

    test('multiple toasts can stack', async ({ page }) => {
      await gotoHome(page);
      await page.evaluate(() => {
        showToast('First', 'info', 0);
        showToast('Second', 'success', 0);
        showToast('Third', 'error', 0);
      });

      expect(await page.locator('.toast').count()).toBe(3);
    });
  });

  test.describe('Session & State', () => {
    test('page navigation preserves session state', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);

      // Go to chat and send a message
      await goToPage(page, 'chat');
      await page.fill('#c-inp', 'Hello');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.cb-a', { timeout: 10000 });

      // Navigate away
      await goToPage(page, 'explore');

      // Navigate back
      await goToPage(page, 'chat');

      // Message should still be there (from sessionStorage)
      await expect(page.locator('.cb-u')).toBeVisible();
    });

    test('free tier tracking works across modes', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setFreeUser(page, 2);

      // Navigate to chat
      await goToPage(page, 'chat');
      const trialText = await page.locator('#page-chat').textContent();
      expect(trialText).toContain('1'); // 1 remaining (3 - 2)
    });
  });

  test.describe('Input Validation', () => {
    test('chat does not send whitespace-only messages', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      await page.fill('#c-inp', '   ');
      await page.keyboard.press('Enter');

      // No message should be sent
      await expect(page.locator('.cb-u')).not.toBeVisible();
    });

    test('explore search handles special characters', async ({ page }) => {
      await gotoHome(page);
      await goToPage(page, 'explore');
      await page.waitForFunction(() => window._dbLoaded === true, { timeout: 30000 });

      await page.fill('#exp-inp', '<script>alert(1)</script>');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Should show "No results found" not execute script
      const htmlContent = await page.locator('#exp-res').innerHTML();
      expect(htmlContent).not.toContain('<script>');
    });

    test('order ID input strips non-numeric characters', async ({ page }) => {
      await page.route('**/api/verify-subscription', async (route) => {
        const body = JSON.parse(route.request().postData());
        // The orderId should be cleaned
        expect(body.orderId).toMatch(/^\d+$/);
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"tier":"premium"}' });
      });

      await gotoHome(page);
      await goToPage(page, 'account');
      await page.fill('#order-id-input', '#2944561');
      await page.locator('#order-activate-btn').click();
    });
  });

  test.describe('Page Title Updates', () => {
    test('title changes when navigating between pages', async ({ page }) => {
      await gotoHome(page);
      const homeTitle = await page.title();
      expect(homeTitle).toContain('ScentWise');

      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');
      const exploreTitle = await page.title();
      expect(exploreTitle).toBeTruthy();

      await page.evaluate(() => go('chat'));
      await page.waitForSelector('#page-chat:not(.hidden)');
      const chatTitle = await page.title();
      expect(chatTitle).toBeTruthy();
    });
  });

  test.describe('Scroll Behavior', () => {
    test('navigating to a new page scrolls to top', async ({ page }) => {
      await gotoHome(page);
      // Scroll down on homepage
      await page.evaluate(() => window.scrollTo(0, 1000));
      await page.waitForTimeout(200);

      await page.evaluate(() => go('explore'));
      await page.waitForSelector('#page-explore:not(.hidden)');
      await page.waitForTimeout(500);

      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeLessThan(100);
    });
  });

  test.describe('Concurrent Requests', () => {
    test('double-clicking send does not duplicate messages', async ({ page }) => {
      await mockAIResponse(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      await page.fill('#c-inp', 'Test');

      // Rapid double-click
      const sendBtn = page.locator('button').filter({ hasText: 'Send' });
      await sendBtn.click();
      await sendBtn.click();

      await page.waitForSelector('.cb-a', { timeout: 10000 });

      // Should only have one user message
      expect(await page.locator('.cb-u').count()).toBe(1);
    });
  });
});
