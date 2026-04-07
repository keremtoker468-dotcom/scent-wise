# ScentWise Site Improvements — Task List

## Phase 1: Quick Backend Fixes

- [x] Webhook 401 — return 401 on signature failure instead of 200 in webhook.js
- [x] Gemini timeout — add AbortController with 15s timeout to Gemini fetch in recommend.js
- [x] Error message leakage — sanitize error messages in login.js
- [x] Content-Type validation — validate Content-Type on all POST endpoints
- [x] Request body size limit — reject oversized request bodies
- [x] Webhook idempotency — prevent duplicate webhook event processing

## Phase 2: Frontend Performance

- [x] Debounce — add 300ms debounce to search input in explore page
- [x] Image cache limit — cap sessionStorage image cache at 200 entries
- [x] Event delegation — replace inline onclick on perfume cards with delegated events

## Phase 3: New Features

- [x] Fragrance comparison — 2-3 parfum yan yana karsilastirma
- [x] Collection/Wishlist — begenilen parfumleri kaydedip listele

## Phase 4: Config & SEO

- [x] PWA shortcuts — add shortcuts to manifest.json
- [x] CSP reporting — add report-uri directive to CSP header in vercel.json
- [x] FAQ page — create SEO-optimized FAQ page
