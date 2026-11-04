  // ---------- мини-карта ----------
  var miniEl = $('mini'), miniC = $('miniC'), miniQ = false, miniGeo = null;
  function miniDraw(){ if(!miniEl || miniQ) return; miniQ = true; requestAnimationFrame(function(){ miniQ = false; drawMini(); }); }
  function drawMini(){
    var show = UI.mini !== false && S.view === 'canvas' && G.nodes.length + G.notes.length > 0;
    miniEl.hidden = !show; if(!show) return;
    var W = 200, H = 130, dpr = window.devicePixelRatio || 1;
    if(miniC.width !== W * dpr){ miniC.width = W * dpr; miniC.height = H * dpr; }
    var cx = miniC.getContext('2d'); cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
    var r = el.canvas.getBoundingClientRect(), c = G.cam;
    var vx = -c.x / c.k, vy = -c.y / c.k, vw = r.width / c.k, vh = r.height / c.k;
    var boxes = [];
    G.nodes.forEach(function(n){ boxes.push({ x:n.x, y:n.y, w:NWof(n), h:NHof(n), c:colorsOf(n)[0], hub:n.kind === 'hub' }); });
    G.notes.forEach(function(t){ if(t.hidden) return; var d = domOf('note', t.id); boxes.push({ x:t.x, y:t.y, w:d ? d.offsetWidth : 160, h:d ? d.offsetHeight : 40, note:true }); });
    var x0 = vx, y0 = vy, x1 = vx + vw, y1 = vy + vh;
    boxes.forEach(function(b){ x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
    var pad = 60; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    var s = Math.min(W / (x1 - x0), H / (y1 - y0)), ox = (W - (x1 - x0) * s) / 2 - x0 * s, oy = (H - (y1 - y0) * s) / 2 - y0 * s;
    miniGeo = { s:s, ox:ox, oy:oy };
    // цвет линий берём из темы, а не пересчитываем стили страницы каждый кадр
    cx.strokeStyle = (typeof themeOf === 'function' && themeOf(UI.theme || 'burgundy').line2) || '#555'; cx.lineWidth = 1;
    G.edges.forEach(function(e){ var a = nodeById(e.from), b = nodeById(e.to); if(!a || !b) return; var p = portOut(a), q = portIn(b);
      cx.beginPath(); cx.moveTo(p.x * s + ox, p.y * s + oy); cx.lineTo(q.x * s + ox, q.y * s + oy); cx.stroke(); });
    boxes.forEach(function(b){
      cx.fillStyle = b.note ? 'rgba(160,150,155,.45)' : b.c;
      var bx = b.x * s + ox, by = b.y * s + oy, bw = Math.max(3, b.w * s), bh = Math.max(2, b.h * s);
      if(b.hub){ cx.beginPath(); cx.arc(bx + bw / 2, by + bh / 2, Math.max(2, bw / 2), 0, Math.PI * 2); cx.fill(); }
      else cx.fillRect(bx, by, bw, bh);
    });
    var acc = document.documentElement.style.getPropertyValue('--red').trim() || '#DC2626';
    cx.fillStyle = acc; cx.globalAlpha = 0.12; cx.fillRect(vx * s + ox, vy * s + oy, vw * s, vh * s);
    cx.globalAlpha = 1; cx.strokeStyle = acc; cx.lineWidth = 1.5; cx.strokeRect(vx * s + ox + 0.5, vy * s + oy + 0.5, vw * s - 1, vh * s - 1);
  }
  function miniGo(e){
    if(!miniGeo) return;
    var mr = miniEl.getBoundingClientRect(), k = mr.width / 200;
    var wx = ((e.clientX - mr.left) / k - miniGeo.ox) / miniGeo.s, wy = ((e.clientY - mr.top) / k - miniGeo.oy) / miniGeo.s;
    var r = el.canvas.getBoundingClientRect();
    G.cam.x = r.width / 2 - wx * G.cam.k; G.cam.y = r.height / 2 - wy * G.cam.k;
    applyCam(); hidePop();
  }
  var miniDrag = false, miniFrozen = null;
  miniEl.addEventListener('pointerdown', function(e){
    e.stopPropagation(); e.preventDefault(); miniDrag = true; miniEl.setPointerCapture(e.pointerId);
    miniFrozen = miniGeo; miniGo(e);
  });
  miniEl.addEventListener('pointermove', function(e){ if(miniDrag){ var keep = miniGeo; miniGeo = miniFrozen; miniGo(e); miniGeo = keep; } });
  miniEl.addEventListener('pointerup', function(){ if(miniDrag){ miniDrag = false; saveGraph(); } });
  miniEl.addEventListener('wheel', function(e){ e.preventDefault(); e.stopPropagation(); var r = el.canvas.getBoundingClientRect(); zoomAt(G.cam.k * Math.exp(-e.deltaY * 0.0025), r.left + r.width / 2, r.top + r.height / 2); }, { passive:false });
  window.addEventListener('resize', miniDraw);
