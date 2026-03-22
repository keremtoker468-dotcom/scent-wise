#!/usr/bin/env node
// Seed Redis with Brave Image Search results for top-rated fragrances.
// Usage: node scripts/seed-images.js [--offset N] [--batch N] [--dry-run]
//
// Environment variables required:
//   BRAVE_SEARCH_KEY          - Brave Search API key
//   UPSTASH_REDIS_REST_URL    - Upstash Redis REST URL
//   UPSTASH_REDIS_REST_TOKEN  - Upstash Redis auth token
//
// Free tier: 1000 Brave queries/month (capped via Redis counter).
// Script auto-stops when monthly quota is reached.

const fs = require('fs');
const path = require('path');

const BRAVE_KEY = process.env.BRAVE_SEARCH_KEY;
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

async function searchBrave(query) {
  const url = `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=1&safesearch=strict&spellcheck=false`;
  const r = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_KEY
    }
  });
  if (!r.ok) throw new Error(`Brave search failed: ${r.status}`);
  const body = await r.json();
  const img = body.results && body.results[0];
  if (!img) return null;
  return {
    u: (img.properties && img.properties.url) || img.url || '',
    t: (img.thumbnail && img.thumbnail.src) || '',
    a: img.title || ''
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Monthly quota tracking (matches api/img.js logic)
const BRAVE_MONTHLY_LIMIT = 1000;

function braveCountKey() {
  const d = new Date();
  return `brave_count:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function getBraveCount() {
  const r = await fetch(`${REDIS_URL}/GET/${encodeURIComponent(braveCountKey())}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  if (!r.ok) return 0;
  const body = await r.json();
  return parseInt(body.result) || 0;
}

async function braveIncrement() {
  const key = braveCountKey();
  await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['INCR', key], ['EXPIRE', key, 3024000]])
  });
}

async function main() {
  if (!BRAVE_KEY) { console.error('Missing BRAVE_SEARCH_KEY'); process.exit(1); }
  if (!DRY_RUN && (!REDIS_URL || !REDIS_TOKEN)) { console.error('Missing Redis credentials'); process.exit(1); }

  // Load perfume data
  const richPath = path.join(__dirname, '..', 'public', 'perfumes-rich.js');
  const richSrc = fs.readFileSync(richPath, 'utf8');

  // Extract arrays using eval
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

  // Show monthly quota status
  if (!DRY_RUN) {
    const currentCount = await getBraveCount();
    const remaining = Math.max(0, BRAVE_MONTHLY_LIMIT - currentCount);
    console.log(`Brave API quota: ${currentCount}/${BRAVE_MONTHLY_LIMIT} used this month (${remaining} remaining)`);
    if (remaining === 0) {
      console.error('Monthly Brave API quota exhausted. Exiting.');
      process.exit(1);
    }
  }

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

    // Check monthly quota before each call
    const count = await getBraveCount();
    if (count >= BRAVE_MONTHLY_LIMIT) {
      console.error(`  Monthly quota reached (${count}/${BRAVE_MONTHLY_LIMIT}). Stopping.`);
      break;
    }

    try {
      const query = frag.name + (frag.brand ? ' ' + frag.brand : '') + ' perfume bottle';
      const result = await searchBrave(query);
      if (result && result.t) {
        await braveIncrement();
        await redisSet(redisKey, result);
        console.log(`  [${OFFSET + i}] OK: ${frag.name} | ${frag.brand} (quota: ${count + 1}/${BRAVE_MONTHLY_LIMIT})`);
        success++;
      } else {
        console.log(`  [${OFFSET + i}] NO RESULT: ${frag.name} | ${frag.brand}`);
        failed++;
      }
    } catch (err) {
      console.error(`  [${OFFSET + i}] ERROR: ${frag.name} | ${frag.brand}: ${err.message}`);
      failed++;
    }

    // Brave free tier: 1 req/sec limit
    await sleep(1100);
  }

  console.log(`\nDone. Success: ${success}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
