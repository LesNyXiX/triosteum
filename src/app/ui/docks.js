  /* =====================================================================
     ПАНЕЛИ ИНСТРУМЕНТОВ У ЛЮБОГО КРАЯ: любую кнопку панели слева можно
     перетащить мышью (или пальцем) к верхнему, нижнему или правому краю —
     там появляется своя панель. Место запоминается. То же самое — в
     Персонализации: у каждой кнопки выбор «слева / сверху / снизу / справа».
     ===================================================================== */
  var DOCK_SIDES = { left:'Слева', top:'Сверху', bottom:'Снизу', right:'Справа' };
  var dockRow = document.querySelector('.row'), dockNav = document.querySelector('nav.tools');
  dockNav.classList.add('dock'); dockNav.dataset.side = 'left';
  var DOCKS = { left:dockNav }, DOCK_BTN = {}, DOCK_ORIG = Array.prototype.slice.call(dockNav.children);
  ['top', 'bottom', 'right'].forEach(function(s){
    var d = document.createElement('nav'); d.className = 'tools dock dock-' + s; d.dataset.side = s; d.hidden = true;
    d.setAttribute('aria-label', 'Инструменты — ' + DOCK_SIDES[s].toLowerCase());
    dockRow.appendChild(d); DOCKS[s] = d;
  });
  DOCK_ORIG.forEach(function(c){ if(!c.classList.contains('tool')) return; var k = c.id || ('tool-' + (c.dataset.tool || '')); c._dk = k; DOCK_BTN[k] = c; });
  function dockKeyOf(btn){ return btn && btn._dk; }
  function dockSideOf(btn){ var d = btn && btn.closest && btn.closest('.dock'); return d ? d.dataset.side : 'left'; }
  function dockRefresh(){
    var map = UI.dock || {}, ord = UI.dockOrder || {};
    // левая панель: свой порядок кнопок; разделители остаются на своих местах
    var leftKeys = DOCK_ORIG.filter(function(c){ return c._dk && !(map[c._dk] && map[c._dk] !== 'left'); }).map(function(c){ return c._dk; });
    if(ord.left && ord.left.length){ var want = ord.left.filter(function(k){ return leftKeys.indexOf(k) >= 0; }); leftKeys = want.concat(leftKeys.filter(function(k){ return want.indexOf(k) < 0; })); }
    var qi = 0;
    DOCK_ORIG.forEach(function(c){
      if(!c._dk){ dockNav.appendChild(c); return; }
      if(map[c._dk] && map[c._dk] !== 'left' && !(ord.left && ord.left.length)) return;
      if(!ord.left || !ord.left.length){ dockNav.appendChild(c); return; }
      if(qi < leftKeys.length) dockNav.appendChild(DOCK_BTN[leftKeys[qi++]]);
    });
    while(qi < leftKeys.length) dockNav.appendChild(DOCK_BTN[leftKeys[qi++]]);
    ['top', 'bottom', 'right'].forEach(function(s){
      var d = DOCKS[s], keys = (ord[s] || []).filter(function(k){ return map[k] === s; });
      Object.keys(map).forEach(function(k){ if(map[k] === s && keys.indexOf(k) < 0) keys.push(k); });
      keys.forEach(function(k){ if(DOCK_BTN[k]) d.appendChild(DOCK_BTN[k]); });
    });
    // пустая панель не показывается (кнопки могут быть выключены или скрыты в этой среде)
    Object.keys(DOCKS).forEach(function(s){
      var d = DOCKS[s]; d.hidden = false; d.classList.remove('empty');
      var any = Array.prototype.some.call(d.children, function(c){ return c.classList.contains('tool') && !c.hidden && getComputedStyle(c).display !== 'none'; });   // без замера размеров: не заставляем браузер пересчитывать раскладку
      if(s === 'left') d.classList.toggle('empty', !any && !document.body.classList.contains('docking')); else d.hidden = !any && !document.body.classList.contains('docking');
    });
  }
  // кнопку key — на край side, перед кнопкой before (или в конец); порядок каждой панели запоминается
  function dockSet(key, side, index, before){
    UI.dock = UI.dock || {}; UI.dockOrder = UI.dockOrder || {};
    var btn = DOCK_BTN[key]; if(!btn) return;
    if(side === 'left') delete UI.dock[key]; else UI.dock[key] = side;
    if(before === undefined){
      var kids = Array.prototype.filter.call(DOCKS[side].children, function(c){ return c._dk && c._dk !== key; });
      before = index !== undefined && index >= 0 && index < kids.length ? kids[index] : null;
    }
    if(before && before.parentNode === DOCKS[side]) DOCKS[side].insertBefore(btn, before);
    else if(side === 'left' && !before){ var keys = $('bKeys'); if(keys && keys.parentNode === dockNav && keys !== btn && UI.dock.bKeys === undefined) dockNav.insertBefore(btn, keys); else dockNav.appendChild(btn); }
    else DOCKS[side].appendChild(btn);
    Object.keys(DOCKS).forEach(function(s){ UI.dockOrder[s] = Array.prototype.filter.call(DOCKS[s].children, function(c){ return c._dk && (s === 'left' ? !UI.dock[c._dk] : UI.dock[c._dk] === s); }).map(function(c){ return c._dk; }); });
    save('triosteum.ui', UI); dockRefresh();
  }
  // клавиатура и меню: сдвинуть кнопку на одно место
  function dockShift(key, delta){
    var btn = DOCK_BTN[key]; if(!btn) return;
    var side = dockSideOf(btn), kids = Array.prototype.filter.call(DOCKS[side].children, function(c){ return c._dk && !c.hidden; }), i = kids.indexOf(btn), j = i + delta;
    if(i < 0 || j < 0 || j >= kids.length) return;
    dockSet(key, side, undefined, delta < 0 ? kids[j] : (kids[j + 1] || null));
  }
  function dockReset(){ UI.dock = {}; UI.dockOrder = {}; save('triosteum.ui', UI); dockRefresh(); }
  new MutationObserver(function(){ dockRefresh(); }).observe(document.body, { attributes:true, attributeFilter:['data-mode'] });
  var dockRsz = 0;
  window.addEventListener('resize', function(){ if(!dockRsz) dockRsz = requestAnimationFrame(function(){ dockRsz = 0; dockRefresh(); }); });

  /* ---------- перетаскивание кнопок между краями ---------- */
  var DG = null, dockNoClick = 0, dockNoClickEl = null, dockZones = null;
  function dockZonesShow(on){
    if(on && !dockZones){
      dockZones = {};
      Object.keys(DOCK_SIDES).forEach(function(s){ var z = document.createElement('div'); z.className = 'dock-zone dz-' + s; z.innerHTML = '<span>' + DOCK_SIDES[s] + '</span>'; dockRow.appendChild(z); dockZones[s] = z; });
    }
    if(!on && dockZones){ Object.keys(dockZones).forEach(function(s){ dockZones[s].remove(); }); dockZones = null; }
  }
  function dockTarget(x, y){
    var R = dockRow.getBoundingClientRect(), T = 90;
    var dists = { left:x - R.left, right:R.right - x, top:y - R.top, bottom:R.bottom - y };
    var best = null; Object.keys(dists).forEach(function(s){ if(dists[s] >= -40 && dists[s] < T && (!best || dists[s] < dists[best])) best = s; });
    if(!best){ var over = document.elementFromPoint(x, y), d = over && over.closest && over.closest('.dock'); if(d) best = d.dataset.side; }
    if(!best) return null;
    // место среди кнопок панели
    var d2 = DOCKS[best], horiz = best === 'top' || best === 'bottom', idx = 0;
    var kids = Array.prototype.filter.call(d2.children, function(c){ return c.classList.contains('tool') && c._dk && c !== DG.b && c.offsetWidth > 0; });
    kids.forEach(function(c, i){ var r = c.getBoundingClientRect(); if((horiz ? x : y) > (horiz ? r.left + r.width / 2 : r.top + r.height / 2)) idx = i + 1; });
    return { side:best, index:idx, before:kids[idx] || null };
  }
  function dockMark(t){
    var m = document.querySelector('.dock-mark');
    if(!t){ if(m) m.remove(); return; }
    if(!m){ m = document.createElement('i'); m.className = 'dock-mark'; }
    var d = DOCKS[t.side]; if(t.before) d.insertBefore(m, t.before); else d.appendChild(m);
  }
  document.addEventListener('pointerdown', function(e){
    var b = e.target.closest && e.target.closest('.dock > .tool');
    if(!b || e.button !== 0) return;
    DG = { b:b, sx:e.clientX, sy:e.clientY, on:false, id:e.pointerId };
  }, true);
  document.addEventListener('pointermove', function(e){
    if(!DG || e.pointerId !== DG.id) return;
    if(!DG.on){
      if(Math.abs(e.clientX - DG.sx) + Math.abs(e.clientY - DG.sy) < 10) return;
      DG.on = true;
      if(typeof hideTip === 'function') hideTip();
      document.body.classList.add('docking'); dockZonesShow(true); dockRefresh();
      DG.ghost = DG.b.cloneNode(true); DG.ghost.removeAttribute('id'); DG.ghost.className = 'tool tool-ghost'; DG.ghost.setAttribute('aria-hidden', 'true'); document.body.appendChild(DG.ghost);
      DG.b.classList.add('dock-src');
    }
    e.preventDefault();
    DG.ghost.style.left = (e.clientX - 22) + 'px'; DG.ghost.style.top = (e.clientY - 22) + 'px';
    var t = dockTarget(e.clientX, e.clientY); DG.t = t;
    if(dockZones) Object.keys(dockZones).forEach(function(s){ dockZones[s].classList.toggle('hot', !!t && t.side === s); });
    dockMark(t);
  }, true);
  function dockEnd(cancel){
    if(!DG) return;
    var g = DG; DG = null;
    if(!g.on) return;
    dockNoClick = Date.now(); dockNoClickEl = g.b;
    g.ghost.remove(); g.b.classList.remove('dock-src'); dockMark(null);
    document.body.classList.remove('docking'); dockZonesShow(false);
    if(!cancel && g.t){ var k = dockKeyOf(g.b); if(k){ var was = dockSideOf(g.b); dockSet(k, g.t.side, undefined, g.t.before); if(was !== g.t.side) toast('«' + (g.b.getAttribute('aria-label') || 'Кнопка') + '» — панель ' + DOCK_SIDES[g.t.side].toLowerCase()); return; } }
    dockRefresh();
  }
  document.addEventListener('pointerup', function(e){ if(DG && e.pointerId === DG.id) dockEnd(false); }, true);
  document.addEventListener('pointercancel', function(){ dockEnd(true); }, true);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && DG && DG.on){ e.stopPropagation(); dockEnd(true); } }, true);
  // нажатие, которым закончилось перетаскивание, — не нажатие кнопки
  window.addEventListener('click', function(e){ if(Date.now() - dockNoClick < 350 && dockNoClickEl && e.target.closest && e.target.closest('.tool') === dockNoClickEl){ dockNoClickEl = null; e.stopPropagation(); e.preventDefault(); } }, true);
  dockRefresh();
