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
    "1 million|paco rabanne": {"us":"B01MS0OXYR","uk":"B00FFJ53PS","de":"B00FFJ53PS","fr":"B00FFJ53PS","es":"B00FFJ53PS","it":"B00FFJ53PS"},
    "9pm|afnan": {"us":"B07RTQ4VM7","uk":"B07RTQ4VM7","de":"B07RTQ4VM7","fr":"B07RTQ4VM7","es":"B07RTQ4VM7","it":"B07RTQ4VM7"},
    "accento|xerjoff": {"us":"B00NAXK388","uk":"B00NAXK388","de":"B00NAXK388","fr":"B07VGMB6P2","es":"B00NAXK388","it":"B00NAXK388"},
    "acqua di gio|giorgio armani": {"us":"B000E7YK5K","uk":"B000E7YK5K","de":"B000E7YK5K","fr":"B000E7YK5K","es":"B000E7YK5K","it":"B000MJZO64"},
    "alexandria ii|xerjoff": {"us":"B07GJVV8JV","uk":"B07GJVV8JV","de":"B07GJVV8JV","fr":"B07GJVV8JV","es":"B07GJVV8JV","it":"B07GJVV8JV"},
    "alien|mugler": {"us":"B00D2I503O","uk":"B00D2I503O","de":"B00D2I503O","fr":"B00D2I503O","es":"B00D2I503O","it":"B00D2I503O"},
    "althaïr|parfums de marly": {"us":"B0CLFCGRRM","uk":"B0CLFCGRRM","de":"B0CLFCGRRM","fr":"B0CLFCGRRM","es":"B0CLFCGRRM","it":"B0CLFCGRRM"},
    "ameer al oudh|lattafa perfumes": {"us":"B01MSXP4OG","uk":"B01MSXP4OG","de":"B01MSXP4OG","fr":"B01MSXP4OG","es":"B01MSXP4OG","it":"B01MSXP4OG"},
    "angel|mugler": {"us":"B08S5PFDGV","uk":"B08S5PFDGV","de":"B08S5PFDGV","es":"B08S5PFDGV","it":"B08S5PFDGV"},
    "ani|nishane": {"us":"B07TS81MVH","uk":"B07TXFD8WY","de":"B07TS81MVH","fr":"B07TS81MVH","es":"B07TS81MVH","it":"B07TS81MVH"},
    "another 13|le labo": {"us":"B07BQYZDFS","uk":"B07BQYZDFS","de":"B07BQYZDFS","fr":"B07BQYZDFS","es":"B07BQYZDFS","it":"B07BQYZDFS"},
    "armani code|giorgio armani": {"us":"B00MMOH15Y","uk":"B0BV2M7RC1","de":"B0BTDCRCXF","es":"B0BTDCRCXF","it":"B0BTDCRCXF"},
    "asad|lattafa perfumes": {"us":"B0B8TQ7YRW","uk":"B0B8TQ7YRW","de":"B0B8TQ7YRW","fr":"B0B8TQ7YRW","es":"B0B8TQ7YRW","it":"B0B8TQ7YRW"},
    "aventus|creed": {"us":"B0799KPC58","uk":"B06ZZGNMYD","de":"B06ZZGNMYD","fr":"B06ZZGNMYD","es":"B06ZZGNMYD","it":"B078YXJC5F"},
    "baccarat rouge 540|maison francis kurkdjian": {"us":"B01B7AP3RQ","uk":"B01B7AP3RQ","de":"B01B7AP3RQ","es":"B01B7AP3RQ","it":"B01CAT5A0S"},
    "bade'e al oud oud for glory|lattafa perfumes": {"us":"B08HVXDLXK","uk":"B08HVXDLXK","de":"B08HVXDLXK","fr":"B08HVXDLXK","es":"B08HVXDLXK","it":"B08HVXDLXK"},
    "bade'e al oud sublime|lattafa perfumes": {"us":"B0C5N4J94J","uk":"B0C5N4J94J","de":"B0C5N4J94J","fr":"B0C5N4J94J","es":"B0C5N4J94J","it":"B0C5N4J94J"},
    "bal d'afrique|byredo": {"us":"B0BRBLDDPL","uk":"B0BRBLDDPL","de":"B0BRBLDDPL","fr":"B0BRBLDDPL","es":"B0BRBLDDPL","it":"B0BRBLDDPL"},
    "bergamote 22|le labo": {"us":"B07DP87QNN","uk":"B07DP87QNN","de":"B07DP87QNN","fr":"B07DP87QNN","es":"B07DP87QNN","it":"B07DP87QNN"},
    "black afgano|nasomatto": {"us":"B003WGIDM6","uk":"B003WGIDM6","de":"B003WGIDM6","fr":"B003WGIDM6","es":"B003WGIDM6","it":"B003WGIDM6"},
    "black opium|yves saint laurent": {"us":"B07P9VPR96","uk":"B074KDTJ3N","de":"B00NBK5JHK","fr":"B07P9VPR96","es":"B00NBK5JHK","it":"B00NBK5JHK"},
    "blanche|byredo": {"us":"B00D8H8H5C","uk":"B0BZWPVS9B","de":"B00D8H8H5C","es":"B00GDLJYMU","it":"B00D8H8H5C"},
    "bleu de chanel|chanel": {"us":"B00NAH3GNI","uk":"B00NAH3GNI","de":"B00NAH3GNI","fr":"B00NAH3GNI","es":"B00NAH3GNI","it":"B00NAH3GNI"},
    "boss bottled|hugo boss": {"us":"B000RPLZAM","uk":"B000RPLZAM","de":"B000RPLZAM","es":"B000RPLZAM","it":"B000RPLZAM"},
    "burberry her|burberry": {"us":"B0GTWSYTHK","uk":"B07H739RNL","de":"B07H739RNL","fr":"B07H739RNL","es":"B07H739RNL","it":"B07H739RNL"},
    "by the fireplace|maison martin margiela": {"us":"B016PIL63K","uk":"B016PIL63K","de":"B016PIL63K","fr":"B0DMQFRJCM","es":"B016PIL63K","it":"B016PIL63K"},
    "carlisle|parfums de marly": {"us":"B079X4Y4MG","uk":"B079X4Y4MG","de":"B079X4Y4MG","fr":"B079X4Y4MG","es":"B079X4Y4MG","it":"B079X4Y4MG"},
    "chance eau tendre|chanel": {"us":"B003L38T7E","uk":"B003L38T7E","de":"B003L38T7E","es":"B003L38T7E","it":"B003L38T7E"},
    "chanel no 5 parfum|chanel": {"us":"B000VOJ9BG","uk":"B000VOJ9BG","de":"B000VOJ9BG","fr":"B000VOJ9BG","es":"B000VOJ9BG","it":"B000VOJ9BG"},
    "ck one|calvin klein": {"us":"B000E7WFX4","uk":"B00HAOP8UQ","de":"B00HAOP8UQ","fr":"B00HAOP8UQ","es":"B00HAOP8UQ","it":"B00HAOP8UQ"},
    "cloud|ariana grande": {"us":"B07JPZ95ZP","uk":"B07JPZ95ZP","de":"B07JPZ95ZP","fr":"B07JPZ95ZP","es":"B07JPZ95ZP","it":"B07JPZ95ZP"},
    "club de nuit intense man|armaf": {"us":"B00M3IFUMK","uk":"B00M3IFUMK","de":"B00M3IFUMK","fr":"B00M3IFUMK","es":"B00M3IFUMK","it":"B00M3IFUMK"},
    "coco mademoiselle|chanel": {"us":"B0042UC6GU","uk":"B0042UC6GU","de":"B000XDX08I","fr":"B0066L5ITU","es":"B0066L5ITU","it":"B0066L5ITU"},
    "cool water|davidoff": {"us":"B00BEESZW6","uk":"B0009OAHC8","de":"B0009OAHC8","fr":"B0009OAHC8","es":"B0009OAHC8","it":"B0009OAHC8"},
    "crystal noir|versace": {"us":"B000WZIVEA","uk":"B009YERAM4","de":"B009YERAM4","fr":"B009YERAM4","es":"B009YERAM4","it":"B009YERAM4"},
    "daisy|marc jacobs": {"us":"B0012RV5UO","uk":"B0012RV5UO","de":"B0012RV5UO","fr":"B0012RV5UO","es":"B0012RV5UO","it":"B0012RV5UO"},
    "delina|parfums de marly": {"us":"B06ZZV8BQD","uk":"B06ZZV8BQD","de":"B06ZZV8BQD","fr":"B06ZZV8BQD","es":"B06ZZV8BQD","it":"B06ZZV8BQD"},
    "english pear & freesia|jo malone london": {"us":"B0DPJ8QNJK","uk":"B0849B9DXR"},
    "erba pura|xerjoff": {"us":"B0CZTZLQG6","uk":"B0CZTZLQG6","de":"B0CZTZLQG6","fr":"B0CZTZLQG6","es":"B0CZTZLQG6","it":"B0CZTZLQG6"},
    "eros|versace": {"us":"B00B4TR3KG","uk":"B00B4TR3KG","de":"B00B4TR3KG","fr":"B00B4TR3KG","es":"B00B4TR3KG","it":"B00B4TR3KG"},
    "explorer|montblanc": {"us":"B07K1BW1XY","uk":"B07K1BW1XY","de":"B07K1H9YZY","fr":"B07K1H9YZY","es":"B07K1H9YZY","it":"B07K1H9YZY"},
    "fahrenheit|dior": {"us":"B0009OAGOC","uk":"B0009OAGOC","de":"B0009OAGOC","fr":"B00102LR2C","es":"B00102LR2C","it":"B0117YTLQG"},
    "fakhar lattafa|lattafa perfumes": {"us":"B08RHWX6G1","uk":"B07XWMY2Y2","de":"B08RHWX6G1","fr":"B08RHWX6G1","es":"B08RHWX6G1","it":"B08RHWX6G1"},
    "fan your flames|nishane": {"us":"B013UBTG32","uk":"B013UBTG32","de":"B013UBTG32","fr":"B06XPM53DX","es":"B013UBTG32","it":"B013UBTG32"},
    "flora gorgeous gardenia|gucci": {"us":"B09L5HB2LC","uk":"B09L5HB2LC","de":"B09L5HB2LC","fr":"B09L5HB2LC","es":"B09L5HB2LC","it":"B09L5HB2LC"},
    "gabrielle|chanel": {"us":"B075BLC569","uk":"B07BYM1ZZZ","de":"B07BYM1ZZZ","fr":"B07BYM1ZZZ","es":"B07BYM1ZZZ","it":"B07BYM1ZZZ"},
    "good girl|carolina herrera": {"us":"B09B678JQC","uk":"B01IYBVIL6","de":"B01IYBVIL6","es":"B01IYBVIL6","it":"B01KYQTVYA"},
    "greenley|parfums de marly": {"us":"B0CLFQ55CM","uk":"B0982S5XST","de":"B0982S5XST","fr":"B0982S5XST","es":"B0982S5XST","it":"B0982S5XST"},
    "gypsy water|byredo": {"us":"B00APOPOKC","uk":"B00APOPOKC","de":"B00APOPOKC","fr":"B00APOPOKC","es":"B00APOPOKC","it":"B00APOPOKC"},
    "hacivat|nishane": {"us":"B0CZXVGV8V","uk":"B0CZXVGV8V","de":"B0CZXVGV8V","fr":"B0CZXVGV8V","es":"B0CZXVGV8V","it":"B0CZXVGV8V"},
    "herod|parfums de marly": {"us":"B00H9I101Y","uk":"B00H9I101Y","de":"B00H9I101Y","fr":"B00H9I101Y","es":"B00H9I101Y","it":"B00H9I101Y"},
    "invictus|paco rabanne": {"us":"B00DAUYQX4","uk":"B00DAUYQX4","de":"B00DAUYQX4","fr":"B00DAUYQX4","es":"B00DAUYQX4","it":"B00DAUYQX4"},
    "j'adore|dior": {"us":"B00AC2KDXK","uk":"B0DZJX3XMY","de":"B0DZJX3XMY","fr":"B0DZJX3XMY","es":"B0DZJX3XMY","it":"B0DZJX3XMY"},
    "jazz club|maison martin margiela": {"us":"B00JAMLFHQ","uk":"B00JAMLFHQ","de":"B00JAMLFHQ","fr":"B0DMQBJXSV","es":"B00JAMLFHQ","it":"B00JAMLFHQ"},
    "khamrah|lattafa perfumes": {"us":"B0B92Y18GT","uk":"B0B92Y18GT","de":"B0B92Y18GT","fr":"B0B92Y18GT","es":"B0B92Y18GT","it":"B0B92Y18GT"},
    "la nuit de l'homme|yves saint laurent": {"us":"B0021MLVA8","uk":"B0021MLVA8","de":"B0021MLVA8","fr":"B0021MLVA8","es":"B0021MLVA8","it":"B0021MLVA8"},
    "la vie est belle lancôme|lancome": {"us":"B00I7PK3GQ","uk":"B00I7PK3GQ","de":"B00I7PK3GQ","fr":"B00I7PK3GQ","es":"B00I7PK3GQ","it":"B00I7PK3GQ"},
    "layton|parfums de marly": {"us":"B01LYHEA5S","uk":"B01LYHEA5S","de":"B01LYHEA5S","fr":"B01LYHEA5S","es":"B01LYHEA5S","it":"B01LYHEA5S"},
    "le male|jean paul gaultier": {"us":"B0733677R6","uk":"B0733677R6","de":"B0733677R6","es":"B0733677R6","it":"B0733677R6"},
    "libre intense|yves saint laurent": {"us":"B08H3PCGWT","uk":"B08H3PCGWT","de":"B08H3PCGWT","fr":"B08H3PCGWT","es":"B08H3PCGWT","it":"B08H3PCGWT"},
    "libre|yves saint laurent": {"us":"B098JCM9Q7","uk":"B07X1YGWSX","de":"B07X1YGWSX","fr":"B07X1YGWSX","es":"B07X1YGWSX","it":"B07X1YGWSX"},
    "miss dior|dior": {"us":"B09FY98RSG","uk":"B09FY98RSG","de":"B09FY98RSG","fr":"B09FY98RSG","es":"B09FY98RSG","it":"B09FY98RSG"},
    "mojave ghost|byredo": {"us":"B0B51C1LNW","uk":"B00NAX07ZM","de":"B00NAX07ZM","fr":"B00NAX07ZM","es":"B00NAX07ZM","it":"B00NAX07ZM"},
    "molecule 01|escentric molecules": {"us":"B0F27TMGK2","uk":"B019HXBCHU","de":"B019HXBCHU","fr":"B019HXBCHU","es":"B019HXBCHU","it":"B019HXBCHU"},
    "mon guerlain|guerlain": {"us":"B01N6XHMNE","uk":"B01N6XHMNE","de":"B01N6XHMNE","fr":"B01N6XHMNE","es":"B01N6XHMNE","it":"B01N6XHMNE"},
    "my way|giorgio armani": {"us":"B08DH7CVCR","uk":"B08DH7CVCR","de":"B08DHFX15Q","es":"B08DHFX15Q","it":"B08DHFX15Q"},
    "narcotic delight|initio parfums prives": {"us":"B0CTXKS12M","uk":"B0CTXKS12M","de":"B0CTXKS12M","fr":"B0CTXKS12M","es":"B0CTXKS12M","it":"B0CTXKS12M"},
    "not a perfume|juliette has a gun": {"us":"B0157V6USM","uk":"B07DGY6VDT","de":"B07DGY6VDT","fr":"B07DGY6VDT","es":"B07DGY6VDT","it":"B07DGY6VDT"},
    "oud for greatness|initio parfums prives": {"us":"B095CWW4MN","uk":"B07JL3RSLZ","de":"B07JL3RSLZ","fr":"B07JL3RSLZ","es":"B07JL3RSLZ","it":"B07JL3RSLZ"},
    "oud maracujá|maison crivelli": {"uk":"B0H2WQS7D1","de":"B0FLWHLH2M","fr":"B0FLWHLH2M","es":"B0FLWHLH2M","it":"B0FLWHLH2M"},
    "pegasus|parfums de marly": {"us":"B00EPGEZE2","uk":"B00EPGEZE2","de":"B00EPGEZE2","fr":"B00EPGEZE2","es":"B00EPGEZE2","it":"B00EPGEZE2"},
    "percival|parfums de marly": {"us":"B07JMKG771","uk":"B07JMKFTWW","de":"B07JMKFTWW","fr":"B07JMKFTWW","es":"B07JMKFTWW","it":"B07JMKFTWW"},
    "portrait of a lady|frederic malle": {"us":"B077XH7KR3","uk":"B077XH7KR3","de":"B077XH7KR3","fr":"B077XH7KR3","es":"B077XH7KR3","it":"B077XH7KR3"},
    "prada paradoxe|prada": {"us":"B0B3Y28N87","uk":"B0B3Y28N87","de":"B0B3Y28N87","fr":"B0B3Y28N87","es":"B0B3Y28N87","it":"B0B3Y28N87"},
    "raghba|lattafa perfumes": {"us":"B08RNCSFTY","uk":"B01EXK6JPM","de":"B01EXK6JPM","fr":"B01EXK6JPM","es":"B01EXK6JPM","it":"B01EXK6JPM"},
    "santal 33|le labo": {"us":"B09VL12323","uk":"B0792JYM8H","de":"B0792JYM8H","fr":"B0792JYM8H","es":"B0792JYM8H","it":"B0792JYM8H"},
    "sauvage elixir|dior": {"us":"B09FY38T89","uk":"B0BCWG85TB","de":"B0BCWG85TB","fr":"B0BCWG85TB","es":"B0BCWG85TB","it":"B0BCWG85TB"},
    "sauvage|dior": {"us":"B01MY1SF77","uk":"B000RO0NOW","de":"B000RO0NOW","fr":"B000RO0NOW","es":"B000RO0NOW","it":"B000RO0NOW"},
    "side effect|initio parfums prives": {"us":"B07BTL8TG8","uk":"B07BTL8TG8","de":"B07BTL8TG8","fr":"B07BTL8TG8","es":"B07BTL8TG8","it":"B07BTL8TG8"},
    "supremacy silver|afnan": {"us":"B07BGDV4WD","uk":"B07BGDV4WD","de":"B07BGDV4WD","fr":"B07BGDV4WD","es":"B07BGDV4WD","it":"B07BGDV4WD"},
    "torino21|xerjoff": {"us":"B0DV9SXTB6","uk":"B0DV9SXTB6","de":"B0DV9SXTB6","fr":"B0DV9SXTB6","es":"B0DV9SXTB6","it":"B0DV9SXTB6"},
    "valaya|parfums de marly": {"us":"B0C6H44XF3","uk":"B0C6H44XF3","de":"B0C6H44XF3","fr":"B0C6H44XF3","es":"B0C6H44XF3","it":"B0C6H44XF3"},
    "xj 1861 naxos|xerjoff": {"us":"B07D384KQG","uk":"B07D384KQG","de":"B07D384KQG","fr":"B07D384KQG","es":"B07D384KQG","it":"B07D384KQG"},
    "yara|lattafa perfumes": {"us":"B09C8VNWBP","uk":"B0CR1S643D","de":"B09C8VNWBP","fr":"B09C8VNWBP","es":"B09C8VNWBP","it":"B09C8VNWBP"}
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
