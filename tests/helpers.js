// @ts-check
const { expect } = require('@playwright/test');

/**
 * Navigate to a specific page/mode via the app's go() function.
 * This bypasses navigation clicks for faster, more reliable test setup.
 */
async function goToPage(page, pageName) {
  await page.evaluate((p) => go(p), pageName);
  await page.waitForSelector(`#page-${pageName}:not(.hidden)`, { timeout: 10000 });
}

/**
 * Wait for the perfume database to finish loading.
 * Many pages depend on the DB being ready (explore, celeb, dupe finder).
 */
async function waitForDB(page) {
  await page.waitForFunction(() => typeof window._dbLoaded !== 'undefined' && window._dbLoaded === true, { timeout: 30000 });
}

/**
 * Set the app to "premium" mode by injecting state.
 * Avoids needing a real subscription for testing paid features.
 */
async function setPremiumUser(page) {
  await page.evaluate(() => {
    window.isPaid = true;
    window.currentTier = 'premium';
    window.freeUsed = 0;
  });
}

/**
 * Set the app to "owner" mode.
 */
async function setOwnerUser(page) {
  await page.evaluate(() => {
    window.isPaid = true;
    window.isOwner = true;
    window.currentTier = 'owner';
  });
}

/**
 * Set the app to "free" mode with a specific number of queries used.
 */
async function setFreeUser(page, queriesUsed = 0) {
  await page.evaluate((used) => {
    window.isPaid = false;
    window.isOwner = false;
    window.currentTier = 'free';
    window.freeUsed = used;
  }, queriesUsed);
}

/**
 * Mock the /api/recommend endpoint to return a predictable AI response.
 */
async function mockAIResponse(page, response = 'Here are your fragrance recommendations:\n\n1. **Dior Sauvage** by Dior — fresh, spicy\n2. **Bleu de Chanel** by Chanel — woody, citrus\n3. **Acqua di Gio** by Giorgio Armani — aquatic, fresh') {
  await page.route('**/api/recommend', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: response, freeUsed: 1, usage: 1 }),
    });
  });
}

/**
 * Mock the /api/recommend endpoint to return a 403 (free trial exhausted).
 */
async function mockAIFreeExhausted(page) {
  await page.route('**/api/recommend', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Free trial exhausted', freeUsed: 3 }),
    });
  });
}

/**
 * Mock the /api/recommend endpoint to return a 429 (rate limited).
 */
async function mockAIRateLimited(page) {
  await page.route('**/api/recommend', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Rate limited. Please try again in a few seconds.' }),
    });
  });
}

/**
 * Mock the /api/recommend endpoint to return a 500 (server error).
 */
async function mockAIServerError(page) {
  await page.route('**/api/recommend', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal server error' }),
    });
  });
}

/**
 * Mock the /api/check-tier endpoint.
 */
async function mockCheckTier(page, tier = 'free', freeUsed = 0) {
  await page.route('**/api/check-tier*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Handle profile requests
    if (url.includes('action=profile')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(method === 'GET' ? { hasProfile: false, profile: null } : { success: true }),
      });
      return;
    }

    // Regular tier check
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tier,
        freeUsed: tier === 'free' ? freeUsed : 0,
        email: tier !== 'free' ? 'test@example.com' : '',
        usage: 0,
      }),
    });
  });
}

/**
 * Mock the /api/create-checkout endpoint.
 */
async function mockCreateCheckout(page) {
  await page.route('**/api/create-checkout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://scentwise.lemonsqueezy.com/checkout/test' }),
    });
  });
}

/**
 * Mock the /api/login endpoint.
 */
async function mockLogin(page, success = true) {
  await page.route('**/api/login', async (route) => {
    if (success) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, tier: 'premium', email: 'test@example.com' }),
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No subscription found for this email.' }),
      });
    }
  });
}

/**
 * Mock the /api/verify-subscription endpoint.
 */
async function mockVerifySubscription(page, success = true) {
  await page.route('**/api/verify-subscription', async (route) => {
    if (success) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, tier: 'premium', email: 'test@example.com' }),
      });
    } else {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid order ID.' }),
      });
    }
  });
}

/**
 * Mock the /api/owner-auth endpoint.
 */
async function mockOwnerAuth(page, success = true) {
  await page.route('**/api/owner-auth', async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
      return;
    }
    if (success) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid key.' }),
      });
    }
  });
}

/**
 * Mock the /api/subscribe endpoint.
 */
async function mockSubscribe(page, success = true) {
  await page.route('**/api/subscribe', async (route) => {
    if (success) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Could not subscribe.' }),
      });
    }
  });
}

/**
 * Mock all image-related endpoints to avoid external fetches.
 */
async function mockImages(page) {
  await page.route('**/api/img*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"urls":[]}' });
  });
  await page.route('**/api/unsplash*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"urls":[]}' });
  });
}

/**
 * Verify a toast notification appeared with the expected text.
 */
async function expectToast(page, text, type = null) {
  const toastSelector = type ? `.toast-${type}` : '.toast';
  const toast = page.locator(toastSelector).filter({ hasText: text });
  await expect(toast.first()).toBeVisible({ timeout: 5000 });
}

/**
 * Go to the homepage and wait for it to be ready.
 */
async function gotoHome(page) {
  await page.goto('/');
  await page.waitForSelector('#page-home', { timeout: 10000 });
}

/**
 * Navigate to a mode page with all API mocks set up for testing.
 * This is the standard setup for testing any AI-powered mode.
 */
async function setupAIModePage(page, mode) {
  await mockCheckTier(page, 'premium');
  await mockAIResponse(page);
  await mockImages(page);
  await page.goto('/');
  await page.waitForSelector('#page-home', { timeout: 10000 });
  await setPremiumUser(page);
  await goToPage(page, mode);
}

module.exports = {
  goToPage,
  waitForDB,
  setPremiumUser,
  setOwnerUser,
  setFreeUser,
  mockAIResponse,
  mockAIFreeExhausted,
  mockAIRateLimited,
  mockAIServerError,
  mockCheckTier,
  mockCreateCheckout,
  mockLogin,
  mockVerifySubscription,
  mockOwnerAuth,
  mockSubscribe,
  mockImages,
  expectToast,
  gotoHome,
  setupAIModePage,
};
