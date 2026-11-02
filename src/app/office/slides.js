  /* ---------- презентации ---------- */
  var SLIDE_CSS = '.slide{position:relative;width:960px;height:540px;background:var(--sbg);color:var(--sink);font-family:Inter,Arial,sans-serif;overflow:hidden;box-sizing:border-box;padding:52px 64px;display:flex;flex-direction:column;text-align:left}' +
    '.slide.lay-title{justify-content:center;align-items:center}' +
    '.slide .sl-title{font-size:52px;font-weight:800;text-align:center;line-height:1.1;outline:none;max-width:100%}' +
    '.slide .sl-sub{margin-top:18px;font-size:24px;color:var(--ssub);text-align:center;outline:none}' +
    '.slide.lay-title:after{content:"";position:absolute;left:50%;bottom:110px;width:120px;height:6px;margin-left:-60px;background:var(--sacc);border-radius:3px}' +
    '.slide .sl-h{font-size:36px;font-weight:800;line-height:1.15;outline:none;padding-bottom:12px;margin-bottom:22px;border-bottom:4px solid var(--sacc);align-self:flex-start;max-width:100%;min-width:60px}' +
    '.slide .sl-body{font-size:23px;line-height:1.45;outline:none;flex:1;min-width:0}' +
    '.slide .sl-body ul{margin:0;padding-left:28px}.slide .sl-body li{margin:0 0 10px}.slide .sl-body li::marker{color:var(--sacc)}' +
    '.slide .sl-cols{display:flex;gap:36px;flex:1;min-height:0}' +
    '.slide .sl-media{flex:1;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
    '.slide .sl-media img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}.slide .sl-media svg{max-height:100%;max-width:100%}' +
    '.slide .sl-media.empty{border:2px dashed var(--ssub);border-radius:12px;color:var(--ssub);font-size:18px;opacity:.6;text-align:center;padding:12px}' +
    '.slide .lnk-t{border-collapse:collapse;font-size:15px;color:var(--sink)}.slide .lnk-t td,.slide .lnk-t th{border:1px solid var(--ssub);padding:5px 9px}';
  (function(){ var st = document.createElement('style'); st.textContent = SLIDE_CSS; document.head.appendChild(st); })();
  function slFit(){
    var st = $('slStage'); if(!st) return; var sl = st.querySelector('.slide'); if(!sl) return;
    var k = Math.min(st.clientWidth / 960, 1.3); sl.style.transform = 'scale(' + k + ')'; sl.style.transformOrigin = '0 0'; st.style.height = Math.round(540 * k) + 'px';
  }
  window.addEventListener('resize', function(){ if(typeof SE !== 'undefined' && SE.f && officeOn()) slFit(); });
  var SL_THEMES = {
    light:{ name:'Светлая', bg:'#FFFFFF', ink:'#111827', sub:'#4B5563', acc:'#16A34A', dark:false },
    dark:{ name:'Тёмная', bg:'#111827', ink:'#F9FAFB', sub:'#9CA3AF', acc:'#22C55E', dark:true },
    green:{ name:'Зелёная', bg:'#064E3B', ink:'#ECFDF5', sub:'#A7F3D0', acc:'#FDE047', dark:true },
    wine:{ name:'Бордовая', bg:'#3B0A14', ink:'#FFF1F2', sub:'#FDA4AF', acc:'#F87171', dark:true },
    blue:{ name:'Синяя', bg:'#EFF6FF', ink:'#1E3A8A', sub:'#3B82F6', acc:'#1D4ED8', dark:false }
  };
  var SL_LAYOUTS = [['title', 'Титульный'], ['content', 'Заголовок и текст'], ['two', 'Два столбца'], ['media', 'Текст и картинка / данные'], ['head', 'Только заголовок']];
  var SE = { f:null, i:0 };
  function slTheme(f){ return SL_THEMES[f.data.theme] || SL_THEMES.light; }
  function bodyHtml(t){ var lines = String(t || '').split('\n').filter(function(x){ return x.trim(); }); if(!lines.length) return ''; return '<ul>' + lines.map(function(l){ return '<li>' + escHtml(l.replace(/^[-•*]\s*/, '')) + '</li>'; }).join('') + '</ul>'; }
  function slideHtml(f, s, forShow){
    var th = slTheme(f), lay = s.layout || 'content';
    var media = s.embed ? '<div class="sl-media">' + embedHtml(Object.assign({ dark:th.dark }, s.embed)) + '</div>' : (s.img ? '<div class="sl-media"><img src="' + s.img + '" alt=""></div>' : '');
    var o = '<div class="slide lay-' + lay + '" style="--sbg:' + th.bg + ';--sink:' + th.ink + ';--ssub:' + th.sub + ';--sacc:' + th.acc + '">';
    if(lay === 'title') o += '<div class="sl-title" data-k="title">' + escHtml(s.title || '') + '</div><div class="sl-sub" data-k="body">' + escHtml(s.body || '') + '</div>';
    else if(lay === 'head') o += '<div class="sl-h" data-k="title">' + escHtml(s.title || '') + '</div>' + media;
    else if(lay === 'two') o += '<div class="sl-h" data-k="title">' + escHtml(s.title || '') + '</div><div class="sl-cols"><div class="sl-body" data-k="body">' + bodyHtml(s.body) + '</div><div class="sl-body" data-k="body2">' + bodyHtml(s.body2) + '</div></div>';
    else if(lay === 'media') o += '<div class="sl-h" data-k="title">' + escHtml(s.title || '') + '</div><div class="sl-cols"><div class="sl-body" data-k="body">' + bodyHtml(s.body) + '</div>' + (media || '<div class="sl-media empty">Картинка или данные из таблицы</div>') + '</div>';
    else o += '<div class="sl-h" data-k="title">' + escHtml(s.title || '') + '</div><div class="sl-body" data-k="body">' + bodyHtml(s.body) + '</div>' + (media ? media : '');
    return o + '</div>';
  }
  function renderSlidesEd(m, f){
    if(SE.f !== f){ SE = { f:f, i:0 }; }
    SE.i = Math.min(SE.i, f.data.slides.length - 1);
    var B = function(label, html, fn, cls){ var b = h('button', { type:'button', 'class':'rb' + (cls ? ' ' + cls : ''), title:label, 'aria-label':label, html:html }); b.addEventListener('mousedown', function(e){ e.preventDefault(); }); b.addEventListener('click', fn); return b; };
    var lay = h('select', { 'class':'input rb-sel', 'aria-label':'Макет слайда', style:'width:170px' }); SL_LAYOUTS.forEach(function(o){ lay.appendChild(h('option', { value:o[0], text:o[1] })); });
    var thm = h('select', { 'class':'input rb-sel', 'aria-label':'Тема презентации', style:'width:120px' }); Object.keys(SL_THEMES).forEach(function(k){ thm.appendChild(h('option', { value:k, text:'Тема: ' + SL_THEMES[k].name })); });
    lay.addEventListener('change', function(){ slCur().layout = lay.value; slSave(); slRenderStage(); slRenderThumbs(); });
    thm.addEventListener('change', function(){ f.data.theme = thm.value; slSave(); slRenderStage(); slRenderThumbs(); });
    var ribbon = h('div', { 'class':'ribbon', role:'toolbar', 'aria-label':'Презентация' }, [
      B('Новый слайд', '<span class="rt">+ Слайд</span>', function(){ slAdd(); }, 'pri2'),
      B('Дублировать слайд', '<span class="rt">Дублировать</span>', function(){ var c = JSON.parse(JSON.stringify(slCur())); f.data.slides.splice(SE.i + 1, 0, c); SE.i++; slSave(); slRenderAll(); }),
      B('Удалить слайд', '<span class="rt">Удалить</span>', function(){ if(f.data.slides.length < 2){ toast('В презентации должен остаться хотя бы один слайд'); return; } f.data.slides.splice(SE.i, 1); SE.i = Math.max(0, SE.i - 1); slSave(); slRenderAll(); }),
      B('Выше', SVGI('<path d="M12 19V5M6 11l6-6 6 6"/>', 16), function(){ slMove(-1); }), B('Ниже', SVGI('<path d="M12 5v14M6 13l6 6 6-6"/>', 16), function(){ slMove(1); }),
      h('span', { 'class':'rsep' }), lay, thm,
      h('span', { 'class':'rsep' }),
      B('Картинка', SVGI('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>', 16), function(){ OF.imgCb = function(u){ var s = slCur(); s.img = u; s.embed = null; if(s.layout === 'title' || s.layout === 'two') s.layout = 'media'; slSave(); slRenderAll(); }; deImgIn.click(); }),
      B('Данные из таблицы (живые)', '<span class="rt">Данные из таблицы</span>', function(e){ slLinkMenu(e.currentTarget); }),
      B('Убрать картинку / данные', SVGI('<path d="M6 6l12 12M18 6L6 18"/>', 16), function(){ var s = slCur(); s.img = null; s.embed = null; slSave(); slRenderAll(); }),
      h('span', { 'class':'grow' }),
      B('Скачать .pptx', '<span class="rt">.pptx</span>', function(){ exportFileAs(f, 'pptx'); })
    ]);
    m.appendChild(ribbon);
    var thumbs = h('div', { 'class':'sl-thumbs', id:'slThumbs', role:'listbox', 'aria-label':'Слайды' });
    var stage = h('div', { 'class':'sl-stage-wrap' }, [ h('div', { 'class':'sl-stage', id:'slStage' }), h('textarea', { 'class':'input sl-notes', id:'slNotes', rows:'2', placeholder:'Заметки докладчика (видны только вам)', 'aria-label':'Заметки докладчика' }) ]);
    m.appendChild(h('div', { 'class':'sl-wrap' }, [ thumbs, stage ]));
    $('slNotes').addEventListener('input', function(){ slCur().notes = $('slNotes').value; slSave(); });
    slRenderAll();
    OF.commit = function(){ slCommitText(); };
    function slAdd(){ f.data.slides.splice(SE.i + 1, 0, { layout:'content', title:'Новый слайд', body:'Первый пункт\nВторой пункт' }); SE.i++; slSave(); slRenderAll(); }
    function slMove(d){ var j = SE.i + d; if(j < 0 || j >= f.data.slides.length) return; var a = f.data.slides; var t = a[SE.i]; a[SE.i] = a[j]; a[j] = t; SE.i = j; slSave(); slRenderAll(); }
    function slRenderAll(){ lay.value = slCur().layout || 'content'; thm.value = f.data.theme || 'light'; slRenderThumbs(); slRenderStage(); $('slNotes').value = slCur().notes || ''; }
    OF.slRenderAll = slRenderAll;
  }
  function slCur(){ return SE.f.data.slides[SE.i]; }
  function slSave(){ SE.f.t = Date.now(); saveGraph(); }
  function slRenderThumbs(){
    var t = $('slThumbs'); if(!t) return; t.innerHTML = '';
    SE.f.data.slides.forEach(function(s, i){
      var b = h('button', { type:'button', role:'option', 'aria-selected':i === SE.i ? 'true' : 'false', 'class':'sl-th' + (i === SE.i ? ' on' : ''), 'aria-label':'Слайд ' + (i + 1) + ': ' + (s.title || '') }, [ h('span', { 'class':'n', text:String(i + 1) }), h('div', { 'class':'mini-sl', html:slideHtml(SE.f, s) }) ]);
      b.addEventListener('click', function(){ slCommitText(); SE.i = i; OF.slRenderAll(); });
      t.appendChild(b);
    });
  }
  function slRenderStage(){
    var st = $('slStage'); if(!st) return;
    st.innerHTML = slideHtml(SE.f, slCur()); slFit();
    Array.prototype.forEach.call(st.querySelectorAll('[data-k]'), function(x){
      x.contentEditable = 'true'; x.spellcheck = true;
      var k = x.getAttribute('data-k');
      if(k !== 'title' && x.classList.contains('sl-body') && !x.querySelector('li')) x.innerHTML = '<ul><li><br></li></ul>';
      x.setAttribute('aria-label', k === 'title' ? 'Заголовок слайда' : 'Текст слайда');
      x.addEventListener('input', function(){ slReadText(x); });
      x.addEventListener('blur', function(){ slRenderThumbs(); });
    });
    var med = st.querySelector('.sl-media'); if(med) med.addEventListener('click', function(e){ var s = slCur(); if(s.embed && ofFile(s.embed.src)){ openMenuAt([{ label:'Открыть таблицу-источник', icon:'file', act:function(){ ofOpen(s.embed.src); } }, { label:'Как гистограмма', icon:'grid', act:function(){ s.embed.kind = 'chart'; s.embed.ctype = 'bar'; slSave(); slRenderStage(); slRenderThumbs(); } }, { label:'Как график', icon:'redo', act:function(){ s.embed.kind = 'chart'; s.embed.ctype = 'line'; slSave(); slRenderStage(); slRenderThumbs(); } }, { label:'Как круговая', icon:'zoom', act:function(){ s.embed.kind = 'chart'; s.embed.ctype = 'pie'; slSave(); slRenderStage(); slRenderThumbs(); } }, { label:'Как таблица', icon:'grid', act:function(){ s.embed.kind = 'table'; slSave(); slRenderStage(); slRenderThumbs(); } }], e.clientX, e.clientY); } });
  }
  function slReadText(x){
    var s = slCur(), k = x.getAttribute('data-k');
    if(k === 'title' || (s.layout === 'title' && k === 'body')) s[k] = x.innerText.replace(/\n+$/, '');
    else s[k] = Array.prototype.map.call(x.querySelectorAll('li'), function(li){ return li.innerText.trim(); }).filter(Boolean).join('\n') || x.innerText.trim();
    slSave();
  }
  function slCommitText(){ var st = $('slStage'); if(st) Array.prototype.forEach.call(st.querySelectorAll('[data-k]'), slReadText); }
  function slLinkMenu(btn){
    pickSheet(btn, 'Данные для слайда', function(sf, i){
      var r = btn.getBoundingClientRect(), g = rangeStr(usedRange(sf.data.sheets[i]));
      function put(kind, ct){ var s = slCur(); s.embed = { src:sf.id, sheet:i, range:g, kind:kind, ctype:ct || 'bar', name:sf.name }; s.img = null; if(s.layout === 'title' || s.layout === 'two') s.layout = 'media'; slSave(); OF.slRenderAll(); toast('Слайд связан с таблицей «' + sf.name + '» — данные обновляются сами'); }
      openMenuAt([{ head:'«' + sf.name + '» · ' + g }, { label:'Гистограмма', icon:'grid', act:function(){ put('chart', 'bar'); } }, { label:'График', icon:'redo', act:function(){ put('chart', 'line'); } }, { label:'Круговая', icon:'zoom', act:function(){ put('chart', 'pie'); } }, { label:'Таблица', icon:'grid', act:function(){ put('table'); } }], r.left, r.bottom + 4);
    });
  }
  function slShow(start){
    slCommitText();
    var f = SE.f, i = start || 0, ov = h('div', { 'class':'sl-show', role:'dialog', 'aria-label':'Показ презентации', tabindex:'0' });
    var frame = h('div', { 'class':'sl-show-frame' }), cnt = h('div', { 'class':'sl-show-cnt' });
    ov.appendChild(frame); ov.appendChild(cnt); document.body.appendChild(ov);
    function draw(){ frame.innerHTML = slideHtml(f, f.data.slides[i], true); cnt.textContent = (i + 1) + ' / ' + f.data.slides.length + ' · ← → или нажатие — листать · Esc — выход'; fit(); }
    function fit(){ var sl = frame.querySelector('.slide'); if(!sl) return; var k = Math.min(window.innerWidth / 960, window.innerHeight / 540); sl.style.transform = 'scale(' + k + ')'; }
    function go(d){ i = Math.max(0, Math.min(f.data.slides.length - 1, i + d)); draw(); }
    function close(){ document.removeEventListener('keydown', key, true); window.removeEventListener('resize', fit); animRemove(ov, 300); if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function(){}); }
    function key(e){ if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); } else if(['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].indexOf(e.key) >= 0){ e.preventDefault(); go(1); } else if(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].indexOf(e.key) >= 0){ e.preventDefault(); go(-1); } }
    ov.addEventListener('click', function(e){ if(e.clientX < window.innerWidth / 4) go(-1); else go(1); });
    document.addEventListener('keydown', key, true); window.addEventListener('resize', fit);
    if(ov.requestFullscreen) ov.requestFullscreen().catch(function(){});
    draw(); ov.focus();
  }
