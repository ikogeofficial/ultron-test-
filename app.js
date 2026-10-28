(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const clamp = (n, a, b, d) => { n = Math.round(Number(n)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
const todayKey = () => dkey(new Date());
const dowMon = () => (new Date().getDay() + 6) % 7; // 0 = Monday ... 6 = Sunday

/* ---------- state ---------- */
const LABELS = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };
const DEF = {
  focus: 25, short: 5, long: 15, every: 4, goal: 120, auto: false, awake: false,
  subjects: ['English', 'Subject 2', 'Subject 3', 'Subject 4'],
  aStart: '09:00', aLen: 120, bStart: '16:30', bLen: 120, cap: 90
};
let settings = Object.assign({}, DEF, store.get('if_settings', {}));
if (!Array.isArray(settings.subjects) || settings.subjects.length !== 4) settings.subjects = DEF.subjects.slice();
let mode = 'focus';
let totalSec = settings.focus * 60;
let remaining = totalSec;
let running = false, endAt = 0, timer = null, wakeLock = null;
let cycle = store.get('if_cycle', 0);
let task = null; // { kind: 'read' | 'cod', key, label }

/* ---------- tabs ---------- */
let tab = store.get('if_tab', 'focus');
function showTab(t) {
  if (!['focus', 'read', 'train'].includes(t)) t = 'focus';
  tab = t; store.set('if_tab', t);
  $$('.pane').forEach(p => { p.hidden = p.dataset.pane !== t; });
  $$('.nav-btn').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  try { window.scrollTo(0, 0); } catch (e) {}
}
$('.nav').addEventListener('click', e => { const b = e.target.closest('.nav-btn'); if (b) showTab(b.dataset.t); });

/* ---------- ring ---------- */
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

function render() {
  const frac = totalSec > 0 ? Math.max(0, Math.min(1, remaining / totalSec)) : 0;
  ring.style.strokeDasharray = CIRC;
  ring.style.strokeDashoffset = CIRC * (1 - frac);
  const vis = frac > 0.002 ? 1 : 0;
  ring.style.opacity = vis;
  knob.style.opacity = vis;
  const a = frac * 2 * Math.PI;
  knob.setAttribute('cx', (160 + R * Math.sin(a)).toFixed(2));
  knob.setAttribute('cy', (160 - R * Math.cos(a)).toFixed(2));
  $('#time').textContent = fmt(remaining);
  $('#modeLabel').textContent = LABELS[mode].toUpperCase();
  let sub;
  if (mode !== 'focus') sub = 'Rest your eyes';
  else if (task) sub = task.label;
  else sub = 'Session ' + ((cycle % settings.every) + 1) + ' of ' + settings.every;
  $('#cycleTxt').textContent = sub;
  $('#startBtn').textContent = running ? 'Pause' : (remaining < totalSec && remaining > 0 ? 'Resume' : 'Start');
  $$('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  document.body.dataset.mode = mode;
  document.title = running ? fmt(remaining) + ' · ' + LABELS[mode] : 'Ikoge Focus';
}

/* ---------- sound effects ---------- */
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
      navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: 'icon.svg', tag: 'ikoge-focus', vibrate: [200, 100, 200] }));
    } else { new Notification(title, { body }); }
  } catch (e) {}
}

/* ---------- timer ---------- */
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

function startTask(t, minutes) {
  stop(); task = t; mode = 'focus';
  totalSec = Math.max(1, minutes) * 60; remaining = totalSec;
  showTab('focus'); start();
}

function markDone(storeKey, key) {
  const o = store.get(storeKey, {}), d = todayKey();
  o[d] = o[d] || {}; o[d][key] = true;
  store.set(storeKey, o);
}

function finish() {
  stop();
  chime();
  try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) {}
  if (mode === 'focus') {
    const mins = Math.max(1, Math.round(totalSec / 60));
    if (task && task.kind === 'cod') {
      addCod(mins); markDone('if_coddone', task.key);
      mode = 'short';
      notify('Training block done', task.label + ' complete.');
    } else {
      record(mins);
      if (task && task.kind === 'read') markDone('if_done', task.key);
      cycle++; store.set('if_cycle', cycle);
      mode = (cycle % settings.every === 0) ? 'long' : 'short';
      notify('Focus session done', 'Take a break. You earned it.');
    }
    task = null;
  } else {
    mode = 'focus';
    notify('Break over', 'Back to focus.');
  }
  totalSec = settings[mode] * 60; remaining = totalSec;
  renderStreak(); renderRead(); renderTrain(); render();
  if (settings.auto) start();
}

$('#startBtn').addEventListener('click', () => (running ? pause() : start()));
$('#resetBtn').addEventListener('click', reset);
$('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setMode(b.dataset.m); });
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b || !b.dataset.min) return;
  stop(); task = null; totalSec = Number(b.dataset.min) * 60; remaining = totalSec; render();
});
$('#fsBtn').addEventListener('click', () => {
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {}
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (running) { tick(); lock(); } renderStreak(); renderRead(); renderTrain(); }
  bgVisibility();
});

/* ---------- streak ---------- */
function record(min) {
  const log = store.get('if_log', {}), k = todayKey(), o = log[k] || { min: 0, sessions: 0 };
  log[k] = { min: o.min + min, sessions: o.sessions + 1 };
  store.set('if_log', log);
}
function calcStreak(log) {
  let n = 0; const d = new Date();
  const done = x => log[dkey(x)] && log[dkey(x)].sessions > 0;
  if (!done(d)) d.setDate(d.getDate() - 1);
  while (done(d)) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const CHECK = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function renderStreak() {
  const log = store.get('if_log', {}), now = new Date();
  const todayMin = (log[dkey(now)] && log[dkey(now)].min) || 0;
  const pct = Math.min(100, Math.round(todayMin / settings.goal * 100));
  $('#streakNum').textContent = calcStreak(log);
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ti = dowMon();
  let h = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(now.getDate() - (ti - i));
    const done = log[dkey(d)] && log[dkey(d)].sessions > 0;
    let cls = 'day', inner = '', style = '';
    if (done) { cls += ' done'; inner = CHECK; }
    else if (i === ti) { cls += ' partial'; style = ' style="--p:' + pct + '"'; }
    h += '<div class="dcol"><div class="' + cls + '"' + style + '>' + inner + '</div><span>' + names[i] + '</span></div>';
  }
  $('#week').innerHTML = h;
  $('#goalTxt').innerHTML = todayMin + '<small>/' + settings.goal + ' min</small>';
  $('#goalPct').textContent = pct + '%';
  $('#goalBar').style.width = pct + '%';
}

/* ---------- READ tab: timetable (no Maths) ---------- */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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
function subjectFor(dow, blk) {
  if (dow === 6) return blk === 'A' ? 'Weak topics review' : 'Past questions (Test Driller)';
  const i = blk === 'A' ? dow % 4 : (dow + 2) % 4;
  return settings.subjects[i];
}
function renderRead() {
  const dow = dowMon(), done = (store.get('if_done', {})[todayKey()]) || {};
  const cyc = settings.focus + settings.short;
  $('#todayName').textContent = DAYS_LONG[dow] + '. Each block is a pomodoro run (' + settings.focus + ' min on, ' + settings.short + ' off).';
  $('#readToday').innerHTML = ['A', 'B'].map(blk => {
    const [s, e] = blockRange(blk), len = e - s, n = Math.max(1, Math.floor(len / cyc));
    const sub = subjectFor(dow, blk), d = !!done[blk];
    return '<div class="blk' + (d ? ' done' : '') + '">' +
      '<button class="chk" data-chk="' + blk + '" aria-label="Mark done">' + CHECK + '</button>' +
      '<div class="blk-t"><div class="blk-time">' + t12(s) + ' - ' + t12(e) + '</div>' +
      '<div class="blk-sub">' + esc(sub) + '</div>' +
      '<div class="blk-s">' + (blk === 'A' ? 'Morning' : 'Evening') + ' block, about ' + n + ' pomodoros</div></div>' +
      '<button class="btn primary sm" data-start="' + blk + '">Start</button></div>';
  }).join('');
  const [as, ae] = blockRange('A'), [bs, be] = blockRange('B');
  $('#wkTimes').textContent = 'Morning ' + t12(as) + ' - ' + t12(ae) + '  |  Evening ' + t12(bs) + ' - ' + t12(be);
  let g = '<div class="wh"></div><div class="wh">Morning</div><div class="wh">Evening</div>';
  for (let i = 0; i < 7; i++) {
    const t = i === dow ? ' today' : '';
    g += '<div class="wd' + t + '">' + DAYS[i] + '</div><div class="' + t.trim() + '">' + esc(subjectFor(i, 'A')) + '</div><div class="' + t.trim() + '">' + esc(subjectFor(i, 'B')) + '</div>';
  }
  $('#readWeek').innerHTML = g;
  const exam = new Date(2027, 3, 16), now = new Date(); now.setHours(0, 0, 0, 0);
  $('#jambDays').textContent = Math.max(0, Math.round((exam - now) / 86400000));
}
$('#readToday').addEventListener('click', e => {
  const c = e.target.closest('[data-chk]'), s = e.target.closest('[data-start]');
  if (c) {
    const o = store.get('if_done', {}), d = todayKey(); o[d] = o[d] || {};
    o[d][c.dataset.chk] = !o[d][c.dataset.chk]; store.set('if_done', o); renderRead();
  } else if (s) {
    const blk = s.dataset.start;
    startTask({ kind: 'read', key: blk, label: 'Reading: ' + subjectFor(dowMon(), blk) }, settings.focus);
  }
});
$('#editRead').addEventListener('click', openSettings);

/* ---------- TRAIN tab: COD ---------- */
const CLASS_DAY = [
  { n: 'SMG', d: 'Close-range tracking. Strafe while you ADS. Pre-aim every corner before you swing.' },
  { n: 'Sniper', d: 'Hold one angle. Practise quick-scope timing and the flick to the chest. Move after every kill.' },
  { n: 'LMG', d: 'Control bursts of 3 to 5 rounds. Hold long lanes. Reposition after 2 kills.' },
  { n: 'Shotgun', d: 'ADS is slow, so train hip-fire pushes: slide in and fire as the slide ends. Ambush from corners. Check your gun for attachments that speed up ADS.' },
  { n: 'Assault Rifle', d: 'Mid-range bursts. Learn the recoil pull-down. Track targets while strafing.' },
  { n: 'Movement mix', d: 'Five minutes on each class. Chain slide, jump and shoot without stopping.' },
  { n: 'Rest and review', d: 'No grinding. Watch one of your own deaths and write the fix below.' }
];
const COD_BLOCKS = [
  { k: 'warm', min: 10, t: 'Warm-up', d: 'Firing Range: spray control on bots at 3 distances, then tracking moving targets.' },
  { k: 'move', min: 10, t: 'Movement', d: 'Slide into jump into shoot. Jump shots and drop shots while moving. Keep your HUD as it is.' },
  { k: 'cls', min: 15, t: 'Class focus', d: '' },
  { k: 'play', min: 25, t: 'Match play', d: 'Play with ONE goal only (example: never fight in the open). Do not chase rank.' },
  { k: 'rev', min: 5, t: 'Review', d: 'Write one thing that cost you a death and one fix. Save it below.' }
];
const SETUP_DEF = '3-finger claw.\nTwo fire buttons: one ADS fire, one hip fire.\nHUD: jump on top, slide under it. Do not swap them.\nSkills: Spotter (defense), Jet (attack, triggers on slide, used to escape).\nGoal: pro level movement and all weapon classes (sniper, SMG, LMG, shotgun).\nWeak spot: ADS with shotguns is slow.';
let cod = Object.assign({ log: {}, lessons: [], setup: SETUP_DEF }, store.get('if_cod', {}));
function saveCod() { store.set('if_cod', cod); }
function addCod(min) {
  const k = todayKey(); cod.log[k] = Math.max(0, (cod.log[k] || 0) + min); saveCod(); renderTrain();
}
function renderTrain() {
  const dow = dowMon(), cl = CLASS_DAY[dow], done = (store.get('if_coddone', {})[todayKey()]) || {};
  const played = cod.log[todayKey()] || 0, cap = settings.cap, pct = Math.min(100, Math.round(played / cap * 100));
  $('#capTxt').innerHTML = played + '<small>/' + cap + ' min</small>';
  $('#capPct').textContent = Math.round(played / cap * 100) + '%';
  $('#capBar').style.width = pct + '%';
  $('#capBar').parentNode.classList.toggle('over', played >= cap);
  $('#capMsg').textContent = played >= cap
    ? 'Cap reached. Close the game and go to your reading block.'
    : (cap - played) + ' min left today. Training blocks add to this automatically.';
  $('#trainDay').textContent = DAYS_LONG[dow] + ' class: ' + cl.n + '. Total about 65 min if you do every block.';
  $('#trainBlocks').innerHTML = COD_BLOCKS.map(b => {
    const d = !!done[b.k], desc = b.k === 'cls' ? cl.n + ': ' + cl.d : b.d;
    return '<div class="blk' + (d ? ' done' : '') + '">' +
      '<button class="chk" data-chk="' + b.k + '" aria-label="Mark done">' + CHECK + '</button>' +
      '<div class="blk-t"><div class="blk-time">' + b.min + ' MIN</div><div class="blk-sub">' + esc(b.t) + '</div>' +
      '<div class="blk-s">' + esc(desc) + '</div></div>' +
      '<button class="btn primary sm" data-start="' + b.k + '">Start</button></div>';
  }).join('');
  $('#lessonList').innerHTML = cod.lessons.slice(0, 5).map(l => '<li><span>' + esc(l.d) + '</span>' + esc(l.t) + '</li>').join('') ||
    '<li><span>EMPTY</span>Your lessons will show here.</li>';
}
$('#capBtns').addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (b) addCod(Number(b.dataset.add)); });
$('#trainBlocks').addEventListener('click', e => {
  const c = e.target.closest('[data-chk]'), s = e.target.closest('[data-start]');
  if (c) {
    const o = store.get('if_coddone', {}), d = todayKey(); o[d] = o[d] || {};
    o[d][c.dataset.chk] = !o[d][c.dataset.chk]; store.set('if_coddone', o); renderTrain();
  } else if (s) {
    const b = COD_BLOCKS.find(x => x.k === s.dataset.start); if (!b) return;
    startTask({ kind: 'cod', key: b.k, label: 'COD: ' + b.t }, b.min);
  }
});
function saveLesson() {
  const inp = $('#lessonIn'), t = inp.value.trim(); if (!t) return;
  cod.lessons.unshift({ d: todayKey(), t }); cod.lessons = cod.lessons.slice(0, 30);
  saveCod(); inp.value = ''; renderTrain();
}
$('#lessonSave').addEventListener('click', saveLesson);
$('#lessonIn').addEventListener('keydown', e => { if (e.key === 'Enter') saveLesson(); });
$('#setupTxt').value = cod.setup;
$('#setupTxt').addEventListener('input', e => { cod.setup = e.target.value; saveCod(); });

/* ---------- ambient (generated offline, loops in background) ---------- */
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

/* ---------- FM / radio ---------- */
const radio = new Audio(); radio.preload = 'none';
let radioOn = false, radioVol = store.get('if_radiovol', 0.7);
const sel = $('#radioSel'), urlIn = $('#radioUrl'), rBtn = $('#radioBtn'), rStat = $('#radioStatus');
sel.value = store.get('if_station', sel.value);
if (!sel.value) sel.selectedIndex = 0;
urlIn.value = store.get('if_customurl', '');
function paintRadio() {
  rBtn.textContent = radioOn ? 'Stop' : 'Play';
  urlIn.hidden = sel.value !== 'custom';
}
function status(t) { rStat.textContent = t; }
sel.addEventListener('change', () => {
  store.set('if_station', sel.value);
  if (radioOn) { radio.pause(); radio.removeAttribute('src'); radio.load(); radioOn = false; status('Stopped'); }
  paintRadio();
});
urlIn.addEventListener('change', () => store.set('if_customurl', urlIn.value.trim()));
rBtn.addEventListener('click', () => {
  if (radioOn) {
    radio.pause(); radio.removeAttribute('src'); radio.load(); radioOn = false; status('Stopped'); paintRadio(); return;
  }
  const url = sel.value === 'custom' ? urlIn.value.trim() : sel.value;
  if (!/^https?:\/\//i.test(url)) { status('Paste a valid stream link (https://...)'); return; }
  store.set('if_customurl', urlIn.value.trim());
  radio.src = url; radio.volume = radioVol; status('Connecting...');
  radio.play().then(() => { radioOn = true; status('Playing'); paintRadio(); })
    .catch(() => { radioOn = false; status('Could not play this stream'); paintRadio(); });
});
radio.addEventListener('error', () => {
  if (!radio.getAttribute('src')) return;
  radioOn = false; status('Stream failed. Try another station.'); paintRadio();
});
$('#radioVol').value = radioVol; radio.volume = radioVol;
$('#radioVol').addEventListener('input', e => { radioVol = Number(e.target.value); radio.volume = radioVol; store.set('if_radiovol', radioVol); });
paintRadio();

/* ---------- Spotify ---------- */
const spIn = $('#spUrl'), spFrame = $('#spFrame'), spOpen = $('#spOpen'), spMsg = $('#spMsg');
function spParse(u) {
  u = String(u || '').trim();
  const m = u.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/i) ||
    u.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)/i);
  return m ? { type: m[1].toLowerCase(), id: m[2] } : null;
}
function spLoad(u) {
  const p = spParse(u);
  if (!p) { spMsg.textContent = 'Paste a Spotify track, album or playlist link.'; return; }
  spMsg.textContent = '';
  spFrame.height = (p.type === 'track' || p.type === 'episode') ? 152 : 352;
  spFrame.src = 'https://open.spotify.com/embed/' + p.type + '/' + p.id + '?utm_source=generator&theme=0';
  spOpen.href = 'https://open.spotify.com/' + p.type + '/' + p.id;
  store.set('if_spotify', u);
}
spIn.value = store.get('if_spotify', 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn');
$('#spLoad').addEventListener('click', () => spLoad(spIn.value));
spIn.addEventListener('keydown', e => { if (e.key === 'Enter') spLoad(spIn.value); });
spLoad(spIn.value);

/* ---------- background: aurora (moving gradients) or your own video ---------- */
const idb = {
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('ikoge-focus', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async get(k) {
    const db = await this.open();
    return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  },
  async put(k, v) {
    const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  },
  async del(k) {
    const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  }
};
const bgC = $('#aurora'), bgV = $('#bgVideo'), g2 = bgC.getContext('2d');
const PAL = {
  focus: [[232, 184, 90], [255, 110, 120], [100, 70, 210]],
  short: [[70, 215, 160], [40, 150, 205], [30, 100, 170]],
  long: [[110, 160, 255], [160, 110, 255], [40, 200, 225]]
};
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let bgMode = store.get('if_bg', 'aurora'), raf = 0, lastDraw = 0, videoUrl = null, hasVideo = false;

function drawAurora(t) {
  const W = bgC.width, H = bgC.height;
  g2.globalCompositeOperation = 'source-over'; g2.fillStyle = '#0c0e10'; g2.fillRect(0, 0, W, H);
  g2.globalCompositeOperation = 'lighter';
  const pal = PAL[mode] || PAL.focus, s = (t || 0) / 1000;
  for (let i = 0; i < 4; i++) {
    const c = pal[i % pal.length].join(',');
    const x = W / 2 + Math.sin(s * 0.22 + i * 2.1) * W * 0.45, y = H / 2 + Math.cos(s * 0.17 + i * 1.7) * H * 0.4;
    const r = H * 0.28 + Math.sin(s * 0.3 + i) * H * 0.04;
    const gr = g2.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + c + ',.5)'); gr.addColorStop(1, 'rgba(' + c + ',0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, W, H);
  }
}
function loop(t) {
  raf = requestAnimationFrame(loop);
  if (t - lastDraw < 55) return; // about 18 fps keeps the battery happy
  lastDraw = t; drawAurora(t);
}
function applyBg() {
  cancelAnimationFrame(raf); raf = 0;
  const useVideo = bgMode === 'video' && hasVideo;
  bgC.hidden = !(bgMode === 'aurora' || (bgMode === 'video' && !hasVideo));
  bgV.hidden = !useVideo;
  if (useVideo) { bgV.muted = true; bgV.play().catch(() => {}); }
  else { try { bgV.pause(); } catch (e) {} }
  if (!bgC.hidden) { drawAurora(performance.now()); if (!reduceMotion && !document.hidden) raf = requestAnimationFrame(loop); }
  $$('#bgChips .chip').forEach(b => b.classList.toggle('on', b.dataset.bg === bgMode));
}
function bgVisibility() {
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; try { bgV.pause(); } catch (e) {} }
  else applyBg();
}
function setBg(m) { bgMode = m; store.set('if_bg', m); applyBg(); }
async function loadVideo() {
  try {
    const blob = await idb.get('bgvideo');
    if (blob) {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      videoUrl = URL.createObjectURL(blob); bgV.src = videoUrl; hasVideo = true;
    } else { hasVideo = false; bgV.removeAttribute('src'); bgV.load(); }
  } catch (e) { hasVideo = false; }
  applyBg();
}
$('#bgChips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  if (b.dataset.bg === 'video' && !hasVideo) { $('#bgMsg').textContent = 'Choose a video first.'; return; }
  setBg(b.dataset.bg);
});
$('#bgPick').addEventListener('click', () => $('#bgFile').click());
$('#bgFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  const msg = $('#bgMsg'); if (!f) return;
  if (!/^video\//.test(f.type)) { msg.textContent = 'That is not a video file.'; return; }
  if (f.size > 60 * 1024 * 1024) { msg.textContent = 'That clip is over 60 MB. Pick a shorter one.'; return; }
  try { await idb.put('bgvideo', f); await loadVideo(); setBg('video'); msg.textContent = 'Video set. It plays silently on a loop.'; }
  catch (err) { msg.textContent = 'Could not save the video (storage may be full).'; }
});
$('#bgClear').addEventListener('click', async () => {
  try { await idb.del('bgvideo'); } catch (e) {}
  if (bgMode === 'video') { bgMode = 'aurora'; store.set('if_bg', 'aurora'); }
  await loadVideo(); $('#bgMsg').textContent = 'Video removed.';
});

/* ---------- settings ---------- */
const dlg = $('#dlg');
function openSettings() {
  $('#sFocus').value = settings.focus; $('#sShort').value = settings.short; $('#sLong').value = settings.long;
  $('#sEvery').value = settings.every; $('#sGoal').value = settings.goal;
  $('#sAuto').checked = !!settings.auto; $('#sAwake').checked = !!settings.awake;
  settings.subjects.forEach((s, i) => { $('#sSub' + i).value = s; });
  $('#sAStart').value = settings.aStart; $('#sALen').value = settings.aLen;
  $('#sBStart').value = settings.bStart; $('#sBLen').value = settings.bLen;
  $('#sCap').value = settings.cap;
  applyBg();
  try { dlg.showModal(); } catch (e) {}
}
$('#setBtn').addEventListener('click', openSettings);
$('#sCancel').addEventListener('click', () => dlg.close());
$('#sSave').addEventListener('click', () => {
  const subs = [0, 1, 2, 3].map(i => $('#sSub' + i).value.trim() || DEF.subjects[i]);
  const tm = (v, d) => (/^\d{1,2}:\d{2}$/.test(v) ? v : d);
  settings = {
    focus: clamp($('#sFocus').value, 1, 180, DEF.focus), short: clamp($('#sShort').value, 1, 60, DEF.short),
    long: clamp($('#sLong').value, 1, 90, DEF.long), every: clamp($('#sEvery').value, 2, 8, DEF.every),
    goal: clamp($('#sGoal').value, 10, 600, DEF.goal), auto: $('#sAuto').checked, awake: $('#sAwake').checked,
    subjects: subs,
    aStart: tm($('#sAStart').value, DEF.aStart), aLen: clamp($('#sALen').value, 30, 240, DEF.aLen),
    bStart: tm($('#sBStart').value, DEF.bStart), bLen: clamp($('#sBLen').value, 30, 240, DEF.bLen),
    cap: clamp($('#sCap').value, 15, 300, DEF.cap)
  };
  store.set('if_settings', settings);
  if (!running && !task) { totalSec = settings[mode] * 60; remaining = totalSec; }
  dlg.close(); render(); renderStreak(); renderRead(); renderTrain();
});

/* ---------- init ---------- */
showTab(tab);
render(); renderStreak(); renderRead(); renderTrain();
loadVideo();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
