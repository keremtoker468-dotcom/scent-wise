#!/usr/bin/env node
/**
 * Injects "Where to Buy" affiliate links into blog articles.
 * Matches perfume names in <div class="frag-name">, <strong>, <b>, <em>, <h3> tags.
 *
 * Usage: node scripts/add-buy-links.js
 */

const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'public', 'blog');

// Well-known perfumes to link
const PERFUMES = [
  { name: 'Baccarat Rouge 540', brand: 'Maison Francis Kurkdjian' },
  { name: 'Dior Sauvage', brand: 'Dior' },
  { name: 'Bleu de Chanel', brand: 'Chanel' },
  { name: 'Creed Aventus', brand: 'Creed' },
  { name: 'Tom Ford Lost Cherry', brand: 'Tom Ford' },
  { name: 'Le Labo Santal 33', brand: 'Le Labo' },
  { name: 'YSL Libre', brand: 'Yves Saint Laurent' },
  { name: 'Chanel No. 5', brand: 'Chanel' },
  { name: 'Versace Eros', brand: 'Versace' },
  { name: 'Acqua di Gio', brand: 'Giorgio Armani' },
  { name: 'Black Orchid', brand: 'Tom Ford' },
  { name: 'Good Girl', brand: 'Carolina Herrera' },
  { name: 'La Vie Est Belle', brand: 'Lancome' },
  { name: 'Light Blue', brand: 'Dolce & Gabbana' },
  { name: 'Ariana Grande Cloud', brand: 'Ariana Grande' },
  { name: 'Dylan Blue', brand: 'Versace' },
  { name: 'Tobacco Vanille', brand: 'Tom Ford' },
  { name: 'Oud Wood', brand: 'Tom Ford' },
  { name: 'Jazz Club', brand: 'Maison Margiela' },
  { name: 'Dolce &amp; Gabbana The One', brand: 'Dolce & Gabbana' },
];

const BUY_MARKER = '<!-- buy-links -->';

function makeBuyHTML(perfumeName, brand) {
  const enc = (s) => encodeURIComponent(s);
  // Use actual name (without HTML entities) for URL
  const cleanName = perfumeName.replace(/&amp;/g, '&');
  return `<div class="buy-links" style="display:flex;gap:6px;margin:6px 0 2px 0">${
    ['fragrancex', 'amazon'].map(r =>
      `<a href="/api/affiliate-redirect?perfume=${enc(cleanName)}&brand=${enc(brand)}&retailer=${r}" rel="sponsored noopener" target="_blank" style="font-size:11px;padding:3px 10px;background:rgba(201,169,110,.1);border:1px solid rgba(201,169,110,.2);border-radius:12px;color:#c9a96e;text-decoration:none;display:inline-block">${r === 'fragrancex' ? 'Buy on FragranceX' : 'Buy on Amazon'} &rarr;</a>`
    ).join('')
  }</div>`;
}

let totalInjected = 0;
let filesModified = 0;

const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');

for (const file of files) {
  const filePath = path.join(BLOG_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');

  // Skip if already processed
  if (html.includes(BUY_MARKER)) continue;

  let changed = false;

  for (const { name, brand } of PERFUMES) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern 1: <div class="frag-name">Name</div> followed by <div class="frag-brand">
    const fragCardRegex = new RegExp(
      `(<div class="frag-brand">[^<]*</div>)((?:(?!<div class="buy-links").)*?)(<div class="frag-notes">)`,
      'g'
    );
    // Simpler: match frag-name containing our perfume name
    const fragNameRegex = new RegExp(
      `(<div class="frag-name">[^<]*${escapedName}[^<]*</div>\\s*<div class="frag-brand">[^<]*</div>)(?!\\s*${BUY_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi'
    );
    if (fragNameRegex.test(html)) {
      // Reset lastIndex after test
      fragNameRegex.lastIndex = 0;
      html = html.replace(fragNameRegex, `$1\n        ${BUY_MARKER}${makeBuyHTML(name, brand)}`);
      changed = true;
      totalInjected++;
    }

    // Pattern 2: <strong>Name</strong> or <b>Name</b> in paragraph text
    const strongRegex = new RegExp(
      `(<(?:strong|b)>[^<]*${escapedName}[^<]*</(?:strong|b)>)(?!\\s*${BUY_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi'
    );
    // Only inject once per perfume per file (first occurrence in bold)
    if (strongRegex.test(html)) {
      strongRegex.lastIndex = 0;
      let replaced = false;
      html = html.replace(strongRegex, (match, group1) => {
        if (replaced) return match;
        replaced = true;
        totalInjected++;
        return `${group1} ${BUY_MARKER}${makeBuyHTML(name, brand)}`;
      });
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, html, 'utf8');
    filesModified++;
    console.log(`  ✓ ${file}`);
  }
}

console.log(`\nDone! Injected buy links in ${totalInjected} places across ${filesModified} files.`);
