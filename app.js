(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const clamp = (n, a, b, d) => { n = Math.round(Number(n)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };

/* ---------- state ---------- */
const LABELS = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };
const DEF = { focus: 25, short: 5, long: 15, every: 4, goal: 120, auto: false, awake: false };
let settings = Object.assign({}, DEF, store.get('if_settings', {}));
let mode = 'focus';
let totalSec = settings.focus * 60;
let remaining = totalSec;
let running = false, endAt = 0, timer = null, wakeLock = null;
let cycle = store.get('if_cycle', 0);

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
  const p = n => String(n).padStart(2, '0');
  return h ? h + ':' + p(m) + ':' + p(x) : p(m) + ':' + p(x);
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
  $('#cycleTxt').textContent = mode === 'focus'
    ? 'Session ' + ((cycle % settings.every) + 1) + ' of ' + settings.every : 'Rest your eyes';
  $('#startBtn').textContent = running ? 'Pause' : (remaining < totalSec && remaining > 0 ? 'Resume' : 'Start');
  $$('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
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
function setMode(m) { stop(); mode = m; totalSec = settings[m] * 60; remaining = totalSec; render(); }

function finish() {
  stop();
  chime();
  try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) {}
  if (mode === 'focus') {
    record(Math.max(1, Math.round(totalSec / 60)));
    cycle++; store.set('if_cycle', cycle);
    mode = (cycle % settings.every === 0) ? 'long' : 'short';
    notify('Focus session done', 'Take a break. You earned it.');
  } else {
    mode = 'focus';
    notify('Break over', 'Back to focus.');
  }
  totalSec = settings[mode] * 60; remaining = totalSec;
  renderStreak(); render();
  if (settings.auto) start();
}

$('#startBtn').addEventListener('click', () => (running ? pause() : start()));
$('#resetBtn').addEventListener('click', reset);
$('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setMode(b.dataset.m); });
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b || !b.dataset.min) return;
  stop(); totalSec = Number(b.dataset.min) * 60; remaining = totalSec; render();
});
$('#fsBtn').addEventListener('click', () => {
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {}
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (running) { tick(); lock(); } renderStreak(); }
});

/* ---------- streak ---------- */
function dkey(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function record(min) {
  const log = store.get('if_log', {}), k = dkey(new Date()), o = log[k] || { min: 0, sessions: 0 };
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
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ti = (now.getDay() + 6) % 7;
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

/* ---------- settings ---------- */
const dlg = $('#dlg');
$('#setBtn').addEventListener('click', () => {
  $('#sFocus').value = settings.focus; $('#sShort').value = settings.short; $('#sLong').value = settings.long;
  $('#sEvery').value = settings.every; $('#sGoal').value = settings.goal;
  $('#sAuto').checked = !!settings.auto; $('#sAwake').checked = !!settings.awake;
  dlg.showModal();
});
$('#sCancel').addEventListener('click', () => dlg.close());
$('#sSave').addEventListener('click', () => {
  settings = {
    focus: clamp($('#sFocus').value, 1, 180, DEF.focus), short: clamp($('#sShort').value, 1, 60, DEF.short),
    long: clamp($('#sLong').value, 1, 90, DEF.long), every: clamp($('#sEvery').value, 2, 8, DEF.every),
    goal: clamp($('#sGoal').value, 10, 600, DEF.goal), auto: $('#sAuto').checked, awake: $('#sAwake').checked
  };
  store.set('if_settings', settings);
  if (!running) { totalSec = settings[mode] * 60; remaining = totalSec; }
  dlg.close(); render(); renderStreak();
});

/* ---------- init ---------- */
render(); renderStreak();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
