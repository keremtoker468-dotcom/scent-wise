# AdSense fix report — scent-wise.com

Date: 2026-09-14 · Branch: `claude/trusting-cannon-72j6dn` · Publisher ID, ads.txt, GA4 and Lemon Squeezy wiring untouched.

## 1. What was wrong (confirmed by `scripts/content-audit.py`)

| Metric | Before | After |
|---|---|---|
| Indexable pages in sitemap (HTML) | 63 | 34 |
| Median words per page (content only, excluding nav/byline/disclosure) | 300 | 624 |
| Mean words per page | 569 | 916 |
| Pages under 400 words | 40 | 11 |
| Duplicate page pairs (8-gram Jaccard ≥ 50 %) | 55 (all `/brands/*`) | 0 |
| Pages with affiliate links and no visible disclosure | 38 | 0 |
| Pages whose "N min read" was off by more than a minute | 43 | 0 |
| Distinct bylines | "ScentWise", "ScentWise Editorial Team" | Kerem Toker (linked author page) |

Word-count distribution:

| Bucket | Before | After |
|---|---|---|
| < 400 | 40 | 11 |
| 400–799 | 11 | 8 |
| 800–1499 | 9 | 11 |
| 1500+ | 3 | 4 |

Full per-page tables: `reports/audit-before.md` (run against commit 57bab6c) and `reports/audit-after.md`.

Of the 11 remaining "thin" pages, 4 are app entry or utility pages that are not articles (`/discover.html`, `/collections.html`, `/contact.html`, `/author/kerem-toker.html`). The 7 thin articles are listed in section 5 and in `content-briefs/README.md`.

## 2. What changed, commit by commit

1. **Audit tooling** — `scripts/content-audit.py` (word counts, read-time check, byline, affiliate-without-disclosure, pairwise duplicate detection; `--live` audits the deployed site, `--public DIR` audits an old checkout), `scripts/check-links.py` (every internal link must resolve to a file, a rewrite or a redirect). Both run via `npm run audit`.
2. **/brands/ duplicates** — the 11 slug URLs were one file (`public/brands/index.html`) served through a `vercel.json` rewrite; brand names were only filled in by client-side JS. Option 1 applied: `noindex, follow` on the file, 11 URLs removed from the sitemap. Links keep working. 55 duplicate pairs → 0.
3. **Consolidation** — 20 pages removed, 2 created:
   - 12 `zodiac-*-fragrances.html` → `/blog/zodiac-fragrance-guide.html` (3,576 words, one section per sign, original text preserved, headings demoted, in-page table of contents).
   - 6 `music-*-fragrances.html` → `/blog/music-fragrance-guide.html` (1,045 words). No new AI text was written for it; it is still thin and is flagged in the briefs.
   - `best-long-lasting-perfumes.html` folded into `how-to-make-perfume-last-longer.html` as a "10 Fragrances Known for Longevity" section.
   - `trending-pistachio` and `trending-marshmallow` deleted.
   - 21 permanent redirects added to `vercel.json` (old URL → new page and `#anchor`); sitemap, RSS feed, blog index, home-page card, `llms.txt` and the related-links list in `frag-images.js` updated. Link checker: 0 broken.
4. **Read time, author, disclosure** — `scripts/build-content.js` (`npm run content`) is now the single source for every post's byline block: author link, published date, updated date (from git), read time computed at 200 wpm. It also syncs `<meta name="author">` and the Article JSON-LD (author → Person, `datePublished`, `dateModified`; adds the block where missing, e.g. the FAQ page) and injects two partials from `scripts/partials/`: the affiliate disclosure box directly under the byline on every page with affiliate links, and an author box at the end of every article. `frag-images.js` no longer injects its own runtime read time / disclosure when the static ones exist.
5. **Author identity** — `/author/kerem-toker.html` (ProfilePage + Person schema, monogram avatar, contact). Home page Organization schema gained `foundingDate` and `founder`. About page rewritten in first person: who runs the site, where the database comes from, how recommendations are generated (Gemini, grounded in the database), and how the site earns money (one-time $10, affiliate links, display ads).
6. **Incidental fix** — the home page's ItemList JSON-LD `<script>` was never closed, which made the browser swallow the Plausible `<script>` tag as JSON. Closed.
7. **Phase 2 briefs** — `content-briefs/` holds six writing briefs (see section 5). They are skeletons for Kerem's own testing, photos and prices; no article text was generated.

## 3. Remaining risks

- **Thin articles still exist.** 7 guides are under 400 words of real content. Google does not publish a threshold, but a manual reviewer opening `le-labo-santal-33-dupes` (193 words) will still see a list with no first-hand content. Finishing at least briefs 1–3 before resubmitting is strongly recommended.
- **The music guide is a merge, not a rewrite.** Six 180-word sections back to back still read as template output. It is indexable; consider `noindex` on it until it has your own content, or fold it into the About-the-app material.
- **Bylines changed retroactively.** Every guide now says "By Kerem Toker" with the original publish date. That is accurate only if you stand behind the content; the briefs are how you make it true for the important pages.
- **Redirect anchors.** The 301s point at `#aries`-style anchors. Verify after deploy that Vercel preserves the fragment in the `Location` header (`curl -I https://scent-wise.com/blog/zodiac-leo-fragrances.html`). If it strips it, the redirect still lands on the right page.
- **The build script is not run by Vercel.** There is no deploy build step (by design, see CLAUDE.md). `npm run content` must be run locally after editing a post; `npm run audit` catches a forgotten run because stated and computed read times diverge.
- **Content on /discover and /collections** is app-landing copy (~300 words). They are fine as entry pages but add nothing for a content review; leaving them indexed is a judgement call.
- **Personal details are placeholders.** The About and author pages contain `<!-- KEREM: … -->` comments where only you can add specifics (city, collection, first bottle, photo, social links). Nothing was invented, so these paragraphs are honest but generic until you fill them.

## 4. Before resubmitting: what Kerem must do by hand

1. Merge this branch and confirm the deploy succeeds (`vercel.json` now has a `redirects` block; the function count is unchanged).
2. Spot-check on the live site: one old zodiac URL redirects; `/brands/dior/` returns `noindex`; a dupe post shows the disclosure box under the byline and the author box at the end; `/author/kerem-toker.html` renders.
3. Google Search Console → Sitemaps: resubmit `sitemap.xml`. Then Removals → temporary removal for the 11 `/brands/*` URLs and, optionally, the 20 old blog URLs, so the index catches up faster than natural recrawl.
4. Fill the `<!-- KEREM: … -->` placeholders in `public/about.html` and `public/author/kerem-toker.html`. Add a real photo as `/author/kerem-toker.jpg` and swap in the `<img>` (instructions are in the HTML comment). Add social links if you have any.
5. Work through `content-briefs/` in the README order, at minimum the three dupe briefs. After each: `npm run content && npm run audit`, commit.
6. Decide on the music guide: deepen it with your own playlist-to-scent notes, or set `<meta name="robots" content="noindex, follow">` on it and drop it from the sitemap until then.
7. Re-run `python3 scripts/content-audit.py --live` against the deployed site and keep the output; it is your evidence that the site is not the one that was rejected.
8. Wait for Search Console to show the new URLs indexed and the old ones gone (typically 1–3 weeks), then resubmit AdSense. Resubmitting before the index reflects the changes risks a seventh rejection on stale crawl data.
9. Run `python3 scripts/content-audit.py` before every future content push; the exit code is non-zero when duplicates, missing disclosures or stale read times appear.
