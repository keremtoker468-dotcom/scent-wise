---
name: seo-audit
description: When the user wants to audit, review, or diagnose SEO issues on their site. Also use when the user mentions "SEO audit," "technical SEO," "why am I not ranking," "SEO issues," "on-page SEO," "meta tags review," "SEO health check," "Core Web Vitals," "structured data," "schema markup," "Open Graph tags," or "page speed." For building pages at scale to target keywords, see programmatic-seo. For adding structured data, see schema-markup.
metadata:
  version: 1.1.0
---

# SEO Audit

You are an expert in search engine optimization. Your goal is to identify SEO issues and provide actionable recommendations to improve organic search performance.

## Initial Assessment

**Check for product marketing context first:**
If `.claude/product-marketing-context.md` exists, read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Before auditing, understand:

1. **Site Context**
   - What type of site? (SaaS, e-commerce, blog, local business, etc.)
   - What's the primary business goal for SEO?
   - What keywords/topics are priorities?

2. **Current State**
   - Any known issues or concerns?
   - Current organic traffic level?
   - Recent changes or migrations?

3. **Scope**
   - Full site audit or specific pages?
   - Technical + on-page, or one focus area?
   - Access to Search Console / analytics?

---

## Audit Framework

### Important: Schema Markup Detection Limitation

**`web_fetch` and `curl` cannot reliably detect structured data / schema markup.**

Many CMS plugins (AIOSEO, Yoast, RankMath) inject JSON-LD via client-side JavaScript -- it will not appear in static HTML or `web_fetch` output (which strips `<script>` tags during conversion).

**To accurately check for schema markup, use one of these methods:**
1. **Browser tool** -- render the page and run: `document.querySelectorAll('script[type="application/ld+json"]')`
2. **Google Rich Results Test** -- https://search.google.com/test/rich-results
3. **Screaming Frog export** -- if the client provides one, use it (SF renders JavaScript)

**Never report "no schema found" based solely on `web_fetch` or `curl`.** This has led to false audit findings in production.

### Priority Order

1. **Crawlability & Indexation** (can Google find and index it?)
2. **Technical Foundations** (is the site fast and functional?)
3. **On-Page Optimization** (is content optimized?)
4. **Structured Data & Social Markup** (is content machine-readable and shareable?)
5. **Content Quality** (does it deserve to rank?)
6. **Accessibility & SEO Overlap** (does it meet shared standards?)
7. **Authority & Links** (does it have credibility?)

---

## Technical SEO Audit

### Crawlability

**Robots.txt**
- Check for unintentional blocks
- Verify important pages allowed
- Check sitemap reference
- Validate syntax (no malformed directives)
- Verify `User-agent` specificity (wildcard vs. Googlebot vs. others)
- Check for `Crawl-delay` directives (not respected by Googlebot, but may affect other bots)

**XML Sitemap**
- Exists and accessible at `/sitemap.xml` or referenced in robots.txt
- Submitted to Google Search Console and Bing Webmaster Tools
- Contains only canonical, indexable URLs (no noindexed, redirected, or 404 pages)
- Updated regularly (check `<lastmod>` dates for accuracy)
- Proper formatting and valid XML
- Under 50MB uncompressed / 50,000 URLs per sitemap file
- Sitemap index used for larger sites
- Includes hreflang references if applicable
- Does not include URLs blocked by robots.txt

**Site Architecture**
- Important pages within 3 clicks of homepage
- Logical hierarchy
- Internal linking structure
- No orphan pages
- Breadcrumb navigation present

**Crawl Budget Issues** (for large sites)
- Parameterized URLs under control
- Faceted navigation handled properly
- Infinite scroll with pagination fallback
- Session IDs not in URLs

### Indexation

**Index Status**
- `site:domain.com` check
- Search Console coverage report
- Compare indexed vs. expected page count

**Indexation Issues**
- Noindex tags on important pages
- Canonicals pointing wrong direction
- Redirect chains/loops
- Soft 404s
- Duplicate content without canonicals

**Canonicalization**
- All pages have canonical tags
- Self-referencing canonicals on unique pages
- HTTP to HTTPS canonicals
- www vs. non-www consistency
- Trailing slash consistency
- Pagination pages canonicalized correctly (rel="next"/"prev" deprecated but canonical still matters)

### Site Speed & Core Web Vitals

**Core Web Vitals (2024+ thresholds)**
- **LCP (Largest Contentful Paint):** < 2.5s (Good), 2.5-4.0s (Needs Improvement), > 4.0s (Poor)
- **INP (Interaction to Next Paint):** < 200ms (Good), 200-500ms (Needs Improvement), > 500ms (Poor)
- **CLS (Cumulative Layout Shift):** < 0.1 (Good), 0.1-0.25 (Needs Improvement), > 0.25 (Poor)

**LCP Optimization Checklist**
- Eliminate render-blocking resources (CSS, JS)
- Preload LCP image or resource (`<link rel="preload">`)
- Optimize server response time (TTFB < 800ms)
- Use CDN for static assets
- Optimize and compress images (WebP/AVIF)
- Inline critical CSS
- Remove unused CSS and JavaScript
- Use `fetchpriority="high"` on LCP element

**INP Optimization Checklist**
- Minimize main thread blocking time
- Break up long tasks (> 50ms)
- Use `requestIdleCallback` for non-critical work
- Optimize event handlers
- Defer non-critical third-party scripts
- Use web workers for heavy computation

**CLS Optimization Checklist**
- Set explicit `width` and `height` on images and video
- Reserve space for ads and embeds
- Avoid inserting content above existing content
- Use `font-display: swap` or `font-display: optional`
- Preload web fonts
- Use CSS `contain` property where applicable

**Additional Speed Factors**
- Server response time (TTFB)
- Image optimization and modern formats
- JavaScript bundle size and execution time
- CSS delivery (critical vs. deferred)
- Caching headers (Cache-Control, ETag)
- CDN usage and configuration
- Font loading strategy
- HTTP/2 or HTTP/3 enabled
- Gzip/Brotli compression enabled
- Resource hints (`preconnect`, `prefetch`, `preload`)

**Tools**
- PageSpeed Insights (lab + field data)
- WebPageTest (detailed waterfall)
- Chrome DevTools Performance panel
- Search Console Core Web Vitals report (field data)
- Chrome UX Report (CrUX) for real-user data

### Mobile-Friendliness

- Responsive design (not separate m. site)
- Viewport meta tag configured (`<meta name="viewport" content="width=device-width, initial-scale=1">`)
- Tap target sizes (minimum 48x48 CSS pixels with 8px spacing)
- No horizontal scroll
- Font sizes legible without zooming (minimum 16px base)
- Same content as desktop (mobile-first indexing)
- Touch-friendly navigation (no hover-dependent menus)
- No intrusive interstitials (Google penalty since 2017)
- Responsive images with `srcset` and `sizes` attributes
- Test on real devices, not just emulators

### Security & HTTPS

- HTTPS across entire site
- Valid SSL certificate (not expired, correct domain)
- No mixed content (HTTP resources on HTTPS pages)
- HTTP to HTTPS 301 redirects
- HSTS header implemented
- Security headers (X-Content-Type-Options, X-Frame-Options, CSP)

### URL Structure

- Readable, descriptive URLs
- Keywords in URLs where natural
- Consistent structure across site sections
- No unnecessary parameters or session IDs
- Lowercase and hyphen-separated
- Reasonable depth (avoid /a/b/c/d/e/f/page)
- No special characters or spaces (encoded as %20)
- Trailing slash policy consistent

---

## On-Page SEO Audit

### Title Tags

**Check for:**
- Unique titles for each page
- Primary keyword near beginning
- 50-60 characters (visible in SERP without truncation)
- Compelling and click-worthy (drives CTR)
- Brand name placement (end, separated by ` | ` or ` - `)

**Common issues:**
- Duplicate titles across pages
- Too long (truncated in SERPs, typically after ~60 characters)
- Too short (wasted ranking opportunity)
- Keyword stuffing
- Missing entirely
- Boilerplate/template titles not customized

### Meta Descriptions

**Check for:**
- Unique descriptions per page
- 150-160 characters (Google may truncate beyond this)
- Includes primary keyword (bolded in SERPs when matching query)
- Clear value proposition
- Call to action where appropriate
- Matches search intent

**Common issues:**
- Duplicate descriptions across pages
- Auto-generated or CMS default descriptions
- Too long (truncated) or too short (wasted space)
- No compelling reason to click
- Missing entirely (Google will auto-generate, often poorly)

### Heading Structure

**Check for:**
- One H1 per page (should be unique and contain primary keyword)
- Logical hierarchy (H1 > H2 > H3, no skipped levels)
- Headings accurately describe the content that follows
- Secondary keywords in H2s where natural
- Headings are not used purely for visual styling

**Common issues:**
- Multiple H1s on a page
- Skipped heading levels (H1 directly to H3)
- Headings used for styling only (use CSS instead)
- No H1 on page
- H1 is the site logo or generic text

### Content Optimization

**Primary Page Content**
- Keyword in first 100 words
- Related keywords (LSI terms) naturally used
- Sufficient depth/length for topic and search intent
- Answers the searcher's query directly
- Better, more comprehensive, or more current than competitors
- Unique value (original data, insights, perspective)

**Thin Content Issues**
- Pages with little unique content
- Tag/category pages with no added value
- Doorway pages (similar pages targeting nearby keywords)
- Duplicate or near-duplicate content
- Auto-generated content with no editorial value

### Image Optimization

**File & Format**
- Descriptive, keyword-relevant file names (e.g., `blue-running-shoes.webp`, not `IMG_4532.jpg`)
- Modern formats: WebP (broad support) or AVIF (better compression, growing support)
- Appropriate compression level (balance quality vs. file size)
- Correctly sized images (do not serve 2000px images in 400px containers)

**Alt Text**
- Present on all meaningful images
- Descriptive of the image content (not keyword-stuffed)
- Conveys meaning for screen readers (accessibility overlap)
- Decorative images use empty alt (`alt=""`) so screen readers skip them
- Primary keyword included naturally where it accurately describes the image

**Performance**
- Lazy loading implemented (`loading="lazy"`) for below-the-fold images
- LCP image is NOT lazy loaded (use `loading="eager"` or omit the attribute)
- Responsive images with `srcset` and `sizes` attributes
- `width` and `height` attributes set to prevent CLS
- Consider `fetchpriority="high"` for hero/LCP images
- Use `<picture>` element for art direction or format fallbacks

**Additional**
- Image sitemap or images included in XML sitemap
- Proper use of `<figure>` and `<figcaption>` for SEO and accessibility
- No broken image links (404s)
- CDN serving for images

### Internal Linking

**Check for:**
- Important pages well-linked from related content
- Descriptive, keyword-rich anchor text (not "click here")
- Logical link relationships that help users and crawlers
- No broken internal links
- Reasonable link count per page (no hard limit, but diminishing returns)
- Contextual links within body content (stronger signal than nav/footer links)

**Common issues:**
- Orphan pages (no internal links pointing to them)
- Over-optimized anchor text (exact-match keyword on every link)
- Important pages buried deep in the site architecture
- Excessive footer/sidebar links diluting link equity
- Nofollow on internal links (wastes crawl budget, does not preserve PageRank)

### Keyword Targeting

**Per Page**
- Clear primary keyword target
- Title, H1, and URL aligned with target keyword
- Content satisfies search intent (informational, navigational, transactional, commercial)
- Not competing with other pages on the same site (keyword cannibalization)

**Site-Wide**
- Keyword mapping document exists (URL to keyword assignment)
- No major keyword gaps in coverage
- No keyword cannibalization (multiple pages targeting same term)
- Logical topical clusters with pillar pages and supporting content
- Content hub strategy connecting related topics

---

## Structured Data / Schema.org Markup

### Detection (Important Caveats)

- **Never rely solely on `web_fetch` or `curl`** for schema detection (see warning above)
- Use Google Rich Results Test, Schema Markup Validator, or browser DevTools
- Check for JSON-LD (preferred by Google), Microdata, and RDFa

### Required Schema by Page Type

**All Pages**
- `Organization` or `LocalBusiness` on homepage
- `WebSite` with `SearchAction` (sitelinks search box)
- `BreadcrumbList` on pages with breadcrumb navigation

**Articles / Blog Posts**
- `Article`, `NewsArticle`, or `BlogPosting`
- Include `author`, `datePublished`, `dateModified`, `headline`, `image`
- `author` should reference a `Person` or `Organization` with a profile URL

**Product Pages**
- `Product` with `name`, `image`, `description`
- `Offer` with `price`, `priceCurrency`, `availability`
- `AggregateRating` and `Review` if reviews exist

**E-commerce Category Pages**
- `ItemList` with product references
- `CollectionPage` type

**Local Business**
- `LocalBusiness` (or more specific subtype)
- `address`, `telephone`, `openingHours`, `geo`
- `areaServed` for service-area businesses

**FAQ Pages**
- `FAQPage` with `Question` and `Answer` pairs
- Note: Google restricted FAQ rich results in August 2023 to government and health sites only

**How-To Content**
- `HowTo` with `step` items
- Note: Google removed HowTo rich results from search in September 2023

**Events**
- `Event` with `startDate`, `location`, `name`, `offers`

**Recipes**
- `Recipe` with `cookTime`, `ingredients`, `nutrition`

### Schema Validation Checklist

- Valid JSON-LD syntax (no trailing commas, proper escaping)
- Required properties present for each type
- No deprecated types (check Google's current supported list)
- URLs are absolute, not relative
- Images referenced in schema are crawlable
- `@context` is `https://schema.org`
- Test with: Google Rich Results Test, Schema.org Validator
- Monitor in Search Console > Enhancements for errors/warnings

### Common Schema Issues

- Missing required fields (Google will not show rich results)
- Schema content does not match visible page content (cloaking risk)
- Duplicate schema types on the same page
- Using deprecated or unsupported types
- JSON-LD syntax errors (invalid JSON)
- Schema only on homepage, not on individual pages

---

## Open Graph & Social Media Meta Tags

### Open Graph (Facebook, LinkedIn, and most platforms)

**Required tags:**
```html
<meta property="og:title" content="Page Title">
<meta property="og:description" content="Page description">
<meta property="og:image" content="https://example.com/image.jpg">
<meta property="og:url" content="https://example.com/page">
<meta property="og:type" content="website">
```

**Check for:**
- `og:title` -- compelling, may differ from `<title>` for social optimization
- `og:description` -- concise summary, 2-4 sentences
- `og:image` -- minimum 1200x630px, ratio 1.91:1; must be absolute URL
- `og:url` -- canonical URL of the page
- `og:type` -- `website`, `article`, `product`, etc.
- `og:site_name` -- brand/site name
- `og:locale` -- language/region (e.g., `en_US`)

**For articles specifically:**
- `article:published_time`
- `article:modified_time`
- `article:author`
- `article:section`
- `article:tag`

### Twitter Cards

**Required tags:**
```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Page Title">
<meta name="twitter:description" content="Page description">
<meta name="twitter:image" content="https://example.com/image.jpg">
```

**Check for:**
- `twitter:card` -- `summary`, `summary_large_image`, `app`, or `player`
- `twitter:site` -- @username of the site
- `twitter:creator` -- @username of the content creator
- Image meets minimum dimensions (summary_large_image: 1200x628px)

### Validation & Common Issues

- Test with Facebook Sharing Debugger (https://developers.facebook.com/tools/debug/)
- Test with Twitter Card Validator
- Test with LinkedIn Post Inspector (https://www.linkedin.com/post-inspector/)
- Images must be publicly accessible (not behind auth or robots.txt blocks)
- Ensure OG tags are in the `<head>`, not in the `<body>`
- Missing OG image is the most common issue (causes blank previews on social shares)
- OG tags must use absolute URLs, not relative paths
- Each page should have unique OG tags (not site-wide defaults on every page)

---

## Accessibility & SEO Overlap

Many accessibility best practices directly improve SEO. Audit for these shared concerns:

### Semantic HTML

- Proper heading hierarchy (H1-H6) -- helps both screen readers and search engines
- Use of `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<footer>` landmarks
- Lists use `<ul>`, `<ol>`, `<li>` (not divs styled as lists)
- Tables use `<th>`, `<caption>`, and `scope` attributes
- Links use `<a>` tags (not divs with click handlers)
- Buttons use `<button>` tags (not styled spans)

### Image Accessibility (directly impacts SEO)

- All meaningful images have descriptive `alt` text
- Decorative images use `alt=""` (empty alt)
- Complex images (charts, infographics) have extended descriptions
- Alt text is concise and descriptive, not keyword-stuffed

### Link Accessibility

- Link text is descriptive (avoid "click here," "read more," "learn more")
- Links are visually distinguishable from surrounding text
- Links to external sites or downloads indicate this to users
- No empty links (anchor tags with no text or aria-label)

### Content Accessibility

- Sufficient color contrast ratios (WCAG AA: 4.5:1 for normal text, 3:1 for large text)
- Text is resizable without breaking layout
- Content is readable without CSS (logical document order)
- Language is declared (`<html lang="en">`) -- helps search engines determine page language
- Reading level is appropriate for the audience

### Keyboard & Focus

- All interactive elements are keyboard-accessible
- Visible focus indicators on interactive elements
- Skip navigation links present
- No keyboard traps

### Multimedia

- Videos have captions/transcripts (provides crawlable text content for SEO)
- Audio content has transcripts
- Auto-playing media can be paused

### ARIA & Structured Content

- ARIA landmarks supplement (not replace) semantic HTML
- `aria-label` and `aria-describedby` used appropriately
- Form inputs have associated `<label>` elements
- Error messages are programmatically associated with form fields

### Why This Matters for SEO

- Google uses accessibility signals as part of page experience
- Semantic HTML helps Googlebot understand page structure
- Alt text is a direct ranking factor for image search
- Transcripts and captions provide additional crawlable content
- Better accessibility = better user experience = better engagement metrics
- Core Web Vitals overlap: CLS, INP, and LCP all affect both accessibility and SEO

### Tools

- Lighthouse Accessibility audit (Chrome DevTools)
- axe DevTools browser extension
- WAVE Web Accessibility Evaluation Tool
- Pa11y (CLI tool for automated testing)

---

## Content Quality Assessment

### E-E-A-T Signals

**Experience**
- First-hand experience demonstrated
- Original insights, data, or research
- Real examples and case studies
- Personal perspective where relevant

**Expertise**
- Author credentials visible (author bio, links to profiles)
- Accurate, detailed information
- Properly sourced claims (outbound links to authoritative sources)
- Technical depth appropriate for the topic

**Authoritativeness**
- Recognized in the space
- Cited by others
- Industry credentials or awards
- Author pages with full bios

**Trustworthiness**
- Accurate, verifiable information
- Transparent about business (About page, team page)
- Contact information available
- Privacy policy, terms of service
- Secure site (HTTPS)
- Clear editorial policy or content review process

### Content Depth

- Comprehensive coverage of topic
- Answers follow-up questions proactively
- Better, more current, or more detailed than top-ranking competitors
- Updated regularly (show `dateModified` in schema)
- Includes unique data, original research, or expert quotes

### User Engagement Signals

- Time on page relative to content length
- Bounce rate in context of page intent
- Pages per session
- Return visits
- Scroll depth

---

## Sitemap & Robots.txt Review

### Robots.txt Detailed Audit

**Location & Accessibility**
- File exists at `/robots.txt` (root domain only)
- Returns 200 status code (not 404 or 500)
- File size under 500KB (Google's limit)
- UTF-8 encoded

**Directive Review**
- No accidental `Disallow: /` blocking entire site
- CSS and JS files are not blocked (Googlebot needs to render pages)
- Admin/login pages appropriately blocked
- Search result pages blocked (avoid duplicate content)
- Staging or development paths blocked
- API endpoints blocked if not meant for indexing
- Query parameter variations handled

**Sitemap Reference**
- `Sitemap:` directive present pointing to XML sitemap
- URL is absolute (full `https://` path)
- Sitemap URL is accessible and returns 200

**Common Robots.txt Mistakes**
- Blocking CSS/JS (breaks rendering for Googlebot)
- Blocking images needed for page understanding
- Trailing whitespace in directives causing misinterpretation
- Using `Disallow` to "noindex" (it prevents crawling, not indexing -- pages can still appear in SERPs)
- Forgetting that robots.txt is publicly readable (do not expose sensitive URL patterns)

### XML Sitemap Detailed Audit

**Structure**
- Valid XML syntax
- Proper namespace declaration (`xmlns`)
- Sitemap index if multiple sitemaps needed
- One sitemap per content type for large sites (posts, pages, products, categories)

**Content Quality**
- All URLs return 200 status codes
- No redirected URLs (3xx)
- No noindexed URLs
- No URLs blocked by robots.txt
- No duplicate URLs
- `<lastmod>` dates are accurate (not all set to today)
- `<changefreq>` and `<priority>` present (optional, mostly ignored by Google, but shows intent)

**Coverage**
- All important pages are included
- New content appears promptly
- Removed content is cleaned up
- Matches canonical URLs (not alternate versions)

---

## Page Speed Analysis

### Measurement Strategy

**Lab Data** (controlled, reproducible)
- Lighthouse in Chrome DevTools
- PageSpeed Insights
- WebPageTest (multi-location testing)

**Field Data** (real users, most important for rankings)
- Chrome UX Report (CrUX) via PageSpeed Insights
- Search Console Core Web Vitals report
- Real User Monitoring (RUM) if implemented

### Performance Budget

Recommend establishing budgets:
- Total page weight: < 2MB (ideally < 1MB)
- JavaScript total: < 300KB compressed
- CSS total: < 100KB compressed
- Largest image: < 200KB
- Total requests: < 50
- Time to Interactive: < 3.5s on 4G

### Critical Rendering Path

**Audit checklist:**
- Critical CSS inlined in `<head>`
- Non-critical CSS loaded asynchronously
- JavaScript deferred or async where possible
- Above-the-fold content renders without waiting for full page load
- No render-blocking third-party scripts in `<head>`
- Fonts preloaded or using `font-display: swap`

### Third-Party Script Impact

- Audit all third-party scripts (analytics, ads, widgets, chat, A/B testing)
- Measure individual impact of each third-party script
- Defer non-essential third-party scripts
- Consider self-hosting critical third-party resources
- Use `async` or `defer` attributes
- Implement Content Security Policy to control third-party loading

### Server & Infrastructure

- TTFB (Time to First Byte) < 800ms
- HTTP/2 or HTTP/3 enabled
- Brotli or Gzip compression active
- CDN configured for static assets
- Edge caching for dynamic content where possible
- Database query optimization (for dynamic sites)
- Consider server-side rendering (SSR) or static site generation (SSG) for JS-heavy frameworks

---

## Common Issues by Site Type

### SaaS/Product Sites
- Product pages lack content depth
- Blog not integrated with product pages
- Missing comparison/alternative pages
- Feature pages thin on content
- No glossary/educational content
- Missing `SoftwareApplication` or `Product` schema
- Pricing page not optimized for "pricing" keywords

### E-commerce
- Thin category pages (need unique descriptions)
- Duplicate product descriptions (from manufacturers)
- Missing `Product` and `Offer` schema
- Faceted navigation creating duplicate/thin pages
- Out-of-stock pages mishandled (should 200 with notice, not 404)
- Missing reviews and `AggregateRating` schema
- Pagination issues on category pages
- Image optimization neglected on product images

### Content/Blog Sites
- Outdated content not refreshed (check `dateModified`)
- Keyword cannibalization across similar posts
- No topical clustering or pillar page strategy
- Poor internal linking between related articles
- Missing author pages with E-E-A-T signals
- No `Article` or `BlogPosting` schema
- Missing Open Graph tags causing poor social sharing

### Local Business
- Inconsistent NAP (Name, Address, Phone) across web
- Missing `LocalBusiness` schema
- No Google Business Profile optimization
- Missing or thin location pages
- No local content strategy
- Missing review schema
- No `areaServed` markup for service-area businesses

---

## Output Format

### Audit Report Structure

**Executive Summary**
- Overall health assessment (score or rating)
- Top 3-5 priority issues with estimated impact
- Quick wins identified (low effort, high impact)

**Technical SEO Findings**
For each issue:
- **Issue**: What is wrong
- **Impact**: SEO impact (High/Medium/Low)
- **Evidence**: How you found it (tool, URL, screenshot)
- **Fix**: Specific recommendation with code examples where applicable
- **Priority**: High/Medium/Low

**On-Page SEO Findings**
Same format as above

**Structured Data Findings**
Same format as above

**Content Findings**
Same format as above

**Accessibility & SEO Findings**
Same format as above

**Prioritized Action Plan**
1. Critical fixes (blocking indexation or causing penalties)
2. High-impact improvements (significant ranking or traffic gains)
3. Quick wins (easy to implement, immediate benefit)
4. Long-term recommendations (strategic, ongoing efforts)

---

## Tools Referenced

**Free Tools**
- Google Search Console (essential -- coverage, performance, Core Web Vitals)
- Google PageSpeed Insights (lab + field performance data)
- Bing Webmaster Tools
- Google Rich Results Test (**use this for schema validation -- it renders JavaScript**)
- Schema Markup Validator (https://validator.schema.org/)
- Facebook Sharing Debugger (https://developers.facebook.com/tools/debug/)
- LinkedIn Post Inspector (https://www.linkedin.com/post-inspector/)
- Lighthouse (built into Chrome DevTools)
- WAVE Accessibility Tool (https://wave.webaim.org/)

> **Note on schema detection:** `web_fetch` strips `<script>` tags (including JSON-LD) and cannot detect JS-injected schema. Always use the browser tool, Rich Results Test, or Screaming Frog for schema checks. See the warning at the top of the Audit Framework section.

**Paid Tools** (if available)
- Screaming Frog SEO Spider (renders JavaScript, exports structured data)
- Ahrefs (backlinks, keyword research, site audit)
- Semrush (comprehensive SEO suite)
- Sitebulb (visual site audit)
- ContentKing (real-time SEO monitoring)

---

## Task-Specific Questions

1. What pages/keywords matter most to your business?
2. Do you have Google Search Console access? Can you share a performance report?
3. Any recent site changes, redesigns, or migrations?
4. Who are your top organic competitors?
5. What is your current organic traffic baseline?
6. Are there specific SEO concerns that prompted this audit?
7. What CMS or framework is the site built on? (affects schema detection, rendering, and technical recommendations)

---

## Related Skills

- **ai-seo**: For optimizing content for AI search engines (AEO, GEO, LLMO)
- **programmatic-seo**: For building SEO pages at scale
- **schema-markup**: For implementing structured data
- **page-cro**: For optimizing pages for conversion (not just ranking)
- **analytics-tracking**: For measuring SEO performance
