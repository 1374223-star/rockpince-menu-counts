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
