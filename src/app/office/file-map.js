  /* =====================================================================
     СХЕМА ФАЙЛОВ: все файлы офиса — блоки, зависимости между ними — связи.
     Связи находятся сами (формулы между таблицами, живые вставки в
     документы и слайды, формы → таблицы) и создаются протягиванием линии.
     «Скомпилировать» — пересчёт всех файлов по порядку зависимостей
     с отчётом об ошибках, битых ссылках и циклах.
     ===================================================================== */
  var FM = { cam:{ x:40, y:40, k:1 }, sel:null, status:{}, report:null, order:[], drag:null };
  var FM_W = 220, FM_H = 92;
  var REF_RE = /(?:'([^']+)'|([A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_.]*))!\$?[A-Z]{1,3}\$?\d+/g;
  function fmFiles(){ return ofItems().filter(function(f){ return f.type !== 'folder'; }); }
  // зависимости: from — источник данных, to — кто его использует
  function fmEdges(){
    var map = {}, files = fmFiles();
    function add(from, to, kind){ if(!from || !to || from.id === to.id) return; var k = from.id + '>' + to.id; if(!map[k]) map[k] = { from:from.id, to:to.id, kinds:{}, n:0 }; map[k].kinds[kind] = (map[k].kinds[kind] || 0) + 1; map[k].n++; }
    files.forEach(function(f){
      if(f.type === 'sheet') f.data.sheets.forEach(function(sh){ sh.rows.forEach(function(row){ row.forEach(function(v){
        if(typeof v !== 'string' || v.charAt(0) !== '=') return; var m; REF_RE.lastIndex = 0;
        while((m = REF_RE.exec(v))){ var t = sheetRef({ file:f }, m[1] || m[2]); if(t && t.file.id !== f.id) add(t.file, f, 'формулы'); }
      }); }); });
      if(f.type === 'doc'){
        var html = f.data.html || '', m2, re = /data-src="([^"]+)"/g; while((m2 = re.exec(html))) add(ofFile(m2[1]), f, 'вставки');
        var re2 = /data-ref="([^"]+)"/g; while((m2 = re2.exec(html))){ var mm = /^(?:'([^']+)'|([^!]+))!/.exec(m2[1].replace(/&#39;|&apos;/g, "'")); var t2 = mm && sheetRef({ file:null }, mm[1] || mm[2]); if(t2) add(t2.file, f, 'значения'); }
      }
      if(f.type === 'slides') (f.data.slides || []).forEach(function(s){ if(s.embed && s.embed.src) add(ofFile(s.embed.src), f, 'диаграммы'); });
      if(f.type === 'form' && f.data.target) add(f, ofFile(f.data.target), 'ответы');
      if(f.type === 'vector') (f.data.items || []).forEach(function(o){ if(o.t === 'image' && o.src && ofFile(o.src)) add(ofFile(o.src), f, 'картинки'); });
    });
    return Object.keys(map).map(function(k){ return map[k]; });
  }
  // порядок пересчёта и циклы (Кан + поиск компонент сильной связности)
  function fmOrder(files, edges){
    var indeg = {}, out = {}; files.forEach(function(f){ indeg[f.id] = 0; out[f.id] = []; });
    edges.forEach(function(e){ if(indeg[e.to] === undefined || !out[e.from]) return; indeg[e.to]++; out[e.from].push(e.to); });
    var q = files.filter(function(f){ return !indeg[f.id]; }).map(function(f){ return f.id; }), order = [];
    while(q.length){ var id = q.shift(); order.push(id); out[id].forEach(function(t){ if(--indeg[t] === 0) q.push(t); }); }
    var cyc = files.filter(function(f){ return order.indexOf(f.id) < 0; }).map(function(f){ return f.id; });
    return { order:order, cyclic:cyc };
  }
  function fmLayout(force){
    var files = fmFiles(), edges = fmEdges(), lvl = {}, plan = fmOrder(files, edges);
    plan.order.concat(plan.cyclic).forEach(function(id){ var L = 0; edges.forEach(function(e){ if(e.to === id && lvl[e.from] !== undefined) L = Math.max(L, lvl[e.from] + 1); }); lvl[id] = L; });
    var cols = {}; files.forEach(function(f){ if(force || !f.map){ (cols[lvl[f.id] || 0] = cols[lvl[f.id] || 0] || []).push(f); } });
    var colsUsed = {}; files.forEach(function(f){ if(f.map && !force){ var c = Math.round(f.map.x / (FM_W + 110)); colsUsed[c] = Math.max(colsUsed[c] || 0, f.map.y + FM_H + 36); } });
    Object.keys(cols).forEach(function(L){ var y = colsUsed[L] || 0; cols[L].forEach(function(f){ f.map = { x:L * (FM_W + 110), y:y }; y += FM_H + 36; }); });
  }
  function fmMeta(f){
    if(f.type === 'sheet'){ var rows = f.data.sheets.reduce(function(s, sh){ return s + sh.rows.length; }, 0), fx = 0; f.data.sheets.forEach(function(sh){ sh.rows.forEach(function(r){ r.forEach(function(v){ if(typeof v === 'string' && v.charAt(0) === '=') fx++; }); }); }); return plural(f.data.sheets.length, 'лист', 'листа', 'листов') + ' · строк ' + rows + ' · формул ' + fx; }
    if(f.type === 'doc'){ var txt = String(f.data.html || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length; return 'слов ' + txt + ' · вставок ' + ((f.data.html || '').match(/class="lnk"/g) || []).length; }
    if(f.type === 'slides') return plural((f.data.slides || []).length, 'слайд', 'слайда', 'слайдов');
    if(f.type === 'form') return plural((f.data.fields || []).length, 'вопрос', 'вопроса', 'вопросов') + (f.data.target && ofFile(f.data.target) ? ' → ' + ofFile(f.data.target).name : '');
    if(f.type === 'image') return (f.data.w || 0) + '×' + (f.data.h || 0) + ' · слоёв ' + ((f.data.layers || []).length);
    if(f.type === 'vector') return (f.data.w || 0) + '×' + (f.data.h || 0) + ' · объектов ' + ((f.data.items || []).length);
    return FT[f.type] ? FT[f.type].name : '';
  }
  function renderFileMap(m){
    var files = fmFiles(); if(files.some(function(f){ return !f.map; })) fmLayout(false);
    var edges = fmEdges();
    var B = function(label, html, fn, cls){ var b = h('button', { type:'button', 'class':'rb' + (cls ? ' ' + cls : ''), title:label, 'aria-label':label, html:html }); b.addEventListener('click', fn); return b; };
    m.appendChild(h('div', { 'class':'ribbon', role:'toolbar', 'aria-label':'Схема файлов' }, [
      B('Скомпилировать: пересчитать все файлы по порядку связей', '<span class="rt">▶ Скомпилировать</span>', fmCompile, 'pri'),
      B('Расставить блоки по порядку зависимостей', '<span class="rt">Расставить</span>', function(){ fmLayout(true); saveGraph(); ofRender(); }),
      B('Вписать в экран', '<span class="rt">Вписать</span>', function(){ fmFit(); }),
      h('span', { 'class':'rsep' }),
      B('Создать файл', '<span class="rt">+ Файл</span>', function(e){ var r = e.currentTarget.getBoundingClientRect(); openMenuAt(newItems(), r.left, r.bottom + 4); }),
      h('span', { 'class':'grow' }),
      h('span', { 'class':'fm-legend', text:'Связи: протяните линию от точки справа у блока к другому файлу · двойной клик — открыть файл' })
    ]));
    var wrap = h('div', { 'class':'fm-wrap', id:'fmWrap', tabindex:'0', 'aria-label':'Схема файлов' });
    var world = h('div', { 'class':'fm-world', id:'fmWorld' });
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'fm-edges'); svg.setAttribute('width', '6000'); svg.setAttribute('height', '4000');
    world.appendChild(svg); wrap.appendChild(world); m.appendChild(wrap);
    if(!files.length){ wrap.appendChild(h('div', { 'class':'fm-empty', text:'Файлов пока нет. Создайте таблицы и документы — здесь появится схема их связей.' })); }
    files.forEach(function(f){
      var st = FM.status[f.id], col = FT[f.type] ? FT[f.type].color : '#64748B';
      var n = h('div', { 'class':'fm-node' + (FM.sel === f.id ? ' sel' : '') + (st ? ' ' + st.s : ''), 'data-fid':f.id, style:'left:' + f.map.x + 'px;top:' + f.map.y + 'px;--fc:' + col, tabindex:'0', role:'button', 'aria-label':FT[f.type].name + ' «' + f.name + '»' }, [
        h('div', { 'class':'fm-top' }, [ h('span', { 'class':'ic', html:ofIcon(f.type, 15) }), h('span', { 'class':'fm-type', text:FT[f.type].name }), st ? h('span', { 'class':'fm-badge', text:st.s === 'ok' ? '✓' : (st.s === 'err' ? st.n + ' ош.' : '!') , title:st.info }) : null ].filter(Boolean)),
        h('div', { 'class':'fm-name', text:f.name }),
        h('div', { 'class':'fm-meta', text:fmMeta(f) }),
        h('span', { 'class':'fm-in', 'aria-hidden':'true' }),
        h('span', { 'class':'fm-out', title:'Потяните к другому файлу, чтобы связать', 'aria-hidden':'true' })
      ]);
      world.appendChild(n);
    });
    fmDrawEdges(edges);
    if(FM.report) m.appendChild(fmReportEl());
    fmApplyCam(); fmBind(wrap);
  }
  function fmEdgePath(a, b){ var x1 = a.map.x + FM_W, y1 = a.map.y + FM_H / 2, x2 = b.map.x, y2 = b.map.y + FM_H / 2, dx = Math.max(40, Math.abs(x2 - x1) / 2); return { d:'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2, mx:(x1 + x2) / 2, my:(y1 + y2) / 2 }; }
  function fmDrawEdges(edges){
    var svg = document.querySelector('#fmWorld .fm-edges'); if(!svg) return; svg.innerHTML = '';
    var NS = 'http://www.w3.org/2000/svg', cyc = FM.cyclic || [];
    edges.forEach(function(e){
      var a = ofFile(e.from), b = ofFile(e.to); if(!a || !b || !a.map || !b.map) return;
      var p = fmEdgePath(a, b), path = document.createElementNS(NS, 'path'), bad = cyc.indexOf(e.from) >= 0 && cyc.indexOf(e.to) >= 0;
      path.setAttribute('d', p.d); path.setAttribute('class', 'fm-edge' + (bad ? ' bad' : '')); path.setAttribute('stroke', bad ? '#DC2626' : FT[a.type].color);
      var t = document.createElementNS(NS, 'title'); t.textContent = a.name + ' → ' + b.name + ': ' + Object.keys(e.kinds).map(function(k){ return k + ' ' + e.kinds[k]; }).join(', '); path.appendChild(t);
      svg.appendChild(path);
      var lb = document.createElementNS(NS, 'text'); lb.setAttribute('x', p.mx); lb.setAttribute('y', p.my - 6); lb.setAttribute('class', 'fm-elabel'); lb.textContent = Object.keys(e.kinds).map(function(k){ return k + ' ' + e.kinds[k]; }).join(' · '); svg.appendChild(lb);
    });
  }
  function fmApplyCam(){ var w = $('fmWorld'); if(w) w.style.transform = 'translate(' + FM.cam.x + 'px,' + FM.cam.y + 'px) scale(' + FM.cam.k + ')'; }
  function fmFit(){
    var files = fmFiles(), wrap = $('fmWrap'); if(!files.length || !wrap) return;
    var x0 = Math.min.apply(0, files.map(function(f){ return f.map.x; })), y0 = Math.min.apply(0, files.map(function(f){ return f.map.y; }));
    var x1 = Math.max.apply(0, files.map(function(f){ return f.map.x + FM_W; })), y1 = Math.max.apply(0, files.map(function(f){ return f.map.y + FM_H; }));
    var r = wrap.getBoundingClientRect(), k = Math.min(1.2, Math.max(0.3, Math.min((r.width - 80) / (x1 - x0 || 1), (r.height - 80) / (y1 - y0 || 1))));
    FM.cam = { k:k, x:(r.width - (x1 - x0) * k) / 2 - x0 * k, y:(r.height - (y1 - y0) * k) / 2 - y0 * k }; fmApplyCam();
  }
  function fmToWorld(e){ var r = $('fmWrap').getBoundingClientRect(), z = UI.scale / 100; return { x:((e.clientX - r.left) / z - FM.cam.x) / FM.cam.k, y:((e.clientY - r.top) / z - FM.cam.y) / FM.cam.k }; }
  function fmBind(wrap){
    wrap.addEventListener('wheel', function(e){ e.preventDefault(); var p = fmToWorld(e), k = Math.min(2, Math.max(0.25, FM.cam.k * (e.deltaY < 0 ? 1.1 : 0.9))); FM.cam.x -= p.x * (k - FM.cam.k); FM.cam.y -= p.y * (k - FM.cam.k); FM.cam.k = k; fmApplyCam(); }, { passive:false });
    wrap.addEventListener('pointerdown', function(e){
      if(e.button !== 0) return;
      var node = e.target.closest('.fm-node'), port = e.target.closest('.fm-out'), z = UI.scale / 100;
      if(port && node){ e.preventDefault(); fmStartLink(node.getAttribute('data-fid'), e); return; }
      if(node){
        var f = ofFile(node.getAttribute('data-fid')), sx = e.clientX, sy = e.clientY, ox = f.map.x, oy = f.map.y, moved = false;
        FM.sel = f.id; Array.prototype.forEach.call(document.querySelectorAll('.fm-node'), function(x){ x.classList.toggle('sel', x === node); });
        var mv = function(ev){ var dx = (ev.clientX - sx) / z / FM.cam.k, dy = (ev.clientY - sy) / z / FM.cam.k; if(Math.abs(dx) + Math.abs(dy) > 3) moved = true; f.map.x = Math.round(ox + dx); f.map.y = Math.round(oy + dy); node.style.left = f.map.x + 'px'; node.style.top = f.map.y + 'px'; fmDrawEdges(fmEdges()); };
        var up = function(){ document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); if(moved) saveGraph(); };
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); return;
      }
      var px = e.clientX, py = e.clientY, cx = FM.cam.x, cy = FM.cam.y; wrap.classList.add('panning');
      var mv2 = function(ev){ FM.cam.x = cx + (ev.clientX - px) / z; FM.cam.y = cy + (ev.clientY - py) / z; fmApplyCam(); };
      var up2 = function(){ wrap.classList.remove('panning'); document.removeEventListener('pointermove', mv2); document.removeEventListener('pointerup', up2); };
      document.addEventListener('pointermove', mv2); document.addEventListener('pointerup', up2);
    });
    wrap.addEventListener('dblclick', function(e){ var node = e.target.closest('.fm-node'); if(node) ofOpen(node.getAttribute('data-fid')); });
    wrap.addEventListener('keydown', function(e){ var node = e.target.closest && e.target.closest('.fm-node'); if(node && e.key === 'Enter') ofOpen(node.getAttribute('data-fid')); });
    wrap.addEventListener('contextmenu', function(e){ var node = e.target.closest('.fm-node'); if(!node) return; e.preventDefault(); var f = ofFile(node.getAttribute('data-fid')); fileMenu(f, e.clientX, e.clientY); });
  }
  // протягивание связи от одного файла к другому
  function fmStartLink(fromId, e){
    var from = ofFile(fromId), svg = document.querySelector('#fmWorld .fm-edges'), NS = 'http://www.w3.org/2000/svg';
    var tmp = document.createElementNS(NS, 'path'); tmp.setAttribute('class', 'fm-edge tmp'); tmp.setAttribute('stroke', FT[from.type].color); svg.appendChild(tmp);
    var mv = function(ev){ var p = fmToWorld(ev), x1 = from.map.x + FM_W, y1 = from.map.y + FM_H / 2, dx = Math.max(40, Math.abs(p.x - x1) / 2); tmp.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (p.x - dx) + ',' + p.y + ' ' + p.x + ',' + p.y); };
    var up = function(ev){
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); tmp.remove();
      var el2 = document.elementFromPoint(ev.clientX, ev.clientY), node = el2 && el2.closest && el2.closest('.fm-node');
      if(!node || node.getAttribute('data-fid') === fromId) return;
      fmLinkMenu(from, ofFile(node.getAttribute('data-fid')), ev.clientX, ev.clientY);
    };
    mv(e); document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  }
  function fmLinkMenu(a, b, x, y){
    var items = [{ head:'«' + a.name + '» → «' + b.name + '»' }];
    if(a.type === 'sheet' && b.type === 'sheet') a.data.sheets.forEach(function(sh, i){ items.push({ label:'Живая копия листа «' + sh.name + '» в книгу «' + b.name + '»', icon:'grid', act:function(){ fmLinkSheets(a, i, b); } }); });
    if(a.type === 'sheet' && b.type === 'sheet') items.push({ label:'Итоги столбцов «' + a.name + '» в новый лист', icon:'plus', act:function(){ fmLinkTotals(a, b); } });
    if(a.type === 'sheet' && b.type === 'doc'){ items.push({ label:'Вставить таблицу (живую) в конец документа', icon:'grid', act:function(){ fmLinkDoc(a, b, 'table'); } }); items.push({ label:'Вставить диаграмму в конец документа', icon:'grid', act:function(){ fmLinkDoc(a, b, 'chart'); } }); }
    if(a.type === 'sheet' && b.type === 'slides') items.push({ label:'Новый слайд с диаграммой из таблицы', icon:'grid', act:function(){ fmLinkSlides(a, b); } });
    if(a.type === 'form' && b.type === 'sheet') items.push({ label:'Записывать ответы формы в эту таблицу', icon:'grid', act:function(){ a.data.target = b.id; fmDone(a, b); } });
    if(a.type === 'image' && b.type === 'vector') items.push({ label:'Поместить изображение на холст', icon:'grid', act:function(){ (b.data.items = b.data.items || []).push({ id:'v' + Date.now().toString(36), t:'image', src:a.id, x:40, y:40, w:Math.min(400, a.data.w || 400), h:Math.min(400, a.data.w || 400) * (a.data.h || 1) / (a.data.w || 1), r:0, op:1 }); fmDone(a, b); } });
    if(a.type === 'vector' && b.type === 'image') items.push({ label:'Добавить рисунок слоем', icon:'grid', act:function(){ vecToImageLayer(a, b, function(){ fmDone(a, b); }); } });
    if(items.length === 1){ toast('Связать «' + FT[a.type].name.toLowerCase() + '» с «' + FT[b.type].name.toLowerCase() + '» напрямую нельзя: потяните от таблицы к таблице, документу или презентации, от формы к таблице, от картинки к векторному рисунку'); return; }
    openMenuAt(items, x, y);
  }
  function fmDone(a, b){ b.t = Date.now(); calcReset(); saveGraph(); ofRender(); toast('Связано: «' + a.name + '» → «' + b.name + '»'); }
  function fmQuote(f, sh){ return "'" + f.name + (f.data.sheets.length > 1 || sh.name !== 'Лист1' ? '/' + sh.name : '') + "'"; }
  function fmLinkSheets(a, i, b){
    var sh = a.data.sheets[i], g = usedRange(sh), q = fmQuote(a, sh), rows = [];
    for(var r = g.r0; r <= g.r1; r++){ var row = []; for(var c = g.c0; c <= g.c1; c++) row.push((sh.rows[r] && String(sh.rows[r][c]).trim() !== '') ? '=' + q + '!' + colName(c) + (r + 1) : ''); rows.push(row); }
    var name = (a.name + ' ' + sh.name).slice(0, 28).replace(/[!'\/]/g, ''), nm = name, k = 2; while(b.data.sheets.some(function(s){ return s.name === nm; })) nm = name + ' ' + (k++);
    b.data.sheets.push({ name:nm, rows:rows, fmt:JSON.parse(JSON.stringify(sh.fmt || {})), widths:JSON.parse(JSON.stringify(sh.widths || {})), charts:[] });
    fmDone(a, b);
  }
  function fmLinkTotals(a, b){
    var rows = [['Книга', 'Лист', 'Столбец', 'Сумма', 'Среднее', 'Записей']];
    a.data.sheets.forEach(function(sh){
      var g = usedRange(sh), q = fmQuote(a, sh); if(g.r1 < 1) return;
      for(var c = g.c0; c <= g.c1; c++){
        var head = String((sh.rows[0] || [])[c] || colName(c)), col = colName(c), rg = q + '!' + col + '2:' + col + (g.r1 + 1);
        var numeric = false; for(var r = 1; r <= g.r1; r++){ var v = sh.rows[r] && sh.rows[r][c]; if(typeof num(v) === 'number' || (typeof v === 'string' && v.charAt(0) === '=')){ numeric = true; break; } }
        if(numeric) rows.push([a.name, sh.name, head, '=СУММ(' + rg + ')', '=СРЗНАЧ(' + rg + ')', '=СЧЁТ(' + rg + ')']);
      }
    });
    var nm = 'Итоги ' + a.name.slice(0, 20).replace(/[!'\/]/g, ''), k = 2, base = nm; while(b.data.sheets.some(function(s){ return s.name === nm; })) nm = base + ' ' + (k++);
    b.data.sheets.push({ name:nm, rows:rows, fmt:{ '0:0':{ b:1 }, '0:1':{ b:1 }, '0:2':{ b:1 }, '0:3':{ b:1 }, '0:4':{ b:1 }, '0:5':{ b:1 } }, widths:{}, charts:[] });
    fmDone(a, b);
  }
  function fmLinkDoc(a, b, kind){
    var sh = a.data.sheets[0], rg = rangeStr(usedRange(sh)), spec = { src:a.id, sheet:0, range:rg, kind:kind, ctype:kind === 'chart' ? 'bar' : '', name:a.name };
    b.data.html = (b.data.html || '') + '<div class="lnk" contenteditable="false" data-src="' + a.id + '" data-sheet="0" data-range="' + rg + '" data-kind="' + kind + '" data-ctype="' + spec.ctype + '" data-name="' + escHtml(a.name) + '">' + embedHtml(spec) + '<span class="lnk-tag">' + escHtml(lnkLabel(spec)) + '</span></div><p><br></p>';
    fmDone(a, b);
  }
  function fmLinkSlides(a, b){
    var g = rangeStr(usedRange(a.data.sheets[0]));
    b.data.slides.push({ layout:'media', title:a.name, body:'', embed:{ src:a.id, sheet:0, range:g, kind:'chart', ctype:'bar', name:a.name } });
    fmDone(a, b);
  }
  // компиляция: пересчёт по порядку зависимостей, ошибки, битые ссылки, циклы
  function fmCompile(){
    var files = fmFiles(), edges = fmEdges(), plan = fmOrder(files, edges), probs = [], status = {};
    calcReset();
    plan.order.concat(plan.cyclic).forEach(function(id){
      var f = ofFile(id), errs = 0, cnt = 0;
      if(f.type === 'sheet') f.data.sheets.forEach(function(sh, si){
        var vals = sheetValues(f, si);
        vals.forEach(function(row, r){ row.forEach(function(v, c){
          var raw = sh.rows[r] && sh.rows[r][c]; if(typeof raw === 'string' && raw.charAt(0) === '=') cnt++;
          if(typeof v === 'string' && v.charAt(0) === '#' && typeof raw === 'string' && raw.charAt(0) === '='){ errs++; if(probs.length < 200) probs.push({ f:f, sheet:si, r:r, c:c, what:v, formula:raw }); }
        }); });
      });
      if(f.type === 'doc'){ var re = /data-src="([^"]+)"/g, m; while((m = re.exec(f.data.html || ''))){ cnt++; if(!ofFile(m[1])){ errs++; probs.push({ f:f, what:'Вставка ссылается на удалённую таблицу' }); } } }
      if(f.type === 'slides') (f.data.slides || []).forEach(function(s, i){ if(s.embed && s.embed.src){ cnt++; if(!ofFile(s.embed.src)){ errs++; probs.push({ f:f, what:'Слайд ' + (i + 1) + ': источник диаграммы удалён' }); } } });
      if(f.type === 'form' && f.data.target && !ofFile(f.data.target)){ errs++; probs.push({ f:f, what:'Таблица для ответов удалена' }); }
      var cyc = plan.cyclic.indexOf(id) >= 0;
      status[id] = { s:errs ? 'err' : (cyc ? 'warn' : 'ok'), n:errs, info:(cnt ? 'Проверено связей и формул: ' + cnt : 'Связей нет') + (errs ? ', ошибок: ' + errs : '') + (cyc ? ', участвует в цикле' : '') };
    });
    if(plan.cyclic.length) probs.unshift({ cycle:true, what:'Цикл между файлами: ' + plan.cyclic.map(function(id){ return '«' + ofFile(id).name + '»'; }).join(' ⇄ ') + ' — файлы ссылаются друг на друга по кругу' });
    FM.status = status; FM.cyclic = plan.cyclic; FM.order = plan.order;
    FM.report = { probs:probs, order:plan.order.map(function(id){ return ofFile(id).name; }), at:new Date(), files:files.length, edges:edges.length };
    // анимация: блоки загораются по порядку пересчёта
    ofRender();
    var seq = plan.order.concat(plan.cyclic);
    seq.forEach(function(id, i){ setTimeout(function(){ var n = document.querySelector('.fm-node[data-fid="' + id + '"]'); if(n){ n.classList.add('pulse'); setTimeout(function(){ n.classList.remove('pulse'); }, 500); } }, 80 * i); });
    toast(probs.length ? 'Скомпилировано с замечаниями: ' + probs.length : 'Скомпилировано без ошибок: файлов ' + files.length + ', связей ' + edges.length);
  }
  function fmReportEl(){
    var R = FM.report, box = h('div', { 'class':'fm-report', role:'region', 'aria-label':'Результат компиляции' });
    box.appendChild(h('div', { 'class':'fm-rh' }, [ h('b', { text:R.probs.length ? 'Замечаний: ' + R.probs.length : 'Ошибок нет' }), h('span', { text:'файлов ' + R.files + ' · связей ' + R.edges + ' · ' + R.at.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }) }),
      h('button', { type:'button', 'class':'x', 'aria-label':'Скрыть', html:SVGI('<path d="M6 6l12 12M18 6L6 18"/>', 12), on:{ click:function(){ FM.report = null; ofRender(); } } }) ]));
    box.appendChild(h('div', { 'class':'fm-order', text:'Порядок пересчёта: ' + (R.order.join(' → ') || '—') }));
    R.probs.slice(0, 60).forEach(function(p){
      var label = p.cycle ? p.what : '«' + p.f.name + '»' + (p.r !== undefined ? ' · ' + p.f.data.sheets[p.sheet].name + '!' + colName(p.c) + (p.r + 1) + ': ' + p.what + ' в ' + p.formula : ': ' + p.what);
      var it = h('button', { type:'button', 'class':'fm-prob' + (p.cycle ? ' cyc' : ''), text:label });
      if(!p.cycle) it.addEventListener('click', function(){ ofOpen(p.f.id); if(p.r !== undefined && p.f.type === 'sheet'){ setTimeout(function(){ if(SG.f === p.f){ SG.idx = p.sheet; renderSheetTabs(); renderGrid(); shSelect(p.r, p.c); } }, 30); } });
      box.appendChild(it);
    });
    return box;
  }
