'use strict';

const APP_NAME = 'BitSync';
const APP_VERSION = '1.0.0';
const SUPPORTED_FORMAT = 1;
// Drill engines this build can run. Network Administration will add 'subnetting', 'vlsm', 'cli'.
const SUPPORTED_DRILLS = [];

/* ================= helpers ================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (ts) => Math.floor((Date.now() - ts) / 86400000);
const enc = encodeURIComponent;

const prefs = {
  get(key, fallback) {
    try { const v = localStorage.getItem('rv-' + key); return v === null ? fallback : v; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('rv-' + key, value); } catch { /* storage blocked: keep defaults */ }
  },
};

const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICON = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  chev: svg('<path d="m9 6 6 6-6 6"/>'),
  list: svg('<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  bookmark: svg('<path d="M6 3h12v18l-6-4-6 4z"/>'),
  importIcon: svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 15v5h16v-5"/>'),
  share: svg('<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 14v6h16v-6"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  book: svg('<path d="M3 5.5c3-1.2 6-1.2 9 .8 3-2 6-2 9-.8v13.5c-3-1.2-6-1.2-9 .8-3-2-6-2-9-.8z"/><path d="M12 6.3v14"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  layers: svg('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  sheet: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  pencil: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  bolt: svg('<path d="M13 3 4 14h7l-1 7 9-11h-7z"/>'),
  sync: svg('<path d="M20 11a8 8 0 0 0-14.3-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.5L20 16"/><path d="M20 20v-4h-4"/>'),
  phone: svg('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  shield: svg('<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>'),
};

/* ---- math + inline markup ---- */

function tex(src, display) {
  if (window.katex) {
    try { return window.katex.renderToString(String(src), { displayMode: display, throwOnError: false }); } catch { /* fall through */ }
  }
  return `<code class="tex">${esc(src)}</code>`;
}

// **bold**, *italic*, `code`, $math$, ==mark==, \n, \$ — everything else is escaped.
function inline(src) {
  if (src === null || src === undefined) return '';
  const slots = [];
  const keep = (html) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = String(src)
    .replace(/\\\$/g, () => keep('$'))
    .replace(/`([^`]+)`/g, (_, c) => keep(`<code>${esc(c)}</code>`))
    .replace(/\$([^$]+?)\$/g, (_, t) => keep(tex(t, false)));
  s = esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\s][^*]*?)\*/g, '<em>$1</em>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/\n/g, '<br>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[+i]);
}

const TEX_SYMBOLS = {
  mu: 'μ', int: '∫', pi: 'π', theta: 'θ', lambda: 'λ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ',
  sigma: 'σ', omega: 'ω', sum: 'Σ', cdot: '·', times: '×', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠',
  infty: '∞', sqrt: '√', pm: '±', Rightarrow: '⇒', to: '→', partial: '∂', approx: '≈',
};

// Readable text version of a TeX snippet, for search results.
function texText(src) {
  return String(src)
    .replace(/\\[,;:! ]|\\quad|\\qquad/g, ' ')
    .replace(/\\(?:left|right|big|Big|displaystyle|mathrm|text|operatorname)\b/g, '')
    .replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\([a-zA-Z]+)/g, (_, name) => TEX_SYMBOLS[name] || '')
    .replace(/[{}]/g, '');
}

function plain(src) {
  return String(src ?? '').replace(/\\\$/g, '$').replace(/\*\*|==|`/g, '').replace(/\*([^*\s][^*]*?)\*/g, '$1')
    .replace(/\$([^$]+?)\$/g, (_, t) => texText(t)).replace(/\s+/g, ' ').trim();
}

/* ================= storage ================= */

const DB = (() => {
  let opening;
  function open() {
    if (!opening) {
      opening = new Promise((resolve, reject) => {
        const req = indexedDB.open('bitsync', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('packs', { keyPath: 'id' });
          req.result.createObjectStore('kv');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return opening;
  }
  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  return {
    all: (store) => run(store, 'readonly', (s) => s.getAll()),
    get: (store, key) => run(store, 'readonly', (s) => s.get(key)),
    put: (store, value, key) => run(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key))),
    del: (store, key) => run(store, 'readwrite', (s) => s.delete(key)),
  };
})();

const state = {
  packs: new Map(),   // id -> pack
  progress: {},       // packId -> { read: { 'docId/sectionId': ts }, pos: { docId: sectionId } }
  bookmarks: [],      // { packId, docId, sectionId, at }
  last: null,         // { packId, docId, sectionId, at }
  lastBackup: 0,
};

async function loadState() {
  for (const rec of await DB.all('packs')) state.packs.set(rec.id, rec.pack);
  state.progress = (await DB.get('kv', 'progress')) || {};
  state.bookmarks = (await DB.get('kv', 'bookmarks')) || [];
  state.last = (await DB.get('kv', 'last')) || null;
  state.lastBackup = (await DB.get('kv', 'lastBackup')) || 0;
}

const dirty = new Set();
let flushTimer;
function saveSoon(key) {
  dirty.add(key);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 500);
}
function flush() {
  clearTimeout(flushTimer);
  for (const key of dirty) DB.put('kv', state[key], key).catch(() => {});
  dirty.clear();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
window.addEventListener('pagehide', flush);

/* ================= pack model ================= */

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const EXTRA_KINDS = ['reference', 'practice', 'drill'];

function validatePack(p) {
  const e = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['This file is not a course pack.'];
  if (p.format !== 'reviewer-pack') e.push('"format" must be "reviewer-pack".');
  if (typeof p.formatVersion !== 'number') e.push('"formatVersion" is missing.');
  else if (p.formatVersion > SUPPORTED_FORMAT) {
    return [`This pack needs a newer version of ${APP_NAME}. Open the app while online so it can update, then import again.`];
  }
  if (!ID_RE.test(p.id || '')) e.push('"id" must use lowercase letters, numbers and dashes.');
  if (!Number.isInteger(p.version) || p.version < 1) e.push('"version" must be a whole number of 1 or more.');
  if (!p.course || typeof p.course.title !== 'string' || !p.course.title.trim()) e.push('"course.title" is missing.');
  if (!Array.isArray(p.lessons) || !p.lessons.length) e.push('"lessons" must be a non-empty list.');
  if (p.extras !== undefined && !Array.isArray(p.extras)) e.push('"extras" must be a list.');
  if (e.length) return e;

  const docIds = new Set();
  const checkDoc = (d, where) => {
    if (!d || !ID_RE.test(d.id || '')) { e.push(`${where}: "id" is missing or invalid.`); return; }
    if (docIds.has(d.id)) e.push(`${where}: id "${d.id}" is used twice.`);
    docIds.add(d.id);
    if (typeof d.title !== 'string') e.push(`${where} (${d.id}): "title" is missing.`);
    if (d.kind === 'drill') return;
    if (!Array.isArray(d.sections) || !d.sections.length) { e.push(`${where} (${d.id}): "sections" must be a non-empty list.`); return; }
    const secIds = new Set();
    d.sections.forEach((s, i) => {
      const w = `${where} (${d.id}), section ${i + 1}`;
      if (!s || !ID_RE.test(s.id || '')) e.push(`${w}: "id" is missing or invalid.`);
      else if (secIds.has(s.id)) e.push(`${w}: id "${s.id}" is used twice.`);
      else secIds.add(s.id);
      if (!s || typeof s.title !== 'string') e.push(`${w}: "title" is missing.`);
      if (!s || !Array.isArray(s.blocks)) e.push(`${w}: "blocks" must be a list.`);
      else s.blocks.forEach((b, j) => { if (!b || typeof b.type !== 'string') e.push(`${w}, block ${j + 1}: "type" is missing.`); });
    });
  };
  p.lessons.forEach((d, i) => checkDoc(d, `Lesson ${i + 1}`));
  (p.extras || []).forEach((d, i) => {
    if (!d || !EXTRA_KINDS.includes(d.kind)) e.push(`Extra ${i + 1}: "kind" must be reference, practice or drill.`);
    checkDoc(d, `Extra ${i + 1}`);
  });
  return e.slice(0, 8);
}

const sortedPacks = () => [...state.packs.values()].sort((a, b) => a.course.title.localeCompare(b.course.title));
const courseColor = (p) => (/^#[0-9a-f]{3,8}$/i.test((p.course && p.course.color) || '') ? p.course.color : '#d85a30');
const courseIcon = (p) => esc(String(p.course.icon || p.course.short || p.course.title).slice(0, 2));
const courseShort = (p) => p.course.short || p.course.title;

// Lessons then extras, in pack order. `n` is the 1-based position among lessons.
function docList(p) {
  return [
    ...p.lessons.map((doc, i) => ({ doc, kind: 'lesson', n: i + 1 })),
    ...(p.extras || []).map((doc, i) => ({ doc, kind: 'extra', n: i + 1 })),
  ];
}
const readableDocs = (p) => docList(p).filter((x) => x.doc.kind !== 'drill');
const findDoc = (p, id) => docList(p).find((x) => x.doc.id === id);

function docEyebrow(entry) {
  if (entry.kind === 'lesson') return `Lesson ${entry.doc.number ?? entry.n}`;
  return { reference: 'Reference', practice: 'Practice', drill: 'Drill' }[entry.doc.kind] || 'Extra';
}

function prog(packId) {
  if (!state.progress[packId]) state.progress[packId] = { read: {}, pos: {} };
  return state.progress[packId];
}
const isRead = (packId, docId, secId) => !!(state.progress[packId] && state.progress[packId].read[`${docId}/${secId}`]);

function docStats(packId, doc) {
  const secs = doc.sections || [];
  const read = secs.filter((s) => isRead(packId, doc.id, s.id)).length;
  return { read, total: secs.length, done: secs.length > 0 && read === secs.length };
}
function courseStats(p) {
  let read = 0, total = 0;
  for (const l of p.lessons) { const s = docStats(p.id, l); read += s.read; total += s.total; }
  return { read, total, pct: total ? Math.round((read / total) * 100) : 0 };
}
// Where a course's "Continue" button leads: the first unfinished lesson, at its saved section.
function nextUp(p) {
  for (const l of p.lessons) {
    if (!docStats(p.id, l).done) return { doc: l, sec: (state.progress[p.id] && state.progress[p.id].pos[l.id]) || '' };
  }
  return null;
}

/* ================= block rendering ================= */

const CALLOUTS = { plain: 'In plain words', easier: 'Easier way', warning: 'Watch out', key: 'Key idea', note: 'Note', summary: 'Summary' };

function renderBlocks(blocks, nested) {
  return (blocks || []).map((b) => renderBlock(b, nested)).join('');
}

function renderBlock(b, nested) {
  if (!b || typeof b !== 'object') return '';
  switch (b.type) {
    case 'text':
      return `<p>${inline(b.text)}</p>`;
    case 'heading':
      return `<h3 class="sub">${inline(b.text)}</h3>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag} class="blist">${(b.items || []).map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`;
    }
    case 'math':
      return `<div class="math-block">${b.label ? `<div class="math-label">${inline(b.label)}</div>` : ''}<div class="math-scroll">${tex(b.tex || '', true)}</div></div>`;
    case 'term':
      return `<dl class="term"><dt>${inline(b.term)}</dt><dd>${inline(b.def)}</dd></dl>`;
    case 'callout': {
      const kind = CALLOUTS[b.kind] ? b.kind : 'note';
      const body = (b.text ? `<p class="co-text">${inline(b.text)}</p>` : '') + (nested ? '' : renderBlocks(b.blocks, true));
      return `<aside class="callout k-${kind}"><div class="co-title">${inline(b.title || CALLOUTS[kind])}</div>${body}</aside>`;
    }
    case 'example':
    case 'problem':
      return renderExample(b, b.type === 'problem');
    case 'table': {
      const head = (b.headers || []).map((h) => `<th>${inline(h)}</th>`).join('');
      const rows = (b.rows || []).map((r) => `<tr>${(Array.isArray(r) ? r : [r]).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
      return `<div class="table-wrap">${b.caption ? `<div class="tcap">${inline(b.caption)}</div>` : ''}<table>${head ? `<thead><tr>${head}</tr></thead>` : ''}<tbody>${rows}</tbody></table></div>`;
    }
    case 'code':
      return `<figure class="code">${b.caption ? `<figcaption>${inline(b.caption)}</figcaption>` : ''}<pre><code>${esc(b.code)}</code></pre></figure>`;
    case 'image': {
      const ok = typeof b.src === 'string' && /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(b.src);
      const img = ok ? `<img src="${esc(b.src)}" alt="${esc(b.alt || '')}" loading="lazy">` : `<div class="img-missing">Image unavailable</div>`;
      return `<figure class="img">${img}${b.caption ? `<figcaption>${inline(b.caption)}</figcaption>` : ''}</figure>`;
    }
    case 'quote':
      return `<blockquote><p>${inline(b.text)}</p>${b.by ? `<cite>— ${inline(b.by)}</cite>` : ''}</blockquote>`;
    case 'divider':
      return '<hr>';
    default:
      return `<div class="unsupported">This part uses a newer feature. Open ${APP_NAME} while online to update it.</div>`;
  }
}

function renderExample(b, isProblem) {
  const steps = Array.isArray(b.steps) ? b.steps : [];
  const showAll = !isProblem && prefs.get('steps', 'one') === 'all';
  const shown = showAll ? steps.length : 0;
  const title = b.title || (isProblem ? 'Problem' : 'Example');

  let h = `<div class="ex${isProblem ? ' is-problem' : ''}" data-shown="${shown}">
    <div class="ex-head"><span class="ex-tag">${isProblem ? 'Try it' : 'Example'}</span><span class="ex-title">${inline(title)}</span></div>
    <div class="ex-problem">${inline(b.problem)}</div>`;
  if (isProblem && b.hint) h += `<div class="ex-hint" hidden><strong>Hint:</strong> ${inline(b.hint)}</div>`;
  h += `<ol class="ex-steps">${steps.map((s, i) => `
    <li class="ex-step"${i < shown ? '' : ' hidden'}>
      <div class="step-n">${i + 1}</div>
      <div class="step-body">
        <div class="step-do">${inline(s && s.do)}</div>
        ${s && s.math ? `<div class="math-scroll">${tex(s.math, true)}</div>` : ''}
        ${s && s.why ? `<div class="step-why"><span class="why-label">Why</span>${inline(s.why)}</div>` : ''}
      </div>
    </li>`).join('')}</ol>`;
  const answerVisible = showAll || (!steps.length && !isProblem);
  if (b.answer) h += `<div class="ex-answer"${answerVisible ? '' : ' hidden'}><span class="ans-label">Answer</span>${inline(b.answer)}</div>`;

  if (!answerVisible || (steps.length && shown < steps.length)) {
    const btns = [];
    if (steps.length) {
      btns.push(`<button class="btn primary" data-act="step-next">${isProblem ? 'Solve step by step' : 'Show step 1'}</button>`);
      btns.push(`<button class="btn" data-act="step-all">${isProblem ? 'Full solution' : 'Show all steps'}</button>`);
    } else if (b.answer) {
      btns.push(`<button class="btn primary" data-act="step-all">Show answer</button>`);
    }
    if (isProblem && b.hint) btns.push(`<button class="btn ghost" data-act="hint">Hint</button>`);
    if (btns.length) h += `<div class="ex-ctrls">${btns.join('')}</div>`;
  }
  return h + '</div>';
}

function revealSteps(ex, count) {
  const steps = $$('.ex-step', ex);
  const shown = +ex.dataset.shown || 0;
  const target = Math.min(steps.length, shown + count);
  for (let i = shown; i < target; i++) { steps[i].hidden = false; steps[i].classList.add('reveal'); }
  ex.dataset.shown = target;
  if (target >= steps.length) {
    const ans = $('.ex-answer', ex);
    if (ans) { ans.hidden = false; ans.classList.add('reveal'); }
    const ctrls = $('.ex-ctrls', ex);
    if (ctrls) ctrls.remove();
  } else {
    const next = $('[data-act="step-next"]', ex);
    if (next) next.textContent = `Next step (${target + 1} of ${steps.length})`;
  }
  if (count === 1 && steps[target - 1]) steps[target - 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ================= search ================= */

let searchIndex = [];
let lastQuery = '';

function blockText(b) {
  if (!b || typeof b !== 'object') return '';
  const asTex = (t) => (t ? texText(t) : '');
  const parts = [b.text, b.term, b.def, b.title, b.problem, b.hint, b.answer, b.caption, b.label, asTex(b.tex), b.code, b.by, b.alt];
  if (Array.isArray(b.items)) parts.push(...b.items);
  if (Array.isArray(b.headers)) parts.push(...b.headers);
  if (Array.isArray(b.rows)) b.rows.forEach((r) => Array.isArray(r) && parts.push(...r));
  if (Array.isArray(b.steps)) b.steps.forEach((s) => s && parts.push(s.do, asTex(s.math), s.why));
  if (Array.isArray(b.blocks)) b.blocks.forEach((x) => parts.push(blockText(x)));
  return parts.filter((x) => x !== undefined && x !== null && x !== '').map(plain).join(' ');
}

function buildIndex() {
  searchIndex = [];
  for (const p of state.packs.values()) {
    for (const { doc } of readableDocs(p)) {
      for (const s of doc.sections || []) {
        const text = `${plain(s.title)} — ${(s.blocks || []).map(blockText).join(' ')}`;
        searchIndex.push({ p, doc, sec: s, text, lower: text.toLowerCase() });
      }
    }
  }
}

function runSearch(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return { words, hits: [] };
  const hits = searchIndex
    .filter((e) => words.every((w) => e.lower.includes(w)))
    .map((e) => ({ e, title: words.every((w) => e.sec.title.toLowerCase().includes(w)) }))
    .sort((a, b) => b.title - a.title)
    .slice(0, 60)
    .map((x) => x.e);
  return { words, hits };
}

function snippet(entry, words) {
  const at = Math.max(0, entry.lower.indexOf(words[0]));
  const start = Math.max(0, at - 50);
  let s = esc((start ? '…' : '') + entry.text.slice(start, at + 120) + (at + 120 < entry.text.length ? '…' : ''));
  for (const w of words) {
    s = s.replace(new RegExp(esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
  }
  return s;
}

/* ================= sheets + toasts ================= */

let sheetOnClose = null;
function openSheet(html, onClose) {
  closeSheet();
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`;
  root.classList.add('open');
  sheetOnClose = onClose || null;
  return $('.sheet', root);
}
function closeSheet() {
  const root = $('#sheet-root');
  if (!root.classList.contains('open')) return;
  root.classList.remove('open');
  root.innerHTML = '';
  const cb = sheetOnClose;
  sheetOnClose = null;
  if (cb) cb();
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

let confirmResolve = null;
function confirmSheet(title, message, okLabel, danger) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    openSheet(`<h2>${esc(title)}</h2><p>${esc(message)}</p>
      <div class="actions">
        <button class="btn block ${danger ? 'danger' : 'primary'}" data-act="confirm" data-v="1">${esc(okLabel)}</button>
        <button class="btn block ghost" data-act="confirm" data-v="0">Cancel</button>
      </div>`, () => { if (confirmResolve) { confirmResolve(false); confirmResolve = null; } });
  });
}

let toastTimer, toastAction;
function toast(message, action, ms = 3200) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(message)}</span>${action ? `<button data-act="toast-action">${esc(action.label)}</button>` : ''}`;
  toastAction = action ? action.fn : null;
  t.classList.add('show');
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ================= views ================= */

const view = $('#view');
let cleanupView = null;
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (currentRoute()[0] === '') render(); });

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function currentRoute() {
  return location.hash.replace(/^#\/?/, '').split('/').map((x) => decodeURIComponent(x));
}

function render() {
  if (cleanupView) { cleanupView(); cleanupView = null; }
  closeSheet();
  const [name, a, b, c] = currentRoute();
  let tab = 'home';
  let html;
  let after = null;
  document.body.dataset.view = name || 'home';
  if (name === 'c' && state.packs.has(a)) {
    html = viewCourse(state.packs.get(a));
  } else if (name === 'r' && state.packs.has(a) && findDoc(state.packs.get(a), b)) {
    document.body.dataset.view = 'reader';
    html = viewReader(state.packs.get(a), findDoc(state.packs.get(a), b));
    after = () => startReader(state.packs.get(a), b, c);
  } else if (name === 'search') {
    tab = 'search';
    html = viewSearch();
    after = startSearch;
  } else if (name === 'saved') {
    tab = 'saved';
    html = viewSaved();
  } else if (name === 'settings') {
    tab = 'settings';
    html = viewSettings();
  } else {
    document.body.dataset.view = 'home';
    html = viewHome();
  }
  view.innerHTML = html;
  $$('#tabs a').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  if (name !== 'r') window.scrollTo(0, 0);
  if (after) after();
}
window.addEventListener('hashchange', render);

/* ---- home ---- */

function viewHome() {
  const packs = sortedPacks();
  let h = `<header class="appbar"><div class="appbar-title"><h1>${APP_NAME}</h1></div>
    <button class="icon-btn" data-act="import" aria-label="Import a course">${ICON.plus}</button></header><div class="page">`;

  if (!isStandalone() && location.protocol.startsWith('http') && prefs.get('install-dismissed', '') !== '1') {
    const how = installPrompt
      ? `<button class="btn primary" data-act="install">Install app</button>`
      : `<p style="margin:0 0 10px">${isIOS() ? 'In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.' : 'In Chrome, open the <b>⋮</b> menu, then tap <b>Add to Home screen</b>.'}</p>`;
    h += `<div class="card banner">${ICON.phone}<div style="flex:1"><strong>Keep ${APP_NAME} on your home screen</strong>
      <p>It opens like an app and works with no internet.${isIOS() ? ' On iPhone this also keeps your courses from being cleared.' : ''}</p>
      <div class="row">${how}<button class="btn ghost" data-act="dismiss-install">Not now</button></div></div></div>`;
  }

  // Nudge a backup once there's progress worth losing: 3+ days of reading, then every 2 weeks.
  const readTimes = Object.values(state.progress).flatMap((p) => Object.values((p && p.read) || {}));
  const readingDays = readTimes.length ? daysSince(Math.min(...readTimes)) : 0;
  const snoozed = +prefs.get('backup-snooze', '0');
  if (readingDays >= 3 && (!state.lastBackup || daysSince(state.lastBackup) >= 14) && Date.now() > snoozed) {
    h += `<div class="card banner">${ICON.shield}<div style="flex:1"><strong>Back up your progress</strong>
      <p>${state.lastBackup ? `Last backup was ${daysSince(state.lastBackup)} days ago.` : 'You haven’t made a backup yet.'} Clearing browser data would erase your reading progress.</p>
      <div class="row"><button class="btn primary" data-act="backup">Back up now</button><button class="btn ghost" data-act="snooze-backup">Later</button></div></div></div>`;
  }

  const last = state.last && state.packs.get(state.last.packId);
  const lastDoc = last && findDoc(last, state.last.docId);
  if (lastDoc) {
    const sec = (lastDoc.doc.sections || []).find((s) => s.id === state.last.sectionId);
    h += `<a class="card continue" style="--c:${courseColor(last)}" href="#/r/${enc(last.id)}/${enc(lastDoc.doc.id)}/${enc(state.last.sectionId || '')}">
      <div class="eyebrow">Continue reading · ${esc(courseShort(last))}</div>
      <div class="ct">${inline(lastDoc.doc.title)}</div>
      ${sec ? `<div class="cs">${inline(sec.title)}</div>` : ''}</a>`;
  }

  if (!packs.length) {
    h += `<div class="empty"><div class="big">${ICON.book}</div><h2>No courses yet</h2>
      <p>Import a course pack (a <b>.json</b> file) — the one you made, or one a classmate sent you.</p>
      <div class="row"><button class="btn primary" data-act="import">${ICON.importIcon} Import a course</button>
      <button class="btn ghost" data-act="load-sample">Try the sample course</button></div></div>`;
  } else {
    h += `<h2 class="list-label">Your courses</h2><div class="course-list">`;
    for (const p of packs) {
      const st = courseStats(p);
      h += `<a class="card course-card" style="--c:${courseColor(p)}" href="#/c/${enc(p.id)}">
        <span class="badge">${courseIcon(p)}</span>
        <span class="cc-body"><span class="cc-title">${esc(p.course.title)}</span>
          <span class="cc-meta">${p.course.code ? esc(p.course.code) + ' · ' : ''}${p.lessons.length} lesson${p.lessons.length === 1 ? '' : 's'}</span>
          <span class="bar"><i style="width:${st.pct}%"></i></span></span>
        <span class="cc-pct">${st.pct}%</span></a>`;
    }
    h += `</div>`;
  }
  return h + `</div>`;
}

/* ---- course ---- */

function viewCourse(p) {
  const st = courseStats(p);
  const up = nextUp(p);
  const started = st.read > 0;
  const go = up || { doc: p.lessons[0], sec: '' };
  const goLabel = !started ? 'Start first lesson' : up ? 'Continue' : 'Read again from the start';

  let h = `<div style="--c:${courseColor(p)}">
    <header class="appbar with-back"><a class="icon-btn" href="#/" aria-label="Back">${ICON.back}</a>
      <div class="appbar-title"><span class="t">${esc(courseShort(p))}</span></div></header>
    <section class="hero">
      <div class="hero-top"><span class="badge">${courseIcon(p)}</span>
        <div><h1>${esc(p.course.title)}</h1>${p.course.code ? `<div class="code">${esc(p.course.code)}</div>` : ''}</div></div>
      ${p.course.description ? `<p class="desc">${inline(p.course.description)}</p>` : ''}
      <div class="progress-line"><span class="bar"><i style="width:${st.pct}%"></i></span>${st.pct}% read</div>
      <a class="btn primary block" href="#/r/${enc(p.id)}/${enc(go.doc.id)}/${enc(up ? go.sec : '')}">${goLabel}${up && started ? ` · ${esc(docEyebrow(findDoc(p, go.doc.id)))}` : ''}</a>
    </section>
    <div class="page"><h2 class="list-label">Lessons</h2><ol class="lesson-list">`;

  p.lessons.forEach((l, i) => {
    const ds = docStats(p.id, l);
    const meta = [l.minutes ? `${l.minutes} min` : '', ds.read ? `${ds.read}/${ds.total} read` : `${ds.total} parts`].filter(Boolean).join(' · ');
    h += `<li><a class="card lesson-row" href="#/r/${enc(p.id)}/${enc(l.id)}">
      <span class="num${ds.done ? ' done' : ''}">${ds.done ? ICON.check : esc(l.number ?? i + 1)}</span>
      <span class="lr-body"><span class="lr-title">${inline(l.title)}</span>
        ${l.summary ? `<span class="lr-sum">${inline(l.summary)}</span>` : ''}
        <span class="lr-meta">${meta}</span></span>${ICON.chev}</a></li>`;
  });
  h += `</ol>`;

  const extras = p.extras || [];
  if (extras.length) {
    h += `<h2 class="list-label">Also in this course</h2><div class="lesson-list">`;
    for (const x of extras) {
      const icon = { reference: ICON.sheet, practice: ICON.pencil, drill: ICON.bolt }[x.kind] || ICON.layers;
      const runnable = x.kind !== 'drill' || SUPPORTED_DRILLS.includes(x.drill);
      const inner = `<span class="xi">${icon}</span><span class="lr-body"><span class="lr-title">${inline(x.title)}</span>
        ${x.description ? `<span class="lr-sum">${inline(x.description)}</span>` : ''}
        ${runnable ? '' : `<span class="lr-meta"><span class="pill">Needs an app update</span></span>`}</span>`;
      h += runnable && x.kind !== 'drill'
        ? `<a class="card lesson-row extra-card" href="#/r/${enc(p.id)}/${enc(x.id)}">${inner}${ICON.chev}</a>`
        : `<div class="card lesson-row extra-card${runnable ? '' : ' disabled'}">${inner}</div>`;
    }
    h += `</div>`;
  }
  return h + `<p class="fine">Version ${p.version}${p.updated ? ` · updated ${esc(p.updated)}` : ''}</p></div></div>`;
}

/* ---- reader ---- */

function viewReader(p, entry) {
  const doc = entry.doc;
  const pid = p.id;
  const docs = readableDocs(p);
  const idx = docs.findIndex((x) => x.doc.id === doc.id);
  const prev = docs[idx - 1];
  const next = docs[idx + 1];
  const st = docStats(pid, doc);
  const bm = new Set(state.bookmarks.filter((x) => x.packId === pid && x.docId === doc.id).map((x) => x.sectionId));

  let h = `<div style="--c:${courseColor(p)}">
    <header class="appbar with-back reader-bar"><a class="icon-btn" href="#/c/${enc(pid)}" aria-label="Back to course">${ICON.back}</a>
      <div class="appbar-title"><span class="eyebrow">${esc(courseShort(p))} · ${esc(docEyebrow(entry))}</span><span class="t">${esc(plain(doc.title))}</span></div>
      <button class="icon-btn" data-act="textsize" aria-label="Text size"><span class="aa">Aa</span></button>
      <button class="icon-btn" data-act="toc" aria-label="Contents">${ICON.list}</button>
      <div class="read-progress"><i></i></div></header>
    <article class="reader">
      <div class="doc-head"><div class="eyebrow">${esc(docEyebrow(entry))}</div><h1>${inline(doc.title)}</h1>
        ${doc.summary || doc.description ? `<p class="summary">${inline(doc.summary || doc.description)}</p>` : ''}
        <div class="meta">${doc.minutes ? `<span>${ICON.clock}${esc(doc.minutes)} min</span>` : ''}<span>${ICON.layers}${st.total} parts</span>
          ${Array.isArray(doc.sources) && doc.sources.length ? `<span>${ICON.book}${doc.sources.map(esc).join(', ')}</span>` : ''}</div></div>`;

  for (const s of doc.sections) {
    h += `<section class="sec${isRead(pid, doc.id, s.id) ? ' is-read' : ''}" id="sec-${esc(s.id)}" data-sec="${esc(s.id)}">
      <div class="sec-head"><span class="read-dot" title="Read"></span><h2>${inline(s.title)}</h2>
        <button class="bm${bm.has(s.id) ? ' on' : ''}" data-act="bookmark" data-sec="${esc(s.id)}" aria-label="Save this part" aria-pressed="${bm.has(s.id)}">${ICON.bookmark}</button></div>
      ${renderBlocks(s.blocks)}
      <div class="sec-end" data-sec-end="${esc(s.id)}"></div></section>`;
  }

  h += `<footer class="doc-end"><div class="done-mark">${ICON.check}</div>
      <h2>End of ${entry.kind === 'lesson' ? 'lesson' : esc(plain(doc.title))}</h2>
      <p>${next ? 'Up next is below.' : 'That’s everything in this course for now.'}</p>
      <nav class="doc-nav">
        ${prev ? `<a class="card prev" href="#/r/${enc(pid)}/${enc(prev.doc.id)}"><small>Previous · ${esc(docEyebrow(prev))}</small><span class="dn-title">${inline(prev.doc.title)}</span></a>` : ''}
        ${next ? `<a class="card next" href="#/r/${enc(pid)}/${enc(next.doc.id)}"><small>Next · ${esc(docEyebrow(next))}</small><span class="dn-title">${inline(next.doc.title)}</span></a>`
               : `<a class="card next" href="#/c/${enc(pid)}"><small>Finished</small><span class="dn-title">Back to course</span></a>`}
      </nav></footer></article></div>`;
  return h;
}

let reader = null;

function startReader(p, docId, secId) {
  const entry = findDoc(p, docId);
  const doc = entry.doc;
  const secs = $$('.sec', view);
  const bar = $('.read-progress i', view);
  reader = { p, doc, cur: null };

  const saved = state.progress[p.id] && state.progress[p.id].pos[doc.id];
  const target = secId || (!docStats(p.id, doc).done && saved) || '';
  if (target && document.getElementById('sec-' + target)) {
    requestAnimationFrame(() => scrollToSection(target, false));
  } else {
    window.scrollTo(0, 0);
  }

  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 1})`;
      let cur = secs.length ? secs[0].dataset.sec : null;
      for (const s of secs) { if (s.getBoundingClientRect().top < 140) cur = s.dataset.sec; else break; }
      if (cur && cur !== reader.cur) {
        reader.cur = cur;
        prog(p.id).pos[doc.id] = cur;
        state.last = { packId: p.id, docId: doc.id, sectionId: cur, at: Date.now() };
        saveSoon('progress');
        saveSoon('last');
      }
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  setTimeout(onScroll, 60);

  // A section counts as read once its end has scrolled into view. Start watching only after
  // the jump to the saved section, so sections we skip over aren't marked.
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) markRead(p, doc, en.target.dataset.secEnd);
  }, { rootMargin: '-72px 0px -12% 0px' });
  const watch = setTimeout(() => $$('.sec-end', view).forEach((el) => io.observe(el)), 400);

  cleanupView = () => { clearTimeout(watch); window.removeEventListener('scroll', onScroll); io.disconnect(); reader = null; flush(); };
}

function markRead(p, doc, secId) {
  const key = `${doc.id}/${secId}`;
  const pr = prog(p.id);
  if (pr.read[key]) return;
  pr.read[key] = Date.now();
  saveSoon('progress');
  const el = document.getElementById('sec-' + secId);
  if (el) el.classList.add('is-read');
  if (docStats(p.id, doc).done) toast(`${doc.title.length > 40 ? 'Lesson' : plain(doc.title)} — complete`);
}

function scrollToSection(secId, smooth) {
  const el = document.getElementById('sec-' + secId);
  if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}

function openToc() {
  if (!reader) return;
  const { p, doc } = reader;
  const items = doc.sections.map((s) => {
    const read = isRead(p.id, doc.id, s.id);
    return `<a href="#" data-act="goto-sec" data-sec="${esc(s.id)}" class="${s.id === reader.cur ? 'current' : ''}">
      <span class="tick${read ? ' on' : ''}">${read ? ICON.check : ''}</span><span>${inline(s.title)}</span></a>`;
  }).join('');
  const sheet = openSheet(`<h2>Contents</h2><nav class="toc">${items}</nav>`);
  sheet.style.setProperty('--c', courseColor(p));
}

function openTextSize() {
  const scale = parseFloat(prefs.get('fs', '1')) || 1;
  openSheet(`<h2>Reading</h2>
    <div class="set-row" style="padding:12px 0"><span class="sr-body"><span class="sr-title">Text size</span></span>
      <span class="stepper"><button data-act="fs" data-v="-1" aria-label="Smaller">A−</button><output id="fs-out">${Math.round(scale * 100)}%</output><button data-act="fs" data-v="1" aria-label="Larger">A+</button></span></div>
    <div class="set-row stack" style="padding:12px 0"><span class="sr-title">Worked examples</span>
      ${segment('steps', prefs.get('steps', 'one'), [['one', 'One step at a time'], ['all', 'All steps shown']])}</div>`);
}

/* ---- search ---- */

function viewSearch() {
  return `<header class="appbar"><div class="appbar-title"><h1>Search</h1></div></header>
    <div class="page"><label class="search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="Search every lesson" autocomplete="off" enterkeyhint="search" value="${esc(lastQuery)}" aria-label="Search"></label>
      <div id="results"></div></div>`;
}

function startSearch() {
  const input = $('#q');
  const out = $('#results');
  const show = () => {
    lastQuery = input.value;
    if (!state.packs.size) { out.innerHTML = `<p class="muted-center">Import a course first, then search across all its lessons here.</p>`; return; }
    const { words, hits } = runSearch(input.value);
    if (!words.length) { out.innerHTML = `<p class="muted-center">Type a word or formula — e.g. “integrating factor”.</p>`; return; }
    if (!hits.length) { out.innerHTML = `<p class="muted-center">No matches for “${esc(input.value)}”.</p>`; return; }
    out.innerHTML = hits.map((e) => `<a class="card result" style="--c:${courseColor(e.p)}" href="#/r/${enc(e.p.id)}/${enc(e.doc.id)}/${enc(e.sec.id)}">
      <span class="r-where"><span class="dot"></span>${esc(courseShort(e.p))} · ${esc(plain(e.doc.title))}</span>
      <span class="r-title">${inline(e.sec.title)}</span><span class="r-snip">${snippet(e, words)}</span></a>`).join('');
  };
  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(show, 140); });
  show();
  if (!lastQuery) input.focus();
}

/* ---- saved ---- */

function viewSaved() {
  let h = `<header class="appbar"><div class="appbar-title"><h1>Saved</h1></div></header><div class="page">`;
  const items = state.bookmarks
    .map((b) => {
      const p = state.packs.get(b.packId);
      const entry = p && findDoc(p, b.docId);
      const sec = entry && (entry.doc.sections || []).find((s) => s.id === b.sectionId);
      return sec ? { b, p, entry, sec } : null;
    })
    .filter(Boolean)
    .sort((x, y) => y.b.at - x.b.at);
  if (!items.length) {
    return h + `<div class="empty"><div class="big">${ICON.bookmark}</div><h2>Nothing saved yet</h2>
      <p>While reading, tap the bookmark next to any part’s title to keep it here.</p></div></div>`;
  }
  for (const { b, p, entry, sec } of items) {
    h += `<div class="card saved-row" style="--c:${courseColor(p)}">
      <a class="result" href="#/r/${enc(p.id)}/${enc(entry.doc.id)}/${enc(sec.id)}">
        <span class="r-where"><span class="dot"></span>${esc(courseShort(p))} · ${esc(docEyebrow(entry))}</span>
        <span class="r-title">${inline(sec.title)}</span><span class="r-snip">${inline(entry.doc.title)}</span></a>
      <button class="icon-btn" data-act="unsave" data-p="${esc(b.packId)}" data-d="${esc(b.docId)}" data-sec="${esc(b.sectionId)}" aria-label="Remove">${ICON.close}</button></div>`;
  }
  return h + `</div>`;
}

/* ---- settings ---- */

function segment(name, value, options) {
  return `<div class="seg" role="radiogroup">${options.map(([v, label]) =>
    `<button role="radio" aria-checked="${v === value}" class="${v === value ? 'on' : ''}" data-act="pref" data-k="${name}" data-v="${v}">${esc(label)}</button>`).join('')}</div>`;
}

function viewSettings() {
  const packs = sortedPacks();
  const scale = parseFloat(prefs.get('fs', '1')) || 1;
  let h = `<header class="appbar"><div class="appbar-title"><h1>Settings</h1></div></header><div class="page">
    <h2 class="list-label">Appearance</h2><div class="card set-group">
      <div class="set-row stack"><span class="sr-title">Theme</span>${segment('theme', prefs.get('theme', 'system'), [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}</div>
      <div class="set-row"><span class="sr-body"><span class="sr-title">Text size</span><span class="sr-sub">For lessons</span></span>
        <span class="stepper"><button data-act="fs" data-v="-1" aria-label="Smaller">A−</button><output id="fs-out">${Math.round(scale * 100)}%</output><button data-act="fs" data-v="1" aria-label="Larger">A+</button></span></div>
      <div class="set-row stack"><span class="sr-title">Worked examples</span>${segment('steps', prefs.get('steps', 'one'), [['one', 'One step at a time'], ['all', 'All steps shown']])}</div>
    </div>

    <h2 class="list-label">Courses</h2><div class="card set-group">`;
  for (const p of packs) {
    h += `<div class="set-row" style="--c:${courseColor(p)}"><span class="badge" style="width:36px;height:36px;font-size:1rem;border-radius:10px">${courseIcon(p)}</span>
      <span class="sr-body"><span class="sr-title">${esc(p.course.title)}</span><span class="sr-sub">Version ${p.version}${p.updated ? ` · ${esc(p.updated)}` : ''}</span></span>
      <button class="icon-btn" data-act="remove-pack" data-p="${esc(p.id)}" aria-label="Remove ${esc(p.course.title)}">${ICON.trash}</button></div>`;
  }
  h += `<div class="set-row"><button class="btn block" data-act="import">${ICON.importIcon} Import course or backup</button></div></div>

    <h2 class="list-label">Share &amp; back up</h2><div class="card set-group">
      <div class="set-row"><span class="sr-body"><span class="sr-title">Share courses</span><span class="sr-sub">Send course files to classmates. Your progress isn’t included.</span></span>
        <button class="btn" data-act="share-packs"${packs.length ? '' : ' disabled'}>${ICON.share} Share</button></div>
      <div class="set-row"><span class="sr-body"><span class="sr-title">Back up my progress</span><span class="sr-sub">${state.lastBackup ? `Last backup ${daysSince(state.lastBackup) === 0 ? 'today' : daysSince(state.lastBackup) + ' days ago'}` : 'Never backed up'} · courses, progress and saved parts</span></span>
        <button class="btn" data-act="backup">${ICON.shield} Back up</button></div>
      <div class="set-row"><span class="sr-body"><span class="sr-sub">To restore, use <b>Import course or backup</b> and pick your backup file.</span></span></div>
    </div>

    <h2 class="list-label">Storage</h2><div class="card set-group">
      <div class="set-row"><span class="sr-body"><span class="sr-title">Keep my data</span><span class="sr-sub" id="persist-status">Checking…</span></span>
        <button class="btn" data-act="persist">Protect</button></div>
    </div>
    <p class="fine">${APP_NAME} ${APP_VERSION} · pack format ${SUPPORTED_FORMAT}<br>Works offline · nothing leaves your phone unless you share it</p></div>`;
  setTimeout(updatePersistStatus, 0);
  return h;
}

async function updatePersistStatus() {
  const el = $('#persist-status');
  if (!el) return;
  if (!navigator.storage || !navigator.storage.persisted) { el.textContent = 'This browser decides on its own. Add the app to your home screen to be safe.'; return; }
  const yes = await navigator.storage.persisted();
  el.textContent = yes ? 'Protected — the browser won’t clear it automatically.' : 'Not protected yet. The browser may clear it if storage runs low.';
}

/* ================= import / export ================= */

async function importFiles(files) {
  const report = [];
  for (const f of files) {
    let data;
    try { data = JSON.parse(await f.text()); } catch {
      report.push({ name: f.name, status: 'error', msg: 'This isn’t a course file — it could not be read.' });
      continue;
    }
    await importData(data, f.name, report);
  }
  finishImport(report);
}

async function importData(data, name, report) {
  if (data && data.format === 'reviewer-bundle') {
    for (const p of data.packs || []) await importPack(p, report);
  } else if (data && data.format === 'reviewer-backup') {
    const ok = await confirmSheet('Restore this backup?', `It adds the courses in the backup and merges its reading progress and saved parts with what’s on this phone. Backup from ${data.created ? data.created.slice(0, 10) : 'an unknown date'}.`, 'Restore');
    if (!ok) { report.push({ name, status: 'skip', msg: 'Backup not restored.' }); return; }
    for (const p of data.packs || []) await importPack(p, report);
    for (const [pid, pr] of Object.entries(data.progress || {})) {
      const mine = prog(pid);
      Object.assign(mine.read, (pr && pr.read) || {});
      for (const [d, s] of Object.entries((pr && pr.pos) || {})) if (!mine.pos[d]) mine.pos[d] = s;
    }
    const have = new Set(state.bookmarks.map((b) => `${b.packId}/${b.docId}/${b.sectionId}`));
    for (const b of data.bookmarks || []) if (b && !have.has(`${b.packId}/${b.docId}/${b.sectionId}`)) state.bookmarks.push(b);
    if (data.last && (!state.last || data.last.at > state.last.at)) state.last = data.last;
    saveSoon('progress'); saveSoon('bookmarks'); saveSoon('last');
    report.push({ name: 'Progress', status: 'updated', msg: 'Reading progress and saved parts restored.' });
  } else {
    await importPack(data, report, name);
  }
}

async function importPack(p, report, name) {
  const errors = validatePack(p);
  const label = (p && p.course && p.course.title) || name || 'Course';
  if (errors.length) { report.push({ name: label, status: 'error', msg: errors.join(' ') }); return; }
  const cur = state.packs.get(p.id);
  if (cur && cur.version >= p.version) {
    report.push({ name: label, status: 'skip', msg: cur.version === p.version ? `Already up to date (version ${p.version}).` : `You already have a newer version (${cur.version}).` });
    return;
  }
  await DB.put('packs', { id: p.id, pack: p, importedAt: Date.now() });
  state.packs.set(p.id, p);
  report.push({ name: label, status: cur ? 'updated' : 'added', msg: cur ? `Updated from version ${cur.version} to ${p.version}.` : `Added (version ${p.version}).` });
}

function finishImport(report) {
  buildIndex();
  flush();
  if (report.some((r) => r.status === 'added' || r.status === 'updated') && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
  render();
  if (report.length === 1 && (report[0].status === 'added' || report[0].status === 'updated')) {
    toast(`${report[0].name}: ${report[0].msg}`);
    return;
  }
  if (!report.length) return;
  openSheet(`<h2>Import</h2><ul class="report">${report.map((r) => `<li class="st-${r.status}"><b>${esc(r.name)}</b><small>${esc(r.msg)}</small></li>`).join('')}</ul>
    <div class="actions"><button class="btn block primary" data-act="sheet-close">Done</button></div>`);
}

async function deliverFile(obj, filename) {
  const file = new File([JSON.stringify(obj)], filename, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return true; } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`Saved ${filename} to your downloads.`, null, 4500);
  return true;
}

function openShareSheet() {
  const rows = sortedPacks().map((p) => `<label class="check-row"><input type="checkbox" name="share" value="${esc(p.id)}" checked>
    <span class="sr-body"><span class="sr-title">${esc(p.course.title)}</span><span class="sr-sub">Version ${p.version}</span></span></label>`).join('');
  openSheet(`<h2>Share courses</h2><p>Your classmates import this file in ${APP_NAME}. Only the course content is shared — not your progress.</p>
    ${rows}<div class="actions"><button class="btn block primary" data-act="do-share">${ICON.share} Share selected</button></div>`);
}

async function shareSelected() {
  const ids = $$('input[name="share"]:checked').map((i) => i.value);
  if (!ids.length) { toast('Pick at least one course.'); return; }
  closeSheet();
  const packs = ids.map((id) => state.packs.get(id));
  if (packs.length === 1) await deliverFile(packs[0], `${packs[0].id}.json`);
  else await deliverFile({ format: 'reviewer-bundle', formatVersion: 1, created: new Date().toISOString(), packs }, `bitsync-courses-${today()}.json`);
}

async function backup() {
  flush();
  const data = {
    format: 'reviewer-backup', formatVersion: 1, app: APP_VERSION, created: new Date().toISOString(),
    packs: sortedPacks(), progress: state.progress, bookmarks: state.bookmarks, last: state.last,
  };
  if (await deliverFile(data, `bitsync-backup-${today()}.json`)) {
    state.lastBackup = Date.now();
    saveSoon('lastBackup');
    flush();
    if (currentRoute()[0] !== 'r') render();
  }
}

/* ================= actions ================= */

const FS_STEPS = [0.85, 0.92, 1, 1.08, 1.16, 1.25, 1.35, 1.5];

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

const ACTIONS = {
  'sheet-close': closeSheet,
  'import': () => $('#file-input').click(),
  'toast-action': () => { $('#toast').classList.remove('show'); if (toastAction) toastAction(); },
  'confirm': (el) => { const r = confirmResolve; confirmResolve = null; closeSheet(); if (r) r(el.dataset.v === '1'); },
  'step-next': (el) => revealSteps(el.closest('.ex'), 1),
  'step-all': (el) => revealSteps(el.closest('.ex'), Infinity),
  'hint': (el) => { const h = $('.ex-hint', el.closest('.ex')); if (h) { h.hidden = false; h.classList.add('reveal'); el.remove(); } },
  'toc': openToc,
  'textsize': openTextSize,
  'goto-sec': (el) => { closeSheet(); scrollToSection(el.dataset.sec, true); },
  'bookmark': (el) => {
    if (!reader) return;
    const key = { packId: reader.p.id, docId: reader.doc.id, sectionId: el.dataset.sec };
    const i = state.bookmarks.findIndex((b) => b.packId === key.packId && b.docId === key.docId && b.sectionId === key.sectionId);
    if (i >= 0) state.bookmarks.splice(i, 1); else state.bookmarks.push({ ...key, at: Date.now() });
    el.classList.toggle('on', i < 0);
    el.setAttribute('aria-pressed', String(i < 0));
    saveSoon('bookmarks');
    toast(i < 0 ? 'Saved — find it in the Saved tab.' : 'Removed from Saved.');
  },
  'unsave': (el) => {
    state.bookmarks = state.bookmarks.filter((b) => !(b.packId === el.dataset.p && b.docId === el.dataset.d && b.sectionId === el.dataset.sec));
    saveSoon('bookmarks');
    render();
  },
  'fs': (el) => {
    const cur = parseFloat(prefs.get('fs', '1')) || 1;
    let i = FS_STEPS.findIndex((x) => x >= cur - 0.001);
    if (i < 0) i = 2;
    const next = FS_STEPS[Math.max(0, Math.min(FS_STEPS.length - 1, i + +el.dataset.v))];
    prefs.set('fs', String(next));
    document.documentElement.style.setProperty('--fs-scale', String(next));
    const out = $('#fs-out');
    if (out) out.textContent = `${Math.round(next * 100)}%`;
  },
  'pref': (el) => {
    const { k, v } = el.dataset;
    prefs.set(k, v);
    if (k === 'theme') applyTheme(v);
    $$(`[data-act="pref"][data-k="${k}"]`).forEach((b) => { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-checked', String(b.dataset.v === v)); });
    if (k === 'steps' && reader) toast('Applies to examples when you next open a lesson.');
  },
  'share-packs': openShareSheet,
  'do-share': shareSelected,
  'backup': backup,
  'snooze-backup': () => { prefs.set('backup-snooze', String(Date.now() + 3 * 86400000)); render(); },
  'remove-pack': async (el) => {
    const p = state.packs.get(el.dataset.p);
    if (!p) return;
    const ok = await confirmSheet(`Remove ${p.course.title}?`, 'This deletes the course and your reading progress for it from this phone. You can import the course file again later.', 'Remove course', true);
    if (!ok) return;
    await DB.del('packs', p.id);
    state.packs.delete(p.id);
    delete state.progress[p.id];
    state.bookmarks = state.bookmarks.filter((b) => b.packId !== p.id);
    if (state.last && state.last.packId === p.id) state.last = null;
    saveSoon('progress'); saveSoon('bookmarks'); saveSoon('last'); flush();
    buildIndex();
    render();
    toast(`${p.course.title} removed.`);
  },
  'persist': async () => {
    if (!navigator.storage || !navigator.storage.persist) { toast('Add the app to your home screen to keep your data safe.'); return; }
    const ok = await navigator.storage.persist();
    toast(ok ? 'Your data is protected.' : 'The browser said no — adding the app to your home screen usually fixes this.', null, 4500);
    updatePersistStatus();
  },
  'load-sample': async () => {
    try {
      const data = await (await fetch('sample/sample-pack.json')).json();
      const report = [];
      await importData(data, 'sample-pack.json', report);
      finishImport(report);
    } catch { toast('The sample course could not be loaded.'); }
  },
  'install': async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => {});
    installPrompt = null;
    render();
  },
  'dismiss-install': () => { prefs.set('install-dismissed', '1'); render(); },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || !ACTIONS[el.dataset.act]) return;
  ev.preventDefault();
  ACTIONS[el.dataset.act](el, ev);
});

$('#file-input').addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  if (files.length) importFiles(files);
});

/* ================= service worker ================= */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  // Skip on a local dev server unless explicitly enabled, so edits show up immediately.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && prefs.get('sw-dev', '') !== '1') return;
  let updating = false;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          toast(`A new version of ${APP_NAME} is ready.`, { label: 'Update', fn: () => { updating = true; w.postMessage('skip-waiting'); } }, 0);
        }
      });
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
}

/* ================= start ================= */

(async function init() {
  applyTheme(prefs.get('theme', 'system'));
  try {
    await loadState();
  } catch {
    view.innerHTML = `<div class="empty"><div class="big">${ICON.close}</div><h2>Storage is blocked</h2>
      <p>${APP_NAME} needs to store your courses on this device. Turn off private browsing, then open it again.</p></div>`;
    return;
  }
  buildIndex();
  render();
  registerServiceWorker();
})();
