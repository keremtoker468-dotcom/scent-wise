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
  var ASINS = /* sw:asins */ {
    "1 million|paco rabanne": {"us":"B00E5VH6QG"},
    "212 vip|carolina herrera": {"us":"B0DVZPJ4L7"},
    "9pm|afnan": {"us":"B07RTQ4VM7"},
    "acqua di gio profondo|giorgio armani": {"us":"B019UBI23Q"},
    "acqua di gio|giorgio armani": {"us":"B000E7YK5K"},
    "adidas dynamic pulse|adidas &mdash;": {"us":"B00H8K4FWO"},
    "afnan 9pm|afnan &mdash;": {"us":"B07RTQ4VM7"},
    "afnan supremacy not only intense|afnan": {"us":"B07W6WLZKD"},
    "alien|mugler": {"us":"B00D2I503O"},
    "amber oud gold edition|al haramain perfumes": {"us":"B08176Y3T1"},
    "ameer al oudh|lattafa perfumes": {"us":"B09JZFZ4BW"},
    "amiri|arabian oud": {"us":"B09VTHFMQ9"},
    "armaf club de nuit intense man best value|armaf &mdash;": {"us":"B00M3IFUMK"},
    "armani code|giorgio armani": {"us":"B0BTDCRCXF"},
    "asad|lattafa perfumes": {"us":"B0B8TQ7YRW"},
    "bade'e al oud oud for glory|lattafa perfumes": {"us":"B08HVXDLXK"},
    "bade'e al oud sublime|lattafa perfumes": {"us":"B0C5N4J94J"},
    "beautiful|estée lauder": {"us":"B000VCW7EO"},
    "black afgano|nasomatto": {"us":"B003WGIDM6"},
    "black opium|yves saint laurent": {"us":"B00YVTO5FM"},
    "bloom eau de toilette|gucci": {"us":"B09SZRNJW9"},
    "bombshell victoria's|victoria s secret": {"us":"B07XC2RYLF"},
    "boss bottled|hugo boss": {"us":"B001O8MI2K"},
    "boss the scent|hugo boss": {"us":"B012NOWOAO"},
    "bright crystal|versace": {"us":"B000O2T3DY"},
    "chrome|azzaro": {"us":"B00017XGDU"},
    "ck one|calvin klein": {"us":"B000E7WFX4"},
    "cloud|ariana grande": {"us":"B07JPZ95ZP"},
    "club de nuit intense man|armaf": {"us":"B07NPLPWJH"},
    "coach for men|coach": {"us":"B074N2Y15P"},
    "cool water parfum|davidoff": {"us":"B096V6NQSQ"},
    "cr7|cristiano ronaldo": {"us":"B079D1D31L"},
    "crystal noir|versace": {"us":"B003NLZKVW"},
    "côte d'azur|oribe": {"us":"B09BGM21P9"},
    "daisy|marc jacobs": {"us":"B001RVH4HS"},
    "dance|shakira": {"us":"B01N94AZJC"},
    "davidoff cool water|davidoff &mdash;": {"us":"B07C1PYQLC"},
    "dedcool 01|dedcool": {"us":"B0BNTLYDRK"},
    "devotion dolce&gabbana|dolce gabbana": {"us":"B0CLFJZ52P"},
    "dossier woody sandalwood|dossier": {"us":"B0D7D6R7YY"},
    "eilish|billie eilish": {"us":"B09MZXJ9GW"},
    "emporio armani stronger with you intensely|giorgio armani": {"us":"B07PTTFFPT"},
    "emporio armani stronger with you|giorgio armani": {"us":"B071SGZ7CK"},
    "encre noire|lalique": {"us":"B001FORJXQ"},
    "eros flame|versace": {"us":"B07K1FVM4S"},
    "eros|versace": {"us":"B00B4TR3KG"},
    "estée lauder beautiful|estée lauder": {"us":"B000VCW7EO"},
    "eternity|calvin klein": {"us":"B00021AJ5I"},
    "euphoria|calvin klein": {"us":"B000XE1TUI"},
    "explorer|montblanc": {"us":"B07K1BW1XY"},
    "fakhar lattafa|lattafa perfumes": {"us":"B07XWMY2Y2"},
    "fame|paco rabanne": {"us":"B0B8SSD56T"},
    "fantasy|britney spears": {"us":"B000ZJW6TY"},
    "fico di amalfi|acqua di parma": {"us":"B007F0WNVW"},
    "fine'ry not another cherry|fine'ry": {"us":"B0BVY3PBJL"},
    "flowerbomb nectar|viktor&rolf": {"us":"B07B3S9JK6"},
    "flowerbomb viktor&rolf|viktor rolf": {"us":"B00BEG4QH2"},
    "flowerbomb|viktor & rolf": {"us":"B0010VY4HI"},
    "flowerbomb|viktor&rolf": {"us":"B00BEG4QH2"},
    "fuel for men|donna karan": {"us":"B003E856LS"},
    "glossier you|glossier": {"us":"B0C3C3C376"},
    "glow|jennifer lopez": {"us":"B0000BV14L"},
    "god is a woman|ariana grande": {"us":"B09PBNX9C7"},
    "good girl|carolina herrera": {"us":"B09B678JQC"},
    "guess seductive homme blue|guess &mdash;": {"us":"B0097EAW30"},
    "guilty pour homme|gucci": {"us":"B00D58PEE6"},
    "hawas for him|rasasi": {"us":"B01LDT51ZU"},
    "hawas|rasasi": {"us":"B01LDT51ZU"},
    "idôle lancôme|lancome": {"us":"B07MR3H8NY"},
    "infusion d'iris|prada": {"us":"B001FWXHK2"},
    "invictus|paco rabanne": {"us":"B00DAUYQX4"},
    "jean paul gaultier le male le parfum|jean paul gaultier &mdash;": {"us":"B08FBQWRYC"},
    "k by dolce & gabbana dolce&gabbana|dolce gabbana": {"us":"B07RYWR3LW"},
    "khamrah|lattafa perfumes": {"us":"B0B92Y18GT"},
    "l'aventure|al haramain perfumes": {"us":"B01F9OUNYE"},
    "l'eau d'issey pour homme|issey miyake": {"us":"B002CT3PXG"},
    "la nuit de l'homme|yves saint laurent": {"us":"B0021MLVA8"},
    "la vie est belle lancôme|lancome": {"us":"B00I7PK3GQ"},
    "la vie est belle|lanc&ocirc;me": {"us":"B00I7PK3GQ"},
    "lady million|paco rabanne": {"us":"B07GH2L15Z"},
    "lancôme la vie est belle|lancôme": {"us":"B00I7PK3GQ"},
    "lattafa khamrah|lattafa &mdash;": {"us":"B0B92Y18GT"},
    "le beau|jean paul gaultier": {"us":"B07TK2966Q"},
    "le male elixir|jean paul gaultier": {"us":"B0C5RWY7P8"},
    "le male|jean paul gaultier": {"us":"B001BAG38G"},
    "legend|montblanc": {"us":"B0050EB0Q4"},
    "libre|ysl": {"us":"B07X1YGWSX"},
    "libre|yves saint laurent": {"us":"B07X1YGWSX"},
    "luna rossa carbon|prada": {"us":"B0755RG3HC"},
    "luna rossa ocean|prada": {"us":"B09FVY4T7M"},
    "maison alhambra philos rosso|maison alhambra": {"us":"B09MYFYMXP"},
    "mediterranean honeysuckle|aerin": {"us":"B00TUPEW3W"},
    "missing person|phlur": {"us":"B0F486953N"},
    "molecule 01|escentric molecules": {"us":"B01FRH5EFQ"},
    "mon paris|ysl": {"us":"B01H2D7G72"},
    "mon paris|yves saint laurent": {"us":"B01H2D7G72"},
    "my way|giorgio armani": {"us":"B08DH7CVCR"},
    "mémoire d’une odeur|gucci": {"us":"B07WL6ZWQL"},
    "narciso rodriguez for her|narciso rodriguez": {"us":"B000VOP7YO"},
    "nautica voyage best overall|nautica &mdash;": {"us":"B003HHWHUE"},
    "nautica voyage|nautica": {"us":"B003HHWHUE"},
    "nautica voyage|nautica &mdash;": {"us":"B003HHWHUE"},
    "nomade|chloe": {"us":"B079ZQ2Q9Z"},
    "not a perfume|juliette has a gun": {"us":"B0130MFX74"},
    "perry ellis 360 red|perry ellis &mdash;": {"us":"B000C1W38O"},
    "perry ellis midnight|perry ellis": {"us":"B09MLZWHCG"},
    "polo blue|ralph lauren": {"us":"B000C219QA"},
    "polo red|ralph lauren": {"us":"B00H6UPQ3S"},
    "prada candy|prada": {"us":"B005KF5WYO"},
    "prada l'homme|prada": {"us":"B07X5778KK"},
    "prada luna rossa carbon|prada &mdash;": {"us":"B0755RG3HC"},
    "prada paradoxe|prada": {"us":"B0B3Y28N87"},
    "r.e.m.|ariana grande": {"us":"B08NHVV6KX"},
    "raghba|lattafa perfumes": {"us":"B08RNCSFTY"},
    "rasasi hawas|rasasi": {"us":"B01LDT51ZU"},
    "rasasi hawas|rasasi &mdash;": {"us":"B01LDT51ZU"},
    "rasasi la yuqawam|rasasi": {"us":"B00UBLVQ0G"},
    "s by shakira|shakira": {"us":"B00468F24G"},
    "scandal|jean paul gaultier": {"us":"B0748GD9DD"},
    "shaghaf oud|swiss arabian": {"us":"B076CSFM9C"},
    "sol de janeiro brazilian bum bum cream|sol de janeiro": {"us":"B013XKHA4M"},
    "spicebomb extreme viktor&rolf|viktor rolf": {"us":"B00WYP5ZHW"},
    "spicebomb extreme|viktor & rolf": {"us":"B00WYP5ZHW"},
    "spicebomb viktor&rolf|viktor rolf": {"us":"B007D1VGSY"},
    "still|jennifer lopez": {"us":"B0746MYRVW"},
    "supremacy silver|afnan": {"us":"B07BGDV4WD"},
    "tres nuit|armaf": {"us":"B00NQGPPW8"},
    "trussardi donna|trussardi": {"us":"B00JRRV7RC"},
    "trésor lancôme|lancome": {"us":"B005IQ2F4A"},
    "trésor midnight rose|lancôme": {"us":"B00DQ5SP3A"},
    "valentino donna born in roma|valentino": {"us":"B07YCLHHB4"},
    "valentino uomo born in roma|valentino": {"us":"B07YDGWWPL"},
    "valentino uomo born in roma|valentino &mdash;": {"us":"B07YDGWWPL"},
    "versace eros|versace": {"us":"B00B4TR3KG"},
    "versace pour homme|versace": {"us":"B01F2LB2GM"},
    "versace pour homme|versace &mdash;": {"us":"B01F2LB2GM"},
    "voce viva|valentino": {"us":"B00H1FB0OW"},
    "wanted|azzaro": {"us":"B003JSEG4Q"},
    "west loop|michael malul london": {"us":"B0CJMN62F4"},
    "yara|lattafa perfumes": {"us":"B09C8VNWBP"}
  } /* /sw:asins */;

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
