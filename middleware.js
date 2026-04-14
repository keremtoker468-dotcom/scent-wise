// Vercel Edge Middleware — runs at CDN edge before serverless functions.
// Provides DDoS protection, bot blocking, and global rate limiting.
// Uses in-memory counters per edge region (not perfectly global, but very fast).

// --- Configuration ---
const GLOBAL_RATE_LIMIT = 120;        // Max requests per IP per window
const GLOBAL_WINDOW_MS = 60_000;      // 1-minute sliding window
const API_RATE_LIMIT = 60;            // Stricter limit for /api/* routes
const API_WINDOW_MS = 60_000;

// Known malicious/scanner User-Agent patterns
const BAD_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /dirbuster/i, /gobuster/i,
  /wpscan/i, /joomla/i, /drupal/i, /nuclei/i, /zgrab/i,
  /(?:python-requests|python-urllib|aiohttp)\/?\d/i,
  /scrapy/i, /colly/i, /phantomjs/i, /headlesschrome/i,
  /ahrefsbot/i, /semrushbot/i, /dotbot/i, /mj12bot/i
];

// Google & legitimate bot User-Agents that must NEVER be blocked
const GOOD_BOT_PATTERNS = [
  /googlebot/i, /adsbot-google/i, /mediapartners-google/i, /google-inspectiontool/i,
  /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i, /yandexbot/i,
  /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i, /whatsapp/i,
  /telegrambot/i, /discordbot/i, /slackbot/i,
  /vercel/i, /uptime/i, /pingdom/i, /uptimerobot/i
];

// Paths that should always pass through without any middleware processing
const BYPASS_PATHS = [
  /^\/ads\.txt$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/llms\.txt$/,
  /^\/llms-full\.txt$/,
  /^\/manifest\.json$/,
  /^\/\.well-known\//
];

// Paths that should never be rate-limited aggressively (static assets)
const STATIC_PATTERNS = [
  /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|webp|avif|txt|xml|json)$/,
  /^\/_vercel\//,
  /^\/sw\.js$/
];

// --- In-memory rate limit store (per edge region) ---
const ipCounts = new Map();
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 30_000) return;
  lastCleanup = now;
  for (const [key, entry] of ipCounts) {
    if (now - entry.start > 120_000) ipCounts.delete(key);
  }
}

function checkRate(ip, prefix, max, windowMs) {
  cleanup();
  const now = Date.now();
  const key = `${prefix}:${ip}`;
  const entry = ipCounts.get(key);

  if (!entry || now - entry.start > windowMs) {
    ipCounts.set(key, { count: 1, start: now });
    return { allowed: true, remaining: max - 1 };
  }

  entry.count++;
  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: max - entry.count };
}

// --- Middleware handler ---
export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Always bypass critical crawl/verification files (ads.txt, robots.txt, sitemap, etc.)
  if (BYPASS_PATHS.some(p => p.test(pathname))) {
    return; // Pass through immediately — never block these
  }

  // Skip rate limiting for static assets
  if (STATIC_PATTERNS.some(p => p.test(pathname))) {
    return; // Pass through
  }

  const ip = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';

  const ua = request.headers.get('user-agent') || '';

  // 1. Never block legitimate bots (Google, Bing, social media crawlers, etc.)
  if (GOOD_BOT_PATTERNS.some(p => p.test(ua))) {
    return; // Always allow through
  }

  // 2. Block known malicious User-Agents (only if not a legitimate bot)
  if (ua === '' || BAD_UA_PATTERNS.some(p => p.test(ua))) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 3. Global rate limit (all non-static requests)
  const globalCheck = checkRate(ip, 'g', GLOBAL_RATE_LIMIT, GLOBAL_WINDOW_MS);
  if (!globalCheck.allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(globalCheck.retryAfter || 60)
      }
    });
  }

  // 4. Stricter rate limit for API routes
  if (pathname.startsWith('/api/')) {
    const apiCheck = checkRate(ip, 'a', API_RATE_LIMIT, API_WINDOW_MS);
    if (!apiCheck.allowed) {
      return new Response(JSON.stringify({ error: 'API rate limit exceeded. Please wait.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(apiCheck.retryAfter || 60)
        }
      });
    }
  }

  // 5. Block requests with suspiciously many query parameters (scanner behavior)
  if (url.searchParams.toString().length > 2000) {
    return new Response(JSON.stringify({ error: 'Request URI too long' }), {
      status: 414,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 6. Block common path traversal / scanner probes
  if (/\.\.|\/etc\/|\/proc\/|\.env|\.git|wp-admin|wp-login|\.php|cgi-bin|\.asp/i.test(pathname)) {
    return new Response('', { status: 404 });
  }

  // Pass through — let Vercel handle the request normally
  return;
}

// Only run middleware on relevant paths (skip all static file extensions)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|woff|woff2|ttf|webp|avif|mp4|webm)).*)'
  ]
};
