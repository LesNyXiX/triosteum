  // ---------- поиск и команды ----------
  var cmdEl = $('cmdk'), cmdQ = $('cmdQ'), cmdList = $('cmdList'), cmdRows = [], cmdIdx = 0, cmdBack = null;
  $('cmdKb').textContent = IS_MAC ? '⌘K' : 'Ctrl K';
  function cmdOpen(){ return !cmdEl.hidden; }
  function openCmd(){
    closeCtx(); hidePop();
    cmdBack = document.activeElement;
    cmdEl.hidden = false; cmdQ.value = ''; cmdSec = 'all'; renderCmd(); cmdQ.focus();
  }
  function closeCmd(){ cmdEl.hidden = true; if(cmdBack && cmdBack.focus && document.contains(cmdBack)) cmdBack.focus(); }
  function toCanvas(){ if(S.view !== 'canvas'){ backToCanvas(); } S.lib = false; render(); }
  function placeCenter(kind, lang){ toCanvas(); ctxPoint = viewCenter(); placeAt(kind, lang); }
  /* Разделы окна: слева список разделов, справа — команды с пояснением и клавишами.
     Пустой запрос — недавние и все разделы по порядку; ввод ищет везде. Tab — следующий раздел. */
  var CMD_SECS = [
    { id:'recent', name:'Недавние', icon:'undo' },
    { id:'add', name:'Добавить', icon:'plus' },
    { id:'board', name:'Доска', icon:'layout' },
    { id:'view', name:'Вид', icon:'zoom' },
    { id:'ai', name:'ИИ', icon:'plug' },
    { id:'office', name:'Офис', icon:'file' },
    { id:'space', name:'Пространство', icon:'folder' },
    { id:'file', name:'Файл и экспорт', icon:'download' },
    { id:'env', name:'Среды', icon:'all' },
    { id:'help', name:'Справка и настройки', icon:'keys' },
    { id:'onboard', name:'На доске', icon:'node' },
    { id:'files', name:'Файлы', icon:'file' },
    { id:'spaces', name:'Пространства', icon:'folder' },
    { id:'plugins', name:'Плагины', icon:'lib' }
  ];
  var cmdSec = 'all';
  function secName(id){ var x = CMD_SECS.filter(function(s){ return s.id === id; })[0]; return x ? x.name : id; }
  function cmdCommands(){
    var bk = function(id, d){ var b = $(id); return b && b.dataset.key !== undefined ? b.dataset.key : d; };
    var C = [
      { sec:'board', label:ENV.word.run, d:'Выполнить всю схему по порядку связей', icon:'run', kb:MOD + 'R', act:runBoard, k:'запустить выполнить run компиляция маршрут' },
      { sec:'add', label:ENV.word.lib, d:'Готовые ' + ENV.word.plugins + ' по разделам', icon:'lib', kb:bk('bLib', 'L'), act:function(){ S.lib = true; render(); el.search.focus(); }, k:'плагины шаблоны библиотека' },
      { sec:'add', label:ENV.word.create, d:'Свой ' + ENV.word.plugin + ' с кодом и описанием', icon:'plug', kb:bk('bCreate', 'P'), act:function(){ openCreate(); }, k:'новый плагин шаблон' },
      { sec:'add', label:'Связующая точка', d:'Узел, который собирает потоки нескольких блоков', icon:'hub', act:function(){ placeCenter('hub'); }, k:'добавить узел хаб' },
      { sec:'add', label:'Текстовая заметка', d:'Подпись или пояснение прямо на доске', icon:'text', kb:'T', act:function(){ placeCenter('text'); }, k:'добавить текст' }
    ];
    LANGS.forEach(function(l){ C.push({ sec:'add', label:'Новый блок · ' + (isDocs() ? l.name : shortName(l)), d:l.tool ? String(l.tool).split('—')[0].trim() : '', swatch:grad(COLORS[l.id]), act:function(){ placeCenter('block', l.id); }, k:'добавить блок код ' + l.name }); });
    C = C.concat([
      { sec:'board', label:'Авто-раскладка по связям', d:'Расставить блоки слева направо по потоку данных', icon:'layout', act:function(){ toCanvas(); autoLayout(); }, k:'упорядочить расставить' },
      { sec:'board', label:'Конструктор схемы', d:'Выровнять блоки и поправить связи', icon:'layout', kb:bk('bBuild', 'B'), act:openBuilder, k:'выровнять ии правки связи' },
      { sec:'board', label:'Выделить всё', icon:'all', kb:MOD + 'A', act:function(){ toCanvas(); selectAll(); } },
      { sec:'board', label:'Отменить', icon:'undo', kb:MOD + 'Z', act:undo },
      { sec:'board', label:'Повторить', icon:'redo', kb:IS_MAC ? '⌘⇧Z' : 'Ctrl+Y', act:redo },
      { sec:'view', label:'Вписать всё в экран', d:'Показать всю схему целиком', icon:'fit', kb:bk('bFit', 'F'), act:function(){ toCanvas(); fitView(); }, k:'масштаб показать' },
      { sec:'view', label:'Масштаб 100%', icon:'zoom', act:function(){ toCanvas(); zoomAt(1); }, k:'zoom' },
      { sec:'view', id:'mini', label:(UI.mini !== false ? 'Скрыть' : 'Показать') + ' мини-карту', icon:'map', act:function(){ UI.mini = UI.mini === false; save('triosteum.ui', UI); miniDraw(); toast('Мини-карта ' + (UI.mini ? 'включена' : 'выключена')); } },
      { sec:'view', id:'snap', label:(UI.snap ? 'Выключить' : 'Включить') + ' привязку к сетке', d:'Блоки встают по точкам сетки после перетаскивания', icon:'magnet', act:function(){ UI.snap = !UI.snap; save('triosteum.ui', UI); toast('Привязка к сетке ' + (UI.snap ? 'включена' : 'выключена')); } },
      PANE ? null : { sec:'view', label:'Две среды рядом', d:'Открыть справа ещё одно пространство', icon:'layout', act:function(){ setTimeout(function(){ splitPick($('splitBtn')); }, 120); }, k:'разделить экран окна рядом сплит две среды' },
      { sec:'ai', label:'ИИ-архитектор: собрать схему по описанию', d:'Опишите задачу словами — ИИ соберёт блоки и связи', icon:'plug', act:openArc, k:'ai ии промт сгенерировать' },
      { sec:'ai', label:ENV.word.scheme, d:'Вся схема одним файлом кода', icon:'file', kb:bk('bScheme', 'C'), act:openScheme, k:'бэкенд backend код python регламент' },
      { sec:'space', label:'Создать пространство', icon:'plus', act:function(){ newProj('Новое пространство'); }, k:'новое проект' },
      { sec:'space', label:'Переименовать пространство', icon:'edit', act:renameProj, k:'проект название' },
      { sec:'space', label:'Дублировать пространство', icon:'copy', act:dupProj, k:'проект копия' },
      { sec:'file', label:'Сохранить пространство (.tsm)', d:'Скачать файл пространства', icon:'download', kb:MOD + 'S', act:exportFile, k:'экспорт скачать tsm json' },
      { sec:'file', label:'Сохранить выделенные блоки (.tsm)', icon:'download', act:exportTsmBlocks, k:'экспорт блоки tsm' },
      { sec:'file', label:'Открыть файл…', d:'Пространство .tsm, таблица, документ или картинка', icon:'upload', kb:MOD + 'O', act:function(){ fileIn.click(); }, k:'импорт загрузить' },
      { sec:'file', label:'Экспорт картинки (SVG)', d:'Схема картинкой для презентации', icon:'map', act:exportSvg, k:'изображение скачать' },
      { sec:'file', label:'Скопировать схему (JSON)', icon:'copy', act:copyScheme },
      { sec:'help', label:'Персонализация', d:'Тема, кнопки, клавиши, резервные копии', icon:'pers', kb:IS_MAC ? '⌘,' : 'Ctrl+,', act:openPers, k:'тема цвет акцент настройки' },
      { sec:'help', label:'Горячие клавиши', d:'Все сочетания клавиш', icon:'keys', kb:'?', act:function(){ showTip($('bKeys'), 6000); }, k:'клавиши сочетания' },
      { sec:'help', label:'Тур по Triosteum', d:'Короткое знакомство за минуту', icon:'map', act:function(){ setTimeout(tourStart, 120); }, k:'обучение помощь подсказки знакомство' }
    ]);
    return C.filter(Boolean);
  }
  function cmdAll(q){
    var rows = [];
    G.nodes.forEach(function(n){ var nl = langById(n.lang); rows.push({ sec:'onboard', label:n.name, sub:(n.kind === 'hub' ? 'точка · ' : '') + (nl ? shortName(nl) : ''), swatch:grad(colorsOf(n)), act:function(){ focusItem('node', n); }, k:n.desc || '' }); });
    G.notes.forEach(function(t){ if(t.text && t.text.trim()) rows.push({ sec:'onboard', label:t.text.trim().split('\n')[0].slice(0, 80), sub:t.attach ? 'комментарий' : 'заметка', icon:'text', act:function(){ focusItem('note', t); }, k:t.text }); });
    rows = rows.concat(cmdCommands());
    Object.keys(ENVS).forEach(function(k){ if(k !== ENV.id) rows.push({ sec:'env', label:'Перейти в среду «' + ENVS[k].name + '»', swatch:ENVS[k].color, act:function(){ goEnv(k); }, k:'среда переключить ' + ENVS[k].short }); });
    rows.push({ sec:'env', label:'Экосистема — все среды', d:'Выбрать среду работы', icon:'all', act:openEco, k:'среды сферы' });
    rows.push({ sec:'env', label:'Пример офиса', d:'Связанные таблица, отчёт, презентация и форма', icon:'file', act:function(){ goEnv('docs', true); }, k:'демо пример офис' });
    if(isOffice()){
      ofTypes().concat(['folder']).forEach(function(t){ rows.push({ sec:'office', label:'Создать: ' + FT[t].name.toLowerCase(), swatch:FT[t].color, act:function(){ if(OF.tab === 'auto') ofSetTab('desk'); newFile(t); }, k:'новый файл ' + FT[t].many }); });
      rows.push({ sec:'office', label:'Шаблоны файлов', icon:'lib', act:openTpl, k:'шаблон' });
      rows.push({ sec:'office', label:'Рабочий стол', icon:'folder', act:function(){ ofSetTab('desk'); } });
      rows.push({ sec:'office', label:'Автоматизация (маршруты)', icon:'layout', act:function(){ ofSetTab('auto'); } });
      rows.push({ sec:'office', label:'AI-помощник офиса', icon:'plug', act:function(){ OF.ai = true; if(OF.tab === 'auto') ofSetTab('desk'); else ofRender(); }, k:'ии' });
      ofItems().forEach(function(f){ if(f.type !== 'folder') rows.push({ sec:'files', label:f.name, sub:FT[f.type].name, swatch:FT[f.type].color, act:function(){ ofOpen(f.id); }, k:filePreview(f) }); });
    }
    PROJ.list.forEach(function(p){ if(p.id !== PROJ.cur) rows.push({ sec:'spaces', label:p.name, sub:ENVS[p.env || 'code'].name, icon:'folder', act:function(){ switchProj(p.id); } }); });
    if(q) PLUGINS.concat(myVis()).forEach(function(p){ var l = langById(p.lang); rows.push({ sec:'plugins', label:p.name, sub:libCatName(p) + ' · ' + (l ? shortName(l) : ''), d:p.desc, swatch:grad(COLORS[p.lang] || ['#888', '#666']), act:function(){ toCanvas(); openOnBoard(p.id); }, k:(p.desc || '') + ' ' + (p.family || '') }); });
    rows.forEach(function(r){ r.group = secName(r.sec); });
    if(!q){
      // недавние — наверху
      var rec = Repo.pref('cmdRecent', []) || [], recRows = [];
      rec.forEach(function(key){ var r = rows.filter(function(x){ return (x.id || x.label) === key && x.sec !== 'onboard'; })[0]; if(r) recRows.push(Object.assign({}, r, { sec:'recent', group:'Недавние' })); });
      return recRows.slice(0, 5).concat(rows);
    }
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.map(function(r){
      var name = r.label.toLowerCase(), hay = (r.label + ' ' + (r.sub || '') + ' ' + (r.d || '') + ' ' + r.group + ' ' + (r.k || '')).toLowerCase();
      if(!words.every(function(w){ return hay.indexOf(w) >= 0; })) return null;
      r.score = (name.indexOf(words[0]) === 0 ? 0 : (name.indexOf(words[0]) >= 0 ? 1 : 2)) + (r.sec === 'plugins' ? 0.5 : 0);
      return r;
    }).filter(Boolean).sort(function(a, b){ return a.score - b.score; });
  }
  function cmdMark(text, q){
    var span = document.createElement('span'); span.className = 'lbl';
    var w = (q || '').toLowerCase().split(/\s+/).filter(Boolean)[0], i = w ? text.toLowerCase().indexOf(w) : -1;
    if(i < 0){ span.textContent = text; return span; }
    span.appendChild(document.createTextNode(text.slice(0, i)));
    span.appendChild(h('mark', { text:text.slice(i, i + w.length) }));
    span.appendChild(document.createTextNode(text.slice(i + w.length)));
    return span;
  }
  function renderCmd(){
    var q = cmdQ.value.trim(), all = cmdAll(q);
    // разделы слева: сколько в каждом по текущему запросу
    var counts = {}; all.forEach(function(r){ counts[r.sec] = (counts[r.sec] || 0) + 1; });
    if(cmdSec !== 'all' && !counts[cmdSec]) cmdSec = 'all';
    var nav = $('cmdNav'); nav.innerHTML = '';
    [{ id:'all', name:'Все', icon:'all' }].concat(CMD_SECS).forEach(function(s){
      var n = s.id === 'all' ? all.length : counts[s.id]; if(!n) return;
      var b = h('button', { type:'button', 'class':'cmdk-s' + (cmdSec === s.id ? ' on' : ''), role:'tab', 'aria-selected':cmdSec === s.id ? 'true' : 'false', tabindex:'-1' }, [ h('span', { 'class':'ic', html:ico(s.icon) }), h('span', { 'class':'nm', text:s.name }), h('span', { 'class':'n', text:String(n) }) ]);
      b.addEventListener('click', function(){ cmdSec = s.id; renderCmd(); cmdQ.focus(); });
      nav.appendChild(b);
    });
    cmdRows = (cmdSec === 'all' ? all : all.filter(function(r){ return r.sec === cmdSec; })).slice(0, 120); cmdIdx = 0; cmdList.innerHTML = '';
    if(!cmdRows.length){ cmdList.appendChild(h('div', { 'class':'cmdk-empty' }, [ h('b', { text:'Ничего не найдено' }), h('span', { text:'Попробуйте другое слово: например «экспорт», «тема» или название блока.' }) ])); $('cmdCount').textContent = ''; return; }
    // группы идут блоками: недавние, затем в порядке разделов (при поиске — по первому появлению)
    var order = []; cmdRows.forEach(function(r){ if(order.indexOf(r.group) < 0) order.push(r.group); });
    if(!q){ var so = CMD_SECS.map(function(s){ return s.name; }); order.sort(function(a, b){ return so.indexOf(a) - so.indexOf(b); }); }
    var sorted = []; order.forEach(function(g){ cmdRows.forEach(function(r){ if(r.group === g) sorted.push(r); }); }); cmdRows = sorted;
    var last = null;
    cmdRows.forEach(function(r, i){
      if(r.group !== last && cmdSec === 'all'){ cmdList.appendChild(h('div', { 'class':'cmdk-g', role:'presentation', text:r.group })); }
      last = r.group;
      var b = h('button', { type:'button', 'class':'cmdk-i' + (r.d ? ' two' : ''), role:'option', id:'cmd-' + i, tabindex:'-1' });
      var ic = h('span', { 'class':'ic' });
      if(r.swatch) ic.innerHTML = '<i style="display:block;width:14px;height:14px;border-radius:4px;background:' + r.swatch + '"></i>'; else ic.innerHTML = ico(r.icon || 'node');
      var txt = h('span', { 'class':'tx' }, [ cmdMark(r.label, q) ]);
      if(r.d) txt.appendChild(h('span', { 'class':'d', text:r.d }));
      b.appendChild(ic); b.appendChild(txt);
      if(r.sub) b.appendChild(h('span', { 'class':'sub', text:r.sub }));
      if(r.kb) b.appendChild(h('kbd', { 'class':'kb', text:r.kb }));
      b.addEventListener('mousemove', function(){ if(cmdIdx !== i){ cmdIdx = i; markCmd(false); } });
      b.addEventListener('click', function(){ cmdIdx = i; runCmd(); });
      cmdList.appendChild(b);
    });
    $('cmdCount').textContent = q ? 'Найдено: ' + cmdRows.length : '';
    markCmd(true);
  }
  function markCmd(scroll){
    Array.prototype.forEach.call(cmdList.querySelectorAll('.cmdk-i'), function(b, i){ b.classList.toggle('on', i === cmdIdx); b.setAttribute('aria-selected', i === cmdIdx ? 'true' : 'false'); });
    var on = $('cmd-' + cmdIdx); cmdQ.setAttribute('aria-activedescendant', on ? on.id : '');
    if(on && scroll !== false) on.scrollIntoView({ block:'nearest' });
  }
  function runCmd(){
    var r = cmdRows[cmdIdx]; if(!r) return;
    if(r.sec !== 'onboard' && r.sec !== 'files' && r.sec !== 'plugins'){ var key = r.id || r.label, rec = (Repo.pref('cmdRecent', []) || []).filter(function(x){ return x !== key; }); rec.unshift(key); Repo.setPref('cmdRecent', rec.slice(0, 8)); }
    cmdQ.blur(); cmdEl.hidden = true; cmdBack = null; r.act();
  }
  function cmdSecStep(d){
    var tabs = Array.prototype.slice.call($('cmdNav').querySelectorAll('.cmdk-s'));
    var cur = tabs.findIndex(function(b){ return b.classList.contains('on'); });
    var next = tabs[(cur + d + tabs.length) % tabs.length]; if(next) next.click();
  }
  cmdQ.addEventListener('input', renderCmd);
  cmdQ.addEventListener('keydown', function(e){
    if(e.key === 'ArrowDown'){ e.preventDefault(); if(cmdRows.length){ cmdIdx = (cmdIdx + 1) % cmdRows.length; markCmd(); } }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); if(cmdRows.length){ cmdIdx = (cmdIdx - 1 + cmdRows.length) % cmdRows.length; markCmd(); } }
    else if(e.key === 'Enter'){ e.preventDefault(); runCmd(); }
    else if(e.key === 'Tab'){ e.preventDefault(); cmdSecStep(e.shiftKey ? -1 : 1); }
    else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closeCmd(); }
  });
  cmdEl.addEventListener('pointerdown', function(e){ if(e.target === cmdEl) closeCmd(); });
  $('cmdBtn').addEventListener('click', openCmd);
  function focusItem(type, o){
    toCanvas();
    if(type === 'note' && o.hidden && o.attach){ var an = nodeById(o.attach); if(an){ toggleComments(an); } }
    var r = el.canvas.getBoundingClientRect(), d = domOf(type, o.id), w = type === 'node' ? NWof(o) : (d ? d.offsetWidth : 160), hh = type === 'node' ? NHof(o) : (d ? d.offsetHeight : 40);
    G.cam.x = r.width / 2 - (o.x + w / 2) * G.cam.k; G.cam.y = r.height / 2 - (o.y + hh / 2) * G.cam.k;
    applyCam(); saveGraph();
    S.multi = []; S.sel = { type:type, id:o.id }; updateSel();
    d = domOf(type, o.id); if(d){ d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash'); setTimeout(function(){ d.classList.remove('flash'); }, 1300); }
  }
