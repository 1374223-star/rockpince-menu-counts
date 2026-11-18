/* Ajándékkereső (owner 2026-11-18): a calm four question flow on the page /ajandekkereso for someone buying for a rock or metal
   fan without knowing bands or sizes. Draws into <div id="rrgf-app">. The answers live in the address, so a result can be shared.
   Data: gifts.json (band list) and d/*.json (one short product list per style, bands in 32 files), rebuilt every night by
   rockoff-upload/src/gifts/build_gifts.py. A result never comes back empty: the match is widened and the page says so.
   Products without sizes go to the basket with one tap, the others open their page. No popups, no per-frame work. */
(function () {
  'use strict';

  var BASE = window.RRGF_BASE || 'https://1374223-star.github.io/rockpince-menu-counts/assets/gifts/';
  var IMG = 'https://rockpince.cdn.shoprenter.hu/custom/rockpince/image/cache/w360h360q80/product/';
  var ADD = '/index.php?route=module/cart/callback', CART = '/index.php?route=checkout/cart';
  var VOUCHER = '/elektronikus-ajandekutalvany-246284', VOUCHER_IMG = 'termekek/termek/2789310_big.jpg';
  var NB = ' ', WANT = 12, ENOUGH = 8;
  var WHO = [['ferfi', 'Férfinak', 'm'], ['no', 'Nőnek', 'f'], ['gyerek', 'Gyereknek', 'k']];
  var STYLES = [['metal', 'Metal', 'metal'], ['punk', 'Punk', 'punk'], ['goth', 'Goth', 'goth'], ['anime', 'Anime', 'anime'], ['nemtudom', 'Nem tudom', 'any']];
  var BUDGETS = [['5alatt', '5' + NB + '000' + NB + 'Ft alatt', 0, 5000], ['5-10', '5-10' + NB + '000' + NB + 'Ft', 5000, 10000],
    ['10-20', '10-20' + NB + '000' + NB + 'Ft', 10000, 20000], ['20felett', '20' + NB + '000' + NB + 'Ft felett', 20000, 1e9]];
  var SIZES = [['tudom', 'Igen, tudom', 'Ruhát is mutatunk, a méretet a termék oldalán választod ki.'],
    ['nemtudom', 'Nem tudom', 'Csak olyat mutatunk, amihez nem kell méret.']];
  var ORDER = ['kinek', 'stilus', 'zenekar', 'keret', 'meret'];
  var CSS = '.rrgf{color:#fff;font-size:15px;line-height:1.45}.rrgf *{box-sizing:border-box}' +
    '.rrgf-step{max-width:760px}.rrgf-intro{margin:0 0 22px;font-size:16px}' +
    '.rrgf-top{display:flex;align-items:center;gap:14px;margin:0 0 14px;color:#9cc7e3;font-size:13px}' +
    '.rrgf-bar{display:flex;gap:4px;width:120px}.rrgf-bar i{flex:1;height:4px;background:rgba(255,255,255,.2)}.rrgf-bar i.on{background:#e52421}' +
    '.rrgf h2.rrgf-h{margin:0 0 6px!important;padding:0;color:#fff;font-size:26px;font-weight:700;line-height:1.2;text-transform:none;outline:0}' +
    '.rrgf-help{margin:0 0 18px;color:#c9dcea}.rrgf-opts{display:grid;gap:10px;margin:0 0 18px}.rrgf-c2{grid-template-columns:repeat(2,minmax(0,1fr))}' +
    '.rrgf-c3{grid-template-columns:repeat(3,minmax(0,1fr))}.rrgf-c4{grid-template-columns:repeat(4,minmax(0,1fr))}.rrgf-c5{grid-template-columns:repeat(5,minmax(0,1fr))}' +
    '.rrgf-o{display:block;width:100%;min-height:62px;padding:12px 10px;border:1px solid rgba(159,214,247,.35);border-radius:0;background:rgba(4,20,34,.62);color:#fff;font:600 16px/1.25 Poppins,Arial,sans-serif;text-align:center;cursor:pointer}' +
    '.rrgf-o:hover{border-color:#fff;background:#0b3049}.rrgf-o small{display:block;margin-top:4px;color:#c9dcea;font-size:12.5px;font-weight:400;line-height:1.3}' +
    '.rrgf-o:focus-visible,.rrgf-l:focus-visible,.rrgf-chip:focus-visible,.rrgf-b:focus-visible,.rrgf-in:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
    '.rrgf-lab{display:block;margin:0 0 6px;font-weight:600}.rrgf-in{display:block;width:100%;height:50px;padding:0 14px;border:0;border-radius:0;background:#fff;color:#111;font:16px Poppins,Arial,sans-serif}' +
    '.rrgf-sug{display:grid;gap:1px;margin:0 0 6px;background:rgba(159,214,247,.25)}.rrgf-sug:empty{display:none}' +
    '.rrgf-sug button{display:block;width:100%;padding:12px 14px;border:0;background:#0b3049;color:#fff;font:15px Poppins,Arial,sans-serif;text-align:left;cursor:pointer}.rrgf-sug button:hover{background:#14507a}' +
    '.rrgf-none{margin:8px 0 0;color:#ffd9a8}.rrgf-none:empty{display:none}.rrgf-sub{margin:18px 0 8px;font-weight:600}' +
    '.rrgf-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 6px}.rrgf-chip{padding:8px 12px;border:1px solid rgba(159,214,247,.35);border-radius:0;background:transparent;color:#fff;font:14px/1.2 Poppins,Arial,sans-serif;cursor:pointer}.rrgf-chip:hover{border-color:#fff;background:#0b3049}' +
    '.rrgf-nav{display:flex;flex-wrap:wrap;gap:18px;margin:6px 0 0}.rrgf-l{padding:6px 0;border:0;background:none;color:#9fd6f7;font:14px Poppins,Arial,sans-serif;text-decoration:underline;cursor:pointer}.rrgf-l:hover{color:#fff}' +
    '.rrgf-note{margin:12px 0 0;padding:10px 12px;border-left:3px solid #e52421;background:rgba(4,20,34,.62)}.rrgf-wait{margin:18px 0}' +
    '.rrgf-g{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin:18px 0 14px}.rrgf-c{display:flex;flex-direction:column;min-width:0;padding:10px;background:#fff;color:#111}' +
    '.rrgf-i{display:block;aspect-ratio:1;margin-bottom:8px}.rrgf-i img{display:block;width:100%;height:100%;object-fit:contain}' +
    '.rrgf-n{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:3.9em;color:#222!important;font-size:13px;line-height:1.3;text-align:center;text-decoration:none!important}' +
    '.rrgf-p{margin:8px 0;font-size:15.5px;text-align:center}.rrgf-p b{font-weight:700}.rrgf-p s{margin-right:6px;color:#8a8a8a;font-size:12.5px}' +
    '.rrgf-b{display:block;width:100%;margin-top:auto;padding:12px 4px;border:0;border-radius:0;background:#0b3049;color:#fff!important;font:700 12.5px/1.15 Poppins,Arial,sans-serif;text-align:center;text-transform:uppercase;text-decoration:none!important;cursor:pointer}' +
    '.rrgf-b:hover{background:#e52421}.rrgf-b.alt{background:#fff;box-shadow:inset 0 0 0 1px #0b3049;color:#0b3049!important}.rrgf-b.alt:hover{background:#0b3049;color:#fff!important}.rrgf-b[disabled]{opacity:.65;cursor:default}.rrgf-b.ok,.rrgf-b.ok:hover{background:#1b8a4c;opacity:1}' +
    '.rrgf-to{display:block;margin-top:6px;color:#0b3049!important;font-size:12.5px;text-align:center;text-decoration:underline!important}' +
    '.rrgf-v{display:flex;align-items:center;gap:18px;margin:0 0 16px;padding:14px 18px;background:#fff;color:#111}.rrgf-v img{flex:none;width:96px;height:96px;object-fit:contain}.rrgf-vt{flex:1;min-width:0}' +
    '.rrgf-v b{display:block;font-size:17px;line-height:1.25}.rrgf-v span{display:block;margin-top:3px;color:#333;font-size:14px}.rrgf-v .rrgf-b{flex:none;width:170px;margin:0}' +
    '@media (max-width:1199px){.rrgf-g{grid-template-columns:repeat(4,minmax(0,1fr))}}' +
    '@media (max-width:767px){.rr-toast{display:none!important}.rrgf h2.rrgf-h{font-size:22px}.rrgf-c4,.rrgf-c5{grid-template-columns:repeat(2,minmax(0,1fr))}.rrgf-c5 .rrgf-o:last-child{grid-column:1/-1}.rrgf-o{min-height:56px;padding:10px 6px;font-size:15px}' +
    '.rrgf-g{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.rrgf-c{padding:8px}.rrgf-n{font-size:12.5px}.rrgf-b{padding:12px 3px;font-size:12px}' +
    '.rrgf-v{flex-wrap:wrap;gap:12px;padding:12px}.rrgf-v img{width:72px;height:72px}.rrgf-vt{flex:1 1 180px}.rrgf-v .rrgf-b{width:100%}}';

  var root, D = null, index = [], bandBy = {}, files = {}, added = {}, ticket = 0, cover = 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ft(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + 'Ft'; }
  function find(list, key) { for (var i = 0; i < list.length; i++) { if (list[i][0] === key) { return list[i]; } } return null; }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/^the /, '').trim();
  }

  /* ---------- the answers, kept in the address ---------- */
  function read() {
    var u = new URLSearchParams(location.search), q = {};
    if (find(WHO, u.get('kinek'))) { q.kinek = u.get('kinek'); }
    if (u.get('zenekar') && bandBy[u.get('zenekar')]) { q.zenekar = u.get('zenekar'); } else if (find(STYLES, u.get('stilus'))) { q.stilus = u.get('stilus'); }
    if (find(BUDGETS, u.get('keret'))) { q.keret = u.get('keret'); }
    if (find(SIZES, u.get('meret'))) { q.meret = u.get('meret'); }
    return q;
  }
  function address(q) {
    var p = ORDER.filter(function (k) { return q[k]; }).map(function (k) { return k + '=' + encodeURIComponent(q[k]); });
    return location.pathname + (p.length ? '?' + p.join('&') : '');
  }
  function go(q) { history.pushState({ rrgf: 1 }, '', address(q)); render(true); }
  function stepOf(q) { return !q.kinek ? 1 : !(q.stilus || q.zenekar) ? 2 : !q.keret ? 3 : !q.meret ? 4 : 5; }
  function clear(q, step) {
    if (step === 1) { delete q.kinek; } else if (step === 2) { delete q.stilus; delete q.zenekar; } else if (step === 3) { delete q.keret; } else { delete q.meret; }
    return q;
  }

  /* ---------- drawing the questions ---------- */
  function top(step, title, help) {
    var bars = '';
    for (var i = 1; i <= 4; i++) { bars += '<i' + (i <= step ? ' class="on"' : '') + '></i>'; }
    return '<div class="rrgf-top"><span>' + step + '. kérdés a 4-ből</span><div class="rrgf-bar" aria-hidden="true">' + bars + '</div></div>' +
      '<h2 class="rrgf-h" tabindex="-1">' + title + '</h2>' + (help ? '<p class="rrgf-help">' + help + '</p>' : '');
  }
  function option(attr, value, label, small) {
    return '<button type="button" class="rrgf-o" data-' + attr + '="' + esc(value) + '">' + esc(label) + (small ? '<small>' + esc(small) + '</small>' : '') + '</button>';
  }
  function nav(step) {
    if (step < 2) { return ''; }
    return '<div class="rrgf-nav"><button type="button" class="rrgf-l" data-back="1">Vissza</button><button type="button" class="rrgf-l" data-restart="1">Újrakezdés</button></div>';
  }
  function stepHtml(step) {
    var h = '<div class="rrgf-step">';
    if (step === 1) {
      h += '<p class="rrgf-intro">Négy rövid kérdés, és megmutatjuk, mivel nem lőhetsz mellé. Nem kell ismerned sem a zenekarokat, sem a méreteket.</p>' +
        top(1, 'Kinek keresel ajándékot?') + '<div class="rrgf-opts rrgf-c3">' + WHO.map(function (w) { return option('kinek', w[0], w[1]); }).join('') + '</div>';
    } else if (step === 2) {
      h += top(2, 'Mit szeret?', 'Írd be a kedvenc zenekarát, vagy válassz stílust. Ha nem tudod, az sem baj.') +
        '<label class="rrgf-lab" for="rrgf-q">Zenekar</label><input id="rrgf-q" class="rrgf-in" type="search" autocomplete="off" enterkeyhint="search" placeholder="Például Metallica">' +
        '<div class="rrgf-sug" id="rrgf-sug"></div><p class="rrgf-none" id="rrgf-none" aria-live="polite"></p>' +
        '<p class="rrgf-sub">Népszerű zenekarok</p><div class="rrgf-chips">' + D.b.slice(0, 8).map(function (b) { return '<button type="button" class="rrgf-chip" data-band="' + esc(b[1]) + '">' + esc(b[0]) + '</button>'; }).join('') + '</div>' +
        '<p class="rrgf-sub">Vagy válassz stílust</p><div class="rrgf-opts rrgf-c5">' + STYLES.map(function (s) { return option('stilus', s[0], s[1]); }).join('') + '</div>';
    } else if (step === 3) {
      h += top(3, 'Mennyit szánnál rá?') + '<div class="rrgf-opts rrgf-c4">' + BUDGETS.map(function (b) { return option('keret', b[0], b[1]); }).join('') + '</div>';
    } else {
      h += top(4, 'Tudod a méretét?') + '<div class="rrgf-opts rrgf-c2">' + SIZES.map(function (s) { return option('meret', s[0], s[1], s[2]); }).join('') + '</div>';
    }
    return h + nav(step) + '</div>';
  }

  /* ---------- band search: typing tolerates accents, "the" and small typos ---------- */
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) { return max + 1; }
    var prev = [], i, j;
    for (j = 0; j <= b.length; j++) { prev[j] = j; }
    for (i = 1; i <= a.length; i++) {
      var cur = [i], best = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) { best = cur[j]; }
      }
      if (best > max) { return max + 1; }
      prev = cur;
    }
    return prev[b.length];
  }
  function search(text) {
    var n = norm(text), c = n.replace(/ /g, ''), out = [], max = c.length <= 5 ? 1 : 2;
    if (c.length < 2) { return out; }
    index.forEach(function (e, pos) {
      var s = -1;
      if (e.n.indexOf(n) === 0 || e.c.indexOf(c) === 0) { s = 0; } else if ((' ' + e.n).indexOf(' ' + n) >= 0) { s = 1; } else if (e.n.indexOf(n) >= 0 || e.c.indexOf(c) >= 0) { s = 2; } else if (c.length >= 4 && (distance(c, e.c, max) <= max || distance(c, e.c.slice(0, c.length), max) <= max)) { s = 3; }
      if (s >= 0) { out.push([s, pos, e.b]); }
    });
    return out.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).slice(0, 6).map(function (x) { return x[2]; });
  }
  function suggest() {
    var input = document.getElementById('rrgf-q'), box = document.getElementById('rrgf-sug'), none = document.getElementById('rrgf-none');
    if (!input) { return; }
    var hits = search(input.value);
    box.innerHTML = hits.map(function (b) { return '<button type="button" data-band="' + esc(b[1]) + '">' + esc(b[0]) + '</button>'; }).join('');
    none.textContent = norm(input.value).length >= 3 && !hits.length ? 'Ezt a nevet nem találtuk. Próbáld másképp, vagy válassz alább stílust.' : '';
  }

  /* ---------- choosing the products ---------- */
  function load(name) {
    if (!files[name]) {
      files[name] = fetch(BASE + 'd/' + name + '.json?v=' + encodeURIComponent(D.built || '')).then(function (r) { if (!r.ok) { throw new Error('data'); } return r.json(); });
      files[name].catch(function () { delete files[name]; });
    }
    return files[name];
  }
  function plan(q) {
    var who = find(WHO, q.kinek)[2], band = q.zenekar ? bandBy[q.zenekar] : null, style = band ? D.g[band[3]] : find(STYLES, q.stilus)[2];
    var main = band ? { f: 'b-' + (band[2] < 10 ? '0' : '') + band[2], k: band[1], band: 1 } : { f: 'g-' + style, k: style };
    var near = { f: 'g-' + style, k: style }, all = { f: 'g-any', k: 'any' }, t = [];
    function add(p, wide, level, why) { t.push({ p: p, wide: wide, level: level, why: why }); }
    add(main, 0, 0, '');
    if (who === 'f') { add(main, 1, 0, 'who'); }
    add(main, 0, 1, 'price');
    if (who === 'f') { add(main, 1, 1, 'price'); }
    if (band && style !== 'any') { add(near, 0, 0, 'style'); if (who === 'f') { add(near, 1, 0, 'style'); } }
    if (style !== 'any' || band) { add(all, 0, 0, 'any'); if (who === 'f') { add(all, 1, 0, 'any'); } }
    if (band && style !== 'any') { add(near, 0, 1, 'style'); }
    if (style !== 'any' || band) { add(all, 0, 1, 'any'); }
    add(main, 1, 2, 'price');
    add(all, 1, 2, 'any');
    return { who: who, band: band, tiers: t };
  }
  function pick(q, done, fail) {
    var P = plan(q), b = BUDGETS.indexOf(find(BUDGETS, q.keret)), noSize = q.meret === 'nemtudom';
    var out = [], seen = {}, kinds = {}, groups = {}, widest = '', i = 0;
    function budgetOk(price, level) {
      if (level === 2) { return true; }
      var at = 0;
      while (at < 3 && price >= BUDGETS[at][3]) { at++; }
      return level === 0 ? at === b : Math.abs(at - b) === 1;
    }
    function take(t, data, capped) {
      var L = data.l[t.p.k];
      if (!L) { return 0; }
      var ids = L[P.who] || [], got = 0;
      if (t.wide && P.who === 'f') { ids = ids.concat((L.m || []).filter(function (id) { var r = data.p[id]; return r && r[6] === 0; })); }
      for (var n = 0; n < ids.length && out.length < WANT; n++) {
        var id = ids[n], r = data.p[id];
        if (!r || seen[id] || (noSize && r[5]) || !budgetOk(r[1], t.level)) { continue; }
        if (capped) {
          if ((kinds[r[8]] || 0) >= 3) { continue; }
          if (!t.p.band && r[9] && (groups[r[9]] || 0) >= 2) { continue; }
        }
        seen[id] = 1; kinds[r[8]] = (kinds[r[8]] || 0) + 1; groups[r[9]] = (groups[r[9]] || 0) + 1;
        out.push({ id: id, r: r }); got++;
      }
      return got;
    }
    function step() {
      if (i >= P.tiers.length || out.length >= WANT) { done({ cards: out, why: widest, band: P.band }); return; }
      var t = P.tiers[i];
      load(t.p.f).then(function (data) {
        var got = take(t, data, true) + (out.length < WANT ? take(t, data, false) : 0);
        if (got && i > 0) { widest = t.why; }
        i++;
        if (i === 1 && out.length >= ENOUGH) { done({ cards: out, why: '', band: P.band }); return; }
        step();
      }).catch(fail);
    }
    step();
  }
  function noteText(res) {
    if (res.why === 'who') { return 'Női darabból ebben az árban kevés van, ezért uniszex termékeket is mutatunk.'; }
    if (res.why === 'price') { return 'Ebben az árban kevés a találat, ezért a közeli árakból is mutatunk.'; }
    if (res.why === 'style') { return (res.band ? res.band[0] + ': ' : '') + 'ezekkel a feltételekkel kevés a találat, ezért hasonló stílusú ajándékokat is mutatunk.'; }
    if (res.why === 'any') { return 'Ezekkel a feltételekkel kevés a találat, ezért a legkeresettebb ajándékainkból is mutatunk.'; }
    return '';
  }

  /* ---------- the result ---------- */
  function picture(path) { return IMG + String(path).split('/').map(encodeURIComponent).join('/'); }
  function buttonHtml(id, r, url) {
    if (r[5]) { return '<a class="rrgf-b alt" href="' + esc(url) + '">Méretet választok</a>'; }
    if (added[id]) { return '<span class="rrgf-b ok">A kosárban</span><a class="rrgf-to" href="' + CART + '">Tovább a kosárhoz</a>'; }
    return '<button type="button" class="rrgf-b" data-add="' + id + '">Kosárba</button>';
  }
  function cardHtml(c) {
    var r = c.r, url = '/' + r[4] + '-' + c.id;
    return '<div class="rrgf-c" data-id="' + c.id + '"><a class="rrgf-i" href="' + esc(url) + '"><img src="' + esc(picture(r[3])) + '" alt="" width="180" height="180" loading="lazy"></a>' +
      '<a class="rrgf-n" href="' + esc(url) + '">' + esc(r[0]) + '</a><div class="rrgf-p">' + (r[2] ? '<s>' + ft(r[2]) + '</s>' : '') + '<b>' + ft(r[1]) + '</b></div>' +
      '<div class="rrgf-a">' + buttonHtml(c.id, r, url) + '</div></div>';
  }
  function voucherHtml() {
    return '<div class="rrgf-v"><img src="' + esc(picture(VOUCHER_IMG)) + '" alt="" width="96" height="96" loading="lazy"><div class="rrgf-vt"><b>Ajándékutalvány, a biztos választás</b>' +
      '<span>Ő dönti el, mit szeretne. 1' + NB + '000' + NB + 'Ft-tól 100' + NB + '000' + NB + 'Ft-ig.</span></div><a class="rrgf-b" href="' + VOUCHER + '">Megnézem</a></div>';
  }
  function summary(q) {
    var band = q.zenekar ? bandBy[q.zenekar] : null, style = band ? band[0] : q.stilus === 'nemtudom' ? 'Bármilyen stílus' : find(STYLES, q.stilus)[1];
    var size = q.meret === 'nemtudom' ? 'Méret nélkül' : 'Méretet tudom';
    return [[1, find(WHO, q.kinek)[1]], [2, style], [3, find(BUDGETS, q.keret)[1]], [4, size]].map(function (c) {
      return '<button type="button" class="rrgf-chip" data-edit="' + c[0] + '" aria-label="' + esc(c[1]) + ', módosítás">' + esc(c[1]) + '</button>';
    }).join('');
  }
  function showResult(q, mine) {
    root.innerHTML = '<h2 class="rrgf-h" tabindex="-1">Ezeket ajánljuk</h2><div class="rrgf-chips">' + summary(q) + '</div><p class="rrgf-wait" role="status">Keressük a legjobbakat...</p>';
    pick(q, function (res) {
      if (mine !== ticket) { return; }
      var note = noteText(res);
      root.innerHTML = '<h2 class="rrgf-h" tabindex="-1">Ezeket ajánljuk</h2><div class="rrgf-chips">' + summary(q) + '</div>' +
        (note ? '<p class="rrgf-note" role="status">' + esc(note) + '</p>' : '') +
        '<div class="rrgf-g">' + res.cards.map(cardHtml).join('') + '</div>' + voucherHtml() +
        '<div class="rrgf-nav"><button type="button" class="rrgf-l" data-back="1">Vissza</button><button type="button" class="rrgf-l" data-restart="1">Újrakezdés</button><button type="button" class="rrgf-l" data-share="1">Link másolása</button></div>';
      root.setAttribute('data-rrgf', 'result' + location.search);
    }, function () {
      if (mine === ticket) { failed(); }
    });
  }
  function failed() {
    root.innerHTML = '<p class="rrgf-note" role="status">Most nem sikerült betölteni az ajánlatokat.</p><div class="rrgf-nav" style="margin:10px 0 16px"><button type="button" class="rrgf-l" data-retry="1">Újrapróbálom</button></div>' + voucherHtml();
    root.setAttribute('data-rrgf', 'error');
  }

  function render(moved) {
    var q = read(), step = stepOf(q), mine = ++ticket;
    root.removeAttribute('data-rrgf');
    if (step < 5) { root.innerHTML = stepHtml(step); root.setAttribute('data-rrgf', 'step' + step); } else { showResult(q, mine); }
    if (moved) {
      reveal(true);
      setTimeout(function () { reveal(false); }, 150);     /* the shop's header shrinks for a moment once the page has scrolled */
      setTimeout(function () { reveal(false); }, 450);
      var h = root.querySelector('.rrgf-h');
      if (h) { h.focus({ preventScroll: true }); }
    }
  }
  function pinnedBottom() {     /* where the header stuck to the top of the window ends */
    var bottom = 0;
    document.elementsFromPoint(innerWidth / 2, 2).forEach(function (e) {
      if (root.contains(e)) { return; }
      for (var n = e; n && n !== document.body; n = n.parentElement) {     /* the theme pins a wrapper around the header */
        var p = getComputedStyle(n).position;
        if (p === 'fixed' || p === 'sticky') { bottom = Math.max(bottom, e.getBoundingClientRect().bottom); return; }
      }
    });
    return Math.min(bottom, innerHeight * 0.4);
  }
  function reveal(far) {
    var y = root.getBoundingClientRect().top;
    cover = Math.max(cover, pinnedBottom());     /* the header grows back when scrolling up, so keep clear of its largest size */
    if (y < cover + 6 || (far && y > innerHeight * 0.45)) { window.scrollTo({ left: 0, top: Math.max(0, window.pageYOffset + y - cover - 14), behavior: 'instant' }); }
  }

  /* ---------- basket: same request and same events as the theme's own button, without its popup ---------- */
  function syncHeader(j) {
    var q = document.querySelector('#js-cart .header-quantity-box'), box = document.querySelector('#js-cart .js-cart-ajax');
    if ((!q || parseInt(q.textContent, 10) !== Number(j.countProducts)) && box && j.html) { box.outerHTML = j.html; }
    var m = document.querySelectorAll('.mobile-cart-product-count');
    for (var i = 0; i < m.length; i++) { m[i].innerHTML = j.countProducts; m[i].classList.remove('mobile-cart-empty'); }
  }
  function announce(j, id, name, price) {
    var line = (j.products || []).filter(function (p) { return String(p.productId) === String(id); })[0] || {};
    var item = { id: '[' + id + ']', sku: line.sku || '', price: price, quantityName: 'db', currency: 'HUF', quantity: 1, name: line.name || name, brand: '' };
    try { localStorage.setItem('cartModified', '1'); } catch (e) { /* private mode */ }
    document.dispatchEvent(new CustomEvent('cartChanged', { detail: { data: j, cartToken: j.cartToken || '', products: j.products } }));
    document.dispatchEvent(new CustomEvent('AddToCart', { detail: { cartToken: j.cartToken || '', product: item, addedItems: j.addedItems && j.addedItems.length ? j.addedItems : [item] } }));
    setTimeout(function () { syncHeader(j); }, 400);
  }
  function addToBasket(btn) {
    var id = btn.getAttribute('data-add'), card = btn.closest('.rrgf-c'), url = card.querySelector('.rrgf-i').getAttribute('href');
    btn.disabled = true; btn.textContent = 'Egy pillanat';
    var body = 'quantity=1&product_id=' + encodeURIComponent(id) + '&product_collaterals=&product_addons=&redirect=' + encodeURIComponent(location.href.split('#')[0]);
    fetch(ADD, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }, body: body })
      .then(function (r) { if (!r.ok) { throw new Error('add'); } return r.json(); })   /* read to the end: leaving earlier can lose the item */
      .then(function (j) {
        var inCart = (j.products || []).some(function (p) { return String(p.productId) === String(id); });
        if (!inCart) { throw new Error('not added'); }
        added[id] = 1;
        var slot = card.querySelector('.rrgf-a');
        slot.innerHTML = '<span class="rrgf-b ok" role="status">A kosárban</span><a class="rrgf-to" href="' + CART + '">Tovább a kosárhoz</a>';
        announce(j, id, card.querySelector('.rrgf-n').textContent, priceOf(card));
      })
      .catch(function () { location.href = url; });
  }
  function priceOf(card) { return Number((card.querySelector('.rrgf-p b').textContent || '').replace(/\D/g, '')) || 0; }

  function share(btn) {
    var url = location.href;
    function copied() { btn.textContent = 'Link másolva'; }
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { navigator.share({ title: 'Ajándékötletek', url: url }).catch(function () { /* closed */ }); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(copied).catch(function () { window.prompt('Link:', url); }); return; }
    window.prompt('Link:', url);
  }

  function onClick(e) {
    var t = e.target.closest('button');
    if (!t || !root.contains(t)) { return; }
    var q = read(), a;
    if ((a = t.getAttribute('data-kinek'))) { q.kinek = a; go(q); } else if ((a = t.getAttribute('data-stilus'))) { q.stilus = a; delete q.zenekar; go(q); } else if ((a = t.getAttribute('data-band'))) { q.zenekar = a; delete q.stilus; go(q); } else if ((a = t.getAttribute('data-keret'))) { q.keret = a; go(q); } else if ((a = t.getAttribute('data-meret'))) { q.meret = a; go(q); } else if (t.hasAttribute('data-back')) { go(clear(q, stepOf(q) - 1)); } else if (t.hasAttribute('data-restart')) { go({}); } else if ((a = t.getAttribute('data-edit'))) { go(clear(q, Number(a))); } else if (t.hasAttribute('data-add')) { addToBasket(t); } else if (t.hasAttribute('data-share')) { share(t); } else if (t.hasAttribute('data-retry')) { start(); }
  }
  function onKey(e) {
    if (e.target.id === 'rrgf-q' && e.key === 'Enter') {
      e.preventDefault();
      var hit = search(e.target.value)[0];
      if (hit) { var q = read(); q.zenekar = hit[1]; delete q.stilus; go(q); }
    }
  }

  function start() {
    fetch(BASE + 'gifts.json').then(function (r) { if (!r.ok) { throw new Error('data'); } return r.json(); }).then(function (d) {
      D = d; bandBy = {}; index = d.b.map(function (b) { var n = norm(b[0]); bandBy[b[1]] = b; return { b: b, n: n, c: n.replace(/ /g, '') }; });
      render(false);
    }).catch(failed);
  }
  function boot() {
    root = document.getElementById('rrgf-app');
    if (!root || window.__rrGf) { return; }
    window.__rrGf = true;
    root.classList.add('rrgf');
    var head = document.querySelector('.header');
    if (head) { cover = Math.max(0, Math.min(head.getBoundingClientRect().bottom, innerHeight * 0.4)); }
    if (!document.getElementById('rrgf-css')) { var st = document.createElement('style'); st.id = 'rrgf-css'; st.textContent = CSS; document.head.appendChild(st); }
    root.addEventListener('click', onClick);
    root.addEventListener('input', function (e) { if (e.target.id === 'rrgf-q') { suggest(); } });
    root.addEventListener('keydown', onKey);
    root.addEventListener('error', function (e) { if (e.target.tagName === 'IMG') { e.target.style.visibility = 'hidden'; } }, true);
    window.addEventListener('popstate', function () { if (D) { render(true); } });
    start();
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
