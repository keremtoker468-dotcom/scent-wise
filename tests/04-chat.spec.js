// @ts-check
const { test, expect } = require('@playwright/test');
const {
  gotoHome, goToPage, setPremiumUser, setFreeUser,
  mockAIResponse, mockAIFreeExhausted, mockAIRateLimited, mockAIServerError,
  mockCheckTier, mockImages, expectToast, setupAIModePage,
} = require('./helpers');

test.describe('AI Chat Mode (Ask the Expert)', () => {
  test.describe('Premium User', () => {
    test.beforeEach(async ({ page }) => {
      await setupAIModePage(page, 'chat');
    });

    test('displays chat page with title and input', async ({ page }) => {
      await expect(page.locator('#page-chat h2')).toContainText('AI');
      await expect(page.locator('#page-chat h2')).toContainText('Fragrance Advisor');
      await expect(page.locator('#c-inp')).toBeVisible();
      await expect(page.locator('#c-inp')).toBeFocused();
    });

    test('shows suggestion cards when no messages', async ({ page }) => {
      const suggestions = page.locator('#c-msgs .card');
      expect(await suggestions.count()).toBe(6);
      await expect(suggestions.first()).toContainText(/Best fragrances|Dupe for|Build me|Compare|Best office|Top 5/);
    });

    test('clicking a suggestion sends the message', async ({ page }) => {
      await page.locator('#c-msgs .card').first().click();
      // Wait for AI response
      await page.waitForSelector('.cb-a', { timeout: 10000 });
      const userMsg = page.locator('.cb-u');
      expect(await userMsg.count()).toBeGreaterThan(0);
      const aiMsg = page.locator('.cb-a');
      expect(await aiMsg.count()).toBeGreaterThan(0);
    });

    test('typing and pressing Enter sends a message', async ({ page }) => {
      await page.fill('#c-inp', 'What is the best summer fragrance?');
      await page.keyboard.press('Enter');

      // Wait for AI response (loading dots may be too brief to catch with instant mock)
      await page.waitForFunction(() => {
        const msgs = document.querySelectorAll('.cb-a');
        return msgs.length > 0 && msgs[msgs.length - 1].textContent.trim().length > 5;
      }, { timeout: 10000 });

      const userBubble = page.locator('.cb-u').last();
      await expect(userBubble).toContainText('best summer fragrance');

      const aiBubble = page.locator('.cb-a').last();
      await expect(aiBubble).toContainText('fragrance recommendations');
    });

    test('Send button sends a message', async ({ page }) => {
      await page.fill('#c-inp', 'Recommend something woody');
      await page.locator('button').filter({ hasText: 'Send' }).click();

      await page.waitForSelector('.cb-a', { timeout: 10000 });
      await expect(page.locator('.cb-u').last()).toContainText('woody');
    });

    test('input is cleared after sending', async ({ page }) => {
      await page.fill('#c-inp', 'Test message');
      await page.keyboard.press('Enter');
      await expect(page.locator('#c-inp')).toHaveValue('');
    });

    test('Send button is disabled during loading', async ({ page }) => {
      // Use a delayed mock response
      await page.route('**/api/recommend', async (route) => {
        await new Promise(r => setTimeout(r, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ result: 'Response', usage: 1 }),
        });
      });

      await page.fill('#c-inp', 'Test');
      await page.keyboard.press('Enter');

      // Button should be disabled while loading
      await expect(page.locator('button').filter({ hasText: 'Send' })).toBeDisabled();
    });

    test('empty message is not sent', async ({ page }) => {
      await page.locator('button').filter({ hasText: 'Send' }).click();
      // No user bubble should appear
      await expect(page.locator('.cb-u')).not.toBeVisible();
    });

    test('chat history persists across messages', async ({ page }) => {
      await page.fill('#c-inp', 'First question');
      await page.keyboard.press('Enter');
      // Wait for the first AI response to fully render
      await page.waitForFunction(() => {
        const msgs = document.querySelectorAll('.cb-a');
        return msgs.length > 0 && msgs[msgs.length - 1].textContent.trim().length > 5;
      }, { timeout: 10000 });

      await page.fill('#c-inp', 'Second question');
      await page.keyboard.press('Enter');
      // Wait for second AI response to fully render
      await page.waitForFunction(() => {
        const msgs = document.querySelectorAll('.cb-a');
        return msgs.length >= 2 && msgs[msgs.length - 1].textContent.trim().length > 5;
      }, { timeout: 10000 });

      const userMsgs = page.locator('.cb-u');
      expect(await userMsgs.count()).toBe(2);
      const aiMsgs = page.locator('.cb-a');
      expect(await aiMsgs.count()).toBe(2);
    });

    test('"New Chat" button appears after messages and clears history', async ({ page }) => {
      await page.fill('#c-inp', 'Test');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.cb-a', { timeout: 10000 });

      const newChatBtn = page.locator('button').filter({ hasText: 'New Chat' });
      await expect(newChatBtn).toBeVisible();

      await newChatBtn.click();
      // Messages should be cleared, suggestions shown again
      await expect(page.locator('.cb-u')).not.toBeVisible();
      expect(await page.locator('#c-msgs .card').count()).toBe(6);
    });

    test('AI response shows feedback buttons (like/dislike)', async ({ page }) => {
      await page.fill('#c-inp', 'Test');
      await page.keyboard.press('Enter');
      // Wait for the actual AI response (not just loading dots)
      await page.waitForFunction(() => {
        const msgs = document.querySelectorAll('.cb-a');
        return msgs.length > 0 && msgs[msgs.length - 1].textContent.trim().length > 5;
      }, { timeout: 10000 });

      // Feedback buttons are plain buttons with thumbs up/down inside .cb-a
      const feedbackBtns = page.locator('.cb-a button');
      expect(await feedbackBtns.count()).toBeGreaterThanOrEqual(2);
    });

    test('AI response is formatted with bold text', async ({ page }) => {
      await page.fill('#c-inp', 'Test');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.cb-a', { timeout: 10000 });

      const boldText = page.locator('.cb-a strong');
      expect(await boldText.count()).toBeGreaterThan(0);
    });

    test('chat messages container has correct ARIA attributes', async ({ page }) => {
      await expect(page.locator('#c-msgs')).toHaveAttribute('role', 'log');
      await expect(page.locator('#c-msgs')).toHaveAttribute('aria-live', 'polite');
    });
  });

  test.describe('Free User with Trial', () => {
    test('shows trial banner with remaining queries', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockAIResponse(page);
      await mockImages(page);
      await gotoHome(page);
      await setFreeUser(page, 1);
      await goToPage(page, 'chat');

      const trialBanner = page.locator('#page-chat').getByText(/free trial/i);
      await expect(trialBanner).toBeVisible();
    });

    test('free user can send messages during trial', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockAIResponse(page);
      await mockImages(page);
      await gotoHome(page);
      await setFreeUser(page, 0);
      await goToPage(page, 'chat');

      await page.fill('#c-inp', 'Test question');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.cb-a', { timeout: 10000 });
      await expect(page.locator('.cb-a').last()).toBeVisible();
    });
  });

  test.describe('Free User - Trial Exhausted', () => {
    test('shows paywall when all free queries are used', async ({ page }) => {
      await mockCheckTier(page, 'free', 3);
      await mockImages(page);
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'chat');

      await expect(page.locator('.paywall')).toBeVisible();
      await expect(page.locator('.paywall')).toContainText('Unlock');
      await expect(page.locator('.paywall')).toContainText('$2.99');
    });

    test('paywall has subscribe button', async ({ page }) => {
      await mockCheckTier(page, 'free', 3);
      await mockImages(page);
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'chat');

      await expect(page.locator('.paywall a[data-subscribe-btn]')).toBeVisible();
      await expect(page.locator('.paywall a[data-subscribe-btn]')).toContainText('Subscribe Now');
    });

    test('paywall has "Log in here" link', async ({ page }) => {
      await mockCheckTier(page, 'free', 3);
      await mockImages(page);
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'chat');

      await expect(page.locator('.paywall').getByText('Log in here')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('rate limit response shows error in chat', async ({ page }) => {
      await mockCheckTier(page, 'premium');
      await mockAIRateLimited(page);
      await mockImages(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await goToPage(page, 'chat');

      await page.fill('#c-inp', 'Test');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.cb-a', { timeout: 10000 });

      await expect(page.locator('.cb-a').last()).toContainText(/busy|try again/i);
    });

    test('server error shows error message', async ({ page }) => {
      await mockCheckTier(page, 'premium');
      await mockAIServerError(page);
      await mockImages(page);
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

      const lastMsg = page.locator('.cb-a').last();
      const text = await lastMsg.textContent();
      expect(text.length).toBeGreaterThan(0);
    });
  });
});
