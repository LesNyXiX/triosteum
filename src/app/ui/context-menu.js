  /* ---------- контекстное меню доски (правая кнопка по пустому месту) ---------- */
  var ctxEl = $('ctx'), ctxPoint = null;
  var IC = {
    plus:'<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M12 9v6M9 12h6"/>',
    hub:'<circle cx="12" cy="12" r="3.5"/><path d="M3 7l5.5 3M3 17l5.5-3M16 12h5"/>',
    text:'<path d="M5 6h14M12 6v13"/>', lib:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><path d="M16.5 13.5v6M13.5 16.5h6"/>',
    paste:'<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2"/>', all:'<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>',
    undo:'<path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2"/>', redo:'<path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h2"/>',
    run:'<path d="M7 5l12 7-12 7z"/>', fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', zoom:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    grid:'<path d="M4 9h16M4 15h16M9 4v16M15 4v16"/>', pers:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    keys:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14h10"/>', copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    align:'<path d="M4 4v16M8 7h10M8 12h6M8 17h12"/>', layout:'<rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="4" width="6" height="5" rx="1"/><rect x="15" y="15" width="6" height="5" rx="1"/><path d="M9 6.5h6M18 9v6"/>',
    file:'<path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8z"/><path d="M14 3v5h5"/>', download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', upload:'<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    folder:'<path d="M3 7a1 1 0 011-1h5l2 2h8a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1z"/>', user:'<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', logout:'<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>', cloud:'<path d="M7 18h10a4 4 0 00.5-8A6 6 0 006 9.5 4.3 4.3 0 007 18z"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>', check:'<path d="M5 12l5 5 9-10"/>',
    map:'<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="11" width="6" height="5" rx="1"/>', magnet:'<path d="M6 4v8a6 6 0 0012 0V4M6 8h4M14 8h4"/>',
    node:'<rect x="4" y="6" width="16" height="12" rx="3"/>', plug:'<path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 01-10 0zM12 17v4"/>'
  };
  function ico(name, sw){ return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[name] || '') + '</svg>'; }
  function ctxItem(o){
    if(o.sep) return h('div', { 'class':'ctx-sep', role:'separator' });
    if(o.head) return h('div', { 'class':'ctx-h', text:o.head });
    var b = h('button', { type:'button', 'class':'ctx-i' + (o.danger ? ' danger' : ''), role:'menuitem', disabled:o.disabled ? 'disabled' : null, 'aria-haspopup':o.sub ? 'menu' : null });
    var ic = h('span', { 'class':'ic' }); if(o.swatch) ic.innerHTML = '<i style="display:block;width:12px;height:12px;border-radius:3px;background:' + o.swatch + '"></i>'; else ic.innerHTML = ico(o.icon);
    b.appendChild(ic); b.appendChild(h('span', { 'class':'lbl', text:o.label }));
    if(o.kb) b.appendChild(h('span', { 'class':'kb', text:o.kb }));
    if(o.sub) b.appendChild(h('span', { 'class':'arr', text:'›' }));
    b.addEventListener('click', function(e){
      e.stopPropagation();
      if(o.sub){ openSub(b, o.sub); return; }
      closeCtx(); o.act();
    });
    if(o.sub) b.addEventListener('mouseenter', function(){ openSub(b, o.sub); });
    else b.addEventListener('mouseenter', function(){ if(b.parentNode === ctxEl) closeSub(); });
    return b;
  }
  var subEl = null;
  function closeSub(){ if(subEl){ animRemove(subEl, 200); subEl = null; } Array.prototype.forEach.call(ctxEl.querySelectorAll('.ctx-i.open'), function(x){ x.classList.remove('open'); }); }
  // Ставит меню рядом с прямоугольником r (пункт родительского меню): справа, если помещается, иначе слева,
  // и всегда целиком в пределах экрана. Положение и размер проверяются по факту на экране на самом месте,
  // поэтому не зависят от масштаба окон, масштаба браузера и того, как браузер считает zoom.
  function placeNear(m, r, again){
    var anim = m.style.animation; if(!again) m.style.animation = 'none';     // анимация появления искажает размеры
    var z = (UI.scale || 100) / 100;
    // поставить левый верхний угол в экранную точку (tx, ty) и проверить по факту, поправив при расхождении
    function moveTo(tx, ty){
      m.style.left = (tx / z) + 'px'; m.style.top = (ty / z) + 'px';
      for(var i = 0; i < 3; i++){
        var b = m.getBoundingClientRect(), dx = tx - b.left, dy = ty - b.top;
        if(Math.abs(dx) < 1 && Math.abs(dy) < 1) return b;
        var k = (b.width / (m.offsetWidth || b.width)) || 1;
        m.style.left = (parseFloat(m.style.left) + dx / k) + 'px'; m.style.top = (parseFloat(m.style.top) + dy / k) + 'px';
      }
      return m.getBoundingClientRect();
    }
    var vw = window.innerWidth, vh = window.innerHeight, y = r.top - 6;
    var b = moveTo(r.right + 4, y);                       // справа от пункта — размеры меряем уже на месте
    if(b.right > vw - 8){                                 // справа не помещается — слева, иначе прижать к краю
      var x = r.left - 4 - b.width;
      if(x < 8) x = vw - b.width - 8;
      b = moveTo(Math.max(8, x), y);
    }
    if(b.bottom > vh - 8) b = moveTo(b.left, Math.max(8, vh - b.height - 8));
    if(!again){ void m.offsetWidth; m.style.animation = anim; }        // вернуть анимацию появления
  }
  function openSub(btn, items){
    closeSub(); btn.classList.add('open');
    subEl = h('div', { 'class':'ctx', role:'menu' }); items.forEach(function(o){ subEl.appendChild(ctxItem(o)); });
    document.body.appendChild(subEl);
    placeNear(subEl, btn.getBoundingClientRect());
    // родительское меню могло ещё доигрывать анимацию появления — уточняем место, когда оно встанет
    var m = subEl; setTimeout(function(){ if(subEl === m && btn.isConnected && !ctxEl.hidden) placeNear(m, btn.getBoundingClientRect(), true); }, 420);
    var f = subEl.querySelector('.ctx-i:not([disabled])'); if(f) f.focus();
  }
  function placeAt(kind, lang){
    var p = ctxPoint;
    if(kind === 'hub') addNode(S.lang, 'Узел ' + (G.nodes.filter(function(x){ return x.kind === 'hub'; }).length + 1), p.x - HUB / 2, p.y - HUB / 2, null, 'hub');
    else if(kind === 'block'){ S.lang = lang; save('triosteum.lang.' + ENV.id, lang); addNode(lang, newBlockName(lang), p.x - NW / 2, p.y - NH / 2); }
    else if(kind === 'text'){
      var note = { id:'t' + (G.seq++), text:'', x:Math.round(p.x), y:Math.round(p.y - 12), fs:UI.note, tint:'grey' };
      G.notes.push(note); S.sel = { type:'note', id:note.id }; S.multi = []; renderGraph(); updateSel(); editNote(note.id); return;
    }
    render();
  }
  function openCtx(cx, cy){
    closeAddMenu(); closeTextMenu(); closeCtx();
    ctxPoint = toWorld(cx, cy);
    var hasSel = !!(S.sel || (S.multi && S.multi.length));
    var addItems = [{ head:isDocs() ? 'Блок маршрута' : 'Блок с кодом' }].concat(LANGS.map(function(l){ return { label:'Блок · ' + (isDocs() ? l.name : shortName(l)), swatch:grad(COLORS[l.id]), act:function(){ placeAt('block', l.id); } }; }))
      .concat([{ sep:true }, { label:'Связующая точка', icon:'hub', act:function(){ placeAt('hub'); } },
        { label:'Текстовая заметка', icon:'text', act:function(){ placeAt('text'); } },
        { label:isDocs() ? 'Шаблон из библиотеки…' : 'Плагин из библиотеки…', icon:'lib', act:function(){ S.placeAt = ctxPoint; S.lib = true; render(); el.search.focus(); } }]);
    var items = [
      { label:'Добавить элемент', icon:'plus', sub:addItems },
      { sep:true },
      { label:'Вставить', icon:'paste', kb:MOD + 'V', disabled:!clip, act:function(){ pasteClip(); } },
      { label:'Выделить всё', icon:'all', kb:MOD + 'A', act:selectAll },
      { label:'Отменить', icon:'undo', kb:MOD + 'Z', disabled:!hist.undo.length && !saveGraphTimer, act:undo },
      { label:'Повторить', icon:'redo', kb:IS_MAC ? '⌘⇧Z' : 'Ctrl+Y', disabled:!hist.redo.length, act:redo },
      hasSel ? { label:'Дублировать', icon:'copy', kb:MOD + 'D', act:dupSel } : null,
      hasSel ? { label:'Удалить выделенное', icon:'trash', kb:'Del', act:deleteSel } : null,
      selObjs().length >= 2 ? { label:'Выровнять и распределить', icon:'align', sub:alignItems() } : null,
      { label:'Конструктор схемы…', icon:'layout', act:openBuilder },
      { sep:true },
      { label:'Поиск и команды', icon:'zoom', kb:MOD + 'K', act:openCmd },
      { label:ENV.word.run, icon:'run', kb:MOD + 'R', act:runBoard },
      { label:'Вписать всё в экран', icon:'fit', disabled:!G.nodes.length && !G.notes.length, act:fitView },
      { label:'Масштаб 100%', icon:'zoom', act:function(){ zoomAt(1); } },
      { label:'Сетка доски', icon:'grid', sub:[['dots','Точки'],['lines','Линии'],['none','Без сетки']].map(function(g){
          return { label:g[1] + (UI.grid === g[0] ? '  ✓' : ''), icon:'grid', act:function(){ UI.grid = g[0]; applyTheme(); } }; }) },
      { sep:true },
      { label:'Экосистема — все среды…', icon:'all', act:openEco },
      { label:'Персонализация…', icon:'pers', act:openPers },
      { label:'Горячие клавиши', icon:'keys', act:function(){ showTip($('bKeys'), 6000); } },
      { label:'Пространство', icon:'file', sub:shareItems() },
      { label:'Очистить доску', icon:'trash', danger:true, disabled:!G.nodes.length && !G.notes.length, act:clearBoard }
    ].filter(Boolean);
    ctxEl.innerHTML = ''; items.forEach(function(o){ ctxEl.appendChild(ctxItem(o)); });
    ctxEl.hidden = false;
    var z = UI.scale / 100, w = ctxEl.offsetWidth * z, hh = ctxEl.offsetHeight * z;
    var x = Math.min(cx, window.innerWidth - w - 8), y = Math.min(cy, window.innerHeight - hh - 8);
    ctxEl.style.left = (Math.max(8, x) / z) + 'px'; ctxEl.style.top = (Math.max(8, y) / z) + 'px';
    var f = ctxEl.querySelector('.ctx-i'); if(f) f.focus();
  }
  function closeCtx(){ closeSub(); ctxEl.hidden = true; }
  document.addEventListener('pointerdown', function(e){ if(!ctxEl.hidden && !ctxEl.contains(e.target) && !(subEl && subEl.contains(e.target))) closeCtx(); }, true);
  document.addEventListener('keydown', function(e){
    if(ctxEl.hidden) return;
    var menu = subEl && subEl.contains(document.activeElement) ? subEl : ctxEl;
    var items = Array.prototype.slice.call(menu.querySelectorAll('.ctx-i:not([disabled])')), i = items.indexOf(document.activeElement);
    if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); if(menu === subEl){ var op = ctxEl.querySelector('.ctx-i.open'); closeSub(); if(op) op.focus(); } else closeCtx(); }
    else if(e.key === 'ArrowDown'){ e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if(e.key === 'ArrowRight' && document.activeElement && document.activeElement.getAttribute('aria-haspopup')){ e.preventDefault(); document.activeElement.click(); }
    else if(e.key === 'ArrowLeft' && menu === subEl){ e.preventDefault(); var op2 = ctxEl.querySelector('.ctx-i.open'); closeSub(); if(op2) op2.focus(); }
  }, true);
  el.canvas.addEventListener('wheel', function(){ if(!ctxEl.hidden) closeCtx(); }, { passive:true });

  function fitView(){
    var xs = [], ys = [];
    G.nodes.forEach(function(n){ xs.push(n.x - 40, n.x + NWof(n) + 40); ys.push(n.y - 20, n.y + NHof(n) + 30); });
    G.notes.forEach(function(t){ if(t.hidden) return; var d = domOf('note', t.id); xs.push(t.x, t.x + (d ? d.offsetWidth : 160)); ys.push(t.y, t.y + (d ? d.offsetHeight : 40)); });
    if(!xs.length) return;
    var r = el.canvas.getBoundingClientRect(), minX = Math.min.apply(0, xs), maxX = Math.max.apply(0, xs), minY = Math.min.apply(0, ys), maxY = Math.max.apply(0, ys);
    var k = Math.max(0.25, Math.min(1.5, Math.min((r.width - 80) / (maxX - minX), (r.height - 80) / (maxY - minY))));
    G.cam.k = k; G.cam.x = r.width / 2 - (minX + maxX) / 2 * k; G.cam.y = r.height / 2 - (minY + maxY) / 2 * k;
    applyCam(); saveGraph(); hidePop();
  }
  function copyScheme(){
    var txt = JSON.stringify({ app:'Triosteum', nodes:G.nodes, edges:G.edges, notes:G.notes }, null, 2);
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ toast('Схема скопирована в буфер обмена'); }, function(){ toast('Браузер не разрешил копирование'); });
    else toast('Браузер не разрешил копирование');
  }
  function clearBoard(){
    G.nodes = []; G.edges = []; G.notes = []; S.sel = null; S.multi = [];
    hidePop(); saveGraph(); renderGraph();
    toast('Доска очищена — ' + MOD + 'Z, чтобы вернуть');
  }
