/* Тезаурус (со ссылками из текста уроков), справочник, помощник. */
(function () {
  'use strict';
  const App = window.App, C = App.C;
  const { $, $$, esc, t } = { $: App.$, $$: App.$$, esc: App.esc, t: App.t };

  const TH = C.thesaurus.map((x, i) => Object.assign({ key: 't' + i, base: x.term.replace(/\s*\(.*?\)\s*/g, '').trim() }, x));

  /* ---------- термины в тексте урока: подчёркивание + подсказка + гиперссылка на тезаурус ---------- */
  App.linkTerms = function (root, lessonNum) {
    const terms = TH.filter((x) => x.lesson === lessonNum && x.base.length > 2).sort((a, b) => b.base.length - a.base.length);
    const used = new Set();
    terms.forEach((term) => {
      // основа слова без окончания (для русских слов), чтобы находить «кластеризации», «кластеризацию»…
      const words = term.base.split(/\s+/).map((w) => {
        const e = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return /[а-яё]{5,}$/i.test(w) ? e.replace(/[аяоеыиуюйь]{1,2}$/i, '') + '[а-яё]{0,4}' : e;
      });
      const re = new RegExp('(^|[^0-9A-Za-zА-Яа-яЁё])(' + words.join('\\s+') + ')(?![0-9A-Za-zА-Яа-яЁё])', 'i');
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement.closest('a,code,pre,h1,h2,h3,h4,.formula,table') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      let node;
      while ((node = walker.nextNode())) {
        const m = re.exec(node.nodeValue);
        if (!m || used.has(term.key)) continue;
        used.add(term.key);
        const start = m.index + m[1].length;
        const mid = node.splitText(start);
        mid.splitText(m[2].length);
        const a = document.createElement('a');
        a.className = 'term';
        a.href = '#/thesaurus?t=' + term.key;
        a.dataset.title = term.term + ' — ' + term.definition;
        a.textContent = mid.nodeValue;
        mid.parentNode.replaceChild(a, mid);
        break;
      }
    });
  };

  /* ---------- тезаурус ---------- */
  App.routes.thesaurus = function (main, r) {
    const q = (r.query.s || '').toLowerCase();
    const list = TH.slice().sort((a, b) => a.term.localeCompare(b.term, 'ru')).filter((x) => !q || (x.term + ' ' + x.definition).toLowerCase().indexOf(q) >= 0);
    const letter = (x) => x.term[0].toUpperCase();
    const letters = [...new Set(list.map(letter))];
    main.innerHTML = `<h1>${esc(t('thesaurus'))}</h1><p class="lead">${esc(t('thesLead', { n: TH.length }))}</p>
      <input type="text" id="ts" placeholder="${esc(t('search'))}" value="${esc(r.query.s || '')}" aria-label="${esc(t('search'))}" data-tip="search">
      <div class="letters">${letters.map((l) => `<a href="#" data-l="${esc(l)}">${esc(l)}</a>`).join('')}</div>
      <dl class="thes">${list.map((x, i) => `${i === 0 || letter(list[i - 1]) !== letter(x) ? `<h2 id="L-${esc(letter(x))}" style="margin-top:1.4rem">${esc(letter(x))}</h2>` : ''}
        <dt id="${x.key}" class="${r.query.t === x.key ? 'hl' : ''}">${esc(x.term)}</dt><dd>${esc(x.definition)} <a class="muted" href="#/lesson/${App.pad(x.lesson)}/theory">${esc(t('lesson'))} ${x.lesson}</a></dd>`).join('')}</dl>
      ${list.length ? '' : `<p class="muted">${esc(t('nothingFound'))}</p>`}`;
    const inp = $('#ts', main);
    let timer;
    inp.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { history.replaceState(null, '', '#/thesaurus?s=' + encodeURIComponent(inp.value)); App.render(); const n = $('#ts'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300); };
    $$('[data-l]', main).forEach((a) => (a.onclick = (e) => { e.preventDefault(); const h = document.getElementById('L-' + a.dataset.l); if (h) h.scrollIntoView(); }));
    if (r.query.t) setTimeout(() => { const el = document.getElementById(r.query.t); if (el) el.scrollIntoView({ block: 'center' }); }, 0);
  };

  /* ---------- справочник ---------- */
  App.routes.reference = function (main) {
    main.innerHTML = `<h1>${esc(t('reference'))}</h1><p class="lead">${esc(t('refLead'))}</p><div class="content">${C.reference}${C.labsExtra}</div>`;
  };

  /* ---------- помощник: доступен с момента запуска по кнопке «?» ---------- */
  App.routes.help = function (main) {
    const kk = App.lang() === 'kk';
    main.innerHTML = `<h1>${esc(t('help'))}</h1><div class="content">${kk ? HELP_KK : HELP_RU}</div>
      <div class="card soft"><strong>${esc(t('docs'))}:</strong> <a href="docs/user-guide.html" target="_blank" rel="noopener">${esc(t('docUser'))}</a> · <a href="docs/install.html" target="_blank" rel="noopener">${esc(t('docInstall'))}</a> · <a href="docs/content-guide.html" target="_blank" rel="noopener">${esc(t('docContent'))}</a></div>`;
  };

  const HELP_RU = `
<p class="lead">Помощник объясняет, как работать с электронным учебным пособием. Открыть его можно в любой момент кнопкой <strong>«?»</strong> в правом верхнем углу.</p>
<h2>1. Начало работы</h2>
<ol><li>Нажмите имя в правом верхнем углу (или «Войти») и <strong>зарегистрируйтесь</strong>: укажите ФИО и группу. PIN-код необязателен — он защищает ваш профиль, если компьютером пользуются несколько человек.</li>
<li>Откройте <strong>«Оглавление»</strong> и выберите <strong>траекторию обучения</strong>.</li>
<li>Нажмите «Начать обучение» — откроется первый урок вашей траектории.</li></ol>
<p>Без регистрации доступен <strong>режим просмотра</strong>: можно читать все материалы, но результаты не сохраняются и контрольные тесты недоступны.</p>
<h2>2. Структура пособия</h2>
<p>Курс состоит из <strong>3 модулей</strong>, модули — из <strong>блоков</strong>, блоки — из <strong>уроков</strong> (всего 15). В каждом уроке есть вкладки:</p>
<table><tr><th>Вкладка</th><th>Что внутри</th></tr>
<tr><td>Теория</td><td>Учебный материал. <u>Подчёркнутые</u> термины — ссылки на тезаурус; наведите курсор, чтобы увидеть определение.</td></tr>
<tr><td>Примеры</td><td>Подробно разобранные примеры и задачи.</td></tr>
<tr><td>Задания</td><td>Упражнения с порядком выполнения, требованиями к результату и подсказками; лабораторные работы на R.</td></tr>
<tr><td>Вопросы</td><td>Интерактивные вопросы с проверкой ответа и объяснением.</td></tr>
<tr><td>Тест</td><td>Текущий контроль знаний по уроку.</td></tr>
<tr><td>Графика</td><td>Все рисунки урока (если они есть).</td></tr></table>
<h2>3. Траектория обучения</h2>
<ul><li><strong>Полный выбор</strong> — изучаются все уроки.</li>
<li><strong>Ручной выбор</strong> — отметьте нужные уроки флажками в оглавлении.</li>
<li><strong>Тестовый выбор</strong> — пройдите диагностический тест по всему курсу; в траекторию автоматически попадут уроки, по которым правильных ответов оказалось недостаточно.</li></ul>
<p>Уроки вне траектории показаны в боковой панели бледным цветом; их можно читать, но контроль по ним не обязателен.</p>
<h2>4. Порядок изучения урока и контроль знаний</h2>
<ol><li>Изучите теорию и примеры, выполните задания.</li>
<li>Ответьте правильно на все вопросы во вкладке «Вопросы». Если ответ неверный, прочитайте пояснение и попробуйте снова.</li>
<li>Пройдите тест урока (<strong>текущий контроль</strong>). Если результат ниже проходного балла, урок отмечается красным «Повторить урок»: изучите его ещё раз, снова ответьте на вопросы и повторите тест.</li>
<li>Когда пройдены все уроки блока, открывается <strong>промежуточный контроль</strong> (тест блока); после всех блоков модуля — <strong>рубежный контроль</strong> (тест модуля); после всех модулей — <strong>итоговый контроль</strong>.</li></ol>
<p>Обучение можно прервать в любой момент: при следующем входе нажмите «Продолжить» на титульной странице.</p>
<h2>5. Тестирование</h2>
<ul><li>Вопросы выбираются <strong>случайно</strong> из базы, порядок вариантов перемешивается.</li>
<li>Время ограничено; таймер показан вверху. Когда время истекает, тест завершается автоматически.</li>
<li>Между вопросами можно переходить по номерам. Результат показывается сразу после завершения.</li>
<li>После теста можно <strong>перейти к любому вопросу с ошибкой</strong>: для каждого варианта указано, почему он верный или неверный.</li>
<li>В разделе «Тестирование» можно тренироваться по любой теме с <strong>фиксацией или без фиксации</strong> результатов.</li></ul>
<h2>6. Статистика</h2>
<p>Раздел «Статистика» показывает состояние каждого урока, лучшие и последние баллы, число попыток, время изучения и историю всех тестов. Данные можно выгрузить в CSV (открывается в Excel) или JSON.</p>
<h2>7. Значки</h2>
<table><tr><th>Значок</th><th>Смысл</th></tr>
<tr><td><span class="dot" style="display:inline-grid"></span></td><td>Урок не начат</td></tr>
<tr><td><span class="dot prog" style="display:inline-grid"></span></td><td>Урок в процессе изучения / контроль доступен</td></tr>
<tr><td><span class="dot done" style="display:inline-grid">✓</span></td><td>Урок или контроль пройден</td></tr>
<tr><td><span class="dot repeat" style="display:inline-grid">!</span></td><td>Нужно повторить урок</td></tr>
<tr><td><span class="dot skip" style="display:inline-grid"></span></td><td>Урок не входит в траекторию</td></tr></table>
<h2>8. Хранение данных</h2>
<p>Профили и результаты хранятся <strong>в этом браузере на этом компьютере</strong>. Если вы откроете пособие на другом устройстве или в другом браузере, данных там не будет. Чтобы перенести результаты, выгрузите их в разделе «Статистика» и передайте преподавателю. Если пособие встроено в сайт (Google Sites) и браузер блокирует сохранение, нажмите «Открыть в новом окне».</p>
<h2>9. Помощь и связь</h2>
<p>По вопросам содержания и работы пособия обращайтесь к преподавателю дисциплины. Контакты разработчика указаны на титульной странице в выходных сведениях.</p>`;

  const HELP_KK = `
<p class="lead">Көмекші электрондық оқу құралымен жұмыс істеу тәртібін түсіндіреді. Оны кез келген уақытта жоғарғы оң жақтағы <strong>«?»</strong> батырмасы арқылы ашуға болады.</p>
<h2>1. Жұмысты бастау</h2>
<ol><li>Жоғарғы оң жақтағы атыңызды (немесе «Кіру») басып, <strong>тіркеліңіз</strong>: аты-жөніңізді және тобыңызды енгізіңіз. PIN-код міндетті емес — компьютерді бірнеше адам қолданса, ол профиліңізді қорғайды.</li>
<li><strong>«Мазмұны»</strong> бөлімін ашып, <strong>оқу траекториясын</strong> таңдаңыз.</li>
<li>«Оқуды бастау» батырмасын басыңыз — траекторияның бірінші сабағы ашылады.</li></ol>
<p>Тіркелусіз <strong>қарау режимі</strong> қолжетімді: барлық материалды оқуға болады, бірақ нәтижелер сақталмайды және бақылау тесттері ашылмайды.</p>
<h2>2. Құралдың құрылымы</h2>
<p>Курс <strong>3 модульден</strong> тұрады, модульдер — <strong>блоктардан</strong>, блоктар — <strong>сабақтардан</strong> (барлығы 15). Әр сабақта қойындылар бар: Теория, Мысалдар, Тапсырмалар, Сұрақтар, Тест, Графика. Теориядағы <u>астын сызылған</u> терминдер тезаурусқа сілтеме болып табылады.</p>
<h2>3. Оқу траекториясы</h2>
<ul><li><strong>Толық таңдау</strong> — барлық сабақтар оқылады.</li>
<li><strong>Қолмен таңдау</strong> — мазмұнда қажетті сабақтарды белгілеңіз.</li>
<li><strong>Тест арқылы таңдау</strong> — бүкіл курс бойынша диагностикалық тест тапсырыңыз; дұрыс жауаптар жеткіліксіз болған сабақтар траекторияға автоматты түрде қосылады.</li></ul>
<h2>4. Сабақты оқу тәртібі және білімді бақылау</h2>
<ol><li>Теория мен мысалдарды оқып, тапсырмаларды орындаңыз.</li>
<li>«Сұрақтар» қойындысындағы барлық сұрақтарға дұрыс жауап беріңіз.</li>
<li>Сабақ тестін тапсырыңыз (<strong>ағымдағы бақылау</strong>). Нәтиже өту балынан төмен болса, сабақты қайта оқып, тестті қайта тапсыру керек.</li>
<li>Блоктың барлық сабақтары өткеннен кейін <strong>аралық бақылау</strong>, модульдің барлық блоктарынан кейін <strong>межелік бақылау</strong>, барлық модульден кейін <strong>қорытынды бақылау</strong> ашылады.</li></ol>
<p>Оқуды кез келген сәтте тоқтатуға болады: келесі жолы титулдық беттегі «Жалғастыру» батырмасын басыңыз.</p>
<h2>5. Тестілеу</h2>
<ul><li>Сұрақтар базадан <strong>кездейсоқ</strong> таңдалады, жауап нұсқаларының реті араласады.</li>
<li>Уақыт шектеулі, таймер жоғарыда көрсетіледі.</li>
<li>Тесттен кейін <strong>қате жауап берілген кез келген сұраққа өтуге</strong> болады: әр нұсқа неге дұрыс не қате екені түсіндіріледі.</li>
<li>«Тестілеу» бөлімінде нәтижені <strong>сақтап немесе сақтамай</strong> жаттығуға болады.</li></ul>
<h2>6. Статистика</h2>
<p>«Статистика» бөлімінде әр сабақтың күйі, ең жақсы және соңғы балл, талпыныстар саны, оқу уақыты және барлық тест тарихы көрсетіледі. Деректерді CSV немесе JSON түрінде жүктеп алуға болады.</p>
<h2>7. Деректерді сақтау</h2>
<p>Профильдер мен нәтижелер <strong>осы компьютердегі осы браузерде</strong> сақталады. Құрал сайтқа (Google Sites) ендірілген болса және браузер сақтауды бұғаттаса, «Жаңа терезеде ашу» батырмасын басыңыз.</p>
<h2>8. Көмек және байланыс</h2>
<p>Мазмұн және жұмыс бойынша сұрақтарды пән оқытушысына қойыңыз. Әзірлеушінің байланыс деректері титулдық беттегі шығу деректерінде көрсетілген.</p>`;
})();
