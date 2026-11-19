/* Search alerts (owner idea 2026-11-17, built 2026-11-19). When a search finds nothing, a small box under the
   "nincs találat" message offers an email when something matching arrives. Loaded by search.js, only on such pages.
   Nothing opens by itself: the box sits in the page, no popup. The request goes to the order tracker web app
   (POST ?rr=sa, SearchAlerts.js), which sends a confirmation email; alerts start only after the person confirms.
   window.RRSA.mount(host, term) fills host with the box. */
(function () {
  'use strict';
  if (window.RRSA) { return; }
  var APP = 'https://script.google.com/macros/s/AKfycbyZxl9EjPVUhT8_JxnLLPP6aswr6g62pXVs3MqyfdTOLYV3kC3UxfUy84emPbJ8sp34tw/exec';
  var KEY = 'rr-sa-asked';
  var EMAIL = /^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
  var ERR = {
    email: 'Ez nem tűnik érvényes email címnek.',
    term: 'Erre a keresésre nem tudunk értesítőt küldeni. Próbáld rövidebben, csak betűkkel.',
    other: 'Most nem sikerült. Próbáld újra egy kicsit később.'
  };
  var BELL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/></svg>';

  /* same rule as rrSaTerm_ in SearchAlerts.js: what the web app would refuse is not offered */
  function clean(s) {
    var t = String(s || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    if (t.normalize) { t = t.normalize('NFC'); }
    if (t.length < 2 || t.length > 40 || t.split(' ').length > 6) { return ''; }
    if (!/^[0-9A-Za-zÀ-ÖØ-öø-ſ '&.\-\/+]+$/.test(t)) { return ''; }
    if (/https?|www|@|\.[a-z]{2,}\b|\/\//i.test(t)) { return ''; }
    return t.replace(/[^0-9A-Za-zÀ-ÖØ-öø-ſ]/g, '').length >= 2 ? t : '';
  }
  function key(t) { t = t.toLowerCase(); if (t.normalize) { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } return t.replace(/[^a-z0-9]+/g, ' ').replace(/^ | $/g, ''); }
  function asked() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function remember(t) { try { var a = asked(); a[key(t)] = 1; localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* private mode */ } }
  function customerEmail() {
    var c = window.ShopRenter && window.ShopRenter.customer;
    return c && Number(c.userId) > 0 && c.email ? String(c.email) : '';
  }
  function ga(name) { try { if (window.gtag) { window.gtag('event', name, { rr_camp: 'search_alert' }); } } catch (e) { /* no analytics */ } }

  function css() {
    if (document.getElementById('rrsa-css')) { return; }
    var s = document.createElement('style');
    s.id = 'rrsa-css';
    s.textContent =
      '.rrsa{box-sizing:border-box;max-width:520px;margin:18px auto 4px;padding:16px 16px 14px;border:1px solid rgba(127,196,234,.35);border-radius:8px;' +
      'background:rgba(6,36,59,.7);color:#c9d8e6;font-size:14px;line-height:1.5;text-align:left}' +
      '.rrsa *{box-sizing:border-box}' +
      '.rrsa .rrsa-h{display:flex;align-items:center;gap:8px;margin:0 0 6px;color:#fff;font-size:16px;font-weight:700;line-height:1.3;text-transform:none;letter-spacing:0}' +
      '.rrsa .rrsa-h svg{flex:none;color:#9cc7e3}' +
      '.rrsa .rrsa-i{margin:0 0 12px;color:#c9d8e6}' +
      '.rrsa .rrsa-i b{color:#fff}' +
      '.rrsa-r{display:flex;gap:8px}' +
      '.rrsa .rrsa-e{flex:1 1 auto;width:auto;min-width:0;height:44px;margin:0;padding:0 12px;border:1px solid rgba(127,196,234,.45);border-radius:4px;' +
      'background:#04121f;box-shadow:none;color:#fff;font-size:16px;line-height:normal}' +
      '.rrsa .rrsa-e::placeholder{color:#7f93a6;opacity:1}' +
      '.rrsa .rrsa-e:focus{outline:none;border-color:#9cc7e3}' +
      '.rrsa .rrsa-b{flex:none;height:44px;margin:0;padding:0 20px;border:0;border-radius:4px;background:#e52421;color:#fff;font:inherit;font-weight:700;cursor:pointer;text-transform:none;letter-spacing:0}' +
      '.rrsa .rrsa-b[disabled]{opacity:.6;cursor:default}' +
      '.rrsa .rrsa-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
      '.rrsa .rrsa-m{margin:8px 0 0;color:#ffb4ae}' +
      '.rrsa .rrsa-m:empty{display:none}' +
      '.rrsa .rrsa-f{margin:8px 0 0;font-size:12px;color:#7f93a6}' +
      '@media (max-width:420px){.rrsa-r{flex-direction:column}.rrsa .rrsa-b{width:100%}}';
    (document.head || document.documentElement).appendChild(s);
  }

  function send(data, done) {
    var x = new XMLHttpRequest();
    x.open('POST', APP + '?rr=sa', true);
    x.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
    x.timeout = 45000;   /* the order tracker can be slow to answer */
    x.onload = function () { var r = null; try { r = JSON.parse(x.responseText); } catch (e) { /* bad */ } done(r || {}); };
    x.onerror = x.ontimeout = function () { done({}); };
    x.send(JSON.stringify(data));
  }

  function mount(host, raw) {
    var term = clean(raw);
    if (!host || !term) { return false; }
    css();
    var box = document.createElement('div');
    box.className = 'rrsa';
    if (asked()[key(term)]) {
      box.innerHTML = '<p class="rrsa-h">' + BELL + '<span></span></p><p class="rrsa-i"></p>';
      box.querySelector('.rrsa-h span').textContent = 'Már figyeljük neked';
      box.querySelector('.rrsa-i').textContent = 'Erre már kértél értesítőt: szólunk emailben, ha érkezik ilyen termék.';
      host.innerHTML = ''; host.appendChild(box);
      return true;
    }
    box.innerHTML =
      '<p class="rrsa-h">' + BELL + '<span>Szóljunk, ha megérkezik?</span></p>' +
      '<p class="rrsa-i">Ha lesz találat erre: <b></b>, küldünk egy emailt. Legfeljebb hetente egyet, és csak ha tényleg van új termék.</p>' +
      '<form novalidate><div class="rrsa-r"><input class="rrsa-e" type="email" name="email" autocomplete="email" inputmode="email" placeholder="Email címed" aria-label="Email címed">' +
      '<button type="submit" class="rrsa-b">Kérem</button></div>' +
      '<input class="rrsa-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="rrsa-m" role="status"></p><p class="rrsa-f">Megerősítő levelet küldünk. Bármikor leiratkozhatsz.</p></form>';
    box.querySelector('.rrsa-i b').textContent = '„' + term + '”';
    var f = box.querySelector('form'), input = box.querySelector('.rrsa-e'), btn = box.querySelector('.rrsa-b'), msg = box.querySelector('.rrsa-m');
    input.value = customerEmail();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.replace(/^\s+|\s+$/g, '').toLowerCase();
      if (!EMAIL.test(email)) { msg.textContent = ERR.email; input.focus(); return; }
      btn.disabled = true;
      msg.textContent = 'Küldés...';
      send({ a: 'join', email: email, term: term, hp: box.querySelector('.rrsa-hp').value }, function (r) {
        btn.disabled = false;
        if (r.ok) {
          remember(term);
          ga('rr_search_alert');
          box.innerHTML = '<p class="rrsa-h">' + BELL + '<span>Már csak egy lépés</span></p><p class="rrsa-i"></p>';
          box.querySelector('.rrsa-i').textContent = 'Ha ezt még nem kérted, pár percen belül kapsz egy megerősítő levelet. Csak a benne lévő gomb megnyomása után értesítünk. Ha nem találod, nézd meg a Spam mappát is.';
          return;
        }
        msg.textContent = ERR[r.error] || ERR.other;
      });
    });
    host.innerHTML = '';
    host.appendChild(box);
    return true;
  }

  /* The shop's own empty search page (our filter did not take over): the box goes under its message. */
  function shop(term) {
    if (document.querySelector('.rrsa')) { return false; }
    if (document.querySelector('.product-snapshot, .product-card')) { return false; }
    var cands = document.querySelectorAll('#content .alert, #content p, #content div, .main-content div, .content div'), at = null, i;
    for (i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (!el.children.length || el.children.length < 3) {
        if (/^\s*Nincs megjeleníthető termék\.?\s*$/i.test(el.textContent || '')) { at = el; break; }
      }
    }
    if (!at || !at.parentNode) { return false; }
    var host = document.createElement('div');
    at.parentNode.insertBefore(host, at.nextSibling);
    return mount(host, term);
  }

  window.RRSA = { mount: mount, shop: shop, clean: clean };
})();
