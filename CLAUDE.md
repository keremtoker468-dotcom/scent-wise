# CLAUDE.md — ScentWise AI

## Project Overview

ScentWise is an AI-powered fragrance advisor web application with a database of 75,000+ perfumes, 101 celebrities, and 6 AI recommendation modes. It uses a freemium model: database browsing is free, AI features require a $2.99/month subscription via Lemon Squeezy.

## Tech Stack

- **Frontend**: Single-page app — vanilla HTML/CSS/JS (no framework), served from `public/`
- **Backend**: Vercel Serverless Functions (Node.js, CommonJS), located in `api/`
- **AI**: Google Gemini 2.0 Flash API for recommendations
- **Payments**: Lemon Squeezy (subscriptions, webhooks)
- **Hosting**: Vercel
- **Rate Limiting / Free Usage Tracking**: Upstash Redis (with in-memory fallback)
- **PWA**: Service Worker (`public/sw.js`) with offline support
- **Monetization**: Amazon Associates (affiliate links), Google AdSense (display ads), CJ Affiliate (FragranceX)

## Project Structure

```
├── api/                        # Vercel serverless functions
│   ├── _lib/                   # Shared server utilities
│   │   ├── csrf.js             # CSRF protection via Origin/Referer validation
│   │   ├── owner-token.js      # Owner auth with weekly rotating HMAC tokens
│   │   ├── rate-limit.js       # Rate limiter (Upstash Redis + in-memory fallback)
│   │   ├── usage.js            # Usage tracking (premium cookie-based, free IP-based via Redis)
│   │   └── user-profile.js     # User fragrance profile storage (Upstash Redis)
│   ├── check-tier.js           # Check user subscription tier
│   ├── create-checkout.js      # Create Lemon Squeezy checkout session
│   ├── debug-config.js         # Debug endpoint for config verification
│   ├── img.js                  # Image proxy endpoint
│   ├── login.js                # Login endpoint
│   ├── owner-auth.js           # Owner authentication
│   ├── perfumes.js             # Perfume data API
│   ├── recommend.js            # Main AI recommendation endpoint (Gemini API)
│   ├── subscribe.js            # Subscription management endpoint
│   ├── unsplash.js             # Unsplash image API proxy
│   ├── verify-subscription.js  # Verify order via Lemon Squeezy API, set auth cookie
│   └── webhook.js              # Lemon Squeezy webhook handler (signature-verified)
├── public/                     # Static frontend files (served by Vercel)
│   ├── index.html              # Main SPA (~61KB, contains all UI)
│   ├── app.js                  # Main application JavaScript (~100KB)
│   ├── perfumes.js             # Full perfume database (~2MB, client-side search)
│   ├── perfumes-rich.js        # Extended perfume data (~1.1MB)
│   ├── sw.js                   # Service Worker (offline caching)
│   ├── manifest.json           # PWA manifest
│   ├── ads.txt                 # Google AdSense domain verification
│   ├── blog/                   # SEO blog articles (static HTML)
│   │   └── frag-images.js      # Shared blog script (perfume images + Amazon links)
│   ├── privacy.html            # Privacy policy
│   ├── terms.html              # Terms of service
│   ├── refund.html             # Refund policy
│   ├── sitemap.xml             # SEO sitemap
│   ├── robots.txt              # Crawler directives
│   ├── llms.txt                # LLM-friendly site description
│   └── llms-full.txt           # Extended LLM site description
├── package.json                # Project metadata (minimal — no build step)
├── vercel.json                 # Vercel config (rewrites, security headers, caching)
└── README.md                   # Deployment guide
```

## Development Commands

```bash
# Run locally (requires Vercel CLI)
vercel dev

# Deploy (happens automatically on git push to connected repo)
vercel
```

There is no build step — the frontend is plain HTML/JS served as static files.

## Environment Variables

Required in Vercel dashboard:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI features |
| `SUBSCRIPTION_SECRET` | HMAC secret for signing subscription cookies |
| `LEMONSQUEEZY_API_KEY` | Lemon Squeezy API key for order verification |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook signature verification secret |
| `LEMONSQUEEZY_STORE_ID` | Store ID for webhook/order validation |
| `LEMONSQUEEZY_PRODUCT_ID` | Product ID for order validation (default: `840512`) |
| `OWNER_KEY` | Owner authentication key (admin access) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL (optional — enables persistent rate limiting & free usage tracking) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |

## Architecture Notes

- **No framework, no build**: The frontend is a single `index.html` + `app.js` with no transpilation or bundling. Edit and deploy directly.
- **Client-side search**: The 75K perfume database is embedded in `perfumes.js` and `perfumes-rich.js`, loaded client-side for instant search with zero API cost.
- **AI features are server-side only**: All Gemini API calls go through `api/recommend.js`. The API key is never exposed to the client.
- **Auth model**: Three tiers — `owner` (HMAC token rotating weekly), `premium` (subscription cookie signed with HMAC), `free` (3 trial queries tracked by IP via Redis + in-memory + cookie).
- **Security**: CSRF via Origin/Referer validation, rate limiting per IP, timing-safe comparisons for all token verification, input validation on all endpoints.
- **Usage limits**: Premium users get 500 queries/month (cookie-based tracking). Free users get 3 trial queries (IP-tracked via Redis to prevent incognito bypass).
- **Service Worker**: Network-first for HTML, stale-while-revalidate for assets, network-only for API calls. Cache version is `sw-v5`.

## Amazon Affiliate Integration

- **Geo-targeting**: `_AMZ_GEO` in `app.js` detects browser language and routes to the nearest Amazon store (US, DE, FR, ES, IT, UK, BE).
- **OneLink**: Amazon OneLink is configured server-side for automatic redirection across 10 countries (US, FR, DE, IT, ES, UK, CA, NL, PL, SE). No client-side script needed.
- **Affiliate tags**: US `scentwise20-20`, DE `scentwisede20-21`, FR `scentwisede0e-21`, ES `scentwised09f-21`, IT `scentwisede09-21`, UK `scentwiseuk-21`, BE `scentwisebe-21`.
- **Placement**: "Shop on Amazon" buttons appear on perfume cards (`perfCard()`), AI recommendation responses (`fmt()`), celebrity fragrance lists (`r_celeb()`), and blog articles (`frag-images.js`).
- **`amazonLink(name, brand)`**: Helper function that builds a search URL with the correct regional domain and affiliate tag.

## Google AdSense

- **Publisher ID**: `ca-pub-9709272849743576`
- **ads.txt**: Located at `public/ads.txt` for domain verification.
- **CSP headers**: `vercel.json` includes `googlesyndication.com`, `doubleclick.net`, `adservice.google.com` in script-src, connect-src, img-src, and frame-src.
- **AdSense script**: Added to `index.html` and all blog HTML files.

## Conventions

- All server code uses **CommonJS** (`require`/`module.exports`), not ESM.
- All crypto operations use **timing-safe comparisons** (`crypto.timingSafeEqual`).
- API endpoints return JSON and use standard HTTP status codes (400, 403, 405, 413, 429, 500).
- Cookie names: `sw_sub` (subscription), `sw_usage` (premium usage), `sw_free` (free trial usage), `sw_owner` (owner auth).
- Security headers are configured in `vercel.json` (CSP, HSTS, X-Frame-Options, etc.).
- Blog content is static HTML in `public/blog/` — no CMS or markdown pipeline. All blog pages share `frag-images.js` for perfume card rendering and Amazon links.
