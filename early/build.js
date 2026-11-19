/* Builds early_head.html, the block pasted into Shoprenter > Custom header scripts (2026-11-19).
   It gives desktop pages their final header and page width before menu.js runs, so they do not jump while loading.
     - early/header.css: the header rules, written by hand from menu.js (rr-ui-fixes, rr-catlook, rr-headrows, rr-head2,
       rr-headtidy, rr-topbar3, ...) plus the shop's own stylesheet.css rules that load at the end of the page, and two
       gaps that hold the places of the Christmas bar and the band strip until menu.js inserts them
     - rr-fluid and rr-spacing: copied here from menu.js itself, so they stay identical
     - category pages: the [count] row under the title (10 px taller); band pages: the band alert line (alerts.js)
     - list pages: the theme's own column rules (layout-2-column.css and the "order:-1" style the shop prints after
       the left column), which arrive after the first paint, so the filter column started on the right
   menu.js removes both style blocks once its own header is in ("Early header handover" at the end of menu.js).
   2026-11-20 (list pages, desktop): until the left column is parsed, the product column keeps the column's place
   (the section comes BEFORE the aside in the HTML, so it painted full width and then jumped right); the theme's small
   list-page stylesheets that the page loads inside <body> (early/theme/*.css, copied as they were on 2026-11-20:
   column/sort bar/product grid, pager, breadcrumb, tiles, filter box, price slider) apply from the first paint; the
   filter box is moved to the top of the left column as soon as it is parsed (menu.js did it seconds later); the
   Barlow Condensed menu font starts loading in the head. If the theme updates those files, copy them again.
   Run: node early/build.js   then paste early_head.html into the admin field if it changed. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'menu.js'), 'utf8').replace(/\r\n/g, '\n');   /* a Windows checkout may write CRLF */

function cssOf(guard, start, end, vars) {
  const a = src.indexOf(guard);
  if (a < 0) { throw new Error('guard not found: ' + guard); }
  const b = src.indexOf(start, a), c = src.indexOf(end, b);
  if (b < 0 || c < 0 || c - a > 20000) { throw new Error('css not found after ' + guard); }
  let expr = src.slice(b + start.length, c);
  for (const [k, v] of Object.entries(vars || {})) { expr = expr.replace(new RegExp('\\b' + k + '\\b', 'g'), JSON.stringify(v)); }
  return eval(expr);  // eslint-disable-line no-eval
}
const W = (src.match(/var W = '([^']+)';/) || [])[1];
if (!W) { throw new Error('rr-fluid width not found'); }
const fluid = cssOf("if (document.getElementById('rr-fluid')) { return; }", 'var css =', ';\n  var style = document.createElement', { W });
const spacing = cssOf("if (document.getElementById('rr-spacing')) { return; }", 'var css = ', ';\n', {});
const XMAS = (src.match(/var XMAS_UNTIL = '(\d{4}-\d\d-\d\d)';/) || [])[1];
if (!XMAS) { throw new Error('XMAS_UNTIL not found'); }
const header = fs.readFileSync(path.join(__dirname, 'header.css'), 'utf8').trim();
const min = s => s.replace(/\s*\n\s*/g, '\n').trim();
/* same order as the list pages load them; they come before header.css, which holds rules from later stylesheets */
const THEME = ['module-pathway.css', 'product-card-quantity.css', 'component-subcategories.css', 'layout-2-column.css',
  'component-pagination.css', 'component-filter-slider.css', 'module-paffilter.css'];
const theme = THEME.map(f => fs.readFileSync(path.join(__dirname, 'theme', f), 'utf8').trim()).join('\n');
/* the two files Google serves for Barlow Condensed 700 (latin, latin-ext) as of 2026-11-20; when Google moves to a new
   version the preload is simply unused (menu.js still loads the font through the stylesheet) */
const FONTS = ['v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2z3bWuQ.woff2', 'v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2z3jWuZEC.woff2'];
/* early/keep.css stays for good (menu.js does not remove it): desktop breadcrumb on one line, the last item (product
   name) ends in "..." instead of wrapping when menu.js adds the [counts] and capitals (1100-1280 px product pages
   dropped 22 px, 2026-11-20) */
const keep = fs.readFileSync(path.join(__dirname, 'keep.css'), 'utf8').trim();
for (const [n, c] of [['theme', theme], ['header', header], ['keep', keep]]) {   /* the admin field strips comments, even inside strings */
  if (/\/\/|\/\*/.test(c)) { throw new Error(n + ' css must not contain // or /*'); }
}

/* Shoprenter's HEAD field takes <script> elements only (a <style> or an HTML comment is refused on save), so the
   styles are added by a script. It runs while the head is parsed, so they apply before the first paint, at the same
   place in the head as an inline <style>. */
const fluidCss = '@media (min-width:992px){\n' + min(spacing) + '\n' + min(fluid) + '\n}';
const headCss = '@media (min-width:992px){\n' + min(theme) + '\n}\n' + min(header);
const keepCss = min(keep);
for (const c of [fluidCss, headCss, keepCss]) { if (/<\/|<!--/.test(c)) { throw new Error('css must not contain </ or <!--'); } }
const out =
  '<script>/* RagnaRock early header (2026-11-19), built by rockpince-menu-counts/early/build.js, do not edit by hand. ' +
  'Gives desktop pages their final header and width before menu.js runs, so they do not jump while loading; ' +
  'menu.js removes it once its own header is in. */\n' +
  '(function(){try{var f=[],p=location.pathname+location.search;if(/checkout|kosar|cart/i.test(p)){f.push(\'nobands\');}' +
  'if(/^\\/zenekarok\\/[^\\/]+\\/?$/.test(location.pathname)){f.push(\'bandpage\');}' +
  'if(new Date(Date.now()+36e5).toISOString().slice(0,10)>\'' + XMAS + '\'){f.push(\'noxmas\');}' +
  'document.documentElement.setAttribute(\'data-rr-early\',f.join(\' \'));}catch(e){}\n' +
  /* same order as menu.js adds them (rr-spacing, then rr-fluid, then the header styles), so ties resolve the same way;
     checkout pages do not get rr-fluid (menu.js leaves it out there too) */
  'function add(id,css){var s=document.createElement(\'style\');s.id=id;s.textContent=css;(document.head||document.documentElement).appendChild(s);}\n' +
  'if(!/^\\/checkout/.test(location.pathname)){add(\'rr-early-fluid\',' + JSON.stringify(fluidCss) + ');}\n' +
  'add(\'rr-early-head\',' + JSON.stringify(headCss) + ');\n' +
  'add(\'rr-early-keep\',' + JSON.stringify(keepCss) + ');\n' +
  /* desktop only: the menu font starts loading in the head (addresses split so the admin field does not read them as
     comments). Its own id: menu.js adds its #rr-catlook-font link AND the #rr-catlook menu style only when that id is
     missing, so reusing the id would drop the menu look (found in testing 2026-11-20). Then the filter box move. */
  'if(window.innerWidth>=992){try{' + FONTS.map(f => 'var P=document.createElement(\'link\');P.rel=\'preload\';P.as=\'font\';P.type=\'font/woff2\';P.crossOrigin=\'anonymous\';' +
    'P.href=\'https:\'+\'/\'+\'/fonts.gstatic.com/s/barlowcondensed/' + f + '\';(document.head||document.documentElement).appendChild(P);').join('') +
  'var L=document.createElement(\'link\');L.id=\'rr-early-font\';L.rel=\'stylesheet\';' +
  'L.href=\'https:\'+\'/\'+\'/fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&display=swap\';(document.head||document.documentElement).appendChild(L);' +
  /* html.rr-colwait holds the left column's place for the product column until the column is parsed */
  'var H=document.documentElement,C=document.getElementsByClassName(\'list-page-column-left\'),fd=0;H.classList.add(\'rr-colwait\');' +
  'var mo=new MutationObserver(function(){if(C.length){H.classList.remove(\'rr-colwait\');}' +
  'var f=!fd&&document.getElementById(\'module_paf_filter_wrapper\'),a=f&&f.parentNode;' +
  'if(a&&a.nodeName===\'ASIDE\'&&/\\bcolumn-left\\b/.test(a.className)){if(a.firstElementChild!==f){a.insertBefore(f,a.firstChild);}fd=1;}' +
  'if(C.length&&fd){mo.disconnect();}});' +
  'mo.observe(H,{childList:true,subtree:true});document.addEventListener(\'DOMContentLoaded\',function(){mo.disconnect();H.classList.remove(\'rr-colwait\');});}catch(e){}}\n' +
  /* safety net: if menu.js never runs (GitHub down), the theme's own header comes back instead of empty gaps */
  'setTimeout(function(){[\'rr-early-fluid\',\'rr-early-head\'].forEach(function(i){var e=document.getElementById(i);if(e){e.parentNode.removeChild(e);}});},12000);\n' +
  '})();</script>\n';
fs.writeFileSync(path.join(root, 'early_head.html'), out, { encoding: 'utf8' });
console.log('early_head.html', out.length, 'chars (header', header.length, ', fluid', fluid.length, ', spacing', spacing.length + ')');
