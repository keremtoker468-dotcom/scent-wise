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

## Project Structure

```
├── api/                        # Vercel serverless functions
│   ├── _lib/                   # Shared server utilities
│   │   ├── csrf.js             # CSRF protection via Origin/Referer validation
│   │   ├── owner-token.js      # Owner auth with weekly rotating HMAC tokens
│   │   ├── rate-limit.js       # Rate limiter (Upstash Redis + in-memory fallback)
│   │   └── usage.js            # Usage tracking (premium cookie-based, free IP-based via Redis)
│   ├── check-tier.js           # Check user subscription tier
│   ├── create-checkout.js      # Create Lemon Squeezy checkout session
│   ├── debug-config.js         # Debug endpoint for config verification
│   ├── login.js                # Login endpoint
│   ├── owner-auth.js           # Owner authentication
│   ├── perfumes.js             # Perfume data API
│   ├── recommend.js            # Main AI recommendation endpoint (Gemini API)
│   ├── verify-subscription.js  # Verify order via Lemon Squeezy API, set auth cookie
│   └── webhook.js              # Lemon Squeezy webhook handler (signature-verified)
├── public/                     # Static frontend files (served by Vercel)
│   ├── index.html              # Main SPA (~61KB, contains all UI)
│   ├── app.js                  # Main application JavaScript (~94KB)
│   ├── perfumes.js             # Full perfume database (~2MB, client-side search)
│   ├── perfumes-rich.js        # Extended perfume data (~1.1MB)
│   ├── sw.js                   # Service Worker (offline caching)
│   ├── manifest.json           # PWA manifest
│   ├── blog/                   # SEO blog articles (static HTML)
│   ├── privacy.html            # Privacy policy
│   ├── terms.html              # Terms of service
│   ├── refund.html             # Refund policy
│   ├── sitemap.xml             # SEO sitemap
│   ├── robots.txt              # Crawler directives
│   └── llms.txt                # LLM-friendly site description
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
- **Service Worker**: Network-first for HTML, stale-while-revalidate for assets, network-only for API calls. Cache version is `sw-v3`.

## Conventions

- All server code uses **CommonJS** (`require`/`module.exports`), not ESM.
- All crypto operations use **timing-safe comparisons** (`crypto.timingSafeEqual`).
- API endpoints return JSON and use standard HTTP status codes (400, 403, 405, 413, 429, 500).
- Cookie names: `sw_sub` (subscription), `sw_usage` (premium usage), `sw_free` (free trial usage), `sw_owner` (owner auth).
- Security headers are configured in `vercel.json` (CSP, HSTS, X-Frame-Options, etc.).
- Blog content is static HTML in `public/blog/` — no CMS or markdown pipeline.
