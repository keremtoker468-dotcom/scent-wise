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
    if (lang.indexOf('it') === 0) return { domain: 'amazon.it', tag: 'scentwisede01-21' };
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
