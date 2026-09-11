# CLAUDE.md — ScentWise AI

## Project Overview

ScentWise is an AI-powered fragrance advisor web application with a database of 65,000+ perfumes, 101 celebrities, and 6 AI recommendation modes. It uses a freemium model: database browsing is free, AI features require a one-time $10 purchase (lifetime access) via Lemon Squeezy.

## Tech Stack

- **Frontend**: Single-page app — vanilla HTML/CSS/JS (no framework), served from `public/`
- **Backend**: Vercel Serverless Functions (Node.js, CommonJS), located in `api/`
- **AI**: Google Gemini 2.0 Flash API for recommendations
- **Payments**: Lemon Squeezy (one-time purchase, webhooks)
- **Hosting**: Vercel
- **Rate Limiting / Free Usage Tracking**: Upstash Redis (with in-memory fallback)
- **PWA**: Service Worker (`public/sw.js`) with offline support
- **Monetization**: Amazon Associates (affiliate links), Google AdSense (display ads), CJ Affiliate (FragranceX)

## Project Structure

```
├── api/                        # Vercel serverless functions
│   ├── _lib/                   # Shared server utilities
│   │   ├── csrf.js             # CSRF protection via Origin/Referer validation
│   │   ├── ga4.js              # GA4 Measurement Protocol + Google Ads click-id store
│   │   ├── owner-token.js      # Owner auth with weekly rotating HMAC tokens
│   │   ├── rate-limit.js       # Rate limiter (Upstash Redis + in-memory fallback)
│   │   ├── usage.js            # Usage tracking (premium cookie-based, free IP-based via Redis)
│   │   └── user-profile.js     # User fragrance profile storage (Upstash Redis)
│   ├── check-tier.js           # Check user subscription tier
│   ├── create-checkout.js      # Create Lemon Squeezy checkout session
│   ├── debug-config.js         # Debug endpoint for config verification
│   ├── img.js                  # Image proxy endpoint
│   ├── login.js                # Login endpoint
│   ├── owner-auth.js           # Owner auth + conversion CSV export + GA4 wiring diagnostic
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
| `GA4_MEASUREMENT_ID` | GA4 measurement ID (`G-769WY8EYH6`) — enables server-side purchase tracking |
| `GA4_API_SECRET` | GA4 Measurement Protocol API secret (Admin → Data Streams → Measurement Protocol API secrets) |
| `GA4_DEBUG` | Optional — set to `1` to send events to GA4's validation endpoint and log the response |
| `GOOGLE_ADS_CONVERSION_NAME` | Optional — conversion action name used in the offline-conversion CSV (default: `ScentWise Purchase`) |

## Architecture Notes

- **No framework, no build**: The frontend is a single `index.html` + `app.js` with no transpilation or bundling. Edit and deploy directly.
- **Client-side search**: The 65K perfume database is embedded in `perfumes.js` and `perfumes-rich.js`, loaded client-side for instant search with zero API cost.
- **AI features are server-side only**: All Gemini API calls go through `api/recommend.js`. The API key is never exposed to the client.
- **Auth model**: Three tiers — `owner` (HMAC token rotating weekly), `premium` (one-time purchase; access cookie signed with HMAC), `free` (up to 3 trial queries tracked by device ID + IP via Redis + in-memory + cookie). Query 1 is a full response; queries 2-3 require email capture (stored in Redis + `sw_email` HMAC cookie) — otherwise the client only shows the first two picks and blurs the rest.
- **Security**: CSRF via Origin/Referer validation, rate limiting per IP, timing-safe comparisons for all token verification, input validation on all endpoints.
- **Usage limits**: Premium users get 500 queries/month (cookie-based tracking). Free users get up to 3 trial queries (device + IP-tracked via Redis to prevent incognito bypass). Pre-email queries after #1 return a `teaser` flag; the client blurs items past the first two picks until the user submits their email.
- **Service Worker**: Network-first for HTML, stale-while-revalidate for assets, network-only for API calls. Cache version is `sw-v5`.

## Amazon Affiliate Integration

- **Geo-targeting**: `_AMZ_GEO` in `app.js` detects browser language and routes to the nearest Amazon store (US, DE, FR, ES, IT, UK, BE).
- **OneLink**: Amazon OneLink is configured server-side for automatic redirection across 10 countries (US, FR, DE, IT, ES, UK, CA, NL, PL, SE). No client-side script needed.
- **Affiliate tags**: US `scentwise20-20`, DE `scentwisede20-21`, FR `scentwisede0e-21`, ES `scentwised09f-21`, IT `scentwisede09-21`, UK `scentwiseuk-21`, BE `scentwisebe-21`.
- **Placement**: "Shop on Amazon" buttons appear on perfume cards (`perfCard()`), AI recommendation responses (`fmt()`), celebrity fragrance lists (`r_celeb()`), and blog articles (`frag-images.js`).
- **`amazonLink(name, brand)`**: Helper function that builds a search URL with the correct regional domain and affiliate tag.

## Conversion Tracking (GA4 + Google Ads)

Checkout completes on Lemon Squeezy's domain, so the browser never sees the purchase:
ad blockers, closed tabs and mobile app switches lose a client-side event. `purchase` is
therefore reported **server-side only**, from the Lemon Squeezy webhook. Never add a
client-side `purchase` event back — two sources double-count revenue and Ads conversions.

The flow:

1. **Landing** — `captureClickId()` in `app.js` stores `gclid` / `wbraid` / `gbraid` in
   `localStorage` under `sw_click_id` (first touch wins, 90-day TTL).
2. **Checkout** — `checkout()` posts that click ID plus the GA4 `client_id` and `session_id`
   read from the `_ga` / `_ga_<stream>` cookies and the banner's ads-consent state.
   `api/create-checkout.js` re-validates all of it (falling back to the request cookies) and
   passes it as Lemon Squeezy `checkout_data.custom`.
3. **Webhook** — `order_created` sends a GA4 `purchase` via the Measurement Protocol
   (`api/_lib/ga4.js`). The `client_id`/`session_id` are what let GA4 credit the sale to the
   original session, and so to the Google Ads click. `order_refunded` sends a `refund`.
   A Redis `SET NX` guard makes webhook retries idempotent across serverless instances.
4. **Fallback** — the click ID is kept in Redis for 90 days. Sales GA4 could not attribute
   (cookies cleared, paid on another device) can be recovered from
   `GET /api/owner-auth?export=conversions` (owner cookie required) as a Google Ads
   offline-conversion CSV; add `&format=json` to see the raw records. Refunded orders drop
   out of that list.

**Verifying the wiring:** `GET /api/owner-auth?ga4ping=1` (owner cookie required) makes the
deployment send a throwaway `server_ping` to GA4 with its own `GA4_MEASUREMENT_ID` /
`GA4_API_SECRET`, and returns Google's validation response verbatim. Use it after changing
either variable — a secret that works from a laptop proves nothing about the one stored in
Vercel. It never sends a `purchase`, so checking the wiring cannot invent revenue in the
reports Google Ads bids on. Note that GA4 answers 204 to events signed with a wrong secret,
so `accepted: true` is not the proof: the event appearing in GA4 Realtime is.

Consent Mode v2 defaults to denied, so the Measurement Protocol event carries
`ad_user_data`/`ad_personalization` from the banner state and sets `non_personalized_ads`
unless the buyer accepted ads cookies.

**Dashboard setup (one-time):**
1. GA4 → Admin → Data Streams → the ScentWise stream → Measurement Protocol API secrets →
   create one → set `GA4_API_SECRET` (and `GA4_MEASUREMENT_ID`) in Vercel.
2. Lemon Squeezy → Settings → Webhooks: the endpoint must include the `order_created` and
   `order_refunded` events.
3. Make a test purchase in LS test mode and watch `purchase` land in GA4 Realtime
   (set `GA4_DEBUG=1` first if it does not — the validation endpoint says why).
4. GA4 → Admin → Key events → mark `purchase` as a key event.
5. Google Ads → Goals → Conversions → New conversion action → Import → GA4 → Web →
   import `purchase`, then switch the campaign's conversion goal from `begin_checkout`.

## Google AdSense

- **Publisher ID**: `ca-pub-9709272849743576`
- **ads.txt**: Located at `public/ads.txt` for domain verification.
- **CSP headers**: `vercel.json` includes `googlesyndication.com`, `doubleclick.net`, `adservice.google.com` in script-src, connect-src, img-src, and frame-src.
- **AdSense script**: Added to `index.html` and all blog HTML files.

## Conventions

- All server code uses **CommonJS** (`require`/`module.exports`), not ESM.
- **The Hobby plan allows 12 Serverless Functions per deployment and `api/` is at exactly 12.**
  Adding a new `api/*.js` file fails the deploy with `exceeded_serverless_functions_per_deployment`
  (the build succeeds, then the deploy step rejects it), so add new endpoints as a method or
  `?action=` branch on an existing function instead.
- All crypto operations use **timing-safe comparisons** (`crypto.timingSafeEqual`).
- API endpoints return JSON and use standard HTTP status codes (400, 403, 405, 413, 429, 500).
- Cookie names: `sw_sub` (subscription), `sw_usage` (premium usage), `sw_free` (free trial usage), `sw_device` (device-bound free trial ID), `sw_email` (email-gate unlock flag), `sw_owner` (owner auth).
- `localStorage` keys: `sw_cookie_consent` (banner choice), `sw_click_id` (first-touch Google Ads click ID).
- Bump the `?v=` query on `/app.js` in `index.html` whenever `app.js` changes — that string is the cache key.
- Security headers are configured in `vercel.json` (CSP, HSTS, X-Frame-Options, etc.).
- Blog content is static HTML in `public/blog/` — no CMS or markdown pipeline. All blog pages share `frag-images.js` for perfume card rendering and Amazon links.
