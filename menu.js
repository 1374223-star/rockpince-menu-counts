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
  /* perf (owner 2026-11-15, older phones lagged): links already checked are skipped on later passes;
     the link identities and the still-unknown links are kept between passes. */
  var hrefIds = {}, pendingLinks = [];
  function update() {
    var anchors = document.getElementsByTagName('a');
    var i, link, resolved, headings, currentId, urlKey;
    var unresolved = pendingLinks;
    /* Once a nested desktop link is safely identified, the mobile/flat copy
       with exactly the same host and path can inherit that identity. */
    for (i = 0; i < anchors.length; i += 1) {
      link = anchors[i];
      if (link.__rrSeen) { continue; }
      link.__rrSeen = true;
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
    pendingLinks = [];
    for (i = 0; i < unresolved.length; i += 1) {
      link = unresolved[i];
      if (!link.isConnected && link.isConnected !== undefined) { continue; }
      urlKey = '$' + link.hostname.toLowerCase() + String(link.pathname || '');
      if (Object.prototype.hasOwnProperty.call(hrefIds, urlKey) && hrefIds[urlKey]) {
        decorate(link, hrefIds[urlKey]);
      } else if (!Object.prototype.hasOwnProperty.call(hrefIds, urlKey)) { pendingLinks.push(link); }
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
    }, 200);
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
    '14025': { expand: [], extra: [], first: ['19518'], depth: 0 }
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
        out.push({ id: id, level: level, title: kids.length > 0 || (level === 0 && cfg.first.indexOf(id) >= 0) });
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
          var added = mutations[i].addedNodes, k;
          for (k = 0; added && k < added.length; k += 1) {
            if (added[k].nodeType === 1 && (added[k].tagName === 'A' || added[k].getElementsByTagName('a').length)) {
              scheduleUpdate(); return;
            }
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
      /* Shoprenter answers with an object keyed by code: {"simple": {...}, "cod": {...}} */
      if (!list && data && typeof data === 'object') {
        var removed = false;
        for (var key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key) && isCod(data[key])) { delete data[key]; removed = true; }
        }
        if (!removed) { return text; }
        setTimeout(showNotice, 300);
        return JSON.stringify(data);
      }
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
    /* owner 2026-11-14: edge-to-edge menu reverted ("looks weird"): centred, one row, as on 2026-11-04 */
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
  /* the checkout (/checkout#/...) has its own light design with dark text: leave it alone */
  if (/^\/checkout/.test(location.pathname)) { return; }
  var SKULL = "url('https://1374223-star.github.io/rockpince-menu-counts/assets/skull-hand-watermark.webp')";
  var NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='turbulence' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .62 0 0 0 0 .85 0 0 0 -2.2 1.05'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.06'/%3E%3C/svg%3E\")";
  var GLOW = 'radial-gradient(ellipse 70% 55% at 50% 35%, #0e4d78 0%, #07304f 40%, #031627 75%, #010811 100%)';
  var KNOT = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='22' viewBox='0 0 240 22'%3E%3Cdefs%3E%3ClinearGradient id='l' x1='0' x2='1'%3E%3Cstop offset='0' stop-color='%237fc4ea' stop-opacity='0'/%3E%3Cstop offset='1' stop-color='%237fc4ea'/%3E%3C/linearGradient%3E%3ClinearGradient id='r' x1='1' x2='0'%3E%3Cstop offset='0' stop-color='%237fc4ea' stop-opacity='0'/%3E%3Cstop offset='1' stop-color='%237fc4ea'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M4 11H100' stroke='url(%23l)' stroke-width='1.5'/%3E%3Cpath d='M140 11H236' stroke='url(%23r)' stroke-width='1.5'/%3E%3Cg fill='none' stroke='%237fc4ea' stroke-width='1.6'%3E%3Cpath d='M120 1A10 10 0 0 1 128.7 16A10 10 0 0 1 120 1Z'/%3E%3Cpath d='M128.7 16A10 10 0 0 1 111.3 16A10 10 0 0 1 128.7 16Z'/%3E%3Cpath d='M111.3 16A10 10 0 0 1 120 1A10 10 0 0 1 111.3 16Z'/%3E%3Ccircle cx='120' cy='11' r='6.2'/%3E%3C/g%3E%3Cpath d='M104 11l3-3 3 3-3 3zM130 11l3-3 3 3-3 3z' fill='%23e52421'/%3E%3C/svg%3E\")";
  var css =
    /* perf (owner 2026-11-15, older phones lagged on scroll): the grain + glow used background-attachment: fixed,
       which repaints the whole screen on every scroll frame on phones. Now it sits on its own fixed layer that the
       phone draws once and just keeps while the page scrolls over it. Looks the same. */
    'html { background: #020c18 !important; }' +
    'body, .layout-wrapper { background: transparent !important; }' +
    'body::before { content: ""; position: fixed; left: 0; top: 0; width: 100%; height: 100vh; height: 100lvh; z-index: -1; pointer-events: none;' +
    ' background: ' + NOISE + ', ' + GLOW + '; transform: translateZ(0); }' +
    '.section-wrapper:has(.seoh1-module), .section-wrapper:has(.advantages-module), .module-dealofday-wrapper, .header-bottom {' +
    ' background: ' + NOISE + ', linear-gradient(180deg, rgba(4,28,46,.55), rgba(2,12,24,.75)) !important; }' +
    '.section-wrapper:has(.advantages-module) { border-top: 1px solid rgba(127,196,234,.15); border-bottom: 1px solid rgba(127,196,234,.15); }' +
    /* perf (owner 2026-11-15): the theme slider's progress line under the thumbnails is resized every frame, which
       repainted the whole page each frame. Phones: hidden. Desktop: boxed in, so only the line itself repaints. */
    '.banner-progress__bar { contain: strict; will-change: transform; }' +
    '.slide--nav { contain: layout paint; }' +
    '@media (max-width: 991px), (hover: none) { .banner-progress__bar, .banner-progress { display: none !important; } }' +
    /* phones: glow only, no grain texture (owner 2026-11-15) - cheaper to draw, the grain is hardly visible there */
    '@media (max-width: 767px) { body::before { background: ' + GLOW + '; }' +
    ' .section-wrapper:has(.seoh1-module), .section-wrapper:has(.advantages-module), .module-dealofday-wrapper, .header-bottom {' +
    ' background: linear-gradient(180deg, rgba(4,28,46,.55), rgba(2,12,24,.75)) !important; } }' +
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

/* Search "new rock" (2026-11-04): a plain brand search opens the NEW ROCK™ folder, where the boots
   (FÉRFI / UNISEX, NŐI) come first, instead of a result list that starts with small accessories.
   More specific searches ("new rock wall", a product code) stay normal searches. */
(function () {
  'use strict';
  var TARGET = '/cipo_bakancs-14232/new-rock-19438';
  var m = /[?&]keyword=([^&#]*)/.exec(location.search);
  if (!m || !/route=product\/list/.test(location.search) || /[?&](sort|page|category_id)=/.test(location.search)) { return; }
  var q;
  try { q = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return; }
  q = q.toLowerCase().replace(/[^a-z0-9áéíóöőúüű ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(new ?rock)( (bakancs|bakancsok|cipo|cipő|csizma|boots?))?$/.test(q)) { location.replace(TARGET); }
})();

/* Free-shipping progress bar (2026-11-04): on the basket page and in the "Kosárba raktad!" popup.
   Free shipping from 30 000 Ft (GLS, as on the site); total = gross basket value (ShopRenter.cart). */
(function () {
  'use strict';
  if (window.__rrShipBar) { return; }
  window.__rrShipBar = true;
  var LIMIT = 30000;
  function total() {
    var items = (window.ShopRenter && ShopRenter.cart && ShopRenter.cart.items) || [];
    var sum = 0;
    for (var i = 0; i < items.length; i++) { sum += Number(items[i].totalNumber || 0); }
    return Math.round(sum);
  }
  function ft(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Ft'; }
  function html(sum) {
    var left = LIMIT - sum, pct = Math.max(4, Math.min(100, Math.round(sum / LIMIT * 100))), done = left <= 0;
    var text = done ? '<strong>Ingyenes a szállítás!</strong> A kosarad értéke elérte a ' + ft(LIMIT) + '-ot.'
                    : 'Még <strong>' + ft(left) + '</strong> és <strong>ingyenes</strong> a szállítás!';
    return '<div style="font-size:15px;color:#1b1b1b;margin-bottom:6px">' + text + '</div>' +
      '<div style="height:8px;background:#e9e9e9;border-radius:4px;overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:' + (done ? '#1b8a4c' : '#e52421') + ';transition:width .4s"></div></div>';
  }
  function place(target, where, sum) {
    if (!target) { return; }
    var box = target.querySelector(':scope > .rr-shipbar') || (where === 'before' && target.previousElementSibling &&
      target.previousElementSibling.classList.contains('rr-shipbar') ? target.previousElementSibling : null);
    if (!box) {
      box = document.createElement('div');
      box.className = 'rr-shipbar';
      box.style.cssText = 'background:#fff;border:1px solid #e3e3e3;border-radius:6px;padding:12px 16px;margin:0 0 16px';
      if (where === 'before') { target.parentNode.insertBefore(box, target); } else { target.insertBefore(box, target.firstChild); }
    }
    if (box.getAttribute('data-sum') === String(sum)) { return; }  /* unchanged: no DOM write (no observer loop) */
    box.setAttribute('data-sum', String(sum));
    if (!sum) { box.style.display = 'none'; return; }
    box.style.display = '';
    box.innerHTML = html(sum);
  }
  /* outside the basket page ShopRenter.cart is not loaded: ask the mini-cart endpoint for the total */
  var asking = false;
  function remoteTotal(done) {
    if (asking) { return; }
    asking = true;
    var x = new XMLHttpRequest();
    x.open('POST', '/index.php?route=module/cart/callback', true);
    x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    x.onloadend = function () {
      asking = false;
      try {
        var t = JSON.parse(x.responseText).total || '';
        done(Number(String(t).replace(/[^0-9]/g, '')) || 0);
      } catch (e) { /* leave the popup as it is */ }
    };
    x.send();
  }
  function render() {
    var table = document.querySelector('.sr-cart-table-wrapper');
    if (table && window.ShopRenter && ShopRenter.cart) { place(table, 'before', total()); }
    var head = null, all = document.querySelectorAll('.fancybox-container *');
    for (var i = 0; i < all.length && !head; i++) {
      if (!all[i].children.length && /Kosárba raktad/.test(all[i].textContent)) { head = all[i]; }
    }
    if (!head) { return; }
    var pop = head.closest('.fancybox-content') || head.parentNode;
    if (pop.querySelector('.rr-shipbar[data-sum]') && pop.getAttribute('data-rr-asked')) { return; }
    pop.setAttribute('data-rr-asked', '1');
    remoteTotal(function (sum) { place(pop, 'first', sum); });
  }
  function later() { setTimeout(render, 400); setTimeout(render, 1500); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', later); } else { later(); }
  document.addEventListener('cartChanged', later);
  if (window.MutationObserver) {
    var t = null;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(render, 300); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();

/* "Ehhez ajánljuk" cross-sell row (2026-11-04), on product pages below the advantages strip:
   boots -> laces / care (Bakancsfűzők és ápolási termékek) + boot ornaments (Cipődíszek, pántok);
   band merch -> patches of the same band ("<band> felvarró" search). Loaded from the shop's own
   listing pages, so it is always current and needs no product data. */
(function () {
  'use strict';
  if (window.__rrXsell || !/product-page-body/.test(document.body ? document.body.className : '')) { return; }
  window.__rrXsell = true;
  var WANT = window.matchMedia && window.matchMedia('(max-width: 767px)').matches ? 4 : 5;

  function crumbs() {
    return Array.prototype.map.call(document.querySelectorAll('.breadcrumb li'), function (li) {
      return li.textContent.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
    });
  }
  function fetchCards(query, done) {
    var x = new XMLHttpRequest();
    x.open('GET', '/index.php?route=product/list&' + query, true);
    x.onload = function () {
      var cards = [];
      try {
        var doc = new DOMParser().parseFromString(x.responseText, 'text/html');
        cards = Array.prototype.slice.call(doc.querySelectorAll('.product-snapshot .product-card'));
      } catch (e) { /* nothing */ }
      done(cards);
    };
    x.onerror = function () { done([]); };
    x.send();
  }
  function idOf(card) {
    var b = card.querySelector('[data-product-id]');
    return b ? b.getAttribute('data-product-id') : '';
  }
  function show(cards) {
    var anchor = document.querySelector('.product-advantages-module');
    anchor = anchor && (anchor.closest('.section-wrapper') || anchor);
    var self = (document.querySelector('form#product input[name="product_id"]') || {}).value;
    var seen = {}, picked = [];
    for (var i = 0; i < cards.length && picked.length < WANT; i++) {
      var id = idOf(cards[i]);
      if (!id || id === self || seen[id]) { continue; }
      seen[id] = true;
      picked.push(cards[i]);
    }
    if (!anchor || picked.length < 2) { return; }
    var box = document.createElement('div');
    box.className = 'rr-xsell container';
    box.innerHTML = '<h3 class="module-head-title h2" style="text-align:center">Ehhez ajánljuk</h3><div class="rr-xsell-grid"></div>';
    var grid = box.querySelector('.rr-xsell-grid');
    picked.forEach(function (card) {
      Array.prototype.forEach.call(card.querySelectorAll('img[data-src]'), function (img) {
        img.setAttribute('src', img.getAttribute('data-src'));
      });
      Array.prototype.forEach.call(card.querySelectorAll('img[loading="lazy"]'), function (img) { img.removeAttribute('loading'); });
      var wrap = document.createElement('div');
      wrap.className = 'product-snapshot list_div_item';  /* same wrapper as on listing pages (theme styles) */
      wrap.appendChild(document.importNode(card, true));
      grid.appendChild(wrap);
    });
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
  }

  function run() {
    var btn = document.querySelector('form#product #add_to_cart[data-name]');
    var c = crumbs(), title = (btn && btn.getAttribute('data-name')) || ((document.querySelector('.product-page-top h1') || {}).textContent || '');
    var path = c.join(' > ');
    if (/BAKANCSOK/.test(path) && !/FŰZŐ|ÁPOLÁS|CIPŐDÍSZ/.test(path)) {
      fetchCards('category_id=14247', function (laces) {
        fetchCards('category_id=14634', function (orn) { show(laces.slice(0, 3).concat(orn.slice(0, 6), laces.slice(3))); });
      });
      return;
    }
    if (/ZENEKAROS/.test(path) && !/FELVARR/.test(path) && title.indexOf(' - ') > 0) {
      var band = title.split(' - ')[0].trim();
      if (band.length >= 2 && band.length <= 40) {
        fetchCards('keyword=' + encodeURIComponent(band + ' felvarró'), function (patches) {
          var b = band.toUpperCase();
          show(patches.filter(function (card) {
            var t = ((card.querySelector('.product-card__title') || {}).textContent || '').trim().toUpperCase();
            return t.indexOf(b) === 0;  /* only this band's patches */
          }));
        });
      }
    }
  }
  var style = document.createElement('style');
  style.textContent = '.rr-xsell{padding:40px 0 16px}.rr-xsell .module-head-title{margin-bottom:24px!important}' +
    '.rr-xsell-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:24px}' +
    '.rr-xsell-grid>.product-snapshot{padding:0!important;margin:0!important;width:auto!important;max-width:none!important}' +
    '@media (max-width:767px){.rr-xsell-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}';
  (document.head || document.documentElement).appendChild(style);
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); } else { run(); }
})();

/* "Kínálatunkból véletlenszerűen" (2026-11-04): homepage row after Újdonságok with 5 random products
   (random switched-on leaf category, random page of it) and a "Mutass mást" button for a new set. */
(function () {
  'use strict';
  if (window.__rrRandom || !/home-body/.test(document.body ? document.body.className : '')) { return; }
  window.__rrRandom = true;
  var COUNTS = 'https://1374223-star.github.io/rockpince-menu-counts/category_counts.json';
  var PER_PAGE = 48;
  var WANT = window.matchMedia && window.matchMedia('(max-width: 767px)').matches ? 4 : 5;
  var leaves = [];

  function get(url, done) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.onload = function () { done(x.status === 200 ? x.responseText : ''); };
    x.onerror = function () { done(''); };
    x.send();
  }
  function pickLeaves(counts) {
    var parents = {};
    Object.keys(counts).forEach(function (id) { parents[counts[id][2]] = true; });
    return Object.keys(counts).filter(function (id) {
      var c = counts[id];
      return !parents[id] && c[1] >= 10 && (c.length < 6 || String(c[5]) === '1');
    }).map(function (id) { return { id: id, n: counts[id][1] }; });
  }
  function pickLeaf() {
    /* bigger categories are picked more often, so the mix follows the catalogue */
    var total = leaves.reduce(function (s, l) { return s + l.n; }, 0), r = Math.random() * total;
    for (var i = 0; i < leaves.length; i++) { r -= leaves[i].n; if (r <= 0) { return leaves[i]; } }
    return leaves[leaves.length - 1];
  }
  /* owner 2026-11-14 ("main page awfully slow"): every visit used to download 5+ whole category pages
     (~2 s each on the server). Now each downloaded page leaves up to 8 of its products in a pool kept in the
     visitor's browser for 2 hours; the row and "Mutass mást" draw from the pool and only fetch when it runs low. */
  var POOL_KEY = 'rr-random-pool', POOL_TTL = 2 * 3600 * 1000;
  function readPool() {
    try {
      var p = JSON.parse(localStorage.getItem(POOL_KEY) || 'null');
      return p && Date.now() - p.t < POOL_TTL ? p.items : [];
    } catch (e) { return []; }
  }
  function savePool(items) {
    try { localStorage.setItem(POOL_KEY, JSON.stringify({ t: (JSON.parse(localStorage.getItem(POOL_KEY) || 'null') || {}).t || Date.now(), items: items.slice(-80) })); } catch (e) { /* full or private */ }
  }
  function toCard(html) {
    var d = document.createElement('div'); d.innerHTML = html;
    return d.firstElementChild;
  }
  function oneCard(done) {
    var leaf = pickLeaf(), page = 1 + Math.floor(Math.random() * Math.max(1, Math.ceil(leaf.n / PER_PAGE)));
    get('/index.php?route=product/list&category_id=' + leaf.id + '&page=' + page, function (htmlText) {
      var cards = [];
      try { cards = Array.prototype.slice.call(new DOMParser().parseFromString(htmlText, 'text/html')
        .querySelectorAll('.product-snapshot .product-card')); } catch (e) { /* nothing */ }
      if (cards.length) {
        var pool = readPool();
        cards.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 8)
          .forEach(function (c) { pool.push({ leaf: leaf.id, html: c.outerHTML }); });
        savePool(pool);
      }
      done(cards.length ? cards[Math.floor(Math.random() * cards.length)] : null, leaf.id);
    });
  }
  /* WANT products from different categories out of the stored pool, or null if the pool is too thin */
  function fromPool() {
    var pool = readPool().slice().sort(function () { return Math.random() - 0.5; }), used = {}, out = [];
    for (var i = 0; i < pool.length && out.length < WANT; i++) {
      if (!used[pool[i].leaf]) { used[pool[i].leaf] = true; var c = toCard(pool[i].html); if (c) { out.push(c); } }
    }
    return out.length >= WANT && pool.length >= WANT * 4 ? out : null;
  }
  /* one product from each of WANT different random categories */
  function load(grid, button) {
    if (!leaves.length) { return; }
    var cached = fromPool();
    if (cached) { render(grid, cached); return; }
    button.disabled = true;
    var got = [], used = {}, pending = 0, rounds = 0;
    function ask() {
      while (pending + got.length < WANT && rounds < WANT * 3) {
        pending++; rounds++;
        oneCard(function (card, leafId) {
          pending--;
          if (card && !used[leafId]) { used[leafId] = true; got.push(card); }
          if (got.length >= WANT || (pending === 0 && rounds >= WANT * 3)) { finish(); } else { ask(); }
        });
      }
    }
    function finish() {
      if (finish.done) { return; }
      finish.done = true;
      button.disabled = false;
      if (got.length < 2) { return; }
      render(grid, got);
    }
    ask();
  }
  function render(grid, got) {
    {
      grid.innerHTML = '';
      got.slice(0, WANT).forEach(function (card) {
        Array.prototype.forEach.call(card.querySelectorAll('img[data-src]'), function (img) { img.setAttribute('src', img.getAttribute('data-src')); });
        Array.prototype.forEach.call(card.querySelectorAll('img[loading="lazy"]'), function (img) { img.removeAttribute('loading'); });
        var wrap = document.createElement('div');
        wrap.className = 'product-snapshot list_div_item';
        wrap.appendChild(document.importNode(card, true));
        grid.appendChild(wrap);
      });
    }
  }
  function build() {
    var after = document.querySelector('.module-latest-wrapper') || document.querySelector('.module-special-wrapper');
    if (!after) { return; }
    var box = document.createElement('div');
    box.className = 'rr-random';
    box.innerHTML = '<div class="container"><h3 class="module-head-title h2" style="text-align:center">Kínálatunkból véletlenszerűen</h3>' +
      '<div class="rr-random-grid"></div><div style="text-align:center;margin-top:24px">' +
      '<button type="button" class="btn btn-primary rr-random-more">Mutass mást</button></div></div>';
    after.parentNode.insertBefore(box, after.nextSibling);
    var grid = box.querySelector('.rr-random-grid'), button = box.querySelector('.rr-random-more');
    button.addEventListener('click', function () { load(grid, button); });
    function start() {
      get(COUNTS, function (text) {
        try { leaves = pickLeaves(JSON.parse(text).counts || {}); } catch (e) { leaves = []; }
        if (!leaves.length) { box.parentNode.removeChild(box); return; }
        load(grid, button);
      });
    }
    /* load only when the visitor scrolls near the row (saves 5 page loads for everyone else) */
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); start(); }
      }, { rootMargin: '800px 0px' });
      io.observe(box);
    } else { start(); }
  }
  var style = document.createElement('style');
  style.textContent = '.rr-random{padding:56px 0}.rr-random .module-head-title{margin-bottom:24px!important}' +
    '.rr-random-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:24px;min-height:420px}' +
    '.rr-random-grid>.product-snapshot{padding:0!important;margin:0!important;width:auto!important;max-width:none!important}' +
    '.rr-random-more{background:#e52421!important;border-color:#e52421!important;color:#fff!important;font-weight:700;padding:12px 28px}' +
    '@media (max-width:767px){.rr-random{padding:40px 0}.rr-random-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-height:0}}';
  (document.head || document.documentElement).appendChild(style);
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', build); } else { build(); }
})();

/* Cookie bar at the bottom (2026-11-04): while it is showing, lift the Fogyasztóbarát badge above it so
   the badge does not cover the cookie text; when the bar closes the badge goes back down. */
(function () {
  'use strict';
  if (window.__rrBadgeLift) { return; }
  window.__rrBadgeLift = true;
  function adjust() {
    var bar = document.querySelector('.nanobar-cookie-box');
    var badge = document.getElementById('fb_header_box');  /* only the small badge (its wrapper holds a hidden panel) */
    if (!badge) { return; }
    var shown = bar && bar.offsetHeight > 0 && getComputedStyle(bar).display !== 'none' && getComputedStyle(bar).visibility !== 'hidden';
    var nav = document.querySelector('.rr-bottomnav');
    var navH = nav && nav.offsetHeight ? nav.offsetHeight : 0;  /* phone bottom bar, when it is showing */
    var px = (shown ? bar.offsetHeight + 8 : 0) + navH;
    shown = px > 0;
    var lift = shown ? px + 'px' : '';
    if (badge.getAttribute('data-rr-lift') === lift) { return; }
    badge.setAttribute('data-rr-lift', lift);
    badge.style.setProperty('transform', shown ? 'translateY(-' + lift + ')' : '');
    badge.style.setProperty('transition', 'transform .2s');
  }
  setInterval(adjust, 2000);
  document.addEventListener('click', function () { setTimeout(adjust, 350); }, true);
  window.addEventListener('resize', adjust);
})();

/* Trust row under Kosárba (2026-11-04): three short, true reassurances in the product page buy box. */
(function () {
  'use strict';
  if (window.__rrTrust || !/product-page-body/.test(document.body ? document.body.className : '')) { return; }
  window.__rrTrust = true;
  var ICON = {
    shop: '<path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6"/>',
    truck: '<path d="M1 6h13v10H1zM14 10h4l3 3v3h-7M5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
  };
  var ROWS = [
    ['shop', 'Ingyenes személyes átvétel budapesti boltunkban'],
    ['truck', 'Ingyenes szállítás 30 000 Ft felett'],
    ['lock', 'Biztonságos online bankkártyás fizetés (SimplePay)']
  ];
  function build() {
    var box = document.querySelector('.product-cart-box');
    if (!box || box.querySelector('.rr-trust')) { return; }
    var list = document.createElement('ul');
    list.className = 'rr-trust';
    list.innerHTML = ROWS.map(function (r) {
      return '<li><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[r[0]] + '</svg><span>' + r[1] + '</span></li>';
    }).join('');
    box.appendChild(list);
  }
  var style = document.createElement('style');
  style.textContent = '.rr-trust{list-style:none;margin:18px 0 0;padding:14px 0 0;border-top:1px solid rgba(255,255,255,.12)}' +
    '.rr-trust li{display:flex;align-items:center;gap:10px;font-size:13.5px;line-height:1.35;color:#d7e6f1;margin:0 0 8px}' +
    '.rr-trust li:last-child{margin-bottom:0}.rr-trust svg{flex:0 0 18px;color:#7fc4ea}';
  (document.head || document.documentElement).appendChild(style);
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', build); } else { build(); }
})();

/* App-style bottom bar on phones (2026-11-04): Főoldal / Kategóriák / Keresés / Kosár, fixed at the bottom.
   Not on product pages (the theme's sticky Kosárba bar is there) and not in the checkout. */
(function () {
  'use strict';
  if (window.__rrBottomNav) { return; }
  window.__rrBottomNav = true;
  var body = document.body;
  if (!body || /product-page-body/.test(body.className) || /^\/checkout/.test(location.pathname)) { return; }
  var H = 60;
  var ICON = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    cart: '<path d="M2 4.5h2.7l2.6 11.6h11.6l2.5-8.1H6"/><circle cx="9.5" cy="19.6" r="1.5"/><circle cx="17.2" cy="19.6" r="1.5"/>'  /* cart, like the header (2026-11-15) */
  };
  function svg(name) {
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + '</svg>';
  }
  function build() {
    if (document.querySelector('.rr-bottomnav')) { return; }
    var nav = document.createElement('nav');
    nav.className = 'rr-bottomnav';
    nav.setAttribute('aria-label', 'Gyors menü');
    nav.innerHTML =
      '<a href="/" class="rr-bn-item">' + svg('home') + '<span>Főoldal</span></a>' +
      '<button type="button" class="rr-bn-item rr-bn-menu">' + svg('menu') + '<span>Kategóriák</span></button>' +
      '<button type="button" class="rr-bn-item rr-bn-search">' + svg('search') + '<span>Keresés</span></button>' +
      '<a href="/index.php?route=checkout/cart" class="rr-bn-item rr-bn-cart">' + svg('cart') + '<span>Kosár</span><b class="rr-bn-count"></b></a>';
    body.appendChild(nav);
    nav.querySelector('.rr-bn-menu').addEventListener('click', function () {
      var b = document.getElementById('js-hamburger-icon');
      if (b) { b.click(); }
    });
    nav.querySelector('.rr-bn-search').addEventListener('click', function () {
      var i = document.getElementById('filter_keyword');
      if (!i) { location.href = '/index.php?route=product/list'; return; }
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
      setTimeout(function () { i.focus(); }, 250);
    });
    body.classList.add('rr-has-bottomnav');
    window.__rrBottomNavHeight = H;
    count();
  }
  /* basket count: mirror the number shown on the header basket icon */
  function count() {
    var t = document.querySelector('.cart-dropdown-toggle');
    var n = t ? ((t.textContent || '').match(/\d+/) || [''])[0] : '';
    var b = document.querySelector('.rr-bn-count');
    if (b) { b.textContent = n; b.style.display = n && n !== '0' ? '' : 'none'; }  /* empty basket: no dot */
  }
  var style = document.createElement('style');
  style.textContent =
    '.rr-bottomnav{display:none}' +
    '@media (max-width:767px){' +
    ' .rr-bottomnav{display:flex;position:fixed;left:0;right:0;bottom:0;height:' + H + 'px;z-index:1020;' +
    '  background:rgba(4,20,34,.97);border-top:1px solid rgba(127,196,234,.25);padding-bottom:env(safe-area-inset-bottom)}' +
    ' .rr-bn-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;' +
    '  color:#d7e6f1!important;font-size:11px;font-weight:600;background:none;border:0;text-decoration:none!important;position:relative}' +
    ' .rr-bn-item:active{color:#fff!important;background:rgba(127,196,234,.12)}' +
    ' .rr-bn-count{position:absolute;top:6px;left:calc(50% + 6px);min-width:18px;height:18px;border-radius:9px;background:#e52421;' +
    '  color:#fff;font-size:11px;line-height:18px;text-align:center;padding:0 4px}' +
    ' body.rr-has-bottomnav{padding-bottom:' + H + 'px!important}' +
    ' body.rr-has-bottomnav .scroll-top-button{bottom:' + (H + 16) + 'px!important}' +
    '}';
  (document.head || document.documentElement).appendChild(style);
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', build); } else { build(); }
  setInterval(count, 1500);
})();

/* Google rating line in the trust row (2026-11-04): real numbers from the shop's Google Maps listing
   "Rockpince RagnaRock" on 2026-11-04 (4,4 from 932 reviews); links to the reviews. Update by hand. */
(function () {
  'use strict';
  if (window.__rrGoogle) { return; }
  window.__rrGoogle = true;
  var RATING = '4,4', COUNT = '932';
  var URL = 'https://www.google.com/maps/search/?api=1&query=Rockpince+RagnaRock+Budapest+D%C3%B3zsa+Gy%C3%B6rgy+%C3%BAt+19';
  function add() {
    var list = document.querySelector('.rr-trust');
    if (!list) { return false; }
    if (list.querySelector('.rr-google')) { return true; }
    var li = document.createElement('li');
    li.className = 'rr-google';
    li.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="#f5c518" aria-hidden="true">' +
      '<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/></svg>' +
      '<span><a href="' + URL + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">' +
      '<strong style="color:#fff">' + RATING + '</strong> · ' + COUNT + ' Google-értékelés</a></span>';
    list.appendChild(li);
    return true;
  }
  var tries = 0, t = setInterval(function () { if (add() || ++tries > 20) { clearInterval(t); } }, 300);
})();

/* Hover zoom on product photos, desktop only (2026-11-04): moving the mouse over the main photo shows a
   1.8x close-up of the sharp 1000 px version; clicking still opens the theme's full-screen viewer. */
(function () {
  'use strict';
  if (window.__rrHoverZoom || !/product-page-body/.test(document.body ? document.body.className : '')) { return; }
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 992px)').matches) { return; }
  window.__rrHoverZoom = true;
  var SCALE = 1.8;
  document.addEventListener('mouseover', function (e) {
    var link = e.target.closest && e.target.closest('.product-image__main-link');
    if (!link || link.getAttribute('data-rr-zoom')) { return; }
    var img = link.querySelector('img');
    if (!img) { return; }
    link.setAttribute('data-rr-zoom', '1');
    link.style.overflow = 'hidden';
    img.style.transition = 'transform .15s ease-out';
    var big = link.getAttribute('href');
    if (big && /\.(jpe?g|png|webp)/i.test(big)) {
      var pre = new Image();
      pre.onload = function () { img.setAttribute('data-rr-small', img.src); img.src = big; };
      pre.src = big;
    }
    link.addEventListener('mousemove', function (ev) {
      var r = link.getBoundingClientRect();
      img.style.transformOrigin = ((ev.clientX - r.left) / r.width * 100) + '% ' + ((ev.clientY - r.top) / r.height * 100) + '%';
      img.style.transform = 'scale(' + SCALE + ')';
    });
    link.addEventListener('mouseleave', function () { img.style.transform = ''; });
    link.style.cursor = 'zoom-in';
  });
})();

/* "Mutass még" on listing pages (2026-11-04): loads the next page's products under the current ones,
   without leaving the page. Page numbers stay (they follow along). Works on category and search lists. */
(function () {
  'use strict';
  if (window.__rrLoadMore) { return; }
  window.__rrLoadMore = true;
  function grid() { return document.querySelector('.product-list .product-snapshot-vertical'); }
  function nextLink(root) {
    var all = (root || document).querySelectorAll('a[data-test-id="nextPageIcon"]');
    return all.length ? all[all.length - 1] : null;
  }
  function build() {
    var g = grid(), next = nextLink();
    if (!g || !next || document.querySelector('.rr-loadmore')) { return; }
    var wrap = document.createElement('div');
    wrap.className = 'rr-loadmore';
    wrap.innerHTML = '<button type="button" class="btn btn-primary rr-loadmore-btn">Mutass még</button>' +
      '<div class="rr-loadmore-info"></div>';
    g.parentNode.insertBefore(wrap, g.nextSibling);
    var btn = wrap.querySelector('button'), info = wrap.querySelector('.rr-loadmore-info');
    var url = next.getAttribute('href');
    function count() {
      var shown = g.querySelectorAll('.product-snapshot').length;
      var total = ((document.querySelector('h1') || {}).textContent || '').match(/\[(\d+)\]/);
      info.textContent = shown + (total ? ' / ' + total[1] : '') + ' termék';
    }
    count();
    btn.addEventListener('click', function () {
      if (!url) { return; }
      btn.disabled = true;
      btn.textContent = 'Betöltés…';
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.onload = function () {
        var doc = null;
        try { doc = new DOMParser().parseFromString(x.responseText, 'text/html'); } catch (e) { /* keep page */ }
        var items = doc ? doc.querySelectorAll('.product-list .product-snapshot-vertical > .product-snapshot') : [];
        Array.prototype.forEach.call(items, function (it) {
          Array.prototype.forEach.call(it.querySelectorAll('img[data-src]'), function (img) { img.setAttribute('src', img.getAttribute('data-src')); });
          Array.prototype.forEach.call(it.querySelectorAll('img[loading="lazy"]'), function (img) { img.removeAttribute('loading'); });
          Array.prototype.forEach.call(it.querySelectorAll('[data-aos]'), function (el) { el.removeAttribute('data-aos'); });
          it.removeAttribute('data-aos');
          g.appendChild(document.importNode(it, true));
        });
        /* page numbers follow the last loaded page */
        var newPag = doc && doc.querySelectorAll('.pagination'), oldPag = document.querySelectorAll('.pagination');
        if (newPag && newPag.length && oldPag.length) {
          oldPag[oldPag.length - 1].innerHTML = newPag[newPag.length - 1].innerHTML;
        }
        /* the address stays on the first page: Back from a product restores all loaded pages (round 5) */
        wrap.setAttribute('data-loaded', String(Number(wrap.getAttribute('data-loaded') || 0) + 1));
        var n = doc && nextLink(doc);
        url = n ? n.getAttribute('href') : null;
        btn.disabled = false;
        btn.textContent = 'Mutass még';
        if (!url || !items.length) { btn.style.display = 'none'; }
        count();
      };
      x.onerror = function () { btn.disabled = false; btn.textContent = 'Mutass még'; };
      x.send();
    });
  }
  var style = document.createElement('style');
  style.textContent = '.rr-loadmore{text-align:center;margin:32px 0 8px}' +
    '.rr-loadmore-btn{background:#e52421!important;border-color:#e52421!important;color:#fff!important;font-weight:700;' +
    'padding:14px 40px;font-size:15px;min-width:220px}.rr-loadmore-btn:disabled{opacity:.7}' +
    '.rr-loadmore-info{margin-top:10px;font-size:13px;color:#b9cddd}';
  (document.head || document.documentElement).appendChild(style);
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', build); } else { build(); }
})();

/* Owner 2026-11-12: ÚJDONSÁGOK opens sorted by "Elérhetőség, legújabb" (newest first) on PC and phone.
   Links to it get the sort added when clicked; landing on it without any sort switches to it.
   A sort the visitor picks in the list (price, name, ...) is always kept. */
(function () {
  var SORT = 'sort=p.date_available&order=DESC';
  function isNew(url) {
    return /\/ujdonsagok2-18914(?:[?#]|$)/.test(url) || /[?&]category_id=18914(?:[&#]|$)/.test(url);
  }
  function withSort(href) {
    if (!href || !isNew(href) || /[?&]sort=/.test(href)) { return href; }
    var hash = '', i = href.indexOf('#');
    if (i >= 0) { hash = href.slice(i); href = href.slice(0, i); }
    return href + (href.indexOf('?') >= 0 ? '&' : '?') + SORT + hash;
  }
  try {
    if (isNew(location.pathname + location.search) && !/[?&]sort=/.test(location.search)) {
      location.replace(withSort(location.href));
      return;
    }
  } catch (e) { /* keep the page as it is */ }
  if (!document.addEventListener) { return; }
  document.addEventListener('click', function (ev) {
    var a = ev.target;
    while (a && a.nodeName !== 'A') { a = a.parentNode; }
    if (!a || !a.getAttribute) { return; }
    var href = a.getAttribute('href'), sorted = withSort(href);
    if (sorted !== href) { a.setAttribute('href', sorted); }
  }, true);
})();

/* Wider pages, tighter spacing, caps labels (owner 2026-11-14: "everything is always tight, filled ...
   no weird large empty spaces"; "all texts all caps like ... headings, buttons; descriptions not").
   Width (middle version, owner chose it over full-bleed after the before/after comparison):
   - page content grows to 1800 px (the theme stopped at 960-1440 px), centred, small side margin
   - product lists add columns as the screen grows; homepage product sliders ~1 card per 290 px
   - product pages keep the theme width (owner 2026-11-14: "the product page doesnt need the stretch")
   Knot divider under homepage titles removed (owner: "remove these weird symbol lines").
   Spacing: product blocks had 130 px below each, homepage sections 56 px padding, an empty product
   tab box (120 px) and a 279 px footer logo; phone category pages repeated three side boxes
   (follow us, customer service photo, full shipping-cost list) under the products.
   Caps: section titles, buttons, header + footer menu links, filter/sort/size labels, cart popup. */
(function () {
  'use strict';
  if (document.getElementById('rr-fluid')) { return; }
  if (/^\/checkout/.test(location.pathname)) { return; }
  var W = 'min(100%, 1800px)';
  var css =
    /* width */
    '@media (min-width: 576px) {' +
    ' body:not(.product-page-body) .layout-wrapper .container, body:not(.product-page-body) .footer-container { max-width: ' + W + ' !important; width: 100% !important;' +
    '   padding-left: clamp(16px, 2vw, 40px) !important; padding-right: clamp(16px, 2vw, 40px) !important; }' +
    ' .slick-slider .slick-prev.custom-slick-arrow { left: 0 !important; z-index: 5; }' +
    ' .slick-slider .slick-next.custom-slick-arrow { right: 0 !important; z-index: 5; }' +
    '}' +
    '@media (min-width: 992px) {' +
    ' .product-snapshot-vertical:not(.slick-slider) { display: grid !important;' +
    '   grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }' +
    /* owner 2026-11-14: "only 5 columns ... so the pics were bigger": 4 on small laptops, never more than 5 */
    ' @media (min-width: 1200px) { .product-snapshot-vertical:not(.slick-slider) { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; } }' +
    ' .product-snapshot-vertical:not(.slick-slider) > .product-snapshot { max-width: none !important; width: auto !important; flex: none !important; }' +
    '}' +
    /* spacing */
    '.module.product-position, .module.home-position { margin-bottom: clamp(24px, 2.2vw, 36px) !important; }' +
    '.module-dealofday-wrapper, .module-special-wrapper, .module-latest-wrapper, .section-wrapper:has(.location-module) {' +
    ' padding-top: clamp(20px, 2vw, 32px) !important; padding-bottom: clamp(20px, 2vw, 32px) !important; }' +
    '.rr-random { padding-top: clamp(20px, 2vw, 32px) !important; padding-bottom: clamp(20px, 2vw, 32px) !important; }' +
    '.section-wrapper:has(.seoh1-module), .section-wrapper:has(.advantages-module) { padding-top: 16px !important; padding-bottom: 16px !important; }' +
    '.section-wrapper:has(.newsletter_subscribe-module), #module_newsletter_subscribe_wrapper { padding-top: 24px !important; padding-bottom: 24px !important; }' +
    '.main-content .module-head-title, .module-head-title { margin-bottom: 14px !important; }' +
    '.home-body .main-content .module-head-title::after { content: none !important; display: none !important; }' +
    '.product-module-list-link-wrapper { margin-top: 16px !important; }' +
    /* bigger buttons instead of empty space */
    '.modules-all-link, .rr-random-more, .rr-loadmore-btn, .location-button { font-size: 15px !important; font-weight: 700 !important;' +
    ' padding: 14px 36px !important; min-width: min(320px, 90vw); border-radius: 4px; }' +
    '.product-card .button-add-to-cart { min-height: 46px !important; font-size: 14px !important; }' +
    '.product-page-tab.rr-empty { display: none !important; }' +
    'footer .ragna-rock-logo img { max-height: clamp(110px, 10vw, 170px) !important; width: auto !important; }' +
    'footer .ragna-rock-logo { text-align: center; }' +
    '.footer-middle { padding-top: 32px !important; padding-bottom: 32px !important; margin-bottom: 24px !important; }' +
    '@media (max-width: 991px) {' +
    ' #module_customcontent2_wrapper, #module_customcontent3_wrapper, #module_customcontent4_wrapper { display: none !important; }' +
    '}' +
    /* caps */
    '.module-head-title, .location-title, .product-option__title, .sort-label, .product-option__name, .quantity-text,' +
    ' .btn, button.btn, a.button, .button-add-to-cart, .modules-all-link, .rr-loadmore-btn, .rr-random-more,' +
    ' .headermenu-list .nav-link, .information-box__item-link, .rr-loadmore-info, .sortbar select, .product-options select,' +
    ' .modal-title, .modal .btn, .cart-popup__success-text, .rr-shipbar, [class*=popup] .btn, [class*=popup] h3, [class*=popup] h4,' +
    ' .location-description strong, .product-page-right-box h6 { text-transform: uppercase !important; letter-spacing: .02em; }';
  var style = document.createElement('style');
  style.id = 'rr-fluid';
  style.type = 'text/css';
  style.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(style);

  function fitSliders() {
    var $ = window.jQuery;
    if (!$ || !$.fn || !$.fn.slick || window.innerWidth < 1200) { return; }
    $('.slick-slider').each(function () {
      if (!this.querySelector('.product-snapshot') || !this.slick) { return; }
      var n = Math.max(5, Math.min(7, Math.floor(this.getBoundingClientRect().width / 270)));
      var sk = this.slick;
      if (sk.originalSettings && sk.originalSettings.slidesToShow !== n) {
        sk.originalSettings.slidesToShow = n;
        sk.options.slidesToShow = n;
        sk.refresh(true);
        $(this).slick('setPosition');
      }
    });
  }
  function tidy() {
    var tabs = document.querySelectorAll('.product-page-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (!tabs[i].innerText.trim() && !tabs[i].querySelector('img, iframe, video')) { tabs[i].classList.add('rr-empty'); }
    }
    var q = document.querySelectorAll('.quantity-text');
    for (var j = 0; j < q.length; j++) { if (/^\s*Menny\.?:?\s*$/i.test(q[j].textContent)) { q[j].textContent = 'Mennyiség:'; } }
  }
  var timer;
  function run() { try { tidy(); fitSliders(); } catch (e) { /* leave the theme layout */ } }
  if (document.readyState !== 'loading') { tidy(); } else { document.addEventListener('DOMContentLoaded', tidy); }
  window.addEventListener('load', function () { run(); setTimeout(run, 1500); });
  window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(run, 250); });
})();

/* Design round 3 (owner 2026-11-14, picked from before/after screenshots: 2, 3, 4, 7 ok; 1, 5, 6 no):
   - category sidebar: TERMÉK SZŰRÉS first, KÖVESS MINKET under it
   - homepage ÚJDONSÁGOK on the dark navy look (same lightning photo under a navy tint) instead of light grey
   - newsletter block lower, the skull hand shown whole on the left
   - footer: the long "Üdvözlünk ..." SEO text folds behind a "Rólunk" line (still in the page for Google) */
(function () {
  'use strict';
  if (document.getElementById('rr-round3')) { return; }
  var css =
    '.module-latest-wrapper { background: linear-gradient(180deg, rgba(4,28,46,.72), rgba(2,12,24,.9)),' +
    ' url("https://rockpince.cdn.shoprenter.hu/custom/rockpince/image/data/design/ujdonsagok-ragna-rock-hatter.jpg") center/cover !important; }' +
    '.module-latest-wrapper .module-head-title { color: #fff !important; }' +
    '#newsletter_subscribe { padding-top: 36px !important; padding-bottom: 36px !important; }' +
    /* cover + left: fills any width (owner 2026-11-14: gap on the right on wide screens), skull hand stays on the left */
    '#module_newsletter_subscribe_wrapper { background-size: cover !important; background-position: left center !important;' +
    ' background-repeat: no-repeat !important; background-color: #0b2236 !important; }' +
    '.rr-seo-fold summary { cursor: pointer; color: #9cc7e3; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;' +
    ' font-size: 13px; padding: 10px 0; list-style: none; }' +
    '.rr-seo-fold summary::-webkit-details-marker { display: none; }' +
    '.rr-seo-fold summary::after { content: " ▾"; }' +
    '.rr-seo-fold[open] summary::after { content: " ▴"; }';
  var style = document.createElement('style');
  style.id = 'rr-round3';
  style.type = 'text/css';
  style.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(style);
  function apply() {
    var aside = document.querySelector('aside.column-left'), filter = document.getElementById('module_paf_filter_wrapper');
    if (aside && filter && aside.firstElementChild !== filter) { aside.insertBefore(filter, aside.firstChild); }
    var seo = document.querySelector('.footer-seo');
    if (seo && !seo.closest('.rr-seo-fold')) {
      var d = document.createElement('details'), s = document.createElement('summary');
      d.className = 'rr-seo-fold';
      s.textContent = 'Rólunk – Ragnarock webáruház';
      d.appendChild(s);
      seo.parentNode.insertBefore(d, seo);
      d.appendChild(seo);
    }
  }
  if (document.readyState !== 'loading') { apply(); } else { document.addEventListener('DOMContentLoaded', apply); }
})();

/* Design round 4 (owner 2026-11-14, all ok'd from before/after screenshots):
   - product page: no Pinterest "Mentés / Megosztás" buttons, no "Átlagos értékelés: Nem értékelt" line while a
     product has no reviews, no stray "db" under the quantity box
   - search bar: bigger, "Keress zenekarra, termékre..." in ice blue; top header links a bit bigger
   - footer: no Shoprenter referral logo in the partner row; the "Segítség" column (one duplicate link) hidden
   - "Kínálatunkból véletlenszerűen": shimmering placeholder cards until the random products arrive */
(function () {
  'use strict';
  if (document.getElementById('rr-round4')) { return; }
  var css =
    '.rr-hide, .product-page-left .social-share-module, #socail-media { display: none !important; }' +
    /* owner 2026-11-14: the "Kapható választék:" heading above the size picker is redundant */
    '.product-options .product-option__title { display: none !important; }' +
    '.header input[type=text], .header input[type=search] { font-size: 16px !important; height: 52px !important; padding-left: 18px !important; }' +
    '.header input::placeholder { color: #9cc7e3 !important; opacity: 1 !important; text-transform: uppercase; letter-spacing: .03em; }' +
    '.headermenu-list .nav-link { font-size: 13px !important; }' +
    '#module_information3_wrapper { display: none !important; }' +
    ".partners__item:has(a[href*='www.shoprenter.hu']) { display: none !important; }" +
    '.rr-random-grid:empty { height: 360px; border-radius: 8px;' +
    ' background: repeating-linear-gradient(90deg, rgba(127,196,234,.10) 0 calc(16.666% - 18px), transparent calc(16.666% - 18px) 16.666%);' +
    ' animation: rrshim 1.4s ease-in-out infinite alternate; }' +
    '@media (max-width: 767px) { .rr-random-grid:empty { height: 300px;' +
    ' background: repeating-linear-gradient(90deg, rgba(127,196,234,.10) 0 calc(50% - 8px), transparent calc(50% - 8px) 50%); } }' +
    '@keyframes rrshim { from { opacity: 1; } to { opacity: .45; } }';
  var style = document.createElement('style');
  style.id = 'rr-round4';
  style.type = 'text/css';
  style.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(style);
  function leaves(root, re) {
    var out = [], all = root ? root.querySelectorAll('*') : [];
    for (var i = 0; i < all.length; i++) { if (!all[i].children.length && re.test(all[i].textContent.trim())) { out.push(all[i]); } }
    return out;
  }
  function apply() {
    var inputs = document.querySelectorAll('.header input[type=text], .header input[type=search]');
    for (var i = 0; i < inputs.length; i++) { inputs[i].placeholder = 'Keresés';   /* owner 2026-11-16: just a faint dark-blue "Keresés" */ }
    if (!/product-page-body/.test(document.body ? document.body.className : '')) { return; }
    var rows = document.querySelectorAll('.product-parameters tr');
    for (var j = 0; j < rows.length; j++) {
      if (/Átlagos értékelés/.test(rows[j].textContent) && /Nem értékelt/.test(rows[j].textContent)) { rows[j].classList.add('rr-hide'); }
    }
    leaves(document.querySelector('.product-page-left'), /^(Mentés|Megosztás)$/).forEach(function (e) {
      var x = e.closest('a,button,span,div') || e;
      (x.parentElement && x.parentElement.children.length <= 3 ? x.parentElement : x).classList.add('rr-hide');
    });
    leaves(document.querySelector('.product-cart-box'), /^db$/).forEach(function (e) { e.classList.add('rr-hide'); });
  }
  if (document.readyState !== 'loading') { apply(); } else { document.addEventListener('DOMContentLoaded', apply); }
  window.addEventListener('load', apply);
})();

/* Round 5 (owner 2026-11-14, ok'd from mock-ups): 1 sizes on product cards, 2 free-shipping bar on the
   product page, 3 "more from this band" link, 4 savings on sale prices, 6 sticky Kosárba bar on phones,
   9 Back keeps the loaded list, 10 size chart pop-up, 12 shop open/closed in the header, 13 Christmas bar,
   14 Sabaton concert tile, 16 "items waiting in your basket" toast, 17 first-visit pickup toast. */
(function () {
  'use strict';
  if (window.__rrRound5) { return; }
  window.__rrRound5 = true;
  if (/^\/checkout/.test(location.pathname)) { return; }

  var FREE = 30000;
  var HOURS = { 1: [12, 18], 2: [12, 18], 3: [12, 18], 4: [12, 18], 5: [12, 18], 6: [10, 14] };  /* Sunday closed */
  var CLOSED_DATES = ['2026-12-24', '2026-12-25', '2026-12-26', '2027-01-01'];  /* shop closed: no "MOST NYITVA" */
  var XMAS_UNTIL = '2026-12-24';
  var GIG_ASSETS = 'https://1374223-star.github.io/rockpince-menu-counts/assets/';
  var GIGS = [  /* shown until `until` (Budapest date); logo/art = GIG_ASSETS + key + '-logo.webp' / '-battle.webp' */
    { key: 'accept', label: 'Accept', keyword: 'accept', until: '2026-12-06', date: '2026. december 6.', place: 'Barba Negra',
      eyebrow: 'Half a Century of Metal<span class="x"> &middot; 50th Anniversary Tour</span>' },
    { key: 'manowar', label: 'Manowar', keyword: 'manowar', until: '2027-01-23', date: '2027. január 23.', place: 'Papp László Sportaréna',
      eyebrow: 'World Tour 2027<span class="x"> &middot; Fighting the World</span>' },
    { key: 'bfmv', label: 'Bullet For My Valentine', btn: 'BFMV', keyword: 'bullet for my valentine', until: '2027-02-15', date: '2027. február 15.',
      place: 'Budapest Aréna', eyebrow: 'Social Apocalypse 2027 &middot; + Pendulum<span class="x"> Live</span>' },
    { key: 'sabaton', label: 'Sabaton', keyword: 'sabaton', until: '2027-05-01', date: '2027. május 1.', place: 'MVM Dome',
      eyebrow: 'The Legendary Tour<span class="x"> &middot; Part 2 &middot; Europe 2027</span>' }
  ];
  var WEARABLE = /póló|polo|pulóver|pulcsi|kapucnis|hoodie|\bing\b|ruha|szoknya|nadrág|short|kesztyű|zokni|\böv\b|gyűrű|karkötő|bakancs|cipő|csizma|\btop\b|felső|harisnya|leggings|kabát|dzseki|mellény|choker|nyakörv|hám|harness|sapka|dress|skirt|corset|fűző|body|trikó/i;

  var body = document.body || document.documentElement;
  var isProduct = /product-page-body/.test(body.className);
  var isHome = /home-body/.test(body.className) || location.pathname === '/';
  var isCart = /route=checkout\/cart/.test(location.search) || /\/kosar/.test(location.pathname);
  var phone = function () { return window.innerWidth < 768; };

  function ft(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Ft'; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (html != null) { e.innerHTML = html; } return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function store(kind) { try { var s = window[kind]; s.setItem('rr-t', '1'); s.removeItem('rr-t'); return s; } catch (e) { return null; } }
  var ls = store('localStorage'), ss = store('sessionStorage');
  function ready(fn) { if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); } else { fn(); } }

  /* one basket request per page (mini-cart endpoint: total + item count) */
  var cartWaiters = null, cartData = null;
  function cartInfo(done, fresh) {
    if (cartData && !fresh) { done(cartData); return; }
    if (cartWaiters) { cartWaiters.push(done); return; }
    cartWaiters = [done];
    var x = new XMLHttpRequest();
    x.open('POST', '/index.php?route=module/cart/callback', true);
    x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    x.onloadend = function () {
      var d = { total: 0, count: 0 };
      try {
        var j = JSON.parse(x.responseText);
        d.total = Number(String(j.total || '').replace(/[^0-9]/g, '')) || 0;
        d.count = Number(j.countProducts || 0) || 0;
      } catch (e) { /* empty basket */ }
      cartData = d;
      var w = cartWaiters; cartWaiters = null;
      for (var i = 0; i < w.length; i++) { w[i](d); }
    };
    x.send();
  }
  document.addEventListener('cartChanged', function () { cartData = null; });

  function budapestNow() {
    var parts = {};
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
        .forEach(function (p) { parts[p.type] = p.value; });
    } catch (e) { var d = new Date(); return { ymd: d.toISOString().slice(0, 10), dow: d.getDay(), min: d.getHours() * 60 + d.getMinutes() }; }
    var dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
    return { ymd: parts.year + '-' + parts.month + '-' + parts.day, dow: dow, min: (Number(parts.hour) % 24) * 60 + Number(parts.minute) };
  }

  var css =
    /* 1 sizes on cards */
    '.rr-sz{margin:2px 0 8px;text-align:center}.rr-sz .l{font-size:10.5px;font-weight:700;letter-spacing:.05em;color:#5b7a92;text-transform:uppercase;margin-bottom:4px}' +
    '.rr-sz .c{display:flex;gap:4px;flex-wrap:wrap;justify-content:center}' +
    '.rr-sz .c button{min-width:32px;padding:5px 4px;border:1px solid #0b2a44;border-radius:3px;background:#fff;font-size:11.5px;font-weight:700;color:#0b2a44;line-height:1.1;cursor:pointer}' +
    '.rr-sz .c button small{display:block;font-size:9px;font-weight:600;color:#b3261e}' +
    '.rr-sz .c button.on{background:#0b2a44;color:#fff}.rr-sz .c button.on small{color:#ffb3b1}' +
    '.rr-sz select{width:100%;height:36px;border:1px solid #0b2a44;border-radius:3px;font-size:12.5px;font-weight:700;color:#0b2a44;background:#fff;padding:0 8px;text-transform:uppercase}' +
    '.rr-sz .one{font-size:11.5px;font-weight:700;color:#5b7a92;text-transform:uppercase;letter-spacing:.04em}' +
    '.rr-sz .warn{color:#e52421;font-size:11.5px;font-weight:800;text-transform:uppercase;margin-top:4px}' +
    '.rr-sz.shake{animation:rrshake .35s}@keyframes rrshake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}' +
    /* 2 free shipping on product page */
    '.rr-fs{margin:12px 0 2px;font-size:13px;color:#e9f2f9;text-transform:uppercase;letter-spacing:.02em}.rr-fs b{color:#fff}' +
    '.rr-fs .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:6px;overflow:hidden}.rr-fs .bar i{display:block;height:100%;background:#e52421}' +
    '.rr-fs.done{color:#34d06a}.rr-fs.done .bar i{background:#1a9b3c}' +
    /* 3 band link */
    '.rr-band{display:inline-flex;gap:8px;align-items:center;margin:2px 0 14px;padding:8px 14px;border:1px solid rgba(127,196,234,.45);border-radius:4px;' +
    'color:#9cc7e3!important;font-weight:700;text-transform:uppercase;font-size:13px;letter-spacing:.04em;text-decoration:none!important}' +
    '.rr-band:hover{background:rgba(127,196,234,.12)}' +
    /* 4 savings */
    '.rr-save{display:block;margin:2px auto 4px;color:#1a9b3c;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.02em}' +
    '.product-page-price .rr-save{color:#34d06a;font-size:14px;margin:6px 0 0}' +
    /* 6 sticky bar on phones */
    '.rr-sticky{position:fixed;left:0;right:0;bottom:0;z-index:1030;background:#06131f;border-top:1px solid rgba(127,196,234,.35);padding:10px 14px;' +
    'display:flex;align-items:center;gap:12px;box-shadow:0 -8px 24px rgba(0,0,0,.5);transform:translateY(110%);transition:transform .25s}' +
    '.rr-sticky.show{transform:none}.rr-sticky img{width:44px;height:44px;object-fit:cover;border-radius:4px;background:#fff}' +
    '.rr-sticky .t{flex:1;min-width:0;color:#fff;font-size:12px;line-height:1.25}.rr-sticky .t span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.rr-sticky .t b{display:block;font-size:16px}' +
    '.rr-sticky a{background:#e52421;color:#fff!important;font-weight:800;text-transform:uppercase;padding:12px 18px;border-radius:4px;font-size:14px;text-decoration:none}' +
    /* 10 size chart */
    '.rr-sg{margin-left:10px;color:#9cc7e3!important;font-weight:700;font-size:12.5px;text-transform:uppercase;text-decoration:underline!important;cursor:pointer;white-space:nowrap}' +
    '.rr-modal-bg{position:fixed;inset:0;background:rgba(0,6,14,.72);z-index:99998;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.rr-modal{width:min(620px,100%);max-height:90vh;overflow:auto;background:linear-gradient(180deg,#0d2a42,#06131f);border:1px solid rgba(127,196,234,.35);' +
    'border-radius:10px;padding:30px 26px 24px;color:#e9f2f9;text-align:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.6)}' +
    '.rr-modal h3{color:#fff;font-weight:800;text-transform:uppercase;font-size:24px;margin:0 0 6px}' +
    '.rr-modal .x{position:absolute;right:14px;top:8px;font-size:28px;color:#9cc7e3;background:none;border:0;cursor:pointer;line-height:1}' +
    '.rr-modal table{width:100%;color:#fff;font-size:14px;margin-top:12px}.rr-modal td,.rr-modal th{padding:8px 6px;border-bottom:1px solid rgba(127,196,234,.2);color:#fff!important}' +
    /* 12 open now */
    '.rr-open{display:inline-flex;align-items:center;gap:7px;margin-right:18px;padding:4px 11px;border-radius:999px;font-weight:700;font-size:11.5px;' +
    'letter-spacing:.04em;text-transform:uppercase;text-decoration:none!important;white-space:nowrap}' +
    '.rr-open i{width:8px;height:8px;border-radius:50%}' +
    '.rr-open.on{background:rgba(26,155,60,.15);color:#34d06a!important;border:1px solid rgba(52,208,106,.5)}.rr-open.on i{background:#34d06a;box-shadow:0 0 8px #34d06a}' +
    '.rr-open.off{background:rgba(229,36,33,.12);color:#ff8a87!important;border:1px solid rgba(229,36,33,.45)}.rr-open.off i{background:#e52421}' +
    /* 13 christmas bar */
    '.rr-xmas{background:linear-gradient(90deg,#8e0f0d,#e52421,#8e0f0d);color:#fff;text-align:center;padding:9px 14px;font-weight:800;font-size:13.5px;' +
    'letter-spacing:.05em;text-transform:uppercase;line-height:1.35}' +
    /* 14 concert tiles */
    '.rr-gigs{display:grid;grid-template-columns:1fr;gap:18px;margin:0 0 26px}' +
    '.rr-gigwrap{container-type:inline-size;container-name:gig;min-width:0}' +
    '.rr-gig{--gold:#d4b46a;--ink:#efe3c2;--bg0:#08080b;--bg1:#2b2621;--bg2:#15131a;--plate:8,8,11;--line:217,180,90;--btn0:#f6e2a1;--btn1:#d4b46a;--btn2:#a9822f;--btnsh:#5e4718;--stub:250px;' +
    'position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:stretch;box-sizing:border-box;height:100%;padding:0 0 18px;' +
    'border:1px solid rgba(var(--line),.55);border-radius:8px;color:var(--ink);' +
    'background:var(--bg0) radial-gradient(ellipse 60% 140% at 42% 50%,var(--bg1) 0%,var(--bg2) 48%,var(--bg0) 100%);' +
    'box-shadow:0 0 0 1px rgba(0,0,0,.7),inset 0 0 0 1px rgba(255,222,150,.09),inset 0 0 60px rgba(0,0,0,.6),0 16px 44px rgba(0,0,0,.55)}' +
    /* one gold for all tiles (owner 2026-11-15): borders, perforation, buttons and gold text come from .rr-gig; a band only tints its background */
    '.rr-gig.g-manowar{--bg0:#0b0604;--bg1:#4a2008;--bg2:#1d0d05;--plate:12,6,3}' +
    '.rr-gig.g-accept{--bg0:#06090e;--bg1:#1b2a3c;--bg2:#0c131d;--plate:6,9,14}' +
    '.rr-gig.g-bfmv{--bg0:#070708;--bg1:#27272b;--bg2:#111113;--plate:7,7,8}' +
    /* phones: keep the text backing off the Pendulum logo at the bottom of the panel */
    '@container gig (max-width:599px){.rr-gig.g-bfmv .txt:before{top:-14px}}' +
    '.rr-gig .art{position:absolute;inset:0;background-position:50% 38%;background-size:cover;background-repeat:no-repeat;opacity:.3}' +
    '.rr-gig .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.22),transparent 28%,transparent 72%,rgba(0,0,0,.42))}' +
    '.rr-gig .lt{display:contents}' +
    '.rr-gig .logo{position:relative;display:block;height:auto;width:min(100%,430px);margin:0 auto}' +
    '.rr-gig .txt{position:relative;isolation:isolate;text-align:center;padding:0 16px;margin-top:-12px;min-width:0}' +
    '.rr-gig .txt:before,.rr-gig .lt:before{content:"";position:absolute;z-index:-1;left:-70px;right:-110px;top:-80px;bottom:-80px;' +
    'background:radial-gradient(ellipse 52% 58% at 44% 50%,rgba(var(--plate),.96) 30%,rgba(var(--plate),.78) 58%,rgba(var(--plate),0) 100%)}' +
    '.rr-gig .lt:before{display:none}' +
    '.rr-gig .eye{font-family:Cinzel,"Times New Roman",serif;font-weight:700;font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);opacity:.92}' +
    '.rr-gig .eye .x,.rr-gig .m{display:none}' +
    '.rr-gig h3{margin:6px 0 4px;font-family:Cinzel,"Times New Roman",serif;font-weight:900;font-size:26px;line-height:1.05;letter-spacing:.04em;text-transform:uppercase;' +
    'background:linear-gradient(180deg,#fbeec2 0%,#e9cc7e 42%,#b8903f 70%,#e2c173 100%);-webkit-background-clip:text;background-clip:text;color:transparent;' +
    'filter:drop-shadow(0 2px 0 #1a1206) drop-shadow(0 6px 14px rgba(0,0,0,.6))}' +
    '.rr-gig .d{font-family:Cinzel,"Times New Roman",serif;font-weight:700;font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:#f3e9cf}' +
    '.rr-gig .d span{color:var(--gold);margin:0 7px}' +
    '.rr-gig .m{margin-top:9px;font-size:13px;font-weight:600;letter-spacing:.04em;color:rgba(239,227,194,.72);white-space:nowrap}' +
    '.rr-gig .stub{position:relative;flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;margin:16px 16px 0;padding:16px 0 0;' +
    'border-top:2px dashed rgba(var(--line),.42)}' +
    '.rr-gig .btn{display:inline-flex;align-items:center;justify-content:center;gap:12px;width:100%;box-sizing:border-box;padding:17px 26px;border-radius:4px;' +
    'font-family:Cinzel,"Times New Roman",serif;font-weight:800;font-size:15px;letter-spacing:.1em;text-transform:uppercase;color:#1a1408!important;text-decoration:none!important;white-space:nowrap;' +
    'background:linear-gradient(180deg,var(--btn0),var(--btn1) 52%,var(--btn2));box-shadow:0 4px 0 var(--btnsh),0 12px 26px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.55);transition:transform .15s,filter .15s}' +
    '.rr-gig .btn i{font-style:normal;font-size:1.25em;line-height:0}' +
    '.rr-gig .btn:hover{filter:brightness(1.08);transform:translateY(-1px)}' +
    '.rr-gig .s2{font-size:10.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:rgba(239,227,194,.62);white-space:nowrap}' +
    /* phones: tight card (owner 2026-11-15): logo trimmed to a band, no eyebrow, no perforation, no subtitle, one-line headline */
    '@container gig (max-width:599px){' +
    '.rr-gig{padding:0 0 14px}' +
    '.rr-gig .logo{width:100%;max-width:440px;aspect-ratio:900/300;object-fit:cover;object-position:50% var(--ly,0%)}' +
    '.rr-gig.g-bfmv{--ly:42%}.rr-gig.g-sabaton{--ly:6%}' +
    '.rr-gig .txt{margin-top:-4px}.rr-gig .txt:before{top:-12px;bottom:-30px}' +
    '.rr-gig .eye,.rr-gig .s2{display:none}' +
    '.rr-gig h3{font-size:clamp(18px,6.6cqw,26px);white-space:nowrap;margin:0 0 4px}' +
    '.rr-gig .d{font-size:clamp(11.5px,3.6cqw,14px);letter-spacing:.1em;line-height:1.45}.rr-gig .d span{margin:0 5px}' +
    '.rr-gig .stub{margin:12px 14px 0;padding:0;border-top:0;gap:0}' +
    '.rr-gig .btn{padding:13px 18px;font-size:clamp(12.5px,4cqw,15px)}' +
    /* perf on phones (owner 2026-11-15): no blurred shadows, each tile drawn once on its own */
    '.rr-gig{box-shadow:0 0 0 1px rgba(0,0,0,.7),inset 0 0 0 1px rgba(255,222,150,.09),0 6px 14px rgba(0,0,0,.45);contain:paint}' +
    '.rr-gig h3{filter:drop-shadow(0 2px 0 #1a1206)}' +
    '.rr-gig .btn{box-shadow:0 4px 0 var(--btnsh),inset 0 1px 0 rgba(255,255,255,.55)}' +
    '}' +
    '@container gig (min-width:600px){' +
    '.rr-gig{flex-direction:row;align-items:center;min-height:206px;padding:0;--stub:330px}' +
    '.rr-gig .art{left:0;right:var(--stub);background-position:right center;background-size:auto 100%;opacity:.8}' +
    '.rr-gig .lt{display:flex;flex-direction:column;justify-content:center;position:relative;isolation:isolate;flex:0 1 auto;max-width:62%;padding:14px 24px 14px 20px}' +
    '.rr-gig .lt:before{display:block;left:-60px;right:-120px;top:-60px;bottom:-60px}' +
    '.rr-gig .txt:before{display:none}' +
    '.rr-gig .logo{width:min(100%,236px);margin:0}' +
    '.rr-gig .txt{text-align:left;padding:0;margin-top:6px}' +
    '.rr-gig .eye{font-size:10.5px}.rr-gig h3{font-size:22px;margin:4px 0 3px}.rr-gig .d{font-size:12.5px}' +
    '.rr-gig .stub{flex:0 0 var(--stub);box-sizing:border-box;align-self:stretch;margin:0 0 0 auto;padding:0 18px;border-top:0;border-left:2px dashed rgba(var(--line),.42);' +
    'background:linear-gradient(90deg,rgba(var(--plate),.55),rgba(var(--plate),.84));-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}' +
    '.rr-gig .btn{width:auto;font-size:13px;padding:14px 20px}' +
    '}' +
    '@container gig (min-width:1000px){' +
    '.rr-gig{--stub:clamp(420px,28cqw,520px);height:clamp(204px,12cqw,290px)}' +
    '.rr-gig .art{opacity:.92}' +
    '.rr-gig .lt{display:contents}.rr-gig .lt:before{display:none}.rr-gig .txt:before{display:block}' +
    '.rr-gig .logo{height:100%;width:auto;max-width:none;margin:0 0 0 -6px}' +
    '.rr-gig .txt{flex:0 1 auto;max-width:380px;padding:0 24px 0 8px;margin:0}' +
    '.rr-gig .eye{font-size:clamp(10.5px,.72cqw,13px);white-space:normal}.rr-gig .eye .x{display:inline}' +
    '.rr-gig h3{font-size:clamp(22px,2.05cqw,36px);margin:6px 0 4px}' +
    '.rr-gig .d{font-size:clamp(13px,1.05cqw,18px)}.rr-gig .d span{margin:0 10px}' +
    '.rr-gig .stub{flex:0 0 var(--stub);width:var(--stub);padding:0 24px}' +
    '.rr-gig .btn{font-size:clamp(14px,1.05cqw,18px);padding:18px 32px;gap:14px}' +
    '.rr-gig .s2{font-size:11.5px}' +
    '}' +
    '@container gig (min-width:1500px){' +
    '.rr-gig .m{display:block}.rr-gig .txt{max-width:620px;padding-right:60px}' +
    '}' +
    /* concert tiles, less text (owner 2026-11-16): one-line headline and date line */
    '.rr-gig h3{white-space:nowrap}@container gig (min-width:600px){.rr-gig .d{white-space:nowrap}}' +
    /* concert tiles: plain type (owner 2026-11-15): Barlow Condensed, solid colours, no gold-gradient lettering */
    '.rr-gig .eye,.rr-gig h3,.rr-gig .d,.rr-gig .btn{font-family:"Barlow Condensed","Arial Narrow",Arial,sans-serif}' +
    '.rr-gig .eye{font-weight:600;font-size:15px;letter-spacing:.06em;opacity:1}' +
    '.rr-gig h3{font-weight:800;font-size:34px;line-height:.98;letter-spacing:.01em;background:none;-webkit-background-clip:border-box;background-clip:border-box;' +
    'color:#fff;filter:none;text-shadow:0 2px 0 rgba(0,0,0,.55),0 4px 16px rgba(0,0,0,.5)}' +
    '.rr-gig .d{font-weight:700;font-size:19px;line-height:1.25;letter-spacing:.03em;color:#fff}.rr-gig .d b{font-weight:700;color:var(--gold)}' +
    '.rr-gig .d span{display:inline-block;width:2px;height:.85em;margin:0 10px;vertical-align:-.06em;background:var(--gold);color:transparent;overflow:hidden;opacity:.8}' +
    '.rr-gig .btn{font-weight:700;font-size:20px;letter-spacing:.04em;gap:10px}' +
    '.rr-gig .btn i{font-size:1.1em}' +
    '@container gig (max-width:599px){' +
    '.rr-gig h3{font-size:clamp(24px,7.6cqw,32px);margin:0 0 2px}' +
    '.rr-gig .d{font-size:clamp(15px,4.8cqw,19px);letter-spacing:.03em}.rr-gig .d span{margin:0 8px}' +
    '.rr-gig .btn{font-size:clamp(17px,5.2cqw,20px);padding:12px 18px}' +
    '}' +
    '@container gig (min-width:600px){' +
    '.rr-gig .eye{font-size:14px}.rr-gig h3{font-size:28px}.rr-gig .d{font-size:17px}' +
    '.rr-gig .btn{font-size:18px;padding:13px 22px}' +
    '}' +
    '@container gig (min-width:1000px){' +
    '.rr-gig .eye{font-size:clamp(14px,1cqw,18px)}.rr-gig h3{font-size:clamp(32px,2.9cqw,52px);margin:4px 0 4px}' +
    '.rr-gig .txt{max-width:470px}.rr-gig .d{font-size:clamp(17px,1.4cqw,24px)}.rr-gig .d span{margin:0 12px}' +
    '.rr-gig .btn{font-size:clamp(19px,1.45cqw,25px);padding:16px 30px}' +
    '}' +
    /* 16, 17 toasts */
    '.rr-toast{position:fixed;z-index:99990;right:20px;bottom:20px;width:min(340px,calc(100vw - 32px));background:#0b2236;border:1px solid rgba(127,196,234,.35);' +
    'border-left:4px solid #e52421;border-radius:8px;padding:14px 38px 14px 16px;color:#e9f2f9;box-shadow:0 12px 30px rgba(0,0,0,.5);font-size:14px;' +
    'opacity:0;transform:translateY(12px);transition:opacity .3s,transform .3s}' +
    '.rr-toast.show{opacity:1;transform:none}.rr-toast b{color:#fff;text-transform:uppercase;letter-spacing:.03em}' +
    '.rr-toast .x{position:absolute;right:10px;top:6px;background:none;border:0;color:#9cc7e3;font-size:22px;cursor:pointer}' +
    '.rr-toast a.go{display:inline-block;margin-top:10px;background:#e52421;color:#fff!important;font-weight:800;text-transform:uppercase;padding:9px 16px;' +
    'border-radius:4px;font-size:12.5px;text-decoration:none!important}' +
    '@media (max-width:767px){.rr-toast{right:16px;left:16px;width:auto}}';
  var st = el('style');
  st.id = 'rr-round5';
  st.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(st);

  /* ---------- 1 sizes on product cards ---------- */
  var sizeCache = {};
  /* sizes are remembered for 3 hours across pages and visits (fewer quick-view requests to the shop) */
  var SIZE_TTL = 3 * 3600 * 1000;
  try {
    var sc = JSON.parse((ls && ls.getItem('rr-sizes')) || 'null');
    sizeCache = sc && sc.t && Date.now() - sc.t < SIZE_TTL ? sc.d : {};
    sizeCache.__t = sc && sc.t && Date.now() - sc.t < SIZE_TTL ? sc.t : Date.now();
  } catch (e) { sizeCache = { __t: Date.now() }; }
  function saveSizes() {
    try {
      var t = sizeCache.__t, d = {}, keys = Object.keys(sizeCache).filter(function (k) { return k !== '__t'; }).slice(-1500);
      keys.forEach(function (k) { d[k] = sizeCache[k]; });
      if (ls) { ls.setItem('rr-sizes', JSON.stringify({ t: t, d: d })); }
    } catch (e) { /* full */ }
  }
  /* product counts of a search (Sabaton tile, band link): searches are slow on the shop, so remember 24 h */
  function searchCount(url, done) {
    /* owner 2026-11-15: a 24 h cache showed yesterday's counts; 1 h now, new key drops the old cached numbers */
    var key = 'rr-cnt2:' + url, hit = null;
    try { hit = JSON.parse((ls && ls.getItem(key)) || 'null'); } catch (e) { hit = null; }
    if (hit && Date.now() - hit.t < 3600 * 1000) { done(hit.n); return; }
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.onload = function () {
      var m = x.responseText.match(/(\d[\d.\s]*)\s*termék/);
      var n = m ? Number(m[1].replace(/\D/g, '')) : 0;
      try { if (ls) { ls.setItem(key, JSON.stringify({ t: Date.now(), n: n })); } } catch (e) { /* full */ }
      done(n);
    };
    x.send();
  }
  function parseSizes(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var sel = doc.querySelector('select[name^="option["]');
    if (!sel) { return { name: '', opts: [] }; }
    var opts = [];
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      if (!o.value) { continue; }
      var label = o.textContent.replace(/\s+/g, ' ').trim(), m = label.match(/^(.*?)\s*(\+\s*[\d.\s]+\s*Ft)$/);
      opts.push({ v: o.value, l: m ? m[1] : label, x: m ? m[2].replace(/\s/g, '') : '' });
    }
    return { name: sel.getAttribute('name'), opts: opts };
  }
  function renderSizes(card, data) {
    if (card.querySelector('.rr-sz')) { return; }
    var footer = card.querySelector('.card__footer'), add = card.querySelector('.list_addtocart');
    if (!footer || !add) { return; }
    var box = el('div', 'rr-sz');
    if (!data.opts.length) {
      var title = (card.querySelector('.product-card__title') || {}).textContent || '';
      if (!WEARABLE.test(title)) { return; }
      box.innerHTML = '<div class="one">Egy méret</div>';
      footer.insertBefore(box, footer.firstChild);
      return;
    }
    box.setAttribute('data-sized', '1');
    var hidden = el('input'); hidden.type = 'hidden'; hidden.name = data.name; hidden.value = ''; hidden.disabled = true;
    add.appendChild(hidden);
    var btn = add.querySelector('.button-add-to-cart');
    function pick(v) {
      hidden.value = v; hidden.disabled = !v;
      if (btn) { if (v) { btn.setAttribute('data-rr-pass', '1'); } else { btn.removeAttribute('data-rr-pass'); } }
      var w = box.querySelector('.warn'); if (w) { w.parentNode.removeChild(w); }
    }
    var short = data.opts.length === 1 || (data.opts.length <= 8 && data.opts.every(function (o) { return o.l.length <= 12; }));
    if (short) {
      var wrap = el('div', 'c');
      data.opts.forEach(function (o) {
        var b = el('button', 'excluded-extra', esc(o.l) + (o.x ? '<small>' + esc(o.x) + '</small>' : ''));
        b.type = 'button';
        b.addEventListener('click', function () {
          var on = wrap.querySelectorAll('.on'); for (var i = 0; i < on.length; i++) { on[i].classList.remove('on'); }
          b.classList.add('on'); pick(o.v);
        });
        wrap.appendChild(b);
      });
      box.appendChild(el('div', 'l', 'Méret'));
      box.appendChild(wrap);
    } else {
      var s = el('select', 'excluded-extra');
      s.innerHTML = '<option value="">Válassz méretet (' + data.opts.length + ')</option>' +
        data.opts.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.l + (o.x ? ' ' + o.x : '')) + '</option>'; }).join('');
      s.addEventListener('change', function () { pick(s.value); });
      box.appendChild(s);
    }
    footer.insertBefore(box, footer.firstChild);
  }
  function loadSizes(card) {
    if (card.getAttribute('data-rr-sz')) { return; }
    card.setAttribute('data-rr-sz', '1');
    var q = card.querySelector('.btn-quickview[data-src]'), add = card.querySelector('.button-add-to-cart[data-product-id]');
    var id = q ? (q.getAttribute('data-src').match(/product_id=(\d+)/) || [])[1] : add && add.getAttribute('data-product-id');
    if (!id) { return; }
    var url = q ? q.getAttribute('data-src') : '/index.php?route=product/quickview&product_id=' + encodeURIComponent(id);
    if (id && sizeCache[id]) { renderSizes(card, sizeCache[id]); return; }
    sizeQueue.push(function (next) {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.onload = function () {
        if (x.status === 200) {
          var data = parseSizes(x.responseText);
          if (id) { sizeCache[id] = data; saveSizes(); }
          renderSizes(card, data);
        }
      };
      x.onloadend = next;
      x.send();
    });
    pumpSizes();
  }
  /* owner 2026-11-14 ("slow when I click"): at most 3 size lookups at a time, and only after the page
     itself has finished loading, so they never compete with the visitor's own clicks */
  var sizeQueue = [], sizeRunning = 0, pageLoaded = document.readyState === 'complete';
  if (!pageLoaded) { window.addEventListener('load', function () { pageLoaded = true; setTimeout(pumpSizes, 300); }); }
  function pumpSizes() {
    if (!pageLoaded) { return; }
    while (sizeRunning < 3 && sizeQueue.length) {
      sizeRunning += 1;
      sizeQueue.shift()(function () { sizeRunning -= 1; pumpSizes(); });
    }
  }
  var cardObserver = window.IntersectionObserver ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { cardObserver.unobserve(en.target); loadSizes(en.target); } });
  }, { rootMargin: '300px 0px' }) : null;
  function watchCards() {
    var cards = document.querySelectorAll('.product-snapshot .product-card:not([data-rr-watch])');
    for (var i = 0; i < cards.length; i++) {
      cards[i].setAttribute('data-rr-watch', '1');
      if (cardObserver) { cardObserver.observe(cards[i]); } else { loadSizes(cards[i]); }
    }
  }
  /* Kosárba on a card with sizes but none picked: ask for the size here (runs before the size guard) */
  window.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest('.product-card .button-add-to-cart') : null;
    if (!btn) { return; }
    var box = btn.closest('.product-card').querySelector('.rr-sz[data-sized]');
    if (!box || btn.getAttribute('data-rr-pass') === '1') { return; }
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (!box.querySelector('.warn')) { box.appendChild(el('div', 'warn', 'Válassz méretet!')); }
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  }, true);

  /* ---------- 4 savings ---------- */
  function prices(node) {
    var c = node.cloneNode(true), post = c.querySelectorAll('.product-price__postfix, .rr-save');
    for (var i = 0; i < post.length; i++) { post[i].parentNode.removeChild(post[i]); }
    return (c.textContent.match(/\d[\d.\s]*\s*Ft/g) || []).map(function (s) { return Number(s.replace(/\D/g, '')); }).filter(Boolean);
  }
  function savings() {
    var boxes = document.querySelectorAll('.product-card__price:not([data-rr-save]), .product-cart-box .product-page-price:not([data-rr-save])');
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i], n = prices(b);
      b.setAttribute('data-rr-save', '1');
      if (n.length < 2) { continue; }
      var hi = Math.max.apply(null, n), lo = Math.min.apply(null, n);
      if (hi - lo < 50) { continue; }
      b.appendChild(el('span', 'rr-save', 'Megtakarítás: ' + ft(hi - lo)));
    }
  }

  /* ---------- product page: 2, 3, 6, 10 ---------- */
  function productPrice() {
    var m = document.querySelector('.product-cart-box meta[itemprop="price"]');
    return m ? Number(m.getAttribute('content')) || 0 : 0;
  }
  function shipBar() {
    var p = document.querySelector('.product-cart-box .product-page-price');
    if (!p) { return; }
    cartInfo(function (d) {
      var price = productPrice(), sum = d.total + price, left = FREE - sum;
      var box = p.querySelector('.rr-fs') || p.appendChild(el('div', 'rr-fs'));
      var pct = Math.max(4, Math.min(100, Math.round(sum / FREE * 100)));
      box.className = 'rr-fs' + (left <= 0 ? ' done' : '');
      box.innerHTML = (left <= 0 ? '<b>Ezzel a termékkel ingyenes a szállítás!</b>'
        : 'Még <b>' + ft(left) + '</b> és <b>ingyenes</b> a szállítás!') + '<div class="bar"><i style="width:' + pct + '%"></i></div>';
    });
  }
  function bandLink() {
    var h = document.querySelector('.product-page-middle h1, .product-page-top__row h1');
    if (!h || document.querySelector('.rr-band')) { return; }
    var band = h.textContent.split(' - ')[0].replace(/[™®]/g, '').replace(/\s+/g, ' ').trim();
    if (band.length < 2 || band.length > 40 || band === h.textContent.trim() || /^\d+$/.test(band)) { return; }
    var url = '/index.php?route=product/list&keyword=' + encodeURIComponent(band.toLowerCase());
    searchCount(url, function (n) {
      if (n < 2 || document.querySelector('.rr-band')) { return; }
      var a = el('a', 'rr-band', 'Még több ' + esc(band) + ' termék (' + n + ') &rarr;');
      a.href = url;
      h.parentNode.insertBefore(a, h.nextSibling);
    });
  }
  function stickyBar() {
    var add = document.querySelector('.product-cart-box #add_to_cart');
    if (!add || document.querySelector('.rr-sticky')) { return; }
    var img = document.querySelector('.product-image__main img'), h = document.querySelector('h1');
    var bar = el('div', 'rr-sticky', '<img alt="" src="' + esc(img ? img.currentSrc || img.src : '') + '"><div class="t"><span>' +
      esc(h ? h.textContent.trim() : '') + '</span><b>' + ft(productPrice()) + '</b></div><a href="#">Kosárba</a>');
    document.body.appendChild(bar);
    bar.querySelector('a').addEventListener('click', function (e) {
      e.preventDefault();
      var box = document.querySelector('.product-cart-box');
      var sel = box && box.querySelector('select[name^="option["]');
      if (sel && !sel.value) { sel.scrollIntoView({ block: 'center', behavior: 'smooth' }); try { sel.focus(); } catch (er) { /* */ } return; }
      add.click();
    });
    var queued = false;
    function check() {
      queued = false;
      var r = add.getBoundingClientRect();
      var away = r.bottom < 60;  /* scrolled past the buy button */
      bar.classList.toggle('show', phone() && away && r.height > 0);
    }
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(check); } }, { passive: true });
    window.addEventListener('resize', check);
    check();
  }
  function sizeChart() {
    var sel = document.querySelector('.product-cart-box select[name^="option["]');
    if (!sel || document.querySelector('.rr-sg')) { return; }
    var tables = document.querySelectorAll('.product-page-middle table, .product-page-top__row table');
    var tab = null;
    for (var i = tables.length - 1; i >= 0; i--) {
      if (!tables[i].querySelector('table') && /Szélesség|Hossz|Mellbőség|Talphossz|Derék|Csípő/i.test(tables[i].textContent)) { tab = tables[i]; break; }
    }
    if (!tab) { return; }
    var a = el('a', 'rr-sg', 'Mérettáblázat');
    a.href = '#';
    (sel.closest('.product-option__item') || sel.parentNode).appendChild(a);
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var name = (document.querySelector('h1') || {}).textContent || '';
      var bg = el('div', 'rr-modal-bg', '<div class="rr-modal" role="dialog" aria-label="Mérettáblázat"><button type="button" class="x" aria-label="Bezárás">&times;</button>' +
        '<h3>Mérettáblázat</h3><div style="color:#9cc7e3;font-size:13px">' + esc(name.trim()) + ' – centiméterben</div></div>');
      bg.querySelector('.rr-modal').appendChild(tab.cloneNode(true));
      function close() { if (bg.parentNode) { bg.parentNode.removeChild(bg); } document.removeEventListener('keydown', key); }
      function key(k) { if (k.key === 'Escape') { close(); } }
      bg.addEventListener('click', function (k) { if (k.target === bg || k.target.classList.contains('x')) { close(); } });
      document.addEventListener('keydown', key);
      document.body.appendChild(bg);
    });
  }

  /* ---------- 9 Back keeps the loaded list ---------- */
  function listState() {
    var grid = document.querySelector('.product-list .product-snapshot-vertical');
    if (!grid || !ss) { return; }
    grid.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.closest('.list_addtocart') || a.getAttribute('href') === '#') { return; }
      var lm = document.querySelector('.rr-loadmore');
      ss.setItem('rr-list', JSON.stringify({ url: location.href, n: lm ? Number(lm.getAttribute('data-loaded') || 0) : 0, y: window.scrollY }));
    });
    var saved = null;
    try { saved = JSON.parse(ss.getItem('rr-list') || 'null'); } catch (e) { saved = null; }
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
    if (!saved || saved.url !== location.href || (nav.type && nav.type !== 'back_forward')) { return; }
    ss.removeItem('rr-list');
    var left = saved.n;
    (function step(tries) {
      var btn = document.querySelector('.rr-loadmore-btn');
      if (left <= 0 || !btn || btn.style.display === 'none') { window.scrollTo(0, saved.y); return; }
      if (btn.disabled) { if (tries < 60) { setTimeout(function () { step(tries + 1); }, 200); } else { window.scrollTo(0, saved.y); } return; }
      left -= 1;
      btn.click();
      setTimeout(function () { step(0); }, 250);
    })(0);
  }

  /* ---------- 12 open / closed ---------- */
  function openChip() {
    var row = document.querySelector('.header-top-row');
    var ul = row && row.querySelector('ul');
    if (!ul) { return; }
    var a = row.querySelector('.rr-open') || el('a', 'rr-open');
    a.href = '/uzletunk';
    if (!a.parentNode) { ul.parentNode.insertBefore(a, ul); ul.parentNode.style.display = 'flex'; ul.parentNode.style.alignItems = 'center'; ul.parentNode.style.justifyContent = 'flex-end'; }
    var now = budapestNow(), h = HOURS[now.dow], closedDay = CLOSED_DATES.indexOf(now.ymd) >= 0;
    var open = h && !closedDay && now.min >= h[0] * 60 && now.min < h[1] * 60;
    var text;
    if (open) { text = 'Bolt most nyitva · ma ' + h[1] + ':00-ig'; }
    else if (h && !closedDay && now.min < h[0] * 60) { text = 'Bolt zárva · ma ' + h[0] + ':00-kor nyit'; }
    else {
      var names = ['vasárnap', 'hétfőn', 'kedden', 'szerdán', 'csütörtökön', 'pénteken', 'szombaton'];
      for (var k = 1; k <= 7; k++) {
        var d = (now.dow + k) % 7;
        if (HOURS[d]) { text = 'Bolt zárva · ' + (k === 1 ? 'holnap' : names[d]) + ' ' + HOURS[d][0] + ':00-kor nyit'; break; }
      }
    }
    a.className = 'rr-open ' + (open ? 'on' : 'off');
    a.innerHTML = '<i></i>' + text;
  }

  /* ---------- 13 christmas bar ---------- */
  function xmasBar() {
    if (budapestNow().ymd > XMAS_UNTIL || document.querySelector('.rr-xmas')) { return; }
    var head = document.querySelector('.header');
    if (!head) { return; }
    /* owner 2026-11-14: this text only, in caps (the .rr-xmas style is uppercase) */
    var bar = el('div', 'rr-xmas', '<span class="rr-xmas-text">Rendeld meg időben az ajándékokat, hogy karácsonyra megérkezzenek!</span>');
    var top = head.closest('.section-wrapper') || head;
    top.parentNode.insertBefore(bar, top);
  }

  /* ---------- 14 concert tiles (Accept, Manowar, BFMV + Pendulum, Sabaton): full-width rows, buttons aligned, each retires after its date ---------- */
  function sabatonTile() {
    if (!isHome || document.querySelector('.rr-gigs')) { return; }
    var today = budapestNow().ymd;
    var gigs = GIGS.filter(function (g) { return today <= g.until; });
    if (!gigs.length) { return; }
    var target = document.querySelector('.module-special-wrapper');
    if (!target) { return; }
    if (!document.getElementById('rr-gig-font')) {
      var f = el('link'); f.id = 'rr-gig-font'; f.rel = 'stylesheet';
      f.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&display=swap';
      document.head.appendChild(f);
    }
    var wrap = el('div', 'container');
    var grid = el('div', 'rr-gigs');
    wrap.appendChild(grid);
    gigs.forEach(function (g) {
      var url = '/index.php?route=product/list&keyword=' + encodeURIComponent(g.keyword);
      var w = el('div', 'rr-gigwrap');
      w.innerHTML = '<div class="rr-gig g-' + g.key + '"><div class="art" style="background-image:url(' + GIG_ASSETS + g.key + '-battle.webp)"></div><div class="shade"></div>' +
        '<div class="lt"><img class="logo" src="' + GIG_ASSETS + g.key + '-logo.webp" alt="' + g.label + '">' +
        '<div class="txt"><h3>Budapesti Koncert</h3>' +
        '<div class="d"><b>' + g.date + '</b><span>&middot;</span>' + g.place + '</div></div></div>' +
        '<div class="stub"><a class="btn" href="' + url + '">' + (g.btn || g.label) + ' termékek</a></div></div>';
      grid.appendChild(w);
    });
    target.parentNode.insertBefore(wrap, target);
  }

  /* ---------- 16, 17 toasts (one at a time) ---------- */
  function toast(html, accent) {
    if (document.querySelector('.rr-toast')) { return; }
    var t = el('div', 'rr-toast', '<button type="button" class="x" aria-label="Bezárás">&times;</button>' + html);
    if (accent) { t.style.borderLeftColor = accent; }
    var bottom = phone() && document.querySelector('.rr-bottomnav') ? 76 : 20;
    var cookie = document.querySelector('.nanobar');
    if (cookie && cookie.offsetHeight && getComputedStyle(cookie).display !== 'none') { bottom += cookie.offsetHeight; }
    t.style.bottom = bottom + 'px';
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 30);
    function close() { t.classList.remove('show'); setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 300); }
    t.querySelector('.x').addEventListener('click', close);
    setTimeout(close, 12000);
  }
  function toasts() {
    if (isCart) { return; }
    var internal = document.referrer && document.referrer.indexOf(location.host) >= 0;
    if (ss && !ss.getItem('rr-cart-toast') && !internal) {
      ss.setItem('rr-cart-toast', '1');
      cartInfo(function (d) {
        if (d.count > 0) {
          toast('<b>A kosaradban ' + d.count + ' termék vár</b><div style="margin-top:6px;color:#9cc7e3">Összesen ' + ft(d.total) +
            '</div><a class="go" href="/index.php?route=checkout/cart">Tovább a kosárhoz</a>');
        } else { firstVisit(); }
      });
      return;
    }
    firstVisit();
  }
  function firstVisit() {
    if (!ls || ls.getItem('rr-first-visit')) { return; }
    ls.setItem('rr-first-visit', String(Date.now()));
    setTimeout(function () {
      toast('<b>Ingyenes személyes átvétel</b><div style="margin-top:6px;color:#9cc7e3">Budapesten, a boltunkban: 1146 Dózsa György út 19.<br>' +
        'Hétfő–péntek 12–18, szombat 10–14</div>', '#7fc4ea');
    }, 2500);
  }

  /* ---------- run ---------- */
  ready(function () {
    xmasBar();
    openChip();
    setInterval(openChip, 60000);
    sabatonTile();
    watchCards();
    savings();
    listState();
    if (isProduct) { shipBar(); bandLink(); stickyBar(); sizeChart(); }
    toasts();
  });
  document.addEventListener('cartChanged', function () { if (isProduct) { setTimeout(shipBar, 300); } });
  if (window.MutationObserver) {
    var tm = null;
    new MutationObserver(function () {
      clearTimeout(tm);
      tm = setTimeout(function () { watchCards(); savings(); }, 250);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();

/* Round 6 (owner 2026-11-14): menu dropdown centred (was stuck to the left edge on wide screens),
   tighter / bigger advantages strip ("very airy ... too much empty space"), TikTok next to Facebook and
   Instagram + the same buttons at the top of the page, light snowfall on the red Christmas bar. */
(function () {
  'use strict';
  if (window.__rrRound6) { return; }
  window.__rrRound6 = true;
  var TIKTOK = 'https://www.tiktok.com/@ragnarock.hu';  /* owner 2026-11-14; empty = no TikTok button */
  var css =
    /* dropdown centred under the menu */
    '@media (min-width: 992px) { .header-bottom .js-subtree-dropdown { left: 0 !important; right: 0 !important; width: auto !important;' +
    ' max-width: 1800px; margin-left: auto !important; margin-right: auto !important; } }' +
    /* advantages strip: three boxed cards, bigger icons and text, less empty space */
    '.advantages-module, .advantages-module .module-body { padding-top: 0 !important; padding-bottom: 0 !important; margin-top: 0 !important; margin-bottom: 0 !important; }' +
    '.section-wrapper:has(.advantages-module) { padding-top: 20px !important; padding-bottom: 20px !important; }' +
    '.advantages-grid, .product-advantages-grid { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 16px !important;' +
    ' padding-top: 0 !important; padding-bottom: 0 !important; }' +
    '.module.advantages-module { margin-bottom: 0 !important; }' +
    '.advantages-item, .product-advantages-item { background: rgba(127,196,234,.06); border: 1px solid rgba(127,196,234,.22); border-radius: 8px;' +
    ' padding: clamp(14px, 1.1vw, 26px) clamp(18px, 1.4vw, 32px) !important; margin: 0 !important; align-items: center !important; gap: 18px; max-width: none !important; width: auto !important; }' +
    '.advantages-item__image, .product-advantages-item__image { height: clamp(42px, 2.6vw, 72px) !important; width: auto !important; }' +
    '.advantages-item__image-wrapper, .product-advantages-item__image-wrapper { margin: 0 !important; }' +
    /* EU map icon (owner 2026-11-14 "too tiny"): its PNG comes padded into a 60x100 box, so it gets the
       square original (swapped in below) and the same square size as the other two icons */
    '.advantages-item__image[src*="a56ae8c1"], .product-advantages-item__image[src*="a56ae8c1"] { width: clamp(42px, 2.6vw, 72px) !important; object-fit: contain; transform: scale(1.4); }' +
    /* SEO headline band (owner 2026-11-14 "this isnt in the middle"): the module's 36px bottom margin pushed the text up */
    '.module.seoh1-module { margin-top: 0 !important; margin-bottom: 0 !important; } .seoh1-module h1 { margin: 0 !important; }' +
    '.advantages-item__title, .product-advantages-item__title { font-size: clamp(15px, 1.05vw, 26px) !important; margin: 0 0 4px !important; letter-spacing: .02em; }' +
    '.advantages-item__text, .product-advantages-item__text { font-size: clamp(13px, .8vw, 19px) !important; line-height: 1.4 !important; opacity: .9; }' +
    '@media (max-width: 767px) { .advantages-grid, .product-advantages-grid { grid-template-columns: 1fr !important; gap: 10px !important; }' +
    ' .advantages-item, .product-advantages-item { padding: 14px 16px !important; } }' +
    /* social buttons at the top (desktop header row) */
    '.rr-social-top { display: inline-flex; gap: 8px; align-items: center; margin-right: 14px; }' +
    '.rr-social-top a { display: inline-flex; width: 26px; height: 26px; }' +
    '.rr-social-top svg { width: 26px !important; height: 26px !important; }' +
    /* Christmas bar v2 (owner 2026-11-14): ~15% taller, string lights on the top edge, canvas snowfall */
    '.rr-xmas { position: relative; overflow: hidden; padding: 14px 14px 8px !important; font-size: 14px !important; }' +
    '.rr-xmas-text { position: relative; z-index: 3; text-shadow: 0 1px 3px rgba(0,0,0,.45); }' +
    '.rr-xmas canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; }' +
    '.rr-lights { position: absolute; left: 0; right: 0; top: 0; height: 14px; z-index: 4; pointer-events: none; }' +
    '.rr-lights svg { position: absolute; left: 0; top: 0; width: 100%; height: 8px; }' +
    '.rr-bulb { position: absolute; top: 3px; width: 6px; height: 9px; border-radius: 45% 45% 50% 50% / 40% 40% 60% 60%;' +
    ' }' +
    '.rr-bgrp { position: absolute; inset: 0; animation: rrtwinkle 2.6s ease-in-out infinite; will-change: opacity; }' +
    '.rr-bgrp.g2 { animation-delay: -1.3s; }' +
    '.rr-xmas.rr-off .rr-bgrp { animation-play-state: paused; }' +
    '.rr-bulb::before { content: ""; position: absolute; left: 1px; top: -2px; width: 4px; height: 3px; background: #2a2a2a; border-radius: 1px; }' +
    '.rr-bulb.c0 { background: #ff4b4b; box-shadow: 0 0 6px 2px rgba(255,75,75,.75); }' +
    '.rr-bulb.c1 { background: #4dff88; box-shadow: 0 0 6px 2px rgba(77,255,136,.7); }' +
    '.rr-bulb.c2 { background: #ffd34d; box-shadow: 0 0 6px 2px rgba(255,211,77,.75); }' +
    '.rr-bulb.c3 { background: #7fd4ff; box-shadow: 0 0 6px 2px rgba(127,212,255,.75); }' +
    '@keyframes rrtwinkle { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }' +
    '@media (prefers-reduced-motion: reduce) { .rr-bgrp { animation: none; } }';
  var style = document.createElement('style');
  style.id = 'rr-round6';
  style.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(style);

  var TT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 35 35" fill="none"><rect width="35" height="35" rx="10" fill="#fff"/>' +
    '<path d="M21.6 8.5c.5 2.4 2 3.9 4.4 4.1v3.3c-1.6.1-3-.4-4.4-1.2v6.6c0 4-3.1 6.4-6.4 6.2-3.4-.2-5.8-3.3-5.2-6.7.5-2.8 3.1-4.9 6.1-4.6v3.4' +
    'c-1.6-.4-3 .6-3.2 2-.3 1.6 1 3 2.6 2.9 1.4-.1 2.4-1.2 2.4-2.7V8.5h3.7z" fill="#0b1a28"/></svg>';
  function addTikTok(wrap) {
    if (!TIKTOK || !wrap || wrap.querySelector('.rr-tiktok')) { return; }
    var a = document.createElement('a');
    a.className = 'social-link rr-tiktok';
    a.href = TIKTOK; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'TikTok');
    a.innerHTML = TT_SVG;
    wrap.appendChild(a);
  }
  function apply() {
    var wraps = document.querySelectorAll('.social-links-wrapper');
    for (var i = 0; i < wraps.length; i++) { addTikTok(wraps[i]); }
    /* EU map icon: the theme serves it padded into 60x100; use the square 300px copy of the same file */
    var eu = document.querySelectorAll('img[src*="a56ae8c1-7bd3-4331-8f81-3250ffb03cdf"]');
    for (var k = 0; k < eu.length; k++) {
      eu[k].src = eu[k].src.replace(/\/cache\/w\d+h\d+(q\d+)?\//, '/cache/w300h300q100/');
      eu[k].removeAttribute('srcset');
    }
    /* copy at the top: next to the shop open/closed chip in the header row */
    var src = wraps[0], row = document.querySelector('.header-top-row');
    var ul = row && row.querySelector('ul');
    if (src && ul && !document.querySelector('.rr-social-top')) {
      var top = document.createElement('div');
      top.className = 'rr-social-top';
      var links = src.querySelectorAll('a');
      for (var j = 0; j < links.length; j++) {
        var c = links[j].cloneNode(true);
        c.target = '_blank'; c.rel = 'noopener';
        top.appendChild(c);
      }
      ul.parentNode.insertBefore(top, ul);
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 50); }); } else { setTimeout(apply, 50); }
})();

/* Admin quick delete (owner 2026-11-14): when the shop owner is logged in to the admin (the theme then shows
   its pencil "edit" links), every product card gets a TÖRLÉS button and product pages a TERMÉK TÖRLÉSE button.
   First click arms it ("BIZTOS? KATTINTS ÚJRA", 4 s), second click deletes through the admin's own GraphQL
   (same request as the admin product list's Törlés). Visitors never see it: no pencil = no button, and the
   request only works with the admin login. Success is checked by the product page returning "not found". */
(function () {
  'use strict';
  if (window.__rrAdminDelete) { return; }
  window.__rrAdminDelete = true;
  var MUTATION = 'mutation deleteProducts($data: [ProductIdInput!]!) { deleteProducts(productIdsInput: $data) { deletedQuantity } }';
  var css =
    /* bottom-left of the photo: the top-left corner holds the discount badge (owner 2026-11-14) */
    '.rr-del{position:absolute;z-index:60;bottom:8px;left:8px;top:auto;background:#e52421;color:#fff;border:0;border-radius:4px;padding:6px 10px;' +
    'font:800 11.5px/1 Poppins,Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;opacity:0;transition:opacity .15s;box-shadow:0 2px 8px rgba(0,0,0,.4)}' +
    '.product-card:hover .rr-del,.rr-del.armed,.rr-del.busy,.rr-del.page{opacity:1}' +
    '.rr-del.armed{background:#8e0f0d;outline:2px solid #fff}.rr-del.busy{background:#555;cursor:wait}' +
    '.rr-del.page{position:static;margin:0 0 12px;padding:10px 16px;font-size:13px}' +
    '.rr-deleted{position:relative;pointer-events:none}.rr-deleted::after{content:"TÖRÖLVE";position:absolute;inset:0;z-index:40;display:flex;' +
    'align-items:center;justify-content:center;background:rgba(0,0,0,.72);color:#ff6b68;font:900 22px Poppins,Arial,sans-serif;letter-spacing:.08em}';
  function idFrom(a) { var m = (a.getAttribute('href') || '').match(/[?&]product_id=(\d+)/); return m ? m[1] : null; }
  function gone(url, done) {
    if (!url) { done(true); return; }
    var x = new XMLHttpRequest();
    x.open('GET', url + (url.indexOf('?') >= 0 ? '&' : '?') + 'rrcheck=' + Date.now(), true);
    /* the shop answers 200 with "A termék nem található!" for a deleted product */
    x.onloadend = function () { done(x.status === 404 || x.status === 410 || /A termék nem található/.test(x.responseText || '')); };
    x.send();
  }
  function remove(id, url, btn, onDone) {
    btn.classList.remove('armed'); btn.classList.add('busy'); btn.textContent = 'Törlés…';
    var x = new XMLHttpRequest();
    x.open('POST', '/admin/graphql?operation_name=deleteProducts', true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.withCredentials = true;
    x.onloadend = function () {
      var ok = false;
      try { ok = x.status === 200 && !JSON.parse(x.responseText).errors; } catch (e) { ok = false; }
      if (!ok) { btn.classList.remove('busy'); btn.textContent = 'Hiba – nem törölve'; return; }
      setTimeout(function () {
        gone(url, function (really) {
          btn.classList.remove('busy');
          if (!really) { btn.textContent = 'Nem sikerült'; return; }
          try {
            var log = JSON.parse(localStorage.getItem('rr-deleted') || '[]');
            log.push({ id: id, url: url, at: new Date().toISOString() });
            localStorage.setItem('rr-deleted', JSON.stringify(log.slice(-500)));
          } catch (e) { /* private window */ }
          onDone();
        });
      }, 600);
    };
    x.send(JSON.stringify({ operationName: 'deleteProducts', query: MUTATION, variables: { data: [{ productId: String(id) }] } }));
  }
  function armable(btn, label, go) {
    var timer = null;
    btn.textContent = label;
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (btn.classList.contains('busy')) { return; }
      if (!btn.classList.contains('armed')) {
        btn.classList.add('armed'); btn.textContent = 'Biztos? Kattints újra';
        timer = setTimeout(function () { btn.classList.remove('armed'); btn.textContent = label; }, 4000);
        return;
      }
      clearTimeout(timer);
      go();
    });
  }
  function scan() {
    var links = document.querySelectorAll('a.edit-link[href*="catalog/product/update"]:not([data-rr-del])');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], id = idFrom(a);
      a.setAttribute('data-rr-del', '1');
      if (!id) { continue; }
      var card = a.closest('.product-card');
      if (card) {
        if (card.querySelector('.rr-del')) { continue; }
        var link = card.querySelector('a.product-card__title-link, a.product-card-image__link');
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'rr-del';
        var img = card.querySelector('.product-card-image') || card;
        if (getComputedStyle(img).position === 'static') { img.style.position = 'relative'; }
        img.appendChild(b);
        (function (b, id, card, url) {
          armable(b, 'Törlés', function () {
            remove(id, url, b, function () { card.classList.add('rr-deleted'); b.style.display = 'none'; });
          });
        })(b, id, card, link ? link.href : null);
        continue;
      }
      if (a.closest('.product-page-head-title') && !document.querySelector('.rr-del.page')) {
        var h = document.querySelector('.product-page-middle h1, h1');
        var pb = document.createElement('button');
        pb.type = 'button'; pb.className = 'rr-del page';
        h.parentNode.insertBefore(pb, h);
        (function (pb, id) {
          armable(pb, 'Termék törlése', function () {
            remove(id, location.href.split('#')[0], pb, function () {
              pb.textContent = 'Törölve – vissza…';
              setTimeout(function () { if (history.length > 1) { history.back(); } else { location.href = '/'; } }, 900);
            });
          });
        })(pb, id);
      }
    }
  }
  function start() {
    if (!document.querySelector('a.edit-link')) { return; }  /* not logged in to the admin: nothing at all */
    var st = document.createElement('style');
    st.id = 'rr-admin-delete';
    st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
    scan();
    if (window.MutationObserver) {
      var t = null;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 300); }).observe(document.documentElement, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); } else { start(); }
})();

/* Christmas bar v2 (owner 2026-11-14): a string of twinkling lights hanging from the top edge and a real
   snowfall (each flake its own size, speed, sideways sway and depth) drawn on a canvas behind the text.
   Pauses when the bar is off screen or the tab is hidden; still lights and no snow for "reduce motion". */
(function () {
  'use strict';
  if (window.__rrXmas2) { return; }
  window.__rrXmas2 = true;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function lights(bar) {
    var box = document.createElement('div');
    box.className = 'rr-lights';
    var w = Math.max(bar.clientWidth, window.screen ? screen.width : 0), step = 30, n = Math.ceil(w / step) + 1, path = 'M0 2';  /* enough for a wider window later */
    for (var i = 0; i < n; i++) { path += ' Q' + (i * step + step / 2) + ' 7 ' + ((i + 1) * step) + ' 2'; }
    box.style.width = (n * step) + 'px';
    box.innerHTML = '<svg viewBox="0 0 ' + (n * step) + ' 8" preserveAspectRatio="none"><path d="' + path +
      '" fill="none" stroke="#1d2a1d" stroke-width="1.6"/></svg>';
    /* perf (owner 2026-11-15): two groups that blink in turn (2 layers for the phone, not one per bulb) */
    var groups = [document.createElement('div'), document.createElement('div')];
    groups[0].className = 'rr-bgrp'; groups[1].className = 'rr-bgrp g2';
    for (var j = 0; j < n; j++) {
      var b = document.createElement('span');
      b.className = 'rr-bulb c' + (j % 4);
      b.style.left = (j * step + step / 2 - 3) + 'px';
      groups[j % 2].appendChild(b);
    }
    box.appendChild(groups[0]); box.appendChild(groups[1]);
    bar.appendChild(box);
  }
  function snow(bar) {
    var c = document.createElement('canvas'), ctx = c.getContext && c.getContext('2d');
    if (!ctx) { return; }
    bar.appendChild(c);
    var flakes = [], W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), running = true, visible = true, last = 0;
    function size() {
      W = bar.clientWidth; H = bar.clientHeight;
      c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var want = Math.round(W / 14);
      while (flakes.length < want) { flakes.push(make(true)); }
      flakes.length = want;
    }
    function make(anywhere) {
      var z = Math.random();  /* depth: near flakes are bigger, faster, brighter */
      return { x: Math.random() * W, y: anywhere ? Math.random() * H : -4, r: 0.6 + z * 1.9, v: 7 + z * 22,
        sway: 4 + Math.random() * 10, phase: Math.random() * 6.28, freq: 0.6 + Math.random() * 1.2, a: 0.35 + z * 0.6 };
    }
    function frame(t) {
      if (!running) { return; }
      if (last && t - last < 30) { requestAnimationFrame(frame); return; }  /* ~30 fps is plenty for snow */
      var dt = Math.min(0.08, (t - (last || t)) / 1000); last = t;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.y += f.v * dt; f.phase += f.freq * dt;
        if (f.y - f.r > H) { flakes[i] = f = make(false); }
        var x = f.x + Math.sin(f.phase) * f.sway;
        ctx.beginPath(); ctx.arc(x, f.y, f.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(255,255,255,' + f.a.toFixed(2) + ')'; ctx.fill();
      }
      if (visible && !document.hidden) { requestAnimationFrame(frame); } else { running = false; }
    }
    function resume() { if (!running && visible && !document.hidden) { running = true; last = 0; requestAnimationFrame(frame); } }
    size();
    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', resume);
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; bar.classList.toggle('rr-off', !visible); resume(); }).observe(bar);
    }
    requestAnimationFrame(frame);
  }
  function cssSnow(bar) {
    if (!document.getElementById('rr-snowcss')) {
      var dot = function (x, y, r, a) { return 'radial-gradient(circle at ' + x + 'px ' + y + 'px, rgba(255,255,255,' + a + ') ' + r + 'px, transparent ' + (r + 0.6) + 'px)'; };
      var near = [], far = [];
      for (var i = 0; i < 14; i++) {
        near.push(dot(Math.round(Math.random() * 180), Math.round(Math.random() * 120), (1.2 + Math.random() * 0.9).toFixed(1), (0.6 + Math.random() * 0.3).toFixed(2)));
        far.push(dot(Math.round(Math.random() * 120), Math.round(Math.random() * 90), (0.6 + Math.random() * 0.5).toFixed(1), (0.3 + Math.random() * 0.25).toFixed(2)));
      }
      var st = document.createElement('style');
      st.id = 'rr-snowcss';
      st.textContent =
        '.rr-snowl{position:absolute;left:0;right:0;top:-120px;height:calc(100% + 120px);z-index:2;pointer-events:none;will-change:transform;' +
        'animation:rrsnow 7s linear infinite}' +
        '.rr-snowl.n{background:' + near.join(',') + ';background-size:180px 120px}' +
        '.rr-snowl.f{top:-90px;height:calc(100% + 90px);background:' + far.join(',') + ';background-size:120px 90px;animation-duration:11s}' +
        '.rr-xmas.rr-off .rr-snowl{animation-play-state:paused}' +
        '@keyframes rrsnow{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,120px,0)}}' +
        '.rr-snowl.f{animation-name:rrsnowf}@keyframes rrsnowf{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,90px,0)}}';
      document.head.appendChild(st);
    }
    var f = document.createElement('div'); f.className = 'rr-snowl f';
    var n = document.createElement('div'); n.className = 'rr-snowl n';
    bar.appendChild(f); bar.appendChild(n);
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (e) { bar.classList.toggle('rr-off', !e[0].isIntersecting); }).observe(bar);
    }
  }
  var tries = 0;
  (function wait() {
    var bar = document.querySelector('.rr-xmas');
    if (!bar) { if (tries++ < 40) { setTimeout(wait, 150); } return; }
    if (bar.getAttribute('data-rr-deco')) { return; }
    bar.setAttribute('data-rr-deco', '1');
    /* perf: decorate after the page has loaded, so it does not slow the first paint on older phones */
    /* phones/tablets (owner 2026-11-15, top of page lagged): the canvas snow made the phone repaint the whole top
       of the page every frame. There the snow is two dotted layers slid by the graphics chip instead (no repaint). */
    var light = (window.matchMedia && matchMedia('(hover: none), (max-width: 991px)').matches);
    function go() { setTimeout(function () { lights(bar); if (!reduce) { if (light) { cssSnow(bar); } else { snow(bar); } } }, 300); }
    if (document.readyState === 'complete') { go(); } else { window.addEventListener('load', go); }
  })();
})();

/* Admin quick "remove discount" (owner 2026-11-14): logged-in admin only (theme pencil links present).
   Hovering the discount badge of a product card shows a big X; first click arms it ("BIZTOS?", 4 s),
   second click opens the product's own admin edit page in an invisible frame, removes every row on its
   Akciók tab, unselects the AKCIÓS TERMÉKEK category (15455) and presses the page's own Mentés - the same
   as doing it by hand. Then the edit page is read again to confirm before the card is updated. */
(function () {
  'use strict';
  if (window.__rrUnsale) { return; }
  window.__rrUnsale = true;
  var SALE_CATEGORY = '15455';
  var X = '✕';
  var css =
    '.rr-unsale{position:absolute;z-index:70;top:0;left:0;min-width:58px;min-height:44px;width:100%;height:100%;display:flex;align-items:center;' +
    'justify-content:center;background:rgba(10,10,10,.82);color:#fff;border:2px solid #e52421;border-radius:4px;font:900 30px/1 Arial,sans-serif;' +
    'cursor:pointer;opacity:0;transition:opacity .12s;padding:0 8px;white-space:nowrap}' +
    '.rr-unsale:hover,.rr-unsale.armed,.rr-unsale.busy{opacity:1}' +
    '.rr-unsale.armed{font-size:12px;background:#8e0f0d;letter-spacing:.04em}.rr-unsale.busy{font-size:12px;background:#555;cursor:wait}' +
    '.rr-unsale-done{position:absolute;z-index:70;top:8px;left:8px;background:#1a9b3c;color:#fff;font:800 11px Poppins,Arial,sans-serif;' +
    'padding:5px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.04em}';

  function editUrl(card) {
    var a = card.querySelector('a.edit-link[href*="catalog/product/update"]');
    return a ? a.getAttribute('href') : null;
  }
  /* read the edit page: is the form there, how many discount rows, is the sale category still selected */
  function state(url, done) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.withCredentials = true;
    x.onloadend = function () {
      try {
        var d = new DOMParser().parseFromString(x.responseText, 'text/html');
        var sel = d.querySelector('select[name="product_category[]"]');
        var opt = sel && sel.querySelector('option[value="' + SALE_CATEGORY + '"]');
        done({ ok: !!d.getElementById('form'), specials: d.querySelectorAll('[id^="special_row"]').length, sale: !!(opt && opt.selected) });
      } catch (e) { done({ ok: false }); }
    };
    x.send();
  }
  function unsale(url, done) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-10000px;top:0;width:1300px;height:900px;opacity:0;pointer-events:none;border:0';
    var step = 0;
    var timer = setTimeout(function () { finish(false, 'időtúllépés'); }, 45000);
    function finish(ok, why) {
      clearTimeout(timer);
      setTimeout(function () { if (f.parentNode) { f.parentNode.removeChild(f); } }, 500);
      done(ok, why);
    }
    f.onload = function () {
      step += 1;
      var doc;
      try { doc = f.contentDocument; } catch (e) { finish(false, 'nincs hozzáférés'); return; }
      if (step === 1) {
        var form = doc && doc.getElementById('form');
        if (!form) { finish(false, 'nincs szerkesztő űrlap'); return; }
        var rows = doc.querySelectorAll('[id^="special_row"]');
        for (var i = 0; i < rows.length; i++) { rows[i].parentNode.removeChild(rows[i]); }
        var sel = doc.querySelector('select[name="product_category[]"]');
        var opt = sel && sel.querySelector('option[value="' + SALE_CATEGORY + '"]');
        if (opt) {
          opt.selected = false;
          try { f.contentWindow.jQuery(sel).trigger('change').trigger('chosen:updated'); } catch (e) { /* plain select */ }
        }
        var save = Array.prototype.filter.call(doc.querySelectorAll('a,button'), function (e) { return e.textContent.trim() === 'Mentés'; })[0];
        if (!save) { finish(false, 'nincs Mentés gomb'); return; }
        save.click();
        return;
      }
      /* the edit page reloaded after Mentés: confirm from a fresh read */
      state(url, function (s) {
        if (s.ok && s.specials === 0 && !s.sale) { finish(true); } else { finish(false, 'mentés után még akciós'); }
      });
    };
    f.src = url;
    document.body.appendChild(f);
  }
  function arm(btn, run) {
    var t = null;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (btn.classList.contains('busy')) { return; }
      if (!btn.classList.contains('armed')) {
        btn.classList.add('armed');
        btn.textContent = 'BIZTOS?';
        t = setTimeout(function () { btn.classList.remove('armed'); btn.textContent = X; }, 4000);
        return;
      }
      clearTimeout(t);
      run();
    });
  }
  function onCardDone(card) {
    var badges = card.querySelector('.product_badges');
    if (badges) { badges.style.display = 'none'; }
    var price = card.querySelector('.product-card__price');
    if (price) {
      var nums = (price.textContent.match(/\d[\d.]*\s*Ft/g) || []).map(function (s) { return Number(s.replace(/\D/g, '')); }).filter(Boolean);
      if (nums.length >= 2) {
        var hi = Math.max.apply(null, nums);
        price.innerHTML = '<span class="snapshot-price snapshot-price--regular">' + String(hi).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Ft</span>';
      }
    }
    var img = card.querySelector('.product-card-image') || card;
    var tag = document.createElement('div');
    tag.className = 'rr-unsale-done';
    tag.textContent = 'Akció törölve';
    img.appendChild(tag);
  }
  function scan() {
    var cards = document.querySelectorAll('.product-card:not([data-rr-unsale])');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      card.setAttribute('data-rr-unsale', '1');
      var badges = card.querySelector('.product_badges');
      var url = editUrl(card);
      if (!badges || !url || !/-\d+\s*%/.test(badges.textContent)) { continue; }
      if (getComputedStyle(badges).position === 'static') { badges.style.position = 'relative'; }
      badges.style.pointerEvents = 'auto';
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rr-unsale';
      b.textContent = X;
      b.title = 'Akció törlése (2 kattintás)';
      badges.appendChild(b);
      (function (b, card, url) {
        arm(b, function () {
          b.classList.remove('armed');
          b.classList.add('busy');
          b.textContent = 'MENTÉS…';
          unsale(url, function (ok, why) {
            b.classList.remove('busy');
            if (ok) { onCardDone(card); } else { b.classList.add('armed'); b.textContent = 'HIBA: ' + (why || ''); }
          });
        });
      })(b, card, url);
    }
  }
  function start() {
    if (!document.querySelector('a.edit-link')) { return; }  /* not logged in to the admin */
    var st = document.createElement('style');
    st.id = 'rr-unsale';
    st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
    scan();
    if (window.MutationObserver) {
      var t = null;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 300); })
        .observe(document.documentElement, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); } else { start(); }
})();

/* Newsletter 10% coupon pop-up (owner 2026-11-15). Signs people up through the shop's own newsletter
   form; the order-tracker Apps Script (NewsletterCoupon.js) then emails a single-use 10% code from
   info@ragnarock.hu within about 10 minutes, first order only, one code per email address.
   Shows: PC when the mouse leaves through the top of the window; phones/tablets after 40 s on the
   second page viewed. Never on cart or checkout. Once per 30 days, never again after signing up.
   Test: add #rr-nl to any URL to open it straight away. */
(function () {
  'use strict';
  if (window.__rrNlPop) { return; }
  window.__rrNlPop = true;
  var path = location.pathname + location.search;
  if (/checkout|kosar|route=account|success/i.test(path)) { return; }
  var KEY = 'rr-nl-pop', DAY = 864e5;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  var force = location.hash === '#rr-nl';
  var st = {};
  try { st = JSON.parse(get(KEY) || '{}') || {}; } catch (e) { st = {}; }
  if (!force && (st.done || (st.shown && Date.now() - st.shown < 30 * DAY))) { return; }
  st.views = (st.views || 0) + 1;
  if (!force) { set(KEY, JSON.stringify(st)); }

  var css =
    '.rr-nl-bg{position:fixed;inset:0;background:rgba(2,8,16,.72);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .25s}' +
    '.rr-nl-bg.show{opacity:1}' +
    /* owner 2026-11-15: RagnaRock look - grain + navy glow like the site background, light blue border, chrome-blue lettering */
    '.rr-nl{position:relative;width:100%;max-width:440px;background:#4f8fbf;border-radius:10px;padding:30px 26px 22px;color:#e8eef4;font-family:inherit;text-align:center;' +
    'overflow:hidden;isolation:isolate;box-shadow:0 0 0 1px rgba(0,0,0,.6),0 0 28px rgba(127,196,234,.28),0 20px 60px rgba(0,0,0,.6)}' +
    /* light running around the border (owner 2026-11-15): a rotating glint behind the box, the box face covers all but a 1.5px rim.
       Only transform is animated, so the graphics chip does it without repainting. */
    '.rr-nl:before{content:"";position:absolute;left:50%;top:50%;width:1100px;height:1100px;translate:-50% -50%;z-index:-2;will-change:rotate;' +
    'background:conic-gradient(from 0deg,rgba(127,196,234,.35) 0deg,rgba(127,196,234,.35) 250deg,#d8f1ff 300deg,#ffffff 315deg,#9fd6f7 330deg,rgba(127,196,234,.35) 360deg);' +
    'animation:rrnlspin 4.5s linear infinite}' +
    '.rr-nl:after{content:"";position:absolute;inset:1.5px;border-radius:9px;z-index:-1;background:url(\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27220%27 height=%27220%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27turbulence%27 baseFrequency=%27.8%27 numOctaves=%272%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix values=%270 0 0 0 .35 0 0 0 0 .62 0 0 0 0 .85 0 0 0 -2.2 1.05%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%27.07%27/%3E%3C/svg%3E\"),radial-gradient(ellipse 90% 70% at 50% 20%,#0e4d78 0%,#07304f 45%,#031627 80%,#010811 100%)}' +
    '@keyframes rrnlspin{to{rotate:360deg}}' +
    '@media (prefers-reduced-motion: reduce){.rr-nl:before{animation:none}}' +
    '.rr-nl .x{position:absolute;top:8px;right:10px;background:none;border:0;color:#9fb3c6;font-size:28px;line-height:1;cursor:pointer;padding:4px 8px}' +
    '.rr-nl .big{font-family:"New Rocker",Georgia,serif;font-size:80px;line-height:.95;letter-spacing:1px;background:linear-gradient(180deg,#f6fcff 0%,#bedef2 42%,#8cb8d8 50%,#96c0de 56%,#def0fb 80%,#96c0de 100%);' +
    '-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 0 #031220) drop-shadow(0 0 1px #031220) drop-shadow(0 6px 14px rgba(0,0,0,.55))}' +
    '.rr-nl h3{margin:8px 0 12px;font-size:19px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#e3f1fa}' +
    '.rr-nl p{margin:0 0 16px;font-size:14px;line-height:1.5;color:#c4d2df}' +
    '.rr-nl input[type=text],.rr-nl input[type=email]{width:100%;box-sizing:border-box;margin:0 0 10px;padding:12px 14px;border-radius:6px;border:1px solid #2b4a66;background:#0a1826;color:#fff;font-size:15px}' +
    '.rr-nl input:focus{outline:none;border-color:#7fc4ea}' +
    '.rr-nl label{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;line-height:1.4;color:#9fb3c6;margin:4px 0 14px;cursor:pointer;text-align:left}' +
    '.rr-nl label input{margin-top:2px;flex:none}' +
    /* the one warm accent (owner 2026-11-15: "it's all blue"): the shop red on the button, white text */
    '.rr-nl button.go{width:100%;padding:14px;border:1px solid rgba(255,140,130,.45);border-radius:6px;background:linear-gradient(180deg,#f0453f 0%,#e52421 50%,#b81a17 100%);' +
    'color:#fff;font-weight:800;font-size:15px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;text-shadow:0 1px 1px rgba(0,0,0,.35);box-shadow:0 4px 14px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.3)}' +
    '.rr-nl button.go:hover{filter:brightness(1.08)}' +
    '.rr-nl button.go:disabled{opacity:.6;cursor:default}' +
    '.rr-nl .err{color:#ff8a80;font-size:13px;min-height:18px;margin:-4px 0 8px}' +
    '.rr-nl .fine{font-size:11px;color:#7f93a6;margin:12px 0 0}' +
    '.rr-nl .ok h3{color:#e3f1fa}';

  function open() {
    if (document.querySelector('.rr-nl-bg')) { return; }
    st.shown = Date.now(); set(KEY, JSON.stringify(st));
    if (!document.getElementById('rr-nl-font')) {
      var fl = document.createElement('link'); fl.id = 'rr-nl-font'; fl.rel = 'stylesheet';
      fl.href = 'https://fonts.googleapis.com/css2?family=New+Rocker&display=swap';
      document.head.appendChild(fl);
    }
    if (!document.getElementById('rr-nl-css')) {
      var s = document.createElement('style'); s.id = 'rr-nl-css'; s.appendChild(document.createTextNode(css));
      document.head.appendChild(s);
    }
    var bg = document.createElement('div');
    bg.className = 'rr-nl-bg';
    bg.innerHTML = '<div class="rr-nl" role="dialog" aria-modal="true" aria-label="Hírlevél kupon">' +
      '<button type="button" class="x" aria-label="Bezárás">&times;</button>' +
      '<div class="body"><div class="big">-10%</div><h3>A következő rendelésedből</h3>' +
      '<p>Iratkozz fel a hírlevelünkre, és emailben elküldjük az egyszer használható kuponkódodat.</p>' +
      '<form novalidate><input type="text" name="fn" placeholder="Keresztnév" autocomplete="given-name">' +
      '<input type="email" name="em" placeholder="E-mail cím" autocomplete="email" required>' +
      '<label><input type="checkbox" name="ok"> Hozzájárulok ahhoz, hogy a Ragnarock - webáruház a nevemet és e-mail címemet hírlevelezési céllal kezelje és a részemre gazdasági reklámot is tartalmazó email hírleveleket küldjön.</label>' +
      '<div class="err"></div><button type="submit" class="go">Kérem a kupont</button></form>' +
      '<div class="fine">Személyenként egy kupon jár, 30 napig érvényes. Ideiglenes vagy több e-mail címmel kért kuponokat érvénytelenítünk. Leiratkozni bármikor lehet.</div></div></div>';
    document.body.appendChild(bg);
    setTimeout(function () { bg.classList.add('show'); }, 20);
    function close() { bg.classList.remove('show'); setTimeout(function () { if (bg.parentNode) { bg.parentNode.removeChild(bg); } }, 250); }
    bg.querySelector('.x').addEventListener('click', close);
    bg.addEventListener('click', function (e) { if (e.target === bg) { close(); } });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    var f = bg.querySelector('form'), err = bg.querySelector('.err'), btn = bg.querySelector('.go');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = f.em.value.trim(), fn = f.fn.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(em)) { err.textContent = 'Adj meg egy érvényes e-mail címet.'; return; }
      if (!f.ok.checked) { err.textContent = 'A feliratkozáshoz pipáld be a hozzájárulást.'; return; }
      err.textContent = ''; btn.disabled = true; btn.textContent = 'Küldés…';
      var post = function (url, body) {
        return fetch(url, { method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: body });
      };
      post('/index.php?route=module/newsletter_subscribe/checkMail', 'value=' + encodeURIComponent(em))
        .then(function (r) { return r.text(); })
        .then(function (free) {
          if (parseInt(free, 10) === 0) { throw new Error('inuse'); }
          var q = ['subscriber_firstname=', 'subscriber_lastname=' + encodeURIComponent(fn),
            'subscriber_email=' + encodeURIComponent(em), 'subscriber_policy=1', 're-email=', 'status=1', 'language_id=1'];
          return post('/index.php?route=module/newsletter_subscribe/subscribe', q.join('&'));
        })
        .then(function () {
          st.done = Date.now(); set(KEY, JSON.stringify(st));
          bg.querySelector('.body').innerHTML = '<div class="ok"><div class="big">-10%</div><h3>Köszönjük, feliratkoztál!</h3>' +
            '<p>Néhány percen belül megérkezik a kuponkódod erre a címre: <b></b>. Ha nem látod, nézd meg a Promóciók vagy a Spam mappát is.</p>' +
            '<button type="button" class="go">Vásárlás folytatása</button></div>';
          bg.querySelector('.ok b').textContent = em;
          bg.querySelector('.ok .go').addEventListener('click', close);
        })
        .catch(function (x) {
          btn.disabled = false; btn.textContent = 'Kérem a kupont';
          if (x && x.message === 'inuse') {
            st.done = Date.now(); set(KEY, JSON.stringify(st));
            err.textContent = 'Ezzel a címmel már feliratkoztál a hírlevelünkre.';
          } else { err.textContent = 'Valami hiba történt, próbáld újra pár perc múlva.'; }
        });
    });
  }

  if (force) { setTimeout(open, 600); return; }
  var AUTO = true;  /* owner 2026-11-15: coupon emails live, pop-up on (false: only #rr-nl opens it) */
  if (!AUTO) { return; }
  var touch = window.matchMedia && matchMedia('(hover: none)').matches;
  if (touch) {
    if (st.views >= 2) { setTimeout(open, 40000); }
  } else {
    var armedAt = Date.now() + 5000;
    document.addEventListener('mouseout', function leave(e) {
      if (e.relatedTarget || e.clientY > 8 || Date.now() < armedAt) { return; }
      document.removeEventListener('mouseout', leave);
      open();
    });
  }
})();

/* Band logo strip (owner 2026-11-15): a row of band-logo buttons slowly sliding under the search bar, above the
   category bar, on every page except cart/checkout. Logos: assets/bands/*.webp built by band-logos/make_logos.py
   (393 bands, each has products). Each visit shows 36 at random (bands with more products come up more often).
   PC: hovering stops it, the mouse can also drag it. Phone: drag left/right with a finger, a tap on an empty
   gap stops / restarts it, a tap on a logo opens that band's search. Hidden once the page is scrolled (the header
   stays stuck to the top), a spacer keeps the page from jumping. Smooth on old phones: the slide is a single
   GPU-moved layer, no script runs while it slides. */
(function () {
  'use strict';
  if (window.__rrBands) { return; }
  window.__rrBands = true;
  if (/checkout|kosar|cart/i.test(location.pathname + location.search)) { return; }
  var BASE = 'https://1374223-star.github.io/rockpince-menu-counts/assets/bands/';
  var SHOW = 80, SPEED = 32;  /* logos per visit (owner 2026-11-15: was 36), px per second */
  var css =
    '.rr-bands{position:relative;height:58px;overflow:hidden;background:linear-gradient(180deg,rgba(3,16,28,.92),rgba(2,10,20,.96));' +
    'border-top:1px solid rgba(127,196,234,.14);border-bottom:1px solid rgba(127,196,234,.14)}' +
    '.rr-bands:before,.rr-bands:after{content:"";position:absolute;top:0;bottom:0;width:48px;z-index:2;pointer-events:none}' +
    '.rr-bands:before{left:0;background:linear-gradient(90deg,#020b16,rgba(2,11,22,0))}' +
    '.rr-bands:after{right:0;background:linear-gradient(270deg,#020b16,rgba(2,11,22,0))}' +
    '.rr-bands-vp{height:100%;overflow:hidden;touch-action:pan-y;cursor:grab;-webkit-user-select:none;user-select:none}' +
    '.rr-bands-vp.drag{cursor:grabbing}' +
    '.rr-bands-track{display:flex;align-items:center;height:100%;width:max-content;will-change:transform;' +
    'animation:rrbands var(--dur,120s) linear infinite}' +
    /* hover pause only with a real mouse: on phones the browser keeps the strip "hovered" after a touch, so it never restarted */
    '.rr-bands.paused .rr-bands-track,.rr-bands.off .rr-bands-track{animation-play-state:paused}' +
    '@media (hover:hover) and (pointer:fine){.rr-bands:hover .rr-bands-track{animation-play-state:paused}' +
    '.rr-blogo:hover img{filter:drop-shadow(0 0 5px rgba(140,205,245,.85)) drop-shadow(0 0 12px rgba(90,170,230,.45))}}' +
    '@keyframes rrbands{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}' +
    /* owner 2026-11-15: no visible buttons - the logo itself is the link, tight around it */
    '.rr-blogo{flex:none;display:block;margin-right:28px;opacity:.88;transition:opacity .15s,transform .15s}' +
    '.rr-blogo img{display:block;width:calc(var(--w) * 1px);height:auto;pointer-events:none;-webkit-user-drag:none}' +
    '.rr-blogo:hover{opacity:1;transform:scale(1.06)}' +
    '.rr-blogo:active img{filter:drop-shadow(0 0 5px rgba(140,205,245,.85))}' +
    '.rr-bands.paused:after{content:"\\275A\\275A";width:auto;right:10px;top:50%;bottom:auto;transform:translateY(-50%);font-size:11px;letter-spacing:-2px;' +
    'color:rgba(160,214,244,.8);background:none}' +
    '.rr-bands-spacer{height:0}' +
    '.header-sticky.headroom--not-top .rr-bands{display:none}' +
    '@media (max-width:991px){.rr-bands{height:50px}.rr-blogo{margin-right:22px}.rr-blogo img{width:calc(var(--w) * .82px)}' +
    '.rr-bands:before,.rr-bands:after{width:28px}}' +
    '@media (prefers-reduced-motion: reduce){.rr-bands-track{animation:none}.rr-bands-vp{overflow-x:auto}}';

  function pick(all) {
    var pool = all.slice(), out = [];
    while (out.length < SHOW && pool.length) {
      var tot = 0, i;
      for (i = 0; i < pool.length; i++) { tot += Math.sqrt(pool[i].c || 1) + 1; }
      var r = Math.random() * tot;
      for (i = 0; i < pool.length; i++) { r -= Math.sqrt(pool[i].c || 1) + 1; if (r <= 0) { break; } }
      out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
    }
    return out;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function build(all) {
    var header = document.querySelector('.section-wrapper.header-sticky .header') || document.querySelector('.header');
    var sticky = document.querySelector('.section-wrapper.header-sticky');
    if (!header || document.querySelector('.rr-bands')) { return; }
    var st = document.createElement('style'); st.id = 'rr-bands-css'; st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
    var list = pick(all), html = '';
    for (var k = 0; k < 2; k++) {  /* two copies: the slide loops seamlessly at -50% */
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        html += '<a class="rr-blogo" draggable="false" href="/index.php?route=product/list&amp;keyword=' + encodeURIComponent(b.k.toLowerCase()) +
          '" title="' + esc(b.n) + '"' + (k ? ' aria-hidden="true" tabindex="-1"' : '') + '><img src="' + BASE + b.s + '.webp" alt="' + esc(b.n) +
          '" width="' + b.w + '" height="' + b.h + '" style="--w:' + b.w + '" loading="lazy" decoding="async" draggable="false"></a>';
      }
    }
    var box = document.createElement('div');
    box.className = 'rr-bands';
    box.setAttribute('aria-label', 'Zenekarok');
    box.innerHTML = '<div class="rr-bands-vp"><div class="rr-bands-track">' + html + '</div></div>';
    var bottom = header.querySelector('.header-bottom');
    if (bottom) { header.insertBefore(box, bottom); } else { header.appendChild(box); }
    /* the strip hides once the page is scrolled; where the theme does not keep the header's height (phones),
       a spacer takes its place so the page does not jump. Measured, so it is 0 where the theme already does it (PC). */
    if (sticky && sticky.parentNode && window.MutationObserver) {
      var sp = document.createElement('div'); sp.className = 'rr-bands-spacer';
      sticky.parentNode.insertBefore(sp, sticky.nextSibling);
      var full = 0;
      var fit = function () {
        if (/headroom--not-top/.test(sticky.className)) { sp.style.height = Math.max(0, full - sticky.offsetHeight) + 'px'; }
        else { sp.style.height = '0'; full = sticky.offsetHeight; }
      };
      fit();
      new MutationObserver(fit).observe(sticky, { attributes: true, attributeFilter: ['class'] });
    }
    var vp = box.querySelector('.rr-bands-vp'), track = box.querySelector('.rr-bands-track');
    var half = 0, dur = 120;
    /* owner 2026-11-16 "sometimes it starts sliding really fast": the duration was measured while the strip was
       hidden (it hides when the page is scrolled; phones fire resize on scroll), so the width read as 0 and the
       30 s floor made 80 logos fly past. Now a hidden/unlaid-out strip is never measured, and it re-measures when
       its real width changes. */
    function measure() {
      var w = track.scrollWidth;
      if (!w || !box.offsetWidth || w < 2 * vp.clientWidth) { return; }
      var nd = Math.max(30, (w / 2) / SPEED);
      if (half && Math.abs(nd - dur) < 1) { return; }
      half = w / 2; dur = nd;
      track.style.setProperty('--dur', dur.toFixed(1) + 's');
    }
    measure();
    window.addEventListener('resize', function () { measure(); });
    if (window.ResizeObserver) { new ResizeObserver(function () { measure(); }).observe(track); }

    /* dragging: freeze the slide where it is, follow the finger/mouse, then let it carry on from there */
    var down = false, moved = false, sx = 0, base = 0, x = 0, pid = null;
    function current() {
      var m = getComputedStyle(track).transform;
      if (!m || m === 'none') { return 0; }
      var v = m.match(/matrix(3d)?\(([^)]+)\)/);
      if (!v) { return 0; }
      var n = v[2].split(',').map(Number);
      return v[1] ? n[12] : n[4];
    }
    function wrap(v) { if (!half) { return v; } while (v > 0) { v -= half; } while (v <= -half) { v += half; } return v; }
    vp.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) { return; }
      down = true; moved = false; sx = e.clientX; pid = e.pointerId;
      base = current(); x = base;
      track.style.animation = 'none';
      track.style.transform = 'translate3d(' + base + 'px,0,0)';
    });
    vp.addEventListener('pointermove', function (e) {
      if (!down || e.pointerId !== pid) { return; }
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) { moved = true; vp.classList.add('drag'); try { vp.setPointerCapture(pid); } catch (er) { /* */ } }
      if (moved) { x = wrap(base + dx); track.style.transform = 'translate3d(' + x + 'px,0,0)'; }
    });
    function release(e) {
      if (!down) { return; }
      down = false; vp.classList.remove('drag');
      var p = half ? -x / half : 0;
      track.style.transform = '';
      track.style.animation = '';
      track.style.animationDelay = (-(p * dur)).toFixed(2) + 's';
      /* a tap (no drag) on an empty gap stops / restarts the slide */
      if (!moved && e && e.type === 'pointerup' && !(e.target.closest && e.target.closest('.rr-blogo'))) { box.classList.toggle('paused'); }
    }
    vp.addEventListener('pointerup', release);
    vp.addEventListener('pointercancel', release);
    vp.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    vp.addEventListener('dragstart', function (e) { e.preventDefault(); });
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (en) { box.classList.toggle('off', !en[0].isIntersecting); }).observe(box);
    }
  }

  function start() {
    var x = new XMLHttpRequest();
    x.open('GET', BASE + 'bands.json', true);
    x.onload = function () {
      var all = [];
      try { all = JSON.parse(x.responseText); } catch (e) { return; }
      if (all.length) { build(all); }
    };
    x.send();
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); } else { start(); }
})();

/* Category bar look (owner 2026-11-15): Barlow Condensed in the bright chrome blue of the logos, larger, and the
   icons in the same chrome (each icon's shape used as a stencil, full-size originals so they stay sharp).
   ÚJDONSÁG / AKCIÓ keeps the shop red. Desktop category bar only. */
(function () {
  'use strict';
  if (window.__rrCatLook) { return; }
  window.__rrCatLook = true;
  var CHROME = 'linear-gradient(180deg,#ffffff 0%,#dcf0fc 40%,#a9d2ee 50%,#b8dcf3 56%,#f0f9ff 80%,#b5daf2 100%)';
  var RED = 'linear-gradient(180deg,#ff8a84 0%,#f04a43 45%,#d92420 55%,#ff6a63 100%)';
  var A = 'html body .module-category-wrapper li.module-list > a.nav-link';
  var css =
    A + ',' + A + ' .rr-category-count{font-family:"Barlow Condensed",Poppins,sans-serif!important;font-weight:700!important;' +
    'font-size:clamp(12.5px,1.27vw,25px)!important;letter-spacing:.03em!important;text-transform:uppercase!important;line-height:1.1!important;' +
    'background:' + CHROME + '!important;-webkit-background-clip:text!important;background-clip:text!important;' +
    'color:transparent!important;-webkit-text-fill-color:transparent!important}' +
    A + '{filter:drop-shadow(0 1px 0 #031220) drop-shadow(0 0 1px rgba(3,18,32,.8));align-items:center!important}' +
    A + ' .rr-category-count{opacity:.8!important}' +
    A + ':hover{filter:drop-shadow(0 1px 0 #031220) drop-shadow(0 0 6px rgba(150,210,245,.75))}' +
    A + '.rr-cat-red,' + A + '.rr-cat-red .rr-category-count{background:' + RED + '!important;-webkit-background-clip:text!important;background-clip:text!important}' +
    '.rr-caticon{display:inline-block;flex:none;width:clamp(18px,1.6vw,28px);height:clamp(18px,1.6vw,28px);margin-right:6px;' +
    '-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat;background:' + CHROME + '}' +
    '.rr-cat-red .rr-caticon{background:' + RED + '}' +
    '.module-category-wrapper .sf-menu ul a,.module-category-wrapper .subtree-dropdown a,.module-category-wrapper .js-subtree-dropdown a{' +
    'font-family:"Barlow Condensed",Poppins,sans-serif!important;font-weight:600!important;letter-spacing:.03em!important;font-size:16px!important}' +
    '.module-category-wrapper .subtree-dropdown a .rr-category-count,.module-category-wrapper .sf-menu ul a .rr-category-count{font-size:1em!important}';
  /* stencils must come from a host that allows it (the shop's image server does not): copies next to menu.js */
  var ICONS = 'https://1374223-star.github.io/rockpince-menu-counts/assets/caticons/';
  function full(src) {
    var m = /\/design\/([^/?]+?)(\.webp)?(\?|$)/.exec(String(src));
    return m ? ICONS + m[1] : src;
  }
  function apply() {
    var links = document.querySelectorAll('.module-category-wrapper li.module-list > a.nav-link');
    if (!links.length) { return false; }
    if (!document.getElementById('rr-catlook-font')) {
      var f = document.createElement('link'); f.id = 'rr-catlook-font'; f.rel = 'stylesheet';
      f.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&display=swap';
      document.head.appendChild(f);
      var s = document.createElement('style'); s.id = 'rr-catlook'; s.appendChild(document.createTextNode(css));
      document.head.appendChild(s);
    }
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (/rgb\(229,\s*36,\s*33\)/.test(getComputedStyle(a).color) || /akci/i.test(a.textContent)) { a.classList.add('rr-cat-red'); }
      var img = a.querySelector('img');
      if (!img || a.querySelector('.rr-caticon')) { continue; }
      var ic = document.createElement('span');
      ic.className = 'rr-caticon';
      ic.setAttribute('aria-hidden', 'true');
      ic.style.setProperty('--m', 'url("' + full(img.currentSrc || img.src) + '")');
      img.parentNode.insertBefore(ic, img);
      img.style.display = 'none';
    }
    return true;
  }
  var tries = 0;
  (function wait() { if (!apply() && tries++ < 40) { setTimeout(wait, 150); } })();
})();

/* Header rows in one rhythm (owner 2026-11-15): the top bar (status, socials, links) and the band-logo strip get the
   same height, the same dark band and the same thin edges, so they frame the logo/search row between them.
   The shop email sits in the middle of the top bar. Desktop only (the phone header has no top bar). */
(function () {
  'use strict';
  if (window.__rrHeadRows) { return; }
  window.__rrHeadRows = true;
  var EMAIL = 'info@ragnarock.hu', H = 50;
  var BAND = 'linear-gradient(180deg,rgba(3,16,28,.92),rgba(2,10,20,.96))';
  var EDGE = '1px solid rgba(127,196,234,.16)';
  var css =
    '@media (min-width:992px){' +
    '.header-top{height:' + H + 'px!important;min-height:' + H + 'px!important;background:' + BAND + '!important;border-top:' + EDGE + ';border-bottom:' + EDGE + '}' +
    '.header-top-row{height:100%!important}' +
    '.rr-bands{height:' + H + 'px!important;border-top:' + EDGE + '!important;border-bottom:' + EDGE + '!important;background:' + BAND + '!important}' +
    '.rr-blogo img{width:calc(var(--w) * .86px)!important}' +
    '.rr-mailtop{display:inline-flex;align-items:center;gap:8px;margin:0 auto;padding:5px 14px;border:1px solid rgba(127,196,234,.35);border-radius:16px;' +
    'color:#e6f3fb!important;font-size:13px;letter-spacing:.02em;text-decoration:none!important;white-space:nowrap;transition:border-color .15s,background .15s}' +
    '.rr-mailtop:hover{border-color:rgba(160,214,244,.8);background:rgba(127,196,234,.1)}' +
    '.rr-mailtop svg{width:16px;height:16px;flex:none}' +
    '}' +
    '@media (max-width:1199px){.rr-mailtop{display:none!important}}';
  function apply() {
    var row = document.querySelector('.header-top-row');
    if (!row) { return false; }
    if (!document.getElementById('rr-headrows')) {
      var s = document.createElement('style'); s.id = 'rr-headrows'; s.appendChild(document.createTextNode(css));
      document.head.appendChild(s);
    }
    if (!row.querySelector('.rr-mailtop')) {
      var a = document.createElement('a');
      a.className = 'rr-mailtop'; a.href = 'mailto:' + EMAIL; a.title = 'Írj nekünk e-mailt';
      a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#9fd6f7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg><span>' + EMAIL + '</span>';
      var social = row.querySelector('.rr-social-top'), list = row.querySelector('.headermenu-list');
      row.insertBefore(a, list || null);
      if (!social && !list) { row.appendChild(a); }
    }
    return true;
  }
  var tries = 0;
  (function wait() { if (!apply() && tries++ < 40) { setTimeout(wait, 150); } })();
})();

/* Header round 2 (owner 2026-11-15):
   - category dropdowns open at once: the theme's "mouse must slow down" check is off and the fade is near-instant
     (a short delay stays only for closing, so a dropdown does not vanish when the mouse slips off for a moment);
     the growing underline under hovered categories is gone
   - basket button: a shopping cart drawn in the chrome blue
   - header logo without the RockPince wordmark, and the same logo as caps on both ends of the band strip */
(function () {
  'use strict';
  if (window.__rrHead2) { return; }
  window.__rrHead2 = true;
  var BRAND = 'https://1374223-star.github.io/rockpince-menu-counts/assets/brand/';
  var css =
    '.module-category-wrapper a.nav-link:before,.module-category-wrapper a.nav-link:after{display:none!important}' +
    '.rr-cart-ic{width:30px;height:30px;display:block}' +
    '@media (min-width:992px){a.header-logo img{width:clamp(150px,11.5vw,230px)!important;height:auto!important;max-width:none!important}' +
    'a.header-logo{flex:none!important}}' +
    /* small laptops (992-1279px): a compact top bar so the links stay on one line */
    '@media (min-width:992px) and (max-width:1279px){.headermenu-list .nav-link{font-size:11.5px!important;padding-left:7px!important;padding-right:7px!important;white-space:nowrap}' +
    '.rr-social-top{display:none!important}.rr-open{font-size:11px!important;padding:4px 10px!important;white-space:nowrap}' +
    '.header-middle-row{gap:12px}}' +
    /* phones/tablets: logo capped in height and centred between the menu and basket buttons */
    '@media (max-width:991px){a.header-logo img{max-height:84px;width:auto!important;margin:0 auto}' +
    '.header-middle-row a.header-logo{flex:1 1 auto!important;display:flex!important;justify-content:center!important;align-items:center}}' +
    /* home heading in the category-bar font; much smaller on phones (owner: too distracting) */
    '.seoh1-module h1{font-family:"Barlow Condensed",Poppins,sans-serif!important;font-weight:700!important;letter-spacing:.04em!important;text-transform:uppercase;' +
    'font-size:clamp(17px,1.6vw,30px)!important;line-height:1.15!important;background:linear-gradient(180deg,#ffffff 0%,#dcf0fc 40%,#a9d2ee 50%,#b8dcf3 56%,#f0f9ff 80%,#b5daf2 100%);' +
    '-webkit-background-clip:text;background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;filter:drop-shadow(0 1px 0 #031220)}' +
    '@media (max-width:767px){.seoh1-module h1{font-size:17px!important;margin:4px 0!important}}';
  var CART = '<svg class="rr-cart-ic" viewBox="0 0 28 28" aria-hidden="true"><defs><linearGradient id="rrcartg" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#cfe9f8"/><stop offset=".55" stop-color="#8fc3e6"/><stop offset="1" stop-color="#d9effb"/></linearGradient></defs>' +
    '<g stroke="url(#rrcartg)" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2.5 4.5h3.2l3 13.5h13.6l2.9-9.5H7"/><circle cx="11" cy="22.6" r="1.8"/><circle cx="20" cy="22.6" r="1.8"/></g></svg>';
  function style() {
    if (document.getElementById('rr-head2')) { return; }
    var s = document.createElement('style'); s.id = 'rr-head2'; s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }
  function menu() {
    var $ = window.jQuery, ul = document.querySelector('.module-category-wrapper ul.sf-menu');
    if (!$ || !ul || !$.fn.superfish || ul.getAttribute('data-rr-fast')) { return !!ul; }
    var o = $(ul).data('sfOptions');
    if (!o) { return false; }
    var keep = {};
    for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k) && typeof o[k] !== 'object' && typeof o[k] !== 'function') { keep[k] = o[k]; } }
    ['onInit', 'onBeforeShow', 'onShow', 'onHide', 'onBeforeHide', 'onIdle', 'onDestroy', 'onHandleTouch', 'animation', 'animationOut'].forEach(function (k) { if (o[k]) { keep[k] = o[k]; } });
    keep.disableHI = true; keep.speed = 60; keep.speedOut = 0; keep.delay = 250;
    try { $(ul).superfish('destroy'); $(ul).superfish(keep); ul.setAttribute('data-rr-fast', '1'); } catch (e) { /* theme menu stays as it was */ }
    return true;
  }
  function cart() {
    var t = document.querySelector('.cart-dropdown-toggle');
    if (!t || t.querySelector('.rr-cart-ic')) { return !!t; }
    var old = t.querySelector('svg');
    if (old) { var d = document.createElement('div'); d.innerHTML = CART; old.parentNode.replaceChild(d.firstChild, old); }
    return true;
  }
  function logos() {
    var imgs = document.querySelectorAll('a.header-logo img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i], src = im.currentSrc || im.src || '';
      if (im.getAttribute('data-rr-logo')) { continue; }
      if (/ragnarock-rockpince-logo/.test(src)) { im.setAttribute('data-rr-logo', '1'); im.removeAttribute('srcset'); im.src = BRAND + 'ragnarock_logo.png'; im.style.height = 'auto';
      }
      else if (/ragna-rock-logo-mobil/.test(src)) { im.setAttribute('data-rr-logo', '1'); im.removeAttribute('srcset'); im.src = BRAND + 'ragnarock_logo_mobil.png'; im.style.width = 'auto'; }
    }
    return imgs.length > 0;
  }
  var tries = 0;
  (function wait() {
    style();
    var a = menu(), b = cart(), c = logos();
    if (!(a && b && c) && tries++ < 60) { setTimeout(wait, 200); }
  })();
})();

/* Concert section skulls (owner 2026-11-15): the skull-hand watermarks from the product pages, one in each empty
   side area beside the concert tiles on the home page. Only on screens wide enough to have empty sides. */
(function () {
  'use strict';
  if (window.__rrGigSkulls) { return; }
  window.__rrGigSkulls = true;
  var SK = "url('https://1374223-star.github.io/rockpince-menu-counts/assets/skull-hand-watermark.webp')";
  var css = '@media (min-width:1700px){' +
    '.container:has(> .rr-gigs){position:relative}' +
    '.container:has(> .rr-gigs):before,.container:has(> .rr-gigs):after{content:"";position:absolute;top:50%;pointer-events:none;z-index:0;' +
    'width:min(calc((100vw - 100%) / 2 - 30px),640px);aspect-ratio:1;background:' + SK + ' center/contain no-repeat;opacity:.13}' +
    '.container:has(> .rr-gigs):before{right:calc(100% + 15px);transform:translateY(-50%) rotate(-10deg)}' +
    '.container:has(> .rr-gigs):after{left:calc(100% + 15px);transform:translateY(-50%) scaleX(-1) rotate(-10deg)}' +
    '.container > .rr-gigs{position:relative;z-index:1}}';
  var s = document.createElement('style'); s.id = 'rr-gig-skulls'; s.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(s);
})();

/* Home banner on phones (owner 2026-11-15): no thumbnail chooser under the banner, just a left and a right arrow on
   the banner itself. The arrows click the (hidden) thumbnails, so the theme's own slider keeps doing the work. */
(function () {
  'use strict';
  if (window.__rrBannerArrows) { return; }
  window.__rrBannerArrows = true;
  var css = '@media (max-width:767px){' +
    '#thumbnail-carousel{position:absolute!important;left:0;width:100%;height:0!important;overflow:hidden!important;opacity:0;pointer-events:none;margin:0!important;padding:0!important}' +
    '.rr-bn-arrows{position:absolute;inset:0;pointer-events:none;z-index:5}' +
    '.rr-bn-arr{position:absolute;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;border:1px solid rgba(160,214,244,.5);opacity:.85;' +
    'background:rgba(2,12,22,.55);color:#e3f3fc;display:flex;align-items:center;justify-content:center;pointer-events:auto;padding:0}' +
    '.rr-bn-arr svg{width:15px;height:15px}.rr-bn-arr.p{left:3px}.rr-bn-arr.n{right:3px}' +
    '.rr-bn-arr:active{background:rgba(127,196,234,.3)}}' +
    '@media (min-width:768px){.rr-bn-arrows{display:none}' +
    /* PC: every banner in the chooser, smaller, lower and further left (owner 2026-11-15; the theme showed 4 at a time) */
    '.slider-thumbnails-wrapper{left:60px!important;bottom:16px!important;max-width:none!important;width:auto!important}' +
    '.js-splide-banner-thumbnails,#thumbnail-carousel{width:auto!important}' +
    '#thumbnail-carousel .splide__track{overflow:visible!important}' +
    '#thumbnail-carousel .splide__list{transform:none!important}' +
    '#thumbnail-carousel .splide__slide{width:96px!important;margin-right:8px!important;opacity:.75;transition:opacity .15s}' +
    '#thumbnail-carousel .splide__slide.is-active,#thumbnail-carousel .splide__slide:hover{opacity:1}' +
    '#thumbnail-carousel .splide__slide img{width:100%!important;height:auto!important}}';
  function go(dir) {
    var slides = document.querySelectorAll('#thumbnail-carousel .splide__slide:not(.splide__slide--clone)');
    if (!slides.length) { return; }
    var cur = 0;
    for (var i = 0; i < slides.length; i++) { if (slides[i].classList.contains('is-active')) { cur = i; break; } }
    var next = (cur + dir + slides.length) % slides.length;
    slides[next].click();
  }
  function build() {
    var main = document.getElementById('main-carousel'), thumbs = document.getElementById('thumbnail-carousel');
    if (!main || !thumbs) { return !!document.querySelector('.home-body') ? false : true; }
    if (main.querySelector('.rr-bn-arrows')) { return true; }
    var s = document.createElement('style'); s.id = 'rr-bn-arrows'; s.appendChild(document.createTextNode(css)); document.head.appendChild(s);
    if (getComputedStyle(main).position === 'static') { main.style.position = 'relative'; }
    var box = document.createElement('div'); box.className = 'rr-bn-arrows';
    box.innerHTML = '<button type="button" class="rr-bn-arr p" aria-label="Előző"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<button type="button" class="rr-bn-arr n" aria-label="Következő"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>';
    main.appendChild(box);
    box.querySelector('.p').addEventListener('click', function (e) { e.preventDefault(); go(-1); });
    box.querySelector('.n').addEventListener('click', function (e) { e.preventDefault(); go(1); });
    return true;
  }
  var tries = 0;
  (function wait() { if (!build() && tries++ < 40) { setTimeout(wait, 200); } })();
})();

/* Phone category menu in the same look (owner 2026-11-15): Barlow Condensed everywhere, the six main categories in
   chrome blue with their chrome icons (ÚJDONSÁG / AKCIÓ in red), matched to the desktop bar by link address. */
(function () {
  'use strict';
  if (window.__rrMmLook) { return; }
  window.__rrMmLook = true;
  var CHROME = 'linear-gradient(180deg,#ffffff 0%,#dcf0fc 40%,#a9d2ee 50%,#b8dcf3 56%,#f0f9ff 80%,#b5daf2 100%)';
  var RED = 'linear-gradient(180deg,#ff8a84 0%,#f04a43 45%,#d92420 55%,#ff6a63 100%)';
  var css =
    '#js-mobile-nav .mm-listitem__text,#js-mobile-nav .mm-navbar__title{font-family:"Barlow Condensed",Poppins,sans-serif!important;font-weight:600!important;' +
    'letter-spacing:.03em!important;font-size:17px!important}' +
    '#js-mobile-nav a.rr-mm-top{display:flex!important;align-items:center;font-size:20px!important;font-weight:700!important;text-transform:uppercase}' +
    '#js-mobile-nav a.rr-mm-top .rr-mm-t{background:' + CHROME + ';-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}' +
    '#js-mobile-nav a.rr-mm-top.rr-cat-red .rr-mm-t{background:' + RED + ';-webkit-background-clip:text;background-clip:text}' +
    '#js-mobile-nav a.rr-mm-top .rr-caticon{width:24px!important;height:24px!important;margin-right:10px}' +
    /* owner 2026-11-15 ("really cool"): the site's navy glow instead of flat blue, a faint skull-hand at the bottom,
       thin light-blue separators, a darker account bar. No grain texture (that one made phones repaint on scroll). */
    '#js-mobile-nav,#js-mobile-nav .mm-panels,#js-mobile-nav .mm-panel{background:radial-gradient(ellipse 120% 55% at 50% 12%,#0e4d78 0%,#07304f 42%,#031627 78%,#010811 100%)!important}' +
    '#js-mobile-nav .mm-panel:after{content:"";position:absolute;left:50%;bottom:40px;width:260px;height:260px;translate:-50% 0;pointer-events:none;opacity:.08;' +
    'background:url("https://1374223-star.github.io/rockpince-menu-counts/assets/skull-hand-watermark.webp") center/contain no-repeat}' +
    '#js-mobile-nav .mm-listitem{border-color:rgba(127,196,234,.14)!important}' +
    '#js-mobile-nav a.rr-mm-top{border-bottom:1px solid rgba(127,196,234,.14)}' +
    /* no separator under the last item of a section: the theme's own divider is already there (no double lines) */
    '#js-mobile-nav li:has(+ li.informations-mobile-menu-item-separator):after{display:none!important}' +
    '#js-mobile-nav li:has(+ li.informations-mobile-menu-item-separator) > a.rr-mm-top,' +
    '#js-mobile-nav li:has(+ li.informations-mobile-menu-item-separator) > .mm-listitem__text{border-bottom:0!important}' +
    '#js-mobile-nav .mm-navbars--top,#js-mobile-nav .mm-navbars_top,#js-mobile-nav [class*=navbar]:first-child{background:rgba(1,8,17,.55)!important}' +
    /* top row (Belépés / Regisztráció / wishlist / close) in the same look; the white close box becomes a chrome-blue X */
    /* the whole top row is one dark band (its inner box starts 15px in, so the full-width parent is coloured) */
    ':has(> .login-and-exit-line-inner),.login-and-exit-line-inner{background:#020d18!important}' +
    ':has(> .login-and-exit-line-inner){border-bottom:1px solid rgba(127,196,234,.2)!important}' +
    '.hamburger-login-box,.hamburger-login-box-wrapper{background:transparent!important;border:0!important}' +
    '.hamburger-login-box .btn-link{font-family:"Barlow Condensed",Poppins,sans-serif!important;font-weight:600!important;letter-spacing:.04em!important;font-size:16px!important;color:#e3f1fa!important}' +
    '.hamburger-login-box svg{color:#cfe9f8!important}' +
    '.close-menu-button-wrapper{background:transparent!important;border-left:1px solid rgba(127,196,234,.2)!important}' +
    '.close-menu-button-wrapper svg,.close-menu-button-wrapper svg *{color:#cfe9f8!important;fill:currentColor}';
  function icons() {
    var map = {};
    var top = document.querySelectorAll('.module-category-wrapper ul.sf-menu > li > a.nav-link');
    for (var i = 0; i < top.length; i++) {
      var ic = top[i].querySelector('.rr-caticon');
      if (ic) { map[top[i].getAttribute('href')] = ic.style.getPropertyValue('--m'); }
    }
    return map;
  }
  function apply() {
    var nav = document.getElementById('js-mobile-nav');
    var map = icons();
    if (!nav || !Object.keys(map).length) { return false; }
    if (!document.getElementById('rr-mmlook')) {
      var s = document.createElement('style'); s.id = 'rr-mmlook'; s.appendChild(document.createTextNode(css)); document.head.appendChild(s);
    }
    var links = nav.querySelectorAll('a.mm-listitem__text');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], m = map[a.getAttribute('href')];
      if (!m || a.classList.contains('rr-mm-top')) { continue; }
      a.classList.add('rr-mm-top');
      if (/akci/i.test(a.textContent)) { a.classList.add('rr-cat-red'); }
      /* wrap the text so only the words get the chrome fill (the count span stays inside) */
      var t = document.createElement('span'); t.className = 'rr-mm-t';
      while (a.firstChild) { t.appendChild(a.firstChild); }
      var icon = document.createElement('span'); icon.className = 'rr-caticon'; icon.setAttribute('aria-hidden', 'true');
      icon.style.setProperty('--m', m);
      a.appendChild(icon); a.appendChild(t);
    }
    /* owner 2026-11-15: shorter label on phones so it fits one line (desktop bar keeps the full name) */
    var all = nav.querySelectorAll('a.mm-listitem__text, .mm-navbar__title, .mm-navbar__title span');
    for (var j = 0; j < all.length; j++) {
      var w = document.createTreeWalker(all[j], NodeFilter.SHOW_TEXT, null), n;
      while ((n = w.nextNode())) {
        if (/zenekaros és egyéb ruhák/i.test(n.nodeValue)) { n.nodeValue = n.nodeValue.replace(/zenekaros és egyéb ruhák/i, 'ZENEKAROS RUHÁK'); }
      }
    }
    return true;
  }
  var tries = 0;
  (function wait() { if (!apply() && tries++ < 50) { setTimeout(wait, 250); } })();
  /* the phone menu rebuilds its links when it is set up / opened: style again whenever it opens */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('.rr-bn-menu, .js-mobile-menu-toggle, [href="#js-mobile-nav"], .mm-listitem__btn, .mm-btn') : null;
    if (t) { setTimeout(apply, 60); setTimeout(apply, 400); }
  }, true);
  setTimeout(apply, 2500); setTimeout(apply, 6000);
})();

/* Product cards (owner 2026-11-15): faint lines above and below the price block, running edge to edge of the card,
   so the card reads as picture + name / price / size + Kosárba. */
(function () {
  'use strict';
  if (document.getElementById('rr-card-lines')) { return; }
  var css = '.product-card .product-card__body > .product-card__price{border-top:1px solid rgba(10,40,64,.13);border-bottom:1px solid rgba(10,40,64,.13);' +
    'margin-left:-12px!important;margin-right:-12px!important;padding:10px 12px!important}';
  var s = document.createElement('style'); s.id = 'rr-card-lines'; s.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(s);
})();

/* Home newsletter section (owner 2026-11-15): looks like the coupon pop-up and says what you get - the 10% code for the
   first order. Only first name + email (the shop form does not require the surname; the coupon email uses the first
   name). The shop's own form, validation and submit stay untouched; this only restyles and relabels it. */
(function () {
  'use strict';
  if (window.__rrNlSection) { return; }
  window.__rrNlSection = true;
  var CHROME = 'linear-gradient(180deg,#f6fcff 0%,#bedef2 42%,#8cb8d8 50%,#96c0de 56%,#def0fb 80%,#96c0de 100%)';
  var W = '#newsletter_subscribe';
  var css =
    W + '{max-width:760px!important;margin:30px auto!important;padding:30px 34px 24px!important;border-radius:12px;position:relative;isolation:isolate;overflow:hidden;text-align:center;' +
    'background:radial-gradient(ellipse 90% 70% at 50% 15%,#0e4d78 0%,#07304f 45%,#031627 80%,#010811 100%)!important;' +
    'border:1px solid rgba(127,196,234,.75);box-shadow:0 0 0 1px rgba(0,0,0,.6),0 0 28px rgba(127,196,234,.25),0 20px 60px rgba(0,0,0,.55)}' +
    W + ' .rr-nls-big{font-family:"New Rocker",Georgia,serif;font-size:76px;line-height:.95;letter-spacing:1px;background:' + CHROME + ';' +
    '-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 0 #031220) drop-shadow(0 0 1px #031220) drop-shadow(0 6px 14px rgba(0,0,0,.55))}' +
    W + ' .module-head-title{font-size:21px!important;letter-spacing:.06em!important;margin:6px 0 8px!important;color:#e3f1fa!important}' +
    W + ' .newsletter-pretext{color:#c4d2df!important;font-size:14.5px!important;line-height:1.55!important;max-width:560px;margin:0 auto 16px!important}' +
    W + ' form{display:flex!important;flex-direction:column;align-items:stretch}' +
    W + ' .subscribe-box{order:1;display:flex!important;flex-direction:row!important;gap:10px!important;justify-content:center;flex-wrap:nowrap}' +
    W + ' .subscribe-box__item{flex:1 1 0!important;min-width:0;height:auto!important;max-width:none!important;margin:0!important;padding:0!important}' +
    W + ' .subscribe-policy{order:2}' + W + ' .subscribe-button{order:3;width:100%!important;max-width:none!important;display:block!important;flex:none!important}' + W + ' .rr-nls-fine{order:4}' +
    W + ' .subscribe-box__item:has(#subscriber-firstname){display:none!important}' +
    W + ' .form-control{background:#0a1826!important;border:1px solid #2b4a66!important;border-radius:6px!important;color:#fff!important;height:46px!important;font-size:15px!important}' +
    W + ' .form-control:focus{border-color:#7fc4ea!important;box-shadow:none!important}' +
    W + ' .subscribe-policy{margin:12px auto 0!important;max-width:620px;text-align:left}' +
    W + ' .subscribe-policy__label{font-size:11.5px!important;line-height:1.45!important;color:#9fb3c6!important}' +
    W + ' .subscribe-button{margin-top:14px!important}' +
    W + ' .subscribe-button .btn{width:100%!important;max-width:none!important;display:block!important;padding:14px!important;border:1px solid rgba(255,140,130,.45)!important;border-radius:6px!important;' +
    'background:linear-gradient(180deg,#f0453f 0%,#e52421 50%,#b81a17 100%)!important;color:#fff!important;font-weight:800!important;font-size:15px!important;' +
    'letter-spacing:1px!important;text-transform:uppercase;text-shadow:0 1px 1px rgba(0,0,0,.35);box-shadow:0 4px 14px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.3)}' +
    W + ' .subscribe-button .btn:hover{filter:brightness(1.08)}' + W + ' .subscribe-button .btn,' + W + ' .subscribe-button .btn *{text-decoration:none!important;border-bottom:0!important}' +
    W + ' .rr-nls-fine{font-size:11.5px;color:#7f93a6;margin:10px 0 0}' +
    W + ' .newsletter-posttext,' + W + ' .module-body > p:not([class]){display:none!important}' +
    /* owner: the big skull picture half-hidden behind the card looked odd - faint skull-hand watermarks instead */
    '.module-newsletter_subscribe-wrapper{background-image:none!important;position:relative;overflow:hidden}' +
    '.module-newsletter_subscribe-wrapper:before,.module-newsletter_subscribe-wrapper:after{content:"";position:absolute;top:50%;width:min(30vw,420px);aspect-ratio:1;pointer-events:none;z-index:0;' +
    'background:url("https://1374223-star.github.io/rockpince-menu-counts/assets/skull-hand-watermark.webp") center/contain no-repeat;opacity:.12}' +
    '.module-newsletter_subscribe-wrapper:before{left:calc(50% - 380px - min(30vw,420px));transform:translateY(-50%) rotate(-10deg)}' +
    '.module-newsletter_subscribe-wrapper:after{right:calc(50% - 380px - min(30vw,420px));transform:translateY(-50%) scaleX(-1) rotate(-10deg)}' +
    '.module-newsletter_subscribe-wrapper > *{position:relative;z-index:1}' +
    '@media (max-width:991px){.module-newsletter_subscribe-wrapper:before,.module-newsletter_subscribe-wrapper:after{display:none}' +
    W + ':after{content:"";position:absolute;left:50%;top:50%;width:300px;height:300px;translate:-50% -50%;z-index:-1;pointer-events:none;opacity:.07;' +
    'background:url("https://1374223-star.github.io/rockpince-menu-counts/assets/skull-hand-watermark.webp") center/contain no-repeat}}' +
    '@media (max-width:767px){' + W + '{margin:20px 12px!important;padding:24px 16px 18px!important}' + W + ' .subscribe-box{flex-direction:column!important;gap:10px!important}' +
    W + ' .subscribe-box__item{flex:none!important}' + W + ' .rr-nls-big{font-size:60px}' + W + ' .module-head-title{font-size:18px!important}}';
  function apply() {
    var box = document.querySelector(W);
    if (!box) { return !document.querySelector('.module-newsletter_subscribe-wrapper') ? false : true; }
    if (box.querySelector('.rr-nls-big')) { return true; }
    if (!document.getElementById('rr-nl-font')) {
      var fl = document.createElement('link'); fl.id = 'rr-nl-font'; fl.rel = 'stylesheet';
      fl.href = 'https://fonts.googleapis.com/css2?family=New+Rocker&display=swap'; document.head.appendChild(fl);
    }
    var st = document.createElement('style'); st.id = 'rr-nl-section'; st.appendChild(document.createTextNode(css)); document.head.appendChild(st);
    var head = box.querySelector('.module-head'), title = box.querySelector('.module-head-title');
    var big = document.createElement('div'); big.className = 'rr-nls-big'; big.textContent = '-10%';
    if (head) { head.insertBefore(big, head.firstChild); }
    if (title) { title.textContent = 'A következő rendelésedből'; }
    var pre = box.querySelector('.newsletter-pretext');
    if (pre) { pre.textContent = 'Iratkozz fel a hírlevelünkre, és e-mailben elküldjük az egyszer használható 10%-os kuponkódodat. Elsőként értesülsz az újdonságokról és az akciókról is.'; }
    var btn = box.querySelector('.subscribe-button .btn');
    if (btn) { btn.textContent = 'Kérem a kupont'; }
    var b = box.querySelector('.subscribe-button');
    if (b && !box.querySelector('.rr-nls-fine')) {
      var f = document.createElement('div'); f.className = 'rr-nls-fine';
      f.textContent = 'Személyenként egy kupon jár, 30 napig érvényes. Ideiglenes vagy több e-mail címmel kért kuponokat érvénytelenítünk. Leiratkozni bármikor lehet.';
      b.parentNode.appendChild(f);
    }
    return true;
  }
  var tries = 0;
  (function wait() { if (!apply() && tries++ < 40) { setTimeout(wait, 200); } })();
})();

/* Newsletter thank-you page (owner 2026-11-15: "looks weird, then nothing happens"): the shop shows only a heading.
   Now a card in the coupon pop-up style says what happens next and offers a way on. */
(function () {
  'use strict';
  if (!/newsletter_subscribe\/thankyou_page/.test(location.search) || window.__rrNlThanks) { return; }
  window.__rrNlThanks = true;
  var CHROME = 'linear-gradient(180deg,#f6fcff 0%,#bedef2 42%,#8cb8d8 50%,#96c0de 56%,#def0fb 80%,#96c0de 100%)';
  var css =
    '.rr-thx{max-width:620px;margin:16px auto 60px!important;padding:34px 30px 28px;border-radius:12px;text-align:center;color:#e8eef4;' +
    'background:radial-gradient(ellipse 90% 70% at 50% 15%,#0e4d78 0%,#07304f 45%,#031627 80%,#010811 100%);border:1px solid rgba(127,196,234,.75);' +
    'box-shadow:0 0 0 1px rgba(0,0,0,.6),0 0 28px rgba(127,196,234,.25),0 20px 60px rgba(0,0,0,.55)}' +
    '.rr-thx .big{font-family:"New Rocker",Georgia,serif;font-size:80px;line-height:.95;background:' + CHROME + ';-webkit-background-clip:text;background-clip:text;' +
    'color:transparent;filter:drop-shadow(0 2px 0 #031220) drop-shadow(0 6px 14px rgba(0,0,0,.55))}' +
    '.rr-thx h2{margin:8px 0 12px;font-size:22px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#e3f1fa}' +
    '.rr-thx p{margin:0 auto 22px;max-width:480px;font-size:15px;line-height:1.6;color:#c4d2df}' +
    '.rr-thx .row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}' +
    '.rr-thx a.b{flex:1 1 200px;max-width:260px;min-height:54px;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px 18px;border-radius:6px;font-weight:800;font-size:14px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none!important}' +
    '.rr-thx a.b1{background:linear-gradient(180deg,#f0453f 0%,#e52421 50%,#b81a17 100%);color:#fff!important;border:1px solid rgba(255,140,130,.45)}' +
    '.rr-thx a.b2{background:transparent;color:#e3f1fa!important;border:1px solid rgba(127,196,234,.6)}' +
    '.rr-thx a.b:hover{filter:brightness(1.1)}' +
    '.page-head-title{text-align:center}';
  function build() {
    var h = document.querySelector('h1.page-head-title');
    if (!h) { return false; }
    if (document.querySelector('.rr-thx')) { return true; }
    var f = document.createElement('link'); f.rel = 'stylesheet'; f.href = 'https://fonts.googleapis.com/css2?family=New+Rocker&display=swap'; document.head.appendChild(f);
    var s = document.createElement('style'); s.appendChild(document.createTextNode(css)); document.head.appendChild(s);
    h.style.display = 'none';
    var c = document.createElement('div'); c.className = 'rr-thx';
    c.innerHTML = '<div class="big">-10%</div><h2>Köszönjük, feliratkoztál!</h2>' +
      '<p>Egy percen belül megérkezik e-mailben az egyszer használható 10%-os kuponkódod. ' +
      'Ha nem látod, nézd meg a Promóciók vagy a Spam mappát is.</p>' +
      '<div class="row"><a class="b b1" data-rr-count-applied="1" href="/ujdonsagok_akciok-15427/ujdonsagok2-18914">Újdonságok megnézése</a>' +
      '<a class="b b2" data-rr-count-applied="1" href="/">Vissza a főoldalra</a></div>';
    h.parentNode.insertBefore(c, h.nextSibling);
    return true;
  }
  var tries = 0;
  (function wait() { if (!build() && tries++ < 40) { setTimeout(wait, 150); } })();
})();

/* Info pages (Szállítás, RagnaRock, Hűségprogram, Kapcsolat): light, readable title + breadcrumb on the dark theme */
(function () {
  if (window.__rrInfoText) { return; }
  window.__rrInfoText = true;
  var st = document.createElement('style');
  st.textContent =
    '.information-page-body h1, .information-page-body .page-head-title, .contact-page-body h1{color:#fff!important}' +
    '.information-page-body .breadcrumb, .information-page-body .breadcrumb a, .information-page-body .breadcrumb-item,' +
    '.contact-page-body .breadcrumb, .contact-page-body .breadcrumb a, .contact-page-body .breadcrumb-item{color:#9fb3c6!important}' +
    '.information-page-body .breadcrumb-item.active{color:#c4d2df!important}';
  (document.head || document.documentElement).appendChild(st);
})();

/* Kapcsolat page (owner 2026-11-16): no skull banner; big e-mail and phone buttons with icons, shop card with
   address, hours and route planning, social links, and the contact form restyled as a dark card. */
(function () {
  if (window.__rrContact) { return; }
  window.__rrContact = true;
  if (!document.body || !/\bcontact-page-body\b/.test(document.body.className)) { return; }
  var IC = {
    mail: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    tel: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };
  var F = '.contact-page-body .contact-content-form';
  var css =
    '.contact-page-body #contact-info{margin:0 0 26px}' +
    '.rr-ct{max-width:1000px;margin:0 auto;color:#c4d2df;font-size:15px;line-height:1.6}' +
    '.rr-ct .lead{text-align:center;margin:0 0 20px;color:#c4d2df}' +
    '.rr-ct .btns{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:0 0 16px}' +
    '.rr-ct .big{display:flex;align-items:center;gap:16px;padding:18px 22px;border-radius:12px;text-decoration:none!important;color:#fff!important;' +
      'background:linear-gradient(180deg,#14659c,#0a3a5e);border:1px solid rgba(127,196,234,.6);box-shadow:0 0 18px rgba(80,170,230,.18);transition:box-shadow .2s,border-color .2s}' +
    '.rr-ct .big:hover{border-color:#9fd6f7;box-shadow:0 0 26px rgba(120,200,250,.4)}' +
    '.rr-ct .big .ic{flex:0 0 52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.1);color:#bfe6ff}' +
    '.rr-ct .big small{display:block;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9fd6f7}' +
    '.rr-ct .big b{display:block;font-size:20px;font-weight:800;letter-spacing:.01em;color:#fff}' +
    '.rr-ct .shop{display:grid;grid-template-columns:1fr auto;gap:12px 20px;align-items:center;padding:18px 22px;border-radius:12px;background:#06243b;border:1px solid rgba(127,196,234,.35)}' +
    '.rr-ct .shop .ln{display:flex;gap:10px;align-items:flex-start;color:#d6e2ec}' +
    '.rr-ct .shop .ln svg{flex:0 0 auto;color:#9fd6f7;margin-top:1px}' +
    '.rr-ct .shop h3{margin:0 0 6px;color:#fff;font-size:17px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}' +
    '.rr-ct .route{display:inline-block;padding:10px 18px;border-radius:8px;background:#e52421;color:#fff!important;font-weight:700;text-decoration:none!important;white-space:nowrap}' +
    '.rr-ct .route:hover{background:#ff3a36}' +
    '.rr-ct .soc{display:flex;gap:10px;justify-content:center;margin:16px 0 0}' +
    '.rr-ct .soc a{display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:20px;border:1px solid rgba(127,196,234,.35);color:#d6e2ec!important;text-decoration:none!important;font-size:14px}' +
    '.rr-ct .soc a:hover{border-color:#9fd6f7;color:#fff!important}' +
    '.rr-ct h2{text-align:center;color:#fff;font-size:20px;text-transform:uppercase;letter-spacing:.06em;margin:30px 0 4px}' +
    '.rr-ct .sub{text-align:center;color:#9fb3c6;margin:0}' +
    F + '{max-width:1000px;margin:0 auto;padding:22px 24px 6px;border-radius:12px 12px 0 0;background:#06243b;border:1px solid rgba(127,196,234,.35);border-bottom:0}' +
    '.contact-page-body .contact-buttons{max-width:1000px;margin:0 auto 30px;padding:0 24px 22px;border-radius:0 0 12px 12px;background:#06243b;border:1px solid rgba(127,196,234,.35);border-top:0}' +
    F + ',' + F + ' *{color:#c4d2df}' +
    F + ' label,' + F + ' .control-label,' + F + ' label *{color:#fff!important}' +
    F + ' input[type=text],' + F + ' input[type=email],' + F + ' textarea{background:#031627!important;border:1px solid rgba(127,196,234,.35)!important;border-radius:8px!important;color:#fff!important}' +
    F + ' input:focus,' + F + ' textarea:focus{border-color:#9fd6f7!important;box-shadow:0 0 0 2px rgba(127,196,234,.2)!important;outline:0}' +
    F + ' a{color:#9fd6f7!important}' +
    '.contact-page-body .contact-buttons .btn{background:#e52421!important;border-color:#e52421!important;color:#fff!important;border-radius:8px;padding:12px 30px;font-weight:700}' +
    '.contact-page-body .contact-buttons .btn:hover{background:#ff3a36!important}' +
    '@media (max-width:600px){.rr-ct .shop{grid-template-columns:1fr}.rr-ct .route{text-align:center}.rr-ct .big b{font-size:18px}' +
      F + '{padding:18px 16px 4px}.contact-page-body .contact-buttons{padding:0 16px 18px}.rr-ct .soc{flex-wrap:wrap}}';
  function socials() {
    var out = [], seen = {};
    var names = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' };
    [].forEach.call(document.querySelectorAll('a[href*="facebook.com"],a[href*="instagram.com"],a[href*="tiktok.com"]'), function (a) {
      var k = /facebook/.test(a.href) ? 'facebook' : /instagram/.test(a.href) ? 'instagram' : 'tiktok';
      if (seen[k] || /sharer|share\?/.test(a.href)) { return; }
      seen[k] = 1;
      out.push('<a href="' + a.href + '" target="_blank" rel="noopener">' + names[k] + '</a>');
    });
    if (!seen.tiktok) { out.push('<a href="https://www.tiktok.com/@ragnarock.hu" target="_blank" rel="noopener">TikTok</a>'); }
    return out.join('');
  }
  function build() {
    var box = document.getElementById('contact-info');
    if (!box) { return false; }
    var st = document.createElement('style'); st.id = 'rr-contact'; st.appendChild(document.createTextNode(css)); document.head.appendChild(st);
    var maps = 'https://www.google.com/maps/search/' + encodeURIComponent('Dózsa György út 19, 1146 Budapest');
    box.innerHTML =
      '<div class="rr-ct">' +
      '<p class="lead">Kérdésed van egy termékről, méretről vagy a rendelésedről? Írj vagy hívj, szívesen segítünk.</p>' +
      '<div class="btns">' +
        '<a class="big" href="mailto:info@ragnarock.hu"><span class="ic">' + IC.mail + '</span><span><small>E-mail</small><b>info@ragnarock.hu</b></span></a>' +
        '<a class="big" href="tel:+36705882134"><span class="ic">' + IC.tel + '</span><span><small>Telefon</small><b>+36 70 588 2134</b></span></a>' +
      '</div>' +
      '<div class="shop"><div><h3>RagnaRock üzlet</h3>' +
        '<div class="ln">' + IC.pin + '<span>1146 Budapest, Dózsa György út 19.</span></div>' +
        '<div class="ln">' + IC.clock + '<span>Hétfő–péntek 12–18 · Szombat 10–14 · Vasárnap zárva</span></div></div>' +
        '<a class="route" href="' + maps + '" target="_blank" rel="noopener">Útvonaltervezés</a></div>' +
      '<div class="soc">' + socials() + '</div>' +
      '<h2>Írj nekünk</h2><p class="sub">Általában egy munkanapon belül válaszolunk.</p>' +
      '</div>';
    return true;
  }
  var tries = 0;
  (function wait() { if (!build() && tries++ < 40) { setTimeout(wait, 150); } })();
})();

/* Divider lines (owner 2026-11-16): no Celtic-knot image on <hr>; thin chrome-blue glow line instead */
(function () {
  if (window.__rrHr) { return; }
  window.__rrHr = true;
  var st = document.createElement('style');
  st.textContent = 'hr{background:linear-gradient(90deg,rgba(127,196,234,0),rgba(127,196,234,.75),rgba(127,196,234,0))!important;' +
    'height:1px!important;border:0!important;opacity:1!important;margin:28px 0!important;box-shadow:0 0 8px rgba(110,190,240,.35)}';
  (document.head || document.documentElement).appendChild(st);
})();

/* Mjölnir easter egg v2 (owner 2026-11-16, desktop only): a Norse hammer in the chrome-blue of the logo lettering,
   centred in the top bar. A click charges it (arcs gather round the hammer), then a branching lightning bolt strikes
   the page with one flash, a shockwave ring, sparks and a synthesized thunder crack + rumble; afterwards electricity
   runs along the screen edges for a few seconds. Nothing runs before the click; canvas and audio are dropped after.
   Reduced-motion users get no flash, shake or shockwave. */
(function () {
  if (window.__rrMjolnir) { return; }
  window.__rrMjolnir = true;
  if (!window.matchMedia || !matchMedia('(hover:hover) and (pointer:fine) and (min-width:1200px)').matches) { return; }
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HAMMER = '<img src="https://1374223-star.github.io/rockpince-menu-counts/assets/mjolnir.webp" width="32" height="44" alt="" draggable="false">';  /* owner's emblem in the lettering chrome */
  var css =
    '.rr-mj{position:relative;z-index:5;width:46px;height:46px;margin-left:4px;padding:0;border:0;border-radius:50%;cursor:pointer;' +
      'background:radial-gradient(circle,rgba(30,110,170,.45) 0%,rgba(6,36,59,0) 70%);display:flex;align-items:center;justify-content:center;transition:filter .25s}' +
    '.rr-mj img{display:block;transition:transform .25s;filter:drop-shadow(0 0 3px rgba(127,208,255,.55))}' +
    '.rr-mj:hover{filter:drop-shadow(0 0 8px rgba(140,210,255,.9))}' +
    '.rr-mj:hover img{transform:rotate(-12deg) scale(1.1)}' +
    '.rr-mj.charge img{animation:rrMjCharge .55s ease-in forwards}' +
    '@keyframes rrMjCharge{0%{transform:rotate(0)}70%{transform:rotate(-38deg) scale(1.22)}100%{transform:rotate(22deg) scale(1.1)}}' +
    '.rr-mj-flash{position:fixed;inset:0;z-index:2147483646;pointer-events:none;background:#f4fbff;opacity:0}' +
    '.rr-mj-flash.go{animation:rrMjFlash 1.3s ease-out forwards}' +
    '@keyframes rrMjFlash{0%{opacity:0}4%{opacity:.97}12%{opacity:.25}20%{opacity:.9}30%{opacity:.15}42%{opacity:.7}100%{opacity:0}}' +
    'html.rr-mj-lit{animation:rrMjLit 1.5s ease-out}' +
    '@keyframes rrMjLit{0%{filter:none}8%{filter:brightness(1.9) saturate(.5)}60%{filter:brightness(1.25)}100%{filter:none}}' +
    '.rr-mj-cv{position:fixed;inset:0;z-index:2147483647;pointer-events:none}' +
    'html.rr-mj-shake body{animation:rrMjShake .5s cubic-bezier(.36,.07,.19,.97)}' +
    '@keyframes rrMjShake{10%,90%{transform:translate(-2px,1px)}20%,80%{transform:translate(4px,-2px)}30%,50%,70%{transform:translate(-7px,3px)}40%,60%{transform:translate(7px,-2px)}}';

  /* ---------- lightning geometry ---------- */
  function bolt(x1, y1, x2, y2, rough) {
    var pts = [[x1, y1], [x2, y2]];
    for (var d = Math.hypot(x2 - x1, y2 - y1) * rough; d > 2.5; d /= 2) {
      var n = [pts[0]];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        n.push([(a[0] + b[0]) / 2 + (Math.random() - .5) * d, (a[1] + b[1]) / 2 + (Math.random() - .5) * d], b);
      }
      pts = n;
    }
    return pts;
  }
  function tree(x1, y1, x2, y2, depth, out, w) {        // main channel plus recursive forks that thin out
    var p = bolt(x1, y1, x2, y2, .32);
    out.push({ p: p, w: w });
    if (depth <= 0) { return out; }
    var forks = 2 + Math.floor(Math.random() * 3);
    for (var k = 0; k < forks; k++) {
      var s = p[Math.floor(p.length * (.15 + Math.random() * .7))];
      var ang = Math.atan2(y2 - y1, x2 - x1) + (Math.random() - .5) * 1.6;
      var len = Math.hypot(x2 - x1, y2 - y1) * (.18 + Math.random() * .3);
      tree(s[0], s[1], s[0] + Math.cos(ang) * len, s[1] + Math.sin(ang) * len, depth - 1, out, w * .5);
    }
    return out;
  }
  function draw(ctx, pts, w, a) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) { ctx.lineTo(pts[i][0], pts[i][1]); }
    ctx.globalAlpha = a * .35; ctx.strokeStyle = '#2f8fd8'; ctx.lineWidth = w * 7; ctx.stroke();     // outer haze
    ctx.globalAlpha = a * .7;  ctx.strokeStyle = '#8fd4ff'; ctx.lineWidth = w * 2.6; ctx.stroke();   // glow
    ctx.globalAlpha = a;       ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w; ctx.stroke();         // white core
  }

  /* ---------- synthesized thunder (no sound files): crackling strike, then a long rolling rumble in a big space ---------- */
  function thunder() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return; }
    try {
      var ac = new AC(), now = ac.currentTime + .03, sr = ac.sampleRate;
      var comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(ac.destination);
      var master = ac.createGain(); master.gain.value = .42; master.connect(comp);   /* owner: a bit too loud at .9 */
      // reverb: a generated 4 s decaying-noise impulse = the sky the thunder rolls around in
      var rev = ac.createConvolver(), ir = ac.createBuffer(2, sr * 4, sr);
      for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < d.length; i++) { d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6); } }
      rev.buffer = ir; var wet = ac.createGain(); wet.gain.value = .55; rev.connect(wet); wet.connect(master);
      function noiseBuf(sec, kind) {
        var b = ac.createBuffer(1, Math.floor(sr * sec), sr), d = b.getChannelData(0), l = 0, b0 = 0, b1 = 0, b2 = 0;
        for (var i = 0; i < d.length; i++) {
          var w = Math.random() * 2 - 1;
          if (kind === 'brown') { l = (l + .02 * w) / 1.02; d[i] = l * 3.5; }
          else if (kind === 'pink') { b0 = .997 * b0 + w * .029591; b1 = .985 * b1 + w * .032534; b2 = .95 * b2 + w * .048056; d[i] = (b0 + b1 + b2 + w * .1) * 2.2; }
          else { d[i] = w; }
        }
        return b;
      }
      var white = noiseBuf(1, 'white'), pink = noiseBuf(3, 'pink'), brown = noiseBuf(7, 'brown');
      function play(buf, t, dur, gainPeak, attack, filt, f1, f2, toRev) {
        var s = ac.createBufferSource(); s.buffer = buf;
        var f = ac.createBiquadFilter(); f.type = filt; f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
        var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gainPeak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(master); if (toRev) { g.connect(rev); }
        s.start(t, Math.random() * .3); s.stop(t + dur + .05);
      }
      // 1) the strike: a fast cluster of crackles (each a tiny bright noise burst), then the main crack
      for (var k = 0; k < 9; k++) { play(white, now + k * .012 + Math.random() * .01, .05 + Math.random() * .05, .5 + Math.random() * .4, .002, 'highpass', 2500, 1200, true); }
      play(white, now + .1, .5, 1, .003, 'lowpass', 9000, 600, true);
      play(pink, now + .1, 1.2, .9, .01, 'lowpass', 3000, 250, true);
      // 2) the roll: several overlapping low swells with random delays, like thunder echoing off clouds
      var t = now + .35;
      for (var r = 0; r < 6; r++) {
        play(brown, t, 2.2 + Math.random() * 2.5, .7 + Math.random() * .5, .25 + Math.random() * .4, 'lowpass', 420 - r * 40, 70, true);
        t += .35 + Math.random() * .7;
      }
      // 3) sub-bass thump you feel more than hear
      var o = ac.createOscillator(), og = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(70, now + .1); o.frequency.exponentialRampToValueAtTime(32, now + 1.6);
      og.gain.setValueAtTime(.0001, now + .1); og.gain.exponentialRampToValueAtTime(.9, now + .14); og.gain.exponentialRampToValueAtTime(.0001, now + 1.8);
      o.connect(og); og.connect(master); o.start(now + .1); o.stop(now + 1.9);
      // 4) fizzing electricity while the arcs run around
      var z = ac.createBufferSource(); z.buffer = white; z.loop = true;
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 2;
      var zg = ac.createGain(); zg.gain.setValueAtTime(.0001, now + .6); zg.gain.exponentialRampToValueAtTime(.06, now + .9); zg.gain.exponentialRampToValueAtTime(.0001, now + 4.6);
      var am = ac.createOscillator(), amg = ac.createGain(); am.type = 'square'; am.frequency.value = 23; amg.gain.value = .04;
      am.connect(amg); amg.connect(zg.gain);
      z.connect(bp); bp.connect(zg); zg.connect(master); z.start(now + .6); am.start(now + .6); z.stop(now + 4.7); am.stop(now + 4.7);
      setTimeout(function () { ac.close(); }, 9000);
    } catch (e) { /* no sound, no problem */ }
  }

  /* ---------- the storm: bolts strike all over the page, the page flashes white, then electricity races around ---------- */
  var busy = false;
  function strike(btn) {
    if (busy) { return; }
    busy = true;
    btn.classList.remove('charge'); void btn.offsetWidth; btn.classList.add('charge');
    thunder();
    var W = innerWidth, H = innerHeight;
    var cv = document.createElement('canvas'), dpr = Math.min(devicePixelRatio || 1, 2);
    cv.className = 'rr-mj-cv'; cv.width = W * dpr; cv.height = H * dpr;
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (!calm) {
      var fl = document.createElement('div'); fl.className = 'rr-mj-flash';
      document.body.appendChild(fl); void fl.offsetWidth; fl.classList.add('go');
      setTimeout(function () { fl.remove(); }, 1400);
      document.documentElement.classList.add('rr-mj-shake', 'rr-mj-lit');
      setTimeout(function () { document.documentElement.classList.remove('rr-mj-shake'); }, 600);
      setTimeout(function () { document.documentElement.classList.remove('rr-mj-lit'); }, 1500);
    }
    // bolts: from the top edge to points spread over the whole page, staggered over ~0.7 s
    var strikes = [];
    var N = 7 + Math.floor(Math.random() * 3);
    for (var i = 0; i < N; i++) {
      (function (i) {
        var x2 = W * ((i + .2 + Math.random() * .6) / N), y2 = H * (.35 + Math.random() * .6);
        var x1 = x2 + (Math.random() - .5) * W * .35;
        strikes.push({ at: i < 3 ? i * 40 : 120 + Math.random() * 600, segs: tree(x1, -10, x2, y2, 2 + (i % 2), [], 2 + Math.random() * 1.6), x: x2, y: y2 });
      })(i);
    }
    // racers: points that dart around the screen leaving short-lived electric arcs behind them
    var racers = [];
    for (var r = 0; r < 9; r++) {
      var a = Math.random() * 7, v = 14 + Math.random() * 16;
      racers.push({ x: Math.random() * W, y: Math.random() * H, vx: Math.cos(a) * v, vy: Math.sin(a) * v, trail: [] });
    }
    var sparks = [];
    var t0 = performance.now(), last = 0, DUR = 5000;
    function frame(now) {
      var t = now - t0;
      if (t > DUR) { cv.remove(); busy = false; btn.classList.remove('charge'); return; }
      if (now - last < 33) { requestAnimationFrame(frame); return; }
      last = now;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      var fade = t < 3800 ? 1 : 1 - (t - 3800) / 1200;
      strikes.forEach(function (s) {
        var st = t - s.at;
        if (st < 0) { return; }
        if (!s.hit) {
          s.hit = true;
          for (var q = 0; q < 18; q++) { var an = Math.random() * 7, sp = 2 + Math.random() * 6; sparks.push({ x: s.x, y: s.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 2.5, life: 1 }); }
        }
        var al = st < 70 ? 1 : Math.max(0, 1 - (st - 70) / 520) * (Math.random() < .3 ? .3 : 1);
        if (al <= 0) { return; }
        s.segs.forEach(function (g) { draw(ctx, g.p, g.w, al); });
        var ig = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 120);
        ig.addColorStop(0, 'rgba(230,248,255,' + .6 * al + ')'); ig.addColorStop(1, 'rgba(90,170,240,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(s.x, s.y, 120, 0, 7); ctx.fill();
      });
      if (t > 450) {
        racers.forEach(function (p) {
          // jittery, fast, bouncing off the screen edges; sometimes it jumps to a new direction
          if (Math.random() < .12) { var na = Math.random() * 7, nv = 14 + Math.random() * 18; p.vx = Math.cos(na) * nv; p.vy = Math.sin(na) * nv; }
          var ox = p.x, oy = p.y;
          p.x += p.vx + (Math.random() - .5) * 10; p.y += p.vy + (Math.random() - .5) * 10;
          if (p.x < 0 || p.x > W) { p.vx = -p.vx; p.x = Math.max(0, Math.min(W, p.x)); }
          if (p.y < 0 || p.y > H) { p.vy = -p.vy; p.y = Math.max(0, Math.min(H, p.y)); }
          p.trail.push([ox, oy, p.x, p.y]); if (p.trail.length > 6) { p.trail.shift(); }
          p.trail.forEach(function (seg, k) { draw(ctx, bolt(seg[0], seg[1], seg[2], seg[3], .55), 1.1, (k + 1) / p.trail.length * .9 * fade); });
          if (Math.random() < .15) {                                   // a branch flicks out to a nearby spot
            var ba = Math.random() * 7, bl = 40 + Math.random() * 90;
            draw(ctx, bolt(p.x, p.y, p.x + Math.cos(ba) * bl, p.y + Math.sin(ba) * bl, .6), .8, .7 * fade);
          }
        });
        if (Math.random() < .25 * fade) {                              // the odd arc jumping between two racers
          var A = racers[Math.floor(Math.random() * racers.length)], B = racers[Math.floor(Math.random() * racers.length)];
          if (A !== B && Math.hypot(A.x - B.x, A.y - B.y) < 450) { draw(ctx, bolt(A.x, A.y, B.x, B.y, .4), 1.4, .9 * fade); }
        }
      }
      sparks.forEach(function (p) {
        if (p.life <= 0) { return; }
        p.x += p.vx; p.y += p.vy; p.vy += .32; p.vx *= .98; p.life -= .035;
        ctx.globalAlpha = Math.max(0, p.life); ctx.strokeStyle = '#dff4ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); ctx.stroke();
      });
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function mount() {
    var bar = document.querySelector('.header-top-row .rr-social-top');
    if (!bar) { return false; }
    var st = document.createElement('style'); st.id = 'rr-mjolnir'; st.textContent = css; document.head.appendChild(st);
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'rr-mj'; b.title = 'Mjölnir'; b.setAttribute('aria-label', 'Mjölnir'); b.innerHTML = HAMMER;
    b.addEventListener('click', function (ev) { ev.preventDefault(); strike(b); });
    bar.appendChild(b);
    return true;
  }
  var tries = 0;
  (function wait() { if (!mount() && tries++ < 40) { setTimeout(wait, 200); } })();
})();

/* Home page "Üzlet és átvevőhely" (owner 2026-11-16): full width, a dark live map hugging the left edge, the shop
   details in the middle, and a collage of the new shop photos hugging the right edge. Phone: details, photos, map. */
(function () {
  if (window.__rrLocation) { return; }
  window.__rrLocation = true;
  var ASSET = 'https://1374223-star.github.io/rockpince-menu-counts/assets/shop/';
  var MAP = 'https://www.google.com/maps?q=47.50566,19.08687&z=15&hl=hu&output=embed';
  var ROUTE = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('Dózsa György út 19, 1146 Budapest');
  var css =
    '.location-module.rr-loc-on{max-width:none!important;width:100%!important;padding:0!important}' +
    '.location-module.rr-loc-on .module-body{padding:0!important}' +
    '.section-wrapper:has(.rr-loc){overflow-x:clip}' +
    '.rr-loc{width:100vw;margin-left:calc(50% - 50vw);display:grid;grid-template-columns:1fr minmax(380px,440px) 1fr;min-height:520px;align-items:stretch;' +
      'border-top:1px solid rgba(127,196,234,.35);border-bottom:1px solid rgba(127,196,234,.35);box-shadow:0 0 30px rgba(40,130,200,.15)}' +
    '.rr-loc .map{position:relative;overflow:hidden;background:#06243b}' +
    '.rr-loc .map iframe{position:absolute;inset:0;width:100%;height:100%;border:0}' +
    '.rr-loc .map:after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset -18px 0 24px -14px rgba(3,18,32,.75)}' +
    '.rr-loc .pics{position:relative;background:#06243b url(' + ASSET + 'fooldal_kollazs_2026.webp) center/cover no-repeat;display:block}' +
    '.rr-loc .pics:after{content:"";position:absolute;inset:0;box-shadow:inset 40px 0 50px -20px rgba(3,18,32,.9);transition:background .25s}' +
    '.rr-loc .pics:hover:after{background:rgba(90,170,240,.08)}' +
    '.rr-loc .mid{display:flex;flex-direction:column;justify-content:center;gap:14px;padding:34px 32px;color:#c4d2df;font-size:15px;line-height:1.55;' +
      'background:linear-gradient(180deg,#0b3a5e 0%,#06243b 55%,#041b2d 100%);border-left:1px solid rgba(127,196,234,.35);border-right:1px solid rgba(127,196,234,.35)}' +
    '.rr-loc h3{margin:0;color:#fff;font-size:26px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;line-height:1.15}' +
    '.rr-loc .eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9fd6f7}' +
    '.rr-loc .addr{color:#fff;font-weight:700;font-size:17px}' +
    '.rr-loc table{width:100%;border-collapse:collapse}' +
    '.rr-loc td{padding:5px 0;border-top:1px solid rgba(127,196,234,.15)}' +
    '.rr-loc tr:first-child td{border-top:0}' +
    '.rr-loc td+td{text-align:right;color:#fff;font-weight:700}' +
    '.rr-loc .closed{color:#ff6b66!important}' +
    '.rr-loc .note{font-size:13px;color:#9fb3c6}' +
    '.rr-loc .btns{display:flex;gap:10px;flex-wrap:wrap}' +
    '.rr-loc .btns a{flex:1 1 140px;text-align:center;padding:11px 14px;border-radius:8px;font-weight:700;text-decoration:none!important}' +
    '.rr-loc .b1{background:#e52421;color:#fff!important}.rr-loc .b1:hover{background:#ff3a36}' +
    '.rr-loc .b2{border:1px solid rgba(127,196,234,.6);color:#d6e2ec!important}.rr-loc .b2:hover{border-color:#9fd6f7;color:#fff!important}' +
    '@media (max-width:991px){.rr-loc{grid-template-columns:1fr;min-height:0}.rr-loc .mid{padding:26px 20px}.rr-loc .mid{order:1;border:0}' +
      '.rr-loc .pics{order:2;height:0;padding-bottom:104%}.rr-loc .map{order:3;height:300px}' +
      '.rr-loc .map:after,.rr-loc .pics:after{box-shadow:none}}';
  function build() {
    var mod = document.querySelector('.location-module');
    if (!mod) { return false; }
    var box = mod.querySelector('.location-wrapper-box');
    if (!box) { return true; }
    var st = document.createElement('style'); st.id = 'rr-location'; st.appendChild(document.createTextNode(css)); document.head.appendChild(st);
    mod.classList.add('rr-loc-on');
    var wrap = document.createElement('div');
    wrap.className = 'rr-loc';
    wrap.innerHTML =
      '<div class="map"><iframe src="' + MAP + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="RagnaRock üzlet a térképen"></iframe></div>' +
      '<div class="mid">' +
        '<div class="eyebrow">Budapest · XIV. kerület</div>' +
        '<h3>Üzlet és átvevőhely</h3>' +
        '<div class="addr">1146 Budapest, Dózsa György út 19.</div>' +
        '<table><tr><td>Hétfő – péntek</td><td>12:00 – 18:00</td></tr><tr><td>Szombat</td><td>10:00 – 14:00</td></tr>' +
          '<tr><td>Vasárnap</td><td class="closed">Zárva</td></tr></table>' +
        '<div class="note">Webshopos rendelésedet itt ingyen átveheted.</div>' +
        '<div class="btns"><a class="b1" href="' + ROUTE + '" target="_blank" rel="noopener">Útvonaltervezés</a>' +
          '<a class="b2" href="/uzletunk">Az üzletről</a></div>' +
      '</div>' +
      '<a class="pics" href="/uzletunk" aria-label="Képek az üzletről"></a>';
    box.replaceWith(wrap);
    return true;
  }
  var tries = 0;
  (function wait() { if (!build() && tries++ < 40) { setTimeout(wait, 200); } })();
})();

/* Top bar layout (owner 2026-11-16), desktop: left = phone + e-mail, middle = social buttons + Mjölnir,
   right = the five page links. The phone leaves the logo row; the "Bolt nyitva/zárva" chip leaves the top bar
   and is shown in the home page "Üzlet és átvevőhely" card instead (kept in sync with the original chip). */
(function () {
  if (window.__rrTopBar3) { return; }
  window.__rrTopBar3 = true;
  var PHONE = '+36705882134', PHONE_TXT = '+36 70 588 2134';
  var css =
    '@media (min-width:1200px){' +
      '.header-top-row{display:grid!important;grid-template-columns:1fr auto 1fr;align-items:center;column-gap:18px}' +
      '.header-top-row .rr-open{display:none!important}' +
      '.header-top-row > *{grid-row:1}' +
      '.rr-tl{display:flex;align-items:center;gap:10px;justify-self:start;grid-column:1}' +
      '.rr-tl .rr-mailtop{margin:0!important}' +
      '.header-top-row .rr-social-top{grid-column:2;justify-self:center;display:flex!important;align-items:center;gap:10px}' +
      '.header-top-row .headermenu-list{grid-column:3;justify-self:end;margin:0;display:flex!important;flex-wrap:nowrap;white-space:nowrap}' +
      '.header-middle__phone{display:none!important}' +
      '.rr-phonetop{display:inline-flex;align-items:center;gap:8px;padding:5px 14px;border:1px solid rgba(127,196,234,.35);border-radius:16px;' +
        'color:#e6f3fb!important;font-size:13px;letter-spacing:.02em;text-decoration:none!important;white-space:nowrap;transition:border-color .15s,background .15s}' +
      '.rr-phonetop:hover{border-color:rgba(160,214,244,.8);background:rgba(127,196,234,.1)}' +
      '.rr-phonetop svg{width:16px;height:16px;flex:none}' +
    '}' +
    '@media (max-width:1199px){.rr-phonetop{display:none!important}}' +
    '.rr-loc .rr-open{align-self:flex-start;margin:0!important}';
  function build() {
    var row = document.querySelector('.header-top-row');
    var mail = row && row.querySelector('.rr-mailtop'), social = row && row.querySelector('.rr-social-top');
    if (!row || !mail || !social) { return false; }
    if (!document.getElementById('rr-topbar3')) {
      var st = document.createElement('style'); st.id = 'rr-topbar3'; st.appendChild(document.createTextNode(css)); document.head.appendChild(st);
    }
    if (!row.querySelector('.rr-tl')) {
      var tl = document.createElement('div'); tl.className = 'rr-tl';
      var ph = document.createElement('a'); ph.className = 'rr-phonetop'; ph.href = 'tel:' + PHONE; ph.title = 'Hívj minket';
      ph.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#9fd6f7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>' +
        '<span>' + PHONE_TXT + '</span>';
      tl.appendChild(ph); tl.appendChild(mail);
      row.insertBefore(tl, row.firstChild);
      row.insertBefore(social, tl.nextSibling);
    }
    return true;
  }
  function syncChip() {                       // copy the live open/closed chip into the home location card
    var src = document.querySelector('.header-top-row .rr-open'), mid = document.querySelector('.rr-loc .mid');
    if (!src || !mid) { return; }
    var c = mid.querySelector('.rr-open');
    if (!c) { c = document.createElement('a'); mid.insertBefore(c, mid.firstChild); }
    c.className = src.className; c.href = '/uzletunk'; c.innerHTML = src.innerHTML;
  }
  var tries = 0;
  (function wait() { if (!build() && tries++ < 50) { setTimeout(wait, 200); } })();
  var n = 0;
  (function chip() { syncChip(); if (n++ < 20) { setTimeout(chip, 1500); } else { setInterval(syncChip, 60000); } })();
})();

/* Header tidy-up (owner 2026-11-16):
   - profile, wishlist and basket are one framed block (same height as the search bar, thin dividers between)
   - top bar spans the full width: phone + e-mail against the left edge, page links against the right edge
   - product cards: no "Cikkszám" line
   - "Kedvezményes kínálatunk" title and its "Összes akciós termék" button in the same colours as the rest */
(function () {
  if (window.__rrHeadTidy) { return; }
  window.__rrHeadTidy = true;
  var LINE = 'rgba(127,196,234,.55)';
  var css =
    '@media (min-width:992px){' +
      '.header-middle-right-wrapper{display:flex!important;align-items:stretch!important;height:52px;border:1px solid ' + LINE + '!important;border-radius:8px!important;' +
        'background:rgba(3,16,28,.55)!important;overflow:hidden;margin:0!important;padding:0!important}' +
      '.header-middle-right-wrapper > .header-middle-right-box{display:flex!important;align-items:center;justify-content:center;width:56px!important;height:100%!important;' +
        'margin:0!important;padding:0!important;border:0!important;background:transparent!important;transition:background .15s}' +
      '.header-middle-right-wrapper > .header-middle-right-box + .header-middle-right-box{border-left:1px solid rgba(127,196,234,.22)!important}' +
      '.header-middle-right-wrapper > .header-middle-right-box:hover{background:rgba(127,196,234,.1)!important}' +
      '.header-middle-right-wrapper > .header-middle-right-box:before,.header-middle-right-wrapper > .header-middle-right-box:after{display:none!important}' +
      '.header-middle-right-wrapper #js-cart *{border:0!important}' +
      '.header-middle-right-wrapper #js-cart,.header-middle-right-wrapper #js-cart > *,.header-middle-right-wrapper #js-cart .js-cart-ajax,.header-middle-right-wrapper #js-cart .cart-dropdown{width:100%;height:100%;display:flex;align-items:center;justify-content:center}' +
      '.header-middle-right-wrapper .cart-dropdown-toggle{background:transparent!important;box-shadow:none!important;width:100%!important;height:100%!important;' +
        'padding:0!important;display:flex!important;align-items:center;justify-content:center;border-radius:0!important}' +
      '.header-middle-right-wrapper .rr-cart-ic{width:26px;height:26px}' +
      '.header-top-row{max-width:none!important;width:100%!important;margin:0!important;padding:0 20px!important}' +
    '}' +
    '.product-card__sku{display:none!important}' +
    '.header input::placeholder{color:#3f6d93!important;opacity:1!important}' +
    '.module-special-wrapper .module-head-title{color:#fff!important;-webkit-text-fill-color:#fff!important}' +
    '.module-special-wrapper .modules-all-link{background:#0b344d!important;border:1px solid ' + LINE + '!important;color:#fff!important}' +
    '.module-special-wrapper .modules-all-link:hover{background:#114a6d!important;border-color:#9fd6f7!important}';
  var st = document.createElement('style'); st.id = 'rr-headtidy'; st.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(st);
  function merge() {
    if (!window.matchMedia || !matchMedia('(min-width:992px)').matches) { return true; }   /* phones keep the theme's own cart button (it balances the centred logo) */
    var wrap = document.querySelector('.header-middle-right-wrapper'), cart = document.getElementById('js-cart');
    if (!wrap || !cart) { return false; }
    if (cart.parentNode !== wrap) { wrap.appendChild(cart); }
    return true;
  }
  var tries = 0;
  (function wait() { if (!merge() && tries++ < 50) { setTimeout(wait, 200); } })();
})();

/* Phone menu arrows (owner 2026-11-16): no subfolder count numbers (they sat misaligned), no tall divider line before
   the arrow, and the ">" is a big chrome "›" in the menu's Barlow Condensed lettering instead of a thin drawn chevron. */
(function () {
  if (window.__rrMmArrows) { return; }
  window.__rrMmArrows = true;
  var CHROME = 'linear-gradient(180deg,#ffffff 0%,#dcf0fc 40%,#a9d2ee 50%,#b8dcf3 56%,#f0f9ff 80%,#b5daf2 100%)';
  var css =
    '#js-mobile-nav .mm-counter{display:none!important}' +
    '#js-mobile-nav .mm-listitem__btn,#js-mobile-nav .mm-btn--next{border-left:0!important;background:transparent!important}' +
    '#js-mobile-nav .mm-listitem__btn:before,#js-mobile-nav .mm-btn--next:before{display:none!important}' +
    '#js-mobile-nav .mm-btn--next{width:56px!important}' +
    '#js-mobile-nav .mm-btn--next:after{content:"\\203A"!important;border:0!important;transform:none!important;width:auto!important;height:auto!important;' +
      'left:auto!important;right:20px!important;top:50%!important;bottom:auto!important;margin:0!important;translate:0 -54%;' +
      'font-family:"Barlow Condensed",Poppins,sans-serif!important;font-weight:700!important;font-size:54px!important;line-height:1!important;' +
      'background:' + CHROME + ';-webkit-background-clip:text;background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;' +
      'filter:drop-shadow(0 1px 0 #031220)}' +
    /* owner: "the > system is inconsistent": rows without subfolders get the same arrow (they open the category),
       and the back button uses the same lettering */
    '#js-mobile-nav .mm-listitem:not([data-mm-child]):not(.informations-mobile-menu-item-separator ~ li) > a.mm-listitem__text{position:relative;padding-right:64px!important}' +
    '#js-mobile-nav .mm-listitem:not([data-mm-child]):not(.informations-mobile-menu-item-separator ~ li) > a.mm-listitem__text:after{content:"\\203A";position:absolute;right:20px;top:50%;translate:0 -54%;' +
      'font-family:"Barlow Condensed",Poppins,sans-serif;font-weight:700;font-size:54px;line-height:1;' +
      'background:' + CHROME + ';-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;filter:drop-shadow(0 1px 0 #031220)}' +
    '#js-mobile-nav .mm-btn--prev:before{content:"\\2039"!important;border:0!important;transform:none!important;width:auto!important;height:auto!important;' +
      'left:50%!important;top:50%!important;right:auto!important;bottom:auto!important;margin:0!important;translate:-50% -54%;' +
      'font-family:"Barlow Condensed",Poppins,sans-serif!important;font-weight:700!important;font-size:54px!important;line-height:1!important;' +
      'background:' + CHROME + ';-webkit-background-clip:text;background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;filter:drop-shadow(0 1px 0 #031220)}';
  var st = document.createElement('style'); st.id = 'rr-mm-arrows'; st.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(st);
})();

/* Phone menu bottom (owner 2026-11-16): no separator lines under the page links, and phone + e-mail as the same
   rounded pills as on the desktop top bar. */
(function () {
  if (window.__rrMmContact) { return; }
  window.__rrMmContact = true;
  var css =
    '#js-mobile-nav li.informations-mobile-menu-item-separator ~ li,#js-mobile-nav li.informations-mobile-menu-item-separator ~ li > *{border-bottom:0!important;border-top:0!important}' +
    '#js-mobile-nav li.informations-mobile-menu-item-separator ~ li:after,#js-mobile-nav li.informations-mobile-menu-item-separator ~ li:before{display:none!important}' +
    '#js-mobile-nav li.rr-mm-contact{padding:14px 20px 6px!important;border:0!important}' +
    '#js-mobile-nav li.rr-mm-contact:after{display:none!important}' +
    '.rr-mm-pills{display:flex;flex-direction:column;gap:10px;align-items:flex-start;padding:16px 20px 10px}' +
    '.rr-mm-pills a{display:inline-flex!important;align-items:center;gap:9px;padding:8px 16px!important;border:1px solid rgba(127,196,234,.45)!important;border-radius:18px;' +
      'color:#e6f3fb!important;font-family:Poppins,sans-serif!important;font-size:15px!important;letter-spacing:.02em;text-decoration:none!important;background:rgba(3,16,28,.35)}' +
    '.rr-mm-pills svg{width:17px;height:17px;flex:none}' +
    /* keep the last items clear of the bottom bar, and hide the Fogyasztó Barát badge while the menu is open */
    '#js-mobile-nav .mm-panel{padding-bottom:110px!important}' +
    '.mm-wrapper--opened #fb_header_box,.mm-wrapper--opened #fb_content_box{display:none!important}';
  var TEL = '<svg viewBox="0 0 24 24" fill="none" stroke="#9fd6f7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>';
  var MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="#9fd6f7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>';
  function build() {
    var tel = document.querySelector('a.informations-mobile-menu-phone');
    if (!tel) { return false; }
    /* mmenu turns anything added inside a menu item into a submenu, so the pills go below the list, and the old
       phone item is hidden */
    var li = tel.closest('li'), list = li && li.parentNode, panel = list && list.parentNode;
    if (!panel) { return false; }
    if (!document.getElementById('rr-mm-contact')) {
      var st = document.createElement('style'); st.id = 'rr-mm-contact'; st.appendChild(document.createTextNode(css)); document.head.appendChild(st);
    }
    li.style.display = 'none';
    if (panel.querySelector('.rr-mm-pills')) { return true; }
    var d = document.createElement('div'); d.className = 'rr-mm-pills';
    d.innerHTML = '<a href="tel:+36705882134">' + TEL + '<span>+36 70 588 2134</span></a>' +
      '<a href="mailto:info@ragnarock.hu">' + MAIL + '<span>info@ragnarock.hu</span></a>';
    list.insertAdjacentElement('afterend', d);
    return true;
  }
  var tries = 0;
  (function wait() { build(); if (tries++ < 60) { setTimeout(wait, 500); } })();   /* keeps checking for 30 s: the menu re-renders */
})();

/* Second band strip, phone home page only (owner 2026-11-16): under the banner, sliding the other way, with none of
   the bands already in the header strip. Same look; the duration is only measured once it is laid out. */
(function () {
  if (window.__rrBands2) { return; }
  window.__rrBands2 = true;
  if (!window.matchMedia || !matchMedia('(max-width:991px)').matches) { return; }
  if (location.pathname !== '/' && location.pathname !== '/index.php') { return; }
  var BASE = 'https://1374223-star.github.io/rockpince-menu-counts/assets/bands/', SHOW = 80, SPEED = 32;
  var css =
    '.rr-bands2{margin:0}' +
    '.rr-bands2 .rr-bands-track{animation-direction:reverse!important}' +
    /* owner: the same 24px gap above the banner as between the banner and this strip */
    '.section-wrapper:has(+ .rr-bands2){margin-top:24px!important}';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pick(all, used) {
    var pool = all.filter(function (b) { return !used[b.s]; }), out = [];
    while (out.length < SHOW && pool.length) {
      var tot = 0, i;
      for (i = 0; i < pool.length; i++) { tot += Math.sqrt(pool[i].c || 1) + 1; }
      var r = Math.random() * tot;
      for (i = 0; i < pool.length; i++) { r -= Math.sqrt(pool[i].c || 1) + 1; if (r <= 0) { break; } }
      out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
    }
    return out;
  }
  function anchor() {
    var b = document.querySelector('.banner-item__image, .slider-thumbnails-wrapper, .rr-banner-arrows');
    return b && (b.closest('.section-wrapper') || b.closest('.module'));
  }
  function build(all) {
    var first = document.querySelector('.rr-bands:not(.rr-bands2)'), at = anchor();
    if (!first || !at || document.querySelector('.rr-bands2')) { return false; }
    var used = {};
    [].forEach.call(first.querySelectorAll('.rr-blogo img'), function (im) { var m = im.src.match(/\/([^\/]+)\.webp/); if (m) { used[m[1]] = 1; } });
    var list = pick(all, used), html = '';
    if (!list.length) { return true; }
    for (var k = 0; k < 2; k++) {
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        html += '<a class="rr-blogo" draggable="false" href="/index.php?route=product/list&amp;keyword=' + encodeURIComponent(b.k.toLowerCase()) +
          '" title="' + esc(b.n) + '"' + (k ? ' aria-hidden="true" tabindex="-1"' : '') + '><img src="' + BASE + b.s + '.webp" alt="' + esc(b.n) +
          '" width="' + b.w + '" height="' + b.h + '" style="--w:' + b.w + '" loading="lazy" decoding="async" draggable="false"></a>';
      }
    }
    var st = document.createElement('style'); st.id = 'rr-bands2-css'; st.appendChild(document.createTextNode(css)); document.head.appendChild(st);
    var box = document.createElement('div');
    box.className = 'rr-bands rr-bands2'; box.setAttribute('aria-label', 'További zenekarok');
    box.innerHTML = '<div class="rr-bands-vp"><div class="rr-bands-track">' + html + '</div></div>';
    at.parentNode.insertBefore(box, at.nextSibling);
    var track = box.querySelector('.rr-bands-track'), vp = box.querySelector('.rr-bands-vp'), dur = 0;
    function measure() {
      var w = track.scrollWidth;
      if (!w || !box.offsetWidth || w < 2 * vp.clientWidth) { return; }
      var nd = Math.max(30, (w / 2) / SPEED);
      if (dur && Math.abs(nd - dur) < 1) { return; }
      dur = nd; track.style.setProperty('--dur', dur.toFixed(1) + 's');
    }
    measure();
    if (window.ResizeObserver) { new ResizeObserver(measure).observe(track); }
    box.addEventListener('click', function (e) { if (!(e.target.closest && e.target.closest('.rr-blogo'))) { box.classList.toggle('paused'); } });
    if (window.IntersectionObserver) { new IntersectionObserver(function (en) { box.classList.toggle('off', !en[0].isIntersecting); }).observe(box); }
    return true;
  }
  var all = null, tries = 0;
  var x = new XMLHttpRequest();
  x.open('GET', BASE + 'bands.json', true);
  x.onload = function () { try { all = JSON.parse(x.responseText); } catch (e) { all = []; } };
  x.send();
  (function wait() { if (!(all && all.length && build(all)) && tries++ < 60) { setTimeout(wait, 250); } })();
})();

/* Footer (owner 2026-11-16): the public e-mail is info@ragnarock.hu (the shop's system address stays as it is in the
   admin, because order e-mails use it), and the PayPal logo goes: PayPal is no longer offered. */
(function () {
  if (window.__rrFooter) { return; }
  window.__rrFooter = true;
  var OLD = 'info@rockpince.hu', NEW = 'info@ragnarock.hu';
  var st = document.createElement('style'); st.id = 'rr-footer';
  st.textContent = '.partner__link[href*="paypal"],.partner:has(.partner__link[href*="paypal"]){display:none!important}';
  (document.head || document.documentElement).appendChild(st);
  function fix() {
    var f = document.querySelector('footer');
    if (!f) { return false; }
    [].forEach.call(f.querySelectorAll('a[href^="mailto:"]'), function (a) {
      if (a.getAttribute('href').indexOf(OLD) >= 0) { a.setAttribute('href', 'mailto:' + NEW); }
      if (a.textContent.indexOf(OLD) >= 0) { a.textContent = a.textContent.split(OLD).join(NEW); }
    });
    [].forEach.call(f.querySelectorAll('.partner__link[href*="paypal"]'), function (a) {
      var p = a.closest('.partner, li, .col, [class*="partner-item"]'); (p && p !== f ? p : a).style.display = 'none';
    });
    return true;
  }
  var tries = 0;
  (function wait() { if (!fix() && tries++ < 40) { setTimeout(wait, 250); } })();
})();

/* "Utoljára megtekintett termékek" (owner: "why are there no sizes, kosárba and price?"): the theme hides the price
   and the card footer in this module only. Show them like on the other product modules (sizes come from the size
   chips added to every card footer). */
(function () {
  if (window.__rrLastSeen) { return; }
  window.__rrLastSeen = true;
  var st = document.createElement('style'); st.id = 'rr-lastseen';
  st.textContent =
    '#lastseen .product-card__price{display:flex!important;flex-direction:column;align-items:center}' +
    '#lastseen .product-card__footer{display:block!important}' +
    '#lastseen .product-card__addtocart{display:flex!important;justify-content:center}' +
    '#lastseen .product-card__details,#lastseen .quantity-input,#lastseen .quantity-name-text{display:none!important}' +
    '#lastseen .button-add-to-cart{display:flex!important;width:100%;justify-content:center}';
  (document.head || document.documentElement).appendChild(st);
})();

/* Cart side panel (owner 2026-11-16), desktop: hovering the basket opens a panel sliding in from the right with what
   is in the cart (photo, name, size, quantity, price), the total and how much is left to free shipping. While the
   cart has items, a small tab on the right edge opens the same panel. The items come from the cart page's own data
   (document.aurora.initialState), fetched only when the panel opens and again only when the count changes. */
(function () {
  if (window.__rrCartPanel) { return; }
  window.__rrCartPanel = true;
  if (!window.matchMedia || !matchMedia('(min-width:992px) and (hover:hover)').matches) { return; }
  if (/checkout/.test(location.search + location.pathname)) { return; }
  var FREE = 30000, CART = '/index.php?route=checkout/cart';
  var css =
    '.header-middle-right-wrapper{overflow:visible!important}' +
    /* the theme's own little cart hover box opened to the right, off the screen: the side panel replaces it */
    '#js-cart .cart-dropdown > :not(.cart-dropdown-toggle),#js-cart .dropdown-menu{display:none!important}' +
    /* the wishlist dropdown opens downwards, inside the screen, instead of to the right */
    '#header-middle-wishlist .dropdown-menu{left:auto!important;right:0!important;top:calc(100% + 8px)!important;bottom:auto!important;transform:none!important;margin:0!important}' +
    '.header-middle-right-wrapper > .header-middle-right-box:first-child{border-radius:7px 0 0 7px}' +
    '.header-middle-right-wrapper > .header-middle-right-box:last-child{border-radius:0 7px 7px 0}' +
    '#js-cart .header-quantity-box{position:absolute!important;top:3px!important;right:5px!important;left:auto!important;min-width:18px;height:18px;line-height:18px;padding:0 4px;' +
      'border-radius:9px;background:#e52421!important;color:#fff!important;font-size:11px;font-weight:700;text-align:center;box-shadow:0 0 0 2px #031627}' +
    '.rr-cp{position:fixed;top:0;right:0;bottom:0;width:390px;max-width:92vw;z-index:2147483000;display:flex;flex-direction:column;' +
      'background:linear-gradient(180deg,#0b3a5e 0%,#06243b 30%,#031627 100%);border-left:1px solid rgba(127,196,234,.55);box-shadow:-18px 0 40px rgba(0,0,0,.55);' +
      'transform:translateX(105%);transition:transform .25s ease;color:#c4d2df;font-family:Poppins,sans-serif}' +
    '.rr-cp.open{transform:none}' +
    '.rr-cp h3{margin:0;padding:22px 22px 14px;color:#fff;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid rgba(127,196,234,.2)}' +
    '.rr-cp .list{flex:1;overflow:auto;padding:6px 22px}' +
    '.rr-cp .it{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid rgba(127,196,234,.14);text-decoration:none!important}' +
    '.rr-cp .it img{width:64px;height:64px;object-fit:contain;background:#fff;border-radius:6px;flex:none}' +
    '.rr-cp .nm{color:#e6f3fb;font-size:13.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
    '.rr-cp .op{color:#9fd6f7;font-size:12px;margin-top:2px}' +
    '.rr-cp .pr{color:#fff;font-weight:700;font-size:14px;margin-top:4px}' +
    '.rr-cp .pr small{color:#9fb3c6;font-weight:400}' +
    '.rr-cp .foot{padding:16px 22px 22px;border-top:1px solid rgba(127,196,234,.25);background:rgba(2,10,20,.55)}' +
    '.rr-cp .sum{display:flex;justify-content:space-between;color:#fff;font-size:17px;font-weight:800;margin-bottom:10px}' +
    '.rr-cp .free{font-size:12.5px;margin-bottom:6px}.rr-cp .free b{color:#fff}' +
    '.rr-cp .bar{height:6px;border-radius:3px;background:rgba(127,196,234,.15);overflow:hidden;margin-bottom:14px}' +
    '.rr-cp .bar i{display:block;height:100%;background:linear-gradient(90deg,#e52421,#ff6a63)}' +
    '.rr-cp .bar.ok i{background:linear-gradient(90deg,#1f9d4a,#34d06a)}' +
    '.rr-cp .go{display:block;text-align:center;padding:12px;border-radius:8px;background:#e52421;color:#fff!important;font-weight:800;text-decoration:none!important;text-transform:uppercase;letter-spacing:.04em}' +
    '.rr-cp .go:hover{background:#ff3a36}' +
    '.rr-cp .empty{padding:30px 0;text-align:center;color:#9fb3c6}' +
    '.rr-cp .x{position:absolute;top:16px;right:16px;width:32px;height:32px;border:0;background:transparent;color:#cfe9f8;font-size:26px;line-height:1;cursor:pointer}' +
    '.rr-cp-tab{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147482999;display:none;flex-direction:column;align-items:center;gap:4px;' +
      'padding:12px 9px;border-radius:10px 0 0 10px;background:linear-gradient(180deg,#14659c,#0a3a5e);border:1px solid rgba(127,196,234,.6);border-right:0;' +
      'color:#fff;font-weight:800;font-size:13px;cursor:pointer;box-shadow:-6px 0 18px rgba(0,0,0,.4)}' +
    '.rr-cp-tab.on{display:flex}.rr-cp-tab svg{width:22px;height:22px}';
  var st = document.createElement('style'); st.id = 'rr-cartpanel'; st.textContent = css; (document.head || document.documentElement).appendChild(st);

  var panel, tab, data = null, dataCount = -1, closeT = null;
  function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Ft'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function count() { var q = document.querySelector('#js-cart .header-quantity-box'); return q ? parseInt(q.textContent, 10) || 0 : 0; }
  function load(cb) {
    var n = count();
    if (data && n === dataCount) { cb(); return; }
    fetch(CART, { credentials: 'include' }).then(function (r) { return r.text(); }).then(function (h) {
      var m = h.match(/initialState\s*=\s*(\{"presentsData.*\});[ 	]*$/m);   /* one line of JSON; more code follows in that script */
      var items = [];
      if (m) { try { items = (JSON.parse(m[1]).items || []).filter(function (i) { return i.cartItemType !== 'Present'; }); } catch (e) { items = []; } }
      data = items; dataCount = n; cb();
    }).catch(function () { data = []; cb(); });
  }
  function render() {
    var items = data || [], total = 0, html = '';
    items.forEach(function (i) {
      total += i.totalNumber || 0;
      var opt = (i.option || []).map(function (o) { return esc(o.value || o.name); }).filter(Boolean).join(', ');
      html += '<a class="it" href="' + esc(i.href) + '"><img src="' + esc(i.imageUrl) + '" alt="" loading="lazy"><div>' +
        '<div class="nm">' + esc((i.name || '').trim()) + '</div>' + (opt ? '<div class="op">' + opt + '</div>' : '') +
        '<div class="pr">' + fmt(i.totalNumber || 0) + (i.quantity > 1 ? ' <small>(' + i.quantity + ' × ' + fmt(i.priceNumber || 0) + ')</small>' : '') + '</div></div></a>';
    });
    var left = Math.max(0, FREE - total), pct = Math.min(100, total / FREE * 100);
    panel.querySelector('h3').textContent = 'Kosár' + (items.length ? ' (' + items.reduce(function (a, i) { return a + (i.quantity || 1); }, 0) + ')' : '');
    panel.querySelector('.list').innerHTML = items.length ? html : '<div class="empty">A kosarad üres.</div>';
    panel.querySelector('.foot').style.display = items.length ? '' : 'none';
    panel.querySelector('.sum').innerHTML = '<span>Összesen</span><span>' + fmt(total) + '</span>';
    panel.querySelector('.free').innerHTML = left ? 'Még <b>' + fmt(left) + '</b> és ingyenes a szállítás!' : '<b>Ingyenes szállítás</b> erre a rendelésre!';
    var bar = panel.querySelector('.bar'); bar.className = 'bar' + (left ? '' : ' ok'); bar.firstChild.style.width = pct + '%';
  }
  function open() {
    clearTimeout(closeT);
    load(function () { render(); panel.classList.add('open'); });
  }
  function later() { clearTimeout(closeT); closeT = setTimeout(function () { panel.classList.remove('open'); }, 350); }
  function build() {
    var cart = document.getElementById('js-cart');
    if (!cart || !document.body) { return false; }
    panel = document.createElement('div'); panel.className = 'rr-cp'; panel.setAttribute('aria-label', 'Kosár tartalma');
    panel.innerHTML = '<button class="x" type="button" aria-label="Bezárás">×</button><h3>Kosár</h3><div class="list"></div>' +
      '<div class="foot"><div class="sum"></div><div class="free"></div><div class="bar"><i></i></div><a class="go" href="' + CART + '">Tovább a kosárhoz</a></div>';
    document.body.appendChild(panel);
    tab = document.createElement('button'); tab.type = 'button'; tab.className = 'rr-cp-tab'; tab.setAttribute('aria-label', 'Kosár megnyitása');
    document.body.appendChild(tab);
    cart.addEventListener('mouseenter', open); cart.addEventListener('mouseleave', later);
    tab.addEventListener('mouseenter', open); tab.addEventListener('click', open); tab.addEventListener('mouseleave', later);
    panel.addEventListener('mouseenter', function () { clearTimeout(closeT); }); panel.addEventListener('mouseleave', later);
    panel.querySelector('.x').addEventListener('click', function () { panel.classList.remove('open'); });
    function syncTab() {
      var n = count();
      tab.classList.toggle('on', n > 0);
      tab.innerHTML = '<svg viewBox="0 0 28 28" fill="none" stroke="#e6f3fb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5h3.2l3 13.5h13.6l2.9-9.5H7"/><circle cx="11" cy="22.6" r="1.8"/><circle cx="20" cy="22.6" r="1.8"/></svg><span>' + n + '</span>';
    }
    syncTab();
    if (window.MutationObserver) { new MutationObserver(syncTab).observe(cart, { childList: true, subtree: true, characterData: true }); }
    return true;
  }
  var tries = 0;
  (function wait() { if (!build() && tries++ < 50) { setTimeout(wait, 200); } })();
})();

/* Phone (owner 2026-11-16): the top band strip is part of the page, not of the sticky header - it scrolls away with
   the page instead of riding along / vanishing under the header. */
(function () {
  if (window.__rrBandsFlow) { return; }
  window.__rrBandsFlow = true;
  if (!window.matchMedia || !matchMedia('(max-width:991px)').matches) { return; }
  var tries = 0;
  (function wait() {
    var strip = document.querySelector('.rr-bands:not(.rr-bands2)'), sticky = document.querySelector('.section-wrapper.header-sticky');
    if (!strip || !sticky) { if (tries++ < 60) { setTimeout(wait, 200); } return; }
    if (strip.closest('.header-sticky')) {
      var after = sticky.nextElementSibling && sticky.nextElementSibling.classList.contains('rr-bands-spacer') ? sticky.nextElementSibling : sticky;
      after.parentNode.insertBefore(strip, after.nextSibling);
      strip.classList.add('rr-bands-flow');
    }
  })();
})();
