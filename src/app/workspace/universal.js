  /* =====================================================================
     УНИВЕРСАЛЬНОСТЬ: всё совмещается со всем.
     · буфер обмена общий для всех пространств и сред (и для системного буфера);
     · блок из другой среды сохраняет свой язык, цвета и код и компилируется
       вместе с остальными блоками одним маршрутом;
     · двойной клик по блоку — открыть его там, где его удобно править:
       блок чужой среды открывается в родной среде, правки возвращаются назад;
     · вставка картинок и текста на доску с выбором «как вставить».
     ===================================================================== */
  var CLIP_KEY = 'triosteum.clip', CLIP_MARK = 'TRIOSTEUM-CLIP:';
  try{ var clipSaved = localStorage.getItem(CLIP_KEY); if(clipSaved) clip = JSON.parse(clipSaved); }catch(e){}

  // переносимая копия: код плагина «замораживается» в блоке, цвета и среда сохраняются
  function clipPortable(c){
    var p = JSON.parse(JSON.stringify({ nodes:c.nodes, notes:c.notes, edges:c.edges }));
    p.nodes.forEach(function(n, i){
      var src = c.nodes[i];
      n.env = n.env || ENV.id; n.colors = n.colors || colorsOf(src);
      if(n.kind !== 'hub'){ n.codes = n.codes || {}; try{ n.codes[n.lang] = nodeCode(src); }catch(e){} }
      if(n.src && typeof ofFile === 'function' && ofFile(n.src)){ n.srcName = ofFile(n.src).name; }
    });
    return p;
  }
  function clipStore(){
    if(!clip) return;
    clip.t = Date.now(); clip.env = ENV.id; clip.envName = ENV.name; clip.proj = PROJ.cur; clip.projName = curProj().name;
    clip.portable = clipPortable(clip);
    try{ localStorage.setItem(CLIP_KEY, JSON.stringify(clip)); }catch(e){}
  }
  var _copySel = copySel;
  copySel = function(){ _copySel(); clipStore(); };
  var _pasteClip = pasteClip;
  pasteClip = function(){
    try{ var s = localStorage.getItem(CLIP_KEY); if(s){ var c = JSON.parse(s); if(!clip || (c.t || 0) > (clip.t || 0)) clip = c; } }catch(e){}
    if(!clip){ toast('Буфер пуст — сначала скопируйте элементы'); return; }
    var foreign = clip.proj && clip.proj !== PROJ.cur && clip.portable;
    if(!foreign){ _pasteClip(); return; }
    var keep = clip;
    clip = { nodes:keep.portable.nodes, notes:keep.portable.notes, edges:keep.portable.edges };
    // блок с файлом другого пространства: ищем файл с тем же именем здесь
    clip.nodes.forEach(function(n){ if(n.src && !(typeof ofFile === 'function' && ofFile(n.src))){ var same = n.srcName && typeof ofByName === 'function' ? ofByName(n.srcName) : null; n.src = same ? same.id : null; } });
    _pasteClip(); clip = keep;
    toast('Вставлено из «' + (keep.projName || 'другого пространства') + '»' + (keep.env !== ENV.id ? ' · среда «' + (ENVS[keep.env] ? ENVS[keep.env].name : keep.envName) + '»' : '') + ': ' + (S.multi || []).length);
  };

  /* ---------- окно «Как вставить?» ---------- */
  function askHow(title, sub, opts){
    var old = $('howW'); if(old) old.remove();
    var box = h('div', { 'class':'how-w', id:'howW', role:'dialog', 'aria-modal':'true', 'aria-label':title });
    function close(){ box.remove(); }
    var list = h('div', { 'class':'how-list' });
    opts.filter(Boolean).forEach(function(o, i){
      var b = h('button', { type:'button', 'class':'how-i' + (i === 0 ? ' pri' : '') }, [
        h('span', { 'class':'how-ic', html:o.ic || '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' }),
        h('span', { 'class':'how-t' }, [ h('b', { text:o.label }), o.desc ? h('span', { text:o.desc }) : null ].filter(Boolean))
      ]);
      b.addEventListener('click', function(){ close(); o.act(); });
      list.appendChild(b);
    });
    box.appendChild(h('div', { 'class':'how-card' }, [
      h('div', { 'class':'how-h' }, [ h('div', null, [ h('h2', { text:title }), sub ? h('p', { text:sub }) : null ].filter(Boolean)),
        h('button', { type:'button', 'class':'icon-btn', 'aria-label':'Закрыть', html:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>', on:{ click:close } }) ]),
      list ]));
    box.addEventListener('pointerdown', function(e){ if(e.target === box) close(); });
    box.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); } });
    document.body.appendChild(box);
    var f = box.querySelector('.how-i'); if(f) f.focus();
    return box;
  }
  var HOW_IC = {
    note:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/></svg>',
    code:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>',
    table:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/></svg>',
    doc:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 12h6M10 16h6"/></svg>',
    image:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>',
    vector:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 5v8l-8 5-8-5V8z"/></svg>',
    block:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="4" width="6" height="5" rx="1"/><rect x="15" y="15" width="6" height="5" rx="1"/><path d="M9 6.5h6M18 9v6"/></svg>',
    link:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>'
  };

  /* ---------- системный буфер: копирование блоков и вставка чего угодно ---------- */
  function typingIn(t){ return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  function boardCtx(){ return S.view === 'canvas' && el.modal.hidden && !cmdOpen() && !(typeof officeOn === 'function' && officeOn()) && !$('howW'); }
  document.addEventListener('copy', function(e){
    if(!boardCtx() || typingIn(e.target) || !clip || Date.now() - (clip.t || 0) > 1500 || !e.clipboardData) return;
    var txt = CLIP_MARK + JSON.stringify({ t:clip.t, env:clip.env, envName:clip.envName, proj:clip.proj, projName:clip.projName, nodes:clip.nodes, notes:clip.notes, edges:clip.edges, portable:clip.portable });
    e.clipboardData.setData('text/plain', txt); e.preventDefault();
  });
  var pasteWait = null;
  function boardPasteSoon(){ clearTimeout(pasteWait); pasteWait = setTimeout(function(){ pasteWait = null; pasteClip(); }, 120); }
  function readClipFiles(dt){ var out = []; if(!dt) return out; Array.prototype.forEach.call(dt.items || [], function(it){ if(it.kind === 'file'){ var f = it.getAsFile(); if(f) out.push(f); } }); if(!out.length) Array.prototype.forEach.call(dt.files || [], function(f){ out.push(f); }); return out; }
  function readDataUrl(file, cb){ var r = new FileReader(); r.onload = function(){ cb(String(r.result)); }; r.readAsDataURL(file); }
  function parseClipMark(txt){ if(typeof txt !== 'string' || txt.indexOf(CLIP_MARK) !== 0) return null; try{ return JSON.parse(txt.slice(CLIP_MARK.length)); }catch(e){ return null; } }
  document.addEventListener('paste', function(e){
    if(!boardCtx() || typingIn(e.target)) return;
    clearTimeout(pasteWait); pasteWait = null;
    e.preventDefault();
    var dt = e.clipboardData, txt = dt ? dt.getData('text/plain') : '', mark = parseClipMark(txt), files = readClipFiles(dt);
    if(mark){ if(!clip || (mark.t || 0) >= (clip.t || 0)) clip = mark; pasteClip(); return; }
    var imgs = files.filter(function(f){ return /^image\//.test(f.type); });
    if(imgs.length){ imgs.forEach(function(f, i){ boardPasteImage(f, i); }); return; }
    if(txt && txt.trim()){ boardPasteText(txt); return; }
    pasteClip();
  });
  function boardPoint(i){ var c = viewCenter(); return { x:c.x - 80 + (i || 0) * 30, y:c.y - 60 + (i || 0) * 30 }; }
  function boardPasteImage(file, i){
    readDataUrl(file, function(url){
      var put = function(){ var p = boardPoint(i), t = { id:newId('t'), text:'', img:url, x:Math.round(p.x), y:Math.round(p.y), fs:UI.note, tint:'grey' }; G.notes.push(t); S.sel = { type:'note', id:t.id }; S.multi = []; saveGraph(); renderGraph(); updateSel(); toast('Картинка на доске'); };
      if(typeof ENV !== 'undefined' && ENV.office && typeof newFile === 'function' && ofTypes().indexOf('image') >= 0){
        askHow('Как вставить картинку?', file.name || 'Изображение из буфера обмена', [
          { label:'На доску', desc:'Картинка-заметка рядом с блоками', ic:HOW_IC.note, act:put },
          { label:'Новым файлом-изображением', desc:'Откроется в редакторе, появится на схеме файлов', ic:HOW_IC.image, act:function(){ importOfficeFile(file); } }
        ]);
      } else put();
    });
  }
  function guessCodeLang(txt){
    if(/^\s*</.test(txt) && /<\/?[a-z][\s\S]*>/i.test(txt)) return 'html';
    if(/\bdef\s+\w+\s*\(|\bimport\s+\w+|print\(|@block/.test(txt)) return 'python';
    if(/#include|std::|int\s+main\s*\(/.test(txt)) return 'cpp';
    if(/\bnamespace\b|\bpublic\s+(static\s+)?\w+\s+\w+\(|using\s+System/.test(txt)) return 'csharp';
    if(/Процедура|Функция|КонецПроцедуры|КонецФункции/.test(txt)) return '1c';
    return null;
  }
  function tsvRows(txt){
    var lines = String(txt).replace(/\r/g, '').split('\n').filter(function(l){ return l.trim(); }); if(lines.length < 2) return null;
    var sep = lines[0].indexOf('\t') >= 0 ? '\t' : (lines[0].indexOf(';') >= 0 ? ';' : (lines[0].split(',').length > 2 ? ',' : null));
    if(!sep) return null;
    var rows = lines.map(function(l){ return l.split(sep).map(function(x){ return x.trim(); }); });
    return rows[0].length > 1 ? rows : null;
  }
  function boardPasteText(txt){
    var p = boardPoint(0), lang = guessCodeLang(txt), rows = tsvRows(txt), opts = [];
    function note(){ var t = { id:newId('t'), text:txt.slice(0, 4000), x:Math.round(p.x), y:Math.round(p.y), fs:UI.note, tint:'grey' }; G.notes.push(t); S.sel = { type:'note', id:t.id }; S.multi = []; saveGraph(); renderGraph(); updateSel(); toast('Текст вставлен заметкой'); }
    function block(l, code, name){ var n = addNode(l, name || (langById(l) ? langById(l).name : 'Блок') + ' из буфера', p.x - NW / 2, p.y - NH / 2); n.codes[l] = code; if(!nativeLang(l)){ n.env = langHomeEnv(l); n.colors = colorsOf(n); } saveGraph(); renderGraph(); toast('Блок «' + n.name + '» на доске'); }
    if(lang) opts.push({ label:'Блок кода · ' + shortName(langById(lang)), desc:nativeLang(lang) ? 'Компилируется вместе со схемой' : 'Блок среды «Разработка» — компилируется вместе со всеми блоками', ic:HOW_IC.code, act:function(){ block(lang, txt); } });
    if(rows) opts.push({ label:'Таблица с данными', desc:rows.length + ' строк × ' + rows[0].length + ' столбцов — данные пойдут по маршруту', ic:HOW_IC.table, act:function(){ block('sheet', JSON.stringify({ rows:rows }), 'Таблица из буфера'); } });
    opts.push({ label:'Текстовая заметка', desc:'Подпись или пояснение на доске', ic:HOW_IC.note, act:note });
    if(!lang) opts.push({ label:'Документ', desc:'Шаблон документа: текст пойдёт по маршруту', ic:HOW_IC.doc, act:function(){ block('doc', '<p>' + escHtml(txt).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>', 'Документ из буфера'); } });
    if(!lang && !nativeLang('python')) opts.push({ label:'Блок кода · Python', desc:'Если это код — он выполнится вместе со схемой', ic:HOW_IC.code, act:function(){ block('python', txt); } });
    if(opts.length === 1){ opts[0].act(); return; }
    askHow('Как вставить?', txt.length > 90 ? txt.slice(0, 90).replace(/\s+/g, ' ') + '…' : txt.replace(/\s+/g, ' '), opts);
  }

  /* ---------- картинки-заметки ---------- */
  var _noteEl = noteEl;
  noteEl = function(t){
    var d = _noteEl(t);
    if(t.img){ d.classList.add('imgnote'); var im = document.createElement('img'); im.src = t.img; im.alt = t.text || 'Картинка'; im.draggable = false; if(t.iw) im.style.width = t.iw + 'px'; d.insertBefore(im, d.firstChild); }
    return d;
  };

  /* ---------- блок чужой среды: метка и открытие в родной среде ---------- */
  function blockHome(n){
    if(!n || n.kind === 'hub' || nativeLang(n.lang)) return ENV.id;
    if(n.env && ENVS[n.env] && ENVS[n.env].langs.some(function(l){ return l.id === n.lang; })) return n.env;
    return langHomeEnv(n.lang) || ENV.id;
  }
  var _nodeEl = nodeEl;
  nodeEl = function(n){
    var d = _nodeEl(n), home = blockHome(n);
    if(home !== ENV.id && ENVS[home]){
      d.classList.add('foreign'); var b = document.createElement('span'); b.className = 'env-tag'; b.textContent = ENVS[home].short || ENVS[home].name; b.title = 'Блок среды «' + ENVS[home].name + '» — компилируется вместе со схемой. Двойной клик — открыть в родной среде'; d.appendChild(b);
    }
    if(n.bridge){ d.classList.add('bridged'); }
    return d;
  };
  function openBlock(n){
    if(!n) return;
    if(n.kind === 'hub'){ S.sel = { type:'node', id:n.id }; showPop(); return; }
    if(n.src && typeof ofFile === 'function' && ofFile(n.src) && ENV.office){ ofOpen(n.src); return; }
    var home = blockHome(n);
    if(home === ENV.id){ openNode(n.id); return; }
    bridgeOpen(n, home);
  }
  // мост: то же пространство открывается в родной среде блока — без копий и лишних пространств;
  // правки сохраняются сразу, «Вернуться» возвращает прежнюю среду
  function bridgeOpen(n, home){
    if(S.visit && S.visit.proj === PROJ.cur && home === S.visit.env){ var id = n.id; visitReturn(); var back = nodeById(id); if(back) openBlock(back); return; }
    if(ENV.office && typeof ofCommit === 'function') ofCommit();
    flushSave();
    var back = { env:ENV.id, envName:ENV.name, node:n.id, tab:ENV.office ? OF.tab : null, proj:PROJ.cur };
    setEnv(home);
    S.visit = back;
    if(typeof ofRender === 'function') ofRender();
    S.view = 'canvas'; hidePop(); render(); renderGraph();
    S.sel = { type:'node', id:n.id }; S.multi = []; updateSel();
    openNode(n.id);
    bridgeBar();
    toast('«' + n.name + '» открыт в среде «' + ENVS[home].name + '» — правки сохраняются сразу');
  }
  function visitReturn(){
    var v = S.visit; if(!v) return;
    flushSave(); S.visit = null;
    if(PROJ.cur !== v.proj){ bridgeBar(); return; }
    setEnv(v.env);
    S.view = 'canvas'; render();
    if(ENV.office && typeof ofSetTab === 'function') ofSetTab(v.tab === 'auto' || !v.tab ? 'auto' : v.tab); else renderGraph();
    var n = nodeById(v.node); if(n){ S.sel = { type:'node', id:n.id }; updateSel(); }
    bridgeBar();
    toast('Вы снова в среде «' + v.envName + '»' + (n ? ' — блок «' + n.name + '» обновлён' : ''));
  }
  var _switchProjU = switchProj;
  switchProj = function(id){ if(S.visit && id !== S.visit.proj) S.visit = null; return _switchProjU.apply(this, arguments); };
  function bridgeReturn(copy){
    if(!copy || !copy.bridge) return;
    flushSave();
    var b = copy.bridge, data = {};
    Object.keys(copy).forEach(function(k){ if(['id', 'x', 'y', 'bridge', 'env'].indexOf(k) < 0) data[k] = JSON.parse(JSON.stringify(copy[k])); });
    G.nodes = G.nodes.filter(function(x){ return x.id !== copy.id; }); G.edges = G.edges.filter(function(e){ return e.from !== copy.id && e.to !== copy.id; });
    saveGraph(); flushSave();
    if(!PROJ.list.some(function(p){ return p.id === b.proj; })){ toast('Исходное пространство удалено'); bridgeBar(); return; }
    switchProj(b.proj);
    var orig = nodeById(b.node);
    if(orig){ Object.keys(data).forEach(function(k){ orig[k] = data[k]; }); }
    else { var c = viewCenter(); data.id = newId('n'); data.x = Math.round(c.x); data.y = Math.round(c.y); data.env = copy.env; G.nodes.push(data); orig = data; }
    if(ENV.office && typeof ofSetTab === 'function') ofSetTab('auto');
    S.view = 'canvas'; render(); saveGraph(); renderGraph(); S.sel = { type:'node', id:orig.id }; updateSel();
    toast('Изменения блока «' + orig.name + '» перенесены в «' + b.projName + '»');
    bridgeBar();
  }
  function bridgeBar(){
    var bar = $('bridgeBar'), list = G.nodes.filter(function(n){ return n.bridge; });
    if(S.visit && S.visit.proj === PROJ.cur){
      var vn = nodeById(S.visit.node);
      if(!bar){ bar = h('div', { 'class':'bridge-bar', id:'bridgeBar', role:'status' }); document.body.appendChild(bar); }
      bar.innerHTML = '';
      bar.appendChild(h('span', { 'class':'bb-t', text:(vn ? 'Блок «' + vn.name + '»' : 'Пространство') + ' открыт в среде «' + ENV.name + '» · правки сохраняются сразу' }));
      bar.appendChild(h('button', { type:'button', 'class':'btn sm primary', text:'Вернуться в «' + S.visit.envName + '»', on:{ click:visitReturn } }));
      return;
    }
    if(!list.length){ if(bar) bar.remove(); return; }
    var dn = typeof docNode === 'function' ? docNode() : null, cur = (dn && dn.bridge) ? dn : list[list.length - 1];
    if(!bar){ bar = h('div', { 'class':'bridge-bar', id:'bridgeBar', role:'status' }); document.body.appendChild(bar); }
    bar.innerHTML = '';
    bar.appendChild(h('span', { 'class':'bb-t', text:'Блок «' + cur.name + '» из пространства «' + cur.bridge.projName + '» (среда «' + cur.bridge.envName + '»)' }));
    bar.appendChild(h('button', { type:'button', 'class':'btn sm primary', text:'Вернуть в «' + cur.bridge.projName + '»', on:{ click:function(){ bridgeReturn(cur); } } }));
    bar.appendChild(h('button', { type:'button', 'class':'btn sm', text:'Оставить здесь', title:'Блок останется в этом пространстве как обычный', on:{ click:function(){ delete cur.bridge; saveGraph(); renderGraph(); bridgeBar(); toast('Блок оставлен в этом пространстве'); } } }));
  }
  var _renderGraphU = renderGraph;
  renderGraph = function(){ _renderGraphU.apply(this, arguments); bridgeBar(); };

  // настройки блока: открыть в родной среде, вернуть правки
  var _renderNodePop = renderNodePop;
  renderNodePop = function(p, n){
    _renderNodePop(p, n);
    if(!n) return;
    var acts = p.querySelector('.acts'); if(!acts) return;
    var home = blockHome(n);
    if(home !== ENV.id && ENVS[home]) acts.insertBefore(h('button', { type:'button', 'class':'btn sm primary', text:'Открыть в среде «' + ENVS[home].name + '»', title:'Исходник блока откроется в его родной среде, в этом же пространстве', on:{ click:function(){ hidePop(); bridgeOpen(n, home); } } }), acts.firstChild);
    if(S.visit && S.visit.proj === PROJ.cur) acts.insertBefore(h('button', { type:'button', 'class':'btn sm primary', text:'Вернуться в «' + S.visit.envName + '»', on:{ click:function(){ hidePop(); visitReturn(); } } }), acts.firstChild);
    if(n.bridge) acts.insertBefore(h('button', { type:'button', 'class':'btn sm primary', text:'Вернуть в «' + n.bridge.projName + '»', on:{ click:function(){ hidePop(); bridgeReturn(n); } } }), acts.firstChild);
    acts.appendChild(h('button', { type:'button', 'class':'btn sm', text:'Копировать (в любое пространство)', on:{ click:function(){ S.multi = []; S.sel = { type:'node', id:n.id }; copySel(); } } }));
  };
