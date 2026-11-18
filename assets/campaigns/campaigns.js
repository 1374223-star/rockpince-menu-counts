/* RagnaRock on-site messages (owner 2026-11-18: "OptiMonk ... rebuild it"). The useful part of a popup tool, without a
   monthly fee or a third party script: a few rule-based messages, at most one per visit, each measured against a group of
   visitors who do not see it. No discounts here: the messages only remind people of what they already wanted.
   The newsletter pop-up in menu.js stays as it is and always goes first.
   Ideas taken from the big tools: an exit message built from what this visitor looked at (Dynamic Yield's affinity overlay),
   a small tab that brings back a closed sign-up offer (Klaviyo's teaser), and a control group to prove real lift.
   Preview on any page: add #rr-camp=cart_exit (or welcome_back, recent_back, browse_exit) to the address.
   Every message has a small, quiet "Ne mutass több ilyet" link (owner 2026-11-18): it ends these messages and the automatic
   newsletter pop-up for good in that browser.
   GA4 events: rr_camp_show, rr_camp_click, rr_camp_close, rr_camp_off, rr_camp_holdout, rr_camp_purchase (rr_camp, rr_group). */
(function () {
  'use strict';
  if (window.__rrCamp) { return; }
  window.__rrCamp = true;

  var FREE = 30000, KEY = 'rr-camp', DAY = 864e5, MIN = 6e4, SPEED = window.RRCAMP_SPEED || 1;
  var CART = '/index.php?route=checkout/cart', CHECKOUT = '/checkout';
  var CHEAP = [['Felvarrók', '/kiegeszitok_ekszerek-14025/felvarrok-14049'], ['Kitűzők', '/kiegeszitok_ekszerek-14025/jelveny_kituzo_bross-14547'],
    ['Kulcstartók', '/kiegeszitok_ekszerek-14025/kulcstarto_passztarto_lakat-14355'], ['Zoknik', '/kiegeszitok_ekszerek-14025/zokni-14085']];
  var CAMPS = {   /* wait: rest days after it was shown; holdout: share of visitors who never see it (the comparison group) */
    cart_exit: { wait: 3, holdout: 0.2 },
    welcome_back: { wait: 2, holdout: 0.2 },
    recent_back: { wait: 7, holdout: 0.2 },
    browse_exit: { wait: 7, holdout: 0.2 }
  };

  var path = location.pathname + location.search;
  var isCheckout = /^\/checkout/.test(location.pathname) || /route=checkout\/(checkout|success)/.test(location.search);
  var isCart = /route=checkout\/cart/.test(location.search) || /^\/(cart|kosar)\b/.test(location.pathname) || !!(document.body && /\bsr-cart-page-body\b/.test(document.body.className));
  var isProduct = !!(document.body && /product-page-body/.test(document.body.className));
  var touch = !!(window.matchMedia && matchMedia('(hover: none)').matches);
  var S = load(), shownNow = false, box = null;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
  function sess(k, v) { try { if (v !== undefined) { sessionStorage.setItem(KEY + k, v); } return sessionStorage.getItem(KEY + k); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ft(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft'; }
  function send(ev, camp, group) {
    var p = { rr_camp: camp, rr_group: group };
    try { if (window.gtag) { window.gtag('event', ev, p); } else { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: ev }, p)); } } catch (e) { /* */ }
  }

  /* ---------- visit and purchase bookkeeping ---------- */
  var now = Date.now(), returning = sess('-back') === '1';
  if (sess('-seen') !== '1') {
    returning = !!(S.last && now - S.last > 30 * MIN);
    sess('-seen', '1'); sess('-back', returning ? '1' : '0');
  }
  S.last = now; S.c = S.c || {}; S.g = S.g || {}; S.x = S.x || []; S.v = S.v || [];
  function purchase() {
    if (!/success/i.test(location.pathname + location.search + location.hash)) { return; }
    S.x.filter(function (x) { return Date.now() - x[2] < 7 * DAY; }).forEach(function (x) { send('rr_camp_purchase', x[0], x[1]); });
    S.x = []; save();
    try {   /* basket recommendations (assets/basket/basket.js) are measured the same way */
      var b = JSON.parse(localStorage.getItem('rr-bsk') || '{}');
      if (b.t && Date.now() - b.t < 7 * DAY) { send('rr_camp_purchase', 'basket_recs', b.g); b.t = 0; localStorage.setItem('rr-bsk', JSON.stringify(b)); }
    } catch (e) { /* */ }
  }
  purchase();
  addEventListener('hashchange', purchase);
  if (isProduct) { remember(); }
  save();
  if (isCheckout || /route=account|success/i.test(path)) { return; }

  function remember() {
    var h = document.querySelector('h1'), c = document.querySelector('link[rel=canonical]'), i = document.querySelector('meta[property="og:image"]');
    if (!h || !c || !i) { return; }
    var u = c.getAttribute('href').replace(/^https?:\/\/[^/]+/, '');
    var name = h.textContent.trim(), parts = name.split(/\s+[-\u2013\u2014]\s+/);
    S.v = [{ u: u, n: name.slice(0, 90), i: i.getAttribute('content'), b: parts.length > 1 ? parts[0].slice(0, 40) : '' }].concat(S.v.filter(function (x) { return x.u !== u; })).slice(0, 6);
  }

  /* ---------- the basket ---------- */
  function count() {
    if (window.RRCAMP_DEMO) { return window.RRCAMP_DEMO.length; }
    var q = document.querySelector('#js-cart .header-quantity-box, .rr-bn-count');
    return q ? parseInt(q.textContent, 10) || 0 : 0;
  }
  function items(done) {
    if (window.RRCAMP_DEMO) { done(window.RRCAMP_DEMO); return; }
    fetch(CART, { credentials: 'include' }).then(function (r) { return r.text(); }).then(function (h) {
      var m = h.match(/initialState\s*=\s*(\{"presentsData.*\});[ \t]*$/m), list = [];
      if (m) { list = (JSON.parse(m[1]).items || []).filter(function (i) { return i.cartItemType !== 'Present'; }); }
      done(list);
    }).catch(function () { done([]); });
  }

  /* ---------- may a message appear now? ---------- */
  function blocked() {
    if (shownNow || sess('-done') === '1') { return true; }
    if (Object.keys(S.c).some(function (k) { return Date.now() - S.c[k] < DAY; })) { return true; }
    var over = document.querySelectorAll('.rr-nl-bg, .fancybox-container, .modal.show, .nanobar-cookie-box');
    for (var i = 0; i < over.length; i++) { if (over[i].getClientRects().length && getComputedStyle(over[i]).visibility !== 'hidden') { return true; } }
    try { var n = JSON.parse(localStorage.getItem('rr-nl-pop') || '{}'); if (n.shown && Date.now() - n.shown < 10 * MIN) { return true; } } catch (e) { /* */ }
    return !!(document.documentElement.classList.contains('rrsx-sheet'));
  }
  function group(id) {
    if (!S.g[id]) { S.g[id] = Math.random() < CAMPS[id].holdout ? 'holdout' : 'show'; }
    return S.g[id];
  }
  function ready(id) { return !S.c[id] || Date.now() - S.c[id] > CAMPS[id].wait * DAY; }
  function fire(id, force) {
    if (!force && (!ready(id) || blocked())) { return; }
    var g = force ? 'show' : group(id);
    BUILD[id](function (html) {
      if (!html || (!force && blocked())) { return; }
      if (!force) { S.c[id] = Date.now(); S.x = S.x.concat([[id, g, Date.now()]]).slice(-6); sess('-done', '1'); save(); }
      if (g === 'holdout') { shownNow = true; send('rr_camp_holdout', id, g); return; }
      show(id, g, html);
    });
  }

  /* ---------- what each message says ---------- */
  function rows(list) {
    return '<div class="rrc-list">' + list.slice(0, 3).map(function (i) {
      return '<a class="rrc-it" href="' + esc(i.href || i.u) + '"><img src="' + esc(i.imageUrl || i.i) + '" alt="" width="48" height="48"><span>' + esc((i.name || i.n || '').trim()) + '</span>' +
        (i.totalNumber ? '<b>' + ft(i.totalNumber) + '</b>' : '') + '</a>';
    }).join('') + '</div>';
  }
  function sum(list) { return list.reduce(function (a, i) { return a + (i.totalNumber || 0); }, 0); }
  function bar(total) {
    var left = FREE - total;
    return '<div class="rrc-free">' + (left > 0 ? 'Még <b>' + ft(left) + '</b> és ingyenes a szállítás' : '<b>Ingyenes a szállítás</b> erre a rendelésre') +
      '</div><div class="rrc-bar"><i style="width:' + Math.min(100, Math.max(4, total / FREE * 100)) + '%"' + (left > 0 ? '' : ' class="ok"') + '></i></div>';
  }
  function viewed() { var here = location.pathname; return S.v.filter(function (x) { return x.u !== here; }); }
  function favourite(list) {   /* the band or brand this visitor looked at most */
    var n = {}, best = '', top = 0;
    list.forEach(function (x) { if (x.b) { var k = x.b.toLowerCase(); n[k] = (n[k] || 0) + 1; if (n[k] > top) { top = n[k]; best = x.b; } } });
    return best;
  }
  function more(list) {
    var b = favourite(list);
    return b ? '<a class="rrc-go" href="/index.php?route=product/list&amp;keyword=' + encodeURIComponent(b.toLowerCase()) + '">Még több: ' + esc(b) + '</a>' : '';
  }
  var BUILD = {
    cart_exit: function (done) {
      items(function (list) {
        if (!list.length) { done(''); return; }
        var t = sum(list), left = FREE - t;
        var extra = isCart && left > 0 ? '<div class="rrc-sub">Ötletek a hiányzó összegre:</div><div class="rrc-chips">' + CHEAP.map(function (c) { return '<a href="' + c[1] + '">' + c[0] + '</a>'; }).join('') + '</div>' : '';
        done('<h3>' + (isCart ? (left <= 0 ? 'Minden készen áll' : left <= 8000 ? 'Már csak egy kicsi hiányzik' : 'Kérsz ingyenes szállítást?') : 'Nem felejtettél el valamit?') + '</h3>' +
          (isCart ? '' : '<p>Ezek még a kosaradban vannak:</p>' + rows(list)) + bar(t) + extra +
          '<a class="rrc-go" href="' + (isCart ? CHECKOUT : CART) + '">' + (isCart ? 'Tovább a pénztárhoz' : 'Tovább a kosárhoz') + '</a>');
      });
    },
    welcome_back: function (done) {
      items(function (list) {
        if (!list.length) { done(''); return; }
        done('<h3>Örülünk, hogy visszatértél!</h3><p>A kosaradban még ott ' + (list.length > 1 ? 'vár ' + list.length + ' termék:' : 'vár ez a termék:') + '</p>' + rows(list) + bar(sum(list)) + '<a class="rrc-go" href="' + CART + '">Megnézem a kosaramat</a>');
      });
    },
    recent_back: function (done) {
      var list = viewed();
      done(list.length >= 2 ? '<h3>Folytasd, ahol abbahagytad</h3><p>Ezeket nézted legutóbb:</p>' + rows(list) + more(list) : '');
    },
    browse_exit: function (done) {
      var list = viewed();
      done(list.length >= 2 ? '<h3>Még nem találtad meg?</h3><p>Ezek tetszettek legutóbb:</p>' + rows(list) + more(list) : '');
    }
  };

  /* ---------- on the page ---------- */
  var CSS = '.rrc-bg{position:fixed;inset:0;z-index:99990;background:rgba(2,8,16,.62)}' +
    '.rrc{position:fixed;z-index:99991;box-sizing:border-box;width:400px;max-width:calc(100vw - 20px);padding:20px;background:#06243b;border:1px solid rgba(127,196,234,.55);border-radius:10px;box-shadow:0 14px 38px rgba(0,0,0,.55);color:#c9d8e6;font:14px/1.45 Poppins,Arial,sans-serif;opacity:0;transition:opacity .16s,transform .16s}' +
    'html.rrc-open .rr-toast{display:none!important}.rrc *{box-sizing:border-box}.rrc.mid{left:50%;top:50%;transform:translate(-50%,-46%)}.rrc.mid.on{transform:translate(-50%,-50%)}.rrc.side{right:18px;bottom:18px;transform:translateY(10px)}.rrc.side.on{transform:none}.rrc.on{opacity:1}' +
    '.rrc h3{margin:0 26px 6px 0;color:#fff;font-size:19px;line-height:1.25;font-weight:800}.rrc p{margin:0 0 10px}' +
    '.rrc-x{position:absolute;right:6px;top:4px;width:36px;height:36px;padding:0;background:none;border:0;color:#9fb3c6;font-size:25px;line-height:1;cursor:pointer}' +
    '.rrc-list{margin-bottom:12px}.rrc-it{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid rgba(127,196,234,.14);color:#e6f3fb!important;text-decoration:none!important}' +
    '.rrc-it img{flex:none;width:48px;height:48px;object-fit:contain;background:#fff;border-radius:4px}.rrc-it span{flex:1;min-width:0;font-size:12.5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.rrc-it b{flex:none;color:#fff;font-size:13px}' +
    '.rrc-free{font-size:13px;margin-bottom:5px}.rrc-free b{color:#fff}.rrc-bar{height:5px;margin-bottom:13px;border-radius:3px;background:rgba(127,196,234,.16);overflow:hidden}.rrc-bar i{display:block;height:100%;background:#e52421}.rrc-bar i.ok{background:#1f9d4a}' +
    '.rrc-sub{margin-bottom:6px;font-size:12.5px}.rrc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:13px}.rrc-chips a{padding:6px 11px;border:1px solid rgba(127,196,234,.45);border-radius:15px;color:#e6f3fb!important;font-size:12.5px;text-decoration:none!important}' +
    '.rrc-off{display:block;margin:9px auto -8px;padding:4px 8px;background:none;border:0;color:#6f8aa0;font:11px/1.3 Poppins,Arial,sans-serif;cursor:pointer}.rrc-off:hover{color:#9fb3c6;text-decoration:underline}' +
    '.rrc-go{display:block;padding:12px;border-radius:6px;background:#e52421;color:#fff!important;font-weight:800;text-align:center;text-decoration:none!important}.rrc-go:hover{background:#ff3a36}' +
    '.rrc-tab{position:fixed;left:0;top:56%;z-index:9990;display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 6px 7px;background:#e52421;border:0;border-radius:0 8px 8px 0;color:#fff;font:800 14px/1 Poppins,Arial,sans-serif;cursor:pointer;box-shadow:2px 3px 12px rgba(0,0,0,.4)}' +
    '.rrc-tab small{font-size:9px;font-weight:600}.rrc-tab i{position:absolute;right:-9px;top:-9px;width:20px;height:20px;border-radius:50%;background:#06243b;border:1px solid rgba(127,196,234,.6);color:#fff;font:400 14px/17px Arial,sans-serif;text-align:center}' +
    '@media (max-width:700px){.rrc,.rrc.mid,.rrc.side{left:10px;right:10px;top:auto;bottom:72px;width:auto;max-width:none;max-height:calc(100vh - 150px);overflow:auto;padding:15px;transform:translateY(10px)}.rrc.on,.rrc.mid.on,.rrc.side.on{transform:none}.rrc-bg{display:none}.rrc h3{font-size:17px}.rrc-list .rrc-it:nth-child(n+3){display:none}html.rrc-open #fb_header_box,html.rrc-open #fb_content_box{display:none!important}' +
    '.rrc-tab{flex-direction:row;gap:4px;padding:9px 3px;font-size:12px;writing-mode:vertical-rl;transform:rotate(180deg);border-radius:8px 0 0 8px}.rrc-tab small{font-size:10px}.rrc-tab i{right:auto;top:auto;left:-10px;bottom:-10px;width:22px;height:22px;line-height:19px;writing-mode:horizontal-tb}}';
  function close(id, g, why) {
    if (!box) { return; }
    if (why) { send('rr_camp_close', id, g); }
    box.remove(); var b = document.querySelector('.rrc-bg'); if (b) { b.remove(); }
    document.documentElement.classList.remove('rrc-open');
    box = null; document.removeEventListener('keydown', onKey);
  }
  var onKey = function () {};
  function css() { if (!document.getElementById('rrc-css')) { var st = document.createElement('style'); st.id = 'rrc-css'; st.textContent = CSS; document.head.appendChild(st); } }
  /* a closed newsletter offer stays one tap away (the pop-up itself lives in menu.js) */
  function teaser(force) {
    var n = {};
    try { n = JSON.parse(localStorage.getItem('rr-nl-pop') || '{}') || {}; } catch (e) { /* */ }
    if (!force && (isCart || n.done || !n.shown || Date.now() - n.shown > 30 * DAY || !window.__rrNlOpen)) { return; }
    if (!force && S.t && Date.now() - S.t < 14 * DAY) { return; }
    if (document.querySelector('.rr-nl-bg')) { return; }
    var id = 'nl_teaser', g = force ? 'show' : (S.g[id] || (S.g[id] = Math.random() < 0.2 ? 'holdout' : 'show'));
    save();
    var first = sess('-tease') !== '1'; sess('-tease', '1');
    if (g === 'holdout') { if (first) { send('rr_camp_holdout', id, g); } return; }
    css();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'rrc-tab'; b.setAttribute('aria-label', '10% kupon a hírlevélre feliratkozóknak');
    b.innerHTML = '-10%<small>kupon</small><i aria-label="Bezárás">&times;</i>';
    var used = false;
    b.addEventListener('click', function (e) {
      if (used) { return; }
      used = true; b.remove();
      if (e.target.tagName === 'I') { S.t = Date.now(); save(); send('rr_camp_close', id, g); return; }
      send('rr_camp_click', id, g); if (window.__rrNlOpen) { window.__rrNlOpen(); }
    });
    document.body.appendChild(b);
    if (first) { send('rr_camp_show', id, g); }
  }
  function switchOff(id, g) {
    S.off = Date.now(); save();
    window.__rrNlOff = true;
    try { var n = JSON.parse(localStorage.getItem('rr-nl-pop') || '{}') || {}; n.done = 1; localStorage.setItem('rr-nl-pop', JSON.stringify(n)); } catch (e) { /* */ }
    send('rr_camp_off', id, g);
    var tab = document.querySelector('.rrc-tab'); if (tab) { tab.remove(); }
    close(id, g);
  }
  function show(id, g, html) {
    shownNow = true;
    css();
    var mid = id === 'cart_exit' || id === 'browse_exit';
    if (mid) { var bg = document.createElement('div'); bg.className = 'rrc-bg'; bg.addEventListener('click', function () { close(id, g, 1); }); document.body.appendChild(bg); }
    box = document.createElement('div'); box.className = 'rrc ' + (mid ? 'mid' : 'side'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Üzenet');
    box.innerHTML = '<button type="button" class="rrc-x" aria-label="Bezárás">&times;</button>' + html + '<button type="button" class="rrc-off">Ne mutass több ilyet</button>';
    box.addEventListener('click', function (e) {
      if (e.target.closest('.rrc-x')) { close(id, g, 1); return; }
      if (e.target.closest('.rrc-off')) { switchOff(id, g); return; }
      if (e.target.closest('a')) { send('rr_camp_click', id, g); }
    });
    onKey = function (e) { if (e.key === 'Escape') { close(id, g, 1); } };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(box);
    document.documentElement.classList.add('rrc-open');
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (box) { box.classList.add('on'); } }); });
    send('rr_camp_show', id, g);
  }

  /* ---------- when ---------- */
  function start() {
    var m = /rr-camp=(\w+)/.exec(location.hash);
    if (m && m[1] === 'nl_teaser') { teaser(true); return; }
    if (m && BUILD[m[1]]) { setTimeout(function () { fire(m[1], true); }, 300); return; }
    if (S.off || (!window.RRCAMP_LIVE && !window.RRCAMP_SPEED)) { return; }   /* RRCAMP_LIVE is set by the loader in menu.js */
    var has = count() > 0, leaving = has ? 'cart_exit' : 'browse_exit';
    setTimeout(teaser, 3000 * SPEED);
    if (touch) {   /* phones have no "mouse leaves": coming back to the tab, or a long pause on the basket */
      var away = 0;
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { away = Date.now(); } else if (away && Date.now() - away > 15000 * SPEED) { fire(leaving); }
      });
      if (has && isCart) { setTimeout(function () { fire('cart_exit'); }, 45000 * SPEED); }
    } else {
      var armed = Date.now() + 8000 * SPEED;
      document.addEventListener('mouseout', function (e) {
        if (e.relatedTarget || e.clientY > 8 || Date.now() < armed) { return; }
        setTimeout(function () { fire(leaving); }, 80);   /* lets the newsletter pop-up go first */
      });
    }
    if (returning && !isCart) {
      setTimeout(function () { if (has) { fire('welcome_back'); } else if (!isProduct) { fire('recent_back'); } }, (has ? 6000 : 9000) * SPEED);
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 400 * SPEED); }); } else { setTimeout(start, 400 * SPEED); }
})();
