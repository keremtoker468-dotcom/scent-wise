(function () {
  var style = document.createElement('style');
  style.textContent = [
    '.frag-thumb{width:52px;height:52px;border-radius:10px;flex-shrink:0;overflow:hidden;',
    'position:relative;display:flex;align-items:center;justify-content:center;background:#1e2a1a}',
    '.frag-thumb img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .3s;position:absolute;inset:0}',
    '.frag-thumb img.ft-loaded{opacity:1}',
    '.ft-letter{font-weight:700;font-size:18px;color:rgba(255,255,255,.65);',
    "font-family:'DM Sans',sans-serif;line-height:1;pointer-events:none}"
  ].join('');
  document.head.appendChild(style);

  var PALETTE = ['#1e2d40','#2d1e40','#1e402d','#402d1e','#401e2d','#2d401e','#1e3840','#38201e'];
  function bgColor(s) { return PALETTE[s.charCodeAt(0) % PALETTE.length]; }

  function cleanBrand(s) { return s.replace(/[\u2014\-].*$/, '').replace(/~?\$[\d.]+.*$/, '').trim(); }

  var _amzGeo = (function() {
    var lang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (lang.indexOf('de') === 0) return { domain: 'amazon.de', tag: 'scentwisede20-21' };
    if (lang.indexOf('fr') === 0) return { domain: 'amazon.fr', tag: 'scentwisede0e-21' };
    if (lang.indexOf('es') === 0) return { domain: 'amazon.es', tag: 'scentwised09f-21' };
    if (lang.indexOf('it') === 0) return { domain: 'amazon.it', tag: 'scentwisede09-21' };
    if (lang === 'nl-be' || lang === 'fr-be') return { domain: 'amazon.com.be', tag: 'scentwisebe-21' };
    if (lang.indexOf('nl') === 0) return { domain: 'amazon.com.be', tag: 'scentwisebe-21' };
    if (lang === 'en-gb') return { domain: 'amazon.co.uk', tag: 'scentwiseuk-21' };
    return { domain: 'amazon.com', tag: 'scentwise20-20' };
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
    a.className = 'amz-btn';
    a.textContent = 'Shop on Amazon';
    a.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:4px 12px;border-radius:8px;font-size:11px;font-weight:600;color:#f90;background:rgba(255,153,0,.08);border:1px solid rgba(255,153,0,.15);text-decoration:none;transition:background .2s';
    a.onmouseover = function() { a.style.background = 'rgba(255,153,0,.15)'; };
    a.onmouseout = function() { a.style.background = 'rgba(255,153,0,.08)'; };
    var info = card.querySelector('.frag-info');
    if (info) info.appendChild(a);
  }

  function loadCard(card) {
    var nameEl = card.querySelector('.frag-name');
    if (!nameEl) return;
    var name = nameEl.textContent.trim();
    var brandEl = card.querySelector('.frag-brand');
    var brand = brandEl ? cleanBrand(brandEl.textContent) : '';

    addAmazonBtn(card, name, brand);

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
