(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const pad = n => String(n).padStart(2, '0');
const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const jget = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

const css = document.createElement('style');
css.textContent = '.ufrm{display:block;width:100%;height:calc(100dvh - 250px);min-height:380px;border:0;background:#000}.nav-btn span{font-size:10px}';
document.head.appendChild(css);

/* ---------- Ultron tab ---------- */
const pane = document.createElement('div');
pane.className = 'pane'; pane.dataset.pane = 'ultron'; pane.hidden = true;
pane.innerHTML = '<section class="card" style="padding:0;overflow:hidden"><iframe class="ufrm" title="Ultron"></iframe></section>' +
  '<div class="note" id="ukb">Type a question. I answer from my offline notes, no internet needed. Tap the orb to preview its moods.</div>';
$('.wrap').insertBefore(pane, $('.foot-note'));
const frame = $('.ufrm', pane);
const btn = document.createElement('button');
btn.className = 'nav-btn'; btn.dataset.t = 'ultron';
btn.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/></svg><span>Ultron</span>';
$('.nav').appendChild(btn);
$('.nav').addEventListener('click', e => {
  const b = e.target.closest('.nav-btn');
  if (!b) return;
  if (b.dataset.t !== 'ultron') { if (frame.dataset.on) { frame.src = 'about:blank'; delete frame.dataset.on; } return; } // stop the orb when you leave
  e.stopPropagation();
  $$('.pane').forEach(p => { p.hidden = p !== pane; });
  $$('.nav-btn').forEach(x => x.classList.toggle('on', x === b));
  if (!frame.dataset.on) { frame.dataset.on = '1'; frame.src = 'ultron.html'; }
  try { window.scrollTo(0, 0); } catch (err) {}
}, true);

/* ---------- offline brain ---------- */
const KB = () => window.ULTRON_KB;
const STOP = new Set('the a an is are was were to of in on for and or me my i you it what how when where who why do does did can about tell with at be this that should'.split(' '));
const norm = q => q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function search(q) {
  const kb = KB(); if (!kb) return null;
  const nq = ' ' + norm(q) + ' ', tk = norm(q).split(' ').filter(w => w.length > 1 && !STOP.has(w));
  let best = null, bs = 0, second = null, ss = 0;
  kb.entries.forEach(e => {
    let s = 0;
    e.k.forEach(p => {
      if (nq.indexOf(' ' + p + ' ') >= 0) s += 4 + p.split(' ').length;
      else p.split(' ').forEach(w => { if (w.length > 2 && tk.indexOf(w) >= 0) s += 1; });
    });
    const tl = e.t.toLowerCase();
    tk.forEach(w => { if (w.length > 2 && tl.indexOf(w) >= 0) s += 1; });
    if (s > bs) { second = best; ss = bs; best = e; bs = s; } else if (s > ss) { second = e; ss = s; }
  });
  return { best, bs, second, ss };
}
const NAMES = { t1: 'Prayer + the Word', t2: 'Phone to the store', t3: 'JAMB reading', t4: 'Evening prayer', t5: 'Pauline chapter' };
function doneToday() { const o = (jget('ul_routine', {}))[keyOf(new Date())] || {}; return Object.keys(NAMES).filter(k => o[k]); }
function streakNow() {
  const r = jget('ul_routine', {}), full = k => { const o = r[k] || {}; return Object.keys(NAMES).every(t => o[t]); };
  let d = new Date(); d.setHours(0, 0, 0, 0);
  if (!full(keyOf(d))) d.setDate(d.getDate() - 1);
  let n = 0; while (full(keyOf(d)) && n < 4000) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function jambDays() {
  const kb = KB(); if (!kb) return null;
  const p = kb.facts.jambStart.split('-').map(Number), now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((new Date(p[0], p[1] - 1, p[2]) - now) / 864e5);
}
function answer(q) {
  const l = q.toLowerCase(), kb = KB();
  if (/\bupdate\b.*\bultron\b|\brefresh\b.*\b(notes|knowledge)\b/.test(l)) return { a: 'Updates come from Claude. Open your chat with Claude and say update ultron. It researches again and replaces my offline notes.' };
  if (!kb) return { a: 'My notes did not load. Close and reopen the app.' };
  if (/\b(last updated|up to date|how old|how fresh)\b|when.*updated/.test(l)) return { a: 'My notes were last refreshed on ' + new Date(kb.updated + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + '. They hold ' + kb.entries.length + ' topics. Tell Claude update ultron to refresh them.' };
  if (/\b(what('?s| is)? the time|time is it|current time)\b/.test(l)) return { a: 'It is ' + new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + '.' };
  if (/\b(today'?s date|what('?s| is)? the date|what day|day is it|date today)\b/.test(l)) return { a: 'Today is ' + new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '.' };
  if (/\b(how many days|days left|days to go|countdown|how long (until|till|to))\b/.test(l) && /(jamb|utme|exam)/.test(l)) {
    const n = jambDays();
    return n > 0 ? { a: n + ' days to the proposed UTME start on 15 March 2027. The date is a proposal, so confirm it on jamb.gov.ng.' } : { a: 'The proposed UTME window has started or passed. Check the JAMB timetable.' };
  }
  if (/\b(my tasks?|tasks? (left|today|done)|my routine|left today|how am i doing|my progress)\b/.test(l)) {
    const d = doneToday(), left = Object.keys(NAMES).filter(k => d.indexOf(k) < 0).map(k => NAMES[k]);
    return { a: left.length ? d.length + ' of 5 core tasks done today. Left: ' + left.join(', ') + '.' : 'All five core tasks are done today. Well finished.' };
  }
  if (/\b(my|current)\s+streak\b|\bstreak\b.*\b(how many|now|currently)\b/.test(l)) { const n = streakNow(); return { a: 'Your current streak is ' + n + (n === 1 ? ' day.' : ' days.') + ' A day counts when all five core tasks are done.' }; }
  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(l)) return { a: 'Hello. Ask me about JAMB, study tips, your tasks or your streak.' };
  const r = search(q);
  if (r && r.best && r.bs >= 3) {
    let a = r.best.a;
    if (r.second && r.ss >= 3 && r.ss >= r.bs * 0.7) a += ' Related: ' + r.second.t + '.';
    return { a, s: r.best.s };
  }
  return { a: 'That is not in my offline notes yet. Ask Claude to add it, then say update ultron.', miss: true };
}
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
function say(d, text, src) {
  const r = d.getElementById('reply'), l = d.getElementById('list');
  if (!r || !l) return;
  Array.from(r.children).forEach(k => {
    if (k.classList.contains('o2')) k.remove();
    else if (k.classList.contains('o1')) k.className = 'old o2';
    else if (k.classList.contains('new')) k.className = 'old o1';
  });
  const n = d.createElement('div'); n.className = 'new'; n.textContent = text; r.appendChild(n);
  const p = d.createElement('p'); p.dataset.ul = '1';
  const sm = d.createElement('small'); sm.textContent = 'Ultron'; p.appendChild(sm); p.appendChild(d.createTextNode(text));
  if (src) { const s2 = d.createElement('small'); s2.style.marginTop = '4px'; s2.textContent = 'Source: ' + host(src); p.appendChild(s2); }
  l.appendChild(p); l.scrollTop = l.scrollHeight;
}
/* questions the notes could not answer are kept so Claude can add them on the next "update ultron" */
function logMiss(q) {
  const m = jget('ul_unanswered', []);
  m.push({ d: keyOf(new Date()), q: q.slice(0, 120) });
  jset('ul_unanswered', m.slice(-50));
}
function hook() {
  let d; try { d = frame.contentDocument; } catch (e) { return; }
  const list = d && d.getElementById('list'); if (!list) return;
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeName !== 'P' || n.dataset.ul) return;
    const q = Array.from(n.childNodes).filter(x => x.nodeType === 3).map(x => x.textContent).join('').trim();
    if (!q) return;
    const r = answer(q);
    if (r.miss) logMiss(q);
    setTimeout(() => say(d, r.a, r.s), 1250);
  }))).observe(list, { childList: true });
}
frame.addEventListener('load', () => { if (frame.dataset.on) hook(); });

/* ---------- load the notes; app.js reads the exam date from them ---------- */
function onNotes() {
  const kb = KB(), note = $('#ukb');
  if (!kb) return;
  if (window.ulApp) window.ulApp.renderRead();
  if (note) note.textContent = 'Type a question. I answer from ' + kb.entries.length + ' offline notes, no internet needed. Notes updated ' +
    new Date(kb.updated + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + '.';
}
const sc = document.createElement('script');
sc.src = 'ultron-kb.js'; sc.onload = onNotes;
document.body.appendChild(sc);
})();
