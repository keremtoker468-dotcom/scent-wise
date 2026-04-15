// @ts-check
const { test, expect } = require('@playwright/test');
const {
  gotoHome, goToPage, setPremiumUser, setOwnerUser, setFreeUser,
  mockCheckTier, mockImages, mockLogin, mockVerifySubscription,
  mockOwnerAuth, mockCreateCheckout, expectToast,
} = require('./helpers');

test.describe('Account & Subscription', () => {
  test.describe('Non-Premium User (Login Page)', () => {
    test.beforeEach(async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'account');
    });

    test('shows login page with email and order ID forms', async ({ page }) => {
      await expect(page.locator('#page-account h2')).toContainText('Log In');
      await expect(page.locator('#login-email')).toBeVisible();
      await expect(page.locator('#order-id-input')).toBeVisible();
    });

    test('email input auto-focuses', async ({ page }) => {
      await expect(page.locator('#login-email')).toBeFocused();
    });

    test('shows email login section with instructions', async ({ page }) => {
      await expect(page.locator('#page-account')).toContainText('Log in with email');
      await expect(page.locator('#page-account')).toContainText('Enter the email');
    });

    test('shows order ID activation section', async ({ page }) => {
      await expect(page.locator('#page-account')).toContainText('Have an order ID');
      await expect(page.locator('#page-account')).toContainText('LemonSqueezy');
    });

    test('shows subscribe link at bottom', async ({ page }) => {
      await expect(page.locator('#page-account')).toContainText("Don't have an account");
      await expect(page.locator('#page-account').getByText('Subscribe for $2.99/month')).toBeVisible();
    });
  });

  test.describe('Email Login Flow', () => {
    test('successful email login', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockLogin(page, true);
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'account');

      await page.fill('#login-email', 'test@example.com');
      await page.locator('#login-btn').click();

      // After successful login, should show premium account page
      await page.waitForFunction(() => window.isPaid === true, { timeout: 10000 });
      await expect(page.locator('#page-account')).toContainText('Your Account');
    });

    test('failed email login shows error', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockLogin(page, false);
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'account');

      await page.fill('#login-email', 'unknown@example.com');
      await page.locator('#login-btn').click();

      await expectToast(page, 'No subscription found', 'error');
    });

    test('login button shows loading state', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockImages(page);
      // Delayed response
      await page.route('**/api/login', async (route) => {
        await new Promise(r => setTimeout(r, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, tier: 'premium', email: 'test@example.com' }),
        });
      });
      await gotoHome(page);
      await goToPage(page, 'account');

      await page.fill('#login-email', 'test@example.com');
      await page.locator('#login-btn').click();

      // Button should show loading dots
      await expect(page.locator('#login-btn .dot')).toBeVisible();
      // Progress bar should appear
      await expect(page.locator('#login-progress')).toBeVisible();
    });

    test('Enter key in email input triggers login', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockLogin(page, true);
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'account');

      await page.fill('#login-email', 'test@example.com');
      await page.keyboard.press('Enter');

      await page.waitForFunction(() => window.isPaid === true, { timeout: 10000 });
    });

    test('empty email does nothing', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'account');

      await page.locator('#login-btn').click();
      // Should still show the login form
      await expect(page.locator('#login-email')).toBeVisible();
    });
  });

  test.describe('Order ID Activation Flow', () => {
    test('successful order activation', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockVerifySubscription(page, true);
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'account');

      await page.fill('#order-id-input', '2944561');
      await page.locator('#order-activate-btn').click();

      await page.waitForFunction(() => window.isPaid === true, { timeout: 10000 });
    });

    test('failed order activation shows error', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockVerifySubscription(page, false);
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'account');

      await page.fill('#order-id-input', '9999999');
      await page.locator('#order-activate-btn').click();

      await expectToast(page, 'Invalid order ID', 'error');
    });

    test('non-numeric order ID shows validation error', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'account');

      await page.fill('#order-id-input', 'abc');
      await page.locator('#order-activate-btn').click();

      await expectToast(page, 'valid numeric order ID', 'error');
    });

    test('Enter key in order input triggers activation', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockVerifySubscription(page, true);
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'account');

      await page.fill('#order-id-input', '2944561');
      await page.keyboard.press('Enter');

      await page.waitForFunction(() => window.isPaid === true, { timeout: 10000 });
    });
  });

  test.describe('Premium Account Page', () => {
    test.beforeEach(async ({ page }) => {
      await mockCheckTier(page, 'premium');
      await mockImages(page);
      await gotoHome(page);
      await setPremiumUser(page);
      await page.evaluate(() => { window.userEmail = 'test@example.com'; });
      await goToPage(page, 'account');
    });

    test('shows premium account with status badge', async ({ page }) => {
      await expect(page.locator('#page-account h2')).toContainText('Your Account');
      await expect(page.locator('#page-account .tag')).toContainText('Premium');
    });

    test('shows email', async ({ page }) => {
      await expect(page.locator('#page-account')).toContainText('test@example.com');
    });

    test('shows AI query usage', async ({ page }) => {
      await expect(page.locator('#page-account')).toContainText(/\d+ \/ 500 this month/);
    });

    test('shows log out button', async ({ page }) => {
      await expect(page.locator('button').filter({ hasText: 'Log Out' })).toBeVisible();
    });

    test('log out returns to free state', async ({ page }) => {
      await page.route('**/api/owner-auth', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
      });

      await page.locator('button').filter({ hasText: 'Log Out' }).click();

      await page.waitForFunction(() => window.isPaid === false, { timeout: 5000 });
    });
  });

  test.describe('Owner Account Page', () => {
    test('shows owner status with crown emoji', async ({ page }) => {
      await mockCheckTier(page, 'owner');
      await mockImages(page);
      await gotoHome(page);
      await setOwnerUser(page);
      await goToPage(page, 'account');

      await expect(page.locator('#page-account')).toContainText('Owner');
      await expect(page.locator('#page-account')).toContainText('Unlimited');
    });
  });
});

test.describe('Admin/Owner Login', () => {
  test.describe('Login Form', () => {
    test.beforeEach(async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'admin');
    });

    test('shows admin login page with key input', async ({ page }) => {
      await expect(page.locator('#page-admin h2')).toContainText('Owner Login');
      await expect(page.locator('#admin-key')).toBeVisible();
      await expect(page.locator('#admin-key')).toHaveAttribute('type', 'password');
    });

    test('admin key input auto-focuses', async ({ page }) => {
      await expect(page.locator('#admin-key')).toBeFocused();
    });

    test('shows "Back to home" link', async ({ page }) => {
      await expect(page.locator('#page-admin').getByText('Back to home')).toBeVisible();
    });
  });

  test.describe('Owner Login Flow', () => {
    test('successful owner login', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockOwnerAuth(page, true);
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'admin');

      await page.fill('#admin-key', 'correct-owner-key');
      await page.locator('#admin-btn').click();

      await page.waitForFunction(() => window.isOwner === true, { timeout: 10000 });
    });

    test('failed owner login shows error', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockOwnerAuth(page, false);
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'admin');

      await page.fill('#admin-key', 'wrong-key');
      await page.locator('#admin-btn').click();

      await expect(page.locator('#admin-err')).toBeVisible();
      await expect(page.locator('#admin-err')).toContainText('Invalid key');
    });

    test('Enter key triggers login', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockOwnerAuth(page, true);
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'admin');

      await page.fill('#admin-key', 'correct-key');
      await page.keyboard.press('Enter');

      await page.waitForFunction(() => window.isOwner === true, { timeout: 10000 });
    });

    test('input is cleared after failed attempt', async ({ page }) => {
      await mockCheckTier(page, 'free');
      await mockOwnerAuth(page, false);
      await mockImages(page);
      await gotoHome(page);
      await goToPage(page, 'admin');

      await page.fill('#admin-key', 'wrong');
      await page.locator('#admin-btn').click();

      await expect(page.locator('#admin-err')).toBeVisible();
      await expect(page.locator('#admin-key')).toHaveValue('');
    });
  });

  test.describe('Owner Logged In', () => {
    test('shows owner-active page with options', async ({ page }) => {
      await mockCheckTier(page, 'owner');
      await mockImages(page);
      await mockOwnerAuth(page, true);
      await gotoHome(page);
      await setOwnerUser(page);
      await goToPage(page, 'admin');

      await expect(page.locator('#page-admin')).toContainText('Owner Access Active');
      await expect(page.locator('button').filter({ hasText: 'Go to Home' })).toBeVisible();
      await expect(page.locator('button').filter({ hasText: 'Logout' })).toBeVisible();
    });
  });
});

test.describe('Subscription Checkout', () => {
  test('subscribe button calls create-checkout API', async ({ page }) => {
    await mockCheckTier(page, 'free');
    await mockImages(page);
    await mockCreateCheckout(page);
    await gotoHome(page);
    await setFreeUser(page, 3);
    await goToPage(page, 'chat');

    // Should show paywall
    await expect(page.locator('.paywall')).toBeVisible();

    // Intercept navigation to checkout
    let navigatedUrl = '';
    page.on('request', req => {
      if (req.url().includes('lemonsqueezy')) navigatedUrl = req.url();
    });

    // Click subscribe - this will try to navigate, which we can catch
    const [, response] = await Promise.all([
      page.locator('.paywall a[data-subscribe-btn]').click().catch(() => {}),
      page.waitForResponse('**/api/create-checkout'),
    ]);

    expect(response.status()).toBe(200);
  });
});
