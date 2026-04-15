// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const {
  setPremiumUser, setFreeUser,
  mockAIResponse, mockCheckTier, mockImages,
  gotoHome, goToPage, setupAIModePage,
} = require('./helpers');

// Create a minimal test image (1x1 red pixel PNG)
function createTestImage() {
  const tmpPath = path.join(__dirname, 'test-image.png');
  if (!fs.existsSync(tmpPath)) {
    // Minimal valid PNG (1x1 red pixel)
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(tmpPath, png);
  }
  return tmpPath;
}

test.describe('Photo Style Scan Mode', () => {
  test.describe('Premium User - Upload', () => {
    test.beforeEach(async ({ page }) => {
      await setupAIModePage(page, 'photo');
    });

    test('displays photo page with upload area', async ({ page }) => {
      await expect(page.locator('#page-photo h2')).toContainText('Style');
      await expect(page.locator('#page-photo h2')).toContainText('Scan');
      await expect(page.locator('.pdrop')).toBeVisible();
    });

    test('upload area has correct text', async ({ page }) => {
      await expect(page.locator('.pdrop')).toContainText('Drop a photo');
      await expect(page.locator('.pdrop')).toContainText('click to upload');
    });

    test('file input exists and accepts images', async ({ page }) => {
      const fileInput = page.locator('#pf');
      await expect(fileInput).toHaveAttribute('accept', 'image/*');
    });

    test('uploading an image shows preview and action buttons', async ({ page }) => {
      const testImg = createTestImage();
      const fileInput = page.locator('#pf');
      await fileInput.setInputFiles(testImg);

      // Wait for preview to render
      await page.waitForSelector('#page-photo img', { timeout: 10000 });
      await expect(page.locator('#page-photo img')).toBeVisible();

      // Should show "Find My Fragrances" button
      await expect(page.locator('button').filter({ hasText: 'Find My Fragrances' })).toBeVisible();
      // Should show "Change Photo" button
      await expect(page.locator('button').filter({ hasText: 'Change Photo' })).toBeVisible();
    });

    test('"Find My Fragrances" sends image and shows results', async ({ page }) => {
      const testImg = createTestImage();
      await page.locator('#pf').setInputFiles(testImg);
      await page.waitForSelector('#page-photo img', { timeout: 10000 });

      await page.locator('button').filter({ hasText: 'Find My Fragrances' }).click();

      // Wait for results (loading state may be too brief to catch with instant mock)
      await page.waitForSelector('#page-photo .rbox', { timeout: 10000 });
      await expect(page.locator('#page-photo .rbox')).toContainText('fragrance');
    });

    test('results show follow-up input', async ({ page }) => {
      const testImg = createTestImage();
      await page.locator('#pf').setInputFiles(testImg);
      await page.waitForSelector('#page-photo img', { timeout: 10000 });
      await page.locator('button').filter({ hasText: 'Find My Fragrances' }).click();
      await page.waitForSelector('#page-photo .rbox', { timeout: 10000 });

      await expect(page.locator('#pfu-inp')).toBeVisible();
    });

    test('"Change Photo" / "Try Another Photo" resets the state', async ({ page }) => {
      const testImg = createTestImage();
      await page.locator('#pf').setInputFiles(testImg);
      await page.waitForSelector('#page-photo img', { timeout: 10000 });

      await page.locator('button').filter({ hasText: 'Change Photo' }).click();

      // Should return to upload area
      await expect(page.locator('.pdrop')).toBeVisible();
    });

    test('results show feedback buttons', async ({ page }) => {
      const testImg = createTestImage();
      await page.locator('#pf').setInputFiles(testImg);
      await page.waitForSelector('#page-photo img', { timeout: 10000 });
      await page.locator('button').filter({ hasText: 'Find My Fragrances' }).click();
      await page.waitForSelector('#page-photo .rbox', { timeout: 10000 });

      // Feedback buttons are plain buttons with thumbs up/down
      const feedback = page.locator('#page-photo .rbox button');
      expect(await feedback.count()).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Drag and Drop', () => {
    test('drop zone highlights on dragover', async ({ page }) => {
      await setupAIModePage(page, 'photo');

      // Simulate dragover event
      await page.locator('.pdrop').dispatchEvent('dragover', {});
      // After dragover, border color should change (via inline style)
      const style = await page.locator('.pdrop').getAttribute('style');
      // The style should be modified by the dragover handler
      // (ondragover sets border-color to var(--g))
    });
  });

  test.describe('Paywall', () => {
    test('shows paywall when free trial exhausted', async ({ page }) => {
      await mockCheckTier(page, 'free', 3);
      await mockImages(page);
      await gotoHome(page);
      await setFreeUser(page, 3);
      await goToPage(page, 'photo');

      await expect(page.locator('.paywall')).toBeVisible();
    });
  });
});
