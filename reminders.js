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
  tick(); sync();
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
/* the island: a small pill that drops from the top while the app is open */
(function () {
  const st = document.createElement('style');
  st.textContent = '.island{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:50%;transform:translate(-50%,-140%);z-index:99;display:flex;align-items:center;gap:10px;max-width:calc(100% - 24px);min-width:200px;padding:10px 18px;border-radius:999px;background:#000;color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);transition:transform .45s cubic-bezier(.2,1.1,.3,1);cursor:pointer;font:inherit}.island.on{transform:translate(-50%,0)}.island i{width:9px;height:9px;border-radius:50%;background:#e8b85a;flex:none;animation:ipulse 1.2s infinite}.island b{display:block;font-size:14px}.island span{display:block;font-size:12px;opacity:.75}@keyframes ipulse{50%{opacity:.35}}';
  document.head.appendChild(st);
})();
let islandT = 0;
function island(d) {
  let el = $('.island');
  if (!el) { el = document.createElement('button'); el.type = 'button'; el.className = 'island'; document.body.appendChild(el); }
  el.innerHTML = '<i></i><div><b></b><span></span></div>';
  el.querySelector('b').textContent = d.label; el.querySelector('span').textContent = d.body;
  el.onclick = () => { el.classList.remove('on'); goTab(d.tab); };
  void el.offsetWidth; el.classList.add('on');
  clearTimeout(islandT); islandT = setTimeout(() => el.classList.remove('on'), 7000);
  try { if (navigator.vibrate) navigator.vibrate([150, 80, 150]); } catch (e) {}
}
function show(d) {
  if (document.visibilityState === 'visible') { island(d); return; }
  if (permState() !== 'granted') return;
  const opts = { body: d.body, icon: 'icon-192.png', tag: 'ikoge-rem-' + d.id, vibrate: [200, 100, 200], requireInteraction: true, data: { tab: d.tab } };
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

/* ---------- reminders while the app is closed (Web Push through your Worker) ---------- */
const workerUrl = () => (store.get('if_rem_worker', '') || '').replace(/\/+$/, '');
function token() {
  let t = store.get('if_rem_token', '');
  if (!t) { t = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join(''); store.set('if_rem_token', t); }
  return t;
}
const b64ToBytes = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(s + '='.repeat((4 - s.length % 4) % 4)); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
async function post(path, body) {
  const r = await fetch(workerUrl() + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}
async function sync() {
  const ep = store.get('if_rem_ep', ''); if (!ep || !workerUrl()) return;
  const cfg = getCfg(), items = {}, done = {};
  DEFS.forEach(d => { items[d.id] = { on: cfg.items[d.id].on, time: cfg.items[d.id].time, label: d.label, body: d.body, tab: d.tab }; done[d.id] = isDoneToday(d.id); });
  try { await post('/sync', { endpoint: ep, token: token(), on: cfg.on, items, done, date: dkey(new Date()) }); } catch (e) {}
}
function bgStat(t) { const s = $('#rBgStat'); if (s) s.textContent = t; }
function bgPaint() {
  const on = !!store.get('if_rem_ep', ''), w = $('#rWorker'), b = $('#rBg'), o = $('#rBgOff');
  if (!w) return;
  w.value = store.get('if_rem_worker', ''); b.hidden = on; o.hidden = !on; w.disabled = on;
  bgStat(on ? 'On. Reminders will reach this phone even when the app is closed.' : 'Paste the link from your Cloudflare Worker, then tap Turn on.');
}
async function bgOn() {
  const url = $('#rWorker').value.trim().replace(/\/+$/, '');
  if (!/^https:\/\//.test(url)) { bgStat('Paste the https link first.'); return; }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { bgStat('This browser cannot do background reminders.'); return; }
  try {
    bgStat('Working...');
    if (permState() === 'default') await Notification.requestPermission();
    if (permState() !== 'granted') { bgStat('Allow notifications first.'); paintPerm(); return; }
    store.set('if_rem_worker', url);
    const k = (await (await fetch(url + '/vapid')).json()).key;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k) });
    store.set('if_rem_ep', sub.endpoint);
    const c = await caches.open('ikoge-cfg'); await c.put('worker', new Response(url));
    await sync(); bgPaint(); paintPerm();
  } catch (e) { bgStat('Could not turn on. Check the link and your internet.'); }
}
async function bgOff() {
  const ep = store.get('if_rem_ep', '');
  try { await post('/off', { endpoint: ep, token: token() }); } catch (e) {}
  try { const reg = await navigator.serviceWorker.ready, s = await reg.pushManager.getSubscription(); if (s) await s.unsubscribe(); } catch (e) {}
  store.set('if_rem_ep', ''); bgPaint();
}
(function () {
  const host = $('#dlg .dlg-btns');
  if (host && !$('#rBg')) host.insertAdjacentHTML('beforebegin',
    '<div class="sec-h sm">Reminders when the app is closed</div>' +
    '<input id="rWorker" class="field" type="url" inputmode="url" placeholder="Paste your reminder link (https://...)">' +
    '<div class="radio-row"><button type="button" class="btn sm" id="rBg">Turn on</button><button type="button" class="btn sm" id="rBgOff" hidden>Turn off</button></div>' +
    '<div class="note" id="rBgStat"></div>');
  const b = $('#rBg'), o = $('#rBgOff'); if (!b) return;
  b.addEventListener('click', bgOn); o.addEventListener('click', bgOff); bgPaint();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sync(); });
  window.addEventListener('pagehide', sync);
})();

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
