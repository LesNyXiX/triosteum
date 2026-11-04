  /* =====================================================================
     СХЕМА ФАЙЛОВ: все файлы офиса — блоки, зависимости между ними — связи.
     Связи находятся сами (формулы между таблицами, живые вставки в
     документы и слайды, формы → таблицы) и создаются протягиванием линии.
     «Скомпилировать» — пересчёт всех файлов по порядку зависимостей
     с отчётом об ошибках, битых ссылках и циклах.
     ===================================================================== */
  var FM = { cam:{ x:40, y:40, k:1 }, sel:null, multi:[], selE:null, status:{}, report:null, order:[], drag:null };
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
      // вставки из других файлов (картинки, данные, тексты) помнят источник
      var fr = function(id){ if(id && ofFile(id)) add(ofFile(id), f, 'вставки'); };
      if(f.type === 'sheet') f.data.sheets.forEach(function(sh){ fr(sh.from); (sh.images || []).forEach(function(o){ fr(o.from); }); });
      if(f.type === 'doc'){ var re3 = /data-from="([^"]+)"/g, m3; while((m3 = re3.exec(f.data.html || ''))) fr(m3[1]); }
      if(f.type === 'slides') (f.data.slides || []).forEach(function(s){ fr(s.from); });
      if(f.type === 'image') (f.data.layers || []).forEach(function(L){ fr(L.from); });
      if(f.type === 'vector') (f.data.items || []).forEach(function(o){ fr(o.from); });
      if(f.type === 'form'){ fr(f.data.from); (f.data.fields || []).forEach(function(q){ fr(q.from); }); }
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
  function fmNotes(){ var s = ofs(); if(!s.mapNotes) s.mapNotes = []; return s.mapNotes; }
  function fmSelIds(){ return FM.multi && FM.multi.length ? FM.multi.slice() : (FM.sel ? [FM.sel] : []); }
  function renderFileMap(m){
    var files = fmFiles(); if(files.some(function(f){ return !f.map; })) fmLayout(false);
    var edges = fmEdges();
    var B = function(label, html, fn, cls){ var b = h('button', { type:'button', 'class':'rb' + (cls ? ' ' + cls : ''), title:label, 'aria-label':label, html:html }); b.addEventListener('click', fn); return b; };
    m.appendChild(h('div', { 'class':'ribbon', role:'toolbar', 'aria-label':'Схема файлов' }, [
      B('Скомпилировать: пересчитать все файлы по порядку связей (' + MOD + 'R)', '<span class="rt">▶ Скомпилировать</span>', fmCompile, 'pri'),
      B('Расставить блоки по порядку зависимостей', '<span class="rt">Расставить</span>', function(){ ofSnapPush(); fmLayout(true); saveGraph(); ofRender(); }),
      B('Вписать в экран', '<span class="rt">Вписать</span>', function(){ fmFit(); }),
      h('span', { 'class':'rsep' }),
      B('Создать файл', '<span class="rt">+ Файл</span>', function(e){ var r = e.currentTarget.getBoundingClientRect(); openMenuAt(newItems(), r.left, r.bottom + 4); }),
      B('Текстовая заметка на схеме', '<span class="rt">+ Заметка</span>', function(){ fmAddNote('', null); }),
      B('Картинка на схеме', '<span class="rt">+ Картинка</span>', function(){ fmPickImage(null); }),
      h('span', { 'class':'grow' }),
      h('span', { 'class':'fm-legend', text:'Протяните линию от точки справа к любому файлу · 2× — открыть · потрясти блок — отцепить связи · ПКМ — меню' })
    ]));
    var wrap = h('div', { 'class':'fm-wrap', id:'fmWrap', tabindex:'0', 'aria-label':'Схема файлов' });
    var world = h('div', { 'class':'fm-world', id:'fmWorld' });
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'fm-edges'); svg.setAttribute('width', '6000'); svg.setAttribute('height', '4000');
    world.appendChild(svg); wrap.appendChild(world); m.appendChild(wrap);
    if(!files.length && !fmNotes().length){ wrap.appendChild(h('div', { 'class':'fm-empty', text:'Файлов пока нет. Правый клик — создать файл, заметку или вставить из буфера. Здесь появится схема связей.' })); }
    var X = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    var sel = fmSelIds();
    files.forEach(function(f){
      var st = FM.status[f.id], col = FT[f.type] ? FT[f.type].color : '#64748B', cms = fmNotes().filter(function(t){ return t.attach === f.id; });
      var n = h('div', { 'class':'fm-node' + (sel.indexOf(f.id) >= 0 ? ' sel' : '') + (st ? ' ' + st.s : ''), 'data-fid':f.id, style:'left:' + f.map.x + 'px;top:' + f.map.y + 'px;--fc:' + col, tabindex:'0', role:'button', 'aria-label':FT[f.type].name + ' «' + f.name + '»' }, [
        h('div', { 'class':'fm-top' }, [ h('span', { 'class':'ic', html:ofIcon(f.type, 15) }), h('span', { 'class':'fm-type', text:FT[f.type].name }), st ? h('span', { 'class':'fm-badge', text:st.s === 'ok' ? '✓' : (st.s === 'err' ? st.n + ' ош.' : '!') , title:st.info }) : null ].filter(Boolean)),
        h('div', { 'class':'fm-name', text:f.name }),
        h('div', { 'class':'fm-meta', text:fmMeta(f) }),
        h('span', { 'class':'fm-in', 'aria-hidden':'true' }),
        h('span', { 'class':'fm-out', title:'Потяните к любому файлу, чтобы вставить или связать', 'aria-hidden':'true' }),
        h('button', { type:'button', 'class':'fm-x', 'aria-label':'Удалить файл «' + f.name + '»', title:'Удалить файл', html:X }),
        h('button', { type:'button', 'class':'fm-c' + (cms.length ? ' has' : ''), 'aria-label':cms.length ? 'Комментарии (' + cms.length + ')' : 'Добавить комментарий', title:cms.length ? 'Показать / скрыть комментарии' : 'Комментарий к файлу', html:'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>' + (cms.length ? '<i>' + cms.length + '</i>' : '') })
      ]);
      world.appendChild(n);
    });
    fmNotes().forEach(function(t){
      var p = fmNotePos(t); if(!p || t.hidden) return;
      var d = h('div', { 'class':'fm-note' + (t.attach ? ' cm' : '') + (sel.indexOf(t.id) >= 0 ? ' sel' : ''), 'data-nid':t.id, style:'left:' + p.x + 'px;top:' + p.y + 'px', tabindex:'0', 'data-ph':t.attach ? 'Комментарий…' : 'Текст заметки…' }, [
        t.img ? h('img', { src:t.img, alt:'', draggable:'false', style:t.iw ? 'width:' + t.iw + 'px' : '' }) : null,
        h('div', { 'class':'fm-nt', text:t.text || '' }),
        h('button', { type:'button', 'class':'fm-x', 'aria-label':'Удалить заметку', html:X })
      ].filter(Boolean));
      world.appendChild(d);
    });
    fmDrawEdges(edges);
    if(FM.report) m.appendChild(fmReportEl());
    fmApplyCam(); fmBind(wrap);
    setTimeout(function(){ if(document.activeElement === document.body) wrap.focus({ preventScroll:true }); }, 0);
  }
  function fmNotePos(t){ if(!t.attach) return { x:t.x, y:t.y }; var f = ofFile(t.attach); if(!f || !f.map) return null; var i = fmNotes().filter(function(x){ return x.attach === t.attach; }).indexOf(t); return { x:f.map.x + (t.dx !== undefined ? t.dx : FM_W + 26), y:f.map.y + (t.dy !== undefined ? t.dy : -10 + i * 54) }; }
  function fmEdgePath(a, b){ var x1 = a.map.x + FM_W, y1 = a.map.y + FM_H / 2, x2 = b.map.x, y2 = b.map.y + FM_H / 2, dx = Math.max(40, Math.abs(x2 - x1) / 2); return { d:'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2, mx:(x1 + x2) / 2, my:(y1 + y2) / 2 }; }
  function fmDrawEdges(edges){
    var svg = document.querySelector('#fmWorld .fm-edges'); if(!svg) return; svg.innerHTML = '';
    var NS = 'http://www.w3.org/2000/svg', cyc = FM.cyclic || [];
    edges.forEach(function(e){
      var a = ofFile(e.from), b = ofFile(e.to); if(!a || !b || !a.map || !b.map) return;
      var key = e.from + '>' + e.to, on = FM.selE === key;
      var p = fmEdgePath(a, b), path = document.createElementNS(NS, 'path'), bad = cyc.indexOf(e.from) >= 0 && cyc.indexOf(e.to) >= 0;
      var g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'fm-eg' + (on ? ' on' : '')); g.setAttribute('data-ek', key);
      var hit = document.createElementNS(NS, 'path'); hit.setAttribute('d', p.d); hit.setAttribute('class', 'fm-ehit'); g.appendChild(hit);
      path.setAttribute('d', p.d); path.setAttribute('class', 'fm-edge' + (bad ? ' bad' : '')); path.setAttribute('stroke', bad ? '#DC2626' : FT[a.type].color);
      var t = document.createElementNS(NS, 'title'); t.textContent = a.name + ' → ' + b.name + ': ' + Object.keys(e.kinds).map(function(k){ return k + ' ' + e.kinds[k]; }).join(', ') + '. Клик — выбрать, × — открепить, ПКМ — меню'; hit.appendChild(t);
      g.appendChild(path);
      var lb = document.createElementNS(NS, 'text'); lb.setAttribute('x', p.mx); lb.setAttribute('y', p.my - 12); lb.setAttribute('class', 'fm-elabel'); lb.textContent = Object.keys(e.kinds).map(function(k){ return k + ' ' + e.kinds[k]; }).join(' · '); g.appendChild(lb);
      var x = document.createElementNS(NS, 'g'); x.setAttribute('class', 'fm-ex'); x.setAttribute('transform', 'translate(' + p.mx + ',' + p.my + ')');
      var c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '9'); x.appendChild(c);
      var xp = document.createElementNS(NS, 'path'); xp.setAttribute('d', 'M-3.5,-3.5L3.5,3.5M3.5,-3.5L-3.5,3.5'); x.appendChild(xp);
      var xt = document.createElementNS(NS, 'title'); xt.textContent = 'Открепить связь: содержимое останется, зависимость исчезнет'; x.appendChild(xt);
      g.appendChild(x);
      svg.appendChild(g);
    });
  }
  function fmEdgeByKey(k){ return fmEdges().filter(function(e){ return e.from + '>' + e.to === k; })[0]; }
  function fmApplyCam(){ var w = $('fmWorld'); if(w) w.style.transform = 'translate(' + FM.cam.x + 'px,' + FM.cam.y + 'px) scale(' + FM.cam.k + ')'; }
  function fmFit(){
    var files = fmFiles(), wrap = $('fmWrap'); if(!files.length || !wrap) return;
    var x0 = Math.min.apply(0, files.map(function(f){ return f.map.x; })), y0 = Math.min.apply(0, files.map(function(f){ return f.map.y; }));
    var x1 = Math.max.apply(0, files.map(function(f){ return f.map.x + FM_W; })), y1 = Math.max.apply(0, files.map(function(f){ return f.map.y + FM_H; }));
    var r = wrap.getBoundingClientRect(), k = Math.min(1.2, Math.max(0.3, Math.min((r.width - 80) / (x1 - x0 || 1), (r.height - 80) / (y1 - y0 || 1))));
    FM.cam = { k:k, x:(r.width - (x1 - x0) * k) / 2 - x0 * k, y:(r.height - (y1 - y0) * k) / 2 - y0 * k }; fmApplyCam();
  }
  function fmToWorld(e){ var r = $('fmWrap').getBoundingClientRect(), z = UI.scale / 100; return { x:((e.clientX - r.left) / z - FM.cam.x) / FM.cam.k, y:((e.clientY - r.top) / z - FM.cam.y) / FM.cam.k }; }
  function fmMarkSel(){
    var s = fmSelIds();
    Array.prototype.forEach.call(document.querySelectorAll('.fm-node'), function(x){ x.classList.toggle('sel', s.indexOf(x.getAttribute('data-fid')) >= 0); });
    Array.prototype.forEach.call(document.querySelectorAll('.fm-note'), function(x){ x.classList.toggle('sel', s.indexOf(x.getAttribute('data-nid')) >= 0); });
    Array.prototype.forEach.call(document.querySelectorAll('.fm-eg'), function(x){ x.classList.toggle('on', x.getAttribute('data-ek') === FM.selE); });
  }
  function fmNoteById(id){ return fmNotes().filter(function(t){ return t.id === id; })[0]; }
  function fmBind(wrap){
    var lastTap = { id:null, t:0 };
    wrap.addEventListener('wheel', function(e){ e.preventDefault(); var p = fmToWorld(e), k = Math.min(2, Math.max(0.25, FM.cam.k * (e.deltaY < 0 ? 1.1 : 0.9))); FM.cam.x -= p.x * (k - FM.cam.k); FM.cam.y -= p.y * (k - FM.cam.k); FM.cam.k = k; fmApplyCam(); }, { passive:false });
    wrap.addEventListener('pointerdown', function(e){
      if(e.button !== 0) return;
      if(e.target.closest('.fm-report')) return;
      var node = e.target.closest('.fm-node'), port = e.target.closest('.fm-out'), note = e.target.closest('.fm-note'), z = UI.scale / 100;
      if(note && note.classList.contains('editing')) return;
      var eg = e.target.closest('.fm-eg');
      if(eg){
        e.preventDefault(); var ek = eg.getAttribute('data-ek');
        if(e.target.closest('.fm-ex')){ fmUnlink(fmEdgeByKey(ek)); return; }
        FM.selE = ek; FM.sel = null; FM.multi = []; fmMarkSel(); return;
      }
      if(e.target.closest('.fm-x')){
        e.preventDefault();
        if(node) fmDeleteFiles([node.getAttribute('data-fid')]); else if(note) fmDeleteNotes([note.getAttribute('data-nid')]);
        return;
      }
      if(e.target.closest('.fm-c') && node){ e.preventDefault(); fmToggleComments(node.getAttribute('data-fid')); return; }
      if(port && node){ e.preventDefault(); fmStartLink(node.getAttribute('data-fid'), e); return; }
      if(node || note){
        var id = node ? node.getAttribute('data-fid') : note.getAttribute('data-nid');
        FM.selE = null;
        if(e.shiftKey){ var cur = fmSelIds(), i = cur.indexOf(id); if(i >= 0) cur.splice(i, 1); else cur.push(id); FM.multi = cur; FM.sel = cur[cur.length - 1] || null; fmMarkSel(); return; }
        var now = Date.now(), dbl = lastTap.id === id && now - lastTap.t < 380; lastTap = { id:id, t:now };
        if(dbl){ e.preventDefault(); lastTap = { id:null, t:0 }; if(node) ofOpen(id); else fmEditNote(id); return; }
        if(fmSelIds().indexOf(id) < 0){ FM.sel = id; FM.multi = []; }
        fmMarkSel();
        var ids = fmSelIds(), grp = ids.map(function(x){ var f = ofFile(x); if(f && f.map) return { o:f.map, el:document.querySelector('.fm-node[data-fid="' + x + '"]'), x:f.map.x, y:f.map.y, file:f }; var t = fmNoteById(x); if(t && !t.attach) return { o:t, el:document.querySelector('.fm-note[data-nid="' + x + '"]'), x:t.x, y:t.y }; return null; }).filter(Boolean);
        var sx = e.clientX, sy = e.clientY, moved = false, snapped = false, dg = { sh:null, shook:false };
        var mv = function(ev){
          var dx = (ev.clientX - sx) / z / FM.cam.k, dy = (ev.clientY - sy) / z / FM.cam.k;
          if(Math.abs(dx) + Math.abs(dy) > 3) moved = true;
          if(moved && !snapped){ snapped = true; ofSnapPush(); }
          grp.forEach(function(g){ g.o.x = Math.round(g.x + dx); g.o.y = Math.round(g.y + dy); if(g.el){ g.el.style.left = g.o.x + 'px'; g.el.style.top = g.o.y + 'px'; } });
          fmSyncNotes(); fmDrawEdges(fmEdges());
          if(node && !dg.shook && fmShakeTrack(dg, ev)){ fmShakeFile(ofFile(id), node); }
          if(moved) jellyMove(dg, ev, node || note);
        };
        var up = function(){ document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); if(moved){ jellyEnd(dg, node || note); saveGraph(); } };
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); return;
      }
      FM.selE = null;
      if(e.shiftKey){ fmRubber(e); return; }
      if(fmSelIds().length){ FM.sel = null; FM.multi = []; fmMarkSel(); }
      var px = e.clientX, py = e.clientY, cx = FM.cam.x, cy = FM.cam.y; wrap.classList.add('panning');
      var mv2 = function(ev){ FM.cam.x = cx + (ev.clientX - px) / z; FM.cam.y = cy + (ev.clientY - py) / z; fmApplyCam(); };
      var up2 = function(){ wrap.classList.remove('panning'); document.removeEventListener('pointermove', mv2); document.removeEventListener('pointerup', up2); };
      document.addEventListener('pointermove', mv2); document.addEventListener('pointerup', up2);
    });
    wrap.addEventListener('keydown', fmKey);
    wrap.addEventListener('contextmenu', function(e){
      e.preventDefault();
      var node = e.target.closest('.fm-node'), note = e.target.closest('.fm-note'), eg = e.target.closest('.fm-eg');
      if(node){ var f = ofFile(node.getAttribute('data-fid')); FM.sel = f.id; FM.multi = []; fmMarkSel(); fmFileMenu(f, e.clientX, e.clientY); return; }
      if(note){ var t = fmNoteById(note.getAttribute('data-nid')); fmNoteMenu(t, e.clientX, e.clientY); return; }
      if(eg){ FM.selE = eg.getAttribute('data-ek'); fmMarkSel(); fmEdgeMenu(fmEdgeByKey(FM.selE), e.clientX, e.clientY); return; }
      fmEmptyMenu(e.clientX, e.clientY, fmToWorld(e));
    });
  }
  function fmSyncNotes(){ fmNotes().forEach(function(t){ if(!t.attach) return; var d = document.querySelector('.fm-note[data-nid="' + t.id + '"]'), p = fmNotePos(t); if(d && p){ d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; } }); }
  // рамка выделения (Shift + протянуть по пустому месту)
  function fmRubber(e){
    var wrap = $('fmWrap'), r = wrap.getBoundingClientRect(), z = UI.scale / 100, box = h('div', { 'class':'fm-rubber' }); wrap.appendChild(box);
    var p0 = fmToWorld(e), sx = e.clientX, sy = e.clientY;
    var mv = function(ev){ var x = Math.min(sx, ev.clientX), y = Math.min(sy, ev.clientY); box.style.left = (x - r.left) / z + 'px'; box.style.top = (y - r.top) / z + 'px'; box.style.width = Math.abs(ev.clientX - sx) / z + 'px'; box.style.height = Math.abs(ev.clientY - sy) / z + 'px'; };
    var up = function(ev){
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); box.remove();
      var p1 = fmToWorld(ev), x0 = Math.min(p0.x, p1.x), x1 = Math.max(p0.x, p1.x), y0 = Math.min(p0.y, p1.y), y1 = Math.max(p0.y, p1.y);
      var ids = fmFiles().filter(function(f){ return f.map && f.map.x < x1 && f.map.x + FM_W > x0 && f.map.y < y1 && f.map.y + FM_H > y0; }).map(function(f){ return f.id; })
        .concat(fmNotes().filter(function(t){ return !t.attach && t.x < x1 && t.x + 160 > x0 && t.y < y1 && t.y + 40 > y0; }).map(function(t){ return t.id; }));
      FM.multi = fmSelIds().concat(ids.filter(function(x){ return fmSelIds().indexOf(x) < 0; })); FM.sel = FM.multi[FM.multi.length - 1] || null; fmMarkSel();
      if(ids.length) toast('Выделено: ' + FM.multi.length);
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  }
  function fmKey(e){
    var t = e.target; if(t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
    var mod = e.ctrlKey || e.metaKey, c = e.code, ids = fmSelIds(), files = ids.filter(function(x){ return ofFile(x); }), notes = ids.filter(function(x){ return fmNoteById(x); });
    if(mod && c === 'KeyA'){ e.preventDefault(); FM.multi = fmFiles().map(function(f){ return f.id; }).concat(fmNotes().filter(function(n){ return !n.attach; }).map(function(n){ return n.id; })); FM.sel = FM.multi[0] || null; fmMarkSel(); toast('Выделено: ' + FM.multi.length); return; }
    if(mod && c === 'KeyD'){ e.preventDefault(); if(!files.length){ toast('Выделите файл'); return; } ofSnapPush(); files.forEach(function(id){ ofDuplicate(id); }); return; }
    if(mod && !e.shiftKey && c === 'KeyZ'){ e.preventDefault(); ofUndo(); return; }
    if(mod && (c === 'KeyY' || (e.shiftKey && c === 'KeyZ'))){ e.preventDefault(); ofRedo(); return; }
    if(mod) return;
    if(e.key === 'Delete' || e.key === 'Backspace'){
      e.preventDefault();
      if(FM.selE){ fmUnlink(fmEdgeByKey(FM.selE)); return; }
      if(files.length) fmDeleteFiles(files); if(notes.length) fmDeleteNotes(notes);
      return;
    }
    if(e.key === 'Enter' && files.length){ e.preventDefault(); ofOpen(files[0]); return; }
    if(e.key === 'F2' && files.length){ e.preventDefault(); ofRename(files[0]); return; }
    if(e.key === 'Escape'){ FM.sel = null; FM.multi = []; FM.selE = null; fmMarkSel(); return; }
    if(/^Arrow/.test(e.key) && ids.length){
      e.preventDefault(); var s = e.shiftKey ? 20 : 4, dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0;
      ids.forEach(function(id){ var f = ofFile(id), o = f ? f.map : fmNoteById(id); if(o && !(o.attach)){ o.x += dx; o.y += dy; } });
      saveGraph(); ofRender();
    }
  }
  /* ---------- удаление, комментарии, заметки и картинки на схеме ---------- */
  function fmDeleteFiles(ids){ ofSnapPush(); var nm = ids.length === 1 && ofFile(ids[0]) ? '«' + ofFile(ids[0]).name + '»' : ids.length + ' файлов'; ofDelete(ids); ofs().mapNotes = fmNotes().filter(function(t){ return !t.attach || ofFile(t.attach); }); FM.sel = null; FM.multi = []; saveGraph(); toastAct('Удалено: ' + nm, 'Вернуть', ofUndo); }
  function fmDeleteNotes(ids){ ofSnapPush(); ofs().mapNotes = fmNotes().filter(function(t){ return ids.indexOf(t.id) < 0; }); FM.sel = null; FM.multi = []; saveGraph(); ofRender(); toastAct(ids.length === 1 ? 'Заметка удалена' : 'Удалено заметок: ' + ids.length, 'Вернуть', ofUndo); }
  function fmToggleComments(fid){
    var cms = fmNotes().filter(function(t){ return t.attach === fid; });
    if(!cms.length){ fmAddNote('', fid); return; }
    var hide = !cms[0].hidden; cms.forEach(function(t){ t.hidden = hide; }); saveGraph(); ofRender();
  }
  function fmAddNote(text, attach, img){
    ofSnapPush();
    var wrap = $('fmWrap'), c = { x:200, y:120 };
    if(wrap){ var r = wrap.getBoundingClientRect(), z = UI.scale / 100; c = { x:((r.width / 2) / z - FM.cam.x) / FM.cam.k - 80, y:((r.height / 2) / z - FM.cam.y) / FM.cam.k - 20 }; }
    if(FM.at){ c = FM.at; FM.at = null; }
    var t = { id:'mn' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), text:text || '', x:Math.round(c.x), y:Math.round(c.y), attach:attach || null, img:img || null };
    fmNotes().forEach(function(x){ if(attach && x.attach === attach) x.hidden = false; });
    fmNotes().push(t); FM.sel = t.id; FM.multi = []; saveGraph();
    if(OF.tab !== 'map') ofSetTab('map'); else ofRender();
    if(!text && !img) setTimeout(function(){ fmEditNote(t.id); }, 30);
    return t;
  }
  function fmEditNote(id){
    var t = fmNoteById(id), d = document.querySelector('.fm-note[data-nid="' + id + '"]'); if(!t || !d) return;
    var tx = d.querySelector('.fm-nt'); d.classList.add('editing'); tx.contentEditable = 'true'; tx.focus();
    var r = document.createRange(); r.selectNodeContents(tx); r.collapse(false); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    tx.addEventListener('keydown', function(e){ e.stopPropagation(); if(e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))){ e.preventDefault(); tx.blur(); } });
    tx.addEventListener('blur', function(){ t.text = tx.innerText.replace(/\n$/, ''); tx.contentEditable = 'false'; d.classList.remove('editing'); if(!t.text.trim() && !t.img && !t.attach){ ofs().mapNotes = fmNotes().filter(function(x){ return x !== t; }); } saveGraph(); ofRender(); }, { once:true });
  }
  function fmPickImage(attach){
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', function(){ var f = inp.files[0]; if(!f) return; readDataUrl(f, function(u){ fmAddNote('', attach, u); }); });
    inp.click();
  }
  function fmFileMenu(f, x, y){
    var cms = fmNotes().filter(function(t){ return t.attach === f.id; }).length, links = fmEdges().filter(function(e){ return e.from === f.id || e.to === f.id; }).length;
    var others = fmFiles().filter(function(z){ return z.id !== f.id; });
    var items = [
      { head:f.name },
      { label:'Открыть', icon:'file', kb:'2×', act:function(){ ofOpen(f.id); } },
      { label:'Переименовать', icon:'edit', kb:'F2', act:function(){ ofRename(f.id); } },
      { label:'Комментарий', icon:'text', act:function(){ fmAddNote('', f.id); } },
      { label:'Вставить в другой файл…', icon:'plus', disabled:!others.length, sub:others.slice(0, 30).map(function(b){ return { label:b.name, icon:'file', act:function(){ insertFileInto(f, b); } }; }) },
      { label:'Копировать', icon:'copy', kb:MOD + 'C', act:function(){ ofCopyFiles([f.id]); } },
      { label:'Дублировать', icon:'copy', kb:MOD + 'D', act:function(){ ofSnapPush(); ofDuplicate(f.id); } },
      { label:'Скачать', icon:'download', sub:exportItems(f) },
      { label:links ? 'Открепить все связи (' + links + ')' : 'Связей нет', icon:'link', disabled:!links, act:function(){ fmUnlinkAll(f); } },
      { label:'Где используется', icon:'map', act:function(){ showLinks(f); } },
      { sep:true },
      { label:'Удалить', icon:'trash', danger:true, kb:'Del', act:function(){ fmDeleteFiles([f.id]); } }
    ];
    if(cms) items.splice(4, 0, { label:'Скрыть / показать комментарии (' + cms + ')', icon:'text', act:function(){ fmToggleComments(f.id); } });
    openMenuAt(items, x, y);
  }
  function fmNoteMenu(t, x, y){
    openMenuAt([{ head:t.attach ? 'Комментарий' : (t.img ? 'Картинка' : 'Заметка') },
      { label:'Изменить текст', icon:'edit', act:function(){ fmEditNote(t.id); } },
      t.img ? { label:'Крупнее', icon:'zoom', act:function(){ t.iw = Math.min(900, (t.iw || 220) * 1.3); saveGraph(); ofRender(); } } : null,
      t.img ? { label:'Мельче', icon:'zoom', act:function(){ t.iw = Math.max(60, (t.iw || 220) / 1.3); saveGraph(); ofRender(); } } : null,
      t.img && fmFiles().length ? { label:'Вставить картинку в файл…', icon:'plus', sub:fmFiles().slice(0, 30).map(function(b){ return { label:b.name, icon:'file', act:function(){ dataUrlSize(t.img, function(w, hh){ insCb = function(){ ofRender(); toast('Картинка вставлена в «' + b.name + '»'); }; putImage(b, t.img, w, hh, null, 'Картинка'); }); } }; }) } : null,
      t.attach ? null : { label:'Добавить картинку', icon:'plus', act:function(){ var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.addEventListener('change', function(){ if(inp.files[0]) readDataUrl(inp.files[0], function(u){ ofSnapPush(); t.img = u; saveGraph(); ofRender(); }); }); inp.click(); } },
      { sep:true },
      { label:'Удалить', icon:'trash', danger:true, kb:'Del', act:function(){ fmDeleteNotes([t.id]); } }].filter(Boolean), x, y);
  }
  function fmEdgeMenu(e, x, y){
    if(!e) return; var a = ofFile(e.from), b = ofFile(e.to);
    openMenuAt([{ head:a.name + ' → ' + b.name },
      { label:'Открепить связь (содержимое останется)', icon:'link', kb:'Del', act:function(){ fmUnlink(e); } },
      e.kinds['вставки'] ? { label:'Удалить вставленное из «' + a.name + '»', icon:'trash', danger:true, act:function(){ fmUnlink(e, true); } } : null,
      e.kinds['вставки'] ? { label:'Обновить вставки из источника', icon:'redo', act:function(){ fmRefreshFrom(a, b); } } : null,
      { sep:true },
      { label:'Открыть «' + a.name + '»', icon:'file', act:function(){ ofOpen(a.id); } },
      { label:'Открыть «' + b.name + '»', icon:'file', act:function(){ ofOpen(b.id); } }].filter(Boolean), x, y);
  }
  function fmEmptyMenu(x, y, at){
    var fc = OF.fileClip || (function(){ try{ return JSON.parse(localStorage.getItem(FILE_KEY) || 'null'); }catch(e){ return null; } })();
    openMenuAt([
      { label:'Создать файл', icon:'plus', sub:newItems() },
      { label:'Текстовая заметка', icon:'text', act:function(){ FM.at = at; fmAddNote('', null); } },
      { label:'Картинка…', icon:'plus', act:function(){ FM.at = at; fmPickImage(null); } },
      { label:'Вставить', icon:'paste', kb:MOD + 'V', disabled:!fc && !clip, act:function(){ if(fc) ofPasteFiles(fc); else if(clip) officePasteBlocks(clip); } },
      { label:'Импорт файлов с компьютера…', icon:'file', act:function(){ ofImportIn.click(); } },
      { sep:true },
      { label:'Выделить всё', icon:'all', kb:MOD + 'A', act:function(){ fmKey({ target:document.body, ctrlKey:true, code:'KeyA', preventDefault:function(){} }); } },
      { label:'Отменить', icon:'undo', kb:MOD + 'Z', disabled:!OF.undo || !OF.undo.length, act:ofUndo },
      { label:'Повторить', icon:'redo', kb:IS_MAC ? '⌘⇧Z' : 'Ctrl+Y', disabled:!OF.redo || !OF.redo.length, act:ofRedo },
      { sep:true },
      { label:'Скомпилировать', icon:'run', kb:MOD + 'R', act:fmCompile },
      { label:'Расставить по зависимостям', icon:'layout', act:function(){ ofSnapPush(); fmLayout(true); saveGraph(); ofRender(); } },
      { label:'Вписать в экран', icon:'fit', act:fmFit },
      { label:'Масштаб 100%', icon:'zoom', act:function(){ FM.cam.k = 1; fmApplyCam(); } },
      { sep:true },
      { label:'Экосистема — все среды…', icon:'all', act:openEco },
      { label:'Персонализация…', icon:'pers', act:openPers },
      { label:'Горячие клавиши', icon:'keys', act:function(){ showTip($('bKeys'), 6000); } },
      { label:'Пространство', icon:'file', sub:shareItems() }
    ], x, y);
  }
  /* ---------- встряхивание блока файла — все его связи отцепляются ---------- */
  function fmShakeTrack(dg, e){ dg.sh = dg.sh || {}; if(shakeDetect(dg.sh, e)){ dg.shook = true; return true; } return false; }
  function fmShakeFile(f, el){
    var n = fmEdges().filter(function(e){ return e.from === f.id || e.to === f.id; }).length;
    if(!n) return;
    if(el){ el.classList.remove('shaken'); void el.offsetWidth; el.classList.add('shaken'); }
    fmUnlinkAll(f, true);
  }
  function fmUnlinkAll(f, shaken){
    var list = fmEdges().filter(function(e){ return e.from === f.id || e.to === f.id; }); if(!list.length) return;
    ofSnapPush(true);
    list.forEach(function(e){ fmUnlinkRaw(e, false); });
    calcReset(); saveGraph(); ofRender();
    toastAct((shaken ? 'Встряхнули «' + f.name + '»: ' : '') + 'отцеплено связей — ' + list.length + ', содержимое сохранено', 'Вернуть', ofUndo);
  }
  // открепить: формулы → значения, живые вставки → снимок, метки источника снимаются
  function fmUnlink(e, removeContent){
    if(!e) return; ofSnapPush(); fmUnlinkRaw(e, removeContent); FM.selE = null; calcReset(); saveGraph(); ofRender();
    var a = ofFile(e.from), b = ofFile(e.to);
    toastAct((removeContent ? 'Вставки удалены: ' : 'Связь откреплена: ') + '«' + a.name + '» → «' + b.name + '»', 'Вернуть', ofUndo);
  }
  function fmUnlinkRaw(e, removeContent){
    var a = ofFile(e.from), b = ofFile(e.to); if(!a || !b) return;
    if(b.type === 'sheet'){
      b.data.sheets.forEach(function(sh, si){
        sh.rows.forEach(function(row, r){ row.forEach(function(v, c){
          if(typeof v !== 'string' || v.charAt(0) !== '=') return; var m, hit = false; REF_RE.lastIndex = 0;
          while((m = REF_RE.exec(v))){ var t = sheetRef({ file:b }, m[1] || m[2]); if(t && t.file.id === a.id) hit = true; }
          if(hit){ var val = cellVal(b, si, c, r); row[c] = val === null || val === undefined ? '' : String(val); }
        }); });
        if(sh.images) sh.images = sh.images.filter(function(o){ if(o.from !== a.id) return true; if(removeContent) return false; delete o.from; return true; });
      });
      if(removeContent){ var keep = b.data.sheets.filter(function(sh){ return sh.from !== a.id; }); if(keep.length) b.data.sheets = keep; }
      b.data.sheets.forEach(function(sh){ if(sh.from === a.id) delete sh.from; });
    }
    if(b.type === 'doc'){
      var d = new DOMParser().parseFromString('<body>' + (b.data.html || '') + '</body>', 'text/html');
      d.body.querySelectorAll('.lnk[data-src="' + a.id + '"]').forEach(function(l){
        if(removeContent){ l.remove(); return; }
        var tag = l.querySelector('.lnk-tag'); if(tag) tag.remove();
        var div = d.createElement('div'); div.innerHTML = l.innerHTML; l.replaceWith(div);
      });
      d.body.querySelectorAll('[data-ref]').forEach(function(x){ var mm = /^(?:'([^']+)'|([^!]+))!/.exec(String(x.getAttribute('data-ref')).replace(/&#39;|&apos;/g, "'")); var t2 = mm && sheetRef({ file:null }, mm[1] || mm[2]); if(t2 && t2.file.id === a.id) x.replaceWith(d.createTextNode(x.textContent)); });
      d.body.querySelectorAll('[data-from="' + a.id + '"]').forEach(function(x){ if(removeContent) x.remove(); else x.removeAttribute('data-from'); });
      b.data.html = d.body.innerHTML;
    }
    if(b.type === 'slides'){
      b.data.slides = (b.data.slides || []).filter(function(s){
        if(s.embed && s.embed.src === a.id){ if(!removeContent){ var sv = embedHtml(Object.assign({ dark:false }, s.embed)); if(/^\s*<svg/.test(sv)) s.img = svgUrl(sv.indexOf('xmlns=') < 0 ? sv.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"') : sv); else { var src = ofFile(s.embed.src), g = parseRange(s.embed.range) || usedRange(src.data.sheets[s.embed.sheet || 0]); s.img = svgUrl(rowsSvg(rangeValues(src, s.embed.sheet || 0, g), '').svg); } } s.embed = null; }
        if(s.from === a.id){ if(removeContent) return false; delete s.from; }
        return true;
      });
    }
    if(b.type === 'form'){ if(b.data.target === a.id) b.data.target = null; if(b.data.from === a.id) delete b.data.from; b.data.fields = (b.data.fields || []).filter(function(q){ if(q.from !== a.id) return true; if(removeContent) return false; delete q.from; return true; }); }
    if(a.type === 'form' && a.data.target === b.id) a.data.target = null;
    if(b.type === 'image'){ b.data.layers = (b.data.layers || []).filter(function(L){ if(L.from !== a.id) return true; if(removeContent) return false; delete L.from; return true; }); if(IE.f === b) IE.f = null; }
    if(b.type === 'vector'){ b.data.items = (b.data.items || []).filter(function(o){ if(o.t === 'image' && o.src === a.id){ if(removeContent) return false; o.data = a.data.prev || a.data.thumb || ''; delete o.src; } if(o.from !== a.id) return true; if(removeContent) return false; delete o.from; return true; }); if(VE.f === b) VE.f = null; }
    b.t = Date.now();
  }
  function fmRefreshFrom(a, b){
    ofSnapPush();
    filePng(a, function(u, w, hh){
      if(b.type === 'sheet') b.data.sheets.forEach(function(sh){ (sh.images || []).forEach(function(o){ if(o.from === a.id){ o.src = u; o.h = Math.round(o.w * hh / w); } }); });
      if(b.type === 'slides') b.data.slides.forEach(function(s){ if(s.from === a.id && s.img) s.img = u; });
      if(b.type === 'vector') b.data.items.forEach(function(o){ if(o.from === a.id){ if(o.t === 'image') o.data = u; else if(o.t === 'svg'){ var s2 = fileSvg(a), san = veSanitizeSvg(s2.svg); if(san){ o.vb = san.vb; o.markup = san.markup; } } } });
      if(b.type === 'doc'){ var d = new DOMParser().parseFromString('<body>' + (b.data.html || '') + '</body>', 'text/html'); d.body.querySelectorAll('[data-from="' + a.id + '"] img').forEach(function(im){ im.setAttribute('src', u); }); b.data.html = d.body.innerHTML; }
      if(b.type === 'image'){ toast('Слой «' + a.name + '» — вставьте заново, чтобы обновить пиксели'); }
      if(VE.f === b) VE.f = null;
      b.t = Date.now(); saveGraph(); ofRender(); toast('Вставки обновлены из «' + a.name + '»');
    });
  }
  /* ---------- отмена в офисе (схема, рабочий стол) ---------- */
  function ofSnapPush(){ OF.undo = OF.undo || []; OF.redo = []; try{ OF.undo.push(JSON.stringify({ items:ofItems(), notes:fmNotes() })); }catch(e){ return; } if(OF.undo.length > 30) OF.undo.shift(); }
  function ofApplySnap(s){ var o = JSON.parse(s); G.files.items = o.items; ofs().mapNotes = o.notes || []; if(typeof IE !== 'undefined') IE.f = null; if(typeof VE !== 'undefined') VE.f = null; calcReset(); saveGraph(); ofRender(); }
  function ofUndo(){ if(!OF.undo || !OF.undo.length){ if(OF.trash){ ofRestore(); return; } toast('Нечего отменять'); return; } (OF.redo = OF.redo || []).push(JSON.stringify({ items:ofItems(), notes:fmNotes() })); ofApplySnap(OF.undo.pop()); toast('Отменено'); }
  function ofRedo(){ if(!OF.redo || !OF.redo.length){ toast('Нечего повторять'); return; } OF.undo.push(JSON.stringify({ items:ofItems(), notes:fmNotes() })); ofApplySnap(OF.redo.pop()); toast('Повторено'); }
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
  // любой файл можно связать с любым: живые связи + универсальные вставки, выбор — во всплывающем окне
  function fmLinkMenu(a, b, x, y){
    var items = [], IC = HOW_IC;
    if(a.type === 'sheet' && b.type === 'sheet') a.data.sheets.forEach(function(sh, i){ items.push({ label:'Живая копия листа «' + sh.name + '»', desc:'Формулы ссылаются на источник — правки приходят сами', ic:IC.link, act:function(){ ofSnapPush(); fmLinkSheets(a, i, b); } }); });
    if(a.type === 'sheet' && b.type === 'sheet') items.push({ label:'Итоги столбцов на новый лист', desc:'Суммы, средние и количество — живыми формулами', ic:IC.link, act:function(){ ofSnapPush(); fmLinkTotals(a, b); } });
    if(a.type === 'sheet' && b.type === 'doc'){ items.push({ label:'Живая таблица в документ', desc:'Обновляется при правках таблицы', ic:IC.link, act:function(){ ofSnapPush(); fmLinkDoc(a, b, 'table'); } }); items.push({ label:'Живая диаграмма в документ', ic:IC.link, act:function(){ ofSnapPush(); fmLinkDoc(a, b, 'chart'); } }); }
    if(a.type === 'sheet' && b.type === 'slides') items.push({ label:'Слайд с живой диаграммой', ic:IC.link, act:function(){ ofSnapPush(); fmLinkSlides(a, b); } });
    if(a.type === 'form' && b.type === 'sheet') items.push({ label:'Записывать ответы формы в эту таблицу', ic:IC.link, act:function(){ ofSnapPush(); a.data.target = b.id; fmDone(a, b); } });
    if(a.type === 'image' && b.type === 'vector') items.push({ label:'Живая картинка на холсте', desc:'Правки изображения появятся в рисунке', ic:IC.link, act:function(){ ofSnapPush(); (b.data.items = b.data.items || []).push({ id:'v' + Date.now().toString(36), t:'image', src:a.id, x:40, y:40, w:Math.min(400, a.data.w || 400), h:Math.min(400, a.data.w || 400) * (a.data.h || 1) / (a.data.w || 1), r:0, op:1 }); if(VE.f === b) VE.f = null; fmDone(a, b); } });
    insertOptions(a, b).forEach(function(o){ var f = o.act; o.act = function(){ ofSnapPush(); insCb = function(){ fmDone(a, b); }; f(); }; items.push(o); });
    if(!items.length){ toast('Нечего связывать'); return; }
    askHow('Как связать «' + a.name + '» → «' + b.name + '»?', FT[a.type].name + ' → ' + FT[b.type].name.toLowerCase() + ' · связь появится на схеме, её можно открепить', items);
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
