  /* ---------- персонализация: тема, акцент, сетка, панель инструментов ---------- */
  var THEMES = {
    burgundy:{ name:'Бордовая', bg:'#12090B', panel:'#1A0D11', line:'#3A1820', line2:'#4A222B', ink:'#F3E6E8', strong:'#FBF1F2', muted:'#C29CA4', dim:'#9C7A82', dot:'#3D1C24', tip:'#2A1218', accent:'#DC2626' },
    graphite:{ name:'Графит', bg:'#0E0F12', panel:'#17191E', line:'#2A2E36', line2:'#3A3F4A', ink:'#E7E9EE', strong:'#F5F6F8', muted:'#A3A9B5', dim:'#868D99', dot:'#2A2E36', tip:'#22252C', accent:'#F97316' },
    midnight:{ name:'Полночь', bg:'#0A0F1C', panel:'#111827', line:'#1F2A44', line2:'#2B3A5C', ink:'#E2E8F0', strong:'#F8FAFC', muted:'#94A3B8', dim:'#7D8BA0', dot:'#1E293B', tip:'#1A2335', accent:'#3B82F6' },
    emerald:{ name:'Изумруд', bg:'#07110E', panel:'#0E1A16', line:'#1A2E27', line2:'#24423A', ink:'#E3F1EC', strong:'#F2FBF7', muted:'#9DBDB2', dim:'#7EA195', dot:'#173029', tip:'#14241F', accent:'#10B981' },
    light:{ name:'Светлая', bg:'#F6F2F3', panel:'#FFFFFF', line:'#EADFE2', line2:'#D9C9CE', ink:'#3A2A2F', strong:'#1A0D11', muted:'#6E5A60', dim:'#7A666C', dot:'#DCCDD2', tip:'#FFFFFF', accent:'#B91C1C', light:true }
  };
  var ACCENTS = ['#DC2626', '#F97316', '#EAB308', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
  var TOOL_OPTS = [
    { id:'lib', btn:'bLib', name:'Библиотека плагинов', core:true },
    { id:'scheme', btn:'bScheme', name:'Целостный код схемы', core:true },
    { id:'create', btn:'bCreate', name:'Создать плагин', core:true },
    { id:'select', btn:null, sel:'[data-tool=select]', name:'Выбор и перемещение', core:true },
    { id:'add', btn:'bAdd', name:'Добавление элементов', core:true },
    { id:'build', btn:'bBuild', name:'Конструктор', core:true },
    { id:'text', btn:null, sel:'[data-tool=text]', name:'Текст', core:true },
    { id:'textsize', btn:'bTextSize', name:'Размер текста', core:true },
    { id:'run', btn:'bRun', name:'Компиляция доски' },
    { id:'undo', btn:'bUndo', name:'Отменить' },
    { id:'redo', btn:'bRedo', name:'Повторить' },
    { id:'all', btn:'bAll', name:'Выделить всё' },
    { id:'fit', btn:'bFit', name:'Вписать всё в экран' },
    { id:'grid', btn:'bGrid', name:'Сетка доски' },
    { id:'pers', btn:'bPers', name:'Персонализация' },
    { id:'keys', btn:'bKeys', name:'Горячие клавиши', core:true },
    { id:'admin', btn:'admBtn', name:'Панель администратора (в шапке)', core:true, admin:true }
  ];
  // контраст по WCAG: подбираем читаемый цвет текста для любого акцента и темы
  function lum(hex){ return hexRgb(hex).map(function(v){ v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function(s, v, i){ return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0); }
  function contrast(a, b){ var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function bestText(bg, light, dark){ light = light || '#FFFFFF'; dark = dark || '#14090C'; return contrast(light, bg) >= contrast(dark, bg) ? light : dark; }
  function readable(color, bg, min){
    if(contrast(color, bg) >= min) return color;
    var toward = lum(bg) < 0.4 ? '#FFFFFF' : '#000000', c = color;
    for(var i = 1; i <= 10 && contrast(c, bg) < min; i++) c = mixHex(color, toward, i / 10);
    return c;
  }
  function hexRgb(x){ x = x.replace('#', ''); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; }
  function mixHex(a, b, t){ var A = hexRgb(a), B = hexRgb(b); return '#' + A.map(function(v, i){ return Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, '0'); }).join(''); }
  var ENV_THEME_DEF = { code:'burgundy', docs:'emerald', wh:'graphite', mes:'graphite', fin:'midnight', hr:'midnight', crm:'burgundy', bi:'midnight', photo:'graphite', vector:'midnight' };
  // акцент среды по умолчанию: на темах, чей собственный акцент спорит с цветом среды
  function envAccent(th, theme){
    if(typeof ENV === 'undefined' || !ENV || ENV.id === 'code') return th.accent;
    theme = theme || 'burgundy';
    if(ENV.id === 'docs') return theme === 'light' || theme === 'burgundy' ? (th.light ? '#15803D' : '#16A34A') : th.accent;
    return readable(ENV.color, th.bg, 3);
  }
  function applyTheme(){
    // у каждой среды своя палитра: запоминаем выбор для текущей среды
    if(typeof ENV !== 'undefined' && ENV){ UI.envs = UI.envs || {}; UI.envs[ENV.id] = { theme:UI.theme || ENV_THEME_DEF[ENV.id] || 'burgundy', accent:UI.accent || null }; }
    var th = themeOf(UI.theme), root = document.documentElement.style;
    // у «Офиса» свой зелёный цвет: на темах с красным акцентом он сохраняется, пока пользователь не выберет другой акцент
    var ac = UI.accent || envAccent(th, UI.theme);
    root.setProperty('--bg', th.bg); root.setProperty('--panel', th.panel); root.setProperty('--line', th.line); root.setProperty('--line2', th.line2);
    root.setProperty('--ink', th.ink); root.setProperty('--ink-strong', th.strong); root.setProperty('--muted', th.muted); root.setProperty('--dim', th.dim);
    root.setProperty('--dot', th.dot); root.setProperty('--tipbg', th.tip);
    var P;
    if(UI.theme === 'burgundy' && ac.toUpperCase() === '#DC2626' && !themeEdited('burgundy') && !TH_ED){
      // исходная палитра — ровно как была
      P = { red:'#DC2626', btn:'#B91C1C', btnH:'#991B1B', soft:'#F87171', wine:'#5C0F1E', wine2:'#3A0F18', onWine:'#fff', onAcc:'#fff' };
    } else {
      var btn = mixHex(ac, '#000000', 0.18);
      var wine = mixHex(ac, th.bg, th.light ? 0.78 : 0.62), wine2 = mixHex(ac, th.bg, th.light ? 0.88 : 0.8);
      P = { red:ac, btn:btn, btnH:mixHex(btn, '#000000', 0.15),
        soft:readable(th.light ? mixHex(ac, '#000000', 0.1) : mixHex(ac, '#FFFFFF', 0.35), th.panel, 4.5),
        wine:wine, wine2:wine2, onWine:bestText(wine, '#FFFFFF', th.strong), onAcc:bestText(btn) };
    }
    root.setProperty('--red', P.red); root.setProperty('--red-btn', P.btn); root.setProperty('--red-btn-h', P.btnH); root.setProperty('--red-soft', P.soft);
    // вспомогательный текст читается и на выделенных строках (фон --wine2) — для любой темы, своей тоже
    root.setProperty('--muted', readable(readable(th.muted, P.wine2, 4.6), th.bg, 4.6)); root.setProperty('--dim', readable(th.dim, th.bg, 4.6));
    root.setProperty('--wine', P.wine); root.setProperty('--wine2', P.wine2); root.setProperty('--on-wine', P.onWine); root.setProperty('--on-accent', P.onAcc);
    root.setProperty('--danger', th.light ? '#B91C1C' : '#FCA5A5');
    // цвета знака Triosteum: на светлой теме — более тёмная версия
    root.setProperty('--lg1', th.light ? '#B01C33' : '#D7263D'); root.setProperty('--lg2', th.light ? '#D7263D' : '#E8566A'); root.setProperty('--lg3', th.light ? '#E8566A' : '#F39AA8');
    root.setProperty('--okc', th.light ? '#15803D' : '#86EFAC'); root.setProperty('--warnc', th.light ? '#A16207' : '#FCD34D');
    document.body.classList.toggle('noanim', UI.anim === false); document.body.classList.toggle('noglow', UI.glow === false);
    root.setProperty('--edge-w', (UI.edgeW || 2.5) + 'px');
    document.body.style.background = th.bg;
    el.canvas.classList.toggle('grid-lines', UI.grid === 'lines'); el.canvas.classList.toggle('grid-none', UI.grid === 'none');
    var tools = UI.tools || {};
    TOOL_OPTS.forEach(function(t){
      var b = t.btn ? $(t.btn) : document.querySelector(t.sel); if(!b) return;
      var on = tools[t.id] === undefined ? !!t.core : !!tools[t.id];
      if(t.admin && !(SERVER && SERVER.admin)) on = false;                 // кнопка панели — только у администратора сервера
      b.hidden = !on;
    });
    save('triosteum.ui', UI);
    if(typeof dockRefresh === 'function') dockRefresh();
  }
  var persWin = null;
  function openPers(){
    renderPers(); $('pers').hidden = false; closeCtx();
    if(!persWin){ persWin = makeWindow($('pers'), '.pers-h', 'pers', 'fixed'); }
    persWin.apply();
    $('persClose').focus();
  }
  $('persClose').addEventListener('click', function(){ $('pers').hidden = true; });
  $('pers').addEventListener('keydown', function(e){ if(e.key === 'Escape') $('pers').hidden = true; });
  function renderPers(){
    var b = $('persBody'); b.innerHTML = '';
    var tg = h('div', { 'class':'themes', role:'radiogroup', 'aria-label':'Тема' });
    themeKeys().forEach(function(k){
      var th = themeOf(k), on = (UI.theme || 'burgundy') === k;
      var pv = h('span', { 'class':'pv', style:'background:' + th.bg + ';border:1px solid ' + th.line2 });
      [th.panel, th.line2, th.accent, th.muted].forEach(function(c, i){ pv.appendChild(h('i', { style:'height:' + (14 + i * 6) + 'px;background:' + c })); });
      var tile = h('div', { 'class':'theme-w' }, [
        h('button', { type:'button', 'class':'theme' + (on ? ' on' : ''), role:'radio', 'aria-checked':on ? 'true' : 'false',
          on:{ click:function(){ if(TH_ED) themeCancel(true); UI.theme = k; UI.accent = null; applyTheme(); renderPers(); } } }, [ pv, h('span', { text:th.name + (themeEdited(k) ? ' ✎' : '') }) ]),
        h('button', { type:'button', 'class':'theme-ed', 'aria-label':'Изменить тему «' + th.name + '»', title:'Изменить тему', html:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>', on:{ click:function(){ themeOpen(k); } } })
      ]);
      tg.appendChild(tile);
    });
    tg.appendChild(h('button', { type:'button', 'class':'theme theme-new', on:{ click:function(){ themeOpen(UI.theme || 'burgundy', { asNew:true, name:'Своя тема' }); } } }, [ h('span', { 'class':'pv' , html:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' }), h('span', { text:'Создать тему' }) ]));
    b.appendChild(section('Тема оформления — для среды «' + ENV.name + '» (у каждой среды своя). Карандаш — изменить тему', tg));
    var th = themeOf(UI.theme || 'burgundy');
    var defAc = envAccent(th, UI.theme);
    b.appendChild(section('Акцентный цвет (кнопки, выделение, активные инструменты)', colorRow(ACCENTS, UI.accent || null, function(c, live){ UI.accent = c; applyTheme(); if(!live) renderPers(); }, 'Акцент', isDocs() ? 'Цвет среды' : 'Цвет темы', defAc)));
    var gseg = h('div', { 'class':'seg' });
    [['dots','Точки'],['lines','Линии'],['none','Без сетки']].forEach(function(o){
      var on = (UI.grid || 'dots') === o[0];
      gseg.appendChild(h('button', { type:'button', 'class':'btn sm' + (on ? ' on' : ''), 'aria-pressed':on ? 'true' : 'false', text:o[1], on:{ click:function(){ UI.grid = o[0]; applyTheme(); renderPers(); } } }));
    });
    b.appendChild(section('Фон доски', gseg));
    b.appendChild(section('Доска', h('div', { 'class':'toolgrid' }, [
      toggleRow('Мини-карта в углу доски', UI.mini !== false, function(v){ UI.mini = v; save('triosteum.ui', UI); miniDraw(); }),
      toggleRow('Привязка к сетке при перемещении', !!UI.snap, function(v){ UI.snap = v; save('triosteum.ui', UI); })
    ])));
    b.appendChild(section('Анимации и эффекты', h('div', { 'class':'toolgrid' }, [
      toggleRow('Анимации окон, меню и панелей', UI.anim !== false, function(v){ UI.anim = v; applyTheme(); }),
      toggleRow('Свечение вокруг курсора', UI.glow !== false, function(v){ UI.glow = v; applyTheme(); })
    ])));
    var eseg = h('div', { 'class':'seg' });
    [[1.5,'Тонкие'],[2.5,'Обычные'],[3.5,'Толстые']].forEach(function(o){
      var on = (UI.edgeW || 2.5) === o[0];
      eseg.appendChild(h('button', { type:'button', 'class':'btn sm' + (on ? ' on' : ''), 'aria-pressed':on ? 'true' : 'false', text:o[1], on:{ click:function(){ UI.edgeW = o[0]; applyTheme(); renderPers(); } } }));
    });
    b.appendChild(section('Линии связей', eseg));
    var dseg = h('div', { 'class':'seg' });
    [['mini', 'Сворачивать в полоску'], ['on', 'Всегда показывать'], ['auto', 'Прятать, пока не нужен'], ['off', 'Выключить']].forEach(function(o){
      var on = (UI.envDock || 'mini') === o[0];
      dseg.appendChild(h('button', { type:'button', 'class':'btn sm' + (on ? ' on' : ''), 'aria-pressed':on ? 'true' : 'false', text:o[1], on:{ click:function(){ UI.envDock = o[0]; save('triosteum.ui', UI); if(typeof envDockRender === 'function') envDockRender(); renderPers(); } } }));
    });
    b.appendChild(section('Док сред внизу — значки сред, как на Mac. «Сворачивать»: через 3 секунды без наведения превращается в полоску, наведите — развернётся. «Прятать»: выезжает у нижнего края', dseg));
    var tgrid = h('div', { 'class':'toolgrid docks-grid' });
    TOOL_OPTS.forEach(function(t){
      if(t.admin && !(SERVER && SERVER.admin)) return;
      var tools = UI.tools || {}, on = tools[t.id] === undefined ? !!t.core : !!tools[t.id];
      var btn = t.btn ? $(t.btn) : document.querySelector(t.sel), key = btn && btn._dk;
      var row = toggleRow(t.name, on, function(v){ UI.tools = UI.tools || {}; UI.tools[t.id] = v; applyTheme(); renderPers(); });
      var tk = btn && typeof toolKeyFor === 'function' ? toolKeyFor(t.btn ? '#' + t.btn : t.sel) : null;
      if(tk && !tk.shown) row.firstChild.appendChild(keyCatcher(tk, t.name));
      else if(btn && btn.dataset.key) row.firstChild.appendChild(h('kbd', { 'class':'tgl-key', text:btn.dataset.key, title:'Стандартное сочетание' }));
      if(key){
        var sel = h('select', { 'class':'dock-sel', 'aria-label':'Где кнопка «' + t.name + '»', on:{ change:function(){ dockSet(key, sel.value); } } });
        Object.keys(DOCK_SIDES).forEach(function(s){ var o = h('option', { value:s, text:DOCK_SIDES[s] }); if(dockSideOf(btn) === s) o.selected = true; sel.appendChild(o); });
        if(!on) sel.disabled = true;
        var mv = h('span', { 'class':'dock-mv' }, [
          h('button', { type:'button', 'class':'icon-btn', 'aria-label':'«' + t.name + '» — на место раньше', title:'Раньше в панели', disabled:on ? null : 'disabled', html:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>', on:{ click:function(){ dockShift(key, -1); renderPers(); } } }),
          h('button', { type:'button', 'class':'icon-btn', 'aria-label':'«' + t.name + '» — на место позже', title:'Позже в панели', disabled:on ? null : 'disabled', html:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>', on:{ click:function(){ dockShift(key, 1); renderPers(); } } })
        ]);
        row.insertBefore(sel, row.lastChild); row.insertBefore(mv, row.lastChild);
      }
      tgrid.appendChild(row);
    });
    var keysReset = h('button', { type:'button', 'class':'btn sm', style:'margin-top:8px;margin-left:6px', text:'Вернуть клавиши по умолчанию', on:{ click:function(){ toolKeysReset(); renderPers(); toast('Горячие клавиши — как по умолчанию'); } } });
    b.appendChild(section('Кнопки панелей инструментов — включите, выберите край и место стрелками (или просто перетащите кнопку к любому краю). Нажмите на клавишу рядом с названием, чтобы задать свою', h('div', null, [ tgrid,
      h('button', { type:'button', 'class':'btn sm', style:'margin-top:8px', text:'Вернуть все кнопки на панель слева', on:{ click:function(){ dockReset(); renderPers(); } } }), keysReset ])));
    var txt = h('div', null, [
      fsRow('Окна и меню', fsControl(UI.scale, 80, 160, function(v){ UI.scale = v; applyUI(); }, 'масштаб окон', '%')),
      fsRow('Редактор кода', fsControl(UI.code, 10, 28, function(v){ UI.code = v; applyUI(); updateGutter(); }, 'шрифт кода')),
      fsRow('Новые заметки', fsControl(UI.note, 8, 72, function(v){ UI.note = v; applyUI(); }, 'шрифт новых заметок'))
    ]);
    b.appendChild(section('Размер текста', txt));
    b.appendChild(section('Секреты для блоков', secretsBox()));
    // очистка: те же действия, что в меню «Пространство → Очистка»
    var clr = h('div', { 'class':'clr-grid' });
    clearItems().forEach(function(it){ if(it.sep) return; clr.appendChild(h('button', { type:'button', 'class':'btn sm' + (it.danger ? ' danger' : ''), text:it.label, on:{ click:function(){ it.act(); setTimeout(function(){ if(!$('pers').hidden) renderPers(); }, 400); } } })); });
    b.appendChild(section('Резервные копии — раз в день и перед каждой очисткой; ключи и пароли в копии не попадают', backupsSection()));
    b.appendChild(section('Очистка', clr));
    b.appendChild(h('button', { type:'button', 'class':'btn', text:'Вернуть всё по умолчанию', on:{ click:function(){
      UI = { scale:100, code:14, note:14 }; applyUI(); applyTheme(); updateGutter(); renderPers(); } } }));
  }
  // секреты: ключи API и пароли для блоков C# (Secrets.Get("ИМЯ")) и 1С (ПолучитьСекрет("ИМЯ"))
  function secretsBox(){
    var box = h('div', { 'class':'sec-box' }), all = secretAll(), names = Object.keys(all).sort();
    box.appendChild(h('p', { 'class':'sec-note', text:'Значения хранятся только в этом браузере и не попадают в код, файл пространства и ссылки «Поделиться». Без галочки «запомнить» секрет забудется при закрытии вкладки.' }));
    names.forEach(function(k){
      box.appendChild(h('div', { 'class':'sec-row' }, [ h('code', { text:k }), h('span', { 'class':'sec-v', text:'••••••' + (all[k].kept ? ' · запомнен' : ' · до закрытия вкладки') }),
        h('button', { type:'button', 'class':'btn sm', text:'Удалить', 'aria-label':'Удалить секрет ' + k, on:{ click:function(){ secretSet(k, null, false); renderPers(); } } }) ]));
    });
    var nm = h('input', { type:'text', placeholder:'ИМЯ, например TELEGRAM_TOKEN', 'aria-label':'Имя секрета', spellcheck:'false' }), vl = h('input', { type:'password', placeholder:'значение', 'aria-label':'Значение секрета', autocomplete:'off' }), kp = h('input', { type:'checkbox' });
    box.appendChild(h('div', { 'class':'sec-add' }, [ nm, vl,
      h('label', { 'class':'sec-keep' }, [ kp, document.createTextNode('запомнить') ]),
      h('button', { type:'button', 'class':'btn sm primary', text:'Добавить', on:{ click:function(){ var n = nm.value.trim(); if(!n || !vl.value){ toast('Укажите имя и значение секрета'); return; } secretSet(n, vl.value, kp.checked); toast('Секрет «' + n + '» сохранён'); renderPers(); } } }) ]));
    return box;
  }
  // кнопки дополнительных инструментов
  $('bRun').addEventListener('click', function(){ runBoard(); });
  $('bUndo').addEventListener('click', function(){ undo(); });
  $('bRedo').addEventListener('click', function(){ redo(); });
  $('bAll').addEventListener('click', function(){ if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); } selectAll(); });
  $('bFit').addEventListener('click', function(){ if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); } fitView(); });
  $('bGrid').addEventListener('click', function(){ UI.grid = UI.grid === 'lines' ? 'none' : (UI.grid === 'none' ? 'dots' : 'lines'); applyTheme(); toast('Сетка: ' + ({ dots:'точки', lines:'линии', none:'без сетки' })[UI.grid]); });
  $('bPers').addEventListener('click', function(){ $('pers').hidden ? openPers() : ($('pers').hidden = true); });
  // закреплённая шестерёнка в шапке — те же настройки в любой среде и на любой вкладке
  var setWasOpen = false;
  $('setBtn').addEventListener('pointerdown', function(){ setWasOpen = !$('pers').hidden; });
  $('setBtn').addEventListener('click', function(e){ var open = e.detail ? setWasOpen : !$('pers').hidden; if(open) $('pers').hidden = true; else openPers(); $('setBtn').setAttribute('aria-expanded', $('pers').hidden ? 'false' : 'true'); });

  // клавиша кнопки в Персонализации: нажать — затем нажать новую клавишу (Esc — отмена, Backspace — без клавиши)
  function keyCatcher(tk, name, after){
    function re(){ if(after) after(); else renderPers(); }
    var b = h('button', { type:'button', 'class':'tgl-key key-set' + (tk.label ? '' : ' none'), text:tk.label || '—', title:'Горячая клавиша — нажмите, чтобы задать свою', 'aria-label':'Клавиша для «' + name + '»: ' + (tk.label || 'нет') + '. Нажмите, чтобы изменить' });
    b.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      if(b.classList.contains('wait')) return;
      b.classList.add('wait'); b.textContent = 'нажмите клавишу…';
      function done(){ document.removeEventListener('keydown', on, true); document.removeEventListener('pointerdown', off, true); b.classList.remove('wait'); }
      function off(ev){ if(ev.target === b) return; done(); b.textContent = tk.label || '—'; }
      function on(ev){
        if(/^(Shift|Control|Alt|Meta)/.test(ev.code)) return;
        ev.preventDefault(); ev.stopPropagation();
        if(ev.key === 'Escape'){ done(); b.textContent = tk.label || '—'; return; }
        if(ev.code === 'Backspace' || ev.code === 'Delete'){ done(); toolKeySet(tk.sel, null); toast('«' + name + '» — без клавиши'); re(); return; }
        var c = { code:ev.code, shift:ev.shiftKey, mod:ev.ctrlKey || ev.metaKey };
        if(ev.altKey){ toast('Alt не используется — браузер занимает его сочетания'); return; }
        var bad = keyFree(c); if(bad){ toast(bad); return; }
        done();
        var taken = toolKeySet(tk.sel, c);
        toast('«' + name + '» — ' + keyLabel(c) + (taken ? '. У «' + taken.name + '» клавиша снята' : ''));
        re();
      }
      document.addEventListener('keydown', on, true); document.addEventListener('pointerdown', off, true);
    });
    return b;
  }
