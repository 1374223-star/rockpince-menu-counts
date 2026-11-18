/* Basket recommendations (owner 2026-11-18). On the basket page this replaces the theme's random "Különleges ajánlataink"
   products with ones that fit the basket: what people really bought together with these items, small things from the same
   band, and items that reach free shipping. Data: recs.json, rebuilt every night by rockoff-upload/src/basket/build_basket.py.
   One tap adds a product without sizes; a product with sizes opens its page. If anything fails the theme's block simply stays.
   20% of browsers keep the old block, so the effect can be measured: GA4 rr_camp_show / click / holdout / purchase with
   rr_camp = basket_recs (the purchase event is sent by campaigns.js). Preview for everyone: add #rr-bsk to the address.
   No per-frame work. */
(function () {
  'use strict';
  if (window.__rrBsk) { return; }
  window.__rrBsk = true;
  if (!document.body || !/\bsr-cart-page-body\b/.test(document.body.className)) { return; }

  var BASE = window.RRBSK_BASE || 'https://1374223-star.github.io/rockpince-menu-counts/assets/basket/';
  var IMG = 'https://rockpince.cdn.shoprenter.hu/custom/rockpince/image/cache/w360h360q80/product/';
  var ADD = '/index.php?route=module/cart/callback';
  var FREE = 30000, REACH = 12000, KEY = 'rr-bsk', CAMP = 'basket_recs', HOLDOUT = 0.2;
  var want = window.matchMedia && matchMedia('(max-width: 767px)').matches ? 4 : 5;
  var D = null, box = null, sig = '';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ft(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft'; }
  function send(ev, g) {
    var p = { rr_camp: CAMP, rr_group: g };
    try { if (window.gtag) { window.gtag('event', ev, p); } else { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: ev }, p)); } } catch (e) { /* */ }
  }
  function state() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function keep(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } }
  function once(k) { try { if (sessionStorage.getItem(KEY + k)) { return false; } sessionStorage.setItem(KEY + k, '1'); } catch (e) { /* */ } return true; }

  function basket() {
    var st = (document.aurora && document.aurora.initialState) || {};
    return (st.items || []).filter(function (i) { return i.cartItemType !== 'Present' && i.productId; });
  }
  function total(list) {   /* the live figure follows quantity changes; the first page state is the fallback */
    var live = (window.ShopRenter && ShopRenter.cart && ShopRenter.cart.items) || [], n = 0, i;
    for (i = 0; i < live.length; i++) { n += Number(live[i].totalNumber || 0); }
    if (n) { return n; }
    for (i = 0; i < list.length; i++) { n += Number(list[i].totalNumber || 0); }
    return n;
  }

  function pick(list, sum) {
    var inCart = {}, out = [], seen = {}, left = FREE - sum, real = 0;
    list.forEach(function (i) { inCart[i.productId] = 1; });
    function add(id, from) {
      if (out.length >= want || seen[id] || inCart[id] || !D.p[id]) { return; }
      seen[id] = 1; out.push({ id: id, p: D.p[id], from: from }); if (from === 't') { real++; }
    }
    var scores = {}, bands = [];
    list.forEach(function (i) {
      (D.t[i.productId] || []).forEach(function (id, n) { scores[id] = (scores[id] || 0) + 6 - n; });
      var b = D.k[String(i.name || '').split(/\s+[-–—]\s+/)[0].trim().toLowerCase()];
      if (b !== undefined && D.b[b] && bands.indexOf(b) < 0) { bands.push(b); }
    });
    var own = [];
    bands.forEach(function (b) { D.b[b].forEach(function (id) { own.push(id); }); });
    if (left > 0 && left <= REACH) {   /* first: small things that finish the free shipping amount, from this band if possible */
      own.concat(D.f).filter(function (id) { var p = D.p[id]; return p && !p[5] && p[1] >= left && !inCart[id]; })
        .sort(function (a, b) { return D.p[a][1] - D.p[b][1]; }).slice(0, 2).forEach(function (id) { add(id, 'r'); });
    }
    Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; }).forEach(function (id) { add(id, 't'); });
    own.forEach(function (id) { add(id, 'b'); });
    D.f.forEach(function (id) { add(id, 'f'); });
    return { cards: out, all: real === out.length && real > 0, left: left };
  }

  function card(c, left) {
    var p = c.p, url = '/' + p[4] + '-' + c.id, reach = left > 0 && p[1] >= left;
    return '<div class="rrbk-c" data-id="' + c.id + '"><a class="rrbk-i" href="' + esc(url) + '"><img src="' + esc(IMG + String(p[3]).split('/').map(encodeURIComponent).join('/')) + '" alt="" width="180" height="180" loading="lazy"></a>' +
      '<a class="rrbk-n" href="' + esc(url) + '">' + esc(p[0]) + '</a>' +
      '<div class="rrbk-p">' + (p[2] ? '<s>' + ft(p[2]) + '</s>' : '') + '<b>' + ft(p[1]) + '</b></div>' +
      (reach ? '<div class="rrbk-f">Ezzel ingyenes a szállítás</div>' : '') +
      (p[5] ? '<a class="rrbk-b alt" href="' + esc(url) + '">Méretet választok</a>' : '<button type="button" class="rrbk-b">Kosárba</button>') + '</div>';
  }
  var CSS = '.rrbk{padding:26px 0 8px}.rrbk h2{margin:0 0 6px!important;color:#fff;text-align:center}.rrbk-s{margin:0 0 18px;color:#9cc7e3;font-size:14px;text-align:center}' +
    '.rrbk-g{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:18px}.rrbk-c{display:flex;flex-direction:column;padding:12px;background:#fff;color:#111}' +
    '.rrbk-i{display:block;aspect-ratio:1;margin-bottom:10px}.rrbk-i img{display:block;width:100%;height:100%;object-fit:contain}' +
    '.rrbk-n{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:3.9em;color:#222!important;font-size:13.5px;line-height:1.3;text-align:center;text-decoration:none!important}' +
    '.rrbk-p{margin:9px 0 8px;font-size:16px;text-align:center}.rrbk-p b{font-weight:700}.rrbk-p s{margin-right:6px;color:#8a8a8a;font-size:13px}' +
    '.rrbk-f{margin:-3px 0 8px;color:#1b8a4c;font-size:12px;font-weight:700;line-height:1.25;text-align:center}' +
    '.rrbk-b{display:block;width:100%;margin-top:auto;padding:12px 6px;border:0;border-radius:0;background:#0b3049;color:#fff!important;font:700 13px/1.15 Poppins,Arial,sans-serif;text-align:center;text-transform:uppercase;text-decoration:none!important;cursor:pointer}' +
    '.rrbk-b:hover{background:#e52421}.rrbk-b.alt{background:#fff;box-shadow:inset 0 0 0 1px #0b3049;color:#0b3049!important}.rrbk-b.alt:hover{background:#0b3049;color:#fff!important}.rrbk-b[disabled]{opacity:.65;cursor:wait}' +
    '@media (max-width:767px){.rrbk{padding:20px 0 6px}.rrbk-g{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.rrbk-c{padding:9px}.rrbk-n{font-size:12.5px}.rrbk-b{padding:12px 3px;font-size:12px}}';

  function add(btn, id, g) {
    btn.disabled = true; btn.textContent = 'Egy pillanat';
    send('rr_camp_click', g);
    var body = 'quantity=1&product_id=' + encodeURIComponent(id) + '&product_collaterals=&product_addons=&redirect=' + encodeURIComponent(location.href.split('#')[0]);
    fetch(ADD, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }, body: body })
      .then(function (r) { if (!r.ok) { throw new Error('add'); } return r.text(); })   /* read it to the end: reloading earlier can lose the item */
      .then(function () { location.reload(); })
      .catch(function () { location.href = '/' + D.p[id][4] + '-' + id; });
  }
  function render(g) {
    var list = basket(), sum = total(list);
    if (!list.length) { return false; }
    var r = pick(list, sum), now = r.cards.map(function (c) { return c.id; }).join() + '|' + Math.round(r.left);
    if (r.cards.length < 2) { return false; }
    if (now === sig) { return true; }
    sig = now;
    var old = document.getElementById('module_upsale_wrapper');
    if (!box) {
      var anchor = old || document.querySelector('.sr-cart-page');
      if (!anchor) { return false; }
      box = document.createElement('div'); box.className = 'rrbk container';
      if (!document.getElementById('rrbk-css')) { var st = document.createElement('style'); st.id = 'rrbk-css'; st.textContent = CSS; document.head.appendChild(st); }
      anchor.parentNode.insertBefore(box, old || anchor.nextSibling);
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button.rrbk-b');
        if (b) { add(b, b.closest('.rrbk-c').getAttribute('data-id'), g); return; }
        if (e.target.closest('a')) { send('rr_camp_click', g); }
      });
    }
    if (old) { old.style.display = 'none'; }
    box.innerHTML = '<h2 class="module-head-title h2">' + (r.all ? 'Ehhez vették még' : 'Ehhez ajánljuk') + '</h2>' +
      (r.left > 0 ? '<p class="rrbk-s">Még ' + ft(r.left) + ' és ingyenes a szállítás</p>' : '<p class="rrbk-s"></p>') +
      '<div class="rrbk-g">' + r.cards.map(function (c) { return card(c, r.left); }).join('') + '</div>';
    return true;
  }

  function start(tries) {
    if (!basket().length) { if ((tries || 0) < 30) { setTimeout(function () { start((tries || 0) + 1); }, 250); } return; }
    var s = state(), force = /rr-bsk/.test(location.hash);
    if (!s.g) { s.g = Math.random() < HOLDOUT ? 'holdout' : 'show'; }
    var g = force ? 'show' : s.g;
    s.t = Date.now(); keep(s);
    if (g === 'holdout') { if (once('-h')) { send('rr_camp_holdout', g); } return; }
    fetch(window.RRBSK_DATA || (BASE + 'recs.json')).then(function (r) { return r.json(); }).then(function (d) {
      D = d;
      if (render(g)) {
        if (once('-s')) { send('rr_camp_show', g); }
        var t = null;
        document.addEventListener('cartChanged', function () { clearTimeout(t); t = setTimeout(function () { render(g); }, 500); });
      }
    }).catch(function () { /* the theme's block stays */ });
  }
  start(0);
})();
