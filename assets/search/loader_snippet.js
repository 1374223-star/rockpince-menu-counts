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
