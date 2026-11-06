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
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHECK = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---------- routine data ---------- */
const TASKS = [
  ['t1', 'Prayer + the Word'], ['t2', 'Phone to the store'], ['t3', 'JAMB reading, 2 hours'],
  ['t4', 'Evening prayer'], ['t5', 'Pauline chapter']
];
const BONUS = ['bx', 'Exercise, 20 minutes'];
let routine = store.get('ul_routine', {});
const cnt = k => { const o = routine[k] || {}; return TASKS.filter(t => o[t[0]]).length; };
const perfect = k => cnt(k) === 5;
function runBack(pred) {
  let d = today0(), n = 0;
  if (!pred(dkey(d))) d = addDays(d, -1);
  while (pred(dkey(d)) && n < 4000) { n++; d = addDays(d, -1); }
  return n;
}
function bestRun(pred) {
  const ks = Object.keys(routine).filter(pred).sort();
  let best = 0, run = 0, prev = null;
  ks.forEach(k => {
    run = prev && dkey(addDays(fromKey(prev), 1)) === k ? run + 1 : 1;
    if (run > best) best = run; prev = k;
  });
  return best;
}

/* ---------- Today pane ---------- */
const QUOTES = [
  'Small steps, taken daily, build a strong life.',
  'Show up today. Tomorrow will thank you.',
  'Read a page. Pray a prayer. Win the day.',
  'Consistency beats intensity.',
  'Focus on the next hour, not the whole year.',
  'You do not need more time, only a clearer start.',
  'Discipline is choosing what matters most over what feels easy now.'
];
const pane = document.createElement('div');
pane.className = 'pane'; pane.dataset.pane = 'today'; pane.hidden = true;
$('.wrap').insertBefore(pane, $('.foot-note'));
let vd = today0(), lastDay = dkey(vd);

function row(id, label, o) {
  return '<div class="blk' + (o[id] ? ' done' : '') + '" data-task="' + id + '"><button class="chk" aria-label="Toggle">' + CHECK +
    '</button><div class="blk-t"><div class="blk-sub">' + esc(label) + '</div></div></div>';
}
function renderToday() {
  const now = new Date(), t0 = today0(), k = dkey(vd), isT = k === dkey(t0), o = routine[k] || {};
  const n = cnt(k), pct = Math.round(n / 5 * 100), h = now.getHours();
  const g = !isT ? 'Reviewing this day' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const log = store.get('if_log', {}), st = store.get('if_settings', {}), goal = st.goal || 120;
  const min = (log[k] && log[k].min) || 0, rp = Math.min(100, Math.round(min / goal * 100));
  const cur = runBack(perfect), best = Math.max(bestRun(perfect), cur);
  const dm = (t0.getDay() + 6) % 7, nm = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  let wk = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(t0, i - dm), c = d > t0 ? 0 : cnt(dkey(d));
    wk += '<div class="' + (i === dm ? 'now' : '') + '"><i class="' + (c === 5 ? 'f' : '') + '" style="height:' + Math.max(5, c * 18) + '%"></i>' + nm[i] + '</div>';
  }
  const msg = n === 5 ? 'All five done. Well finished.' : (5 - n) + ' left to finish this day.';
  pane.innerHTML =
    '<section class="card hero"><div class="hero-t"><h1>' + g + '</h1><div class="note">' +
      vd.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + '</div>' +
      '<div class="note">' + msg + '</div></div><div class="ring" style="--p:' + pct + '"><b>' + pct + '%</b></div></section>' +
    '<section class="card"><div class="dnav"><button class="icon-btn" data-d="-1" aria-label="Previous day">&lsaquo;</button>' +
      '<div class="sec-h">' + (isT ? 'Today\'s routine' : vd.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })) + '</div>' +
      '<button class="icon-btn" data-d="1" aria-label="Next day"' + (isT ? ' disabled' : '') + '>&rsaquo;</button></div>' +
      '<div class="blocks">' + TASKS.map(t => row(t[0], t[1], o)).join('') + '</div>' +
      '<div class="blocks bonus"><div class="note">Bonus</div>' + row(BONUS[0], BONUS[1], o) + '</div>' +
      (isT ? '' : '<button class="btn sm wide" data-d="today" style="margin-top:12px">Back to today</button>') + '</section>' +
    '<section class="card"><div class="stats"><div><b>' + n + '/5</b><span>Done</span></div><div><b>' + (5 - n) +
      '</b><span>Left</span></div><div><b>' + cur + '</b><span>Day streak</span></div></div>' +
      '<div class="note" style="margin-top:10px">Best streak: ' + best + ' days</div></section>' +
    '<section class="card"><div class="goal-row"><div class="sec-h">Reading focus</div><div class="goal-pct">' + rp + '%</div></div>' +
      '<div class="goal-num">' + min + '<small>/' + goal + ' min</small></div><div class="bar"><i style="width:' + rp + '%"></i></div></section>' +
    '<section class="card"><div class="sec-h">This week</div><div class="wkbar">' + wk + '</div></section>' +
    '<section class="card"><div class="quote">' + QUOTES[Math.floor(t0 / 864e5) % QUOTES.length] + '</div></section>' +
    '<section class="card go"><button class="btn sm" data-go="focus">Timer</button><button class="btn sm" data-go="read">Reading</button><button class="btn sm" data-go="train">Exercise</button></section>';
}
pane.addEventListener('click', e => {
  const r = e.target.closest('[data-task]'), d = e.target.closest('[data-d]'), go = e.target.closest('[data-go]');
  if (r) {
    const k = dkey(vd); routine[k] = routine[k] || {};
    routine[k][r.dataset.task] = !routine[k][r.dataset.task];
    store.set('ul_routine', routine); renderToday();
  } else if (d) {
    if (d.dataset.d === 'today') vd = today0();
    else { const nd = addDays(vd, Number(d.dataset.d)); if (nd <= today0()) vd = nd; }
    renderToday();
  } else if (go) {
    const b = $('.nav-btn[data-t="' + go.dataset.go + '"]'); if (b) b.click();
  }
});
function showToday() {
  $$('.pane').forEach(p => { p.hidden = p !== pane; });
  $$('.nav-btn').forEach(b => b.classList.toggle('on', b.dataset.t === 'today'));
  renderToday();
  try { window.scrollTo(0, 0); } catch (e) {}
}
$('.nav').addEventListener('click', e => {
  const b = e.target.closest('.nav-btn');
  if (b && b.dataset.t === 'today') { e.stopPropagation(); vd = today0(); showToday(); }
}, true);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (dkey(today0()) !== lastDay) { lastDay = dkey(today0()); vd = today0(); }
  if (!pane.hidden) renderToday();
});

/* ---------- opening quiz ---------- */
const QZ = [
  ['Biology', 'Which organelle is the powerhouse of the cell?', 'Mitochondrion', ['Ribosome', 'Nucleus', 'Golgi body']],
  ['Biology', 'Which pigment captures light for photosynthesis?', 'Chlorophyll', ['Haemoglobin', 'Melanin', 'Keratin']],
  ['Biology', 'What is the basic unit of heredity?', 'Gene', ['Enzyme', 'Tissue', 'Hormone']],
  ['Chemistry', 'What is the atomic number of carbon?', '6', ['4', '8', '12']],
  ['Chemistry', 'Which gas forms when zinc reacts with dilute hydrochloric acid?', 'Hydrogen', ['Oxygen', 'Chlorine', 'Carbon dioxide']],
  ['Chemistry', 'What is the pH of pure water at 25 degrees C?', '7', ['1', '5', '14']],
  ['Physics', 'What is the SI unit of force?', 'Newton', ['Joule', 'Watt', 'Pascal']],
  ['Physics', 'Which of these is a vector quantity?', 'Velocity', ['Speed', 'Mass', 'Time']],
  ['Physics', 'Which quantity is measured in joules?', 'Energy', ['Power', 'Force', 'Pressure']],
  ['English', 'Choose the word closest in meaning to "abundant".', 'Plentiful', ['Scarce', 'Narrow', 'Hidden']],
  ['English', 'Choose the correct sentence.', 'Neither of the boys is here.', ['Neither of the boys are here.', 'Neither of the boys were here.', 'Neither of the boys be here.']],
  ['English', 'Choose the opposite of "generous".', 'Stingy', ['Kind', 'Polite', 'Wealthy']]
];
const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function startQuiz() {
  const seen = {}, picks = [];
  shuf(QZ).forEach(q => { if (picks.length < 3 && !seen[q[0]]) { seen[q[0]] = 1; picks.push(q); } });
  let i = 0, score = 0;
  const ov = document.createElement('div'); ov.className = 'qz';
  document.body.appendChild(ov);
  const close = () => { ov.remove(); };
  function save() {
    const h = store.get('ul_quiz', {}); h[dkey(new Date())] = { s: score, t: picks.length };
    const ks = Object.keys(h).sort().slice(-60), o = {}; ks.forEach(k => { o[k] = h[k]; }); store.set('ul_quiz', o);
  }
  function show() {
    if (i >= picks.length) {
      save();
      ov.innerHTML = '<div class="card"><div class="sec-h">Warm-up done</div><h2 class="q-t">You got ' + score + ' of ' + picks.length +
        '.</h2><div class="note">' + (score === picks.length ? 'Sharp. Your mind is ready.' : 'Good start. Every miss is a lesson for later.') +
        '</div><button class="btn primary" id="qgo">Start my day</button></div>';
      $('#qgo').onclick = close; return;
    }
    const q = picks[i], opts = shuf([q[2]].concat(q[3]));
    ov.innerHTML = '<div class="card"><div class="q-top"><div class="sec-h">' + q[0] + ' &middot; ' + (i + 1) + '/' + picks.length +
      '</div><button id="qskip">SKIP</button></div><h2 class="q-t">' + esc(q[1]) + '</h2><div class="q-o">' +
      opts.map(o => '<button data-a="' + esc(o) + '">' + esc(o) + '</button>').join('') + '</div></div>';
    $('#qskip').onclick = close;
    $$('.q-o button', ov).forEach(b => b.onclick = () => {
      if (ov.dataset.lock) return; ov.dataset.lock = '1';
      const right = b.dataset.a === q[2];
      if (right) score++;
      b.classList.add(right ? 'ok' : 'no');
      if (!right) $$('.q-o button', ov).forEach(x => { if (x.dataset.a === q[2]) x.classList.add('ok'); });
      setTimeout(() => { delete ov.dataset.lock; i++; if (ov.isConnected) show(); }, 1000);
    });
  }
  show();
}

/* ---------- init ---------- */
showToday();
startQuiz();
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.update())).catch(() => {});
})();
