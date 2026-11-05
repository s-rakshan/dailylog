/* Daily Log: monthly project sheets on this phone (localStorage). Keep it simple. */
'use strict';
const APP_NAME = 'Daily Log';
const KEY = 'dailylog.v1', SCHEMA = 1, VERSION = '1.2.4';
const COL_TYPES = [
  { id: 'tick', label: 'Tick', hint: 'Tap cycles blank → ✓ → ✗' },
  { id: 'text', label: 'Text', hint: 'Anything' },
  { id: 'times', label: 'Times', hint: '1:20, 2:30 — digits and : . , ; space' },
  { id: 'number', label: 'Number', hint: 'Digits only (and one decimal)' },
];

const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
function el(tag, a = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in a) {
    const v = a[k]; if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => c != null && c !== false && e.append(c.nodeType ? c : String(c)));
  return e;
}
const ICON = {
  check: '<svg class="tk" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M8.8 19.2 2.6 13l2.5-2.5 3.6 3.6L18.9 3.9 21.4 6.4 8.8 19.2Z"/></svg>',
  cross: '<svg class="tk" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M18.8 21.2 12 14.4 5.2 21.2 2.8 18.8 9.6 12 2.8 5.2 5.2 2.8 12 9.6l6.8-6.8 2.4 2.4L14.4 12l6.8 6.8-2.4 2.4Z"/></svg>',
  lock: '<svg class="lk-ic" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
};

/* ---------------- data ---------------- */
const fresh = () => ({
  v: SCHEMA,
  settings: { catchup: false, vibrate: true, theme: 'peach' },
  projects: [],
  activeId: null,
  // reminder skip markers: { 'projId:YYYY-MM-DD': true, catchup:'YYYY-MM-DD' }
  notified: {},
});
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function normCol(c) {
  if (!c || !c.name) return null;
  const type = ['tick', 'text', 'times', 'number'].includes(c.type) ? c.type : 'text';
  const w = +c.w; return { id: String(c.id || uid()), name: String(c.name).slice(0, 40), type, locked: !!c.locked, w: w >= 48 && w <= 480 ? Math.round(w) : null };
}
function normProject(p) {
  if (!p || !p.name) return null;
  const months = {};
  if (p.months && typeof p.months === 'object') {
    for (const [ym, mo] of Object.entries(p.months)) {
      if (!/^\d{4}-\d{2}$/.test(ym) || !mo) continue;
      const days = {};
      if (mo.days && typeof mo.days === 'object') {
        for (const [d, cells] of Object.entries(mo.days)) {
          const n = +d; if (n < 1 || n > 31 || !cells || typeof cells !== 'object') continue;
          days[n] = { ...cells };
        }
      }
      months[ym] = { note: String(mo.note || ''), days };
    }
  }
  return {
    id: String(p.id || uid()),
    name: String(p.name).slice(0, 60),
    archived: !!p.archived,
    createdAt: +p.createdAt || Date.now(),
    columns: (Array.isArray(p.columns) ? p.columns : []).map(normCol).filter(Boolean),
    months,
    remind: !!p.remind,
    copyAsked: /^\d{4}-\d{2}$/.test(p.copyAsked) ? p.copyAsked : '',
    remindAt: /^\d{2}:\d{2}$/.test(p.remindAt) ? p.remindAt : '09:00',
  };
}
function migrate(d) {
  const f = fresh();
  if (!d || typeof d !== 'object') return f;
  const out = { ...f, ...d, v: SCHEMA, settings: { ...f.settings, ...(d.settings || {}) }, notified: { ...(d.notified || {}) } };
  out.projects = (Array.isArray(d.projects) ? d.projects : []).map(normProject).filter(Boolean);
  if (out.activeId && !out.projects.find(p => p.id === out.activeId && !p.archived)) out.activeId = null;
  if (!out.activeId) {
    const live = out.projects.find(p => !p.archived);
    out.activeId = live ? live.id : null;
  }
  return out;
}
let D; try { D = migrate(JSON.parse(localStorage.getItem(KEY))); } catch { D = fresh(); }
const S = () => D.settings;
applyTheme(S().theme);
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(D)); }
  catch { toast('Could not save. Phone storage may be full.'); }
}
try { navigator.storage?.persist?.(); } catch {}

/* ---------------- dates ---------------- */
const now = () => new Date();
const ymKey = (y, m) => `${y}-${pad(m + 1)}`; // m 0-based
const curYM = () => { const d = now(); return ymKey(d.getFullYear(), d.getMonth()); };
const parseYM = ym => { const [y, m] = ym.split('-').map(Number); return { y, m: m - 1 }; };
const daysIn = ym => { const { y, m } = parseYM(ym); return new Date(y, m + 1, 0).getDate(); };
const monthLabel = ym => { const { y, m } = parseYM(ym); return new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };
const addMonth = (ym, n) => { const { y, m } = parseYM(ym); const d = new Date(y, m + n, 1); return ymKey(d.getFullYear(), d.getMonth()); };
const todayDay = () => now().getDate();
const weekday = (ym, day) => { const { y, m } = parseYM(ym); return new Date(y, m, day).toLocaleDateString('en-IN', { weekday: 'short' }); };
const dateKey = (ym, day) => `${ym}-${pad(day)}`;
const yesterdayInfo = () => {
  const d = now(); d.setDate(d.getDate() - 1);
  return { ym: ymKey(d.getFullYear(), d.getMonth()), day: d.getDate(), label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) };
};

/* ---------------- project helpers ---------------- */
const liveProjects = () => D.projects.filter(p => !p.archived);
const archivedProjects = () => D.projects.filter(p => p.archived);
const active = () => D.projects.find(p => p.id === D.activeId && !p.archived) || null;
function ensureMonth(p, ym) {
  if (!p.months[ym]) p.months[ym] = { note: '', days: {} };
  return p.months[ym];
}
function dayCells(p, ym, day) {
  const mo = ensureMonth(p, ym);
  if (!mo.days[day]) mo.days[day] = {};
  return mo.days[day];
}
function isDayFilled(p, ym, day) {
  const cells = p.months[ym]?.days?.[day];
  if (!cells) return false;
  return p.columns.some(c => {
    if (c.locked) return false; // targets don't count as logging
    const v = cells[c.id];
    return v != null && String(v).trim() !== '';
  });
}
function filledCount(p, ym) {
  let n = 0; const dim = daysIn(ym);
  for (let d = 1; d <= dim; d++) if (isDayFilled(p, ym, d)) n++;
  return n;
}
function slug(s) {
  return String(s || 'log').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'log';
}

/* ---------------- view state ---------------- */
let viewYM = curYM();
const editCols = new Set(); // locked columns temporarily unlocked (not saved)
const isLockedNow = c => c.locked && !editCols.has(c.id);
const hasLockedVals = (p, ym) => p.columns.some(c => c.locked && Object.values(p.months[ym]?.days || {}).some(x => x[c.id] != null && x[c.id] !== ''));
function copyTargets(p, from, to) {
  const lc = p.columns.filter(c => c.locked); let n = 0;
  const dim = daysIn(to);
  for (let d = 1; d <= dim; d++) {
    const src = p.months[from]?.days?.[d]; if (!src) continue;
    lc.forEach(c => { const v = src[c.id]; if (v == null || v === '') return; const dst = dayCells(p, to, d); if (dst[c.id] == null || dst[c.id] === '') { dst[c.id] = v; n++; } });
  }
  // prune empty day objects created by dayCells
  Object.entries(p.months[to]?.days || {}).forEach(([d, x]) => { if (!Object.keys(x).length) delete p.months[to].days[d]; });
  p.copyAsked = to; save(); return n;
}
function maybeOfferTargets(p) {
  const ym = curYM(), prev = addMonth(ym, -1);
  if (viewYM !== ym || p.copyAsked === ym || !hasLockedVals(p, prev) || hasLockedVals(p, ym)) return;
  p.copyAsked = ym; save();
  toast("Copy last month's targets?", { label: 'Copy', fn: () => { const n = copyTargets(p, prev, ym); toast(n ? `Copied ${n} target${n === 1 ? '' : 's'}` : 'Nothing to copy'); render(); } }, 10000);
}
let scrollTodayOnce = true;

/* ---------------- toast / sheets ---------------- */
let toastT;
function toast(msg, act, ms = 3500) {
  const t = $('#toast'); t.innerHTML = ''; t.append(el('span', {}, msg));
  if (act) t.append(el('button', { onclick: () => { hideToast(); act.fn(); } }, act.label));
  t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(hideToast, ms);
}
const hideToast = () => $('#toast').classList.remove('on');

let sheetOpen = null;
function openSheet(build, cls = '') {
  hideToast();
  const had = !!sheetOpen; closeSheet(true, had);
  const opened = Date.now();
  const scrim = el('div', { class: 'scrim', onclick: () => { if (Date.now() - opened > 450) closeSheet(); } });
  const sh = el('div', { class: 'sheet ' + cls, role: 'dialog' });
  if (!cls.includes('full')) sh.append(el('div', { class: 'grab' }));
  $('#sheets').append(scrim, sh);
  sheetOpen = { scrim, sh, onClose: null };
  build(sh, sheetOpen);
  if (!history.state?.sheet) history.pushState({ sheet: 1 }, '');
  requestAnimationFrame(() => { scrim.classList.add('on'); sh.classList.add('on'); });
  return sh;
}
function closeSheet(silent, fromPop) {
  if (!sheetOpen) return; const { scrim, sh, onClose } = sheetOpen; sheetOpen = null;
  onClose?.(); scrim.remove(); sh.remove();
  // Defer the history pop: if another sheet opens right away (menu → Rename), it reuses this entry
  // instead of being closed by the late popstate.
  if (!fromPop) setTimeout(() => { if (!sheetOpen && history.state?.sheet) { ignorePop = true; history.back(); } }, 0);
  if (!silent) render();
}
let ignorePop = false;
addEventListener('popstate', () => { if (ignorePop) { ignorePop = false; return; } if (sheetOpen) closeSheet(false, true); });
const head = (title, extra) => el('div', { class: 'sh-h' }, el('h2', {}, title), extra || null, el('button', { class: 'ib', 'aria-label': 'Close', html: ICON.x, onclick: () => closeSheet() }));
function choose(title, msg, buttons) {
  return new Promise(res => {
    openSheet((sh, st) => {
      st.onClose = () => res(null);
      sh.append(head(title));
      if (msg) sh.append(el('p', { class: 'note', style: 'margin-top:0;font-size:15px;color:var(--fg2)' }, msg));
      sh.append(
        el('div', { class: 'btns' + (buttons.length > 2 ? ' list' : '') },
          buttons.map(b => el('button', { class: 'btn ' + (b.cls || '') + (b.label === 'Cancel' ? ' cxl' : ''), onclick: () => { st.onClose = null; closeSheet(); res(b.v); } }, b.label))));
    });
  });
}
function askText(title, opts = {}) {
  return new Promise(res => {
    openSheet((sh, st) => {
      st.onClose = () => res(null);
      const inp = el(opts.multi ? 'textarea' : 'input', {
        class: opts.multi ? 'ta' : 'tin', id: 'askIn',
        placeholder: opts.placeholder || '', value: opts.value || '',
        maxlength: opts.max || 200, ...(opts.multi ? {} : { type: 'text' }),
      });
      if (opts.multi) inp.textContent = opts.value || '';
      sh.append(head(title), el('div', { class: 'fld', style: 'margin-top:8px' }, inp),
        el('div', { class: 'btns' },
          el('button', { class: 'btn', onclick: () => { st.onClose = null; closeSheet(); res(null); } }, 'Cancel'),
          el('button', { class: 'btn pri', onclick: () => { st.onClose = null; const v = inp.value.trim(); closeSheet(); res(v); } }, opts.ok || 'Save')));
      setTimeout(() => { inp.focus(); if (!opts.multi) inp.select?.(); }, 80);
    });
  });
}

/* ---------------- filter inputs ---------------- */
function filterTimes(s) { return String(s).replace(/[^\d:.,;\s]/g, ''); }
function filterNumber(s) {
  let t = String(s).replace(/[^\d.]/g, '');
  const i = t.indexOf('.');
  if (i !== -1) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
  return t;
}
function cycleTick(v) {
  if (!v) return '✓';
  if (v === '✓') return '✗';
  return '';
}

/* ---------------- render ---------------- */
function render() {
  document.title = APP_NAME;
  const p = active();
  renderTabs();
  renderBanner();
  if (!p) {
    $('#sheetWrap').hidden = true; $('#dock').hidden = true; $('#empty').hidden = false;
    $('#empty').innerHTML = '';
    $('#empty').append(
      el('h1', {}, APP_NAME),
      el('p', {}, 'Your monthly project sheets — on this phone, offline. Create a project, add columns, fill each day.'),
      el('button', { class: 'btn', onclick: () => newProject() }, 'Create a project'));
    return;
  }
  $('#empty').hidden = true; $('#sheetWrap').hidden = false; $('#dock').hidden = false;
  // clamp view month to not go past current
  if (viewYM > curYM()) viewYM = curYM();
  $('#monthLabel').textContent = p.name + ' · ' + monthLabel(viewYM);
  $('#thisMonthBtn').hidden = viewYM === curYM();
  $('#nextM').disabled = viewYM >= curYM();
  $('#nextM').style.opacity = viewYM >= curYM() ? '.35' : '1';

  const mo = ensureMonth(p, viewYM);
  const first = (mo.note || '').split('\n')[0].trim();
  const info = $('#infoLine');
  info.textContent = first || 'Add a note for this month…';
  info.classList.toggle('empty-info', !first);

  const filled = filledCount(p, viewYM);
  const dim = daysIn(viewYM);
  $('#meta').textContent = `${filled} of ${dim} days logged · ${p.columns.length} column${p.columns.length === 1 ? '' : 's'}`;

  renderGrid(p);
  // copy yesterday button
  const cy = $('#copyYest');
  const isCur = viewYM === curYM();
  const td = todayDay();
  const y = yesterdayInfo();
  const todayEmpty = isCur && !isDayFilled(p, viewYM, td);
  const yestHas = isDayFilled(p, y.ym, y.day);
  cy.hidden = !(todayEmpty && yestHas);
  maybeOfferTargets(p);
}
function renderTabs() {
  const box = $('#tabs'); box.innerHTML = '';
  const list = liveProjects();
  const tk = curYM(), td = todayDay();
  list.forEach(p => {
    const on = p.id === D.activeId;
    const filled = isDayFilled(p, tk, td);
    const b = el('button', {
      class: 'tab' + (on ? ' on' : '') + (filled ? '' : ' todo'),
      role: 'tab', 'aria-selected': on,
      onclick: () => { D.activeId = p.id; save(); scrollTodayOnce = true; render(); },
    }, p.name);
    // accent dot = today still needs filling; no dot once filled (targets don't count)
    if (!filled) b.append(el('span', { class: 'dot', title: 'Today not filled yet' }));
    // long-press → project menu
    bindLongPress(b, () => projectMenu(p));
    b.addEventListener('touchmove', () => clearTimeout(t), { passive: true });
    box.append(b);
  });
}
function renderBanner() {
  const b = $('#banner'); b.hidden = true; b.innerHTML = '';
  const p = active(); if (!p) return;
  // Fill yesterday?
  const y = yesterdayInfo();
  const dk = 'yd:' + p.id + ':' + dateKey(curYM(), todayDay());
  if (!isDayFilled(p, y.ym, y.day) && !D.notified[dk]) {
    b.hidden = false;
    b.append(
      el('span', { class: 't' }, `Yesterday called. It felt ignored. (${y.label})`),
      el('button', { class: 'btn', id: 'ydOpen', onclick: () => openYesterday() }, 'Open'),
      el('button', { class: 'btn ghost', id: 'ydDismiss', onclick: () => {
        // keep only today's dismiss markers so the store doesn't grow
        Object.keys(D.notified).forEach(k => { if (k.startsWith('yd:') && !k.endsWith(dateKey(curYM(), todayDay()))) delete D.notified[k]; });
        D.notified[dk] = true; save(); renderBanner();
      } }, 'Dismiss'));
    return;
  }
  // Catch-up list at/after 10pm if enabled and some projects empty today
  if (S().catchup) {
    const d = now();
    if (d.getHours() >= 22) {
      const empty = liveProjects().filter(pr => !isDayFilled(pr, curYM(), todayDay()));
      if (empty.length) {
        b.hidden = false;
        b.append(el('span', { class: 't' }, `Still empty today: ${empty.map(x => x.name).join(', ')}`));
      }
    }
  }
}
function renderGrid(p) {
  const g = $('#grid'); g.innerHTML = '';
  const dim = daysIn(viewYM);
  const isCur = viewYM === curYM();
  const td = todayDay();
  const thead = el('thead');
  const hr = el('tr', {},
    el('th', { class: 'day' }, 'Day'),
    ...p.columns.map(c => el('th', {},
      el('button', { class: 'thbtn' + (c.locked ? ' lk' : ''), title: 'Edit column', onclick: () => columnMenu(c) },
        el('span', {}, c.name), c.locked ? (editCols.has(c.id) ? el('i', { class: 'lki' }, '✎') : el('i', { class: 'lki', html: ICON.lock })) : null),
      el('span', { class: 'rz', 'data-col': c.id, 'aria-hidden': 'true' }))));
  if (!p.columns.length) hr.append(el('th', {}, el('span', { style: 'color:var(--fg3);font-weight:500;text-transform:none;letter-spacing:0' }, 'Add a column →')));
  thead.append(hr); g.append(thead);
  const tb = el('tbody');
  for (let day = 1; day <= dim; day++) {
    const isToday = isCur && day === td;
    const tr = el('tr', { class: isToday ? 'today' : '', 'data-day': day });
    const dayBtn = el('button', {
      class: 'dnum', type: 'button', title: 'Long-press to clear',
      onclick: () => {}, // long-press handled below
    }, String(day), el('small', {}, weekday(viewYM, day)));
    bindLongPress(dayBtn, () => clearDay(p, day));
    tr.append(el('td', { class: 'day' }, dayBtn));
    p.columns.forEach(c => tr.append(el('td', { class: 'cell ' + c.type + (c.locked ? (isLockedNow(c) ? ' locked' : ' editing') : '') }, cellControl(p, day, c))));
    if (!p.columns.length) tr.append(el('td', { class: 'cell' }, el('span', { style: 'color:var(--fg3);font-size:13px;padding:0 8px' }, '—')));
    tb.append(tr);
  }
  g.append(tb);
  applyWidths(p);
  if (scrollTodayOnce && isCur) {
    scrollTodayOnce = false;
    requestAnimationFrame(() => scrollToDay(td));
  }
}
function openYesterday() {
  const y = yesterdayInfo();
  viewYM = y.ym; scrollTodayOnce = false; render();
  requestAnimationFrame(() => {
    scrollToDay(y.day);
    const row = $(`#grid tr[data-day="${y.day}"]`);
    if (row) { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1600); }
  });
}
function scrollToDay(day) {
  const row = $(`#grid tr[data-day="${day}"]`);
  const sc = $('#scroller');
  if (!row || !sc) return;
  // Only scroll the grid scroller — never the page (that hid the month bar under the sticky header).
  if (sc.scrollHeight > sc.clientHeight + 1) {
    const top = row.offsetTop - sc.clientHeight / 2 + row.offsetHeight / 2;
    sc.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else {
    // grid isn't height-bounded on this layout: the page scrolls, so centre the row in the window
    const r = row.getBoundingClientRect();
    window.scrollTo({ top: Math.max(0, scrollY + r.top - innerHeight / 2 + r.height / 2), behavior: 'smooth' });
  }
}
function cellControl(p, day, c) {
  const cells = dayCells(p, viewYM, day);
  const v = cells[c.id] ?? '';
  const lockedNow = isLockedNow(c);
  if (c.type === 'tick') {
    const cls = v === '✓' ? 'yes' : v === '✗' ? 'no' : '';
    return el('button', {
      class: 'ch ' + cls, type: 'button', 'aria-label': c.name,
      ...(lockedNow ? { tabindex: -1, 'aria-disabled': 'true' } : {}),
      onclick: () => {
        if (isLockedNow(c)) return;
        cells[c.id] = cycleTick(v);
        if (!cells[c.id]) delete cells[c.id];
        save();
        if (S().vibrate) try { navigator.vibrate?.(10); } catch {}
        render();
      },
    }, ...(v === '✓' ? [el('span', { class: 'mk', html: ICON.check })] : v === '✗' ? [el('span', { class: 'mk', html: ICON.cross })] : []));
  }
  const inp = el('textarea', {
    class: 'cin' + (c.type === 'text' ? ' text' : ''), rows: 1, 'data-col': c.id,
    ...(lockedNow ? { readonly: true, tabindex: -1 } : {}),
    inputmode: c.type === 'number' ? 'decimal' : 'text',
    value: v, placeholder: '',
    'aria-label': `${c.name}, day ${day}`,
    onfocus: e => e.target.dataset.old = e.target.value,
    oninput: e => {
      let n = e.target.value;
      if (c.type === 'times') n = filterTimes(n);
      if (c.type === 'number') n = filterNumber(n);
      if (n !== e.target.value) e.target.value = n;
      fitCell(e.target);
    },
    onchange: e => commitCell(p, day, c, e.target.value),
    onblur: e => commitCell(p, day, c, e.target.value),
    onkeydown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
        // move to next day same column
        const next = $(`#grid tr[data-day="${day + 1}"] .cin[data-col="${c.id}"]`);
        next?.focus();
      }
    },
  });
  inp.value = v || '';
  requestAnimationFrame(() => fitCell(inp));
  return inp;
}
function commitCell(p, day, c, raw) {
  if (isLockedNow(c)) return;
  const cells = dayCells(p, viewYM, day);
  let v = String(raw ?? '').trim();
  if (c.type === 'times') v = filterTimes(v).trim();
  if (c.type === 'number') v = filterNumber(v).trim();
  const old = cells[c.id] ?? '';
  if (v === old) return;
  if (v) cells[c.id] = v; else delete cells[c.id];
  // prune empty day objects
  if (!Object.keys(cells).length) delete ensureMonth(p, viewYM).days[day];
  save();
  // soft update meta without full re-render (keeps focus)
  const filled = filledCount(p, viewYM);
  $('#meta').textContent = `${filled} of ${daysIn(viewYM)} days logged · ${p.columns.length} column${p.columns.length === 1 ? '' : 's'}`;
  applyWidths(p);
  renderTabs();
  renderBanner();
  const cy = $('#copyYest');
  const y = yesterdayInfo();
  cy.hidden = !(viewYM === curYM() && !isDayFilled(p, viewYM, todayDay()) && isDayFilled(p, y.ym, y.day));
}
function bindLongPress(node, fn) {
  // One long-press = one call. Swallow the click/contextmenu that follows it, so the
  // finger lifting doesn't land on the new sheet's backdrop and close it.
  let t, fired = 0;
  const fire = () => { if (Date.now() - fired < 800) return; fired = Date.now(); fn(); };
  const start = () => { clearTimeout(t); t = setTimeout(() => { t = null; fire(); }, 480); };
  const cancel = () => clearTimeout(t);
  node.addEventListener('touchstart', start, { passive: true });
  node.addEventListener('touchend', e => { cancel(); if (Date.now() - fired < 800 && e.cancelable) e.preventDefault(); });
  node.addEventListener('touchmove', cancel, { passive: true });
  node.addEventListener('mousedown', start);
  node.addEventListener('mouseup', cancel);
  node.addEventListener('mouseleave', cancel);
  node.addEventListener('contextmenu', e => { e.preventDefault(); cancel(); fire(); });
  node.addEventListener('click', e => { if (Date.now() - fired < 800) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
}

/* ---------------- actions: projects ---------------- */
async function newProject() {
  const name = await askText('New project', { placeholder: 'e.g. Hawk Eye', max: 60, ok: 'Create' });
  if (!name) return;
  const p = { id: uid(), name, archived: false, createdAt: Date.now(), columns: [], months: {}, remind: false, remindAt: '09:00' };
  D.projects.push(p); D.activeId = p.id; viewYM = curYM(); scrollTodayOnce = true; save();
  toast('Project created. Add a column to start.');
  render();
}
async function renameProject(p) {
  const name = await askText('Rename project', { value: p.name, max: 60 });
  if (!name || name === p.name) return;
  p.name = name; save(); render();
}
async function projectMenu(p) {
  if (!p) p = active(); if (!p) return;
  const v = await choose(p.name, null, [
    ...(p.columns.some(c => c.locked) ? [{ label: "Copy last month's targets", v: 'copy' }] : []),
    { label: 'Rename', v: 'rename' },
    { label: p.remind ? `Reminder on · ${fmt12(p.remindAt)}` : 'Set reminder', v: 'remind' },
    { label: 'Archive', v: 'archive', cls: 'dng' },
    { label: 'Cancel', v: null },
  ]);
  if (v === 'copy') { const n = copyTargets(p, addMonth(viewYM, -1), viewYM); render(); toast(n ? `Copied ${n} target${n === 1 ? '' : 's'}` : 'Nothing new to copy'); }
  if (v === 'rename') renameProject(p);
  else if (v === 'remind') reminderSheet(p);
  else if (v === 'archive') archiveProject(p);
}
async function archiveProject(p) {
  const ok = await choose('Archive project?', `"${p.name}" will be hidden. You can restore it from Settings.`, [
    { label: 'Archive', v: true, cls: 'dng' }, { label: 'Cancel', v: false },
  ]);
  if (!ok) return;
  p.archived = true;
  if (D.activeId === p.id) {
    const next = liveProjects()[0];
    D.activeId = next ? next.id : null;
  }
  save();
  toast('Archived', { label: 'Undo', fn: () => { p.archived = false; D.activeId = p.id; save(); render(); } }, 6000);
  render();
}
function fmt12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? 'AM' : 'PM';
  return `${(h % 12) || 12}:${pad(m)} ${ap}`;
}

/* ---------------- columns ---------------- */
async function addColumn() {
  const p = active(); if (!p) return;
  let type = 'tick';
  openSheet((sh, st) => {
    const nameIn = el('input', { class: 'tin', id: 'colName', placeholder: 'Column name', maxlength: 40 });
    const seg = el('div', { class: 'seg' });
    COL_TYPES.forEach(t => {
      const b = el('button', {
        class: t.id === type ? 'on' : '', type: 'button',
        onclick: e => { type = t.id; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === e.currentTarget)); hint.textContent = t.hint; },
      }, t.label, el('small', {}, t.id === 'tick' ? '✓ ✗' : t.id === 'times' ? '1:20' : t.id === 'number' ? '42' : 'abc'));
      seg.append(b);
    });
    const hint = el('p', { class: 'note', style: 'margin-top:10px' }, COL_TYPES[0].hint);
    const lockIn = el('input', { type: 'checkbox', id: 'colLock' });
    const lockRow = el('div', { class: 'fld lockrow' },
      el('div', {}, el('label', { for: 'colLock', style: 'margin:0' }, 'Locked (targets)'), el('p', { class: 'note', style: 'margin:2px 0 0' }, "Grey and read-only. Use ⋯ Edit to type targets.")),
      el('label', { class: 'sw' }, lockIn, el('i')));
    sh.append(head('Add column'),
      el('div', { class: 'fld' }, el('label', { for: 'colName' }, 'Name'), nameIn),
      el('div', { class: 'fld' }, el('label', {}, 'Type'), seg, hint),
      lockRow,
      el('div', { class: 'btns' },
        el('button', { class: 'btn', onclick: () => closeSheet() }, 'Cancel'),
        el('button', { class: 'btn pri', onclick: () => {
          const name = nameIn.value.trim(); if (!name) { nameIn.focus(); return; }
          const col = { id: uid(), name, type, locked: lockIn.checked };
          p.columns.push(col);
          if (col.locked) editCols.add(col.id); // start in edit mode so targets can be typed straight away
          save(); closeSheet(); toast(col.locked ? 'Locked column added — type targets, then ⋯ Done' : 'Column added');
        } }, 'Add')));
    setTimeout(() => nameIn.focus(), 80);
  });
}
async function columnMenu(c) {
  const p = active(); if (!p) return;
  const idx = p.columns.findIndex(x => x.id === c.id);
  const editing = editCols.has(c.id);
  const v = await choose(c.name, `Type: ${c.type}${c.locked ? (editing ? ' · locked, editing now' : ' · locked') : ''}`, [
    ...(c.locked ? [editing ? { label: 'Done (lock again)', v: 'done', cls: 'pri' } : { label: 'Edit (type targets)', v: 'edit', cls: 'pri' }] : []),
    { label: c.locked ? 'Unlock column' : 'Lock column', v: 'lock' },
    ...(c.locked ? [{ label: "Copy last month's targets", v: 'copy' }] : []),
    ...(c.w ? [{ label: 'Auto width', v: 'autow' }] : []),
    { label: 'Rename', v: 'rename' },
    { label: 'Move left', v: 'left' },
    { label: 'Move right', v: 'right' },
    { label: 'Delete column', v: 'del', cls: 'dng' },
    { label: 'Cancel', v: null },
  ]);
  if (v === 'autow') { c.w = null; save(); render(); toast(c.name + ': auto width'); return; }
  if (v === 'edit') { editCols.add(c.id); render(); toast('Editing ' + c.name + ' — tap ⋯ Done when finished'); return; }
  if (v === 'done') { editCols.delete(c.id); render(); toast(c.name + ' locked'); return; }
  if (v === 'lock') { c.locked = !c.locked; editCols.delete(c.id); save(); render(); toast(c.locked ? c.name + ' locked' : c.name + ' unlocked'); return; }
  if (v === 'copy') { const n = copyTargets(p, addMonth(viewYM, -1), viewYM); render(); toast(n ? `Copied ${n} target${n === 1 ? '' : 's'} from ${monthLabel(addMonth(viewYM, -1))}` : 'Nothing new to copy'); return; }
  if (v === 'rename') {
    const name = await askText('Rename column', { value: c.name, max: 40 });
    if (name && name !== c.name) { c.name = name; save(); render(); }
  } else if (v === 'left' && idx > 0) {
    p.columns.splice(idx - 1, 0, p.columns.splice(idx, 1)[0]); save(); render();
  } else if (v === 'right' && idx < p.columns.length - 1) {
    p.columns.splice(idx + 1, 0, p.columns.splice(idx, 1)[0]); save(); render();
  } else if (v === 'del') {
    const ok = await choose('Delete column?', `Remove "${c.name}"? Values already logged in this column stay in the backup file but disappear from the sheet.`, [
      { label: 'Delete', v: true, cls: 'dng' }, { label: 'Cancel', v: false },
    ]);
    if (!ok) return;
    const removed = p.columns.splice(idx, 1)[0];
    // keep cell values in data (harmless) — or strip? Spec: delete column. Strip for cleanliness.
    Object.values(p.months).forEach(mo => Object.values(mo.days || {}).forEach(cells => { delete cells[removed.id]; }));
    save();
    toast('Column deleted', { label: 'Undo', fn: () => { p.columns.splice(idx, 0, removed); save(); render(); } }, 7000);
    render();
  }
}
async function clearDay(p, day) {
  if (!isDayFilled(p, viewYM, day)) return;
  const ok = await choose(`Clear day ${day}?`, 'All values on this row will be removed (locked targets stay).', [
    { label: 'Clear', v: true, cls: 'dng' }, { label: 'Cancel', v: false },
  ]);
  if (!ok) return;
  const mo = ensureMonth(p, viewYM);
  const old = mo.days[day] ? { ...mo.days[day] } : null;
  const keep = {}; p.columns.forEach(c => { if (c.locked && old?.[c.id] != null) keep[c.id] = old[c.id]; });
  if (Object.keys(keep).length) mo.days[day] = keep; else delete mo.days[day];
  save();
  toast('Day cleared', { label: 'Undo', fn: () => { if (old) { mo.days[day] = old; save(); render(); } } }, 6000);
  render();
}
function copyYesterday() {
  const p = active(); if (!p) return;
  const y = yesterdayInfo();
  const src = p.months[y.ym]?.days?.[y.day];
  if (!src) return toast('Yesterday is empty.');
  const td = todayDay();
  const dest = dayCells(p, curYM(), td);
  p.columns.forEach(c => { if (!c.locked && src[c.id] != null && src[c.id] !== '') dest[c.id] = src[c.id]; });
  save(); toast('Copied yesterday into today'); viewYM = curYM(); scrollTodayOnce = true; render();
}

/* ---------------- info note ---------------- */
async function editInfo() {
  const p = active(); if (!p) return;
  const mo = ensureMonth(p, viewYM);
  const note = await askText('Month note', { value: mo.note || '', multi: true, max: 500, placeholder: 'e.g. Goal: 60 kg within December', ok: 'Save' });
  if (note == null) return;
  mo.note = note; save(); render();
}

/* ---------------- reminders ---------------- */
async function askNotif() {
  try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch {}
}
async function notify(title, body, opts = {}) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const r = await navigator.serviceWorker?.getRegistration();
    if (r?.showNotification) { await r.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', ...opts }); return true; }
    new Notification(title, { body, icon: 'icons/icon-192.png', ...opts }); return true;
  } catch { return false; }
}
function reminderSheet(p) {
  openSheet(sh => {
    const sw = el('label', { class: 'sw' },
      el('input', { type: 'checkbox', checked: p.remind, onchange: async e => {
        p.remind = e.target.checked; save();
        if (p.remind) await askNotif();
      } }), el('i'));
    const tm = el('input', { class: 'tin tin-time', type: 'time', value: p.remindAt, onchange: e => { p.remindAt = e.target.value || '09:00'; save(); } });
    sh.append(head('Reminder'),
      el('div', { class: 'card' },
        el('div', { class: 'it' }, el('div', { class: 'l' }, el('div', {}, 'Remind me'), el('small', {}, 'Skipped if today is already filled')), sw),
        el('div', { class: 'it' }, el('div', { class: 'l' }, el('div', {}, 'Time')), tm)),
      el('p', { class: 'note' }, 'Web reminders on Android are best-effort — they work better when the app has been opened recently. A proper APK later will make them reliable.'));
  });
}
function checkReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const d = now();
  const mins = d.getHours() * 60 + d.getMinutes();
  const today = dateKey(curYM(), todayDay());
  liveProjects().forEach(p => {
    if (!p.remind) return;
    if (isDayFilled(p, curYM(), todayDay())) return;
    const [h, m] = p.remindAt.split(':').map(Number);
    if (mins < h * 60 + m) return;
    const key = p.id + ':' + today;
    if (D.notified[key]) return;
    D.notified[key] = true; save();
    notify(p.name, 'Still empty today — tap to fill.', { tag: 'proj-' + p.id, data: { projectId: p.id, url: './' } });
  });
  if (S().catchup && mins >= 22 * 60) {
    const ckey = 'catchup:' + today;
    if (!D.notified[ckey]) {
      const empty = liveProjects().filter(p => !isDayFilled(p, curYM(), todayDay()));
      if (empty.length) {
        D.notified[ckey] = true; save();
        notify(APP_NAME, `Still empty: ${empty.map(p => p.name).join(', ')}`, { tag: 'catchup' });
      }
    }
  }
  // prune old notified keys (keep ~7 days)
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const cut = dateKey(ymKey(cutoff.getFullYear(), cutoff.getMonth()), cutoff.getDate());
  Object.keys(D.notified).forEach(k => {
    const m = k.match(/(\d{4}-\d{2}-\d{2})$/);
    if (m && m[1] < cut) delete D.notified[k];
  });
}

/* ---------------- export + PNG ---------------- */
function download(blob, name) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function monthKeysFor(p) {
  const set = new Set(Object.keys(p.months || {}));
  set.add(curYM());
  set.add(addMonth(curYM(), -1));
  // include months from createdAt
  const start = new Date(p.createdAt);
  let ym = ymKey(start.getFullYear(), start.getMonth());
  while (ym <= curYM()) { set.add(ym); ym = addMonth(ym, 1); if (set.size > 120) break; }
  return [...set].sort().reverse();
}
function lastMonth() { return addMonth(curYM(), -1); }
function buildMonthRows(p, ym) {
  const dim = daysIn(ym);
  const head = ['Day', ...p.columns.map(c => c.name)];
  const rows = [];
  for (let d = 1; d <= dim; d++) {
    const cells = p.months[ym]?.days?.[d] || {};
    const wd = weekday(ym, d);
    rows.push([`${d} ${wd}`, ...p.columns.map(c => {
      const v = cells[c.id];
      if (v == null || v === '') return '';
      return String(v);
    })]);
  }
  return { head, rows, note: p.months[ym]?.note || '', grey: [0, ...p.columns.map(c => !!c.locked)] .map((g, i) => i && g ? i : -1).filter(i => i > 0) };
}
function monthsInRange(p, from, to) {
  // from/to are YYYY-MM-DD or undefined
  const keys = monthKeysFor(p).filter(ym => {
    if (from && ym + '-31' < from) return false;
    if (to && ym + '-01' > to) return false;
    // only include if has any data or is current/selected
    return true;
  }).sort();
  return keys;
}
function exportDocx(p, mode, mon, from, to) {
  let months = [];
  if (mode === 'month') months = [mon];
  else if (mode === 'range') months = monthsInRange(p, from, to);
  else months = monthKeysFor(p).sort();
  // trim empty trailing months except the selected one in month mode
  if (mode !== 'month') months = months.filter(ym => filledCount(p, ym) > 0 || Object.keys(p.months[ym]?.days || {}).length);
  if (!months.length) months = [curYM()];
  const model = {
    title: p.name,
    subtitle: `${months.length === 1 ? monthLabel(months[0]) : monthLabel(months[0]) + ' – ' + monthLabel(months[months.length - 1])}  ·  exported ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`,
    months: months.map(ym => {
      const { head, rows, note } = buildMonthRows(p, ym);
      return { title: monthLabel(ym), head, rows, note, grey: buildMonthRows(p, ym).grey };
    }),
  };
  const name = months.length === 1
    ? `${slug(p.name)}-${months[0]}.docx`
    : `${slug(p.name)}-${months[0]}_to_${months[months.length - 1]}.docx`;
  const blob = makeDocx(model);
  download(blob, name);
  toast('Saved ' + name);
  return { blob, name, months };
}
function renderMonthPng(p, ym) {
  // Light paper-style canvas so the shared photo looks like his old sheet photos
  const { head, rows, note, grey } = buildMonthRows(p, ym);
  const G = new Set(grey);
  const cols = head.length;
  const scale = 2;
  const padX = 36, padY = 36;
  const dayW = 70, colW = Math.max(90, Math.min(160, Math.floor(520 / Math.max(1, cols - 1))));
  const rowH = 34, headH = 40;
  const titleH = 56 + (note ? 28 : 0);
  const tableW = dayW + colW * (cols - 1);
  const W = Math.max(640, tableW + padX * 2);
  const H = padY * 2 + titleH + headH + rowH * rows.length + 24;
  const c = document.createElement('canvas');
  c.width = W * scale; c.height = H * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#faf9f7';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '700 26px system-ui,sans-serif';
  ctx.fillText(p.name, padX, padY + 26);
  ctx.font = '500 15px system-ui,sans-serif';
  ctx.fillStyle = '#666';
  ctx.fillText(monthLabel(ym), padX, padY + 48);
  if (note) {
    ctx.font = 'italic 13px system-ui,sans-serif';
    ctx.fillText(note.split('\n')[0].slice(0, 80), padX, padY + 70);
  }
  const top = padY + titleH;
  // header
  ctx.fillStyle = '#eceae6';
  ctx.fillRect(padX, top, tableW, headH);
  ctx.strokeStyle = '#cfcbc4';
  ctx.lineWidth = 1;
  ctx.font = '650 12px system-ui,sans-serif';
  ctx.fillStyle = '#555';
  let x = padX;
  head.forEach((h, i) => {
    const w = i === 0 ? dayW : colW;
    if (G.has(i)) { ctx.fillStyle = '#dedbd6'; ctx.fillRect(x, top, w, headH); }
    ctx.strokeRect(x, top, w, headH);
    ctx.fillStyle = G.has(i) ? '#8a8a8a' : '#555';
    ctx.fillText(String(h).slice(0, 18).toUpperCase(), x + 8, top + 24);
    x += w;
  });
  rows.forEach((r, ri) => {
    const y = top + headH + ri * rowH;
    if (ri % 2) { ctx.fillStyle = '#f3f1ed'; ctx.fillRect(padX, y, tableW, rowH); }
    x = padX;
    r.forEach((cell, i) => {
      const w = i === 0 ? dayW : colW;
      if (G.has(i)) { ctx.fillStyle = '#ebe9e5'; ctx.fillRect(x, y, w, rowH); }
      ctx.strokeStyle = '#d9d5ce';
      ctx.strokeRect(x, y, w, rowH);
      ctx.fillStyle = i === 0 ? '#333' : (G.has(i) || cell === '✗') ? '#8f8f8f' : '#1a1a1a';
      ctx.font = (i === 0 ? '650 ' : '500 ') + '13px system-ui,sans-serif';
      const t = String(cell ?? '');
      if (i && (t === '✓' || t === '✗')) {
        ctx.save(); ctx.translate(x + 8, y + 10); ctx.scale(14 / 24, 14 / 24);
        ctx.fillStyle = t === '✓' ? (G.has(i) ? '#8f8f8f' : '#2b2b2b') : '#9a9a9a';
        ctx.fill(new Path2D(t === '✓' ? 'M8.8 19.2 2.6 13l2.5-2.5 3.6 3.6L18.9 3.9 21.4 6.4 8.8 19.2Z' : 'M18.8 21.2 12 14.4 5.2 21.2 2.8 18.8 9.6 12 2.8 5.2 5.2 2.8 12 9.6l6.8-6.8 2.4 2.4L14.4 12l6.8 6.8-2.4 2.4Z'));
        ctx.restore();
      } else ctx.fillText(t.slice(0, i === 0 ? 8 : 22), x + 8, y + 22);
      x += w;
    });
  });
  // footer
  ctx.fillStyle = '#999';
  ctx.font = '12px system-ui,sans-serif';
  ctx.fillText('Daily Log', padX, H - 14);
  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}
async function sharePngs(p, months) {
  const files = [];
  for (const ym of months) {
    const blob = await renderMonthPng(p, ym);
    if (!blob) continue;
    files.push(new File([blob], `${slug(p.name)}-${ym}.png`, { type: 'image/png' }));
  }
  if (!files.length) return toast('Nothing to share.');
  let ok = false;
  try { ok = !!navigator.canShare?.({ files }); } catch {}
  if (ok) {
    try { await navigator.share({ files, title: p.name }); }
    catch (e) {
      if (e?.name !== 'AbortError') {
        files.forEach(f => download(f, f.name));
        toast('Couldn\'t share, so saved PNG' + (files.length > 1 ? 's' : '') + ' to Downloads');
      }
    }
    return;
  }
  files.forEach(f => download(f, f.name));
  toast('Sharing isn\'t available here, so saved PNG' + (files.length > 1 ? 's' : '') + ' to Downloads');
}

/* ---------------- settings ---------------- */
function settingsSheet() {
  openSheet(sh => {
    const p = active();
    const sw = (on, fn) => el('label', { class: 'sw' }, el('input', { type: 'checkbox', checked: on, onchange: e => fn(e.target.checked) }), el('i'));
    const it = (title, hint, ctl, cls) => el('div', { class: 'it ' + (cls || '') }, el('div', { class: 'l' }, el('div', {}, title), hint ? el('small', {}, hint) : null), ctl);
    const grp = (t, ...items) => el('div', { class: 'grp' }, el('h3', {}, t), el('div', { class: 'card' }, ...items));

    // export controls
    let exMode = 'month';
    const lastM = lastMonth();
    const months = p ? monthKeysFor(p) : [lastM, curYM()];
    const exMon = el('select', { class: 'sel' }, months.map(k => el('option', { value: k, selected: k === lastM }, monthLabel(k))));
    const monBox = el('div', { class: 'row2' }, exMon);
    const exFrom = el('input', { class: 'tin', type: 'date', value: dateKey(addMonth(curYM(), -1), 1), style: 'flex:1' });
    const exTo = el('input', { class: 'tin', type: 'date', value: dateKey(curYM(), todayDay()), style: 'flex:1' });
    const rangeBox = el('div', { class: 'row2', hidden: true }, exFrom, exTo);
    const exSeg = el('div', { class: 'seg sm' }, [['month', 'Month'], ['range', 'Dates'], ['all', 'All']].map(([v, l]) =>
      el('button', { class: v === exMode ? 'on' : '', onclick: e => {
        exMode = v; rangeBox.hidden = v !== 'range'; monBox.hidden = v !== 'month';
        exSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget));
      } }, l)));
    const runExport = async share => {
      if (!p) return toast('Create a project first.');
      const monthsList = exMode === 'month' ? [exMon.value]
        : exMode === 'range' ? monthsInRange(p, exFrom.value, exTo.value)
        : monthKeysFor(p).sort().filter(ym => filledCount(p, ym) > 0 || ym === curYM());
      if (!monthsList.length) return toast('Nothing to export.');
      if (share) await sharePngs(p, monthsList);
      else exportDocx(p, exMode, exMon.value, exFrom.value, exTo.value);
    };

    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const nb = perm === 'granted' ? el('span', { class: 'note', style: 'margin:0' }, 'On')
      : perm === 'denied' ? el('span', { class: 'note', style: 'margin:0' }, 'Blocked')
      : el('button', { class: 'btn', style: 'flex:none;height:40px;padding:0 14px;font-size:14px', onclick: async () => { await askNotif(); closeSheet(true); settingsSheet(); } }, 'Allow');

    const arch = archivedProjects();
    const archCard = arch.length ? grp('Archived', ...arch.map(ap => el('div', { class: 'it' },
      el('div', { class: 'l' }, el('div', {}, ap.name)),
      el('button', { class: 'btn', style: 'flex:none;height:40px;padding:0 12px;font-size:14px', onclick: () => { ap.archived = false; D.activeId = ap.id; save(); closeSheet(); toast('Restored'); } }, 'Restore'),
      el('button', { class: 'btn dng', style: 'flex:none;height:40px;padding:0 12px;font-size:14px', onclick: async () => {
        const ok = await choose('Delete forever?', `"${ap.name}" and all its months will be gone.`, [
          { label: 'Delete forever', v: true, cls: 'dng' }, { label: 'Cancel', v: false },
        ]);
        if (!ok) return;
        D.projects = D.projects.filter(x => x.id !== ap.id); save(); closeSheet(true); settingsSheet();
      } }, 'Delete')))) : null;

    const fileIn = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async e => {
      const f = e.target.files?.[0]; if (!f) return;
      try {
        const text = await f.text();
        const data = migrate(JSON.parse(text));
        const ok = await choose('Restore backup?', 'This replaces everything currently in the app.', [
          { label: 'Restore', v: true, cls: 'dng' }, { label: 'Cancel', v: false },
        ]);
        if (!ok) return;
        D = data; save(); closeSheet(); toast('Backup restored'); render();
      } catch { toast('Could not read that file.'); }
      e.target.value = '';
    } });

    const bits = [
      el('div', { class: 'sh-h' }, el('button', { class: 'ib', 'aria-label': 'Back', html: ICON.back, onclick: () => closeSheet() }), el('h2', {}, 'Settings')),
      grp('Theme', themePicker(S().theme || 'peach', id => { S().theme = id; save(); })),
      grp('Reminders',
        it('10 PM catch-up', 'Lists only the projects still empty today', sw(S().catchup, v => { S().catchup = v; save(); if (v) askNotif(); })),
        it('Vibrate on tick', null, sw(S().vibrate, v => { S().vibrate = v; save(); })),
        it('Notifications', perm === 'denied' ? 'Allow them in Chrome site settings' : 'Needed for reminders to reach you', nb)),
      p ? grp('Export · ' + p.name,
        el('div', { class: 'it col' }, exSeg, monBox, rangeBox,
          el('div', { class: 'row2', style: 'margin-top:8px' },
            el('button', { class: 'btn pri', onclick: () => runExport(false) }, 'Save'),
            el('button', { class: 'btn', onclick: () => runExport(true).catch(e => toast('Share failed: ' + (e?.message || e))) }, 'Share'))),
        el('p', { class: 'note', style: 'margin:8px 4px 0' }, 'Save downloads a Word file. Share sends a PNG photo (one per month) — Chrome on Android can\'t share .docx.')) : null,
      grp('Backup',
        el('div', { class: 'it col' },
          el('div', { class: 'row2' },
            el('button', { class: 'btn', onclick: () => {
              const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
              download(blob, `dailylog-backup-${curYM()}.json`);
              toast('Backup saved');
            } }, 'Download backup'),
            el('button', { class: 'btn', onclick: () => fileIn.click() }, 'Restore…')),
          fileIn)),
      archCard,
      el('p', { class: 'note' }, `${APP_NAME} ${VERSION}. Everything stays on this phone. Clearing Chrome site data deletes it — keep monthly exports or a backup.`),
    ].filter(Boolean);
    sh.append(...bits);
  }, 'full');
}

/* ---------------- wiring ---------------- */
$('#addProject').onclick = () => newProject();
$('#setBtn').onclick = () => settingsSheet();
$('#prevM').onclick = () => { viewYM = addMonth(viewYM, -1); scrollTodayOnce = false; render(); };
$('#nextM').onclick = () => { if (viewYM < curYM()) { viewYM = addMonth(viewYM, 1); scrollTodayOnce = viewYM === curYM(); render(); } };
$('#thisMonthBtn').onclick = () => { viewYM = curYM(); scrollTodayOnce = true; render(); };
$('#monthBtn').onclick = () => {
  // simple jump: pick from recent months
  const p = active(); if (!p) return;
  const months = monthKeysFor(p).slice(0, 24);
  openSheet(sh => {
    sh.append(head('Jump to month'),
      el('div', { class: 'card' }, ...months.map(ym => el('button', {
        class: 'it', style: 'width:100%;text-align:left',
        onclick: () => { viewYM = ym; scrollTodayOnce = ym === curYM(); closeSheet(); },
      }, el('div', { class: 'l' }, el('div', {}, monthLabel(ym)), el('small', {}, `${filledCount(p, ym)} days logged`))))));
  });
};
$('#infoLine').onclick = () => editInfo();
$('#projMenu').onclick = () => projectMenu(active());
$('#addCol').onclick = () => addColumn();
$('#copyYest').onclick = () => copyYesterday();

// (month swipe removed in 1.2.1: change months with ◀ ▶ or the month list)

document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(); render(); } });
navigator.serviceWorker?.addEventListener('message', e => {
  if (e.data?.type === 'open' && e.data.projectId) {
    D.activeId = e.data.projectId; viewYM = curYM(); scrollTodayOnce = true; save(); render();
  }
});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadSW = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.register('sw.js').then(r => document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update().catch(() => {}); })).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW && !reloaded) { reloaded = true; location.reload(); } });
}

render();
checkReminders();
setInterval(checkReminders, 60000);

function fitCell(t){ t.style.height='auto'; t.style.height=Math.max(44,t.scrollHeight)+'px'; }

/* ---------------- column widths: Auto (fit content) or manual drag ---------------- */
var _mctx;
function textW(t, font) { _mctx = _mctx || document.createElement('canvas').getContext('2d'); _mctx.font = font; return _mctx.measureText(t).width; }
function autoWidth(p, c) {
  let w = textW(c.name.toUpperCase(), '650 12px system-ui,sans-serif') * 1.05 + 32 + (c.locked ? 18 : 0);
  if (c.type !== 'tick') {
    const f = (c.type === 'text' ? '500 15px' : '600 15px') + ' system-ui,sans-serif';
    Object.values(p.months[viewYM]?.days || {}).forEach(x => { const v = x[c.id]; if (v) String(v).split('\n').forEach(l => { w = Math.max(w, textW(l, f) + 26); }); });
  }
  return Math.round(Math.min(240, Math.max(({ tick: 56, text: 96, times: 72, number: 64 })[c.type] || 64, w)));
}
function setColW(i, w) {
  $('#grid').querySelectorAll(`tr > :nth-child(${i + 2})`).forEach(n => { n.style.width = n.style.minWidth = n.style.maxWidth = w + 'px'; });
}
function applyWidths(p) { p.columns.forEach((c, i) => setColW(i, c.w || autoWidth(p, c))); refitCells(); }
function refitCells() { requestAnimationFrame(() => document.querySelectorAll('#grid textarea.cin').forEach(fitCell)); }
(() => {
  let drag = null, lastUp = { id: null, t: 0 };
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest?.('.rz'); if (!h) return;
    e.preventDefault(); e.stopPropagation();
    const p = active(); const i = p.columns.findIndex(c => c.id === h.dataset.col); if (i < 0) return;
    drag = { p, i, c: p.columns[i], x0: e.clientX, w0: h.parentElement.getBoundingClientRect().width, moved: false };
    h.setPointerCapture?.(e.pointerId); h.classList.add('on');
  }, true);
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x0; if (Math.abs(dx) > 3) drag.moved = true;
    drag.w = Math.round(Math.min(480, Math.max(48, drag.w0 + dx))); setColW(drag.i, drag.w);
  }, true);
  const end = e => {
    if (!drag) return; const d = drag; drag = null;
    document.querySelectorAll('.rz.on').forEach(x => x.classList.remove('on'));
    if (d.moved) { d.c.w = d.w; save(); refitCells(); lastUp = { id: null, t: 0 }; return; }
    const now = Date.now();
    if (lastUp.id === d.c.id && now - lastUp.t < 350) { d.c.w = null; save(); applyWidths(d.p); toast(d.c.name + ': auto width'); lastUp = { id: null, t: 0 }; }
    else lastUp = { id: d.c.id, t: now };
  };
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', end, true);
  document.addEventListener('click', e => { if (e.target.closest?.('.rz')) { e.preventDefault(); e.stopPropagation(); } }, true);
})();
