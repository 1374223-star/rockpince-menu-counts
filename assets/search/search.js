/* RagnaRock kereső és szűrő (owner 2026-11-18: "a better more complex search function with filters and knobs").
   Search page: replaces the shop's result list at once. Category and band pages: the shop's own list, pagination, headings
   and category text stay untouched until a shopper uses a filter; removing every filter brings them back.
   A Web Worker downloads, parses, filters and counts, the page only draws. If anything fails the normal shop page remains.
   Off switch: ?rrsx=0. No size filter (owner's decision). All class names start with rrsx-. */
(function () {
  'use strict';
  if (window.__rrsx) { return; }
  window.__rrsx = true;
  var PREVIEW = !!window.RRSX_PREVIEW;
  var params = new URLSearchParams(location.search);
  if (params.get('rrsx') === '0') { return; }
  if (!window.Worker || !window.fetch || !window.IntersectionObserver || !window.URLSearchParams) { return; }
  var bodyClass = document.body ? document.body.className : '';
  var CAT_PAGE = !PREVIEW && (/\bcategory-list-body\b/.test(bodyClass) || (params.get('route') === 'product/list' && !!params.get('category_id')));
  var SEARCH_PAGE = PREVIEW || (!CAT_PAGE && params.get('route') === 'product/list');
  if (!CAT_PAGE && !SEARCH_PAGE) { return; }

  var INDEX_URL = new URL(window.RRSX_INDEX || 'https://raw.githubusercontent.com/1374223-star/rockpince-menu-counts/search-index/search_index.json', location.href).href;
  var COUNTS_URL = window.RRSX_COUNTS || 'https://1374223-star.github.io/rockpince-menu-counts/category_counts.json';
  var SHOP = PREVIEW ? 'https://www.rockpince.hu/' : '/';
  var IMG = 'https://rockpince.cdn.shoprenter.hu/custom/rockpince/image/cache/w360h360q80/product/';
  var PAGE = 48, TIMEOUT = 15000, BUCKETS = 28, MOBILE = matchMedia('(max-width: 991px)');
  var SORTS = [['new', 'Elérhetőség, legújabb'], ['rel', 'Legjobb találat'], ['asc', 'Ár szerint növekvő'], ['desc', 'Ár szerint csökkenő'],
    ['off', 'Legnagyobb kedvezmény'], ['name', 'Név, A - Z']];
  var SWATCH = { 'Fekete': '#111', 'Fehér': '#fff', 'Szürke': '#8b9299', 'Piros': '#d3201c', 'Bordó': '#6d1424', 'Kék': '#1f5fbf', 'Zöld': '#2c8a3e', 'Lila': '#6f3aa8',
    'Sárga': '#f2c81e', 'Narancs': '#ee7b1a', 'Barna': '#6e4326', 'Bézs': '#d9c3a0', 'Rózsaszín': '#f28cb3',
    'Többszínű': 'conic-gradient(#d3201c,#f2c81e,#2c8a3e,#1f5fbf,#6f3aa8,#d3201c)' };
  var COLOUR_ORDER = Object.keys(SWATCH);
  var KIND_LABELS = ['Zenekar', 'Márka', 'Film, anime, játék'];

  /* ---------- the worker: downloads and parses the data, answers every query ---------- */
  function workerMain() {
    var FORMAT = 3, CACHE = 'rrsx-index-1', BUCKETS = 28, FRESH_DAYS = 30, EPOCH = Date.UTC(2020, 0, 1);
    var BIT = { T: 1, B: 2, G: 4, P: 8, S: 16, O: 32, N: 64 }, FACET_SHIFT = 7;
    var D = null, N = 0, built = '', builtDay = 0, opts = null, split = false, base = '';
    var title, slug, img, hay = null, vocab = null, shardDone = {}, shardWait = {}, allText = null, active = 0, waiting = [];
    var scope = null, scopeN = 0, baseKey = null, baseList = null, baseLo = 0, baseHi = 0, lastFixed = null, lastTs = [];
    var orders = {}, pass = null, latest = 0, cacheStore = null;

    function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[™®]/g, '').toLowerCase(); }
    function slugOf(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

    /* ----- browser cache keyed by build date; every step may fail and then the network answers ----- */
    function store() {
      if (cacheStore) { return cacheStore; }
      cacheStore = (self.caches ? self.caches.open(CACHE) : Promise.resolve(null)).catch(function () { return null; });
      return cacheStore;
    }
    function keyOf(stamp, name) { return 'https://rrsx.invalid/' + String(stamp).replace(/\W/g, '') + '/' + name; }
    function net(url, how) {
      return fetch(url, how || {}).then(function (r) { if (!r.ok) { throw new Error('http ' + r.status); } return r; });
    }
    function cachedJson(name, stamp, valid) {
      var key = keyOf(stamp, name), url = base + name;
      function fresh(c, how) {
        return net(url, how).then(function (r) {
          var copy = c ? r.clone() : null;
          return r.json().then(function (j) {
            if (!valid(j)) { throw new Error('stale ' + name); }
            if (c) { c.put(key, copy).catch(function () {}); }
            return j;
          });
        });
      }
      return store().then(function (c) {
        var hit = c ? c.match(key).catch(function () { return null; }) : Promise.resolve(null);
        return hit.then(function (r) {
          return r ? r.json().then(function (j) { if (!valid(j)) { throw new Error('bad'); } return j; }) : Promise.reject(new Error('miss'));
        }).catch(function () {
          return fresh(c).catch(function () { return fresh(c, { cache: 'reload' }); });   /* the CDN can lag behind the manifest for a few minutes */
        });
      });
    }
    function prune(stamp) {
      store().then(function (c) {
        if (!c) { return; }
        var mark = '/' + String(stamp).replace(/\W/g, '') + '/';
        c.keys().then(function (ks) { ks.forEach(function (k) { if (k.url.indexOf(mark) < 0 && k.url.indexOf('/latest/') < 0) { c.delete(k); } }); });
      }).catch(function () {});
    }

    /* ----- loading ----- */
    function undelta(list) { var o = new Int32Array(list.length), v = 0; for (var i = 0; i < list.length; i++) { v += list[i]; o[i] = v; } return o; }
    function setBuilt(b) { built = b; builtDay = Math.floor((Date.parse(b.slice(0, 10) + 'T00:00:00Z') - EPOCH) / 864e5); }
    function common(d) {
      D = { types: d.types, genders: d.genders, bands: d.bands, kinds: d.band_kinds || [], facets: d.facets || [], values: d.facet_values || [] };
      N = d.n !== undefined ? d.n : d.items.length;
      D.price = new Int32Array(N); D.sale = new Int32Array(N); D.now = new Int32Array(N); D.off = new Uint8Array(N); D.type = new Int16Array(N);
      D.band = new Int16Array(N); D.gender = new Int8Array(N); D.stock = new Uint8Array(N); D.days = new Uint16Array(N); D.id = new Int32Array(N);
      D.fOf = new Uint8Array(D.values.length); D.values.forEach(function (v, i) { D.fOf[i] = v[0]; });
      title = new Array(N); slug = new Array(N); img = new Array(N); pass = new Uint8Array(N);
    }
    function finish() {
      var hasDays = false, i;
      for (i = 0; i < N; i++) {
        var p = D.sale[i] || D.price[i]; D.now[i] = p;
        D.off[i] = D.sale[i] ? Math.round((1 - D.sale[i] / D.price[i]) * 100) : 0;
        if (D.days[i]) { hasDays = true; }
      }
      D.hasDays = hasDays;
    }
    function fromCore(c) {
      common(c); split = true;
      D.bandShard = c.band_shard; D.typeShard = c.type_shard; D.shards = c.shards;
      D.id = undelta(c.id);
      var days = undelta(c.days);
      for (var i = 0; i < N; i++) {
        D.price[i] = c.price[i]; D.sale[i] = c.sale[i]; D.type[i] = c.type[i]; D.band[i] = c.band[i];
        D.gender[i] = c.gender[i]; D.stock[i] = c.stock[i]; D.days[i] = days[i];
      }
      var counts = new Int32Array(N + 1), lists = c.value_pos.map(undelta), v, k;
      for (v = 0; v < lists.length; v++) { for (k = 0; k < lists[v].length; k++) { counts[lists[v][k] + 1]++; } }
      for (i = 0; i < N; i++) { counts[i + 1] += counts[i]; }
      var at = counts.slice(), vals = new Uint16Array(counts[N]);
      for (v = 0; v < lists.length; v++) { for (k = 0; k < lists[v].length; k++) { vals[at[lists[v][k]]++] = v; } }
      D.vOff = counts; D.vals = vals;
      D.catPos = c.cat_pos; D.tree = c.cat_tree || []; D.paths = c.cat_paths || {};
      finish();
    }
    function fromFull(d) {
      common(d); split = false; D.catPos = {};
      var counts = new Int32Array(N + 1), i, k, x, vals = [];
      for (i = 0; i < N; i++) {
        x = d.items[i];
        D.id[i] = x[0]; title[i] = x[1]; D.price[i] = x[2]; D.sale[i] = x[3]; D.type[i] = x[4]; D.band[i] = x[5]; D.gender[i] = x[6];
        D.stock[i] = x[7]; slug[i] = x[8]; img[i] = x[9]; D.days[i] = x[12] || 0;
        var fv = x[10] || [], cs = x[11] || [];
        counts[i + 1] = counts[i] + fv.length;
        for (k = 0; k < fv.length; k++) { vals.push(fv[k]); }
        for (k = 0; k < cs.length; k++) { (D.catPos[cs[k]] = D.catPos[cs[k]] || []).push(i); }
      }
      D.vOff = counts; D.vals = Uint16Array.from(vals); D.tree = []; D.paths = {}; D.rawCats = true;
      finish();
      allText = Promise.resolve();
    }
    function tooOld(b) { return Date.now() - Date.parse(b) > 5 * 864e5; }    /* old data could show old prices: then the shop's own page stays */
    function stale() { postMessage({ failed: 'catalogue too old', fatal: 1 }); return new Promise(function () {}); }
    function loadSplit() {
      return net(base + 'search_manifest.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (m) {
        if (m.off) { postMessage({ failed: 'switched off', fatal: 1 }); return new Promise(function () {}); }   /* remote off switch: the shop page stays as it is */
        if (m.v !== FORMAT || !m.built) { throw new Error('format'); }
        if (tooOld(m.built)) { return stale(); }
        return cachedJson('search_core.json', m.built, function (j) { return j.v === FORMAT && j.built === m.built; }).then(function (c) {
          setBuilt(m.built); fromCore(c); prune(m.built);
        });
      });
    }
    function loadFull() {
      var name = opts.url.slice(base.length);
      return cachedJson(name, 'latest', function (j) {
        return j.items && j.v === 2 && (Date.now() - Date.parse(j.built)) < 12 * 36e5;   /* no manifest to compare: accept only a recent copy */
      }).catch(function () {
        return net(opts.url, { cache: 'no-cache' }).then(function (r) { return r.json(); });
      }).then(function (j) { if (tooOld(j.built)) { return stale(); } setBuilt(j.built); fromFull(j); });
    }
    function loadTree() {
      if (D.tree.length || !opts.counts || (opts.cat === null && !opts.path)) { return Promise.resolve(); }
      return net(opts.counts).then(function (r) { return r.json(); }).then(function (j) {
        var cs = j.counts || {};
        Object.keys(cs).forEach(function (id) {
          var row = cs[id];
          D.tree.push([+id, +row[2] || 0]);
          if (row[3] && !/-\d+\/?$/.test(row[3])) { D.paths[String(row[3]).replace(/\/$/, '')] = +id; }
        });
      }).catch(function () {});
    }
    function positions(cid) {
      var p = D.catPos[cid];
      if (!p) { return null; }
      return D.rawCats ? p : undelta(p);
    }
    function setScope() {
      scope = null; scopeN = 0;
      if (opts.cat === null && !opts.path) { return; }
      var cid = opts.cat || D.paths[String(opts.path).replace(/\/$/, '')];
      if (!cid) { return; }
      var kids = {}, seen = {}, todo = [cid], i, k;
      D.tree.forEach(function (e) { (kids[e[1]] = kids[e[1]] || []).push(e[0]); });
      scope = new Uint8Array(N);
      while (todo.length) {
        var c = todo.pop();
        if (seen[c]) { continue; }
        seen[c] = 1;
        var p = positions(c);
        if (p) { for (i = 0; i < p.length; i++) { scope[p[i]] = 1; } }
        (kids[c] || []).forEach(function (x) { todo.push(x); });
      }
      for (k = 0; k < N; k++) { scopeN += scope[k]; }
    }
    function load() {
      return (opts.noSplit ? Promise.reject(new Error('off')) : loadSplit()).catch(loadFull).then(loadTree).then(function () {
        setScope();
        var lo = 1e9, hi = 0;
        for (var i = 0; i < N; i++) { if (!scope || scope[i]) { var p = D.now[i]; if (p < lo) { lo = p; } if (p > hi) { hi = p; } } }
        postMessage({ ready: 1, types: D.types, genders: D.genders, bands: D.bands, kinds: D.kinds, facets: D.facets, values: D.values, hasDays: D.hasDays,
          lo: lo, hi: hi, total: N, built: built, split: split, scoped: !!scope, scopeN: scopeN });
      });
    }

    /* ----- text shards: titles, links, photos ----- */
    function shardOf(i) { return D.band[i] >= 0 ? D.bandShard[D.band[i]] : D.typeShard[D.type[i] + 1]; }
    function pump() {
      while (active < 4 && waiting.length) { waiting.shift()(); }
    }
    function shard(s) {
      if (shardDone[s]) { return Promise.resolve(); }
      if (shardWait[s]) { return shardWait[s]; }
      var name = 'search_text_' + (s < 10 ? '0' : '') + s + '.json';
      shardWait[s] = new Promise(function (ok, no) {
        waiting.push(function () {
          active++;
          cachedJson(name, built, function (j) { return j.v === FORMAT && j.built === built; }).then(function (j) {
            var pos = undelta(j.p), r = j.r;
            for (var i = 0; i < pos.length; i++) { var p = pos[i]; title[p] = r[i * 3]; slug[p] = r[i * 3 + 1] || slugOf(r[i * 3]); img[p] = r[i * 3 + 2]; }
            shardDone[s] = 1; active--; pump(); ok();
          }).catch(function (e) { active--; delete shardWait[s]; pump(); no(e); });
        });
        pump();
      });
      return shardWait[s];
    }
    function everyShard() {
      if (!allText) {
        var all = []; for (var s = 0; s < D.shards; s++) { all.push(shard(s)); }
        allText = Promise.all(all);
        allText.catch(function () { allText = null; });
      }
      return allText;
    }

    /* ----- text search ----- */
    function buildHay() {
      if (hay) { return; }
      var tw = D.types.map(function (t) { return norm(t[0] + ' ' + t[2]).replace(/,/g, ' '); });
      var bw = D.bands.map(function (b) { var n = norm(b); return n + ' ' + n.replace(/[^a-z0-9]/g, ''); });
      var gw = D.genders.map(function (g) { return norm(g).replace('/', ' '); });
      var vw = D.values.map(function (v) { return norm(v[1]); });
      hay = new Array(N);
      for (var i = 0; i < N; i++) {
        var extra = '';
        for (var k = D.vOff[i]; k < D.vOff[i + 1]; k++) { extra += vw[D.vals[k]] + ' '; }
        hay[i] = ' ' + norm(title[i]) + ' ' + (D.type[i] >= 0 ? tw[D.type[i]] : '') + ' ' + (D.band[i] >= 0 ? bw[D.band[i]] : '') + ' ' + (D.gender[i] >= 0 ? gw[D.gender[i]] : '') + ' ' + extra;
      }
    }
    function tokens(s) { return norm(s).split(/[\s,;]+/).map(function (t) { return t.replace(/^[^a-z0-9]+|[^a-z0-9+#]+$/g, ''); }).filter(Boolean); }
    function test(h, t) { return t.length < 3 ? h.indexOf(' ' + t) >= 0 : h.indexOf(t) >= 0; }
    function buildVocab() {
      vocab = new Map();
      for (var i = 0; i < N; i++) { hay[i].split(/[^a-z0-9]+/).forEach(function (w) { if (w.length > 2) { vocab.set(w, (vocab.get(w) || 0) + 1); } }); }
    }
    function close(a, b, max) {   /* edit distance with swaps, stops early */
      var la = a.length, lb = b.length;
      if (Math.abs(la - lb) > max) { return false; }
      var p2 = null, p = [], i, j;
      for (j = 0; j <= lb; j++) { p[j] = j; }
      for (i = 1; i <= la; i++) {
        var c = [i], best = i;
        for (j = 1; j <= lb; j++) {
          var v = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
          if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) { v = Math.min(v, p2[j - 2] + 1); }
          c[j] = v; if (v < best) { best = v; }
        }
        if (best > max) { return false; }
        p2 = p; p = c;
      }
      return p[lb] <= max;
    }
    function fix(t) {   /* a word nothing contains: plural ending first, then the closest common word */
      var stem = t.replace(/(ok|ek|ak|ök|k)$/, '');
      if (stem.length >= 3 && stem !== t) { for (var i = 0; i < N; i++) { if (hay[i].indexOf(stem) >= 0) { return stem; } } }
      if (t.length < 4) { return null; }
      if (!vocab) { buildVocab(); }
      var max = t.length >= 7 ? 2 : 1, best = null, n = 0;
      vocab.forEach(function (c, w) { if (c > n && w[0] === t[0] && close(t, w, max)) { best = w; n = c; } });
      if (!best) { vocab.forEach(function (c, w) { if (c > n && close(t, w, max)) { best = w; n = c; } }); }
      return best;
    }
    function getBase(text) {
      if (baseKey === text && baseList) { return baseList; }
      var ts = tokens(text), fixed = null, out = new Int32Array(N), n = 0, i, k;
      if (ts.length) {
        buildHay();
        var bad = ts.filter(function (t) { for (var j = 0; j < N; j++) { if (test(hay[j], t)) { return false; } } return true; });
        if (bad.length) { ts = ts.map(function (t) { if (bad.indexOf(t) < 0) { return t; } var f = fix(t); if (f) { fixed = fixed || {}; fixed[t] = f; return f; } return t; }); }
      }
      var lo = 1e9, hi = 0;
      for (i = 0; i < N; i++) {
        if (scope && !scope[i]) { continue; }
        var ok = 1;
        if (ts.length) { var h = hay[i]; for (k = 0; k < ts.length; k++) { if (!test(h, ts[k])) { ok = 0; break; } } }
        if (ok) { out[n++] = i; var p = D.now[i]; if (p < lo) { lo = p; } if (p > hi) { hi = p; } }
      }
      baseKey = text; baseList = out.subarray(0, n); baseLo = n ? lo : 0; baseHi = hi; lastFixed = fixed; lastTs = ts;
      return baseList;
    }
    function score(i, ts, whole) {
      var t = ' ' + norm(title[i]) + ' ', s = 0, b = D.band[i], y = D.type[i];
      if (b >= 0 && norm(D.bands[b]) === whole) { s += 60; }
      if (t.indexOf(' ' + whole + ' ') === 1) { s += 30; } else if (t.indexOf(' ' + whole + ' ') > 0) { s += 16; }
      ts.forEach(function (w) { if (t.indexOf(' ' + w + ' ') >= 0) { s += 8; } else if (t.indexOf(' ' + w) >= 0) { s += 4; } });
      if (y >= 0 && norm(D.types[y][0]).indexOf(whole) === 0) { s += 12; }
      return s + (D.stock[i] ? 3 : 0);
    }
    function order(kind) {
      if (orders[kind]) { return orders[kind]; }
      var o = new Int32Array(N), i, p = D.now, f = D.off;
      for (i = 0; i < N; i++) { o[i] = i; }
      if (kind === 'asc') { o.sort(function (a, b) { return p[a] - p[b] || a - b; }); }
      else if (kind === 'desc') { o.sort(function (a, b) { return p[b] - p[a] || a - b; }); }
      else if (kind === 'off') { o.sort(function (a, b) { return f[b] - f[a] || a - b; }); }
      else if (kind === 'name') { var c = new Intl.Collator('hu'); o.sort(function (a, b) { return c.compare(title[a], title[b]) || a - b; }); }
      orders[kind] = o;
      return o;
    }

    /* ----- one query: every group's counts ignore that group's own selection ----- */
    function picks(list, q, total) {
      var out = [], from = q.from, end = from + q.size, seen = 0, rounds = q.gone ? [1, 0] : [1], r, i, p;
      if (!q.size) { return out; }
      for (r = 0; r < rounds.length && seen < end && seen < total; r++) {
        for (i = 0; i < list.length && seen < end; i++) {
          p = list[i];
          if (!pass[p] || D.stock[p] !== rounds[r]) { continue; }
          if (seen >= from) { out.push(p); }
          seen++;
        }
      }
      return out;
    }
    function relevance(list, q) {
      var ts = lastTs, whole = ts.join(' '), hits = [], i;
      for (i = 0; i < list.length; i++) { if (pass[list[i]]) { hits.push(list[i]); } }
      var sc = new Map();
      hits.forEach(function (p) { sc.set(p, score(p, ts, whole)); });
      hits.sort(function (a, b) { return (q.gone ? D.stock[b] - D.stock[a] : 0) || sc.get(b) - sc.get(a) || a - b; });
      return hits.slice(q.from, q.from + q.size);
    }
    function card(p) {
      return [D.id[p], title[p], D.price[p], D.sale[p], D.stock[p], slug[p], img[p], D.days[p] && D.days[p] >= builtDay - FRESH_DAYS ? 1 : 0];
    }
    function run(q) {
      var t0 = performance.now(), list = getBase(q.text || ''), nT = D.types.length + 1, nB = D.bands.length + 1, nG = D.genders.length + 1, nV = D.values.length, nF = D.facets.length;
      var cT = new Int32Array(nT), cB = new Int32Array(nB), cG = new Int32Array(nG), cV = new Int32Array(nV), cover = new Int32Array(nF);
      var relax = new Int32Array(FACET_SHIFT + nF), hist = new Int32Array(BUCKETS), sale = 0, gone = 0, fresh = 0, total = 0, sMin = 1e9, sMax = 0;
      var sT = null, sB = null, sG = null, sV = null, need = 0, i;
      function pick(a, n, off) { var s = new Uint8Array(n); a.forEach(function (v) { s[v + off] = 1; }); return s; }
      if (q.types.length) { sT = pick(q.types, nT, 1); }
      if (q.bands.length) { sB = pick(q.bands, nB, 1); }
      if (q.genders.length) { sG = pick(q.genders, nG, 1); }
      if (q.vals.length) { sV = pick(q.vals, nV, 0); q.vals.forEach(function (v) { need |= (1 << (FACET_SHIFT + D.fOf[v])); }); }
      var min = q.min || 0, max = q.max || 1e12;
      if (q.max && min > max) { var sw = min; min = max; max = sw; }
      var freshFrom = D.hasDays ? builtDay - FRESH_DAYS : 1e9, span = Math.log((baseHi || 1) / (baseLo || 1)) || 1, lo = baseLo || 1;
      var type = D.type, band = D.band, gender = D.gender, now = D.now, sl = D.sale, stock = D.stock, days = D.days, vOff = D.vOff, vals = D.vals, fOf = D.fOf;
      pass.fill(0);
      for (var n = 0; n < list.length; n++) {
        i = list[n];
        var fail = 0, a = vOff[i], b = vOff[i + 1], v, k, p = now[i];
        if (sT && !sT[type[i] + 1]) { fail |= 1; }
        if (sB && !sB[band[i] + 1]) { fail |= 2; }
        if (sG && !sG[gender[i] + 1]) { fail |= 4; }
        if (p < min || p > max) { fail |= 8; }
        if (q.sale && !sl[i]) { fail |= 16; }
        if (!q.gone && !stock[i]) { fail |= 32; }
        var isNew = days[i] >= freshFrom && days[i] > 0;
        if (q.fresh && !isNew) { fail |= 64; }
        if (need) {
          var got = 0;
          for (k = a; k < b; k++) { v = vals[k]; if (sV[v]) { got |= 1 << (FACET_SHIFT + fOf[v]); } }
          fail |= need & ~got;
        }
        if (fail & (fail - 1)) { continue; }      /* fails two groups: it counts nowhere */
        if (fail) { relax[31 - Math.clz32(fail)]++; }
        if (!fail || fail === 1) { cT[type[i] + 1]++; }
        if (!fail || fail === 2) { cB[band[i] + 1]++; }
        if (!fail || fail === 4) { cG[gender[i] + 1]++; }
        if (!fail || fail === 8) {
          var h = Math.floor(Math.log(p / lo) / span * BUCKETS); hist[h >= BUCKETS ? BUCKETS - 1 : h < 0 ? 0 : h]++;
          if (p < sMin) { sMin = p; } if (p > sMax) { sMax = p; }
        }
        if (sl[i] && (!fail || fail === 16)) { sale++; }
        if (!stock[i] && (!fail || fail === 32)) { gone++; }
        if (isNew && (!fail || fail === 64)) { fresh++; }
        if (b > a) {
          var mask = 0;
          for (k = a; k < b; k++) {
            v = vals[k];
            var bit = 1 << (FACET_SHIFT + fOf[v]);
            if (!fail || fail === bit) { cV[v]++; if (!(mask & bit)) { mask |= bit; cover[fOf[v]]++; } }
          }
        }
        if (!fail) { pass[i] = 1; total++; }
      }
      var sort = q.sort, chosen;
      if (sort === 'rel' && lastTs.length) { chosen = relevance(list, q); }
      else { chosen = picks(sort === 'new' || sort === 'rel' ? list : order(sort), q, total); }
      var msg = { id: q.id, add: q.add, from: q.from, total: total, fixed: lastFixed, lo: baseLo, hi: baseHi, cT: cT, cB: cB, cG: cG, cV: cV, cover: cover, relax: relax,
        hist: hist, sale: sale, gone: gone, fresh: fresh, sMin: total || sMax ? sMin : 0, sMax: sMax, ms: Math.round((performance.now() - t0) * 10) / 10 };
      var missing = {}, miss = false;
      chosen.forEach(function (p) { if (title[p] === undefined) { missing[shardOf(p)] = 1; miss = true; } });
      if (!miss) { msg.items = chosen.map(card); postMessage(msg); return; }
      msg.items = null; msg.wait = chosen.length;
      postMessage(msg);
      Promise.all(Object.keys(missing).map(function (s) { return shard(+s); })).then(function () {
        if (q.id === latest) { postMessage({ id: q.id, fill: 1, add: q.add, items: chosen.map(card) }); }
      }).catch(function (e) { postMessage({ failed: String(e), id: q.id }); });
    }
    function query(q) {
      latest = q.id;
      var needAll = split && (q.text || q.sort === 'name');
      if (!needAll) { run(q); return; }
      everyShard().then(function () { if (q.id === latest) { run(q); } }).catch(function (e) { postMessage({ failed: String(e), id: q.id }); });
    }
    onmessage = function (e) {
      var m = e.data;
      if (m.load) {
        opts = m.load; base = opts.url.slice(0, opts.url.lastIndexOf('/') + 1);
        load().catch(function (err) { postMessage({ failed: String(err), fatal: 1 }); });
        return;
      }
      try { query(m); } catch (err) { postMessage({ failed: String(err), id: m.id }); }
    };
  }

  /* ---------- styles ---------- */
  var CSS = [
    'html.rrsx-on .main-content>:not(#rrsx-root){display:none!important}html.rrsx-on #fb_header_box,html.rrsx-on #fb_content_box{display:none!important}',
    'html.rrsx-eng .column-right>.page-body{display:none!important}html.rrsx-eng .column-left>:not(#rrsx-dock){visibility:hidden!important}',
    '.rrsx-covered{visibility:hidden!important}',
    '.rrsx-ui{--line:rgba(127,196,234,.28);--panel:#072338;--deep:#04192b;--ice:#9fd6f7;--txt:#e6f3fb;--mut:#a9c2d4;--red:#e52421;color:var(--txt);font-family:Poppins,Arial,sans-serif;font-size:14px;line-height:1.4}',
    '.rrsx-ui,.rrsx-ui *,.rrsx-ui *:before,.rrsx-ui *:after{box-sizing:border-box}',
    '.rrsx-ui button,.rrsx-ui input,.rrsx-ui select{font:inherit;color:inherit}',
    '.rrsx-ui :focus-visible{outline:2px solid #fff!important;outline-offset:1px}',
    '#rrsx-root.rrsx-full{max-width:1500px;margin:0 auto;padding:18px 16px 40px}',
    '#rrsx-root.rrsx-incat{display:none;padding:0 0 30px}html.rrsx-eng #rrsx-root.rrsx-incat{display:block}',
    '.rrsx-h1{margin:0 0 12px;font-size:34px;line-height:1.15;font-weight:800;color:#fff}',
    '.rrsx-box{position:relative;margin-bottom:14px}',
    '.rrsx-q{width:100%;height:54px;padding:0 48px 0 18px;background:var(--deep);border:1px solid var(--ice);border-radius:6px;font-size:17px!important;color:#fff!important;outline:0}',
    '.rrsx-q:focus{box-shadow:0 0 0 3px rgba(127,196,234,.3)}.rrsx-q::placeholder{color:#8fabbf}',
    '.rrsx-x{position:absolute;right:6px;top:7px;width:40px;height:40px;background:none;border:0;cursor:pointer;font-size:22px!important;color:var(--mut)!important}',
    '.rrsx-wrap{display:grid;grid-template-columns:272px minmax(0,1fr);gap:22px;align-items:start}',
    '@media(min-width:992px){html:has(.rrsx-side) #fb_header_box{transform:translateX(calc(100vw - 275px))}html:has(.rrsx-side) #fb_content_box{transform:translateX(calc(100vw - 375px))}}',   /* the consumer badge moves to the other corner, off the filter */
    '.rrsx-side{background:var(--panel);border:1px solid var(--line);border-radius:8px;scrollbar-width:thin;overflow:auto;overscroll-behavior:contain}',
    '.rrsx-wrap .rrsx-side{position:sticky;top:calc(var(--rrsx-top,0px) + 12px);max-height:calc(100vh - var(--rrsx-top,0px) - 24px)}',
    '#rrsx-dock{position:sticky;top:calc(var(--rrsx-top,0px) - 8px);margin:0 10px;height:0;z-index:6}#rrsx-dock .rrsx-side{margin-top:20px}html.rrsx-dockon .column-left>:not(#rrsx-dock){visibility:hidden!important}',
    '#rrsx-dock .rrsx-side{max-height:calc(100vh - var(--rrsx-top,0px) - 24px)}',
    '.rrsx-sw span{white-space:nowrap}.rrsx-row[disabled],.rrsx-col[disabled],.rrsx-chip[disabled],.rrsx-sw[disabled]{opacity:.38;cursor:default}.rrsx-row[disabled]:hover,.rrsx-col[disabled]:hover{background:none}',
    '.rrsx-side-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:14px 15px 12px;border-bottom:1px solid var(--line)}',
    '.rrsx-side-h h2{margin:0;font-size:17px;line-height:1.2;font-weight:800;color:#fff;text-transform:uppercase;white-space:nowrap}.rrsx-sc{font-size:12px;color:var(--mut);white-space:nowrap}',
    '.rrsx-close{display:none;width:44px;height:44px;margin:-8px -8px -8px 0;background:none;border:0;font-size:28px!important;line-height:1;cursor:pointer}',
    '.rrsx-wait{padding:26px 15px;color:var(--mut);text-align:center}',
    '.rrsx-f{border-bottom:1px solid var(--line)}.rrsx-f:last-child{border-bottom:0}.rrsx-f[hidden]{display:none}',
    '.rrsx-f>summary{display:flex;align-items:center;gap:8px;min-height:44px;padding:8px 15px;cursor:pointer;list-style:none;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#fff}',
    '.rrsx-f>summary::-webkit-details-marker{display:none}.rrsx-f>summary h3{flex:1;margin:0;font:inherit;letter-spacing:inherit;color:inherit}',
    '.rrsx-f>summary:after{content:"";width:7px;height:7px;margin-right:3px;border:solid var(--ice);border-width:0 2px 2px 0;transform:rotate(45deg)}.rrsx-f[open]>summary:after{transform:rotate(225deg)}',
    '.rrsx-fn{min-width:20px;padding:0 6px;border-radius:10px;background:var(--red);font-size:12px;line-height:20px;text-align:center;letter-spacing:0;color:#fff}.rrsx-fn:empty{display:none}',
    '.rrsx-fb{padding:0 15px 13px}',
    '.rrsx-row{display:flex;align-items:center;gap:8px;width:100%;min-height:32px;padding:3px 2px;background:none;border:0;cursor:pointer;text-align:left;border-radius:4px}',
    '.rrsx-row:hover{background:rgba(127,196,234,.1)}.rrsx-row i{flex:none;width:17px;height:17px;border:1px solid #7fa3bb;border-radius:3px;background:var(--deep);position:relative}',
    '.rrsx-row.on i{background:var(--red);border-color:var(--red)}.rrsx-row.on i:after{content:"";position:absolute;left:5px;top:1px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}',
    '.rrsx-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rrsx-row b{flex:none;font-weight:400;font-size:12px;color:var(--mut)}',
    '.rrsx-g{margin:0 0 3px}.rrsx-g summary{display:flex;justify-content:space-between;align-items:center;min-height:32px;padding:4px 2px;cursor:pointer;color:var(--ice);font-weight:600;list-style:none}.rrsx-g summary::-webkit-details-marker{display:none}',
    '.rrsx-g summary span{flex:1}.rrsx-g summary b{font-weight:400;font-size:12px;color:var(--mut)}',
    '.rrsx-find{width:100%;height:38px;margin-bottom:6px;padding:0 10px;background:var(--deep);border:1px solid var(--line);border-radius:4px;color:#fff!important}.rrsx-find::placeholder{color:#8fabbf}',
    '.rrsx-more{min-height:32px;margin-top:2px;padding:4px 2px;background:none;border:0;color:var(--ice)!important;cursor:pointer;text-decoration:underline}.rrsx-mt{color:var(--mut);padding:4px 2px}',
    '.rrsx-chips{display:flex;flex-wrap:wrap;gap:6px}.rrsx-chip{min-height:36px;padding:6px 12px;background:var(--deep);border:1px solid var(--line);border-radius:18px;cursor:pointer}',
    '.rrsx-chip.on{background:var(--red);border-color:var(--red);color:#fff!important}.rrsx-chip small{opacity:.8;font-size:11px;margin-left:4px}',
    '.rrsx-cols{display:flex;flex-wrap:wrap;gap:2px 6px}.rrsx-col{display:flex;align-items:center;gap:6px;flex:0 0 auto;max-width:100%;min-height:34px;padding:3px;background:none;border:0;border-radius:5px;cursor:pointer;text-align:left}',
    '.rrsx-col:hover{background:rgba(127,196,234,.1)}.rrsx-col i{flex:none;width:22px;height:22px;border-radius:50%;border:1px solid rgba(255,255,255,.55)}.rrsx-col.on i{box-shadow:0 0 0 2px var(--panel),0 0 0 4px var(--red)}',
    '.rrsx-col span{white-space:nowrap}.rrsx-col b{min-width:27px;font-weight:400;font-size:11px;color:var(--mut)}',
    '.rrsx-hist{display:flex;align-items:flex-end;gap:1px;height:44px;margin-bottom:-1px}.rrsx-hist u{flex:1;min-height:0;background:#2f6488;text-decoration:none}.rrsx-hist u.in{background:var(--ice)}',
    '.rrsx-range{position:relative;height:30px}.rrsx-range:before{content:"";position:absolute;left:0;right:0;top:13px;height:3px;background:#2f6488}',
    '.rrsx-range input{position:absolute;left:0;top:0;width:100%;height:30px;margin:0;background:none;pointer-events:none;-webkit-appearance:none;appearance:none}',
    '.rrsx-range input::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:24px;height:24px;border-radius:50%;background:#fff;border:3px solid var(--red);cursor:pointer}',
    '.rrsx-range input::-moz-range-thumb{pointer-events:auto;width:18px;height:18px;border-radius:50%;background:#fff;border:3px solid var(--red);cursor:pointer}',
    '.rrsx-pr{display:flex;align-items:center;gap:6px;margin-top:6px}.rrsx-pr input{width:0;flex:1;height:38px;padding:0 8px;background:var(--deep);border:1px solid var(--line);border-radius:4px;color:#fff!important;-moz-appearance:textfield}',
    '.rrsx-pr input::-webkit-inner-spin-button{display:none}.rrsx-pr input::placeholder{color:#8fabbf}',
    '.rrsx-sw{display:flex;align-items:center;gap:10px;width:100%;min-height:38px;padding:4px 0;background:none;border:0;cursor:pointer;text-align:left}.rrsx-sw[hidden]{display:none}',
    '.rrsx-sw span{flex:1}.rrsx-sw b{font-weight:400;font-size:12px;color:var(--mut)}.rrsx-sw i{flex:none;width:38px;height:22px;border-radius:11px;background:#3a5a71;position:relative}',
    '.rrsx-sw i:after{content:"";position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff}.rrsx-sw.on i{background:var(--red)}.rrsx-sw.on i:after{left:18px}',
    '.rrsx-tog{padding:8px 15px;border-bottom:1px solid var(--line)}',
    '.rrsx-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.rrsx-n{flex:1;min-width:120px;font-size:16px;font-weight:700;color:#fff}',
    '.rrsx-open{display:none;height:42px;padding:0 14px;background:var(--red);border:0;border-radius:5px;font-weight:700;color:#fff!important;cursor:pointer}',
    '.rrsx-sort{display:flex;align-items:center;gap:8px}.rrsx-sort select{height:42px;max-width:230px;padding:0 8px;background:var(--deep);border:1px solid var(--line);border-radius:5px;color:#fff!important}',
    '.rrsx-sort option{background:var(--deep);color:#fff}.rrsx-dens{display:flex;border:1px solid var(--line);border-radius:5px;overflow:hidden}',
    '.rrsx-dens button{display:flex;align-items:center;justify-content:center;width:42px;height:40px;background:var(--deep);border:0;cursor:pointer;color:var(--mut)!important}.rrsx-dens button[aria-pressed=true]{background:#0e4d78;color:#fff!important}',
    '.rrsx-dens svg{width:18px;height:18px;fill:currentColor}',
    '.rrsx-act{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}.rrsx-act:empty{display:none}',
    '.rrsx-tag{display:inline-flex;align-items:center;gap:6px;max-width:100%;min-height:32px;padding:5px 10px;background:#0e4d78;border:0;border-radius:16px;color:#fff!important;cursor:pointer;font-size:13px!important}',
    '.rrsx-tag:after{content:"\\00d7";font-size:16px;line-height:1}.rrsx-tag.clr{background:none;text-decoration:underline;color:var(--ice)!important}.rrsx-tag.clr:after{content:""}',
    '.rrsx-note{margin:0 0 12px;color:var(--ice)}.rrsx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(186px,1fr));gap:12px}.rrsx-grid.rrsx-dense{grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:8px}',
    '.rrsx-dense .rrsx-t{font-size:12px;-webkit-line-clamp:2}.rrsx-dense .rrsx-p{font-size:14px}.rrsx-dense .rrsx-b{padding:7px}',
    '.rrsx-card{display:flex;flex-direction:column;position:relative;background:#fff;color:#141414!important;text-decoration:none!important;border-radius:3px;overflow:hidden;content-visibility:auto;contain-intrinsic-size:auto 320px}',
    '.rrsx-card:hover .rrsx-t{text-decoration:underline}.rrsx-img{display:block;width:100%;aspect-ratio:1;object-fit:contain;background:#fff}',
    '.rrsx-b{display:flex;flex:1;flex-direction:column;gap:6px;padding:9px 10px 11px}.rrsx-t{flex:1;font-size:13px;font-weight:600;line-height:1.3;color:#141414;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
    '.rrsx-p{font-size:16px;font-weight:800;color:#141414}.rrsx-p.sale{color:#c91c18}.rrsx-p s{margin-left:6px;font-size:12px;font-weight:500;color:#5f6871}',
    '.rrsx-badge{position:absolute;left:0;top:8px;padding:3px 8px;background:#e52421;color:#fff;font-size:12px;font-weight:700}.rrsx-badge.out{background:#333}.rrsx-badge.new{background:#0b3350}',
    '.rrsx-card.out .rrsx-img{opacity:.45}.rrsx-end{height:1px}.rrsx-load{display:block;margin:18px auto 0;padding:12px 26px;background:#0e4d78;border:0;border-radius:5px;font-weight:700;color:#fff!important;cursor:pointer}',
    '.rrsx-none{padding:30px 18px;background:var(--panel);border:1px solid var(--line);border-radius:8px;text-align:center}.rrsx-none h2{margin:0 0 8px;font-size:21px;color:#fff}.rrsx-none a{color:var(--ice)}',
    '.rrsx-sug{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:12px 0}.rrsx-sug button{min-height:40px;padding:7px 14px;background:#0e4d78;border:0;border-radius:5px;color:#fff!important;cursor:pointer}',
    '.rrsx-sk{aspect-ratio:3/4;background:rgba(127,196,234,.08);border-radius:3px}.rrsx-foot,.rrsx-shade{display:none}',
    '#rrsx-pill{display:none}',
    '@media (max-width:991px){#rrsx-root.rrsx-full{padding:12px 10px 90px}#rrsx-root.rrsx-incat{padding-bottom:70px}.rrsx-h1{display:none}.rrsx-q{height:48px;font-size:16px!important}.rrsx-x{top:4px}',
    '.rrsx-wrap{display:block}.rrsx-open{display:block}#rrsx-dock{display:none}',
    '.rrsx-bar{position:sticky;top:var(--rrsx-top,0px);z-index:20;margin:0 -10px 10px;padding:8px 10px;background:var(--deep);border-bottom:1px solid var(--line)}.rrsx-incat .rrsx-bar{margin:0 0 10px}',
    '.rrsx-n{order:3;flex-basis:100%;font-size:14px}.rrsx-sort{flex:1;justify-content:flex-end;min-width:0}.rrsx-sort label{display:none}.rrsx-sort select{width:100%;max-width:none}',
    '.rrsx-dens button{width:40px}.rrsx-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.rrsx-grid.rrsx-dense{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}',
    '.rrsx-side{display:none;position:fixed;left:0;right:0;bottom:0;top:auto;z-index:2147483000;max-height:88vh;max-height:88dvh;border:0;border-radius:14px 14px 0 0;padding-bottom:74px}',
    'html.rrsx-sheet .rrsx-side{display:block}html.rrsx-sheet,html.rrsx-sheet body{overflow:hidden!important}',
    '.rrsx-shade{position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147482999;background:rgba(0,8,16,.62)}html.rrsx-sheet .rrsx-shade{display:block}',
    '.rrsx-side-h{position:sticky;top:0;z-index:2;align-items:center;background:var(--panel)}.rrsx-close{display:block}.rrsx-sc{flex:1}.rrsx-row{min-height:42px}.rrsx-col{min-height:42px}',
    '.rrsx-foot{position:fixed;left:0;right:0;bottom:0;z-index:2147483001;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:var(--panel);border-top:1px solid var(--line)}',
    'html.rrsx-sheet .rrsx-foot{display:block}html.rrsx-sheet .rr-bottomnav,html.rrsx-sheet #fb_header_box,html.rrsx-sheet #fb_content_box{display:none!important}.rrsx-foot button{width:100%;height:50px;background:var(--red);border:0;border-radius:6px;font-size:16px!important;font-weight:700;color:#fff!important;cursor:pointer}',
    '#rrsx-pill{display:flex;align-items:center;gap:8px;position:fixed;left:50%;bottom:calc(74px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1019;height:46px;padding:0 20px;background:#e52421;border:0;border-radius:23px;box-shadow:0 3px 12px rgba(0,0,0,.45);font:700 15px Poppins,Arial,sans-serif;color:#fff}}'
  ].join('');

  var S = { text: params.get('keyword') || params.get('q') || '', types: [], bands: [], genders: [], vals: [], min: 0, max: 0, sale: false, gone: false, fresh: false, sort: 'new' };
  var HEAD = PREVIEW || CAT_PAGE ? null : document.getElementById('filter_keyword');
  var M = null, W = null, root = null, side = null, dock = null, shade = null, styleEl = null, pill = null, $ = {}, secs = {}, seq = 0, shown = 0, total = 0, last = null;
  var restore = null, timer = 0, ready = false, busy = false, engaged = false, opener = null, wantSheet = false, started = false, guard = 0, ro = null, sideDirty = false, wired = false;
  var lo = 0, hi = 0, topPx = 0, fitting = false, wantEng = false, swKept = {};

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function n(v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function ft(v) { return n(v) + ' Ft'; }
  function plain(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function nice(t) { return t.replace(/\s+[-–—]\s+[A-Z0-9][A-Z0-9\/_.\-]{3,}$/, function (m) { return /\d/.test(m) ? '' : m; }); }
  function s2p(v) { return lo && hi > lo ? lo * Math.pow(hi / lo, v / 1000) : 0; }
  function p2s(p) { return lo && hi > lo ? Math.max(0, Math.min(1000, Math.round(1000 * Math.log(p / lo) / Math.log(hi / lo)))) : 0; }
  function filterCount() { return S.types.length + S.bands.length + S.genders.length + S.vals.length + (S.min || S.max ? 1 : 0) + (S.sale ? 1 : 0) + (S.gone ? 1 : 0) + (S.fresh ? 1 : 0); }
  function toggle(a, v) { var i = a.indexOf(v); if (i >= 0) { a.splice(i, 1); } else { a.push(v); } }
  function catId() {
    var q = +params.get('category_id'); if (q) { return q; }
    var m = /-(\d+)\/?$/.exec(location.pathname);
    return m ? +m[1] : null;
  }
  function hasFilterHash() { return /(^#|&)(t|b|g|min|max|akcio|uj|elfogyott|f\.[a-z_]+)=/.test(location.hash); }

  /* ---------- URL: the filters live in the address, after #, so links and reload work and Google sees the normal page ---------- */
  function readHash() {
    var h = new URLSearchParams(location.hash.replace(/^#/, ''));
    var list = function (k) { return (h.get(k) || '').split('|').filter(Boolean); };
    S.types = list('t').map(function (x) { return M.types.findIndex(function (t) { return t[0] === x; }); }).filter(function (i) { return i >= 0; });
    S.bands = list('b').map(function (x) { return M.bands.indexOf(x); }).filter(function (i) { return i >= 0; });
    S.genders = list('g').map(function (x) { return M.genders.indexOf(x); }).filter(function (i) { return i >= 0; });
    S.vals = [];
    M.facets.forEach(function (f, fi) {
      list('f.' + f[0]).forEach(function (x) { var i = M.values.findIndex(function (v) { return v[0] === fi && v[1] === x; }); if (i >= 0) { S.vals.push(i); } });
    });
    S.min = +h.get('min') || 0; S.max = +h.get('max') || 0; S.sale = h.get('akcio') === '1'; S.gone = false; S.fresh = h.get('uj') === '1' && M.hasDays;
    S.sort = SORTS.some(function (x) { return x[0] === h.get('s'); }) ? h.get('s') : 'new';
  }
  function url() {
    var h = new URLSearchParams();
    if (S.types.length) { h.set('t', S.types.map(function (i) { return M.types[i][0]; }).join('|')); }
    if (S.bands.length) { h.set('b', S.bands.map(function (i) { return M.bands[i]; }).join('|')); }
    if (S.genders.length) { h.set('g', S.genders.map(function (i) { return M.genders[i]; }).join('|')); }
    M.facets.forEach(function (f, fi) {
      var v = S.vals.filter(function (i) { return M.values[i][0] === fi; }).map(function (i) { return M.values[i][1]; });
      if (v.length) { h.set('f.' + f[0], v.join('|')); }
    });
    if (S.min) { h.set('min', S.min); } if (S.max) { h.set('max', S.max); }
    if (S.sale) { h.set('akcio', '1'); } if (S.fresh) { h.set('uj', '1'); }
    if (S.sort !== 'new' && (!CAT_PAGE || filterCount())) { h.set('s', S.sort); }
    var p = new URLSearchParams(location.search);
    if (SEARCH_PAGE) { if (S.text) { p.set(PREVIEW ? 'q' : 'keyword', S.text); } else { p.delete(PREVIEW ? 'q' : 'keyword'); } }
    var hs = h.toString(), qs = p.toString().replace(/%2F/g, '/');   /* route=product/list stays readable for the shop's own scripts */
    return location.pathname + (qs ? '?' + qs : '') + (hs ? '#' + hs : '');
  }

  /* ---------- talking to the worker ---------- */
  function ask(add) {
    busy = true;
    var size = !CAT_PAGE || wantEng ? (add ? PAGE : Math.max(PAGE, restore ? restore.shown : 0)) : 0;
    window.__rrsxAsk = performance.now();
    W.postMessage({ id: ++seq, add: !!add, text: CAT_PAGE ? '' : S.text, types: S.types, bands: S.bands, genders: S.genders, vals: S.vals, min: S.min, max: S.max,
      sale: S.sale, gone: S.gone, fresh: S.fresh, sort: S.sort, from: add ? shown : 0, size: size });
  }
  function setEngaged(on) {
    if (!CAT_PAGE) { return; }
    wantEng = on;
    if (on === engaged) { return; }
    engaged = on;
    document.documentElement.classList.toggle('rrsx-eng', on);
    if (!on) { shown = 0; $.grid.innerHTML = ''; }
    cover();
  }
  function change(wait) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var was = engaged;
      if (CAT_PAGE) {
        if (filterCount() > 0) { wantEng = true; } else { setEngaged(false); }
        if (was && !engaged) { S.sort = 'new'; $.sort.value = 'new'; var head = document.querySelector('.column-right>.page-head'); if (head && head.getBoundingClientRect().top < 0) { head.scrollIntoView(); } }
      }
      history.replaceState(null, '', url());
      ask(false);
    }, wait || 0);
  }

  /* ---------- drawing: existing buttons and cards are updated in place, so nothing flashes or jumps ---------- */
  function morph(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.parentNode.replaceChild(b, a); return; }
    if (a.nodeType === 3) { if (a.data !== b.data) { a.data = b.data; } return; }
    if (a.nodeType !== 1) { return; }
    var keepOpen = a.nodeName === 'DETAILS', i, at;
    for (i = 0; i < b.attributes.length; i++) { at = b.attributes[i]; if (!(keepOpen && at.name === 'open') && a.getAttribute(at.name) !== at.value) { a.setAttribute(at.name, at.value); } }
    for (i = a.attributes.length - 1; i >= 0; i--) { at = a.attributes[i]; if (!(keepOpen && at.name === 'open') && !b.hasAttribute(at.name)) { a.removeAttribute(at.name); } }
    morphKids(a, b);
  }
  function morphKids(a, b) {
    var x = [].slice.call(a.childNodes), y = [].slice.call(b.childNodes), i;
    for (i = 0; i < y.length; i++) { if (x[i]) { morph(x[i], y[i]); } else { a.appendChild(y[i]); } }
    for (i = y.length; i < x.length; i++) { a.removeChild(x[i]); }
  }
  function setHtml(el, html) { var t = document.createElement('template'); t.innerHTML = html; morphKids(el, t.content); }
  function ordered(s, rows) {     /* the first order of a list stays for good: buttons never change places */
    s.order = s.order || {}; s.nextOrder = s.nextOrder || 0;
    rows.slice().sort(function (a, b) { return b[0] - a[0]; }).forEach(function (r) { if (s.order[r[4]] === undefined) { s.order[r[4]] = s.nextOrder++; } });
    return rows.sort(function (a, b) { return s.order[a[4]] - s.order[b[4]]; });
  }
  function kept(s, key) { return !!(s.order && s.order[key] !== undefined); }
  function showCards(items, id, done) {     /* cards still in the list keep their loaded pictures; the swap waits briefly for the new ones */
    var old = {}, t = document.createElement('template'), fresh = [];
    [].forEach.call($.grid.querySelectorAll('.rrsx-card'), function (c) { old[c.getAttribute('href')] = c; });
    var nodes = items.map(function (x) {
      t.innerHTML = card(x);
      var c = t.content.firstChild, k = c.getAttribute('href');
      if (old[k]) { var r = old[k]; delete old[k]; return r; }
      fresh.push(c); return c;
    });
    var ready = fresh.slice(0, 10).map(function (c) { var i = c.querySelector('img'); i.loading = 'eager'; return i.decode ? i.decode().catch(function () {}) : null; });
    var finished = false;
    function swap() {
      if (finished || id !== seq) { return; }
      finished = true;
      var f = document.createDocumentFragment(); nodes.forEach(function (c) { f.appendChild(c); });
      $.grid.textContent = ''; $.grid.appendChild(f);
      if (CAT_PAGE && wantEng) { setEngaged(true); }
      done();
    }
    Promise.all(ready).then(swap); setTimeout(swap, fresh.length ? 200 : 0);
  }
  function card(x) {
    var pct = x[3] ? Math.round((1 - x[3] / x[2]) * 100) : 0, t = esc(nice(x[1])), src = IMG + x[6].split('/').map(encodeURIComponent).join('/') + '.webp';
    var badge = !x[4] ? '<span class="rrsx-badge out">Elfogyott</span>' : pct ? '<span class="rrsx-badge">-' + pct + '%</span>' : x[7] ? '<span class="rrsx-badge new">Új</span>' : '';
    return '<a class="rrsx-card' + (x[4] ? '' : ' out') + '" href="' + SHOP + esc(x[5]) + '-' + x[0] + '">' +
      '<img class="rrsx-img" src="' + esc(src) + '" alt="' + t + '" width="360" height="360" loading="lazy" decoding="async">' + badge +
      '<span class="rrsx-b"><span class="rrsx-t">' + t + '</span>' +
      (x[3] ? '<span class="rrsx-p sale">' + ft(x[3]) + '<s>' + ft(x[2]) + '</s></span>' : '<span class="rrsx-p">' + ft(x[2]) + '</span>') + '</span></a>';
  }
  function row(kind, id, label, count, on) {
    return '<button type="button" class="rrsx-row' + (on ? ' on' : '') + '" data-k="' + kind + '" data-v="' + id + '" aria-pressed="' + !!on + '"' + (count || on ? '' : ' disabled') + '><i aria-hidden="true"></i><span>' + esc(label) + '</span><b>' + n(count || 0) + '</b></button>';
  }
  function sec(key, title, body, isOpen) {
    return '<details class="rrsx-f" data-sec="' + key + '"' + (isOpen ? ' open' : '') + ' hidden><summary><h3>' + esc(title) + '</h3><em class="rrsx-fn" style="font-style:normal"></em></summary><div class="rrsx-fb">' + body + '</div></details>';
  }
  function findBox(key, label) { return '<input class="rrsx-find" type="search" data-find="' + key + '" placeholder="' + esc(label) + '" aria-label="' + esc(label) + '" hidden>'; }
  function bandGroups() {
    var kinds = M.kinds || [], used = {}, groups = [];
    M.bands.forEach(function (b, i) { var k = kinds[i]; if (KIND_LABELS.indexOf(k) >= 0) { used[k] = 1; } });
    var any = Object.keys(used).length > 0;
    KIND_LABELS.forEach(function (k, i) { if (used[k]) { groups.push({ key: 'k' + i, label: k, kind: k }); } });
    if (!any) { groups.push({ key: 'k9', label: 'Zenekar / márka', kind: null }); }
    else if (M.bands.some(function (b, i) { return KIND_LABELS.indexOf(kinds[i]) < 0; })) { groups.push({ key: 'k9', label: 'Egyéb márkák', kind: null }); }
    return groups;
  }
  function facetOrder() {
    var pref = ['colour', 'motif', 'style', 'fit', 'print', 'material', 'boot_height', 'boot_feature'];
    return M.facets.map(function (f, i) { return i; }).sort(function (a, b) {
      var x = pref.indexOf(M.facets[a][0]), y = pref.indexOf(M.facets[b][0]);
      return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
    });
  }
  function buildSections() {
    var order = facetOrder(), colour = order.filter(function (fi) { return M.facets[fi][0] === 'colour'; });
    function facetSec(fi) { var f = M.facets[fi]; return sec('f' + fi, f[1], f[0] === 'colour' ? '<div class="rrsx-cols" data-l></div>' : findBox('f' + fi, f[1] + ' keresése') + '<div data-l></div>', f[0] === 'colour'); }
    var h = '<div class="rrsx-tog" data-sec="tog">' +
      '<button type="button" class="rrsx-sw" data-tg="sale" aria-pressed="false"><span>Csak akciós</span><b></b><i aria-hidden="true"></i></button>' +
      '<button type="button" class="rrsx-sw" data-tg="fresh" aria-pressed="false" hidden><span>Új termékek</span><b></b><i aria-hidden="true"></i></button></div>';
    colour.forEach(function (fi) { h += facetSec(fi); });
    h += sec('types', 'Termék típusa', findBox('types', 'Típus keresése') + '<div data-l></div>', true);
    h += sec('price', 'Ár', '<div class="rrsx-hist" data-p="hist" aria-hidden="true">' + new Array(BUCKETS + 1).join('<u></u>') + '</div><div class="rrsx-range"><input data-p="r1" type="range" min="0" max="1000" value="0" aria-label="Legalacsonyabb ár"><input data-p="r2" type="range" min="0" max="1000" value="1000" aria-label="Legmagasabb ár"></div>' +
      '<div class="rrsx-pr"><input data-p="p1" type="number" inputmode="numeric" min="0" aria-label="Ár ettől (Ft)"><span>és</span><input data-p="p2" type="number" inputmode="numeric" min="0" aria-label="Ár eddig (Ft)"><span>Ft</span></div>', true);
    h += sec('gen', 'Kinek', '<div class="rrsx-chips" data-l></div>', true);
    bandGroups().forEach(function (g, i) { h += sec(g.key, g.label, findBox(g.key, g.label + ' keresése') + '<div data-l></div>', i === 0); });
    order.forEach(function (fi) { if (colour.indexOf(fi) < 0) { h += facetSec(fi); } });
    $.body.innerHTML = h;
    secs = {};
    $.body.querySelectorAll('[data-sec]').forEach(function (e) { secs[e.getAttribute('data-sec')] = { el: e, list: e.querySelector('[data-l]'), find: e.querySelector('[data-find]'), q: '', all: false, dirty: true }; });
    $.body.querySelectorAll('[data-p]').forEach(function (e) { $[e.getAttribute('data-p')] = e; });
    $.bars = [].slice.call($.hist.children);
    $.sw = {}; $.body.querySelectorAll('[data-tg]').forEach(function (e) { $.sw[e.getAttribute('data-tg')] = e; });
    wirePrice();
  }
  function setSec(s, show, selected) {
    s.on = s.on || show;      /* a group that has appeared stays: the panel never jumps */
    if (s.el.hidden === !!s.on) { s.el.hidden = !s.on; }
    var badge = s.el.querySelector('.rrsx-fn');
    if (badge) { var t = selected ? String(selected) : ''; if (badge.textContent !== t) { badge.textContent = t; } }
  }
  function drawLongList(s, rows, limit) {     /* rows: [count, html, label, selected, key] */
    var q = plain(s.q), all = ordered(s, rows).filter(function (r) { return r[3] || !q || plain(r[2]).indexOf(q) >= 0; });
    var lim = s.all || q ? 80 : limit, list = all.filter(function (r, i) { return i < lim || r[3]; }), more = all.length - list.length;
    if (s.find) { var long = rows.length > limit + 2; if (s.find.hidden === long) { s.find.hidden = !long; } }
    setHtml(s.list, list.map(function (r) { return r[1]; }).join('') +
      (more > 0 ? '<button type="button" class="rrsx-more" data-more="1">Több mutatása (' + n(more) + ')</button>' : '') +
      (!all.length ? '<div class="rrsx-mt">Nincs találat</div>' : ''));
  }
  function drawTypes(s, m) {
    var groups = [], by = {}, rows = [], q = plain(s.q);
    M.types.forEach(function (t, i) {
      var c = m.cT[i + 1], on = S.types.indexOf(i) >= 0, key = 't' + i;
      if (!c && !on && !kept(s, key)) { return; }
      var r = [c, row('t', i, t[0], c, on), t[0], on, key];
      rows.push(r);
      if (q && plain(t[0]).indexOf(q) < 0 && !on) { return; }
      if (!by[t[1]]) { by[t[1]] = { name: t[1], sum: 0, rows: [], on: false }; groups.push(by[t[1]]); }
      by[t[1]].sum += c; by[t[1]].on = by[t[1]].on || on; by[t[1]].rows.push(r);
    });
    ordered(s, rows);
    if (s.flat === undefined) { s.flat = rows.length <= 10; }
    s.gOrder = s.gOrder || {}; s.nextG = s.nextG || 0;
    groups.slice().sort(function (a, b) { return b.sum - a.sum; }).forEach(function (g) { if (s.gOrder[g.name] === undefined) { s.gOrder[g.name] = s.nextG++; } });
    groups.sort(function (a, b) { return s.gOrder[a.name] - s.gOrder[b.name]; });
    groups.forEach(function (g) { g.rows.sort(function (a, b) { return s.order[a[4]] - s.order[b[4]]; }); });
    if (s.find) { var long = rows.length > 12; if (s.find.hidden === long) { s.find.hidden = !long; } }
    if (s.flat && !q) { setHtml(s.list, rows.map(function (r) { return r[1]; }).join('')); return; }
    s.groups = s.groups || {};
    setHtml(s.list, groups.map(function (g, i) {
      var isOpen = q || (s.groups[g.name] !== undefined ? s.groups[g.name] : (g.on || i === 0));
      return '<details class="rrsx-g" data-g="' + esc(g.name) + '"' + (isOpen ? ' open' : '') + '><summary><span>' + esc(g.name) + '</span><b>' + n(g.sum) + '</b></summary>' + g.rows.map(function (r) { return r[1]; }).join('') + '</details>';
    }).join('') || '<div class="rrsx-mt">Nincs találat</div>');
    [].forEach.call(s.list.querySelectorAll('.rrsx-g'), function (d) { var name = d.getAttribute('data-g'); if (s.groups[name] === undefined) { s.groups[name] = d.open; } });
  }
  function drawBands(g, s, m) {
    var rows = [], kinds = M.kinds || [], picked = 0;
    M.bands.forEach(function (b, i) {
      var inGroup = g.kind ? kinds[i] === g.kind : KIND_LABELS.indexOf(kinds[i]) < 0;
      if (!inGroup) { return; }
      var c = m.cB[i + 1], on = S.bands.indexOf(i) >= 0, key = 'b' + i;
      if (on) { picked++; }
      if (c || on || kept(s, key)) { rows.push([c, row('b', i, b, c, on), b, on, key]); }
    });
    ordered(s, rows);
    setSec(s, rows.length > 1 || picked > 0, picked);
    if (!s.el.hidden && s.el.open) { drawLongList(s, rows, 8); s.dirty = false; } else { s.dirty = true; }
  }
  function drawFacet(fi, s, m) {
    var rows = [], picked = 0, f = M.facets[fi], isCol = f[0] === 'colour', vals = [];
    M.values.forEach(function (v, i) { if (v[0] === fi) { vals.push(i); } });
    vals.forEach(function (i) {
      var c = m.cV[i], on = S.vals.indexOf(i) >= 0, label = M.values[i][1], key = 'v' + i;
      if (on) { picked++; }
      if (!c && !on && !kept(s, key)) { return; }
      var html;
      if (isCol) {
        html = '<button type="button" class="rrsx-col' + (on ? ' on' : '') + '" data-k="v" data-v="' + i + '" aria-pressed="' + on + '"' + (c || on ? '' : ' disabled') + ' aria-label="' + esc(label) + ', ' + n(c) + ' termék"><i aria-hidden="true" style="background:' + (SWATCH[label] || 'repeating-linear-gradient(45deg,#777 0 4px,#aaa 4px 8px)') + '"></i><span>' + esc(label) + '</span><b>' + n(c) + '</b></button>';
      } else { html = row('v', i, label, c, on); }
      rows.push([c, html, label, on, key]);
    });
    ordered(s, rows);
    var relevant = picked > 0 || (isCol ? rows.length > 0 : rows.length > 1 && m.cover[fi] >= Math.max(3, m.total * 0.05));
    setSec(s, relevant, picked);
    if (s.el.hidden || !s.el.open) { s.dirty = true; return; }
    s.dirty = false;
    if (isCol) {
      rows.sort(function (a, b) { return COLOUR_ORDER.indexOf(a[2]) - COLOUR_ORDER.indexOf(b[2]); });
      setHtml(s.list, rows.map(function (r) { return r[1]; }).join(''));
    } else { drawLongList(s, rows, 8); }
  }
  function drawPrice(m) {
    lo = m.lo; hi = m.hi;
    var s = secs.price, usable = hi > lo || S.min || S.max;
    setSec(s, !!usable, S.min || S.max ? 1 : 0);
    if (!usable) { return; }
    var a = S.min ? p2s(S.min) : 0, b = S.max ? p2s(S.max) : 1000, top = 1, i;
    for (i = 0; i < BUCKETS; i++) { if (m.hist[i] > top) { top = m.hist[i]; } }
    for (i = 0; i < BUCKETS; i++) {
      var mid = (i + .5) / BUCKETS * 1000, h = m.hist[i] ? Math.max(4, Math.round(Math.sqrt(m.hist[i] / top) * 100)) + '%' : '0', u = $.bars[i], cls = mid >= a && mid <= b ? 'in' : '';
      if (u.style.height !== h) { u.style.height = h; } if (u.className !== cls) { u.className = cls; }
    }
    if (document.activeElement !== $.r1) { $.r1.value = a; } if (document.activeElement !== $.r2) { $.r2.value = b; }
    $.r1.setAttribute('aria-valuetext', ft(S.min || lo)); $.r2.setAttribute('aria-valuetext', ft(S.max || hi));
    if (document.activeElement !== $.p1) { $.p1.value = S.min || ''; $.p1.placeholder = n(m.sMax ? m.sMin : lo); }
    if (document.activeElement !== $.p2) { $.p2.value = S.max || ''; $.p2.placeholder = n(m.sMax || hi); }
  }
  function chips() {
    var a = [];
    S.types.forEach(function (i) { a.push(['t', i, M.types[i][0]]); }); S.bands.forEach(function (i) { a.push(['b', i, M.bands[i]]); });
    S.genders.forEach(function (i) { a.push(['g', i, M.genders[i]]); }); S.vals.forEach(function (i) { a.push(['v', i, M.values[i][1]]); });
    if (S.min || S.max) { a.push(['p', 0, (S.min ? ft(S.min) + ' felett' : '') + (S.min && S.max ? ', ' : '') + (S.max ? ft(S.max) + ' alatt' : '')]); }
    if (S.sale) { a.push(['s', 0, 'Akciós']); } if (S.fresh) { a.push(['n', 0, 'Új termék']); }
    return a;
  }
  function drawActive() {
    var a = chips(), filters = a.length, label = 'Szűrők' + (filters ? ' (' + filters + ')' : '');
    if (HEAD && S.text) { a.unshift(['q', 0, 'Keresés: ' + S.text]); }
    setHtml($.act, a.map(function (x) { return '<button type="button" class="rrsx-tag" data-rk="' + x[0] + '" data-rv="' + x[1] + '" aria-label="Szűrő törlése: ' + esc(x[2]) + '">' + esc(x[2]) + '</button>'; }).join('') +
      (filters > 1 ? '<button type="button" class="rrsx-tag clr" data-rk="all">Szűrők törlése</button>' : ''));
    $.open.textContent = label;
    if (pill) { pill.textContent = label; }
  }
  function sheetOpen() { return document.documentElement.classList.contains('rrsx-sheet'); }
  function drawSide(m) {
    if (MOBILE.matches && !sheetOpen()) { sideDirty = true; return; }
    sideDirty = false;
    var ae = document.activeElement, key = ae && side.contains(ae) ? [ae.getAttribute('data-k'), ae.getAttribute('data-v'), ae.getAttribute('data-tg')] : null;
    var keepScroll = side.scrollTop;
    var t = secs.types, g = secs.gen;
    var typeCount = 0; M.types.forEach(function (x, i) { if (m.cT[i + 1]) { typeCount++; } });
    setSec(t, typeCount > 1 || S.types.length > 0, S.types.length);
    if (!t.el.hidden && t.el.open) { drawTypes(t, m); t.dirty = false; } else { t.dirty = true; }
    bandGroups().forEach(function (grp) { drawBands(grp, secs[grp.key], m); });
    var genCount = 0; M.genders.forEach(function (x, i) { if (m.cG[i + 1]) { genCount++; } });
    setSec(g, genCount > 1 || S.genders.length > 0, S.genders.length);
    if (!g.el.hidden) {
      g.kept = g.kept || {};
      setHtml(g.list, M.genders.map(function (x, i) {
        var on = S.genders.indexOf(i) >= 0, c = m.cG[i + 1];
        if (c) { g.kept[i] = 1; }
        return c || on || g.kept[i] ? '<button type="button" class="rrsx-chip' + (on ? ' on' : '') + '" data-k="g" data-v="' + i + '" aria-pressed="' + on + '"' + (c || on ? '' : ' disabled') + '>' + esc(x) + '<small>' + n(c) + '</small></button>' : '';
      }).join(''));
    }
    drawPrice(m);
    M.facets.forEach(function (f, fi) { drawFacet(fi, secs['f' + fi], m); });
    [['sale', S.sale, m.sale], ['fresh', S.fresh, m.fresh]].forEach(function (x) {
      var b = $.sw[x[0]];
      swKept[x[0]] = swKept[x[0]] || x[1] || x[2] > 0;
      b.hidden = !swKept[x[0]]; b.disabled = !x[1] && !x[2]; b.className = 'rrsx-sw' + (x[1] ? ' on' : ''); b.setAttribute('aria-pressed', String(!!x[1]));
      var count = n(x[2] || 0), label = b.querySelector('b'); if (label.textContent !== count) { label.textContent = count; }
    });
    if (key) {
      var sel = key[2] ? '[data-tg="' + key[2] + '"]' : key[0] ? '[data-k="' + key[0] + '"][data-v="' + key[1] + '"]' : null, el = sel && side.querySelector(sel);
      if (el && el !== document.activeElement) { el.focus({ preventScroll: true }); }
    }
    side.scrollTop = keepScroll;
    fitSide();
  }
  function groupName(g) {
    if (g === 0) { return ['Termék típusa', 'T']; } if (g === 1) { return ['Zenekar, márka', 'B']; } if (g === 2) { return ['Kinek', 'G']; } if (g === 3) { return ['Ár', 'p']; }
    if (g === 4) { return ['Csak akciós', 's']; } if (g === 5) { return ['Elfogyottak is', 'o']; } if (g === 6) { return ['Új termék', 'n']; }
    return [M.facets[g - 7][1], 'F' + (g - 7)];
  }
  function groupActive(g) {
    return g === 0 ? S.types.length : g === 1 ? S.bands.length : g === 2 ? S.genders.length : g === 3 ? S.min || S.max : g === 4 ? S.sale : g === 5 ? 0 : g === 6 ? S.fresh :
      S.vals.some(function (v) { return M.values[v][0] === g - 7; });
  }
  function drawNone(m) {
    var sug = [], i;
    for (i = 0; i < m.relax.length; i++) {
      if (m.relax[i] > 0 && groupActive(i)) {
        var g = groupName(i);
        sug.push([m.relax[i], '<button type="button" data-rk="' + g[1] + '" data-rv="0">' + esc(i === 5 ? 'Elfogyottak mutatása' : g[0] + ' törlése') + ' (' + n(m.relax[i]) + ' találat)</button>']);
      }
    }
    sug.sort(function (a, b) { return b[0] - a[0]; });
    var full = SHOP + 'index.php?route=product/list&rrsx=0' + (S.text ? '&keyword=' + encodeURIComponent(S.text) : '');
    $.none.innerHTML = '<h2>Erre most nincs találat</h2>' +
      (sug.length ? '<p>Ezzel a változtatással lenne találat:</p><div class="rrsx-sug">' + sug.slice(0, 4).map(function (x) { return x[1]; }).join('') + '</div>' : '<p>Próbálj rövidebb szót, vagy törölj egy szűrőt.</p>') +
      (CAT_PAGE ? '' : '<p><a href="' + esc(full) + '">Keresés a webshop teljes kínálatában</a></p>');
  }
  function skeleton(count) { return new Array(Math.min(count, 12) + 1).join('<div class="rrsx-sk"></div>'); }
  function afterCards(m) {
    if (restore) { var r = restore; restore = null; requestAnimationFrame(function () { scrollTo(0, r.y); }); }
    else if (!m.add && !m.fill && !m.keep) {
      var head = topPx, y = $.top.getBoundingClientRect().top;
      if (y < head - 40) { scrollTo(0, scrollY + y - head - 8); }
    }
  }
  function result(m) {
    last = m; total = m.total; busy = false;
    $.n.textContent = n(total) + ' találat'; $.see.textContent = n(total) + ' találat mutatása';
    if ($.sc) { $.sc.textContent = n(total) + ' termék'; }
    var fx = m.fixed ? Object.keys(m.fixed).map(function (k) { return m.fixed[k]; }) : null;
    $.note.innerHTML = fx && total ? 'Nem találtuk pontosan ezt, ezért erre keresünk: <b>' + esc(fx.join(', ')) + '</b>' : ''; $.note.style.display = fx && total ? '' : 'none';
    drawActive(); drawSide(m);
    if (CAT_PAGE && !wantEng) { return; }
    function finish() {
      busy = false;
      $.load.style.display = shown < total ? '' : 'none';
      $.none.style.display = total ? 'none' : '';
      if (!total) { drawNone(m); }
      window.__rrsxDone = performance.now();
    }
    if (m.items) {
      if (m.add) { append(m.items, m.id); afterCards(m); finish(); }
      else { busy = true; showCards(m.items, m.id, function () { shown = m.items.length; afterCards(m); finish(); }); }
    } else if (m.wait) {
      busy = true;       /* the text file is on its way: the current list stays on screen until it is ready */
      if (!m.add && !$.grid.children.length && (engaged || !CAT_PAGE)) { $.grid.innerHTML = skeleton(m.wait); shown = 0; afterCards(m); }
    } else if (!m.add) { $.grid.textContent = ''; shown = 0; finish(); }
  }
  function append(items, id) {     /* endless list: a few cards per task, so scrolling never stalls on a slow phone */
    shown += items.length;
    var at = 0;
    (function step() {
      if (id !== seq) { return; }
      $.grid.insertAdjacentHTML('beforeend', items.slice(at, at + 12).map(card).join(''));
      at += 12;
      if (at < items.length) { setTimeout(step, 0); }
    })();
  }
  function fill(m) {
    if (m.id !== seq) { return; }
    function finish() { busy = false; $.load.style.display = shown < total ? '' : 'none'; $.none.style.display = total ? 'none' : ''; window.__rrsxDone = performance.now(); }
    if (m.add) { append(m.items, m.id); finish(); }
    else { showCards(m.items, m.id, function () { shown = m.items.length; afterCards(m); finish(); }); }
  }

  /* ---------- the phone sheet ---------- */
  var FOCUSABLE = 'button:not([hidden]),summary,input:not([hidden]),a[href]';
  function sheet(on, from) {
    var was = sheetOpen();
    document.documentElement.classList.toggle('rrsx-sheet', !!on);
    if (on && !was) {
      opener = from || document.activeElement;
      side.setAttribute('role', 'dialog'); side.setAttribute('aria-modal', 'true');
      side.scrollTop = 0;
      if (last && sideDirty) { drawSide(last); }
      var c = side.querySelector('.rrsx-close'); if (c) { c.focus({ preventScroll: true }); }
    } else if (!on && was) {
      side.removeAttribute('role'); side.removeAttribute('aria-modal');
      if (opener && opener.focus && document.contains(opener)) { opener.focus({ preventScroll: true }); }
      opener = null;
    }
  }
  function trap(e) {
    if (!sheetOpen()) { return; }
    if (e.key === 'Escape') { sheet(false); return; }
    if (e.key !== 'Tab') { return; }
    var list = [].filter.call(side.querySelectorAll(FOCUSABLE), function (x) { return x.getClientRects().length; });
    if (!list.length) { return; }
    var first = list[0], end = list[list.length - 1];
    if (!side.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
    else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
  }

  /* ---------- building the page parts ---------- */
  function resHtml() {
    return '<div data-p="top"></div><div class="rrsx-bar"><button type="button" class="rrsx-open" data-p="open" aria-haspopup="dialog">Szűrők</button><div class="rrsx-n" data-p="n" aria-live="polite"></div>' +
      '<div class="rrsx-dens" role="group" aria-label="Termékek mérete"><button type="button" data-dens="0" aria-label="Nagy képek" aria-pressed="true"><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M1 1h7v7H1zM10 1h7v7h-7zM1 10h7v7H1zM10 10h7v7h-7z"/></svg></button>' +
      '<button type="button" data-dens="1" aria-label="Kis képek" aria-pressed="false"><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M1 1h4v4H1zM7 1h4v4H7zM13 1h4v4h-4zM1 7h4v4H1zM7 7h4v4H7zM13 7h4v4h-4zM1 13h4v4H1zM7 13h4v4H7zM13 13h4v4h-4z"/></svg></button></div>' +
      '<div class="rrsx-sort"><label for="rrsx-s">Rendezés:</label><select id="rrsx-s" data-p="sort" aria-label="Rendezés">' +
      SORTS.filter(function (x) { return !CAT_PAGE || x[0] !== 'rel'; }).map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="rrsx-act" data-p="act"></div><p class="rrsx-note" data-p="note" style="display:none"></p><div class="rrsx-none" data-p="none" style="display:none"></div>' +
      '<div class="rrsx-grid" data-p="grid">' + (CAT_PAGE ? '' : skeleton(10)) + '</div><div class="rrsx-end" data-p="end"></div><button type="button" class="rrsx-load" data-p="load" style="display:none">Több termék</button>';
  }
  function makeSide() {
    side = document.createElement('aside');
    side.className = 'rrsx-side rrsx-ui'; side.setAttribute('aria-labelledby', 'rrsx-st');
    side.innerHTML = '<div class="rrsx-side-h"><h2 id="rrsx-st">' + (CAT_PAGE ? 'Termék szűrés' : 'Szűrők') + '</h2><span class="rrsx-sc" data-s="sc"></span><button type="button" class="rrsx-close" aria-label="Szűrők bezárása">&times;</button></div>' +
      '<div data-s="body"><div class="rrsx-wait">Szűrők betöltése...</div></div><div class="rrsx-foot"><button type="button" data-s="see">Találatok mutatása</button></div>';
    $.sc = side.querySelector('[data-s=sc]'); $.body = side.querySelector('[data-s=body]'); $.see = side.querySelector('[data-s=see]');
    shade = document.createElement('div'); shade.className = 'rrsx-shade'; document.body.appendChild(shade);
  }
  function placeSide() {
    var target;
    if (MOBILE.matches) { target = document.body; }
    else if (CAT_PAGE) { target = dock; }
    else { target = root.querySelector('.rrsx-wrap'); }
    if (target && side.parentNode !== target) { if (target === root.querySelector('.rrsx-wrap')) { target.insertBefore(side, target.firstChild); } else { target.appendChild(side); } }
    if (!MOBILE.matches) { sheet(false); }
    document.documentElement.classList.toggle('rrsx-dockon', !!CAT_PAGE && !MOBILE.matches && side.parentNode === dock);
    fitSide();
  }
  function cover() {}
  function fitSide() {     /* the panel always ends inside the screen; it scrolls inside itself */
    fitting = false;
    if (!side) { return; }
    if (MOBILE.matches) { if (side.style.maxHeight) { side.style.maxHeight = ''; } return; }
    var h = Math.max(260, Math.floor(innerHeight - Math.max(side.getBoundingClientRect().top, topPx + 12) - 14)) + 'px';
    if (side.style.maxHeight !== h) { side.style.maxHeight = h; }
  }
  function queueFit() { if (!fitting && !MOBILE.matches) { fitting = true; requestAnimationFrame(fitSide); } }
  function css() { if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'rrsx-css'; styleEl.textContent = CSS; document.head.appendChild(styleEl); } }
  function build() {
    css();
    root = document.createElement('div'); root.id = 'rrsx-root'; root.className = 'rrsx-ui ' + (CAT_PAGE ? 'rrsx-incat' : 'rrsx-full');
    makeSide();
    if (CAT_PAGE) {
      var head = document.querySelector('.column-right>.page-head'), aside = document.querySelector('.column-left');
      if (!head || !aside) { return false; }
      root.innerHTML = resHtml();
      head.parentNode.insertBefore(root, head.nextSibling);
      dock = document.createElement('div'); dock.id = 'rrsx-dock'; dock.className = 'rrsx-ui';
      if (getComputedStyle(aside).position === 'static') { aside.style.position = 'relative'; }
    } else {
      root.innerHTML = '<h1 class="rrsx-h1">Keresés</h1><div class="rrsx-box"><input class="rrsx-q" type="search" enterkeyhint="search" autocomplete="off" aria-label="Keresés" placeholder="Keress zenekarra, termékre, cikkszámra"><button type="button" class="rrsx-x" aria-label="Keresés törlése">&times;</button></div>' +
        '<div class="rrsx-wrap"><section aria-label="Találatok">' + resHtml() + '</section></div>';
      var host = PREVIEW ? document.body : document.querySelector('.main-content');
      if (!host) { return false; }
      host.insertBefore(root, host.firstChild);
      document.documentElement.classList.add('rrsx-on');
    }
    root.querySelectorAll('[data-p]').forEach(function (e) { $[e.getAttribute('data-p')] = e; });
    if (HEAD) { root.querySelector('.rrsx-box').remove(); HEAD.defaultValue = ''; }
    if (SEARCH_PAGE) { $.q = HEAD || root.querySelector('.rrsx-q'); $.q.value = S.text; }
    placeSide();
    return true;
  }
  function density(v, save) {
    $.grid.classList.toggle('rrsx-dense', v === 1);
    root.querySelectorAll('[data-dens]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-dens') === v)); });
    if (save) { try { localStorage.setItem('rrsx-dens', String(v)); } catch (e) {} }
  }
  function clearGroup(k, v) {
    if (k === 'all') { S.types = []; S.bands = []; S.genders = []; S.vals = []; S.min = S.max = 0; S.sale = S.gone = S.fresh = false; }
    else if (k === 'q') { S.text = ''; if ($.q) { $.q.value = ''; } }
    else if (k === 't') { toggle(S.types, v); } else if (k === 'b') { toggle(S.bands, v); } else if (k === 'g') { toggle(S.genders, v); } else if (k === 'v') { toggle(S.vals, v); }
    else if (k === 'T') { S.types = []; } else if (k === 'B') { S.bands = []; } else if (k === 'G') { S.genders = []; }
    else if (k === 'p') { S.min = S.max = 0; } else if (k === 's') { S.sale = false; } else if (k === 'n') { S.fresh = false; }
    else if (k === 'o') { S.gone = !S.gone; }
    else if (k[0] === 'F') { var f = +k.slice(1); S.vals = S.vals.filter(function (i) { return M.values[i][0] !== f; }); }
  }
  function onClick(e) {
    if (e.rrsxSeen) { return; }      /* the panel can sit inside the results area: one click, one action */
    e.rrsxSeen = true;
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b) {
      var c = e.target.closest && e.target.closest('.rrsx-card');
      if (c) { try { history.scrollRestoration = 'manual'; sessionStorage.setItem('rrsx-back', JSON.stringify({ u: location.href, y: scrollY, shown: shown })); } catch (_) {} }
      return;
    }
    var k = b.getAttribute('data-k'), v = +b.getAttribute('data-v'), rk = b.getAttribute('data-rk'), tg = b.getAttribute('data-tg'), dens = b.getAttribute('data-dens');
    if (dens !== null) { density(+dens, true); return; }
    if (b === $.open) { sheet(true, b); return; }
    if (b === $.see || b.classList.contains('rrsx-close')) { sheet(false); return; }
    if (b === $.load) { if (!busy) { ask(true); } return; }
    if (!M) { return; }
    if (k === 't') { toggle(S.types, v); } else if (k === 'b') { toggle(S.bands, v); } else if (k === 'g') { toggle(S.genders, v); } else if (k === 'v') { toggle(S.vals, v); }
    else if (tg) { S[tg] = !S[tg]; }
    else if (b.getAttribute('data-more')) { var s = secOf(b); if (s) { s.all = true; redrawSec(s); } return; }
    else if (rk) { clearGroup(rk, +b.getAttribute('data-rv')); }
    else { return; }
    change();
  }
  function secOf(el) { var d = el.closest('[data-sec]'); return d ? secs[d.getAttribute('data-sec')] : null; }
  function redrawSec(s) {
    if (!last) { return; }
    var key = s.el.getAttribute('data-sec');
    if (key === 'types') { drawTypes(s, last); }
    else if (key[0] === 'k') { bandGroups().forEach(function (g) { if (g.key === key) { drawBands(g, s, last); } }); }
    else if (key[0] === 'f') { drawFacet(+key.slice(1), s, last); }
    cover();
  }
  function wirePrice() {
    function fromRange() {
      var a = +$.r1.value, c = +$.r2.value; if (a > c) { var t = a; a = c; c = t; }
      S.min = a > 0 ? Math.floor(s2p(a) / 10) * 10 : 0; S.max = c < 1000 ? Math.ceil(s2p(c) / 10) * 10 : 0;
      $.p1.value = S.min || ''; $.p2.value = S.max || ''; change(70);
    }
    $.r1.addEventListener('input', fromRange); $.r2.addEventListener('input', fromRange);
    function fromBox() { S.min = Math.max(0, +$.p1.value || 0); S.max = Math.max(0, +$.p2.value || 0); change(260); }
    $.p1.addEventListener('input', fromBox); $.p2.addEventListener('input', fromBox);
  }
  function placeTop() {
    var hdr = document.getElementById('section-header');
    if (!hdr) { return; }
    var lastTop = -1, later = 0;
    function place() {
      var v = Math.max(0, Math.round(hdr.getBoundingClientRect().bottom));
      if (v !== lastTop) {     /* only on our own boxes: a variable on <html> would restyle the whole page on every header move */
        lastTop = v; topPx = v;
        [root, side, dock].forEach(function (e) { if (e) { e.style.setProperty('--rrsx-top', v + 'px'); } });
        queueFit();
      }
    }
    place();
    /* the shop's header slides by class change; measuring on those moments means no work at all while scrolling */
    new MutationObserver(function () { place(); clearTimeout(later); later = setTimeout(place, 320); }).observe(hdr, { attributes: true, attributeFilter: ['class'] });
    hdr.addEventListener('transitionend', place, { passive: true });
    addEventListener('resize', place, { passive: true });
  }
  function wire() {
    if (wired) { return; }
    wired = true;
    root.addEventListener('click', onClick); side.addEventListener('click', onClick);
    shade.addEventListener('click', function () { sheet(false); });
    if (SEARCH_PAGE) {
      $.q.addEventListener('input', function () { S.text = $.q.value.trim(); change(110); });
      $.q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); S.text = $.q.value.trim(); change(); $.q.blur(); } }, true);
      if (HEAD) { window.moduleSearch = function () { S.text = $.q.value.trim(); change(); }; }
      else { root.querySelector('.rrsx-x').addEventListener('click', function () { $.q.value = ''; S.text = ''; change(); $.q.focus(); }); }
    }
    $.sort.addEventListener('change', function () { S.sort = $.sort.value; change(); });
    side.addEventListener('input', function (e) {
      var key = e.target.getAttribute && e.target.getAttribute('data-find');
      if (key && secs[key]) { secs[key].q = e.target.value; redrawSec(secs[key]); }
    });
    side.addEventListener('toggle', function (e) {
      var d = e.target;
      if (d.matches && d.matches('.rrsx-g')) { var t = secs.types; t.groups = t.groups || {}; t.groups[d.getAttribute('data-g')] = d.open; }
      else if (d.matches && d.matches('.rrsx-f') && d.open) { var s = secs[d.getAttribute('data-sec')]; if (s && s.dirty) { s.dirty = false; redrawSec(s); } }
      if (d.matches && d.matches('.rrsx-f')) { cover(); }
    }, true);
    document.addEventListener('keydown', trap);
    MOBILE.addEventListener('change', function () { placeSide(); if (last) { drawSide(last); } });
    new IntersectionObserver(function (en) { if (en[0].isIntersecting && ready && !busy && shown && shown < total && (!CAT_PAGE || engaged)) { ask(true); } }, { rootMargin: '700px 0px' }).observe($.end);
    root.addEventListener('error', function (e) { var i = e.target; if (i.tagName === 'IMG' && /\.webp$/.test(i.src)) { i.src = i.src.replace(/\.webp$/, ''); } }, true);
    window.addEventListener('hashchange', function () { readHash(); $.sort.value = S.sort; if (CAT_PAGE) { setEngaged(filterCount() > 0); } ask(false); });
    addEventListener('scroll', queueFit, { passive: true }); addEventListener('resize', queueFit, { passive: true });
    placeTop();
  }
  function giveUp(why) {
    clearTimeout(guard); clearTimeout(timer);
    var cls = document.documentElement.classList; cls.remove('rrsx-on', 'rrsx-sheet', 'rrsx-eng', 'rrsx-dockon');
    [root, side, dock, shade, pill].forEach(function (e) { if (e && e.parentNode) { e.parentNode.removeChild(e); } });
    if (ro) { ro.disconnect(); }
    if (W) { W.terminate(); W = null; }
    window.RRSX_DEAD = why || 1;
    document.removeEventListener('click', tapFilter, true);
    if (wantSheet) { wantSheet = false; var shopBtn = document.getElementById('js-open-filter-btn'); if (shopBtn) { shopBtn.click(); } }
  }
  function onReady(m) {
    clearTimeout(guard);
    if (CAT_PAGE && !m.scoped) { giveUp('no category data'); return; }
    if (CAT_PAGE && !m.scopeN) { giveUp('empty category'); return; }
    M = m; ready = true; lo = m.lo; hi = m.hi;
    buildSections(); readHash(); $.sort.value = S.sort; wire();
    try { var d = +localStorage.getItem('rrsx-dens'); if (d === 1) { density(1); } } catch (e) {}
    if (CAT_PAGE) { dock.parentNode || document.querySelector('.column-left').insertBefore(dock, document.querySelector('.column-left').firstChild); placeSide(); setEngaged(filterCount() > 0); }
    try { var b = JSON.parse(sessionStorage.getItem('rrsx-back') || 'null'); if (b && b.u === location.href) { restore = b; try { history.scrollRestoration = 'manual'; } catch (_) {} } sessionStorage.removeItem('rrsx-back'); } catch (_) {}
    window.__rrsxInfo = { split: m.split, built: m.built, scopeN: m.scopeN };
    ask(false);
  }
  function start() {
    if (started) { return; }
    started = true;
    if (!build()) { giveUp('no mount'); return; }
    if (wantSheet) { sheet(true, document.getElementById('js-open-filter-btn') || pill); }
    guard = setTimeout(function () { giveUp('timeout'); }, TIMEOUT);
    try { W = new Worker(URL.createObjectURL(new Blob(['(' + workerMain.toString() + ')()'], { type: 'text/javascript' }))); }
    catch (e) { giveUp('worker'); return; }
    W.onerror = function () { if (!ready) { giveUp('worker error'); } else if (engaged || SEARCH_PAGE) { giveUp('worker error'); } };
    W.onmessage = function (e) {
      var m = e.data;
      if (m.failed) { if (!ready || m.fatal || m.id === seq) { giveUp(m.failed); } return; }
      if (m.ready) { onReady(m); return; }
      if (m.fill) { fill(m); return; }
      if (m.id === seq) { window.__rrsxMs = m.ms; result(m); }
    };
    W.postMessage({ load: { url: INDEX_URL, counts: COUNTS_URL, cat: CAT_PAGE ? catId() : null, path: CAT_PAGE ? location.pathname : '', noSplit: !!window.RRSX_NO_SPLIT } });
  }

  /* ---------- on phones nothing heavy starts until the filter button is used ---------- */
  function tapFilter(e) {
    var b = e.target.closest ? e.target.closest('#js-open-filter-btn,#rrsx-pill') : null;
    if (!b || window.RRSX_DEAD) { return; }
    e.preventDefault(); e.stopImmediatePropagation();
    if (started) { if (side) { sheet(true, b); } return; }
    wantSheet = true; start();
  }
  function makePill() {
    if (document.getElementById('js-open-filter-btn')) { return; }
    pill = document.getElementById('rrsx-pill');
    if (!pill) { css(); pill = document.createElement('button'); pill.type = 'button'; pill.id = 'rrsx-pill'; pill.textContent = 'Szűrők'; pill.setAttribute('aria-haspopup', 'dialog'); document.body.appendChild(pill); }
  }
  function boot() {
    if (SEARCH_PAGE) { start(); return; }
    css();
    window.RRSX_LIVE = true;
    if (MOBILE.matches) {
      document.addEventListener('click', tapFilter, true);
      makePill();
      if (hasFilterHash()) { start(); } else if (window.RRSX_OPEN) { wantSheet = true; start(); }
    } else { start(); }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
