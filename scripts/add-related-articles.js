#!/usr/bin/env node
/**
 * Injects "Related Articles" section into all blog posts.
 * Matches articles by category (dupes, best-of, zodiac, music, trending, guides).
 * Run: node scripts/add-related-articles.js
 */
const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '../public/blog');

// Define article metadata for matching
const ARTICLES = {
  'best-mens-fragrances.html': { title: "Best Men's Fragrances 2026", tags: ['best', 'men', 'guide'] },
  'best-womens-fragrances.html': { title: "Best Women's Fragrances 2026", tags: ['best', 'women', 'guide'] },
  'best-budget-colognes-for-teens.html': { title: 'Best Budget Colognes for Teens', tags: ['best', 'budget', 'men'] },
  'best-date-night-fragrances.html': { title: 'Best Date Night Fragrances', tags: ['best', 'guide', 'occasion'] },
  'best-long-lasting-perfumes.html': { title: 'Best Long-Lasting Perfumes', tags: ['best', 'guide'] },
  'best-niche-fragrances.html': { title: 'Best Niche Fragrances', tags: ['best', 'niche', 'guide'] },
  'best-office-fragrances.html': { title: 'Best Office Fragrances', tags: ['best', 'guide', 'occasion'] },
  'best-perfumes-under-50.html': { title: 'Best Perfumes Under $50', tags: ['best', 'budget', 'guide'] },
  'best-summer-fragrances.html': { title: 'Best Summer Fragrances', tags: ['best', 'guide', 'season'] },
  'baccarat-rouge-540-dupes.html': { title: 'Baccarat Rouge 540 Dupes', tags: ['dupes', 'niche'] },
  'creed-aventus-dupes.html': { title: 'Creed Aventus Dupes', tags: ['dupes', 'niche', 'men'] },
  'dior-sauvage-dupes.html': { title: 'Dior Sauvage Dupes', tags: ['dupes', 'men'] },
  'le-labo-santal-33-dupes.html': { title: 'Le Labo Santal 33 Dupes', tags: ['dupes', 'niche'] },
  'tom-ford-lost-cherry-dupes.html': { title: 'Tom Ford Lost Cherry Dupes', tags: ['dupes', 'niche'] },
  'ysl-libre-dupes.html': { title: 'YSL Libre Dupes', tags: ['dupes', 'women'] },
  'celebrity-fragrances-guide.html': { title: 'Celebrity Fragrances Guide', tags: ['celebrity', 'guide'] },
  'fragrance-layering-guide.html': { title: 'Fragrance Layering Guide', tags: ['guide', 'technique'] },
  'how-to-make-perfume-last-longer.html': { title: 'How to Make Perfume Last Longer', tags: ['guide', 'technique'] },
  'smellmaxxing-guide-2026.html': { title: 'Smellmaxxing Guide 2026', tags: ['guide', 'men', 'technique'] },
  'what-is-oud.html': { title: 'What Is Oud?', tags: ['notes', 'guide', 'education'] },
  'vanilla-in-perfumery.html': { title: 'Vanilla in Perfumery', tags: ['notes', 'guide', 'education'] },
  'trending-pistachio-fragrances.html': { title: 'Trending Pistachio Fragrances', tags: ['trending', 'notes'] },
  'trending-marshmallow-fragrances.html': { title: 'Trending Marshmallow Fragrances', tags: ['trending', 'notes'] },
  'music-classical-fragrances.html': { title: 'Classical Music Fragrances', tags: ['music'] },
  'music-electronic-fragrances.html': { title: 'Electronic Music Fragrances', tags: ['music'] },
  'music-hip-hop-fragrances.html': { title: 'Hip-Hop Music Fragrances', tags: ['music'] },
  'music-indie-rock-fragrances.html': { title: 'Indie Rock Music Fragrances', tags: ['music'] },
  'music-jazz-fragrances.html': { title: 'Jazz Music Fragrances', tags: ['music'] },
  'music-rnb-fragrances.html': { title: 'R&B Music Fragrances', tags: ['music'] },
  'zodiac-aquarius-fragrances.html': { title: 'Aquarius Fragrances', tags: ['zodiac'] },
  'zodiac-aries-fragrances.html': { title: 'Aries Fragrances', tags: ['zodiac'] },
  'zodiac-cancer-fragrances.html': { title: 'Cancer Fragrances', tags: ['zodiac'] },
  'zodiac-capricorn-fragrances.html': { title: 'Capricorn Fragrances', tags: ['zodiac'] },
  'zodiac-gemini-fragrances.html': { title: 'Gemini Fragrances', tags: ['zodiac'] },
  'zodiac-leo-fragrances.html': { title: 'Leo Fragrances', tags: ['zodiac'] },
  'zodiac-libra-fragrances.html': { title: 'Libra Fragrances', tags: ['zodiac'] },
  'zodiac-pisces-fragrances.html': { title: 'Pisces Fragrances', tags: ['zodiac'] },
  'zodiac-sagittarius-fragrances.html': { title: 'Sagittarius Fragrances', tags: ['zodiac'] },
  'zodiac-scorpio-fragrances.html': { title: 'Scorpio Fragrances', tags: ['zodiac'] },
  'zodiac-taurus-fragrances.html': { title: 'Taurus Fragrances', tags: ['zodiac'] },
  'zodiac-virgo-fragrances.html': { title: 'Virgo Fragrances', tags: ['zodiac'] },
};

function getRelated(filename, count = 4) {
  const article = ARTICLES[filename];
  if (!article) return [];

  const scored = [];
  for (const [file, meta] of Object.entries(ARTICLES)) {
    if (file === filename) continue;
    const overlap = article.tags.filter(t => meta.tags.includes(t)).length;
    if (overlap > 0) {
      scored.push({ file, title: meta.title, score: overlap });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count);
}

function buildRelatedHTML(related) {
  if (!related.length) return '';

  const cards = related.map(r =>
    `      <a href="/blog/${r.file}" class="related-card">
        <span class="related-title">${r.title}</span>
        <span class="related-arrow">&rarr;</span>
      </a>`
  ).join('\n');

  return `
  <section class="related-articles">
    <h2>Related Articles</h2>
    <div class="related-grid">
${cards}
    </div>
  </section>

  <style>
  .related-articles { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #23232a; }
  .related-articles h2 { font-size: 1.3rem; margin-bottom: 1rem; color: #f0ece4; }
  .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.75rem; }
  .related-card { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: #16161a; border: 1px solid #23232a; border-radius: 12px; text-decoration: none; color: #f0ece4; transition: border-color 0.25s, transform 0.25s; }
  .related-card:hover { border-color: rgba(201,169,110,0.3); transform: translateY(-2px); }
  .related-title { font-size: 0.9rem; font-weight: 500; }
  .related-arrow { color: #c9a96e; font-size: 1.1rem; flex-shrink: 0; margin-left: 0.75rem; }
  </style>`;
}

// Also add SEO cross-links to perfume/brand/note pages
function buildSEOLinksHTML() {
  return `
  <section class="seo-crosslinks" style="margin-top:2rem;padding:1.25rem;background:#0f0f12;border:1px solid #23232a;border-radius:12px">
    <p style="font-size:0.85rem;color:#a8a29e;margin-bottom:0.5rem">Explore more:</p>
    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;font-size:0.85rem">
      <a href="/perfumes/" style="color:#c9a96e;text-decoration:none">Top Perfumes</a>
      <a href="/brands/" style="color:#c9a96e;text-decoration:none">Browse Brands</a>
      <a href="/notes/" style="color:#c9a96e;text-decoration:none">Notes &amp; Accords</a>
      <a href="/blog/" style="color:#c9a96e;text-decoration:none">All Articles</a>
    </div>
  </section>`;
}

// Process all blog files
const MARKER = '<!-- related-articles-injected -->';
let updated = 0;
let skipped = 0;

for (const filename of Object.keys(ARTICLES)) {
  const filepath = path.join(BLOG_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`SKIP (not found): ${filename}`);
    skipped++;
    continue;
  }

  let html = fs.readFileSync(filepath, 'utf8');

  // Skip if already injected
  if (html.includes(MARKER)) {
    console.log(`SKIP (already done): ${filename}`);
    skipped++;
    continue;
  }

  const related = getRelated(filename);
  if (!related.length) {
    console.log(`SKIP (no related): ${filename}`);
    skipped++;
    continue;
  }

  const injection = MARKER + '\n' + buildRelatedHTML(related) + '\n' + buildSEOLinksHTML();

  // Insert before </article>
  if (html.includes('</article>')) {
    html = html.replace('</article>', injection + '\n</article>');
  } else {
    // Fallback: insert before footer
    html = html.replace('<footer class="footer">', injection + '\n<footer class="footer">');
  }

  fs.writeFileSync(filepath, html, 'utf8');
  console.log(`UPDATED: ${filename} (+${related.length} related articles)`);
  updated++;
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
