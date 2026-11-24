// @ts-check
const { test, expect } = require('@playwright/test');
const { mockAPIs } = require('./helpers');

test.describe('Home page', () => {
  test('renders before the perfume database loads', async ({ page }) => {
    await mockAPIs(page);
    await page.route('**/perfumes*.js', () => { /* hold forever */ });
    await page.goto('/');
    await expect(page.locator('#view-home')).toBeVisible();
    await expect(page.locator('#hero-q')).toBeVisible();
  });

  test('one h1, dupe-first title and home canonical', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page).toHaveTitle(/Perfume Dupes/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://scent-wise.com/');
  });

  test('app.js is deferred and versioned', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
    const s = page.locator('script[src^="/app.js"]');
    await expect(s).toHaveAttribute('defer', '');
    await expect(s).toHaveAttribute('src', /\?v=\d+/);
  });

  test('hero tabs switch between dupe and mood search', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
    const dupe = page.locator('[data-hero-mode="dupe"]'), chat = page.locator('[data-hero-mode="chat"]');
    await expect(dupe).toHaveAttribute('aria-selected', 'true');
    await chat.click();
    await expect(chat).toHaveAttribute('aria-selected', 'true');
    await expect(dupe).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#hero-q')).not.toHaveAttribute('placeholder', /Baccarat/);
  });

  test('free allowance is described in one sentence', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
    await expect(page.locator('#hero-trust')).toHaveText('3 free searches. The first needs no sign-up, the next two your email.');
  });

  test('FAQ markup and FAQPage JSON-LD list the same questions', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
    const html = await page.locator('#faq-list summary').allTextContents();
    const ld = await page.evaluate(() => {
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        const d = JSON.parse(s.textContent || '{}');
        if (d['@type'] === 'FAQPage') return d.mainEntity.map((q) => q.name);
      }
      return [];
    });
    expect(ld).toEqual(html.map((t) => t.trim()));
  });

  test('no horizontal scroll on a phone', async ({ page }) => {
    await mockAPIs(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('Route pages are their own documents', () => {
  for (const [path, title, h1] of [['/explore', /Explore 65,000\+/, 'Explore'], ['/celebrities', /Celebrity Fragrances/, 'Celebrities'], ['/advisor', /AI Fragrance Advisor/, null]]) {
    test(`${path} serves its own title, canonical and single h1`, async ({ page, request }) => {
      const raw = await (await request.get(path)).text();
      expect(raw).toContain(`<link rel="canonical" href="https://scent-wise.com${path}">`);
      expect(raw.match(/<h1[\s>]/g) || []).toHaveLength(1);
      expect(raw).not.toContain('"@type":"FAQPage"');
      await mockAPIs(page);
      await page.goto(path);
      await expect(page).toHaveTitle(title);
      await expect(page.locator('h1')).toHaveCount(1);
      if (h1) await expect(page.locator('h1')).toHaveText(h1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://scent-wise.com${path}`);
    });
  }

  test('celebrity list is in the HTML before any script runs', async ({ request }) => {
    const raw = await (await request.get('/celebrities')).text();
    expect((raw.match(/class="celeb"/g) || []).length).toBeGreaterThan(90);
    expect(raw).toContain('Rihanna');
  });

  test('client-side navigation updates the canonical', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
    await page.locator('[data-nav="explore"]:visible').first().click();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://scent-wise.com/explore');
  });
});

test.describe('Explore and celebrities', () => {
  test('explore search finds a perfume client-side', async ({ page }) => {
    await mockAPIs(page);
    const api = [];
    page.on('request', (r) => { const u = r.url(); if (u.includes('/api/') && !u.includes('check-tier') && !u.includes('/api/img')) api.push(u); });
    await page.goto('/explore');
    await page.locator('#explore-q').fill('Sauvage');
    await page.locator('#explore-q').press('Enter');
    await expect(page.locator('#explore-results .pcard').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#explore-results')).toContainText('Sauvage');
    expect(api).toHaveLength(0);
  });

  test('celebrity filter narrows the grid', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/celebrities');
    await page.locator('#celeb-q').fill('Rihanna');
    await expect(page.locator('#celeb-grid .celeb')).toHaveCount(1, { timeout: 30000 });
  });
});
