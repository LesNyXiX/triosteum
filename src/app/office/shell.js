  /* =====================================================================
     ОФИС: рабочий стол с файлами, проводник, вкладки и редакторы
     (документы, таблицы, презентации, формы), связанные между собой.
     Маршруты согласования — во вкладке «Автоматизация».
     ===================================================================== */
  var SVGI = function(p, s){ return '<svg viewBox="0 0 24 24" width="' + (s || 18) + '" height="' + (s || 18) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var FT = {
    doc:{ name:'Документ', many:'Документы', color:'#2563EB', ic:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 12h6M10 16h6"/>' },
    sheet:{ name:'Таблица', many:'Таблицы', color:'#16A34A', ic:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>' },
    slides:{ name:'Презентация', many:'Презентации', color:'#EA580C', ic:'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M12 17v3M8 21h8M8 13l3-3 2 2 3-3"/>' },
    form:{ name:'Форма', many:'Формы', color:'#9333EA', ic:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>' },
    folder:{ name:'Папка', many:'Папки', color:'#CA8A04', ic:'<path d="M3 7a1 1 0 011-1h5l2 2h8a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1z"/>' }
  };
  var OF = { tab:'desk', dir:null, sel:[], side:window.innerWidth > 900, ai:false, view:'icons', q:'', trash:null, drag:null };
  function ofs(){ if(!G.files) G.files = { items:[], open:[], active:'desk' }; if(!G.files.open) G.files.open = []; return G.files; }
  function ofItems(){ return ofs().items; }
  function ofFile(id){ return ofItems().filter(function(f){ return f.id === id; })[0]; }
  function ofByName(name, type){ var n = String(name).trim().toLowerCase(); return ofItems().filter(function(f){ return (!type || f.type === type) && f.name.toLowerCase() === n; })[0]; }
  function officeOn(){ return typeof ENV !== 'undefined' && ENV && ENV.id === 'docs' && OF.tab !== 'auto'; }
  var ofSaveT = null;
  function ofSave(){ var f = ofFile(OF.tab); if(f) f.t = Date.now(); saveGraph(); }
  function ofId(){ return 'f' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36); }
  function ofChildren(dir){ return ofItems().filter(function(f){ return (f.parent || null) === (dir || null); }); }
  function ofPath(f){ var p = [], x = f; while(x && x.parent){ x = ofFile(x.parent); if(x) p.unshift(x); } return p; }
  function ofUnique(name, parent){ var base = name, n = name, i = 2; while(ofChildren(parent).some(function(f){ return f.name.toLowerCase() === n.toLowerCase(); })) n = base + ' ' + (i++); return n; }
  function ofFreeSpot(dir){
    var taken = ofChildren(dir).map(function(f){ return Math.round(f.x / 184) + ':' + Math.round(f.y / 156); });
    for(var i = 0; i < 400; i++){ var cols = Math.max(3, Math.floor(((OF.deskW || 900) - 40) / 184)), x = i % cols, y = Math.floor(i / cols); if(taken.indexOf(x + ':' + y) < 0) return { x:24 + x * 184, y:24 + y * 156 }; }
    return { x:24, y:24 };
  }
  function blankSheet(name){ return { name:name || 'Лист1', rows:[['']], fmt:{}, widths:{}, charts:[] }; }
  function defaultData(type){
    if(type === 'doc') return { html:'<h1>Новый документ</h1><p>Начните печатать здесь. Вставляйте живые данные из таблиц кнопкой «Данные из таблицы».</p>' };
    if(type === 'sheet') return { sheets:[blankSheet('Лист1')] };
    if(type === 'slides') return { theme:'light', slides:[{ layout:'title', title:'Название презентации', body:'Подзаголовок · ' + new Date().toLocaleDateString('ru-RU') }] };
    if(type === 'form') return { title:'Новая форма', desc:'Заполните поля и нажмите «Отправить».', fields:[{ id:'q1', label:'ФИО', type:'text', required:true }, { id:'q2', label:'Подразделение', type:'select', options:['Производство', 'Снабжение', 'Финансы'] }], target:null };
    return {};
  }
  function newFile(type, name, data, parent, opts){
    parent = parent === undefined ? OF.dir : parent;
    var sp = ofFreeSpot(parent);
    var f = { id:ofId(), type:type, name:ofUnique(name || (type === 'folder' ? 'Новая папка' : 'Новый ' + FT[type].name.toLowerCase().replace('новый ', '')), parent), parent:parent || null,
      x:sp.x, y:sp.y, data:data || defaultData(type), t:Date.now() };
    if(type === 'doc' && !name) f.name = ofUnique('Новый документ', parent);
    if(type === 'sheet' && !name) f.name = ofUnique('Новая таблица', parent);
    if(type === 'slides' && !name) f.name = ofUnique('Новая презентация', parent);
    if(type === 'form' && !name) f.name = ofUnique('Новая форма', parent);
    ofItems().push(f); ofSave();
    if(!(opts && opts.silent)){ if(type !== 'folder') ofOpen(f.id); else ofRender(); }
    return f;
  }
  function ofOpen(id){
    var f = ofFile(id); if(!f) return;
    if(f.type === 'folder'){ OF.dir = f.id; ofSetTab('desk'); return; }
    var s = ofs(); if(s.open.indexOf(id) < 0) s.open.push(id);
    ofSetTab(id);
  }
  function ofClose(id){
    var s = ofs(), i = s.open.indexOf(id); if(i < 0) return;
    if(id === OF.tab) ofCommit();
    s.open.splice(i, 1);
    if(OF.tab === id) ofSetTab(s.open[Math.min(i, s.open.length - 1)] || 'desk'); else ofRenderTabs();
    saveGraph();
  }
  function ofCommit(){ if(OF.commit){ try{ OF.commit(); }catch(e){} } }
  function ofSetTab(t){
    ofCommit(); OF.commit = null;
    if(t !== 'desk' && t !== 'auto' && !ofFile(t)) t = 'desk';
    var wasAuto = OF.tab === 'auto';
    OF.tab = t; ofs().active = t; saveGraph();
    if(t === 'auto' || wasAuto){ S.view = 'canvas'; render(); if(t === 'auto') renderGraph(); }
    ofRender();
  }
  function ofDelete(ids){
    var all = [];
    (function rec(list){ list.forEach(function(id){ var f = ofFile(id); if(!f) return; all.push(f); if(f.type === 'folder') rec(ofChildren(f.id).map(function(x){ return x.id; })); }); })(ids);
    if(!all.length) return;
    OF.trash = all.map(function(f){ return JSON.parse(JSON.stringify(f)); });
    var gone = all.map(function(f){ return f.id; });
    G.files.items = ofItems().filter(function(f){ return gone.indexOf(f.id) < 0; });
    G.files.open = ofs().open.filter(function(id){ return gone.indexOf(id) < 0; });
    if(gone.indexOf(OF.tab) >= 0) OF.tab = 'desk';
    if(gone.indexOf(OF.dir) >= 0) OF.dir = null;
    OF.sel = []; saveGraph(); ofRender();
    toast('Удалено: ' + (all.length === 1 ? '«' + all[0].name + '»' : all.length + ' объектов') + ' · ' + MOD + 'Z — вернуть');
  }
  function ofRestore(){
    if(!OF.trash){ toast('Нечего возвращать'); return; }
    OF.trash.forEach(function(f){ if(!ofFile(f.id)) ofItems().push(f); }); OF.trash = null; saveGraph(); ofRender(); toast('Файлы возвращены');
  }
  function ofDuplicate(id){
    var f = ofFile(id); if(!f || f.type === 'folder') return;
    var c = JSON.parse(JSON.stringify(f)); c.id = ofId(); c.name = ofUnique(f.name + ' (копия)', f.parent); c.x += 24; c.y += 24; c.t = Date.now();
    ofItems().push(c); saveGraph(); ofRender(); toast('Создана копия «' + c.name + '»');
  }
  function ofRename(id){
    var f = ofFile(id); if(!f) return;
    var card = document.querySelector('[data-fid="' + id + '"] .fc-name') || document.querySelector('.otab[data-tab="' + id + '"] .nm');
    var inp = h('input', { 'class':'input fc-ren', 'aria-label':'Новое имя', maxlength:'80' }); inp.value = f.name;
    if(!card){ var v = window.prompt ? null : null; }
    var host = card || $('ofMain');
    var old = card ? card.textContent : '';
    if(card){ card.textContent = ''; card.appendChild(inp); } else { host.insertBefore(inp, host.firstChild); }
    inp.focus(); inp.select();
    var done = false;
    function fin(ok){ if(done) return; done = true; var v = inp.value.trim(); if(ok && v && v !== f.name){ f.name = ofUnique(v, f.parent) === v ? v : ofUnique(v, f.parent); f.t = Date.now(); saveGraph(); } inp.remove(); if(card) card.textContent = f.name || old; ofRender(); }
    inp.addEventListener('keydown', function(e){ e.stopPropagation(); if(e.key === 'Enter'){ e.preventDefault(); fin(true); } if(e.key === 'Escape'){ e.preventDefault(); fin(false); } });
    inp.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
    inp.addEventListener('blur', function(){ fin(true); });
  }
  function ofMoveTo(ids, dir){
    ids.forEach(function(id){
      var f = ofFile(id); if(!f || f.id === dir) return;
      for(var x = ofFile(dir); x; x = x.parent ? ofFile(x.parent) : null) if(x.id === f.id) return;   // не кладём папку в саму себя
      f.parent = dir || null; var sp = ofFreeSpot(dir); f.x = sp.x; f.y = sp.y;
    });
    saveGraph(); ofRender();
  }
  function fmtAgo(t){
    if(!t) return ''; var s = (Date.now() - t) / 1000;
    if(s < 60) return 'только что'; if(s < 3600) return Math.floor(s / 60) + ' мин назад'; if(s < 86400) return Math.floor(s / 3600) + ' ч назад';
    return new Date(t).toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
  }
  function ofIcon(type, size){ return SVGI(FT[type].ic, size); }

  /* ---------- оболочка: вкладки, проводник ---------- */
  function ofApplyMode(){
    var on = isDocs();
    $('otabs').hidden = !on;
    document.body.setAttribute('data-mode', on && OF.tab !== 'auto' ? 'office' : (on ? 'auto' : 'code'));
    $('office').hidden = !officeOn();
  }
  function ofRender(){
    ofApplyMode();
    if(!isDocs()) return;
    ofRenderTabs();
    if(!officeOn()){ status(); return; }
    el.canvas.hidden = true; el.editor.hidden = true; el.lib.hidden = true; hidePop();
    $('ofSide').hidden = !OF.side; $('ofAi').hidden = !OF.ai;
    $('ofrFiles').classList.toggle('on', OF.side); $('ofrFiles').setAttribute('aria-pressed', OF.side ? 'true' : 'false');
    $('ofAiBtn').classList.toggle('on', OF.ai); $('ofAiBtn').setAttribute('aria-pressed', OF.ai ? 'true' : 'false');
    ofRenderTree();
    var m = $('ofMain'); m.innerHTML = ''; OF.commit = null;
    var f = ofFile(OF.tab);
    if(!f) renderDesk(m);
    else if(f.type === 'doc') renderDocEd(m, f);
    else if(f.type === 'sheet') renderSheetEd(m, f);
    else if(f.type === 'slides') renderSlidesEd(m, f);
    else if(f.type === 'form') renderFormEd(m, f);
    if(OF.ai) renderOfAi();
    $('topRun').textContent = !f ? 'Запустить маршрут' : ({ doc:'Предпросмотр', sheet:'Пересчитать', slides:'▶ Показ', form:'Заполнить' })[f.type];
    $('topRun').classList.toggle('on', !!(f && f.type === 'doc' && DE.preview));
    status();
  }
  function ofRenderTabs(){
    var box = $('otabFiles'); box.innerHTML = '';
    Array.prototype.forEach.call(document.querySelectorAll('#otabs .otab.fixed'), function(b){ var on = b.dataset.tab === OF.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    ofs().open.forEach(function(id){
      var f = ofFile(id); if(!f) return; var on = id === OF.tab;
      var t = h('div', { 'class':'otab' + (on ? ' on' : ''), 'data-tab':id, role:'tab', 'aria-selected':on ? 'true' : 'false', tabindex:'0', title:f.name, style:'--fc:' + FT[f.type].color }, [
        h('span', { 'class':'ic', html:ofIcon(f.type, 14) }), h('span', { 'class':'nm', text:f.name }),
        h('button', { type:'button', 'class':'x', 'aria-label':'Закрыть «' + f.name + '»', html:SVGI('<path d="M6 6l12 12M18 6L6 18"/>', 12),
          on:{ click:function(e){ e.stopPropagation(); ofClose(id); } } })
      ]);
      t.addEventListener('click', function(){ if(OF.tab !== id) ofSetTab(id); });
      t.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); ofSetTab(id); } });
      t.addEventListener('auxclick', function(e){ if(e.button === 1) ofClose(id); });
      box.appendChild(t);
    });
    var on = box.querySelector('.otab.on'); if(on && on.scrollIntoView) on.scrollIntoView({ block:'nearest', inline:'nearest' });
  }
  Array.prototype.forEach.call(document.querySelectorAll('#otabs .otab.fixed'), function(b){ b.addEventListener('click', function(){ if(b.dataset.tab === 'desk') OF.dir = OF.tab === 'desk' ? null : OF.dir; ofSetTab(b.dataset.tab); }); });
  function ofRenderTree(){
    var t = $('ofTree'); t.innerHTML = '';
    var q = OF.q.trim().toLowerCase();
    if(q){
      var hits = ofItems().filter(function(f){ return f.name.toLowerCase().indexOf(q) >= 0; });
      if(!hits.length) t.appendChild(h('div', { 'class':'of-empty', text:'Ничего не найдено' }));
      hits.forEach(function(f){ t.appendChild(treeRow(f, 0)); });
      return;
    }
    (function rec(dir, depth){
      ofChildren(dir).sort(function(a, b){ return (a.type === 'folder' ? 0 : 1) - (b.type === 'folder' ? 0 : 1) || a.name.localeCompare(b.name, 'ru'); }).forEach(function(f){
        t.appendChild(treeRow(f, depth));
        if(f.type === 'folder' && f.openTree !== false) rec(f.id, depth + 1);
      });
    })(null, 0);
    if(!ofItems().length) t.appendChild(h('div', { 'class':'of-empty', text:'Файлов пока нет. Создайте документ, таблицу, презентацию или форму.' }));
  }
  function treeRow(f, depth){
    var on = f.id === OF.tab || (f.type === 'folder' && f.id === OF.dir && OF.tab === 'desk');
    var r = h('button', { type:'button', 'class':'tr' + (on ? ' on' : ''), style:'padding-left:' + (10 + depth * 14) + 'px;--fc:' + FT[f.type].color, title:f.name }, [
      f.type === 'folder' ? h('span', { 'class':'car' + (f.openTree === false ? '' : ' open'), html:SVGI('<path d="M9 6l6 6-6 6"/>', 12) }) : h('span', { 'class':'car sp' }),
      h('span', { 'class':'ic', html:ofIcon(f.type, 15) }), h('span', { 'class':'nm', text:f.name })
    ]);
    r.addEventListener('click', function(e){
      if(f.type === 'folder' && e.target.closest('.car')){ f.openTree = f.openTree === false; saveGraph(); ofRenderTree(); return; }
      if(f.type === 'folder'){ OF.dir = f.id; ofSetTab('desk'); } else ofOpen(f.id);
      if(window.innerWidth < 760){ OF.side = false; ofRender(); }
    });
    r.addEventListener('contextmenu', function(e){ e.preventDefault(); fileMenu(f, e.clientX, e.clientY); });
    return r;
  }
  $('ofSearch').addEventListener('input', function(){ OF.q = $('ofSearch').value; ofRenderTree(); });
  $('ofNew').addEventListener('click', function(){ var r = this.getBoundingClientRect(); openMenuAt(newItems(), r.left, r.bottom + 6); });
  $('ofrFiles').addEventListener('click', function(){ OF.side = !OF.side; ofRender(); });
  $('ofrNew').addEventListener('click', function(){ var r = this.getBoundingClientRect(); openMenuAt(newItems(), r.right + 8, r.top); });
  $('ofrTpl').addEventListener('click', function(){ openTpl(); });
  $('ofrImport').addEventListener('click', function(){ ofImportIn.click(); });
  $('ofAiBtn').addEventListener('click', function(){ OF.ai = !OF.ai; ofRender(); if(OF.ai){ var t = $('ofAi').querySelector('textarea'); if(t) t.focus(); } });
  function newItems(dir){
    var d = dir === undefined ? OF.dir : dir;
    return [{ head:'Создать' }].concat(['doc', 'sheet', 'slides', 'form', 'folder'].map(function(t){
      return { label:FT[t].name, swatch:FT[t].color, act:function(){ var prev = OF.dir; OF.dir = d; newFile(t); OF.dir = t === 'folder' ? d : prev; if(t === 'folder') ofRender(); } };
    })).concat([{ sep:true }, { label:'Из шаблона…', icon:'lib', act:openTpl }, { label:'Открыть файл с компьютера…', icon:'upload', act:function(){ ofImportIn.click(); } }]);
  }
  function fileMenu(f, x, y){
    var folders = ofItems().filter(function(z){ return z.type === 'folder' && z.id !== f.id; });
    var items = [
      { head:f.name },
      { label:f.type === 'folder' ? 'Открыть папку' : 'Открыть', icon:'file', act:function(){ ofOpen(f.id); } },
      { label:'Переименовать', icon:'edit', kb:'F2', act:function(){ ofRename(f.id); } },
      f.type !== 'folder' ? { label:'Дублировать', icon:'copy', act:function(){ ofDuplicate(f.id); } } : null,
      f.type !== 'folder' ? { label:'Скачать', icon:'download', sub:exportItems(f) } : null,
      { label:'Переместить в…', icon:'folder', sub:[{ label:'Рабочий стол', icon:'folder', act:function(){ ofMoveTo([f.id], null); } }].concat(folders.map(function(z){ return { label:z.name, icon:'folder', act:function(){ ofMoveTo([f.id], z.id); } }; })) },
      f.type !== 'folder' ? { label:'Где используется', icon:'map', act:function(){ showLinks(f); } } : null,
      { sep:true },
      { label:'Удалить', icon:'trash', danger:true, kb:'Del', act:function(){ ofDelete([f.id]); } }
    ];
    openMenuAt(items, x, y);
  }
