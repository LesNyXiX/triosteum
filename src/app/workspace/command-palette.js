  // ---------- поиск и команды ----------
  var cmdEl = $('cmdk'), cmdQ = $('cmdQ'), cmdList = $('cmdList'), cmdRows = [], cmdIdx = 0, cmdBack = null;
  $('cmdKb').textContent = IS_MAC ? '⌘K' : 'Ctrl K';
  function cmdOpen(){ return !cmdEl.hidden; }
  function openCmd(){
    closeCtx(); hidePop();
    cmdBack = document.activeElement;
    cmdEl.hidden = false; cmdQ.value = ''; renderCmd(); cmdQ.focus();
  }
  function closeCmd(){ cmdEl.hidden = true; if(cmdBack && cmdBack.focus && document.contains(cmdBack)) cmdBack.focus(); }
  function toCanvas(){ if(S.view !== 'canvas'){ backToCanvas(); } S.lib = false; render(); }
  function placeCenter(kind, lang){ toCanvas(); ctxPoint = viewCenter(); placeAt(kind, lang); }
  function cmdCommands(){
    var C = [
      { label:ENV.word.run, icon:'run', kb:MOD + 'R', act:runBoard, k:'запустить выполнить run компиляция маршрут' },
      { label:ENV.word.lib, icon:'lib', act:function(){ S.lib = true; render(); el.search.focus(); }, k:'плагины шаблоны' },
      { label:ENV.word.create, icon:'plug', act:function(){ openCreate(); }, k:'новый плагин шаблон' },
      { label:'Связующая точка', icon:'hub', act:function(){ placeCenter('hub'); }, k:'добавить узел хаб' },
      { label:'Текстовая заметка', icon:'text', act:function(){ placeCenter('text'); }, k:'добавить текст' }
    ];
    LANGS.forEach(function(l){ C.push({ label:(isDocs() ? 'Новый блок · ' + l.name : 'Новый блок · ' + shortName(l)), swatch:grad(COLORS[l.id]), act:function(){ placeCenter('block', l.id); }, k:'добавить блок код ' + l.name }); });
    C = C.concat([
      { label:'Вписать всё в экран', icon:'fit', act:function(){ toCanvas(); fitView(); }, k:'масштаб показать' },
      { label:'Масштаб 100%', icon:'zoom', act:function(){ toCanvas(); zoomAt(1); }, k:'zoom' },
      { label:'Авто-раскладка по связям', icon:'layout', act:function(){ toCanvas(); autoLayout(); }, k:'упорядочить расставить' },
      { label:'Конструктор схемы', icon:'layout', act:openBuilder, k:'выровнять ии правки связи' },
      { label:'ИИ-архитектор: собрать схему по описанию', icon:'plug', act:openArc, k:'ai ии промт сгенерировать' },
      { label:ENV.word.scheme, icon:'file', act:openScheme, k:'бэкенд backend код python регламент' },
      { label:'Выделить всё', icon:'all', kb:MOD + 'A', act:function(){ toCanvas(); selectAll(); } },
      { label:'Отменить', icon:'undo', kb:MOD + 'Z', act:undo },
      { label:'Повторить', icon:'redo', act:redo },
      { label:(UI.mini !== false ? 'Скрыть' : 'Показать') + ' мини-карту', icon:'map', act:function(){ UI.mini = UI.mini === false; save('triosteum.ui', UI); miniDraw(); toast('Мини-карта ' + (UI.mini ? 'включена' : 'выключена')); } },
      { label:(UI.snap ? 'Выключить' : 'Включить') + ' привязку к сетке', icon:'magnet', act:function(){ UI.snap = !UI.snap; save('triosteum.ui', UI); toast('Привязка к сетке ' + (UI.snap ? 'включена' : 'выключена')); } },
      { label:'Персонализация', icon:'pers', act:openPers, k:'тема цвет акцент настройки' },
      { label:'Создать пространство', icon:'plus', act:function(){ newProj('Новое пространство'); }, k:'новое проект' },
      { label:'Переименовать пространство', icon:'edit', act:renameProj, k:'проект название' },
      { label:'Дублировать пространство', icon:'copy', act:dupProj, k:'проект копия' },
      { label:'Сохранить в файл (.json)', icon:'download', kb:MOD + 'S', act:exportFile, k:'экспорт скачать' },
      { label:'Открыть файл…', icon:'upload', kb:MOD + 'O', act:function(){ fileIn.click(); }, k:'импорт загрузить' },
      { label:'Экспорт картинки (SVG)', icon:'map', act:exportSvg, k:'изображение скачать' },
      { label:'Скопировать схему (JSON)', icon:'copy', act:copyScheme },
      { label:'Горячие клавиши', icon:'keys', act:function(){ showTip($('bKeys'), 6000); }, k:'клавиши сочетания' }
    ]);
    return C.map(function(c){ c.group = 'Команды'; return c; });
  }
  function cmdAll(q){
    var rows = [];
    G.nodes.forEach(function(n){ var nl = langById(n.lang); rows.push({ group:'На доске', label:n.name, sub:(n.kind === 'hub' ? 'точка · ' : '') + (nl ? shortName(nl) : ''), swatch:grad(colorsOf(n)), act:function(){ focusItem('node', n); }, k:n.desc || '' }); });
    G.notes.forEach(function(t){ if(t.text && t.text.trim()) rows.push({ group:'На доске', label:t.text.trim().split('\n')[0].slice(0, 80), sub:t.attach ? 'комментарий' : 'заметка', icon:'text', act:function(){ focusItem('note', t); }, k:t.text }); });
    rows = rows.concat(cmdCommands());
    Object.keys(ENVS).forEach(function(k){ if(k !== ENV.id) rows.push({ group:'Экосистема', label:'Перейти в среду «' + ENVS[k].name + '»', swatch:ENVS[k].color, act:function(){ goEnv(k); }, k:'среда переключить ' + ENVS[k].short }); });
    rows.push({ group:'Экосистема', label:'Экосистема — все среды', icon:'all', act:openEco, k:'среды сферы' });
    rows.push({ group:'Экосистема', label:'Пример офиса: связанные таблица, отчёт, презентация, форма', icon:'file', act:function(){ goEnv('docs', true); }, k:'демо пример офис' });
    if(isDocs()){
      ['doc', 'sheet', 'slides', 'form', 'folder'].forEach(function(t){ rows.push({ group:'Офис', label:'Создать: ' + FT[t].name.toLowerCase(), swatch:FT[t].color, act:function(){ if(OF.tab === 'auto') ofSetTab('desk'); newFile(t); }, k:'новый файл ' + FT[t].many }); });
      rows.push({ group:'Офис', label:'Шаблоны файлов', icon:'lib', act:openTpl, k:'шаблон' });
      rows.push({ group:'Офис', label:'Рабочий стол', icon:'folder', act:function(){ ofSetTab('desk'); } });
      rows.push({ group:'Офис', label:'Автоматизация (маршруты)', icon:'layout', act:function(){ ofSetTab('auto'); } });
      rows.push({ group:'Офис', label:'AI-помощник офиса', icon:'plug', act:function(){ OF.ai = true; if(OF.tab === 'auto') ofSetTab('desk'); else ofRender(); }, k:'ии' });
      ofItems().forEach(function(f){ if(f.type !== 'folder') rows.push({ group:'Файлы', label:f.name, sub:FT[f.type].name, swatch:FT[f.type].color, act:function(){ ofOpen(f.id); }, k:filePreview(f) }); });
    }
    PROJ.list.forEach(function(p){ if(p.id !== PROJ.cur) rows.push({ group:'Пространства', label:p.name, sub:ENVS[p.env || 'code'].name, icon:'folder', act:function(){ switchProj(p.id); } }); });
    if(q) PLUGINS.concat(myVis()).forEach(function(p){ var l = langById(p.lang); rows.push({ group:'Плагины', label:p.name, sub:'на доску · ' + (l ? shortName(l) : ''), swatch:grad(COLORS[p.lang] || ['#888', '#666']), act:function(){ toCanvas(); openOnBoard(p.id); }, k:(p.desc || '') + ' ' + (p.family || '') }); });
    if(!q) return rows;
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.map(function(r){
      var name = r.label.toLowerCase(), hay = (r.label + ' ' + (r.sub || '') + ' ' + r.group + ' ' + (r.k || '')).toLowerCase();
      if(!words.every(function(w){ return hay.indexOf(w) >= 0; })) return null;
      r.score = (name.indexOf(words[0]) === 0 ? 0 : (name.indexOf(words[0]) >= 0 ? 1 : 2));
      return r;
    }).filter(Boolean).sort(function(a, b){ return a.score - b.score; });
  }
  function renderCmd(){
    var q = cmdQ.value.trim();
    cmdRows = cmdAll(q).slice(0, 80); cmdIdx = 0; cmdList.innerHTML = '';
    if(!cmdRows.length){ cmdList.appendChild(h('div', { 'class':'cmdk-empty', text:'Ничего не найдено' })); return; }
    // группы идут блоками, в порядке первого появления
    var order = []; cmdRows.forEach(function(r){ if(order.indexOf(r.group) < 0) order.push(r.group); });
    var sorted = []; order.forEach(function(g){ cmdRows.forEach(function(r){ if(r.group === g) sorted.push(r); }); }); cmdRows = sorted;
    var last = null;
    cmdRows.forEach(function(r, i){
      if(r.group !== last){ cmdList.appendChild(h('div', { 'class':'cmdk-g', text:r.group })); last = r.group; }
      var b = h('button', { type:'button', 'class':'cmdk-i', role:'option', id:'cmd-' + i, tabindex:'-1' });
      var ic = h('span', { 'class':'ic' });
      if(r.swatch) ic.innerHTML = '<i style="display:block;width:12px;height:12px;border-radius:3px;background:' + r.swatch + '"></i>'; else ic.innerHTML = ico(r.icon || 'node');
      b.appendChild(ic); b.appendChild(h('span', { 'class':'lbl', text:r.label }));
      if(r.sub) b.appendChild(h('span', { 'class':'sub', text:r.sub }));
      if(r.kb) b.appendChild(h('span', { 'class':'kb', text:r.kb }));
      b.addEventListener('mousemove', function(){ if(cmdIdx !== i){ cmdIdx = i; markCmd(false); } });
      b.addEventListener('click', function(){ cmdIdx = i; runCmd(); });
      cmdList.appendChild(b);
    });
    markCmd(true);
  }
  function markCmd(scroll){
    Array.prototype.forEach.call(cmdList.querySelectorAll('.cmdk-i'), function(b, i){ b.classList.toggle('on', i === cmdIdx); b.setAttribute('aria-selected', i === cmdIdx ? 'true' : 'false'); });
    var on = $('cmd-' + cmdIdx); cmdQ.setAttribute('aria-activedescendant', on ? on.id : '');
    if(on && scroll !== false) on.scrollIntoView({ block:'nearest' });
  }
  function runCmd(){ var r = cmdRows[cmdIdx]; if(!r) return; cmdQ.blur(); cmdEl.hidden = true; cmdBack = null; r.act(); }
  cmdQ.addEventListener('input', renderCmd);
  cmdQ.addEventListener('keydown', function(e){
    if(e.key === 'ArrowDown'){ e.preventDefault(); if(cmdRows.length){ cmdIdx = (cmdIdx + 1) % cmdRows.length; markCmd(); } }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); if(cmdRows.length){ cmdIdx = (cmdIdx - 1 + cmdRows.length) % cmdRows.length; markCmd(); } }
    else if(e.key === 'Enter'){ e.preventDefault(); runCmd(); }
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
