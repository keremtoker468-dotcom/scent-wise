#!/usr/bin/env node
// Seed Redis with Bing Image Search results for top-rated fragrances.
// Usage: node scripts/seed-images.js [--offset N] [--batch N] [--dry-run]
//
// Environment variables required:
//   BING_SEARCH_KEY           - Bing Image Search API key
//   UPSTASH_REDIS_REST_URL    - Upstash Redis REST URL
//   UPSTASH_REDIS_REST_TOKEN  - Upstash Redis auth token
//
// Free tier: 1000 Bing queries/month. Use --batch 100 --offset 0, then
// --offset 100, etc. to spread across days.

const fs = require('fs');
const path = require('path');

const BING_KEY = process.env.BING_SEARCH_KEY;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Parse args
const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1]) : def;
}
const OFFSET = getArg('offset', 0);
const BATCH = getArg('batch', 100);
const DRY_RUN = args.includes('--dry-run');
const TOP_N = getArg('top', 1000);

async function redisSet(key, value) {
  const r = await fetch(`${REDIS_URL}/SET/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value))
  });
  if (!r.ok) throw new Error(`Redis SET failed: ${r.status}`);
}

async function redisGet(key) {
  const r = await fetch(`${REDIS_URL}/GET/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  if (!r.ok) return null;
  const body = await r.json();
  return body.result ? JSON.parse(body.result) : null;
}

async function searchBing(query) {
  const url = `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(query)}&count=1&safeSearch=Strict&imageType=Photo`;
  const r = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': BING_KEY }
  });
  if (!r.ok) throw new Error(`Bing search failed: ${r.status}`);
  const body = await r.json();
  const img = body.value && body.value[0];
  if (!img) return null;
  return { u: img.contentUrl, t: img.thumbnailUrl, a: img.name || '' };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!BING_KEY) { console.error('Missing BING_SEARCH_KEY'); process.exit(1); }
  if (!DRY_RUN && (!REDIS_URL || !REDIS_TOKEN)) { console.error('Missing Redis credentials'); process.exit(1); }

  // Load perfume data
  const richPath = path.join(__dirname, '..', 'public', 'perfumes-rich.js');
  const richSrc = fs.readFileSync(richPath, 'utf8');

  // Extract arrays using eval in a sandboxed scope
  const sandbox = {};
  const fn = new Function('_RB', '_RA', '_RD',
    richSrc.replace(/^var /gm, '') // strip var declarations so assignments go to params
  );
  // Actually, the file uses var declarations. Let's eval carefully.
  const extracted = {};
  const evalSrc = richSrc + '\nextracted._RB=_RB;extracted._RA=_RA;extracted._RD=_RD;';
  eval(evalSrc);

  const _RB = extracted._RB;
  const _RD = extracted._RD;

  console.log(`Loaded ${_RD.length} fragrances, ${_RB.length} brands`);

  // Sort by rating descending, take top N
  const sorted = _RD
    .map((e, i) => ({ name: e[0], brand: _RB[e[1]] || '', rating: e[4] || 0, idx: i }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, TOP_N);

  const batch = sorted.slice(OFFSET, OFFSET + BATCH);
  console.log(`Processing ${batch.length} fragrances (offset=${OFFSET}, batch=${BATCH}, top=${TOP_N})`);

  let success = 0, skipped = 0, failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const frag = batch[i];
    const redisKey = 'fi:' + (frag.name + '|' + frag.brand).toLowerCase();

    // Check if already cached
    if (!DRY_RUN) {
      const existing = await redisGet(redisKey);
      if (existing) {
        console.log(`  [${OFFSET + i}] SKIP (cached): ${frag.name} | ${frag.brand}`);
        skipped++;
        continue;
      }
    }

    if (DRY_RUN) {
      console.log(`  [${OFFSET + i}] DRY-RUN: ${frag.name} | ${frag.brand} (rating: ${frag.rating})`);
      success++;
      continue;
    }

    try {
      const query = frag.name + (frag.brand ? ' ' + frag.brand : '') + ' perfume bottle';
      const result = await searchBing(query);
      if (result) {
        await redisSet(redisKey, result);
        console.log(`  [${OFFSET + i}] OK: ${frag.name} | ${frag.brand}`);
        success++;
      } else {
        console.log(`  [${OFFSET + i}] NO RESULT: ${frag.name} | ${frag.brand}`);
        failed++;
      }
    } catch (err) {
      console.error(`  [${OFFSET + i}] ERROR: ${frag.name} | ${frag.brand}: ${err.message}`);
      failed++;
    }

    // Rate limit: ~3 req/sec to stay well within Bing limits
    await sleep(350);
  }

  console.log(`\nDone. Success: ${success}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
