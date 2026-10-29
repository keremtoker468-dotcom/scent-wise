/* Consent for the static pages (blog, legal pages, author, collections…).
   Must load synchronously in <head>, BEFORE gtag.js and adsbygoogle.js, so that
   Google tags start in "denied" (Consent Mode v2) and AdSense requests
   non-personalised ads until the visitor accepts. Shares the
   `sw_cookie_consent` localStorage choice with the app's own banner in
   index.html, so a choice made in one place applies everywhere.
   KVKK m.5 / GDPR Art. 6-7 + ePrivacy: analytics and advertising cookies need
   prior, opt-in consent. */
(function () {
  var KEY = 'sw_cookie_consent';
  function read() { try { var v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* private mode */ } }

  var c = read();
  var analytics = !!(c && c.analytics), ads = !!(c && c.ads);

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: ads ? 'granted' : 'denied',
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_user_data: ads ? 'granted' : 'denied',
    ad_personalization: ads ? 'granted' : 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
  window.gtag('set', 'ads_data_redaction', true);
  // AdSense: no personalised ads without consent.
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.requestNonPersonalizedAds = ads ? 0 : 1;

  function apply(a, d) {
    save({ essential: true, analytics: a, ads: d, ts: Date.now() });
    window.gtag('consent', 'update', {
      ad_storage: d ? 'granted' : 'denied',
      analytics_storage: a ? 'granted' : 'denied',
      ad_user_data: d ? 'granted' : 'denied',
      ad_personalization: d ? 'granted' : 'denied'
    });
    window.adsbygoogle.requestNonPersonalizedAds = d ? 0 : 1;
    var b = document.getElementById('sw-consent');
    if (b) b.parentNode.removeChild(b);
  }
  // Lets a "Cookie settings" link reopen the banner.
  window.swOpenConsent = function () { show(true); };

  function show(force) {
    if (document.getElementById('sw-consent')) return;
    // index.html renders its own banner (#cookie-banner).
    if (!force && document.getElementById('cookie-banner')) return;
    var tr = /^tr\b/i.test(navigator.language || '');
    var t = tr ? {
      msg: 'Siteyi çalıştırmak için zorunlu çerezler kullanıyoruz. İzninizle, ziyaret istatistikleri (Google Analytics) ve kişiselleştirilmiş reklamlar (Google AdSense) için de çerez kullanırız. Reddederseniz bu çerezler yüklenmez.',
      more: 'Çerez ve gizlilik politikası', kvkk: 'KVKK Aydınlatma Metni',
      all: 'Tümünü kabul et', min: 'Yalnızca zorunlu', stats: 'Yalnızca istatistik'
    } : {
      msg: 'We use essential cookies to run the site. With your permission we also use cookies for visit statistics (Google Analytics) and personalised ads (Google AdSense). If you decline, those cookies are not set.',
      more: 'Cookie & privacy policy', kvkk: 'KVKK notice (TR)',
      all: 'Accept all', min: 'Essential only', stats: 'Statistics only'
    };
    var el = document.createElement('div');
    el.id = 'sw-consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', tr ? 'Çerez tercihleri' : 'Cookie preferences');
    el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:640px;margin:0 auto;background:#16151c;color:#eceaf2;border:1px solid #2c2a36;border-radius:12px;padding:16px;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35)';
    var btn = 'cursor:pointer;border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;border:1px solid #4a4658;';
    el.innerHTML = '<p style="margin:0 0 10px">' + t.msg + ' <a href="/privacy.html" style="color:#d9b877">' + t.more + '</a> · <a href="/kvkk.html" style="color:#d9b877">' + t.kvkk + '</a></p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" data-c="all" style="' + btn + 'background:#d9b877;color:#16151c;border-color:#d9b877">' + t.all + '</button>' +
      '<button type="button" data-c="stats" style="' + btn + 'background:transparent;color:#eceaf2">' + t.stats + '</button>' +
      '<button type="button" data-c="min" style="' + btn + 'background:transparent;color:#eceaf2">' + t.min + '</button></div>';
    el.addEventListener('click', function (e) {
      var k = e.target && e.target.getAttribute && e.target.getAttribute('data-c');
      if (k === 'all') apply(true, true);
      else if (k === 'stats') apply(true, false);
      else if (k === 'min') apply(false, false);
    });
    document.body.appendChild(el);
  }

  if (!c) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { show(false); });
    else show(false);
  }
})();
