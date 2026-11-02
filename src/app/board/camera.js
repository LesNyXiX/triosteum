  /* ---------- камера ---------- */
  function applyCam(){
    var c = G.cam;
    el.world.style.transform = 'translate(' + c.x + 'px,' + c.y + 'px) scale(' + c.k + ')';
    var g = 24 * c.k;
    el.canvas.style.backgroundSize = g + 'px ' + g + 'px';
    el.canvas.style.backgroundPosition = c.x + 'px ' + c.y + 'px';
    el.zVal.textContent = Math.round(c.k * 100) + '%';
    if(S.view === 'canvas') status();
    miniDraw();
  }
  function toWorld(cx, cy){
    var r = el.canvas.getBoundingClientRect(), c = G.cam;
    return { x:(cx - r.left - c.x) / c.k, y:(cy - r.top - c.y) / c.k };
  }
  function zoomAt(k, cx, cy){
    var c = G.cam, r = el.canvas.getBoundingClientRect();
    k = Math.max(0.25, Math.min(3, k));
    var px = (cx === undefined ? r.width / 2 : cx - r.left), py = (cy === undefined ? r.height / 2 : cy - r.top);
    c.x = px - (px - c.x) * (k / c.k);
    c.y = py - (py - c.y) * (k / c.k);
    c.k = k;
    applyCam(); saveGraph(); hidePop();
  }
