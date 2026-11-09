(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------- the reminders ---------- */
/* readA and readB take their time from the Reading settings (aStart, bStart), so the time lives in one place */
const DEFS = [
  { id: 'pray', label: 'Prayer + the Word', time: '05:30', tab: 'today', body: 'Start your day with prayer and the Word.' },
  { id: 'body', label: 'Body routine', time: '06:00', tab: 'train', body: 'About 10 minutes. Posture, plank, core.' },
  { id: 'readA', label: 'Morning reading block', from: 'aStart', tab: 'read', body: 'Your morning reading block is starting.' },
  { id: 'readB', label: 'Evening reading block', from: 'bStart', tab: 'read', body: 'Your evening reading block is starting.' },
  { id: 'pauline', label: 'Pauline chapter', time: '21:00', tab: 'today', body: 'Read one Pauline chapter.' },
  { id: 'evening', label: 'Evening prayer', time: '21:30', tab: 'today', body: 'Time for evening prayer.' },
  { id: 'store', label: 'Phone to the store', time: '22:00', tab: 'today', body: 'Put your phone in the store for the night.' },
  { id: 'sleep', label: 'Sleep', time: '22:30', tab: 'today', body: 'Lights out. Sleep is when you grow.' }
];
const READ_DEF = { aStart: '09:00', bStart: '16:30' };
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const pad2 = n => String(n).padStart(2, '0');
const dkey = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const normTime = (v, d) => { if (!TIME_RE.test(v || '')) return d; const p = v.split(':'); return pad2(p[0]) + ':' + p[1]; };

function readTime(def) {
  const s = store.get('if_settings', {});
  return normTime(s[def.from], READ_DEF[def.from]);
}
function getCfg() {
  const c = store.get('if_rem', {}), saved = (c && c.items) || {}, items = {};
  DEFS.forEach(d => {
    const s = saved[d.id] || {};
    items[d.id] = { on: s.on !== false, time: d.from ? readTime(d) : normTime(s.time, d.time) };
  });
  return { on: !!(c && c.on), items };
}

/* ---------- permission ---------- */
function permState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
function statusText() {
  const p = permState();
  if (p === 'unsupported') return 'This browser cannot show notifications.';
  if (p === 'granted') return 'Notifications are allowed.';
  if (p === 'denied') return 'Notifications are blocked. Allow them for this app in your phone settings, then come back.';
  return 'Tap Allow notifications, then Save.';
}

/* ---------- settings section ---------- */
function paint() {
  const cfg = getCfg(), list = $('#rList'); if (!list) return;
  $('#rOn').checked = cfg.on;
  list.innerHTML = DEFS.map(d => {
    const it = cfg.items[d.id];
    return '<label class="rrow"><span class="rl"><input type="checkbox" data-r="' + d.id + '"' + (it.on ? ' checked' : '') + '> ' + d.label + '</span>' +
      (d.from ? '<span class="rt">' + it.time + '</span>' : '<input type="time" data-rt="' + d.id + '" value="' + it.time + '">') + '</label>';
  }).join('');
  paintPerm();
}
function paintPerm() {
  const st = $('#rStat'), btn = $('#rPerm'); if (!st || !btn) return;
  st.textContent = statusText();
  btn.hidden = permState() !== 'default';
}
function save() {
  const list = $('#rList'); if (!list) return;
  const prev = getCfg(), items = {};
  DEFS.forEach(d => {
    const on = $('[data-r="' + d.id + '"]', list), tm = $('[data-rt="' + d.id + '"]', list);
    items[d.id] = { on: on ? on.checked : true, time: d.from ? readTime(d) : normTime(tm && tm.value, d.time) };
  });
  store.set('if_rem', { on: $('#rOn').checked, items });
  /* a reminder you switched on or moved is allowed to fire again today */
  const k = dkey(new Date()), all = store.get('if_remfired', {}), fired = all[k] || {};
  DEFS.forEach(d => { if (prev.items[d.id].on !== items[d.id].on || prev.items[d.id].time !== items[d.id].time) delete fired[d.id]; });
  const keep = {}; keep[k] = fired; store.set('if_remfired', keep);
  tick();
}
function bind() {
  const btn = $('#rPerm'); if (!btn) return;
  btn.addEventListener('click', () => {
    try {
      const r = Notification.requestPermission();
      if (r && r.then) r.then(paintPerm); else paintPerm();
    } catch (e) { paintPerm(); }
  });
}
bind();

/* ---------- the engine ---------- */
const WINDOW_MIN = 90; // a reminder later than this after its time is skipped, not fired
const toMin = s => { const p = (s || '').split(':'); return Number(p[0]) * 60 + Number(p[1]); };
const DONE_KEY = { pray: 't1', store: 't2', pauline: 't5', evening: 't4', body: 'bx' };

/* pure: which reminders fire now, and which are silently skipped (already done, or too late) */
function due(cfg, nowMin, fired, isDone) {
  const fire = [], skip = [];
  DEFS.forEach(d => {
    const it = cfg.items[d.id];
    if (!it.on || fired[d.id]) return;
    const t = toMin(it.time);
    if (nowMin < t) return;
    if (nowMin - t > WINDOW_MIN || isDone(d.id)) skip.push(d.id); else fire.push(d.id);
  });
  return { fire, skip };
}
function isDoneToday(id) {
  const k = dkey(new Date());
  if (id === 'readA' || id === 'readB') return !!((store.get('if_done', {})[k] || {})[id === 'readA' ? 'A' : 'B']);
  const key = DONE_KEY[id];
  return key ? !!((store.get('ul_routine', {})[k] || {})[key]) : false;
}
function show(d) {
  if (permState() !== 'granted') return;
  const opts = { body: d.body, icon: 'icon-192.png', tag: 'ikoge-rem-' + d.id, vibrate: [200, 100, 200], data: { tab: d.tab } };
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(d.label, opts));
    else new Notification(d.label, opts);
  } catch (e) {}
}
function tick(now) {
  now = now || new Date();
  const cfg = getCfg(); if (!cfg.on || permState() !== 'granted') return;
  const k = dkey(now), all = store.get('if_remfired', {}), fired = all[k] || {};
  const r = due(cfg, now.getHours() * 60 + now.getMinutes(), fired, isDoneToday);
  if (!r.fire.length && !r.skip.length) return;
  r.skip.concat(r.fire).forEach(id => { fired[id] = true; }); // mark first so nothing can repeat
  const keep = {}; keep[k] = fired; store.set('if_remfired', keep);
  r.fire.forEach(id => show(DEFS.find(d => d.id === id)));
}

/* tapping a notification opens the matching tab */
const TABS = ['today', 'focus', 'read', 'train'];
function goTab(t) { if (TABS.indexOf(t) < 0) return; const b = $('.nav-btn[data-t="' + t + '"]'); if (b) b.click(); }
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'ikoge-tab') goTab(e.data.tab); });
const openTab = new URLSearchParams(location.search).get('tab');
if (openTab) setTimeout(() => goTab(openTab), 700);

setInterval(tick, 20000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
setTimeout(tick, 1500);

window.ulRem = { paint, save, getCfg, DEFS, due, tick };
})();
