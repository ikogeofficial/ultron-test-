// Ikoge Ultron: background reminders as a Supabase Edge Function.
// No secrets in this file. Push keys are made on first use and kept in the ul_keys table.
// Needs the secret CRON_SECRET (set in Supabase, see supabase/setup.sql notes).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const WINDOW = 90;          // minutes: a reminder later than this after its time is skipped
const LAGOS = 60;           // Nigeria is UTC+1 all year
const SUBJECT = 'https://github.com/ikogeofficial/ultron-test-';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, apikey, x-client-info',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uText = s => b64u(new TextEncoder().encode(s));
async function sha(s) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/* ---------- the database (tables made by supabase/setup.sql) ---------- */
function makeDb(sb) {
  const one = async q => { const { data, error } = await q.maybeSingle(); if (error) throw error; return data; };
  const ok = async q => { const { error } = await q; if (error) throw error; };
  return {
    getKeys: () => one(sb.from('ul_keys').select('priv,pub').eq('id', 1)),
    putKeys: (priv, pub) => ok(sb.from('ul_keys').upsert({ id: 1, priv, pub })),
    getRec: uid => one(sb.from('ul_push').select('*').eq('uid', uid)),
    putRec: (uid, r) => ok(sb.from('ul_push').upsert({ uid, th: r.th, endpoint: r.endpoint, is_on: r.is_on, items: r.items, done: r.done, done_date: r.done_date, fired: r.fired, fired_date: r.fired_date })),
    delRec: uid => ok(sb.from('ul_push').delete().eq('uid', uid)),
    listOn: async () => { const { data, error } = await sb.from('ul_push').select('*').eq('is_on', true); if (error) throw error; return data || []; },
    putMsg: (uid, msgs) => ok(sb.from('ul_msg').upsert({ uid, msgs, created: new Date().toISOString() })),
    popMsg: async uid => {
      const m = await one(sb.from('ul_msg').select('msgs,created').eq('uid', uid));
      if (m) await ok(sb.from('ul_msg').delete().eq('uid', uid));
      return (m && Date.now() - Date.parse(m.created) < 3600000) ? m.msgs : [];
    }
  };
}

/* ---------- push keys ---------- */
async function getKeys(db) {
  let k = await db.getKeys();
  if (k) return k;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pub = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
  await db.putKeys(priv, pub);
  return { priv, pub };
}
async function authHeader(db, endpoint) {
  const k = await getKeys(db);
  const head = b64uText(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64uText(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT }));
  const key = await crypto.subtle.importKey('jwk', k.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(head + '.' + body));
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + k.pub;
}
/* a push with no body: the phone wakes the app's service worker, which then asks /msg what to show */
async function ping(db, endpoint) {
  return fetch(endpoint, { method: 'POST', headers: { Authorization: await authHeader(db, endpoint), TTL: '3600', Urgency: 'high', 'Content-Length': '0' } });
}

/* ---------- requests from the app ---------- */
function cleanItems(raw) {
  const out = {};
  Object.keys(raw || {}).slice(0, 20).forEach(id => {
    const it = raw[id];
    if (!/^[a-zA-Z]{1,12}$/.test(id) || !it || !TIME_RE.test(it.time || '')) return;
    out[id] = { on: it.on !== false, time: it.time, label: String(it.label || '').slice(0, 60), body: String(it.body || '').slice(0, 140), tab: ['today', 'focus', 'read', 'train'].includes(it.tab) ? it.tab : 'today' };
  });
  return out;
}
async function handle(req, db, env) {
  const url = new URL(req.url);
  const route = url.pathname.replace(/\/+$/, '').split('/').pop();
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (route === 'vapid' && req.method === 'GET') return json({ key: (await getKeys(db)).pub });
  if (req.method !== 'POST') return json({ ok: true, app: 'ikoge-ultron-reminders' });
  if (route === 'cron') {
    if (!env.cronSecret || req.headers.get('x-cron-secret') !== env.cronSecret) return json({ error: 'no' }, 401);
    await run(db); return json({ ok: true });
  }
  let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (typeof b.endpoint !== 'string' || !/^https:\/\//.test(b.endpoint) || b.endpoint.length > 1000) return json({ error: 'bad endpoint' }, 400);
  const uid = await sha(b.endpoint);

  if (route === 'sync') {
    if (typeof b.token !== 'string' || b.token.length < 16 || b.token.length > 100) return json({ error: 'bad token' }, 400);
    const th = await sha(b.token), old = await db.getRec(uid);
    if (old && old.th !== th) return json({ error: 'not yours' }, 403);
    const rec = old || { fired: {}, fired_date: '' };
    rec.th = th; rec.endpoint = b.endpoint; rec.is_on = !!b.on; rec.items = cleanItems(b.items);
    rec.done = (b.done && typeof b.done === 'object') ? b.done : {};
    rec.done_date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : '';
    await db.putRec(uid, rec);
    return json({ ok: true });
  }
  if (route === 'msg') return json({ msgs: await db.popMsg(uid) });
  if (route === 'off') {
    const old = await db.getRec(uid);
    if (old && b.token && old.th === await sha(String(b.token))) await db.delRec(uid);
    return json({ ok: true });
  }
  return json({ error: 'not found' }, 404);
}

/* ---------- the cron: called every minute ---------- */
async function run(db, nowMs = Date.now()) {
  const d = new Date(nowMs + LAGOS * 60000);
  const date = d.toISOString().slice(0, 10), mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  for (const rec of await db.listOn()) {
    if (rec.fired_date !== date) { rec.fired = {}; rec.fired_date = date; }
    const doneToday = rec.done_date === date ? rec.done : {};
    const msgs = []; let changed = false;
    Object.keys(rec.items).forEach(id => {
      const it = rec.items[id]; if (!it.on || rec.fired[id]) return;
      const t = toMin(it.time); if (mins < t) return;
      rec.fired[id] = true; changed = true;
      if (mins - t <= WINDOW && !doneToday[id]) msgs.push({ id, title: it.label, body: it.body, tab: it.tab });
    });
    if (!changed) continue;
    if (msgs.length) {
      await db.putMsg(rec.uid, msgs);
      const r = await ping(db, rec.endpoint);
      if (r.status === 404 || r.status === 410) { await db.delRec(rec.uid); continue; }
    }
    await db.putRec(rec.uid, rec);
  }
}

export { handle, run, makeDb };

// @ts-ignore  (Deno only; skipped when tested in Node)
if (typeof Deno !== 'undefined') {
  // @ts-ignore
  const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const db = makeDb(sb);
  // @ts-ignore
  const env = { cronSecret: Deno.env.get('CRON_SECRET') };
  // @ts-ignore
  Deno.serve(req => handle(req, db, env).catch(() => json({ error: 'server' }, 500)));
}
