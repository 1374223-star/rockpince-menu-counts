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
      '.rr-looks-c:hover .rr-looks-t,.rr-looks-c:focus-visible .rr-looks-t{text-decoration:underline}' +
      '.rr-looks-i{display:block;aspect-ratio:1/1;padding:10px 10px 0;background:#fff}' +
      '.rr-looks-i img{display:block;width:100%;height:100%;object-fit:contain}' +
      '.rr-looks-t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em;margin:12px 12px 8px;font-size:14px;line-height:1.35;text-align:center;color:#14202b}' +
      '.rr-looks-p{margin:auto 12px 0;padding:10px 0 12px;border-top:1px solid #e6e9ec;text-align:center;font-weight:700;font-size:16px;color:#14202b}' +
      '.rr-looks-p s{display:block;font-size:12px;font-weight:400;color:#7a8590}.rr-looks-p b{color:#e52421}' +
      '.rr-looks-m{display:block;margin:0 12px 12px;padding:10px 6px;background:#0b344d;color:#fff;font-size:13px;font-weight:700;letter-spacing:.5px;text-align:center;text-transform:uppercase}' +
      '.rr-looks-more{text-align:center;margin-top:22px}' +
      '.rr-looks-more a{display:inline-block;padding:12px 22px;border:1px solid #7fc4ea;border-radius:4px;color:#fff!important;font-weight:700;text-decoration:none!important}' +
      '.rr-looks-more a:hover{background:#0b344d}' +
      '@media (max-width:767px){.rr-looks-g{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.rr-looks-t{font-size:13px;margin:10px 8px 6px}.rr-looks-m{margin:0 8px 8px}}';
    (document.head || document.documentElement).appendChild(s);
  }

  function anchor() {
    var a = document.querySelector('.module-similar_products-wrapper') || document.querySelector('.module-boughtwith-wrapper');
    if (a) { return { el: a, after: true }; }
    a = document.querySelector('.module-productreview-wrapper');
    return a ? { el: a, after: false } : null;
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
      '<div class="rr-looks-more"><a></a></div>';
    box.querySelector('h3').textContent = head;
    var a = box.querySelector('.rr-looks-more a');
    a.href = more; a.textContent = style ? 'Még több: ' + style : 'Még több alternatív ruha';
    box.querySelector('.rr-looks-g').innerHTML = ids.map(function (j) {
      var c = cards[j], sale = c[2] > 0 && c[2] < c[1];
      return '<a class="rr-looks-c" href="/' + esc(c[4]) + '-' + j + '">' +
        '<span class="rr-looks-i"><img src="' + esc(img(c[3])) + '" alt="" loading="lazy" width="360" height="360"></span>' +
        '<span class="rr-looks-t">' + esc(c[0]) + '</span>' +
        '<span class="rr-looks-p">' + (sale ? '<s>' + ft(c[1]) + '</s><b>' + ft(c[2]) + '</b>' : ft(c[1])) + '</span>' +
        '<span class="rr-looks-m">Megnézem</span></a>';
    }).join('');
    box.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('a');
      if (link && window.gtag) { try { window.gtag('event', 'rr_looks_click', { rr_camp: 'looks', rr_group: style || 'lookalike' }); } catch (_) { /* no analytics */ } }
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
