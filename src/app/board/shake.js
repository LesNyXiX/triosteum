  /* ---------- встряхивание: зажать блок и потрясти ----------
     Блок: все его связи переходят на новую связующую точку на его месте —
     ничего не теряется, блок свободен. Точка: все её связи отцепляются. */
  var SHAKE = { flips:4, minRun:16, window:900 };
  // распознавание встряхивания: несколько резких смен направления за короткое время
  function shakeDetect(sh, e){
    if(sh.x === undefined){ sh.x = e.clientX; sh.y = e.clientY; sh.dir = 0; sh.run = 0; sh.flips = []; return false; }
    var dx = e.clientX - sh.x, dy = e.clientY - sh.y; sh.x = e.clientX; sh.y = e.clientY;
    var ax = Math.abs(dx) >= Math.abs(dy), d = ax ? dx : dy; if(Math.abs(d) < 2) return false;
    var dir = (ax ? 1 : 2) * Math.sign(d), now = performance.now();
    if(sh.dir && dir === -sh.dir && sh.run >= SHAKE.minRun){ sh.flips.push(now); sh.run = 0; }
    else if(dir !== sh.dir) sh.run = 0;
    sh.dir = dir; sh.run += Math.abs(d);
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
