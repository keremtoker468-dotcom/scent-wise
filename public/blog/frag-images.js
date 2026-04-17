(function () {
  var style = document.createElement('style');
  style.textContent = [
    '.frag-thumb{width:52px;height:52px;border-radius:10px;flex-shrink:0;overflow:hidden;',
    'position:relative;display:flex;align-items:center;justify-content:center;background:#1e2a1a}',
    '.frag-thumb img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .3s;position:absolute;inset:0}',
    '.frag-thumb img.ft-loaded{opacity:1}',
    '.ft-letter{font-weight:700;font-size:18px;color:rgba(255,255,255,.65);',
    "font-family:'DM Sans',sans-serif;line-height:1;pointer-events:none}",
    '.frag-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.frag-action-btn{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid rgba(201,169,110,.25);background:rgba(201,169,110,.08);color:#443a29;text-decoration:none;font-family:inherit;transition:background .2s,border-color .2s}',
    '.frag-action-btn:hover{background:rgba(201,169,110,.18);border-color:rgba(201,169,110,.4)}',
    '.frag-action-btn.active{background:#c9a96e;border-color:#c9a96e;color:#2a2218}',
    '.frag-profile-box{margin-top:10px;padding:12px;background:rgba(201,169,110,.06);border:1px solid rgba(201,169,110,.2);border-radius:10px;font-size:12px;color:#443a29}',
    '.frag-profile-box .sp-scores{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}',
    '.frag-profile-box .sp-score{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:10px;font-size:11px;background:rgba(255,255,255,.5);border:1px solid rgba(201,169,110,.18);color:#2a2218}',
    '.frag-profile-box .sp-score .sp-lbl{color:#595040}',
    '.frag-profile-box .sp-score .sp-bar{display:inline-block;width:32px;height:4px;border-radius:2px;background:rgba(120,95,40,.12);position:relative;overflow:hidden}',
    '.frag-profile-box .sp-score .sp-fill{position:absolute;left:0;top:0;height:100%;border-radius:2px}',
    '.frag-profile-box .sp-bb{display:inline-block;margin-top:8px;padding:5px 12px;border-radius:12px;font-size:11px;font-weight:600}',
    '.sw-cmp-bar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:900;display:flex;align-items:center;gap:10px;padding:10px 16px;background:#f5efe4;border:1px solid rgba(201,169,110,.3);border-radius:100px;box-shadow:0 10px 30px rgba(74,56,24,.18);font-size:13px;color:#2a2218}',
    '.sw-cmp-bar .sw-cmp-items{font-weight:600}',
    '.sw-cmp-bar .sw-cmp-go{display:inline-flex;align-items:center;gap:4px;padding:7px 14px;border-radius:100px;background:#c9a96e;color:#2a2218;font-weight:700;font-size:12px;text-decoration:none;border:none;cursor:pointer}',
    '.sw-cmp-bar .sw-cmp-go[disabled]{opacity:.5;cursor:not-allowed}',
    '.sw-cmp-bar .sw-cmp-clear{background:none;border:none;color:#595040;font-size:18px;cursor:pointer;padding:0 4px;line-height:1}',
    '@media(max-width:520px){.sw-cmp-bar{left:12px;right:12px;transform:none;bottom:12px;justify-content:space-between}}'
  ].join('');
  document.head.appendChild(style);

  var PALETTE = ['#1e2d40','#2d1e40','#1e402d','#402d1e','#401e2d','#2d401e','#1e3840','#38201e'];
  function bgColor(s) { return PALETTE[s.charCodeAt(0) % PALETTE.length]; }

  function cleanBrand(s) { return s.replace(/[\u2014\-].*$/, '').replace(/~?\$[\d.]+.*$/, '').trim(); }

  var STORES = {
    de: { domain: 'amazon.de', tag: 'scentwisede20-21' },
    fr: { domain: 'amazon.fr', tag: 'scentwisede0e-21' },
    es: { domain: 'amazon.es', tag: 'scentwised09f-21' },
    it: { domain: 'amazon.it', tag: 'scentwisede09-21' },
    uk: { domain: 'amazon.co.uk', tag: 'scentwiseuk-21' },
    be: { domain: 'amazon.com.be', tag: 'scentwisebe-21' },
    us: { domain: 'amazon.com', tag: 'scentwise20-20' }
  };
  var _amzGeo = (function() {
    var tz = '';
    try { tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase(); } catch (e) {}
    var TZ_MAP = { 'europe/paris':'fr','europe/monaco':'fr','europe/berlin':'de','europe/vienna':'de','europe/zurich':'de','europe/luxembourg':'de','europe/madrid':'es','europe/rome':'it','europe/london':'uk','europe/dublin':'uk','europe/brussels':'be','europe/amsterdam':'be' };
    if (TZ_MAP[tz]) return STORES[TZ_MAP[tz]];
    var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || navigator.userLanguage || 'en']).map(function(l) { return String(l).toLowerCase(); });
    for (var i = 0; i < langs.length; i++) {
      var lang = langs[i];
      if (lang === 'nl-be' || lang === 'fr-be') return STORES.be;
      if (lang === 'en-gb') return STORES.uk;
      if (lang.indexOf('de') === 0) return STORES.de;
      if (lang.indexOf('fr') === 0) return STORES.fr;
      if (lang.indexOf('es') === 0) return STORES.es;
      if (lang.indexOf('it') === 0) return STORES.it;
      if (lang.indexOf('nl') === 0) return STORES.be;
    }
    return STORES.us;
  })();
  function amzLink(name, brand) {
    return 'https://www.' + _amzGeo.domain + '/s?k=' + encodeURIComponent(name + ' ' + brand + ' perfume') + '&tag=' + _amzGeo.tag;
  }
  function addAmazonBtn(card, name, brand) {
    if (card.querySelector('.amz-btn')) return;
    var a = document.createElement('a');
    a.href = amzLink(name, brand);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'amz-btn frag-action-btn';
    a.textContent = 'Shop on Amazon';
    a.style.cssText = 'color:#b97600;background:rgba(255,153,0,.08);border-color:rgba(255,153,0,.2)';
    var actions = ensureActions(card);
    actions.appendChild(a);
  }

  function ensureActions(card) {
    var info = card.querySelector('.frag-info') || card;
    var actions = info.querySelector('.frag-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'frag-actions';
      info.appendChild(actions);
    }
    return actions;
  }

  // ═══ COMPARE ═══
  var _CMP_KEY = 'sw_compare_v1';
  function getCompare() {
    try { var d = JSON.parse(localStorage.getItem(_CMP_KEY)); return Array.isArray(d) ? d.slice(0, 3) : []; } catch (e) { return []; }
  }
  function setCompare(list) {
    try { localStorage.setItem(_CMP_KEY, JSON.stringify(list.map(function(c) { return { name: c.name, brand: c.brand }; }))); } catch (e) {}
  }
  function cmpKey(n, b) { return ((n||'') + '|' + (b||'')).toLowerCase(); }
  function inCompare(name, brand) {
    var k = cmpKey(name, brand);
    return getCompare().some(function(c) { return cmpKey(c.name, c.brand) === k; });
  }
  function toggleCompare(name, brand) {
    var list = getCompare();
    var k = cmpKey(name, brand);
    var idx = list.findIndex(function(c) { return cmpKey(c.name, c.brand) === k; });
    if (idx >= 0) { list.splice(idx, 1); setCompare(list); return false; }
    if (list.length >= 3) { alert('Compare up to 3 fragrances at a time. Remove one first.'); return inCompare(name, brand); }
    list.push({ name: name, brand: brand });
    setCompare(list);
    return true;
  }

  function addCompareBtn(card, name, brand) {
    if (card.querySelector('.cmp-btn')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cmp-btn frag-action-btn';
    function sync() {
      var on = inCompare(name, brand);
      b.classList.toggle('active', on);
      b.textContent = on ? 'In Compare' : '+ Compare';
    }
    b.onclick = function(e) {
      e.preventDefault();
      toggleCompare(name, brand);
      sync();
      renderCmpBar();
    };
    sync();
    ensureActions(card).appendChild(b);
  }

  function renderCmpBar() {
    var list = getCompare();
    var bar = document.getElementById('sw-cmp-bar');
    if (!list.length) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'sw-cmp-bar';
      bar.className = 'sw-cmp-bar';
      document.body.appendChild(bar);
    }
    var canCompare = list.length >= 2;
    bar.innerHTML = '<span class="sw-cmp-items">Compare ' + list.length + '/3</span>'
      + '<a class="sw-cmp-go" href="/?compare=1"' + (canCompare ? '' : ' onclick="event.preventDefault()" aria-disabled="true"') + (canCompare ? '' : ' disabled') + '>Compare &rarr;</a>'
      + '<button class="sw-cmp-clear" type="button" aria-label="Clear comparison">&times;</button>';
    bar.querySelector('.sw-cmp-clear').onclick = function() {
      setCompare([]);
      renderCmpBar();
      document.querySelectorAll('.cmp-btn.active').forEach(function(btn) { btn.classList.remove('active'); btn.textContent = '+ Compare'; });
    };
  }

  // ═══ SCENT PROFILE ═══
  var _PROFILE_CACHE_KEY = 'sw_scent_profiles_v1';
  function loadProfileCache() { try { return JSON.parse(localStorage.getItem(_PROFILE_CACHE_KEY)) || {}; } catch (e) { return {}; } }
  function saveProfileCache(c) { try { localStorage.setItem(_PROFILE_CACHE_KEY, JSON.stringify(c)); } catch (e) {} }
  function profileKey(n, b) { return ((n||'') + '|' + (b||'')).toLowerCase().trim(); }
  var _inflight = {};

  function fetchProfile(name, brand) {
    var k = profileKey(name, brand);
    var cache = loadProfileCache();
    if (cache[k]) return Promise.resolve(cache[k]);
    if (_inflight[k]) return _inflight[k];
    var prompt = 'For the fragrance "' + name + (brand ? ' by ' + brand : '') + '":\n\n'
      + 'Return ONLY a JSON object (no markdown, no code fences, no prose) with these exact keys:\n'
      + '{"longevity":1-5,"projection":1-5,"sillage":1-5,"versatility":1-5,"blindBuyRisk":"Low"|"Medium"|"Test first","blindBuyReason":"one short sentence explaining why","gender":"Male/Female/Unisex","concentration":"EDP/EDT/Parfum/etc","accords":"comma separated","notes":"comma separated top/heart/base notes","rating":1-5 or null}\n\n'
      + 'Base scores on community consensus and typical performance. If the fragrance is unknown, use null for all fields.';
    var p = fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
      credentials: 'same-origin',
      body: JSON.stringify({ mode: 'chat', messages: [{ role: 'user', content: prompt }] })
    })
      .then(function(r) { return r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)); })
      .then(function(j) {
        var raw = (j && j.result) || '';
        var jsonStr = String(raw).replace(/```json?\s*/g, '').replace(/```/g, '').trim();
        var info = JSON.parse(jsonStr);
        if (!info || typeof info !== 'object') return null;
        var c = loadProfileCache();
        c[k] = info;
        saveProfileCache(c);
        return info;
      })
      .catch(function() { return null; })
      .then(function(r) { delete _inflight[k]; return r; });
    _inflight[k] = p;
    return p;
  }

  function scoreBadge(label, n) {
    n = parseInt(n);
    if (!n || n < 1 || n > 5) return '';
    var pct = (n / 5) * 100;
    var color = n >= 4 ? '#3f7a4e' : n >= 3 ? '#9a7a1e' : '#b93b3b';
    return '<span class="sp-score"><span class="sp-lbl">' + label + '</span>'
      + '<span class="sp-bar"><span class="sp-fill" style="width:' + pct + '%;background:' + color + '"></span></span>'
      + '<span style="color:' + color + ';font-weight:700">' + n + '</span></span>';
  }
  function blindBuyBadge(risk, reason) {
    if (!risk) return '';
    var r = String(risk).toLowerCase();
    var bg, fg, bd;
    if (r.indexOf('low') === 0) { bg = 'rgba(72,138,85,.14)'; fg = '#3f7a4e'; bd = 'rgba(72,138,85,.3)'; }
    else if (r.indexOf('med') === 0) { bg = 'rgba(200,150,30,.16)'; fg = '#8a6510'; bd = 'rgba(200,150,30,.32)'; }
    else { bg = 'rgba(185,59,59,.12)'; fg = '#b93b3b'; bd = 'rgba(185,59,59,.28)'; }
    var esc = function(s) { return String(s).replace(/[&<>"]/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
    var txt = esc(risk) + (reason ? ' — ' + esc(reason) : '');
    return '<div class="sp-bb" style="background:' + bg + ';color:' + fg + ';border:1px solid ' + bd + '">' + txt + '</div>';
  }
  function renderProfile(info) {
    if (!info) return '<div style="font-size:12px;color:#595040">Details unavailable for this fragrance.</div>';
    var scores = [
      scoreBadge('Longevity', info.longevity),
      scoreBadge('Projection', info.projection),
      scoreBadge('Sillage', info.sillage),
      scoreBadge('Versatility', info.versatility)
    ].filter(Boolean).join('');
    var bb = blindBuyBadge(info.blindBuyRisk, info.blindBuyReason);
    if (!scores && !bb) return '<div style="font-size:12px;color:#595040">Details unavailable for this fragrance.</div>';
    return (scores ? '<div class="sp-scores">' + scores + '</div>' : '') + bb;
  }

  function addScentProfileBtn(card, name, brand) {
    if (card.querySelector('.sp-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sp-btn frag-action-btn';
    btn.textContent = 'Scent Profile';
    var box = null;
    btn.onclick = function(e) {
      e.preventDefault();
      if (box) { box.remove(); box = null; btn.classList.remove('active'); btn.textContent = 'Scent Profile'; return; }
      btn.classList.add('active');
      btn.textContent = 'Hide Profile';
      box = document.createElement('div');
      box.className = 'frag-profile-box';
      box.innerHTML = '<div style="font-size:12px;color:#595040">Loading profile...</div>';
      var info = card.querySelector('.frag-info') || card;
      info.appendChild(box);
      fetchProfile(name, brand).then(function(data) {
        if (!box) return;
        box.innerHTML = renderProfile(data);
      });
    };
    ensureActions(card).appendChild(btn);
  }

  function loadCard(card) {
    var nameEl = card.querySelector('.frag-name');
    if (!nameEl) return;
    var name = nameEl.textContent.trim();
    var brandEl = card.querySelector('.frag-brand');
    var brand = brandEl ? cleanBrand(brandEl.textContent) : '';

    addAmazonBtn(card, name, brand);
    addScentProfileBtn(card, name, brand);
    addCompareBtn(card, name, brand);

    if (card.querySelector('.frag-thumb')) return;

    var thumb = document.createElement('div');
    thumb.className = 'frag-thumb';
    thumb.style.background = bgColor(name);
    var letter = document.createElement('span');
    letter.className = 'ft-letter';
    letter.textContent = name.charAt(0).toUpperCase();
    thumb.appendChild(letter);

    var rank = card.querySelector('.frag-rank');
    if (rank) rank.after(thumb); else card.insertBefore(thumb, card.firstChild);

    fetch('/api/img?name=' + encodeURIComponent(name) + '&brand=' + encodeURIComponent(brand))
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (imgs) {
        if (!imgs || !imgs[0] || !imgs[0].thumb) return;
        var img = document.createElement('img');
        img.alt = name;
        img.loading = 'lazy';
        img.onload = function () { img.classList.add('ft-loaded'); };
        img.onerror = function () { img.remove(); };
        img.src = imgs[0].thumb;
        thumb.appendChild(img);
      })
      .catch(function () {});
  }

  function init() {
    var cards = document.querySelectorAll('.frag-card');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { loadCard(e.target); io.unobserve(e.target); }
        });
      }, { rootMargin: '200px' });
      cards.forEach(function (c) { io.observe(c); });
    } else {
      cards.forEach(loadCard);
    }
    renderCmpBar();
  }

  // ═══ READING TIME ═══
  function addReadingTime() {
    var article = document.querySelector('article.article');
    if (!article) return;
    var meta = article.querySelector('.meta');
    if (!meta || meta.querySelector('.reading-time')) return;
    var text = article.textContent || '';
    var words = text.trim().split(/\s+/).length;
    var mins = Math.max(1, Math.round(words / 230));
    var span = document.createElement('span');
    span.className = 'reading-time';
    span.style.cssText = 'font-size:13px;color:var(--td)';
    span.textContent = mins + ' min read';
    meta.insertBefore(span, meta.firstChild);
  }

  // ═══ RELATED ARTICLES ═══
  function addRelatedArticles() {
    var article = document.querySelector('article.article');
    if (!article) return;
    var path = window.location.pathname;

    var articles = [
      {url:'/blog/best-mens-fragrances.html', title:'Best Men\'s Fragrances 2026', cat:'guide'},
      {url:'/blog/best-womens-fragrances.html', title:'Best Women\'s Fragrances 2026', cat:'guide'},
      {url:'/blog/baccarat-rouge-540-dupes.html', title:'Baccarat Rouge 540 Dupes', cat:'dupe'},
      {url:'/blog/dior-sauvage-dupes.html', title:'Dior Sauvage Dupes', cat:'dupe'},
      {url:'/blog/creed-aventus-dupes.html', title:'Creed Aventus Dupes', cat:'dupe'},
      {url:'/blog/tom-ford-lost-cherry-dupes.html', title:'Tom Ford Lost Cherry Dupes', cat:'dupe'},
      {url:'/blog/ysl-libre-dupes.html', title:'YSL Libre Dupes', cat:'dupe'},
      {url:'/blog/le-labo-santal-33-dupes.html', title:'Le Labo Santal 33 Dupes', cat:'dupe'},
      {url:'/blog/best-date-night-fragrances.html', title:'Best Date Night Fragrances', cat:'guide'},
      {url:'/blog/best-office-fragrances.html', title:'Best Office Fragrances', cat:'guide'},
      {url:'/blog/best-summer-fragrances.html', title:'Best Summer Fragrances', cat:'guide'},
      {url:'/blog/best-long-lasting-perfumes.html', title:'Best Long-Lasting Perfumes', cat:'guide'},
      {url:'/blog/best-perfumes-under-50.html', title:'Best Perfumes Under $50', cat:'guide'},
      {url:'/blog/best-niche-fragrances.html', title:'Best Niche Fragrances', cat:'guide'},
      {url:'/blog/smellmaxxing-guide-2026.html', title:'Smellmaxxing Guide 2026', cat:'guide'},
      {url:'/blog/fragrance-layering-guide.html', title:'Fragrance Layering Guide', cat:'guide'},
      {url:'/blog/how-to-make-perfume-last-longer.html', title:'How to Make Perfume Last Longer', cat:'guide'},
      {url:'/blog/celebrity-fragrances-guide.html', title:'Celebrity Fragrances Guide', cat:'guide'},
      {url:'/blog/best-budget-colognes-for-teens.html', title:'Best Budget Colognes for Teens', cat:'guide'},
      {url:'/blog/what-is-oud.html', title:'What Is Oud?', cat:'edu'},
      {url:'/blog/vanilla-in-perfumery.html', title:'Vanilla in Perfumery', cat:'edu'},
      {url:'/blog/trending-pistachio-fragrances.html', title:'Trending Pistachio Fragrances', cat:'trend'},
      {url:'/blog/trending-marshmallow-fragrances.html', title:'Trending Marshmallow Fragrances', cat:'trend'},
      {url:'/blog/fragrance-faq.html', title:'Fragrance FAQ', cat:'edu'},
      {url:'/blog/ai-perfume-recommendations.html', title:'AI Perfume Recommendations', cat:'guide'}
    ];

    // Find current article category
    var current = articles.find(function(a) { return path.indexOf(a.url) !== -1; });
    var currentCat = current ? current.cat : 'guide';

    // Pick 3 related: prefer same category, exclude current
    var sameCat = articles.filter(function(a) { return a.cat === currentCat && path.indexOf(a.url) === -1; });
    var diffCat = articles.filter(function(a) { return a.cat !== currentCat && path.indexOf(a.url) === -1; });

    // Shuffle
    function shuffle(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
    shuffle(sameCat);
    shuffle(diffCat);

    var picks = sameCat.slice(0, 2).concat(diffCat.slice(0, 1));
    if (picks.length < 3) picks = picks.concat(diffCat.slice(1, 4 - picks.length));
    if (picks.length === 0) return;

    var section = document.createElement('div');
    section.style.cssText = 'margin-top:48px;padding-top:32px;border-top:1px solid var(--d4)';
    section.innerHTML = '<h2 style="font-family:\'Playfair Display\',serif;font-size:22px;margin-bottom:20px;font-weight:600">Related Articles</h2>'
      + '<div style="display:grid;gap:12px">' + picks.map(function(a) {
        return '<a href="' + a.url + '" style="display:block;padding:16px 20px;background:var(--d2);border:1px solid var(--d4);border-radius:14px;color:var(--t);text-decoration:none;font-size:15px;font-weight:500;transition:all .2s" onmouseover="this.style.borderColor=\'rgba(201,169,110,.3)\';this.style.background=\'var(--d3)\'" onmouseout="this.style.borderColor=\'var(--d4)\';this.style.background=\'var(--d2)\'">' + a.title + ' &rarr;</a>';
      }).join('') + '</div>';

    // Insert before the last cta-box or at end of article
    var ctaBoxes = article.querySelectorAll('.cta-box');
    var lastCta = ctaBoxes.length > 0 ? ctaBoxes[ctaBoxes.length - 1] : null;
    if (lastCta) lastCta.parentNode.insertBefore(section, lastCta.nextSibling);
    else article.appendChild(section);
  }

  function initBlogFeatures() {
    addReadingTime();
    addRelatedArticles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); initBlogFeatures(); });
  } else {
    init();
    initBlogFeatures();
  }
})();
