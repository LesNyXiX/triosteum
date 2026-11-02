  /* ---------- переключение среды ---------- */
  function setEnv(id){
    ENV = ENVS[id] || ENVS.code;
    UI.envs = UI.envs || {};
    // первый запуск: текущая палитра остаётся за «Разработкой»
    if(!UI.envs.code) UI.envs.code = { theme:UI.theme || 'burgundy', accent:UI.accent || null };
    var et = UI.envs[ENV.id] || { theme:ENV_THEME_DEF[ENV.id] || 'burgundy', accent:null };
    UI.theme = et.theme; UI.accent = et.accent;
    applyTheme(); if(!$('pers').hidden) renderPers();
    LANGS.length = 0; ENV.langs.forEach(function(l){ LANGS.push(l); });
    for(var k in COLORS) delete COLORS[k];
    for(var k2 in ENV.colors) COLORS[k2] = ENV.colors[k2];
    PLUGINS.length = 0; ENV.plugins.forEach(function(p){ PLUGINS.push(p); });
    var sl = load('triosteum.lang.' + ENV.id, ENV.defLang); S.lang = langById(sl) ? sl : ENV.defLang;
    S.filter = 'all';
    document.body.setAttribute('data-env', ENV.id);
    var w = ENV.word;
    function tip(id, t, s){ var b = $(id); if(b){ b.setAttribute('data-tip', t + '|' + s); b.setAttribute('aria-label', t); } }
    tip('bLib', w.lib, isDocs() ? 'Документы, таблицы, этапы и выгрузки' : 'Готовые и ваши плагины');
    tip('bScheme', w.scheme, w.schemeSub);
    tip('bCreate', w.create, isDocs() ? 'Документ, таблица, этап или расчёт' : 'Задайте название и язык');
    tip('bRun', w.run, w.runSub);
    var lh = document.querySelector('#libHead h2'); if(lh) lh.textContent = w.lib;
    $('newTitle').textContent = w.newTitle; $('newLangLabel').textContent = w.kindLabel;
    var sh = document.querySelector('#schemeW .pers-h h2'); if(sh) sh.textContent = w.scheme;
    $('envName').textContent = ENV.name; $('envDot').style.background = ENV.color;
    var hp = el.hint.querySelector('p'), coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    if(hp) hp.textContent = isDocs()
      ? 'Соберите маршрут документа: таблица с данными → шаблон документа → этапы согласования → выгрузка. Нажмите кнопку выше, ' + (coarse ? 'удерживайте палец на доске' : 'правый клик по доске') + ' или кнопку «AI» — ИИ соберёт маршрут по описанию.'
      : (coarse ? 'Удерживайте палец на доске, чтобы добавить элемент, или откройте плагин из библиотеки. Кнопка с лупой вверху — поиск и все команды.'
        : 'Нажмите правой кнопкой по доске, чтобы добавить элемент, откройте плагин из библиотеки или нажмите ' + (IS_MAC ? '⌘K' : 'Ctrl+K') + ' — поиск и команды. Файл пространства можно перетащить прямо сюда.');
    if(typeof ARC !== 'undefined'){ ARC.res = null; ARC.err = null; }
    if(typeof SC !== 'undefined'){ SC.tab = 'auto'; SC.out = ''; SC.err = null; }
    ['arcW', 'schemeW', 'builder', 'resW'].forEach(function(x){ var e = $(x); if(e) e.hidden = true; });
    renderChips(); renderList();
  }
