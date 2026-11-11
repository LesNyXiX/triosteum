  // ---------- пространства ----------
  var PROJ = Repo.spaceList();
  if(!PROJ || !PROJ.list || !PROJ.list.length){ PROJ = { cur:'p1', list:[{ id:'p1', name:'Новое пространство', t:Date.now() }] }; Repo.saveSpaceList(PROJ); }
  if(PANE && PROJ.list.some(function(p){ return p.id === PANE; })) PROJ.cur = PANE;
  // каждое пространство хранится под своим ключом: вкладки с разными пространствами не перетирают друг друга
  function curId(){ return PROJ ? PROJ.cur : 'p1'; }
  function gKey(){ return 'triosteum.proj.' + curId(); }   // устарело: используйте Repo.space(curId())
  (function migrate(){
    var own = Repo.space(curId());
    if(own && Array.isArray(own.nodes)){ var g = normGraph(own); Object.keys(G).forEach(function(k){ delete G[k]; }); for(var k in g) G[k] = g[k]; }
    else Repo.saveSpace(curId(), G);
  })();
  var extTimer = null;
  Store.watch(function(key, val){
    var silent = SERVER && SERVER.quietUpdate(key);
    if(Repo.isSpaceListKey(key) && val && val.list){ var np = val; np.cur = PROJ.cur; PROJ.list = np.list.some(function(p){ return p.id === PROJ.cur; }) ? np.list : PROJ.list.concat(np.list.filter(function(p){ return !PROJ.list.some(function(q){ return q.id === p.id; }); })); showProjName(); return; }
    if(!Repo.isSpaceKey(key, curId()) || !val) return;
    // то же пространство изменили в другой вкладке (или на сервере) — подтягиваем свежую версию
    clearTimeout(extTimer);
    extTimer = setTimeout(function(){
      if(saveGraphTimer && !silent){ toast('Это пространство изменено в другой вкладке — сохранится последняя правка'); return; }
      try{
        var g = normGraph(val); Object.keys(G).forEach(function(k){ delete G[k]; }); for(var k in g) G[k] = g[k];
        // Внешний граф обновляет базовый снимок, но не создаёт новое локальное действие.
        hist.undo = []; hist.redo = []; hist.last = null; commitHist(true);
        S.sel = null; S.multi = []; hidePop(); renderGraph(); applyCam();
        if(typeof ofLoad === 'function'){ var keep = OF.tab; ofLoad(); if(keep && keep !== OF.tab && (keep === 'auto' || keep === 'desk' || keep === 'map' || ofFile(keep))) ofSetTab(keep); }
        if(!silent) toast('Пространство обновлено: изменения из другой вкладки');
      }catch(x){}
    }, 250);
  });
  function curProj(){ return PROJ.list.filter(function(p){ return p.id === PROJ.cur; })[0] || PROJ.list[0]; }
  function saveProj(){ Repo.saveSpaceList(PROJ); }
  function showProjName(){ var p = curProj(); $('projName').textContent = p.name; document.title = p.name + ' — Triosteum'; }
  function uniqueName(name){
    var base = (name || 'Пространство').trim() || 'Пространство', n = base, i = 2;
    while(PROJ.list.some(function(p){ return p.name === n; })) n = base + ' ' + (i++);
    return n;
  }
  function normGraph(o){
    o = JSON.parse(JSON.stringify(o || {}));
    var g = { nodes:o.nodes || [], edges:o.edges || [], notes:o.notes || [], cam:o.cam || { x:0, y:0, k:1 }, seq:o.seq || 1 };
    if(o.backend) g.backend = o.backend;
    if(o.files) g.files = o.files;
    g.nodes.forEach(function(n){ if(!n.codes) n.codes = {}; });
    var mx = 0;
    [].concat(g.nodes, g.edges, g.notes).forEach(function(x){ var m = /(\d+)$/.exec(String(x.id)); if(m) mx = Math.max(mx, +m[1]); });
    g.edges.forEach(function(e){ (e.taps || []).forEach(function(tp){ var m = /(\d+)$/.exec(String(tp.id)); if(m) mx = Math.max(mx, +m[1]); }); });
    g.seq = Math.max(g.seq, mx + 1);
    return g;
  }
  function setGraph(o){
    var g = normGraph(o);
    Object.keys(G).forEach(function(k){ delete G[k]; });
    for(var k in g) G[k] = g[k];
    S.sel = null; S.multi = []; hidePop(); closeCtx();
    hist.undo = []; hist.redo = []; hist.last = null; commitHist();
    runState = {};
    if(S.view !== 'canvas'){ S.view = 'canvas'; }
    S.doc = G.nodes[0] ? { kind:'node', id:G.nodes[0].id } : null;
    render(); renderGraph(); applyCam();
    Repo.saveSpace(curId(), G);
    ofLoad();
  }
  function stashCur(){ flushSave(); Repo.saveSpace(curId(), G); curProj().t = Date.now(); saveProj(); }
  function switchProj(id){
    if(id === PROJ.cur) return;
    stashCur(); PROJ.cur = id; saveProj();
    var envChanged = (curProj().env || 'code') !== ENV.id;
    setEnv(curProj().env || 'code');
    setGraph(Repo.space(id)); showProjName();
    toast('Открыто пространство «' + curProj().name + '»' + (envChanged ? ' · среда «' + ENV.name + '»' : ''));
  }
  function newProj(name, data, env){
    stashCur();
    env = ENVS[env] ? env : ENV.id;
    var id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    PROJ.list.push({ id:id, name:uniqueName(name), t:Date.now(), env:env }); PROJ.cur = id; saveProj();
    if(env !== ENV.id) setEnv(env);
    setGraph(data || null); Repo.saveSpace(id, G); showProjName();
    return id;
  }
  function dupProj(){ var g = JSON.parse(JSON.stringify(G)); newProj(curProj().name + ' (копия)', g); toast('Создана копия пространства'); }
  var delArm = 0;
  function delProj(){
    if(PROJ.list.length < 2){ toast('Это единственное пространство — создайте ещё одно, чтобы удалить это'); return; }
    if(Date.now() - delArm > 4000){ delArm = Date.now(); toast('Удалить «' + curProj().name + '» без возврата? Выберите пункт ещё раз'); return; }
    delArm = 0;
    var gone = curProj();
    Repo.removeSpace(gone.id);
    PROJ.list = PROJ.list.filter(function(p){ return p.id !== gone.id; });
    var next = PROJ.list.slice().sort(function(a, b){ return b.t - a.t; })[0];
    PROJ.cur = next.id; saveProj();
    setEnv(next.env || 'code');
    setGraph(Repo.space(next.id)); showProjName();
    toast('Пространство «' + gone.name + '» удалено');
  }
  /* ---------- очистка: доска, пространство, пространства среды, все пространства, настройки ----------
     Опасные действия подтверждаются повторным выбором; последнее можно вернуть пунктом «Вернуть…» (до перезагрузки). */
  var CLR = { undo:null };
  // окно подтверждения: заголовок, пояснение, кнопка действия; Enter — да, Esc — нет
  function askConfirm(title, text, yes, fn){
    var m = $('askModal'), prev = document.activeElement;
    $('askTitle').textContent = title; $('askText').textContent = text; $('askYes').textContent = yes || 'Да';
    m.hidden = false; setTimeout(function(){ $('askNo').focus(); }, 30);
    function close(ok){ m.hidden = true; $('askYes').onclick = $('askNo').onclick = null; m.onkeydown = m.onpointerdown = null; if(prev && prev.focus) try { prev.focus(); } catch(e){} if(ok) fn(); }
    $('askYes').onclick = function(){ close(true); }; $('askNo').onclick = function(){ close(false); };
    m.onkeydown = function(e){ if(e.key === 'Escape'){ e.stopPropagation(); close(false); } };
    m.onpointerdown = function(e){ if(e.target === m) close(false); };
  }
  function clrConfirm(id, text, fn){ askConfirm(text + '?', 'Если передумаете — «Пространство → Очистка → Вернуть» (до перезагрузки страницы).', 'Очистить', fn); }
  function emptyGraph(cam){ return { nodes:[], edges:[], notes:[], cam:cam || { x:0, y:0, k:1 }, seq:1 }; }
  function clrBackup(label, ids, ui){
    stashCur();
    var b = { label:label, list:JSON.parse(JSON.stringify(PROJ.list)), cur:PROJ.cur, spaces:{}, ui:ui ? JSON.parse(JSON.stringify(UI)) : null };
    (ids || []).forEach(function(id){ b.spaces[id] = Repo.space(id); });
    CLR.undo = b;
  }
  function clrRestore(){
    var b = CLR.undo; if(!b) return; CLR.undo = null;
    if(b.ui){ UI = b.ui; save('triosteum.ui', UI); applyUI(); applyTheme(); if(typeof dockRefresh === 'function') dockRefresh(); toast('Настройки возвращены'); return; }
    Object.keys(b.spaces).forEach(function(id){ if(b.spaces[id]) Repo.saveSpace(id, b.spaces[id]); });
    PROJ.list = b.list; PROJ.cur = b.cur; saveProj();
    setEnv(curProj().env || 'code'); setGraph(Repo.space(PROJ.cur)); showProjName();
    toast('Возвращено: ' + b.label);
  }
  function clearSpaces(ids, label){
    clrBackup(label, ids);
    ids.forEach(function(id){ if(id !== PROJ.cur) Repo.saveSpace(id, emptyGraph()); });
    if(ids.indexOf(PROJ.cur) >= 0) setGraph(emptyGraph(G.cam));
    PROJ.list.forEach(function(p){ if(ids.indexOf(p.id) >= 0) p.t = Date.now(); }); saveProj();
    toast(label + ' — готово. Передумали? Пространство → Очистка → «Вернуть»');
  }
  function clearCurSpace(){ var nm = curProj().name; clrConfirm('cur', 'Очистить всё в «' + nm + '»: доску, файлы и код схемы', function(){ clearSpaces([PROJ.cur], 'Очищено пространство «' + nm + '»'); }); }
  function clearEnvSpaces(k){
    k = ENVS[k] ? k : ENV.id; var nm = ENVS[k].name, ids = envProjects(k).map(function(p){ return p.id; });
    if(!ids.length){ toast('В среде «' + nm + '» нет пространств'); return; }
    clrConfirm('env', 'Очистить все пространства среды «' + nm + '» (' + ids.length + ')', function(){ clearSpaces(ids, 'Очищены пространства среды «' + nm + '»'); });
  }
  // одно пространство по id (из меню дока сред) — не обязательно открытое
  function spaceName(id){ var p = PROJ.list.filter(function(x){ return x.id === id; })[0]; return p ? p.name : ''; }
  function clearSpaceById(id){ var nm = spaceName(id); if(!nm) return; clrConfirm('one', 'Очистить всё в «' + nm + '»: доску, файлы и код схемы', function(){ clearSpaces([id], 'Очищено пространство «' + nm + '»'); }); }
  function deleteSpaceById(id){ var nm = spaceName(id); if(!nm) return; askConfirm('Удалить «' + nm + '»?', 'Пространство исчезнет из списка вместе с содержимым. Передумаете — «Вернуть» в меню среды (до перезагрузки страницы).', 'Удалить', function(){ deleteSpaces([id], 'Пространство «' + nm + '»'); }); }
  function deleteEnvSpaces(k){
    var nm = ENVS[k].name, ids = envProjects(k).map(function(p){ return p.id; });
    if(!ids.length) return;
    askConfirm('Удалить все пространства среды «' + nm + '» (' + ids.length + ')?', 'Они исчезнут вместе с содержимым. Передумаете — «Вернуть» в меню среды (до перезагрузки страницы).', 'Удалить', function(){ deleteSpaces(ids, 'Пространства среды «' + nm + '»'); });
  }
  // удаляет пространства с возможностью вернуть; если удалили открытое — открывается самое свежее из оставшихся,
  // если не осталось ни одного — создаётся пустое в текущей среде
  function deleteSpaces(ids, label){
    clrBackup(label, ids);
    ids.forEach(function(id){ Repo.removeSpace(id); });
    var curGone = ids.indexOf(PROJ.cur) >= 0;
    PROJ.list = PROJ.list.filter(function(p){ return ids.indexOf(p.id) < 0; });
    if(!PROJ.list.length){
      var nid = 'p' + Date.now().toString(36);
      PROJ.list = [{ id:nid, name:envNewName(ENV.id), t:Date.now(), env:ENV.id }]; PROJ.cur = nid; saveProj();
      setGraph(emptyGraph()); Repo.saveSpace(nid, G); showProjName();
    } else if(curGone){
      var next = PROJ.list.slice().sort(function(a, b){ return b.t - a.t; })[0];
      PROJ.cur = next.id; saveProj(); setEnv(next.env || 'code'); setGraph(Repo.space(next.id)); showProjName();
    } else { saveProj(); showProjName(); }
    toast(label + ' — удалено. Передумали? Правый щелчок по среде в доке → «Вернуть»');
  }
  function clearAllSpaces(){ var ids = PROJ.list.map(function(p){ return p.id; }); clrConfirm('all', 'Очистить содержимое всех пространств (' + ids.length + '), названия останутся', function(){ clearSpaces(ids, 'Очищены все пространства'); }); }
  function deleteAllSpaces(){ clrConfirm('del', 'Удалить все пространства (' + PROJ.list.length + ') и начать с одного пустого', deleteAllNow); }
  function deleteAllNow(){
    var ids = PROJ.list.map(function(p){ return p.id; });
    clrBackup('Все пространства', ids);
    ids.forEach(function(id){ Repo.removeSpace(id); });
    var id = 'p' + Date.now().toString(36);
    PROJ.list = [{ id:id, name:envNewName(ENV.id), t:Date.now(), env:ENV.id }]; PROJ.cur = id; saveProj();
    setGraph(emptyGraph()); Repo.saveSpace(id, G); showProjName();
    toast('Все пространства удалены. Передумали? Пространство → Очистка → «Вернуть»');
  }
  function resetUiSettings(){ clrConfirm('ui', 'Сбросить оформление: темы, свои темы, кнопки панелей, размеры текста', resetUiNow); }
  function resetUiNow(){
    clrBackup('Настройки', [], true);
    UI = { scale:100, code:14, note:14 }; save('triosteum.ui', UI); applyUI(); applyTheme(); if(typeof dockReset === 'function') dockReset();
    if(!$('pers').hidden) renderPers();
    toast('Оформление сброшено. Передумали? Пространство → Очистка → «Вернуть»');
  }
  function clearSecretsKeys(){ askConfirm('Удалить секреты блоков и ключи ИИ?', 'Их нельзя будет вернуть — придётся ввести заново.', 'Удалить', clearKeysNow); }
  function clearKeysNow(){
    ['triosteum.secrets', 'triosteum.claude.key', 'triosteum.ai.key.openai', 'triosteum.claude.on'].forEach(function(k){ try { localStorage.removeItem(k); } catch(e){} try { sessionStorage.removeItem(k); } catch(e){} });
    if(typeof CL !== 'undefined' && CL.on && typeof clDisable === 'function') clDisable(true);
    toast('Секреты и ключи ИИ удалены из этого браузера');
  }
  function clearItems(){
    var u = CLR.undo;
    return (u ? [{ label:'Вернуть: ' + u.label, icon:'undo', act:clrRestore }, { sep:true }] : []).concat([
      { label:'Очистить доску', icon:'trash', act:function(){ clrConfirm('board', 'Убрать с доски все блоки, связи и заметки', function(){ clrBackup('Доска', [PROJ.cur]); clearBoard(); }); } },
      { label:'Очистить это пространство целиком', icon:'trash', act:clearCurSpace },
      { label:'Очистить все пространства среды «' + ENV.name + '»', icon:'trash', act:clearEnvSpaces },
      { label:'Очистить все пространства', icon:'trash', danger:true, act:clearAllSpaces },
      { label:'Удалить все пространства', icon:'trash', danger:true, act:deleteAllSpaces },
      { sep:true },
      { label:'Сбросить оформление и панели', icon:'edit', act:resetUiSettings },
      { label:'Удалить секреты и ключи ИИ', icon:'trash', act:clearSecretsKeys }
    ]);
  }
  function renameProj(){
    var btn = $('projBtn'), inp = h('input', { 'class':'proj-in', type:'text', 'aria-label':'Название пространства', maxlength:'80' });
    inp.value = curProj().name; btn.hidden = true; btn.parentNode.insertBefore(inp, btn); inp.focus(); inp.select();
    var done = false;
    function finish(ok){
      if(done) return; done = true;
      var v = inp.value.trim();
      if(ok && v && v !== curProj().name){ curProj().name = uniqueName(v); saveProj(); toast('Пространство переименовано'); }
      inp.remove(); btn.hidden = false; showProjName(); btn.focus();
    }
    inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); finish(true); } else if(e.key === 'Escape'){ e.preventDefault(); finish(false); } e.stopPropagation(); });
    inp.addEventListener('blur', function(){ finish(true); });
  }
  function projItems(){
    var items = [];
    // текущая среда — первой
    [ENV.id].concat(Object.keys(ENVS).filter(function(k){ return k !== ENV.id; })).forEach(function(k){
      var list = envProjects(k); if(!list.length) return;
      items.push({ head:ENVS[k].name });
      list.forEach(function(p){ items.push({ label:p.name, icon:p.id === PROJ.cur ? 'check' : 'folder', act:function(){ switchProj(p.id); } }); });
    });
    return items.concat([{ sep:true },
      { label:'Создать пространство', icon:'plus', sub:Object.keys(ENVS).map(function(k){ return { label:'В среде «' + ENVS[k].name + '»', swatch:ENVS[k].color, act:function(){ newProj(k === 'docs' ? 'Документооборот' : 'Новое пространство', null, k); toast('Создано пустое пространство · ' + ENVS[k].name); } }; }) },
      { label:'Экосистема — все среды…', icon:'all', act:openEco },
      { label:'Переименовать…', icon:'edit', act:renameProj },
      { label:'Дублировать', icon:'copy', act:dupProj },
      { sep:true }].concat(shareItems()).concat([{ sep:true },
      { label:'Очистка', icon:'trash', sub:clearItems() },
      { label:'Удалить пространство', icon:'trash', danger:true, act:delProj }]).concat(accountItems()));
  }
  // вход в облако: кто вошёл, перенос из браузера, выход
  // в приложении для Windows — вернуться к выбору режима (сервер или без интернета)
  function desktopItems(){ return window.triosteumDesktop && window.triosteumDesktop.switchMode ? [{ label:'Режим работы приложения…', icon:'layout', act:function(){ window.triosteumDesktop.switchMode(); } }] : []; }
  function accountItems(){
    if(!SERVER){
      var lp = localProfile(); if(!lp) return desktopItems().length ? [{ sep:true }].concat(desktopItems()) : [];
      return [{ sep:true }, { head:lp.name + ' · ' + lp.org }, { label:'Профиль…', icon:'user', act:function(){ showWelcome(true); } }].concat(desktopItems()).concat([
        { label:'Выйти', icon:'logout', act:localLogout }]);
    }
    var u = SERVER.user || {}, items = [{ sep:true }, { head:(u.name || u.email || 'Аккаунт') + (SERVER.org ? ' · ' + SERVER.org.name : '') }];
    if(SERVER.localCount()) items.push({ label:'Перенести пространства из этого браузера…', icon:'cloud', act:importLocal });
    items.push({ label:'Команда…', icon:'user', act:openTeam });
    items.push({ label:'История версий…', icon:'layout', act:openHistory });
    if(SERVER.admin) items.push({ label:'Панель администратора…', icon:'keys', act:function(){ openAdmin(); } });
    items = items.concat(desktopItems());
    items.push({ label:'Выйти', icon:'logout', act:function(){ SERVER.logout(); } });
    return items;
  }
  function importLocal(){
    var n = SERVER.localCount();
    toast('Переносим пространства: ' + n + '…');
    SERVER.importLocal().then(function(r){
      toast('Перенесено пространств: ' + (r && r.spaces != null ? r.spaces : n) + '. Обновляем страницу…');
      setTimeout(function(){ location.reload(); }, 900);
    }, function(){ toast('Не удалось перенести — проверьте связь и попробуйте ещё раз'); });
  }
  function shareItems(){
    return [
      { label:'Сохранить пространство (.tsm)', icon:'download', kb:MOD + 'S', act:exportFile },
      { label:'Сохранить выделенные блоки (.tsm)', icon:'download', act:exportTsmBlocks },
      { label:'Открыть файл…', icon:'upload', kb:MOD + 'O', act:function(){ fileIn.click(); } },
      { label:'Скопировать схему (JSON)', icon:'copy', act:copyScheme },
      { label:'Экспорт картинки (SVG)', icon:'map', disabled:!G.nodes.length && !G.notes.length, act:exportSvg }
    ];
  }
  $('projBtn').addEventListener('click', function(){
    var r = this.getBoundingClientRect();
    if(!ctxEl.hidden && this.getAttribute('aria-expanded') === 'true'){ closeCtx(); return; }
    openMenuAt(projItems(), r.left, r.bottom + 6, this);
  });
  $('projBtn').addEventListener('dblclick', function(){ closeCtx(); renameProj(); });
  $('shareBtn').addEventListener('click', function(){
    var r = this.getBoundingClientRect(), z = UI.scale / 100;
    if(!ctxEl.hidden && this.getAttribute('aria-expanded') === 'true'){ closeCtx(); return; }
    openMenuAt([{ head:'Поделиться пространством' }].concat(shareItems()), r.right - 260 * z, r.bottom + 6, this);
  });
