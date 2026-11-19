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
   Run: node early/build.js   then paste early_head.html into the admin field if it changed. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'menu.js'), 'utf8');

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

const out =
  '<!-- RagnaRock early header (2026-11-19). Shoprenter: Custom header scripts. Built by rockpince-menu-counts/early/build.js, do not edit by hand. ' +
  'Gives desktop pages their final header and width before menu.js runs, so they do not jump while loading; menu.js removes it once its own header is in. -->\n' +
  '<script>(function(){try{var f=[],p=location.pathname+location.search;if(/checkout|kosar|cart/i.test(p)){f.push(\'nobands\');}' +
  'if(/^\\/zenekarok\\/[^\\/]+\\/?$/.test(location.pathname)){f.push(\'bandpage\');}' +
  'if(new Date(Date.now()+36e5).toISOString().slice(0,10)>\'' + XMAS + '\'){f.push(\'noxmas\');}' +
  'document.documentElement.setAttribute(\'data-rr-early\',f.join(\' \'));}catch(e){}})();</script>\n' +
  /* same order as menu.js adds them (rr-spacing, then rr-fluid, then the header styles), so ties resolve the same way */
  '<style id="rr-early-fluid">@media (min-width:992px){\n' + min(spacing) + '\n' + min(fluid) + '\n}</style>\n' +
  '<script>if(/^\\/checkout/.test(location.pathname)){var rrEf=document.getElementById(\'rr-early-fluid\');if(rrEf){rrEf.parentNode.removeChild(rrEf);}}</script>\n' +
  '<style id="rr-early-head">\n' + min(header) + '\n</style>\n' +
  /* safety net: if menu.js never runs (GitHub down), the theme's own header comes back instead of empty gaps */
  '<script>setTimeout(function(){[\'rr-early-fluid\',\'rr-early-head\'].forEach(function(i){var e=document.getElementById(i);if(e){e.parentNode.removeChild(e);}});},12000);</script>\n';
fs.writeFileSync(path.join(root, 'early_head.html'), out, { encoding: 'utf8' });
console.log('early_head.html', out.length, 'chars (header', header.length, ', fluid', fluid.length, ', spacing', spacing.length + ')');
