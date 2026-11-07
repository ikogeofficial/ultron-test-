(() => {
'use strict';
const D = window.IKOGE_DATA;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* =====================================================================
   helpers
   ===================================================================== */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const clamp = (n, a, b, d) => { n = Math.round(Number(n)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* dates: always local calendar days, stored as YYYY-MM-DD */
const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayKey = () => dkey(new Date());
const parseKey = k => { const p = String(k).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const dowOf = k => (parseKey(k).getDay() + 6) % 7; // 0 = Monday
const dowMon = () => dowOf(todayKey());
const weekStart = k => addDays(k, -dowOf(k));
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDay = k => { const d = parseKey(k); return DAYS[dowOf(k)] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); };
const hm = m => { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm' : m + 'm'; };

const CHECK = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#04170e" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function openDlg(d) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
function closeDlg(d) { try { d.close(); } catch (e) { d.removeAttribute('open'); } }

let toastT = 0;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

function confirmBox(head, text, yes) {
  return new Promise(res => {
    const d = $('#dlgConfirm');
    $('#cfHead').textContent = head; $('#cfText').textContent = text; $('#cfYes').textContent = yes || 'Confirm';
    $('#cfYes').onclick = () => { res(true); closeDlg(d); };
    $('#cfNo').onclick = () => { res(false); closeDlg(d); };
    d.onclose = () => res(false);
    openDlg(d);
  });
}

/* =====================================================================
   state
   ===================================================================== */
const LABELS = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const JAMB_GOAL = 120;
const DEF = {
  name: 'Core', quiz: true, quizN: 5, thresh: 3,
  focus: 25, short: 5, long: 15, every: 4, goal: 120, auto: false, awake: false,
  subjects: ['Biology', 'Chemistry', 'Physics', 'English'],
  aStart: '09:00', aLen: 60, bStart: '16:30', bLen: 60, cap: 90
};
let settings = Object.assign({}, DEF, store.get('if_settings', {}));
if (!Array.isArray(settings.subjects) || settings.subjects.length !== 4) settings.subjects = DEF.subjects.slice();
settings.subjects = settings.subjects.map((s, i) => (/^Subject \d$/.test(s) || !String(s).trim()) ? DEF.subjects[i] : s);

let books = store.get('if_books', []);
let sessions = store.get('if_sessions', []);
let routine = store.get('if_routine', {});
let nnn = store.get('if_nnn', { checks: {} });
if (!nnn || typeof nnn.checks !== 'object') nnn = { checks: {} };
let quizlog = store.get('if_quizlog', []);

/* one-time: carry the old focus-session log into the new reading history */
(function migrate() {
  if (store.get('if_migr2', false)) return;
  const log = store.get('if_log', {});
  Object.keys(log).forEach(d => {
    const o = log[d]; if (!o || !o.min) return;
    sessions.push({ id: uid(), d, ts: parseKey(d).getTime() + 43200000, min: o.min, pages: 0, sub: null, book: null, kind: 'focus' });
  });
  store.set('if_sessions', sessions); store.set('if_migr2', true);
})();

const saveSettings = () => store.set('if_settings', settings);
const saveBooks = () => { store.set('if_books', books); bust(); };
const saveSessions = () => { store.set('if_sessions', sessions); bust(); };
const saveRoutine = () => store.set('if_routine', routine);
const saveNnn = () => store.set('if_nnn', nnn);

/* ---------- derived data ---------- */
let _ix = null;
function bust() { _ix = null; }
function isJamb(s) {
  if (s.sub) return true;
  if (s.book) { const b = books.find(x => x.id === s.book); return !!b && b.cat === 'JAMB'; }
  return false;
}
function ix() {
  if (_ix) return _ix;
  const m = {}, j = {}, p = {};
  sessions.forEach(s => {
    m[s.d] = (m[s.d] || 0) + s.min; p[s.d] = (p[s.d] || 0) + (s.pages || 0);
    if (isJamb(s)) j[s.d] = (j[s.d] || 0) + s.min;
  });
  _ix = { m, j, p }; return _ix;
}
const minutesOn = k => ix().m[k] || 0;
const jambOn = k => ix().j[k] || 0;
const pagesOn = k => ix().p[k] || 0;

function taskDone(k, key) {
  const r = routine[k] || {};
  if (key === 'p3') return !!r.p3 || jambOn(k) >= JAMB_GOAL;
  return !!r[key];
}
const scoreOf = k => D.CORE_TASKS.reduce((n, t) => n + (taskDone(k, t.k) ? 1 : 0), 0);
const routineOK = k => scoreOf(k) >= settings.thresh;
const readingOK = k => minutesOn(k) > 0;
function firstDate() {
  let f = null;
  Object.keys(routine).forEach(k => { if (!f || k < f) f = k; });
  sessions.forEach(s => { if (!f || s.d < f) f = s.d; });
  return f;
}
function streakOf(pred) {
  let n = 0, k = todayKey();
  if (!pred(k)) k = addDays(k, -1);
  while (n < 3700 && pred(k)) { n++; k = addDays(k, -1); }
  return n;
}
function bestOf(pred) {
  const f = firstDate(); if (!f) return 0;
  const end = todayKey(); let best = 0, cur = 0, k = f, guard = 0;
  while (k <= end && guard++ < 4000) { if (pred(k)) { cur++; if (cur > best) best = cur; } else cur = 0; k = addDays(k, 1); }
  return best;
}
const levelOf = k => { const s = scoreOf(k); return !s ? 0 : s === 5 ? 3 : s >= settings.thresh ? 2 : 1; };

/* =====================================================================
   tabs
   ===================================================================== */
const TABS = ['today', 'read', 'streaks', 'exercise', 'ultron'];
let tab = store.get('if_tab', 'today');
if (!TABS.includes(tab)) tab = 'today';
let sub = 'plan';
let viewDate = todayKey();

function stagger(pane) {
  Array.from(pane.children).forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8)));
}
function showTab(t) {
  if (!TABS.includes(t)) t = 'today';
  tab = t; store.set('if_tab', t);
  document.body.dataset.tab = t;
  $$('.pane').forEach(p => { const on = p.dataset.pane === t; p.hidden = !on; if (on) stagger(p); });
  $$('.nav-btn').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $('#navInd').style.transform = 'translateX(' + (TABS.indexOf(t) * 100) + '%)';
  if (t === 'ultron') { const f = $('#ultronFrame'); if (!f.getAttribute('src')) f.setAttribute('src', f.dataset.src); }
  try { window.scrollTo(0, 0); } catch (e) {}
  renderAll();
}
function showSub(s) {
  sub = s;
  $$('#rSeg button').forEach(b => b.classList.toggle('on', b.dataset.sub === s));
  $$('.sub').forEach(x => { x.hidden = x.dataset.sub !== s; });
}
$('.nav').addEventListener('click', e => { const b = e.target.closest('.nav-btn'); if (b) showTab(b.dataset.t); });
$('#rSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showSub(b.dataset.sub); });

function go(where) {
  if (where === 'read-plan') { showTab('read'); showSub('plan'); }
  else showTab(where);
}

/* =====================================================================
   timer engine
   ===================================================================== */
let mode = 'focus';
let totalSec = settings.focus * 60;
let remaining = totalSec;
let running = false, endAt = 0, timer = null, wakeLock = null;
let cycle = store.get('if_cycle', 0);
let task = null; // { kind: 'read' | 'cod' | 'ex', key, label, subject, bookId }

const R = 128, CIRC = 2 * Math.PI * R;
const ring = $('#ring'), knob = $('#knob');
(function ticks() {
  let h = '';
  for (let i = 0; i < 60; i++) {
    const a = i * Math.PI / 30, major = i % 5 === 0, r1 = major ? 139 : 144, r2 = 150;
    h += '<line class="tk' + (major ? ' major' : '') + '" x1="' + (160 + r1 * Math.sin(a)).toFixed(2) +
      '" y1="' + (160 - r1 * Math.cos(a)).toFixed(2) + '" x2="' + (160 + r2 * Math.sin(a)).toFixed(2) +
      '" y2="' + (160 - r2 * Math.cos(a)).toFixed(2) + '"/>';
  }
  $('#ticks').innerHTML = h;
})();

function fmt(s) {
  s = Math.max(0, Math.ceil(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? h + ':' + pad(m) + ':' + pad(x) : pad(m) + ':' + pad(x);
}

let miniEl = null;
function renderMini() {
  if (!miniEl) {
    miniEl = document.createElement('button'); miniEl.className = 'mini'; miniEl.hidden = true;
    miniEl.addEventListener('click', openFocus); document.body.appendChild(miniEl);
  }
  const active = running || (mode === 'focus' && remaining < totalSec && remaining > 0);
  miniEl.hidden = !active || !$('#focusView').hidden;
  miniEl.innerHTML = '<i></i>' + fmt(remaining) + ' <span>' + esc(task ? task.label : LABELS[mode]) + '</span>';
}

function render() {
  const frac = totalSec > 0 ? Math.max(0, Math.min(1, remaining / totalSec)) : 0;
  ring.style.strokeDasharray = CIRC;
  ring.style.strokeDashoffset = CIRC * (1 - frac);
  const vis = frac > 0.002 ? 1 : 0;
  ring.style.opacity = vis; knob.style.opacity = vis;
  const a = frac * 2 * Math.PI;
  knob.setAttribute('cx', (160 + R * Math.sin(a)).toFixed(2));
  knob.setAttribute('cy', (160 - R * Math.cos(a)).toFixed(2));
  $('#time').textContent = fmt(remaining);
  $('#modeLabel').textContent = LABELS[mode].toUpperCase();
  let s;
  if (mode !== 'focus') s = 'Rest your eyes';
  else if (task) s = task.label;
  else s = 'Session ' + ((cycle % settings.every) + 1) + ' of ' + settings.every;
  $('#cycleTxt').textContent = s;
  $('#fvTag').textContent = task ? (task.kind === 'cod' ? 'TRAINING' : task.kind === 'ex' ? 'EXERCISE' : 'READING') : LABELS[mode].toUpperCase();
  $('#startBtn').textContent = running ? 'Pause' : (remaining < totalSec && remaining > 0 ? 'Resume' : 'Start');
  $('#finishBtn').hidden = mode !== 'focus';
  $$('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  document.body.dataset.mode = mode;
  document.title = running ? fmt(remaining) + ' · ' + LABELS[mode] : 'Ultron';
  renderMini();
}

/* sounds: chime + notification */
let actx = null;
function ctx() {
  if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function chime() {
  const c = ctx(); if (!c) return;
  [659.25, 783.99, 987.77].forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.22;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 1);
  });
}
function notify(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: 'icon.svg', tag: 'ultron-timer', vibrate: [200, 100, 200] }));
    } else { new Notification(title, { body }); }
  } catch (e) {}
}

async function lock() {
  if (!settings.awake || !('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function unlock() { try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null; }

function tick() {
  remaining = Math.max(0, (endAt - Date.now()) / 1000);
  render();
  if (remaining <= 0) finish();
}
function start() {
  if (remaining <= 0) remaining = totalSec;
  ctx();
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
  running = true; endAt = Date.now() + remaining * 1000;
  clearInterval(timer); timer = setInterval(tick, 250);
  lock(); render();
}
function stop() { running = false; clearInterval(timer); unlock(); }
function pause() { if (!running) return; tick(); if (!running) return; stop(); render(); }
function reset() { stop(); remaining = totalSec; render(); }
function setMode(m) { stop(); task = null; mode = m; totalSec = settings[m] * 60; remaining = totalSec; render(); }

function openFocus() { const v = $('#focusView'); v.classList.remove('out'); v.hidden = false; document.body.style.overflow = 'hidden'; render(); }
function closeFocus() {
  const v = $('#focusView'); if (v.hidden) return;
  v.classList.add('out');
  setTimeout(() => { v.hidden = true; v.classList.remove('out'); document.body.style.overflow = ''; renderMini(); }, 280);
}

function startTask(t, minutes) {
  stop(); task = t; mode = 'focus';
  totalSec = Math.max(1, minutes) * 60; remaining = totalSec;
  openFocus(); start();
}

function markDone(storeKey, key) {
  const o = store.get(storeKey, {}), d = todayKey();
  o[d] = o[d] || {}; o[d][key] = true; store.set(storeKey, o);
}

/* log a finished (or manually ended) focus run */
function completeFocus(mins) {
  if (task && task.kind === 'cod') {
    addCod(mins); markDone('if_coddone', task.key);
    notify('Training block done', task.label + ' complete.'); toast('Training logged: ' + mins + ' min');
  } else if (task && task.kind === 'ex') {
    routine[todayKey()] = Object.assign(routine[todayKey()] || {}, { ex: true }); saveRoutine();
    notify('Workout done', 'Bonus complete. Nice work.'); toast('Workout done. Bonus earned');
  } else {
    const s = logSession({ min: mins, sub: task && task.subject || null, book: task && task.bookId || null, kind: task ? 'read' : 'focus' });
    if (task && (task.key === 'A' || task.key === 'B')) markDone('if_done', task.key);
    notify('Reading session done', 'Take a break. You earned it.');
    if (s.book) setTimeout(() => openSessionDlg({ mode: 'summary', s }), 350);
    else toast('Saved: ' + mins + ' min' + (s.sub ? ' of ' + s.sub : ''));
  }
}
function finish() {
  stop(); chime();
  try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) {}
  if (mode === 'focus') {
    const mins = Math.max(1, Math.round(totalSec / 60));
    const kind = task && task.kind;
    completeFocus(mins);
    if (kind === 'cod' || kind === 'ex') mode = 'short';
    else { cycle++; store.set('if_cycle', cycle); mode = (cycle % settings.every === 0) ? 'long' : 'short'; }
    task = null;
  } else { mode = 'focus'; notify('Break over', 'Back to focus.'); }
  totalSec = settings[mode] * 60; remaining = totalSec;
  renderAll(); render();
  if (settings.auto) start();
}
function finishEarly() {
  if (mode !== 'focus') return;
  const spent = Math.round((totalSec - remaining) / 60);
  if (running) tick();
  if (spent < 1) { toast('Run the timer for at least 1 minute first'); return; }
  stop(); completeFocus(spent); task = null;
  totalSec = settings.focus * 60; remaining = totalSec; render(); renderAll(); closeFocus();
}

$('#startBtn').addEventListener('click', () => (running ? pause() : start()));
$('#resetBtn').addEventListener('click', reset);
$('#finishBtn').addEventListener('click', finishEarly);
$('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setMode(b.dataset.m); });
$('#fvClose').addEventListener('click', closeFocus);
$('#fvSounds').addEventListener('click', () => openDlg($('#dlgSounds')));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (running) { tick(); lock(); } renderAll(); }
  bgVisibility();
});

/* =====================================================================
   sessions + books
   ===================================================================== */
function logSession(o) {
  const s = { id: uid(), d: o.d || todayKey(), ts: Date.now(), min: Math.max(1, Math.round(o.min)), pages: o.pages || 0, sub: o.sub || null, book: o.book || null, kind: o.kind || 'read' };
  sessions.push(s); saveSessions(); renderAll(); return s;
}
const bookPages = id => sessions.reduce((n, s) => n + (s.book === id ? (s.pages || 0) : 0), 0);
const bookMins = id => sessions.reduce((n, s) => n + (s.book === id ? s.min : 0), 0);
const sessionName = s => {
  if (s.book) { const b = books.find(x => x.id === s.book); return b ? b.title : 'Removed book'; }
  return s.sub || (s.kind === 'focus' ? 'Focus session' : 'General reading');
};

function forOptions(selected) {
  let h = '<option value="">General reading</option>';
  settings.subjects.forEach(s => { h += '<option value="s:' + esc(s) + '">' + esc(s) + '</option>'; });
  h += '<option value="s:JAMB review">JAMB review</option>';
  const open = books.filter(b => !b.done);
  if (open.length) h += '<optgroup label="Books">' + open.map(b => '<option value="b:' + b.id + '">' + esc(b.title) + '</option>').join('') + '</optgroup>';
  return h;
}
function parseFor(v) {
  if (!v) return { subject: null, bookId: null };
  if (v.startsWith('s:')) return { subject: v.slice(2), bookId: null };
  if (v.startsWith('b:')) return { subject: null, bookId: v.slice(2) };
  return { subject: null, bookId: null };
}
function forLabel(f) { return f.bookId ? ((books.find(b => b.id === f.bookId) || {}).title || 'Book') : (f.subject || 'General reading'); }

/* ---------- session dialog (manual log or pages after a timer) ---------- */
let seCtx = null;
function openSessionDlg(o) {
  seCtx = o; const m = o.mode;
  const lab = id => $('#' + id).parentNode;
  $('#seHead').textContent = m === 'summary' ? 'Session saved' : 'Log a session';
  lab('seFor').hidden = m === 'summary'; lab('seMin').hidden = m === 'summary'; lab('seDate').hidden = m === 'summary';
  $('#seMsg').textContent = '';
  if (m === 'summary') {
    $('#seNote').textContent = o.s.min + ' min on ' + sessionName(o.s) + '. How many pages did you read?';
    $('#sePages').value = o.s.pages || '';
  } else {
    $('#seNote').textContent = 'Add a session you did without the timer.';
    $('#seFor').innerHTML = forOptions(); $('#seFor').value = o.forVal || '';
    $('#seMin').value = o.min || ''; $('#sePages').value = '';
    $('#seDate').value = todayKey(); $('#seDate').max = todayKey();
  }
  openDlg($('#dlgSession'));
}
$('#seCancel').addEventListener('click', () => closeDlg($('#dlgSession')));
$('#seSave').addEventListener('click', () => {
  const pages = clamp($('#sePages').value || 0, 0, 2000, 0);
  if (seCtx.mode === 'summary') {
    const s = sessions.find(x => x.id === seCtx.s.id); if (s) { s.pages = pages; saveSessions(); }
    closeDlg($('#dlgSession')); renderAll(); toast('Pages saved'); return;
  }
  const mins = clamp($('#seMin').value, 1, 600, 0), d = $('#seDate').value || todayKey();
  if (!mins) { $('#seMsg').textContent = 'Enter the minutes you read.'; return; }
  if (d > todayKey()) { $('#seMsg').textContent = 'That date is in the future.'; return; }
  const f = parseFor($('#seFor').value);
  logSession({ min: mins, pages, sub: f.subject, book: f.bookId, d, kind: 'manual' });
  closeDlg($('#dlgSession')); toast('Session added');
});

/* ---------- books ---------- */
let editBookId = null;
function openBook(id) {
  editBookId = id || null;
  const b = id ? books.find(x => x.id === id) : null;
  $('#bkHead').textContent = b ? 'Edit book' : 'Add a book';
  $('#bkTitle').value = b ? b.title : ''; $('#bkAuthor').value = b ? b.author : '';
  $('#bkCat').value = b ? b.cat : 'JAMB'; $('#bkTotal').value = b ? b.total : ''; $('#bkGoal').value = b ? (b.goal || 0) : 10;
  $('#bkMsg').textContent = '';
  openDlg($('#dlgBook'));
}
$('#addBook').addEventListener('click', () => openBook());
$('#bkCancel').addEventListener('click', () => closeDlg($('#dlgBook')));
$('#bkSave').addEventListener('click', () => {
  const title = $('#bkTitle').value.trim(), total = clamp($('#bkTotal').value, 1, 5000, 0);
  if (!title) { $('#bkMsg').textContent = 'Give the book a title.'; return; }
  if (!total) { $('#bkMsg').textContent = 'Enter the total number of pages.'; return; }
  const o = { title, author: $('#bkAuthor').value.trim(), cat: $('#bkCat').value, total, goal: clamp($('#bkGoal').value || 0, 0, 500, 0) };
  if (editBookId) Object.assign(books.find(x => x.id === editBookId) || {}, o);
  else books.unshift(Object.assign({ id: uid(), done: false, added: todayKey() }, o));
  saveBooks(); closeDlg($('#dlgBook')); renderAll(); toast(editBookId ? 'Book updated' : 'Book added');
});

function bookCard(b) {
  const pg = bookPages(b.id), pct = Math.min(100, Math.round(pg / b.total * 100)), today = sessions.filter(s => s.book === b.id && s.d === todayKey()).reduce((n, s) => n + (s.pages || 0), 0);
  const goal = b.goal ? ' · today ' + today + '/' + b.goal + ' pages' : '';
  return '<div class="book" data-id="' + b.id + '"><h3>' + esc(b.title) + '</h3><div class="by">' + esc(b.author || 'Unknown author') + ' · ' + esc(b.cat) + '</div>' +
    '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
    '<div class="meta"><span>' + pg + ' / ' + b.total + ' pages · ' + pct + '%</span><span>' + hm(bookMins(b.id)) + goal + '</span></div>' +
    '<div class="acts">' + (b.done
      ? '<button class="btn sm" data-bact="reopen">Reopen</button><button class="btn sm" data-bact="del">Remove</button>'
      : '<button class="btn primary sm" data-bact="read">Read</button><button class="btn sm" data-bact="log">Pages</button><button class="btn sm" data-bact="done">Finish</button><button class="btn sm" data-bact="edit">Edit</button>') + '</div></div>';
}
function renderBooks() {
  const open = books.filter(b => !b.done), done = books.filter(b => b.done);
  const pages = books.reduce((n, b) => n + bookPages(b.id), 0);
  $('#bookStats').innerHTML = stat(open.length, 'In progress') + stat(done.length, 'Completed') + stat(pages, 'Pages read');
  $('#bookList').innerHTML = open.length ? open.map(bookCard).join('') : '<div class="empty">No books yet. Tap Add book to start your shelf.</div>';
  $('#bookDone').innerHTML = done.length ? done.map(b => bookCard(b).replace('</h3>', ' &#10003;</h3>')).join('') : '<div class="empty">Finished books will collect here.</div>';
}
async function bookAct(e) {
  const btn = e.target.closest('[data-bact]'); if (!btn) return;
  const id = btn.closest('.book').dataset.id, b = books.find(x => x.id === id); if (!b) return;
  const a = btn.dataset.bact;
  if (a === 'edit') openBook(id);
  else if (a === 'log') openSessionDlg({ mode: 'manual', forVal: 'b:' + id });
  else if (a === 'read') { showSub('plan'); $('#forSel').value = 'b:' + id; toast('Pick a time, then press Start'); window.scrollTo(0, 0); }
  else if (a === 'done') { b.done = true; b.doneDate = todayKey(); saveBooks(); renderAll(); toast('Book completed'); }
  else if (a === 'reopen') { b.done = false; delete b.doneDate; saveBooks(); renderAll(); }
  else if (a === 'del') {
    if (await confirmBox('Remove this book?', 'The book is removed from your shelf. Your reading time stays in the history.', 'Remove')) { books = books.filter(x => x.id !== id); saveBooks(); renderAll(); }
  }
}
$('#bookList').addEventListener('click', bookAct);
$('#bookDone').addEventListener('click', bookAct);

/* ---------- history ---------- */
function stat(n, l) { return '<div class="stat"><b>' + n + '</b><span>' + l + '</span></div>'; }
function renderLog() {
  const t = todayKey(), w0 = weekStart(t);
  let wk = 0, wkp = 0, tot = 0, totp = 0;
  sessions.forEach(s => { tot += s.min; totp += s.pages || 0; if (s.d >= w0 && s.d <= t) { wk += s.min; wkp += s.pages || 0; } });
  $('#logStats').innerHTML = stat(hm(minutesOn(t)), 'Today') + stat(hm(wk), 'This week') + stat(hm(tot), 'All time') +
    stat(pagesOn(t), 'Pages today') + stat(wkp, 'Pages this week') + stat(sessions.length, 'Sessions');
  if (!sessions.length) { $('#logList').innerHTML = '<div class="empty">No sessions yet. Start a timer or log one by hand.</div>'; return; }
  const sorted = sessions.slice().sort((a, b) => b.d.localeCompare(a.d) || b.ts - a.ts).slice(0, 80);
  let h = '', last = '';
  sorted.forEach(s => {
    if (s.d !== last) { last = s.d; h += '<div class="logday">' + esc(s.d === t ? 'TODAY' : fmtDay(s.d).toUpperCase()) + ' · ' + hm(minutesOn(s.d)) + '</div>'; }
    h += '<div class="logrow"><div class="lt"><b>' + esc(sessionName(s)) + '</b><span>' + s.min + ' min' + (s.pages ? ' · ' + s.pages + ' pages' : '') + (s.kind === 'manual' ? ' · added by hand' : '') + '</span></div><button class="del" data-del="' + s.id + '" aria-label="Delete session">&times;</button></div>';
  });
  $('#logList').innerHTML = h;
}
$('#logList').addEventListener('click', async e => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  if (await confirmBox('Delete this session?', 'It is removed from your history and totals.', 'Delete')) { sessions = sessions.filter(s => s.id !== b.dataset.del); saveSessions(); renderAll(); }
});
$('#addSession').addEventListener('click', () => openSessionDlg({ mode: 'manual' }));

/* ---------- JAMB subjects ---------- */
function plannedWeek(name) {
  let m = 0;
  for (let d = 0; d < 6; d++) { if (blockInfo(d, 'A').sub === name) m += settings.aLen; if (blockInfo(d, 'B').sub === name) m += settings.bLen; }
  return m;
}
function quizAcc(name) {
  let r = 0, n = 0;
  quizlog.forEach(q => { const x = q.by && q.by[name]; if (x) { r += x[0]; n += x[1]; } });
  return n ? { r, n, pct: Math.round(r / n * 100) } : null;
}
function renderJamb() {
  const exam = new Date(2027, 3, 16), now = new Date(); now.setHours(0, 0, 0, 0);
  $('#jambDays').textContent = Math.max(0, Math.round((exam - now) / 86400000));
  const t = todayKey(), w0 = weekStart(t);
  const cols = ['s0', 's1', 's2', 's3'];
  let h = settings.subjects.map((name, i) => {
    const mine = sessions.filter(s => s.sub === name);
    const tot = mine.reduce((n, s) => n + s.min, 0), wk = mine.filter(s => s.d >= w0).reduce((n, s) => n + s.min, 0);
    const plan = plannedWeek(name) || 1, pct = Math.min(100, Math.round(wk / plan * 100));
    const last = mine.length ? mine.map(s => s.d).sort().pop() : null, qa = quizAcc(name);
    return '<section class="card subj ' + cols[i] + '"><div class="row"><h3><span class="tag"></span>' + esc(name) + '</h3><div class="pill">' + pct + '% of week</div></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="nums">' + stat(hm(tot), 'Total') + stat(hm(wk) , 'This week') + stat(qa ? qa.pct + '%' : '-', 'Quiz score') + '</div>' +
      '<div class="note" style="margin-top:10px">' + mine.length + ' session' + (mine.length === 1 ? '' : 's') + (last ? ' · last read ' + (last === t ? 'today' : fmtDay(last)) : ' · not started yet') + ' · weekly plan ' + hm(plan === 1 ? 0 : plan) + '</div>' +
      '<button class="btn primary sm wide" data-study="' + esc(name) + '">Study ' + esc(name) + '</button></section>';
  }).join('');
  const rev = sessions.filter(s => s.sub === 'JAMB review').reduce((n, s) => n + s.min, 0);
  h += '<section class="card subj s4"><div class="row"><h3><span class="tag"></span>Weak topics and past questions</h3></div><div class="nums" style="grid-template-columns:1fr 1fr">' + stat(hm(rev), 'Review time') + stat(quizlog.length, 'Quizzes taken') + '</div>' +
    '<button class="btn sm wide" data-study="JAMB review">Start a review session</button></section>';
  $('#jambSubjects').innerHTML = h;
}
$('#jambSubjects').addEventListener('click', e => {
  const b = e.target.closest('[data-study]'); if (!b) return;
  startTask({ kind: 'read', key: 'free', label: 'Reading: ' + b.dataset.study, subject: b.dataset.study }, wheelVal);
});

/* =====================================================================
   reading plan: wheel + timetable
   ===================================================================== */
const WHEEL = []; for (let m = 5; m <= 180; m += 5) WHEEL.push(m);
let wheelVal = settings.focus;
const wheel = $('#wheel');
(function buildWheel() {
  wheel.innerHTML = '<div class="pad"></div>' + WHEEL.map(m => '<div data-m="' + m + '">' + m + '</div>').join('') + '<div class="pad"></div>';
})();
function nearest(m) { let b = WHEEL[0]; WHEEL.forEach(x => { if (Math.abs(x - m) < Math.abs(b - m)) b = x; }); return b; }
function paintWheel() {
  $$('#wheel [data-m]').forEach(d => d.classList.toggle('sel', Number(d.dataset.m) === wheelVal));
  $('#wheelLbl').textContent = wheelVal + ' min';
  $$('#chips .chip').forEach(c => c.classList.toggle('on', Number(c.dataset.min) === wheelVal));
}
let wheelAuto = false, wTimer = 0;
function setWheel(m, smooth) {
  wheelVal = nearest(m);
  const idx = WHEEL.indexOf(wheelVal);
  wheelAuto = !!smooth; clearTimeout(wTimer);
  if (smooth) wTimer = setTimeout(() => { wheelAuto = false; }, 600); // ignore in-between scroll events while we animate
  try { wheel.scrollTo({ top: idx * 50, behavior: smooth ? 'smooth' : 'auto' }); } catch (e) { wheel.scrollTop = idx * 50; }
  paintWheel();
}
wheel.addEventListener('scroll', () => {
  if (wheelAuto) return;
  const idx = Math.max(0, Math.min(WHEEL.length - 1, Math.round(wheel.scrollTop / 50)));
  if (WHEEL[idx] !== wheelVal) { wheelVal = WHEEL[idx]; paintWheel(); try { if (navigator.vibrate) navigator.vibrate(4); } catch (e) {} }
});
wheel.addEventListener('touchstart', () => { wheelAuto = false; clearTimeout(wTimer); }, { passive: true });
wheel.addEventListener('click', e => { const d = e.target.closest('[data-m]'); if (d) setWheel(Number(d.dataset.m), true); });
$('#chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) setWheel(Number(b.dataset.min), true); });
$('#tpStart').addEventListener('click', () => {
  const f = parseFor($('#forSel').value);
  startTask({ kind: 'read', key: 'free', label: 'Reading: ' + forLabel(f), subject: f.subject, bookId: f.bookId }, wheelVal);
});

/* timetable: 2 blocks a day, 3 blocks per subject a week, Sunday for review */
function toMin(s) { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; }
function t12(min) {
  min = ((min % 1440) + 1440) % 1440;
  let h = Math.floor(min / 60); const m = min % 60, ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; return h + ':' + pad(m) + ' ' + ap;
}
function blockRange(blk) {
  const s = toMin(blk === 'A' ? settings.aStart : settings.bStart), l = blk === 'A' ? settings.aLen : settings.bLen;
  return [s, s + l];
}
function blockInfo(dow, blk) {
  if (dow === 6) return blk === 'A' ? { label: 'Weak topics review', sub: 'JAMB review' } : { label: 'Past questions', sub: 'JAMB review' };
  const name = settings.subjects[blk === 'A' ? dow % 4 : (dow + 2) % 4];
  return { label: name, sub: name };
}
let ttSel = dowMon();
function renderTimetable() {
  const t = todayKey(), tdow = dowMon(), w0 = weekStart(t), nm = new Date().getHours() * 60 + new Date().getMinutes();
  const cyc = settings.focus + settings.short;
  $('#ttDays').innerHTML = DAYS.map((n, i) => {
    const k = addDays(w0, i), d = parseKey(k).getDate();
    return '<button class="dchip' + (i === ttSel ? ' on' : '') + '" data-d="' + i + '"><span>' + n + '</span><b>' + d + '</b></button>';
  }).join('');
  const k = addDays(w0, ttSel), done = (store.get('if_done', {})[k]) || {}, isToday = ttSel === tdow, future = k > t;
  $('#ttList').innerHTML = ['A', 'B'].map(blk => {
    const [s, e] = blockRange(blk), info = blockInfo(ttSel, blk), d = !!done[blk], n = Math.max(1, Math.floor((e - s) / cyc));
    const now = isToday && nm >= s && nm < e && !d;
    return '<div class="tl' + (d ? ' done' : '') + (now ? ' now' : '') + '"><div class="blk' + (d ? ' done' : '') + '">' +
      '<button class="chk" data-chk="' + blk + '" aria-label="Mark done" ' + (future ? 'disabled' : '') + '>' + CHECK + '</button>' +
      '<div class="blk-t"><div class="blk-time">' + t12(s) + ' - ' + t12(e) + (now ? ' · NOW' : '') + '</div><div class="blk-sub">' + esc(info.label) + '</div>' +
      '<div class="blk-s">' + (blk === 'A' ? 'Morning' : 'Evening') + ' block · about ' + n + ' pomodoro' + (n > 1 ? 's' : '') + '</div></div>' +
      (isToday ? '<button class="btn primary sm" data-start="' + blk + '">Start</button>' : '') + '</div></div>';
  }).join('');
  const [as, ae] = blockRange('A'), [bs, be] = blockRange('B');
  $('#wkTimes').textContent = 'Morning ' + t12(as) + ' - ' + t12(ae) + '  |  Evening ' + t12(bs) + ' - ' + t12(be);
  let g = '<div class="wh"></div><div class="wh">Morning</div><div class="wh">Evening</div>';
  for (let i = 0; i < 7; i++) {
    const c = i === tdow ? ' today' : '';
    g += '<div class="wd' + c + '">' + DAYS[i] + '</div><div class="' + c.trim() + '">' + esc(blockInfo(i, 'A').label) + '</div><div class="' + c.trim() + '">' + esc(blockInfo(i, 'B').label) + '</div>';
  }
  $('#readWeek').innerHTML = g;
}
$('#ttDays').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) { ttSel = Number(b.dataset.d); renderTimetable(); } });
$('#ttList').addEventListener('click', e => {
  const c = e.target.closest('[data-chk]'), s = e.target.closest('[data-start]');
  const k = addDays(weekStart(todayKey()), ttSel);
  if (c && !c.disabled) {
    const o = store.get('if_done', {}); o[k] = o[k] || {}; o[k][c.dataset.chk] = !o[k][c.dataset.chk]; store.set('if_done', o); renderAll();
  } else if (s) {
    const blk = s.dataset.start, info = blockInfo(dowMon(), blk);
    startTask({ kind: 'read', key: blk, label: 'Reading: ' + info.label, subject: info.sub }, settings.focus);
  }
});
$('#editRead').addEventListener('click', openSettings);

/* =====================================================================
   TODAY
   ===================================================================== */
function ringSvg(pct) {
  const c = 2 * Math.PI * 38;
  return '<svg viewBox="0 0 96 96"><defs><linearGradient id="rgGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c2b8ff"/><stop offset="1" stop-color="#6d5bff"/></linearGradient></defs>' +
    '<circle class="rg-t" cx="48" cy="48" r="38"/><circle class="rg-v" cx="48" cy="48" r="38" transform="rotate(-90 48 48)" style="stroke-dasharray:' + c.toFixed(1) + ';stroke-dashoffset:' + (c * (1 - pct / 100)).toFixed(1) + '"/></svg>' +
    '<div class="rg-n"><span>' + pct + '<small>%</small></span></div>';
}
function renderToday() {
  const now = new Date(), t = todayKey(), vk = viewDate > t ? t : viewDate, isToday = vk === t;
  const hr = now.getHours(), g = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  $('#tDate').textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#tGreet').textContent = g + ', ' + settings.name;
  const sc = scoreOf(vk), pct = Math.round(sc / 5 * 100);
  $('#tRing').innerHTML = ringSvg(pct);
  $('#tStats').innerHTML = stat(sc + '/5', 'tasks done') + stat(5 - sc, 'remaining') + stat(streakOf(routineOK), 'day streak');
  const q = D.QUOTES[Math.floor(parseKey(t) / 86400000) % D.QUOTES.length];
  $('#tQuote').innerHTML = '<p>' + esc(q.t) + '</p>' + (q.a ? '<small>' + esc(q.a.toUpperCase()) + '</small>' : '');

  $('#tTasksTitle').textContent = isToday ? "Today's routine" : fmtDay(vk);
  $('#tTasksCount').textContent = sc + ' of 5';
  $('#tTasksCount').classList.toggle('ok', sc === 5);
  let ds = '';
  for (let i = 6; i >= 0; i--) {
    const k = addDays(t, -i);
    ds += '<button class="dchip' + (k === vk ? ' on' : '') + (scoreOf(k) === 5 ? ' full' : '') + '" data-k="' + k + '"><span>' + DAYS[dowOf(k)] + '</span><b>' + parseKey(k).getDate() + '</b></button>';
  }
  $('#tDays').innerHTML = ds;
  const rows = D.CORE_TASKS.concat([D.BONUS_TASK]).map(tk => {
    const d = taskDone(vk, tk.k);
    let subTxt = tk.s;
    if (tk.k === 'p3') subTxt = Math.min(jambOn(vk), 999) + ' / ' + JAMB_GOAL + ' min of JAMB reading';
    if (tk.k === 'ex' && !d) subTxt = '20 minutes · bonus, not required';
    return '<div class="task' + (d ? ' done' : '') + (tk.k === 'ex' ? ' bonus' : '') + '" data-key="' + tk.k + '"><div class="chk">' + CHECK + '</div><div class="tt"><b>' + esc(tk.t) + '</b><span>' + esc(subTxt) + '</span></div></div>';
  });
  $('#tTasks').innerHTML = rows.join('');

  const mins = minutesOn(vk), goal = settings.goal, rp = Math.min(100, Math.round(mins / goal * 100));
  let nextTxt = '';
  if (isToday) {
    const nm = now.getHours() * 60 + now.getMinutes(), dn = store.get('if_done', {})[t] || {};
    const nb = ['A', 'B'].filter(b => !dn[b] && blockRange(b)[1] > nm)[0];
    nextTxt = nb ? 'Next block: ' + blockInfo(dowMon(), nb).label + ' at ' + t12(blockRange(nb)[0]) : 'Both reading blocks are finished or past.';
  }
  $('#tReading').innerHTML = '<div class="goal-row"><div class="goal-num">' + mins + '<small>/' + goal + ' min</small></div><div class="goal-pct">' + rp + '%</div></div>' +
    '<div class="bar"><i style="width:' + rp + '%"></i></div>' +
    '<div class="note" style="margin-top:10px">' + pagesOn(vk) + ' pages · ' + sessions.filter(s => s.d === vk).length + ' sessions' + (nextTxt ? ' · ' + esc(nextTxt) : '') + '</div>';

  const w0 = weekStart(t); let wk = '', wmin = 0;
  for (let i = 0; i < 7; i++) {
    const k = addDays(w0, i), s = scoreOf(k), fut = k > t; wmin += minutesOn(k);
    let cls = 'day', inner = '', st = '';
    if (!fut && s >= settings.thresh) { cls += ' done'; inner = CHECK; }
    else if (!fut && s > 0) { cls += ' some'; st = ' style="--p:' + Math.round(s / 5 * 100) + '"'; }
    wk += '<div class="dcol' + (k === t ? ' now' : '') + '"><div class="' + cls + '"' + st + '>' + inner + '</div><span>' + DAYS[i] + '</span></div>';
  }
  $('#tWeek').innerHTML = wk;
  $('#tWeek').title = hm(wmin) + ' read this week';

  const todayQ = quizlog.filter(x => x.d === t).sort((a, b) => b.score - a.score)[0];
  $('#tQuick').querySelector('[data-act="quiz"] span').textContent = todayQ ? 'Best today ' + todayQ.score + '/' + todayQ.n : settings.quizN + ' questions';
}
$('#tDays').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { viewDate = b.dataset.k; renderToday(); } });
$('#tTasks').addEventListener('click', e => {
  const el = e.target.closest('[data-key]'); if (!el) return;
  const t = todayKey(), vk = viewDate > t ? t : viewDate, key = el.dataset.key, r = routine[vk] = routine[vk] || {};
  if (key === 'p3' && !r.p3 && jambOn(vk) >= JAMB_GOAL) { toast('Done automatically from your reading time'); return; }
  r[key] = !r[key]; if (!r[key]) delete r[key];
  if (!Object.keys(r).length) delete routine[vk];
  saveRoutine(); renderAll();
});
$('#tQuick').addEventListener('click', e => {
  const b = e.target.closest('.qa'); if (!b) return;
  if (b.dataset.go) go(b.dataset.go); else if (b.dataset.act === 'quiz') openQuiz();
});

/* =====================================================================
   STREAKS
   ===================================================================== */
let calM = { y: new Date().getFullYear(), m: new Date().getMonth() };
function renderStreaks() {
  $('#sTop').innerHTML =
    '<div class="sbox flame"><div class="lbl">Routine streak</div><div class="big">' + streakOf(routineOK) + '</div><div class="sub">days at ' + settings.thresh + '+ core tasks</div></div>' +
    '<div class="sbox"><div class="lbl">Best routine</div><div class="big">' + bestOf(routineOK) + '</div><div class="sub">longest run</div></div>' +
    '<div class="sbox flame"><div class="lbl">Reading streak</div><div class="big">' + streakOf(readingOK) + '</div><div class="sub">days with reading</div></div>' +
    '<div class="sbox"><div class="lbl">Best reading</div><div class="big">' + bestOf(readingOK) + '</div><div class="sub">longest run</div></div>';

  const t = todayKey(), y = calM.y, m = calM.m, first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
  $('#calTitle').textContent = MONTHS[m] + ' ' + y;
  let c = DAYS.map(d => '<div class="dh">' + d[0] + '</div>').join('');
  for (let i = 0; i < lead; i++) c += '<div class="cd blank"></div>';
  for (let d = 1; d <= days; d++) {
    const k = y + '-' + pad(m + 1) + '-' + pad(d), fut = k > t;
    c += '<div class="cd' + (fut ? ' fut' : ' l' + levelOf(k)) + (k === t ? ' today' : '') + '" data-k="' + k + '">' + d + '</div>';
  }
  $('#cal').innerHTML = c;
  const cur = new Date(); $('#calNext').disabled = (y === cur.getFullYear() && m === cur.getMonth());

  const arr = []; for (let i = 13; i >= 0; i--) arr.push(addDays(t, -i));
  const maxM = Math.max(settings.goal, ...arr.map(minutesOn));
  $('#chart14').innerHTML = arr.map((k, i) => {
    const rp = scoreOf(k) * 20, mp = Math.round(minutesOn(k) / maxM * 100);
    return '<div class="col"><div class="bars"><i class="b1" style="height:' + Math.max(3, rp) + '%;animation-delay:' + i * 30 + 'ms"></i><i class="b2" style="height:' + Math.max(3, mp) + '%;animation-delay:' + i * 30 + 'ms"></i></div><small>' + parseKey(k).getDate() + '</small></div>';
  }).join('');

  const last30 = []; for (let i = 29; i >= 0; i--) last30.push(addDays(t, -i));
  const active = last30.filter(k => scoreOf(k) > 0 || minutesOn(k) > 0).length, perfect = last30.filter(k => scoreOf(k) === 5).length;
  const avg = Math.round(last30.reduce((n, k) => n + scoreOf(k), 0) / (30 * 5) * 100), rm = last30.reduce((n, k) => n + minutesOn(k), 0);
  const okd = last30.filter(routineOK).length;
  $('#consist').innerHTML = stat(Math.round(okd / 30 * 100) + '%', 'Consistency') + stat(active + '/30', 'Active days') + stat(perfect, 'Perfect days') +
    stat(avg + '%', 'Avg routine') + stat(hm(rm), 'Read (30 d)') + stat(hm(Math.round(rm / 30)), 'Avg per day');

  const w0 = weekStart(t); let wh = '';
  for (let w = 0; w < 8; w++) {
    const ws = addDays(w0, -7 * w); let sc = 0, n = 0, mn = 0;
    for (let i = 0; i < 7; i++) { const k = addDays(ws, i); if (k > t) break; sc += scoreOf(k); n++; mn += minutesOn(k); }
    const p = n ? Math.round(sc / (n * 5) * 100) : 0, d = parseKey(ws);
    wh += '<div class="wrow"><span>' + (w === 0 ? 'This week' : d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3)) + '</span><div class="bar"><i style="width:' + p + '%"></i></div><b>' + p + '% · ' + hm(mn) + '</b></div>';
  }
  $('#weeks').innerHTML = wh;
  renderNnn();
}
$('#calPrev').addEventListener('click', () => { calM.m--; if (calM.m < 0) { calM.m = 11; calM.y--; } renderStreaks(); });
$('#calNext').addEventListener('click', () => { const cur = new Date(); if (calM.y === cur.getFullYear() && calM.m === cur.getMonth()) return; calM.m++; if (calM.m > 11) { calM.m = 0; calM.y++; } renderStreaks(); });
$('#cal').addEventListener('click', e => {
  const c = e.target.closest('[data-k]'); if (!c || c.classList.contains('fut')) return;
  viewDate = c.dataset.k; showTab('today');
});

/* ---------- No Nut November (private, separate from every other streak) ---------- */
let nnnHide = store.get('if_nnn_hide', false);
function renderNnn() {
  const y = new Date().getFullYear(), nk = d => y + '-11-' + pad(d), t = todayKey();
  const n1 = nk(1), n30 = nk(30), inMonth = t >= n1 && t <= n30;
  const chk = nnn.checks, done = Array.from({ length: 30 }, (_, i) => i + 1).filter(d => chk[nk(d)]).length;
  let best = 0, run = 0;
  for (let d = 1; d <= 30; d++) { if (chk[nk(d)]) { run++; if (run > best) best = run; } else run = 0; }
  let ref = t > n30 ? n30 : t, cur = 0;
  if (ref >= n1) { if (!chk[ref]) ref = addDays(ref, -1); while (ref >= n1 && chk[ref]) { cur++; ref = addDays(ref, -1); } }
  const left = t < n1 ? 30 : t >= n30 ? 0 : 30 - parseKey(t).getDate();
  const pct = Math.round(done / 30 * 100), tdone = !!chk[t];
  let missed = 0; for (let d = 1; d <= 30; d++) { const k = nk(d); if (k < t && !chk[k]) missed++; }
  let msg;
  if (t < n1) msg = 'The challenge opens on 1 November.';
  else if (t > n30) msg = 'The challenge month is over. You completed ' + done + ' of 30 days.';
  else if (tdone) msg = 'Checked in for today. Well done.';
  else if (cur === 0 && missed > 0) msg = 'Fresh start today. Every day counts on its own.';
  else msg = 'Check in when your day is done.';
  $('#nnnEye').innerHTML = nnnHide
    ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const lead = (parseKey(n1).getDay() + 6) % 7;
  let cal = DAYS.map(d => '<div class="dh cd blank" style="background:none;aspect-ratio:auto;font-size:10px;color:var(--dim)">' + d[0] + '</div>').join('');
  for (let i = 0; i < lead; i++) cal += '<div></div>';
  for (let d = 1; d <= 30; d++) {
    const k = nk(d); let cls = 'nd';
    if (k > t) cls += ' fut'; else if (chk[k]) cls += ' done'; else if (k < t) cls += ' missed'; else cls += ' pending';
    if (k === t) cls += ' today';
    cal += '<div class="' + cls + '" data-k="' + k + '">' + (chk[k] ? '&#10003;' : d) + '</div>';
  }
  const btn = t < n1 ? '<button class="btn wide" disabled>Starts 1 November</button>'
    : t > n30 ? '' : '<button class="btn ' + (tdone ? '' : 'primary ') + 'wide" id="nnnCheck">' + (tdone ? 'Checked in today (tap to undo)' : 'Check in for today') + '</button>';
  $('#nnnBody').innerHTML = '<div class="' + (nnnHide ? 'blur' : '') + '">' +
    '<div class="mini-stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">' + stat(cur, 'Streak') + stat(best, 'Best') + stat(done, 'Done') + stat(left, 'Days left') + '</div>' +
    '<div class="goal-row"><div class="note">Progress</div><div class="goal-pct">' + done + '/30 · ' + pct + '%</div></div><div class="bar green"><i style="width:' + pct + '%"></i></div>' +
    '<div class="ncal">' + cal + '</div>' +
    '<div class="hint">' + esc(msg) + '</div><div style="margin-top:12px">' + btn + '</div>' +
    '<button class="ghost" id="nnnReset" style="margin-top:6px">Reset challenge data</button></div>';
  $('#nnnSub').textContent = nnnHide ? 'Details hidden. Tap the eye to show.' : 'A private challenge, separate from your other streaks.';
}
function nnnToggle(k) {
  const t = todayKey(), y = new Date().getFullYear();
  if (k > t || k < y + '-11-01' || k > y + '-11-30') return; // never award future days
  if (nnn.checks[k]) delete nnn.checks[k]; else nnn.checks[k] = true; // a set: no duplicate check-ins
  saveNnn(); renderNnn();
}
$('#nnnBody').addEventListener('click', async e => {
  if (nnnHide) return;
  const d = e.target.closest('.nd'), c = e.target.closest('#nnnCheck'), r = e.target.closest('#nnnReset');
  if (d) nnnToggle(d.dataset.k);
  else if (c) nnnToggle(todayKey());
  else if (r && await confirmBox('Reset challenge data?', 'This clears every November check-in on this phone. It cannot be undone.', 'Reset')) { nnn = { checks: {} }; saveNnn(); renderNnn(); toast('Challenge data cleared'); }
});
$('#nnnEye').addEventListener('click', () => { nnnHide = !nnnHide; store.set('if_nnn_hide', nnnHide); renderNnn(); });

/* =====================================================================
   EXERCISE + COD
   ===================================================================== */
let cod = Object.assign({ log: {}, lessons: [], setup: D.SETUP_DEF }, store.get('if_cod', {}));
function saveCod() { store.set('if_cod', cod); }
function addCod(min) { const k = todayKey(); cod.log[k] = Math.max(0, (cod.log[k] || 0) + min); saveCod(); renderEx(); }

function renderEx() {
  const t = todayKey(), done = taskDone(t, 'ex');
  $('#exState').textContent = done ? 'Done today' : 'Bonus';
  $('#exState').classList.toggle('ok', done);
  $('#exBlocks').innerHTML = D.EXERCISE.map(b => '<div class="exb"><div class="m">' + b.m + ' MIN</div><div><b>' + esc(b.t) + '</b><span>' + esc(b.d) + '</span></div></div>').join('');
  $('#exMark').textContent = done ? 'Undo done' : 'Mark done';
  const w0 = weekStart(t); let wk = '';
  for (let i = 0; i < 7; i++) { const k = addDays(w0, i), d = taskDone(k, 'ex'); wk += '<div class="dcol' + (k === t ? ' now' : '') + '"><div class="day' + (d ? ' done' : '') + '">' + (d ? CHECK : '') + '</div><span>' + DAYS[i] + '</span></div>'; }
  $('#exWeek').innerHTML = wk;

  const dow = dowMon(), cl = D.CLASS_DAY[dow], cd = (store.get('if_coddone', {})[t]) || {};
  const played = cod.log[t] || 0, cap = settings.cap, pct = Math.min(100, Math.round(played / cap * 100));
  $('#capTxt').innerHTML = played + '<small>/' + cap + ' min</small>';
  $('#capPct').textContent = Math.round(played / cap * 100) + '%';
  $('#capBar').style.width = pct + '%';
  $('#capBar').parentNode.classList.toggle('over', played >= cap);
  $('#capMsg').textContent = played >= cap ? 'Cap reached. Close the game and go to your reading block.' : (cap - played) + ' min left today. Training blocks add to this automatically.';
  $('#trainDay').textContent = DAYS_LONG[dow] + ' class: ' + cl.n + '. About 65 min if you do every block.';
  $('#trainBlocks').innerHTML = D.COD_BLOCKS.map(b => {
    const d = !!cd[b.k], desc = b.k === 'cls' ? cl.n + ': ' + cl.d : b.d;
    return '<div class="blk' + (d ? ' done' : '') + '"><button class="chk" data-chk="' + b.k + '" aria-label="Mark done">' + CHECK + '</button>' +
      '<div class="blk-t"><div class="blk-time">' + b.min + ' MIN</div><div class="blk-sub">' + esc(b.t) + '</div><div class="blk-s">' + esc(desc) + '</div></div>' +
      '<button class="btn primary sm" data-start="' + b.k + '">Start</button></div>';
  }).join('');
  $('#lessonList').innerHTML = cod.lessons.slice(0, 5).map(l => '<li><span>' + esc(l.d) + '</span>' + esc(l.t) + '</li>').join('') || '<li><span>EMPTY</span>Your lessons will show here.</li>';
}
$('#exStart').addEventListener('click', () => startTask({ kind: 'ex', key: 'ex', label: '20 minute workout' }, 20));
$('#exMark').addEventListener('click', () => {
  const t = todayKey(), r = routine[t] = routine[t] || {};
  if (r.ex) delete r.ex; else r.ex = true;
  if (!Object.keys(r).length) delete routine[t];
  saveRoutine(); renderAll();
});
$('#capBtns').addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (b) addCod(Number(b.dataset.add)); });
$('#trainBlocks').addEventListener('click', e => {
  const c = e.target.closest('[data-chk]'), s = e.target.closest('[data-start]');
  if (c) {
    const o = store.get('if_coddone', {}), d = todayKey(); o[d] = o[d] || {};
    o[d][c.dataset.chk] = !o[d][c.dataset.chk]; store.set('if_coddone', o); renderEx();
  } else if (s) {
    const b = D.COD_BLOCKS.find(x => x.k === s.dataset.start); if (!b) return;
    startTask({ kind: 'cod', key: b.k, label: 'COD: ' + b.t }, b.min);
  }
});
function saveLesson() {
  const inp = $('#lessonIn'), t = inp.value.trim(); if (!t) return;
  cod.lessons.unshift({ d: todayKey(), t }); cod.lessons = cod.lessons.slice(0, 30);
  saveCod(); inp.value = ''; renderEx();
}
$('#lessonSave').addEventListener('click', saveLesson);
$('#lessonIn').addEventListener('keydown', e => { if (e.key === 'Enter') saveLesson(); });
$('#setupTxt').value = cod.setup;
$('#setupTxt').addEventListener('input', e => { cod.setup = e.target.value; saveCod(); });

/* =====================================================================
   SOUNDS: ambient (generated offline), radio, Spotify
   ===================================================================== */
function makeWav(kind) {
  const sr = 22050, n = sr * 8, F = sr / 2, d = new Int16Array(n);
  let lp = 0, hp = 0, px = 0, br = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1; let v;
    if (kind === 'brown') { br = (br + 0.02 * w) / 1.02; v = br * 3.5; }
    else {
      const al = kind === 'heavy' ? 0.12 : 0.35, ha = kind === 'heavy' ? 0.995 : 0.97, g = kind === 'heavy' ? 2.2 : 1.4;
      lp += al * (w - lp); hp = ha * (hp + lp - px); px = lp; v = hp * g;
    }
    d[i] = Math.round(Math.max(-1, Math.min(1, v)) * 0.8 * 32767);
  }
  for (let k = 0; k < F; k++) { const t = k / F; d[k] = Math.round(d[k] * t + d[n - F + k] * (1 - t)); }
  const s = d.slice(0, n - F);
  const buf = new ArrayBuffer(44 + s.length * 2), v = new DataView(buf);
  const ws = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + s.length * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, s.length * 2, true);
  new Int16Array(buf, 44).set(s);
  return new Blob([buf], { type: 'audio/wav' });
}
const amb = new Audio(); amb.loop = true;
const ambUrls = {};
let ambKind = null, ambVol = store.get('if_ambvol', 0.6);
function paintAmb() { $$('#amb .chip').forEach(b => b.classList.toggle('on', b.dataset.k === ambKind)); }
$('#amb').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  const k = b.dataset.k;
  if (ambKind === k) { amb.pause(); ambKind = null; }
  else {
    if (!ambUrls[k]) ambUrls[k] = URL.createObjectURL(makeWav(k));
    amb.src = ambUrls[k]; amb.volume = ambVol; amb.play().catch(() => {}); ambKind = k;
  }
  paintAmb();
});
$('#ambVol').value = ambVol; amb.volume = ambVol;
$('#ambVol').addEventListener('input', e => { ambVol = Number(e.target.value); amb.volume = ambVol; store.set('if_ambvol', ambVol); });

const radio = new Audio(); radio.preload = 'none';
let radioOn = false, radioVol = store.get('if_radiovol', 0.7);
const sel = $('#radioSel'), urlIn = $('#radioUrl'), rBtn = $('#radioBtn'), rStat = $('#radioStatus');
sel.value = store.get('if_station', sel.value);
if (!sel.value) sel.selectedIndex = 0;
urlIn.value = store.get('if_customurl', '');
function paintRadio() { rBtn.textContent = radioOn ? 'Stop' : 'Play'; urlIn.hidden = sel.value !== 'custom'; }
function status(t) { rStat.textContent = t; }
sel.addEventListener('change', () => {
  store.set('if_station', sel.value);
  if (radioOn) { radio.pause(); radio.removeAttribute('src'); radio.load(); radioOn = false; status('Stopped'); }
  paintRadio();
});
urlIn.addEventListener('change', () => store.set('if_customurl', urlIn.value.trim()));
rBtn.addEventListener('click', () => {
  if (radioOn) { radio.pause(); radio.removeAttribute('src'); radio.load(); radioOn = false; status('Stopped'); paintRadio(); return; }
  const url = sel.value === 'custom' ? urlIn.value.trim() : sel.value;
  if (!/^https?:\/\//i.test(url)) { status('Paste a valid stream link (https://...)'); return; }
  store.set('if_customurl', urlIn.value.trim());
  radio.src = url; radio.volume = radioVol; status('Connecting...');
  radio.play().then(() => { radioOn = true; status('Playing'); paintRadio(); }).catch(() => { radioOn = false; status('Could not play this stream'); paintRadio(); });
});
radio.addEventListener('error', () => { if (!radio.getAttribute('src')) return; radioOn = false; status('Stream failed. Try another station.'); paintRadio(); });
$('#radioVol').value = radioVol; radio.volume = radioVol;
$('#radioVol').addEventListener('input', e => { radioVol = Number(e.target.value); radio.volume = radioVol; store.set('if_radiovol', radioVol); });
paintRadio();

const spIn = $('#spUrl'), spFrame = $('#spFrame'), spOpen = $('#spOpen'), spMsg = $('#spMsg');
function spParse(u) {
  u = String(u || '').trim();
  const m = u.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/i) || u.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)/i);
  return m ? { type: m[1].toLowerCase(), id: m[2] } : null;
}
let spLoaded = false;
function spLoad(u) {
  const p = spParse(u);
  if (!p) { spMsg.textContent = 'Paste a Spotify track, album or playlist link.'; return; }
  spMsg.textContent = '';
  spFrame.height = (p.type === 'track' || p.type === 'episode') ? 152 : 352;
  spFrame.src = 'https://open.spotify.com/embed/' + p.type + '/' + p.id + '?utm_source=generator&theme=0';
  spOpen.href = 'https://open.spotify.com/' + p.type + '/' + p.id;
  store.set('if_spotify', u); spLoaded = true;
}
spIn.value = store.get('if_spotify', 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn');
$('#spLoad').addEventListener('click', () => spLoad(spIn.value));
spIn.addEventListener('keydown', e => { if (e.key === 'Enter') spLoad(spIn.value); });
function openSounds() { openDlg($('#dlgSounds')); if (!spLoaded) spLoad(spIn.value); } // load the embed only when opened (saves data)
$('#sndBtn').addEventListener('click', openSounds);
$('#fvSounds').onclick = openSounds;
$('#sndClose').addEventListener('click', () => closeDlg($('#dlgSounds')));

/* =====================================================================
   BACKGROUND: palettes, your own image, your own video
   ===================================================================== */
const idb = {
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('ikoge-focus', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async put(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  async del(k) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
};
const bgC = $('#aurora'), bgV = $('#bgVideo'), bgI = $('#bgImg'), g2 = bgC.getContext('2d');
const PAL = {
  violet: [[155, 140, 255], [109, 91, 255], [70, 160, 255]],
  midnight: [[60, 76, 150], [34, 44, 100], [96, 64, 170]],
  ocean: [[40, 170, 210], [60, 110, 220], [40, 200, 180]],
  ember: [[255, 140, 90], [220, 70, 110], [140, 60, 200]],
  chrome: [[206, 211, 226], [140, 148, 172], [92, 98, 124]]
};
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let bgMode = store.get('if_bg', 'violet');
if (bgMode === 'aurora') bgMode = 'violet';
let raf = 0, lastDraw = 0, vUrl = null, iUrl = null, hasVideo = false, hasImage = false;

function drawAurora(t) {
  const W = bgC.width, H = bgC.height;
  g2.globalCompositeOperation = 'source-over'; g2.fillStyle = '#07080b'; g2.fillRect(0, 0, W, H);
  g2.globalCompositeOperation = 'lighter';
  const pal = PAL[bgMode] || PAL.violet, s = (t || 0) / 1000;
  for (let i = 0; i < 4; i++) {
    const c = pal[i % pal.length].join(',');
    const x = W / 2 + Math.sin(s * 0.22 + i * 2.1) * W * 0.45, y = H / 2 + Math.cos(s * 0.17 + i * 1.7) * H * 0.4;
    const r = H * 0.28 + Math.sin(s * 0.3 + i) * H * 0.04;
    const gr = g2.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + c + ',.5)'); gr.addColorStop(1, 'rgba(' + c + ',0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, W, H);
  }
}
function loop(t) { raf = requestAnimationFrame(loop); if (t - lastDraw < 55) return; lastDraw = t; drawAurora(t); }
function applyBg() {
  cancelAnimationFrame(raf); raf = 0;
  const useV = bgMode === 'video' && hasVideo, useI = bgMode === 'image' && hasImage, plain = bgMode === 'off';
  const pal = !useV && !useI && !plain;
  bgC.hidden = !pal; bgV.hidden = !useV; bgI.hidden = !useI;
  if (useV) { bgV.muted = true; bgV.play().catch(() => {}); } else { try { bgV.pause(); } catch (e) {} }
  if (pal) { if (!PAL[bgMode]) bgMode = 'violet'; drawAurora(performance.now()); if (!reduceMotion && !document.hidden) raf = requestAnimationFrame(loop); }
  $$('#bgChips .chip').forEach(b => b.classList.toggle('on', b.dataset.bg === bgMode));
}
function bgVisibility() { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; try { bgV.pause(); } catch (e) {} } else applyBg(); }
function setBg(m) { bgMode = m; store.set('if_bg', m); applyBg(); }
async function loadMedia() {
  try {
    const v = await idb.get('bgvideo');
    if (v) { if (vUrl) URL.revokeObjectURL(vUrl); vUrl = URL.createObjectURL(v); bgV.src = vUrl; hasVideo = true; }
    else { hasVideo = false; bgV.removeAttribute('src'); bgV.load(); }
    const im = await idb.get('bgimage');
    if (im) { if (iUrl) URL.revokeObjectURL(iUrl); iUrl = URL.createObjectURL(im); bgI.src = iUrl; hasImage = true; }
    else { hasImage = false; bgI.removeAttribute('src'); }
  } catch (e) { hasVideo = false; hasImage = false; }
  applyBg();
}
$('#bgChips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  if (b.dataset.bg === 'video' && !hasVideo) { $('#bgMsg').textContent = 'Choose a video first.'; return; }
  if (b.dataset.bg === 'image' && !hasImage) { $('#bgMsg').textContent = 'Choose an image first.'; return; }
  setBg(b.dataset.bg);
});
$('#bgPick').addEventListener('click', () => $('#bgFile').click());
$('#bgPickImg').addEventListener('click', () => $('#bgFileImg').click());
$('#bgFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; const msg = $('#bgMsg'); if (!f) return;
  if (!/^video\//.test(f.type)) { msg.textContent = 'That is not a video file.'; return; }
  if (f.size > 60 * 1024 * 1024) { msg.textContent = 'That clip is over 60 MB. Pick a shorter one.'; return; }
  try { await idb.put('bgvideo', f); await loadMedia(); setBg('video'); msg.textContent = 'Video set. It plays silently on a loop.'; }
  catch (err) { msg.textContent = 'Could not save the video (storage may be full).'; }
});
$('#bgFileImg').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; const msg = $('#bgMsg'); if (!f) return;
  if (!/^image\//.test(f.type)) { msg.textContent = 'That is not an image file.'; return; }
  if (f.size > 25 * 1024 * 1024) { msg.textContent = 'That image is over 25 MB. Pick a smaller one.'; return; }
  try { await idb.put('bgimage', f); await loadMedia(); setBg('image'); msg.textContent = 'Image set as your background.'; }
  catch (err) { msg.textContent = 'Could not save the image (storage may be full).'; }
});
$('#bgClear').addEventListener('click', async () => {
  try {
    if (bgMode === 'image') await idb.del('bgimage'); else if (bgMode === 'video') await idb.del('bgvideo');
    else { await idb.del('bgimage'); await idb.del('bgvideo'); }
  } catch (e) {}
  if (bgMode === 'image' || bgMode === 'video') { bgMode = 'violet'; store.set('if_bg', 'violet'); }
  await loadMedia(); $('#bgMsg').textContent = 'Removed.';
});

/* =====================================================================
   SETTINGS + data backup
   ===================================================================== */
const dlg = $('#dlgSettings');
function openSettings() {
  $('#sName').value = settings.name; $('#sQuiz').checked = settings.quiz !== false; $('#sQuizN').value = settings.quizN; $('#sThresh').value = settings.thresh;
  $('#sFocus').value = settings.focus; $('#sShort').value = settings.short; $('#sLong').value = settings.long;
  $('#sEvery').value = settings.every; $('#sGoal').value = settings.goal;
  $('#sAuto').checked = !!settings.auto; $('#sAwake').checked = !!settings.awake;
  settings.subjects.forEach((s, i) => { $('#sSub' + i).value = s; });
  $('#sAStart').value = settings.aStart; $('#sALen').value = settings.aLen;
  $('#sBStart').value = settings.bStart; $('#sBLen').value = settings.bLen;
  $('#sCap').value = settings.cap; $('#dMsg').textContent = '';
  applyBg(); openDlg(dlg);
}
$('#setBtn').addEventListener('click', openSettings);
$('#sCancel').addEventListener('click', () => closeDlg(dlg));
$('#sSave').addEventListener('click', () => {
  const subs = [0, 1, 2, 3].map(i => $('#sSub' + i).value.trim() || DEF.subjects[i]);
  const tm = (v, d) => (/^\d{1,2}:\d{2}$/.test(v) ? v : d);
  settings = {
    name: $('#sName').value.trim() || DEF.name, quiz: $('#sQuiz').checked, quizN: clamp($('#sQuizN').value, 3, 10, DEF.quizN), thresh: clamp($('#sThresh').value, 1, 5, DEF.thresh),
    focus: clamp($('#sFocus').value, 1, 180, DEF.focus), short: clamp($('#sShort').value, 1, 60, DEF.short),
    long: clamp($('#sLong').value, 1, 90, DEF.long), every: clamp($('#sEvery').value, 2, 8, DEF.every),
    goal: clamp($('#sGoal').value, 10, 600, DEF.goal), auto: $('#sAuto').checked, awake: $('#sAwake').checked,
    subjects: subs,
    aStart: tm($('#sAStart').value, DEF.aStart), aLen: clamp($('#sALen').value, 30, 240, DEF.aLen),
    bStart: tm($('#sBStart').value, DEF.bStart), bLen: clamp($('#sBLen').value, 30, 240, DEF.bLen),
    cap: clamp($('#sCap').value, 15, 300, DEF.cap)
  };
  saveSettings();
  if (!running && !task) { totalSec = settings[mode] * 60; remaining = totalSec; }
  closeDlg(dlg); render(); renderAll();
});

$('#dExport').addEventListener('click', () => {
  try {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('if_')) data[k] = store.get(k, null); }
    const blob = new Blob([JSON.stringify({ app: 'ultron', v: 1, saved: new Date().toISOString(), data }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ultron-backup-' + todayKey() + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    $('#dMsg').textContent = 'Backup saved to your downloads. Backgrounds are not included.';
  } catch (e) { $('#dMsg').textContent = 'Could not create the backup.'; }
});
$('#dImport').addEventListener('click', () => $('#dFile').click());
$('#dFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  let obj; try { obj = JSON.parse(await f.text()); } catch (err) { $('#dMsg').textContent = 'That file is not a valid backup.'; return; }
  if (!obj || obj.app !== 'ultron' || !obj.data || typeof obj.data !== 'object') { $('#dMsg').textContent = 'That file is not an Ultron backup.'; return; }
  if (!(await confirmBox('Restore this backup?', 'This replaces the data on this phone with the backup.', 'Restore'))) return;
  Object.keys(obj.data).forEach(k => { if (k.startsWith('if_')) store.set(k, obj.data[k]); });
  location.reload();
});
$('#dReset').addEventListener('click', async () => {
  if (!(await confirmBox('Reset all app data?', 'This deletes your books, sessions, routine, streaks, challenge data and settings on this phone. Export a backup first if you want to keep it.', 'Delete everything'))) return;
  const del = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('if_')) del.push(k); }
  del.forEach(k => store.del(k));
  try { await idb.del('bgvideo'); await idb.del('bgimage'); } catch (e) {}
  location.reload();
});

/* =====================================================================
   OPENING QUIZ
   ===================================================================== */
let qs = [], qi = 0, qans = [], qlock = false, qsaved = false;
function pickQuiz(n) {
  let seen = store.get('if_qseen', []);
  const subs = ['Biology', 'Chemistry', 'Physics', 'English'];
  const pools = subs.map(s => {
    const all = D.QUIZ.map((q, i) => ({ q, i })).filter(x => x.q.s === s);
    const fresh = all.filter(x => !seen.includes(x.i));
    return shuffle(fresh.length ? fresh : all);
  });
  const out = []; let j = Math.floor(Math.random() * 4), guard = 0;
  while (out.length < n && guard++ < 80) { const p = pools[j % 4]; if (p.length) out.push(p.shift()); j++; }
  seen = seen.concat(out.map(x => x.i)).slice(-32); store.set('if_qseen', seen);
  return shuffle(out).map(x => ({
    s: x.q.s, q: x.q.q, e: x.q.e,
    o: shuffle(x.q.o.map((t, i) => ({ t, ok: i === x.q.a })))
  }));
}
function openQuiz() {
  qs = pickQuiz(settings.quizN); qi = 0; qans = []; qlock = false; qsaved = false;
  const v = $('#quiz'); v.classList.remove('out'); v.hidden = false; document.body.style.overflow = 'hidden';
  renderQ();
}
function closeQuiz() {
  const v = $('#quiz'); if (v.hidden) return;
  v.classList.add('out');
  setTimeout(() => { v.hidden = true; v.classList.remove('out'); if ($('#focusView').hidden) document.body.style.overflow = ''; renderAll(); }, 280);
}
function dots() {
  $('#qDots').innerHTML = qs.map((_, i) => '<i class="' + (i < qans.length ? (qans[i] ? 'ok' : 'no') : i === qi ? 'cur' : '') + '"></i>').join('');
}
function renderQ() {
  const it = qs[qi]; dots(); qlock = false;
  $('#qCard').innerHTML = '<div class="qsub">' + esc(it.s) + ' · ' + (qi + 1) + ' of ' + qs.length + '</div><div class="qtext">' + esc(it.q) + '</div><div class="qopts">' +
    it.o.map((o, i) => '<button class="qopt" data-i="' + i + '"><b>' + 'ABCD'[i] + '</b><span>' + esc(o.t) + '</span></button>').join('') + '</div>';
  $('#qExplain').textContent = ''; $('#qNext').hidden = true; $('#qNext').dataset.end = '';
}
$('#qCard').addEventListener('click', e => {
  const b = e.target.closest('.qopt');
  if (b && !qlock) {
    qlock = true; const it = qs[qi], pick = it.o[Number(b.dataset.i)], ok = pick.ok;
    qans[qi] = ok; dots();
    $$('#qCard .qopt').forEach((el, i) => { el.classList.add(it.o[i].ok ? 'right' : (el === b ? 'wrong' : 'dim')); });
    $('#qExplain').textContent = (ok ? 'Correct. ' : 'Not quite. ') + it.e;
    $('#qNext').textContent = qi === qs.length - 1 ? 'See my score' : 'Next'; $('#qNext').hidden = false;
    try { if (navigator.vibrate) navigator.vibrate(ok ? 12 : [30, 40, 30]); } catch (er) {}
    return;
  }
  if (e.target.closest('#qAgain')) openQuiz();
});
function saveQuiz() {
  const n = qans.length; if (!n || qsaved) return; qsaved = true;
  const by = {};
  for (let i = 0; i < n; i++) { const s = qs[i].s; by[s] = by[s] || [0, 0]; by[s][1]++; if (qans[i]) by[s][0]++; }
  quizlog.push({ d: todayKey(), ts: Date.now(), score: qans.filter(Boolean).length, n, by });
  quizlog = quizlog.slice(-200); store.set('if_quizlog', quizlog);
}
$('#qNext').addEventListener('click', () => {
  if (qi < qs.length - 1) { qi++; renderQ(); return; }
  if ($('#qNext').dataset.end === '1') { $('#qNext').dataset.end = ''; closeQuiz(); return; }
  saveQuiz(); dots();
  const sc = qans.filter(Boolean).length, n = qs.length;
  const msg = sc === n ? 'Perfect. Sharp mind, strong start.' : sc >= n * 0.6 ? 'Solid. Keep that edge all day.' : 'Good effort. The explanations are the real prize.';
  const by = {}; qs.forEach((q, i) => { by[q.s] = by[q.s] || [0, 0]; by[q.s][1]++; if (qans[i]) by[q.s][0]++; });
  $('#qCard').innerHTML = '<div class="qend"><div class="qsub">Warm-up complete</div><div class="qscore">' + sc + '/' + n + '</div><div class="qtext" style="font-size:19px">' + esc(msg) + '</div>' +
    '<div class="note">' + Object.keys(by).map(s => esc(s) + ' ' + by[s][0] + '/' + by[s][1]).join(' · ') + '</div><button class="btn wide" id="qAgain">Another round</button></div>';
  $('#qExplain').textContent = ''; $('#qNext').textContent = 'Start my day'; $('#qNext').dataset.end = '1';
});
$('#quizSkip').addEventListener('click', () => { saveQuiz(); closeQuiz(); });

/* =====================================================================
   boot
   ===================================================================== */
function fillFor() {
  const cur = $('#forSel').value; $('#forSel').innerHTML = forOptions();
  if ([...$('#forSel').options].some(o => o.value === cur)) $('#forSel').value = cur;
}
let rendering = false;
function renderAll() {
  if (rendering) return; rendering = true;
  try {
    renderToday(); renderTimetable(); fillFor(); renderBooks(); renderJamb(); renderLog(); renderStreaks(); renderEx();
  } catch (e) { console.error(e); }
  rendering = false;
}
(function init() {
  $('#dlgSettings').addEventListener('cancel', () => {});
  showTab(tab); showSub('plan');
  setWheel(settings.focus, false);
  render(); loadMedia();
  if (settings.quiz !== false) openQuiz();
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
})();
