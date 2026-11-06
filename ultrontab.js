(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const css = document.createElement('style');
css.textContent = '.ufrm{display:block;width:100%;height:calc(100dvh - 250px);min-height:380px;border:0;background:#000}' +
  '.nav-btn span{font-size:10px}';
document.head.appendChild(css);
const pane = document.createElement('div');
pane.className = 'pane'; pane.dataset.pane = 'ultron'; pane.hidden = true;
pane.innerHTML = '<section class="card" style="padding:0;overflow:hidden"><iframe class="ufrm" title="Ultron"></iframe></section>' +
  '<div class="note">Ultron interface preview. Tap the orb to cycle its moods. Live replies connect through the Ultron agent project.</div>';
$('.wrap').insertBefore(pane, $('.foot-note'));
const frame = $('.ufrm', pane);
const btn = document.createElement('button');
btn.className = 'nav-btn'; btn.dataset.t = 'ultron';
btn.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/></svg><span>Ultron</span>';
$('.nav').appendChild(btn);
$('.nav').addEventListener('click', e => {
  const b = e.target.closest('.nav-btn');
  if (!b) return;
  if (b.dataset.t !== 'ultron') { if (frame.getAttribute('src')) frame.removeAttribute('src'); return; } // stop the orb when leaving, saves battery
  e.stopPropagation();
  $$('.pane').forEach(p => { p.hidden = p !== pane; });
  $$('.nav-btn').forEach(x => x.classList.toggle('on', x === b));
  if (!frame.getAttribute('src')) frame.src = 'ultron.html';
  try { window.scrollTo(0, 0); } catch (err) {}
}, true);
})();
