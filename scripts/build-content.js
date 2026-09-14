#!/usr/bin/env node
// Content build for the static blog. Idempotent — run it after editing any post
// and commit the result:   npm run content
//
// For every public/blog/*.html post it:
//   1. recomputes "N min read" from the visible word count (200 wpm)
//   2. rewrites the byline block (.meta) as: author link · published · updated · read time
//      published = existing date in the post (or first git commit), updated = last git
//      commit date of the file, or today when the file has uncommitted changes
//   3. syncs <meta name="author"> and the Article JSON-LD (author → Person, dates)
//   4. inserts scripts/partials/affiliate-disclosure.html right under the byline on
//      pages that carry affiliate links (Amazon URLs, or fragrance cards that
//      /blog/frag-images.js decorates with "Shop on Amazon" buttons), removes it elsewhere
//   5. appends scripts/partials/author-box.html at the end of the article
// Partials are wrapped in <!-- sw:name --> … <!-- /sw:name --> markers so re-runs replace
// rather than duplicate them.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BLOG = path.join(ROOT, 'public', 'blog');
const PARTIALS = path.join(__dirname, 'partials');
const WPM = 200;
const AUTHOR = { name: 'Kerem Toker', url: 'https://scent-wise.com/author/kerem-toker.html', path: '/author/kerem-toker.html' };
const SITE = 'https://scent-wise.com';
const TODAY = new Date().toISOString().slice(0, 10);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const partial = (name) => fs.readFileSync(path.join(PARTIALS, name + '.html'), 'utf8').trim();
const wrap = (name, html) => `<!-- sw:${name} -->\n${html}\n<!-- /sw:${name} -->`;
const markerRe = (name) => new RegExp(`\\s*<!-- sw:${name} -->[\\s\\S]*?<!-- /sw:${name} -->`, 'g');

function git(args, file) {
  try { return execSync(`git ${args} -- "${file}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return ''; }
}
function fmtDate(iso) { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; }

function visibleWords(html) {
  let t = html;
  for (const tag of ['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'aside']) {
    t = t.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), ' ');
  }
  t = t.replace(/<div class="meta">[\s\S]*?<\/div>/, ' ');  // byline is not content
  t = t.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
       .replace(/&[a-z]+;|&#\d+;/gi, ' ');
  return (t.match(/[A-Za-z0-9'’À-ɏ]+/g) || []).length;
}

function hasAffiliate(html) {
  return /amazon\.(com|de|fr|es|it|co\.uk|com\.be)|tag=scentwise|amzn\.to/i.test(html)
      || (html.includes('frag-images.js') && html.includes('class="frag-card"'));
}

function processPost(file) {
  const rel = path.relative(ROOT, file);
  let html = fs.readFileSync(file, 'utf8');
  const original = html;

  // strip previously injected partials so word count and positions are computed on clean content
  html = html.replace(markerRe('disclosure'), '').replace(markerRe('author'), '');

  const metaMatch = html.match(/<div class="meta">([\s\S]*?)<\/div>/);
  if (!metaMatch) { console.warn(`skip ${rel}: no .meta byline`); return; }

  // ---- dates ----
  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  let published = null;
  for (const m of ldBlocks) { const d = m[1].match(/"datePublished":\s*"(\d{4}-\d{2}-\d{2})/); if (d) { published = d[1]; break; } }
  if (!published) { const t = metaMatch[1].match(/datetime="(\d{4}-\d{2}-\d{2})"/); if (t) published = t[1]; }
  if (!published) published = git('log --diff-filter=A --format=%cs', rel).split('\n').pop() || TODAY;
  const dirty = git('status --porcelain', rel) !== '' || html !== original;
  let modified = dirty ? TODAY : (git('log -1 --format=%cs', rel) || TODAY);
  if (modified < published) modified = published;

  // ---- byline ----
  const words = visibleWords(html);
  const minutes = Math.max(1, Math.round(words / WPM));
  const byline = [
    `<span>By <a href="${AUTHOR.path}" rel="author">${AUTHOR.name}</a></span>`,
    `<span>&middot;</span>`,
    `<span>Published <time datetime="${published}">${fmtDate(published)}</time></span>`,
    ...(modified !== published ? [`<span>&middot;</span>`, `<span>Updated <time datetime="${modified}">${fmtDate(modified)}</time></span>`] : []),
    `<span>&middot;</span>`,
    `<span>${minutes} min read</span>`,
  ].join('\n    ');
  html = html.replace(/<div class="meta">[\s\S]*?<\/div>/, `<div class="meta">\n    ${byline}\n  </div>`);

  // ---- head metadata ----
  html = html.replace(/<meta name="author" content="[^"]*">/, `<meta name="author" content="${AUTHOR.name}">`);
  const authorLd = { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url };
  let hasArticle = false;
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, body) => {
    let data; try { data = JSON.parse(body); } catch { return whole; }
    if (data['@type'] !== 'Article') return whole;
    hasArticle = true;
    data.author = authorLd;
    data.datePublished = published;
    data.dateModified = modified;
    return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
  });
  if (!hasArticle) {
    const title = (html.match(/<title>(.*?)<\/title>/s) || [,''])[1].replace(/\s*\|\s*ScentWise\s*$/, '').trim();
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [,''])[1];
    const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [,`${SITE}/blog/${path.basename(file)}`])[1];
    const article = { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc,
      image: `${SITE}/og-image.png`, author: authorLd,
      publisher: { '@type': 'Organization', name: 'ScentWise', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png` } },
      datePublished: published, dateModified: modified, mainEntityOfPage: { '@type': 'WebPage', '@id': canonical } };
    html = html.replace('<script type="application/ld+json">', `<script type="application/ld+json">\n${JSON.stringify(article, null, 2)}\n</script>\n<script type="application/ld+json">`);
  }

  // ---- partials ----
  if (hasAffiliate(html)) {
    html = html.replace(/(<div class="meta">[\s\S]*?<\/div>)/, `$1\n  ${wrap('disclosure', partial('affiliate-disclosure'))}`);
  }
  html = html.replace(/\s*<\/article>/, `\n  ${wrap('author', partial('author-box'))}\n</article>`);

  if (html !== original) { fs.writeFileSync(file, html); console.log(`updated ${rel}  (${words} words, ${minutes} min, ${published} → ${modified}${hasAffiliate(html) ? ', disclosure' : ''})`); }
}

for (const f of fs.readdirSync(BLOG)) {
  if (!f.endsWith('.html') || f === 'index.html') continue;
  processPost(path.join(BLOG, f));
}
