/* Тестирование (текущий, промежуточный, рубежный, итоговый контроль; диагностика; свободное тестирование),
   результаты с переходом к ошибкам, статистика, панель преподавателя. */
(function () {
  'use strict';
  const App = window.App;
  const { $, $$, esc, t } = { $: App.$, $$: App.$$, esc: App.esc, t: App.t };

  /* ---------- формирование набора вопросов случайной выборкой из базы ---------- */
  function pick(lids, perLesson) {
    let items = [];
    lids.forEach((lid) => {
      App.shuffle(App.lessonTests(lid)).slice(0, perLesson).forEach((it) => items.push({ lid, it }));
    });
    return App.shuffle(items);
  }
  function scopeInfo(type, id) {
    const S = App.settings();
    if (type === 'lesson') {
      const L = App.lesson(id);
      return { scope: 'lesson:' + id, title: `${t('currentControl')}: ${t('lesson')} ${L.number}`, lids: [id], per: S.count.lesson, minutes: S.time.lesson, back: `#/lesson/${id}/test` };
    }
    if (type === 'block') {
      const b = App.blocks.find((x) => x.id === id);
      return { scope: 'block:' + id, title: `${t('blockTest')} ${id.slice(1)}. ${App.title(b)}`, lids: App.trajLessons((l) => l.block.id === id).map((l) => l.lid), per: S.count.block, minutes: S.time.block, back: '#/toc' };
    }
    if (type === 'module') {
      const m = App.modules.find((x) => x.id === id);
      return { scope: 'module:' + id, title: `${t('moduleTest')}: ${App.title(m)}`, lids: App.trajLessons((l) => l.module.id === id).map((l) => l.lid), per: S.count.module, minutes: S.time.module, back: '#/toc' };
    }
    if (type === 'final') return { scope: 'final', title: t('finalTest'), lids: App.lessons.map((l) => l.lid), per: S.count.final, minutes: S.time.final, back: '#/toc' };
    if (type === 'diag') return { scope: 'diag', title: t('diagTest'), lids: App.lessons.map((l) => l.lid), per: S.count.diag, minutes: S.time.diag, back: '#/toc' };
    return null;
  }

  /* ---------- страница контрольного теста: условия и запуск ---------- */
  App.routes.control = function (main, r) {
    const type = r.parts[1], id = r.parts[2];
    if (!App.user()) { main.innerHTML = `<div class="note">${esc(t('needUser'))}</div><a class="btn" href="#/users">${esc(t('register'))}</a>`; return; }
    if (type === 'lesson') { App.go(`#/lesson/${id}/test`); return; }
    const info = scopeInfo(type, id);
    if (!info) return App.routes.notfound(main);
    let ready = true, why = '';
    if (type === 'block') { ready = App.blockReady(App.blocks.find((b) => b.id === id)); why = t('lockBlock'); }
    if (type === 'module') { ready = App.moduleReady(App.modules.find((m) => m.id === id)); why = t('lockModule'); }
    if (type === 'final') { ready = App.finalReady() || App.trajLessons().length === 0; why = t('lockFinal'); }
    if ((type === 'block' || type === 'module') && !info.lids.length) { ready = false; why = t('lockEmpty'); }
    const kind = { block: 'kindBlock', module: 'kindModule', final: 'kindFinal', diag: 'kindDiag' }[type];
    const n = info.lids.length * info.per;
    const res = App.progress().results.filter((x) => x.scope === info.scope).slice(-5).reverse();
    main.innerHTML = `<h1>${esc(info.title)}</h1><p class="lead">${esc(t(kind))}</p>
      <div class="card soft"><ul><li>${esc(t('ctlRule1', { n, per: info.per }))}</li><li>${esc(t('testRule2', { m: info.minutes }))}</li><li>${esc(t(type === 'diag' ? 'diagRule' : 'testRule3', { p: App.settings().pass }))}</li><li>${esc(t('testRule4'))}</li></ul>
      ${ready ? '' : `<div class="note important"><strong>${esc(t('testLocked'))}</strong> ${esc(why)}</div>`}
      <div class="actions"><button class="btn" id="go" ${ready ? '' : 'disabled'} data-tip="startTest">${esc(t('startTest'))}</button><a class="btn secondary" href="#/tests">${esc(t('practice'))}</a></div></div>
      ${res.length ? `<h3>${esc(t('attempts'))}</h3><ul>${res.map((x) => `<li>${App.fmtDate(x.date)} — <a href="#/result/${x.id}">${x.correct}/${x.total} (${x.percent}%)</a></li>`).join('')}</ul>` : ''}`;
    const b = $('#go', main);
    if (b) b.onclick = () => App.startControl(type, id);
  };

  App.startControl = function (type, id) {
    const info = scopeInfo(type, id);
    startTest({ type, scope: info.scope, title: info.title, items: pick(info.lids, info.per), minutes: info.minutes, recorded: true, back: info.back });
  };

  /* ---------- свободное тестирование: с фиксацией или без фиксации результатов ---------- */
  App.routes.tests = function (main, r) {
    const S = App.settings();
    const pre = r.query.scope || 'all';
    let opts = `<option value="all">${esc(t('wholeCourse'))}</option>`;
    App.modules.forEach((m, mi) => {
      opts += `<option value="module:${m.id}">${esc(t('module'))} ${mi + 1}. ${esc(App.title(m))}</option>`;
      m.blocks.forEach((b) => {
        opts += `<option value="block:${b.id}">&nbsp;&nbsp;${esc(t('block'))} ${esc(b.id.slice(1))}. ${esc(App.title(b))}</option>`;
        b.lessons.forEach((l) => { opts += `<option value="lesson:${App.pad(l.number)}">&nbsp;&nbsp;&nbsp;&nbsp;${esc(t('lesson'))} ${l.number}. ${esc(App.title(l))}</option>`; });
      });
    });
    const u = App.user();
    main.innerHTML = `<h1>${esc(t('testing'))}</h1><p class="lead">${esc(t('testingLead'))}</p>
      <form class="card soft" id="tf">
        <label for="tScope">${esc(t('scope'))}</label><select id="tScope">${opts}</select>
        <label for="tN">${esc(t('qCount'))}</label><input type="number" id="tN" min="1" max="150" value="10">
        <label for="tM">${esc(t('timeLimit'))}</label><input type="number" id="tM" min="0" max="180" value="${S.time.free}">
        <label class="check"><input type="checkbox" id="tRec" ${u ? 'checked' : 'disabled'}> ${esc(t('recordResults'))}</label>
        ${u ? '' : `<p class="muted">${esc(t('recordNeedUser'))}</p>`}
        <div class="error-text" id="tErr"></div>
        <div class="actions"><button class="btn" type="submit" data-tip="startTest">${esc(t('startTest'))}</button></div></form>
      ${u && App.learning() ? `<h2>${esc(t('controlTests'))}</h2><div class="grid2">${controlCards()}</div>` : ''}`;
    const sel = $('#tScope', main);
    sel.value = Array.from(sel.options).some((o) => o.value === pre) ? pre : 'all';
    $('#tf', main).onsubmit = (e) => {
      e.preventDefault();
      const v = sel.value;
      let lids;
      if (v === 'all') lids = App.lessons.map((l) => l.lid);
      else if (v.startsWith('module:')) lids = App.lessons.filter((l) => l.module.id === v.slice(7)).map((l) => l.lid);
      else if (v.startsWith('block:')) lids = App.lessons.filter((l) => l.block.id === v.slice(6)).map((l) => l.lid);
      else lids = [v.slice(7)];
      const n = parseInt($('#tN').value, 10), m = parseInt($('#tM').value, 10);
      const pool = lids.reduce((a, l) => a + App.lessonTests(l).length, 0);
      if (!(n >= 1)) { $('#tErr').textContent = t('errCount'); return; }
      if (!(m >= 0)) { $('#tErr').textContent = t('errTime'); return; }
      const items = App.shuffle(pick(lids, 100)).slice(0, Math.min(n, pool));
      startTest({ type: 'free', scope: 'free:' + v, title: `${t('testing')}: ${sel.options[sel.selectedIndex].text.trim()}`, items, minutes: m, recorded: !!(u && $('#tRec').checked), back: '#/tests' });
    };
  };
  function controlCards() {
    let h = '';
    App.blocks.forEach((b) => { h += card('block', b.id, `${t('blockTest')} ${b.id.slice(1)}`, App.blockReady(b)); });
    App.modules.forEach((m, i) => { h += card('module', m.id, `${t('moduleTest')} ${i + 1}`, App.moduleReady(m)); });
    h += card('final', 'all', t('finalTest'), App.finalReady());
    return h;
    function card(type, id, label, ready) {
      const passed = App.controlPassed(type === 'final' ? 'final' : type + ':' + id);
      return `<a class="card" style="text-decoration:none;color:inherit" href="#/control/${type}/${id}"><strong>${esc(label)}</strong><br><span class="badge ${passed ? 'ok' : ready ? 'blue' : ''}">${esc(t(passed ? 'passed' : ready ? 'available' : 'locked'))}</span></a>`;
    }
  }

  /* ---------- прохождение теста ---------- */
  function startTest(cfg) {
    if (!cfg.items.length) { alert(t('noItems')); return; }
    App.running = {
      cfg,
      items: cfg.items.map(({ lid, it }) => ({ lid, it, order: App.shuffle(it.options.map((_, k) => k)) })),
      answers: {}, cur: 0, started: Date.now(),
      deadline: cfg.minutes > 0 ? Date.now() + cfg.minutes * 60000 : null,
    };
    App.go('#/test');
  }
  let tick = null;
  App.routes.test = function (main) {
    const R = App.running;
    if (!R) { main.innerHTML = `<div class="note">${esc(t('noRunning'))}</div><a class="btn" href="#/tests">${esc(t('testing'))}</a>`; return; }
    App.setLeaveGuard(() => !App.running || confirm(t('leaveTest')));
    const it = R.items[R.cur];
    const ans = R.answers[R.cur];
    main.innerHTML = `<h1>${esc(R.cfg.title)}</h1>
      <div class="test-bar"><span>${esc(t('question'))} ${R.cur + 1} / ${R.items.length}</span>
        <span class="timer" id="timer" data-tip="timer"></span>
        <span class="muted">${esc(t('answeredN', { n: Object.keys(R.answers).length, total: R.items.length }))}</span>
        <button class="btn secondary" id="finish" style="margin-left:auto" data-tip="finish">${esc(t('finish'))}</button></div>
      <div class="qnav">${R.items.map((_, k) => `<button class="${R.answers[k] != null ? 'answered' : ''} ${k === R.cur ? 'cur' : ''}" data-k="${k}" aria-label="${esc(t('question'))} ${k + 1}">${k + 1}</button>`).join('')}</div>
      <div class="q"><div class="q-head"><span>${esc(t('lesson'))} ${+it.lid}</span><span>${'●'.repeat(it.it.level)}${'○'.repeat(3 - it.it.level)}</span></div>
      <div class="q-text">${esc(it.it.text)}</div>
      ${it.order.map((k) => `<label class="opt ${ans === k ? 'sel' : ''}"><input type="radio" name="tq" value="${k}" ${ans === k ? 'checked' : ''}><span>${esc(it.it.options[k])}</span></label>`).join('')}</div>
      <div class="actions"><button class="btn secondary" id="prev" ${R.cur === 0 ? 'disabled' : ''}>← ${esc(t('prev'))}</button>
      ${R.cur < R.items.length - 1 ? `<button class="btn" id="next">${esc(t('next'))} →</button>` : `<button class="btn" id="finish2">${esc(t('finish'))}</button>`}</div>`;
    $$('[name=tq]', main).forEach((x) => (x.onchange = () => { R.answers[R.cur] = +x.value; $$('.opt', main).forEach((o) => o.classList.toggle('sel', $('input', o).checked)); $$('.qnav button')[R.cur].classList.add('answered'); }));
    $$('.qnav button', main).forEach((b) => (b.onclick = () => { R.cur = +b.dataset.k; App.render(); }));
    const prev = $('#prev', main), next = $('#next', main);
    if (prev) prev.onclick = () => { R.cur--; App.render(); };
    if (next) next.onclick = () => { R.cur++; App.render(); };
    const fin = () => {
      const left = R.items.length - Object.keys(R.answers).length;
      if (left) App.confirm(t('finishConfirm', { n: left }), finishTest); else finishTest();
    };
    $('#finish', main).onclick = fin;
    if ($('#finish2', main)) $('#finish2', main).onclick = fin;
    clearInterval(tick);
    const paint = () => {
      const el = $('#timer');
      if (!App.running || !el) { clearInterval(tick); return; }
      if (!R.deadline) { el.textContent = '∞'; return; }
      const s = Math.max(0, Math.round((R.deadline - Date.now()) / 1000));
      el.textContent = `${App.pad(Math.floor(s / 60))}:${App.pad(s % 60)}`;
      el.classList.toggle('low', s < 60);
      if (s <= 0) { clearInterval(tick); alert(t('timeOver')); finishTest(); }
    };
    paint();
    tick = setInterval(paint, 1000);
  };

  function finishTest() {
    const R = App.running;
    if (!R) return;
    clearInterval(tick);
    App.running = null;
    App.setLeaveGuard(null);
    const S = App.settings();
    const details = R.items.map((x, k) => ({ lid: x.lid, id: x.it.id, chosen: R.answers[k] != null ? R.answers[k] : null, order: x.order, ok: R.answers[k] === x.it.correct }));
    const correct = details.filter((d) => d.ok).length;
    const percent = Math.round((correct / details.length) * 100);
    const res = {
      id: 'r' + Date.now().toString(36), type: R.cfg.type, scope: R.cfg.scope, title: R.cfg.title, date: Date.now(),
      duration: Math.round((Date.now() - R.started) / 1000), total: details.length, correct, percent,
      passed: percent >= S.pass, recorded: R.cfg.recorded, back: R.cfg.back, details,
    };
    if (R.cfg.recorded && App.user()) {
      const p = App.progress();
      p.results.push(res);
      if (res.type === 'lesson') {
        const lid = res.scope.slice(7), s = App.lp(lid);
        s.tries++;
        s.last = percent;
        s.best = Math.max(s.best || 0, percent);
        if (!res.passed) { s.q = {}; s.cycle++; }   // недостаточно правильных ответов — повторить урок
      }
      if (res.type === 'diag') {
        const weak = App.lessons.filter((l) => {
          const ds = details.filter((d) => d.lid === l.lid);
          return ds.length && (ds.filter((d) => d.ok).length / ds.length) * 100 < S.pass;
        }).map((l) => l.number);
        p.traj = { mode: 'test', list: weak, chosen: true };
        res.weak = weak;
      }
      App.save();
    } else {
      App.lastUnrecorded = res;
    }
    App.go('#/result/' + (res.recorded ? res.id : 'last'));
  }

  /* ---------- результат и свободный переход к вопросам с ошибками ---------- */
  App.findResult = (id) => (id === 'last' ? App.lastUnrecorded : App.user() && App.progress().results.find((r) => r.id === id));
  App.routes.result = function (main, r) {
    const res = App.findResult(r.parts[1]);
    if (!res) return App.routes.notfound(main);
    const k = r.query.q != null ? +r.query.q : null;
    const bank = (lid, id) => App.lessonTests(lid).find((x) => x.id === id);
    const wrong = res.details.map((d, i) => (d.ok ? null : i)).filter((x) => x != null);
    let h = `<h1>${esc(res.title)}</h1><p class="muted">${App.fmtDate(res.date)} · ${esc(t('duration'))}: ${App.fmtDur(res.duration)} · ${esc(t(res.recorded ? 'recorded' : 'notRecorded'))}</p>
      <div class="card"><div class="score ${res.passed ? 'pass' : 'fail'}">${res.correct} / ${res.total} · ${res.percent}%</div>
      <p><strong>${esc(t(res.passed ? 'resPass' : 'resFail'))}</strong> ${esc(t(res.passed ? 'resPassText' : 'resFailText', { p: App.settings().pass }))}</p>`;
    if (res.type === 'diag' && res.weak) h += `<div class="note">${esc(res.weak.length ? t('diagResult', { list: res.weak.join(', ') }) : t('diagAllGood'))}</div>`;
    if (res.type === 'lesson' && !res.passed && res.recorded) h += `<div class="note important"><strong>${esc(t('repeatTitle'))}</strong> ${esc(t('repeatText'))}</div>`;
    h += `<div class="qnav">${res.details.map((d, i) => `<button class="${d.ok ? 'right' : 'wrong'} ${k === i ? 'cur' : ''}" data-k="${i}" aria-label="${esc(t('question'))} ${i + 1}: ${esc(t(d.ok ? 'fbRight' : 'fbWrongShort'))}">${i + 1}</button>`).join('')}</div>
      <p class="muted">${esc(t(wrong.length ? 'reviewHint' : 'reviewHintAll'))}</p>
      <div class="actions">${wrong.length ? `<button class="btn" id="firstWrong">${esc(t('toFirstWrong'))}</button>` : ''}
      ${res.type === 'lesson' && !res.passed ? `<a class="btn secondary" href="#/lesson/${res.scope.slice(7)}/theory">${esc(t('repeatLesson'))}</a>` : ''}
      ${res.type === 'diag' ? `<a class="btn" href="#/toc">${esc(t('toToc'))}</a>` : `<a class="btn secondary" href="${esc(res.back || '#/toc')}">${esc(t('back'))}</a>`}</div></div>`;
    if (k != null && res.details[k]) {
      const d = res.details[k], it = bank(d.lid, d.id);
      if (it) {
        h += `<div class="q" id="rev"><div class="q-head"><span>${esc(t('question'))} ${k + 1} · ${esc(t('lesson'))} ${+d.lid}</span><span class="badge ${d.ok ? 'ok' : 'bad'}">${esc(t(d.ok ? 'fbRight' : d.chosen == null ? 'noAnswer' : 'fbWrongShort'))}</span></div><div class="q-text">${esc(it.text)}</div>
        ${d.order.map((o) => {
          const cls = o === it.correct ? 'right' : o === d.chosen ? 'wrong' : '';
          const mark = o === it.correct ? '✓ ' : o === d.chosen ? '✗ ' : '';
          return `<div class="opt ${cls}"><span>${mark}${esc(it.options[o])}${o === d.chosen ? ` <em>(${esc(t('yourChoice'))})</em>` : ''}<span class="why">${esc(it.feedback[o])}</span></span></div>`;
        }).join('')}
        <div class="feedback ${d.ok ? 'ok' : 'bad'}"><div class="fb-title">${esc(t(d.ok ? 'fbRight' : 'fbWhy'))}</div>${esc(it.feedback[it.correct])} <a href="#/lesson/${d.lid}/theory">${esc(t('toTheory'))}</a></div>
        <div class="actions">${prevNextWrong(wrong, k)}</div></div>`;
      }
    }
    main.innerHTML = h;
    $$('.qnav button', main).forEach((b) => (b.onclick = () => App.go(`#/result/${r.parts[1]}?q=${b.dataset.k}`)));
    $$('[data-goto]', main).forEach((b) => (b.onclick = () => App.go(`#/result/${r.parts[1]}?q=${b.dataset.goto}`)));
    const fw = $('#firstWrong', main);
    if (fw) fw.onclick = () => App.go(`#/result/${r.parts[1]}?q=${wrong[0]}`);
    if (k != null) { const rev = $('#rev'); if (rev) setTimeout(() => rev.scrollIntoView({ block: 'start' }), 0); }
  };
  function prevNextWrong(wrong, k) {
    const nx = wrong.find((i) => i > k), pv = wrong.slice().reverse().find((i) => i < k);
    return (pv != null ? `<button class="btn secondary" data-goto="${pv}">← ${esc(t('prevWrong'))}</button>` : '') + (nx != null ? `<button class="btn" data-goto="${nx}">${esc(t('nextWrong'))} →</button>` : '');
  }

  /* ---------- статистика ---------- */
  App.routes.stats = function (main) {
    const u = App.user();
    if (!u) { main.innerHTML = `<h1>${esc(t('stats'))}</h1><div class="note">${esc(t('needUser'))}</div><a class="btn" href="#/users">${esc(t('register'))}</a>`; return; }
    main.innerHTML = `<h1>${esc(t('stats'))}: ${esc(u.name)}</h1>` + statsHtml(u.id) +
      `<div class="actions"><button class="btn secondary" id="csv" data-tip="csv">${esc(t('exportCsv'))}</button><button class="btn secondary" id="json" data-tip="json">${esc(t('exportJson'))}</button></div>`;
    $('#csv', main).onclick = () => download(`stats-${u.name}.csv`, toCsv([u.id]), 'text/csv');
    $('#json', main).onclick = () => download(`progress-${u.name}.json`, JSON.stringify({ user: u, progress: App.db().progress[u.id] }, null, 1), 'application/json');
  };
  function statsHtml(uid) {
    const p = App.progress(uid), S = App.settings();
    const ok = App.integrityOk(uid);
    const done = App.lessons.filter((l) => App.lessonStatus(l.lid, uid) === 'done').length;
    const totalTime = Object.values(p.time).reduce((a, b) => a + b, 0);
    const bests = App.lessons.map((l) => p.lessons[l.lid] && p.lessons[l.lid].best).filter((x) => x != null);
    const avg = bests.length ? Math.round(bests.reduce((a, b) => a + b, 0) / bests.length) : null;
    let h = (ok ? '' : `<div class="note important"><strong>${esc(t('integrityTitle'))}</strong> ${esc(t('integrityBad'))}</div>`) +
      `<div class="grid2"><div class="card"><div class="muted">${esc(t('lessonsDone'))}</div><div class="score">${done} / ${App.lessons.length}</div></div>
      <div class="card"><div class="muted">${esc(t('avgBest'))}</div><div class="score">${avg == null ? '—' : avg + '%'}</div></div>
      <div class="card"><div class="muted">${esc(t('timeTotal'))}</div><div class="score" style="font-size:1.5rem">${App.fmtDur(totalTime)}</div></div>
      <div class="card"><div class="muted">${esc(t('trajectory'))}</div><div><strong>${esc(t('traj_' + p.traj.mode))}</strong><br>${p.traj.list.length} ${esc(t('lessonsW'))}</div></div></div>
      <h2>${esc(t('byLessons'))}</h2><table><tr><th>${esc(t('lesson'))}</th><th>${esc(t('status'))}</th><th>${esc(t('questionsSolved'))}</th><th>${esc(t('bestScore'))}</th><th>${esc(t('lastScore'))}</th><th>${esc(t('attemptsN'))}</th><th>${esc(t('time'))}</th></tr>`;
    App.lessons.forEach((l) => {
      const s = p.lessons[l.lid] || { q: {}, tries: 0 };
      const qn = App.lessonData(l.lid).questions.length;
      const st = App.lessonStatus(l.lid, uid);
      h += `<tr><td>${l.number}. ${esc(App.title(l))}${p.traj.list.indexOf(l.number) < 0 ? ` <span class="badge">${esc(t('notInTraj'))}</span>` : ''}</td><td><span class="badge ${st === 'done' ? 'ok' : st === 'repeat' ? 'bad' : ''}">${esc(t('st_' + st))}</span></td><td>${Object.keys(s.q || {}).length}/${qn}</td><td>${s.best != null ? s.best + '%' : '—'}</td><td>${s.last != null ? s.last + '%' : '—'}</td><td>${s.tries || 0}</td><td>${App.fmtDur(p.time[l.lid] || 0)}</td></tr>`;
    });
    h += '</table>';
    const ctl = p.results.filter((r) => r.type !== 'lesson');
    h += `<h2>${esc(t('history'))}</h2>`;
    if (!p.results.length) h += `<p class="muted">${esc(t('noResults'))}</p>`;
    else h += `<table><tr><th>${esc(t('date'))}</th><th>${esc(t('test'))}</th><th>${esc(t('result'))}</th><th>${esc(t('duration'))}</th></tr>` +
      p.results.slice().reverse().map((r) => `<tr><td>${App.fmtDate(r.date)}</td><td>${uid === App.db().current ? `<a href="#/result/${r.id}">${esc(r.title)}</a>` : esc(r.title)}</td><td><span class="badge ${r.passed ? 'ok' : 'bad'}">${r.correct}/${r.total} · ${r.percent}%</span></td><td>${App.fmtDur(r.duration)}</td></tr>`).join('') + '</table>';
    h += `<p class="muted">${esc(t('passRule', { p: S.pass }))} ${ctl.length ? '' : ''}</p>`;
    return h;
  }
  function toCsv(uids) {
    const db = App.db();
    const rows = [['user', 'group', 'lesson', 'status', 'questions_solved', 'best_percent', 'last_percent', 'attempts', 'time_min']];
    const rows2 = [['user', 'group', 'date', 'test', 'correct', 'total', 'percent', 'passed', 'duration_s']];
    uids.forEach((uid) => {
      const u = db.users[uid], p = App.progress(uid);
      App.lessons.forEach((l) => {
        const s = p.lessons[l.lid] || { q: {}, tries: 0 };
        rows.push([u.name, u.group || '', l.number + '. ' + l.title_ru, App.lessonStatus(l.lid, uid), Object.keys(s.q || {}).length, s.best == null ? '' : s.best, s.last == null ? '' : s.last, s.tries || 0, Math.round((p.time[l.lid] || 0) / 60)]);
      });
      p.results.forEach((r) => rows2.push([u.name, u.group || '', new Date(r.date).toISOString(), r.title, r.correct, r.total, r.percent, r.passed ? 1 : 0, r.duration]));
    });
    const csv = (rs) => rs.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    return '﻿' + csv(rows) + '\r\n\r\n' + csv(rows2);
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- панель преподавателя: настройки, статистика всех пользователей, экспорт/импорт ---------- */
  App.routes.teacher = function (main) {
    const S = App.settings(), db = App.db();
    if (!App.teacherOk) {
      const first = !S.teacherHash;
      main.innerHTML = `<h1>${esc(t('teacherPanel'))}</h1><p class="lead">${esc(t(first ? 'teacherFirst' : 'teacherLogin'))}</p>
        <form class="card soft" id="tp"><label for="tpw">${esc(t('password'))}</label><input type="password" id="tpw" minlength="6" required>
        ${first ? `<label for="tpw2">${esc(t('passwordRepeat'))}</label><input type="password" id="tpw2" required>` : ''}
        <div class="error-text" id="tpErr"></div><div class="actions"><button class="btn" type="submit">${esc(t(first ? 'save' : 'signIn'))}</button></div></form>`;
      $('#tp', main).onsubmit = (e) => {
        e.preventDefault();
        const pw = $('#tpw').value;
        if (first) {
          if (pw.length < 6) { $('#tpErr').textContent = t('errPw'); return; }
          if (pw !== $('#tpw2').value) { $('#tpErr').textContent = t('errPwMatch'); return; }
          S.teacherHash = App.hashPin('teacher:' + pw); App.save();
        } else if (App.hashPin('teacher:' + pw) !== S.teacherHash) { $('#tpErr').textContent = t('errPinWrong'); return; }
        App.teacherOk = true; App.render();
      };
      return;
    }
    const users = Object.values(db.users);
    main.innerHTML = `<h1>${esc(t('teacherPanel'))}</h1>
      <h2>${esc(t('settings'))}</h2><form class="card soft" id="sf"><div class="grid2">
        <div><label for="sPass">${esc(t('passPercent'))}</label><input type="number" id="sPass" min="1" max="100" value="${S.pass}"></div>
        ${['lesson', 'block', 'module', 'final', 'diag', 'free'].map((k) => `<div><label for="sT_${k}">${esc(t('timeFor', { what: t('kindShort_' + k) }))}</label><input type="number" id="sT_${k}" min="0" max="240" value="${S.time[k]}"></div>`).join('')}
        ${['lesson', 'block', 'module', 'final', 'diag'].map((k) => `<div><label for="sC_${k}">${esc(t('countFor', { what: t('kindShort_' + k) }))}</label><input type="number" id="sC_${k}" min="1" max="10" value="${S.count[k]}"></div>`).join('')}
      </div><div class="actions"><button class="btn" type="submit">${esc(t('save'))}</button><span class="muted" id="sMsg"></span></div></form>
      <h2>${esc(t('allUsers'))} (${users.length})</h2>
      ${users.length ? `<table><tr><th>${esc(t('fullName'))}</th><th>${esc(t('group'))}</th><th>${esc(t('lessonsDone'))}</th><th>${esc(t('testsN'))}</th><th>${esc(t('integrity'))}</th><th></th></tr>${users.map((u) => {
        const p = App.progress(u.id);
        return `<tr><td>${esc(u.name)}</td><td>${esc(u.group || '')}</td><td>${App.lessons.filter((l) => App.lessonStatus(l.lid, u.id) === 'done').length}/${App.lessons.length}</td><td>${p.results.length}</td><td>${App.integrityOk(u.id) ? '✓' : `<span class="badge bad">${esc(t('changed'))}</span>`}</td><td><button class="btn secondary" data-view="${esc(u.id)}">${esc(t('details'))}</button> <button class="btn danger" data-reset="${esc(u.id)}">${esc(t('resetProgress'))}</button></td></tr>`;
      }).join('')}</table>` : `<p class="muted">${esc(t('noUsers'))}</p>`}
      <div id="uDetail"></div>
      <div class="actions"><button class="btn secondary" id="csvAll">${esc(t('exportCsv'))}</button><button class="btn secondary" id="jsonAll">${esc(t('exportBackup'))}</button>
      <label class="btn secondary" style="margin:0">${esc(t('importBackup'))}<input type="file" id="imp" accept="application/json" hidden></label>
      <button class="btn secondary" id="tOut">${esc(t('logout'))}</button></div>
      <p class="muted">${esc(t('teacherNote'))}</p>`;
    $('#sf', main).onsubmit = (e) => {
      e.preventDefault();
      const num = (id, lo, hi, d) => { const v = parseInt($(id).value, 10); return v >= lo && v <= hi ? v : d; };
      S.pass = num('#sPass', 1, 100, S.pass);
      Object.keys(S.time).forEach((k) => { S.time[k] = num('#sT_' + k, 0, 240, S.time[k]); });
      Object.keys(S.count).forEach((k) => { S.count[k] = num('#sC_' + k, 1, 10, S.count[k]); });
      App.save();
      $('#sMsg').textContent = t('saved');
    };
    $$('[data-view]', main).forEach((b) => (b.onclick = () => { $('#uDetail').innerHTML = `<div class="card"><h3>${esc(db.users[b.dataset.view].name)}</h3>${statsHtml(b.dataset.view)}</div>`; }));
    $$('[data-reset]', main).forEach((b) => (b.onclick = () => App.confirm(t('confirmReset', { name: db.users[b.dataset.reset].name }), () => { delete db.progress[b.dataset.reset]; App.save(); App.render(); })));
    $('#csvAll', main).onclick = () => download('stats-all.csv', toCsv(users.map((u) => u.id)), 'text/csv');
    $('#jsonAll', main).onclick = () => { const c = JSON.parse(JSON.stringify(db)); download('abd-backup.json', JSON.stringify(c, null, 1), 'application/json'); };
    $('#imp', main).onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const data = JSON.parse(rd.result);
          if (!data.users || !data.progress) throw new Error('format');
          App.confirm(t('confirmImport', { n: Object.keys(data.users).length }), () => {
            Object.assign(db.users, data.users);
            Object.assign(db.progress, data.progress);
            App.save(); App.render();
          });
        } catch (err) { alert(t('importError')); }
      };
      rd.readAsText(f);
    };
    $('#tOut', main).onclick = () => { App.teacherOk = false; App.go('#/'); };
  };
})();
