  // ---------- выравнивание, сдвиг, дублирование, авто-раскладка ----------
  function selObjs(){
    var arr = S.multi && S.multi.length ? S.multi : (S.sel ? [S.sel] : []);
    return arr.map(function(m){
      if(m.type === 'node'){ var n = nodeById(m.id); return n ? { type:'node', o:n, w:NWof(n), h:NHof(n) } : null; }
      if(m.type === 'note'){ var t = noteById(m.id); if(!t || t.attach) return null; var d = domOf('note', t.id); return { type:'note', o:t, w:d ? d.offsetWidth : 160, h:d ? d.offsetHeight : 40 }; }
      return null;
    }).filter(Boolean);
  }
  function afterMove(){
    G.nodes.forEach(function(n){ commentsOf(n.id).forEach(syncNote); });
    saveGraph(); renderGraph(); if(S.pop) placePop();
  }
  function alignSel(mode){
    var a = selObjs();
    if(a.length < 2){ toast('Выделите несколько элементов: Shift+клик или Shift+рамка'); return; }
    var minX = Math.min.apply(0, a.map(function(x){ return x.o.x; })), maxX = Math.max.apply(0, a.map(function(x){ return x.o.x + x.w; }));
    var minY = Math.min.apply(0, a.map(function(x){ return x.o.y; })), maxY = Math.max.apply(0, a.map(function(x){ return x.o.y + x.h; }));
    if(mode === 'left') a.forEach(function(x){ x.o.x = minX; });
    if(mode === 'right') a.forEach(function(x){ x.o.x = maxX - x.w; });
    if(mode === 'hc') a.forEach(function(x){ x.o.x = Math.round((minX + maxX) / 2 - x.w / 2); });
    if(mode === 'top') a.forEach(function(x){ x.o.y = minY; });
    if(mode === 'bottom') a.forEach(function(x){ x.o.y = maxY - x.h; });
    if(mode === 'vc') a.forEach(function(x){ x.o.y = Math.round((minY + maxY) / 2 - x.h / 2); });
    if(mode === 'dh' || mode === 'dv'){
      var hz = mode === 'dh', key = hz ? 'x' : 'y', sz = hz ? 'w' : 'h';
      a.sort(function(p, q){ return p.o[key] - q.o[key]; });
      var total = a.reduce(function(s, x){ return s + x[sz]; }, 0), span = (hz ? maxX - minX : maxY - minY);
      var gap = Math.max(24, (span - total) / (a.length - 1)), pos = hz ? minX : minY;
      a.forEach(function(x){ x.o[key] = Math.round(pos); pos += x[sz] + gap; });
    }
    afterMove();
  }
  function alignItems(){
    return [
      { label:'По левому краю', icon:'align', act:function(){ alignSel('left'); } },
      { label:'По центру (горизонтально)', icon:'align', act:function(){ alignSel('hc'); } },
      { label:'По правому краю', icon:'align', act:function(){ alignSel('right'); } },
      { sep:true },
      { label:'По верхнему краю', icon:'align', act:function(){ alignSel('top'); } },
      { label:'По середине (вертикально)', icon:'align', act:function(){ alignSel('vc'); } },
      { label:'По нижнему краю', icon:'align', act:function(){ alignSel('bottom'); } },
      { sep:true },
      { label:'Распределить по горизонтали', icon:'layout', act:function(){ alignSel('dh'); } },
      { label:'Распределить по вертикали', icon:'layout', act:function(){ alignSel('dv'); } }
    ];
  }
  function nudgeSel(e){
    var a = selObjs(); if(!a.length) return false;
    var st = e.shiftKey ? 10 : (UI.snap ? GRID : 1);
    var dx = e.key === 'ArrowLeft' ? -st : (e.key === 'ArrowRight' ? st : 0), dy = e.key === 'ArrowUp' ? -st : (e.key === 'ArrowDown' ? st : 0);
    a.forEach(function(x){ x.o.x += dx; x.o.y += dy; });
    afterMove(); return true;
  }
  function dupSel(){
    var keep = clip, kn = pasteN;
    copySel();
    if(clip && clip !== keep){ pasteN = 0; pasteClip(); }
    clip = keep; pasteN = kn;
  }
  function autoLayout(){
    if(G.nodes.length < 2){ toast('Нужно хотя бы два блока'); return; }
    var plan = boardOrder(), lvl = {}, maxL = 0;
    plan.order.forEach(function(n){
      var L = 0; plan.preds[n.id].forEach(function(p){ if(lvl[p] !== undefined) L = Math.max(L, lvl[p] + 1); });
      lvl[n.id] = L; maxL = Math.max(maxL, L);
    });
    plan.cyclic.forEach(function(n){ lvl[n.id] = maxL + 1; });
    var cols = {}; G.nodes.forEach(function(n){ (cols[lvl[n.id]] = cols[lvl[n.id]] || []).push(n); });
    var x0 = Math.min.apply(0, G.nodes.map(function(n){ return n.x; }));
    var cy = G.nodes.reduce(function(s, n){ return s + n.y + NHof(n) / 2; }, 0) / G.nodes.length;
    var colW = NW + 120, rowH = NH + 48;
    Object.keys(cols).forEach(function(L){
      var col = cols[L].sort(function(p, q){ return p.y - q.y; }), top = cy - (col.length * rowH - 48) / 2;
      col.forEach(function(n, i){
        n.x = Math.round(x0 + L * colW + (NW - NWof(n)) / 2);
        n.y = Math.round(top + i * rowH + (NH - NHof(n)) / 2);
        if(UI.snap){ n.x = Math.round(n.x / GRID) * GRID; n.y = Math.round(n.y / GRID) * GRID; }
      });
    });
    afterMove(); setTimeout(fitView, 20);
    toast('Блоки расставлены по порядку выполнения — ' + MOD + 'Z, чтобы вернуть');
  }
