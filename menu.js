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
    /* Menu bar edge to edge (owner 2026-11-14): one row on every desktop width, first item at the left edge,
       last at the right, text + icons scale with the screen (10.5px at 992 px ... 22px from ~2250 px). */
    '@media (min-width: 992px) {' +
    ' .header-bottom .container-wide { max-width: none !important;' +
    '   padding-left: clamp(16px, 2vw, 48px) !important; padding-right: clamp(16px, 2vw, 48px) !important; }' +
    ' .header-bottom ul.category-menu { display: flex !important; width: 100% !important; margin-left: 0 !important; margin-right: 0 !important;' +
    '   flex-wrap: nowrap !important; justify-content: space-between !important; }' +
    ' .header-bottom ul.category-menu > li > a.nav-link { margin: 22px 0 !important; font-size: clamp(10.5px, .98vw, 22px) !important;' +
    '   white-space: nowrap !important; display: flex !important; align-items: center !important; }' +
    ' .header-bottom ul.category-menu > li > a.nav-link > img { width: 1.45em !important; height: 1.45em !important; }' +
    ' .header-bottom ul.category-menu > li > a.nav-link .rr-category-count { font-size: .9em !important; }' +
    '}' +
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
  function oneCard(done) {
    var leaf = pickLeaf(), page = 1 + Math.floor(Math.random() * Math.max(1, Math.ceil(leaf.n / PER_PAGE)));
    get('/index.php?route=product/list&category_id=' + leaf.id + '&page=' + page, function (htmlText) {
      var cards = [];
      try { cards = Array.prototype.slice.call(new DOMParser().parseFromString(htmlText, 'text/html')
        .querySelectorAll('.product-snapshot .product-card')); } catch (e) { /* nothing */ }
      done(cards.length ? cards[Math.floor(Math.random() * cards.length)] : null, leaf.id);
    });
  }
  /* one product from each of WANT different random categories */
  function load(grid, button) {
    if (!leaves.length) { return; }
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
    ask();
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
  setInterval(adjust, 700);
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
    cart: '<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>'
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
    var n = t ? ((t.innerText || '').match(/\d+/) || [''])[0] : '';
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
        try { history.replaceState(null, '', url.replace(/#.*$/, '')); } catch (e) { /* old browser */ }
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
    '   grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) !important; }' +
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
    '#module_newsletter_subscribe_wrapper { background-size: auto 100% !important; background-position: left center !important;' +
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
    '.header input[type=text], .header input[type=search] { font-size: 16px !important; height: 52px !important; padding-left: 18px !important; }' +
    '.header input::placeholder { color: #9cc7e3 !important; opacity: 1 !important; text-transform: uppercase; letter-spacing: .03em; }' +
    '.headermenu-list .nav-link { font-size: 13px !important; }' +
    '#module_information3_wrapper { display: none !important; }' +
    ".partners__item:has(a[href*='www.shoprenter.hu']) { display: none !important; }" +
    '.rr-random-grid:empty { height: 360px; border-radius: 8px;' +
    ' background: repeating-linear-gradient(90deg, rgba(127,196,234,.10) 0 calc(16.666% - 18px), transparent calc(16.666% - 18px) 16.666%);' +
    ' -webkit-mask: linear-gradient(90deg, #000 40%, rgba(0,0,0,.45) 50%, #000 60%) 0 0/300% 100%;' +
    ' mask: linear-gradient(90deg, #000 40%, rgba(0,0,0,.45) 50%, #000 60%) 0 0/300% 100%; animation: rrshim 1.4s linear infinite; }' +
    '@media (max-width: 767px) { .rr-random-grid:empty { height: 300px;' +
    ' background: repeating-linear-gradient(90deg, rgba(127,196,234,.10) 0 calc(50% - 8px), transparent calc(50% - 8px) 50%); } }' +
    '@keyframes rrshim { to { -webkit-mask-position: -150% 0; mask-position: -150% 0; } }';
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
    for (var i = 0; i < inputs.length; i++) { inputs[i].placeholder = 'Keress zenekarra, termékre...'; }
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
