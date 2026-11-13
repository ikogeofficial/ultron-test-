(() => {
'use strict';
/* Phone-clock alarms for the Android app (Capacitor). In a normal browser this file only adds the "Move my data" box. */
const cap = window.Capacitor;
const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const LN = native ? ((cap.Plugins && cap.Plugins.LocalNotifications) || cap.registerPlugin('LocalNotifications')) : null;
const DAYS = 14, CH = 'ikoge-rem';
const $ = (s, r = document) => r.querySelector(s);
const pad2 = n => String(n).padStart(2, '0');
const dkey = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const jget = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const DONE_KEY = { pray: 't1', bible: 't1', jamb: 't3', store: 't2', pauline: 't5', evening: 't4', body: 'bx' };
function isDoneToday(id) {
  const k = dkey(new Date());
  if (id === 'readA' || id === 'readB') return !!((jget('if_done', {})[k] || {})[id === 'readA' ? 'A' : 'B']);
  const key = DONE_KEY[id];
  return key ? !!((jget('ul_routine', {})[k] || {})[key]) : false;
}
function goTab(t) { const b = $('.nav-btn[data-t="' + t + '"]'); if (b) b.click(); }

/* ---------- the schedule (October plan). Wed = 3. Sunday = 0. ---------- */
const SUBJ = { 0: 'Review day: go over the week.', 1: 'Biology', 2: 'Chemistry', 3: 'Physics', 4: 'English', 5: 'Biology', 6: 'Chemistry and Physics practice' };
const JAMB_BODY = {}; Object.keys(SUBJ).forEach(k => { JAMB_BODY[k] = 'Time to study: ' + SUBJ[k] + '. Phone face down, timer on.'; });
const NEW_DEFS = [
  { id: 'wake', label: 'Wake up', time: '06:00', tab: 'today', body: 'Good morning. Get up now.', dayTime: { 3: '05:00' } },
  { id: 'pray', label: 'Prayer + daily declaration', time: '06:05', tab: 'today', body: 'Pray and say your daily declaration.', dayTime: { 3: '05:05' } },
  { id: 'church', label: 'Leave for church', time: '06:10', tab: 'today', body: 'Church starts at 6:30. Leave now.', only: [3] },
  { id: 'body', label: 'Exercise', time: '06:15', tab: 'train', body: 'Exercise now. 20 to 30 minutes.', not: [3] },
  { id: 'bible', label: 'Bible: Genesis 1 onward', time: '07:00', tab: 'today', body: 'Read your next chapter.', not: [3] },
  { id: 'brk', label: 'Breakfast + 20 min past questions', time: '07:30', tab: 'read', body: 'Eat, then 20 minutes of JAMB past questions.', dayTime: { 3: '07:45' } },
  { id: 'walk', label: 'Thank-you prayer first', time: '14:30', tab: 'today', body: 'You are back from lessons. Pray first, then everything else.' },
  { id: 'jamb', label: 'JAMB, 3:00 to 5:00 PM', time: '15:00', tab: 'read', body: 'Time to study.', dayBody: JAMB_BODY },
  { id: 'evening', label: 'Evening prayer', time: '19:30', tab: 'today', body: 'Time for evening prayer.' },
  { id: 'pauline', label: 'Pauline chapter', time: '20:45', tab: 'today', body: 'Read one Pauline chapter.' },
  { id: 'winddown', label: 'Wind-down', time: '21:00', tab: 'today', body: 'Wind-down. Plan tomorrow, then inspiration.' },
  { id: 'store', label: 'Phone to the store', time: '21:15', tab: 'today', body: 'Put your phone in the store for the night.' },
  { id: 'sleep', label: 'Sleep', time: '21:30', tab: 'today', body: 'Lights out. Sleep is when you grow.' }
];
function applySchedule() {
  const R = window.ulRem; if (!R || !R.DEFS) return false;
  try {
    if (localStorage.getItem('ik_sched_v') !== 'nov13') {
      const c = jget('if_rem', null);
      localStorage.setItem('if_rem', JSON.stringify({ on: c ? !!c.on : native, items: {} }));
      localStorage.setItem('ik_sched_v', 'nov13');
    }
  } catch (e) {}
  R.DEFS.length = 0; NEW_DEFS.forEach(d => R.DEFS.push(d));
  try { R.paint(); } catch (e) {}
  return true;
}
applySchedule();

/* pure: every alarm from now on, for the next `days` days. Done-today reminders are left out for today. */
function plan(nowMs, cfg, defs, isDone, days) {
  const out = [], n = new Date(nowMs);
  for (let off = 0; off < days; off++) {
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + off);
    const dayNo = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    const wd = d.getDay();
    defs.forEach((def, i) => {
      const it = cfg.items[def.id]; if (!it || !it.on) return;
      if (def.only && def.only.indexOf(wd) < 0) return;
      if (def.not && def.not.indexOf(wd) >= 0) return;
      const p = String((def.dayTime && def.dayTime[wd]) || it.time).split(':'), h = Number(p[0]), m = Number(p[1]);
      if (!(h >= 0 && h < 24 && m >= 0 && m < 60)) return;
      const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).getTime();
      if (at <= nowMs) return;
      if (off === 0 && isDone(def.id)) return;
      out.push({ id: dayNo * 16 + i + 1, at, title: def.label, body: (def.dayBody && def.dayBody[wd]) || def.body, tab: def.tab });
    });
  }
  return out;
}

let busy = false, again = false;
async function sync() {
  if (!LN) return;
  if (busy) { again = true; return; }
  busy = true;
  try {
    const R = window.ulRem; if (!R) { setTimeout(sync, 1500); return; }
    if (R.DEFS.length !== NEW_DEFS.length || !R.DEFS[0] || R.DEFS[0].id !== 'wake') applySchedule();
    const perm = await LN.checkPermissions();
    if (perm.display !== 'granted') return;
    await LN.createChannel({ id: CH, name: 'Reminders', description: 'Daily reminders', importance: 5, visibility: 1, vibration: true });
    const cfg = R.getCfg(), now = Date.now();
    const want = cfg.on ? plan(now, cfg, R.DEFS, isDoneToday, DAYS) : [];
    const wantIds = new Set(want.map(w => w.id));
    const pend = ((await LN.getPending()).notifications || []).filter(p => p.id !== 1);
    const stale = pend.filter(p => !wantIds.has(p.id));
    if (stale.length) await LN.cancel({ notifications: stale.map(p => ({ id: p.id })) });
    /* an alarm due within the next minute is never touched */
    const items = want.filter(w => w.at > now + 60000).map(w => ({
      id: w.id, title: w.title, body: w.body, channelId: CH, extra: { tab: w.tab },
      schedule: { at: new Date(w.at), allowWhileIdle: true }
    }));
    if (items.length) await LN.schedule({ notifications: items });
    stat('Alarms set: ' + items.length + ' (next ' + DAYS + ' days). They ring from the phone clock, no internet needed.');
  } catch (e) { stat('Could not set alarms: ' + (e && e.message ? e.message : e)); }
  finally { busy = false; if (again) { again = false; sync(); } }
}

function stat(t) { const s = $('#nStat'); if (s) s.textContent = t; }

/* ---------- panel in Settings ---------- */
function panel() {
  const list = $('#rList'); if (!list || $('#nBox')) return;
  const box = document.createElement('div'); box.id = 'nBox';
  box.innerHTML =
    (native
      ? '<div class="sec-h sm">Alarms (work without internet)</div>' +
        '<div class="note" id="nStat">Tap Allow alarms first.</div>' +
        '<div class="radio-row"><button type="button" class="btn sm" id="nAllow">Allow alarms</button><button type="button" class="btn sm" id="nTest">Test in 1 min</button></div>' +
        '<div class="note">Also do this once: Phone Settings, Apps, Ikoge Ultron, Battery, choose Unrestricted. On Tecno, Infinix or Xiaomi also turn on Autostart and lock the app in Recent apps.</div>'
      : '') +
    '<div class="sec-h sm">Move my data</div>' +
    '<div class="radio-row"><button type="button" class="btn sm" id="nExp">Copy my data</button><button type="button" class="btn sm" id="nImp">Paste my data</button></div>' +
    '<textarea id="nTxt" class="field" rows="3" placeholder="Paste here, then tap Paste my data again" hidden></textarea>' +
    '<div class="note" id="nMsg"></div>';
  list.insertAdjacentElement('afterend', box);
  const msg = t => { $('#nMsg').textContent = t; };
  $('#nExp').onclick = async () => {
    const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
    const txt = JSON.stringify({ ikogeBackup: 1, data: o });
    try { await navigator.clipboard.writeText(txt); msg('Copied. Open the app on the other side and tap Paste my data.'); }
    catch (e) { const t = $('#nTxt'); t.hidden = false; t.value = txt; t.select(); msg('Select all in the box and copy it.'); }
  };
  $('#nImp').onclick = async () => {
    const t = $('#nTxt'); let txt = t.hidden ? '' : t.value.trim();
    if (!txt) { try { txt = (await navigator.clipboard.readText()).trim(); } catch (e) {} }
    if (!txt) { t.hidden = false; msg('Paste your copied data in the box, then tap Paste my data again.'); return; }
    try {
      const o = JSON.parse(txt); if (!o || o.ikogeBackup !== 1 || typeof o.data !== 'object') throw 0;
      Object.keys(o.data).forEach(k => { if (typeof o.data[k] === 'string') localStorage.setItem(k, o.data[k]); });
      msg('Done. Reloading...'); setTimeout(() => location.reload(), 600);
    } catch (e) { msg('That is not a valid copy. Copy again from the old app.'); }
  };
  if (native) {
    const rs = $('#rStat'), rp = $('#rPerm'); if (rs) rs.hidden = true; if (rp) rp.hidden = true;
    $('#nAllow').onclick = async () => {
      try {
        const p = await LN.requestPermissions();
        if (p.display !== 'granted') { stat('Notifications are blocked. Allow them in Phone Settings, Apps, Ikoge Ultron.'); return; }
        try { const ex = await LN.checkExactNotificationSetting(); if (ex.exact_alarm !== 'granted') await LN.changeExactNotificationSetting(); } catch (e) {}
        sync();
      } catch (e) { stat('Could not ask: ' + (e && e.message ? e.message : e)); }
    };
    $('#nTest').onclick = async () => {
      try {
        await LN.createChannel({ id: CH, name: 'Reminders', description: 'Daily reminders', importance: 5, visibility: 1, vibration: true });
        await LN.schedule({ notifications: [{ id: 1, title: 'Test alarm', body: 'It works. This came from the phone clock.', channelId: CH, extra: { tab: 'today' }, schedule: { at: new Date(Date.now() + 60000), allowWhileIdle: true } }] });
        stat('Test alarm set for 1 minute from now. Close the app or switch on airplane mode and wait.');
      } catch (e) { stat('Test failed: ' + (e && e.message ? e.message : e)); }
    };
    LN.checkPermissions().then(p => stat(p.display === 'granted' ? 'Allowed. Syncing...' : 'Tap Allow alarms first.')).catch(() => {});
  }
}

panel();
if (LN) {
  let dt = 0; const later = () => { clearTimeout(dt); dt = setTimeout(sync, 800); };
  document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#dlg')) later(); });
  document.addEventListener('change', e => { if (e.target && e.target.closest && e.target.closest('#dlg')) later(); });
  document.addEventListener('visibilitychange', () => sync());
  window.addEventListener('pagehide', () => sync());
  LN.addListener('localNotificationActionPerformed', e => {
    const t = e && e.notification && e.notification.extra && e.notification.extra.tab;
    if (t) goTab(t);
  });
  setTimeout(sync, 1200);
}
window.ikNative = { plan, sync };
})();
