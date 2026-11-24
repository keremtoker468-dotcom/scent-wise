#!/usr/bin/env node
// `npm run views` — writes public/explore.html, public/advisor.html and public/celebrities.html
// from public/index.html, so each route answers with its own <title>, description, canonical,
// <h1> and structured data instead of the home page's. The SPA takes over after load as usual.
// Run it after every change to index.html or celebs.js, and commit the generated files.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', 'public');
const SITE = 'https://scent-wise.com';
const src = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function celebs() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(PUB, 'celebs.js'), 'utf8'), ctx);
  return ctx.window.SW_CELEBS || [];
}
// Same markup as renderCelebs() in app.js, so the swap on load is invisible.
function celebGrid(list) {
  return list.map((c) => `<button class="celeb" type="button" data-celeb="${esc(c.name)}"><span class="avatar">${esc(c.img || c.name[0])}</span><span class="stack" style="gap:2px"><span class="t-head" style="font-size:17px">${esc(c.name)}</span><span class="t-foot muted">${c.frags.length} fragrance${c.frags.length === 1 ? '' : 's'}</span></span><span class="t-call muted" style="line-height:1.4">${c.frags.slice(0, 3).map((f) => esc(f.split('|')[0])).join(' · ')}</span></button>`).join('');
}

const VIEWS = [
  {
    file: 'explore.html', path: '/explore', view: 'explore', type: 'CollectionPage', crumb: 'Explore',
    title: 'Explore 65,000+ Fragrances — ScentWise',
    desc: 'Search 65,000+ perfumes by name, brand, scent family and gender. See the notes, accords and closest-smelling alternatives for each one. Free, no sign-up.',
    heading: [/<h2 class="t-1">Explore<\/h2>/, '<h1 class="t-1">Explore</h1>'],
  },
  {
    file: 'advisor.html', path: '/advisor', view: 'advisor', type: 'WebPage', crumb: 'AI Advisor',
    title: 'AI Fragrance Advisor — ScentWise',
    desc: 'Find a cheaper perfume that smells like the one you love, or describe a mood, a photo, a song or a style and get fragrance picks with prices. Three free searches.',
    heading: [/<h2 class="t-3" id="mode-title">([^<]*)<\/h2>/, '<h1 class="t-3" id="mode-title">$1</h1>'],
  },
  {
    file: 'celebrities.html', path: '/celebrities', view: 'celebs', type: 'CollectionPage', crumb: 'Celebrities',
    title: 'Celebrity Fragrances — What 101 Celebrities Wear | ScentWise',
    desc: 'The perfumes 101 celebrities are documented wearing, from Rihanna and Zendaya to David Beckham and Timothée Chalamet, with similar and cheaper picks for each.',
    heading: [/<h2 class="t-1">Celebrities<\/h2>/, '<h1 class="t-1">Celebrities</h1>'],
  },
];

// Every substitution must hit exactly once; a miss means index.html changed shape and the
// generated page would silently keep the home page's metadata.
function sub(s, re, to, label) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const n = (s.match(g) || []).length;
  if (n !== 1) throw new Error(`${label}: expected 1 match in index.html, found ${n}`);
  return s.replace(re, to);
}
const lit = (t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const block = (o) => `<script type="application/ld+json">\n${JSON.stringify(o)}\n</script>\n`;

for (const v of VIEWS) {
  const url = SITE + v.path;
  const t = esc(v.title), d = esc(v.desc);
  let s = src;
  s = sub(s, /<title>[^<]*<\/title>/, `<title>${t}</title>`, 'title');
  s = sub(s, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${d}">`, 'description');
  s = sub(s, lit(`<link rel="canonical" href="${SITE}/">`), `<link rel="canonical" href="${url}">`, 'canonical');
  s = sub(s, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`, 'og:url');
  s = sub(s, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${t}">`, 'og:title');
  s = sub(s, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${d}">`, 'og:description');
  s = sub(s, /<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${t}">`, 'twitter:title');
  s = sub(s, /<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${d}">`, 'twitter:description');

  // Structured data: keep Organization / WebSite / WebApplication; drop the home-only blocks
  // (WebPage, FAQPage, HowTo, ItemList, BreadcrumbList) and add this page's own.
  let kept = 0;
  s = s.replace(/<script type="application\/ld\+json">\n?([\s\S]*?)\n?<\/script>\n?/g, (m, body) => {
    let type;
    try { type = [].concat(JSON.parse(body)['@type']).join(','); } catch (e) { throw new Error('unparseable JSON-LD in index.html'); }
    if (/Organization|WebSite|WebApplication/.test(type)) { kept++; return m; }
    return kept === 3 ? '%%LD%%' : '';
  });
  if (kept !== 3) throw new Error(`structured data: expected 3 shared blocks, kept ${kept}`);
  const page = { '@context': 'https://schema.org', '@type': v.type, '@id': url + '#webpage', url, name: v.title, description: v.desc, isPartOf: { '@id': SITE + '/#website' }, inLanguage: 'en' };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: v.crumb, item: url }] };
  s = s.replace('%%LD%%', block(page) + block(crumbs)).replace(/%%LD%%/g, '');

  // One <h1> per page: the home hero steps down to <h2>, this view's heading steps up.
  s = sub(s, /<h1 class="t-display">([\s\S]*?)<\/h1>/, '<h2 class="t-display">$1</h2>', 'hero h1');
  s = sub(s, v.heading[0], v.heading[1], 'view heading');

  // Open on this view so its content is in place before app.js runs.
  s = sub(s, lit('<section class="view is-active" id="view-home" data-view="home">'), '<section class="view" id="view-home" data-view="home">', 'home view');
  s = sub(s, lit(`<section class="view" id="view-${v.view}" data-view="${v.view}">`), `<section class="view is-active" id="view-${v.view}" data-view="${v.view}">`, 'active view');

  if (v.view === 'celebs') s = sub(s, /(<div[^>]*id="celeb-grid"[^>]*>)(<\/div>)/, (m, a, b) => a + celebGrid(celebs()) + b, 'celeb grid');

  s = sub(s, /^<!doctype html>/i, (m) => `${m}\n<!-- Generated from index.html by scripts/build-views.js. Do not edit by hand: run npm run views. -->`, 'doctype');
  fs.writeFileSync(path.join(PUB, v.file), s);
  console.log(`wrote public/${v.file}`);
}
