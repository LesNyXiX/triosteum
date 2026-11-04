  /* ---------- встряхивание: зажать блок и потрясти ----------
     Блок: все его связи переходят на новую связующую точку на его месте —
     ничего не теряется, блок свободен. Точка: все её связи отцепляются. */
  var SHAKE = { flips:4, minRun:25, window:800, minPath:260, maxNet:0.3 };
  // встряхивание — это частые смены направления на месте: за последние 0,8 с не меньше 4 разворотов
  // по основной оси, путь не меньше 260 px, а сам блок почти не сдвинулся. Обычное перетаскивание
  // с поправками (даже туда-обратно) под эти условия не попадает.
  function shakeDetect(sh, e){
    var now = performance.now();
    sh.pts = (sh.pts || []).filter(function(p){ return now - p.t < SHAKE.window; });
    sh.pts.push({ x:e.clientX, y:e.clientY, t:now });
    var P = sh.pts; if(P.length < 6) return false;
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, L = 0;
    P.forEach(function(p, i){ x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); if(i) L += Math.hypot(p.x - P[i - 1].x, p.y - P[i - 1].y); });
    var net = Math.hypot(P[P.length - 1].x - P[0].x, P[P.length - 1].y - P[0].y);
    if(L < SHAKE.minPath || net > L * SHAKE.maxNet) return false;
    var ax = (x1 - x0) >= (y1 - y0) ? 'x' : 'y', dir = 0, run = 0, flips = 0;
    for(var i = 1; i < P.length; i++){
      var d = P[i][ax] - P[i - 1][ax]; if(Math.abs(d) < 1) continue;
      var s2 = Math.sign(d);
      if(dir && s2 !== dir){ if(run >= SHAKE.minRun) flips++; run = 0; }
      dir = s2; run += Math.abs(d);
    }
    if(flips >= SHAKE.flips){ sh.pts = []; return true; }
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
