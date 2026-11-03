  /* ---------- связь с «Автоматизацией»: блоки берут данные из файлов ---------- */
  function fileAsBlockCode(f, lang){
    if(lang === 'sheet' && f.type === 'sheet'){ calcReset(); return JSON.stringify({ rows:sheetValues(f, 0).map(function(r){ return r.map(function(v){ return typeof v === 'number' ? String(v) : String(v === undefined ? '' : v); }); }) }); }
    if(lang === 'doc' && f.type === 'doc') return docExportHtml(f);
    return null;
  }
  function srcSection(n){
    var type = n.lang === 'sheet' ? 'sheet' : 'doc', list = ofItems().filter(function(x){ return x.type === type; });
    var s = h('select', { 'class':'input', 'aria-label':'Источник данных блока' });
    s.appendChild(h('option', { value:'', text:'Своё содержимое блока' }));
    list.forEach(function(x){ var o = h('option', { value:x.id, text:'Файл: ' + x.name }); if(n.src === x.id) o.selected = true; s.appendChild(o); });
    s.addEventListener('change', function(){ n.src = s.value || null; saveGraph(); refreshNode(n); renderPop(); toast(n.src ? 'Блок берёт данные из файла — правки в файле сразу попадают в маршрут' : 'Блок использует своё содержимое'); });
    return h('div', { 'class':'prm' }, [ s, h('div', { 'class':'prm-hint', text:list.length ? 'Выберите ' + (type === 'sheet' ? 'таблицу' : 'документ') + ' с рабочего стола — маршрут будет работать с живыми данными.' : 'На рабочем столе пока нет ' + (type === 'sheet' ? 'таблиц' : 'документов') + '.' }) ]);
  }
  function saveResultsToFiles(){
    if(!RES.items.length) return;
    var dir = newFile('folder', 'Результаты маршрута ' + new Date().toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }), null, null, { silent:true });
    var n = 0;
    RES.items.forEach(function(it){
      if(it.type === 'doc'){ newFile('doc', it.title, { html:it.html + (it.status.length ? '<p style="color:#666;font-size:12px">Отметки маршрута: ' + escHtml(it.status.join(' → ')) + '</p>' : '') }, dir.id, { silent:true }); n++; }
      else if(it.type === 'table'){ var aoa = rowsToAoa(it.rows); newFile('sheet', it.title, { sheets:[{ name:'Лист1', rows:aoa.map(function(r){ return r.map(function(v){ return String(v); }); }), fmt:{}, widths:{}, charts:[] }] }, dir.id, { silent:true }); n++; }
    });
    saveGraph(); toast('Сохранено в «Файлы»: ' + n + ' (папка «' + dir.name + '»)');
    return dir;
  }

  function ofLoad(){
    var s = G.files, a = s && s.active;
    OF.tab = a && (a === 'desk' || a === 'auto' || ofFile(a)) ? a : 'desk';
    OF.dir = null; OF.sel = []; OF.commit = null; SG.f = null; SE.f = null; FE.f = null; DE.f = null; OA.res = null; OA.err = null;
    if(isOffice() && OF.tab === 'auto'){ S.view = 'canvas'; render(); renderGraph(); }
    ofRender();
  }