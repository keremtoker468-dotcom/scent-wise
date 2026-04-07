# Progress Log

## Iteration 1 — Webhook 401
- **Task:** Return 401 on signature failure
- **Result:** SKIP — Already implemented correctly (L45 returns 401)

## Iteration 2 — Gemini Timeout
- **Task:** Add 15s AbortController timeout
- **Result:** PASS
- **Changes:** api/recommend.js — AbortController with 15s timeout, returns 504 on timeout
- **Commit:** 7c52a64

## Iteration 3 — Error Message Leakage
- **Task:** Sanitize error messages in login.js
- **Result:** PASS
- **Changes:** Removed LEMONSQUEEZY_API_KEY from user-facing errors, removed upstream HTTP status codes
- **Commit:** 4f825e1

## Iteration 4 — Content-Type Validation
- **Task:** Validate Content-Type on all POST endpoints
- **Result:** PASS
- **Changes:** Added validateContentType() to csrf.js, applied to 7 POST endpoints (excluding webhook)
- **Commit:** b960346

## Iteration 5 — Request Body Size Limit
- **Task:** Reject oversized request bodies
- **Result:** PASS
- **Changes:** Added isBodyTooLarge() to csrf.js, 1MB default, 10MB for recommend (photos)
- **Commit:** 9665539

## Iteration 6 — Webhook Idempotency
- **Task:** Prevent duplicate webhook processing
- **Result:** PASS
- **Changes:** In-memory event dedup cache with 10min TTL, prunes at 500 entries
- **Commit:** 980d695

## Iteration 7 — Debounce
- **Task:** Add 300ms debounce to explore search
- **Result:** PASS
- **Changes:** oninput with 300ms debounce, Enter key bypasses debounce
- **Commit:** d6d1a17

## Iteration 8 — Image Cache Limit
- **Task:** Cap image cache at 200 entries
- **Result:** PASS
- **Changes:** _imgCacheKeys array tracks insertion order, FIFO eviction from both _imgCache and sessionStorage
- **Commit:** f6368a3

## Iteration 9 — Event Delegation
- **Task:** Replace inline onclick on perfume card hearts
- **Result:** PASS
- **Changes:** Heart buttons use data-heart-name/brand attributes, single delegated listener on document
- **Commit:** 84fda2c

## Iteration 10 — Fragrance Comparison
- **Task:** Build comparison feature (2-3 perfumes side by side)
- **Result:** PASS
- **Changes:** Compare button on cards, floating compare bar, full comparison overlay with notes/accords/rating
- **Commit:** a63be7e

## Iteration 11 — Collection/Wishlist
- **Task:** Persist liked fragrances to localStorage
- **Result:** PASS
- **Changes:** _saveCollection/_loadCollection with localStorage, "My Collection" section in account page
- **Commit:** fac1c6f

## Iteration 12 — PWA Shortcuts
- **Task:** Add shortcuts to manifest.json
- **Result:** PASS
- **Changes:** 3 shortcuts (Dupe Finder, Chat, Explore) + ?mode= query param handling for deep linking
- **Commit:** 860922a

## Iteration 13 — CSP Reporting
- **Task:** Add CSP violation reporting
- **Result:** PASS
- **Changes:** New /api/csp-report endpoint + report-uri directive in CSP header
- **Commit:** efaa394

## Iteration 14 — FAQ Page
- **Task:** Create SEO-optimized FAQ page
- **Result:** PASS
- **Changes:** 15 Q&A items, FAQPage schema JSON-LD, added to sitemap and blog index
- **Commit:** e0c8b8a

## Summary
- **Total tasks:** 14
- **Completed:** 13 (1 was already done)
- **Failed:** 0
- **Total commits:** 13
