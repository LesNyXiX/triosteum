  /* ---------- встряхивание: зажать блок и потрясти ----------
     Блок: все его связи переходят на новую связующую точку на его месте —
     ничего не теряется, блок свободен. Точка: все её связи отцепляются. */
  var SHAKE = { flips:4, minRun:14, window:1000 };
  // распознавание встряхивания: несколько резких разворотов движения за короткое время —
  // в любом направлении (влево-вправо, вверх-вниз, по диагонали)
  function shakeDetect(sh, e){
    var now = performance.now();
    if(sh.x === undefined){ sh.x = e.clientX; sh.y = e.clientY; sh.dx = 0; sh.dy = 0; sh.pdx = 0; sh.pdy = 0; sh.plen = 0; sh.flips = []; return false; }
    var mx = e.clientX - sh.x, my = e.clientY - sh.y; sh.x = e.clientX; sh.y = e.clientY;
    if(Math.abs(mx) + Math.abs(my) < 1.5) return false;
    var len = Math.hypot(sh.dx, sh.dy);
    // текущий отрезок продолжается, пока направление не развернулось больше чем на ~110°
    if(len > 0 && (mx * sh.dx + my * sh.dy) / (Math.hypot(mx, my) * len) < -0.35){
      if(len >= SHAKE.minRun && sh.plen >= SHAKE.minRun * 0.6 && (sh.dx * sh.pdx + sh.dy * sh.pdy) / (len * sh.plen) < -0.2) sh.flips.push(now);
      else if(len >= SHAKE.minRun && !sh.plen) sh.flips.push(now);
      sh.pdx = sh.dx; sh.pdy = sh.dy; sh.plen = len; sh.dx = mx; sh.dy = my;
    } else { sh.dx += mx; sh.dy += my; }
    sh.flips = sh.flips.filter(function(t){ return now - t < SHAKE.window; });
    return sh.flips.length >= SHAKE.flips;
  }
  function shakeTrack(dg, e){
    if(dg.shook || dg.type !== 'node' || dg.group) return false;
    dg.sh = dg.sh || {};
    if(shakeDetect(dg.sh, e)){ dg.shook = true; shakeNode(dg); return true; }
    return false;
  }
  function shakeNode(dg){
    var n = dg.item, id = n.id;
    var touches = function(e){ return e.from === id || e.to === id; };
    var tapHas = G.edges.some(function(e){ return (e.taps || []).some(function(tp){ return tapIds(tp).indexOf(id) >= 0; }); });
    var cnt = G.edges.filter(touches).length;
    if(dg.el){ dg.el.classList.remove('shaken'); void dg.el.offsetWidth; dg.el.classList.add('shaken'); }
    if(!cnt && !tapHas){ toast('У «' + n.name + '» нет связей'); return; }
    if(n.kind === 'hub'){
      G.edges = G.edges.filter(function(e){ return !touches(e); });
      G.edges.forEach(function(e){ (e.taps || []).forEach(function(tp){ tp.nodes = tapIds(tp).filter(function(x){ return x !== id; }); }); });
      renderEdges(); var hb = dg.el && dg.el.querySelector('.hub-badge'); if(hb) hb.remove();   // сохранение — по окончании перетаскивания, одним шагом истории
      toastAct('Связи точки отцеплены: ' + cnt, 'Вернуть', undo);
      return;
    }
    // на месте блока остаётся связующая точка, все связи переходят к ней
    var ox = dg.ox !== undefined ? dg.ox : n.x, oy = dg.oy !== undefined ? dg.oy : n.y;
    var hub = { id:newId('n'), name:'Узел ' + (G.nodes.filter(function(x){ return x.kind === 'hub'; }).length + 1), lang:n.lang, kind:'hub', x:Math.round(ox + NWof(n) / 2 - HUB / 2), y:Math.round(oy + NHof(n) / 2 - HUB / 2), codes:{}, pluginId:null, family:null, desc:'Связи блока «' + n.name + '»', colors:n.colors || null };
    G.nodes.push(hub);
    G.edges.forEach(function(e){ if(e.from === id) e.from = hub.id; if(e.to === id) e.to = hub.id; (e.taps || []).forEach(function(tp){ tp.nodes = tapIds(tp).map(function(x){ return x === id ? hub.id : x; }); }); });
    // связь «точка → точка» не нужна
    G.edges = G.edges.filter(function(e){ return e.from !== e.to; });
    renderGraph();
    var ne = domOf('node', id); if(ne){ dg.el = ne; ne.classList.add('dragging', 'shaken'); }
    toastAct('Связи «' + n.name + '» перешли на узел (' + cnt + ')', 'Вернуть', undo);
  }
  /* ---------- точки на связях ---------- */
  // потрясли точку: сначала отцепляются подключённые блоки, пустая точка снимается со связи
  function shakeTap(dg){
    var tp = dg.tap, e0 = dg.edge, ids = tapIds(tp).filter(function(x){ return nodeById(x); });
    if(ids.length){ tp.nodes = []; renderEdges(); toastAct('От точки отцеплено блоков: ' + ids.length, 'Вернуть', undo); }
    else { e0.taps = (e0.taps || []).filter(function(x){ return x !== tp; }); dg.dead = true; S.sel = null; hidePop(); renderEdges(); toastAct('Точка снята со связи', 'Вернуть', undo); }
  }
  // точку утянули от связи: она становится узлом, подключённые блоки переходят к нему
  function tearTap(dg, e){
    var tp = dg.tap, e0 = dg.edge, w = toWorld(e.clientX, e.clientY), ids = tapIds(tp).filter(function(x){ return nodeById(x); });
    e0.taps = (e0.taps || []).filter(function(x){ return x !== tp; });
    var first = ids.length ? nodeById(ids[0]) : null;
    var hub = { id:newId('n'), name:tp.name || ('Узел ' + (G.nodes.filter(function(x){ return x.kind === 'hub'; }).length + 1)), lang:first ? first.lang : S.lang, kind:'hub',
      x:Math.round(w.x - HUB / 2), y:Math.round(w.y - HUB / 2), codes:{}, pluginId:null, family:null, desc:'Точка, снятая со связи', colors:tp.color ? [tp.color, tp.color] : null };
    G.nodes.push(hub);
    ids.forEach(function(id){ G.edges.push({ id:newId('e'), from:id, to:hub.id, taps:[] }); });
    S.sel = { type:'node', id:hub.id }; S.multi = []; hidePop();
    renderGraph();
    var el2 = domOf('node', hub.id); if(el2) el2.classList.add('dragging');
    drag = { mode:'move', type:'node', item:hub, el:el2, ox:hub.x, oy:hub.y, dx:HUB / 2, dy:HUB / 2, sx:e.clientX, sy:e.clientY, moved:true, sticky:false, group:null, shook:true };
    toastAct('Точка снята со связи и стала узлом' + (ids.length ? ' — блоки остались подключены' : ''), 'Вернуть', undo);
  }
