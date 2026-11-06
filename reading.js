(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const pad = n => String(n).padStart(2, '0');
const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hm = m => m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const SUBJ = ['Biology', 'Chemistry', 'Physics', 'English'];
const CATS = ['Fiction', 'Non-fiction', 'Faith', 'Study', 'Other'];

const css = document.createElement('style');
css.textContent = '.bk{padding:12px;border-radius:16px;background:rgba(0,0,0,.26);border:1px solid var(--glass-b);display:flex;flex-direction:column;gap:8px}' +
  '.bk-b{display:flex;gap:8px}.bk-b .btn{flex:1;padding:11px 4px;font-size:11px;letter-spacing:.06em}' +
  '.bk .bar{margin:0}.bks{display:flex;flex-direction:column;gap:10px;margin-top:10px}' +
  '.hist{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.26);border:1px solid var(--glass-b);font-size:13px}' +
  '.hist span{font:10px var(--mono);color:var(--mut);display:block}.hist button{background:none;border:0;color:var(--mut);font-size:18px;padding:4px 8px;cursor:pointer}' +
  '.qz label{display:flex;flex-direction:column;gap:6px}';
document.head.appendChild(css);

const pane = $('[data-pane="read"]');
if (!pane) return;
const box = document.createElement('div');
box.style.cssText = 'display:flex;flex-direction:column;gap:16px';
pane.appendChild(box);

let books = [], sess = [], tg = {}, wg = 100;
const load = () => { books = store.get('ul_books', []); sess = store.get('ul_sess', []); tg = store.get('ul_subtarget', {}); wg = store.get('ul_weekgoal', 100); };
const save = () => { store.set('ul_books', books); store.set('ul_sess', sess.slice(-600)); };

function modal(title, fields, okLabel, onSave) {
  const ov = document.createElement('div'); ov.className = 'qz';
  ov.innerHTML = '<div class="card"><h2 class="q-t">' + esc(title) + '</h2>' + fields.map(f => '<label class="note">' + esc(f.l) +
    (f.t === 'select' ? '<select class="field" id="mf_' + f.id + '">' + f.o.map(o => '<option>' + esc(o) + '</option>').join('') + '</select>' :
      '<input class="field" id="mf_' + f.id + '" type="' + f.t + '"' + (f.max ? ' max="' + f.max + '"' : '') + (f.t === 'number' ? ' inputmode="numeric" min="0"' : ' maxlength="80"') +
      ' value="' + esc(f.v == null ? '' : f.v) + '">') + '</label>').join('') +
    '<div class="note" id="mf_err" style="color:#ff7a96"></div><div class="btnrow" style="grid-template-columns:1fr 1fr"><button class="btn" id="mf_c">Cancel</button><button class="btn primary" id="mf_s">' + okLabel + '</button></div></div>';
  document.body.appendChild(ov);
  $('#mf_c').onclick = () => ov.remove();
  $('#mf_s').onclick = () => {
    const v = {}; fields.forEach(f => { v[f.id] = $('#mf_' + f.id).value.trim(); });
    const err = onSave(v);
    if (err) $('#mf_err').textContent = err; else { ov.remove(); render(); }
  };
}
const num = (v, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0; };

function logSession(book, subj) {
  const tk = dkey(today0());
  const f = [{ id: 'm', l: 'Minutes read', t: 'number' }];
  if (book) f.push({ id: 'p', l: 'Pages read', t: 'number' });
  f.push({ id: 'd', l: 'Date', t: 'date', v: tk, max: tk });
  modal(book ? 'Log: ' + book.title : 'Log: ' + subj, f, 'Save', v => {
    const m = num(v.m, 0, 720), p = book ? num(v.p, 0, 5000) : 0;
    if (m < 1 && p < 1) return 'Enter minutes or pages.';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v.d) && v.d <= tk ? v.d : tk;
    const s = { id: uid(), d, m, p };
    if (book) {
      s.b = book.id; s.t = book.title;
      if (p > 0) { book.read = Math.min(book.total, book.read + p); if (book.read >= book.total) { book.done = true; book.doneDate = d; } }
    } else s.s = subj;
    sess.push(s); save();
  });
}
function addBook() {
  modal('Add a book', [{ id: 't', l: 'Title', t: 'text' }, { id: 'a', l: 'Author', t: 'text' },
    { id: 'c', l: 'Category', t: 'select', o: CATS }, { id: 'n', l: 'Total pages', t: 'number' }], 'Add', v => {
    if (!v.t) return 'Add a title.';
    const n = num(v.n, 0, 5000); if (n < 1) return 'Enter the total pages.';
    books.push({ id: uid(), title: v.t.slice(0, 80), author: v.a.slice(0, 60), cat: v.c, total: n, read: 0, done: false });
    save();
  });
}
function render() {
  load();
  const t0 = today0(), tk = dkey(t0), dm = (t0.getDay() + 6) % 7, wk0 = dkey(addDays(t0, -dm));
  let tot = 0, tm = 0, tp = 0, wm = 0, wp = 0;
  sess.forEach(s => { tot += s.m; if (s.d === tk) { tm += s.m; tp += s.p; } if (s.d >= wk0 && s.d <= tk) { wm += s.m; wp += s.p; } });
  const gp = Math.min(100, Math.round(wp / wg * 100));
  const active = books.filter(b => !b.done), done = books.filter(b => b.done);
  const subj = SUBJ.map(n => {
    const ss = sess.filter(s => s.s === n), m = ss.reduce((a, s) => a + s.m, 0), last = ss.length ? ss.map(s => s.d).sort().pop() : null;
    const target = tg[n] || 30, pc = Math.min(100, Math.round(m / (target * 60) * 100));
    return '<div class="bk"><div class="sec-row"><div class="blk-sub">' + n + '</div><div class="pill">' + pc + '%</div></div><div class="bar"><i style="width:' + pc + '%;background:#a78bfa"></i></div>' +
      '<div class="blk-s">' + hm(m) + ' of ' + target + 'h target &middot; ' + ss.length + ' sessions' + (last ? ' &middot; last ' + last : '') + '</div>' +
      '<div class="bk-b"><button class="btn sm" data-ls="' + n + '">Log session</button></div></div>';
  }).join('');
  const bl = active.map(b => {
    const pc = Math.round(b.read / b.total * 100);
    return '<div class="bk"><div><div class="blk-sub">' + esc(b.title) + '</div><div class="blk-s">' + esc(b.author || 'Unknown author') + ' &middot; ' + esc(b.cat) + '</div></div>' +
      '<div class="bar"><i style="width:' + pc + '%;background:#a78bfa"></i></div><div class="blk-s">' + b.read + '/' + b.total + ' pages &middot; ' + pc + '%</div>' +
      '<div class="bk-b"><button class="btn sm" data-lb="' + b.id + '">Log</button><button class="btn sm" data-fb="' + b.id + '">Finish</button><button class="btn sm" data-xb="' + b.id + '">Delete</button></div></div>';
  }).join('');
  const cl = done.map(b => '<div class="hist"><div>' + esc(b.title) + '<span>' + esc(b.author || 'Unknown author') + (b.doneDate ? ' &middot; finished ' + b.doneDate : '') + '</span></div><button data-rb="' + b.id + '" title="Reopen">&#8635;</button></div>').join('');
  const hs = sess.slice().reverse().sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)).slice(0, 10).map(s =>
    '<div class="hist"><div>' + esc(s.t || s.s || 'Reading') + '<span>' + s.d + ' &middot; ' + s.m + ' min' + (s.p ? ' &middot; ' + s.p + ' pages' : '') + '</span></div><button data-ds="' + s.id + '" aria-label="Delete session">&times;</button></div>').join('');
  box.innerHTML =
    '<section class="card"><div class="sec-h">Reading stats</div><div class="stats" style="margin-top:10px"><div><b>' + hm(tm) + '</b><span>Today</span></div><div><b>' + hm(wm) +
      '</b><span>This week</span></div><div><b>' + hm(tot) + '</b><span>All time</span></div></div>' +
      '<div class="note" style="margin-top:10px">Pages: ' + tp + ' today, ' + wp + ' this week.</div>' +
      '<div class="goal-row"><div class="note">Weekly goal: ' + wp + '/' + wg + ' pages</div><div class="goal-pct">' + gp + '%</div></div><div class="bar"><i style="width:' + gp + '%"></i></div>' +
      '<button class="btn sm wide" data-act="goal" style="margin-top:12px">Set weekly page goal</button></section>' +
    '<section class="card"><div class="sec-h">JAMB subjects</div><div class="bks">' + subj + '</div>' +
      '<button class="btn sm wide" data-act="targets" style="margin-top:12px">Set target hours</button></section>' +
    '<section class="card"><div class="sec-row"><div class="sec-h">Books</div><button class="btn primary sm" data-act="add">Add book</button></div>' +
      '<div class="bks">' + (bl || '<div class="note">No books yet. Tap Add book to start your shelf.</div>') + '</div></section>' +
    '<section class="card"><div class="sec-h">Completed books (' + done.length + ')</div><div class="bks">' + (cl || '<div class="note">Finished books will collect here.</div>') + '</div></section>' +
    '<section class="card"><div class="sec-h">Reading history</div><div class="bks">' + (hs || '<div class="note">No sessions logged yet.</div>') + '</div></section>';
}
box.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  const D = t.dataset, bk = id => books.find(b => b.id === id);
  if (D.act === 'add') addBook();
  else if (D.act === 'goal') modal('Weekly page goal', [{ id: 'g', l: 'Pages per week', t: 'number', v: wg }], 'Save', v => { const n = num(v.g, 0, 5000); if (n < 1) return 'Enter a number above 0.'; store.set('ul_weekgoal', n); });
  else if (D.act === 'targets') modal('Target hours per subject', SUBJ.map(n => ({ id: n, l: n, t: 'number', v: tg[n] || 30 })), 'Save', v => {
    const o = {}; SUBJ.forEach(n => { const h = num(v[n], 0, 1000); o[n] = h < 1 ? 30 : h; }); store.set('ul_subtarget', o);
  });
  else if (D.ls) logSession(null, D.ls);
  else if (D.lb && bk(D.lb)) logSession(bk(D.lb), null);
  else if (D.fb && bk(D.fb)) { const b = bk(D.fb); b.done = true; b.read = b.total; b.doneDate = dkey(today0()); save(); render(); }
  else if (D.xb && bk(D.xb)) { if (confirm('Delete "' + bk(D.xb).title + '"? Its logged sessions stay in history.')) { books = books.filter(b => b.id !== D.xb); save(); render(); } }
  else if (D.rb && bk(D.rb)) { const b = bk(D.rb); b.done = false; if (b.read >= b.total) b.read = Math.max(0, b.total - 1); save(); render(); }
  else if (D.ds) {
    const s = sess.find(x => x.id === D.ds); if (!s) return;
    if (!confirm('Delete this session?')) return;
    const b = s.b && bk(s.b);
    if (b && s.p) { b.read = Math.max(0, b.read - s.p); if (b.done && b.read < b.total) b.done = false; }
    sess = sess.filter(x => x.id !== D.ds); save(); render();
  }
});
$('.nav').addEventListener('click', e => { const b = e.target.closest('.nav-btn'); if (b && b.dataset.t === 'read') setTimeout(render, 0); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !pane.hidden) render(); });
render();
})();
