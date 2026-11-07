  /* ---------- не рисовать то, чего не видно ----------
     Блоки и связи за краем экрана (с запасом) получают visibility:hidden: браузер их не рисует
     и не проверяет под курсором. На больших досках это в разы снижает работу на каждый кадр. */
  var CULL = { raf:0, M:260 };
  function cullView(){ if(!CULL.raf) CULL.raf = requestAnimationFrame(cullNow); }
  function cullNow(){
    CULL.raf = 0;
    if(!el.canvas || el.canvas.hidden || S.view !== 'canvas') return;
    var c = G.cam, W = el.canvas.clientWidth, H = el.canvas.clientHeight, m = CULL.M;
    if(!W || !H) return;
    var x0 = (-m - c.x) / c.k, y0 = (-m - c.y) / c.k, x1 = (W + m - c.x) / c.k, y1 = (H + m - c.y) / c.k;
    var big = G.nodes.length > 40;        // на маленьких досках не тратим время
    Array.prototype.forEach.call(el.nodes.children, function(d){
      var n = nodeById(d.dataset.id), off = false;
      if(big && n && !d.classList.contains('dragging') && !d.classList.contains('sel')){
        var w = NWof(n), h = NHof(n);
        off = n.x + w + 60 < x0 || n.x - 60 > x1 || n.y + h + 40 < y0 || n.y - 40 > y1;
      }
      if(d._off !== off){ d._off = off; d.classList.toggle('off', off); }
    });
    if(!el.edgeLayer) return;
    Array.prototype.forEach.call(el.edgeLayer.children, function(g){
      var hit = g.lastChild, id = hit && hit.getAttribute && hit.getAttribute('data-edge'), off = false;
      if(big && id){
        var e = edgeById(id), a = e && nodeById(e.from), b = e && nodeById(e.to);
        if(a && b){
          var lx = Math.min(a.x, b.x) - 60, rx = Math.max(a.x + NWof(a), b.x + NWof(b)) + 60, ty = Math.min(a.y, b.y) - 40, by = Math.max(a.y + NHof(a), b.y + NHof(b)) + 40;
          off = rx < x0 || lx > x1 || by < y0 || ty > y1;
        }
      }
      if(g._off !== off){ g._off = off; g.classList.toggle('off', off); }
    });
  }
  var EBI = { arr:null, map:null };
  function edgeById(id){
    if(EBI.arr !== G.edges || !EBI.map || !EBI.map[id]){ EBI.arr = G.edges; EBI.map = Object.create(null); G.edges.forEach(function(e){ EBI.map[e.id] = e; }); }
    return EBI.map[id];
  }
  (function(){
    var _ac = applyCam; applyCam = function(){ var r = _ac.apply(this, arguments); cullView(); return r; };
    var _rg = renderGraph; renderGraph = function(){ var r = _rg.apply(this, arguments); cullView(); return r; };
    var _re = renderEdges; renderEdges = function(){ var r = _re.apply(this, arguments); cullView(); return r; };
    window.addEventListener('resize', cullView);
  })();
