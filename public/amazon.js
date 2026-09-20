// ScentWise — shared Amazon Associates link builder.
// Loaded by index.html (before app.js) and by every blog guide (before /blog/frag-images.js).
// One place for: store selection (geo), affiliate tags, ASIN product links, localized search
// fallback, per-surface tracking IDs and affiliate click analytics.
//
// Why: the Associates report showed 286/290 clicks in category "Unknown" earning $0, and the
// Linked Product report empty all year. Search-result links (/s?k=...) never identify a product,
// so Amazon cannot attribute the sale to a category or item. A /dp/ASIN link fixes attribution,
// category commission rate and basket quality at once. Until an ASIN is known for a perfume we
// fall back to a *localized* Beauty-department search instead of an all-departments English one.
(function () {
  'use strict';

  // ── Stores ─────────────────────────────────────────────────────────────────────────────────
  // kw = the word for "perfume" shoppers type on that store. Searching "perfume" on amazon.fr
  // returns far worse results than "parfum".
  // tag = the Associates tracking ID for that marketplace. An empty tag means the store is
  // linked without attribution (better than sending the visitor to a store they cannot buy from).
  var STORES = {
    us: { code: 'us', domain: 'amazon.com', tag: 'scentwise20-20', kw: 'perfume' },
    uk: { code: 'uk', domain: 'amazon.co.uk', tag: 'scentwiseuk-21', kw: 'perfume' },
    de: { code: 'de', domain: 'amazon.de', tag: 'scentwisede20-21', kw: 'Parfüm' },
    fr: { code: 'fr', domain: 'amazon.fr', tag: 'scentwisede0e-21', kw: 'parfum' },
    es: { code: 'es', domain: 'amazon.es', tag: 'scentwised09f-21', kw: 'perfume' },
    it: { code: 'it', domain: 'amazon.it', tag: 'scentwisede09-21', kw: 'profumo' },
    be: { code: 'be', domain: 'amazon.com.be', tag: 'scentwisebe-21', kw: 'parfum' },
    // Amazon Türkiye has its own Associates programme (affiliate-program.amazon.com.tr).
    // Fill the tag in once the account is approved; until then Turkish visitors at least land on
    // a store that ships to them instead of amazon.com.
    tr: { code: 'tr', domain: 'amazon.com.tr', tag: '', kw: 'parfüm' }
  };

  // ── Per-surface tracking IDs ───────────────────────────────────────────────────────────────
  // Associates Central → Account Settings → Manage Your Tracking IDs. Create the IDs *first*:
  // a click with an unknown tracking ID is not credited. Then fill them in here, e.g.
  //   us: { explore: 'scentwise-explore-20', advisor: 'scentwise-advisor-20', blog: 'scentwise-blog-20' }
  // Surfaces used by the site: explore, profile, advisor, celebs, compare, blog.
  // A surface with no entry falls back to the store's default tag.
  var SURFACE_TAGS = {
    us: {}, uk: {}, de: {}, fr: {}, es: {}, it: {}, be: {}, tr: {}
  };

  // ── Geo ────────────────────────────────────────────────────────────────────────────────────
  // Timezone first (most reliable proxy for where the shopper physically is), then language.
  // Countries without a ScentWise store map to the store that ships to them and that locals
  // already use (e.g. Austria/Poland/Nordics → amazon.de, Portugal → amazon.es, Ireland → .co.uk).
  // The Americas and everything else fall back to amazon.com — Amazon OneLink then redirects CA/NL/PL/SE visitors.
  var TZ_MAP = {
    'europe/london': 'uk', 'europe/belfast': 'uk', 'europe/jersey': 'uk', 'europe/guernsey': 'uk', 'europe/isle_of_man': 'uk', 'europe/dublin': 'uk',
    'europe/berlin': 'de', 'europe/busingen': 'de', 'europe/vienna': 'de', 'europe/zurich': 'de', 'europe/luxembourg': 'de',
    'europe/warsaw': 'de', 'europe/prague': 'de', 'europe/bratislava': 'de', 'europe/budapest': 'de', 'europe/ljubljana': 'de', 'europe/zagreb': 'de',
    'europe/stockholm': 'de', 'europe/copenhagen': 'de', 'europe/oslo': 'de', 'europe/helsinki': 'de', 'europe/tallinn': 'de', 'europe/riga': 'de', 'europe/vilnius': 'de',
    'europe/bucharest': 'de', 'europe/sofia': 'de', 'europe/athens': 'de',
    'europe/paris': 'fr', 'europe/monaco': 'fr',
    'europe/madrid': 'es', 'atlantic/canary': 'es', 'europe/lisbon': 'es', 'atlantic/madeira': 'es', 'atlantic/azores': 'es', 'europe/andorra': 'es', 'europe/gibraltar': 'es',
    'europe/rome': 'it', 'europe/vatican': 'it', 'europe/san_marino': 'it', 'europe/malta': 'it',
    'europe/brussels': 'be', 'europe/amsterdam': 'be',
    'europe/istanbul': 'tr', 'asia/istanbul': 'tr', 'turkey': 'tr'
  };
  var LANG_EXACT = { 'fr-ca': 'us', 'en-ca': 'us', 'es-us': 'us', 'es-mx': 'us', 'es-419': 'us', 'pt-br': 'us', 'nl-be': 'be', 'fr-be': 'be', 'de-be': 'be', 'en-gb': 'uk', 'cy-gb': 'uk', 'en-ie': 'uk', 'ga-ie': 'uk', 'pt-pt': 'es', 'de-at': 'de', 'de-ch': 'de', 'fr-ch': 'fr', 'it-ch': 'it' };
  var LANG_PREFIX = [['tr', 'tr'], ['de', 'de'], ['fr', 'fr'], ['es', 'es'], ['ca', 'es'], ['eu', 'es'], ['gl', 'es'], ['it', 'it'], ['nl', 'be'], ['pl', 'de'], ['cs', 'de'], ['sk', 'de'], ['hu', 'de'], ['sv', 'de'], ['da', 'de'], ['nb', 'de'], ['nn', 'de'], ['no', 'de'], ['fi', 'de'], ['el', 'de'], ['ro', 'de'], ['bg', 'de'], ['hr', 'de'], ['sl', 'de']];

  function resolveStore() {
    var tz = '';
    try { tz = String(Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase(); } catch (e) { /* noop */ }
    if (TZ_MAP[tz]) return STORES[TZ_MAP[tz]];
    var langs = [];
    try { langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || navigator.userLanguage || 'en']).map(function (l) { return String(l).toLowerCase(); }); } catch (e) { /* noop */ }
    for (var i = 0; i < langs.length; i++) {
      var lang = langs[i];
      if (LANG_EXACT[lang]) return STORES[LANG_EXACT[lang]];
      for (var j = 0; j < LANG_PREFIX.length; j++) {
        var p = LANG_PREFIX[j][0];
        if (lang === p || lang.indexOf(p + '-') === 0) return STORES[LANG_PREFIX[j][1]];
      }
    }
    return STORES.us;
  }
  var STORE = resolveStore();

  // ── ASIN map ───────────────────────────────────────────────────────────────────────────────
  // Key: lower-cased "name|brand" exactly as in perfumes.js / celebs.js / blog .frag-name + .frag-brand.
  // Value: { us: 'B0…', de: 'B0…', … } — one ASIN per marketplace (ASINs differ between stores
  // and between sizes; pick the standard 100ml EDP/EDT listing sold by Amazon or a real retailer).
  // Maintained via `node scripts/asin-map.js` (CSV in content-briefs/asin-map.csv). Do not edit the
  // block between the markers by hand — the script regenerates it.
  var ASINS = /* sw:asins */ {} /* /sw:asins */;

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function asinFor(name, brand, store) {
    var n = norm(name), b = norm(brand);
    var rec = ASINS[n + '|' + b] || (b ? null : ASINS[n + '|']) || null;
    if (!rec && b) {
      // Tolerate brand spelled differently (e.g. "YSL" vs "Yves Saint Laurent") when the name is unique.
      var hit = null, k;
      for (k in ASINS) { if (k.indexOf(n + '|') === 0) { if (hit) { hit = null; break; } hit = ASINS[k]; } }
      rec = hit;
    }
    return rec && rec[store.code] ? String(rec[store.code]) : '';
  }

  // ── Link builder ───────────────────────────────────────────────────────────────────────────
  function searchQuery(name, brand, store) {
    var n = String(name || '').trim(), b = String(brand || '').trim();
    var q = (b && n.toLowerCase().indexOf(b.toLowerCase()) === -1) ? b + ' ' + n : n;
    return (q + ' ' + store.kw).trim();
  }
  function tagFor(store, surface) {
    var per = SURFACE_TAGS[store.code] || {};
    return (surface && per[surface]) || store.tag || '';
  }
  /**
   * link(name, brand, { surface })
   * → https://www.amazon.fr/dp/B00XXXXXXX?tag=…           when an ASIN is known for this store
   * → https://www.amazon.fr/s?k=Prada+L%27Homme+parfum&i=beauty&tag=…   otherwise
   * `i=beauty` restricts the search to the Beauty department (no unrelated sponsored products,
   * and Beauty/Premium Beauty commission rates instead of the "Unknown" bucket).
   */
  function link(name, brand, opts) {
    opts = opts || {};
    var store = (opts.store && STORES[opts.store]) || STORE;
    var tag = tagFor(store, opts.surface);
    var asin = asinFor(name, brand, store);
    var url;
    if (asin) {
      url = 'https://www.' + store.domain + '/dp/' + encodeURIComponent(asin) + '?th=1&psc=1';
      if (tag) url += '&tag=' + encodeURIComponent(tag);
    } else {
      url = 'https://www.' + store.domain + '/s?k=' + encodeURIComponent(searchQuery(name, brand, store)) + '&i=beauty';
      if (tag) url += '&tag=' + encodeURIComponent(tag);
    }
    if (opts.surface) url += '#sw-' + encodeURIComponent(opts.surface); // never reaches Amazon; read back by the click tracker
    return url;
  }

  // ── Click analytics ────────────────────────────────────────────────────────────────────────
  // Associates only reports per tracking ID; this tells GA4 / Plausible which surface and store
  // each outbound click came from, and whether it was a product (/dp/) or a search link.
  function onClick(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var m = /^https:\/\/www\.(amazon\.[a-z.]+)\/(dp\/([A-Z0-9]{10})|s\?)/.exec(href);
    if (!m) return;
    var surface = (/#sw-([a-z0-9_-]+)$/i.exec(href) || [])[1] || a.getAttribute('data-surface') || (document.body.classList.contains('blog') || location.pathname.indexOf('/blog/') === 0 ? 'blog' : 'app');
    var params = { store: m[1], surface: surface, link_type: m[3] ? 'product' : 'search', asin: m[3] || '', page: location.pathname };
    try { if (typeof window.gtag === 'function') window.gtag('event', 'affiliate_click', params); } catch (err) { /* noop */ }
    try { if (typeof window.plausible === 'function') window.plausible('Affiliate Click', { props: params }); } catch (err) { /* noop */ }
  }
  document.addEventListener('click', onClick, true);
  document.addEventListener('auxclick', onClick, true);

  window.SW_AMZ = { link: link, store: STORE, stores: STORES, asinFor: asinFor, searchQuery: searchQuery, resolveStore: resolveStore };
})();
