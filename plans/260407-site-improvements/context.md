# Context — ScentWise Site Improvements

## Key Files

### Frontend
- `public/app.js` — Main SPA JS (~2600 lines)
  - `searchDB()` at L190 — perfume database search
  - `perfCard()` at L1095 — perfume card HTML rendering (inline onclick)
  - `_imgCache` at L950 — in-memory + sessionStorage image cache
  - `_likedFrags` at L342 — Set tracking liked/disliked fragrances
  - `_ss(k)`/`_ssw(k,v)` at L1326-1327 — sessionStorage helpers
  - `r_explore()` at L1787 — explore page with search input
  - `r_celeb()` at L2362 — celebrity fragrances
  - All mode pages: r_home(1534), r_chat(1837), r_photo(1925), r_zodiac(2015), r_music(2081), r_style(2151), r_dupe(2286), r_account(2408)
- `public/manifest.json` — PWA manifest (no shortcuts currently)
- `public/index.html` — SPA HTML with meta tags, CSP loaded from vercel.json

### Backend (api/)
- `api/webhook.js` — LemonSqueezy webhook handler
  - `verifySignature()` at L7 — HMAC-SHA256
  - Returns 200 on signature failure (should be 401)
  - No idempotency — processes same event twice
- `api/recommend.js` — AI recommendation endpoint
  - Gemini fetch at L148 — no timeout/AbortController
  - Usage tracking at L179-192
- `api/login.js` — Email subscription login
  - L62: leaks "LEMONSQUEEZY_API_KEY" env var name
  - L95: leaks upstream HTTP status codes
- `api/check-tier.js` — Mixed endpoint: tier check + profile CRUD
  - Profile GET at L116, POST (quiz) at L71, POST (feedback) at L98, DELETE at L57

### Config
- `vercel.json` — Security headers, CSP at L14, routing rules
