# AdSense fix report — scent-wise.com

Date: 2026-09-14 · Branch: `claude/trusting-cannon-72j6dn` · Publisher ID, ads.txt, GA4 and Lemon Squeezy wiring untouched.

## 1. What was wrong (confirmed by `scripts/content-audit.py`)

| Metric | Before | After |
|---|---|---|
| Indexable pages in sitemap (HTML) | 63 | 34 |
| Median words per page (content only, excluding nav/byline/disclosure) | 300 | 1176 |
| Mean words per page | 569 | 1243 |
| Pages under 400 words | 40 | 4 |
| Duplicate page pairs (8-gram Jaccard ≥ 50 %) | 55 (all `/brands/*`) | 0 |
| Pages with affiliate links and no visible disclosure | 38 | 0 |
| Pages whose "N min read" was off by more than a minute | 43 | 0 |
| Distinct bylines | "ScentWise", "ScentWise Editorial Team" | Kerem Toker (linked author page) |

Word-count distribution:

| Bucket | Before | After |
|---|---|---|
| < 400 | 40 | 4 |
| 400–799 | 11 | 6 |
| 800–1499 | 9 | 16 |
| 1500+ | 3 | 8 |

Full per-page tables: `reports/audit-before.md` (run against commit 57bab6c) and `reports/audit-after.md`.

The 4 remaining "thin" pages are app entry or utility pages, not articles (`/discover.html`, `/collections.html`, `/contact.html`, `/author/kerem-toker.html`). Every guide is now above 1,000 words of content.

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
7. **Phase 2 briefs** — `content-briefs/` holds six writing briefs. They are skeletons for Kerem's own testing, photos and prices.
8. **Deepening (second pass, at Kerem's request)** — the six briefed articles and the music guide were expanded with note-based material only: "which version are you copying" sections (Sauvage EDT/EDP/Parfum/Elixir, BR540 EDP/Extrait, Aventus opening vs drydown, Santal 33 EDP vs oil), note-overlap tables derived from each card's tags against the original's published structure, clone/alternative/counterfeit distinctions, how-to-sample checklists, a longevity self-measurement protocol, a genre-to-family reference and playlist method for the music guide, and 5-question FAQs with `FAQPage` schema. Each of these pages opens with a "how this list was built" note stating that it is a note-based shortlist and not a wear test, and no prices, launch years for obscure clones, or first-hand claims were added. Word counts: Santal 33 207 → 1,176; BR540 632 → 1,779; Sauvage 1,025 → 1,994; Aventus 485 → 1,499; under-$50 388 → 1,280; last-longer 845 → 1,624; music guide 1,045 → 1,676.
9. **Third pass** — the last five thin guides were deepened the same way: YSL Libre gains a version table (EDT/EDP/Intense/Le Parfum), a clone/flanker/same-family split that names Libre Le Parfum as a flanker rather than a dupe, a note-overlap table and FAQ; date night gains an occasion-matching table, a base-note explainer and application advice; vanilla gains vanillin vs absolute, how vanilla behaves as a base note, a five-family table and FAQ; oud gains a spectrum table, regional styles, how to read "oud" on a label, a beginner's path and the rose-oud pairing; summer gains a five-style table, why fresh notes fade, a concentration-in-heat table and mistakes to avoid. Word counts: Libre 218 → 1,232; date night 239 → 1,126; vanilla 268 → 1,100; oud 339 → 1,288; summer 371 → 1,243. All 15 guides that carry fragrance lists now have FAQPage schema.
10. **Placeholders filled** — the `KEREM:` comments on the About and author pages were replaced with text based only on what is known (founder, started 2025, runs it alone, loves perfume). No city, collection size, first bottle or photo was invented; the author page keeps a monogram avatar until a photo is added.

## 3. Remaining risks

- **No thin articles remain.** Every guide is above 1,000 words of content; the four sub-400 pages are app and utility pages.
- **The deepened pages are note-based, and say so.** The new sections add real comparison value, but they are still written from published note pyramids rather than from wear tests. A reviewer will see honest labelling, not first-hand experience. The first-hand layer (your longevity tables, photos, dated prices, owned/sampled labels) is still the strongest single improvement available and is what the briefs now ask for.
- **The music guide's six genre sections are unchanged;** the new depth is in the framing, reference table and method that follow them. If it still reads as template output to you, `noindex` remains an option.
- **Bylines changed retroactively.** Every guide now says "By Kerem Toker" with the original publish date. That is accurate only if you stand behind the content; the briefs are how you make it true for the important pages.
- **Redirect anchors.** The 301s point at `#aries`-style anchors. Verify after deploy that Vercel preserves the fragment in the `Location` header (`curl -I https://scent-wise.com/blog/zodiac-leo-fragrances.html`). If it strips it, the redirect still lands on the right page.
- **The build script is not run by Vercel.** There is no deploy build step (by design, see CLAUDE.md). `npm run content` must be run locally after editing a post; `npm run audit` catches a forgotten run because stated and computed read times diverge.
- **Content on /discover and /collections** is app-landing copy (~300 words). They are fine as entry pages but add nothing for a content review; leaving them indexed is a judgement call.
- **Personal details are minimal.** The About and author pages say only what is known (founder, 2025, one person, loves perfume). Nothing was invented, so they are honest but generic; a photo, a sentence about your collection or where you are based, and social links would make them read as a real person rather than a profile template.

## 4. Before resubmitting: what Kerem must do by hand

1. The branch is merged to `main` (fast-forward). Confirm the Vercel deploy succeeds (`vercel.json` now has a `redirects` block; the function count is unchanged).
2. Spot-check on the live site: one old zodiac URL redirects; `/brands/dior/` returns `noindex`; a dupe post shows the disclosure box under the byline and the author box at the end; `/author/kerem-toker.html` renders.
3. Google Search Console → Sitemaps: resubmit `sitemap.xml`. Then Removals → temporary removal for the 11 `/brands/*` URLs and, optionally, the 20 old blog URLs, so the index catches up faster than natural recrawl.
4. Add a real photo to `/author/kerem-toker.html` (save it as `public/author/kerem-toker.jpg` and replace the `KT` avatar div with `<div class="avatar"><img src="/author/kerem-toker.jpg" alt="Kerem Toker" width="96" height="96"></div>`), and add one or two personal sentences plus social links if you have them. The same goes for `public/about.html`.
5. Add the first-hand layer the briefs in `content-briefs/` still ask for: your longevity tables, photos, dated prices and owned/sampled/not-tested labels, starting with the three dupe guides. As each page gets it, delete that page's "How this list was built" note. After each: `npm run content && npm run audit`, commit.
6. Re-read the deepened guides once as the author. They are written in your voice from published note structures; if any sentence does not match your own experience of a fragrance, change it. That read-through is the last step before the site can honestly carry your byline.
7. Re-run `python3 scripts/content-audit.py --live` against the deployed site and keep the output; it is your evidence that the site is not the one that was rejected.
8. Wait for Search Console to show the new URLs indexed and the old ones gone (typically 1–3 weeks), then resubmit AdSense. Resubmitting before the index reflects the changes risks a seventh rejection on stale crawl data.
9. Run `python3 scripts/content-audit.py` before every future content push; the exit code is non-zero when duplicates, missing disclosures or stale read times appear.
