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
  const items = {};
  DEFS.forEach(d => {
    const on = $('[data-r="' + d.id + '"]', list), tm = $('[data-rt="' + d.id + '"]', list);
    items[d.id] = { on: on ? on.checked : true, time: d.from ? readTime(d) : normTime(tm && tm.value, d.time) };
  });
  store.set('if_rem', { on: $('#rOn').checked, items });
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

window.ulRem = { paint, save, getCfg, DEFS };
})();
