/* Ядро ЭУИ: хранилище, защита данных, язык интерфейса, маршрутизация, боковая панель. */
(function () {
  'use strict';
  const C = window.COURSE;
  const App = (window.App = { C, routes: {} });

  /* ---------- утилиты ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmtDate = (ts) => { const d = new Date(ts); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtDur = (s) => { s = Math.round(s || 0); const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин ${s % 60} с`; };
  Object.assign(App, { $, $$, esc, pad, shuffle, fmtDate, fmtDur });

  /* ---------- SHA-256 (для PIN-кодов и контрольной суммы результатов) ---------- */
  function sha256(ascii) {
    const rr = (v, a) => (v >>> a) | (v << (32 - a));
    const bytes = unescape(encodeURIComponent(ascii));
    const K = [], H = [];
    let primeCounter = 0; const isComposite = {};
    for (let c = 2; primeCounter < 64; c++) {
      if (!isComposite[c]) {
        for (let i = 0; i < 313; i += c) isComposite[i] = c;
        H[primeCounter] = (Math.pow(c, 0.5) * 4294967296) | 0;
        K[primeCounter++] = (Math.pow(c, 1 / 3) * 4294967296) | 0;
      }
    }
    const hash = H.slice(0, 8);
    const words = [];
    let s = bytes + '\x80';
    while (s.length % 64 - 56) s += '\x00';
    for (let i = 0; i < s.length; i++) words[i >> 2] |= s.charCodeAt(i) << ((3 - i) % 4) * 8;
    words[words.length] = ((bytes.length * 8) / 4294967296) | 0;
    words[words.length] = bytes.length * 8;
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, (j += 16));
      const old = hash.slice(0);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + K[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash.unshift((t1 + t2) | 0);
        hash[4] = (hash[4] + t1) | 0;
        hash.pop();
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    return hash.map((h) => ('00000000' + (h >>> 0).toString(16)).slice(-8)).join('');
  }
  App.sha256 = sha256;
  const SALT = 'abd-eui-2025:';
  App.hashPin = (pin) => sha256(SALT + 'pin:' + pin);

  /* ---------- хранилище ---------- */
  const KEY = 'abd-etextbook-v1';
  const defaults = () => ({
    v: 1, users: {}, current: null, progress: {},
    settings: {
      lang: 'ru', pass: 60,
      time: { lesson: 10, block: 15, module: 20, final: 40, diag: 40, free: 20 },   // минуты
      count: { lesson: 5, block: 3, module: 2, final: 2, diag: 2 },                  // вопросов на урок
      teacherHash: null,
    },
  });
  let persistent = true;
  try { const k = '__abd_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); } catch (e) { persistent = false; }
  let DB;
  try { DB = JSON.parse((persistent && localStorage.getItem(KEY)) || 'null') || defaults(); } catch (e) { DB = defaults(); }
  const d0 = defaults();
  DB.settings = Object.assign(d0.settings, DB.settings || {});
  DB.settings.time = Object.assign(d0.settings.time, DB.settings.time);
  DB.settings.count = Object.assign(d0.settings.count, DB.settings.count);
  App.persistent = persistent;

  const sign = (p) => { const c = Object.assign({}, p); delete c.sig; return sha256(SALT + JSON.stringify(c)); };
  App.save = function () {
    // подписываются все профили: у остальных подпись не меняется, если их данные не менялись
    Object.keys(DB.progress).forEach((uid) => { const p = DB.progress[uid]; if (p && (uid === DB.current || !p.sig)) p.sig = sign(p); });
    if (!persistent) return;
    try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { persistent = false; App.showStorageWarn(); }
  };
  App.integrityOk = (uid) => { const p = DB.progress[uid]; return !p || (!p.tampered && (!p.sig || p.sig === sign(p))); };
  // проверка при загрузке, до любого сохранения: изменённые вне пособия результаты помечаются навсегда
  Object.keys(DB.progress).forEach((uid) => {
    const p = DB.progress[uid];
    if (p && p.sig && p.sig !== sign(p) && !p.tampered) p.tampered = Date.now();
  });
  App.db = () => DB;
  App.settings = () => DB.settings;
  App.replaceDB = (obj) => { DB = Object.assign(defaults(), obj); App.save(); };

  /* ---------- структура курса ---------- */
  const lessonsFlat = [], blocksFlat = [];
  C.structure.modules.forEach((m, mi) => m.blocks.forEach((b) => {
    blocksFlat.push(Object.assign({ module: m }, b));
    b.lessons.forEach((l) => lessonsFlat.push(Object.assign({ lid: pad(l.number), block: b, module: m, mi }, l)));
  }));
  App.lessons = lessonsFlat;
  App.blocks = blocksFlat;
  App.modules = C.structure.modules;
  App.lesson = (lid) => lessonsFlat.find((l) => l.lid === lid);
  App.lessonData = (lid) => C.lessons[lid];
  const testCache = {};
  App.lessonTests = (lid) => {
    if (!testCache[lid]) {
      const raw = atob(C.lessons[lid].tests);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      testCache[lid] = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    }
    return testCache[lid];
  };

  /* ---------- язык интерфейса ---------- */
  App.lang = () => DB.settings.lang || 'ru';
  App.t = function (key, vars) {
    const dict = App.I18N[App.lang()] || App.I18N.ru;
    let s = dict[key] != null ? dict[key] : (App.I18N.ru[key] != null ? App.I18N.ru[key] : key);
    if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  };
  App.title = (o) => (App.lang() === 'kk' && o.title_kk ? o.title_kk : o.title_ru);

  /* ---------- пользователь и прогресс ---------- */
  App.user = () => (DB.current && DB.users[DB.current]) || null;
  App.progress = function (uid) {
    uid = uid || DB.current;
    if (!uid) return null;
    if (!DB.progress[uid]) DB.progress[uid] = { lessons: {}, results: [], traj: { mode: 'full', list: lessonsFlat.map((l) => l.number), chosen: false }, last: null, time: {}, mode: 'learn' };
    return DB.progress[uid];
  };
  App.lp = function (lid, uid) {
    const p = App.progress(uid);
    if (!p) return null;
    if (!p.lessons[lid]) p.lessons[lid] = { seen: {}, q: {}, best: null, last: null, tries: 0, cycle: 1 };
    return p.lessons[lid];
  };
  App.learning = () => !!App.user() && App.progress().mode !== 'view';
  App.inTraj = (n, uid) => { const p = App.progress(uid); return !p || p.traj.list.indexOf(n) >= 0; };
  App.lessonStatus = function (lid, uid) {
    const p = App.progress(uid);
    if (!p) return 'new';
    const s = p.lessons[lid];
    if (!s) return 'new';
    if (s.last != null && s.last < DB.settings.pass) return 'repeat';
    if (s.best != null && s.best >= DB.settings.pass) return 'done';
    return Object.keys(s.seen).length ? 'prog' : 'new';
  };
  App.questionsDone = function (lid) {
    const s = App.lp(lid);
    const qs = C.lessons[lid].questions;
    return !!s && qs.every((q) => s.q[q.id]);
  };
  App.controlPassed = function (scopeId, uid) {
    const p = App.progress(uid);
    return !!p && p.results.some((r) => r.scope === scopeId && r.recorded && r.percent >= DB.settings.pass);
  };
  App.trajLessons = (filter) => lessonsFlat.filter((l) => App.inTraj(l.number) && (!filter || filter(l)));
  App.blockReady = function (b) {
    const ls = App.trajLessons((l) => l.block.id === b.id);
    return ls.length > 0 && ls.every((l) => App.lessonStatus(l.lid) === 'done');
  };
  App.moduleReady = function (m) {
    const bs = m.blocks.filter((b) => App.trajLessons((l) => l.block.id === b.id).length);
    return bs.length > 0 && bs.every((b) => App.controlPassed('block:' + b.id));
  };
  App.finalReady = function () {
    const ms = App.modules.filter((m) => App.trajLessons((l) => l.module.id === m.id).length);
    return ms.length > 0 && ms.every((m) => App.controlPassed('module:' + m.id));
  };

  /* ---------- маршрутизация ---------- */
  App.go = (h) => { if (location.hash === h) App.render(); else location.hash = h; };
  App.parse = function () {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const query = {};
    (qs || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); query[k] = decodeURIComponent(v || ''); });
    return { name: parts[0] || 'home', parts, query };
  };
  let leaveGuard = null;
  App.setLeaveGuard = (fn) => { leaveGuard = fn; };
  let lastHash = location.hash;
  App.render = function () {
    if (leaveGuard && !leaveGuard()) { history.replaceState(null, '', lastHash || '#/'); return; }
    leaveGuard = null;
    lastHash = location.hash;
    const r = App.parse();
    App.route = r;
    const view = App.routes[r.name] || App.routes.notfound;
    const main = $('#main');
    main.innerHTML = '';
    document.body.classList.remove('menu-open');
    try { view(main, r); } catch (e) { console.error(e); main.innerHTML = `<div class="note important"><strong>${esc(App.t('error'))}</strong> ${esc(e.message)}</div>`; }
    App.renderChrome();
    window.scrollTo(0, 0);
    if (App.user() && r.name !== 'test' && r.name !== 'users') { App.progress().last = location.hash; App.save(); }
  };

  /* ---------- оформление: верхняя панель, боковая панель, подсказки ---------- */
  App.renderChrome = function () {
    document.documentElement.lang = App.lang() === 'kk' ? 'kk' : 'ru';
    $('#brandText').textContent = App.title(C.meta);
    $$('[data-i18n]').forEach((el) => { el.textContent = App.t(el.dataset.i18n); });
    $('#langBtn').textContent = App.lang() === 'kk' ? 'RU' : 'KZ';
    const u = App.user();
    $('#userPill').textContent = u ? u.name : App.t('signIn');
    $$('.topnav a').forEach((a) => a.classList.toggle('active', location.hash.indexOf(a.getAttribute('href')) === 0));
    App.renderSidebar();
  };

  App.renderSidebar = function () {
    const side = $('#sidebar');
    const r = App.route || {};
    const cur = r.name === 'lesson' ? r.parts[1] : null;
    const curCtl = r.name === 'control' ? r.parts[1] + ':' + r.parts[2] : (r.name === 'control' ? 'final' : null);
    const learning = App.learning();
    let h = `<div class="side-title">${esc(App.t('toc'))}</div>`;
    App.modules.forEach((m, mi) => {
      h += `<div class="side-mod"><div class="side-head">${esc(App.t('module'))} ${mi + 1}. ${esc(App.title(m))}</div>`;
      m.blocks.forEach((b) => {
        h += `<div class="side-block"><div class="side-head">${esc(App.t('block'))} ${esc(b.id.slice(1))}. ${esc(App.title(b))}</div>`;
        b.lessons.forEach((l) => {
          const lid = pad(l.number);
          const st = App.lessonStatus(lid);
          const off = learning && !App.inTraj(l.number);
          const icon = st === 'done' ? '✓' : st === 'repeat' ? '!' : '';
          const tip = off ? App.t('notInTraj') : App.t('st_' + st);
          h += `<a class="side-link${cur === lid ? ' active' : ''}${off ? ' off' : ''}" href="#/lesson/${lid}/theory" data-title="${esc(tip)}"><span class="dot ${st}${off ? ' skip' : ''}">${icon}</span><span>${l.number}. ${esc(App.title(l))}</span></a>`;
        });
        if (learning) h += ctlLink('block', b.id, App.t('blockTest'), curCtl);
        h += '</div>';
      });
      if (learning) h += ctlLink('module', m.id, App.t('moduleTest'), curCtl);
      h += '</div>';
    });
    if (learning) h += ctlLink('final', 'all', App.t('finalTest'), curCtl);
    side.innerHTML = h;
  };
  function ctlLink(type, id, label, cur) {
    const scope = type === 'final' ? 'final' : type + ':' + id;
    const passed = App.controlPassed(scope);
    const ready = type === 'block' ? App.blockReady(App.blocks.find((b) => b.id === id)) : type === 'module' ? App.moduleReady(App.modules.find((m) => m.id === id)) : App.finalReady();
    const tip = passed ? App.t('passed') : ready ? App.t('available') : App.t('locked');
    return `<a class="side-link ctl${cur === type + ':' + id ? ' active' : ''}" href="#/control/${type}/${id}" data-title="${esc(tip)}"><span class="dot ${passed ? 'done' : ready ? 'prog' : ''}">${passed ? '✓' : ''}</span><span>${esc(label)}</span></a>`;
  }

  // всплывающие подсказки на языке интерфейса (§11: элементы управления с подсказкой)
  const tipEl = () => $('#tooltip');
  function showTip(el) {
    const txt = el.dataset.title || (el.dataset.tip && App.t('tip_' + el.dataset.tip));
    if (!txt) return;
    const t = tipEl();
    t.textContent = txt;
    t.hidden = false;
    const r = el.getBoundingClientRect();
    const w = Math.min(300, t.offsetWidth);
    let x = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
    let y = r.bottom + 8;
    if (y + t.offsetHeight > window.innerHeight - 8) y = r.top - t.offsetHeight - 8;
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }
  document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tip],[data-title]'); if (el) showTip(el); });
  document.addEventListener('mouseout', (e) => { if (e.target.closest('[data-tip],[data-title]')) tipEl().hidden = true; });
  document.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip],[data-title]'); if (el) showTip(el); else tipEl().hidden = true; });
  document.addEventListener('touchstart', () => { tipEl().hidden = true; }, { passive: true });

  /* ---------- модальное окно ---------- */
  App.modal = function (html, onMount) {
    const m = $('#modal');
    $('#modalBody').innerHTML = html;
    m.hidden = false;
    const close = () => { m.hidden = true; $('#modalBody').innerHTML = ''; };
    m.onclick = (e) => { if (e.target === m) close(); };
    if (onMount) onMount($('#modalBody'), close);
    const f = $('#modalBody input, #modalBody button');
    if (f) f.focus();
    return close;
  };
  App.confirm = (text, ok) => App.modal(`<p>${esc(text)}</p><div class="actions"><button class="btn" id="mOk">${esc(App.t('yes'))}</button><button class="btn secondary" id="mNo">${esc(App.t('cancel'))}</button></div>`,
    (b, close) => { $('#mOk', b).onclick = () => { close(); ok(); }; $('#mNo', b).onclick = close; });

  /* ---------- окружение: iframe Google Sites, недоступное хранилище ---------- */
  App.inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  App.showStorageWarn = function () {
    const w = $('#storageWarn');
    w.hidden = false;
    w.textContent = App.t(App.inFrame ? 'storageWarnFrame' : 'storageWarn');
  };

  /* ---------- учёт времени изучения урока ---------- */
  setInterval(() => {
    const r = App.route;
    if (!r || r.name !== 'lesson' || document.hidden || !App.user()) return;
    const p = App.progress();
    p.time[r.parts[1]] = (p.time[r.parts[1]] || 0) + 15;
    App.save();
  }, 15000);

  /* ---------- запуск ---------- */
  App.start = function () {
    $('#menuBtn').onclick = () => document.body.classList.toggle('menu-open');
    $('#scrim').onclick = () => document.body.classList.remove('menu-open');
    $('#langBtn').onclick = () => { DB.settings.lang = App.lang() === 'kk' ? 'ru' : 'kk'; App.save(); App.render(); };
    if (App.inFrame) {
      const b = $('#newWinBtn');
      b.hidden = false;
      b.onclick = () => window.open(location.href, '_blank', 'noopener');
    }
    if (!persistent) App.showStorageWarn();
    window.addEventListener('hashchange', App.render);
    window.addEventListener('beforeunload', (e) => { if (App.running) { e.preventDefault(); e.returnValue = ''; } });
    App.render();
  };
})();
