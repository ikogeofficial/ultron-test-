// Ikoge Ultron: background reminders (Cloudflare Worker).
// Needs: a KV namespace bound as KV, and a cron trigger "* * * * *".
// No secrets in this file. Push keys are made on first use and kept in KV.
const WINDOW = 90;          // minutes: a reminder later than this after its time is skipped
const LAGOS = 60;           // Nigeria is UTC+1 all year
const SUBJECT = 'https://github.com/ikogeofficial/ultron-test-';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
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

/* ---------- push keys (made once, kept in KV) ---------- */
async function getKeys(env) {
  let k = await env.KV.get('vapid', 'json');
  if (k) return k;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pub = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
  k = { priv, pub };
  await env.KV.put('vapid', JSON.stringify(k));
  return k;
}
async function authHeader(env, endpoint) {
  const k = await getKeys(env);
  const head = b64uText(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64uText(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT }));
  const key = await crypto.subtle.importKey('jwk', k.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(head + '.' + body));
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + k.pub;
}
/* a push with no body: the phone wakes the app's service worker, which then asks /msg what to show */
async function ping(env, endpoint) {
  return fetch(endpoint, { method: 'POST', headers: { Authorization: await authHeader(env, endpoint), TTL: '3600', Urgency: 'high', 'Content-Length': '0' } });
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
async function handle(req, env) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (url.pathname === '/vapid' && req.method === 'GET') return json({ key: (await getKeys(env)).pub });
  if (req.method !== 'POST') return json({ ok: true, app: 'ikoge-ultron-reminders' });
  let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (typeof b.endpoint !== 'string' || !/^https:\/\//.test(b.endpoint) || b.endpoint.length > 1000) return json({ error: 'bad endpoint' }, 400);
  const uid = await sha(b.endpoint), rk = 'u:' + uid;

  if (url.pathname === '/sync') {
    if (typeof b.token !== 'string' || b.token.length < 16 || b.token.length > 100) return json({ error: 'bad token' }, 400);
    const th = await sha(b.token), old = await env.KV.get(rk, 'json');
    if (old && old.th !== th) return json({ error: 'not yours' }, 403);
    const rec = old || { fired: {} };
    rec.th = th; rec.endpoint = b.endpoint; rec.on = !!b.on; rec.items = cleanItems(b.items);
    rec.done = (b.done && typeof b.done === 'object') ? b.done : {};
    rec.doneDate = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : '';
    await env.KV.put(rk, JSON.stringify(rec));
    return json({ ok: true });
  }
  if (url.pathname === '/msg') {
    const m = await env.KV.get('m:' + uid, 'json');
    if (m) await env.KV.delete('m:' + uid);
    return json({ msgs: m || [] });
  }
  if (url.pathname === '/off') {
    const old = await env.KV.get(rk, 'json');
    if (old && b.token && old.th === await sha(String(b.token))) await env.KV.delete(rk);
    return json({ ok: true });
  }
  return json({ error: 'not found' }, 404);
}

/* ---------- the cron: runs every minute ---------- */
async function run(env, nowMs = Date.now()) {
  const d = new Date(nowMs + LAGOS * 60000);
  const date = d.toISOString().slice(0, 10), mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  let cursor;
  do {
    const page = await env.KV.list({ prefix: 'u:', cursor });
    cursor = page.list_complete ? undefined : page.cursor;
    for (const key of page.keys) {
      const rec = await env.KV.get(key.name, 'json'); if (!rec || !rec.on) continue;
      if (!rec.fired || rec.firedDate !== date) { rec.fired = {}; rec.firedDate = date; }
      const doneToday = rec.doneDate === date ? rec.done : {};
      const msgs = []; let changed = false;
      Object.keys(rec.items).forEach(id => {
        const it = rec.items[id]; if (!it.on || rec.fired[id]) return;
        const t = toMin(it.time); if (mins < t) return;
        rec.fired[id] = true; changed = true;
        if (mins - t <= WINDOW && !doneToday[id]) msgs.push({ id, title: it.label, body: it.body, tab: it.tab });
      });
      if (!changed) continue;
      if (msgs.length) {
        await env.KV.put('m:' + key.name.slice(2), JSON.stringify(msgs), { expirationTtl: 3600 });
        const r = await ping(env, rec.endpoint);
        if (r.status === 404 || r.status === 410) { await env.KV.delete(key.name); continue; }
      }
      await env.KV.put(key.name, JSON.stringify(rec));
    }
  } while (cursor);
}

export default {
  fetch: (req, env) => handle(req, env).catch(() => json({ error: 'server' }, 500)),
  scheduled: (event, env, ctx) => ctx.waitUntil(run(env))
};
export { run, handle };
