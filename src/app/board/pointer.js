  /* ---------- мышь и касания ---------- */
  var drag = null, lastTap = { key:null, t:0 }, pendingText = null;
  // не даём кнопке комментария забирать фокус: иначе поле теряет ввод до клика
  el.canvas.addEventListener('mousedown', function(e){ if(e.target.closest('.cbtn, .xbtn')) e.preventDefault(); });
  el.canvas.addEventListener('click', function(e){
    var xb = e.target.closest('.xbtn');
    if(xb){ var xn = xb.closest('.node'); if(xn){ S.sel = { type:'node', id:xn.dataset.id }; deleteSel(); } return; }
    var cbtn = e.target.closest('.cbtn');
    if(cbtn){
      var cn = nodeById(cbtn.closest('.node').dataset.id);
      if(cn) toggleComments(cn);
      return;
    }
    if(pendingText && S.tool === 'text'){
      var q = pendingText; pendingText = null;
      var note = { id:'t' + (G.seq++), text:'', x:Math.round(q.x), y:Math.round(q.y - 12), fs:UI.note, tint:'grey' };
      G.notes.push(note); S.sel = { type:'note', id:note.id };
      S.tool = 'select'; render(); renderGraph(); updateSel();
      editNote(note.id);
    }
  });
  function nodeAt(cx, cy){
    var t = document.elementFromPoint(cx, cy);
    var ne = t && t.closest && t.closest('.node');
    return ne ? nodeById(ne.dataset.id) : null;
  }
  function isDouble(key){
    var now = Date.now(), dbl = lastTap.key === key && now - lastTap.t < 420;
    return dbl;
  }
  function carry(on){ el.canvas.classList.toggle('carrying', on); }
  el.canvas.addEventListener('pointerdown', function(e){
    if(e.button !== 0 && e.pointerType === 'mouse') return;
    if(drag && drag.sticky){                 // второе нажатие после двойного клика — отпускаем
      e.preventDefault(); moveDrag(e); drag.sticky = false; carry(false); endDrag(e, false); return;
    }
    if(e.target.closest('.zoom') || e.target.closest('.hint button') || e.target.closest('.runp') || e.target.closest('.mini') || e.target.closest('.ai-fab')) return;
    if(e.target.closest('.cbtn, .xbtn')){ drag = null; return; }
    var noteE = e.target.closest('.note');
    if(noteE && noteE.classList.contains('editing')) return;     // курсор внутри редактируемой заметки
    if(editingNote && document.activeElement) document.activeElement.blur();

    var cbtn = e.target.closest('.cbtn');
    if(cbtn){ drag = null; return; }   // обрабатывается по click — так на телефоне открывается клавиатура
    var rzh = e.target.closest('.rz');
    if(rzh){
      var rn = nodeById(rzh.closest('.node').dataset.id);
      if(rn){
        el.canvas.setPointerCapture(e.pointerId);
        S.multi = []; S.sel = { type:'node', id:rn.id }; updateSel(); hidePop();
        var rd = domOf('node', rn.id); rd.classList.add('resizing'); el.canvas.classList.add('resizing');
        drag = { mode:'resize', item:rn, el:rd, w0:NWof(rn), h0:NHof(rn), sx:e.clientX, sy:e.clientY, moved:false };
        return;
      }
    }
    var dot = e.target.closest('.port-dot');
    var ne = e.target.closest('.node');
    var hit = e.target.closest('.edge-hit');
    var handle = e.target.closest('.edge-handle');
    var taph = e.target.closest('.tap-handle');
    var tlh = e.target.closest('.tlink-hit');
    el.canvas.setPointerCapture(e.pointerId);

    if(tlh && !taph){
      var tle = edgeById(tlh.getAttribute('data-edge')), tlp = tle && tapById(tle, tlh.getAttribute('data-tap')), tln = nodeById(tlh.getAttribute('data-node'));
      if(tlp && tln){
        var stL = isDouble('tl:' + tlp.id + ':' + tln.id); lastTap = { key:null, t:0 };
        drag = { mode:'tlinkgrab', edge:tle, tap:tlp, node:tln, sx:e.clientX, sy:e.clientY, moved:false };
        if(stL){ grabTapLink(e); drag.sticky = true; carry(true); }
        return;
      }
    }

    if(taph){
      var te = edgeById(taph.getAttribute('data-edge')), tp = te && tapById(te, taph.getAttribute('data-tap'));
      if(tp){
        var stT = isDouble('tap:' + tp.id); lastTap = { key:null, t:0 };
        S.sel = { type:'tap', id:tp.id, edge:te.id }; hidePop(); renderEdges();
        drag = { mode:'tap', edge:te, tap:tp, sx:e.clientX, sy:e.clientY, moved:false, sticky:stT };
        if(stT) carry(true);
        return;
      }
    }

    if(handle){
      var eid = handle.getAttribute('data-edge'), endName = handle.getAttribute('data-end');
      var edge = edgeById(eid);
      if(edge){
        var stE = isDouble('end:' + eid); lastTap = { key:null, t:0 };
        G.edges = G.edges.filter(function(x){ return x.id !== eid; });
        if(S.sel && S.sel.type === 'edge' && S.sel.id === eid){ S.sel = null; hidePop(); }
        renderEdges();
        startLink(e, nodeById(endName === 'to' ? edge.from : edge.to), endName === 'to' ? 'to' : 'from', null, edge);
        drag.key = 'end:' + eid; drag.sticky = stE; if(stE) carry(true);
        return;
      }
    }
    if(dot){
      var pn = nodeById(ne.dataset.id), stP = isDouble('port:' + pn.id); lastTap = { key:null, t:0 };
      dot.classList.add('grab'); hidePop();
      startLink(e, pn, 'to', dot, null);
      drag.key = 'port:' + pn.id; drag.sticky = stP; if(stP) carry(true);
      return;
    }
    if(ne){
      var n = nodeById(ne.dataset.id);
      if(e.shiftKey){ toggleMulti('node', n.id); drag = null; return; }
      var stN = isDouble('n:' + n.id); lastTap = { key:null, t:0 };
      if(stN){                                   // двойное нажатие по блоку — удалить (Ctrl+Z или «Вернуть» отменяет)
        e.preventDefault(); drag = null; hidePop();
        S.multi = []; S.sel = { type:'node', id:n.id };
        ne.classList.add('removing');
        var nm = n.name;
        setTimeout(function(){
          if(!nodeById(n.id)) return;
          S.multi = []; S.sel = { type:'node', id:n.id }; deleteSel(); flushSave();
          toastAct('Блок «' + nm + '» удалён', 'Вернуть', undo);
        }, document.body.classList.contains('noanim') ? 0 : 170);
        return;
      }
      var w = toWorld(e.clientX, e.clientY), grp = groupFor('node', n);
      if(!grp){ S.multi = []; S.sel = { type:'node', id:n.id }; }
      updateSel(); hidePop();
      ne.classList.add('dragging');
      drag = { mode:'move', type:'node', item:n, el:ne, dx:w.x - n.x, dy:w.y - n.y, sx:e.clientX, sy:e.clientY, moved:false, sticky:false, group:grp };
      if(e.pointerType !== 'mouse'){        // на телефоне: удержание открывает код
        var dn = drag;
        dn.lp = setTimeout(function(){ if(drag === dn && !dn.moved){ drag = null; dn.el.classList.remove('dragging'); showPop(); } }, 600);
      }
      return;
    }
    if(noteE){
      var t = noteById(noteE.dataset.id);
      if(e.shiftKey && !t.attach){ toggleMulti('note', t.id); drag = null; return; }
      var stNo = isDouble('t:' + t.id); lastTap = { key:null, t:0 };
      var w2 = toWorld(e.clientX, e.clientY), grp2 = groupFor('note', t);
      if(!grp2){ S.multi = []; S.sel = { type:'note', id:t.id }; }
      updateSel(); hidePop();
      drag = { mode:'move', type:'note', item:t, el:noteE, dx:w2.x - t.x, dy:w2.y - t.y, sx:e.clientX, sy:e.clientY, moved:false, sticky:stNo, group:grp2 };
      if(stNo) carry(true);
      else if(e.pointerType !== 'mouse'){
        var dno = drag;
        dno.lp = setTimeout(function(){ if(drag === dno && !dno.moved){ drag = null; showPop(); } }, 600);
      }
      return;
    }
    if(hit){
      var hid = hit.getAttribute('data-edge'), he = edgeById(hid);
      if(he && isDouble('e:' + hid)){
        lastTap = { key:null, t:0 };
        var ntp = addTap(he, freeT(he, 0.5));
        S.sel = { type:'tap', id:ntp.id, edge:he.id }; renderEdges();
        toast('Точка добавлена — потяните к ней отросток блока');
        drag = null; return;
      }
      S.multi = []; S.sel = { type:'edge', id:hid }; updateSel();
      // за саму линию тоже можно ухватиться: потянули — отцепляется ближайший к курсору конец
      drag = { mode:'edgegrab', edge:he, sx:e.clientX, sy:e.clientY, w0:toWorld(e.clientX, e.clientY), moved:false };
      return;
    }
    if(S.tool === 'block' || S.tool === 'hub'){
      var p = toWorld(e.clientX, e.clientY);
      if(S.tool === 'hub') addNode(S.lang, 'Узел ' + (G.nodes.filter(function(x){ return x.kind === 'hub'; }).length + 1), p.x - HUB / 2, p.y - HUB / 2, null, 'hub');
      else addNode(S.lang, newBlockName(S.lang), p.x - NW / 2, p.y - NH / 2);
      render();                                  // остаёмся в инструменте добавления
      drag = null; return;
    }
    if(S.tool === 'text'){
      pendingText = toWorld(e.clientX, e.clientY);
      drag = null;
      el.canvas.releasePointerCapture(e.pointerId);
      return;
    }
    if(e.shiftKey){ startMarquee(e); return; }
    if(S.sel || (S.multi && S.multi.length)){ S.sel = null; S.multi = []; updateSel(); }
    hidePop();
    drag = { mode:'pan', sx:e.clientX, sy:e.clientY, cx:G.cam.x, cy:G.cam.y };
    if(e.pointerType !== 'mouse'){          // на телефоне: удержание на пустой доске — меню доски
      var dp = drag, px = e.clientX, py = e.clientY;
      dp.lp = setTimeout(function(){ if(drag === dp && Math.abs(G.cam.x - dp.cx) + Math.abs(G.cam.y - dp.cy) < 6){ drag = null; openCtx(px, py); } }, 600);
    }
    el.canvas.style.cursor = 'grabbing';
  });

  function grabTapLink(e){
    var g = drag;
    g.tap.nodes = tapIds(g.tap).filter(function(x){ return x !== g.node.id; });
    renderEdges();
    startLink(e, g.node, 'to', null, null);
    drag.moved = true; drag.restoreTap = { tap:g.tap, node:g.node.id }; drag.key = 'tl:' + g.tap.id + ':' + g.node.id;
  }
  function groupFor(type, obj){
    if(!inMulti(type, obj.id) || S.multi.length < 2) return null;
    var items = S.multi.filter(function(m){ return !(m.type === type && m.id === obj.id); }).map(function(m){
      var o = m.type === 'node' ? nodeById(m.id) : noteById(m.id);
      return o ? { type:m.type, obj:o, x:o.x, y:o.y } : null;
    }).filter(Boolean);
    return { ox:obj.x, oy:obj.y, items:items };
  }
  function startLink(e, fixed, free, dot, edge){
    var c = colorsOf(fixed), col = free === 'to' ? c[1] : c[0];
    // отросток сам становится линией: прячем его и тянем линию прямо от края блока
    var pa = free === 'to' ? { 'class':'edge', d:'', stroke:col } : { 'class':'edge', d:'', stroke:col, 'stroke-dasharray':'6 5' };
    var path = svg('path', pa);
    var end = svg('circle', { r:free === 'to' ? 7 : 8, fill:col, stroke:'#12090B', 'stroke-width':2 });
    var fd = free === 'to' ? domOf('node', fixed.id) : null; if(fd) fd.classList.add('linking');
    el.tempLayer.appendChild(path); el.tempLayer.appendChild(end);
    drag = { mode:'link', fixed:fixed, free:free, dot:dot, edge:edge, path:path, end:end, over:null, sx:e.clientX, sy:e.clientY, moved:false };
    el.canvas.style.cursor = 'grabbing';
    moveLink(e);
  }
  function moveLink(e){
    if(!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
    var m = toWorld(e.clientX, e.clientY);
    var d = drag.free === 'to' ? curve(portOut(drag.fixed), m, true) : curve(m, portIn(drag.fixed));
    drag.path.setAttribute('d', d);
    drag.end.setAttribute('cx', m.x); drag.end.setAttribute('cy', m.y);
    var t = nodeAt(e.clientX, e.clientY);
    if(t && t.id === drag.fixed.id) t = null;
    if((drag.over && drag.over.id) !== (t && t.id)){
      if(drag.over){ var oe = domOf('node', drag.over.id); if(oe) oe.classList.remove('drop'); }
      if(t){ var te = domOf('node', t.id); if(te) te.classList.add('drop'); }
      drag.over = t;
    }
    // новая связь из отростка блока: можно прицепиться к точке или к самой связи
    drag.overTap = null; drag.overEdge = null;
    if(!t && drag.free === 'to' && !drag.edge){
      var k = G.cam.k, best = null;
      G.edges.forEach(function(ed){
        if(ed.from === drag.fixed.id || ed.to === drag.fixed.id) return;
        var p = edgePaths[ed.id]; if(!p) return;
        var L = p.getTotalLength();
        (ed.taps || []).forEach(function(tp){
          var q = p.getPointAtLength(tp.t * L), dd = Math.hypot(q.x - m.x, q.y - m.y);
          if(dd < 18 / k && (!best || dd < best.dist)) best = { kind:'tap', edge:ed, tap:tp, x:q.x, y:q.y, dist:dd - 6 / k };
        });
        var r = nearestOnEdge(ed, m);
        if(r && r.dist < 12 / k && r.t > 0.03 && r.t < 0.97 && (!best || r.dist < best.dist)) best = { kind:'edge', edge:ed, t:r.t, x:r.x, y:r.y, dist:r.dist };
      });
      if(best){
        if(best.kind === 'tap') drag.overTap = best; else drag.overEdge = best;
        drag.path.setAttribute('d', curve(portOut(drag.fixed), best, true));
        drag.end.setAttribute('cx', best.x); drag.end.setAttribute('cy', best.y);
        drag.end.setAttribute('stroke', '#FBF1F2'); drag.end.setAttribute('r', 10);
        return;
      }
    }
    drag.end.setAttribute('stroke', '#12090B'); drag.end.setAttribute('r', drag.free === 'to' ? 7 : 8);
  }
  el.canvas.addEventListener('pointermove', moveDrag);
  function moveDrag(e){
    if(!drag) return;
    // двойной клик с удержанием: если тянут с зажатой кнопкой — это обычное перетаскивание
    if(drag.sticky && !drag.released && (e.buttons & 1) && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.held = true;
    if(drag.mode === 'pan'){
      G.cam.x = drag.cx + (e.clientX - drag.sx); G.cam.y = drag.cy + (e.clientY - drag.sy); applyCam();
    } else if(drag.mode === 'marquee'){
      moveMarquee(e);
    } else if(drag.mode === 'move'){
      if(!drag.moved && !drag.sticky && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 4) return;
      if(drag.lp){ clearTimeout(drag.lp); drag.lp = null; }
      var w = toWorld(e.clientX, e.clientY);
      drag.tx = Math.round(w.x - drag.dx); drag.ty = Math.round(w.y - drag.dy); drag.moved = true;
      if(UI.snap && !e.altKey){ drag.tx = Math.round(drag.tx / GRID) * GRID; drag.ty = Math.round(drag.ty / GRID) * GRID; }
      smoothMove(drag);
    } else if(drag.mode === 'edgegrab'){
      if(Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 5) return;
      var ge = drag.edge, r0 = nearestOnEdge(ge, drag.w0), useTo = !r0 || r0.t >= 0.5;
      G.edges = G.edges.filter(function(x){ return x.id !== ge.id; });
      S.sel = null; renderEdges();
      startLink(e, nodeById(useTo ? ge.from : ge.to), useTo ? 'to' : 'from', null, ge);
      drag.moved = true; drag.key = 'end:' + ge.id;
    } else if(drag.mode === 'tlinkgrab'){
      if(Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 5) return;
      grabTapLink(e);
    } else if(drag.mode === 'resize'){
      var k = G.cam.k, nw = drag.w0 + (e.clientX - drag.sx) / k, nh = drag.h0 + (e.clientY - drag.sy) / k;
      if(e.shiftKey){ var f = Math.max(nw / drag.w0, nh / drag.h0); nw = drag.w0 * f; nh = drag.h0 * f; }
      if(UI.snap && !e.altKey){ nw = Math.round((drag.item.x + nw) / GRID) * GRID - drag.item.x; nh = Math.round((drag.item.y + nh) / GRID) * GRID - drag.item.y; }
      nw = Math.round(Math.max(NMIN_W, Math.min(NMAX_W, nw))); nh = Math.round(Math.max(NMIN_H, Math.min(NMAX_H, nh)));
      drag.moved = true;
      drag.item.w = nw === NW ? undefined : nw; drag.item.h = nh === NH ? undefined : nh;
      sizeNodeEl(drag.el, drag.item);
      if(!drag.raf){ var rdg = drag; drag.raf = requestAnimationFrame(function(){ rdg.raf = 0; renderEdges(); }); }
      if(el.stLeft) el.stLeft.textContent = 'Размер блока: ' + nw + ' × ' + nh + (e.shiftKey ? ' · пропорционально' : ' · Shift — пропорционально');
    } else if(drag.mode === 'link'){
      moveLink(e);
    } else if(drag.mode === 'tap'){
      if(!drag.moved && !drag.sticky && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      var r = nearestOnEdge(drag.edge, toWorld(e.clientX, e.clientY));
      if(r){ drag.tap.t = clampT(r.t); renderEdges(); }
    }
  }
  // плавное перетаскивание: блок мягко догоняет курсор, перерисовка — раз в кадр
  function placeDragged(dg, x, y){
    dg.item.x = x; dg.item.y = y;
    dg.el.style.left = x + 'px'; dg.el.style.top = y + 'px';

      if(dg.group){
        var ddx = dg.item.x - dg.group.ox, ddy = dg.item.y - dg.group.oy;
        dg.group.items.forEach(function(gi){
          gi.obj.x = gi.x + ddx; gi.obj.y = gi.y + ddy;
          if(gi.type === 'note' && gi.obj.attach){ var gn = nodeById(gi.obj.attach); if(gn){ gi.obj.dx = gi.obj.x - gn.x; gi.obj.dy = gi.obj.y - gn.y; } }
          var gd = domOf(gi.type, gi.obj.id); if(gd){ gd.style.left = gi.obj.x + 'px'; gd.style.top = gi.obj.y + 'px'; }
          if(gi.type === 'node') commentsOf(gi.obj.id).forEach(function(t){ syncNote(t); var cd = domOf('note', t.id); if(cd){ cd.style.left = t.x + 'px'; cd.style.top = t.y + 'px'; } });
        });
      }
      if(dg.type === 'note' && dg.item.attach){
        var an = nodeById(dg.item.attach); if(an){ dg.item.dx = dg.item.x - an.x; dg.item.dy = dg.item.y - an.y; dg.item.auto = false; }
      }
      if(dg.type === 'node'){
        commentsOf(dg.item.id).forEach(function(t){ syncNote(t); var cd = domOf('note', t.id); if(cd){ cd.style.left = t.x + 'px'; cd.style.top = t.y + 'px'; } });
      }
    renderEdges();
  }
  var moveRaf = 0, moveT = 0;
  function smoothMove(dg){
    if(dg.vx == null){ dg.vx = dg.item.x; dg.vy = dg.item.y; }
    if(document.body.classList.contains('noanim')){ dg.vx = dg.tx; dg.vy = dg.ty; placeDragged(dg, dg.tx, dg.ty); return; }
    if(moveRaf) return;
    moveT = performance.now();
    moveRaf = requestAnimationFrame(function step(now){
      moveRaf = 0;
      if(drag !== dg && !dg.finishing) return;
      var dt = Math.min(64, now - moveT); moveT = now;
      var f = 1 - Math.pow(1 - 0.38, dt / 16.7);
      dg.vx += (dg.tx - dg.vx) * f; dg.vy += (dg.ty - dg.vy) * f;
      var done = Math.abs(dg.tx - dg.vx) < 0.4 && Math.abs(dg.ty - dg.vy) < 0.4;
      if(done){ dg.vx = dg.tx; dg.vy = dg.ty; }
      placeDragged(dg, Math.round(dg.vx * 10) / 10, Math.round(dg.vy * 10) / 10);
      if(!done) moveRaf = requestAnimationFrame(step);
      else if(dg.finishing){ dg.finishing = false; saveGraph(); }
    });
  }
  function endDrag(e, cancel){
    if(!drag) return;
    var dd = drag; drag = null;
    if(dd.lp) clearTimeout(dd.lp);
    carry(false);
    if(dd.mode === 'marquee'){ endMarquee(dd); applyCursor(); return; }
    if(dd.mode === 'edgegrab'){ lastTap = { key:'e:' + dd.edge.id, t:Date.now() }; applyCursor(); return; }
    if(dd.mode === 'tlinkgrab'){ S.sel = { type:'tap', id:dd.tap.id, edge:dd.edge.id }; lastTap = { key:'tl:' + dd.tap.id + ':' + dd.node.id, t:Date.now() }; renderEdges(); applyCursor(); return; }
    if(dd.mode === 'move'){
      dd.el.classList.remove('dragging');
      if(dd.moved){
        lastTap = { key:null, t:0 };
        if(dd.tx != null && (Math.abs(dd.vx - dd.tx) > 0.4 || Math.abs(dd.vy - dd.ty) > 0.4) && !document.body.classList.contains('noanim')){ dd.finishing = true; smoothMove(dd); }
        else { if(dd.tx != null) placeDragged(dd, dd.tx, dd.ty); saveGraph(); }
      }
      else { lastTap = { key:(dd.type === 'node' ? 'n:' : 't:') + dd.item.id, t:Date.now() }; }
    } else if(dd.mode === 'link'){
      if(dd.dot) dd.dot.classList.remove('grab');
      el.tempLayer.innerHTML = '';
      Array.prototype.forEach.call(el.nodes.querySelectorAll('.node.linking'), function(x){ x.classList.remove('linking'); });
      if(dd.over){ var oe = domOf('node', dd.over.id); if(oe) oe.classList.remove('drop'); }
      if(!dd.moved && !cancel){
        // простое нажатие без движения: ничего не меняем, запоминаем для двойного клика
        if(dd.edge) G.edges.push(dd.edge);
        lastTap = { key:dd.key, t:Date.now() };
        renderEdges(); applyCursor(); return;
      }
      if(cancel){
        if(dd.edge) G.edges.push(dd.edge);
        if(dd.restoreTap && tapIds(dd.restoreTap.tap).indexOf(dd.restoreTap.node) < 0) dd.restoreTap.tap.nodes.push(dd.restoreTap.node);
      } else if(dd.over){
        var from = dd.free === 'to' ? dd.fixed.id : dd.over.id;
        var to   = dd.free === 'to' ? dd.over.id : dd.fixed.id;
        if(!G.edges.some(function(x){ return x.from === from && x.to === to; })){
          G.edges.push({ id: dd.edge ? dd.edge.id : 'e' + (G.seq++), from:from, to:to, taps:dd.edge ? dd.edge.taps : [] });
        }
      } else if(dd.overTap){
        var otp = dd.overTap.tap;
        if(tapIds(otp).indexOf(dd.fixed.id) < 0) otp.nodes.push(dd.fixed.id);
        S.sel = { type:'tap', id:otp.id, edge:dd.overTap.edge.id };
        toast('«' + dd.fixed.name + '» встроен в поток');
      } else if(dd.overEdge){
        var ntp = addTap(dd.overEdge.edge, dd.overEdge.t, dd.fixed.id);
        S.sel = { type:'tap', id:ntp.id, edge:dd.overEdge.edge.id };
        toast('«' + dd.fixed.name + '» встроен в поток');
      }
      saveGraph(); renderEdges(); status();
    } else if(dd.mode === 'resize'){
      dd.el.classList.remove('resizing'); el.canvas.classList.remove('resizing');
      if(dd.raf) cancelAnimationFrame(dd.raf);
      renderEdges(); status();
      if(dd.moved){ saveGraph(); placePop(); }
    } else if(dd.mode === 'pan'){
      saveGraph();
    } else if(dd.mode === 'tap'){
      if(!dd.moved) lastTap = { key:'tap:' + dd.tap.id, t:Date.now() };
      saveGraph(); renderEdges();
    }
    applyCursor();
  }
  el.canvas.addEventListener('pointerup', function(e){
    if(drag && drag.sticky && !drag.held){ drag.released = true; toast('Элемент в руке — нажмите, чтобы отпустить'); return; }   // двойной клик без перетаскивания — элемент остаётся в руке
    endDrag(e, false);
  });
  // правая кнопка мыши: блок — открыть код, заметка — редактировать текст
  // правая кнопка мыши — единственный способ открыть окно настроек (на телефоне — удержание)
  el.canvas.addEventListener('contextmenu', function(e){
    if(e.target.closest('.runp')) return;
    if(e.target.closest('.mini') || e.target.closest('.ai-fab')){ e.preventDefault(); return; }
    e.preventDefault();
    if(drag && drag.sticky) return;
    if(e.target.closest('.note.editing')) return;
    var ne = e.target.closest('.node'), no = e.target.closest('.note'), th = e.target.closest('.tap-handle'), eh = e.target.closest('.edge-hit, .edge-handle');
    if(th) S.sel = { type:'tap', id:th.getAttribute('data-tap'), edge:th.getAttribute('data-edge') };
    else if(ne) S.sel = { type:'node', id:ne.dataset.id };
    else if(no) S.sel = { type:'note', id:no.dataset.id };
    else if(eh) S.sel = { type:'edge', id:eh.getAttribute('data-edge') };
    else { hidePop(); openCtx(e.clientX, e.clientY); return; }
    updateSel(); showPop();
  });
  el.canvas.addEventListener('pointercancel', function(e){ endDrag(e, true); });
  el.canvas.addEventListener('wheel', function(e){
    if(e.target.closest('.runp')) return;          // прокрутка лога компиляции
    e.preventDefault();
    if(e.ctrlKey || e.metaKey){ zoomAt(G.cam.k * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY); }
    else { G.cam.x -= e.deltaX; G.cam.y -= e.deltaY; applyCam(); saveGraph(); placePop(); }
  }, { passive:false });
  window.addEventListener('resize', placePop);
  document.addEventListener('keydown', function(e){
    var mod = e.ctrlKey || e.metaKey, code = e.code || '';
    if(typeof OF === 'object' && OF && officeOn() && !cmdOpen() && officeKey(e)) return;
    // ⌘/Ctrl+R — компиляция: на доске вся схема, в редакторе текущий код
    if(mod && !e.altKey && code === 'KeyR'){ e.preventDefault(); if(S.view === 'editor') runCode(); else runBoard(); return; }
    if(mod && !e.altKey && code === 'KeyK'){ e.preventDefault(); cmdOpen() ? closeCmd() : openCmd(); return; }
    if(mod && !e.altKey && code === 'KeyS'){ e.preventDefault(); exportFile(); return; }
    if(mod && !e.altKey && code === 'KeyO'){ e.preventDefault(); fileIn.click(); return; }
    if(cmdOpen()) return;
    if(officeOn()) return;
    if(S.view !== 'canvas' || !el.modal.hidden) return;
    var t = e.target;
    if(t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
    if(mod && !e.altKey){
      if(code === 'KeyA'){ e.preventDefault(); selectAll(); }
      else if(code === 'KeyZ' && !e.shiftKey){ e.preventDefault(); undo(); }
      else if(code === 'KeyY' || (code === 'KeyZ' && e.shiftKey)){ e.preventDefault(); redo(); }
      else if(code === 'KeyC'){ e.preventDefault(); copySel(); }
      else if(code === 'KeyV'){ e.preventDefault(); pasteClip(); }
      else if(code === 'KeyD'){ e.preventDefault(); dupSel(); }
      return;
    }
    if(/^Arrow(Left|Right|Up|Down)$/.test(e.key) && nudgeSel(e)){ e.preventDefault(); return; }
    if((e.key === 'Delete' || e.key === 'Backspace') && (S.sel || (S.multi && S.multi.length))){ e.preventDefault(); deleteSel(); }
    if(e.key === 'Escape'){
      if(drag && (drag.mode === 'link' || drag.sticky)) endDrag(e, true);
      else if(!addMenu.hidden) closeAddMenu();
      else if(!runEl.box.hidden) runEl.box.hidden = true;
      else if(S.pop) hidePop();
      else if(S.sel || (S.multi && S.multi.length)){ S.sel = null; S.multi = []; updateSel(); }
    }
    if(e.key === 'Enter' && S.sel && S.sel.type === 'node'){ openNode(S.sel.id); }
  });
  function applyCursor(){ el.canvas.style.cursor = S.tool === 'select' ? 'default' : (S.tool === 'text' ? 'text' : 'crosshair'); }
