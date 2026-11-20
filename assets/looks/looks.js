/* Same-style row (owner 2026-11-19: "1 and 2"). On alternative clothes product pages, under the shop's "Hasonló termékek":
   up to 10 other pieces in the same Stílus (Romantikus gót, Nu-goth, Military...), for the same people, at most 3 of one
   product type, with a link to all of that style on the Alternatív ruhák page. Pieces with no style get look-alikes.
   Data: branch "looks" of this repo, written every night by rockoff-upload/src/looks/build_looks.py.
   Loaded by menu.js when the browser is idle; one small file per page, no scroll listener, nothing moves above the row. */
(function () {
  'use strict';
  if (window.__rrLooks) { return; }
  window.__rrLooks = true;
  var DATA = window.RRLOOKS_DATA || 'https://raw.githubusercontent.com/1374223-star/rockpince-menu-counts/looks/';
  var IMG = 'https://rockpince.cdn.shoprenter.hu/custom/rockpince/image/cache/w360h360q80/product/';
  var ALT = '/alternativ-ruhazat';
  var phone = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
  var input = document.querySelector('form#product input[name="product_id"]');
  var id = input && Number(input.value);
  if (!id) { return; }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ft(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft'; }
  function img(path) { return (IMG + String(path).split('/').map(encodeURIComponent).join('/')).replace('/product/../', '/'); }

  function css() {
    var s = document.createElement('style');
    s.textContent =
      '.rr-looks{padding:8px 0 28px}' +
      '.rr-looks .module-head{text-align:center;margin-bottom:22px}' +
      '.rr-looks-g{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:24px}' +
      '.rr-looks-c{display:flex;flex-direction:column;background:#fff;color:#14202b;text-decoration:none!important;border-radius:2px;overflow:hidden}' +
      '.rr-looks-i{display:block;aspect-ratio:1/1;padding:10px 10px 0;background:#fff}' +
      '.rr-looks-i img{display:block;width:100%;height:100%;object-fit:contain}' +
      '.rr-looks-t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em;margin:12px 12px 8px;font-size:14px;line-height:1.35;text-align:center;color:#14202b}' +
      '.rr-looks-p{margin:auto 12px 0;padding:10px 0 12px;border-top:1px solid #e6e9ec;text-align:center;font-weight:700;font-size:16px;color:#14202b}' +
      '.rr-looks-p s{display:block;font-size:12px;font-weight:400;color:#7a8590}.rr-looks-p b{color:#e52421}' +
      '.rr-looks-l{display:flex;flex-direction:column;flex:1;color:#14202b;text-decoration:none!important}.rr-looks-l:hover .rr-looks-t{text-decoration:underline}' +
      '.rr-looks-b{padding:0 12px 12px}.rr-looks-add{width:100%;min-height:42px;padding:8px 6px;background:#e52421;border:0;border-radius:3px;color:#fff!important;font-size:13px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;cursor:pointer}' +
      '.rr-looks-add:hover{background:#c41b17}.rr-looks-add[disabled]{opacity:.7;cursor:default}' +
      '.rr-looks-szl{margin-bottom:6px;font-size:11px;font-weight:700;letter-spacing:.05em;color:#5b7a92;text-transform:uppercase;text-align:center}' +
      '.rr-looks-sz{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}.rr-looks-sz button{min-width:40px;min-height:38px;padding:5px 6px;background:#fff;border:1px solid #0b2a44;border-radius:3px;color:#0b2a44!important;font-size:12px;font-weight:700;line-height:1.1;cursor:pointer}' +
      '.rr-looks-sz button:hover{background:#0b2a44;color:#fff!important}.rr-looks-sz small{display:block;font-size:9px;color:#b3261e}' +
      '.rr-looks-ok{display:block;margin-bottom:4px;font-size:13px;font-weight:800;color:#1d7a3a;text-align:center}.rr-looks-to{display:block;padding:9px 6px;background:#0b344d;border-radius:3px;color:#fff!important;font-size:12px;font-weight:700;text-align:center;text-decoration:none!important}' +
      '.rr-looks-more{text-align:center;margin-top:22px}' +
      '.rr-looks-more a{display:inline-block;padding:12px 22px;border:1px solid #7fc4ea;border-radius:4px;color:#fff!important;font-weight:700;text-decoration:none!important}' +
      '.rr-looks-more a:hover{background:#0b344d}' +
      '@media (max-width:767px){.rr-looks-g{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.rr-looks-t{font-size:13px;margin:10px 8px 6px}.rr-looks-b{padding:0 8px 8px}}';
    (document.head || document.documentElement).appendChild(s);
  }

  function anchor() {
    var a = document.querySelector('.module-similar_products-wrapper') || document.querySelector('.module-boughtwith-wrapper');
    if (a) { return { el: a, after: true }; }
    a = document.querySelector('.module-productreview-wrapper');
    return a ? { el: a, after: false } : null;
  }

  /* basket straight from the row (owner 2026-11-20: "can choose sizes and put them in basket"): same request and size
     reading as the search page's cards (search.js basketAdd), which the gift finder proved first. Any failure opens the product. */
  var ADD_URL = '/index.php?route=module/cart/callback', CART_URL = '/index.php?route=checkout/cart', sizeMemo = {};
  function sizesOf(pid) {
    if (sizeMemo[pid]) { return Promise.resolve(sizeMemo[pid]); }
    return fetch('/index.php?route=product/quickview&product_id=' + encodeURIComponent(pid), { credentials: 'include' }).then(function (r) { if (!r.ok) { throw new Error('sizes'); } return r.text(); }).then(function (html) {
      var sel = new DOMParser().parseFromString(html, 'text/html').querySelector('select[name^="option["]'), opts = [];
      if (sel) { [].forEach.call(sel.options, function (o) { if (o.value && !o.disabled) { var l = o.textContent.replace(/\s+/g, ' ').trim(), m = l.match(/^(.*?)\s*(\+\s*[\d.\s]+\s*Ft)$/); opts.push({ v: o.value, l: m ? m[1] : l, x: m ? m[2].replace(/\s/g, '') : '' }); } }); }
      return (sizeMemo[pid] = { name: sel ? sel.getAttribute('name') : '', opts: opts });
    });
  }
  function syncCartHeader(j) {
    var q = document.querySelector('#js-cart .header-quantity-box'), cb = document.querySelector('#js-cart .js-cart-ajax');
    if ((!q || parseInt(q.textContent, 10) !== Number(j.countProducts)) && cb && j.html) { cb.outerHTML = j.html; }
    [].forEach.call(document.querySelectorAll('.mobile-cart-product-count'), function (m) { m.innerHTML = j.countProducts; m.classList.remove('mobile-cart-empty'); });
  }
  function basketAdd(card, pid, size, sizes, price, track) {
    var buy = card.querySelector('.rr-looks-b'), name = (card.querySelector('.rr-looks-t') || {}).textContent || '';
    buy.innerHTML = '<button type="button" class="rr-looks-add" disabled>Egy pillanat</button>';
    var body = 'quantity=1&product_id=' + encodeURIComponent(pid) + (sizes && sizes.name ? '&' + encodeURIComponent(sizes.name) + '=' + encodeURIComponent(size) : '') +
      '&product_collaterals=&product_addons=&redirect=' + encodeURIComponent(location.href.split('#')[0]);
    fetch(ADD_URL, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }, body: body })
      .then(function (r) { if (!r.ok) { throw new Error('add'); } return r.json(); })
      .then(function (j) {
        var line = (j.products || []).filter(function (p) { return String(p.productId) === String(pid); })[0];
        if (!line) { throw new Error('not added'); }
        buy.innerHTML = '<span class="rr-looks-ok" role="status">A kosárban</span><a class="rr-looks-to" href="' + CART_URL + '">Tovább a kosárhoz</a>';
        var item = { id: '[' + pid + ']', sku: line.sku || '', price: price, quantityName: 'db', currency: 'HUF', quantity: 1, name: line.name || name, brand: '' };
        try { localStorage.setItem('cartModified', '1'); } catch (_) { /* private mode */ }
        document.dispatchEvent(new CustomEvent('cartChanged', { detail: { data: j, cartToken: j.cartToken || '', products: j.products } }));
        document.dispatchEvent(new CustomEvent('AddToCart', { detail: { cartToken: j.cartToken || '', product: item, addedItems: j.addedItems && j.addedItems.length ? j.addedItems : [item] } }));
        track('rr_looks_add');
        setTimeout(function () { syncCartHeader(j); }, 400);
      })
      .catch(function () { location.href = card.getAttribute('data-href'); });
  }
  function basketClick(b, track) {
    var card = b.closest('.rr-looks-c'), buy = card && card.querySelector('.rr-looks-b');
    if (!buy || b.disabled) { return; }
    var price = +buy.getAttribute('data-price') || +b.getAttribute('data-price') || 0;
    if (b.hasAttribute('data-size')) { basketAdd(card, b.getAttribute('data-id'), b.getAttribute('data-size'), sizeMemo[b.getAttribute('data-id')], price, track); return; }
    var pid = b.getAttribute('data-add');
    b.disabled = true; b.textContent = 'Egy pillanat';
    sizesOf(pid).then(function (s) {
      if (!s.opts.length) { basketAdd(card, pid, '', s, price, track); return; }
      buy.setAttribute('data-price', String(price));
      buy.innerHTML = '<div class="rr-looks-szl">Válassz méretet</div><div class="rr-looks-sz">' + s.opts.map(function (o) {
        return '<button type="button" data-size="' + esc(o.v) + '" data-id="' + esc(pid) + '">' + esc(o.l) + (o.x ? '<small>' + esc(o.x) + '</small>' : '') + '</button>'; }).join('') + '</div>';
    }).catch(function () { location.href = card.getAttribute('data-href'); });
  }

  function show(row, cards) {
    var at = anchor();
    if (!at || !row || document.querySelector('.rr-looks')) { return; }
    var style = row[0], ids = row[1].filter(function (j) { return cards[j] && j !== id; }).slice(0, phone ? 4 : 10);
    if (ids.length < 4) { return; }
    css();
    var head = style ? 'Ugyanebben a stílusban: ' + style : 'Hasonló stílusú darabok';
    var more = style ? ALT + '#f.style=' + encodeURIComponent(style) : ALT;
    var box = document.createElement('div');
    box.className = 'rr-looks module';
    box.innerHTML = '<div class="module-head"><h3 class="module-head-title"></h3></div><div class="rr-looks-g"></div>' +
      '<div class="rr-looks-more"><a data-rr-count-applied="1"></a></div>';   /* no menu [count] badge: it would show all of Alternatív ruhák */
    box.querySelector('h3').textContent = head;
    var a = box.querySelector('.rr-looks-more a');
    a.href = more; a.textContent = style ? 'Még több: ' + style : 'Még több alternatív ruha';
    box.querySelector('.rr-looks-g').innerHTML = ids.map(function (j) {
      var c = cards[j], sale = c[2] > 0 && c[2] < c[1], href = '/' + esc(c[4]) + '-' + j;
      return '<div class="rr-looks-c" data-href="' + href + '"><a class="rr-looks-l" href="' + href + '">' +
        '<span class="rr-looks-i"><img src="' + esc(img(c[3])) + '" alt="" loading="lazy" width="360" height="360"></span>' +
        '<span class="rr-looks-t">' + esc(c[0]) + '</span>' +
        '<span class="rr-looks-p">' + (sale ? '<s>' + ft(c[1]) + '</s><b>' + ft(c[2]) + '</b>' : ft(c[1])) + '</span></a>' +
        '<div class="rr-looks-b"><button type="button" class="rr-looks-add" data-add="' + j + '" data-price="' + (sale ? c[2] : c[1]) + '">Kosárba</button></div></div>';
    }).join('');
    function track(name) { if (window.gtag) { try { window.gtag('event', name, { rr_camp: 'looks', rr_group: style || 'lookalike' }); } catch (_) { /* no analytics */ } } }
    box.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : null, b = t && t.closest('button');
      if (b && box.contains(b)) { e.preventDefault(); basketClick(b, track); return; }
      if (t && t.closest('a') && !t.closest('.rr-looks-to')) { track('rr_looks_click'); }
    });
    at.el.parentNode.insertBefore(box, at.after ? at.el.nextSibling : at.el);
  }

  var x = new XMLHttpRequest();
  x.open('GET', DATA + (id % 256) + '.json');
  x.onload = function () {
    var d = null;
    try { d = x.status === 200 ? JSON.parse(x.responseText) : null; } catch (e) { d = null; }
    if (d && d.p && d.p[id]) { show(d.p[id], d.c || {}); }
  };
  x.send();
})();
