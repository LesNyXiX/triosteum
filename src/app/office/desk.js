  /* ---------- рабочий стол ---------- */
  function renderDesk(m){
    var path = OF.dir ? ofPath(ofFile(OF.dir)).concat([ofFile(OF.dir)]) : [];
    var crumbs = h('nav', { 'class':'crumbs', 'aria-label':'Путь' }, [ h('button', { type:'button', text:'Рабочий стол', on:{ click:function(){ OF.dir = null; ofRender(); } } }) ]);
    path.forEach(function(p){ crumbs.appendChild(h('span', { 'class':'sl', text:'/' })); crumbs.appendChild(h('button', { type:'button', text:p.name, on:{ click:function(){ OF.dir = p.id; ofRender(); } } })); });
    var bar = h('div', { 'class':'desk-bar' }, [ crumbs, h('span', { 'class':'grow' }) ].concat(ofTypes().concat(['folder']).map(function(t){
      return h('button', { type:'button', 'class':'btn sm nb', style:'--fc:' + FT[t].color, title:'Создать: ' + FT[t].name, on:{ click:function(){ newFile(t); if(t === 'folder') ofRender(); } } }, [ h('span', { 'class':'ic', html:ofIcon(t, 15) }), h('span', { text:FT[t].name }) ]);
    })).concat([
      ENV.office && ENV.office.noTpl ? null : h('button', { type:'button', 'class':'btn sm', text:'Шаблоны', on:{ click:openTpl } }),
      h('button', { type:'button', 'class':'btn sm', text:OF.view === 'icons' ? 'Списком' : 'Значками', on:{ click:function(){ OF.view = OF.view === 'icons' ? 'list' : 'icons'; ofRender(); } } }),
      OF.view === 'icons' ? h('button', { type:'button', 'class':'btn sm', text:'Упорядочить', on:{ click:arrangeDesk } }) : null
    ].filter(Boolean)));
    m.appendChild(bar);
    var items = ofChildren(OF.dir);
    var area = h('div', { 'class':'desk' + (OF.view === 'list' ? ' list' : ''), id:'desk', tabindex:'0', 'aria-label':'Файлы на рабочем столе' });
    m.appendChild(area);
    OF.deskW = area.clientWidth || 900;
    if(!items.length){
      area.appendChild(h('div', { 'class':'desk-empty' }, [
        h('div', { 'class':'de-ic', html:SVGI('<path d="M3 7a1 1 0 011-1h5l2 2h8a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1z"/><path d="M12 11v5M9.5 13.5h5"/>', 26) }),
        h('h2', { text:OF.dir ? 'Папка пустая' : 'Рабочий стол пуст' }),
        h('p', { text:'Создайте документ, таблицу, презентацию или форму кнопками выше, откройте шаблон или перетащите сюда файлы Word, Excel и CSV. Кнопка «AI-помощник» создаст файлы по описанию.' }),
        h('div', { 'class':'bld-acts', style:'justify-content:center' }, [
          h('button', { type:'button', 'class':'btn primary', text:'Открыть шаблон', on:{ click:openTpl } }),
          !OF.dir && !ofItems().length ? h('button', { type:'button', 'class':'btn', text:'Загрузить пример офиса', on:{ click:seedOffice } }) : null
        ].filter(Boolean))
      ]));
    }
    if(OF.view === 'list'){
      var tb = h('table', { 'class':'flist' });
      tb.innerHTML = '<thead><tr><th>Имя</th><th>Тип</th><th>Изменён</th></tr></thead>';
      var body = h('tbody');
      items.sort(function(a, b){ return (a.type === 'folder' ? 0 : 1) - (b.type === 'folder' ? 0 : 1) || (b.t || 0) - (a.t || 0); }).forEach(function(f){
        var tr = h('tr', { 'data-fid':f.id, tabindex:'0', style:'--fc:' + FT[f.type].color }, [
          h('td', null, [ h('span', { 'class':'ic', html:ofIcon(f.type, 16) }), h('span', { 'class':'fc-name', text:f.name }) ]), h('td', { text:FT[f.type].name }), h('td', { text:fmtAgo(f.t) }) ]);
        tr.addEventListener('dblclick', function(){ ofOpen(f.id); });
        tr.addEventListener('click', function(){ if(window.matchMedia('(pointer:coarse)').matches) ofOpen(f.id); });
        tr.addEventListener('keydown', function(e){ if(e.key === 'Enter') ofOpen(f.id); if(e.key === 'Delete') ofDelete([f.id]); if(e.key === 'F2') ofRename(f.id); });
        tr.addEventListener('contextmenu', function(e){ e.preventDefault(); fileMenu(f, e.clientX, e.clientY); });
        body.appendChild(tr);
      });
      tb.appendChild(body); if(items.length) area.appendChild(tb);
      return;
    }
    var maxY = 0;
    items.forEach(function(f){
      var c = h('div', { 'class':'fcard' + (OF.sel.indexOf(f.id) >= 0 ? ' sel' : ''), 'data-fid':f.id, tabindex:'0', role:'button', 'aria-label':FT[f.type].name + ' «' + f.name + '»', style:'left:' + f.x + 'px;top:' + f.y + 'px;--fc:' + FT[f.type].color }, [
        h('div', { 'class':'fc-top' }, [ h('span', { 'class':'fc-ic', html:ofIcon(f.type, 22) }), fileThumb(f) || h('span', { 'class':'fc-prev', text:filePreview(f) }) ]),
        h('div', { 'class':'fc-name', text:f.name }),
        h('div', { 'class':'fc-meta', text:FT[f.type].name + (f.type === 'folder' ? ' · ' + ofChildren(f.id).length + ' объектов' : ' · ' + fmtAgo(f.t)) })
      ]);
      maxY = Math.max(maxY, f.y + 150);
      area.appendChild(c);
    });
    var pad = h('div', { 'class':'desk-pad', style:'top:' + (maxY + 40) + 'px' }); area.appendChild(pad);
  }
  function fileThumb(f){
    try{
      if(f.type === 'image' && f.data.thumb) return h('img', { 'class':'fc-thumb', src:f.data.thumb, alt:'' });
      if(f.type === 'vector' && (f.data.items || []).length) return h('img', { 'class':'fc-thumb', src:'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(vecSvgString(f, false)), alt:'' });
    }catch(e){}
    return null;
  }
  function filePreview(f){
    if(f.type === 'image') return (f.data.w || 0) + '×' + (f.data.h || 0) + ' · слоёв ' + (f.data.layers || []).length;
    if(f.type === 'vector') return (f.data.w || 0) + '×' + (f.data.h || 0) + ' · объектов ' + (f.data.items || []).length;
    try{
      if(f.type === 'doc'){ var d = document.createElement('div'); d.innerHTML = f.data.html || ''; return d.textContent.replace(/\s+/g, ' ').trim().slice(0, 90); }
      if(f.type === 'sheet'){ var s = f.data.sheets[0]; return f.data.sheets.length + ' ' + (f.data.sheets.length === 1 ? 'лист' : 'листа') + ' · ' + s.rows.filter(function(r){ return r.some(function(x){ return String(x).trim(); }); }).length + ' строк' + (s.rows[0] && s.rows[0][0] ? ' · ' + s.rows[0].filter(Boolean).slice(0, 3).join(', ') : ''); }
      if(f.type === 'slides') return f.data.slides.length + ' слайдов · ' + (f.data.slides[0] ? f.data.slides[0].title : '');
      if(f.type === 'form') return f.data.fields.length + ' полей · ' + (f.data.target && ofFile(f.data.target) ? 'ответы → «' + ofFile(f.data.target).name + '»' : 'ответов пока нет');
      if(f.type === 'folder') return ofChildren(f.id).slice(0, 3).map(function(x){ return x.name; }).join(', ');
    }catch(e){}
    return '';
  }
  function arrangeDesk(){
    var cols = Math.max(2, Math.floor(((document.getElementById('desk') || {}).clientWidth || 900) / 184) - 0);
    ofChildren(OF.dir).sort(function(a, b){ return (a.type === 'folder' ? 0 : 1) - (b.type === 'folder' ? 0 : 1) || a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'ru'); })
      .forEach(function(f, i){ f.x = 24 + (i % cols) * 184; f.y = 24 + Math.floor(i / cols) * 156; });
    saveGraph(); ofRender();
  }
  // перетаскивание карточек, выделение, открытие
  (function deskEvents(){
    var main = $('ofMain'), lastTapT = 0, lastTapId = null, lp = null;
    main.addEventListener('pointerdown', function(e){
      var c = e.target.closest('.fcard'); if(!c || e.target.closest('.fc-ren')) { if(e.target.closest('#desk') && !c){ OF.sel = []; Array.prototype.forEach.call(document.querySelectorAll('.fcard.sel'), function(x){ x.classList.remove('sel'); }); } return; }
      if(e.button !== 0 && e.pointerType === 'mouse') return;
      var f = ofFile(c.dataset.fid); if(!f) return;
      if(e.shiftKey || e.ctrlKey || e.metaKey){ var i = OF.sel.indexOf(f.id); if(i >= 0) OF.sel.splice(i, 1); else OF.sel.push(f.id); }
      else if(OF.sel.indexOf(f.id) < 0) OF.sel = [f.id];
      Array.prototype.forEach.call(document.querySelectorAll('.fcard'), function(x){ x.classList.toggle('sel', OF.sel.indexOf(x.dataset.fid) >= 0); });
      var group = OF.sel.map(function(id){ var g = ofFile(id); return g ? { f:g, x:g.x, y:g.y, el:document.querySelector('.fcard[data-fid="' + id + '"]') } : null; }).filter(Boolean);
      OF.drag = { sx:e.clientX, sy:e.clientY, f:f, group:group, moved:false, id:e.pointerId };
      c.setPointerCapture(e.pointerId);
      if(e.pointerType !== 'mouse'){ var dd = OF.drag; lp = setTimeout(function(){ if(OF.drag === dd && !dd.moved){ OF.drag = null; fileMenu(f, e.clientX, e.clientY); } }, 600); }
    });
    main.addEventListener('pointermove', function(e){
      var d = OF.drag; if(!d) return;
      var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if(!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      d.moved = true; clearTimeout(lp);
      var z = UI.scale / 100 || 1;
      d.group.forEach(function(g){ g.f.x = Math.max(0, Math.round(g.x + dx)); g.f.y = Math.max(0, Math.round(g.y + dy)); if(g.el){ g.el.style.left = g.f.x + 'px'; g.el.style.top = g.f.y + 'px'; g.el.classList.add('drag'); } });
      var under = document.elementsFromPoint(e.clientX, e.clientY).filter(function(x){ return x.classList && x.classList.contains('fcard') && OF.sel.indexOf(x.dataset.fid) < 0; })[0];
      Array.prototype.forEach.call(document.querySelectorAll('.fcard.drop'), function(x){ x.classList.remove('drop'); });
      d.over = null;
      if(under){ var uf = ofFile(under.dataset.fid); if(uf && uf.type === 'folder'){ under.classList.add('drop'); d.over = uf; } }
    });
    function end(e){
      var d = OF.drag; OF.drag = null; clearTimeout(lp); if(!d) return;
      Array.prototype.forEach.call(document.querySelectorAll('.fcard.drag,.fcard.drop'), function(x){ x.classList.remove('drag', 'drop'); });
      if(d.moved){
        if(d.over){ ofMoveTo(d.group.map(function(g){ return g.f.id; }), d.over.id); toast('Перемещено в «' + d.over.name + '»'); }
        else saveGraph();
        return;
      }
      var now = Date.now();
      if(lastTapId === d.f.id && now - lastTapT < 420){ lastTapT = 0; ofOpen(d.f.id); return; }
      lastTapT = now; lastTapId = d.f.id;
    }
    main.addEventListener('pointerup', end); main.addEventListener('pointercancel', function(){ OF.drag = null; clearTimeout(lp); });
    main.addEventListener('contextmenu', function(e){
      if(!e.target.closest('#desk')) return;
      e.preventDefault();
      var c = e.target.closest('.fcard, tr[data-fid]');
      if(c){ fileMenu(ofFile(c.dataset.fid), e.clientX, e.clientY); return; }
      openMenuAt(newItems().concat([{ sep:true }, { label:'Упорядочить значки', icon:'layout', act:arrangeDesk }, { label:'Вернуть удалённое', icon:'undo', disabled:!OF.trash, act:ofRestore }]), e.clientX, e.clientY);
    });
    main.addEventListener('keydown', function(e){
      if(!e.target.closest('#desk')) return;
      var c = e.target.closest('.fcard');
      if(e.key === 'Enter' && c){ ofOpen(c.dataset.fid); }
      else if((e.key === 'Delete' || e.key === 'Backspace') && (OF.sel.length || c)){ e.preventDefault(); ofDelete(OF.sel.length ? OF.sel.slice() : [c.dataset.fid]); }
      else if(e.key === 'F2' && c){ e.preventDefault(); ofRename(c.dataset.fid); }
    });
    main.addEventListener('dragover', function(e){ if(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0 && officeOn()){ e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    main.addEventListener('drop', function(e){ var fl = e.dataTransfer && e.dataTransfer.files; if(!fl || !fl.length || !officeOn()) return; e.preventDefault(); Array.prototype.forEach.call(fl, importOfficeFile); });
  })();
  var ofImportIn = document.createElement('input'); ofImportIn.type = 'file'; ofImportIn.multiple = true; ofImportIn.accept = '.xlsx,.xls,.csv,.docx,.html,.htm,.txt,.md,.json,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg'; ofImportIn.hidden = true; document.body.appendChild(ofImportIn);
  ofImportIn.addEventListener('change', function(){ Array.prototype.forEach.call(ofImportIn.files, importOfficeFile); ofImportIn.value = ''; });
  function baseName(n){ return n.replace(/\.[^.]+$/, ''); }
  function importOfficeFile(file){
    var nm = baseName(file.name);
    if(/\.json$/i.test(file.name)){ importFile(file); return; }
    if(/\.svg$/i.test(file.name)){ file.text().then(function(t){ var s = veSanitizeSvg(t); if(!s){ toast('Не удалось прочитать SVG «' + file.name + '»'); return; } var w = Math.round(Math.min(4000, s.w || 800)), hh = Math.round(Math.min(4000, s.h || 600)); newFile('vector', nm, { w:w, h:hh, bg:'transparent', items:[{ id:veId(), t:'svg', name:nm.slice(0, 30), vb:s.vb, markup:s.markup, x:0, y:0, w:w, h:hh, r:0, op:1 }] }); toast('SVG «' + nm + '» открыт как векторный рисунок'); }); return; }
    if(/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)){ var u = URL.createObjectURL(file), im = new Image(); im.onload = function(){ var k = Math.min(1, 4000 / Math.max(im.width, im.height)), w = Math.round(im.width * k), hh = Math.round(im.height * k), c = document.createElement('canvas'); c.width = w; c.height = hh; c.getContext('2d').drawImage(im, 0, 0, w, hh); URL.revokeObjectURL(u); newFile('image', nm, { w:w, h:hh, layers:[{ id:'l1', name:'Фон', vis:true, op:1, blend:'source-over', src:c.toDataURL('image/png') }] }); toast('Изображение «' + nm + '» открыто' + (k < 1 ? ' (уменьшено до 4000 px)' : '')); }; im.onerror = function(){ toast('Не удалось открыть «' + file.name + '»'); }; im.src = u; return; }
    if(/\.csv$/i.test(file.name)){ file.text().then(function(t){ t = t.replace(/^﻿/, ''); var l0 = t.split('\n')[0]; var sep = (l0.match(/;/g) || []).length >= (l0.match(/,/g) || []).length ? ';' : ','; var rows = parseCsv(t, sep).filter(function(r){ return r.some(function(x){ return String(x).trim(); }); }); newFile('sheet', nm, { sheets:[{ name:'Лист1', rows:rows.length ? rows : [['']], fmt:{}, widths:{}, charts:[] }] }); toast('Таблица «' + nm + '» импортирована'); }); return; }
    if(/\.xlsx?$/i.test(file.name)){
      Promise.all([loadXLSX(), file.arrayBuffer()]).then(function(a){
        var X = a[0], wb = X.read(a[1], { type:'array', cellFormula:true });
        var sheets = wb.SheetNames.slice(0, 12).map(function(sn){
          var ws = wb.Sheets[sn], ref = ws['!ref']; if(!ref) return blankSheet(sn);
          var rg = X.utils.decode_range(ref), rows = [];
          for(var r = rg.s.r; r <= Math.min(rg.e.r, rg.s.r + 2000); r++){ var row = []; for(var c = rg.s.c; c <= Math.min(rg.e.c, rg.s.c + 60); c++){ var cell = ws[X.utils.encode_cell({ r:r, c:c })]; row.push(!cell ? '' : (cell.f ? '=' + cell.f : (cell.w !== undefined && typeof cell.v !== 'number' ? cell.w : String(cell.v)))); } rows.push(row); }
          return { name:sn, rows:rows, fmt:{}, widths:{}, charts:[] };
        });
        newFile('sheet', nm, { sheets:sheets }); toast('Книга Excel «' + nm + '» импортирована: листов ' + sheets.length);
      }, function(){ toast('Модуль Excel недоступен — сохраните файл как CSV и откройте снова'); });
      return;
    }
    if(/\.docx$/i.test(file.name)){
      Promise.all([loadLib('mammoth', 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js'), file.arrayBuffer()]).then(function(a){
        return a[0].convertToHtml({ arrayBuffer:a[1] }).then(function(r){ newFile('doc', nm, { html:sanitizeHtml(r.value) || '<p></p>' }); toast('Документ Word «' + nm + '» импортирован'); });
      }).catch(function(){ toast('Не удалось открыть .docx — сохраните документ как .html и откройте снова'); });
      return;
    }
    file.text().then(function(t){
      var html = /\.html?$/i.test(file.name) ? sanitizeHtml(new DOMParser().parseFromString(t, 'text/html').body.innerHTML)
        : t.split(/\n{2,}/).map(function(p){ return '<p>' + escHtml(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
      newFile('doc', nm, { html:html }); toast('Документ «' + nm + '» импортирован');
    });
  }
  var libP = {};
  function loadLib(name, url){
    if(window[name]) return Promise.resolve(window[name]);
    if(libP[name]) return libP[name];
    libP[name] = new Promise(function(res, rej){ var s = document.createElement('script'); s.src = url; s.onload = function(){ window[name] ? res(window[name]) : rej(new Error(name)); }; s.onerror = function(){ libP[name] = null; rej(new Error('Не удалось загрузить модуль ' + name)); }; document.head.appendChild(s); });
    return libP[name];
  }