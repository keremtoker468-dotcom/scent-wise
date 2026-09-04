/* ScentWise — client
   Plain JS, no build. Talks to the existing Vercel functions under /api.
   Views: home, explore, advisor, celebs, account. Perfume data is loaded
   lazily from /perfumes.js and /perfumes-rich.js on first use. */
(function () {
  'use strict';

  // ───────────────────────── config ─────────────────────────
  const FREE_LIMIT = 3;          // must match server FREE_TRIAL_QUERIES
  const MAX_PAID = 500;          // must match server MAX_MONTHLY_QUERIES
  const HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' };
  const PAGE_SIZE = 24;

  // ───────────────────────── state ─────────────────────────
  const S = {
    tier: 'free', isPaid: false, isOwner: false, email: '', usage: 0, freeUsed: 0, emailGiven: false,
    view: 'home', mode: 'chat', busy: false,
    explore: { q: '', fam: '', gender: '', shown: 0, results: [] },
    photo: null, // { b64, preview }
    celebFilter: ''
  };

  // ───────────────────────── utils ─────────────────────────
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* quota or private mode */ } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* noop */ } };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const track = (name, params) => { try { if (typeof gtag === 'function') gtag('event', name, params || {}); } catch (e) { /* noop */ } };

  function toast(msg, ms) {
    const wrap = $('#toast'); if (!wrap) return;
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, ms || 3200);
  }
  const icon = (id, size, stroke) => `<svg width="${size || 18}" height="${size || 18}" fill="none" stroke="currentColor" stroke-width="${stroke || 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const bottle = (w, h) => `<svg class="bottle" width="${w || 52}" height="${h || 78}" viewBox="0 0 48 72" aria-hidden="true"><use href="#i-bottle"/></svg>`;

  // ───────────────────────── scent families ─────────────────────────
  // Category codes in the data: F Fresh, L Floral, O Oriental, W Woody, S Sweet,
  // A Aromatic, Q Aquatic, U Fruity, M Musky, P Warm Spicy.
  const CAT_NAME = { F: 'Fresh', L: 'Floral', O: 'Amber', W: 'Woody', S: 'Sweet', A: 'Aromatic', Q: 'Aquatic', U: 'Fruity', M: 'Musky', P: 'Warm spicy', '': '' };
  // Filter families (chips) map onto category codes; colours come from famOf().
  const CAT_FAM = { F: 'fresh', Q: 'fresh', L: 'floral', O: 'amber', P: 'amber', W: 'woody', S: 'gourmand', A: 'green', U: 'citrus', M: 'other', '': 'other' };
  const GENDER_NAME = { M: 'For men', F: 'For women', U: 'For everyone', '': '' };
  // Filter families. Rich records (7.9k with accords) are classified by their leading accords, which is
  // far more useful than the single category code; everything else falls back to the category.
  const FAM_LABEL = { fresh: 'Fresh', citrus: 'Fruity', floral: 'Floral', woody: 'Woody', amber: 'Amber', gourmand: 'Sweet', green: 'Aromatic', other: 'Musky' };
  const FAM_ACCORDS = {
    fresh: ['fresh', 'aquatic', 'marine', 'ozonic', 'fresh spicy', 'citrus'],
    citrus: ['fruity', 'tropical', 'citrus', 'cherry'],
    floral: ['floral', 'white floral', 'yellow floral', 'rose', 'tuberose', 'iris', 'violet'],
    woody: ['woody', 'oud', 'conifer', 'earthy', 'mossy', 'patchouli'],
    amber: ['amber', 'warm spicy', 'balsamic', 'animalic', 'leather', 'smoky', 'tobacco', 'oud'],
    gourmand: ['sweet', 'vanilla', 'caramel', 'chocolate', 'cacao', 'coffee', 'honey', 'almond', 'lactonic', 'coconut', 'nutty', 'rum', 'whiskey'],
    green: ['aromatic', 'green', 'herbal', 'anis', 'lavender'],
    other: ['musky', 'powdery', 'soapy', 'aldehydic']
  };
  const ACCORD_FAMS = {};
  Object.keys(FAM_ACCORDS).forEach((f) => FAM_ACCORDS[f].forEach((a) => { (ACCORD_FAMS[a] = ACCORD_FAMS[a] || []).push(f); }));
  function famsFromAccords(accords) {
    const out = []; (accords || []).slice(0, 4).forEach((a) => (ACCORD_FAMS[a] || []).forEach((f) => { if (out.indexOf(f) === -1) out.push(f); }));
    return out;
  }
  const famOf = (codeOrItem) => {
    if (codeOrItem && typeof codeOrItem === 'object') { const it = codeOrItem; if (it.f && it.f.length) return it.f[0]; const r = richOf(it); if (r && r.f && r.f.length) return r.f[0]; return CAT_FAM[it.c] || 'other'; }
    return CAT_FAM[codeOrItem] || 'other';
  };
  const catLabel = (code) => CAT_NAME[code] || '';
  function famLabel(it) { const r = richOf(it); if (r && r.f && r.f.length) return FAM_LABEL[r.f[0]]; return catLabel(it.c) || 'Fragrance'; }
  function hasFam(it, fam) { const r = richOf(it); if (r && r.f && r.f.length) return r.f.indexOf(fam) !== -1; return (CAT_FAM[it.c] || 'other') === fam; }

  // ───────────────────────── database ─────────────────────────
  // ITEMS: every perfume (69k) as {n, b, c, g, k}. RICH: 7.9k records with
  // rating/accords/notes keyed by "name|brand" (lowercase).
  const DB = { items: [], rich: new Map(), richList: [], top: [], byKey: new Map(), popular: [], popRank: new Map(), loaded: false, promise: null };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  function loadDB() {
    if (DB.loaded) return Promise.resolve();
    if (DB.promise) return DB.promise;
    DB.promise = Promise.all([loadScript('/perfumes.js'), loadScript('/perfumes-rich.js'), loadScript('/popular.js').catch(() => {})]).then(decodeDB).catch((err) => {
      console.error(err); DB.loaded = true; toast('Could not load the perfume library. Please retry.');
    });
    return DB.promise;
  }
  function decodeDB() {
    return new Promise((resolve) => {
      if (typeof _SI !== 'undefined' && !DB.items.length) {
        const items = new Array(_SI.length);
        for (let i = 0; i < _SI.length; i++) {
          const p = _SI[i].split('|');
          const n = p[0], b = _SB[+p[1]] || '', c = (p[2] || '').length === 1 ? p[2] : '', g = (p[3] || '').length === 1 ? p[3] : '';
          items[i] = { n, b, c, g, k: (n + ' ' + b).toLowerCase() };
          DB.byKey.set((n + '|' + b).toLowerCase(), items[i]);
        }
        DB.items = items;
      }
      setTimeout(() => {
        if (typeof _RD !== 'undefined' && !DB.rich.size) {
          for (const e of _RD) {
            const rec = { n: e[0], b: _RB[e[1]] || '', c: e[2] || '', g: e[3] || '', r: e[4] || 0, a: (e[5] || []).map((i) => _RA[i]).filter(Boolean), t: e[6] || '' };
            rec.k = (rec.n + '|' + rec.b).toLowerCase();
            rec.words = noteWords(rec.t);
            rec.f = famsFromAccords(rec.a); if (!rec.f.length) rec.f = [CAT_FAM[rec.c] || 'other'];
            DB.rich.set(rec.k, rec);
            DB.richList.push(rec);
          }
          DB.top = DB.richList.slice().sort((a, b) => b.r - a.r);
        }
        // Curated popularity: exact "Name|Brand" keys from popular.js, rank = position.
        (window.SW_POPULAR || []).forEach((k, i) => {
          const key = k.toLowerCase(); const it = DB.byKey.get(key);
          if (it && !DB.popRank.has(key)) {
            DB.popRank.set(key, i); DB.popular.push(it);
            // Rich records sometimes spell the brand differently (e.g. Christian Dior vs Dior); rank those too.
            const rec = DB.rich.get(key) || find(it.n, it.b); if (rec && !DB.popRank.has(rec.k)) DB.popRank.set(rec.k, i);
          }
        });
        DB.loaded = true; resolve();
      }, 0);
    });
  }
  function noteWords(str) {
    if (!str) return new Set();
    const stop = new Set(['and', 'the', 'with', 'for', 'des', 'top', 'mid', 'base', 'from', 'note', 'notes']);
    return new Set(str.toLowerCase().replace(/[;,()]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !stop.has(w)));
  }
  function find(name, brand) {
    if (!name) return null;
    const key = (name + '|' + (brand || '')).toLowerCase();
    if (DB.rich.has(key)) return DB.rich.get(key);
    const nl = name.toLowerCase();
    let best = null;
    for (const rec of DB.richList) {
      const rn = rec.n.toLowerCase();
      if (rn === nl) { if (!brand || rec.b.toLowerCase().includes(brand.toLowerCase())) return rec; if (!best) best = rec; }
    }
    // No prefix fallback: a click on "Sauvage" must never open a flanker's notes.
    return best;
  }
  function itemFor(name, brand) {
    // Any perfume from the big index (no notes), used for images/family colour.
    const nl = String(name || '').toLowerCase(), bl = String(brand || '').toLowerCase();
    let fallback = null;
    for (const it of DB.items) {
      if (it.n.toLowerCase() === nl) { if (!bl || it.b.toLowerCase().includes(bl)) return it; if (!fallback) fallback = it; }
    }
    return fallback;
  }
  // Search: every term must appear in "name brand"; ranked by where it matches.
  function search(q, opts) {
    opts = opts || {};
    const terms = String(q || '').toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    const fam = opts.fam || '', gender = opts.gender || '';
    const out = [];
    const passFilter = (it) => (!fam || hasFam(it, fam)) && (!gender || it.g === gender);
    const popRank = (it) => { const r = DB.popRank.get((it.n + '|' + it.b).toLowerCase()); return r === undefined ? -1 : r; };
    if (!terms.length) {
      // No query: the curated popularity list first, then the best-rated of the rest.
      const seen = new Set();
      for (const it of DB.popular) { if (passFilter(it)) { out.push(it); seen.add((it.n + '|' + it.b).toLowerCase()); } }
      for (const rec of DB.top) { if (!seen.has(rec.k) && passFilter(rec)) out.push(rec); }
      return out;
    }
    const scored = [];
    for (const it of DB.items) {
      if (!passFilter(it)) continue;
      const k = it.k; let ok = true;
      for (const t of terms) { if (k.indexOf(t) === -1) { ok = false; break; } }
      if (!ok) continue;
      const nl = it.n.toLowerCase();
      let score = 0;
      for (const t of terms) { if (nl === t) score += 100; else if (nl.startsWith(t)) score += 60; else if (nl.indexOf(t) !== -1) score += 30; else score += 10; }
      if (DB.rich.has(it.n.toLowerCase() + '|' + it.b.toLowerCase())) score += 15;
      const pr = popRank(it); if (pr >= 0) score += 400 - pr;
      score -= Math.min(20, nl.length / 4);
      scored.push([score, it]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    for (const s of scored) out.push(s[1]);
    return out;
  }
  function richOf(it) { return it.r !== undefined ? it : (DB.rich.get((it.n + '|' + it.b).toLowerCase()) || null); }
  function notesTiers(t) {
    if (!t) return null;
    const parts = t.split(';').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 3) return { top: parts[0], heart: parts[1], base: parts.slice(2).join('; ') };
    if (parts.length === 2) return { top: parts[0], base: parts[1] };
    return { all: parts[0] };
  }
  // Nearest neighbours by accord overlap (Jaccard) with a small note bonus.
  function similarTo(rec, limit) {
    if (!rec || !rec.a || !rec.a.length) return [];
    const ta = new Set(rec.a), tw = rec.words || noteWords(rec.t);
    const scored = [];
    for (const p of DB.richList) {
      if (p === rec || !p.a.length) continue;
      let inter = 0; for (const a of ta) if (p.a.indexOf(a) !== -1) inter++;
      if (!inter) continue;
      const jac = inter / (ta.size + p.a.length - inter);
      let bonus = 0;
      if (tw.size && p.words.size) { let ni = 0; for (const w of tw) if (p.words.has(w)) ni++; bonus = (ni / (tw.size + p.words.size - ni)) * 0.15; }
      const score = jac + bonus;
      if (score > 0.3) scored.push([score, p]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, limit || 6).map((s) => ({ rec: s[1], score: s[0] }));
  }
  function bestMatch(name) {
    const fl = String(name || '').toLowerCase().trim();
    if (fl.length < 3) return null;
    let target = null, best = 0;
    for (const p of DB.richList) {
      const nl = p.n.toLowerCase(); let s = 0;
      if (nl === fl) s = 100; else if (nl.startsWith(fl + ' ')) s = 90 - (nl.length - fl.length); else if (nl.startsWith(fl)) s = 70 - (nl.length - fl.length); else if (fl.length >= 5 && nl.indexOf(fl) !== -1) s = 60 - (nl.length - fl.length);
      if (s > best) { best = s; target = p; }
      if (s === 100) break;
    }
    return best >= 40 ? target : null;
  }
  function dupeGrounding(name) {
    const target = bestMatch(name);
    if (!target || !target.a.length) return '';
    const matches = similarTo(target, 15);
    if (!matches.length) return '';
    let text = `\n\n[DATABASE MATCHES — use these real perfumes from our database as your primary source for recommendations. Prioritize these over your own knowledge. Similarity scores are based on accord & note overlap.]\nOriginal: ${target.n} by ${target.b} | Accords: ${target.a.join(', ')}${target.t ? ' | Notes: ' + target.t : ''}\n\nTop matches by similarity:\n`;
    matches.forEach((m, i) => { text += `${i + 1}. ${m.rec.n} by ${m.rec.b} (score: ${(m.score * 100).toFixed(0)}%) | Accords: ${m.rec.a.join(', ')}${m.rec.t ? ' | Notes: ' + m.rec.t : ''} | Rating: ${m.rec.r}/5\n`; });
    return text;
  }
  function dbContext(query) {
    let results = search(query).slice(0, 20);
    if (!results.length) {
      for (const t of String(query).toLowerCase().split(/\s+/)) { if (t.length > 3) results = results.concat(search(t).slice(0, 10)); }
    }
    if (!results.length) return '';
    const lines = results.slice(0, 15).map((it) => {
      const r = richOf(it); let s = `${it.n} by ${it.b}`;
      if (it.c) s += ` | ${catLabel(it.c)}`; if (it.g) s += ` | ${GENDER_NAME[it.g] || it.g}`;
      if (r && r.t) s += ` | Notes: ${r.t}`; if (r && r.a.length) s += ` | Accords: ${r.a.join(', ')}`; if (r && r.r) s += ` | Rating: ${r.r}/5`;
      return s;
    });
    return '\n\nRelevant perfumes from database:\n' + lines.join('\n');
  }

  // ───────────────────────── images (/api/img proxy) ─────────────────────────
  // Lookups go through a small queue (4 in flight) so a card grid never floods the proxy or
  // the per-IP limits. Hits are remembered in localStorage; misses for 12 hours only.
  const IMG = { mem: new Map(), pending: new Map(), queue: [], active: 0, MAX: 4, NEG_TTL: 12 * 3600 * 1000 };
  function pumpImages() {
    while (IMG.active < IMG.MAX && IMG.queue.length) {
      const job = IMG.queue.shift(); IMG.active++;
      job().finally(() => { IMG.active--; pumpImages(); });
    }
  }
  function imageFor(name, brand) {
    const key = 'sw2_img_' + (name + '|' + (brand || '')).toLowerCase();
    if (IMG.mem.has(key)) return Promise.resolve(IMG.mem.get(key));
    const cached = lsGet(key, undefined);
    if (cached && typeof cached === 'object') {
      if (cached.u) { IMG.mem.set(key, cached.u); return Promise.resolve(cached.u); }
      if (cached.u === null && Date.now() - (cached.t || 0) < IMG.NEG_TTL) return Promise.resolve(null);
    } else if (typeof cached === 'string' && cached) { IMG.mem.set(key, cached); return Promise.resolve(cached); }
    if (IMG.pending.has(key)) return IMG.pending.get(key);
    const p = new Promise((resolve) => {
      IMG.queue.push(async () => {
        try {
          const r = await fetch('/api/img?name=' + encodeURIComponent(name) + '&brand=' + encodeURIComponent(brand || ''), { headers: { 'X-Requested-With': 'ScentWise' } });
          if (r.status === 429) { resolve(null); return; }
          const arr = r.ok ? await r.json() : [];
          const url = Array.isArray(arr) && arr[0] && (arr[0].thumb || arr[0].url) ? (arr[0].thumb || arr[0].url) : null;
          IMG.mem.set(key, url); lsSet(key, { u: url, t: Date.now() }); resolve(url);
        } catch (e) { resolve(null); } finally { IMG.pending.delete(key); }
      });
      pumpImages();
    });
    IMG.pending.set(key, p);
    return p;
  }
  const imgObserver = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
    for (const en of entries) { if (en.isIntersecting) { imgObserver.unobserve(en.target); paintImage(en.target); } }
  }, { rootMargin: '120px' }) : null;
  function paintImage(art) {
    const name = art.getAttribute('data-img-name'), brand = art.getAttribute('data-img-brand') || '';
    if (!name || art.querySelector('img')) return;
    imageFor(name, brand).then((url) => {
      if (!url || art.querySelector('img')) return;
      const img = new Image(); img.alt = ''; img.decoding = 'async';
      img.onload = () => { art.appendChild(img); };
      img.src = url;
    });
  }
  function watchImages(root) {
    $$('[data-img-name]', root || document).forEach((el) => { if (imgObserver) imgObserver.observe(el); else paintImage(el); });
  }

  // ───────────────────────── Amazon (geo-targeted affiliate links) ─────────────────────────
  const _AMZ_GEO = (function () {
    const STORES = {
      de: { domain: 'amazon.de', tag: 'scentwisede20-21' }, fr: { domain: 'amazon.fr', tag: 'scentwisede0e-21' },
      es: { domain: 'amazon.es', tag: 'scentwised09f-21' }, it: { domain: 'amazon.it', tag: 'scentwisede09-21' },
      uk: { domain: 'amazon.co.uk', tag: 'scentwiseuk-21' }, be: { domain: 'amazon.com.be', tag: 'scentwisebe-21' },
      us: { domain: 'amazon.com', tag: 'scentwise20-20' }
    };
    let tz = ''; try { tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase(); } catch (e) { /* noop */ }
    const TZ_MAP = { 'europe/paris': 'fr', 'europe/monaco': 'fr', 'europe/berlin': 'de', 'europe/vienna': 'de', 'europe/zurich': 'de', 'europe/luxembourg': 'de', 'europe/madrid': 'es', 'europe/rome': 'it', 'europe/london': 'uk', 'europe/dublin': 'uk', 'europe/brussels': 'be', 'europe/amsterdam': 'be' };
    if (TZ_MAP[tz]) return STORES[TZ_MAP[tz]];
    const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map((l) => String(l).toLowerCase());
    for (const lang of langs) {
      if (lang === 'nl-be' || lang === 'fr-be') return STORES.be;
      if (lang === 'en-gb' || lang === 'cy-gb') return STORES.uk;
      if (lang.startsWith('de')) return STORES.de; if (lang.startsWith('fr')) return STORES.fr;
      if (lang.startsWith('es')) return STORES.es; if (lang.startsWith('it')) return STORES.it; if (lang.startsWith('nl')) return STORES.be;
    }
    return STORES.us;
  })();
  function amazonLink(name, brand) {
    const q = encodeURIComponent((name || '') + ' ' + (brand || '') + ' perfume');
    return 'https://www.' + _AMZ_GEO.domain + '/s?k=' + q + '&tag=' + _AMZ_GEO.tag;
  }

  // ───────────────────────── likes (local collection) ─────────────────────────
  const LIKES_KEY = 'sw2_collection';
  const likes = new Set(lsGet(LIKES_KEY, []));
  const likeKey = (n, b) => (n + '|' + (b || '')).toLowerCase();
  function toggleLike(n, b) {
    const k = likeKey(n, b);
    if (likes.has(k)) likes.delete(k); else likes.add(k);
    lsSet(LIKES_KEY, Array.from(likes));
    $$('.heart[data-like]').forEach((el) => { el.classList.toggle('is-on', likes.has(el.getAttribute('data-like'))); });
    return likes.has(k);
  }

  // ───────────────────────── card renderers ─────────────────────────
  function famClass(it) { return 'fam-' + famOf(it || {}); }
  function inkClass(it) { return 'ink-' + famOf(it || {}); }
  function popBadge(it) { const r = DB.popRank.get(((it.n || '') + '|' + (it.b || '')).toLowerCase()); return r === undefined ? '' : `<span class="badge pop" title="Curated popularity rank">#${r + 1} popular</span>`; }
  function heartHTML(n, b, extra) {
    const k = likeKey(n, b);
    return `<button class="heart${likes.has(k) ? ' is-on' : ''}${extra ? ' ' + extra : ''}" type="button" data-like="${esc(k)}" data-like-name="${esc(n)}" data-like-brand="${esc(b || '')}" aria-label="Save ${esc(n)}">${icon('heart', 18)}</button>`;
  }
  function pcardHTML(it, opts) {
    opts = opts || {};
    const r = richOf(it);
    const notes = r && r.t ? r.t.replace(/;/g, ' ·').replace(/,/g, ' ·').replace(/\s+and\s+/gi, ' · ') : (r && r.a.length ? r.a.slice(0, 4).join(' · ') : (it.notes || catLabel(it.c)));
    return `<article class="pcard" data-open-name="${esc(it.n)}" data-open-brand="${esc(it.b)}">
      <div class="art ${famClass(it)}" data-img-name="${esc(it.n)}" data-img-brand="${esc(it.b)}">${bottle()}${heartHTML(it.n, it.b)}</div>
      <div class="meta"><div class="name">${esc(it.n)}</div><div class="brand">${esc(it.b)}</div><div class="notes">${esc(notes || '')}</div></div>
      <div class="foot"><span class="fam ${inkClass(it)}">${esc(famLabel(it))}</span><span class="row" style="gap:6px"><button class="icon-btn sm cmp${inCompare(it.n, it.b) ? ' is-on' : ''}" type="button" data-cmp-name="${esc(it.n)}" data-cmp-brand="${esc(it.b)}" aria-label="Add to compare" title="Compare" data-stop>${icon('layers', 16)}</button><button class="btn btn-quiet btn-sm btn-profile" type="button" data-profile-name="${esc(it.n)}" data-profile-brand="${esc(it.b)}" data-stop>Profile</button><a class="btn btn-quiet btn-sm" href="${amazonLink(it.n, it.b)}" target="_blank" rel="noopener sponsored" data-stop>Shop</a></span></div>
    </article>`;
  }
  function rowcardHTML(it, trailing) {
    return `<button class="rowcard" type="button" data-open-name="${esc(it.n)}" data-open-brand="${esc(it.b)}">
      <span class="art ${famClass(it)}" data-img-name="${esc(it.n)}" data-img-brand="${esc(it.b)}">${bottle(22, 33)}</span>
      <span class="meta"><span class="name">${esc(it.n)}</span><span class="brand">${esc(it.b)}${trailing ? ' · ' + esc(trailing) : ''}</span></span>
      ${icon('chev', 18, 2)}
    </button>`;
  }
  function skeletonCards(n) {
    let s = ''; for (let i = 0; i < n; i++) s += `<div class="pcard" aria-hidden="true"><div class="skel" style="height:200px;border-radius:14px"></div><div class="meta"><div class="skel" style="height:16px;width:60%"></div><div class="skel" style="height:12px;width:40%"></div></div></div>`; return s;
  }

  // ───────────────────────── router ─────────────────────────
  const VIEWS = { home: 'ScentWise — AI Fragrance Advisor | Find Your Perfect Perfume', explore: 'Explore 65,000+ Fragrances — ScentWise', advisor: 'AI Fragrance Advisor — ScentWise', celebs: 'Celebrity Fragrances — ScentWise', account: 'Your Account — ScentWise' };
  const PATHS = { '/': 'home', '/index.html': 'home', '/explore': 'explore', '/advisor': 'advisor', '/celebrities': 'celebs', '/account': 'account', '/pricing': 'home', '/how-it-works': 'home', '/profile': 'account', '/profile.html': 'account' };
  const VIEW_PATH = { home: '/', explore: '/explore', advisor: '/advisor', celebs: '/celebrities', account: '/account' };
  const MODE_IDS = ['chat', 'dupe', 'photo', 'zodiac', 'music', 'style', 'celeb'];

  function navigate(path, opts) {
    opts = opts || {};
    const url = new URL(path, location.origin);
    if (opts.replace) history.replaceState(opts.state || null, '', url.pathname + url.search + url.hash);
    else history.pushState(opts.state || null, '', url.pathname + url.search + url.hash);
    route();
  }
  function route() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(location.search);
    let view = PATHS[path] || 'home';
    const mode = params.get('mode');
    if (mode === 'explore') view = 'explore';
    else if (mode && MODE_IDS.indexOf(mode) !== -1) { view = 'advisor'; S.mode = mode; }
    if (params.has('admin')) view = 'account';
    showView(view);
    if (path === '/pricing') scrollToId('pricing');
    else if (path === '/how-it-works') scrollToId('how');
    else if (location.hash && view === 'home') scrollToId(location.hash.slice(1));
  }
  function scrollToId(id) {
    const el = document.getElementById(id); if (!el) return;
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
  function showView(view) {
    S.view = view;
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.getAttribute('data-view') === view));
    $$('[data-nav]').forEach((a) => { if (a.getAttribute('data-nav') === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.title = VIEWS[view] || VIEWS.home;
    if (!location.hash) window.scrollTo({ top: 0 });
    if (view === 'explore') initExplore();
    else if (view === 'advisor') initAdvisor();
    else if (view === 'celebs') initCelebs();
    else if (view === 'account') renderAccount();
    else if (view === 'home') revealHome();
  }
  window.addEventListener('popstate', route);

  // Global click delegation: SPA links, mode tiles, cards, hearts, actions.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-nav]');
    if (a && !e.metaKey && !e.ctrlKey && a.origin === location.origin) {
      e.preventDefault(); navigate(a.getAttribute('href')); return;
    }
    const like = e.target.closest('[data-like]');
    if (like) { e.preventDefault(); e.stopPropagation(); const on = toggleLike(like.getAttribute('data-like-name'), like.getAttribute('data-like-brand')); toast(on ? 'Saved to your collection' : 'Removed from your collection', 1800); return; }
    if (e.target.closest('[data-stop]')) return;
    const modeBtn = e.target.closest('[data-mode]');
    if (modeBtn && !modeBtn.closest('#mode-list') && !modeBtn.closest('#mode-chips')) {
      e.preventDefault(); openAdvisor(modeBtn.getAttribute('data-mode'), modeBtn.getAttribute('data-prompt') || ''); return;
    }
    const act = e.target.closest('[data-action]');
    if (act) { e.preventDefault(); runAction(act.getAttribute('data-action'), act); return; }
    const open = e.target.closest('[data-open-name]');
    if (open) { e.preventDefault(); openSheet(open.getAttribute('data-open-name'), open.getAttribute('data-open-brand') || ''); return; }
  });
  function runAction(name, el) {
    if (name === 'checkout') return checkout(el);
    if (name === 'close-sheet') return closeSheet();
    if (name === 'ask-dupes') return openAdvisor('dupe', el.getAttribute('data-name') || '');
    if (name === 'ask-about') return openAdvisor('chat', el.getAttribute('data-prompt') || '');
    if (name === 'logout') return logout();
    if (name === 'reset-profile') return resetProfile();
    if (name === 'clear-thread') return clearThread();
    if (name === 'open-gate') return showGate(true);
    if (name === 'go-explore') return navigate('/explore');
    if (name === 'open-compare') return openCompareSheet();
    if (name === 'clear-compare') { compareList = []; saveCompare(); return; }
  }

  // ───────────────────────── home ─────────────────────────
  const FEATURED = [
    { n: 'Aventus', b: 'Creed', c: 'F', notes: 'Pineapple · bergamot · birch · musk' },
    { n: 'Santal 33', b: 'Le Labo', c: 'W', notes: 'Sandalwood · cardamom · iris · leather' },
    { n: 'Baccarat Rouge 540', b: 'Maison Francis Kurkdjian', c: 'O', notes: 'Saffron · jasmine · ambergris · cedar' },
    { n: 'Gypsy Water', b: 'Byredo', c: 'A', notes: 'Bergamot · juniper · incense · vanilla' }
  ];
  function initHome() {
    const box = $('#home-featured');
    if (box && !box.children.length) { box.innerHTML = FEATURED.map((f) => pcardHTML(f)).join(''); watchImages(box); }
    const form = $('#hero-form');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); const q = $('#hero-q').value.trim(); openAdvisor('chat', q); });
    if (innerWidth < 520 && $('#hero-q')) $('#hero-q').placeholder = 'A mood, a memory, an occasion…';
    $$('#hero-chips .chip').forEach((c) => c.addEventListener('click', () => openAdvisor(c.getAttribute('data-mode') || 'chat', c.getAttribute('data-prompt') || c.textContent.trim())));
    $$('.section, .band, #pricing, #guides, #faq').forEach((el) => el.classList.add('reveal'));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { rootMargin: '-40px' });
      $$('.reveal').forEach((el) => io.observe(el));
    } else { $$('.reveal').forEach((el) => el.classList.add('in')); }
  }
  function revealHome() { setTimeout(() => $$('.reveal').forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight) el.classList.add('in'); }), 30); }
  function renderTrust() {
    const el = $('#hero-trust'); if (!el) return;
    if (S.isOwner) el.textContent = 'Owner access. Unlimited queries.';
    else if (S.isPaid) el.textContent = `Lifetime access active. ${Math.max(0, MAX_PAID - S.usage)} of ${MAX_PAID} queries left this month.`;
    else if (S.freeUsed >= FREE_LIMIT) el.textContent = 'Free picks used. Lifetime access is $10, once.';
    else el.textContent = S.freeUsed ? `${FREE_LIMIT - S.freeUsed} free pick${FREE_LIMIT - S.freeUsed === 1 ? '' : 's'} left. Then $10 once for lifetime access.` : 'One free pick, no sign-up. Then $10 once for lifetime access.';
    const cta = $('#nav-cta');
    if (cta) { if (S.isPaid) { cta.textContent = 'Account'; cta.setAttribute('href', '/account'); cta.setAttribute('data-nav', 'account'); } else { cta.textContent = 'Try free'; cta.setAttribute('href', '/advisor'); cta.setAttribute('data-nav', 'advisor'); } }
  }

  // ───────────────────────── explore ─────────────────────────
  let exploreReady = false;
  function initExplore() {
    const status = $('#explore-status');
    if (!exploreReady) {
      exploreReady = true;
      const q = $('#explore-q');
      q.addEventListener('input', debounce(() => { S.explore.q = q.value.trim(); $('#explore-clear').hidden = !q.value; runExplore(); }, 160));
      $('#explore-form').addEventListener('submit', (e) => { e.preventDefault(); S.explore.q = q.value.trim(); runExplore(); });
      $('#explore-clear').addEventListener('click', () => { q.value = ''; S.explore.q = ''; $('#explore-clear').hidden = true; runExplore(); q.focus(); });
      $$('#family-chips .chip').forEach((c) => c.addEventListener('click', () => { S.explore.fam = c.getAttribute('data-fam'); $$('#family-chips .chip').forEach((x) => x.setAttribute('aria-pressed', x === c ? 'true' : 'false')); runExplore(); }));
      $$('#gender-chips .chip').forEach((c) => c.addEventListener('click', () => { S.explore.gender = c.getAttribute('data-gender'); $$('#gender-chips .chip').forEach((x) => x.setAttribute('aria-pressed', x === c ? 'true' : 'false')); runExplore(); }));
      $('#explore-more').addEventListener('click', () => renderExploreChunk());
    }
    if (!DB.loaded) { $('#explore-results').innerHTML = skeletonCards(8); if (status) status.textContent = 'Loading the library…'; }
    loadDB().then(runExplore);
  }
  function runExplore() {
    if (!DB.loaded) return;
    const st = S.explore;
    st.results = search(st.q, { fam: st.fam, gender: st.gender });
    st.shown = 0;
    $('#explore-results').innerHTML = '';
    const status = $('#explore-status');
    if (!st.results.length) {
      status.textContent = 'No matches.';
      $('#explore-results').innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="t-head">Nothing matched “${esc(st.q)}”.</span><span>Try a brand, a note like “vanilla”, or fewer words.</span><button class="btn btn-quiet btn-md" type="button" data-action="ask-about" data-prompt="${esc('Recommend fragrances similar to ' + st.q)}">Ask the advisor instead</button></div>`;
      $('#explore-more').hidden = true; return;
    }
    const famName = st.fam ? FAM_LABEL[st.fam] : '';
    status.textContent = st.q ? `${st.results.length.toLocaleString()} result${st.results.length === 1 ? '' : 's'} for “${st.q}”${famName ? ' · ' + famName : ''}` : (famName ? `${st.results.length.toLocaleString()} ${famName.toLowerCase()} picks, most popular first · ${DB.items.length.toLocaleString()} fragrances in the library` : `Most popular first · ${DB.items.length.toLocaleString()} fragrances in the library`);
    renderExploreChunk();
  }
  function renderExploreChunk() {
    const st = S.explore; const slice = st.results.slice(st.shown, st.shown + PAGE_SIZE);
    const frag = document.createElement('div'); frag.innerHTML = slice.map((it) => pcardHTML(it)).join('');
    const grid = $('#explore-results');
    while (frag.firstChild) grid.appendChild(frag.firstChild);
    st.shown += slice.length;
    $('#explore-more').hidden = st.shown >= st.results.length;
    watchImages(grid);
  }

  // ───────────────────────── perfume detail sheet ─────────────────────────
  let sheetLastFocus = null;
  function openSheet(name, brand) {
    const sheet = $('#sheet'); sheetLastFocus = document.activeElement;
    sheet.hidden = false; document.body.style.overflow = 'hidden';
    sheet.innerHTML = `<div class="sheet"><div class="art fam-other"><div class="skel" style="position:absolute;inset:0;border-radius:0"></div></div><div class="body"><div class="skel" style="height:28px;width:60%"></div><div class="skel" style="height:16px;width:40%"></div></div></div>`;
    loadDB().then(() => renderSheet(name, brand));
  }
  function renderSheet(name, brand) {
    const sheet = $('#sheet'); if (sheet.hidden) return;
    const rec = find(name, brand);
    const it = rec || itemFor(name, brand) || { n: name, b: brand, c: '', g: '' };
    const feat = FEATURED.find((f) => f.n.toLowerCase() === String(name).toLowerCase());
    const tiers = rec ? notesTiers(rec.t) : null;
    const sims = rec ? similarTo(rec, 6) : [];
    const cheaper = sims.filter((s) => s.rec.b !== it.b).slice(0, 4);
    const chips = [];
    if (it.c) chips.push(`<span class="chip ${famClass(it)}" style="height:32px;font-size:13px;font-weight:600"><span class="dot" style="background:currentColor"></span>${esc(catLabel(it.c))}</span>`);
    if (it.g) chips.push(`<span class="chip" style="height:32px;font-size:13px;font-weight:600;color:var(--fg2)">${esc(GENDER_NAME[it.g] || '')}</span>`);
    if (rec && rec.r) chips.push(`<span class="chip" style="height:32px;font-size:13px;font-weight:600;color:var(--fg2)">${rec.r.toFixed(1)} / 5</span>`);
    const pb = popBadge(it); if (pb) chips.push(pb);
    let notesHTML = '';
    if (tiers) {
      notesHTML = `<div class="stack" style="gap:10px"><span class="t-head" style="font-size:17px">Notes</span><div class="notes-table">${tiers.top ? `<div><b>Top</b><span>${esc(tiers.top)}</span></div>` : ''}${tiers.heart ? `<div><b>Heart</b><span>${esc(tiers.heart)}</span></div>` : ''}${tiers.base ? `<div><b>Base</b><span>${esc(tiers.base)}</span></div>` : ''}${tiers.all ? `<div><b>Notes</b><span>${esc(tiers.all)}</span></div>` : ''}</div></div>`;
    } else if (feat) {
      notesHTML = `<div class="stack" style="gap:10px"><span class="t-head" style="font-size:17px">Notes</span><div class="notes-table"><div><b>Notes</b><span>${esc(feat.notes)}</span></div></div></div>`;
    }
    const accords = rec && rec.a.length ? `<div class="stack" style="gap:10px"><span class="t-head" style="font-size:17px">Accords</span><div class="chips">${rec.a.slice(0, 8).map((a) => `<span class="chip" style="height:36px;font-size:13px">${esc(a)}</span>`).join('')}</div></div>` : '';
    const simHTML = cheaper.length ? `<div class="stack" style="gap:10px"><div class="row" style="justify-content:space-between"><span class="t-head" style="font-size:17px">Smells close</span><button class="btn btn-text btn-sm" type="button" data-action="ask-dupes" data-name="${esc(it.n + ' by ' + it.b)}">Find cheaper twins</button></div><div class="stack" style="gap:8px">${cheaper.map((s) => rowcardHTML(s.rec, Math.min(99, Math.round(s.score * 100)) + '% match')).join('')}</div></div>` : `<div class="stack" style="gap:10px"><span class="t-call muted">No note data for this one yet. The advisor can still find alternatives.</span><button class="btn btn-quiet btn-md" type="button" data-action="ask-dupes" data-name="${esc(it.n + ' by ' + it.b)}" style="align-self:flex-start">Find cheaper twins</button></div>`;
    sheet.innerHTML = `<div class="sheet" role="document">
      <div class="hero-art ${famClass(it)}" data-img-name="${esc(it.n)}" data-img-brand="${esc(it.b)}">${bottle(88, 132)}${heartHTML(it.n, it.b, 'icon-btn glass')}<button class="icon-btn glass close" type="button" data-action="close-sheet" aria-label="Close">${icon('close', 20, 2)}</button></div>
      <div class="body">
        <div class="stack" style="gap:12px"><div class="stack" style="gap:4px"><span class="eyebrow">${esc(it.b)}</span><h2 class="t-3">${esc(it.n)}</h2></div><div class="chips">${chips.join('')}</div></div>
        ${notesHTML}${accords}
        <div class="stack" style="gap:10px" id="sheet-profile" data-name="${esc(it.n)}" data-brand="${esc(it.b)}">${profileSectionHTML(it.n, it.b)}</div>
        ${simHTML}
        <div class="actions"><a class="btn btn-primary btn-lg" href="${amazonLink(it.n, it.b)}" target="_blank" rel="noopener sponsored" style="flex:1">${icon('bag', 18)}Shop on Amazon</a><button class="btn btn-quiet btn-lg cmp${inCompare(it.n, it.b) ? ' is-on' : ''}" type="button" data-cmp-name="${esc(it.n)}" data-cmp-brand="${esc(it.b)}">${icon('layers', 18)}Compare</button></div>
        <span class="t-cap muted-2" style="text-align:center">Affiliate link. You pay the same.</span>
      </div></div>`;
    watchImages(sheet);
    const closeBtn = $('.close', sheet); if (closeBtn) closeBtn.focus();
    if (S.profileWanted && S.profileWanted === likeKey(it.n, it.b)) { S.profileWanted = null; loadProfileInto(it.n, it.b); }
  }
  function closeSheet() {
    const sheet = $('#sheet'); if (sheet.hidden) return;
    sheet.hidden = true; sheet.innerHTML = ''; document.body.style.overflow = '';
    if (sheetLastFocus && sheetLastFocus.focus) sheetLastFocus.focus();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  document.addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

  // ───────────────────────── advisor ─────────────────────────
  const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const MODES = {
    chat: { title: 'Describe it', hint: 'Tell the advisor what you want in plain words.', placeholder: 'A mood, an occasion, a fragrance you love…', presets: ['Fresh and clean for the office, nothing loud', 'Something warm for autumn evenings, not too sweet', 'A signature scent that gets compliments but stays close to skin'] },
    dupe: { title: 'Find it for less', hint: 'Name a fragrance, get affordable alternatives with the same notes.', placeholder: 'Which fragrance do you want a cheaper twin of?', presets: ['Baccarat Rouge 540', 'Creed Aventus', 'Dior Sauvage', 'Le Labo Santal 33', 'Tom Ford Lost Cherry', 'YSL Libre'] },
    photo: { title: 'Scan a photo', hint: 'An outfit, a room, a place. The aesthetic becomes a scent brief.', placeholder: 'Optional: anything the photo does not show', presets: [] },
    zodiac: { title: 'Zodiac match', hint: 'Your birthday, read as a scent profile.', placeholder: 'Your sign or birthday, for example 14 March', presets: SIGNS },
    music: { title: 'Music match', hint: 'The genres you play, translated into notes.', placeholder: 'Artists or genres you play most', presets: ['Hip-hop', 'Jazz', 'Indie rock', 'Electronic', 'Classical', 'R&B'] },
    style: { title: 'Style match', hint: 'Fashion and aesthetic, turned into fragrance.', placeholder: 'Describe your style: brands, fits, colours', presets: ['Old money', 'Streetwear', 'Minimalist', 'Dark academia', 'Coastal', 'Y2K'] },
    celeb: { title: 'Celebrity picks', hint: 'What 101 celebrities actually wear. Type a name.', placeholder: 'A celebrity name, for example Rihanna', presets: [] }
  };
  const CHAT_SYS = 'You are ScentWise AI, the world\'s most knowledgeable fragrance advisor, powered by a database of over 65,000 real perfumes with actual notes, accords, and ratings. You ALWAYS give confident, specific recommendations with real fragrance names, notes, and details. You never say you are under development or that your database is not operational. When users mention something about the site or numbers, respond helpfully. Format recommendations clearly with fragrance name, brand, key notes, and why it matches. Keep responses concise but informative. Never apologize for lacking data — you have one of the largest fragrance databases in the world. ';

  const threads = {};
  const threadKey = (m) => 'sw2_thread_' + m;
  function getThread(mode) { if (!threads[mode]) threads[mode] = lsGet(threadKey(mode), []); return threads[mode]; }
  function saveThread(mode) { const t = getThread(mode); if (t.length > 40) t.splice(0, t.length - 40); lsSet(threadKey(mode), t.map((m) => Object.assign({}, m, { preview: undefined }))); }
  function clearThread() { const m = S.mode; threads[m] = []; lsDel(threadKey(m)); S.photo = null; renderThread(); toast('Conversation cleared', 1600); }

  let advisorReady = false;
  function initAdvisor() {
    if (!advisorReady) {
      advisorReady = true;
      S.mode = MODE_IDS.indexOf(S.mode) !== -1 ? S.mode : (lsGet('sw2_mode', 'chat') || 'chat');
      $$('#mode-list .mode').forEach((b) => b.addEventListener('click', () => setMode(b.getAttribute('data-mode'))));
      const chips = $('#mode-chips');
      chips.innerHTML = MODE_IDS.map((id) => `<button class="chip" type="button" data-mode-chip="${id}">${esc(MODES[id].title)}</button>`).join('');
      $$('[data-mode-chip]', chips).forEach((b) => b.addEventListener('click', () => setMode(b.getAttribute('data-mode-chip'))));
      const form = $('#composer'), ta = $('#composer-input');
      form.addEventListener('submit', (e) => { e.preventDefault(); const t = ta.value.trim(); if (!t && !(S.mode === 'photo' && S.photo)) return; ta.value = ''; autosize(ta); sendMessage(t); });
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
      ta.addEventListener('input', () => autosize(ta));
      setupPhoto();
    }
    setMode(S.mode, true);
    loadDB();
  }
  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; }
  function setMode(mode, silent) {
    if (!MODES[mode]) mode = 'chat';
    S.mode = mode; lsSet('sw2_mode', mode);
    $$('#mode-list .mode').forEach((b) => { if (b.getAttribute('data-mode') === mode) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    $$('#mode-chips .chip').forEach((b) => b.setAttribute('aria-pressed', b.getAttribute('data-mode-chip') === mode ? 'true' : 'false'));
    $('#mode-title').textContent = MODES[mode].title; $('#mode-hint').textContent = MODES[mode].hint;
    $('#composer-input').placeholder = MODES[mode].placeholder;
    $('#dropzone').hidden = mode !== 'photo';
    $('#composer-note').textContent = mode === 'celeb' ? 'Lists come from published interviews and features. Availability changes.' : 'Answers can be wrong. Check the notes and try a sample before you buy.';
    if (mode === 'celeb') loadCelebs().then(renderThread); else renderThread();
    if (!silent) $('#composer-input').focus();
    renderMeter();
  }
  function openAdvisor(mode, prompt) {
    S.mode = MODES[mode] ? mode : 'chat';
    navigate('/advisor');
    if (prompt) { if (S.mode === 'chat' || S.mode === 'dupe' || S.mode === 'celeb') sendMessage(prompt); else { $('#composer-input').value = prompt; autosize($('#composer-input')); } }
  }

  // ---- thread rendering ----
  function renderThread() {
    const box = $('#thread'); if (!box) return;
    const t = getThread(S.mode);
    let html = '';
    if (!t.length) html += starterHTML();
    t.forEach((m, i) => { html += m.role === 'user' ? userHTML(m) : aiHTML(m, i); });
    if (S.busy && S.busyMode === S.mode) html += `<div class="typing" aria-label="Thinking"><i></i><i></i><i></i></div>`;
    box.innerHTML = html;
    watchImages(box);
    if (S.scrollNext && box.lastElementChild) { S.scrollNext = false; box.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
  function starterHTML() {
    const m = MODES[S.mode];
    if (S.mode === 'celeb') {
      const names = (window.SW_CELEBS || []).slice(0, 14).map((c) => c.name);
      return `<div class="stack" style="gap:12px"><span class="t-call muted">Pick a name, or type one.</span><div class="chips">${names.map((n) => `<button class="chip" type="button" data-preset="${esc(n)}">${esc(n)}</button>`).join('')}<a class="chip ghost" href="/celebrities" data-nav="celebs">All 101</a></div></div>`;
    }
    if (S.mode === 'photo') return `<div class="stack" style="gap:8px"><span class="t-call muted">Add a photo below. Your outfit, your room, a place you love. It is analysed once and not stored.</span></div>`;
    if (!m.presets.length) return '';
    return `<div class="stack" style="gap:12px"><span class="t-call muted">${S.mode === 'chat' ? 'Try one of these, or write your own.' : 'Pick one, or type your own.'}</span><div class="chips">${m.presets.map((p) => `<button class="chip" type="button" data-preset="${esc(p)}">${esc(p)}</button>`).join('')}</div></div>`;
  }
  document.addEventListener('click', (e) => {
    const p = e.target.closest('[data-preset]'); if (!p) return;
    e.preventDefault(); sendMessage(p.getAttribute('data-preset'), { preset: true });
  });
  function userHTML(m) {
    const img = m.preview ? `<img src="${m.preview}" alt="Your photo" style="max-height:140px;border-radius:12px;margin-bottom:8px;display:block">` : (m.hasImage ? `<span class="t-foot" style="opacity:.7;display:block;margin-bottom:4px">Photo</span>` : '');
    return `<div class="msg-user">${img}${esc(m.text || (m.hasImage ? 'Analyse this style' : ''))}</div>`;
  }
  function aiHTML(m, idx) {
    if (m.kind === 'paywall') return paywallHTML(m);
    if (m.kind === 'error') return `<div class="msg-ai"><div class="alert error">${esc(m.text)}</div>${m.retry ? `<div><button class="btn btn-quiet btn-md" type="button" data-retry="${idx}">${icon('refresh', 16)}Try again</button></div>` : ''}</div>`;
    if (m.kind === 'celeb') return celebAnswerHTML(m);
    if (m.kind === 'note') return `<div class="msg-ai"><div class="intro">${formatInline(m.text)}</div></div>`;
    const locked = !!m.teaser && !S.isPaid && !S.emailGiven;
    const parsed = parseAI(m.text || '');
    let html = '<div class="msg-ai">';
    if (!parsed) {
      if (locked) {
        const split = splitTeaser(m.text);
        html += `<div class="intro">${formatInline(split.visible)}</div>`;
        if (split.hidden) html += `<div class="rec is-locked" style="padding:20px"><div class="intro">${formatInline(split.hidden)}</div></div>${gateHTML()}`;
      } else html += `<div class="intro">${formatInline(m.text)}</div>`;
    } else {
      if (parsed.intro) html += `<div class="intro">${formatInline(parsed.intro)}</div>`;
      html += `<div class="recs">${parsed.picks.map((p, i) => recHTML(p, locked && i >= 2)).join('')}</div>`;
      if (locked && parsed.picks.length > 2) html += gateHTML();
      if (parsed.outro) html += `<div class="intro t-call muted">${formatInline(parsed.outro)}</div>`;
    }
    html += feedbackHTML(idx, m) + '</div>';
    return html;
  }
  function recHTML(p, locked) {
    const rec = DB.loaded ? find(p.name, p.brand) : null;
    const it = rec || (DB.loaded ? itemFor(p.name, p.brand) : null) || { n: p.name, b: p.brand, c: '' };
    const notes = p.notes || (rec && rec.t ? rec.t.replace(/;/g, ' ·') : '');
    const risk = p.risk ? `<span class="badge" style="align-self:flex-start;color:${/low/i.test(p.risk) ? 'var(--ok)' : (/test|polar/i.test(p.risk) ? 'var(--danger)' : 'var(--fg2)')}">${esc(p.risk.replace(/\.$/, ''))}</span>` : '';
    const scores = p.scores ? `<div class="scores">${Object.keys(p.scores).map((k) => `<span>${esc(k)} ${p.scores[k]}/5</span>`).join('')}</div>` : '';
    const similar = p.similar ? `<div class="notes">Similar to ${formatInline(p.similar)}</div>` : '';
    const extra = !p.why && p.extra ? `<div class="why">${formatInline(p.extra)}</div>` : '';
    const inner = `<div class="art ${famClass(it)}" ${locked ? '' : `data-img-name="${esc(p.name)}" data-img-brand="${esc(p.brand)}"`}>${bottle(40, 60)}</div>
      <div class="stack" style="gap:8px;min-width:0;flex:1">
        <div class="meta"><div class="stack"><div class="name" style="font-size:17px;font-weight:600;line-height:1.3">${esc(p.name)}</div><div class="brand" style="font-size:14px;color:var(--fg2)">${esc(p.brand)}</div></div>
        ${p.why ? `<div class="why">${formatInline(p.why)}</div>` : ''}${extra}${notes ? `<div class="notes">${esc(notes)}</div>` : ''}${similar}${risk}${scores}</div>
        <div class="foot"><button class="btn btn-text btn-sm" type="button" data-action="ask-dupes" data-name="${esc(p.name + (p.brand ? ' by ' + p.brand : ''))}" data-stop>Similar for less</button><span class="row" style="gap:6px">${heartHTML(p.name, p.brand, 'icon-btn sm')}<button class="icon-btn sm cmp${inCompare(p.name, p.brand) ? ' is-on' : ''}" type="button" data-cmp-name="${esc(p.name)}" data-cmp-brand="${esc(p.brand)}" aria-label="Add to compare" title="Compare" data-stop>${icon('layers', 16)}</button><a class="btn btn-quiet btn-sm" href="${amazonLink(p.name, p.brand)}" target="_blank" rel="noopener sponsored" data-stop>Shop</a></span></div>
      </div>`;
    return `<article class="rec${locked ? ' is-locked' : ''}" ${locked ? 'aria-hidden="true"' : `data-open-name="${esc(p.name)}" data-open-brand="${esc(p.brand)}"`}>${inner}</article>`;
  }
  function feedbackHTML(idx, m) {
    if (m.kind || !/\*\*[^*]{3,}\*\*/.test(m.text || '')) return '';
    return `<div class="feedback"><span class="t-foot muted-2">Was this useful?</span><button class="icon-btn sm" type="button" data-rate="${idx}" data-liked="1" aria-label="Useful" style="border:1px solid var(--line)">${icon('up', 16)}</button><button class="icon-btn sm" type="button" data-rate="${idx}" data-liked="0" aria-label="Not useful" style="border:1px solid var(--line)">${icon('down', 16)}</button><button class="btn btn-text btn-sm" type="button" data-preset="${esc(S.mode === 'dupe' ? 'Show me more dupes, cheaper if possible' : 'Show me more picks in the same direction')}">Show more</button></div>`;
  }
  function gateHTML() {
    return `<div class="gate" id="gate">
      <div class="stack" style="gap:4px"><span class="t-head" style="font-size:17px">Unlock the rest of these picks</span><span class="t-call muted">Add your email for the two remaining free picks. Or skip the limit entirely with lifetime access, $10 once.</span></div>
      <form class="row" style="gap:8px;flex-wrap:wrap" id="gate-form"><input class="input" type="email" name="email" placeholder="you@example.com" required autocomplete="email" style="flex:1;min-width:200px"><button class="btn btn-primary" type="submit">Unlock picks</button><button class="btn btn-text" type="button" data-action="checkout">Lifetime access</button></form>
      <span class="t-cap muted-2">Occasional fragrance guides by email. Unsubscribe any time.</span></div>`;
  }
  function paywallHTML(m) {
    return `<div class="msg-ai"><div class="gate"><div class="stack" style="gap:4px"><span class="t-head" style="font-size:17px">${esc(m.title || 'You have used your free picks.')}</span><span class="t-call muted">${esc(m.text || 'Lifetime access is $10, once: all seven modes and 500 queries a month.')}</span></div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="button" data-action="checkout">Get lifetime access · $10</button><a class="btn btn-quiet" href="/account" data-nav="account">I already paid</a></div></div></div>`;
  }
  function showGate() { const g = $('#gate'); if (g) { g.scrollIntoView({ behavior: 'smooth', block: 'center' }); const i = $('input', g); if (i) i.focus(); } }
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'gate-form') return;
    e.preventDefault();
    const email = e.target.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email address.'); return; }
    const btn = $('button[type=submit]', e.target); btn.disabled = true;
    try {
      const r = await fetch('/api/subscribe', { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify({ email, action: 'gate' }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save your email.');
      S.emailGiven = true; track('email_captured', { method: 'gate' });
      MODE_IDS.forEach((m) => { const t = getThread(m); let ch = false; t.forEach((x) => { if (x.teaser) { x.teaser = false; ch = true; } }); if (ch) saveThread(m); });
      toast('Unlocked. Enjoy the picks.'); renderThread(); renderMeter(); renderTrust();
    } catch (err) { toast(err.message || 'Could not save your email.'); btn.disabled = false; }
  });
  document.addEventListener('click', async (e) => {
    const rt = e.target.closest('[data-rate]');
    if (rt) {
      const idx = +rt.getAttribute('data-rate'), liked = rt.getAttribute('data-liked') === '1';
      const m = getThread(S.mode)[idx]; if (!m) return;
      rt.closest('.feedback').innerHTML = `<span class="t-foot muted-2">${liked ? 'Noted. The advisor will lean this way.' : 'Noted. The advisor will steer away from these.'}</span>`;
      const parsed = parseAI(m.text || ''); const names = parsed ? parsed.picks.slice(0, 5).map((p) => p.name + (p.brand ? ' by ' + p.brand : '')) : [];
      for (const n of names) { try { await fetch('/api/check-tier?action=profile', { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify({ fragranceName: n, aiText: (m.text || '').slice(0, 3000), liked }) }); } catch (err) { /* profile feedback is best effort */ } }
      return;
    }
    const retry = e.target.closest('[data-retry]');
    if (retry) { const t = getThread(S.mode); const idx = +retry.getAttribute('data-retry'); const prev = t[idx - 1]; if (prev && prev.role === 'user') { t.splice(idx - 1, 2); saveThread(S.mode); sendMessage(prev.text || '', { preset: prev.preset, keepPhoto: prev.hasImage }); } }
  });

  // ---- text formatting (fallback + inline) ----
  function formatInline(text) {
    let s = esc(text || '');
    s = s.replace(/\*\*(.+?)\*\*/g, (m, name) => {
      const by = name.match(/^(.+?)\s+by\s+(.+)$/i);
      if (!by) return `<strong>${name}</strong>`;
      return `<button class="frag" type="button" data-open-name="${esc(by[1].trim())}" data-open-brand="${esc(by[2].trim())}" style="font-weight:600;color:var(--accent);text-decoration:underline;text-underline-offset:3px">${name}</button>`;
    });
    s = s.replace(/^(WHY IT MATCHES YOU|BLIND BUY RISK|SIMILAR TO|SCORES):/gim, '<span class="t-foot muted-2">$1:</span>');
    return s.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }
  function splitTeaser(text) {
    const m = String(text || '').match(/\n\s*(?:[3-9]|[1-9]\d+)[.)]\s/);
    if (!m) return { visible: text, hidden: '' };
    return { visible: text.slice(0, m.index), hidden: text.slice(m.index + 1) };
  }
  function parseScores(val) {
    const out = {}; const re = /(Longevity|Projection|Uniqueness|Versatility|Sillage)\s*:?\s*(\d(?:\.\d)?)\s*\/\s*5/gi; let m;
    while ((m = re.exec(val))) out[m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()] = m[2];
    return Object.keys(out).length ? out : null;
  }
  function parseAI(text) {
    if (!text) return null;
    const lines = text.replace(/\r/g, '').split('\n');
    const picks = []; const intro = []; let cur = null;
    for (const line of lines) {
      const m = line.match(/^\s*(\d{1,2})[.)]\s+(.*)$/);
      if (m && /\*\*.+?\*\*/.test(m[2]) && (+m[1] === picks.length + 1 || (!picks.length && +m[1] === 1))) { cur = { head: m[2], body: [] }; picks.push(cur); continue; }
      if (!cur) intro.push(line); else cur.body.push(line);
    }
    if (!picks.length) return null;
    const last = picks[picks.length - 1]; let outro = [];
    let bi = -1; for (let i = last.body.length - 1; i >= 0; i--) { if (!last.body[i].trim()) { bi = i; break; } }
    if (bi > 0) { const tail = last.body.slice(bi + 1); if (tail.length && !tail.some((l) => /^(WHY|BLIND|SIMILAR|SCORES|\d+[.)])/i.test(l.trim()))) { outro = tail; last.body = last.body.slice(0, bi); } }
    return { intro: intro.join('\n').trim(), outro: outro.join('\n').trim(), picks: picks.map(parsePick) };
  }
  function parsePick(p) {
    const bm = p.head.match(/\*\*(.+?)\*\*/);
    const full = (bm ? bm[1] : p.head).replace(/\*+/g, '').trim();
    const by = full.match(/^(.+?)\s+by\s+(.+)$/i);
    const name = (by ? by[1] : full).trim(), brand = by ? by[2].trim() : '';
    let notes = bm ? p.head.slice(p.head.indexOf(bm[0]) + bm[0].length) : '';
    notes = notes.replace(/^[\s—–:-]+/, '').replace(/\*\*/g, '').trim();
    const f = { why: '', risk: '', similar: '', scores: null }; const other = []; let current = null;
    const labelRe = /^(WHY IT MATCHES YOU|WHY THIS MATCHES|MATCHES YOUR PROFILE|WHY IT MATCHES|BLIND BUY RISK|SIMILAR TO|SCORES)\s*:\s*(.*)$/i;
    for (const raw of p.body) {
      const line = raw.replace(/^\s*[-•]\s*/, '').trim(); if (!line) { current = null; continue; }
      const lm = line.match(labelRe);
      if (lm) { const key = lm[1].toUpperCase();
        if (key.indexOf('WHY') === 0 || key.indexOf('MATCHES') === 0) { f.why = lm[2]; current = 'why'; }
        else if (key.indexOf('BLIND') === 0) { f.risk = lm[2]; current = null; }
        else if (key.indexOf('SIMILAR') === 0) { f.similar = lm[2]; current = 'similar'; }
        else { f.scores = parseScores(lm[2]); current = null; }
        continue; }
      if (/^\d+[.)]\s/.test(line)) { other.push(line.replace(/^\d+[.)]\s*/, '')); current = null; continue; }
      if (current) { f[current] += ' ' + line; continue; }
      other.push(line);
    }
    return { name, brand, notes: notes.slice(0, 160), why: f.why.trim(), risk: f.risk.trim(), similar: f.similar.trim(), scores: f.scores, extra: other.join('\n').trim() };
  }

  // ---- sending ----
  function canUseAI() { return S.isPaid || S.isOwner || S.freeUsed < FREE_LIMIT; }
  function monthName(i) { return ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][i]; }
  function signFromText(text) {
    const t = String(text || '').toLowerCase();
    for (const s of SIGNS) if (t.indexOf(s.toLowerCase()) !== -1) return s;
    let d = null, mo = null;
    for (let i = 0; i < 12; i++) { const mn = monthName(i); const re1 = new RegExp('(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s*(?:of\\s*)?' + mn.slice(0, 3) + '[a-z]*'); const re2 = new RegExp(mn.slice(0, 3) + '[a-z]*\\s*(\\d{1,2})'); const m = t.match(re1) || t.match(re2); if (m) { d = +m[1]; mo = i + 1; break; } }
    if (!d) { const m = t.match(/(\d{1,2})[\/.](\d{1,2})/); if (m) { const a = +m[1], b = +m[2]; if (a > 12 && b <= 12) { d = a; mo = b; } else if (b > 12 && a <= 12) { d = b; mo = a; } else { d = a; mo = b; } } }
    if (!d || !mo) return null;
    const cut = [[1, 20, 'Capricorn', 'Aquarius'], [2, 19, 'Aquarius', 'Pisces'], [3, 21, 'Pisces', 'Aries'], [4, 20, 'Aries', 'Taurus'], [5, 21, 'Taurus', 'Gemini'], [6, 21, 'Gemini', 'Cancer'], [7, 23, 'Cancer', 'Leo'], [8, 23, 'Leo', 'Virgo'], [9, 23, 'Virgo', 'Libra'], [10, 23, 'Libra', 'Scorpio'], [11, 22, 'Scorpio', 'Sagittarius'], [12, 22, 'Sagittarius', 'Capricorn']];
    const c = cut[mo - 1]; return d < c[1] ? c[2] : c[3];
  }
  function lastAiText(t) { for (let i = t.length - 1; i >= 0; i--) if (t[i].role === 'ai' && !t[i].kind && t[i].text) return t[i].text; return ''; }
  function buildPayload(mode, text, opts, t) {
    const prevAi = lastAiText(t);
    const wrap = (ctxLabel, res) => `Context: ${ctxLabel}:\n${res}\n\nFollow-up question: ${text}`;
    if (mode === 'chat') {
      const history = t.filter((m) => !m.kind && (m.role === 'user' || m.role === 'ai') && m.text).slice(-12).map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
      const ctx = DB.loaded ? dbContext(text) : '';
      history.push({ role: 'user', content: CHAT_SYS + (ctx || '') + '\n\nUser question: ' + text });
      return { mode: 'chat', messages: history };
    }
    if (mode === 'dupe') {
      if (prevAi && !opts.preset) return { mode: 'chat', messages: [{ role: 'user', content: wrap('I asked for affordable dupes and got these recommendations', prevAi) }] };
      const grounding = DB.loaded ? dupeGrounding(text) : '';
      const body = `The user wants affordable dupes for **${text}**. If you don't recognize this name, say so kindly — suggest 2-3 likely fragrances they might've meant and ask which one. Otherwise: start with one precise sentence describing the original's actual scent experience (what spraying it feels like, not just a note list). Then deliver 5 dupes from cheapest to most expensive, prioritizing picks under $80. For each:\n1. **Bold** name + brand\n2. Approximate retail price\n3. How close the match is — be honest. "Dead-on clone", "85% there but lighter", "Same DNA, different personality" — no fake 100% matches.\n4. Key notes it shares with the original\n5. The main difference (what you lose — longevity, projection, a specific note)\n6. Where to buy (Amazon, FragranceNet, brand site, etc.)\n\nVoice: warm, specific, confident — a trusted advisor who has smelled all of these. End with one honest line — which dupe you'd personally pick, and why.${grounding}`;
      return { mode: 'chat', messages: [{ role: 'user', content: body }] };
    }
    if (mode === 'zodiac') {
      const sign = signFromText(text);
      if (prevAi && !sign && !opts.preset) return { mode: 'chat', messages: [{ role: 'user', content: wrap('I asked about zodiac fragrance recommendations and got this', prevAi) }] };
      const subject = sign || text;
      return { mode: 'chat', messages: [{ role: 'user', content: `Match 5 fragrances to a ${subject}. Open with one sentence capturing the essence of this sign — the temperament, the traits that matter for scent. Then deliver picks in your calm, confident advisor voice. For each: **bold** name+brand, top/heart/base notes, 2-3 sentences connecting the scent to specific ${subject} traits (be precise: ruling planet, what they gravitate toward, how they carry themselves), approximate price. Sound like a well-read friend who knows both astrology and perfumery — not a horoscope column.` }] };
    }
    if (mode === 'music') {
      if (prevAi && !opts.preset) return { mode: 'chat', messages: [{ role: 'user', content: wrap('I asked for fragrances matching my music taste and got this', prevAi) }] };
      const content = opts.preset
        ? `Match 5 fragrances to ${text} music. Open with one line reading the sonic and sensory character of ${text} — texture, mood, how it sits in a room. Then deliver picks in your composed, knowledgeable voice. For each: **bold** name+brand, top/heart/base notes, 2-3 sentences drawing the music-to-scent line (specific artists, textures, eras — avoid vague words like "energetic"), price range. Sound like a friend who knows both the music and the fragrances well.`
        : `The user describes their music taste as: "${text}". Open with one line reflecting their taste back in sensory terms — show them you understood it. Then match 5 fragrances to this musical world. For each: **bold** name+brand, top/heart/base notes, 2-3 sentences tying the scent to specific elements of their taste (a texture, an era, a lyric, a named artist if given), price range. Warm, precise, confident — no hype, no filler.`;
      return { mode: 'chat', messages: [{ role: 'user', content }] };
    }
    if (mode === 'style') {
      if (prevAi && !opts.preset) return { mode: 'chat', messages: [{ role: 'user', content: wrap('I asked for fragrances matching my style and got this', prevAi) }] };
      const content = opts.preset
        ? `Match 5 fragrances to the "${text}" fashion aesthetic. Open with one sentence reading the mood of this style — fabrics, silhouette, attitude. Then deliver picks in your confident advisor voice. For each: **bold** name+brand, top/heart/base notes, 2-3 sentences connecting the scent to specific style cues (palette, texture, era, the person who wears this well), price range. Mix premium and budget. Tailored, not theatrical.`
        : `The user describes their personal style as: "${text}". Open with one sentence reflecting their style back in sensory terms — show them you understood it. Then match 5 fragrances. For each: **bold** name+brand, top/heart/base notes, 2-3 sentences of specific reasoning (what in their description sparked this pick — a word, an item, a mood), price range. Mix premium and budget. Tailored, precise, never generic.`;
      return { mode: 'chat', messages: [{ role: 'user', content }] };
    }
    if (mode === 'photo') {
      if (S.photo) return { mode: 'photo', imageBase64: S.photo.b64, imageMime: 'image/jpeg', messages: [{ role: 'user', content: text || 'Analyze this style and recommend matching fragrances.' }] };
      if (prevAi) return { mode: 'chat', messages: [{ role: 'user', content: wrap('I uploaded a style photo and got these fragrance recommendations', prevAi) }] };
      return null;
    }
    return null;
  }
  async function sendMessage(text, opts) {
    opts = opts || {};
    if (S.busy) return;
    const mode = S.mode, t = getThread(mode);
    text = String(text || '').trim();
    if (mode === 'celeb') return celebAnswer(text);
    if (mode === 'photo' && !S.photo && !lastAiText(t)) { toast('Add a photo first.'); $('#dropzone').focus(); return; }
    if (mode === 'dupe' && text.length < 3) { toast('Type a fragrance name, at least 3 characters.'); return; }
    if (!canUseAI()) { t.push({ role: 'ai', kind: 'paywall', title: 'You have used your free picks.', text: 'Lifetime access is $10, once: all seven modes and 500 queries a month.' }); saveThread(mode); renderThread(); track('paywall_shown', { mode }); return; }
    if (navigator.onLine === false) { toast('You are offline. Reconnect and try again.'); return; }
    const hasImage = mode === 'photo' && !!S.photo;
    t.push({ role: 'user', text, preset: !!opts.preset, hasImage, preview: hasImage ? S.photo.preview : undefined });
    saveThread(mode); S.busy = true; S.busyMode = mode; S.scrollNext = true; $('#send-btn').disabled = true; renderThread();
    await loadDB().catch(() => {});
    const payload = buildPayload(mode, text, opts, t);
    if (!payload) { S.busy = false; $('#send-btn').disabled = false; return; }
    let result;
    try { result = await callAI(payload); }
    catch (err) { result = { error: err }; }
    S.busy = false; $('#send-btn').disabled = false;
    if (result.error) {
      const e = result.error;
      if (e.status === 403 && typeof e.data.freeUsed === 'number') { S.freeUsed = e.data.freeUsed; t.push({ role: 'ai', kind: 'paywall', title: 'You have used your free picks.', text: 'Lifetime access is $10, once: all seven modes and 500 queries a month.' }); track('paywall_shown', { mode, source: 'server_403' }); }
      else if (e.status === 403) { S.isPaid = false; S.tier = 'free'; t.push({ role: 'ai', kind: 'paywall', title: 'Your session has expired.', text: 'Sign in again from your account page, or get lifetime access.' }); }
      else if (e.status === 429 && e.data.reason === 'ip_daily_cap') t.push({ role: 'ai', kind: 'paywall', title: 'This network has been busy today.', text: 'Free picks are shared per network. Try again later, or get lifetime access to skip the limit.' });
      else if (e.status === 429 && typeof e.data.usage === 'number') { S.usage = e.data.usage; t.push({ role: 'ai', kind: 'error', text: e.data.error || 'Monthly limit reached. It resets next month.' }); }
      else t.push({ role: 'ai', kind: 'error', text: e.status === 504 ? 'The advisor took too long. Please try again.' : (e.data && e.data.error) || 'Something went wrong. Please try again.', retry: true });
      saveThread(mode); renderThread(); renderMeter(); renderTrust(); return;
    }
    const d = result.data;
    if (typeof d.freeUsed === 'number') S.freeUsed = d.freeUsed; else if (typeof d.usage === 'number') S.usage = d.usage; else if (S.isPaid) S.usage++;
    if (typeof d.emailGiven === 'boolean') S.emailGiven = d.emailGiven;
    const teaser = !!d.teaser && !S.isPaid && !S.isOwner && !S.emailGiven;
    t.push({ role: 'ai', text: d.result || 'No response. Try again.', teaser }); S.scrollNext = true;
    if (hasImage) S.photo = null, resetDropzone();
    saveThread(mode); renderThread(); renderMeter(); renderTrust();
    track('ai_recommendation', { mode, tier: S.tier || 'free' });
    if (teaser) setTimeout(showGate, 600);
  }
  async function callAI(payload) {
    const attempt = async (timeoutMs) => {
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const r = await fetch('/api/recommend', { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify(payload), signal: ctrl.signal });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) { const e = new Error(data.error || 'Request failed'); e.status = r.status; e.data = data; throw e; }
        return { data };
      } finally { clearTimeout(timer); }
    };
    try { return await attempt(30000); }
    catch (e) {
      const transient = e.name === 'AbortError' || /Failed to fetch|network/i.test(e.message || '') || (e.status && e.status >= 500);
      if (!transient) { if (!e.data) e.data = {}; throw e; }
      await sleep(600);
      try { return await attempt(30000); } catch (e2) { if (!e2.data) e2.data = {}; if (!e2.status && e2.name === 'AbortError') e2.status = 504; throw e2; }
    }
  }

  // ---- photo ----
  function setupPhoto() {
    const dz = $('#dropzone'), input = $('#photo-input');
    dz.setAttribute('tabindex', '0'); dz.setAttribute('role', 'button');
    dz.addEventListener('click', () => input.click());
    dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', () => { if (input.files && input.files[0]) handlePhoto(input.files[0]); input.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.style.borderColor = ''; }));
    dz.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handlePhoto(f); });
  }
  function resetDropzone() { const dz = $('#dropzone'); if (!dz) return; dz.classList.remove('has-image'); dz.innerHTML = `${icon('image', 22)}<span id="dropzone-label">Drop a photo here or tap to choose</span><input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp,image/gif" hidden>`; $('#photo-input').addEventListener('change', function () { if (this.files && this.files[0]) handlePhoto(this.files[0]); this.value = ''; }); }
  function handlePhoto(file) {
    if (!/^image\//.test(file.type)) { toast('Please choose an image.'); return; }
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200; let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { const s = MAX / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = c.toDataURL('image/jpeg', 0.8); URL.revokeObjectURL(url);
      S.photo = { b64: dataUrl.split(',')[1], preview: dataUrl };
      const dz = $('#dropzone'); dz.classList.add('has-image'); dz.innerHTML = `<img src="${dataUrl}" alt="Selected photo"><span class="t-call muted">Ready. Press send to analyse it.</span><input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp,image/gif" hidden>`;
      $('#photo-input').addEventListener('change', function () { if (this.files && this.files[0]) handlePhoto(this.files[0]); this.value = ''; });
      $('#composer-input').focus();
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image.'); };
    img.src = url;
  }

  // ---- celebrity mode (local data, no AI call) ----
  function celebAnswer(text) {
    const t = getThread('celeb');
    const list = window.SW_CELEBS || [];
    const q = text.toLowerCase();
    const c = list.find((x) => x.name.toLowerCase() === q) || list.find((x) => x.name.toLowerCase().indexOf(q) !== -1) || list.find((x) => q.indexOf(x.name.toLowerCase()) !== -1);
    t.push({ role: 'user', text });
    if (!c) { const near = list.filter((x) => x.name.toLowerCase()[0] === q[0]).slice(0, 5).map((x) => x.name); t.push({ role: 'ai', kind: 'note', text: `No list for “${text}” yet. Names close to that: ${near.join(', ') || 'none'}. The full list of 101 is on the Celebrities page.` }); }
    else t.push({ role: 'ai', kind: 'celeb', name: c.name, frags: c.frags });
    saveThread('celeb'); renderThread();
  }
  function celebAnswerHTML(m) {
    const rows = (m.frags || []).map((k) => { const [n, b] = k.split('|'); const it = (DB.loaded && (find(n, b) || itemFor(n, b))) || { n, b, c: '' }; return `<div class="row" style="gap:8px">${rowcardHTML(Object.assign({}, it, { n, b }))}<a class="btn btn-quiet btn-sm" href="${amazonLink(n, b)}" target="_blank" rel="noopener sponsored">Shop</a></div>`; }).join('');
    const names = (m.frags || []).map((k) => k.replace('|', ' by ')).join(', ');
    return `<div class="msg-ai"><div class="intro">${esc(m.name)} wears ${m.frags.length === 1 ? 'this' : 'these'}:</div><div class="stack" style="gap:8px;max-width:640px">${rows}</div><div><button class="btn btn-quiet btn-md" type="button" data-action="ask-about" data-prompt="${esc('Which of these fragrances that ' + m.name + ' wears would suit me, and what are cheaper alternatives to each: ' + names + '?')}">Ask which suits me</button></div></div>`;
  }

  // ---- usage meter ----
  function renderMeter() {
    const el = $('#meter'); if (!el) return;
    if (S.isOwner) { el.innerHTML = `<div class="row" style="justify-content:space-between"><span class="t-call" style="font-weight:600">Owner</span><span class="t-foot muted">Unlimited</span></div>`; return; }
    if (S.isPaid) { const left = Math.max(0, MAX_PAID - S.usage); el.innerHTML = `<div class="row" style="justify-content:space-between"><span class="t-call" style="font-weight:600">Lifetime access</span><span class="t-foot muted">${left} of ${MAX_PAID} left</span></div><div class="progress"><i style="width:${Math.min(100, (S.usage / MAX_PAID) * 100)}%"></i></div><span class="t-foot muted">Resets monthly. Thank you for supporting ScentWise.</span>`; return; }
    const used = Math.min(FREE_LIMIT, S.freeUsed);
    el.innerHTML = `<div class="row" style="justify-content:space-between"><span class="t-call" style="font-weight:600">Free picks</span><span class="t-foot muted">${used} of ${FREE_LIMIT} used</span></div><div class="progress"><i style="width:${(used / FREE_LIMIT) * 100}%"></i></div><span class="t-foot muted">Lifetime access is $10 once: all modes, ${MAX_PAID} queries a month.</span><button class="btn btn-text btn-sm" type="button" data-action="checkout" style="align-self:flex-start;padding:0">Unlock lifetime</button>`;
  }

  // ───────────────────────── compare tray ─────────────────────────
  const CMP_KEY = 'sw2_compare', CMP_MAX = 3;
  let compareList = lsGet(CMP_KEY, []).filter((k) => typeof k === 'string').slice(0, CMP_MAX);
  function inCompare(n, b) { return compareList.indexOf(likeKey(n, b)) !== -1; }
  function saveCompare() { lsSet(CMP_KEY, compareList); renderTray(); $$('.cmp[data-cmp-name]').forEach((el) => el.classList.toggle('is-on', inCompare(el.getAttribute('data-cmp-name'), el.getAttribute('data-cmp-brand')))); }
  function toggleCompare(n, b) {
    const k = likeKey(n, b);
    const i = compareList.indexOf(k);
    if (i !== -1) { compareList.splice(i, 1); saveCompare(); toast('Removed from compare', 1600); return; }
    if (compareList.length >= CMP_MAX) { toast(`Compare holds ${CMP_MAX}. Remove one first.`, 2600); return; }
    compareList.push(k); saveCompare(); toast(compareList.length < 2 ? 'Added. Pick one more to compare.' : 'Added to compare', 1800);
  }
  function compareItem(k) {
    const [n, b] = k.split('|');
    return (DB.loaded && (find(n, b) || itemFor(n, b))) || { n: titleCase(n), b: titleCase(b), c: '' };
  }
  function renderTray() {
    const tray = $('#compare-tray'); if (!tray) return;
    if (!compareList.length) { tray.hidden = true; tray.innerHTML = ''; document.body.classList.remove('has-tray'); return; }
    tray.hidden = false; document.body.classList.add('has-tray');
    tray.innerHTML = `<div class="tray-inner">
      <span class="t-foot muted" style="flex-shrink:0">Compare</span>
      <div class="chips scroll" style="margin:0;padding:0;flex:1;min-width:0">${compareList.map((k) => { const it = compareItem(k); return `<span class="chip" style="height:36px;font-size:13px;padding-right:6px">${esc(it.n)}<button class="icon-btn" type="button" data-cmp-remove="${esc(k)}" aria-label="Remove ${esc(it.n)}" style="width:28px;height:28px;margin-left:2px">${icon('close', 14, 2)}</button></span>`; }).join('')}</div>
      <button class="btn btn-primary btn-md" type="button" data-action="open-compare" ${compareList.length < 2 ? 'disabled' : ''}>Compare ${compareList.length}</button>
      <button class="btn btn-text btn-md" type="button" data-action="clear-compare">Clear</button></div>`;
  }
  document.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-cmp-remove]');
    if (rm) { e.preventDefault(); const k = rm.getAttribute('data-cmp-remove'); compareList = compareList.filter((x) => x !== k); saveCompare(); return; }
    const c = e.target.closest('[data-cmp-name]');
    if (c) { e.preventDefault(); e.stopPropagation(); toggleCompare(c.getAttribute('data-cmp-name'), c.getAttribute('data-cmp-brand') || ''); return; }
    const p = e.target.closest('[data-profile-name]');
    if (p) { e.preventDefault(); e.stopPropagation(); const n = p.getAttribute('data-profile-name'), b = p.getAttribute('data-profile-brand') || ''; S.profileWanted = likeKey(n, b); openSheet(n, b); return; }
    const gen = e.target.closest('[data-profile-generate]');
    if (gen) { e.preventDefault(); const box = gen.closest('[data-name]'); if (box) loadProfileInto(box.getAttribute('data-name'), box.getAttribute('data-brand') || '', box); return; }
  });
  function openCompareSheet() {
    if (compareList.length < 2) { toast('Pick at least two fragrances to compare.'); return; }
    const sheet = $('#sheet'); sheetLastFocus = document.activeElement;
    sheet.hidden = false; document.body.style.overflow = 'hidden';
    const items = compareList.map(compareItem);
    const cols = items.map((it) => {
      const rec = richOf(it); const tiers = rec ? notesTiers(rec.t) : null; const prof = profileCached(it.n, it.b);
      const row = (label, val) => `<div class="cmp-row"><span class="t-foot muted-2">${label}</span><span class="t-call">${val || '—'}</span></div>`;
      return `<div class="cmp-col" data-name="${esc(it.n)}" data-brand="${esc(it.b)}">
        <div class="art ${famClass(it)}" data-img-name="${esc(it.n)}" data-img-brand="${esc(it.b)}" style="position:relative;display:flex;align-items:center;justify-content:center;height:140px;border-radius:14px;overflow:hidden">${bottle(40, 60)}</div>
        <div class="stack" style="gap:2px"><span class="t-head" style="font-size:17px">${esc(it.n)}</span><span class="t-call muted">${esc(it.b)}</span></div>
        <div class="row" style="gap:6px;flex-wrap:wrap">${popBadge(it)}${rec && rec.r ? `<span class="badge">${rec.r.toFixed(1)} / 5</span>` : ''}</div>
        ${row('Family', esc(famLabel(it)))}${row('For', esc(GENDER_NAME[it.g] || '—'))}
        ${row('Accords', rec && rec.a.length ? esc(rec.a.slice(0, 6).join(', ')) : (prof && prof.accords ? esc(prof.accords) : ''))}
        ${row('Top', tiers && tiers.top ? esc(tiers.top) : (tiers && tiers.all ? esc(tiers.all) : (prof && prof.notes && !tiers ? esc(prof.notes) : '')))}${tiers && tiers.heart ? row('Heart', esc(tiers.heart)) : ''}${tiers && tiers.base ? row('Base', esc(tiers.base)) : ''}
        <div class="stack" style="gap:8px" id="cmp-profile-${esc(likeKey(it.n, it.b)).replace(/[^a-z0-9]/g, '_')}">${prof ? profileScoresHTML(prof) : `<button class="btn btn-quiet btn-sm" type="button" data-profile-generate style="align-self:flex-start">${icon('sparkle', 14)}Scent profile</button>`}</div>
        <div class="row" style="gap:6px;margin-top:auto"><a class="btn btn-quiet btn-sm" href="${amazonLink(it.n, it.b)}" target="_blank" rel="noopener sponsored">Shop</a><button class="btn btn-text btn-sm" type="button" data-cmp-remove="${esc(likeKey(it.n, it.b))}">Remove</button></div>
      </div>`;
    }).join('');
    sheet.innerHTML = `<div class="sheet cmp-sheet" role="document"><div class="body">
      <div class="row" style="justify-content:space-between;align-items:flex-start"><div class="stack" style="gap:2px"><h2 class="t-3">Compare</h2><span class="t-foot muted">Side by side. Scent profiles are AI estimates and use one advisor query each.</span></div><button class="icon-btn" type="button" data-action="close-sheet" aria-label="Close">${icon('close', 20, 2)}</button></div>
      <div class="cmp-grid" style="grid-template-columns:repeat(${items.length}, minmax(0, 1fr))">${cols}</div></div></div>`;
    watchImages(sheet);
  }

  // ───────────────────────── scent profile (AI, cached) ─────────────────────────
  const profileKey = (n, b) => 'sw2_profile_' + likeKey(n, b);
  const profileInflight = new Map();
  function profileCached(n, b) { const v = lsGet(profileKey(n, b), null); return v && typeof v === 'object' ? v : null; }
  async function fetchProfile(n, b) {
    const cached = profileCached(n, b); if (cached) return cached;
    const k = profileKey(n, b); if (profileInflight.has(k)) return profileInflight.get(k);
    const prompt = `For the fragrance "${n}${b ? ' by ' + b : ''}":\n\nReturn ONLY a JSON object (no markdown, no code fences, no prose) with these exact keys:\n{"longevity":1-5,"projection":1-5,"sillage":1-5,"versatility":1-5,"blindBuyRisk":"Low"|"Medium"|"Test first","blindBuyReason":"one short sentence explaining why","gender":"Male/Female/Unisex","concentration":"EDP/EDT/Parfum/etc","accords":"comma separated","notes":"comma separated top/heart/base notes","rating":1-5 or null,"summary":"two sentences on how it smells and when to wear it"}\n\nBase scores on community consensus and typical performance. If the fragrance is unknown, use null for all fields.`;
    const p = (async () => {
      const r = await callAI({ mode: 'chat', messages: [{ role: 'user', content: prompt }] });
      const d = r.data;
      if (typeof d.freeUsed === 'number') S.freeUsed = d.freeUsed; else if (typeof d.usage === 'number') S.usage = d.usage;
      if (typeof d.emailGiven === 'boolean') S.emailGiven = d.emailGiven;
      renderMeter(); renderTrust(); track('ai_recommendation', { mode: 'profile', tier: S.tier || 'free' });
      const raw = String(d.result || '').replace(/```json?/gi, '').replace(/```/g, '').trim();
      const m = raw.match(/\{[\s\S]*\}/); if (!m) throw new Error('No profile returned.');
      const info = JSON.parse(m[0]); if (!info || typeof info !== 'object' || !info.longevity) throw new Error('The advisor did not recognise this fragrance.');
      lsSet(k, info); return info;
    })().finally(() => profileInflight.delete(k));
    profileInflight.set(k, p); return p;
  }
  function scoreRow(label, val) { const n = parseInt(val, 10); if (!n || n < 1 || n > 5) return ''; return `<div class="score"><span class="t-foot muted-2" style="width:84px">${label}</span><span class="progress" style="flex:1"><i style="width:${(n / 5) * 100}%"></i></span><span class="t-foot" style="width:28px;text-align:right">${n}/5</span></div>`; }
  function profileScoresHTML(p) {
    const risk = p.blindBuyRisk ? `<span class="badge" style="align-self:flex-start;color:${/low/i.test(p.blindBuyRisk) ? 'var(--ok)' : (/test/i.test(p.blindBuyRisk) ? 'var(--danger)' : 'var(--fg2)')}">${esc(p.blindBuyRisk)}${/low/i.test(p.blindBuyRisk) ? ' risk blind buy' : ''}</span>` : '';
    const meta = [p.concentration, p.gender].filter(Boolean).map((x) => `<span class="badge">${esc(x)}</span>`).join('');
    return `<div class="stack" style="gap:6px">${scoreRow('Longevity', p.longevity)}${scoreRow('Projection', p.projection)}${scoreRow('Sillage', p.sillage)}${scoreRow('Versatility', p.versatility)}</div>${risk || meta ? `<div class="row" style="gap:6px;flex-wrap:wrap">${risk}${meta}</div>` : ''}${p.blindBuyReason ? `<span class="t-call muted">${esc(p.blindBuyReason)}</span>` : ''}`;
  }
  function profileSectionHTML(n, b) {
    const p = profileCached(n, b);
    const head = `<div class="row" style="justify-content:space-between"><span class="t-head" style="font-size:17px">Scent profile</span><span class="badge">${icon('sparkle', 12)}AI estimate</span></div>`;
    if (p) return head + (p.summary ? `<p class="t-call muted">${esc(p.summary)}</p>` : '') + profileScoresHTML(p) + (!DB.rich.has(likeKey(n, b)) && p.notes ? `<span class="t-foot muted-2">Notes: ${esc(p.notes)}</span>` : '');
    return head + `<span class="t-call muted">Longevity, projection, sillage, versatility and blind-buy risk, estimated by the advisor. Uses one query.</span><button class="btn btn-quiet btn-md" type="button" data-profile-generate style="align-self:flex-start">${icon('sparkle', 16)}Generate scent profile</button>`;
  }
  async function loadProfileInto(n, b, box) {
    box = box || $('#sheet-profile'); if (!box) return;
    if (!profileCached(n, b) && !canUseAI()) { box.innerHTML = `<div class="gate"><span class="t-call">You have used your free picks. Lifetime access is $10, once.</span><div class="row" style="gap:8px"><button class="btn btn-primary btn-md" type="button" data-action="checkout">Get lifetime access</button><a class="btn btn-quiet btn-md" href="/account" data-nav="account">I already paid</a></div></div>`; return; }
    box.innerHTML = `<div class="row" style="gap:10px"><span class="typing"><i></i><i></i><i></i></span><span class="t-call muted">Reading the community consensus…</span></div>`;
    try {
      const p = await fetchProfile(n, b);
      if (box.id === 'sheet-profile') box.innerHTML = profileSectionHTML(n, b); else box.innerHTML = profileScoresHTML(p);
    } catch (e) {
      const msg = e.status === 403 ? 'Free picks used. Lifetime access is $10, once.' : (e.status === 429 ? 'Too many requests right now. Try again in a minute.' : (e.message || 'Could not build the profile.'));
      box.innerHTML = `<span class="t-call" style="color:var(--danger)">${esc(msg)}</span><button class="btn btn-quiet btn-sm" type="button" data-profile-generate style="align-self:flex-start">Try again</button>`;
    }
  }

  // ───────────────────────── celebrities view ─────────────────────────
  let celebsPromise = null, celebsReady = false;
  function loadCelebs() {
    if (window.SW_CELEBS) return Promise.resolve();
    if (!celebsPromise) celebsPromise = loadScript('/celebs.js').catch(() => { window.SW_CELEBS = []; });
    return celebsPromise;
  }
  function initCelebs() {
    if (!celebsReady) {
      celebsReady = true;
      $('#celeb-q').addEventListener('input', debounce(() => { S.celebFilter = $('#celeb-q').value.trim().toLowerCase(); renderCelebs(); }, 120));
    }
    $('#celeb-grid').innerHTML = skeletonCards(8);
    Promise.all([loadCelebs(), loadDB()]).then(renderCelebs);
  }
  function renderCelebs() {
    const grid = $('#celeb-grid'); if (!grid) return;
    const list = (window.SW_CELEBS || []).filter((c) => !S.celebFilter || c.name.toLowerCase().indexOf(S.celebFilter) !== -1 || c.frags.some((f) => f.toLowerCase().indexOf(S.celebFilter) !== -1));
    if (!list.length) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="t-head">No one matches “${esc(S.celebFilter)}”.</span></div>`; return; }
    grid.innerHTML = list.map((c) => `<button class="celeb" type="button" data-celeb="${esc(c.name)}"><span class="avatar">${esc(c.img || c.name[0])}</span><span class="stack" style="gap:2px"><span class="t-head" style="font-size:17px">${esc(c.name)}</span><span class="t-foot muted">${c.frags.length} fragrance${c.frags.length === 1 ? '' : 's'}</span></span><span class="t-call muted" style="line-height:1.4">${c.frags.slice(0, 3).map((f) => esc(f.split('|')[0])).join(' · ')}</span></button>`).join('');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-celeb]'); if (!b) return;
    const c = (window.SW_CELEBS || []).find((x) => x.name === b.getAttribute('data-celeb')); if (c) openCelebSheet(c);
  });
  function openCelebSheet(c) {
    const sheet = $('#sheet'); sheetLastFocus = document.activeElement;
    sheet.hidden = false; document.body.style.overflow = 'hidden';
    const rows = c.frags.map((k) => { const [n, b] = k.split('|'); const it = (DB.loaded && (find(n, b) || itemFor(n, b))) || { n, b, c: '' }; return `<div class="row" style="gap:8px">${rowcardHTML(Object.assign({}, it, { n, b }))}<a class="btn btn-quiet btn-sm" href="${amazonLink(n, b)}" target="_blank" rel="noopener sponsored">Shop</a></div>`; }).join('');
    const names = c.frags.map((k) => k.replace('|', ' by ')).join(', ');
    sheet.innerHTML = `<div class="sheet" role="document" style="grid-template-columns:1fr;max-width:640px">
      <div class="body">
        <div class="row" style="justify-content:space-between;align-items:flex-start"><div class="row" style="gap:14px"><span class="avatar" style="width:56px;height:56px;font-size:21px">${esc(c.img || c.name[0])}</span><div class="stack" style="gap:2px"><h2 class="t-3">${esc(c.name)}</h2><span class="t-foot muted">${c.frags.length} fragrance${c.frags.length === 1 ? '' : 's'} on record</span></div></div><button class="icon-btn" type="button" data-action="close-sheet" aria-label="Close">${icon('close', 20, 2)}</button></div>
        <div class="stack" style="gap:8px">${rows}</div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="button" data-action="ask-about" data-prompt="${esc('Which of these fragrances that ' + c.name + ' wears would suit me, and what are cheaper alternatives to each: ' + names + '?')}">Ask which suits me</button></div>
        <span class="t-cap muted-2">From published interviews and features. Availability changes.</span>
      </div></div>`;
    watchImages(sheet);
  }

  // ───────────────────────── account ─────────────────────────
  let profileCache = null;
  function renderAccount() {
    const el = $('#account'); if (!el) return;
    const admin = new URLSearchParams(location.search).has('admin');
    const collection = Array.from(likes).map((k) => { const [n, b] = k.split('|'); const it = (DB.loaded && (find(n, b) || itemFor(n, b))) || null; return it ? Object.assign({}, it) : { n: titleCase(n), b: titleCase(b), c: '' }; });
    const collectionHTML = `<div class="stack" style="gap:10px"><div class="row" style="justify-content:space-between"><span class="t-head">Saved fragrances</span><span class="t-foot muted">${collection.length}</span></div>${collection.length ? `<div class="stack" style="gap:8px">${collection.map((it) => rowcardHTML(it)).join('')}</div>` : `<span class="t-call muted">Tap the heart on any fragrance to keep it here. Saved on this device.</span>`}</div>`;
    let status = '';
    if (S.isOwner) status = `<div class="card" style="padding:24px"><div class="kv"><span class="muted">Status</span><b>Owner</b></div><div class="kv"><span class="muted">Queries</span><b>Unlimited</b></div><div class="row" style="gap:8px;padding-top:14px"><button class="btn btn-quiet btn-md" type="button" data-action="logout">Log out</button></div></div>`;
    else if (S.isPaid) status = `<div class="card" style="padding:24px"><div class="kv"><span class="muted">Status</span><b>Lifetime access</b></div><div class="kv"><span class="muted">Email</span><b>${esc(S.email || '—')}</b></div><div class="kv"><span class="muted">AI queries this month</span><b>${S.usage} of ${MAX_PAID}</b></div><div class="progress" style="margin:14px 0"><i style="width:${Math.min(100, (S.usage / MAX_PAID) * 100)}%"></i></div><div class="row" style="gap:8px"><a class="btn btn-primary btn-md" href="/advisor" data-nav="advisor">Open the advisor</a><button class="btn btn-quiet btn-md" type="button" data-action="logout">Log out</button></div></div>`;
    else status = `<div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px"><div class="stack" style="gap:4px"><span class="t-head">Free</span><span class="t-call muted">${Math.max(0, FREE_LIMIT - S.freeUsed)} of ${FREE_LIMIT} free picks left on this device.</span></div><div class="progress"><i style="width:${(Math.min(FREE_LIMIT, S.freeUsed) / FREE_LIMIT) * 100}%"></i></div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="button" data-action="checkout">Get lifetime access · $10</button><a class="btn btn-quiet" href="/advisor" data-nav="advisor">Use free picks</a></div></div>
      <div class="card" style="padding:24px;display:flex;flex-direction:column;gap:20px"><div class="stack" style="gap:4px"><span class="t-head">Already paid?</span><span class="t-call muted">Sign in with the email you used at checkout, or paste your order number from the receipt.</span></div>
        <form class="form" id="login-form"><label class="t-foot muted" for="login-email">Email</label><div class="row" style="gap:8px;flex-wrap:wrap"><input class="input" id="login-email" type="email" autocomplete="email" placeholder="you@example.com" required style="flex:1;min-width:220px"><button class="btn btn-primary btn-md" type="submit">Sign in</button></div></form>
        <form class="form" id="order-form"><label class="t-foot muted" for="order-id">Order number</label><div class="row" style="gap:8px;flex-wrap:wrap"><input class="input" id="order-id" type="text" inputmode="numeric" placeholder="e.g. 2944561" required style="flex:1;min-width:220px"><button class="btn btn-quiet btn-md" type="submit">Activate</button></div></form>
        <div class="alert" id="account-msg" hidden></div></div>`;
    const profileHTML = (S.isPaid || S.isOwner) ? `<div class="card" style="padding:24px;display:flex;flex-direction:column;gap:12px" id="profile-card"><div class="row" style="justify-content:space-between"><span class="t-head">Scent profile</span><button class="btn btn-text btn-sm" type="button" data-action="reset-profile">Reset</button></div><div id="profile-body"><span class="t-call muted">Loading…</span></div></div>` : '';
    const adminHTML = admin && !S.isOwner ? `<form class="card form" id="owner-form" style="padding:24px"><span class="t-head">Owner access</span><div class="row" style="gap:8px"><input class="input" id="owner-key" type="password" placeholder="Owner key" required style="flex:1"><button class="btn btn-primary btn-md" type="submit">Unlock</button></div></form>` : '';
    el.innerHTML = `<div class="stack" style="gap:10px"><h1 class="t-1">You</h1><p class="muted">Access, usage and the fragrances you saved.</p></div>${status}${profileHTML}${adminHTML}${collectionHTML}`;
    watchImages(el);
    if (S.isPaid || S.isOwner) loadProfile();
    if (!DB.loaded && collection.length) loadDB().then(() => { if (S.view === 'account') renderAccount(); });
  }
  function titleCase(s) { return String(s || '').replace(/\b\w/g, (c) => c.toUpperCase()); }
  document.addEventListener('submit', async (e) => {
    const f = e.target;
    if (f.id === 'login-form') { e.preventDefault(); return loginEmail($('#login-email').value.trim()); }
    if (f.id === 'order-form') { e.preventDefault(); return verifyOrder($('#order-id').value.trim(), false); }
    if (f.id === 'owner-form') { e.preventDefault(); return ownerLogin($('#owner-key').value); }
  });
  function accountMsg(text, isError) { const el = $('#account-msg'); if (!el) { toast(text, 5000); return; } el.hidden = false; el.textContent = text; el.classList.toggle('error', !!isError); }
  async function loadProfile() {
    const body = $('#profile-body'); if (!body) return;
    try {
      const r = await fetch('/api/check-tier?action=profile', { credentials: 'same-origin', headers: { 'X-Requested-With': 'ScentWise' } });
      const d = await r.json(); profileCache = d.profile || null;
      if (!d.hasProfile || !d.profile) { body.innerHTML = `<span class="t-call muted">Nothing learned yet. Rate a few picks in the advisor and this fills in.</span>`; return; }
      const p = d.profile; const chips = (arr) => arr && arr.length ? `<div class="chips">${arr.slice(0, 10).map((x) => `<span class="chip" style="height:32px;font-size:13px">${esc(x)}</span>`).join('')}</div>` : `<span class="t-call muted">—</span>`;
      body.innerHTML = `<div class="stack" style="gap:14px"><div class="kv"><span class="muted">Interactions</span><b>${p.queryCount || 0}</b></div><div class="stack" style="gap:6px"><span class="t-foot muted">Notes you like</span>${chips(p.likedNotes)}</div><div class="stack" style="gap:6px"><span class="t-foot muted">Notes to avoid</span>${chips(p.dislikedNotes)}</div><div class="stack" style="gap:6px"><span class="t-foot muted">Brands</span>${chips(p.likedBrands)}</div><div class="stack" style="gap:6px"><span class="t-foot muted">Families</span>${chips(p.preferredCategories)}</div></div>`;
    } catch (err) { body.innerHTML = `<span class="t-call muted">Could not load your profile right now.</span>`; }
  }
  async function resetProfile() {
    if (!confirm('Reset your scent profile? The advisor forgets what it learned.')) return;
    try { const r = await fetch('/api/check-tier?action=profile', { method: 'DELETE', credentials: 'same-origin', headers: { 'X-Requested-With': 'ScentWise' } }); if (!r.ok) throw new Error(); toast('Profile reset.'); loadProfile(); } catch (e) { toast('Could not reset the profile.'); }
  }

  // ───────────────────────── tier / checkout / login ─────────────────────────
  async function checkTier() {
    try {
      const r = await fetch('/api/check-tier', { credentials: 'same-origin', headers: { 'X-Requested-With': 'ScentWise' } });
      const d = await r.json();
      S.tier = d.tier || 'free'; S.isOwner = S.tier === 'owner'; S.isPaid = S.isOwner || S.tier === 'premium';
      S.email = d.email || ''; if (typeof d.usage === 'number') S.usage = d.usage; if (typeof d.freeUsed === 'number') S.freeUsed = d.freeUsed; if (typeof d.emailGiven === 'boolean') S.emailGiven = d.emailGiven;
    } catch (e) { S.tier = 'free'; S.isOwner = false; S.isPaid = false; }
    renderTrust(); renderMeter(); if (S.view === 'account') renderAccount();
  }
  let checkoutUrl = '';
  async function checkout(btn) {
    if (S.isPaid) { navigate('/advisor'); return; }
    if (checkoutUrl) { location.href = checkoutUrl; return; }
    const label = btn ? btn.innerHTML : ''; if (btn) { btn.disabled = true; btn.textContent = 'Opening checkout…'; }
    try {
      const r = await fetch('/api/create-checkout', { method: 'POST', credentials: 'same-origin', headers: HEADERS, body: '{}' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url || !/^https:\/\/[^/]*lemonsqueezy\.com(\/|$)/.test(d.url)) throw new Error(d.error || 'Checkout is unavailable right now.');
      checkoutUrl = d.url; track('begin_checkout', { currency: 'USD', value: 10, items: [{ item_name: 'ScentWise Lifetime', price: 10 }] });
      location.href = d.url;
    } catch (e) { toast(e.message || 'Checkout is unavailable right now.', 5000); if (btn) { btn.disabled = false; btn.innerHTML = label; } }
  }
  async function verifyOrder(orderId, silent) {
    orderId = String(orderId || '').replace(/^#/, '').replace(/[^\d]/g, '').slice(0, 20);
    if (!orderId) { accountMsg('Enter the numeric order number from your receipt.', true); return false; }
    try {
      const r = await fetch('/api/verify-subscription', { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify({ orderId }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success) { S.isPaid = true; S.tier = d.tier || 'premium'; if (d.email) S.email = d.email; if (!silent) accountMsg('Lifetime access activated. Welcome.'); toast('Lifetime access activated.'); track('purchase', { currency: 'USD', value: 10, transaction_id: orderId }); renderTrust(); renderMeter(); renderAccount(); return true; }
      if (!silent) accountMsg(r.status === 429 ? 'Too many attempts. Try again in a minute.' : (d.error || 'Could not verify that order.'), true);
      return false;
    } catch (e) { if (!silent) accountMsg('Network error. Please try again.', true); return false; }
  }
  async function loginEmail(email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { accountMsg('Enter a valid email address.', true); return; }
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify({ email }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success) { S.isPaid = true; S.tier = d.tier || 'premium'; S.email = d.email || email; toast('Signed in. Lifetime access active.'); renderTrust(); renderMeter(); renderAccount(); return; }
      accountMsg(r.status === 404 ? 'No purchase found for this email. Try the order number instead.' : (r.status === 429 ? 'Too many attempts. Try again in a minute.' : (d.error || 'Could not sign in.')), true);
    } catch (e) { accountMsg('Network error. Please try again.', true); }
  }
  async function ownerLogin(key) {
    try {
      const r = await fetch('/api/owner-auth', { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify({ key }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success) { history.replaceState(null, '', '/account'); await checkTier(); toast('Owner access on.'); renderAccount(); } else toast(d.error || 'Invalid key.');
    } catch (e) { toast('Network error.'); }
  }
  async function logout() {
    try { await fetch('/api/owner-auth', { method: 'DELETE', credentials: 'same-origin', headers: { 'X-Requested-With': 'ScentWise' } }); } catch (e) { /* noop */ }
    S.isOwner = false; S.isPaid = false; S.tier = 'free'; S.email = ''; S.usage = 0; profileCache = null;
    toast('Logged out.'); await checkTier(); renderAccount();
  }

  // ───────────────────────── boot ─────────────────────────
  async function boot() {
    initHome();
    renderTray();
    route();
    const params = new URLSearchParams(location.search);
    const orderId = params.get('order_id') || params.get('orderId');
    await checkTier();
    if (orderId) {
      toast('Confirming your order…', 4000);
      let ok = false;
      for (let i = 0; i < 4 && !ok; i++) { ok = await verifyOrder(orderId, true); if (!ok) await sleep(1500 * (i + 1)); }
      history.replaceState(null, '', ok ? '/advisor' : '/account');
      if (ok) { route(); toast('Lifetime access activated. Welcome.', 5000); }
      else { route(); accountMsg('We could not confirm the order automatically. Paste the order number below, or sign in with your checkout email.', true); }
    }
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
