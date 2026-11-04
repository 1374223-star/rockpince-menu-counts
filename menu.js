/* Rockpince category counts (ES5) - DYNAMIC version.
   Numbers are loaded from https://1374223-star.github.io/rockpince-menu-counts/category_counts.json
   which a GitHub Action regenerates from the Shoprenter API every 3 hours.
   Menu matching logic unchanged from the 2026-10-14 static version. Only decorates page text. */
(function () {
  'use strict';
  var COUNTS_URL = 'https://1374223-star.github.io/rockpince-menu-counts/category_counts.json';
  function run(counts, totalProducts) {
  var data = counts;
  var countSuffix = /\s+\[\d+\]$/;
  var lastPathId = /-(\d+)$/;
  var candidatesByName = {};
  var scheduled = false;
  var accentMap = {
    '\u00e1': 'a', '\u00e0': 'a', '\u00e2': 'a', '\u00e4': 'a',
    '\u00e9': 'e', '\u00e8': 'e', '\u00ea': 'e',
    '\u00ed': 'i', '\u00ec': 'i',
    '\u00f3': 'o', '\u00f6': 'o', '\u0151': 'o',
    '\u00fa': 'u', '\u00fc': 'u', '\u0171': 'u'
  };
  function normalize(value) {
    return String(value || '').toLowerCase()
      .replace(/[\u00e1\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00ed\u00ec\u00f3\u00f6\u0151\u00fa\u00fc\u0171]/g,
        function (ch) { return accentMap[ch] || ch; })
      .replace(/[\u2122\u00ae]/g, '')
      .replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  }
  function bare(value) {
    return String(value || '').replace(countSuffix, '');
  }
  var id;
  for (id in data) {
    if (Object.prototype.hasOwnProperty.call(data, id)) {
      var key = '$' + normalize(data[id][0]);
      if (!Object.prototype.hasOwnProperty.call(candidatesByName, key)) {
        candidatesByName[key] = [];
      }
      candidatesByName[key].push(id);
    }
  }
  function namedCandidates(text) {
    return candidatesByName['$' + normalize(bare(text))] || [];
  }
  function knownHost(host) {
    return (/^(www\.)?rockpince\.hu$/i).test(String(host || '')) ||
      (/^rockpince\.myshoprenter\.hu$/i).test(String(host || '')) ||
      (/^(www\.)?ragnarock\.hu$/i).test(String(host || ''));
  }
  function categoryId(link) {
    if (!knownHost(link.hostname)) { return null; }
    /* page-number links (?page=2) point at the same category: never count them */
    if (link.tagName && (/[?&]page=/i.test(String(link.search || '')) ||
        (link.closest && link.closest('.pagination, [class*="pagination"], [class*="paging"]')))) { return null; }
    var parts = String(link.pathname || '').replace(/\/+$/, '').split('/');
    var match = lastPathId.exec(parts[parts.length - 1] || '');
    return match && Object.prototype.hasOwnProperty.call(data, match[1]) ? match[1] : null;
  }
  function tag(node) {
    return String(node && (node.tagName || node.nodeName) || '').toUpperCase();
  }
  /* Only select a link which belongs to this LI, never a child submenu. */
  function ownAnchor(li) {
    var children = li.childNodes || li.children || [];
    var i, sub, j;
    for (i = 0; i < children.length; i += 1) {
      if (tag(children[i]) === 'A') { return children[i]; }
      /* Some Shoprenter themes wrap a menu item's link in a DIV. */
      if (tag(children[i]) === 'DIV' || tag(children[i]) === 'SPAN') {
        sub = children[i].childNodes || children[i].children || [];
        for (j = 0; j < sub.length; j += 1) {
          if (tag(sub[j]) === 'A') { return sub[j]; }
        }
      }
    }
    return null;
  }
  function menuParents(link) {
    var node = link, parents = [], parentLink;
    /* Find current menu item, then its actual LI ancestors. */
    while (node && tag(node) !== 'LI') { node = node.parentNode; }
    if (!node) { return parents; }
    node = node.parentNode;
    while (node) {
      if (tag(node) === 'LI') {
        parentLink = ownAnchor(node);
        if (parentLink && knownHost(parentLink.hostname)) {
          parents.push(parentLink);
        }
      }
      node = node.parentNode;
    }
    return parents;
  }
  function parentMatches(category, ancestors) {
    var parentId = data[category] && data[category][2];
    var i, ancestor, current, expected, foundId;
    if (!parentId || !ancestors.length) { return false; }
    for (i = 0; i < ancestors.length; i += 1) {
      ancestor = ancestors[i];
      if (!parentId || !data[parentId]) { return false; }
      current = data[parentId];
      expected = normalize(current[0]);
      foundId = categoryId(ancestor);
      if (foundId) {
        if (foundId !== parentId) { return false; }
      } else if (normalize(bare(ancestor.textContent)) !== expected) {
        return false;
      }
      parentId = current[2];
      if (!parentId) { return true; }
    }
    return true;
  }
  function resolve(link) {
    var exact = categoryId(link);
    if (exact) { return exact; }
    /* Unknown numeric suffix may be a different product/category URL. */
    var pathParts = String(link.pathname || '').replace(/\/+$/, '').split('/');
    if (lastPathId.test(pathParts[pathParts.length - 1] || '')) { return null; }
    var candidates = namedCandidates(link.textContent);
    if (candidates.length === 1) { return candidates[0]; }
    if (!candidates.length) { return null; }
    var ancestors = menuParents(link), valid = [], i;
    if (!ancestors.length) { return null; }
    for (i = 0; i < candidates.length; i += 1) {
      if (parentMatches(candidates[i], ancestors)) { valid.push(candidates[i]); }
    }
    return valid.length === 1 ? valid[0] : null;
  }
  /* exactId: the link URL itself ends in this category's ID, so a menu label that
     differs from the category name (renamed category) still gets its number. */
  function decorate(element, id, exactId) {
    if (!id || !Object.prototype.hasOwnProperty.call(data, id)) { return; }
    if (typeof data[id][1] !== 'number') { return; }
    if (element.getAttribute('data-rr-count-applied') === '1') { return; }
    /* owner 2026-11-03: categories with 0 products are never shown (menus, dropdowns, tiles, sidebar) */
    /* switched-off folders too: the shop can keep showing them from its cache for a while */
    if ((data[id][1] === 0 || data[id][5] === 0) && String(element.tagName).toUpperCase() === 'A') {
      var holder = element.closest ? element.closest('li, .subcategory__card, .card') : null;
      (holder || element).style.setProperty('display', 'none', 'important');
      element.setAttribute('data-rr-count-applied', '1');
      return;
    }
    var textMatches = normalize(bare(element.textContent)) === normalize(data[id][0]);
    if (exactId) {
      if (!normalize(bare(element.textContent))) { return; }
      /* links with an image: only when the text is the category name (menu items with icons),
         never banners / product pictures that happen to link to a category */
      if (element.getElementsByTagName('img').length && !textMatches) { return; }
    } else if (!textMatches) { return; }
    var count = document.createElement('span');
    count.className = 'rr-category-count';
    count.textContent = ' [' + data[id][1] + ']';
    element.appendChild(count);
    element.setAttribute('data-rr-count-applied', '1');
  }
  function update() {
    var anchors = document.getElementsByTagName('a');
    var i, link, resolved, headings, currentId, urlKey;
    var hrefIds = {}, unresolved = [];
    /* Once a nested desktop link is safely identified, the mobile/flat copy
       with exactly the same host and path can inherit that identity. */
    for (i = 0; i < anchors.length; i += 1) {
      link = anchors[i];
      if (!knownHost(link.hostname)) { continue; }
      resolved = resolve(link);
      urlKey = '$' + link.hostname.toLowerCase() + String(link.pathname || '');
      if (resolved) {
        if (Object.prototype.hasOwnProperty.call(hrefIds, urlKey) &&
            hrefIds[urlKey] !== resolved) {
          hrefIds[urlKey] = null;
        } else if (!Object.prototype.hasOwnProperty.call(hrefIds, urlKey)) {
          hrefIds[urlKey] = resolved;
        }
        decorate(link, resolved, resolved === categoryId(link));
      } else { unresolved.push(link); }
    }
    for (i = 0; i < unresolved.length; i += 1) {
      link = unresolved[i];
      urlKey = '$' + link.hostname.toLowerCase() + String(link.pathname || '');
      if (Object.prototype.hasOwnProperty.call(hrefIds, urlKey) && hrefIds[urlKey]) {
        decorate(link, hrefIds[urlKey]);
      }
    }
    currentId = categoryId(window.location);
    headings = document.getElementsByTagName('h1');
    for (i = 0; i < headings.length; i += 1) {
      if (currentId) {
        decorate(headings[i], currentId);
      } else if (knownHost(window.location.hostname)) {
        var candidates = namedCandidates(headings[i].textContent);
        if (candidates.length === 1) { decorate(headings[i], candidates[0]); }
      }
    }
  }
  /* Phone menu (mmenu): the small number next to ">" counts every subfolder, hidden ones too,
     so it is set to the folders really shown (and ">" is hidden when none is left);
     the DROPDOWNS "first" folders move to the top in bold, like on the desktop. */
  function fixMobileMenu() {
    var nav = document.getElementById('js-mobile-nav');
    if (!nav) { return; }
    var items = nav.querySelectorAll('li.mm-listitem[data-mm-child]'), i, j;
    for (i = 0; i < items.length; i += 1) {
      var panel = document.getElementById(items[i].getAttribute('data-mm-child'));
      var counter = items[i].querySelector('.mm-counter');
      var button = items[i].querySelector('.mm-btn--next');
      if (!panel || !counter) { continue; }
      var children = panel.querySelectorAll('.mm-listview > li'), shown = 0;
      for (j = 0; j < children.length; j += 1) {
        if (children[j].style.display !== 'none') { shown += 1; }
      }
      if (counter.textContent !== String(shown)) { counter.textContent = String(shown); }
      if (button) { button.style.display = shown ? '' : 'none'; }
      /* on a category page the theme leaves the submenu title empty: use the folder's name */
      var title = panel.querySelector('.mm-navbar__title span') || panel.querySelector('.mm-navbar__title');
      var own = items[i].querySelector('a.mm-listitem__text');
      if (title && own && !title.textContent.replace(/\s+/g, '')) { title.textContent = own.textContent.replace(/\s+/g, ' ').trim(); }
    }
    var root, k, link, li;
    for (root in DROPDOWNS) {
      if (!Object.prototype.hasOwnProperty.call(DROPDOWNS, root)) { continue; }
      for (k = DROPDOWNS[root].first.length - 1; k >= 0; k -= 1) {
        link = nav.querySelector('a.mm-listitem__text[href$="-' + DROPDOWNS[root].first[k] + '"]');
        li = link ? link.closest('li') : null;
        if (!li || !li.parentNode) { continue; }
        link.style.fontWeight = '800';
        if (li.parentNode.firstElementChild !== li) { li.parentNode.insertBefore(li, li.parentNode.firstElementChild); }
      }
    }
  }
  function scheduleUpdate() {
    if (scheduled) { return; }
    scheduled = true;
    window.setTimeout(function () {
      scheduled = false; update();
      try { liveTotal(); } catch (e) { /* ignore */ }
      try { fixMobileMenu(); } catch (e) { /* ignore */ }
    }, 80);
  }
  /* Self-updating 3-column dropdowns (DISZTÁRGY, KIEGÉSZÍTŐK), built from the live category
     tree in the counts file: only switched-on folders, Hungarian A-Z, current names and links.
     expand: show this folder's subfolders instead of the folder itself (jewellery types).
     extra: also list this folder from another tree (Ékszeres dobozok under KIEGÉSZÍTŐK). */
  var DROPDOWNS = {
    /* first: shown first and in bold, before the A-Z list */
    /* depth: how many subfolder levels show under each folder (owner 2026-11-03: KIEGÉSZÍTŐK
       shows only its own folders on hover, the subfolders stay on the category pages) */
    '14130': { expand: [], extra: [], first: ['14454'], depth: 3 },
    '14025': { expand: [], extra: [], first: [], depth: 0 }
  };
  var HU = '0123456789abcdefghijklmnoöpqrstuüvwxyz';
  var HU_SAME = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ő': 'ö', 'ú': 'u', 'ű': 'ü' };
  function huKey(text) {
    var s = String(text || '').toLowerCase(), out = '', i, ch, r;
    for (i = 0; i < s.length; i += 1) {
      ch = HU_SAME[s.charAt(i)] || s.charAt(i);
      r = HU.indexOf(ch);
      out += r < 0 ? '00' : (r + 1 < 10 ? '0' : '') + (r + 1);
    }
    return out;
  }
  function usable(id) {
    var c = data[id];
    return c && c.length >= 6 && c[5] === 1 && c[3];
  }
  function childrenOf(id) {
    var out = [], k;
    for (k in data) {
      if (Object.prototype.hasOwnProperty.call(data, k) && data[k][2] === id && usable(k)) { out.push(k); }
    }
    return out;
  }
  function buildDropdowns() {
    var root, cfg, li, box, ids, items, i, j, per, row, col, ul, item, a, kids;
    for (root in DROPDOWNS) {
      if (!Object.prototype.hasOwnProperty.call(DROPDOWNS, root)) { continue; }
      cfg = DROPDOWNS[root];
      li = document.getElementById('cat_' + root);
      box = li && li.querySelector('.ragna-rock-dropdown');
      if (!box || box.getAttribute('data-rr-built') === '1') { continue; }
      ids = childrenOf(root);
      items = [];
      for (i = 0; i < ids.length; i += 1) {
        if (cfg.expand.indexOf(ids[i]) >= 0) {
          kids = childrenOf(ids[i]);
          for (j = 0; j < kids.length; j += 1) { items.push(kids[j]); }
        } else { items.push(ids[i]); }
      }
      for (i = 0; i < cfg.extra.length; i += 1) {
        if (usable(cfg.extra[i]) && items.indexOf(cfg.extra[i]) < 0) { items.push(cfg.extra[i]); }
      }
      if (items.length < 3) { continue; } /* data looks wrong: keep the hand-made menu */
      items.sort(function (x, y) {
        var fx = cfg.first.indexOf(x), fy = cfg.first.indexOf(y);
        if (fx >= 0 || fy >= 0) { return (fx < 0 ? 999 : fx) - (fy < 0 ? 999 : fy); }
        return huKey(data[x][0]) < huKey(data[y][0]) ? -1 : 1;
      });
      /* Every folder with subfolders is a bold title with its subfolders listed under it (A-Z,
         "Egyéb ..." last, deeper levels indented further), so nothing is hidden behind a click. */
      function addTree(id, level, out) {
        var kids = level < (cfg.depth === undefined ? 3 : cfg.depth) ? childrenOf(id) : [], k;
        out.push({ id: id, level: level, title: kids.length > 0 });
        kids.sort(function (x, y) {
          var ox = /^egy[eé]b/i.test(data[x][0]) ? 1 : 0, oy = /^egy[eé]b/i.test(data[y][0]) ? 1 : 0;
          if (ox !== oy) { return ox - oy; }
          return huKey(data[x][0]) < huKey(data[y][0]) ? -1 : 1;
        });
        for (k = 0; k < kids.length; k += 1) { addTree(kids[k], level + 1, out); }
      }
      var blocks = [], total = 0, b, block;
      for (i = 0; i < items.length; i += 1) {
        block = [];
        addTree(items[i], 0, block);
        blocks.push(block);
        total += block.length;
      }
      /* 3 balanced columns: try every split of the (ordered, never broken) blocks and keep the
         one whose tallest column is shortest; titles count a bit more (they have extra space) */
      var weights = [], w, x, y, best = null, cut1 = 0, cut2 = 0;
      for (b = 0; b < blocks.length; b += 1) {
        w = 0;
        for (j = 0; j < blocks[b].length; j += 1) { w += blocks[b][j].title ? 1.4 : 1; }
        weights.push(w);
      }
      function span(from, to) { var s = 0, q; for (q = from; q < to; q += 1) { s += weights[q]; } return s; }
      for (x = 0; x <= blocks.length; x += 1) {
        for (y = x; y <= blocks.length; y += 1) {
          w = Math.max(span(0, x), span(x, y), span(y, blocks.length));
          if (best === null || w < best) { best = w; cut1 = x; cut2 = y; }
        }
      }
      var columns = [[], [], []];
      for (b = 0; b < blocks.length; b += 1) {
        var into = b < cut1 ? 0 : (b < cut2 ? 1 : 2);
        for (j = 0; j < blocks[b].length; j += 1) { columns[into].push(blocks[b][j]); }
      }
      row = document.createElement('div');
      row.className = 'row custom-dropdown-menu';
      for (i = 0; i < 3; i += 1) {
        col = document.createElement('div');
        col.className = 'col';
        ul = document.createElement('ul');
        ul.className = 'list-unstyled';
        for (j = 0; j < columns[i].length; j += 1) {
          var e = columns[i][j];
          item = document.createElement('li');
          a = document.createElement('a');
          a.href = window.location.protocol + '//' + window.location.host + data[e.id][3];
          a.textContent = data[e.id][0];
          if (e.title) {
            a.style.setProperty('font-weight', '800', 'important');
            if (e.level === 0 && j > 0) { item.style.setProperty('margin-top', '10px', 'important'); }
          }
          if (e.level > 0) {
            item.style.setProperty('padding-left', (14 * e.level) + 'px', 'important');
            a.style.setProperty('font-size', '12px', 'important');
            if (!e.title) { a.style.setProperty('opacity', '0.85', 'important'); }
            a.textContent = '› ' + a.textContent;
          }
          item.appendChild(a);
          ul.appendChild(item);
        }
        col.appendChild(ul);
        row.appendChild(col);
      }
      while (box.firstChild) { box.removeChild(box.firstChild); }
      box.appendChild(row);
      box.setAttribute('data-rr-built', '1');
    }
  }
  /* Banner text "Több mint 45,000 elérhető termék" -> "[44 308] elérhető termék" (live total,
     refreshed with the counts every 3 hours). Only the text nodes are changed. */
  function liveTotal() {
    if (typeof totalProducts !== 'number' || totalProducts < 1000) { return; }
    var pattern = /(t[öo]bb\s+mint\s*)?\[?[0-9][0-9.,\s]*\]?\s*(elérhető\s+termék)/i;
    var shown = String(totalProducts).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    var walker = document.createTreeWalker(document.body, 4, null, false), node;
    while ((node = walker.nextNode())) {
      if (pattern.test(node.nodeValue) && node.nodeValue.indexOf('[' + shown + ']') < 0) {
        node.nodeValue = node.nodeValue.replace(pattern, '[' + shown + '] $2');
      }
    }
  }
  function start() {
    try { buildDropdowns(); } catch (e) { /* never break the page: keep the hand-made menu */ }
    try { liveTotal(); } catch (e) { /* the banner keeps its own text */ }
    if (!document.getElementById('rr-category-count-style')) {
      var style = document.createElement('style');
      style.id = 'rr-category-count-style';
      style.type = 'text/css';
      style.textContent = '.rr-category-count { display: inline !important; margin-left: .35em !important; white-space: nowrap; opacity: 1 !important; font-size: 1em !important; font-weight: 700 !important; }' +
        /* owner 2026-11-03: every category name in FULL CAPITALS (display only; stored names unchanged) */
        ' ul.category-menu a, .sf-menu a, .ragna-rock-dropdown a, .mm-listitem a, ul.list-unstyled.category a,' +
        ' .subcategory__card-body, .subcategory__card-body a, .category-list-body h1.page-head-title,' +
        ' .breadcrumb-item, .breadcrumb-item a { text-transform: uppercase !important; }' +
        /* the theme fixes the dropdown box at 350px: let the self-built dropdowns grow with their content */
        ' li#cat_14130 .subtree-dropdown-inner, li#cat_14025 .subtree-dropdown-inner { height: auto !important; min-height: 350px; }' +
        ' li#cat_14130 .subtree-dropdown, li#cat_14025 .subtree-dropdown { max-height: calc(100vh - 140px); overflow-y: auto; }' +
        /* phone menu: long names wrap instead of ending in "..." that hid the count */
        ' #js-mobile-nav .mm-listitem__text { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }' +
        /* phone category page: two tiles per row, picture fills the tile (was a 190px picture on the left) */
        ' @media (max-width: 575.98px) { .subcategory-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }' +
        ' .subcategory__card-image { width: 100% !important; height: auto !important; }' +
        ' .subcategory__card-body, .subcategory__card-body a { font-size: 11px !important; line-height: 1.3 !important; } }';
      var head = document.getElementsByTagName('head')[0];
      if (head) { head.appendChild(style); }
    }
    update();
    try { fixMobileMenu(); } catch (e) { /* the theme menu stays as it is */ }
    var Observer = window.MutationObserver || window.WebKitMutationObserver;
    if (Observer && document.body) {
      var observer = new Observer(function (mutations) {
        var i;
        for (i = 0; i < mutations.length; i += 1) {
          if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
            scheduleUpdate(); return;
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } else if (window.setInterval) {
      window.setInterval(update, 1500);
    }
  }
  if (document.readyState === 'loading') {
    if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', start, false);
    } else if (window.attachEvent) {
      window.attachEvent('onload', start);
    }
  } else { start(); }
}
  try {
    var xhr = new XMLHttpRequest();
    /* cache-buster changes every 10 minutes so browsers pick up new numbers */
    xhr.open('GET', COUNTS_URL + '?v=' + Math.floor(new Date().getTime() / 600000), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || xhr.status !== 200) { return; }
      var payload;
      try { payload = JSON.parse(xhr.responseText); } catch (e) { return; }
      if (payload && payload.counts) { run(payload.counts, payload.total_visible_products); }
    };
    xhr.send(null);
  } catch (e) { /* no counts shown if loading fails; the menu itself is untouched */ }
}());

/* New Rock = prepaid only (owner 2026-11-04). When the cart holds a New Rock item
   (product names start with "New Rock - "), the checkout's payment list
   (POST checkout/paymentmethod/list) is filtered so cash on delivery (utánvét) is not offered,
   and a short notice is shown. Page-side only: unpaid New Rock orders are refused by hand. */
(function () {
  'use strict';
  if (!window.XMLHttpRequest || !Object.defineProperty) { return; }
  var MARK = /New Rock - /;
  var NOTICE = 'A New Rock termékek csak előre fizetéssel rendelhetők, ezért utánvét nem választható.';
  function isCod(m) {
    return m && (/^cod/i.test(String(m.code || '')) || /utánvét|utanvet/i.test(String(m.title || '')));
  }
  function cartHasNewRock(body) {
    return MARK.test(String(body || '')) || MARK.test(document.body ? document.body.innerText : '');
  }
  function filter(text, body) {
    if (!cartHasNewRock(body)) { return text; }
    try {
      var data = JSON.parse(text), list = Object.prototype.toString.call(data) === '[object Array]' ? data : data && data.data;
      if (!list || !list.length) { return text; }
      var kept = [];
      for (var i = 0; i < list.length; i++) { if (!isCod(list[i])) { kept.push(list[i]); } }
      if (kept.length === list.length) { return text; }
      if (list === data) { data = kept; } else { data.data = kept; }
      setTimeout(showNotice, 300);
      return JSON.stringify(data);
    } catch (e) { return text; }
  }
  function showNotice() {
    var box = document.querySelector('.payment-method');
    if (!box || document.getElementById('rr-newrock-prepaid')) { return; }
    var p = document.createElement('div');
    p.id = 'rr-newrock-prepaid';
    p.style.cssText = 'margin:0 0 12px;padding:10px 14px;border-left:4px solid #e52421;background:#fff3f3;color:#222;font-weight:600';
    p.appendChild(document.createTextNode(NOTICE));
    box.insertBefore(p, box.firstChild);
  }
  var open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
  var proto = XMLHttpRequest.prototype;
  var textDesc = Object.getOwnPropertyDescriptor(proto, 'responseText');
  var respDesc = Object.getOwnPropertyDescriptor(proto, 'response');
  if (!textDesc || !respDesc) { return; }
  proto.open = function (method, url) {
    this.__rrPay = /checkout\/paymentmethod\/list/.test(String(url || ''));
    return open.apply(this, arguments);
  };
  proto.send = function (body) {
    var xhr = this;
    if (xhr.__rrPay) {
      var cache = null;
      var get = function () {
        if (cache === null && xhr.readyState === 4) { cache = filter(textDesc.get.call(xhr), body); }
        return cache === null ? textDesc.get.call(xhr) : cache;
      };
      try {
        Object.defineProperty(xhr, 'responseText', { configurable: true, get: get });
        Object.defineProperty(xhr, 'response', { configurable: true, get: function () {
          var raw = respDesc.get.call(xhr);
          if (xhr.readyState !== 4) { return raw; }
          if (typeof raw === 'string') { return get(); }
          try { return JSON.parse(filter(JSON.stringify(raw), body)); } catch (e) { return raw; }
        } });
      } catch (e) { /* leave the request alone */ }
    }
    return send.apply(this, arguments);
  };
})();

/* Layout fixes (2026-11-04): one-row desktop menu (counts kept), red Kosárba on product pages,
   no net "+ ÁFA" price, simpler product cards, no fade-in on scroll, smaller phone badge. */
(function () {
  'use strict';
  if (document.getElementById('rr-ui-fixes')) { return; }
  var css =
    '@media (min-width: 992px) {' +
    ' .header-bottom ul.category-menu { flex-wrap: nowrap !important; justify-content: center !important; }' +
    ' .header-bottom ul.category-menu > li > a.nav-link { margin: 22px clamp(8px, 1.05vw, 22px) !important;' +
    '   font-size: clamp(12px, .95vw, 14px) !important; white-space: nowrap !important; }' +
    ' .header-bottom ul.category-menu > li > a.nav-link .rr-category-count { font-size: .9em !important; }' +
    '}' +
    /* 992-1279 px (small laptops): smaller items; under 1140 px it wraps to two neat rows instead of overflowing */
    '@media (min-width: 992px) and (max-width: 1279px) {' +
    ' .header-bottom ul.category-menu > li > a.nav-link { margin: 18px 7px !important; font-size: 11.5px !important; }' +
    ' .header-bottom ul.category-menu > li > a.nav-link > img { width: 16px !important; height: 16px !important; }' +
    '}' +
    '@media (min-width: 992px) and (max-width: 1139px) { .header-bottom ul.category-menu { flex-wrap: wrap !important; } }' +
    '.product-price__postfix { display: none !important; }' +
    '#add_to_cart.button-add-to-cart { background: #e52421 !important; border-color: #e52421 !important; color: #fff !important;' +
    ' font-size: 16px !important; font-weight: 700 !important; padding: 14px 28px !important; min-width: 200px; }' +
    '#add_to_cart.button-add-to-cart:hover { background: #c41c19 !important; border-color: #c41c19 !important; }' +
    '.product-card__details { display: none !important; }' +
    '.product-card .list_addtocart .quantity-input, .product-card .list_addtocart .quantity-name-text { display: none !important; }' +
    '.product-card .list_addtocart .button-add-to-cart { width: 100% !important; flex: 1 1 100% !important; }' +
    '[data-aos] { opacity: 1 !important; transform: none !important; transition: none !important; }' +
    '@media (max-width: 991px) { #fb_header_box { transform: scale(.75); transform-origin: left bottom; opacity: .9; } }';
  var style = document.createElement('style');
  style.id = 'rr-ui-fixes';
  style.type = 'text/css';
  style.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(style);
})();

/* Background design (2026-11-04): fine leather-like grain over a navy glow instead of the flat
   blues, faint skull-hand watermarks (from the logo) in the empty side areas on wide screens,
   and a small knot divider under the big homepage titles. Desktop + phone safe. */
(function () {
  'use strict';
  if (document.getElementById('rr-bg-design')) { return; }
  var SKULL = "url('https://1374223-star.github.io/rockpince-menu-counts/assets/skull-hand-watermark.webp')";
  var NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='turbulence' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .62 0 0 0 0 .85 0 0 0 -2.2 1.05'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.06'/%3E%3C/svg%3E\")";
  var GLOW = 'radial-gradient(ellipse 70% 55% at 50% 35%, #0e4d78 0%, #07304f 40%, #031627 75%, #010811 100%)';
  var KNOT = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='22' viewBox='0 0 240 22'%3E%3Cdefs%3E%3ClinearGradient id='l' x1='0' x2='1'%3E%3Cstop offset='0' stop-color='%237fc4ea' stop-opacity='0'/%3E%3Cstop offset='1' stop-color='%237fc4ea'/%3E%3C/linearGradient%3E%3ClinearGradient id='r' x1='1' x2='0'%3E%3Cstop offset='0' stop-color='%237fc4ea' stop-opacity='0'/%3E%3Cstop offset='1' stop-color='%237fc4ea'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M4 11H100' stroke='url(%23l)' stroke-width='1.5'/%3E%3Cpath d='M140 11H236' stroke='url(%23r)' stroke-width='1.5'/%3E%3Cg fill='none' stroke='%237fc4ea' stroke-width='1.6'%3E%3Cpath d='M120 1A10 10 0 0 1 128.7 16A10 10 0 0 1 120 1Z'/%3E%3Cpath d='M128.7 16A10 10 0 0 1 111.3 16A10 10 0 0 1 128.7 16Z'/%3E%3Cpath d='M111.3 16A10 10 0 0 1 120 1A10 10 0 0 1 111.3 16Z'/%3E%3Ccircle cx='120' cy='11' r='6.2'/%3E%3C/g%3E%3Cpath d='M104 11l3-3 3 3-3 3zM130 11l3-3 3 3-3 3z' fill='%23e52421'/%3E%3C/svg%3E\")";
  var css =
    'body, .layout-wrapper { background: ' + NOISE + ', ' + GLOW + ' !important; background-attachment: fixed, fixed !important; background-color: #020c18 !important; }' +
    '.section-wrapper:has(.seoh1-module), .section-wrapper:has(.advantages-module), .module-dealofday-wrapper, .header-bottom {' +
    ' background: ' + NOISE + ', linear-gradient(180deg, rgba(4,28,46,.55), rgba(2,12,24,.75)) !important; }' +
    '.section-wrapper:has(.advantages-module) { border-top: 1px solid rgba(127,196,234,.15); border-bottom: 1px solid rgba(127,196,234,.15); }' +
    '.module-dealofday-wrapper .module-body::after { background: linear-gradient(180deg, rgba(14,77,120,.28), rgba(3,22,39,.28)) !important; border: 1px solid rgba(127,196,234,.14); }' +
    '.home-body .main-content .module-head-title::after { content: ""; display: block; width: 240px; height: 22px; margin: 12px auto 0; background: ' + KNOT + ' center/contain no-repeat; }' +
    /* homepage: skulls either side of the Kiemelt termék block */
    '@media (min-width: 1200px) {' +
    ' .module-dealofday-wrapper { position: relative; overflow: hidden; }' +
    ' .module-dealofday-wrapper::before, .module-dealofday-wrapper::after { content: ""; position: absolute; top: 50%; width: min(30vw, 620px); aspect-ratio: 1;' +
    '   background: ' + SKULL + ' center/contain no-repeat; opacity: .12; pointer-events: none; z-index: 0; }' +
    ' .module-dealofday-wrapper::before { left: -4%; transform: translateY(-50%) rotate(-10deg); }' +
    ' .module-dealofday-wrapper::after { right: -4%; transform: translateY(-50%) scaleX(-1) rotate(-10deg); }' +
    ' .module-dealofday-wrapper > * { position: relative; z-index: 1; }' +
    '}' +
    /* other pages: skulls in the empty side areas of wide screens */
    '@media (min-width: 1800px) {' +
    ' body:not(.home-body) .layout-wrapper { position: relative; z-index: 0; }' +
    ' body:not(.home-body) .layout-wrapper::before, body:not(.home-body) .layout-wrapper::after { content: ""; position: fixed; top: 30vh;' +
    '   width: calc((100vw - 1440px) / 2 - 40px); max-width: 560px; aspect-ratio: 1; background: ' + SKULL + ' center/contain no-repeat;' +
    '   opacity: .12; pointer-events: none; z-index: -1; }' +
    ' body:not(.home-body) .layout-wrapper::before { left: 20px; transform: rotate(-10deg); }' +
    ' body:not(.home-body) .layout-wrapper::after { right: 20px; transform: scaleX(-1) rotate(-10deg); }' +
    '}';
  var style = document.createElement('style');
  style.id = 'rr-bg-design';
  style.type = 'text/css';
  style.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(style);
})();

/* Spacing (2026-11-04): one scale (8/12/16/24/32/56 px) - same section padding everywhere, 24 px card grid
   both ways, equal-height cards with prices and buttons lined up, bigger prices, product title in 2-3 lines,
   bigger size picker. Also re-measures the sticky header after the menu got shorter (no empty gap). */
(function () {
  'use strict';
  if (document.getElementById('rr-spacing')) { return; }
  var css = ".module-dealofday-wrapper, .module-special-wrapper, .module-latest-wrapper, .section-wrapper:has(.location-module) { padding-top: 56px !important; padding-bottom: 56px !important; } .section-wrapper:has(.seoh1-module) { padding-top: 32px !important; padding-bottom: 32px !important; } .main-content .module-head-title { margin-bottom: 24px !important; } .product-module-list-link-wrapper { margin-top: 24px !important; } .product-snapshot-vertical { margin-left: -12px !important; margin-right: -12px !important; row-gap: 0 !important; } .product-snapshot-vertical > .product-snapshot { padding-left: 12px !important; padding-right: 12px !important; margin-top: 24px !important; } .product-card { padding: 12px !important; height: 100%; display: flex !important; flex-direction: column !important; } .product-card .card__body { flex: 1 1 auto; } .product-card .card__footer { margin-top: auto; } .product-card__title { font-size: 14px !important; line-height: 1.35 !important; margin: 12px 0 8px !important; min-height: calc(3 * 1.35em); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; } .product-card__sku { font-size: 11px !important; opacity: .65; margin: 0 0 8px !important; } .product-card__price { font-size: 18px !important; font-weight: 800 !important; margin: 0 0 12px !important; } .product-card .button-add-to-cart { min-height: 44px; font-size: 13px !important; font-weight: 700 !important; } .page-head h1, .category-list-body h1 { margin-bottom: 16px !important; } .column-left .module { padding: 16px !important; margin-bottom: 16px !important; } .product-page-body h1, .product-body h1 { font-size: clamp(24px, 2.1vw, 32px) !important; line-height: 1.2 !important; margin-bottom: 16px !important; } .product-page-body select, .product-body select { min-height: 44px; min-width: 120px; font-size: 15px !important; } #add_to_cart.button-add-to-cart { min-height: 52px; } @media (max-width: 767px) { .module-dealofday-wrapper, .module-special-wrapper, .module-latest-wrapper, .section-wrapper:has(.location-module) { padding-top: 40px !important; padding-bottom: 40px !important; } .product-snapshot-vertical { margin-left: -6px !important; margin-right: -6px !important; } .product-snapshot-vertical > .product-snapshot { padding-left: 6px !important; padding-right: 6px !important; margin-top: 12px !important; } .product-card { padding: 8px !important; } .product-card__title { font-size: 13px !important; } .product-card__price { font-size: 16px !important; } } .product-page-body .product-price { font-size: 30px !important; font-weight: 800 !important; } .product-option__title { font-size: 15px !important; margin-bottom: 8px !important; }";
  var style = document.createElement('style');
  style.id = 'rr-spacing';
  style.type = 'text/css';
  style.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(style);

  /* The theme stores the header height once at load; with the one-row menu that height is too big. */
  function fixHeader() {
    var sticky = document.querySelector('.header-sticky');
    var header = sticky && sticky.querySelector('.header');
    if (!header || !/headroom--top/.test(sticky.className) || !header.offsetHeight) { return; }
    sticky.style.setProperty('--header-element-height', header.offsetHeight + 'px');
    var bottom = sticky.querySelector('.header-bottom');
    if (bottom && bottom.offsetHeight) { sticky.style.setProperty('--header-bottom-height', bottom.offsetHeight + 'px'); }
  }
  var timer = null;
  function later() { clearTimeout(timer); timer = setTimeout(fixHeader, 150); }
  if (document.readyState === 'complete') { later(); } else { window.addEventListener('load', later); }
  document.addEventListener('DOMContentLoaded', later);
  window.addEventListener('resize', later);
  setTimeout(fixHeader, 1500);
})();

/* Size guard (2026-11-04): no order without a size.
   1) Product page + quick view: no size is preselected ("Válassz méretet"); Kosárba without a size shows a
      warning instead of adding the product.
   2) Kosárba on a product card: if the product has sizes, the quick view opens so the size can be picked;
      products without sizes are added as before. */
(function () {
  'use strict';
  if (window.__rrSizeGuard) { return; }
  window.__rrSizeGuard = true;
  var PLACEHOLDER = 'Válassz méretet';
  var WARNING = 'Kérjük, válassz méretet!';

  function optionSelects(root) {
    return root ? Array.prototype.slice.call(root.querySelectorAll('select[name^="option["]')) : [];
  }
  /* add an empty first choice and select it, once per select */
  function addPlaceholder(select) {
    if (select.getAttribute('data-rr-placeholder')) { return; }
    select.setAttribute('data-rr-placeholder', '1');
    var opt = document.createElement('option');
    opt.value = '';
    opt.textContent = PLACEHOLDER;
    opt.disabled = true;
    select.insertBefore(opt, select.firstChild);
    select.value = '';
    select.selectedIndex = 0;
    select.addEventListener('change', function () { clearWarning(select); });
  }
  function warn(select) {
    select.style.setProperty('outline', '2px solid #e52421', 'important');
    var box = select.parentNode;
    if (!box.querySelector('.rr-size-warning')) {
      var p = document.createElement('div');
      p.className = 'rr-size-warning';
      p.style.cssText = 'color:#ff5a55;font-weight:700;font-size:14px;margin-top:6px';
      p.appendChild(document.createTextNode(WARNING));
      box.appendChild(p);
    }
    try { select.focus(); select.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* old browser */ }
  }
  function clearWarning(select) {
    select.style.removeProperty('outline');
    var w = select.parentNode.querySelector('.rr-size-warning');
    if (w) { w.parentNode.removeChild(w); }
  }
  function prepare(root) { optionSelects(root).forEach(addPlaceholder); }

  /* the product page form, and quick views as they open */
  function scan() { prepare(document.getElementById('product')); prepare(document.querySelector('.fancybox-quickview, .fancybox-content, .fancybox-container')); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', scan); } else { scan(); }
  if (window.MutationObserver) {
    new MutationObserver(function () { scan(); }).observe(document.documentElement, { childList: true, subtree: true });
  }

  var hasOptions = {};  /* product id -> true/false, from the quick view html */
  function checkOptions(id, done) {
    if (id in hasOptions) { done(hasOptions[id]); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/index.php?route=product/quickview&product_id=' + encodeURIComponent(id), true);
    xhr.onload = function () {
      hasOptions[id] = xhr.status === 200 && /name="option\[/.test(xhr.responseText);
      done(hasOptions[id]);
    };
    xhr.onerror = function () { done(false); };
    xhr.send();
  }

  document.addEventListener('click', function (event) {
    var btn = event.target && event.target.closest ? event.target.closest('.button-add-to-cart') : null;
    if (!btn || btn.getAttribute('data-rr-pass') === '1') { return; }

    /* product page / quick view: the form has the size picker */
    var form = btn.closest('form');
    var selects = optionSelects(form);
    if (selects.length) {
      var missing = selects.filter(function (s) { return !s.value; });
      if (missing.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        warn(missing[0]);
      }
      return;
    }

    /* product card: find out whether this product has sizes */
    var card = btn.closest('.product-card');
    var id = btn.getAttribute('data-product-id');
    if (!card || !id) { return; }
    event.preventDefault();
    event.stopImmediatePropagation();
    checkOptions(id, function (sized) {
      var quick = card.querySelector('.btn-quickview');
      var link = card.querySelector('a.product-card__title-link, a.product-card-image__link, a.product-card__details-button');
      if (sized && quick) {
        quick.click();
      } else if (sized) {
        /* cards without a quick view (product-page rows, cart popup): open the product to pick a size */
        if (link) { window.location.href = link.href; }
        else { window.location.href = '/index.php?route=product/product&product_id=' + encodeURIComponent(id); }
      } else {
        btn.setAttribute('data-rr-pass', '1');
        btn.click();
        btn.removeAttribute('data-rr-pass');
      }
    });
  }, true);
})();
