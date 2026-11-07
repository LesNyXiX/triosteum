  /* ---------- док сред внизу, как на Mac ----------
     Значки всех сред. Под курсором значки плавно увеличиваются «волной», над значком — подпись,
     под открытой средой — точка (под средами, где уже есть пространства, — точка поменьше).
     Щелчок — значок подпрыгивает, и открывается среда. Настройка: Персонализация → «Док сред». */
  var EDOCK = { el:null, items:[], raf:0, mx:null, hideT:0 };
  var ED_BASE = 46, ED_MAX = 76, ED_RANGE = 150;
  function envIc(k){ var e = ENVS[k]; return e.ic || (k === 'code' ? '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>' : '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'); }
  function envDockMode(){ return UI.envDock || 'on'; }
  function envDockBuild(){
    if(EDOCK.el || PANE) return;
    var d = h('nav', { 'class':'env-dock', id:'envDock', 'aria-label':'Среды работы' });
    var shelf = h('div', { 'class':'ed-shelf', role:'toolbar', 'aria-label':'Среды работы' });
    d.appendChild(shelf);
    document.querySelector('.row').appendChild(d);
    EDOCK.el = d; EDOCK.shelf = shelf;
    shelf.addEventListener('mousemove', function(e){ EDOCK.mx = e.clientX; edFrame(); });
    shelf.addEventListener('mouseleave', function(){ EDOCK.mx = null; edFrame(); });
    shelf.addEventListener('keydown', function(e){
      var its = EDOCK.items.map(function(x){ return x.b; }), i = its.indexOf(document.activeElement);
      if(i < 0) return;
      if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){ e.preventDefault(); its[(i + (e.key === 'ArrowRight' ? 1 : -1) + its.length) % its.length].focus(); }
      else if(e.key === 'Home' || e.key === 'End'){ e.preventDefault(); its[e.key === 'Home' ? 0 : its.length - 1].focus(); }
    });
    // автоскрытие: док выезжает, когда курсор у нижнего края рабочей области
    document.addEventListener('mousemove', function(e){
      if(envDockMode() !== 'auto' || !EDOCK.el) return;
      var r = document.querySelector('.row').getBoundingClientRect(), near = e.clientY > r.bottom - 14 && e.clientY <= r.bottom + 4;
      if(near || EDOCK.el.matches(':hover') || EDOCK.el.contains(document.activeElement)){ clearTimeout(EDOCK.hideT); EDOCK.el.classList.add('peek'); }
      else if(EDOCK.el.classList.contains('peek') && !EDOCK.hideT){ EDOCK.hideT = setTimeout(function(){ EDOCK.hideT = 0; if(!EDOCK.el.matches(':hover') && !EDOCK.el.contains(document.activeElement)) EDOCK.el.classList.remove('peek'); }, 700); }
    });
    d.addEventListener('focusin', function(){ if(envDockMode() === 'auto') EDOCK.el.classList.add('peek'); });
  }
  function envDockItem(opt){
    var b = h('button', { type:'button', 'class':'ed-i' + (opt.cls ? ' ' + opt.cls : ''), style:'--ec:' + (opt.color || 'var(--red)'), 'aria-label':opt.label + (opt.here ? ' — открыта' : ''), 'aria-current':opt.here ? 'true' : null });
    b.appendChild(h('span', { 'class':'ed-tip', 'aria-hidden':'true', text:opt.label }));
    b.appendChild(h('span', { 'class':'ed-tile art', html:envIconSvg(opt.key, true) }));
    b.appendChild(h('span', { 'class':'ed-dot' + (opt.here ? ' here' : opt.dot ? '' : ' none'), 'aria-hidden':'true' }));
    b.addEventListener('click', function(){
      if(b.classList.contains('jump')) return;
      b.classList.add('jump');
      setTimeout(function(){ opt.act(); }, opt.here ? 0 : 260);       // как на Mac: сначала прыжок, затем открывается
      setTimeout(function(){ b.classList.remove('jump'); }, 820);
    });
    // правый щелчок (или клавиша меню / Shift+F10) — действия над пространствами этой среды
    if(opt.menu) b.addEventListener('contextmenu', function(e){ e.preventDefault(); envDockMenuOpen(b, opt.menu()); });
    b.addEventListener('focus', function(){ b.classList.add('kb'); });
    b.addEventListener('blur', function(){ b.classList.remove('kb'); });
    EDOCK.shelf.appendChild(b);
    EDOCK.items.push({ b:b });
    return b;
  }
  function envDockRender(){
    if(PANE) return;
    envDockBuild();
    var mode = envDockMode();
    document.body.classList.toggle('has-envdock', mode === 'on');
    EDOCK.el.hidden = mode === 'off';
    EDOCK.el.classList.toggle('auto', mode === 'auto');
    EDOCK.shelf.innerHTML = ''; EDOCK.items = [];
    Object.keys(ENVS).forEach(function(k){
      var e = ENVS[k], n = envProjects(k).length, here = ENV.id === k;
      envDockItem({ key:k, label:e.name + (n ? ' · ' + n + ' ' + plural(n, 'пространство', 'пространства', 'пространств') : ''), color:e.color, ic:envIc(k), here:here, dot:n > 0, menu:function(){ return envDockMenu(k); }, act:function(){ if(ENV.id === k){ toast('Вы уже в среде «' + e.name + '»'); return; } goEnv(k); } });
    });
    EDOCK.shelf.appendChild(h('span', { 'class':'ed-sep', 'aria-hidden':'true' }));
    envDockItem({ key:'_all', menu:envDockAllMenu, label:'Все среды', color:'#64748B', cls:'ed-all', ic:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>', act:openEco });
    edFrame();
  }
  /* ---------- меню значка: открыть, создать, очистить, удалить пространства среды ---------- */
  function spWord(n){ return n + ' ' + plural(n, 'пространство', 'пространства', 'пространств'); }
  function envDockUndo(items){
    if(CLR.undo) items.push({ sep:true }, { label:'Вернуть: ' + CLR.undo.label, icon:'undo', act:clrRestore });
    return items;
  }
  function envDockMenu(k){
    var e = ENVS[k], list = envProjects(k), n = list.length, here = ENV.id === k;
    var items = [{ head:e.name + ' · ' + (n ? spWord(n) : 'пространств нет') }];
    if(!here) items.push({ label:n ? 'Открыть среду' : 'Открыть среду (создать пространство)', icon:'folder', act:function(){ goEnv(k); } });
    items.push({ label:'Новое пространство', icon:'plus', act:function(){ newProj(envNewName(k), null, k); toast('Создано пространство «' + curProj().name + '» в среде «' + e.name + '»'); } });
    if(!n) return envDockUndo(items);
    items.push({ label:'Открыть пространство', icon:'file', sub:list.map(function(p){
      var on = p.id === PROJ.cur;
      return { label:p.name + (on ? ' — открыто' : ''), icon:on ? 'check' : 'file', disabled:on, act:function(){ switchProj(p.id); } };
    }) });
    items.push({ sep:true });
    if(n === 1){
      var p = list[0];
      items.push({ label:'Очистить «' + p.name + '»', icon:'trash', act:function(){ clearSpaceById(p.id); } });
      items.push({ label:'Удалить «' + p.name + '»', icon:'trash', danger:true, act:function(){ deleteSpaceById(p.id); } });
    } else {
      items.push({ label:'Очистить пространство', icon:'trash', sub:list.map(function(p){ return { label:p.name, icon:'trash', act:function(){ clearSpaceById(p.id); } }; }) });
      items.push({ label:'Очистить все в среде (' + n + ')', icon:'trash', act:function(){ clearEnvSpaces(k); } });
      items.push({ label:'Удалить пространство', icon:'trash', danger:true, sub:list.map(function(p){ return { label:p.name, icon:'trash', danger:true, act:function(){ deleteSpaceById(p.id); } }; }) });
      items.push({ label:'Удалить все в среде (' + n + ')', icon:'trash', danger:true, act:function(){ deleteEnvSpaces(k); } });
    }
    return envDockUndo(items);
  }
  function envDockAllMenu(){
    var n = PROJ.list.length;
    return envDockUndo([
      { head:'Все среды · ' + spWord(n) },
      { label:'Открыть экран сред', icon:'all', act:openEco },
      { sep:true },
      { label:'Очистить все пространства (' + n + ')', icon:'trash', act:clearAllSpaces },
      { label:'Удалить все пространства (' + n + ')', icon:'trash', danger:true, act:deleteAllSpaces }
    ]);
  }
  // меню встаёт над значком, а не поверх дока
  function envDockMenuOpen(b, items){
    var r = b.getBoundingClientRect();
    b.classList.add('menu');
    openMenuAt(items, r.left + r.width / 2, r.top, b);
    var z = UI.scale / 100, w = ctxEl.offsetWidth * z, hh = ctxEl.offsetHeight * z;
    var x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8), y = Math.max(8, EDOCK.shelf.getBoundingClientRect().top - (ED_MAX - ED_BASE) - hh - 6);   // с запасом на увеличение значков под курсором
    ctxEl.style.left = (x / z) + 'px'; ctxEl.style.top = (y / z) + 'px'; ctxEl.classList.add('up');
    var mo = new MutationObserver(function(){ if(ctxEl.hidden){ b.classList.remove('menu'); ctxEl.classList.remove('up'); mo.disconnect(); } });
    mo.observe(ctxEl, { attributes:true, attributeFilter:['hidden'] });
  }
  function plural(n, a, b, c){ var m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; }
  // увеличение «волной»: размер значка зависит от расстояния до курсора (как в Dock на Mac)
  function edFrame(){
    if(EDOCK.raf) return;
    EDOCK.raf = requestAnimationFrame(function(){
      EDOCK.raf = 0;
      var touch = window.matchMedia && matchMedia('(hover: none)').matches, on = EDOCK.mx != null && !touch && !document.body.classList.contains('noanim');
      // сначала все замеры, потом все изменения — иначе браузер пересчитывает раскладку на каждом значке
      var centers = on ? EDOCK.items.map(function(it){ var r = it.b.getBoundingClientRect(); return r.left + r.width / 2; }) : null;
      EDOCK.items.forEach(function(it, i){
        var size = ED_BASE;
        if(on){ var d = Math.abs(EDOCK.mx - centers[i]); if(d < ED_RANGE){ var t = Math.cos(d / ED_RANGE * Math.PI / 2); size = ED_BASE + (ED_MAX - ED_BASE) * t * t; } }
        var v = size.toFixed(1);
        if(it.sz !== v){ it.sz = v; it.b.style.setProperty('--sz', v + 'px'); }
      });
      EDOCK.el.classList.toggle('hot', EDOCK.mx != null);
    });
  }
  // переключили среду или пространство — точки под значками обновляются
  (function(){
    if(PANE) return;
    var _sp = showProjName;
    showProjName = function(){ var r = _sp.apply(this, arguments); try { envDockRender(); } catch(e){} return r; };
  })();
  // в редакторе кода и в открытом файле Офиса док не закрывает консоль и текст — он виден на досках и рабочих столах
  function envDockScene(){
    var off = S.view === 'editor' || (typeof OF === 'object' && OF && isOffice() && ['desk', 'map', 'auto'].indexOf(OF.tab) < 0);
    document.body.classList.toggle('ed-away', !!off);
  }
  (function(){
    if(PANE) return;
    var _r = render; render = function(){ var x = _r.apply(this, arguments); envDockScene(); return x; };
    if(typeof ofRender === 'function'){ var _o = ofRender; ofRender = function(){ var x = _o.apply(this, arguments); envDockScene(); return x; }; }
  })();
  if(!PANE) setTimeout(envDockRender, 0);
