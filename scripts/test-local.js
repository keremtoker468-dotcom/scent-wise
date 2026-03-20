#!/usr/bin/env node
/**
 * ScentWise — Local Test Runner
 *
 * Tests all new features without needing a running server.
 * For features requiring a server, prints manual test instructions.
 *
 * Usage: node scripts/test-local.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✕\x1b[0m';
const INFO = '\x1b[36m→\x1b[0m';
const WARN = '\x1b[33m!\x1b[0m';
let passed = 0, failed = 0, skipped = 0;

function log(icon, msg) { console.log(`  ${icon} ${msg}`); }

// ───── STATIC FILE CHECKS ─────

function checkFileExists(filePath, desc) {
  const full = path.join(__dirname, '..', filePath);
  if (fs.existsSync(full)) {
    log(PASS, `${desc} — ${filePath}`);
    passed++;
    return true;
  } else {
    log(FAIL, `${desc} — ${filePath} NOT FOUND`);
    failed++;
    return false;
  }
}

function checkFileContains(filePath, search, desc) {
  const full = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(full)) {
    log(FAIL, `${desc} — file not found: ${filePath}`);
    failed++;
    return false;
  }
  const content = fs.readFileSync(full, 'utf8');
  if (content.includes(search)) {
    log(PASS, desc);
    passed++;
    return true;
  } else {
    log(FAIL, `${desc} — "${search}" not found in ${filePath}`);
    failed++;
    return false;
  }
}

// ───── HTTP CHECKS ─────

function fetchJSON(urlPath, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, BASE_URL);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'ScentWise',
        ...(options.headers || {})
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function checkEndpoint(urlPath, expectedStatus, desc, options = {}) {
  const res = await fetchJSON(urlPath, options);
  if (!res) {
    log(WARN, `${desc} — server not reachable (start with: npx vercel dev)`);
    skipped++;
    return null;
  }
  if (res.status === expectedStatus) {
    log(PASS, `${desc} — HTTP ${res.status}`);
    passed++;
    return res;
  } else {
    log(FAIL, `${desc} — expected ${expectedStatus}, got ${res.status}`);
    failed++;
    return res;
  }
}

// ═══════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════

async function main() {
  console.log('\n\x1b[1m═══ ScentWise Local Test Suite ═══\x1b[0m\n');

  // ───── PHASE A: Conversion Fixes ─────
  console.log('\x1b[1m Phase A: Conversion Fixes\x1b[0m');

  // A1: Social proof
  checkFileExists('api/feedback.js', 'A1: Feedback API endpoint exists');
  checkFileContains('public/app.js', 'feedbackHTML', 'A1: Feedback widget function in app.js');
  checkFileContains('public/app.js', 'submitFeedback', 'A1: submitFeedback function in app.js');
  checkFileContains('public/app.js', 'sendFeedback', 'A1: sendFeedback function in app.js');
  checkFileContains('public/index.html', 'hp-testimonials', 'A1: Testimonials section in homepage');
  checkFileContains('public/app.js', 'loadTestimonials', 'A1: Testimonials loader in app.js');

  // A2: Product demo
  checkFileContains('public/index.html', 'hp-demo', 'A2: Product demo section in homepage');
  checkFileContains('public/index.html', 'See It in Action', 'A2: Demo section heading');
  checkFileContains('public/index.html', 'Dupe Finder', 'A2: Dupe Finder demo card');

  // A3: Pricing
  checkFileContains('public/index.html', 'hp-pricing', 'A3: Pricing section in homepage');
  checkFileContains('public/index.html', 'Simple Pricing', 'A3: Pricing section heading');
  checkFileContains('public/index.html', '$2.99', 'A3: Price displayed');
  checkFileContains('public/index.html', '500 AI queries/month', 'A3: Premium query limit shown');
  checkFileContains('public/index.html', 'Most Popular', 'A3: Premium badge');

  // A4: Email capture
  checkFileExists('api/capture-email.js', 'A4: Email capture API endpoint');
  checkFileContains('public/app.js', 'captureEmail', 'A4: captureEmail function in app.js');
  checkFileContains('public/app.js', 'pw-email', 'A4: Email input in paywall');
  checkFileContains('public/app.js', '/api/capture-email', 'A4: API call to capture-email');

  console.log('');

  // ───── PHASE B: Scale Traffic + Revenue ─────
  console.log('\x1b[1m Phase B: Scale Traffic & Revenue\x1b[0m');

  // B1: OG cards
  checkFileExists('api/og.js', 'B1: OG image API endpoint');
  checkFileContains('api/og.js', 'ImageResponse', 'B1: Uses @vercel/og ImageResponse');
  checkFileContains('seo/_includes/base.njk', '/api/og?title=', 'B1: OG image meta in 11ty template');
  checkFileContains('package.json', '@vercel/og', 'B1: @vercel/og dependency added');

  // B2: Dupe Finder
  checkFileContains('public/app.js', 'r_dupe', 'B2: Dupe Finder renderer');
  checkFileContains('public/app.js', 'dupeSearch', 'B2: dupeSearch function');
  checkFileContains('public/app.js', 'dupeFU', 'B2: Dupe follow-up function');
  checkFileContains('public/app.js', "id:'dupe'", 'B2: Dupe in navigation arrays');
  checkFileContains('public/index.html', 'page-dupe', 'B2: Dupe page div in HTML');
  checkFileContains('public/index.html', 'Dupe Finder', 'B2: Dupe Finder in homepage modes');

  // B3: Buy buttons
  checkFileContains('seo/_includes/perfume.njk', 'Where to Buy', 'B3: Buy section in perfume template');
  checkFileContains('seo/_includes/perfume.njk', 'affiliate-redirect', 'B3: Affiliate links in template');
  checkFileContains('seo/_includes/perfume.njk', 'rel="sponsored noopener"', 'B3: Proper rel attributes');
  checkFileExists('scripts/add-buy-links.js', 'B3: Blog buy-links injection script');
  // Check a blog article was modified
  const blogDir = path.join(__dirname, '..', 'public', 'blog');
  const blogFiles = fs.readdirSync(blogDir).filter(f => f.endsWith('.html') && f !== 'index.html');
  const blogsWithBuyLinks = blogFiles.filter(f => {
    const content = fs.readFileSync(path.join(blogDir, f), 'utf8');
    return content.includes('buy-links');
  });
  if (blogsWithBuyLinks.length > 0) {
    log(PASS, `B3: Buy links injected into ${blogsWithBuyLinks.length} blog articles`);
    passed++;
  } else {
    log(FAIL, 'B3: No blog articles have buy links');
    failed++;
  }

  // B4: Security fixes
  checkFileContains('api/recommend.js', "const subSecret = process.env.SUBSCRIPTION_SECRET;", 'B4: No OWNER_KEY fallback in recommend.js');
  const recContent = fs.readFileSync(path.join(__dirname, '..', 'api', 'recommend.js'), 'utf8');
  if (!recContent.includes('SUBSCRIPTION_SECRET || process.env.OWNER_KEY')) {
    log(PASS, 'B4: OWNER_KEY fallback removed');
    passed++;
  } else {
    log(FAIL, 'B4: OWNER_KEY fallback still present!');
    failed++;
  }
  checkFileContains('api/verify-subscription.js', 'expired', 'B4: Rejects expired subscriptions');
  checkFileContains('api/verify-subscription.js', 'paused', 'B4: Rejects paused subscriptions');
  checkFileContains('api/verify-subscription.js', 'cancelled', 'B4: Rejects cancelled subscriptions');

  console.log('');

  // ───── PHASE C: Optimize ─────
  console.log('\x1b[1m Phase C: Optimize With Data\x1b[0m');

  // C1: Orama search
  checkFileContains('public/app.js', '_initOrama', 'C1: Orama initialization function');
  checkFileContains('public/app.js', 'orama.search', 'C1: Orama search call in searchDB');
  checkFileContains('public/app.js', 'tolerance', 'C1: Fuzzy search tolerance configured');
  checkFileContains('public/index.html', 'orama', 'C1: Orama CDN script in HTML');
  checkFileContains('vercel.json', 'unpkg.com', 'C1: Orama CDN in CSP');

  // C2: Promptfoo
  checkFileExists('promptfooconfig.yaml', 'C2: Promptfoo config file');
  checkFileExists('prompts/chat.txt', 'C2: Chat prompt extracted');
  checkFileExists('prompts/zodiac.txt', 'C2: Zodiac prompt extracted');
  checkFileExists('prompts/dupe.txt', 'C2: Dupe prompt extracted');

  // C3: Jest tests
  checkFileExists('tests/auth.test.js', 'C3: Auth test file');
  checkFileExists('tests/rate-limit.test.js', 'C3: Rate limit test file');
  checkFileContains('package.json', '"test"', 'C3: Test script in package.json');
  checkFileContains('package.json', 'jest', 'C3: Jest dependency');

  // C4: Expanded SEO
  checkFileContains('seo/_data/perfumes.js', '2000', 'C4: SEO limit expanded to 2000');
  checkFileContains('seo/_data/perfumes.js', '3.5', 'C4: Rating threshold lowered to 3.5');

  console.log('');

  // ───── API ENDPOINT CHECKS (requires running server) ─────
  console.log('\x1b[1m API Endpoints (requires `npx vercel dev`)\x1b[0m');

  // Check if server is reachable
  const health = await fetchJSON('/');
  if (!health) {
    console.log(`  ${WARN} Server not running. Start with: \x1b[1mnpx vercel dev\x1b[0m`);
    console.log(`  ${INFO} Skipping API tests — run this script again after starting the server\n`);
    skipped += 8;
  } else {
    // Feedback endpoint
    await checkEndpoint('/api/feedback', 200, 'GET /api/feedback — returns stats');
    await checkEndpoint('/api/feedback', 200, 'POST /api/feedback — submit feedback', {
      method: 'POST',
      body: { helpful: true, text: 'Great recommendations!', mode: 'chat' }
    });

    // Email capture
    await checkEndpoint('/api/capture-email', 400, 'POST /api/capture-email — rejects invalid email', {
      method: 'POST',
      body: { email: 'not-an-email' }
    });

    // Check tier
    await checkEndpoint('/api/check-tier', 200, 'GET /api/check-tier — returns tier info');

    // OG image
    await checkEndpoint('/api/og?title=Test+Perfume&brand=Test+Brand', 200, 'GET /api/og — generates OG image');

    // Security: recommend without SUBSCRIPTION_SECRET should fail properly
    await checkEndpoint('/api/recommend', 405, 'GET /api/recommend — rejects non-POST');

    // Affiliate redirect
    await checkEndpoint('/api/affiliate-redirect?perfume=Dior+Sauvage&brand=Dior&retailer=amazon', 302, 'GET /api/affiliate-redirect — redirects');
  }

  console.log('');

  // ───── SUMMARY ─────
  const total = passed + failed + skipped;
  console.log('\x1b[1m═══ Results ═══\x1b[0m');
  console.log(`  ${PASS} Passed: ${passed}`);
  if (failed) console.log(`  ${FAIL} Failed: ${failed}`);
  if (skipped) console.log(`  ${WARN} Skipped: ${skipped}`);
  console.log(`  Total:  ${total}\n`);

  if (failed === 0) {
    console.log('  \x1b[32m\x1b[1mAll checks passed!\x1b[0m\n');
  } else {
    console.log(`  \x1b[31m\x1b[1m${failed} check(s) failed — review above.\x1b[0m\n`);
  }

  // ───── MANUAL TEST SCENARIOS ─────
  console.log('\x1b[1m═══ Manual Test Scenarios ═══\x1b[0m');
  console.log(`
  Start the server:  \x1b[1mnpx vercel dev\x1b[0m
  Then open:         \x1b[1mhttp://localhost:3000\x1b[0m

  \x1b[1m1. Homepage Tour (no login needed)\x1b[0m
     → Scroll down from hero: see "See It in Action" demo section
     → Continue scrolling: "Ways to Discover" now shows 7 modes (incl Dupe Finder)
     → Near bottom: "Simple Pricing" table (Free vs Premium $2.99)
     → Testimonials section appears once users leave feedback

  \x1b[1m2. Dupe Finder Mode\x1b[0m
     → Click "Dupes" in nav bar (or mode 07 on homepage)
     → Click "Baccarat Rouge 540" from popular searches
     → AI returns 5 affordable alternatives with prices
     → Ask a follow-up: "Which one lasts longest?"

  \x1b[1m3. Feedback Widget\x1b[0m
     → Go to AI Advisor (chat mode)
     → Send: "Best colognes for summer"
     → Below the AI response, see "Was this helpful? 👍👎"
     → Click 👍 → type feedback → click Send
     → Check feedback stored: GET http://localhost:3000/api/feedback

  \x1b[1m4. Email Capture at Paywall\x1b[0m
     → Use all 3 free AI queries (send 3 messages in different modes)
     → On the 4th attempt, paywall appears
     → Below "Subscribe Now", see email capture input
     → Enter email → click "Send Matches"

  \x1b[1m5. Fuzzy Search (Orama)\x1b[0m
     → Go to Explore tab
     → Search: "Dior Sauvag" (typo — missing 'e')
     → Should still find "Dior Sauvage" via fuzzy matching
     → Also try: "baccarat roug", "chanel bleu"

  \x1b[1m6. Buy Links on Blog Articles\x1b[0m
     → Open: http://localhost:3000/blog/best-mens-fragrances.html
     → Scroll to fragrance cards — see "Buy on FragranceX / Amazon" links
     → Click one → should redirect via /api/affiliate-redirect

  \x1b[1m7. OG Card Preview\x1b[0m
     → Open: http://localhost:3000/api/og?title=Dior%20Sauvage&brand=Dior&rating=4.5&accords=Aromatic,Fresh
     → See branded social card image with perfume info

  \x1b[1m8. Security Verification\x1b[0m
     → In .env, set SUBSCRIPTION_SECRET= (empty)
     → Restart server → POST to /api/recommend
     → Should get HTTP 500 "Server configuration error" (NOT a fallback)

  \x1b[1m9. Jest Tests\x1b[0m
     → Run: \x1b[1mnpm test\x1b[0m
     → All 28 tests should pass (auth, usage, rate-limit)

  \x1b[1m10. SEO Build (expanded)\x1b[0m
      → Run: \x1b[1mnpm run build\x1b[0m
      → Should generate ~2000 perfume pages + brands + notes
      → Check: public/perfumes/ has many more subdirectories
`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
