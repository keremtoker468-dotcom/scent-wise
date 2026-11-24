// @ts-check
const { test, expect } = require('@playwright/test');
const { mockAPIs, DUPE_ANSWER } = require('./helpers');

async function askDupe(page, opts) {
  await mockAPIs(page, Object.assign({ result: DUPE_ANSWER }, opts));
  await page.goto('/advisor?mode=dupe');
  await page.locator('#composer-input').fill('Baccarat Rouge 540');
  await page.locator('#send-btn').click();
}

test.describe('Dupe answers', () => {
  test('show price, saving, trade-off and a priced Shop button', async ({ page }) => {
    await askDupe(page);
    const first = page.locator('#thread .rec').first();
    await expect(first).toContainText('Club de Nuit Milestone', { timeout: 30000 });
    await expect(first.locator('.cost')).toContainText('~$40');
    await expect(first.locator('.cost .save')).toContainText('Save ~88%');
    await expect(first.locator('.trade')).toContainText('Same.');
    await expect(first.locator('.trade')).toContainText('You give up.');
    const shop = first.getByRole('link', { name: /Shop/ });
    await expect(shop).toContainText('Shop · ~$40');
    await expect(shop).toHaveAttribute('href', /amazon\./);
  });

  test('match bar comes from the database, never from the AI text', async ({ page }) => {
    await askDupe(page);
    const first = page.locator('#thread .rec').first();
    await expect(first.locator('.match')).toBeVisible({ timeout: 30000 });
    await expect(first.locator('.match')).toContainText(/match|accords|notes/i);
    await expect(page.locator('#thread')).not.toContainText(/\d+% match/);
  });

  test('a pick outside the library is labelled and never called low-risk', async ({ page }) => {
    await askDupe(page);
    const second = page.locator('#thread .rec').nth(1);
    await expect(second).toContainText('Imaginary Rouge Nine', { timeout: 30000 });
    await expect(second.locator('.lib')).toContainText('Not in our library');
    await expect(second).not.toContainText('Low-risk');
    await expect(page.locator('#thread .rec').first().locator('.lib.ok')).toBeVisible();
  });

  test('fixes "a impressive" in AI text', async ({ page }) => {
    await askDupe(page);
    await expect(page.locator('#thread')).toContainText('an impressive sugary trail', { timeout: 30000 });
    await expect(page.locator('#thread')).not.toContainText('a impressive');
  });
});

test.describe('Paywall and checkout', () => {
  test('free limit shows the unlock card over blurred picks', async ({ page }) => {
    await askDupe(page, { tier: { freeUsed: 3 } });
    const pw = page.locator('#thread .paywall');
    await expect(pw).toBeVisible({ timeout: 30000 });
    await expect(pw.locator('.rec.is-locked')).toHaveCount(2);
    await expect(pw).toContainText(/close matches for Baccarat Rouge 540|one step away/);
    await expect(pw.getByRole('button', { name: 'Unlock for $10' })).toBeVisible();
  });

  test('checkout button stays disabled until the waiver is ticked', async ({ page }) => {
    await askDupe(page, { tier: { freeUsed: 3 } });
    // On a phone the cookie banner sits over the bottom of the sheet; answer it first, as a visitor would.
    const essential = page.getByRole('button', { name: 'Essential only' });
    if (await essential.isVisible()) await essential.click();
    await page.getByRole('button', { name: 'Unlock for $10' }).click();
    const go = page.locator('#co-go');
    await expect(go).toBeDisabled();
    await page.locator('#co-waiver').check();
    await expect(go).toBeEnabled();
  });
});
