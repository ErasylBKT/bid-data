/* Титул, регистрация пользователей, оглавление и траектория, урок и интерактивные вопросы. */
(function () {
  'use strict';
  const App = window.App, C = App.C;
  const { $, $$, esc, t } = { $: App.$, $$: App.$$, esc: App.esc, t: App.t };

  const isTodo = (v) => !v || /TODO/.test(String(v));
  const val = (v) => (isTodo(v) ? `<span class="todo">${esc(App.t('todoField'))}</span>` : esc(v));

  /* ================= ТИТУЛ ================= */
  App.routes.home = function (main) {
    const m = C.meta, u = App.user(), p = App.progress();
    const kk = App.lang() === 'kk';
    const authors = (m.authors || []).map(val).join('<br>');
    main.innerHTML = `
    <section class="title-page">
      <div class="org">${val(m.organization)}<br>${val(m.department)}</div>
      <h1>${esc(m.title_ru)}</h1>
      <div class="sub">${esc(m.subtitle_ru)}</div>
      <div class="kk">${esc(m.title_kk)} — ${esc(m.subtitle_kk)}</div>
      <p class="muted">${esc(m.language_ru)} · ${esc(m.language_kk)}</p>
      <p>${authors}</p>
      <p class="muted">${val(m.city)}, ${val(m.year)}</p>
      ${m.organization_kk ? `<div class="kk-title muted">
        <div>${esc(m.organization_kk)}${m.department_kk ? `<br>${esc(m.department_kk)}` : ''}</div>
        <div><strong>${esc(m.title_kk)}</strong> — ${esc(m.subtitle_kk)}</div>
        <div>${(m.authors_kk || []).map(esc).join('<br>')}</div>
        ${(m.authors_lat || []).length ? `<div>${(m.authors_lat || []).map(esc).join('<br>')}</div>` : ''}
        <div>${esc(m.city_kk || '')}, ${val(m.year)}</div>
      </div>` : ''}
      <div class="actions" style="justify-content:center">
        ${u && p.last ? `<a class="btn" href="${esc(p.last)}" data-tip="continue">${esc(t('continue'))}</a>` : ''}
        <a class="btn${u && p.last ? ' secondary' : ''}" href="${u ? '#/toc' : '#/users'}" data-tip="startLearn">${esc(t(u ? 'toToc' : 'startLearn'))}</a>
        <a class="btn secondary" href="#/lesson/01/theory" id="viewMode" data-tip="viewMode">${esc(t('viewMode'))}</a>
      </div>
      <p class="muted">${esc(m.copyright && !isTodo(m.copyright) ? m.copyright : '©')} </p>
    </section>
    <h2>${esc(t('annotation'))}</h2>
    <p>${esc(kk ? m.annotation_kk : m.annotation_ru)}</p>
    <details><summary>${esc(kk ? 'Аннотация (на русском языке)' : 'Аннотация (қазақ тілінде)')}</summary><p>${esc(kk ? m.annotation_ru : m.annotation_kk)}</p></details>
    <h2>${esc(t('imprint'))}</h2>
    <dl class="kv">
      <dt>${esc(t('edType'))}</dt><dd>${esc(m.subtitle_ru)}; ${esc(m.audience_ru)}</dd>
      <dt>${esc(t('specialty'))}</dt><dd>${val(kk && m.specialty_kk ? m.specialty_kk : m.specialty)}</dd>
      <dt>${esc(t('reviewers'))}</dt><dd>${(m.reviewers || []).map(val).join('<br>')}</dd>
      <dt>${esc(t('publisher'))}</dt><dd>${val(m.publisher && m.publisher.name)}; ${val(m.publisher && m.publisher.address)}; ${val(m.publisher && m.publisher.email)}; ${val(m.publisher && m.publisher.phone)}</dd>
      <dt>${esc(t('developer'))}</dt><dd>${val(m.developer && m.developer.name)}; ${val(m.developer && m.developer.email)}; ${val(m.developer && m.developer.phone)}</dd>
      <dt>${esc(t('volume'))}</dt><dd>${esc(m.size_mb)} МБ; ${App.modules.length} ${esc(t('modulesW'))}, ${App.blocks.length} ${esc(t('blocksW'))}, ${App.lessons.length} ${esc(t('lessonsW'))}</dd>
      <dt>${esc(t('kit'))}</dt><dd>${esc(t('kitText'))}</dd>
      <dt>${esc(t('sysreq'))}</dt><dd>${esc(m.system_requirements_ru)}</dd>
      <dt>${esc(t('udc'))}</dt><dd>${val(m.udc)}</dd>
      <dt>${esc(t('copyright'))}</dt><dd>${val(m.copyright)}</dd>
      <dt>${esc(t('regNo'))}</dt><dd>${esc(t('regNoText'))}</dd>
    </dl>
    <h3>${esc(t('bibliography'))}</h3>
    <ol>${(m.bibliography || []).map((b) => `<li>${val(b)}</li>`).join('')}</ol>
    <h3>${esc(t('docs'))}</h3>
    <ul><li><a href="docs/install.html" target="_blank" rel="noopener">${esc(t('docInstall'))}</a></li><li><a href="docs/user-guide.html" target="_blank" rel="noopener">${esc(t('docUser'))}</a></li><li><a href="docs/content-guide.html" target="_blank" rel="noopener">${esc(t('docContent'))}</a></li><li><a href="README.txt" target="_blank" rel="noopener">README.txt</a></li></ul>
    <p class="muted">${esc(t('build'))}: ${esc(C.build)}</p>`;
    $('#viewMode', main).onclick = () => { if (App.user()) { App.progress().mode = 'view'; App.save(); } };
  };

  /* ================= ПОЛЬЗОВАТЕЛИ (регистрация, корректировка, удаление) ================= */
  App.routes.users = function (main) {
    const db = App.db(), u = App.user();
    const list = Object.values(db.users).sort((a, b) => a.name.localeCompare(b.name));
    let h = `<h1>${esc(t('users'))}</h1><p class="lead">${esc(t('usersLead'))}</p>`;
    if (u) {
      const p = App.progress();
      h += `<div class="card"><h2 style="margin-top:0">${esc(u.name)}</h2>
        <p class="muted">${esc(t('group'))}: ${esc(u.group || '—')} · ${esc(t('registered'))}: ${App.fmtDate(u.created)} · PIN: ${u.pin ? esc(t('yes')) : esc(t('no'))}</p>
        <label class="check"><input type="radio" name="mode" value="learn" ${p.mode !== 'view' ? 'checked' : ''}> <span><strong>${esc(t('modeLearn'))}</strong> — ${esc(t('modeLearnD'))}</span></label>
        <label class="check"><input type="radio" name="mode" value="view" ${p.mode === 'view' ? 'checked' : ''}> <span><strong>${esc(t('modeView'))}</strong> — ${esc(t('modeViewD'))}</span></label>
        <div class="actions"><button class="btn secondary" id="edit" data-tip="editUser">${esc(t('edit'))}</button>
        <button class="btn secondary" id="logout" data-tip="logout">${esc(t('logout'))}</button>
        <button class="btn danger" id="del" data-tip="deleteUser">${esc(t('deleteProfile'))}</button></div></div>`;
    }
    if (list.length) {
      h += `<h2>${esc(t('profilesHere'))}</h2><div class="grid2">` + list.map((x) =>
        `<button class="card" style="text-align:left;cursor:pointer;font:inherit" data-uid="${esc(x.id)}" data-title="${esc(t('tip_signInAs'))}"><strong>${esc(x.name)}</strong><br><span class="muted">${esc(x.group || '')}${x.pin ? ' · PIN' : ''}${x.id === db.current ? ' · ' + esc(t('current')) : ''}</span></button>`).join('') + '</div>';
    }
    h += `<h2>${esc(t('register'))}</h2><form class="card soft" id="reg" autocomplete="off">
      <label for="rName">${esc(t('fullName'))} *</label><input type="text" id="rName" maxlength="80" required>
      <label for="rGroup">${esc(t('group'))}</label><input type="text" id="rGroup" maxlength="40">
      <label for="rPin">${esc(t('pinOpt'))}</label><input type="password" id="rPin" inputmode="numeric" maxlength="12">
      <div class="error-text" id="rErr" role="alert"></div>
      <div class="actions"><button class="btn" type="submit" data-tip="register">${esc(t('register'))}</button></div></form>
      <p class="muted">${esc(t('privacy'))} <a href="#/teacher">${esc(t('teacherPanel'))}</a></p>`;
    main.innerHTML = h;

    $$('[name=mode]', main).forEach((r) => (r.onchange = () => { App.progress().mode = r.value; App.save(); App.renderChrome(); }));
    $$('[data-uid]', main).forEach((b) => (b.onclick = () => signIn(db.users[b.dataset.uid])));
    $('#reg', main).onsubmit = (e) => {
      e.preventDefault();
      const name = $('#rName').value.trim().replace(/\s+/g, ' ');
      const pin = $('#rPin').value.trim();
      const err = $('#rErr');
      if (name.length < 3) { err.textContent = t('errName'); $('#rName').focus(); return; }
      if (pin && !/^\d{4,12}$/.test(pin)) { err.textContent = t('errPin'); $('#rPin').focus(); return; }
      if (Object.values(db.users).some((x) => x.name.toLowerCase() === name.toLowerCase())) { err.textContent = t('errExists'); return; }
      const id = 'u' + Date.now().toString(36);
      db.users[id] = { id, name, group: $('#rGroup').value.trim(), pin: pin ? App.hashPin(pin) : null, created: Date.now() };
      db.current = id;
      App.progress();
      App.save();
      App.go('#/toc');
    };
    if (u) {
      $('#logout', main).onclick = () => { db.current = null; App.save(); App.go('#/users'); };
      $('#edit', main).onclick = () => editUser(u);
      $('#del', main).onclick = () => requirePin(u, () => App.confirm(t('confirmDelete', { name: u.name }), () => {
        delete db.users[u.id]; delete db.progress[u.id]; db.current = null; App.save(); App.go('#/users');
      }));
    }
  };

  function requirePin(u, ok) {
    if (!u.pin) return ok();
    App.modal(`<h3>${esc(t('enterPin'))}</h3><p>${esc(u.name)}</p><input type="password" id="pin" inputmode="numeric"><div class="error-text" id="pErr"></div>
      <div class="actions"><button class="btn" id="pOk">${esc(t('signIn'))}</button><button class="btn secondary" id="pNo">${esc(t('cancel'))}</button></div>`, (b, close) => {
      const go = () => { if (App.hashPin($('#pin', b).value.trim()) === u.pin) { close(); ok(); } else { $('#pErr', b).textContent = t('errPinWrong'); } };
      $('#pOk', b).onclick = go;
      $('#pin', b).onkeydown = (e) => { if (e.key === 'Enter') go(); };
      $('#pNo', b).onclick = close;
    });
  }
  App.requirePin = requirePin;
  function signIn(u) {
    requirePin(u, () => {
      const db = App.db();
      db.current = u.id;
      App.save();
      const p = App.progress();
      if (!App.integrityOk(u.id)) alert(t('integrityBad'));
      App.go(p.last || '#/toc');
    });
  }
  function editUser(u) {
    App.modal(`<h3>${esc(t('edit'))}</h3>
      <label for="eName">${esc(t('fullName'))}</label><input type="text" id="eName" value="${esc(u.name)}" maxlength="80">
      <label for="eGroup">${esc(t('group'))}</label><input type="text" id="eGroup" value="${esc(u.group || '')}" maxlength="40">
      <label for="ePin">${esc(t('pinNew'))}</label><input type="password" id="ePin" inputmode="numeric" maxlength="12">
      <label class="check"><input type="checkbox" id="eNoPin"> ${esc(t('pinRemove'))}</label>
      <div class="error-text" id="eErr"></div>
      <div class="actions"><button class="btn" id="eOk">${esc(t('save'))}</button><button class="btn secondary" id="eNo">${esc(t('cancel'))}</button></div>`, (b, close) => {
      $('#eNo', b).onclick = close;
      $('#eOk', b).onclick = () => {
        const name = $('#eName', b).value.trim().replace(/\s+/g, ' ');
        const pin = $('#ePin', b).value.trim();
        if (name.length < 3) { $('#eErr', b).textContent = t('errName'); return; }
        if (pin && !/^\d{4,12}$/.test(pin)) { $('#eErr', b).textContent = t('errPin'); return; }
        u.name = name; u.group = $('#eGroup', b).value.trim();
        if ($('#eNoPin', b).checked) u.pin = null; else if (pin) u.pin = App.hashPin(pin);
        App.save(); close(); App.render();
      };
    });
  }

  /* ================= ОГЛАВЛЕНИЕ И ТРАЕКТОРИЯ ================= */
  App.routes.toc = function (main) {
    const u = App.user(), learning = App.learning(), p = App.progress();
    const done = learning ? App.trajLessons((l) => App.lessonStatus(l.lid) === 'done').length : 0;
    const total = learning ? App.trajLessons().length : App.lessons.length;
    let h = `<h1>${esc(t('toc'))}</h1>`;
    if (!u) h += `<div class="note">${esc(t('tocGuest'))} <a href="#/users">${esc(t('register'))}</a></div>`;
    else if (!learning) h += `<div class="note">${esc(t('viewModeOn'))} <a href="#/users">${esc(t('changeMode'))}</a></div>`;
    if (learning) {
      const pct = total ? Math.round((done / total) * 100) : 100;
      h += `<div class="card soft"><strong>${esc(t('progress'))}:</strong> ${done} / ${total} ${esc(t('lessonsW'))} <div class="progress" style="margin-top:8px"><span style="width:${pct}%"></span></div>
        ${p.last ? `<div class="actions"><a class="btn" href="${esc(p.last)}">${esc(t('continue'))}</a>${nextLink()}</div>` : `<div class="actions">${nextLink(true)}</div>`}</div>
      <h2>${esc(t('trajectory'))}</h2><p class="muted">${esc(t('trajLead'))}</p>
      <div class="card">
        <label class="check"><input type="radio" name="traj" value="full" ${p.traj.mode === 'full' ? 'checked' : ''}> <span><strong>${esc(t('trajFull'))}</strong> — ${esc(t('trajFullD'))}</span></label>
        <label class="check"><input type="radio" name="traj" value="manual" ${p.traj.mode === 'manual' ? 'checked' : ''}> <span><strong>${esc(t('trajManual'))}</strong> — ${esc(t('trajManualD'))}</span></label>
        <label class="check"><input type="radio" name="traj" value="test" ${p.traj.mode === 'test' ? 'checked' : ''}> <span><strong>${esc(t('trajTest'))}</strong> — ${esc(t('trajTestD'))}</span></label>
        <div class="actions" id="trajActs"></div><div class="error-text" id="trajErr"></div></div>`;
    }
    h += '<h2>' + esc(t('structure')) + '</h2>';
    App.modules.forEach((m, mi) => {
      h += `<div class="card"><h3 style="margin-top:0">${esc(t('module'))} ${mi + 1}. ${esc(App.title(m))}</h3>`;
      m.blocks.forEach((b) => {
        h += `<h4>${esc(t('block'))} ${esc(b.id.slice(1))}. ${esc(App.title(b))}</h4><ul style="list-style:none;padding-left:0">`;
        b.lessons.forEach((l) => {
          const lid = App.pad(l.number), st = App.lessonStatus(lid);
          const cb = learning ? `<input type="checkbox" class="tcb" value="${l.number}" ${App.inTraj(l.number) ? 'checked' : ''} ${p.traj.mode === 'manual' ? '' : 'disabled'} aria-label="${esc(t('includeLesson'))}" data-title="${esc(t('includeLesson'))}"> ` : '';
          const els = ['theory', 'examples', 'tasks', 'questions', 'test'].map((e) => `<a href="#/lesson/${lid}/${e}">${esc(t('el_' + e))}</a>`).join(' · ');
          h += `<li style="margin:8px 0">${cb}<a href="#/lesson/${lid}/theory"><strong>${esc(t('lesson'))} ${l.number}. ${esc(App.title(l))}</strong></a> ${learning ? `<span class="badge ${st === 'done' ? 'ok' : st === 'repeat' ? 'bad' : ''}">${esc(t('st_' + st))}</span>` : ''}<br><span class="muted">${els}</span></li>`;
        });
        h += '</ul>';
      });
      h += '</div>';
    });
    main.innerHTML = h;
    if (!learning) return;

    const acts = $('#trajActs', main);
    const paintActs = () => {
      const mode = ($('[name=traj]:checked', main) || {}).value;
      $$('.tcb', main).forEach((c) => (c.disabled = mode !== 'manual'));
      acts.innerHTML = mode === 'test'
        ? `<a class="btn" href="#/control/diag/all" data-tip="diag">${esc(t('diagStart'))}</a>${p.traj.mode === 'test' && p.traj.chosen ? `<span class="muted">${esc(t('diagDone', { n: p.traj.list.length }))}</span>` : ''}`
        : `<button class="btn" id="trajSave" data-tip="trajSave">${esc(t('save'))}</button>`;
      const sv = $('#trajSave', main);
      if (sv) sv.onclick = () => {
        const list = mode === 'full' ? App.lessons.map((l) => l.number) : $$('.tcb:checked', main).map((c) => +c.value);
        if (!list.length) { $('#trajErr', main).textContent = t('trajEmpty'); return; }
        p.traj = { mode, list, chosen: true };
        App.save();
        App.render();
      };
    };
    $$('[name=traj]', main).forEach((r) => (r.onchange = paintActs));
    paintActs();
  };
  function nextLink(first) {
    const n = App.nextInTraj();
    if (!n) return '';
    return `<a class="btn ${first ? '' : 'secondary'}" href="#/lesson/${n.lid}/theory">${esc(t(first ? 'startLearn' : 'nextTrajLesson'))}: ${n.number}. ${esc(App.title(n))}</a>`;
  }
  App.nextInTraj = function (afterNum) {
    const ls = App.trajLessons();
    if (afterNum != null) return ls.find((l) => l.number > afterNum) || null;
    return ls.find((l) => App.lessonStatus(l.lid) !== 'done') || null;
  };

  /* ================= УРОК ================= */
  const TABS = ['theory', 'examples', 'tasks', 'questions', 'test', 'media'];
  App.routes.lesson = function (main, r) {
    const lid = r.parts[1];
    const L = App.lesson(lid);
    if (!L) return App.routes.notfound(main);
    const D = App.lessonData(lid);
    const media = imagesOf(D);
    const tabs = TABS.filter((x) => x !== 'media' || media.length);
    const tab = tabs.indexOf(r.parts[2]) >= 0 ? r.parts[2] : 'theory';
    const learning = App.learning();
    const s = learning ? App.lp(lid) : null;
    if (s) { s.seen[tab] = 1; App.save(); }
    const st = learning ? App.lessonStatus(lid) : null;
    const mi = App.modules.indexOf(L.module) + 1;

    let h = `<div class="crumbs"><a href="#/toc">${esc(t('toc'))}</a> › ${esc(t('module'))} ${mi}. ${esc(App.title(L.module))} › ${esc(t('block'))} ${esc(L.block.id.slice(1))}. ${esc(App.title(L.block))}</div>
      <h1>${esc(t('lesson'))} ${L.number}. ${esc(App.title(L))}</h1>`;
    if (App.lang() === 'kk') h += `<p class="muted">${esc(L.title_ru)}</p>`;
    if (learning) {
      h += `<p><span class="badge ${st === 'done' ? 'ok' : st === 'repeat' ? 'bad' : 'blue'}">${esc(t('st_' + st))}</span> `;
      if (!App.inTraj(L.number)) h += `<span class="badge">${esc(t('notInTraj'))}</span> `;
      if (s.best != null) h += `<span class="badge">${esc(t('bestScore'))}: ${s.best}%</span>`;
      h += '</p>';
      if (st === 'repeat') h += `<div class="note important"><strong>${esc(t('repeatTitle'))}</strong> ${esc(t('repeatText'))}</div>`;
    } else if (!App.user()) {
      h += `<div class="note">${esc(t('guestLesson'))} <a href="#/users">${esc(t('register'))}</a></div>`;
    }
    h += '<nav class="tabs" role="tablist">' + tabs.map((x) => {
      const seen = s && (x === 'questions' ? App.questionsDone(lid) : x === 'test' ? st === 'done' : s.seen[x]);
      return `<a class="tab${x === tab ? ' active' : ''}" role="tab" aria-selected="${x === tab}" href="#/lesson/${lid}/${x}" data-tip="el_${x}">${esc(t('el_' + x))}${seen ? ' <span class="tick">✓</span>' : ''}</a>`;
    }).join('') + '</nav><div class="content" id="lc"></div>';
    main.innerHTML = h;
    const lc = $('#lc', main);

    if (tab === 'theory' || tab === 'examples') {
      lc.innerHTML = D[tab] || `<p class="muted">${esc(t('empty'))}</p>`;
      App.linkTerms(lc, L.number);
    } else if (tab === 'tasks') {
      lc.innerHTML = (D.tasks || '') + (L.number >= 10 && C.labsExtra ? `<div class="card soft">${C.labsExtra}<p><a href="#/reference">${esc(t('reference'))}</a></p></div>` : '');
    } else if (tab === 'questions') {
      renderQuestions(lc, lid, D);
    } else if (tab === 'test') {
      renderLessonTest(lc, lid);
    } else if (tab === 'media') {
      lc.innerHTML = '<div class="gallery">' + media.map((m) => `<figure><a href="${esc(m.src)}" target="_blank" rel="noopener"><img src="${esc(m.src)}" alt="${esc(m.alt)}" loading="lazy"></a><figcaption>${esc(m.alt)}</figcaption></figure>`).join('') + '</div>';
    }

    // навигация урока
    const ti = tabs.indexOf(tab);
    const prevL = App.lessons[App.lessons.indexOf(L) - 1], nextL = App.lessons[App.lessons.indexOf(L) + 1];
    const nextT = learning ? App.nextInTraj(L.number) : nextL;
    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    nav.innerHTML =
      (ti > 0 ? `<a class="btn secondary" href="#/lesson/${lid}/${tabs[ti - 1]}">← ${esc(t('el_' + tabs[ti - 1]))}</a>` : prevL ? `<a class="btn secondary" href="#/lesson/${prevL.lid}/theory">← ${esc(t('lesson'))} ${prevL.number}</a>` : '<span></span>') +
      (ti < tabs.length - 1 ? `<a class="btn" href="#/lesson/${lid}/${tabs[ti + 1]}">${esc(t('el_' + tabs[ti + 1]))} →</a>` : nextT ? `<a class="btn" href="#/lesson/${nextT.lid}/theory">${esc(t('lesson'))} ${nextT.number} →</a>` : '');
    main.appendChild(nav);
  };

  function imagesOf(D) {
    const out = [];
    const tmp = document.createElement('div');
    tmp.innerHTML = (D.theory || '') + (D.examples || '');
    $$('img', tmp).forEach((img, i) => {
      let cap = img.getAttribute('alt') || '';
      if (!cap) { const n = img.nextElementSibling; if (n && /^Рисунок/.test(n.textContent.trim())) cap = n.textContent.trim(); }
      out.push({ src: img.getAttribute('src'), alt: cap || App.t('figure') + ' ' + (i + 1) });
    });
    return out;
  }

  /* ---------- элемент «Вопросы»: интерактивная проверка с обратной связью (§9, §10) ---------- */
  function renderQuestions(lc, lid, D) {
    const qs = D.questions || [];
    const learning = App.learning();
    const s = learning ? App.lp(lid) : null;
    lc.innerHTML = `<p class="muted">${esc(t('qLead'))}</p>`;
    qs.forEach((q, i) => {
      const box = document.createElement('div');
      box.className = 'q';
      lc.appendChild(box);
      paintQ(box, q, i, s);
    });
    if (D.selfcheck) {
      const sc = document.createElement('div');
      sc.className = 'card soft';
      sc.innerHTML = D.selfcheck;
      lc.appendChild(sc);
    }
    if (learning) {
      const done = App.questionsDone(lid);
      const f = document.createElement('div');
      f.className = 'note';
      f.innerHTML = done ? `${esc(t('qAllDone'))} <a href="#/lesson/${lid}/test">${esc(t('el_test'))} →</a>` : esc(t('qNotDone', { n: qs.filter((q) => !s.q[q.id]).length }));
      lc.appendChild(f);
    }
  }

  function paintQ(box, q, i, s) {
    const solved = s && s.q[q.id];
    const typeHint = { single: t('qtSingle'), multiple: t('qtMultiple'), truefalse: t('qtTF'), input: t('qtInput') }[q.type];
    let h = `<div class="q-head"><span>${esc(t('question'))} ${i + 1} · ${esc(typeHint)}</span><span>${'●'.repeat(q.level || 1)}${'○'.repeat(3 - (q.level || 1))} ${solved ? `<span class="badge ok">${esc(t('solved'))}</span>` : ''}</span></div><div class="q-text">${esc(q.text)}</div>`;
    const name = 'q_' + q.id;
    if (q.type === 'single' || q.type === 'multiple') {
      h += q.options.map((o, k) => `<label class="opt"><input type="${q.type === 'single' ? 'radio' : 'checkbox'}" name="${name}" value="${k}"><span>${esc(o)}</span></label>`).join('');
    } else if (q.type === 'truefalse') {
      h += [[true, t('true')], [false, t('false')]].map(([v, l]) => `<label class="opt"><input type="radio" name="${name}" value="${v}"><span>${esc(l)}</span></label>`).join('');
    } else {
      h += `<input type="text" class="qin" aria-label="${esc(t('yourAnswer'))}" placeholder="${esc(t('yourAnswer'))}">`;
    }
    h += `<div class="actions"><button class="btn" data-act="check" data-tip="check">${esc(t('check'))}</button></div><div class="fb" aria-live="polite"></div>`;
    box.innerHTML = h;
    $$('.opt input', box).forEach((inp) => (inp.onchange = () => $$('.opt', box).forEach((o) => o.classList.toggle('sel', $('input', o).checked))));
    const qin = $('.qin', box);
    if (qin) qin.onkeydown = (e) => { if (e.key === 'Enter') $('[data-act=check]', box).click(); };
    $('[data-act=check]', box).onclick = () => check(box, q, i, s);
  }

  const normAns = (x) => String(x).toLowerCase().replace(/ё/g, 'е').replace(/[\s.,;:«»"'()−–-]+/g, '').replace(/b/g, 'β');
  function check(box, q, i, s) {
    const fb = $('.fb', box);
    let ok, chosen;
    if (q.type === 'input') {
      chosen = $('.qin', box).value.trim();
      if (!chosen) { fb.innerHTML = `<div class="feedback bad"><div class="fb-title">${esc(t('fbEmpty'))}</div>${esc(t('fbEmptyText'))}</div>`; return; }
      ok = q.answers.some((a) => normAns(a) === normAns(chosen));
    } else {
      const sel = $$('.opt input:checked', box).map((x) => x.value);
      if (!sel.length) { fb.innerHTML = `<div class="feedback bad"><div class="fb-title">${esc(t('fbEmpty'))}</div>${esc(t('fbChoose'))}</div>`; return; }
      if (q.type === 'single') ok = +sel[0] === q.correct;
      else if (q.type === 'truefalse') ok = (sel[0] === 'true') === q.correct;
      else { const c = q.correct.slice().sort().join(','); ok = sel.map(Number).sort().join(',') === c; }
      chosen = sel;
    }
    if (ok) {
      if (s) { s.q[q.id] = 1; App.save(); }
      $$('.opt', box).forEach((o) => { if ($('input', o).checked) o.classList.add('right'); });
      fb.innerHTML = `<div class="feedback ok" tabindex="-1"><div class="fb-title">✓ ${esc(t('fbRight'))}</div>${esc(q.explain)}</div>
        <div class="actions"><button class="btn secondary" data-act="next">${esc(t('nextQuestion'))}</button></div>`;
      $('.q-head span:last-child', box).insertAdjacentHTML('beforeend', ` <span class="badge ok">${esc(t('solved'))}</span>`);
      $('[data-act=check]', box).disabled = true;
      if (s) refreshQuestionsNote(box);
    } else {
      let why = '';
      if (q.type === 'multiple') {
        const need = q.correct.length, got = chosen.length;
        why = got < need ? t('fbMultiFew') : got > need ? t('fbMultiMany') : t('fbMultiMix');
      } else if (q.type === 'input') why = t('fbInputWrong');
      else why = t('fbWrongChoice');
      $$('.opt', box).forEach((o) => { if ($('input', o).checked) o.classList.add('wrong'); });
      fb.innerHTML = `<div class="feedback bad" tabindex="-1"><div class="fb-title">${esc(t('fbWrong'))}</div>${esc(why)}</div>
        <div class="actions"><button class="btn" data-act="retry">${esc(t('tryAgain'))}</button><button class="btn secondary" data-act="show">${esc(t('showExplain'))}</button></div>`;
      $('[data-act=check]', box).disabled = true;
    }
    // обратная связь остаётся, пока пользователь сам не выберет следующее действие (§10)
    $$('[data-act]', fb).forEach((b) => (b.onclick = () => {
      if (b.dataset.act === 'retry') { $('[data-act=check]', box).disabled = false; fb.innerHTML = ''; $$('.opt', box).forEach((o) => o.classList.remove('wrong', 'right')); }
      else if (b.dataset.act === 'show') showAnswer(box, q, fb);
      else if (b.dataset.act === 'next') { const nx = box.nextElementSibling; if (nx) { nx.scrollIntoView({ behavior: 'smooth', block: 'start' }); const f = nx.querySelector('input,button'); if (f) f.focus({ preventScroll: true }); } }
    }));
    const f = $('.feedback', fb);
    if (f) f.focus({ preventScroll: true });
  }
  function showAnswer(box, q, fb) {
    let right;
    if (q.type === 'single') right = q.options[q.correct];
    else if (q.type === 'multiple') right = q.correct.map((k) => q.options[k]).join('; ');
    else if (q.type === 'truefalse') right = q.correct ? t('true') : t('false');
    else right = q.answers[0];
    fb.innerHTML = `<div class="feedback ok"><div class="fb-title">${esc(t('rightAnswer'))}: ${esc(right)}</div>${esc(q.explain)}<p class="muted" style="margin:.5rem 0 0">${esc(t('fbNowYou'))}</p></div>
      <div class="actions"><button class="btn" data-act="retry2">${esc(t('answerNow'))}</button></div>`;
    $('[data-act=retry2]', fb).onclick = () => { $('[data-act=check]', box).disabled = false; fb.innerHTML = ''; $$('.opt', box).forEach((o) => o.classList.remove('wrong', 'right')); };
  }
  function refreshQuestionsNote(box) {
    const r = App.route;
    const lid = r.parts[1];
    const note = box.parentElement.querySelector('.note:last-child');
    if (note && App.questionsDone(lid)) note.innerHTML = `${esc(t('qAllDone'))} <a href="#/lesson/${lid}/test">${esc(t('el_test'))} →</a>`;
    App.renderSidebar();
  }

  /* ---------- элемент «Тест» урока: текущий контроль ---------- */
  function renderLessonTest(lc, lid) {
    const S = App.settings();
    const bank = App.lessonTests(lid).length;
    if (!App.learning()) {
      lc.innerHTML = `<div class="note">${esc(t('testViewMode'))}</div><div class="actions"><a class="btn" href="#/tests?scope=lesson:${lid}">${esc(t('practice'))}</a>${App.user() ? '' : `<a class="btn secondary" href="#/users">${esc(t('register'))}</a>`}</div>`;
      return;
    }
    const s = App.lp(lid), ready = App.questionsDone(lid);
    const res = App.progress().results.filter((x) => x.scope === 'lesson:' + lid).slice(-5).reverse();
    lc.innerHTML = `<div class="card soft"><h3 style="margin-top:0">${esc(t('currentControl'))}</h3>
      <ul><li>${esc(t('testRule1', { n: Math.min(S.count.lesson, bank), bank }))}</li><li>${esc(t('testRule2', { m: S.time.lesson }))}</li><li>${esc(t('testRule3', { p: S.pass }))}</li><li>${esc(t('testRule4'))}</li></ul>
      ${ready ? '' : `<div class="note important"><strong>${esc(t('testLocked'))}</strong> ${esc(t('testLockedText'))} <a href="#/lesson/${lid}/questions">${esc(t('el_questions'))}</a></div>`}
      <div class="actions"><button class="btn" id="go" ${ready ? '' : 'disabled'} data-tip="startTest">${esc(t('startTest'))}</button></div></div>
      ${res.length ? `<h3>${esc(t('attempts'))}</h3><ul>${res.map((x) => `<li>${App.fmtDate(x.date)} — <a href="#/result/${x.id}">${x.correct}/${x.total} (${x.percent}%)</a> <span class="badge ${x.passed ? 'ok' : 'bad'}">${esc(t(x.passed ? 'passed' : 'failed'))}</span></li>`).join('')}</ul>` : ''}
      <p class="muted">${esc(t('attemptsN'))}: ${s.tries}</p>`;
    const b = $('#go', lc);
    if (b) b.onclick = () => App.startControl('lesson', lid);
  }

  App.routes.notfound = function (main) {
    main.innerHTML = `<h1>${esc(t('notFound'))}</h1><p><a href="#/">${esc(t('home'))}</a></p>`;
  };
})();
