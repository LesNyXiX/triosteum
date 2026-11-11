  /* Локальный журнал действий: без исходников, значений полей и секретов. */
  var AUD = { max:2000, seq:0, quiet:0, space:curId(), last:null, runSpace:null, ui:null, view:null, back:null };
  var AUD_TYPES = { node_add:'Добавлен блок', node_del:'Удалён блок', node_name:'Переименован блок', code:'Изменён код', edge_add:'Добавлена связь', edge_del:'Удалена связь', note_add:'Добавлена заметка', note_del:'Удалена заметка', run:'Запуск схемы', import:'Загружена схема', restore:'Восстановление' };
  function audSnap(){
    return { nodes:G.nodes.map(function(n){ return { id:n.id, name:n.name, code:Object.keys(n.codes || {}).sort().map(function(k){ return k + '\n' + n.codes[k]; }).join('\n'), lang:n.lang }; }), edges:G.edges.map(function(e){ return { id:e.id, from:e.from, to:e.to, taps:JSON.stringify(e.taps || []) }; }), notes:G.notes.map(function(n){ return { id:n.id }; }) };
  }
  function audList(space){ var a = Repo.pref('audit:' + (space || curId()), []); return Array.isArray(a) ? a.filter(function(r){ return r && typeof r.t === 'number' && isFinite(r.t) && Object.prototype.hasOwnProperty.call(AUD_TYPES, r.type); }).slice(0, AUD.max) : []; }
  function audWho(){ var p = typeof localProfile === 'function' ? localProfile() : Repo.pref('profile', {}); return String(p && p.name || 'Пользователь').slice(0, 80); }
  function audEntry(type, obj, detail){ return { id:Date.now().toString(36) + '-' + (++AUD.seq), t:Date.now(), who:audWho(), type:type, obj:String(obj || '').slice(0, 100), detail:String(detail || '').slice(0, 200) }; }
  function audAppend(rows, space){
    if(!rows.length) return;
    space = space || curId(); Repo.setPref('audit:' + space, rows.slice().reverse().concat(audList(space)).slice(0, AUD.max));
    if(AUD.ui && !AUD.ui.layer.hidden && AUD.view === space) audRender();
  }
  function audMap(a){ var m = Object.create(null); a.forEach(function(v){ m[v.id] = v; }); return m; }
  function audCodeSize(a, b){
    var old = String(a).split('\n'), next = String(b).split('\n'), i = 0, end = 0;
    while(i < old.length && i < next.length && old[i] === next[i]) i++;
    while(end < old.length - i && end < next.length - i && old[old.length - 1 - end] === next[next.length - 1 - end]) end++;
    return '+' + (next.length - i - end) + ' / −' + (old.length - i - end) + ' строк';
  }
  function audDiff(before, after){
    var rows = [], old = audMap(before.nodes), now = audMap(after.nodes);
    after.nodes.forEach(function(n){ var b = old[n.id];
      if(!b) rows.push(audEntry('node_add', n.name));
      else {
        if(n.name !== b.name) rows.push(audEntry('node_name', n.name, b.name + ' → ' + n.name));
        if(n.code !== b.code || n.lang !== b.lang) rows.push(audEntry('code', n.name, audCodeSize(b.code, n.code)));
      }
    });
    before.nodes.forEach(function(n){ if(!now[n.id]) rows.push(audEntry('node_del', n.name)); });
    function edges(a, b, type){ var known = audMap(b); a.forEach(function(e){ if(!known[e.id] || e.from !== known[e.id].from || e.to !== known[e.id].to || e.taps !== known[e.id].taps){ var names = type === 'edge_add' ? now : old; rows.push(audEntry(type, (names[e.from] ? names[e.from].name : e.from) + ' → ' + (names[e.to] ? names[e.to].name : e.to))); } }); }
    edges(after.edges, before.edges, 'edge_add'); edges(before.edges, after.edges, 'edge_del');
    function notes(a, b, type){ var known = audMap(b); a.forEach(function(n){ if(!known[n.id]) rows.push(audEntry(type, 'Заметка ' + n.id)); }); }
    notes(after.notes, before.notes, 'note_add'); notes(before.notes, after.notes, 'note_del');
    return rows;
  }
  function audCollect(){
    var next = audSnap(), space = curId();
    if(!AUD.quiet && AUD.last && AUD.space === space) audAppend(audDiff(AUD.last, next), space);
    AUD.last = next; AUD.space = space;
  }
  function audClose(){ if(AUD.ui) AUD.ui.layer.hidden = true; if(AUD.back && document.contains(AUD.back)) AUD.back.focus(); }
  function audOpen(){
    flushSave(); AUD.back = document.activeElement; AUD.view = curId();
    if(!AUD.ui){
      var layer = h('div', { 'class':'aud-layer', hidden:'' }), box = h('section', { 'class':'aud-window', role:'dialog', 'aria-modal':'true', 'aria-labelledby':'audTitle' });
      var q = h('input', { 'class':'input', type:'search', 'aria-label':'Поиск в журнале', placeholder:'Найти действие или блок' });
      var type = h('select', { 'class':'input', 'aria-label':'Тип действия' }, [h('option', { value:'', text:'Все действия' })]);
      Object.keys(AUD_TYPES).forEach(function(k){ type.appendChild(h('option', { value:k, text:AUD_TYPES[k] })); });
      var rows = h('div', { 'class':'aud-rows' });
      box.appendChild(h('div', { 'class':'aud-head' }, [h('h2', { id:'audTitle', text:'Журнал действий' }), h('button', { type:'button', 'class':'icon-btn', text:'×', 'aria-label':'Закрыть журнал', on:{ click:audClose } })]));
      box.appendChild(h('p', { 'class':'aud-caption', text:'Локальная история этого браузера, последние 2000 записей. Журнал можно очистить; это не защищённый серверный аудит.' }));
      box.appendChild(h('div', { 'class':'aud-filters' }, [q, type]));
      box.appendChild(h('div', { 'class':'acts' }, [h('button', { type:'button', 'class':'btn sm', text:'Выгрузить CSV', on:{ click:audCsv } }), h('button', { type:'button', 'class':'btn sm danger', text:'Очистить журнал', on:{ click:function(){ var space = AUD.view; askConfirm('Очистить журнал действий?', 'Записи этого пространства будут удалены из журнала.', 'Очистить', function(){ Repo.setPref('audit:' + space, []); audRender(); }); } } })]));
      box.appendChild(rows); layer.appendChild(box); document.body.appendChild(layer);
      AUD.ui = { layer:layer, box:box, q:q, type:type, rows:rows };
      q.addEventListener('input', audRender); type.addEventListener('change', audRender);
      box.addEventListener('keydown', function(e){
        if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); audClose(); }
        if(e.key === 'Tab'){ var all = box.querySelectorAll('button,input,select'); if(e.shiftKey && document.activeElement === all[0]){ e.preventDefault(); all[all.length - 1].focus(); } else if(!e.shiftKey && document.activeElement === all[all.length - 1]){ e.preventDefault(); all[0].focus(); } }
      });
    }
    AUD.ui.layer.hidden = false; AUD.ui.q.value = ''; AUD.ui.type.value = ''; audRender(); AUD.ui.q.focus();
  }
  function audFiltered(){
    var q = AUD.ui.q.value.trim().toLowerCase(), type = AUD.ui.type.value;
    return audList(AUD.view).filter(function(r){ return (!type || r.type === type) && (!q || [r.who, r.obj, r.detail, AUD_TYPES[r.type]].join(' ').toLowerCase().indexOf(q) >= 0); });
  }
  function audRender(){
    if(!AUD.ui) return; var box = AUD.ui.rows; box.textContent = ''; var day = '';
    var list = audFiltered();
    if(!list.length) box.appendChild(h('p', { 'class':'aud-caption', text:'Записей нет' }));
    list.forEach(function(r){
      var d = new Date(r.t).toLocaleDateString('ru-RU'); if(d !== day){ day = d; box.appendChild(h('h3', { text:day })); }
      box.appendChild(h('div', { 'class':'aud-row', 'data-type':r.type }, [h('small', { text:new Date(r.t).toLocaleTimeString('ru-RU') + ' · ' + r.who }), h('b', { text:(AUD_TYPES[r.type] || r.type) + ': ' + r.obj }), r.detail ? h('span', { text:r.detail }) : null]));
    });
  }
  function audCsv(){
    var esc = function(v){ v = String(v == null ? '' : v); if(/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var rows = [['Дата', 'Пользователь', 'Действие', 'Объект', 'Подробности']].concat(audFiltered().map(function(r){ return [new Date(r.t).toISOString(), r.who, AUD_TYPES[r.type] || r.type, r.obj, r.detail]; }));
    download('triosteum-audit.csv', '\ufeff' + rows.map(function(r){ return r.map(esc).join(';'); }).join('\r\n'), 'text/csv;charset=utf-8', 'Журнал сохранён');
  }
  (function(){
    AUD.last = audSnap();
    var commit = commitHist; commitHist = function(){ var r = commit.apply(this, arguments); audCollect(); return r; };
    var graph = setGraph; setGraph = function(){ AUD.quiet++; try { return graph.apply(this, arguments); } finally { AUD.quiet--; AUD.space = curId(); AUD.last = audSnap(); } };
    var restore = restoreSnap; restoreSnap = function(){ var r = restore.apply(this, arguments); AUD.last = audSnap(); AUD.space = curId(); audAppend([audEntry('restore', 'Схема', 'Возврат состояния доски')]); return r; };
    var create = newProj; newProj = function(name, data){ var r = create.apply(this, arguments); if(data) audAppend([audEntry('import', name || 'Пространство', 'Создано пространство из схемы')]); AUD.last = audSnap(); AUD.space = curId(); return r; };
    var begin = cmpBegin; cmpBegin = function(){ AUD.runSpace = curId(); return begin.apply(this, arguments); };
    var end = cmpEnd; cmpEnd = function(results, stopped){
      var space = AUD.runSpace || curId(), errors = CMP.errs.length;
      var waiting = CMP.order.some(function(id){ return CMP.blocks[id].s === 'wait' || CMP.blocks[id].s === 'run'; });
      var detail = stopped ? 'Остановлен' : waiting ? 'Исполнитель не запустился' : errors ? 'Ошибок: ' + errors : 'Успешно';
      var r = end.apply(this, arguments); audAppend([audEntry('run', 'Схема', detail)], space); return r;
    };
    var apply = bkApply; bkApply = function(data, label){
      var copy = Object.assign({}, data), projects = copy['triosteum.projects'], space = projects && projects.cur || curId(), key = 'triosteum.audit:' + space;
      copy[key] = [audEntry('restore', 'Резервная копия', label)].concat(Array.isArray(copy[key]) ? copy[key] : []).slice(0, AUD.max);
      return apply(copy, label);
    };
    var commands = cmdCommands; cmdCommands = function(){ return commands().concat([{ sec:'space', label:'Журнал действий', d:'Кто и когда менял блоки и связи в этом браузере', icon:'file', act:audOpen, k:'аудит история изменения audit' }]); };
    var menu = projItems; projItems = function(){ return menu().concat([{ label:'Журнал действий', icon:'file', act:audOpen }]); };
  })();
