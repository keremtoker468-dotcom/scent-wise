// Shared API mocks: the static test server has no /api, so every spec stubs what it needs.
async function mockAPIs(page, opts = {}) {
  const tier = Object.assign({ tier: 'free', freeUsed: 0, emailGiven: true }, opts.tier || {});
  await page.route('**/api/check-tier*', (route) => {
    const url = route.request().url();
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(url.includes('action=profile') ? { hasProfile: false, profile: null } : tier) });
  });
  await page.route('**/api/recommend', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: opts.result || 'Test AI response.', freeUsed: (tier.freeUsed || 0) + 1 }) }));
  await page.route('**/api/img*', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('**/api/unsplash*', (route) => route.fulfill({ status: 404, body: '' }));
}

// A dupe-mode answer in the format recommend.js asks for: one library pick, one invented name.
const DUPE_ANSWER = `ORIGINAL PRICE: ~$325 for 70 ml
Baccarat Rouge 540 is a haze of burnt sugar, saffron and mineral amber.

1. **Club de Nuit Milestone by Armaf** — saffron, amberwood; ~$40
SAME: the airy saffron-amber glow.
YOU GIVE UP: some of the extrait's density.
BLIND BUY RISK: Low-risk blind buy
SCORES: Longevity: 4/5 | Projection: 4/5 | Uniqueness: 2/5 | Versatility: 4/5

2. **Imaginary Rouge Nine by Nobody Perfumes** — sugar, amber; ~$20
SAME: a impressive sugary trail.
YOU GIVE UP: the mineral edge.
BLIND BUY RISK: Low-risk blind buy
SCORES: Longevity: 3/5 | Projection: 3/5 | Uniqueness: 2/5 | Versatility: 3/5

If I had to pick one, the Armaf.`;

module.exports = { mockAPIs, DUPE_ANSWER };
