#!/usr/bin/env node
// ScentWise — Amazon ASIN map maintenance.  `node scripts/asin-map.js` (or `npm run asins`)
//
//  1. Refreshes content-briefs/asin-map.csv: one row per perfume that gets a "Shop on Amazon"
//     button somewhere on the site (curated popular list, celebrity lists, blog fragrance cards),
//     most-clicked surfaces first. Rows that already have ASINs filled in are kept verbatim.
//  2. Regenerates the ASIN block in public/amazon.js from every row that has at least one ASIN.
//
// Fill the CSV by hand (or from the Associates SiteStripe / Product Advertising API): open the
// perfume on each store, copy the 10-character ASIN from the URL (/dp/B0XXXXXXXX). Prefer the
// standard 100 ml EDP/EDT listing sold by Amazon or a real retailer, not a decant or tester.
// ASINs differ per marketplace — a US ASIN will usually 404 on amazon.de.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const CSV = path.join(ROOT, 'content-briefs', 'asin-map.csv');
const AMAZON_JS = path.join(PUB, 'amazon.js');
const STORES = ['us', 'uk', 'de', 'fr', 'es', 'it', 'be', 'tr'];
const HEADER = ['name', 'brand', 'source'].concat(STORES);
const POPULAR_LIMIT = 200; // the head of the popularity list covers almost every click

function loadWindowGlobal(file, key) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox);
  return sandbox.window[key] || [];
}
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const key = (n, b) => norm(n) + '|' + norm(b);

// ── candidates ────────────────────────────────────────────────────────────────────────────────
function candidates() {
  const out = new Map(); // key → { name, brand, source }
  const add = (name, brand, source) => {
    name = String(name || '').trim(); brand = String(brand || '').trim();
    if (!name) return;
    const k = key(name, brand);
    if (!out.has(k)) out.set(k, { name, brand, source });
    else if (!out.get(k).source.includes(source)) out.get(k).source += '+' + source;
  };
  loadWindowGlobal(path.join(PUB, 'popular.js'), 'SW_POPULAR').slice(0, POPULAR_LIMIT).forEach((s) => { const [n, b] = String(s).split('|'); add(n, b, 'popular'); });
  loadWindowGlobal(path.join(PUB, 'celebs.js'), 'SW_CELEBS').forEach((c) => (c.frags || []).forEach((s) => { const [n, b] = String(s).split('|'); add(n, b, 'celebs'); }));
  const cleanBrand = (s) => s.replace(/[—\-].*$/, '').replace(/~?\$[\d.]+.*$/, '').trim(); // same rule as frag-images.js
  const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();
  for (const f of fs.readdirSync(path.join(PUB, 'blog')).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(PUB, 'blog', f), 'utf8');
    if (!html.includes('frag-images.js')) continue;
    // .frag-name is always followed by its .frag-brand inside the same .frag-info block
    const re = /<div class="frag-name">([\s\S]*?)<\/div>\s*(?:<div class="frag-brand">([\s\S]*?)<\/div>)?/g;
    let m;
    while ((m = re.exec(html))) add(strip(m[1]), m[2] ? cleanBrand(strip(m[2])) : '', 'blog');
  }
  return out;
}

// ── csv ───────────────────────────────────────────────────────────────────────────────────────
const q = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
function parseCsv(text) {
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
function readExisting() {
  if (!fs.existsSync(CSV)) return new Map();
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  const idx = (h) => head.indexOf(h);
  const out = new Map();
  for (const r of rows) {
    const rec = { name: r[idx('name')] || '', brand: r[idx('brand')] || '', source: r[idx('source')] || '', asins: {} };
    for (const s of STORES) { const v = (r[idx(s)] || '').trim().toUpperCase(); if (v) rec.asins[s] = v; }
    out.set(key(rec.name, rec.brand), rec);
  }
  return out;
}

// ── main ──────────────────────────────────────────────────────────────────────────────────────
function main() {
  const existing = readExisting();
  const cands = candidates();
  // keep every existing row (hand-added perfumes too), then append new candidates
  const rows = [];
  for (const [k, rec] of existing) rows.push(Object.assign({}, rec, { source: (cands.get(k) || rec).source || rec.source }));
  for (const [k, c] of cands) if (!existing.has(k)) rows.push({ name: c.name, brand: c.brand, source: c.source, asins: {} });

  const bad = [];
  const asinMap = {};
  for (const r of rows) {
    const clean = {};
    for (const s of STORES) {
      const v = r.asins[s];
      if (!v) continue;
      if (!/^[A-Z0-9]{10}$/.test(v)) { bad.push(`${r.name} | ${r.brand} [${s}] "${v}"`); continue; }
      clean[s] = v;
    }
    if (Object.keys(clean).length) asinMap[key(r.name, r.brand)] = clean;
  }
  if (bad.length) { console.error('Invalid ASINs (must be 10 letters/digits):\n  ' + bad.join('\n  ')); process.exit(1); }

  fs.mkdirSync(path.dirname(CSV), { recursive: true });
  const csv = [HEADER.join(',')].concat(rows.map((r) => [r.name, r.brand, r.source].concat(STORES.map((s) => r.asins[s] || '')).map(q).join(','))).join('\n') + '\n';
  fs.writeFileSync(CSV, csv);

  const js = fs.readFileSync(AMAZON_JS, 'utf8');
  const re = /\/\* sw:asins \*\/[\s\S]*?\/\* \/sw:asins \*\//;
  if (!re.test(js)) throw new Error('markers /* sw:asins */ … /* /sw:asins */ not found in public/amazon.js');
  const body = Object.keys(asinMap).sort().map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(asinMap[k])}`).join(',\n');
  const block = '/* sw:asins */ ' + (body ? '{\n' + body + '\n  }' : '{}') + ' /* /sw:asins */';
  const next = js.replace(re, block);
  if (next !== js) fs.writeFileSync(AMAZON_JS, next);

  const filled = Object.keys(asinMap).length;
  console.log(`asin-map: ${rows.length} perfumes in ${path.relative(ROOT, CSV)}, ${filled} with ASINs → public/amazon.js${filled ? ' (bump /amazon.js?v= in index.html)' : ''}`);
}
main();
