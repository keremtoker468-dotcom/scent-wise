#!/usr/bin/env node
/**
 * Adds CSS gradient hero banners to blog articles.
 * Assigns a gradient style based on article category/keywords.
 *
 * Usage: node scripts/add-blog-heroes.js
 */

const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'public', 'blog');
const HERO_MARKER = '<!-- hero-banner -->';

// Category detection from filename/title keywords
function detectStyle(filename, title) {
  const f = filename.toLowerCase();
  const t = title.toLowerCase();
  if (f.includes('summer') || f.includes('aquatic') || t.includes('fresh') || t.includes('summer') || t.includes('beach')) return 'cool';
  if (f.includes('spring') || f.includes('floral') || f.includes('women') || f.includes('bloom') || t.includes('spring') || t.includes('floral') || t.includes('women')) return 'floral';
  if (f.includes('fall') || f.includes('autumn') || f.includes('vanilla') || f.includes('amber') || f.includes('marshmallow') || f.includes('caramel') || t.includes('fall') || t.includes('warm') || t.includes('vanilla')) return 'warm';
  if (f.includes('winter') || f.includes('oud') || f.includes('niche') || f.includes('woody') || t.includes('winter') || t.includes('oud') || t.includes('niche')) return 'earthy';
  if (f.includes('celeb') || f.includes('luxury') || f.includes('100-200') || t.includes('celebrity') || t.includes('luxury') || t.includes('icon')) return 'luxe';
  if (f.includes('dupe') || f.includes('budget') || f.includes('under') || f.includes('mens') || f.includes('teen') || f.includes('office') || f.includes('smellmax')) return 'smoky';
  if (f.includes('music') || f.includes('jazz') || f.includes('hip-hop') || f.includes('electronic') || f.includes('rnb') || f.includes('indie') || f.includes('classical')) return 'cool';
  if (f.includes('zodiac') || f.includes('pisces') || f.includes('scorpio') || f.includes('cancer') || f.includes('capricorn')) return 'luxe';
  if (f.includes('aries') || f.includes('leo') || f.includes('sagittarius')) return 'warm';
  if (f.includes('gemini') || f.includes('libra') || f.includes('aquarius')) return 'cool';
  if (f.includes('taurus') || f.includes('virgo')) return 'earthy';
  return 'smoky'; // default
}

// Detect tag from filename
function detectTag(filename) {
  const f = filename.toLowerCase();
  if (f.includes('zodiac') || f.includes('pisces') || f.includes('scorpio') || f.includes('aries') || f.includes('leo') || f.includes('cancer') || f.includes('gemini') || f.includes('taurus') || f.includes('virgo') || f.includes('libra') || f.includes('sagittarius') || f.includes('capricorn') || f.includes('aquarius')) return 'Zodiac';
  if (f.includes('music') || f.includes('jazz') || f.includes('hip-hop') || f.includes('electronic') || f.includes('rnb') || f.includes('indie') || f.includes('classical')) return 'Music × Fragrance';
  if (f.includes('celeb')) return 'Celebrity';
  if (f.includes('dupe')) return 'Dupe Guide';
  if (f.includes('summer') || f.includes('spring') || f.includes('fall') || f.includes('winter')) return 'Seasonal Guide';
  if (f.includes('budget') || f.includes('under')) return 'Budget';
  if (f.includes('100-200') || f.includes('luxury') || f.includes('niche')) return 'Luxury';
  if (f.includes('layering') || f.includes('last-longer') || f.includes('smellmax')) return 'Expert Guide';
  if (f.includes('trending') || f.includes('pistachio') || f.includes('marshmallow')) return 'Trending';
  if (f.includes('oud') || f.includes('vanilla')) return 'Ingredient Guide';
  return 'Guide';
}

const HERO_CSS = `<style>
.blog-hero{position:relative;padding:60px 0 40px;min-height:200px;display:flex;flex-direction:column;justify-content:flex-end;margin-bottom:32px;border-radius:0 0 16px 16px;overflow:hidden}
.blog-hero::before{content:'';position:absolute;inset:0;opacity:.15}
.blog-hero .hero-tag{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#c9a96e;margin-bottom:12px}
.blog-hero h1{font-family:'Playfair Display',serif;font-size:clamp(28px,5vw,42px);line-height:1.2;margin-bottom:10px;color:#f0ece4}
.blog-hero .hero-sub{font-size:15px;color:rgba(240,236,228,.65);max-width:560px;line-height:1.6}
.hero-warm{background:linear-gradient(135deg,#1a1008 0%,#2a1a0a 30%,#1a1510 60%,#0a0a0a 100%)}
.hero-warm::before{background:radial-gradient(ellipse at 70% 30%,rgba(201,169,110,.3),transparent 60%)}
.hero-cool{background:linear-gradient(135deg,#0a1520 0%,#0a1a2a 30%,#081518 60%,#0a0a0a 100%)}
.hero-cool::before{background:radial-gradient(ellipse at 30% 40%,rgba(100,180,220,.25),transparent 60%)}
.hero-floral{background:linear-gradient(135deg,#1a0a18 0%,#2a1020 30%,#1a1018 60%,#0a0a0a 100%)}
.hero-floral::before{background:radial-gradient(ellipse at 60% 50%,rgba(200,130,170,.2),transparent 60%)}
.hero-earthy{background:linear-gradient(135deg,#0a1a0a 0%,#102010 30%,#0a150a 60%,#0a0a0a 100%)}
.hero-earthy::before{background:radial-gradient(ellipse at 40% 30%,rgba(120,160,100,.2),transparent 60%)}
.hero-smoky{background:linear-gradient(135deg,#141414 0%,#1a1a18 30%,#121210 60%,#0a0a0a 100%)}
.hero-smoky::before{background:radial-gradient(ellipse at 50% 40%,rgba(180,160,140,.15),transparent 60%)}
.hero-luxe{background:linear-gradient(135deg,#140a1e 0%,#1a1028 30%,#100a1a 60%,#0a0a0a 100%)}
.hero-luxe::before{background:radial-gradient(ellipse at 65% 35%,rgba(160,120,200,.2),transparent 60%)}
</style>`;

function makeHeroHTML(style, tag, title, subtitle) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `${HERO_MARKER}\n${HERO_CSS}\n<div class="blog-hero hero-${style}">\n  <div class="hero-tag">${esc(tag)}</div>\n  <h1>${esc(title)}</h1>\n  <p class="hero-sub">${esc(subtitle)}</p>\n</div>`;
}

let modified = 0;
const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');

for (const file of files) {
  const filePath = path.join(BLOG_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');

  if (html.includes(HERO_MARKER)) continue;

  // Extract title
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (!titleMatch) continue;
  const title = titleMatch[1].replace(/&amp;/g, '&').replace(/&mdash;/g, '—').trim();

  // Extract subtitle
  const subMatch = html.match(/<p class="subtitle">([^<]+)<\/p>/);
  const subtitle = subMatch ? subMatch[1].replace(/&amp;/g, '&').replace(/&mdash;/g, '—').trim() : '';

  const style = detectStyle(file, title);
  const tag = detectTag(file);

  // Insert hero after <article class="article"> and replace the existing h1 + subtitle
  // Find the article opening
  const articleStart = html.indexOf('<article');
  if (articleStart === -1) continue;
  const articleTagEnd = html.indexOf('>', articleStart) + 1;

  // Find breadcrumb end
  const breadEnd = html.indexOf('</nav>', articleTagEnd);
  if (breadEnd === -1) continue;
  const insertPoint = breadEnd + 6; // after </nav>

  // Find and remove original h1 and subtitle (they're now in the hero)
  let modified_html = html.slice(0, insertPoint) + '\n\n' + makeHeroHTML(style, tag, title, subtitle) + '\n' + html.slice(insertPoint);

  // Remove the original h1 (but only the one after our hero, not the hero h1)
  // Find the second h1 occurrence and remove it + subtitle
  const heroEnd = modified_html.indexOf('</div>', modified_html.indexOf(HERO_MARKER)) + 6;
  const afterHero = modified_html.slice(heroEnd);
  const cleanedAfter = afterHero
    .replace(/<h1[^>]*>[^<]+<\/h1>\s*/, '')
    .replace(/<p class="subtitle">[^<]+<\/p>\s*/, '');

  modified_html = modified_html.slice(0, heroEnd) + cleanedAfter;

  fs.writeFileSync(filePath, modified_html, 'utf8');
  modified++;
  console.log(`  ✓ ${file} → ${style}`);
}

console.log(`\nDone! Added hero banners to ${modified} articles.`);
