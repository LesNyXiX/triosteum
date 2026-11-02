  /* ---------- редактор кода ---------- */
  function renderLangList(){
    el.langList.innerHTML = '';
    var active = cur().id;
    LANGS.forEach(function(l){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'opt' + (l.id === active ? ' on' : '');
      b.setAttribute('role','option'); b.setAttribute('aria-selected', l.id === active ? 'true' : 'false');
      b.innerHTML = '<span style="display:flex;align-items:center;gap:10px"><span style="width:12px;height:12px;border-radius:3px;flex:none"></span><span><span class="n"></span><span class="d"></span></span></span><svg class="i chk" viewBox="0 0 24 24" style="width:16px;height:16px;stroke-width:2.2" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
      b.querySelector('span span').style.background = grad(COLORS[l.id]);
      b.querySelector('.n').textContent = l.name;
      var n = docNode();
      b.querySelector('.d').textContent = n && l.id !== n.lang ? variantKind(n, l.id).t + ' · ' + l.tool : l.tool;
      b.addEventListener('click', function(){ setLang(l.id); });
      b.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ closeLang(); el.langBtn.focus(); } });
      el.langList.appendChild(b);
    });
  }
  function updateGutter(){
    var n = el.code.value.split('\n').length, s = '';
    for(var i=1;i<=n;i++){ s += i + (i<n ? '\n' : ''); }
    el.gutter.textContent = s;
    el.gutter.scrollTop = el.code.scrollTop;
  }
  var previewTimer = null;
  function updatePreview(now){
    if(cur().id !== 'html') return;
    clearTimeout(previewTimer);
    if(now){ el.frame.srcdoc = el.code.value; return; }
    previewTimer = setTimeout(function(){ el.frame.srcdoc = el.code.value; }, 300);
  }
  function status(){
    if(typeof OF === 'object' && OF && officeOn()){ ofStatus(); return; }
    var l = cur();
    if(S.view === 'editor'){
      el.stLeft.textContent = (docNode() ? 'Блок: ' : (isDocs() ? 'Шаблон: ' : 'Плагин: ')) + fileName() + (isDocs() ? ' · Тип: ' + l.name : ' · Язык: ' + l.name + ' · Строк: ' + el.code.value.split('\n').length);
      el.stRight.textContent = ENV.name + ' · ' + l.tool;
    } else {
      el.stLeft.textContent = 'Инструмент: ' + TOOL_NAMES[S.tool] + ' · Блоков: ' + G.nodes.length + ' · Связей: ' + G.edges.length + ' · Заметок: ' + G.notes.length +
        (S.multi && S.multi.length ? ' · Выделено: ' + S.multi.length : '');
      el.stRight.textContent = ENV.name + ' · Масштаб ' + Math.round(G.cam.k * 100) + '%';
    }
  }
  function render(){
    if(typeof OF === 'object' && OF && isDocs() && OF.tab !== 'auto'){ ofRender(); return; }
    var isEd = S.view === 'editor';
    el.lib.hidden = !S.lib;
    el.canvas.hidden = isEd;
    el.editor.hidden = !isEd;
    el.bLib.classList.toggle('on', S.lib); el.bLib.setAttribute('aria-pressed', S.lib);
    el.bCreate.classList.toggle('on', !el.modal.hidden);
    toolBtns.forEach(function(b){ b.classList.toggle('on', !isEd && b.dataset.tool === S.tool); b.setAttribute('aria-pressed', !isEd && b.dataset.tool === S.tool); });
    var addOn = !isEd && (S.tool === 'block' || S.tool === 'hub');
    var ba = document.getElementById('bAdd'); if(ba) ba.classList.toggle('on', addOn);
    if(isEd) hidePop();
    applyCursor(); applyCam(); status();
    if(!isEd) placePop();
    if(typeof OF === 'object' && OF) ofApplyMode();
    $('topRun').textContent = 'Запустить';
  }
  function loadDoc(){
    var l = cur(), n = docNode(), p = docPlugin();
    el.code.value = getCode();
    el.docTitle.value = docTitle();
    var editable = !!(n || (p && p.my));
    el.docTitle.readOnly = !editable;
    el.docTitle.title = editable ? 'Нажмите, чтобы переименовать' : '';
    el.backBtn.hidden = !n;
    el.toBoard.hidden = !p;
    el.fileName.textContent = fileName();
    el.langLabel.textContent = (isDocs() ? 'Тип: ' : 'Язык: ') + l.name;
    el.envLabel.textContent = 'Среда: ' + l.tool;
    el.preview.hidden = l.id !== 'html';
    updatePreview(true);
    el.out.textContent = l.real ? 'Готово. Нажмите «Запустить код» или Ctrl+Enter.' : 'Редактор готов. Компилятор для ' + l.name + ' подключим на сервере, пока доступна только запись кода.';
    renderLangList(); updateGutter(); status();
    applyPane();
  }
  function setLang(id){
    var n = docNode(), p = docPlugin();
    if(n){ n.lang = id; saveGraph(); }
    else if(p && p.my){ p.lang = id; saveMy(); renderList(); }
    else if(p){
      // встроенный плагин: если есть аналог на этом языке — показываем его, иначе шаблон в новом плагине
      var v = p.family && VARIANTS[p.family] && VARIANTS[p.family][id];
      if(!v){ S.lang = id; save('triosteum.lang.' + ENV.id, id); closeLang(); toast('У этого плагина нет версии на ' + shortName(langById(id))); return; }
      var np = { id:'my-' + Date.now(), my:true, name:p.name, lang:id, desc:p.desc, family:p.family, codes:{} };
      np.codes[id] = v; MY.unshift(np); saveMy(); renderChips(); renderList();
      S.doc = { kind:'plugin', id:np.id };
      toast('Открыта версия на ' + shortName(langById(id)) + ' (копия в «Мои плагины»)');
    }
    closeLang(); loadDoc();
  }
  function openPlugin(id){
    S.doc = { kind:'plugin', id:id }; S.view = 'editor'; S.lib = false;
    loadDoc(); render();
    el.code.focus(); el.code.setSelectionRange(0, 0); el.code.scrollTop = 0;
  }
  function openNode(id){
    var on = nodeById(id);
    if(on && isDocs() && on.src && ofFile(on.src)){ ofOpen(on.src); return; }
    if(on && isDocs() && (isParamKind(on.lang) || on.kind === 'hub')){ S.view = 'canvas'; S.multi = []; S.sel = { type:'node', id:id }; render(); renderGraph(); updateSel(); showPop(); return; }
    S.doc = { kind:'node', id:id }; S.view = 'editor'; S.lib = false;
    loadDoc(); render();
    el.code.focus(); el.code.setSelectionRange(0, 0); el.code.scrollTop = 0;
  }
  function backToCanvas(){ S.view = 'canvas'; closeLang(); render(); renderGraph(); }
  el.backBtn.addEventListener('click', backToCanvas);
  el.toBoard.addEventListener('click', function(){ var p = docPlugin(); if(p){ S.view = 'canvas'; closeLang(); openOnBoard(p.id); } });
  el.docTitle.addEventListener('input', function(){
    var n = docNode(), p = docPlugin(), v = el.docTitle.value.trim() || 'Без названия';
    if(n){ n.name = v; saveGraph(); }
    else if(p && p.my){ p.name = v; saveMy(); renderList(); }
    else return;
    el.fileName.textContent = fileName(); status();
  });
  function openLang(){ S.langOpen = true; renderLangList(); el.langList.hidden = false; el.langBtn.setAttribute('aria-expanded','true'); var on = el.langList.querySelector('.on'); if(on) on.focus(); }
  function closeLang(){ S.langOpen = false; el.langList.hidden = true; el.langBtn.setAttribute('aria-expanded','false'); }

  el.bLib.addEventListener('click', function(){ S.lib = !S.lib; render(); if(S.lib) el.search.focus(); });
  $('libClose').addEventListener('click', function(){ S.lib = false; render(); });
  el.bCreate.addEventListener('click', openCreate);
  toolBtns.forEach(function(b){ b.addEventListener('click', function(){
    S.tool = b.dataset.tool; closeLang(); hidePop();
    if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); } else render();
  }); });
  $('zIn').addEventListener('click', function(){ zoomAt(G.cam.k + 0.25); });
  $('zOut').addEventListener('click', function(){ zoomAt(G.cam.k - 0.25); });
  $('zReset').addEventListener('click', function(){ zoomAt(1); });

  el.langBtn.addEventListener('click', function(e){ e.stopPropagation(); S.langOpen ? closeLang() : openLang(); });
  el.langBtn.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeLang(); });
  document.addEventListener('click', function(e){ if(S.langOpen && !el.langList.contains(e.target)) closeLang(); });

  el.code.addEventListener('input', function(){ setCode(el.code.value); updateGutter(); updatePreview(false); status(); });
  el.code.addEventListener('scroll', function(){ el.gutter.scrollTop = el.code.scrollTop; });
  el.code.addEventListener('keydown', function(e){
    if(e.key === 'Tab' && !e.shiftKey){
      e.preventDefault();
      var s = el.code.selectionStart, en = el.code.selectionEnd, v = el.code.value;
      el.code.value = v.slice(0, s) + '    ' + v.slice(en);
      el.code.selectionStart = el.code.selectionEnd = s + 4;
      el.code.dispatchEvent(new Event('input'));
    }
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){ e.preventDefault(); runCode(); }
    if(e.key === 'Escape' && docNode()){ backToCanvas(); }
  });
  $('resetTpl').addEventListener('click', function(){
    clearCode();
    el.code.value = original(); updateGutter(); updatePreview(true); status();
    el.out.textContent = isDocs() ? 'Блок возвращён к шаблону.' : 'Код возвращён к исходному.';
    if(paneFor() !== 'code') applyPane();
  });
