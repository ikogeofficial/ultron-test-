(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const pad = n => String(n).padStart(2, '0');
const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const fromKey = k => { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const CHECK = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const NAMES = { t1: 'Prayer + the Word', t2: 'Phone to the store', t3: 'JAMB reading', t4: 'Evening prayer', t5: 'Pauline chapter' };
const TASKS = Object.keys(NAMES);
let routine = {};
const cnt = k => { const o = routine[k] || {}; return TASKS.filter(t => o[t]).length; };
function runBack(pred) {
  let d = today0(), n = 0;
  if (!pred(dkey(d))) d = addDays(d, -1);
  while (pred(dkey(d)) && n < 4000) { n++; d = addDays(d, -1); }
  return n;
}
function bestRun(ks) {
  let best = 0, run = 0, prev = null;
  ks.forEach(k => { run = prev && dkey(addDays(fromKey(prev), 1)) === k ? run + 1 : 1; if (run > best) best = run; prev = k; });
  return best;
}

const css = document.createElement('style');
css.textContent = '.chart14{display:grid;grid-template-columns:repeat(14,1fr);gap:4px;align-items:end;height:96px;margin-top:10px}' +
  '.chart14 div{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px;height:100%;font:9px var(--mono);color:var(--mut)}' +
  '.chart14 i{width:100%;border-radius:5px;background:rgba(255,255,255,.1);min-height:4px}' +
  '.chart14 i.f{background:linear-gradient(180deg,#c4b0ff,#7c5ce0);box-shadow:0 0 10px rgba(167,139,250,.5)}.chart14 .now{color:var(--v)}' +
  '.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-top:10px}' +
  '.cal .h{font:10px var(--mono);color:var(--mut);text-align:center}' +
  '.cal button{aspect-ratio:1;border-radius:10px;border:1px solid var(--glass-b);background:rgba(255,255,255,.05);color:var(--txt);font:12px var(--mono);cursor:pointer;padding:0}' +
  '.cal button.f{background:linear-gradient(160deg,#b9a2ff,#7c5ce0);border-color:transparent;color:#0b0714;font-weight:700}' +
  '.cal button.p{background:rgba(167,139,250,.28)}.cal button.x{opacity:.3;cursor:default}.cal button.sel{outline:2px solid #fff}' +
  '.wks{display:flex;flex-direction:column;gap:7px;margin-top:10px}.wks div{display:flex;align-items:center;gap:10px;font:11px var(--mono);color:var(--mut)}' +
  '.wks b{flex:1;height:8px;border-radius:9px;background:rgba(255,255,255,.08);overflow:hidden}.wks i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#7c5ce0,#c4b0ff)}' +
  '.nn-g{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:12px 0}' +
  '.nn-g button{aspect-ratio:1;border-radius:12px;border:1px solid var(--glass-b);background:rgba(255,255,255,.04);color:var(--mut);font:12px var(--mono);cursor:pointer;padding:0;display:grid;place-items:center}' +
  '.nn-g .ok{background:linear-gradient(160deg,#b9a2ff,#7c5ce0);border-color:transparent}.nn-g .ms{border-style:dashed;color:var(--dim)}' +
  '.nn-g .pd{border-color:var(--v);color:var(--txt);box-shadow:0 0 12px rgba(167,139,250,.35)}.nn-g .ft{opacity:.3;cursor:default}' +
  '.nn-body{transition:filter .3s}.nn-body.hid{filter:blur(12px);pointer-events:none;user-select:none}' +
  '.legend{display:flex;gap:12px;font-size:11px;color:var(--mut);flex-wrap:wrap}' +
  '.stats.six{grid-template-columns:repeat(3,1fr)}.stats.six div{margin:0}';
document.head.appendChild(css);

const pane = document.createElement('div');
pane.className = 'pane'; pane.dataset.pane = 'streaks'; pane.hidden = true;
$('.wrap').insertBefore(pane, $('.foot-note'));
const btn = document.createElement('button');
btn.className = 'nav-btn'; btn.dataset.t = 'streaks';
btn.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg><span>Streaks</span>';
$('.nav').insertBefore(btn, $('.nav-btn[data-t="train"]'));

let sel = null;
function render() {
  routine = store.get('ul_routine', {});
  const nn = store.get('ul_nnn', {}), hid = store.get('ul_nnnhide', false);
  const t0 = today0(), tk = dkey(t0), y = t0.getFullYear();
  const perfKeys = Object.keys(routine).filter(k => cnt(k) === 5).sort();
  const cur = runBack(k => cnt(k) === 5), best = Math.max(cur, bestRun(perfKeys));
  let sum = 0, pd = 0;
  for (let i = 0; i < 30; i++) { const c = cnt(dkey(addDays(t0, -i))); sum += c; if (c === 5) pd++; }
  let ch = '';
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t0, -i), c = cnt(dkey(d));
    ch += '<div class="' + (i === 0 ? 'now' : '') + '"><i class="' + (c === 5 ? 'f' : '') + '" style="height:' + Math.max(5, c * 20) + '%"></i>' + d.getDate() + '</div>';
  }
  const dm = (t0.getDay() + 6) % 7;
  let wk = '';
  for (let w = 7; w >= 0; w--) {
    const ws = addDays(t0, -dm - 7 * w); let c = 0;
    for (let j = 0; j < 7; j++) { const d = addDays(ws, j); if (d <= t0 && cnt(dkey(d)) === 5) c++; }
    wk += '<div>' + pad(ws.getDate()) + '/' + pad(ws.getMonth() + 1) + '<b><i style="width:' + Math.round(c / 7 * 100) + '%"></i></b>' + c + '/7</div>';
  }
  const m = t0.getMonth(), first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  let cal = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => '<div class="h">' + x + '</div>').join('');
  for (let i = 0; i < lead; i++) cal += '<span></span>';
  for (let d = 1; d <= dim; d++) {
    const dt = new Date(y, m, d), k = dkey(dt), c = cnt(k), fut = dt > t0;
    cal += '<button class="' + (fut ? 'x' : c === 5 ? 'f' : c > 0 ? 'p' : '') + (sel === k ? ' sel' : '') + '"' + (fut ? ' disabled' : ' data-sel="' + k + '"') + '>' + d + '</button>';
  }
  let detail = 'Tap a day to see what was done.';
  if (sel) {
    const o = routine[sel] || {}, done = TASKS.filter(t => o[t]).map(t => NAMES[t]);
    detail = fromKey(sel).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }) + ': ' + cnt(sel) + '/5' +
      (o.bx ? ' + exercise bonus' : '') + '. ' + (done.length ? done.join(', ') + '.' : 'Nothing logged.');
  }
  /* No Nut November */
  const nk = d => y + '-11-' + pad(d);
  let ok = 0, ms = 0, left = 0, cells = '';
  for (let d = 1; d <= 30; d++) {
    const dt = new Date(y, 10, d), k = nk(d);
    let c, tx = d;
    if (nn[k]) { c = 'ok'; ok++; tx = CHECK; }
    else if (dt > t0) { c = 'ft'; left++; }
    else if (dt.getTime() === t0.getTime()) { c = 'pd'; left++; }
    else { c = 'ms'; ms++; }
    cells += '<button class="' + c + '"' + (c === 'ft' ? ' disabled' : ' data-nd="' + k + '"') + '>' + tx + '</button>';
  }
  const ncur = runBack(k => !!nn[k]), nbest = Math.max(ncur, bestRun(Object.keys(nn).sort()));
  const inNov = t0.getMonth() === 10, todayOk = !!nn[tk];
  const msg = !inNov ? (t0.getMonth() < 10 ? 'The challenge opens on 1 November.' : 'The challenge month has ended. Your record is saved here.') :
    todayOk ? 'Checked in for today. Well done.' :
    (ncur === 0 && ms > 0 ? 'A fresh start is always available. Today can be day one.' : 'Check in when your day is done.');
  pane.innerHTML =
    '<section class="card"><div class="sec-h">Daily streak</div><div class="stats" style="margin-top:10px"><div><b>' + cur + '</b><span>Current</span></div><div><b>' + best +
      '</b><span>Best</span></div><div><b>' + perfKeys.length + '</b><span>Perfect days</span></div></div>' +
      '<div class="note" style="margin-top:10px">Last 30 days: ' + pd + ' perfect days, average ' + Math.round(sum / 150 * 100) + '% of tasks done. A perfect day means all 5 core tasks.</div></section>' +
    '<section class="card"><div class="sec-h">Last 14 days</div><div class="chart14">' + ch + '</div></section>' +
    '<section class="card"><div class="sec-h">' + t0.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + '</div><div class="cal">' + cal + '</div>' +
      '<div class="note" style="margin-top:10px">' + detail + '</div></section>' +
    '<section class="card"><div class="sec-h">Weekly history</div><div class="wks">' + wk + '</div></section>' +
    '<section class="card"><div class="sec-row"><div class="sec-h">No Nut November</div><button class="btn sm" data-nn="hide">' + (hid ? 'Show' : 'Hide') + '</button></div>' +
      '<div class="nn-body' + (hid ? ' hid' : '') + '"><div class="note" style="margin-top:6px">Private. Kept only on this phone and separate from your reading streak.</div>' +
      '<div class="stats six" style="margin-top:10px"><div><b>' + ncur + '</b><span>Current</span></div><div><b>' + nbest + '</b><span>Best</span></div><div><b>' + ok +
      '</b><span>Done</span></div><div><b>' + left + '</b><span>Left</span></div><div><b>' + ms + '</b><span>Missed</span></div><div><b>' + Math.round(ok / 30 * 100) + '%</b><span>Progress</span></div></div>' +
      '<div class="bar"><i style="width:' + Math.round(ok / 30 * 100) + '%;background:#a78bfa;box-shadow:0 0 14px rgba(167,139,250,.6)"></i></div>' +
      '<div class="nn-g">' + cells + '</div>' +
      '<div class="legend"><span>Violet: done</span><span>Dashed: missed</span><span>Glow: today</span><span>Faint: ahead</span></div>' +
      '<div class="note" style="margin:10px 0">' + msg + '</div>' +
      '<button class="btn primary wide" data-nn="check"' + (inNov ? '' : ' disabled') + '>' + (todayOk ? 'Checked in. Tap to undo' : 'Check in today') + '</button>' +
      '<button class="btn sm wide" data-nn="reset" style="margin-top:10px">Reset challenge data</button></div></section>';
}
function toggleNN(k) {
  const t0 = today0(), y = t0.getFullYear(), dt = fromKey(k);
  if (dt.getFullYear() !== y || dt.getMonth() !== 10 || dt > t0) return;
  const nn = store.get('ul_nnn', {});
  if (nn[k]) delete nn[k]; else nn[k] = 1;
  store.set('ul_nnn', nn);
}
pane.addEventListener('click', e => {
  const s = e.target.closest('[data-sel]'), n = e.target.closest('[data-nn]'), d = e.target.closest('[data-nd]');
  if (s) { sel = sel === s.dataset.sel ? null : s.dataset.sel; }
  else if (d) { toggleNN(d.dataset.nd); }
  else if (n) {
    const a = n.dataset.nn;
    if (a === 'hide') store.set('ul_nnnhide', !store.get('ul_nnnhide', false));
    else if (a === 'check') toggleNN(dkey(today0()));
    else if (a === 'reset' && confirm('Reset all No Nut November check-ins? This cannot be undone.')) store.set('ul_nnn', {});
  } else return;
  render();
});
$('.nav').addEventListener('click', e => {
  const b = e.target.closest('.nav-btn');
  if (!b || b.dataset.t !== 'streaks') return;
  e.stopPropagation();
  $$('.pane').forEach(p => { p.hidden = p !== pane; });
  $$('.nav-btn').forEach(x => x.classList.toggle('on', x === b));
  render();
  try { window.scrollTo(0, 0); } catch (err) {}
}, true);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !pane.hidden) render(); });
})();
