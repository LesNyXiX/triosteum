  /* ---------- встряхивание: зажать блок и потрясти ----------
     Блок: все его связи переходят на новую связующую точку на его месте —
     ничего не теряется, блок свободен. Точка: все её связи отцепляются. */
  var SHAKE = { flips:3, minRun:16, window:1100 };
  // распознавание встряхивания: смены направления по каждой оси отдельно — работает и для
  // диагональной тряски, и для коротких быстрых движений мышью или пальцем
  function shakeDetect(sh, e){
    var now = performance.now();
    if(sh.x === undefined){ sh.x = e.clientX; sh.y = e.clientY; sh.ax = { dir:0, run:0 }; sh.ay = { dir:0, run:0 }; sh.flips = []; return false; }
    var dx = e.clientX - sh.x, dy = e.clientY - sh.y; sh.x = e.clientX; sh.y = e.clientY;
    [[sh.ax, dx], [sh.ay, dy]].forEach(function(p){
      var a = p[0], d = p[1]; if(Math.abs(d) < 1) return;
      var dir = Math.sign(d);
      if(a.dir && dir !== a.dir){ if(a.run >= SHAKE.minRun) sh.flips.push(now); a.run = 0; }
      a.dir = dir; a.run += Math.abs(d);
    });
    sh.flips = sh.flips.filter(function(t){ return now - t < SHAKE.window; });
    if(sh.flips.length >= SHAKE.flips){ sh.flips = []; return true; }
    return false;
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
