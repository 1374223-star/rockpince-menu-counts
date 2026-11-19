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
  var hostRx = /^(?:(?:www\.)?rockpince\.hu|rockpince\.myshoprenter\.hu|(?:www\.)?ragnarock\.hu)$/i, hostSeen = {};
  function knownHost(host) {
    host = String(host || '');
    var v = hostSeen[host];
    if (v === undefined) { v = hostSeen[host] = hostRx.test(host); }
    return v;
  }
  /* 2026-11-17: folders whose address does not end in their id (/anime, /anime-kaiju-no-8) are found by their path */
  var idByPath = null;
  function pathId(path) {
    if (idByPath === null) {
      idByPath = {};
      for (var k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k) && data[k] && data[k][3]) { idByPath[String(data[k][3]).replace(/\/+$/, '')] = k; }
      }
    }
    return idByPath[path] || null;
  }
  function categoryId(link) {
    if (!knownHost(link.hostname)) { return null; }
    var path = String(link.pathname || '').replace(/\/+$/, '');
    var parts = path.split('/');
    var match = lastPathId.exec(parts[parts.length - 1] || '');
    var byPath = pathId(path);
    if (byPath && (!match || match[1] !== byPath)) { match = [null, byPath]; }
    if (!match || !Object.prototype.hasOwnProperty.call(data, match[1])) { return null; }
    /* page-number links (?page=2) point at the same category: never count them
       (perf 2026-11-17: checked after the cheap ID test, so product links never pay for closest()) */
    if (link.tagName && (/[?&]page=/i.test(String(link.search || '')) ||
        (link.closest && link.closest('.pagination, [class*="pagination"], [class*="paging"]')))) { return null; }
    return match[1];
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
    if (String(element.tagName).toUpperCase() === 'H1' && element.parentNode) {
      /* SEO (owner 2026-11-17): the count stays visible right after the heading but outside the <h1>, so the heading
         Google reads is just the category name; same font, same line */
      var cs = getComputedStyle(element), row = document.createElement('div');
      row.className = 'rr-h1row';
      row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:baseline;column-gap:.28em;margin:' + cs.marginTop + ' 0 ' + cs.marginBottom;
      element.parentNode.insertBefore(row, element);
      row.appendChild(element);
      element.style.setProperty('margin', '0', 'important');
      count.className = 'rr-category-count rr-h1-count';
      count.setAttribute('aria-hidden', 'true');
      ['fontSize', 'fontWeight', 'fontFamily', 'color', 'letterSpacing', 'textTransform', 'lineHeight'].forEach(function (k) { count.style[k] = cs[k]; });
      count.textContent = '[' + data[id][1] + ']';
      row.appendChild(count);
      element.setAttribute('data-rr-count-applied', '1');
      return;
    }
    element.appendChild(count);
    element.setAttribute('data-rr-count-applied', '1');
  }
  /* perf (owner 2026-11-15, older phones lagged): links already checked are skipped on later passes;
     the link identities and the still-unknown links are kept between passes. */
  var hrefIds = {}, pendingLinks = [];
  /* perf (2026-11-17, phone CPU profile: this block was ~0.5 s of a 6x-throttled load): links inside menus that are
     not on screen (the desktop menu on phones, the phone menu until it is opened) are labelled in small chunks
     while the browser is idle; opening the phone menu finishes them at once. Visible links are done right away. */
  var lazyQueue = [], lazyTimer = null;
  function lazyRoots() {
    var out = [], mob = document.getElementById('js-mobile-nav'), desk = document.getElementById('category-nav');
    if (mob && !/mm-menu--opened/.test(mob.className)) { out.push(mob); }
    if (desk && !desk.getClientRects().length) { out.push(desk); }
    return out;
  }
  function processLink(link, unresolved) {
    var resolved, urlKey, parts;
    link.__rrSeen = true;
    if (!knownHost(link.hostname)) { return; }
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
      return;
    }
    /* a numeric ID that is not a category (product pages): can never become one, so not kept for later passes */
    parts = String(link.pathname || '').replace(/\/+$/, '').split('/');
    if (!lastPathId.test(parts[parts.length - 1] || '')) { unresolved.push(link); }
  }
  function lazyStep(all) {
    lazyTimer = null;
    var n = all ? lazyQueue.length : 120, link;
    while (n-- > 0 && lazyQueue.length) {
      link = lazyQueue.shift();
      if (!link.__rrSeen) { processLink(link, pendingLinks); }
    }
    if (lazyQueue.length) { lazyLater(); } else {
      update(true);
      try { fixMobileMenu(); } catch (e) { /* the theme menu stays as it is */ }
    }
  }
  function lazyLater() {
    if (lazyTimer) { return; }
    lazyTimer = window.requestIdleCallback ? window.requestIdleCallback(function () { lazyStep(false); }, { timeout: 2500 })
      : window.setTimeout(function () { lazyStep(false); }, 60);
  }
  function lazyFlush() {
    if (!lazyQueue.length) { return; }
    if (lazyTimer && window.cancelIdleCallback && window.requestIdleCallback) { window.cancelIdleCallback(lazyTimer); }
    else if (lazyTimer) { window.clearTimeout(lazyTimer); }
    lazyTimer = null;
    lazyStep(true);
  }
  function update(noLazy) {
    var anchors = document.getElementsByTagName('a');
    var i, j, link, headings, currentId, urlKey, roots, inner;
    var unresolved = pendingLinks;
    if (!noLazy) {
      roots = lazyRoots();
      for (j = 0; j < roots.length; j += 1) {
        inner = roots[j].getElementsByTagName('a');
        for (i = 0; i < inner.length; i += 1) {
          if (!inner[i].__rrSeen && !inner[i].__rrLazy) { inner[i].__rrLazy = true; lazyQueue.push(inner[i]); }
        }
      }
      if (lazyQueue.length) { lazyLater(); }
    }
    /* Once a nested desktop link is safely identified, the mobile/flat copy
       with exactly the same host and path can inherit that identity. */
    for (i = 0; i < anchors.length; i += 1) {
      link = anchors[i];
      if (link.__rrSeen || (link.__rrLazy && !noLazy)) { continue; }
      processLink(link, unresolved);
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
    /* groups (owner 2026-11-17): fixed columns with a heading each; folders not listed go to the last column */
    '14130': { expand: [], extra: [], first: ['14454'], depth: 3, groups: [
      ['SZOBROK / DÍSZEK', ['14454', '18750']],
      ['OTTHON / LAKÁS', ['14460', '14451', '14469', '14445', '14151', '14409', '14283', '14478', '15276', '14748']],
      ['AJÁNDÉK / EGYÉB', ['14490', '14559', '14505', '18922', '14652', '14133', '20196', '20199']]] },
    '14025': { expand: [], extra: [], first: ['19518'], depth: 0 },
    /* ANIME (owner 2026-11-17): the anime folders in 3 columns like KIEGÉSZÍTŐK, most products first, Egyéb last */
    '20209': { expand: [], extra: [], first: [], depth: 0, sort: 'count' }
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
        if (cfg.sort === 'count') {
          var ex = /^egy[eé]b/i.test(data[x][0]) ? 1 : 0, ey = /^egy[eé]b/i.test(data[y][0]) ? 1 : 0;
          if (ex !== ey) { return ex - ey; }
          return (data[y][1] - data[x][1]) || (huKey(data[x][0]) < huKey(data[y][0]) ? -1 : 1);
        }
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
      if (cfg.groups) {
        /* fixed groups: heading, then its folders in the listed order; unlisted folders join the last group */
        var placed = {};
        for (i = 0; i < cfg.groups.length; i += 1) {
          columns[i].push({ heading: cfg.groups[i][0] });
          for (j = 0; j < cfg.groups[i][1].length; j += 1) {
            for (b = 0; b < blocks.length; b += 1) {
              if (blocks[b][0].id === cfg.groups[i][1][j]) {
                for (x = 0; x < blocks[b].length; x += 1) { columns[i].push(blocks[b][x]); }
                placed[b] = true;
              }
            }
          }
        }
        for (b = 0; b < blocks.length; b += 1) {
          if (!placed[b]) { for (x = 0; x < blocks[b].length; x += 1) { columns[cfg.groups.length - 1].push(blocks[b][x]); } }
        }
      } else {
        for (b = 0; b < blocks.length; b += 1) {
          var into = b < cut1 ? 0 : (b < cut2 ? 1 : 2);
          for (j = 0; j < blocks[b].length; j += 1) { columns[into].push(blocks[b][j]); }
        }
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
          if (e.heading) {  /* group heading (not a link) */
            item.textContent = e.heading;
            item.style.cssText = 'font-size:11px!important;letter-spacing:.08em;opacity:.6;margin:0 0 8px!important;font-weight:700';
            ul.appendChild(item);
            continue;
          }
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
    var mobNav = document.getElementById('js-mobile-nav');
    if (Observer && mobNav) {   /* phone menu opening (mmenu adds mm-menu--opened): finish its labels now */
      new Observer(function () { if (/mm-menu--opened/.test(mobNav.className)) { lazyFlush(); } })
        .observe(mobNav, { attributes: true, attributeFilter: ['class'] });
    }
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
  function isVoucher(el) {   /* the gift voucher's "size" is its value */
    var f = el.closest && el.closest('form'), i = f && f.querySelector('input[name="product_id"]');
    return !!(i && i.value === '246284');
  }

  function optionSelects(root) {
    return root ? Array.prototype.slice.call(root.querySelectorAll('select[name^="option["]')) : [];
  }
  /* add an empty first choice and select it, once per select */
  function addPlaceholder(select) {
    if (select.getAttribute('data-rr-placeholder')) { return; }
    select.setAttribute('data-rr-placeholder', '1');
    var opt = document.createElement('option');
    opt.value = '';
    opt.textContent = isVoucher(select) ? 'Válassz összeget' : PLACEHOLDER;
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
      p.appendChild(document.createTextNode(isVoucher(select) ? 'Kérjük, válassz összeget!' : WARNING));
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
   Free shipping from 30 000 Ft (GLS, as on the site); total = gross basket value (ShopRenter.cart). */
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
  function ft(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft'; }
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
    anchor = document.querySelector('.rr-social') || anchor;   /* below the photos + reviews slot (owner 2026-11-17) */
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
  ICON.clock = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
  var ROWS = [
    /* Experiment 3 (owner 2026-11-17): honest delivery time, the owner's own figures */
    ['clock', 'Raktárról 1-2 munkanap alatt nálad, beszerzéssel általában kb. 2 hét'],
    ['shop', 'Ingyenes személyes átvétel budapesti boltunkban'],
    ['truck', 'Ingyenes szállítás 30 000 Ft felett'],
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
      var total = ((document.querySelector('.rr-h1-count') || document.querySelector('h1') || {}).textContent || '').match(/\[(\d+)\]/);
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
   Links to it get the sort added when clicked. A sort the visitor picks in the list (price, name, ...) is always kept.
   2026-11-17 (SEO audit R3.2, owner "do everything"): the redirect on landing without a sort is switched off. Google
   followed it to the sorted URL, which Shoprenter marks "noindex, nofollow", so the category could drop out of Google.
   Menu clicks still open newest-first; to restore the landing redirect set LANDING = true. */
(function () {
  var LANDING = false;
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
    if (LANDING && isNew(location.pathname + location.search) && !/[?&]sort=/.test(location.search)) {
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
      s.textContent = 'Rólunk | Ragnarock webáruház';
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
    for (var i = 0; i < inputs.length; i++) {   /* owner 2026-11-16: just a faint dark-blue "Keresés" (English mode keeps "Search") */
      if (!inputs[i].hasAttribute('data-rr-hu')) { inputs[i].placeholder = 'Keresés'; }
    }
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

  function ft(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft'; }
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

  /* perf 2026-11-17: one formatter, and the answer is reused for 20 s (it was rebuilt on every call) */
  var budFmt = null, budLast = null, budAt = 0;
  function budapestNow() {
    var parts = {}, now = Date.now();
    if (budLast && now - budAt < 20000) { return budLast; }
    try {
      budFmt = budFmt || new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
      budFmt.formatToParts(new Date(now)).forEach(function (p) { parts[p.type] = p.value; });
    } catch (e) { var d = new Date(); return { ymd: d.toISOString().slice(0, 10), dow: d.getDay(), min: d.getHours() * 60 + d.getMinutes() }; }
    var dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
    budAt = now;
    budLast = { ymd: parts.year + '-' + parts.month + '-' + parts.day, dow: dow, min: (Number(parts.hour) % 24) * 60 + Number(parts.minute) };
    return budLast;
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
    '.rr-sticky .rr-st-size{flex:0 0 auto;max-width:92px;height:44px;padding:0 8px;background:#0b2236;color:#fff;border:1px solid rgba(127,196,234,.55);border-radius:4px;font-weight:700;font-size:14px}' +
    '.rr-sticky .rr-st-size.need{border-color:#e52421;box-shadow:0 0 0 2px rgba(229,36,33,.45)}' +
    '.rr-sticky.has-size{gap:8px;padding:10px 10px}.rr-sticky.has-size a{padding:12px 12px}' +
    '@media (max-width:420px){.rr-sticky.has-size img{display:none}}' +
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
      var isGift = !!card.querySelector('a[href$="-246284"]');   /* the gift voucher's options are amounts */
      s.innerHTML = '<option value="">' + (isGift ? 'Válassz összeget' : 'Válassz méretet') + ' (' + data.opts.length + ')</option>' +
        data.opts.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(isGift && o.x ? ft(Number(o.x.replace(/\D/g, ''))) : o.l + (o.x ? ' ' + o.x : '')) + '</option>'; }).join('');
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
    if (!box.querySelector('.warn')) { box.appendChild(el('div', 'warn', box.closest('.product-card') && box.closest('.product-card').querySelector('a[href$="-246284"]') ? 'Válassz összeget!' : 'Válassz méretet!')); }
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
  /* SEO 2026-11-17: when the band has its own page (/zenekarok/..., assets/seo/bandkeys.json from
     rockoff-upload/src/bandpages/bandkeys.py) the link goes there - an indexable page instead of the noindex search,
     ~23 000 product pages now link to the band pages - and the count comes from the menu-count file the browser has
     cached (no extra search request). Bands without a page keep the search link. */
  var BANDKEYS = 'https://1374223-star.github.io/rockpince-menu-counts/assets/seo/bandkeys.json';
  var COUNTS_JSON = 'https://1374223-star.github.io/rockpince-menu-counts/category_counts.json';
  function bandNorm(s) {   /* same as build.norm() in Python */
    s = String(s).replace(/&/g, ' and ').replace(/’/g, "'");
    if (s.normalize) { s = s.normalize('NFKD'); }
    s = s.replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\x00-\x7f]/g, '');
    s = s.replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, '');
    return s.replace(/^the /, '').replace(/ /g, '');
  }
  function getJson(url, cb) {
    var x = new XMLHttpRequest();
    x.open('GET', url);
    x.onload = function () { var d = null; try { d = JSON.parse(x.responseText); } catch (e) { /* none */ } cb(d); };
    x.onerror = function () { cb(null); };
    x.send();
  }
  function bandLink() {
    var h = document.querySelector('.product-page-middle h1, .product-page-top__row h1');
    if (!h || document.querySelector('.rr-band')) { return; }
    var band = h.textContent.split(' - ')[0].replace(/[™®]/g, '').replace(/\s+/g, ' ').trim();
    if (band.length < 2 || band.length > 40 || band === h.textContent.trim() || /^\d+$/.test(band)) { return; }
    var search = '/index.php?route=product/list&keyword=' + encodeURIComponent(band.toLowerCase());
    function put(href, n) {
      if (n < 2 || document.querySelector('.rr-band')) { return; }
      var a = el('a', 'rr-band', 'Még több ' + esc(band) + ' termék (' + n + ') &rarr;');
      a.href = href;
      h.parentNode.insertBefore(a, h.nextSibling);
    }
    getJson(BANDKEYS, function (keys) {
      var hit = keys && keys[bandNorm(band)];
      if (!hit) { searchCount(search, function (n) { put(search, n); }); return; }
      /* same URL as the category-count block, so it comes from the browser cache */
      getJson(COUNTS_JSON + '?v=' + Math.floor(new Date().getTime() / 600000), function (c) {
        var row = c && c.counts && c.counts[hit[1]];
        if (row && typeof row[1] === 'number') { put(hit[0], row[1]); }
        else { searchCount(search, function (n) { put(hit[0], n); }); }
      });
    });
  }
  function stickyBar() {
    var add = document.querySelector('.product-cart-box #add_to_cart');
    if (!add || document.querySelector('.rr-sticky')) { return; }
    var img = document.querySelector('.product-image__main img'), h = document.querySelector('h1');
    var bar = el('div', 'rr-sticky', '<img alt="" src="' + esc(img ? img.currentSrc || img.src : '') + '"><div class="t"><span>' +
      esc(h ? h.textContent.trim() : '') + '</span><b>' + ft(productPrice()) + '</b></div><a href="#">Kosárba</a>');
    document.body.appendChild(bar);
    /* Experiment 2 (owner 2026-11-17): the size picker right in the sticky bar, mirrored both ways with the real one */
    var realSel = document.querySelector('.product-cart-box select[name^="option["]'), mini = null;
    if (realSel) {
      mini = document.createElement('select');
      mini.className = 'rr-st-size';
      mini.setAttribute('aria-label', 'Méret');
      Array.prototype.forEach.call(realSel.options, function (o) {
        var c = document.createElement('option');
        c.value = o.value; c.disabled = o.disabled;
        c.textContent = o.value ? o.textContent.replace(/\s+/g, ' ').replace(/\s*\+.*$/, '').trim() : 'Méret';
        mini.appendChild(c);
      });
      mini.value = realSel.value;
      bar.insertBefore(mini, bar.querySelector('a'));
      bar.classList.add('has-size');
      mini.addEventListener('change', function () {
        realSel.value = mini.value;
        realSel.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.jQuery) { try { window.jQuery(realSel).trigger('change'); } catch (er) { /* */ } }
      });
      realSel.addEventListener('change', function () { if (mini.value !== realSel.value) { mini.value = realSel.value; } });
    }
    bar.querySelector('a').addEventListener('click', function (e) {
      e.preventDefault();
      try { if (window.gtag) { window.gtag('event', 'rr_exp_click', { rr_exp: 'sticky_add_to_cart' }); } } catch (er) { /* */ }
      var box = document.querySelector('.product-cart-box');
      var sel = box && box.querySelector('select[name^="option["]');
      if (sel && !sel.value) {
        if (mini) { try { mini.focus(); mini.showPicker && mini.showPicker(); } catch (er) { /* */ } mini.classList.add('need'); return; }
        sel.scrollIntoView({ block: 'center', behavior: 'smooth' }); try { sel.focus(); } catch (er) { /* */ } return;
      }
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
        '<h3>Mérettáblázat</h3><div style="color:#9cc7e3;font-size:13px">' + esc(name.trim()) + ', centiméterben</div></div>');
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
    /* same text; a tap leads to the gift finder (owner 2026-11-18) */
    bar.style.cursor = 'pointer'; bar.setAttribute('role', 'link'); bar.setAttribute('aria-label', 'Ajándékkereső');
    bar.addEventListener('click', function () { location.href = '/ajandekkereso'; });
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
    /* sit above the visible cookie bar (the first .nanobar is the hidden free-shipping bar; measuring that one put
       the toast over the "Elfogadom" button, which blocks consent and with it the Meta/TikTok pixels) */
    var bars = document.querySelectorAll('.nanobar, .nanobar-cookie-box');
    for (var bi = 0; bi < bars.length; bi++) {
      if (bars[bi].offsetHeight && getComputedStyle(bars[bi]).display !== 'none') { bottom = Math.max(bottom, bars[bi].offsetHeight + 12); }
    }
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
    /* it covered Kosárba and swallowed the tap (night test 2026-11-19): on product pages it waits for the next page */
    if (document.body.classList.contains('product-page-body')) { return; }
    ls.setItem('rr-first-visit', String(Date.now()));
    setTimeout(function () {
      toast('<b>Ingyenes személyes átvétel</b><div style="margin-top:6px;color:#9cc7e3">Budapesten, a boltunkban: 1146 Dózsa György út 19.<br>' +
        'Nyitva: hétfőtől péntekig 12-18, szombaton 10-14</div>', '#7fc4ea');
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
      var dot = function (x, y, r, a) { r = parseFloat(r);   /* r arrived as text: 'r + 0.6' made '1.50.6px', an invalid gradient, so phones had no snow */
        return 'radial-gradient(circle at ' + x + 'px ' + y + 'px, rgba(255,255,255,' + a + ') ' + r.toFixed(1) + 'px, transparent ' + (r + 0.7).toFixed(1) + 'px)'; };
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
      var nums = (price.textContent.match(/\d[\d.\s]*\s*Ft/g) || []).map(function (s) { return Number(s.replace(/\D/g, '')); }).filter(Boolean);
      if (nums.length >= 2) {
        var hi = Math.max.apply(null, nums);
        price.innerHTML = '<span class="snapshot-price snapshot-price--regular">' + String(hi).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft</span>';
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
  if (/checkout|kosar|^\/cart(?:[/?]|$)|route=account|success/i.test(path)) { return; }   /* the basket's address is /cart */
  var KEY = 'rr-nl-pop', DAY = 864e5;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  var force = location.hash === '#rr-nl';
  var st = {};
  try { st = JSON.parse(get(KEY) || '{}') || {}; } catch (e) { st = {}; }
  if (!force && st.done) { return; }
  /* owner 2026-11-18: in the 30 quiet days it does not open by itself, but the small -10% tab (assets/campaigns) can open it */
  var quiet = !force && st.shown && Date.now() - st.shown < 30 * DAY;
  if (!quiet) {
    st.views = (st.views || 0) + 1;
    if (!force) { set(KEY, JSON.stringify(st)); }
  }

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
    if (window.__rrNlOff || document.querySelector('.rr-nl-bg')) { return; }
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

  window.__rrNlOpen = open;
  if (force) { setTimeout(open, 600); return; }
  if (quiet) { return; }
  var AUTO = true;  /* owner 2026-11-15: coupon emails live, pop-up on (false: only #rr-nl opens it) */
  if (!AUTO) { return; }
  var touch = window.matchMedia && matchMedia('(hover: none)').matches;
  /* owner 2026-11-18: not too many popups, so it waits if an on-site message (assets/campaigns) was shown in the last 24 hours */
  function auto() {
    var c = {};
    try { c = (JSON.parse(get('rr-camp') || '{}') || {}).c || {}; } catch (e) { c = {}; }
    if (document.querySelector('.rrc') || Object.keys(c).some(function (k) { return Date.now() - c[k] < DAY; })) { return; }
    open();
  }
  if (touch) {
    if (st.views >= 2) { setTimeout(auto, 40000); }
  } else {
    var armedAt = Date.now() + 5000;
    document.addEventListener('mouseout', function leave(e) {
      if (e.relatedTarget || e.clientY > 8 || Date.now() < armedAt) { return; }
      document.removeEventListener('mouseout', leave);
      auto();
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
    '.rr-blogo:hover img{filter:brightness(1.3) drop-shadow(0 0 5px #7fc4ea) drop-shadow(0 0 12px rgba(56,168,240,1)) drop-shadow(0 0 20px rgba(56,168,240,.85))}}' +
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
      try { all = JSON.parse(x.responseText); } catch (e) { window.__rrBandsFailed = true; return; }
      if (all.length) { build(all); } else { window.__rrBandsFailed = true; }
    };
    x.onerror = function () { window.__rrBandsFailed = true; };  /* the early header's gap is let go at once */
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
  var RED = CHROME;  /* owner 2026-11-16: ÚJDONSÁG / AKCIÓ in the regular chrome too (was red) */
  var A = 'html body .module-category-wrapper li.module-list > a.nav-link';
  var css =
    A + ',' + A + ' .rr-category-count{font-family:"Barlow Condensed",Poppins,sans-serif!important;font-weight:700!important;' +
    /* 2026-11-17: 7 tabs since ANIME (was 1.27vw/25px, which overflowed the row at 1440 px) */
    'font-size:clamp(12px,1.12vw,22px)!important;letter-spacing:.03em!important;text-transform:uppercase!important;line-height:1.1!important;' +
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
      /* perf 2026-11-17: no getComputedStyle here (it forced a full style recalculation per link while icons were
         being inserted); RED is the regular chrome since 2026-11-16, the class is kept for the ÚJDONSÁG / AKCIÓ link */
      if (/akci/i.test(a.textContent)) { a.classList.add('rr-cat-red'); }
      var img = a.querySelector('img');
      if (!img && !a.querySelector('.rr-caticon') && a.parentNode && a.parentNode.id === 'cat_20209') {
        /* ANIME has no menu image in the shop: the Brand of Sacrifice glyph (owner 2026-11-17) */
        var ia = document.createElement('span');
        ia.className = 'rr-caticon';
        ia.setAttribute('aria-hidden', 'true');
        ia.style.setProperty('--m', 'url("' + ICONS + 'anime_brand.svg")');
        a.insertBefore(ia, a.firstChild);
        continue;
      }
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
    /* owner 2026-11-17: the home page keeps the old RagnaRock + RockPince duo logo for now (phone and desktop) */
    if (document.body && /home-body/.test(document.body.className)) {
      if (!document.getElementById('rr-duologo')) {
        var ds = document.createElement('style'); ds.id = 'rr-duologo';
        ds.textContent = '@media (min-width:992px){.home-body a.header-logo img{width:auto!important;height:auto!important;max-height:96px!important;max-width:150px!important}}' +
          /* phone: narrow enough to stay clear of the Mjölnir button beside the menu button */
          '@media (max-width:991px){.home-body a.header-logo img{max-width:min(196px,50vw)!important;width:auto!important;height:auto!important;max-height:84px!important}}';
        document.head.appendChild(ds);
      }
      /* 2026-11-17: the shop logo (also the Facebook share picture) is now the RagnaRock-only footer logo; the home
         header keeps showing the duo logo file, which is still on the server */
      [].forEach.call(imgs, function (im) {
        var s = im.currentSrc || im.src || '';
        if (/ragna-rock-logo-rock-pince-/.test(s) && !im.getAttribute('data-rr-logo')) {
          im.setAttribute('data-rr-logo', '1'); im.removeAttribute('srcset');
          im.src = 'https://rockpince.cdn.shoprenter.hu/custom/rockpince/image/cache/w336h230q100/design/ragnarock-rockpince-logo.png.webp';
        }
      });
      return imgs.length > 0;
    }
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i], src = im.currentSrc || im.src || '';
      if (im.getAttribute('data-rr-logo')) { continue; }
      if (/ragnarock-rockpince-logo|ragna-rock-logo-rock-pince-/.test(src)) { im.setAttribute('data-rr-logo', '1'); im.removeAttribute('srcset'); im.src = BRAND + 'ragnarock_logo.png'; im.style.height = 'auto';
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
    /* perf 2026-11-17: was getComputedStyle(main).position (forced a full style recalculation during load); the
       slider is position:relative already (Splide CSS), the rule below only makes sure */
    s.appendChild(document.createTextNode('#main-carousel{position:relative}'));
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
  var RED = CHROME;  /* owner 2026-11-16: ÚJDONSÁG / AKCIÓ in the regular chrome too (was red) */
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
        '<div class="ln">' + IC.clock + '<span>Hétfőtől péntekig 12-18 · Szombat 10-14 · Vasárnap zárva</span></div></div>' +
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
  if (!window.matchMedia) { return; }
  /* owner 2026-11-17: phones too, silent, the phone vibrates with the flashes instead of the thunder */
  var DESK = matchMedia('(hover:hover) and (pointer:fine) and (min-width:1200px)').matches, PHONE = matchMedia('(max-width:991px)').matches;
  if (!DESK && !PHONE) { return; }
  var SLOT = 62;   /* phone home: height of the hammer row under the second band strip */
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
    '.rr-mj.ph{position:absolute;left:56px;top:50%;margin:-20px 0 0;width:40px;height:40px;z-index:6}' +
    '.rr-mj.ph img{width:25px;height:auto}' +
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

  /* ---------- phone buzz (owner 2026-11-17: "no vibration"): Android vibrates through navigator.vibrate. iPhones have
     no web vibration at all, but toggling an iOS switch checkbox (<input type=checkbox switch>, iOS 17.4+) plays the
     system haptic tick, so a hidden one is clicked in step with the flashes. ---------- */
  var hapLabel = null;
  function hapTick() {
    try {
      if (!hapLabel) {
        hapLabel = document.createElement('label');
        hapLabel.setAttribute('aria-hidden', 'true');
        hapLabel.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0';
        var cb = document.createElement('input'); cb.type = 'checkbox'; cb.setAttribute('switch', ''); cb.tabIndex = -1;
        hapLabel.appendChild(cb); document.body.appendChild(hapLabel);
      }
      hapLabel.click();
    } catch (e) {}
  }
  function buzz() {
    if (navigator.vibrate) {
      try { if (navigator.vibrate([70, 50, 220, 90, 60, 70, 320, 160, 90, 120, 60, 220, 40, 90, 40])) { return; } } catch (e) {}
    }
    hapTick();   /* first tick inside the tap itself (iOS wants a user gesture), the rest follow the flashes */
    [60, 140, 200, 300, 420, 560, 700, 900, 1150].forEach(function (t) { setTimeout(hapTick, t); });
  }

  /* ---------- the storm: bolts strike all over the page, the page flashes white, then electricity races around ---------- */
  var busy = false;
  function strike(btn) {
    if (busy) { return; }
    busy = true;
    btn.classList.remove('charge'); void btn.offsetWidth; btn.classList.add('charge');
    if (DESK) { thunder(); }
    else { buzz(); }
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
    for (var r = 0; r < (PHONE ? 6 : 9); r++) {
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

  /* owner 2026-11-17: on the phone home page the hammer sits centred in its own short row under the second band strip
     (the strip/banner gaps stay as they were); every few seconds it wiggles and glows (transform/opacity only, so the
     compositor does it without repaints) so people see it is meant to be tapped */
  var phoneCss =
    '.rr-mj-slot{display:flex;justify-content:center;align-items:center;height:' + SLOT + 'px}' +
    '.rr-mj.ph.slot{position:relative;left:auto;top:auto;margin:0!important;width:50px;height:50px}' +
    '.rr-mj.ph.slot img{width:28px}' +
    '@keyframes rrMjNudge{0%,84%,100%{transform:rotate(0)}87%{transform:rotate(-16deg) scale(1.1)}90%{transform:rotate(12deg) scale(1.1)}93%{transform:rotate(-7deg) scale(1.05)}96%{transform:rotate(3deg)}}' +
    '@keyframes rrMjGlow{0%,82%,100%{opacity:0}89%{opacity:1}}' +
    '@media (prefers-reduced-motion:no-preference){' +
      '.rr-mj.ph img{animation:rrMjNudge 5s ease-in-out 1.5s infinite;transform-origin:50% 75%}' +
      '.rr-mj.ph::after{content:"";position:absolute;inset:-8px;border-radius:50%;pointer-events:none;opacity:0;' +
        'background:radial-gradient(circle,rgba(150,215,255,.6) 0%,rgba(110,190,245,.25) 45%,rgba(110,190,245,0) 70%);animation:rrMjGlow 5s ease-in-out 1.5s infinite}' +
      '.rr-mj.ph.charge img{animation:rrMjCharge .55s ease-in forwards}}';
  function mount() {
    var HOME = PHONE && (location.pathname === '/' || location.pathname === '/index.php');
    var bar = PHONE ? document.querySelector('.header-middle-row') : document.querySelector('.header-top-row .rr-social-top');
    var strip2 = HOME ? document.querySelector('.rr-bands2') : null;
    if (!bar || (HOME && !strip2)) { return false; }
    if (PHONE && !HOME && getComputedStyle(bar).position === 'static') { bar.style.position = 'relative'; }
    var st = document.createElement('style'); st.id = 'rr-mjolnir'; st.textContent = css + (PHONE ? phoneCss : ''); document.head.appendChild(st);
    var b = document.createElement('button');
    b.type = 'button'; b.className = PHONE ? 'rr-mj ph' + (HOME ? ' slot' : '') : 'rr-mj'; b.title = 'Mjölnir'; b.setAttribute('aria-label', 'Mjölnir'); b.innerHTML = HAMMER;
    b.addEventListener('click', function (ev) { ev.preventDefault(); strike(b); });
    if (HOME) {
      var slot = document.createElement('div'); slot.className = 'rr-mj-slot'; slot.appendChild(b);
      strip2.parentNode.insertBefore(slot, strip2.nextSibling);
      return true;
    }
    bar.appendChild(b);
    if (PHONE) {   /* other phone pages: beside the menu button, on its centre line (absolute, so the logo stays centred) */
      var br = bar.getBoundingClientRect(), first = null;
      [].forEach.call(bar.children, function (e) { var r = e.getBoundingClientRect(); if (e !== b && r.width > 0 && (!first || r.left < first.left)) { first = r; } });
      if (first) { b.style.margin = '0'; b.style.top = Math.round(first.top - br.top + first.height / 2 - 20) + 'px'; b.style.left = Math.round(first.right - br.left + 6) + 'px'; }
    }
    return true;
  }
  var tries = 0;
  (function wait() { if (!mount() && tries++ < 60) { setTimeout(wait, 200); } })();
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
        '<table><tr><td>Hétfőtől péntekig</td><td>12:00-18:00</td></tr><tr><td>Szombat</td><td>10:00-14:00</td></tr>' +
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
      /* owner 2026-11-17: blocks against both edges, the social block always the same distance from the two others */
      '.header-top-row{display:grid!important;grid-template-columns:auto minmax(18px,1fr) auto minmax(18px,1fr) auto;align-items:center;column-gap:0}' +
      '.header-top-row .rr-open{display:none!important}' +
      '.header-top-row > *{grid-row:1}' +
      '.rr-tl{display:flex;align-items:center;gap:10px;justify-self:start;grid-column:1}' +
      '.rr-tl .rr-mailtop{margin:0!important}' +
      '.header-top-row .rr-social-top{grid-column:3;justify-self:center;margin:0!important;display:flex!important;align-items:center;gap:10px}' +
      '.header-top-row .headermenu-list{grid-column:5;justify-self:end;margin:0;display:flex!important;flex-wrap:nowrap;white-space:nowrap;gap:0}' +
      /* the five page links closer together */
      '.header-top-row .headermenu-list > li{margin:0!important;padding:0!important}' +
      '.header-top-row .headermenu-list .nav-link{padding-left:9px!important;padding-right:9px!important}' +
      '.header-top-row .headermenu-list{padding:0!important}' +
      '.header-top-row .headermenu-list > li:first-child .nav-link{padding-left:0!important}' +
      '.header-top-row .headermenu-list > li:last-child .nav-link{padding-right:0!important}' +
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
    /* owner 2026-11-17: both gaps about 30% smaller (24px -> 17px) */
    '.section-wrapper:has(+ .rr-bands2){margin-top:17px!important;margin-bottom:17px!important}' +
    '.rr-bands2{margin-top:-7px!important}';   /* the banner's hidden thumbnail row adds 7px under it */
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

/* Cart box (owner 2026-11-17, replaces the full-height side panel: "too big and clunky"), desktop: hovering the
   basket drops a small box down from it, like the Kedvencek dropdown, with what is in the cart (photo, name, size,
   price), the total, how much is left to free shipping and a button to the cart. While the cart has items, a small
   tab on the right edge shows the same box beside it on hover. Nothing shows for an empty cart. The items come from
   the cart page's own data (document.aurora.initialState), fetched on first hover and again only when the count changes. */
(function () {
  if (window.__rrCartPanel) { return; }
  window.__rrCartPanel = true;
  if (!window.matchMedia || !matchMedia('(min-width:992px) and (hover:hover)').matches) { return; }
  if (/checkout/.test(location.search + location.pathname)) { return; }
  var FREE = 30000, CART = '/index.php?route=checkout/cart';
  var css =
    '.header-middle-right-wrapper{overflow:visible!important}' +
    /* the theme's own little cart hover box opened to the right, off the screen: this box replaces it */
    '#js-cart .cart-dropdown > :not(.cart-dropdown-toggle),#js-cart .dropdown-menu{display:none!important}' +
    /* the wishlist dropdown opens downwards, inside the screen, instead of to the right */
    '#header-middle-wishlist .dropdown-menu{left:auto!important;right:0!important;top:calc(100% + 8px)!important;bottom:auto!important;transform:none!important;margin:0!important}' +
    '.header-middle-right-wrapper > .header-middle-right-box:first-child{border-radius:7px 0 0 7px}' +
    '.header-middle-right-wrapper > .header-middle-right-box:last-child{border-radius:0 7px 7px 0}' +
    '#js-cart .header-quantity-box{position:absolute!important;top:3px!important;right:5px!important;left:auto!important;min-width:18px;height:18px;line-height:18px;padding:0 4px;' +
      'border-radius:9px;background:#e52421!important;color:#fff!important;font-size:11px;font-weight:700;text-align:center;box-shadow:0 0 0 2px #031627}' +
    '.rr-cb{position:fixed;z-index:2147483000;width:330px;display:none;flex-direction:column;background:#06243b;border:1px solid rgba(127,196,234,.55);' +
      'border-radius:10px;box-shadow:0 14px 34px rgba(0,0,0,.55);color:#c4d2df;font-family:Poppins,sans-serif;overflow:hidden}' +
    '.rr-cb.open{display:flex;animation:rrCbIn .14s ease-out}' +
    '@keyframes rrCbIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}' +
    '.rr-cb.side.open{animation-name:rrCbSide}@keyframes rrCbSide{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:none}}' +
    '.rr-cb .hd{padding:11px 14px 9px;color:#fff;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid rgba(127,196,234,.2)}' +
    '.rr-cb .list{max-height:258px;overflow:auto;padding:0 14px}' +
    '.rr-cb .it{display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(127,196,234,.12);text-decoration:none!important}' +
    '.rr-cb .it:last-child{border-bottom:0}' +
    '.rr-cb .it img{width:46px;height:46px;object-fit:contain;background:#fff;border-radius:5px;flex:none}' +
    '.rr-cb .it > div{min-width:0;flex:1}' +
    '.rr-cb .nm{color:#e6f3fb;font-size:12.5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
    '.rr-cb .it:hover .nm{color:#fff;text-decoration:underline}' +
    '.rr-cb .op{color:#9fd6f7;font-size:11.5px}' +
    '.rr-cb .pr{flex:none;color:#fff;font-weight:700;font-size:13px;white-space:nowrap;text-align:right}' +
    '.rr-cb .pr small{display:block;color:#9fb3c6;font-weight:400;font-size:11px}' +
    '.rr-cb .foot{padding:10px 14px 13px;border-top:1px solid rgba(127,196,234,.25);background:rgba(2,10,20,.45)}' +
    '.rr-cb .sum{display:flex;justify-content:space-between;color:#fff;font-size:14.5px;font-weight:800;margin-bottom:6px}' +
    '.rr-cb .free{font-size:11.5px;margin-bottom:5px}.rr-cb .free b{color:#fff}' +
    '.rr-cb .bar{height:4px;border-radius:2px;background:rgba(127,196,234,.15);overflow:hidden;margin-bottom:10px}' +
    '.rr-cb .bar i{display:block;height:100%;background:linear-gradient(90deg,#e52421,#ff6a63)}' +
    '.rr-cb .bar.ok i{background:linear-gradient(90deg,#1f9d4a,#34d06a)}' +
    '.rr-cb .go{display:block;text-align:center;padding:9px;border-radius:6px;background:#e52421;color:#fff!important;font-size:13px;font-weight:800;text-decoration:none!important;text-transform:uppercase;letter-spacing:.04em}' +
    '.rr-cb .go:hover{background:#ff3a36}' +
    '.rr-cb .tier{font-size:12px;line-height:1.45;color:#c9d8e6;margin:0 0 10px}.rr-cb .tier:empty{display:none}.rr-cb .tier b{color:#fff}' +
    '.rr-cb .tier a{color:#9fd6f7!important;text-decoration:underline!important}.rr-cb .tier .rr-gem{margin:-3px 3px 0 0}' +
    '.rr-cp-tab{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147482999;display:none;flex-direction:column;align-items:center;gap:4px;' +
      'padding:12px 9px;border-radius:10px 0 0 10px;background:linear-gradient(180deg,#14659c,#0a3a5e);border:1px solid rgba(127,196,234,.6);border-right:0;' +
      'color:#fff;font-weight:800;font-size:13px;cursor:pointer;box-shadow:-6px 0 18px rgba(0,0,0,.4)}' +
    '.rr-cp-tab.on{display:flex}.rr-cp-tab svg{width:22px;height:22px}';
  var st = document.createElement('style'); st.id = 'rr-cartpanel'; st.textContent = css; (document.head || document.documentElement).appendChild(st);

  var box, tab, cart, data = null, dataCount = -1, closeT = null, want = null;
  function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft'; }
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
    var items = data || [], total = 0, html = '', pcs = 0;
    items.forEach(function (i) {
      total += i.totalNumber || 0; pcs += i.quantity || 1;
      var opt = (i.option || []).map(function (o) { return esc(o.value || o.name); }).filter(Boolean).join(', ');
      html += '<a class="it" href="' + esc(i.href) + '"><img src="' + esc(i.imageUrl) + '" alt="" loading="lazy"><div>' +
        '<div class="nm">' + esc((i.name || '').trim()) + '</div>' + (opt ? '<div class="op">' + opt + '</div>' : '') + '</div>' +
        '<div class="pr">' + fmt(i.totalNumber || 0) + (i.quantity > 1 ? '<small>' + i.quantity + ' db</small>' : '') + '</div></a>';
    });
    var left = Math.max(0, FREE - total), pct = Math.min(100, total / FREE * 100);
    box.querySelector('.hd').textContent = 'Kosár (' + pcs + ' termék)';
    box.querySelector('.list').innerHTML = html;
    box.querySelector('.sum').innerHTML = '<span>Összesen</span><span>' + fmt(total) + '</span>';
    box.querySelector('.free').innerHTML = left ? 'Még <b>' + fmt(left) + '</b> és ingyenes a szállítás!' : '<b>Ingyenes szállítás</b> erre a rendelésre!';
    var bar = box.querySelector('.bar'); bar.className = 'bar' + (left ? '' : ' ok'); bar.firstChild.style.width = pct + '%';
    var tl = box.querySelector('.tier');   /* Hűségszintek (owner 2026-11-17): points and level for this basket */
    if (tl && window.RRTIER) {
      tl.innerHTML = RRTIER.summary(total, RRTIER.me());
      RRTIER.get(function (m) { if (m) { tl.innerHTML = RRTIER.summary(total, m); } });
    }
    return items.length > 0;
  }
  function place(from) {
    if (from === 'tab') {
      var t = tab.getBoundingClientRect();
      box.classList.add('side'); box.style.right = (innerWidth - t.left + 8) + 'px'; box.style.left = 'auto';
      box.style.top = Math.max(10, Math.min(innerHeight - box.offsetHeight - 10, t.top + t.height / 2 - box.offsetHeight / 2)) + 'px';
    } else {
      var a = (cart.closest('.header-middle-right-wrapper') || cart).getBoundingClientRect(), c = cart.getBoundingClientRect();
      box.classList.remove('side'); box.style.left = 'auto';
      box.style.right = Math.max(8, innerWidth - c.right) + 'px'; box.style.top = (a.bottom + 8) + 'px';
    }
  }
  function open(from) {
    clearTimeout(closeT); want = from;
    if (count() < 1) { box.classList.remove('open'); return; }
    load(function () {
      if (want !== from) { return; }
      if (!render()) { box.classList.remove('open'); return; }
      box.classList.add('open'); place(from);
    });
  }
  function later() { clearTimeout(closeT); closeT = setTimeout(function () { want = null; box.classList.remove('open'); }, 300); }
  function build() {
    cart = document.getElementById('js-cart');
    if (!cart || !document.body) { return false; }
    box = document.createElement('div'); box.className = 'rr-cb'; box.setAttribute('aria-label', 'Kosár tartalma');
    box.innerHTML = '<div class="hd">Kosár</div><div class="list"></div>' +
      '<div class="foot"><div class="sum"></div><div class="free"></div><div class="bar"><i></i></div><div class="tier"></div><a class="go" href="' + CART + '">Tovább a kosárhoz</a></div>';
    document.body.appendChild(box);
    tab = document.createElement('a'); tab.href = CART; tab.className = 'rr-cp-tab'; tab.setAttribute('aria-label', 'Kosár');
    document.body.appendChild(tab);
    cart.addEventListener('mouseenter', function () { open('cart'); }); cart.addEventListener('mouseleave', later);
    tab.addEventListener('mouseenter', function () { open('tab'); }); tab.addEventListener('mouseleave', later);
    box.addEventListener('mouseenter', function () { clearTimeout(closeT); }); box.addEventListener('mouseleave', later);
    /* the "Hűségszintek" link in the tier line opens the levels window (owner 2026-11-17: it "lead me nowhere") */
    box.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-rrt]');
      if (t && window.RRTIER) { e.preventDefault(); want = null; box.classList.remove('open'); RRTIER.open(); }
    });
    addEventListener('scroll', function () { if (box.classList.contains('open') && want === 'cart') { want = null; box.classList.remove('open'); } }, { passive: true });
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

/* Owner feedback 2026-11-17:
   - RagnaRock page: its theme column kept a 25% empty side column, so the content sat left; full width + centred now.
   - "Utoljára megtekintett termékek" heading was black (unreadable) on the info pages.
   - Pinterest "Mentés" / Facebook "Megosztás" buttons hidden everywhere (info pages had them under the content).
   - Product page: "Küldd el egy barátodnak" buttons under the photo - Messenger, Instagram, TikTok. Phones open the
     Messenger app directly, and the phone's own share window for Instagram / TikTok (neither has a share link). Desktop
     copies the product link and opens that site's inbox to paste it in. */
(function () {
  if (window.__rrFb17) { return; }
  window.__rrFb17 = true;
  var st = document.createElement('style'); st.id = 'rr-fb17';
  st.textContent =
    '.information-page-body section.column-content{flex:0 0 100%!important;max-width:100%!important}' +
    '#lastseen .module-head-title,#lastseen .module-head .h2{color:#fff!important;-webkit-text-fill-color:#fff!important}' +
    '.social-share-module,.information__social-share-module,.pinterest-share,.fb-share-button,#socail-media,[class*="PIN_"][class*="_button_pin"]{display:none!important}' +
    '.rr-send{margin:14px 0 4px;text-align:center}' +
    '.rr-send .lb{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9fd6f7;margin-bottom:8px}' +
    '.rr-send .bt{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}' +
    '.rr-send button{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:19px;border:1px solid rgba(127,196,234,.5);' +
      'background:rgba(6,36,59,.85);color:#e6f3fb;font:600 13px Poppins,sans-serif;cursor:pointer;transition:background .15s,border-color .15s}' +
    '.rr-send button:hover{background:#0e4d78;border-color:#9fd6f7}' +
    '.rr-send svg{width:18px;height:18px;flex:none}' +
    '@media (max-width:480px){.rr-send .bt{gap:6px;flex-wrap:nowrap}.rr-send button{height:36px;padding:0 10px;font-size:12px;gap:5px}.rr-send svg{width:16px;height:16px}}' +
    '.rr-send-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:2147483600;padding:10px 16px;border-radius:8px;' +
      'background:#06243b;border:1px solid rgba(127,196,234,.6);color:#fff;font:600 13px Poppins,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.5)}';
  (document.head || document.documentElement).appendChild(st);

  if (!/product-page-body/.test(document.body ? document.body.className : '')) { return; }
  var TOUCH = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  var IC = {
    m: '<svg viewBox="0 0 24 24"><path fill="#4aa8ff" d="M12 2C6.4 2 2 6.1 2 11.6c0 2.9 1.2 5.4 3.2 7.1V22l2.9-1.6c1.2.3 2.5.5 3.9.5 5.6 0 10-4.1 10-9.4S17.6 2 12 2z"/><path fill="#fff" d="m5.9 14.6 3-4.7 2.6 2 3.3-2 -3 4.7-2.5-2z"/></svg>',
    i: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff6fae" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="#ff6fae"/></svg>',
    t: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.3 6.3 0 1 0 5.3 6.2V8.6a7.7 7.7 0 0 0 4.4 1.4V6.7A4.4 4.4 0 0 1 16.6 2z"/></svg>'
  };
  function link() { var c = document.querySelector('link[rel=canonical]'); return (c && c.href) || location.href.split('#')[0]; }
  function title() { var h = document.querySelector('h1'); return h ? h.textContent.trim() : document.title; }
  function toast(t) {
    var d = document.createElement('div'); d.className = 'rr-send-toast'; d.textContent = t; document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 3200);
  }
  function copyOpen(site) {
    var u = link(), w = window.open(site, '_blank', 'noopener');
    function done() { toast('Link kimásolva - illeszd be az üzenetbe'); }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(u).then(done, function () { prompt('Másold ki a linket:', u); }); }
    else { prompt('Másold ki a linket:', u); }
    return w;
  }
  /* owner 2026-11-18: on phones the button must lead to sending the product to a friend, like Messenger. Instagram and
     TikTok have no public link that opens their "send to" screen, so the phone's own share window opens with the product
     link attached: pick the app, then the friend. The link is copied as well, in case the app is not in that list.
     Where the share window does not exist (in-app browsers), the link is copied and the app's messages screen opens. */
  function share(site, hint) {
    if (!TOUCH) { copyOpen(site); return; }
    var u = link(), data = { title: title(), url: u };
    function inbox() {
      function go() { toast('Link kimásolva - illeszd be az üzenetbe'); setTimeout(function () { location.href = site; }, 900); }
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(u).then(go, function () { prompt('Másold ki a linket:', u); }); }
      else { prompt('Másold ki a linket:', u); }
    }
    if (!navigator.share || (navigator.canShare && !navigator.canShare(data))) { inbox(); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(u).catch(function () {}); }
    toast(hint);
    navigator.share(data).catch(function (e) { if (!e || e.name !== 'AbortError') { inbox(); } });
  }
  var ACT = {
    m: function () {
      if (TOUCH) { location.href = 'fb-messenger://share/?link=' + encodeURIComponent(link()); return; }
      copyOpen('https://www.messenger.com/');
    },
    i: function () { share('https://www.instagram.com/direct/inbox/', 'Válaszd az Instagramot, majd a barátodat'); },
    t: function () { share('https://www.tiktok.com/messages', 'Válaszd a TikTokot, majd a barátodat'); }
  };
  function mount() {
    var img = document.getElementById('product-image');
    if (!img) { return false; }
    if (document.querySelector('.rr-send')) { return true; }
    var box = document.createElement('div'); box.className = 'rr-send';
    box.innerHTML = '<div class="lb">Küldd el egy barátodnak</div><div class="bt">' +
      '<button type="button" data-k="m">' + IC.m + 'Messenger</button>' +
      '<button type="button" data-k="i">' + IC.i + 'Instagram</button>' +
      '<button type="button" data-k="t">' + IC.t + 'TikTok</button></div>';
    box.addEventListener('click', function (e) { var b = e.target.closest('button[data-k]'); if (b) { e.preventDefault(); ACT[b.getAttribute('data-k')](); } });
    img.parentNode.insertBefore(box, img.nextSibling);
    return true;
  }
  var tries = 0;
  (function wait() { if (!mount() && tries++ < 40) { setTimeout(wait, 250); } })();
})();

/* Browser translation helpers (owner 2026-11-17: "fix the translation stuff, even things like KERESÉS"). The shop is
   Hungarian only; foreign visitors use Chrome/Google page translation. When a page is shown translated (Google adds
   translated-ltr/-rtl to <html> and sets its lang to the target language):
   - the search box placeholder (an attribute Google does not touch) is set in that language, and restored after;
   - in English, known machine-translation mistakes are corrected in the translated text and the tab title
     ("Disztárgy" -> "Disobject", "Magyar zenekarok" -> "Hungarian orchestra", "Üzletünk" -> "Our business",
     "Rockpince" -> "Rock Cellar", ...). Only the translated copy is touched, so "show original" brings the Hungarian
     back untouched. Nothing at all runs for visitors who do not translate. */
(function () {
  if (window.__rrTranslate) { return; }
  window.__rrTranslate = true;
  var SEARCH = { en: 'Search', de: 'Suche', fr: 'Rechercher', it: 'Cerca', es: 'Buscar', pt: 'Pesquisar', nl: 'Zoeken', pl: 'Szukaj',
    cs: 'Hledat', sk: 'Hľadať', sl: 'Iskanje', hr: 'Traži', sr: 'Pretraga', ro: 'Căutare', bg: 'Търсене', uk: 'Пошук', ru: 'Поиск',
    sv: 'Sök', da: 'Søg', no: 'Søk', nb: 'Søk', fi: 'Haku', el: 'Αναζήτηση', tr: 'Ara', ja: '検索', zh: '搜索', ko: '검색' };
  var FIX_EN = [   /* [pattern, replacement] on the English output; case of the original is kept */
    [/\bdis ?objects?\b/gi, 'Decor & Gifts'],
    [/\bdisplay objects?\b/gi, 'Decor & Gifts'],
    [/\bdecorative objects?\b/gi, 'Decor & Gifts'],
    [/\bhungarian orchestras?\b/gi, 'Hungarian bands'],   /* only this one: real band names contain "Orchestra" */
    [/\bband and other clothes\b/gi, 'Band merch & other clothing'],
    [/\bour business\b/gi, 'Our store'],
    [/\brock cellar\b/gi, 'RockPince'],
    [/\brock basement\b/gi, 'RockPince'],
    [/\bblack beard\b/gi, 'Barba Negra'],   /* the concert venue's name */
    /* owner's screenshots 2026-11-17 */
    [/\bnew ?\/ ?action\b/gi, 'New / Sale'],
    [/\bnews ?\/ ?sales\b/gi, 'New / Sale'],
    [/\balternative clothes\b/gi, 'Alternative clothing'],
    [/\bour discounted offers?\b/gi, 'On sale'],
    [/\bour discount offers?\b/gi, 'On sale'],
    [/\bour special offers\b/gi, 'On sale'],
    [/\brandomly from our offer\b/gi, 'Random picks'],
    [/\blast viewed products\b/gi, 'Recently viewed'],
    [/\ball new\b(?! arrivals)/gi, 'All new arrivals'],
    [/\bthe coupon, please\b/gi, 'Get my coupon'],
    [/\babout business\b/gi, 'About the store'],
    [/\bable information\b/gi, 'Illustrated guide'],
    [/\bI'll put it on my wish ?list\b/gi, 'Add to wishlist'],
    [/\bsmall sewing machine\b/gi, 'small patch'],
    [/\bsmall seamstress\b/gi, 'small patch'],
    [/\bbackstitcher\b/gi, 'back patch'],
    [/\bseamstress\b/gi, 'patch'],
    [/\bsteel-lined\b/gi, 'steel toe'],
    [/\bsteel lined\b/gi, 'steel toe'],
    [/\b(\d{1,2})[- ]holes?\b/gi, '$1-eyelet'],
    [/\bXIV\. circ\./g, 'XIV. district,'],
    [/\bWED (10:00 ?- ?2:00 PM)/g, 'SAT $1'],
    [/\bredemption\b/gi, 'Apply'],
    [/\bgross total\b/gi, 'Total'],
    [/^availability$/gi, 'Contact details'],
    [/\bI buy as a company\b/gi, "I'm buying as a company"],
    /* owner 2026-11-16: "ZENEKAROS" came back as "BANDED", "EGYÉB MINTÁS" as "OTHER PATTERNED" */
    [/\bbanded\b/gi, 'Band merch'],
    [/\bother patterned\b/gi, 'Other designs']
  ];
  /* "Még <b>X Ft</b> és <b>ingyenes</b> a szállítás!" comes back as "Even X and free the delivery!" in pieces */
  function fixShipLines() {
    [].forEach.call(document.querySelectorAll('b, strong'), function (b) {
      var box = b.parentElement;
      if (!box || box.__rrShipFixed || (box.textContent || '').length > 160) { return; }
      if (!/\beven\b[\s\S]*\band\b[\s\S]*\bfree\b[\s\S]*\bdelivery\b/i.test(box.textContent)) { return; }
      var w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) {
        if (n.parentElement && n.parentElement.closest('.bar')) { continue; }
        var v = n.nodeValue;
        if (/^\s*even\s*$/i.test(v)) { n.nodeValue = keepCase(v.trim(), 'Only') + ' '; }
        else if (/^\s*and\s*$/i.test(v)) { n.nodeValue = ' ' + keepCase(v.trim(), 'more for') + ' '; }
        else if (/^\s*the delivery!?\s*$/i.test(v)) { n.nodeValue = ' ' + keepCase(v.trim(), 'delivery!'); }
      }
      box.__rrShipFixed = true;
    });
  }
  /* Hungarian text Google leaves as it is (lazy carousel cards, <option> labels), English only, exact matches */
  var LEFT_EN = { 'MÉRET': 'SIZE', 'Méret': 'Size', 'méret': 'size', 'VILLÁMNÉZET': 'QUICK VIEW', 'Villámnézet': 'Quick view',
    'Kívánságlistára teszem': 'Add to wishlist', 'KOSÁRBA': 'ADD TO CART', 'Kosárba': 'Add to cart', 'ÚJ TERMÉK': 'NEW', 'Új termék': 'New',
    'Válassz méretet': 'Choose size', 'VÁLASSZ MÉRETET': 'CHOOSE SIZE', 'Méret választás': 'Choose size',
    'DIST': 'DECOR & GIFTS', 'Dist': 'Decor & Gifts', 'Törlés': 'Remove', 'TÖRLÉS': 'REMOVE', 'DELETION': 'REMOVE', 'Deletion': 'Remove',
    'Magyarország': 'Hungary' };
  var LEFT_RE = [[/^(Válassz méretet|VÁLASSZ MÉRETET)(\s*\(\d+\))$/, function (m, a, c) { return (a === a.toUpperCase() ? 'CHOOSE SIZE' : 'Choose size') + c; }],
    [/^DIST(\s*\[\d+\])$/, 'DECOR & GIFTS$1']];
  var PH_EN = { 'Vezetéknév': 'Last name', 'Keresztnév': 'First name', 'E-mail cím': 'Email address', 'E-mail': 'Email', 'Jelszó': 'Password' };
  function lang() { return String(document.documentElement.lang || '').toLowerCase().split('-')[0]; }
  function active() { return /\btranslated-(ltr|rtl)\b/.test(document.documentElement.className) && lang() && lang() !== 'hu'; }
  function keepCase(src, rep) {
    if (src === src.toUpperCase() && /[A-Z]/.test(src)) { return rep.toUpperCase(); }
    if (src.charAt(0) === src.charAt(0).toUpperCase()) { return rep.charAt(0).toUpperCase() + rep.slice(1); }
    return rep.charAt(0).toLowerCase() + rep.slice(1);
  }
  function fixText(s) {
    var out = s;
    for (var i = 0; i < FIX_EN.length; i++) {
      var re = FIX_EN[i][0], one = new RegExp(re.source, re.flags.replace('g', ''));
      out = out.replace(re, function (m) { return keepCase(m, m.replace(one, FIX_EN[i][1])); });   /* keeps $1 groups working */
    }
    return out;
  }
  function placeholders(on) {
    var inputs = document.querySelectorAll('.header input[type="text"], .header input[type="search"], #js-mobile-nav input[type="text"]');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (on) {
        if (!el.hasAttribute('data-rr-ph')) { el.setAttribute('data-rr-ph', el.placeholder || ''); }
        el.placeholder = SEARCH[lang()] || SEARCH.en;
      } else if (el.hasAttribute('data-rr-ph')) { el.placeholder = el.getAttribute('data-rr-ph'); el.removeAttribute('data-rr-ph'); }
    }
    if (!on) {   /* the form fields renamed in English */
      [].forEach.call(document.querySelectorAll('input[data-rr-ph]'), function (el) { el.placeholder = el.getAttribute('data-rr-ph'); el.removeAttribute('data-rr-ph'); });
    }
  }
  var timer = null, bodyObs = null, fixing = false, swapped = [], swappedOpt = [];
  function sweep() {
    timer = null;
    if (!active()) { return; }
    placeholders(true);
    if (lang() !== 'en') { return; }
    fixing = true;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      var v = n.nodeValue;
      if (!v || v.length < 3) { continue; }
      var k = v.trim();
      if (LEFT_EN[k]) { if (n.__rrOrig == null) { n.__rrOrig = v; swapped.push(n); } n.nodeValue = v.replace(k, LEFT_EN[k]); continue; }
      var hit = false;
      for (var j = 0; j < LEFT_RE.length; j++) {
        if (LEFT_RE[j][0].test(k)) { if (n.__rrOrig == null) { n.__rrOrig = v; swapped.push(n); } n.nodeValue = v.replace(k, k.replace(LEFT_RE[j][0], LEFT_RE[j][1])); hit = true; break; }
      }
      if (hit) { continue; }
      if (/[a-z]/i.test(v)) { var f = fixText(v); if (f !== v) { n.nodeValue = f; } }
    }
    [].forEach.call(document.querySelectorAll('input[placeholder]'), function (el) {
      var o = el.getAttribute('data-rr-ph') != null ? el.getAttribute('data-rr-ph') : el.placeholder;
      if (PH_EN[o]) { if (el.getAttribute('data-rr-ph') == null) { el.setAttribute('data-rr-ph', o); } el.placeholder = PH_EN[o]; }
    });
    fixShipLines();
    [].forEach.call(document.querySelectorAll('option'), function (o) {   /* <option> text is not reached by the walker fix for "DIST" etc. */
      var k = o.textContent.trim();
      for (var j = 0; j < LEFT_RE.length; j++) { if (LEFT_RE[j][0].test(k)) { if (o.__rrOrig == null) { o.__rrOrig = o.textContent; swappedOpt.push(o); } o.textContent = k.replace(LEFT_RE[j][0], LEFT_RE[j][1]); } }
    });
    var t = fixText(document.title); if (t !== document.title) { document.title = t; }
    fixing = false;
  }
  function later() { if (!fixing && !timer) { timer = setTimeout(sweep, 350); } }
  function update() {
    if (active()) {
      later();
      if (!bodyObs && window.MutationObserver && document.body) {
        bodyObs = new MutationObserver(later);
        bodyObs.observe(document.body, { childList: true, subtree: true, characterData: true });
      }
    } else {
      if (bodyObs) { bodyObs.disconnect(); bodyObs = null; }
      placeholders(false);
      swapped.forEach(function (n) { if (n.__rrOrig != null) { n.nodeValue = n.__rrOrig; n.__rrOrig = null; } });   /* Google only restores what it translated */
      swapped = [];
      swappedOpt.forEach(function (o) { if (o.__rrOrig != null) { o.textContent = o.__rrOrig; o.__rrOrig = null; } });
      swappedOpt = [];
    }
  }
  if (window.MutationObserver) {
    new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'lang'] });
  }
  update();
  /* footer opening hours "[H-P 12:00-18:00, SZ 10:00-14:00]": "SZ" is also Wednesday (szerda), translators said WED */
  var fTries = 0;
  (function footerDays() {
    var f = document.querySelector('footer');
    if (!f) { if (fTries++ < 30) { setTimeout(footerDays, 500); } return; }
    var w = document.createTreeWalker(f, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { if (/\bSZ \d{1,2}:\d{2}/.test(n.nodeValue)) { n.nodeValue = n.nodeValue.replace(/\bSZ (\d{1,2}:\d{2})/g, 'Szo $1'); } }
  })();
})();

/* Display-only EUR prices (owner 2026-11-17). Visitors whose browser is not Hungarian (no Hungarian language and a
   time zone other than Budapest) see prices converted to EUR at the daily ECB rate (assets/eur.json, refreshed by a
   GitHub Action, so no outside service sees the visitor). A small Ft / € switch on the left edge flips it either way
   and is remembered. Checkout and cart pages always show forints, because that is what the card is charged.
   Only text that reads "<number> Ft" or "<number> HUF" changes; the original text is kept and put back on switching. */
(function () {
  if (window.__rrEur) { return; }
  window.__rrEur = true;
  return;   /* owner 2026-11-16: switched off on rockpince.hu (99% Hungarian customers; EU shop planned on its own domain). Kept for reuse. */
  var RATE_URL = 'https://1374223-star.github.io/rockpince-menu-counts/assets/eur.json', FALLBACK = 365.6;
  var KEY = 'rr_cur', RKEY = 'rr_eur_rate';
  function store(k, v) { try { if (v == null) { localStorage.removeItem(k); } else { localStorage.setItem(k, v); } } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).join(',');
  var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var foreign = !/(^|,)hu\b/i.test(langs) && tz !== 'Europe/Budapest';
  var pref = read(KEY);
  var mode = pref === 'EUR' || pref === 'HUF' ? pref : (foreign ? 'EUR' : 'HUF');
  if (!foreign && !pref) { return; }                      /* Hungarian visitors never see any of this */
  var checkout = /checkout|route=checkout|\/kosar/i.test(location.pathname + location.search);
  var rate = FALLBACK;
  var cached = read(RKEY);
  if (cached) { try { var c = JSON.parse(cached); if (c.r > 250 && c.r < 600) { rate = c.r; } if (Date.now() - c.t < 12 * 3600e3) { cached = 'fresh'; } } catch (e) {} }
  if (cached !== 'fresh') {
    fetch(RATE_URL, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
      var r = Number(j && j.huf_per_eur);
      if (r > 250 && r < 600) { store(RKEY, JSON.stringify({ r: r, t: Date.now() })); if (r !== rate) { rate = r; if (mode === 'EUR') { restoreAll(); convertAll(); } } }
    }).catch(function () {});
  }

  var RE = /(\d{1,3}(?:[.,   ]\d{3})+|\d+)\s?(Ft|HUF)\b/g;
  var SKIP = 'script,style,textarea,input,select,noscript,.rr-cur,[contenteditable],.rr-cur-toast';
  var touched = [];
  function eur(n) { var v = n / rate; return '€' + (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }
  function convertNode(n) {
    var v = n.nodeValue;
    if (!v || v.indexOf('Ft') < 0 && v.indexOf('HUF') < 0) { return; }
    RE.lastIndex = 0;
    if (!RE.test(v)) { return; }
    var p = n.parentElement;
    if (!p || p.closest(SKIP)) { return; }
    RE.lastIndex = 0;
    var out = v.replace(RE, function (m, num) { var h = parseInt(num.replace(/[^\d]/g, ''), 10); return isFinite(h) ? eur(h) : m; });
    if (out !== v) { if (n.__rrHu == null) { n.__rrHu = v; touched.push(n); } n.nodeValue = out; }
  }
  var busy = false;
  function convertAll(root) {
    if (mode !== 'EUR' || checkout || !document.body) { return; }
    busy = true;
    var w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { convertNode(n); }
    busy = false;
  }
  function restoreAll() {
    busy = true;
    touched.forEach(function (n) { if (n.__rrHu != null) { n.nodeValue = n.__rrHu; n.__rrHu = null; } });
    touched = [];
    busy = false;
  }
  var timer = null;
  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (busy || mode !== 'EUR' || timer) { return; }
      timer = setTimeout(function () { timer = null; convertAll(); }, 250);
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  var css =
    '.rr-cur{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:2147482998;display:flex;flex-direction:column;' +
      'border-radius:0 10px 10px 0;overflow:hidden;border:1px solid rgba(127,196,234,.6);border-left:0;box-shadow:6px 0 18px rgba(0,0,0,.4);font-family:Poppins,sans-serif}' +
    '.rr-cur button{width:38px;height:34px;border:0;background:#06243b;color:#9fb3c6;font-weight:800;font-size:14px;cursor:pointer;padding:0}' +
    '.rr-cur button.on{background:linear-gradient(180deg,#14659c,#0a3a5e);color:#fff}' +
    '.rr-cur button + button{border-top:1px solid rgba(127,196,234,.35)}' +
    '@media (max-width:991px){.rr-cur{top:auto;bottom:calc(var(--rr-bottomnav,64px) + 150px);transform:none}.rr-cur button{width:34px;height:30px;font-size:13px}}' +
    '.rr-cur-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:2147483600;max-width:min(92vw,420px);padding:11px 16px;border-radius:8px;' +
      'background:#06243b;border:1px solid rgba(127,196,234,.6);color:#e6f3fb;font:600 13px/1.4 Poppins,sans-serif;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.5)}';
  function toast(t) {
    var d = document.createElement('div'); d.className = 'rr-cur-toast'; d.setAttribute('translate', 'no'); d.textContent = t; document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 6500);
  }
  function set(m) {
    if (m === mode) { return; }
    mode = m; store(KEY, m);
    if (m === 'EUR') { convertAll(); } else { restoreAll(); }
    paint();
  }
  var bar = null;
  function paint() {
    if (!bar) { return; }
    [].forEach.call(bar.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.getAttribute('data-c') === mode); });
  }
  function build() {
    if (!document.body) { return false; }
    var st = document.createElement('style'); st.id = 'rr-eur'; st.textContent = css; document.head.appendChild(st);
    bar = document.createElement('div'); bar.className = 'rr-cur notranslate'; bar.setAttribute('translate', 'no');
    bar.title = checkout ? 'Payment is in Hungarian forint (HUF)' : 'Approximate prices in EUR. You pay in Hungarian forint (HUF).';
    bar.innerHTML = '<button type="button" data-c="HUF" aria-label="Prices in forint">Ft</button><button type="button" data-c="EUR" aria-label="Prices in euro">€</button>';
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-c]'); if (!b) { return; }
      if (checkout && b.getAttribute('data-c') === 'EUR') { toast('At checkout prices are shown in HUF, the currency you pay in.'); }
      set(b.getAttribute('data-c'));
    });
    document.body.appendChild(bar);
    paint();
    if (mode === 'EUR' && !checkout) {
      convertAll();
      if (!read('rr_cur_seen')) { store('rr_cur_seen', '1'); toast('Prices are shown in EUR (approx., ECB rate). You pay in Hungarian forint (HUF). Tap Ft on the left to switch back.'); }
    }
    return true;
  }
  var tries = 0;
  (function wait() { if (!build() && tries++ < 40) { setTimeout(wait, 150); } })();
})();

/* SEO (owner 2026-11-17). Google reads the rendered page, so these additions count:
   - home: store details (address, opening hours, phone, map point, socials) and the site search box, as JSON-LD;
   - product pages: brand, shipping cost and return policy added to the shop's own Product / Offer markup.
     Brand = a known brand in the product name, otherwise none (owner: RagnaRock is never shown as a brand).
     Shipping: GLS 1 850 Ft, free from 30 000 Ft. Returns: 14 days by GLS exchange parcel, free when it is our fault
     (broken / wrong item), 1 500 Ft when it is the buyer's (wrong size);
   - product photos without a description get the product name as alt text;
   - page 2+ of a category: "noindex, follow" instead of "noindex, nofollow", so Google still follows the products. */
(function () {
  if (window.__rrSeo) { return; }
  window.__rrSeo = true;
  var SITE = location.protocol + '//' + location.host + '/';   /* follows the domain (ragnarock.hu from January) */
  var body = document.body ? document.body.className : '';
  function ld(obj, id) {
    if (document.getElementById(id)) { return; }
    var s = document.createElement('script'); s.type = 'application/ld+json'; s.id = id; s.textContent = JSON.stringify(obj);
    (document.head || document.documentElement).appendChild(s);
  }
  function meta(parent, prop, content) { var m = document.createElement('meta'); m.setAttribute('itemprop', prop); m.setAttribute('content', content); parent.appendChild(m); return m; }
  function link(parent, prop, href) { var l = document.createElement('link'); l.setAttribute('itemprop', prop); l.setAttribute('href', href); parent.appendChild(l); return l; }
  function scope(parent, prop, type) { var d = document.createElement('div'); d.setAttribute('itemprop', prop); d.setAttribute('itemscope', ''); d.setAttribute('itemtype', 'https://schema.org/' + type); d.hidden = true; parent.appendChild(d); return d; }

  /* ---------- home: the store + the site search box ---------- */
  if (/home-body/.test(body) || location.pathname === '/' || location.pathname === '/index.php' && !location.search) {
    ld({ '@context': 'https://schema.org', '@type': 'ClothingStore', '@id': SITE + '#store',
      name: 'RagnaRock Rock & Metal Shop', alternateName: ['RagnaRock', 'Rockpince'], url: SITE,
      logo: 'https://1374223-star.github.io/rockpince-menu-counts/assets/mail/logo.png',
      image: ['https://1374223-star.github.io/rockpince-menu-counts/assets/shop/uzletunk_bolt_2026.webp'],
      description: 'Magyarország legnagyobb rock és alternatív ruházati webshopja és boltja: zenekaros pólók, pulóverek, bakancsok, kiegészítők és dísztárgyak Budapesten.',
      telephone: '+36705882134', email: 'info@ragnarock.hu', priceRange: '990-150 000 Ft', currenciesAccepted: 'HUF',
      address: { '@type': 'PostalAddress', streetAddress: 'Dózsa György út 19.', addressLocality: 'Budapest', postalCode: '1146', addressRegion: 'Budapest', addressCountry: 'HU' },
      geo: { '@type': 'GeoCoordinates', latitude: 47.50566, longitude: 19.08687 },
      hasMap: 'https://www.google.com/maps?q=47.50566,19.08687',
      openingHoursSpecification: [
        { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '12:00', closes: '18:00' },
        { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '10:00', closes: '14:00' }],
      sameAs: ['https://www.facebook.com/Rockpincehu-192771484084237', 'https://www.instagram.com/ragnarock.hu/', 'https://www.tiktok.com/@ragnarock.hu'] }, 'rr-ld-store');
    ld({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE + '#website', url: SITE, name: 'RagnaRock', inLanguage: 'hu',
      publisher: { '@id': SITE + '#store' },
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: SITE + 'index.php?route=product/list&keyword={search_term_string}' },
        'query-input': 'required name=search_term_string' } }, 'rr-ld-website');
  }

  /* ---------- page 2+ of a listing: keep it out of the index, but let Google follow the products ---------- */
  var page = /[?&]page=(\d+)/.exec(location.search);
  if (page && Number(page[1]) > 1) {
    var rm = document.querySelector('meta[name="robots"]');
    if (rm && /nofollow/i.test(rm.content)) { rm.setAttribute('content', 'noindex, follow'); }
  }

  /* ---------- product page ---------- */
  if (!/product-page-body/.test(body)) { return; }
  var BRANDS = ['New Rock', 'Spiral', 'Alchemy', 'Nemesis Now', 'Killstar', 'Brandit', 'Punk Rave', 'Dark In Love', 'Banned', 'Restyle',
    'Pentagramme', 'Steelground', 'Mil-Tec', 'Rock Rebel', 'Kreepsville', 'Jawbreaker', 'Hell Bunny', 'Poizen', 'Vixxsin', 'Rockabella',
    'Demonia', 'Altercore', 'Heartless', 'Necessary Evil', 'Too Fast', 'Sourpuss', 'Loungefly', 'Funko'];
  var tries = 0;
  (function run() {
    var prod = document.querySelector('[itemtype$="schema.org/Product"]'), h1 = document.querySelector('h1');
    if (!prod || !h1) { if (tries++ < 30) { setTimeout(run, 300); } return; }
    var name = h1.textContent.replace(/\s+/g, ' ').trim();
    if (!prod.querySelector('[itemprop="brand"]')) {
      /* owner 2026-11-16: no invented brand; only a brand actually named in the product title, else none */
      var lower = name.toLowerCase(), brand = '';
      for (var i = 0; i < BRANDS.length; i++) { if (lower.indexOf(BRANDS[i].toLowerCase()) >= 0) { brand = BRANDS[i]; break; } }
      if (!brand && /\bphantom\b/.test(lower)) { brand = 'Brandit'; }   /* Phantom boots are Brandit's */
      if (brand) { meta(scope(prod, 'brand', 'Brand'), 'name', brand); }
    }
    [].forEach.call(prod.querySelectorAll('[itemprop="offers"]'), function (offer) {
      if (offer.querySelector('[itemprop="shippingDetails"]')) { return; }
      var priceEl = offer.querySelector('[itemprop="price"]'), price = priceEl ? Number(priceEl.getAttribute('content')) : 0;
      var sd = scope(offer, 'shippingDetails', 'OfferShippingDetails');
      var rate = scope(sd, 'shippingRate', 'MonetaryAmount'); meta(rate, 'value', price >= 30000 ? '0' : '1850'); meta(rate, 'currency', 'HUF');
      meta(scope(sd, 'shippingDestination', 'DefinedRegion'), 'addressCountry', 'HU');
      /* Search Console 2026-11-17: "Hiányzó mező: deliveryTime". Handling 0-14 days (stock or procurement) + GLS 1-2 days,
         the same 1-16 days as the Merchant Center shipping setting */
      var dt = scope(sd, 'deliveryTime', 'ShippingDeliveryTime');
      var ht = scope(dt, 'handlingTime', 'QuantitativeValue'); meta(ht, 'minValue', '0'); meta(ht, 'maxValue', '14'); meta(ht, 'unitCode', 'DAY');
      var tt = scope(dt, 'transitTime', 'QuantitativeValue'); meta(tt, 'minValue', '1'); meta(tt, 'maxValue', '2'); meta(tt, 'unitCode', 'DAY');
      var rp = scope(offer, 'hasMerchantReturnPolicy', 'MerchantReturnPolicy');
      /* Search Console 2026-11-17: "Hiányzó mező: returnFees". The customer pays the return shipping (GLS, 1 500 Ft) */
      link(rp, 'returnFees', 'https://schema.org/ReturnShippingFees');
      var rf = scope(rp, 'returnShippingFeesAmount', 'MonetaryAmount'); meta(rf, 'value', '1500'); meta(rf, 'currency', 'HUF');
      meta(rp, 'applicableCountry', 'HU');
      link(rp, 'returnPolicyCategory', 'https://schema.org/MerchantReturnFiniteReturnWindow');
      meta(rp, 'merchantReturnDays', '14');
      link(rp, 'returnMethod', 'https://schema.org/ReturnByMail');
      link(rp, 'itemDefectReturnFees', 'https://schema.org/FreeReturn');
      link(rp, 'customerRemorseReturnFees', 'https://schema.org/ReturnShippingFees');
      var fee = scope(rp, 'customerRemorseReturnShippingFeesAmount', 'MonetaryAmount'); meta(fee, 'value', '1500'); meta(fee, 'currency', 'HUF');
    });
    /* photos without a description: the product name (Google Images reads the alt text) */
    var pics = document.querySelectorAll('#product-image img, .product-image__main img, .product-image-thumbnails img');
    [].forEach.call(pics, function (im, k) {
      if (!(im.getAttribute('alt') || '').trim()) { im.setAttribute('alt', name + (k ? ', ' + (k + 1) + '. kép' : '')); }
    });
  })();
})();

/* Band pages (SEO, owner OK 2026-11-16): every top band has its own page under /zenekarok/... (built and kept
   filled by rockoff-upload/src/bandpages/build.py). The parent "Zenekarok" never shows in a menu and its own
   page sends visitors to ZENEKAROS; the breadcrumb on a band page points there too. Band strip logos open the
   band page when the band has one (otherwise the search, as before). Map: assets/seo/bandpages.json. */
(function () {
  if (window.__rrBandPages) { return; }
  window.__rrBandPages = true;
  var ZEN = '/ruhazat_cipo-14031/zenekaros-14040';
  /* href ends with /zenekarok on any domain (2026-11-17: was the exact www.rockpince.hu address, would break in January) */
  var Z = 'a[href$="/zenekarok"]';
  /* 2026-11-17: the Innocent banner landing page (INNOCENT CLOTHING, cat 20131) is hidden from every menu too */
  var I = 'a[href$="/innocent-clothing"]';
  var st = document.createElement('style'); st.id = 'rr-bandpages';
  st.textContent = '#cat_19526,li:has(> ' + Z + '),li:has(> div > ' + Z + '),li:has(> span > ' + Z + '),' +
    '#cat_20131,li:has(> ' + I + '),li:has(> div > ' + I + '),li:has(> span > ' + I + '){display:none!important}';
  (document.head || document.documentElement).appendChild(st);
  if (/^\/zenekarok\/?$/.test(location.pathname)) { location.replace(ZEN); return; }
  function crumbs() {
    [].forEach.call(document.querySelectorAll('.breadcrumb ' + Z + ',[class*=breadcrumb] ' + Z), function (a) {
      a.setAttribute('href', ZEN);
      var t = a.querySelector('span') || a;
      if (/^\s*Zenekarok\s*$/.test(t.textContent)) { t.textContent = 'Zenekaros'; }
    });
  }
  if (/^\/zenekarok\//.test(location.pathname)) {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', crumbs); } else { crumbs(); }
  }
  var map = null, tries = 0;
  var x = new XMLHttpRequest();
  x.open('GET', 'https://1374223-star.github.io/rockpince-menu-counts/assets/seo/bandpages.json', true);
  x.onload = function () { try { map = JSON.parse(x.responseText); } catch (e) { map = {}; } };
  x.send();
  function relink() {
    var done = 0;
    if (map) {
      [].forEach.call(document.querySelectorAll('a.rr-blogo:not([data-bp])'), function (a) {
        var im = a.querySelector('img'), m = im && /\/bands\/([^\/]+)\.webp/.exec(im.getAttribute('src') || '');
        a.setAttribute('data-bp', '1');
        if (m && map[m[1]]) { a.setAttribute('href', map[m[1]]); }
      });
      done = document.querySelectorAll('a.rr-blogo').length;
    }
    if (tries++ < 80) { setTimeout(relink, done ? 1500 : 250); }
  }
  relink();
})();

/* Header look (owner 2026-11-16, mockup "L" with white top row): the band-logo strip on a light brushed-steel band
   with dark logos, plain white text in the top info row, no line under the category bar. Static paint only: the
   darkening filter sits once on the sliding track (one layer), nothing repaints while it slides. */
(function () {
  if (window.__rrSteel) { return; }
  window.__rrSteel = true;
  var T = '.header-top .headermenu-list a,.header-top .headermenu-list a *,.header-top .rr-phonetop,.header-top .rr-phonetop *,.header-top .rr-mailtop,.header-top .rr-mailtop *';
  var GLOW = 'brightness(1.3) drop-shadow(0 0 1px rgba(3,18,34,.95)) drop-shadow(0 0 1px rgba(3,18,34,.95)) drop-shadow(0 0 5px #7fc4ea) ' +
    'drop-shadow(0 0 12px rgba(56,168,240,1)) drop-shadow(0 0 20px rgba(56,168,240,.85))';
  var st = document.createElement('style'); st.id = 'rr-steel';
  st.textContent =
    T + '{color:#fff!important;-webkit-text-fill-color:#fff!important;background-image:none!important;text-shadow:none!important}' +
    '.header-top .rr-phonetop svg,.header-top .rr-mailtop svg{color:#fff!important;stroke:#fff!important}' +
    'html body .header-bottom{border-top:0!important;border-bottom:0!important;box-shadow:none!important}' +
    /* steel strip on PC only (owner 2026-11-16: phones keep the old navy strips) */
    '@media (min-width:992px){' +
    'html body .rr-bands{background:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,rgba(0,0,0,.03) 1px 3px),linear-gradient(180deg,#d9dfe4,#aab5bf)!important;' +
    'border-top:1px solid #f1f4f6!important;border-bottom:1px solid #5c6873!important}' +
    'html body .rr-bands:before,html body .rr-bands:after{display:none!important}' +
    'html body .rr-bands{background:linear-gradient(90deg,#020b16 0,rgba(2,11,22,.7) 50px,rgba(2,11,22,0) 140px,rgba(2,11,22,0) calc(100% - 140px),rgba(2,11,22,.7) calc(100% - 50px),#020b16 100%),' +
    'repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,rgba(0,0,0,.03) 1px 3px),linear-gradient(180deg,#d9dfe4,#aab5bf)!important}' +
    'html body .rr-bands .rr-bands-vp{-webkit-mask-image:linear-gradient(90deg,transparent 0,transparent 30px,#000 140px,#000 calc(100% - 140px),transparent calc(100% - 30px));' +
    'mask-image:linear-gradient(90deg,transparent 0,transparent 30px,#000 140px,#000 calc(100% - 140px),transparent calc(100% - 30px))}' +
    /* dark logos on the steel: the darkening sits on each logo, not on the whole row, so the hovered one can drop it
       (owner 2026-11-17: "make the band name glow up with lightblue strong when hovered"): it turns white with a thin
       dark edge (readable on the light steel) and a strong light blue glow */
    'html body .rr-bands .rr-blogo img{filter:invert(1) brightness(.28)}' +
    'html body .rr-bands .rr-blogo{opacity:.92!important}' +
    'html body .rr-bands .rr-blogo:active img{filter:' + GLOW + '!important}' +
    '}' +
    '@media (min-width:992px) and (hover:hover) and (pointer:fine){' +
    'html body .rr-bands .rr-blogo:hover{opacity:1!important}' +
    'html body .rr-bands .rr-blogo:hover img{filter:' + GLOW + '!important}' +
    '}';
  (document.head || document.documentElement).appendChild(st);
})();

/* Shop's own English mode (owner 2026-11-16: on phones without Google Translate, e.g. Brave, foreign visitors saw
   every word in Hungarian). Foreign visitors (same test as the EUR prices: no Hungarian browser language and not on
   Budapest time) get the shop's texts in English: menus, buttons, labels, category names, and the product type in
   product names ("Unisex Póló" -> "Unisex T-shirt"). HU / EN buttons sit under Ft / € on the left edge and the choice
   is remembered. Words come from assets/i18n/en.json (built by i18n/build_en.py from the category tree). Hungarian
   visitors never see any of this. Only text is swapped; the original is kept and put back on switching to HU. */
(function () {
  if (window.__rrLang) { return; }
  window.__rrLang = true;
  return;   /* owner 2026-11-16: switched off with the EUR prices; the EU shop gets its own English site. Kept for reuse. */
  var KEY = 'rr_lang';
  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).join(',');
  var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var foreign = !/(^|,)hu\b/i.test(langs) && tz !== 'Europe/Budapest';
  var pref = read();
  if (!foreign && !pref) { return; }
  var mode = pref === 'EN' || pref === 'HU' ? pref : 'EN';
  var DICT = null, PN = [], swapped = [];
  var SKIP = 'script,style,textarea,noscript,.rr-cur,.rr-cur-toast,[contenteditable]';
  var MON = { 'január': 'January', 'február': 'February', 'március': 'March', 'április': 'April', 'május': 'May', 'június': 'June',
    'július': 'July', 'augusztus': 'August', 'szeptember': 'September', 'október': 'October', 'november': 'November', 'december': 'December' };
  var RX = [
    [/^(\d+\s*-\s*\d+) év$/i, function (m, a) { return a + ' years'; }],
    [/^Megtakarítás:\s*(.+)$/i, function (m, a) { return keep(m, 'You save: ') + a; }],
    [/^(\d+\s*-\s*\d+\s*\/\s*\d+)\s+termék$/i, function (m, a) { return a + ' products'; }],
    [/^(\d+)\s+termék$/i, function (m, a) { return a + ' products'; }],
    [/^(Válassz méretet)(\s*\(\d+\))$/i, function (m, a, c) { return keep(a, 'Choose size') + c; }],
    [/^\(([\d .]+) Ft \+ ÁFA\)$/i, function (m, a) { return '(' + a + ' Ft + VAT)'; }],
    [/^(.+) termékek$/i, function (m, a) { return a + keep(m, ' merch'); }],
    [/^még több (.+) termék (\(\d+\).*)$/i, function (m, a, c) { return keep(m, 'More ') + a + keep(m, ' products ') + c; }],
    [/^(.+) feletti vásárlás esetén csomagod ingyen kiszállítjuk!$/i, function (m, a) { return 'Free delivery on orders over ' + a + '!'; }],
    [/^(.+) feletti vásárlás esetén( ingyenes)?$/i, function (m, a, f) { return (f ? 'Free on orders over ' : 'On orders over ') + a; }],
    [/^ingyenes szállítás (.+) felett$/i, function (m, a) { return 'Free shipping over ' + a; }],
    [/^még (.+) és ingyenes a szállítás!?$/i, function (m, a) { return keep(m, 'Only ') + a + keep(m, ' more for free shipping!'); }],
    [/^·\s*([\d\s]+?)\s*Google-értékelés$/i, function (m, a) { return '· ' + a + ' Google reviews'; }],
    [/^([\d,.]+)\s*·\s*([\d\s]+?)\s*Google-értékelés$/i, function (m, a, b) { return a.replace(',', '.') + ' · ' + b + ' Google reviews'; }],
    [/^Szállítási határidő \(a készlettől függően\):\s*(.+?)\s*nap$/i, function (m, a) { return 'Delivery time (depending on stock): ' + a + ' days'; }],
    [/^(\d{4})\. (január|február|március|április|május|június|július|augusztus|szeptember|október|november|december) (\d{1,2})\.(.*)$/i,
      function (m, y, mo, d, rest) { return keep(m, d + ' ' + MON[mo.toLowerCase()] + ' ' + y) + rest; }]
  ];
  function keep(src, rep) { return src === src.toUpperCase() && /[A-ZÁÉÍÓÖŐÚÜŰ]/.test(src) ? rep.toUpperCase() : rep; }
  function caseLike(src, rep) {
    if (src === src.toUpperCase()) { return rep.toUpperCase(); }
    if (src.charAt(0) === src.charAt(0).toUpperCase()) { return rep.replace(/(^|\s)([a-z])/g, function (m, s, c) { return s + c.toUpperCase(); }); }
    return rep;
  }
  function pname(seg) {   /* translate the product type at the end of one " - " segment */
    var low = seg.toLowerCase();
    for (var i = 0; i < PN.length; i++) {
      var k = PN[i][0];
      if (low === k) { return caseLike(seg, PN[i][1]); }
      if (k.length >= 5 && low.length > k.length && low.slice(-k.length) === k && /\s/.test(low.charAt(low.length - k.length - 1))) {
        var head = seg.slice(0, seg.length - k.length);
        return head + caseLike(seg.slice(-k.length), PN[i][1]);
      }
      if (k.length >= 5 && low.indexOf(k + ' ') === 0 && /^[A-Z0-9-]+$/i.test(seg.slice(k.length + 1))) {
        return caseLike(seg.slice(0, k.length), PN[i][1]) + seg.slice(k.length);
      }
    }
    return null;
  }
  function look(k) {
    var t = DICT[k] || DICT[k.toLowerCase()];
    if (!t) { return null; }
    return k === k.toUpperCase() && /[A-ZÁÉÍÓÖŐÚÜŰ]/.test(k) ? t.toUpperCase() : t;
  }
  function tr(v) {
    var k = v.replace(/\s+/g, ' ').trim();
    if (!k || !/[a-záéíóöőúüű]/i.test(k)) { return null; }
    var d = look(k); if (d) { return v.replace(v.trim(), d); }
    var m = /^(.+?)(\s*[\[(]\d+[\])])$/.exec(k);
    if (m && (d = look(m[1]))) { return v.replace(v.trim(), d + m[2]); }
    for (var i = 0; i < RX.length; i++) { if (RX[i][0].test(k)) { return v.replace(v.trim(), k.replace(RX[i][0], RX[i][1])); } }
    if (!/\s[-–]\s/.test(k) && k.length < 60) { var whole = pname(k); if (whole && whole !== k) { return v.replace(v.trim(), whole); } }
    if (/\s[-–]\s/.test(k)) {   /* product names: "Band - Design - Type - SKU" */
      var parts = k.split(/(\s[-–]\s)/), hit = false;
      for (var j = 0; j < parts.length; j += 2) { var t = pname(parts[j]); if (t) { parts[j] = t; hit = true; } }
      if (hit) { return v.replace(v.trim(), parts.join('')); }
    }
    return null;
  }
  var busy = false, timer = null;
  function sweep() {
    timer = null;
    if (mode !== 'EN' || !DICT) { return; }
    busy = true;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      if (n.__rrHu != null && n.nodeValue === n.__rrEn) { continue; }
      var p = n.parentElement; if (!p || p.closest(SKIP)) { continue; }
      var t = tr(n.nodeValue);
      if (t != null && t !== n.nodeValue) { if (n.__rrHu == null) { swapped.push(n); } n.__rrHu = n.nodeValue; n.nodeValue = t; n.__rrEn = t; }
    }
    [].forEach.call(document.querySelectorAll('input[placeholder]'), function (el) {
      var o = el.hasAttribute('data-rr-hu') ? el.getAttribute('data-rr-hu') : el.placeholder.trim();
      if (el.hasAttribute('data-rr-hu') && el.placeholder !== o) { return; }
      var t = DICT[o] || DICT[o.toLowerCase()];
      if (t) { el.setAttribute('data-rr-hu', o); el.placeholder = t; }
    });
    shipLine();
    busy = false;
  }
  /* "Még <b>X</b> és <b>ingyenes</b> a szállítás!" is several text nodes */
  function shipLine() {
    [].forEach.call(document.querySelectorAll('b, strong'), function (b) {
      var box = b.parentElement;
      if (!box || box.__rrShipEn || (box.textContent || '').length > 160) { return; }
      if (!/^\s*még\s[\s\S]*\sés\s[\s\S]*szállítás!?\s*$/i.test(box.textContent)) { return; }
      var w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), n, MAP = { 'még': 'Only', 'és': 'more for', 'a szállítás!': 'shipping!', 'a szállítás': 'shipping', 'ingyenes': 'free', 'free': 'free' };
      while ((n = w.nextNode())) {
        var k = n.nodeValue.trim().toLowerCase();
        if (MAP[k]) { var t = n.nodeValue.replace(n.nodeValue.trim(), keep(n.nodeValue.trim(), MAP[k])); if (n.__rrHu == null) { swapped.push(n); n.__rrHu = n.nodeValue; } n.nodeValue = t; n.__rrEn = t; }
      }
      box.__rrShipEn = true;
    });
  }
  function later() { if (!busy && !timer) { timer = setTimeout(sweep, 400); } }
  function restore() {
    [].forEach.call(document.querySelectorAll('b, strong'), function (b) { if (b.parentElement) { b.parentElement.__rrShipEn = false; } });
    swapped.forEach(function (n) { if (n.__rrHu != null) { if (n.nodeValue === n.__rrEn) { n.nodeValue = n.__rrHu; } n.__rrHu = null; n.__rrEn = null; } });
    swapped = [];
    [].forEach.call(document.querySelectorAll('input[data-rr-hu]'), function (el) { el.placeholder = el.getAttribute('data-rr-hu'); el.removeAttribute('data-rr-hu'); });
  }
  function set(m) {
    if (m === mode) { return; }
    mode = m; store(m);
    if (m === 'EN') { sweep(); } else { restore(); }
    paint();
  }
  function paint() {
    [].forEach.call(document.querySelectorAll('.rr-cur button[data-l]'), function (b) { b.classList.toggle('on', b.getAttribute('data-l') === mode); });
  }
  function mount() {
    var bar = document.querySelector('.rr-cur');
    if (!bar) { return false; }
    if (bar.querySelector('[data-l]')) { return true; }
    var st = document.createElement('style'); st.id = 'rr-lang';
    st.textContent = '.rr-cur button[data-l]{font-size:12px!important;letter-spacing:.02em}.rr-cur button[data-l="HU"]{border-top:3px solid rgba(127,196,234,.6)!important}';
    document.head.appendChild(st);
    bar.insertAdjacentHTML('beforeend', '<button type="button" data-l="HU" aria-label="Magyar">HU</button><button type="button" data-l="EN" aria-label="English">EN</button>');
    bar.addEventListener('click', function (e) { var b = e.target.closest('button[data-l]'); if (b) { set(b.getAttribute('data-l')); } });
    paint();
    return true;
  }
  var tries = 0;
  (function wait() { if (!mount() && tries++ < 60) { setTimeout(wait, 250); } })();
  fetch('https://1374223-star.github.io/rockpince-menu-counts/assets/i18n/en.json').then(function (r) { return r.json(); }).then(function (j) {
    DICT = {}; Object.keys(j.exact || {}).forEach(function (k) { DICT[k] = j.exact[k]; DICT[k.toLowerCase()] = DICT[k.toLowerCase()] || j.exact[k]; }); PN = j.pname || [];
    if (mode === 'EN') { sweep(); }
    if (window.MutationObserver) { new MutationObserver(function () { if (mode === 'EN') { later(); } }).observe(document.body, { childList: true, subtree: true, characterData: true }); }
  }).catch(function () {});
})();

/* TikTok pixel shop events (owner 2026-11-16: TikTok ad spent 25.6k Ft on Nov 9-16 with 0 conversions). The shop's
   TikTok pixel only sent page views, so the ad group optimising for "Add to Cart" never got a signal. The shop
   already tells Google about product views, add-to-carts, checkout and purchases (gtag events in dataLayer);
   this copies each one to TikTok once: view_item -> ViewContent, add_to_cart -> AddToCart,
   begin_checkout -> InitiateCheckout, purchase -> CompletePayment. content_id = the product SKU, the same id the
   TikTok catalogue feed uses, so the catalogue carousel can learn which products sell. */
(function () {
  if (window.__rrTtEvents) { return; }
  window.__rrTtEvents = true;
  var MAP = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'CompletePayment' };
  var sent = {};
  /* Meta InitiateCheckout from code (owner OK 2026-11-16). The Events Manager button rule "tovább pénztárba" sent it with
     1.18 HUF (it read the net "1.181 Ft"); that rule is deleted and this sends the gross basket value once per checkout.
     Meta's own consent handling (fbq consent revoke/grant) still applies. */
  function metaCheckout(p, items) {
    var qty = 0, n = 0;
    for (var k = 0; k < items.length; k++) { qty += Number(items[k].quantity || 1); }
    var data = { value: Number(p.value || 0), currency: p.currency || 'HUF', num_items: qty };
    (function wait() {
      if (typeof window.fbq === 'function') { try { window.fbq('track', 'InitiateCheckout', data); } catch (x) {} }
      else if (n++ < 40) { setTimeout(wait, 250); }
    })();
  }
  function forward(e) {
    if (!e || typeof e !== 'object') { return; }
    var name = e[0] === 'event' ? e[1] : null, p = e[0] === 'event' ? e[2] : null;
    if (!name && e.event && e.ecommerce) { name = e.event; p = e.ecommerce; }
    if (!MAP[name] || !p) { return; }
    var items = p.items || [];
    /* Shoprenter pushes begin_checkout and purchase twice (GTM object with value "1500.00", gtag call with 1500):
       compare numbers, not strings, so each goes to TikTok once */
    var key = name + '|' + (p.transaction_id || '') + '|' + items.map(function (i) { return i.item_id + 'x' + Number(i.quantity || 1); }).join(',') + '|' + Number(p.value || 0);
    if (name !== 'add_to_cart' && sent[key]) { return; }
    sent[key] = 1;
    if (name === 'begin_checkout') { metaCheckout(p, items); }
    var data = {
      contents: items.map(function (i) { return { content_id: String(i.item_id || ''), content_type: 'product', content_name: i.item_name || '', quantity: Number(i.quantity || 1), price: Number(i.price || 0) }; }),
      value: Number(p.value || 0), currency: p.currency || 'HUF'
    };
    var opt = p.transaction_id ? { event_id: 'order_' + p.transaction_id } : undefined;
    var go = function () { try { window.ttq.track(MAP[name], data, opt); } catch (x) {} };
    if (window.ttq && window.ttq.track) { go(); } else { var n = 0; (function wait() { if (window.ttq && window.ttq.track) { go(); } else if (n++ < 40) { setTimeout(wait, 250); } })(); }
  }
  var dl = window.dataLayer = window.dataLayer || [];
  for (var i = 0; i < dl.length; i++) { forward(dl[i]); }
  var push = dl.push;
  dl.push = function () { for (var j = 0; j < arguments.length; j++) { forward(arguments[j]); } return push.apply(dl, arguments); };
})();

/* Mobile conversion experiments (owner OK 2026-11-17; measured before/after for 8 weeks with GA4 funnel by device).
   Baseline (365 days): mobile view->add to cart 14.4%, add to cart->begin checkout 51.0%, AOV 13,226 Ft.
   Exp 1: on the phone basket page a sticky bar above the bottom menu with the gross total, what is missing for
          free shipping, and "Tovább a pénztárba" (shown while the page's own button is off screen).
   Exp 4: on phones the "Ehhez ajánljuk" add-on row moves up, right under the buy box.
   (Exp 2 = size picker in the sticky Kosárba bar, Exp 3 = delivery line in the trust row: in their own blocks.)
   Clicks on the sticky buttons send the GA4 event rr_exp_click. No per-frame work: IntersectionObserver only. */
(function () {
  'use strict';
  if (window.__rrExp) { return; }
  window.__rrExp = { start: '2026-11-17' };
  var phone = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
  if (!phone) { return; }
  var FREE = 30000;
  function ft(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft'; }
  function num(t) { var m = String(t || '').replace(/\s/g, '').match(/(\d[\d.]*)Ft/); return m ? Number(m[1].replace(/\./g, '')) : 0; }

  /* Exp 1 */
  function cartBar() {
    if (!/sr-cart-page-body/.test(document.body.className) || document.querySelector('.rr-cobar')) { return true; }
    var btn = document.querySelector('.sr-next-to-checkout, .ac-next-to-checkout');
    var lab = document.querySelector('.ac-gross-sum-label');
    if (!btn || !lab) { return false; }
    var bar = document.createElement('div');
    bar.className = 'rr-cobar';
    bar.innerHTML = '<div class="t"><span>Összesen</span><b></b><i></i></div><a href="' + (btn.getAttribute('href') || '/checkout') + '">Tovább a pénztárba</a>';
    document.body.appendChild(bar);
    function total() {
      var row = lab.closest('tr'), cells = row ? row.querySelectorAll('td, th') : [];
      return num(cells.length ? cells[cells.length - 1].textContent : '');
    }
    function paint() {
      var t = total();
      bar.querySelector('b').textContent = t ? ft(t) : '';
      bar.querySelector('i').textContent = t && t < FREE ? 'Még ' + ft(FREE - t) + ' és ingyenes a szállítás' : (t ? 'Ingyenes szállítás' : '');
    }
    paint();
    var tbl = lab.closest('table');
    if (tbl && window.MutationObserver) { new MutationObserver(paint).observe(tbl, { childList: true, subtree: true, characterData: true }); }
    bar.querySelector('a').addEventListener('click', function () {
      try { if (window.gtag) { window.gtag('event', 'rr_exp_click', { rr_exp: 'sticky_checkout' }); } } catch (e) { /* */ }
    });
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (en) { bar.classList.toggle('show', !en[0].isIntersecting); }).observe(btn);
    } else { bar.classList.add('show'); }
    return true;
  }

  /* Exp 4 */
  function moveXsell() {
    var xs = document.querySelector('.rr-xsell'), box = document.querySelector('.product-cart-box');
    if (!xs || !box || xs.classList.contains('rr-xsell-up')) { return !!xs || !box; }
    xs.classList.add('rr-xsell-up');
    /* after the product's <form>, never inside it: the add-on cards' hidden fields would be submitted with Kosárba */
    var anchor = box.closest('form') || box;
    anchor.parentNode.insertBefore(xs, anchor.nextSibling);
    return true;
  }

  var st = document.createElement('style');
  st.id = 'rr-exp';
  st.textContent =
    '.rr-cobar{position:fixed;left:0;right:0;bottom:60px;z-index:1025;display:flex;align-items:center;gap:10px;padding:10px 12px;' +
    'background:#06131f;border-top:1px solid rgba(127,196,234,.35);box-shadow:0 -8px 24px rgba(0,0,0,.5);transform:translateY(130%);transition:transform .25s}' +
    '.rr-cobar.show{transform:none}' +
    '.rr-cobar .t{flex:1;min-width:0;color:#fff;line-height:1.2}.rr-cobar .t span{display:block;font-size:11px;color:#9fb3c6;text-transform:uppercase}' +
    '.rr-cobar .t b{display:block;font-size:17px}.rr-cobar .t i{display:block;font-style:normal;font-size:11px;color:#9cc7e3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.rr-cobar a{flex:0 0 auto;background:#e52421;color:#fff!important;font-weight:800;text-transform:uppercase;padding:13px 14px;border-radius:4px;font-size:14px;text-decoration:none!important}' +
    '.rr-xsell.rr-xsell-up{padding:18px 0 6px!important;max-width:100%}.rr-xsell.rr-xsell-up .module-head-title{font-size:18px!important;margin-bottom:12px!important;text-align:left!important}';
  (document.head || document.documentElement).appendChild(st);
  var n1 = 0, n4 = 0;
  (function wait1() { if (!cartBar() && n1++ < 40) { setTimeout(wait1, 300); } })();
  (function wait4() { if (!moveXsell() && n4++ < 50) { setTimeout(wait4, 400); } })();
})();

/* Deleted products (owner OK 2026-11-16: 185 TDM "farmering" items removed). Shoprenter has no 301 tool and shows
   "A termék nem található!" with status 200 for them, so on that page a known deleted product id is sent to its band
   page (or a band search). Google follows JS redirects. Map: assets/seo/deleted_redirects.json, built by
   rockoff-upload/src/util/deleted_redirect_map.py from the deletion backups. Runs only on the not-found page. */
(function () {
  if (window.__rrGone) { return; }
  window.__rrGone = true;
  /* 2026-11-17: the not-found page says "index, follow" with status 200 (soft 404); when there is no redirect
     target it becomes noindex, so dead URLs drop out of Google instead of being indexed as an empty page */
  function noindex() {
    var r = document.querySelector('meta[name="robots"]');
    if (!r) { r = document.createElement('meta'); r.name = 'robots'; document.head.appendChild(r); }
    r.setAttribute('content', 'noindex, follow');
  }
  function go() {
    if (!document.querySelector('[data-test-id="notFoundPage"]')) { return; }
    var m = location.search.match(/[?&]product_id=(\d+)/) || location.pathname.match(/-(\d+)\/?$/);
    if (!m) { noindex(); return; }
    var x = new XMLHttpRequest();
    x.open('GET', 'https://1374223-star.github.io/rockpince-menu-counts/assets/seo/deleted_redirects.json');
    x.onload = function () {
      var to = null;
      try { to = JSON.parse(x.responseText)[m[1]]; } catch (e) { /* no map */ }
      if (to) { location.replace(to); } else { noindex(); }
    };
    x.onerror = noindex;
    x.send();
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', go); } else { go(); }
})();

/* Vásárlóink fotói (owner 2026-11-17): customer photos.
   Product pages: a strip of the approved photos of that product, from assets/photos/photos.json (built every night by
   rockoff-upload/src/photos/publish_photos.py from the approved rows of the order tracker's VÁSÁRLÓI FOTÓK tab).
   The "Vásárlóink fotói" information page (/vasarloink-fotoi, informationid_103): with ?t=<order token> from the
   review email, the upload form (posts to the Apps Script photo web app); always the gallery of every approved photo.
   No per-frame effects; the JSON is fetched once, after load, only on these pages. */
(function () {
  'use strict';
  var cls = document.body ? document.body.className : '';
  var onProduct = /product-page-body/.test(cls), onPage = /\binformationid_103\b/.test(cls);
  if (window.__rrPhotos || (!onProduct && !onPage)) { return; }
  window.__rrPhotos = true;
  var BASE = 'https://1374223-star.github.io/rockpince-menu-counts/assets/photos/';
  var APP = 'https://script.google.com/macros/s/AKfycbyZxl9EjPVUhT8_JxnLLPP6aswr6g62pXVs3MqyfdTOLYV3kC3UxfUy84emPbJ8sp34tw/exec';
  var PAGE = '/vasarloink-fotoi';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function huDate(d) { var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(d || ''); return m ? m[1] + '. ' + m[2] + '. ' + m[3] + '.' : ''; }
  function getJSON(url, done) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.onload = function () { var j = null; try { j = JSON.parse(x.responseText); } catch (e) { /* bad */ } done(j); };
    x.onerror = function () { done(null); };
    x.send();
  }
  function productUrl(id) { return '/index.php?route=product/product&product_id=' + encodeURIComponent(id); }

  var style = document.createElement('style');
  style.textContent =
    '.rr-social:empty{display:none}.rr-social{padding-top:8px}.rr-social>.module-productreview-wrapper{margin-bottom:24px}' +
    '.rr-ugc{padding:28px 0 36px}.rr-ugc .module-head-title{margin-bottom:18px!important;text-align:center}' +
    '.rr-ugc-row{display:flex;gap:12px;overflow-x:auto;padding-bottom:6px;justify-content:center;flex-wrap:wrap}' +
    '.rr-ugc-thumb{flex:0 0 auto;width:150px;cursor:zoom-in;border:1px solid #3a7aa6;border-radius:8px;overflow:hidden;background:#06243b}' +
    '.rr-ugc-thumb img{display:block;width:150px;height:150px;object-fit:cover}' +
    '.rr-ugc-thumb span{display:block;padding:6px 8px;font-size:12px;color:#c9d8e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.rr-ugc-more{text-align:center;margin-top:12px}.rr-ugc-more a{color:#9fd6f7}' +
    '.rr-ugc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-top:10px}' +
    '.rr-ugc-card{border:1px solid #3a7aa6;border-radius:10px;overflow:hidden;background:#06243b}' +
    '.rr-ugc-card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;cursor:zoom-in}' +
    '.rr-ugc-card div{padding:10px 12px;font-size:14px;color:#c9d8e6;line-height:1.45}.rr-ugc-card a{color:#9fd6f7}' +
    '.rr-ugc-card i{display:block;color:#fff;font-style:normal;margin-top:4px}' +
    '.rr-ugc-box{border:1px solid #3a7aa6;border-radius:12px;background:#06243b;padding:22px;margin:10px 0 30px;color:#c9d8e6;max-width:760px}' +
    '.rr-ugc-box h2{color:#fff;margin:0 0 12px;font-size:22px}.rr-ugc-box label{display:block;margin:10px 0;cursor:pointer}' +
    '.rr-ugc-box textarea{width:100%;min-height:70px;border-radius:6px;border:1px solid #3a7aa6;background:#000c1a;color:#fff;padding:8px}' +
    '.rr-ugc-box .rr-ugc-btn{background:#e52421;color:#fff;border:0;border-radius:6px;padding:13px 26px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;cursor:pointer}' +
    '.rr-ugc-box .rr-ugc-btn[disabled]{opacity:.6;cursor:wait}.rr-ugc-msg{margin-top:12px;font-weight:bold}' +
    '.rr-ugc-prev{max-width:220px;max-height:220px;border-radius:8px;display:none;margin:8px 0}' +
    '.rr-ugc-lb{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:100000;display:flex;align-items:center;justify-content:center;flex-direction:column;cursor:zoom-out;padding:20px}' +
    '.rr-ugc-lb img{max-width:100%;max-height:85vh;border-radius:8px}.rr-ugc-lb div{color:#fff;margin-top:10px;text-align:center}' +
    '@media (max-width:767px){.rr-ugc-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.rr-ugc-thumb,.rr-ugc-thumb img{width:120px}.rr-ugc-thumb img{height:120px}}';
  (document.head || document.documentElement).appendChild(style);

  function lightbox(p) {
    var lb = document.createElement('div');
    lb.className = 'rr-ugc-lb';
    lb.innerHTML = '<img alt="" src="' + BASE + esc(p.id) + '.webp"><div>' + esc(p.n) + (p.c ? ': ' + esc(p.c) : '') + '</div>';
    function close() { lb.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') { close(); } }
    lb.addEventListener('click', close);
    document.addEventListener('keydown', key);
    document.body.appendChild(lb);
  }

  /* ---------- product page: description, photos, reviews right under the advantage boxes (owner 2026-11-17) ----------
     A slot (.rr-social) goes right after the "Ingyenes kiszállítás" boxes, above "Ehhez ajánljuk" (the cross-sell
     block places itself after the slot). Order inside: the Leírás tab (when it has content, usually the size chart),
     the customer photos (when there are approved ones), the reviews (only when the product has reviews, so an empty
     "no reviews yet" box never sits high up). */
  function slot() {
    var s = document.querySelector('.rr-social');
    if (s) { return s; }
    var adv = document.querySelector('.product-advantages-module');
    adv = adv && (adv.closest('.section-wrapper') || adv);
    if (!adv) { return null; }
    s = document.createElement('div');
    s.className = 'rr-social container';
    adv.parentNode.insertBefore(s, adv.nextSibling);
    /* the long description (usually the size chart) comes first, when there is one (owner 2026-11-17) */
    var tab = document.querySelector('section.product-page-tab');
    if (tab && (tab.querySelector('img, table') || tab.textContent.replace(/Leírás/g, '').replace(/\s+/g, '').length > 30)) {
      s.appendChild(tab);
    }
    var rev = document.querySelector('#module_productreview_wrapper');
    if (rev && rev.querySelector('.product-review-summary')) { s.appendChild(rev); }
    return s;
  }
  function strip(list) {
    var self = (document.querySelector('form#product input[name="product_id"]') || {}).value;
    var mine = (list || []).filter(function (p) { return p.p === self; });
    if (!mine.length) { return; }
    var box = document.createElement('div');
    var holder = slot();
    box.className = holder ? 'rr-ugc' : 'rr-ugc container';
    box.innerHTML = '<h3 class="module-head-title h2">Vásárlóink fotói</h3><div class="rr-ugc-row"></div>' +
      '<div class="rr-ugc-more"><a href="' + PAGE + '">Még több vásárlói fotó</a></div>';
    var row = box.querySelector('.rr-ugc-row');
    mine.slice(0, 12).forEach(function (p) {
      var t = document.createElement('div');
      t.className = 'rr-ugc-thumb';
      t.innerHTML = '<img loading="lazy" alt="Vásárlói fotó: ' + esc(p.pn) + '" src="' + BASE + esc(p.id) + '_t.webp"><span>' + esc(p.n) + '</span>';
      t.addEventListener('click', function () { lightbox(p); });
      row.appendChild(t);
    });
    if (holder) { holder.insertBefore(box, holder.querySelector('#module_productreview_wrapper')); return; }
    var anchor = document.querySelector('#module_productreview_wrapper');
    if (anchor) { anchor.parentNode.insertBefore(box, anchor); }
  }

  /* ---------- gallery ---------- */
  function gallery(root, list) {
    var wrap = document.createElement('div');
    if (!list || !list.length) {
      wrap.innerHTML = '<p>Hamarosan itt lesznek az első fotók.</p>';
      root.appendChild(wrap);
      return;
    }
    wrap.className = 'rr-ugc-grid';
    list.forEach(function (p) {
      var c = document.createElement('div');
      c.className = 'rr-ugc-card';
      c.innerHTML = '<img loading="lazy" alt="Vásárlói fotó: ' + esc(p.pn) + '" src="' + BASE + esc(p.id) + '_t.webp">' +
        '<div><a href="' + productUrl(p.p) + '">' + esc(p.pn) + '</a><br>' + esc(p.n) + (p.d ? ', ' + huDate(p.d) : '') +
        (p.c ? '<i>' + esc(p.c) + '</i>' : '') + '</div>';
      c.querySelector('img').addEventListener('click', function () { lightbox(p); });
      wrap.appendChild(c);
    });
    root.appendChild(wrap);
  }

  /* ---------- upload form ---------- */
  var ERR = {
    bad_link: 'Ez a link nem érvényes. Írj nekünk az info@ragnarock.hu címre, és segítünk.',
    limit: 'Erre a rendelésre már elküldted a fotókat. Köszönjük!',
    consent: 'Kérjük, pipáld be a hozzájárulást.',
    too_big: 'Ez a kép túl nagy. Próbálj egy másikat.',
    not_image: 'Ezt a fájlt nem tudjuk képként megnyitni. Próbáld JPG formátumban.',
    bad_product: 'Válaszd ki, melyik termékről készült a fotó.',
    busy: 'Most épp sokan küldenek fotót, próbáld újra egy perc múlva.',
    server: 'Valami hiba történt. Próbáld újra később, vagy írj az info@ragnarock.hu címre.'
  };
  function shrink(file, done) {   /* longest side 1600 px, JPEG: small upload, no location data (EXIF dropped) */
    function draw(src, w, h) {
      var k = Math.min(1, 1600 / Math.max(w, h)), c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      done(c.toDataURL('image/jpeg', 0.85));
    }
    if (window.createImageBitmap) {
      createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (b) { draw(b, b.width, b.height); }, function () { done(null); });
      return;
    }
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () { draw(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url); };
    img.onerror = function () { done(null); };
    img.src = url;
  }
  function form(root, token) {
    var box = document.createElement('div');
    box.className = 'rr-ugc-box';
    box.innerHTML = '<p>Betöltés...</p>';
    root.appendChild(box);
    getJSON(APP + '?rr=photo&a=order&t=' + encodeURIComponent(token), function (o) {
      if (!o || !o.ok) { box.innerHTML = '<p>' + ERR[(o && o.error) || 'server'] + '</p>'; return; }
      if (o.used >= o.max) { box.innerHTML = '<p>' + ERR.limit + '</p>'; return; }
      var opts = o.products.map(function (p, i) {
        return '<label><input type="radio" name="rr-ugc-p" value="' + esc(p.id) + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(p.name) + '</label>';
      }).join('');
      box.innerHTML = '<h2>' + (o.first ? 'Szia ' + esc(o.first) + '! ' : '') + 'Mutasd meg a fotódat!</h2>' +
        '<p>Melyik termékről készült a fotó?</p>' + opts +
        '<p style="margin-top:14px">Fotó (rajtad, nálad otthon, a koncerten, bárhol):</p>' +
        '<input type="file" accept="image/*" class="rr-ugc-file"><img class="rr-ugc-prev" alt="">' +
        '<p style="margin-top:14px">Pár szó a fotóhoz (nem kötelező):</p><textarea maxlength="200" class="rr-ugc-cap"></textarea>' +
        '<label><input type="checkbox" class="rr-ugc-ok"> Hozzájárulok, hogy a fotó és a keresztnevem megjelenjen a RagnaRock webshopban.</label>' +
        '<button type="button" class="rr-ugc-btn">Fotó küldése</button><div class="rr-ugc-msg"></div>';
      var file = box.querySelector('.rr-ugc-file'), prev = box.querySelector('.rr-ugc-prev'), msg = box.querySelector('.rr-ugc-msg');
      var btn = box.querySelector('.rr-ugc-btn'), data = null;
      file.addEventListener('change', function () {
        data = null; prev.style.display = 'none'; msg.textContent = '';
        if (!file.files || !file.files[0]) { return; }
        msg.textContent = 'Kép előkészítése...';
        shrink(file.files[0], function (d) {
          data = d;
          msg.textContent = d ? '' : ERR.not_image;
          if (d) { prev.src = d; prev.style.display = 'block'; }
        });
      });
      btn.addEventListener('click', function () {
        var pick = box.querySelector('input[name="rr-ugc-p"]:checked');
        if (!data) { msg.textContent = 'Válassz ki egy fotót.'; return; }
        if (!box.querySelector('.rr-ugc-ok').checked) { msg.textContent = ERR.consent; return; }
        btn.disabled = true; msg.textContent = 'Küldés...';
        var x = new XMLHttpRequest();
        x.open('POST', APP + '?rr=photo', true);
        x.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
        x.onload = function () {
          var r = null;
          try { r = JSON.parse(x.responseText); } catch (e) { /* bad */ }
          btn.disabled = false;
          if (r && r.ok) {
            o.used++;
            box.innerHTML = '<h2>Köszönjük!</h2><p>Megkaptuk a fotódat. Jóváhagyás után megjelenik a termék oldalán és itt, a Vásárlóink fotói között.</p>' +
              (o.used < o.max ? '<button type="button" class="rr-ugc-btn">Küldök még egyet</button>' : '');
            var again = box.querySelector('.rr-ugc-btn');
            if (again) { again.addEventListener('click', function () { box.remove(); form(root, token); }); }
            return;
          }
          msg.textContent = ERR[(r && r.error) || 'server'] || ERR.server;
        };
        x.onerror = function () { btn.disabled = false; msg.textContent = ERR.server; };
        x.send(JSON.stringify({ t: token, product: pick ? pick.value : '', caption: box.querySelector('.rr-ugc-cap').value, consent: true, image: data }));
      });
    });
  }

  function run() {
    if (onPage) {
      var root = document.getElementById('rr-photos');
      if (!root) { return; }
      var t = (location.search.match(/[?&]t=([^&#]+)/) || [])[1];
      var formRoot = document.createElement('div'), galRoot = document.createElement('div');
      root.appendChild(formRoot); root.appendChild(galRoot);
      if (t) { form(formRoot, decodeURIComponent(t)); }
      getJSON(BASE + 'photos.json', function (j) { gallery(galRoot, j && j.photos); });
      return;
    }
    slot();   /* reviews move up at once; the photos follow when the JSON arrives */
    getJSON(BASE + 'photos.json', function (j) { strip(j && j.photos); });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); } else { run(); }
})();

/* Hűségszintek (owner 2026-11-17: Bronz / Ezüst 30 000 / Arany 60 000 / Gyémánt 90 000 Ft in 12 months -> 3 / 5 / 7 / 9%
   points; "nice looking little logos visible all the time everywhere"). Faceted rhombus gems from
   site-changes/2026-11-17_tiers/gems.py. window.RRTIER is shared with the hűségpont info box and the cart / checkout notice.
   Header (every page): a gem left of the cart button. Guests see the Gyémánt gem; logged-in customers see their own
   level (with its name on desktop). Click opens the level panel: own level, 12-month total, distance to the next level,
   the four levels. The level comes from the order tracker web app (GET ?rr=tier, LoyaltyTiers.js) with the account id
   and the sha256 of the account email (no email leaves the browser), kept 6 hours in localStorage. The extra points are
   paid by the PC nightly (rockoff-upload/src/loyalty/tier_bonus.py). No per-frame work. */
(function () {
  'use strict';
  if (window.RRTIER || !document.body) { return; }
  var APP = 'https://script.google.com/macros/s/AKfycbyZxl9EjPVUhT8_JxnLLPP6aswr6g62pXVs3MqyfdTOLYV3kC3UxfUy84emPbJ8sp34tw/exec';
  var GEMS = {
    bronz: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" style="overflow:visible" aria-hidden="true"><defs><linearGradient id="fr§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:#ffe0bd"/><stop offset="0.18" style="stop-color:#e7a76c"/><stop offset="0.45" style="stop-color:#7a3d17"/><stop offset="0.62" style="stop-color:#b46a33"/><stop offset="0.8" style="stop-color:#7a3d17"/><stop offset="1" style="stop-color:#3d1c0a"/></linearGradient><linearGradient id="tl§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:#e7a76c"/><stop offset="0.35" style="stop-color:#ffe0bd"/><stop offset="0.6" style="stop-color:#b46a33"/><stop offset="1" style="stop-color:#e7a76c"/></linearGradient><linearGradient id="tr§" x1="1" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:#b46a33"/><stop offset="0.4" style="stop-color:#e7a76c"/><stop offset="0.7" style="stop-color:#b46a33"/><stop offset="1" style="stop-color:#7a3d17"/></linearGradient><linearGradient id="br§" x1="1" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:#3d1c0a"/><stop offset="0.5" style="stop-color:#7a3d17"/><stop offset="1" style="stop-color:#b46a33"/></linearGradient><linearGradient id="bl§" x1="0" y1="1" x2="1" y2="0"><stop offset="0" style="stop-color:#7a3d17"/><stop offset="0.45" style="stop-color:#b46a33"/><stop offset="0.75" style="stop-color:#e7a76c"/><stop offset="1" style="stop-color:#7a3d17"/></linearGradient><radialGradient id="glow§"><stop offset="0" style="stop-color:#ffffff;stop-opacity:.9"/><stop offset="1" style="stop-color:#ffffff;stop-opacity:0"/></radialGradient></defs><polygon points="20,1 39,24 20,47 1,24" style="fill:url(#fr§)"/><polygon points="20,5.6 20,24 4.8,24" style="fill:url(#tl§)"/><polygon points="20,5.6 35.2,24 20,24" style="fill:url(#tr§)"/><polygon points="20,24 35.2,24 20,42.4" style="fill:url(#br§)"/><polygon points="4.8,24 20,24 20,42.4" style="fill:url(#bl§)"/><polyline points="4.8,24 20,5.6 35.2,24" style="fill:none;stroke:#ffe0bd;stroke-width:.9;stroke-opacity:.9"/><polyline points="35.2,24 20,42.4 4.8,24" style="fill:none;stroke:#3d1c0a;stroke-width:.9;stroke-opacity:.8"/><path d="M20 5.6L20 24L20 42.4M4.8 24L35.2 24" style="stroke:#ffe0bd;stroke-width:.5;stroke-opacity:.45"/><polygon points="17.264,8.912 11.64,15.72 14.68,24 20,13.88" style="fill:#ffffff;opacity:.35"/><polygon points="20,1 39,24 20,47 1,24" style="fill:none;stroke:#0a1420;stroke-width:1.4;stroke-linejoin:round"/><polygon points="20,2.38 37.86,24 20,45.62 2.14,24" style="fill:none;stroke:#ffe0bd;stroke-width:.6;stroke-opacity:.55"/><circle cx="13.5" cy="15.5" r="3.52" style="fill:url(#glow§)"/><path d="M13.5 12.3C13.82 14.9667 14.0333 15.18 16.7 15.5C14.0333 15.82 13.82 16.0333 13.5 18.7C13.18 16.0333 12.9667 15.82 10.3 15.5C12.9667 15.18 13.18 14.9667 13.5 12.3Z" style="fill:#ffffff;opacity:0.95"/></svg>',
    ezust: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" style="overflow:visible" aria-hidden="true"><defs><linearGradient id="fr§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:#ffffff"/><stop offset="0.18" style="stop-color:#dfe6ec"/><stop offset="0.45" style="stop-color:#5f6a75"/><stop offset="0.62" style="stop-color:#9faab5"/><stop offset="0.8" style="stop-color:#5f6a75"/><stop offset="1" style="stop-color:#2e353c"/></linearGradient><linearGradient id="tl§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:#dfe6ec"/><stop offset="0.35" style="stop-color:#ffffff"/><stop offset="0.6" style="stop-color:#9faab5"/><stop offset="1" style="stop-color:#dfe6ec"/></linearGradient><linearGradient id="tr§" x1="1" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:#9faab5"/><stop offset="0.4" style="stop-color:#dfe6ec"/><stop offset="0.7" style="stop-color:#9faab5"/><stop offset="1" style="stop-color:#5f6a75"/></linearGradient><linearGradient id="br§" x1="1" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:#2e353c"/><stop offset="0.5" style="stop-color:#5f6a75"/><stop offset="1" style="stop-color:#9faab5"/></linearGradient><linearGradient id="bl§" x1="0" y1="1" x2="1" y2="0"><stop offset="0" style="stop-color:#5f6a75"/><stop offset="0.45" style="stop-color:#9faab5"/><stop offset="0.75" style="stop-color:#dfe6ec"/><stop offset="1" style="stop-color:#5f6a75"/></linearGradient><radialGradient id="glow§"><stop offset="0" style="stop-color:#ffffff;stop-opacity:.9"/><stop offset="1" style="stop-color:#ffffff;stop-opacity:0"/></radialGradient></defs><polygon points="20,1 39,24 20,47 1,24" style="fill:url(#fr§)"/><polygon points="20,5.6 20,24 4.8,24" style="fill:url(#tl§)"/><polygon points="20,5.6 35.2,24 20,24" style="fill:url(#tr§)"/><polygon points="20,24 35.2,24 20,42.4" style="fill:url(#br§)"/><polygon points="4.8,24 20,24 20,42.4" style="fill:url(#bl§)"/><polyline points="4.8,24 20,5.6 35.2,24" style="fill:none;stroke:#ffffff;stroke-width:.9;stroke-opacity:.9"/><polyline points="35.2,24 20,42.4 4.8,24" style="fill:none;stroke:#2e353c;stroke-width:.9;stroke-opacity:.8"/><path d="M20 5.6L20 24L20 42.4M4.8 24L35.2 24" style="stroke:#ffffff;stroke-width:.5;stroke-opacity:.45"/><polygon points="17.264,8.912 11.64,15.72 14.68,24 20,13.88" style="fill:#ffffff;opacity:.35"/><polygon points="20,1 39,24 20,47 1,24" style="fill:none;stroke:#0a1420;stroke-width:1.4;stroke-linejoin:round"/><polygon points="20,2.38 37.86,24 20,45.62 2.14,24" style="fill:none;stroke:#ffffff;stroke-width:.6;stroke-opacity:.55"/><circle cx="13.5" cy="15.5" r="3.52" style="fill:url(#glow§)"/><path d="M13.5 12.3C13.82 14.9667 14.0333 15.18 16.7 15.5C14.0333 15.82 13.82 16.0333 13.5 18.7C13.18 16.0333 12.9667 15.82 10.3 15.5C12.9667 15.18 13.18 14.9667 13.5 12.3Z" style="fill:#ffffff;opacity:0.95"/></svg>',
    arany: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" style="overflow:visible" aria-hidden="true"><defs><linearGradient id="fr§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:#fff7c9"/><stop offset="0.18" style="stop-color:#f5d24f"/><stop offset="0.45" style="stop-color:#8a5f06"/><stop offset="0.62" style="stop-color:#c99418"/><stop offset="0.8" style="stop-color:#8a5f06"/><stop offset="1" style="stop-color:#4d3200"/></linearGradient><linearGradient id="tl§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:#f5d24f"/><stop offset="0.35" style="stop-color:#fff7c9"/><stop offset="0.6" style="stop-color:#c99418"/><stop offset="1" style="stop-color:#f5d24f"/></linearGradient><linearGradient id="tr§" x1="1" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:#c99418"/><stop offset="0.4" style="stop-color:#f5d24f"/><stop offset="0.7" style="stop-color:#c99418"/><stop offset="1" style="stop-color:#8a5f06"/></linearGradient><linearGradient id="br§" x1="1" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:#4d3200"/><stop offset="0.5" style="stop-color:#8a5f06"/><stop offset="1" style="stop-color:#c99418"/></linearGradient><linearGradient id="bl§" x1="0" y1="1" x2="1" y2="0"><stop offset="0" style="stop-color:#8a5f06"/><stop offset="0.45" style="stop-color:#c99418"/><stop offset="0.75" style="stop-color:#f5d24f"/><stop offset="1" style="stop-color:#8a5f06"/></linearGradient><radialGradient id="glow§"><stop offset="0" style="stop-color:#ffffff;stop-opacity:.9"/><stop offset="1" style="stop-color:#ffffff;stop-opacity:0"/></radialGradient></defs><polygon points="20,1 39,24 20,47 1,24" style="fill:url(#fr§)"/><polygon points="20,5.6 20,24 4.8,24" style="fill:url(#tl§)"/><polygon points="20,5.6 35.2,24 20,24" style="fill:url(#tr§)"/><polygon points="20,24 35.2,24 20,42.4" style="fill:url(#br§)"/><polygon points="4.8,24 20,24 20,42.4" style="fill:url(#bl§)"/><polyline points="4.8,24 20,5.6 35.2,24" style="fill:none;stroke:#fff7c9;stroke-width:.9;stroke-opacity:.9"/><polyline points="35.2,24 20,42.4 4.8,24" style="fill:none;stroke:#4d3200;stroke-width:.9;stroke-opacity:.8"/><path d="M20 5.6L20 24L20 42.4M4.8 24L35.2 24" style="stroke:#fff7c9;stroke-width:.5;stroke-opacity:.45"/><polygon points="17.264,8.912 11.64,15.72 14.68,24 20,13.88" style="fill:#ffffff;opacity:.35"/><polygon points="20,1 39,24 20,47 1,24" style="fill:none;stroke:#0a1420;stroke-width:1.4;stroke-linejoin:round"/><polygon points="20,2.38 37.86,24 20,45.62 2.14,24" style="fill:none;stroke:#fff7c9;stroke-width:.6;stroke-opacity:.55"/><circle cx="13.5" cy="15.5" r="3.52" style="fill:url(#glow§)"/><path d="M13.5 12.3C13.82 14.9667 14.0333 15.18 16.7 15.5C14.0333 15.82 13.82 16.0333 13.5 18.7C13.18 16.0333 12.9667 15.82 10.3 15.5C12.9667 15.18 13.18 14.9667 13.5 12.3Z" style="fill:#ffffff;opacity:0.95"/></svg>',
    gyemant: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" style="overflow:visible" aria-hidden="true"><defs><radialGradient id="glow§"><stop offset="0" style="stop-color:#ffffff;stop-opacity:.95"/><stop offset=".35" style="stop-color:#d8f6ff;stop-opacity:.55"/><stop offset="1" style="stop-color:#9fe3ff;stop-opacity:0"/></radialGradient><radialGradient id="halo§"><stop offset=".55" style="stop-color:#7fd6ff;stop-opacity:.45"/><stop offset="1" style="stop-color:#7fd6ff;stop-opacity:0"/></radialGradient><linearGradient id="tb§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:#ffffff"/><stop offset="0.45" style="stop-color:#d4f3ff"/><stop offset="0.7" style="stop-color:#ffffff"/><stop offset="1" style="stop-color:#9fdcfb"/></linearGradient></defs><ellipse cx="20" cy="24" rx="23" ry="27" style="fill:url(#halo§)"/><polygon points="20,1 10.5,12.5 20,12.5" style="fill:#ffffff"/><polygon points="10.5,12.5 10.5,24 20,12.5" style="fill:#bfeaff"/><polygon points="10.5,12.5 1,24 10.5,24" style="fill:#e6f8ff"/><polygon points="20,1 20,12.5 29.5,12.5" style="fill:#bfeaff"/><polygon points="29.5,12.5 20,12.5 29.5,24" style="fill:#ffffff"/><polygon points="29.5,12.5 29.5,24 39,24" style="fill:#8fd6f8"/><polygon points="39,24 29.5,24 29.5,35.5" style="fill:#5cb8ee"/><polygon points="29.5,35.5 29.5,24 20,35.5" style="fill:#8fd6f8"/><polygon points="29.5,35.5 20,35.5 20,47" style="fill:#2f86d0"/><polygon points="1,24 10.5,35.5 10.5,24" style="fill:#8fd6f8"/><polygon points="10.5,35.5 20,35.5 10.5,24" style="fill:#bfeaff"/><polygon points="10.5,35.5 20,47 20,35.5" style="fill:#5cb8ee"/><polygon points="20,12.5 29.5,24 20,35.5 10.5,24" style="fill:url(#tb§)"/><polygon points="20,12.5 20,24 10.5,24" style="fill:#ffffff;opacity:.55"/><polygon points="20,24 29.5,24 20,35.5" style="fill:#5cb8ee;opacity:.35"/><polygon points="29.5,14.8 33.775,17.675 34.25,24" style="fill:#ffd2f2;opacity:.75"/><polygon points="10.5,32.05 6.225,24 5.75,29.75" style="fill:#fff2a8;opacity:.7"/><polygon points="26.65,35.5 23.8,42.4 20,41.25" style="fill:#c9ffe8;opacity:.6"/><path d="M20 1L20 12.5M39 24L29.5 24M20 47L20 35.5M1 24L10.5 24M10.5 12.5L20 12.5M10.5 12.5L10.5 24M29.5 12.5L20 12.5M29.5 12.5L29.5 24M29.5 35.5L29.5 24M29.5 35.5L20 35.5M10.5 35.5L20 35.5M10.5 35.5L10.5 24" style="stroke:#ffffff;stroke-width:.45;stroke-opacity:.7"/><polygon points="20,12.5 29.5,24 20,35.5 10.5,24" style="fill:none;stroke:#ffffff;stroke-width:.7;stroke-opacity:.9"/><polygon points="20,1 39,24 20,47 1,24" style="fill:none;stroke:#0a1420;stroke-width:1.3;stroke-linejoin:round"/><circle cx="13" cy="13" r="6.05" style="fill:url(#glow§)"/><path d="M13 7.5C13.55 12.0833 13.9167 12.45 18.5 13C13.9167 13.55 13.55 13.9167 13 18.5C12.45 13.9167 12.0833 13.55 7.5 13C12.0833 12.45 12.45 12.0833 13 7.5Z" style="fill:#ffffff;opacity:1.0"/><circle cx="31" cy="31" r="3.52" style="fill:url(#glow§)"/><path d="M31 27.8C31.32 30.4667 31.5333 30.68 34.2 31C31.5333 31.32 31.32 31.5333 31 34.2C30.68 31.5333 30.4667 31.32 27.8 31C30.4667 30.68 30.68 30.4667 31 27.8Z" style="fill:#ffffff;opacity:0.9"/><circle cx="30" cy="9" r="2.64" style="fill:url(#glow§)"/><path d="M30 6.6C30.24 8.6 30.4 8.76 32.4 9C30.4 9.24 30.24 9.4 30 11.4C29.76 9.4 29.6 9.24 27.6 9C29.6 8.76 29.76 8.6 30 6.6Z" style="fill:#ffffff;opacity:0.85"/><circle cx="10.5" cy="34" r="2.2" style="fill:url(#glow§)"/><path d="M10.5 32C10.7 33.6667 10.8333 33.8 12.5 34C10.8333 34.2 10.7 34.3333 10.5 36C10.3 34.3333 10.1667 34.2 8.5 34C10.1667 33.8 10.3 33.6667 10.5 32Z" style="fill:#ffffff;opacity:0.8"/></svg>',
  };
  var LEVELS = [{ k: 'bronz', n: 'Bronz', r: 3, at: 0 }, { k: 'ezust', n: 'Ezüst', r: 5, at: 30000 },
    { k: 'arany', n: 'Arany', r: 7, at: 60000 }, { k: 'gyemant', n: 'Gyémánt', r: 9, at: 90000 }];
  var me = null, loaded = false, waiting = [];

  function ft(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft'; }   /* never broken across lines */
  var gid = 0;   /* every copy gets its own gradient ids: a gradient inside a hidden copy would blank the others */
  function gem(k, h) { gid++; return GEMS[k].replace(/§/g, '_' + gid).replace('<svg ', '<svg class="rr-gem" width="' + Math.round(h * 40 / 48) + '" height="' + h + '" '); }
  function levelOf(spend) { var L = LEVELS[0]; for (var i = 0; i < LEVELS.length; i++) { if (spend >= LEVELS[i].at) { L = LEVELS[i]; } } return L; }
  function nextOf(L) { var i = LEVELS.indexOf(L); return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null; }
  function ladder(cur) {
    var h = '<div class="rr-tlad">';
    for (var i = 0; i < LEVELS.length; i++) {
      var L = LEVELS[i];
      h += '<div class="rr-tlad-i' + (cur && cur.k === L.k ? ' on' : '') + '">' + gem(L.k, 42) + '<b>' + L.n + '</b><span>' + L.r +
        '% pont</span><i>' + (L.at ? ft(L.at) + '-tól' : 'regisztrációval') + '</i></div>';
    }
    return h + '</div>';
  }
  function mini(sz) { var h = ''; for (var i = 0; i < LEVELS.length; i++) { h += gem(LEVELS[i].k, sz || 20); } return '<span class="rr-tmini">' + h + '</span>'; }
  function art(n) { return /^[AEIOUÁÉÍÓÖŐÚÜŰ]/.test(n) ? 'az' : 'a'; }
  function lrow(sz) {   /* the four levels in one row (cart / checkout) */
    var h = '<div class="rr-lrow">';
    for (var i = 0; i < LEVELS.length; i++) {
      var L = LEVELS[i];
      h += '<span>' + gem(L.k, sz || 26) + '<span><b>' + L.n + ' ' + L.r + '%</b><i>' + (L.at ? ft(L.at) + '-tól' : 'regisztrációval') + '</i></span></span>';
    }
    return h + '</div>';
  }
  var cartT = null;
  function cartTotal(cb) {   /* the mini-cart endpoint: basket total */
    var x = new XMLHttpRequest();
    x.open('POST', '/index.php?route=module/cart/callback', true);
    x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    x.onloadend = function () { var n = 0; try { n = Number(String(JSON.parse(x.responseText).total || '').replace(/[^0-9]/g, '')) || 0; } catch (e) { n = 0; } cb(n); };
    x.send();
  }
  function summary(total, m) {   /* one line for small places (add-to-cart popup, mini cart); m = own level or null */
    if (!total) { return ''; }
    if (!m) {
      return mini(18) + ' Bejelentkezve erre a kosárra kb. <b>' + Math.round(total / 33) + ' pont</b> jár. <a href="/husegprogram" data-rrt="1">Hűségszintek: akár 9% pont</a>';
    }
    var N = nextOf(m.L), R = levelOf(m.spend + total);
    if (R.r > m.L.r) {
      return gem(R.k, 22) + ' Ezzel a rendeléssel <b>' + R.n + '</b> szintre lépsz: erre a kosárra kb. <b>' + Math.round(total * R.r / 100) + ' pont</b> (' + R.r + '%).';
    }
    return gem(m.L.k, 22) + ' <b>' + m.L.n + '</b> szint: erre a kosárra kb. <b>' + Math.round(total * m.L.r / 100) + ' pont</b> (' + m.L.r + '%).' +
      (N ? ' Még <b>' + ft(N.at - m.spend - total) + '</b> ' + art(N.n) + ' <b>' + N.n + '</b> szintig.' : '');
  }
  function popup() {   /* Shoprenter's "Kosárba raktad!" box (fancybox) */
    var boxes = document.querySelectorAll('.cart-popup__box');
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (b.querySelector('.rr-tier-pop')) { continue; }
      var d = document.createElement('div'), close = b.querySelector('.message-close'), row = close && close.parentNode;
      d.className = 'rr-tier-pop';
      if (row && row.parentNode && b.contains(row)) { row.parentNode.insertBefore(d, row); } else { b.appendChild(d); }
      d.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-rrt]')) { e.preventDefault(); open(); } });
      (function (d) { cartTotal(function (tot) { get(function (m) { d.innerHTML = summary(tot, m); }); }); })(d);
    }
  }
  if (window.MutationObserver) {
    var pt = null;
    new MutationObserver(function () {   /* the popup fills in a moment after its container appears */
      clearTimeout(pt); pt = setTimeout(popup, 250); setTimeout(popup, 900); setTimeout(popup, 2000);
    }).observe(document.body, { childList: true });
  }
  function user() { var c = window.ShopRenter && ShopRenter.customer; return c && Number(c.userId) > 0 && c.email ? c : null; }
  function hex(buf) { var a = new Uint8Array(buf), s = ''; for (var i = 0; i < a.length; i++) { s += ('0' + a[i].toString(16)).slice(-2); } return s; }
  function load(cb) {
    var u = user(), key, raw = null;
    if (!u) { cb(null); return; }
    key = 'rr-tier-' + u.userId;
    function done(s) { me = { spend: s, L: levelOf(s) }; cb(me); }
    try { raw = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { raw = null; }
    if (raw && typeof raw.s === 'number' && Date.now() - raw.t < 6 * 3600000) { done(raw.s); return; }
    if (!window.crypto || !crypto.subtle || !window.TextEncoder || !window.fetch) { cb(null); return; }
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(u.email).trim().toLowerCase())).then(function (b) {
      return fetch(APP + '?rr=tier&u=' + encodeURIComponent(u.userId) + '&h=' + hex(b));
    }).then(function (r) { return r.json(); }).then(function (d) {
      var s = d && typeof d.spend === 'number' ? d.spend : 0;
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), s: s })); } catch (e) { /* private mode */ }
      done(s);
    }).catch(function () { cb(null); });
  }
  function get(cb) {
    if (loaded) { cb(me); return; }
    waiting.push(cb);
    if (waiting.length > 1) { return; }
    load(function (m) { loaded = true; var w = waiting; waiting = []; for (var i = 0; i < w.length; i++) { w[i](m); } });
  }

  function open() {
    get(function (m) {
      var bg = document.createElement('div'), N = m && nextOf(m.L), body;
      if (m) {
        body = '<div class="rr-tp-me">' + gem(m.L.k, 68) + '<div><b>' + m.L.n + ' szint</b><span>' + m.L.r +
          '% pont minden rendelésed után</span><i>Az elmúlt 12 hónapban: ' + ft(m.spend) + '</i></div></div>' +
          (N ? '<p class="rr-tp-next">Még <b>' + ft(N.at - m.spend) + '</b>, és ' + gem(N.k, 22) + ' <b>' + N.n + '</b> szintre lépsz (' + N.r + '% pont).</p>' +
            '<div class="rr-tp-bar"><span style="width:' + Math.max(3, Math.min(100, Math.round((m.spend - m.L.at) / (N.at - m.L.at) * 100))) + '%"></span></div>'
            : '<p class="rr-tp-next">A legmagasabb szinten vagy. Köszönjük, hogy velünk vagy!</p>');
      } else {
        body = '<p>Minden bejelentkezve leadott rendelésed után hűségpont jár, és minél többet vásárolsz egy év alatt, annál több.</p>';
      }
      bg.className = 'rr-tp-bg';
      bg.innerHTML = '<div class="rr-tp" role="dialog" aria-modal="true" aria-label="Hűségszintek">' +
        '<button type="button" class="rr-tp-x" aria-label="Bezárás">×</button><h3>Hűségszintek</h3>' + body + ladder(m && m.L) +
        '<p class="rr-tp-f">A szinted az elmúlt 12 hónapban bejelentkezve leadott és megkapott rendeléseid összegétől függ. ' +
        'Már az a rendelés is a magasabb szint szerint kap pontot, amelyikkel átléped a határt. 1 pont = 1 Ft.</p>' +
        (m ? '' : '<div class="rr-tp-btns"><a class="p" href="/customer/login">Belépés</a><a class="s" href="/customer/register">Regisztráció</a></div>') +
        '<a class="rr-tp-more" href="/husegprogram">A hűségprogram részletei</a></div>';
      function close() { bg.remove(); document.removeEventListener('keydown', key); }
      function key(e) { if (e.key === 'Escape') { close(); } }
      bg.addEventListener('click', function (e) { if (e.target === bg || e.target.classList.contains('rr-tp-x')) { close(); } });
      document.addEventListener('keydown', key);
      document.body.appendChild(bg);
      try { if (window.gtag) { window.gtag('event', 'rr_tier_open', { rr_tier: m ? m.L.k : 'guest' }); } } catch (x) { /* */ }
    });
  }

  /* desktop: the gem on the "Hűségprogram" link of the top bar (logged in: "<level> szint"); phones: the gem floats left of
     the cart button (#js-cart is position:relative and stays; only the cart inside it is re-rendered by AJAX) */
  var tries = 0, spots = [];
  function paint(m) {
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      s.g.innerHTML = gem(m ? m.L.k : 'gyemant', s.h);
      if (s.t) { s.t.textContent = m ? m.L.n + ' szint' : s.orig; }
      s.a.title = m ? m.L.n + ' szint: ' + m.L.r + '% pont' : 'Hűségszintek: akár 9% pont';
    }
  }
  function spot(a, g, t, h) {
    spots.push({ a: a, g: g, t: t, h: h, orig: t ? t.textContent : '' });
    a.addEventListener('click', function (e) { e.preventDefault(); open(); });
  }
  function badge() {
    if (document.getElementById('rr-tier-m')) { return; }
    var nav = document.querySelector('a.nav-link[href*="husegprogram"]'), box = document.getElementById('js-cart');
    if (!box) { if (tries++ < 20) { setTimeout(badge, 400); } return; }
    if (nav && !nav.querySelector('.rr-tier-n')) {
      var li = nav.closest('li');   /* owner 2026-11-17: the last item of the top bar, after Kapcsolat */
      if (li && li.parentNode && li.parentNode.lastElementChild !== li) { li.parentNode.appendChild(li); }
      var txt = (nav.textContent || '').trim() || 'Hűségprogram';
      nav.innerHTML = '<span class="rr-tier-n"></span><span class="rr-tier-nt"></span>';
      nav.classList.add('rr-tier-link');
      nav.lastChild.textContent = txt;
      spot(nav, nav.firstChild, nav.lastChild, 29);
    }
    var a = document.createElement('a');
    a.id = 'rr-tier-m';
    a.className = 'rr-tier-m';
    a.href = '/husegprogram';
    a.setAttribute('aria-label', 'Hűségszintek');
    a.appendChild(document.createElement('span'));
    box.insertBefore(a, box.firstChild);
    spot(a, a.firstChild, null, 31);
    paint(null);
    get(function (m) { if (m) { paint(m); } });
  }

  var st = document.createElement('style');
  st.textContent =
    '.rr-gem{display:inline-block;vertical-align:middle;flex:none}' +
    '.rr-tier-n{display:inline-block;vertical-align:middle;margin:-9px 7px -9px 0;line-height:0}' +   /* no extra line height */
    '#js-cart .rr-tier-m,.rr-tier-m{display:none!important;position:absolute;right:100%;top:50%;transform:translateY(-50%);margin-right:4px;padding:4px;line-height:0;z-index:2}' +
    '.rr-tier-m:hover .rr-gem,.nav-link:hover .rr-tier-n .rr-gem{filter:brightness(1.15)}' +
    '@media (max-width:991px){#js-cart .rr-tier-m,.rr-tier-m{display:block!important}}' +
    '.rr-tmini{display:inline-flex;gap:2px;vertical-align:middle;margin-right:4px}' +
    '.rr-tlad{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:12px 0}' +
    '.rr-tlad-i{text-align:center;padding:10px 2px 8px;border:1px solid #1d4361;border-radius:8px;background:#041a2c}' +
    '.rr-tlad-i.on{border-color:#9fd6f7;background:#0b3456}' +
    '.rr-tlad-i b{display:block;color:#fff;font-size:13px;margin-top:6px}.rr-tlad-i span{display:block;color:#9fd6f7;font-weight:700;font-size:13px}' +
    '.rr-tlad-i i{display:block;font-style:normal;color:#7f93a6;font-size:11px;line-height:1.3}' +
    '.rr-tp-bg{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:100001;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.rr-tp{position:relative;background:#06243b;border:1px solid #3a7aa6;border-radius:12px;max-width:460px;width:100%;max-height:88vh;overflow:auto;' +
      'padding:22px 20px 18px;color:#c9d8e6;font-size:15px;line-height:1.55;box-shadow:0 12px 40px rgba(0,0,0,.6);text-align:center}' +
    '.rr-tp h3{color:#fff;font-size:20px;margin:0 0 12px;padding-right:28px}.rr-tp p{margin:0 0 10px}.rr-tp b{color:#fff}' +
    '.rr-tp-x{position:absolute;top:8px;right:10px;background:none;border:0;color:#fff;font-size:26px;line-height:1;cursor:pointer;padding:4px 8px}' +
    '.rr-tp-me{display:flex;align-items:center;justify-content:center;gap:14px;margin:0 0 10px;text-align:left}.rr-tp-me b{display:block;font-size:19px}' +
    '.rr-tp-me span{display:block;color:#9fd6f7;font-weight:700}.rr-tp-me i{display:block;font-style:normal;color:#9fb3c6;font-size:14px}' +
    '.rr-tp-next .rr-gem{margin:-3px 0 0}.rr-tp-bar{height:8px;border-radius:4px;background:#041a2c;border:1px solid #1d4361;overflow:hidden;margin:0 0 6px}' +
    '.rr-tp-bar span{display:block;height:100%;background:linear-gradient(90deg,#3a7aa6,#9fd6f7)}' +
    '.rr-tp-f{font-size:13px;color:#9fb3c6}' +
    '.rr-tp-btns{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:6px}' +
    '.rr-tier-pop{margin:12px 0 4px;padding:10px 14px;border-radius:8px;background:#f4f8fb;border:1px solid #d3e2ee;border-left:4px solid #c99418;' +
      'color:#1f3448;font-size:14px;line-height:1.5;text-align:left}.rr-tier-pop b{color:#0b2239}.rr-tier-pop a{color:#0b5e9c;font-weight:700;text-decoration:underline}' +
    '.rr-tier-pop .rr-gem{margin:-3px 3px 0 0}.rr-tier-pop:empty{display:none}' +
    '.rr-lrow{display:flex;flex-wrap:wrap;gap:10px 18px;margin:10px 0 2px}.rr-lrow>span{display:inline-flex;align-items:center;gap:7px}' +
    '.rr-lrow>span>span{display:flex;flex-direction:column;line-height:1.2}.rr-lrow b{font-size:14px}.rr-lrow i{font-style:normal;font-size:12px;opacity:.75}' +
    '.rr-tp-btns a{display:inline-block;padding:10px 14px;border-radius:6px;font-weight:bold;font-size:14px;text-decoration:none!important}' +
    '.rr-tp-btns a.p{background:#e52421;color:#fff!important}.rr-tp-btns a.s{border:1px solid #7fc4ea;color:#fff!important}' +
    '.rr-tp-more{display:block;margin-top:12px;color:#9fd6f7!important;text-decoration:underline!important}';
  (document.head || document.documentElement).appendChild(st);

  window.RRTIER = { LEVELS: LEVELS, gem: gem, ladder: ladder, mini: mini, lrow: lrow, summary: summary, art: art, get: get, open: open, levelOf: levelOf, nextOf: nextOf,
    ft: ft, me: function () { return me; } };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', badge); } else { badge(); }
})();


/* Hűségpont info (owner 2026-11-17: "unreadable for a while"). The theme's hover tooltip next to "Szerezhető
   hűségpontok" was 1,100 px tall (it ran off the top of the screen), could not be scrolled, and its links were white on
   white. The (i) now opens a short box on click / tap, with working links. No per-frame work. */
(function () {
  'use strict';
  if (window.__rrLoyaltyInfo || !/product-page-body/.test(document.body ? document.body.className : '')) { return; }
  window.__rrLoyaltyInfo = true;
  var st = document.createElement('style');
  st.textContent =
    '.rr-lp-bg{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:100001;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.rr-lp{position:relative;background:#06243b;border:1px solid #3a7aa6;border-radius:12px;max-width:440px;width:100%;max-height:86vh;overflow:auto;' +
    'padding:22px 22px 18px;color:#c9d8e6;font-size:15px;line-height:1.55;box-shadow:0 12px 40px rgba(0,0,0,.6)}' +
    '.rr-lp h3{color:#fff;font-size:20px;margin:0 0 10px;padding-right:28px}.rr-lp p{margin:0 0 10px}.rr-lp b{color:#fff}' +
    '.rr-lp ul{margin:0 0 12px;padding-left:18px}.rr-lp li{margin:0 0 6px}' +
    '.rr-lp-x{position:absolute;top:8px;right:10px;background:none;border:0;color:#fff;font-size:26px;line-height:1;cursor:pointer;padding:4px 8px}' +
    '.rr-lp-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}' +
    '.rr-lp-btns a{display:inline-block;padding:10px 14px;border-radius:6px;font-weight:bold;font-size:14px;text-decoration:none!important}' +
    '.rr-lp-btns a.p{background:#e52421;color:#fff!important}.rr-lp-btns a.s{border:1px solid #7fc4ea;color:#fff!important}' +
    '.rr-lp-more{display:block;margin-top:12px;color:#9fd6f7!important;text-decoration:underline!important}' +
    '.product-parameter__loyaltypoints .component-tooltip{cursor:pointer;flex:none;margin-left:6px}' +
    'tr.product-parameter__loyaltypoints>td{vertical-align:middle!important}' +
    'tr.product-parameter__loyaltypoints .product-parameter__label{white-space:nowrap}' +
    'tr.product-parameter__loyaltypoints .product-parameter__value{font-size:18px!important;font-weight:700!important;color:#fff!important;white-space:nowrap}' +
    'tr.product-parameter__loyaltypoints .product-parameter__value:after{content:" pont";font-size:14px;font-weight:400;color:#9fd6f7}' +
    '.rr-tier-pl{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:2px 0 8px;font-size:14px;line-height:1.35}' +
    'td.rr-tier-pl-td{padding-top:0!important;border:0!important}' +
    '.rr-tier-pl a{color:#9fd6f7!important;text-decoration:underline!important}.rr-tier-pl b{color:#fff}';
  (document.head || document.documentElement).appendChild(st);

  function open() {
    var bg = document.createElement('div');
    bg.className = 'rr-lp-bg';
    bg.innerHTML = '<div class="rr-lp" role="dialog" aria-modal="true" aria-label="Hűségpontok">' +
      '<button type="button" class="rr-lp-x" aria-label="Bezárás">×</button>' +
      '<h3>Hűségpontok</h3>' +
      '<p><b>1 pont = 1 Ft</b> kedvezmény a következő rendelésedből.</p>' +
      (window.RRTIER ? '<p style="margin:12px 0 0"><b>Hűségszintek:</b> minél többet vásárolsz egy év alatt, annál több pont jár.</p>' + RRTIER.ladder() : '') +
      '<ul><li>Minden termék után jár pont, akciós terméknél az akciós ár után. A termék oldalán látod, mennyi. A szállítási díjra nem jár pont.</li>' +
      '<li>A pontokat a <b>bejelentkezve</b> leadott rendelések után írjuk jóvá, amint megkaptad a rendelésed.</li>' +
      '<li>Beváltás: 5 000 Ft feletti kosárértéknél, a pénztárban, bejelentkezve kiválaszthatod, hány pontot használsz fel. Egy rendelés összegének legfeljebb a fele fizethető pontokkal.</li></ul>' +
      '<div class="rr-lp-btns"><a class="p" href="/customer/login">Belépés</a><a class="s" href="/customer/register">Regisztráció</a></div>' +
      '<a class="rr-lp-more" href="/husegprogram">A hűségprogram részletei</a></div>';
    function close() { bg.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') { close(); } }
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.classList.contains('rr-lp-x')) { close(); } });
    document.addEventListener('keydown', key);
    document.body.appendChild(bg);
  }
  function tierLine(el) {   /* Hűségszintek (owner 2026-11-17): guests see the four gems, higher levels their own points */
    if (!window.RRTIER || document.querySelector('.rr-tier-pl')) { return; }
    var row = el.closest('.product-parameter__loyaltypoints') || el.parentNode, line = document.createElement('div');
    var nums = (row.textContent || '').replace(/[\s.\u00a0]/g, '').match(/\d+/g), base = nums ? Number(nums[nums.length - 1]) : 0;
    line.className = 'rr-tier-pl';
    line.innerHTML = RRTIER.mini(26) + '<a href="#" role="button">Hűségszintek: akár 9% pont</a>';
    line.addEventListener('click', function (e) { e.preventDefault(); RRTIER.open(); });
    if (row.tagName === 'TR') {   /* the points row is a table row: the line gets a full-width row of its own */
      var tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 2; td.className = 'rr-tier-pl-td'; td.appendChild(line); tr.appendChild(td);
      row.parentNode.insertBefore(tr, row.nextSibling);
    } else { row.parentNode.insertBefore(line, row.nextSibling); }
    RRTIER.get(function (m) {
      if (!m || m.L.r <= 3 || !base) { return; }
      line.innerHTML = RRTIER.gem(m.L.k, 27) + ' <a href="#" role="button"><b>' + m.L.n + '</b> szinten kb. <b>' + Math.round(base * 33 * m.L.r / 100) + ' pont</b> jár erre a termékre</a>';   /* base = price / 33; tier_bonus.py pays rate% of the price */
    });
  }
  var tries = 0;
  function hook() {
    var el = document.querySelector('.product-parameter__loyaltypoints .component-tooltip');
    if (!el) { if (tries++ < 25) { setTimeout(hook, 300); } return; }
    if (el.__rrLp) { return; }
    el.__rrLp = true;
    el.removeAttribute('data-tippy-content');   /* the theme reads it only when it builds the tooltip */
    if (el._tippy) { el._tippy.destroy(); }
    el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', 'Hűségpontok: részletek');
    el.textContent = '?';   /* owner 2026-11-17: a question mark, not an i */
    el.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(); }, true);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    tierLine(el);
    /* the theme may build its tooltip after us: remove it again when it appears */
    var n = 0;
    (function late() { if (el._tippy) { el._tippy.destroy(); } else if (n++ < 20) { setTimeout(late, 500); } })();
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', hook); } else { hook(); }
})();


/* Hűségpont notices in the cart and the checkout (owner 2026-11-17: only 23% of orders are placed logged in and almost
   nobody redeems points). One small inline box, never a popup, never sticky:
   1. guest: "Bejelentkezve erre a rendelésre kb. N hűségpontot kapnál ..." + Belépés / Regisztráció. N = the shop's own
      "+ N" row ("Ennyi hűségpontot kapnál regisztrált vásárlóként"), else product total / 50. Cart: above the checkout
      buttons. Checkout: top of the first step (Elérhetőség); Belépés there opens the checkout's own login box.
   2. logged in, has points, basket >= 5 000 Ft, no points used yet: "N hűségpontod van ...". Shoprenter redeems points
      in the pénztár ("Hűségpont megadása" field), not in the cart, so the text says so; in the checkout a link jumps to
      the field.
   3. logged in, has points, basket < 5 000 Ft: one short line.
   Logged in = ShopRenter.customer.userId > 0 (cart) / the checkout store's isAuthenticated. Balance = loyalty_points
   .usercanuse: in the checkout from its store, on the cart page from the checkout's own GET /checkout/cart (asked only
   for logged-in visitors). The guest box is checked on the live site; the logged-in boxes follow Shoprenter's checkout
   bundle markup (no test account). No per-frame work: one debounced MutationObserver re-checks after the Vue apps
   re-render (quantity change, step change) and writes only when the box text or place has to change. */
(function () {
  'use strict';
  if (window.__rrCartLoyalty || !document.body) { return; }
  var isCart = /\bsr-cart-page-body\b/.test(document.body.className || '');
  var isCheckout = !isCart && (/^\/checkout\/?$/.test(location.pathname) || /route=checkout\/checkout(&|$)/.test(location.search));
  if (!isCart && !isCheckout) { return; }
  window.__rrCartLoyalty = true;
  var MIN = 5000, PER = 50, lp = null, asked = false, timer = null;

  function digits(t) { var m = String(t == null ? '' : t).replace(/[\s. ]/g, '').match(/\d+/); return m ? Number(m[0]) : 0; }
  function ft(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft'; }
  function initial() { return (document.aurora && document.aurora.initialState) || {}; }
  function store() {
    var el = document.querySelector(isCart ? '.cart-page-vue' : '#app');
    return el && el.__vue__ && el.__vue__.$store ? el.__vue__.$store : null;
  }
  function config() { var s = store(); return (s && s.state.config) || initial().config || {}; }
  function enabled() {
    var c = config(), l = c.loyalty_points;
    if (l && typeof l === 'object') {
      MIN = Number(l.minCartAmount) || MIN;
      PER = Number(l.valuePerPoints) || PER;
      return String(l.enabled) !== '0' && String(l.loyaltypoints_status) !== '0';
    }
    return c.loyaltypoints_status !== false;
  }
  function totals() {
    var s = store(), st = s && s.state, t = st && (isCart ? st.totals : st.cart && st.cart.totals);
    if (!t) { var i = initial(); t = isCart ? i.totals : i.cart && i.cart.totals; }
    return t || [];
  }
  function row(type) {
    var t = totals();
    for (var i = 0; i < t.length; i++) { if (t[i] && t[i].type === type) { return t[i]; } }
    return null;
  }
  function basket() {   /* gross product total, shipping not included */
    var r = row('sub_total_with_tax');
    if (r) { return Math.round(Number(r.value) || 0); }   /* live Vue store; ShopRenter.cart is not updated by AJAX */
    var items = (window.ShopRenter && ShopRenter.cart && ShopRenter.cart.items) || [], sum = 0;
    for (var i = 0; i < items.length; i++) { sum += Number(items[i].totalNumber || 0); }
    return Math.round(sum);
  }
  function toGet() {
    var el = document.querySelector('.ac-total-value-potential-loyalty-points, .ac-checkout-potential-loyalty-points');
    var n = el ? digits(el.textContent) : 0, r;
    if (!n && (r = row('potentialLoyaltyPoints'))) { n = digits(r.description) || digits(r.text); }
    return n || Math.round(basket() / PER);
  }
  function guest() {   /* true = guest, false = logged in, null = cannot tell (then nothing is shown) */
    if (isCheckout) {
      var s = store();
      if (s && s.getters && typeof s.getters.isAuthenticated === 'boolean') { return !s.getters.isAuthenticated; }
      var u = initial().user;
      if (u !== undefined) { return !(u && u.customer_id !== undefined); }
    }
    var c = window.ShopRenter && ShopRenter.customer;
    if (c && c.userId !== undefined) { return !(Number(c.userId) > 0); }
    if (document.querySelector('.loyalty-would-get-row, .total-potential-loyalty-points')) { return true; }
    if (document.querySelector('.loyalty-row, .total-loyalty-points')) { return false; }
    return null;
  }
  function ask() {   /* cart page, logged-in visitors only: the checkout's own cart data carries the points balance */
    if (asked) { return; }
    asked = true;
    var x = new XMLHttpRequest();
    x.open('GET', '/checkout/cart', true);
    x.setRequestHeader('Accept', 'application/json');
    x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    if (document.aurora && document.aurora.csrfToken) { x.setRequestHeader('X-CSRF-TOKEN', document.aurora.csrfToken); }
    x.onload = function () {
      try { lp = JSON.parse(x.responseText).loyalty_points || false; } catch (e) { lp = false; }
      ensure();
    };
    x.onerror = function () { lp = false; };
    x.send();
  }
  function points() {   /* {have, used}, or null when there is no balance to talk about */
    var l = lp;
    if (isCheckout) { var s = store(); l = s && s.state.checkout ? s.state.checkout.loyalty_points : (initial().checkout || {}).loyalty_points; }
    else if (l === null) { ask(); return null; }
    if (!l || typeof l !== 'object') { return null; }
    return { have: Math.floor(Number(l.usercanuse) || 0), used: Number(l.selected_value) > 0 || !!row('loyaltypointsToUse') };
  }
  function firstStep() {
    var s = store(), r = s && s.state.route;
    if (r && r.name) { return r.name === 'customerdata'; }
    return !location.hash || /customerdata/i.test(location.hash);
  }
  function view() {   /* [key, html] of the box to show, or null */
    if (!enabled()) { return null; }
    var g = guest(), sum = basket();
    if (g === null || !sum) { return null; }
    if (g) {
      if (isCheckout && !firstStep()) { return null; }
      var n = toGet();
      return ['g' + n, '<p>' + (n
        ? 'Bejelentkezve erre a rendelésre kb. <b>' + n + ' hűségpontot</b> kapnál (<b>' + ft(n) + ' kedvezmény</b> a következő vásárlásodnál).'
        : 'Bejelentkezve erre a rendelésre is <b>hűségpontot</b> kapnál, amit a következő vásárlásodnál kedvezményként beválthatsz.') +
        '</p>' + (window.RRTIER ? '<p class="rr-loy-t"><b>Hűségszintek:</b> egy év vásárlásai alapján akár <b>9% pont</b>. ' +
        '<a href="#" data-rr="tiers">Részletek</a></p>' + RRTIER.lrow(26) : '') + '<p class="rr-loy-a"><a href="/customer/login" data-rr="login">Belépés</a><a href="/customer/register" data-rr="register">Regisztráció</a></p>'];
    }
    var p = points(), t = tier(paidNow());
    if (!p || !p.have || p.used) { return t; }
    if (sum < MIN) {
      return ['m' + p.have + '/' + sum + (t ? t[0] : ''), '<p><b>' + p.have + ' hűségpontod</b> van, ezeket ' + ft(MIN) + ' feletti kosárnál tudod beváltani. ' +
        'Ehhez még <b>' + ft(MIN - sum) + '</b> hiányzik.</p>' + (t ? t[1] : '')];
    }
    var field = isCheckout && !!document.querySelector('.ac-test-loyalty-point-input, .loyalty-point input');
    return ['u' + p.have + (field ? 'f' : '') + (t ? t[0] : ''), '<p><b>' + p.have + ' hűségpontod</b> van, ez <b>' + ft(p.have) + ' kedvezmény</b>. ' +
      (isCheckout ? 'Itt, a <b>Hűségpont megadása</b> mezőben beválthatod.' : 'A pénztárban, a <b>Hűségpont megadása</b> mezőben beválthatod.') +
      (p.have * 2 > sum ? ' Egy rendelés összegének legfeljebb a fele fizethető pontokkal.' : '') +   /* shop setting maxPercent 50 (owner 2026-11-17) */
      '</p>' + (field ? '<p class="rr-loy-a"><a href="#" data-rr="field">Mutasd a mezőt</a></p>' : '') + (t ? t[1] : '')];
  }
  var tierAsked = false;
  function paidNow() {   /* what the level counts: products after coupons and redeemed points (owner 2026-11-17) */
    var t = totals(), sum = basket();
    for (var i = 0; i < t.length; i++) {
      if (t[i] && /coupon|loyaltypointstouse/i.test(String(t[i].type || ''))) { sum -= Math.abs(Number(t[i].value) || 0); }
    }
    return Math.max(0, Math.round(sum));
  }
  function tier(sum) {   /* Hűségszintek (owner 2026-11-17): [key, html] of the level line for a logged-in customer */
    if (!window.RRTIER) { return null; }
    var m = RRTIER.me(), N, R;
    if (!m) { if (!tierAsked) { tierAsked = true; RRTIER.get(function () { ensure(); }); } return null; }
    N = RRTIER.nextOf(m.L);
    R = RRTIER.levelOf(m.spend + sum);   /* one order can jump more than one level */
    if (R.r > m.L.r) {
      return ['T' + R.k, '<p class="rr-loy-t">' + RRTIER.gem(R.k, 28) + 'Ezzel a rendeléssel <b>' + R.n + '</b> szintre lépsz: erre a rendelésre már <b>' +
        R.r + '% pont</b> jár. <a href="#" data-rr="tiers">Részletek</a></p>'];
    }
    return ['T' + m.L.k + (N ? N.at - m.spend - sum : ''), '<p class="rr-loy-t">' + RRTIER.gem(m.L.k, 28) + '<b>' + m.L.n + '</b> szint, ' + m.L.r + '% pont. ' +
      (N ? 'Ezzel a kosárral együtt még <b>' + ft(N.at - m.spend - sum) + '</b> hiányzik ' + (/^[AEIOUÁÉÍÓÖŐÚÜŰ]/.test(N.n) ? 'az' : 'a') + ' <b>' + N.n + '</b> szinthez (' + N.r + '%). ' : '') +
      '<a href="#" data-rr="tiers">Részletek</a></p>'];
  }
  function anchor() {   /* the box goes right before this element */
    if (isCart) {
      var a = document.querySelector('.sr-cart-bottom-buttons-row'), b;
      if (a) { return a; }
      b = document.querySelector('.sr-next-to-checkout');
      return b ? (b.closest('.row') || b) : null;
    }
    var inner = document.querySelector('#app .checkout-app-left-inner'), k = inner ? inner.children : [];
    for (var i = 0; i < k.length; i++) {   /* first child after the logo / step bar (desktop keeps them in here) */
      if (k[i].id !== 'rr-loy' && !k[i].classList.contains('header') && !k[i].classList.contains('sr-only')) { return k[i]; }
    }
    return null;
  }
  function visible(el) { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }
  function field() {
    var all = document.querySelectorAll('.ac-test-loyalty-point-input, .loyalty-point input');
    for (var i = 0; i < all.length; i++) { if (visible(all[i])) { return all[i]; } }
    return null;
  }
  function showField(f) {
    var w = f.closest('.loyalty-point') || f;
    w.scrollIntoView({ block: 'center' });
    try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
    w.classList.add('rr-loy-hl');
    setTimeout(function () { w.classList.remove('rr-loy-hl'); }, 2500);
  }
  function goField() {
    var f = field(), h;
    if (f) { showField(f); return; }
    h = document.querySelector('#sidebar .sidebar-header');   /* phones: the field sits in the folded order summary */
    if (h) { h.click(); setTimeout(function () { var g = field(); if (g) { showField(g); } }, 400); }
  }
  function click(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-rr]') : null, k;
    if (!a) { return; }
    k = a.getAttribute('data-rr');
    try { if (window.gtag) { window.gtag('event', 'rr_loyalty_click', { rr_loy: k, rr_page: isCart ? 'cart' : 'checkout' }); } } catch (x) { /* */ }
    if (k === 'field') { e.preventDefault(); goField(); return; }
    if (k === 'tiers' && window.RRTIER) { e.preventDefault(); RRTIER.open(); return; }
    var m = k === 'login' && isCheckout ? document.querySelector('.login-modal-button') : null;
    if (m) { e.preventDefault(); m.click(); }
  }
  function ensure() {
    var v = view(), box = document.getElementById('rr-loy'), a;
    if (!v) { if (box && box.parentNode) { box.parentNode.removeChild(box); } return; }
    a = anchor();
    if (!a || !a.parentNode) { return; }
    if (!box) {
      box = document.createElement('div');
      box.id = 'rr-loy';
      box.className = 'rr-loy';
      box.setAttribute('role', 'note');
      box.addEventListener('click', click);
    }
    if (box.getAttribute('data-k') !== v[0]) { box.setAttribute('data-k', v[0]); box.innerHTML = v[1]; }
    if (box.nextElementSibling !== a) { a.parentNode.insertBefore(box, a); }
  }
  function later() { clearTimeout(timer); timer = setTimeout(ensure, 250); }

  var st = document.createElement('style');
  st.id = 'rr-loy-css';
  st.textContent =
    '.rr-loy{background:#f4f8fb;border:1px solid #d3e2ee;border-left:4px solid #c99418;border-radius:10px;padding:16px 20px;margin:0 0 16px;' +
      'color:#1f3448;font-size:15px;line-height:1.55;text-align:left;text-transform:none;letter-spacing:normal}' +
    '.rr-loy p{margin:0;color:#1f3448;font-size:15px;line-height:1.55}.rr-loy b{color:#0b2239;font-weight:700}' +
    '.rr-loy .rr-loy-t{margin-top:8px}.rr-loy .rr-gem{margin:-4px 6px 0 0}.rr-loy .rr-lrow .rr-gem{margin:0}' +
    '.rr-loy a{color:#0b5e9c!important;font-weight:700;text-decoration:underline!important}.rr-loy a:hover{color:#e52421!important}' +
    '.rr-loy .rr-loy-a{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}' +
    '.rr-loy .rr-loy-a a[data-rr=login],.rr-loy .rr-loy-a a[data-rr=register]{display:inline-block;padding:8px 18px;border-radius:6px;text-decoration:none!important;font-size:14px}' +
    '.rr-loy .rr-loy-a a[data-rr=login]{background:#0b2d4a;color:#fff!important}.rr-loy .rr-loy-a a[data-rr=register]{border:1px solid #0b2d4a;color:#0b2d4a!important}' +
    '.sr-cart-page-body .rr-loy{max-width:none;margin:12px 0 18px}' +
    '.rr-loy-hl{outline:2px solid #e52421;outline-offset:2px;border-radius:4px}' +
    '@media (max-width:767px){.sr-cart-page-body .rr-loy{max-width:none;margin:6px 0 14px}}' +
    '@media (min-width:992px){#app .rr-loy{margin:26px 0 0}}';   /* checkout, desktop: clear of the step labels */
  (document.head || document.documentElement).appendChild(st);

  function start() {
    ensure();
    var root = document.querySelector(isCart ? '.cart-page-vue' : '#app') || document.body;
    if (window.MutationObserver) { new MutationObserver(later).observe(root, { childList: true, subtree: true, characterData: true }); }
    if (isCheckout) { window.addEventListener('hashchange', later); }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); } else { start(); }
})();


/* Méretcsere (owner 2026-11-17: "a 4th button that says MÉRETCSERE, GLS cserecsomag 1500 Ft, csak címre, make a fitting
   icon"): a fourth item in the theme's advantage boxes on the home page (.advantages-grid) and on product pages
   (.product-advantages-grid), same markup as the others, icon assets/icons/meretcsere.svg (T-shirt in swap arrows,
   site-changes/2026-11-17_meretcsere/make_icon.py). Desktop shows four columns, tablets two, phones keep one. */
(function () {
  'use strict';
  if (window.__rrSizeSwap) { return; }
  window.__rrSizeSwap = true;
  var ICON = 'https://1374223-star.github.io/rockpince-menu-counts/assets/icons/meretcsere.svg';
  var SPOTS = [
    { grid: '.advantages-grid', p: 'advantages-item', title: 'MÉRETCSERE', text: 'GLS cserecsomaggal 1 500 Ft, csak címre szállítva' },
    { grid: '.product-advantages-grid', p: 'product-advantages-item', title: 'MÉRETCSERE', text: 'Nem jó a méret? GLS cserecsomaggal 1 500 Ft, csak címre szállítva.' }
  ];
  var st = document.createElement('style');
  st.textContent =
    '@media (min-width:768px){.advantages-grid.rr-adv4,.product-advantages-grid.rr-adv4{grid-template-columns:repeat(2,1fr)!important}}' +
    '@media (min-width:1200px){.advantages-grid.rr-adv4,.product-advantages-grid.rr-adv4{grid-template-columns:repeat(4,1fr)!important}}' +
    /* owner 2026-11-17: "same sized in all dimensions": every row as tall as the tallest box, boxes fill their cell */
    '.advantages-grid,.product-advantages-grid{grid-auto-rows:1fr!important;align-items:stretch!important}' +
    '.rr-adv-gems{display:block;margin:2px 0 4px;line-height:0}' +
    '.advantages-grid>.advantages-item,.product-advantages-grid>.product-advantages-item{height:100%!important;align-items:center!important;box-sizing:border-box}';
  (document.head || document.documentElement).appendChild(st);
  function levels() {   /* the points box of the same rows: levels instead of the old text */
    var items = document.querySelectorAll('.advantages-item, .product-advantages-item');
    for (var i = 0; i < items.length; i++) {
      var it = items[i], h = it.querySelector('[class$="__title"]'), tx = it.querySelector('[class$="__text"]');
      if (!h || !tx || !/PONTOKAT/i.test(h.textContent) || it.querySelector('.rr-adv-gems')) { continue; }
      tx.innerHTML = (window.RRTIER ? '<span class="rr-adv-gems">' + RRTIER.mini(20) + '</span>' : '') +
        'Akár 9% pont vissza minden rendelésed után: Bronz, Ezüst, Arany és Gyémánt szint.';
      it.style.cursor = 'pointer';
      it.addEventListener('click', function () { if (window.RRTIER) { RRTIER.open(); } else { location.href = '/husegprogram'; } });
    }
  }
  function add() {
    levels();
    for (var i = 0; i < SPOTS.length; i++) {
      var s = SPOTS[i], grid = document.querySelector(s.grid);
      if (!grid || grid.querySelector('.rr-swap') || grid.children.length < 1) { continue; }
      var item = grid.children[grid.children.length - 1].cloneNode(true);
      item.classList.add('rr-swap');
      item.removeAttribute('data-aos');
      var img = item.querySelector('img');
      if (img) { img.src = ICON; img.removeAttribute('srcset'); img.alt = s.title; }
      var h = item.querySelector('.' + s.p + '__title'), tx = item.querySelector('.' + s.p + '__text');
      if (h) { h.textContent = s.title; }
      if (tx) { tx.textContent = s.text; }
      grid.appendChild(item);
      grid.classList.add('rr-adv4');
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', add); } else { add(); }
})();


/* Hover glow (owner 2026-11-17: "every button and clickable things glow up with a fitting lightblue glow rather than the
   underline"). Text links glow, buttons and cards get a light blue halo, icons a drop-shadow; the theme's sliding
   underline bars (top bar, main menu) are gone. Hover only, no animation loop (phone performance). */
(function () {
  'use strict';
  if (window.__rrGlow) { return; }
  window.__rrGlow = true;
  var G = 'rgba(127,196,234,', st = document.createElement('style');
  st.id = 'rr-glow';
  st.textContent =
    'a,button,.btn,[role=button],input[type=submit],input[type=button]{transition:box-shadow .18s ease,text-shadow .18s ease,filter .18s ease}' +
    'a:hover,a:focus-visible{text-decoration:none!important}' +
    '.headermenu-list .nav-link::before,.headermenu-list .nav-link::after,li.category-list>a.nav-link::before{display:none!important}' +
    'a:hover{text-shadow:0 0 8px ' + G + '.9),0 0 18px ' + G + '.45)}' +
    'html body .btn:hover,html body a.btn:hover,html body button.btn:hover,html body .button:hover,html body input[type=submit]:hover,html body input[type=button]:hover,' +
    'html body .rr-cb .go:hover,html body .rr-lp-btns a:hover,html body .rr-tp-btns a:hover,html body .rr-loy .rr-loy-a a:hover{' +
      'box-shadow:0 0 0 2px ' + G + '.9),0 0 18px rgba(64,160,225,.7)!important;text-shadow:none!important}' +
    'html body .product-card:hover,html body .advantages-item:hover,html body .product-advantages-item:hover{' +
      'box-shadow:0 0 0 2px ' + G + '.8),0 0 22px ' + G + '.65)!important}' +
    /* no text glow on the white areas (product cards, cart, checkout, popups): it looks hazy there; the card / button halo does it */
    '.product-card a:hover,.sr-cart-page-body .cart-page-vue a:hover,#app a:hover,.cart-popup a:hover,.rr-loy a:hover,.rr-tier-pop a:hover{text-shadow:none!important}' +
    '.social-link:hover,.rr-social-top a:hover,.header-middle-right-box-link:hover svg,.cart-dropdown-toggle:hover svg,#rr-tier-m:hover,.rr-tier-link:hover .rr-gem{' +
      'filter:drop-shadow(0 0 6px ' + G + '.95)) drop-shadow(0 0 12px ' + G + '.5))}' +
    'a:hover img:not(.product-card img):not(.card img){filter:drop-shadow(0 0 6px ' + G + '.8))}' +
    /* top row (owner 2026-11-17 "the glow doesnt seem to work ... in the top row"): the steel header block keeps that row's
       text flat with text-shadow:none!important, so its hover glow needs the stronger selector; the phone / mail pills
       get the button halo too */
    'html body .header-top .headermenu-list a:hover,html body .header-top .headermenu-list a:hover *,' +
    'html body .header-top .rr-phonetop:hover,html body .header-top .rr-phonetop:hover *,html body .header-top .rr-mailtop:hover,html body .header-top .rr-mailtop:hover *{' +
      'text-shadow:0 0 8px ' + G + '.95),0 0 18px ' + G + '.55)!important}' +
    'html body .header-top .rr-phonetop:hover,html body .header-top .rr-mailtop:hover{box-shadow:0 0 0 1px ' + G + '.9),0 0 14px rgba(64,160,225,.6)!important}' +
    'html body .header-top .rr-phonetop:hover svg,html body .header-top .rr-mailtop:hover svg{filter:drop-shadow(0 0 5px ' + G + '.95))}';
  (document.head || document.documentElement).appendChild(st);
})();


/* Product page buy box (owner 2026-11-17: "a bit over the place ... sizes and distances between objects, unharmonic,
   textbutton isnt centered"): one column on one rhythm. Labels (Méret, Mennyiség) sit above their controls in the same
   small caps, Mérettáblázat on the label row at the right, the select full width, quantity + KOSÁRBA on one row (KOSÁRBA
   under it when the box is narrow), every control 50 px tall, the button text centred, the free-shipping line with a
   normal line height. Also: the quick view drops its "Várható szállítás" row; the register / login pages hide the empty
   "Közösségi bejelentkezés" block (no Facebook / Google app is connected to it). */
(function () {
  'use strict';
  if (window.__rrBuyBox) { return; }
  window.__rrBuyBox = true;
  var B = 'body.product-page-body .product-cart-box ';
  var LBL = 'display:block!important;margin:0!important;padding:0!important;font-size:12px!important;font-weight:600!important;letter-spacing:.06em!important;' +
    'text-transform:uppercase!important;color:#9fb7cb!important;line-height:1.3!important';
  var st = document.createElement('style');
  st.id = 'rr-buybox';
  st.textContent =
    B + '.rr-fs{line-height:1.4!important;margin:10px 0 0!important}' + B + '.rr-fs .bar{margin-top:8px!important}' +
    B + '.product-options{margin:20px 0 0!important}' +
    B + '.product-option__item{display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:space-between!important;gap:7px 12px!important;margin:0 0 14px!important}' +
    B + '.product-option__name{order:1;' + LBL + '}' +
    B + '.rr-sg{order:2;margin:0 0 0 auto!important;font-size:12px!important;line-height:1.3!important}' +
    B + '.product-option__item>.product-option__select{order:3;flex:1 1 100%!important;width:100%!important;margin:0!important}' +
    B + '.product-option__select select{width:100%!important;height:50px!important;max-width:none!important}' +
    B + '.product-addtocart{margin:6px 0 0!important}' +
    B + '.product-addtocart-wrapper{display:flex!important;flex-wrap:wrap!important;align-items:flex-end!important;gap:12px!important}' +
    B + '.product-addtocart-wrapper>div:not(.product_table_quantity):not(.product_table_addtocartbtn){position:absolute!important}' +   /* an empty theme div took a gap */
    B + '.product_table_quantity{flex:0 0 108px!important;width:108px!important;margin:0!important}' +
    B + '.quantity-text{' + LBL + ';margin:0 0 7px!important}' +
    B + '.js-input-spinner-wrapper{display:flex!important;flex-wrap:nowrap!important;width:100%!important;height:50px!important;margin:0!important}' +
    B + '.js-input-spinner-wrapper .js-input-spinner-btn{flex:0 0 36px!important;width:36px!important;height:100%!important;margin:0!important;padding:0!important}' +
    B + '.js-input-spinner-wrapper input{flex:1 1 auto!important;min-width:0!important;width:auto!important;height:100%!important;margin:0!important;padding:0!important;text-align:center!important}' +
    B + '.product_table_addtocartbtn{flex:1 1 140px!important;min-width:0!important;max-width:none!important;margin:0!important}' +
    'html ' + B + '#add_to_cart.button-add-to-cart{display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;' +
      'width:100%!important;min-width:0!important;height:50px!important;padding:0 16px!important;margin:0!important;box-sizing:border-box!important}' +
    'html ' + B + '#add_to_cart.button-add-to-cart span{margin:0!important;text-align:center!important}' +
    B + '.rr-trust{margin-top:22px!important}' +
    /* quick view: no "Várható szállítás" row (owner 2026-11-17) */
    '.product-quickview .product-parameter-shipping-time{display:none!important}' +
    /* empty social login block (no provider connected) */
    '#sociallogin:not(:has(.social-login-content *)){display:none!important}';
  (document.head || document.documentElement).appendChild(st);

  /* the "Vagy használja a közösségi regisztrációt:" line above the empty block */
  if (/sr-(register|login)-page-body/.test(document.body ? document.body.className : '') || /customer\/(register|login)|account\/(register|login)/.test(location.href)) {
    var n = 0;
    (function hide() {
      var sl = document.getElementById('sociallogin'), c = sl && sl.querySelector('.social-login-content');
      if (sl && c && !c.firstElementChild) {
        sl.style.display = 'none';
        var ps = document.querySelectorAll('p');
        for (var i = 0; i < ps.length; i++) { if (/közösségi regisztráció/i.test(ps[i].textContent) && ps[i].textContent.length < 80) { ps[i].style.display = 'none'; } }
      }
      if (n++ < 20) { setTimeout(hide, 500); }
    })();
  }
})();

/* Register page (owner 2026-11-17: "add here the 10% coupon for signing up the newsletter, and mention the
   hüségrendszer"): two perks under the title, and a "+10% kupon" tag on the newsletter checkbox. Ticking it at
   registration makes a newsletter subscriber within seconds, so NewsletterCoupon.js sends the code as usual. */
(function () {
  'use strict';
  if (window.__rrRegPerks) { return; }
  window.__rrRegPerks = true;
  if (!document.body || !/sr-register-page-body/.test(document.body.className)) { return; }
  var st = document.createElement('style');
  st.id = 'rr-regp';
  st.textContent =
    '.rr-regp{display:grid;grid-template-columns:1fr;gap:10px;max-width:750px;margin:0 auto 26px;text-align:left}' +
    '.rr-regp .it{display:flex;gap:16px;align-items:center;padding:14px 18px;border:1px solid rgba(127,196,234,.35);border-radius:8px;background:rgba(4,16,28,.55)}' +
    '.rr-regp .ic{flex:0 0 64px;height:64px;display:flex;align-items:center;justify-content:center}' +
    '.rr-regp .pc{width:64px;height:64px;border-radius:50%;background:#e52421;color:#fff;font:800 19px/64px Poppins,Arial,sans-serif;text-align:center;letter-spacing:-.02em}' +
    '.rr-regp b{display:block;color:#fff;font-size:15px;line-height:1.3;margin:0 0 4px}' +
    '.rr-regp span{display:block;color:#c9d8e6;font-size:13px;line-height:1.45}' +
    '.rr-regp span b{display:inline;font-size:13px;margin:0}' +
    '.rr-reg-tag{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:3px;background:#e52421;color:#fff!important;font-size:11px;font-weight:800;' +
      'letter-spacing:.04em;text-transform:uppercase;line-height:1.5;vertical-align:1px;white-space:nowrap}' +
    '@media (max-width:767px){.rr-regp{margin-bottom:20px}.rr-regp .it{padding:13px 14px}.rr-regp .ic{flex-basis:52px;height:52px}' +
      '.rr-regp .pc{width:52px;height:52px;line-height:52px;font-size:16px}}';
  (document.head || document.documentElement).appendChild(st);
  function gem() { return window.RRTIER ? RRTIER.gem('gyemant', 52) : ''; }
  var n = 0;
  (function add() {
    var head = document.querySelector('.sr-register .page-head'), box = document.querySelector('.rr-regp');
    if (head && !box) {
      box = document.createElement('div');
      box.className = 'rr-regp';
      box.innerHTML =
        '<div class="it"><div class="ic"><div class="pc">-10%</div></div><div><b>10% kupon a hírlevélért</b>' +
        '<span>Pipáld be lent a hírlevelet, és e-mailben küldjük az egyszer használható 10%-os kuponkódodat.</span></div></div>' +
        '<div class="it"><div class="ic rr-regp-gem">' + gem() + '</div><div><b>Hűségpont minden rendelésed után</b>' +
        '<span>Alapból <b>3%</b>, és ahogy egy év alatt többet vásárolsz, Ezüst, Arany, majd Gyémánt szinten <b>akár 9%</b>. 1 pont = 1 Ft kedvezmény.</span></div></div>';
      head.parentNode.insertBefore(box, head.nextSibling);
    }
    var g = box && box.querySelector('.rr-regp-gem');
    if (g && !g.firstChild && window.RRTIER) { g.innerHTML = gem(); }
    var lab = document.querySelector('label[for="newsletter_id"]');
    if (lab && !lab.querySelector('.rr-reg-tag')) {
      var t = document.createElement('span'); t.className = 'rr-reg-tag'; t.textContent = '+10% kupon'; lab.appendChild(t);
    }
    if (n++ < 40) { setTimeout(add, n < 10 ? 300 : 1000); }   /* the form is Vue: it can come late or redraw */
  })();
})();


/* Category tile captions (owner 2026-11-17: "AJÁNDÉKUTALVÁN / Y", "AJÁNDÉKTÁRGYA / K"): never break inside a word;
   a caption whose longest word does not fit gets a smaller font instead. Measured once on load and on resize. */
(function () {
  'use strict';
  if (window.__rrCapFit) { return; }
  window.__rrCapFit = true;
  var st = document.createElement('style');
  st.textContent = '.subcategory__link{word-break:normal!important;overflow-wrap:normal!important}';
  (document.head || document.documentElement).appendChild(st);
  var cv = document.createElement('canvas').getContext('2d');
  function fit() {
    var ls = document.querySelectorAll('.subcategory__link');
    for (var i = 0; i < ls.length; i++) {
      var a = ls[i];
      a.style.fontSize = '';
      var s = getComputedStyle(a), fs = parseFloat(s.fontSize) || 14, txt = '';
      for (var k = 0; k < a.childNodes.length; k++) { if (a.childNodes[k].nodeType === 3) { txt += a.childNodes[k].textContent; } }
      if (s.textTransform === 'uppercase') { txt = txt.toUpperCase(); }
      cv.font = s.fontWeight + ' ' + fs + 'px ' + s.fontFamily;
      var sp = parseFloat(s.letterSpacing) || 0, words = txt.replace(/-/g, '- ').split(/\s+/), max = 0;   /* a hyphen is a fine place to wrap */
      for (var w = 0; w < words.length; w++) { if (words[w]) { max = Math.max(max, cv.measureText(words[w]).width + sp * words[w].length); } }
      var avail = a.clientWidth - (parseFloat(s.paddingLeft) || 0) - (parseFloat(s.paddingRight) || 0);
      if (avail > 0 && max > avail) { a.style.fontSize = Math.max(9, Math.floor(fs * avail / max * 0.97 * 10) / 10) + 'px'; }
    }
  }
  function go() { if (document.querySelector('.subcategory__link')) { fit(); } }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', go); } else { go(); }
  window.addEventListener('load', go);
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); }
  var t = null;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(go, 200); });
})();


/* Google sign-in button (owner 2026-11-17: "dont like how the google button looks like stylistically"): Shoprenter's
   blue box becomes Google's own dark button style (dark fill, thin grey border, the coloured G, Hungarian text) at the
   height of the shop's buttons, and the formal "Vagy használja a közösségi regisztrációt:" line becomes a VAGY divider.
   The link itself (Shoprenter's Google sign-in URL) is untouched. */
(function () {
  'use strict';
  if (window.__rrGoogleBtn) { return; }
  window.__rrGoogleBtn = true;
  var st = document.createElement('style');
  st.id = 'rr-gbtn';
  st.textContent =
    'html body #sociallogin .social-login-link.is-google{display:flex!important;align-items:center!important;justify-content:center!important;gap:12px;' +
      'width:300px;max-width:100%;height:46px;margin:0 auto!important;padding:0 18px!important;box-sizing:border-box;background:#131314!important;' +
      'border:1px solid #8e918f!important;border-radius:4px!important;color:#e3e3e3!important;font:600 14px/1 Poppins,Arial,sans-serif!important;' +
      'letter-spacing:.2px;text-decoration:none!important;text-transform:none!important;transition:box-shadow .18s ease,border-color .18s ease}' +
    'html body #sociallogin .social-login-link.is-google *{background:transparent!important;border:0!important;box-shadow:none!important}' +
    'html body #sociallogin .social-login-link.is-google .icon{display:flex!important;width:20px;height:20px;padding:0!important;margin:0!important;flex:0 0 20px}' +
    'html body #sociallogin .social-login-link.is-google .icon svg{width:20px!important;height:20px!important}' +
    'html body #sociallogin .social-login-link.is-google .rr-gtxt{color:#e3e3e3!important;font:600 14px/1 Poppins,Arial,sans-serif!important;white-space:nowrap}' +
    'html body #sociallogin .social-login-link.is-google:hover{border-color:#9fd6f7!important;box-shadow:0 0 0 1px rgba(127,196,234,.9),0 0 16px rgba(64,160,225,.6)!important}' +
    'html body #sociallogin .social-link{width:100%;display:flex;justify-content:center}' +
    '.rr-or{display:flex;align-items:center;gap:12px;width:300px;max-width:100%;margin:20px auto 14px;color:#9fb7cb;font:600 12px/1 Poppins,Arial,sans-serif;letter-spacing:.14em}' +
    '.rr-or:before,.rr-or:after{content:"";flex:1;height:1px;background:rgba(159,183,203,.35)}';
  (document.head || document.documentElement).appendChild(st);
  function text() {
    var c = document.body ? document.body.className : '';
    if (/sr-register-page-body/.test(c)) { return 'Regisztráció Google-fiókkal'; }
    if (/sr-login-page-body/.test(c)) { return 'Bejelentkezés Google-fiókkal'; }
    return 'Folytatás Google-fiókkal';
  }
  var n = 0;
  (function fix() {
    var a = document.querySelector('#sociallogin .social-login-link.is-google');
    if (a && !a.querySelector('.rr-gtxt')) {
      var icon = a.querySelector('.icon');
      var kids = [].slice.call(a.childNodes);
      for (var i = 0; i < kids.length; i++) { if (kids[i] !== icon) { a.removeChild(kids[i]); } }
      var t = document.createElement('span'); t.className = 'rr-gtxt'; t.textContent = text(); a.appendChild(t);
      var sl = document.getElementById('sociallogin');
      var ps = document.querySelectorAll('p');
      for (var k = 0; k < ps.length; k++) {
        if (/közösségi regisztráció/i.test(ps[k].textContent) && ps[k].textContent.length < 80) { ps[k].style.display = 'none'; }
      }
      if (sl && !document.querySelector('.rr-or')) {
        var or = document.createElement('div'); or.className = 'rr-or'; or.textContent = 'VAGY';
        sl.parentNode.insertBefore(or, sl);
      }
    }
    if (n++ < 30) { setTimeout(fix, n < 10 ? 300 : 1000); }   /* the register form is Vue and may render late */
  })();
})();

/* On-site messages (owner 2026-11-18, our own version of an OptiMonk-type tool): basket reminder, welcome back, recently viewed
   and the small -10% tab. The code is in assets/campaigns/campaigns.js and loads when the browser is idle. */
(function () {
  if (window.__rrCampLoad) { return; }
  window.__rrCampLoad = true;
  window.RRCAMP_LIVE = true;
  function add() {
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://1374223-star.github.io/rockpince-menu-counts/assets/campaigns/campaigns.js';
    document.head.appendChild(s);
  }
  if (window.requestIdleCallback) { requestIdleCallback(add, { timeout: 3000 }); } else { setTimeout(add, 1500); }
})();

/* Basket recommendations (owner 2026-11-18): assets/basket/basket.js, loaded on the basket page only. */
(function () {
  if (window.__rrBskLoad) { return; }
  window.__rrBskLoad = true;
  function go() {
    if (!document.body || !/\bsr-cart-page-body\b/.test(document.body.className)) { return; }
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://1374223-star.github.io/rockpince-menu-counts/assets/basket/basket.js';
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', go); } else { go(); }
})();

/* Gift voucher (owner 2026-11-18). The product is a 0 Ft item whose value is its option, so the page said "0 Ft" and
   "Válassz méretet" and promised shipping. Here it shows the amount, and what the buyer really gets. */
(function () {
  'use strict';
  if (window.__rrVoucher) { return; }
  window.__rrVoucher = true;
  var ID = '246284';
  function ft(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0Ft'; }
  function value(o) { var m = String(o.textContent).replace(/\s/g, '').match(/\+?(\d+)Ft$/); return m ? Number(m[1]) : 0; }
  function cards() {
    Array.prototype.forEach.call(document.querySelectorAll('a.product-card__title-link[href$="-' + ID + '"]'), function (a) {
      var c = a.closest('.product-card'), p = c && c.querySelector('.snapshot-price, .product-price');
      if (p) { p.textContent = ft(1000) + '-tól'; }
    });
    if (/ajandekutalvanyok-15430/.test(location.pathname)) {   /* the shop's internal 1 Ft item does not belong next to it */
      Array.prototype.forEach.call(document.querySelectorAll('a.product-card__title-link[title="[WEBSHOP EGYÉB]"]'), function (a) {
        var w = a.closest('.product-snapshot') || a.closest('.product-card'); if (w) { w.style.display = 'none'; }
      });
    }
  }
  function page() {
    var id = document.querySelector('form#product input[name="product_id"]'), sel = document.querySelector('.product-cart-box select[name^="option["]');
    if (!id || id.value !== ID || !sel) { return; }
    document.documentElement.classList.add('rr-vch');
    function prices(text) {
      Array.prototype.forEach.call(document.querySelectorAll('.product-cart-box .product-page-price .product-price, .rr-sticky .t b'), function (p) { p.textContent = text; });
    }
    function paint() { var o = sel.options[sel.selectedIndex], v = o ? value(o) : 0; prices(v ? ft(v) : ft(1000) + '-tól'); }
    [sel, document.querySelector('.rr-st-size')].forEach(function (s) {
      if (!s) { return; }
      Array.prototype.forEach.call(s.options, function (o) { var v = value(o); if (v) { o.textContent = ft(v); } else if (!o.value) { o.textContent = 'Válassz összeget'; } });
    });
    if (!sel.getAttribute('data-rr-vch')) { sel.setAttribute('data-rr-vch', '1'); sel.addEventListener('change', paint); }
    paint();
    var list = document.querySelector('.rr-trust');
    if (list && !list.getAttribute('data-rr-vch')) {
      list.setAttribute('data-rr-vch', '1');
      var li = list.querySelectorAll('li');
      [['A kódot e-mailben küldjük, a fizetés beérkezése után 1-2 munkanapon belül', 0], ['Nem jár le, online vásárlásnál váltható be', 1]].forEach(function (r) { if (li[r[1]]) { li[r[1]].lastChild.textContent = r[0]; } });
      if (li[2]) { li[2].style.display = 'none'; }
    }
  }
  function run() { cards(); page(); }
  function start() {
    var st = document.createElement('style');
    st.textContent = 'html.rr-vch .rr-fs{display:none!important}';
    document.head.appendChild(st);
    run(); setTimeout(run, 400); setTimeout(run, 1500); setTimeout(run, 4000);
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); } else { start(); }
})();

/* Band alerts (owner 2026-11-18): assets/alerts/alerts.js, on product pages and band pages, when the browser is idle.
   A small link that opens an email field in place; opt-in with a confirmation email (BandAlerts.js). Never a popup. */
(function () {
  if (window.__rrBaLoad) { return; }
  window.__rrBaLoad = true;
  function add() {
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://1374223-star.github.io/rockpince-menu-counts/assets/alerts/alerts.js';
    document.head.appendChild(s);
  }
  function go() {
    if (!document.body || !(/\bproduct-page-body\b/.test(document.body.className) || /^\/zenekarok\/[^\/]+\/?$/.test(location.pathname))) { return; }
    if (window.requestIdleCallback) { requestIdleCallback(add, { timeout: 3000 }); } else { setTimeout(add, 1500); }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', go); } else { go(); }
})();

/* Gift finder (owner 2026-11-18): page /ajandekkereso (information page 105), code in assets/gifts/gifts.js.
   Also a plain link in the top menu row, next to Hűségprogram. */
(function () {
  if (window.__rrGfLoad) { return; }
  window.__rrGfLoad = true;
  function go() {
    if (document.getElementById('rrgf-app')) {
      var s = document.createElement('script'); s.async = true;
      s.src = 'https://1374223-star.github.io/rockpince-menu-counts/assets/gifts/gifts.js';
      document.head.appendChild(s);
    }
    var nav = document.querySelector('.headermenu-list a.nav-link[href*="husegprogram"]') || document.querySelector('a.nav-link[href*="husegprogram"]');
    var item = nav && nav.closest('li');
    if (item && !document.querySelector('a.nav-link[href$="/ajandekkereso"]')) {
      var c = item.cloneNode(false), a = nav.cloneNode(false);
      a.setAttribute('href', '/ajandekkereso'); a.removeAttribute('title'); a.textContent = 'Ajándékkereső';
      c.appendChild(a);
      item.parentNode.insertBefore(c, item);
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', go); } else { go(); }
})();

/* Filter loader for menu.js. PUBLIC = false: only browsers that opened a page with ?rrsx=1 get the filter (private test).
   PUBLIC = true: everybody. ?rrsx=0 turns it off in that browser.
   Search page, or a link that already carries filters: loads search.js at once.
   Category and band pages on desktop: loads it when the browser is idle.
   Category and band pages on phones: loads nothing until the shop's SZŰRÉS button (or the small Szűrők button on pages
   that have none) is tapped. If the script cannot load, the tap goes through to the shop's own filter.
   Off switch: ?rrsx=0 */
(function () {
  'use strict';
  if (window.__rrsxLoader) { return; }
  window.__rrsxLoader = true;
  var SRC = window.RRSX_SRC || 'https://1374223-star.github.io/rockpince-menu-counts/assets/search/search.js';
  var PUBLIC = true, on = PUBLIC;
  try {
    var flag = new URLSearchParams(location.search).get('rrsx');
    if (flag === '0') { localStorage.removeItem('rrsx-test'); return; }
    if (flag === '1') { localStorage.setItem('rrsx-test', '1'); }
    on = on || flag === '1' || localStorage.getItem('rrsx-test') === '1';
  } catch (e) { /* no storage: only the public setting counts */ }
  if (!on) { return; }
  var requested = false, pill = null;
  function load(onFail) {
    if (requested) { return; }
    requested = true;
    var s = document.createElement('script');
    s.src = SRC; s.async = true;
    s.onerror = function () { window.RRSX_DEAD = 'script'; if (pill) { pill.remove(); } if (onFail) { onFail(); } };
    document.head.appendChild(s);
  }
  function init() {
    var c = document.body.className, search = /\bsearch-list-body\b/.test(c), cat = /\bcategory-list-body\b/.test(c);
    if (!search && !cat) { return; }
    if (search || /(^#|&)(t|b|g|min|max|akcio|uj|elfogyott|f\.[a-z_]+)=/.test(location.hash)) { load(); return; }
    if (!matchMedia('(max-width: 991px)').matches) {
      if (window.requestIdleCallback) { requestIdleCallback(function () { load(); }, { timeout: 4000 }); } else { setTimeout(load, 2000); }
      return;
    }
    if (!document.getElementById('js-open-filter-btn')) {
      pill = document.createElement('button');
      pill.type = 'button'; pill.id = 'rrsx-pill'; pill.textContent = 'Szűrők'; pill.setAttribute('aria-haspopup', 'dialog');
      pill.style.cssText = 'display:flex;align-items:center;position:fixed;left:50%;bottom:calc(74px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1019;height:46px;padding:0 20px;background:#e52421;border:0;border-radius:23px;box-shadow:0 3px 12px rgba(0,0,0,.45);font:700 15px Poppins,Arial,sans-serif;color:#fff';
      document.body.appendChild(pill);
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('#js-open-filter-btn,#rrsx-pill') : null;
      if (!b || window.RRSX_LIVE || window.RRSX_DEAD) { return; }
      e.preventDefault(); e.stopImmediatePropagation();
      window.RRSX_OPEN = true;
      load(function () { if (b.id !== 'rrsx-pill') { b.click(); } });
    }, true);
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();

/* Részletes keresés button at the header search box (owner 2026-11-18). Desktop: small link under the box, in the free
   strip of the header. Phone: inside the box, because the box touches the end of the header. Nothing on the page moves. */
(function () {
  'use strict';
  if (window.__rrFind) { return; }
  window.__rrFind = true;
  var CSS = '.rr-find{position:absolute;z-index:6;display:inline-flex;align-items:center;gap:6px;left:2px;top:100%;height:20px;margin-top:1px;color:#9fd0ee!important;font-size:12px;font-weight:600;line-height:20px;text-decoration:none!important;white-space:nowrap}' +
    '.rr-find:hover,.rr-find:focus-visible{color:#fff!important;text-decoration:underline!important}.rr-find svg{flex:none;width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}.rr-find em{font-style:normal}' +
    '@media(max-width:991.98px){.rr-find{left:auto;right:54px;top:50%;height:34px;margin-top:-17px;padding:0 10px;border:1px solid #2a5f85;border-radius:17px;background:#0b2c45;color:#fff!important}.rr-find::after{content:"";position:absolute;left:-2px;right:-2px;top:-6px;bottom:-6px}.rr-find em{display:none}#filter_keyword{padding-right:158px!important}}';
  function add() {
    var input = document.getElementById('filter_keyword'), box = input && input.closest('.search-module');
    if (!box || box.querySelector('.rr-find')) { return; }
    var style = document.createElement('style'); style.id = 'rr-find-css'; style.textContent = CSS; document.head.appendChild(style);
    var a = document.createElement('a');
    a.className = 'rr-find'; a.href = '/index.php?route=product/list#reszletes'; a.setAttribute('aria-label', 'Részletes keresés');
    a.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h7M13 4h1M2 12h1M7 12h7"/><circle cx="11" cy="4" r="2"/><circle cx="5" cy="12" r="2"/></svg><span>Részletes<em> keresés</em></span>';
    a.addEventListener('click', function (e) {
      var text = input.value.trim(), onSearch = document.body.classList.contains('search-list-body');
      if (onSearch && window.RRSX_ADV) { e.preventDefault(); window.RRSX_ADV(); return; }
      if (text) { a.href = '/index.php?route=product/list&keyword=' + encodeURIComponent(text) + '#reszletes'; }
    });
    box.appendChild(a);
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', add); } else { add(); }
})();

/* Night test fixes, 2026-11-19.
   Supplier size tables up to 900 px wide stretched about 6 in 10 Fantasmagoria product pages on phones: the sticky buy bar
   disappeared and the added-to-basket window was cut off. They now scroll inside their own box. Also: the gift finder in
   the phone menu, and the dead picture at the end of the gift voucher text. */
(function () {
  if (window.__rrNightFix) { return; }
  window.__rrNightFix = true;
  var s = document.createElement('style');
  s.textContent = '.product-desc .f-overflow-x{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}' +
    '@media (max-width:767px){.product-desc>table{display:block;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}}' +
    'img[src*="/fajltar/89664.png"]{display:none!important}';
  document.head.appendChild(s);
  function phoneGiftLink(tries) {
    var nav = document.querySelector('#js-mobile-nav a.mm-listitem__text[href*="husegprogram"]'), item = nav && nav.closest('li');
    if (!item) { if (tries > 0) { setTimeout(function () { phoneGiftLink(tries - 1); }, 700); } return; }
    if (document.querySelector('#js-mobile-nav a[href$="/ajandekkereso"]')) { return; }
    var c = item.cloneNode(false), a = nav.cloneNode(false);
    c.removeAttribute('id'); a.removeAttribute('id'); a.removeAttribute('title');
    a.setAttribute('href', '/ajandekkereso'); a.textContent = 'Ajándékkereső';
    c.appendChild(a);
    item.parentNode.insertBefore(c, item);
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { phoneGiftLink(12); }); } else { phoneGiftLink(12); }
})();

/* Early header handover (2026-11-19). The shop's <head> carries style#rr-early-head (Shoprenter: Custom header
   scripts; source early_head.html in this repo): this file's desktop header rules plus two gaps that hold the places
   of the Christmas bar and the band strip, so the first paint already has the final header and the page does not jump
   while it loads (desktop layout shift was 0.6 to 1.4). Once our own header pieces are in, the copy is removed, so
   later edits here never fight it. Changing a header height, XMAS_UNTIL or the band strip rule? Change early_head.html too. */
(function () {
  'use strict';
  if (window.__rrEarlyHandover) { return; }
  window.__rrEarlyHandover = true;
  var t0 = Date.now(), flags = document.documentElement.getAttribute('data-rr-early') || '';
  function has(s) { return !!document.querySelector(s); }
  function logoDone() {  /* the swapped logo (336x173) must have loaded, or the old picture's shape shows for a moment */
    if (document.body.classList.contains('home-body')) { return true; }
    var im = document.querySelector('a.header-logo img.header-logo-img');
    return !im || (im.getAttribute('data-rr-logo') && im.complete);
  }
  function ready() {
    if (window.innerWidth < 992) { return true; }
    return has('#rr-headrows') && has('#rr-headtidy') && has('#rr-ui-fixes') && has('#rr-catlook') && logoDone() &&
      has('#rr-spacing') && has('#rr-fb17') && (has('#rr-fluid') || /^\/checkout/.test(location.pathname)) &&
      (!document.body.classList.contains('category-list-body') || has('#rr-category-count-style')) &&
      (!/\bbandpage\b/.test(flags) || has('.page-head .rrba') || window.__rrBaDone) &&
      (has('.rr-xmas') || /\bnoxmas\b/.test(flags)) &&
      (has('.rr-bands') || /\bnobands\b/.test(flags) || window.__rrBandsFailed) &&
      (window.innerWidth < 1200 || has('.rr-tl'));
  }
  (function wait() {
    var early = document.getElementById('rr-early-head'), fluid = document.getElementById('rr-early-fluid');
    if (!early && !fluid) { return; }
    if (ready() || Date.now() - t0 > 8000) {
      if (fluid) { fluid.parentNode.removeChild(fluid); }
      if (early) { early.parentNode.removeChild(early); }
      return;
    }
    setTimeout(wait, 100);
  })();
})();
