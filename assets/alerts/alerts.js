/* Band alerts (owner 2026-11-18: "just dont want people spammed or too many popups, make everything sensible").
   A small link under the band link of a product page and under the title of a band page. Tapping it opens an email field in
   place. Nothing opens by itself: no popup, no overlay. The request goes to the order tracker web app (POST ?rr=ba,
   BandAlerts.js), which sends a confirmation email; alerts start only after the person confirms.
   Band list: bands.json, written by rockoff-upload/src/alerts/band_alerts.py --bands. No per-frame work, no scroll listener. */
(function () {
  'use strict';
  if (window.__rrBa) { return; }
  window.__rrBa = true;
  var body = document.body, path = location.pathname;
  if (!body || /^\/(?:checkout|cart|kosar)(?:\/|$)/i.test(path) || /route=checkout/i.test(location.search)) { return; }
  var isProduct = /\bproduct-page-body\b/.test(body.className), isBand = /^\/zenekarok\/[^\/]+\/?$/.test(path);
  if (!isProduct && !isBand) { return; }

  var BASE = window.RRBA_BASE || 'https://1374223-star.github.io/rockpince-menu-counts/assets/alerts/';
  var APP = 'https://script.google.com/macros/s/AKfycbyZxl9EjPVUhT8_JxnLLPP6aswr6g62pXVs3MqyfdTOLYV3kC3UxfUy84emPbJ8sp34tw/exec';
  var KEY = 'rr-ba-asked';
  var EMAIL = /^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
  var ERR = {
    email: 'Ez nem tűnik érvényes email címnek.',
    other: 'Most nem sikerült. Próbáld újra egy kicsit később.'
  };
  var BELL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/></svg>';

  function bandNorm(s) {   /* same as bandNorm in menu.js and norm() in bandpages/build.py */
    s = String(s).replace(/&/g, ' and ').replace(/’/g, "'");
    if (s.normalize) { s = s.normalize('NFKD'); }
    s = s.replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\x00-\x7f]/g, '');
    s = s.replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, '');
    return s.replace(/^the /, '').replace(/ /g, '');
  }
  function asked() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function remember(band) {
    try { var a = asked(); a[bandNorm(band)] = 1; localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* private mode */ }
  }
  function customerEmail() {
    var c = window.ShopRenter && window.ShopRenter.customer;
    return c && Number(c.userId) > 0 && c.email ? String(c.email) : '';
  }

  function css() {
    if (document.getElementById('rrba-css')) { return; }
    var s = document.createElement('style');
    s.id = 'rrba-css';
    s.textContent =
      '.rrba{display:block;margin:-6px 0 14px;max-width:440px;font-size:13px;line-height:1.45}' +
      '.rrba-band{margin:2px 0 16px}' +
      '.rrba .rrba-t{display:inline-flex;align-items:center;gap:7px;min-height:40px;margin:0;padding:4px 0;border:0;background:none;box-shadow:none;' +
      'color:#9cc7e3;font:inherit;font-weight:600;text-align:left;text-transform:none;letter-spacing:0;cursor:pointer}' +
      '.rrba .rrba-t:hover span,.rrba .rrba-t:focus-visible span{text-decoration:underline}' +
      '.rrba .rrba-t svg{flex:none}' +
      '.rrba-f{margin:2px 0 0;padding:12px;border:1px solid rgba(127,196,234,.3);border-radius:4px;background:rgba(6,36,59,.55)}' +
      '.rrba-f[hidden]{display:none}' +
      '.rrba .rrba-i{margin:0 0 10px;color:#c9d8e6}' +
      '.rrba-r{display:flex;gap:8px}' +
      '.rrba .rrba-e{flex:1 1 auto;width:auto;min-width:0;height:42px;margin:0;padding:0 11px;border:1px solid rgba(127,196,234,.45);border-radius:4px;' +
      'background:#04121f;box-shadow:none;color:#fff;font-size:16px;line-height:normal}' +
      '.rrba .rrba-e::placeholder{color:#7f93a6;opacity:1}' +
      '.rrba .rrba-e:focus{outline:none;border-color:#9cc7e3}' +
      '.rrba .rrba-b{flex:none;height:42px;margin:0;padding:0 18px;border:0;border-radius:4px;background:#e52421;color:#fff;font:inherit;font-weight:700;cursor:pointer}' +
      '.rrba .rrba-b[disabled]{opacity:.6;cursor:default}' +
      '.rrba .rrba-h{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
      '.rrba .rrba-m{margin:8px 0 0;color:#ffb4ae}' +
      '.rrba .rrba-m:empty{display:none}' +
      '.rrba .rrba-d{margin:0;color:#c9d8e6}' +
      '.rrba .rrba-d b{display:block;margin-bottom:3px;color:#fff}';
    (document.head || document.documentElement).appendChild(s);
  }

  function send(data, done) {
    var x = new XMLHttpRequest();
    x.open('POST', APP + '?rr=ba', true);
    x.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
    x.timeout = 45000;   /* the order tracker sheet can be slow to answer */
    x.onload = function () { var r = null; try { r = JSON.parse(x.responseText); } catch (e) { /* bad */ } done(r || {}); };
    x.onerror = x.ontimeout = function () { done({}); };
    x.send(JSON.stringify(data));
  }

  function make(band) {
    var box = document.createElement('div');
    box.className = 'rrba' + (isBand ? ' rrba-band' : '');
    box.innerHTML =
      '<button type="button" class="rrba-t" aria-expanded="false">' + BELL + '<span></span></button>' +
      '<form class="rrba-f" hidden novalidate>' +
      '<p class="rrba-i"></p>' +
      '<div class="rrba-r"><input class="rrba-e" type="email" name="email" autocomplete="email" inputmode="email" placeholder="Email címed" aria-label="Email címed">' +
      '<button type="submit" class="rrba-b">Kérem</button></div>' +
      '<input class="rrba-h" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="rrba-m" role="status"></p></form>';
    var t = box.querySelector('.rrba-t'), label = t.querySelector('span'), f = box.querySelector('.rrba-f');
    var input = box.querySelector('.rrba-e'), btn = box.querySelector('.rrba-b'), msg = box.querySelector('.rrba-m');
    function setLabel() {
      label.textContent = (asked()[bandNorm(band)] ? 'Értesítést kértél az új ' : 'Értesíts az új ') + band + ' termékekről';
    }
    setLabel();
    box.querySelector('.rrba-i').textContent = 'Emailt küldünk, ha új ' + band + ' termék érkezik: legfeljebb hetente egyet, és csak akkor, ha tényleg van újdonság. Bármikor leiratkozhatsz.';
    t.addEventListener('click', function () {
      var open = f.hidden;
      f.hidden = !open;
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        if (!input.value) { input.value = customerEmail(); }
        if (!input.value) { input.focus(); }
      }
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.trim().toLowerCase();
      if (!EMAIL.test(email)) { msg.textContent = ERR.email; input.focus(); return; }
      btn.disabled = true;
      msg.textContent = 'Küldés...';
      send({ a: 'join', email: email, band: band, hp: box.querySelector('.rrba-h').value }, function (r) {
        btn.disabled = false;
        if (r.ok) {
          remember(band);
          setLabel();
          f.innerHTML = '<p class="rrba-d"><b>Már csak egy lépés</b></p>';
          var p = f.querySelector('.rrba-d');
          p.appendChild(document.createTextNode('Ha ezt még nem kérted, pár percen belül kapsz egy megerősítő levelet. Csak a benne lévő gomb megnyomása után értesítünk. Ha nem találod, nézd meg a Spam mappát is.'));
          return;
        }
        msg.textContent = ERR[r.error] || ERR.other;
      });
    });
    return box;
  }

  function target() {
    if (isBand) { return document.querySelector('.rr-h1row') || document.querySelector('h1'); }
    return document.querySelector('.rr-band') || document.querySelector('.product-page-middle h1, .product-page-top__row h1');
  }
  function place(box) {
    var at = target();
    if (at && at.parentNode && box.previousElementSibling !== at) { at.parentNode.insertBefore(box, at.nextSibling); }
  }
  function bandOf(data) {
    if (isBand) { return data.n[data.p[path.replace(/\/$/, '').split('/').pop()]]; }
    var h = document.querySelector('.product-page-middle h1, .product-page-top__row h1');
    if (!h || h.textContent.indexOf(' - ') < 0) { return ''; }
    var k = bandNorm(h.textContent.split(' - ')[0].replace(/[™®]/g, ''));
    if (!k) { return ''; }
    var keys = {};
    data.n.forEach(function (n, i) { keys[bandNorm(n)] = i; });
    var i = keys[k] !== undefined ? keys[k] : data.a[k];
    return i === undefined ? '' : data.n[i];
  }
  function start(data) {
    window.__rrBaDone = true;  /* menu.js early header handover: the line is placed now, or never */
    var band = data && data.n && bandOf(data);
    if (!band || document.querySelector('.rrba') || !target()) { return; }
    css();
    var box = make(band);
    place(box);
    /* menu.js may add its own line under the title a moment later: keep ours below it. Two checks, no observer. */
    setTimeout(function () { place(box); }, 1500);
    setTimeout(function () { place(box); }, 4000);
  }

  var x = new XMLHttpRequest();
  x.open('GET', BASE + 'bands.json');
  x.onload = function () { var d = null; try { d = JSON.parse(x.responseText); } catch (e) { /* none */ } start(d); };
  x.onerror = function () { window.__rrBaDone = true; };
  x.send();
})();
