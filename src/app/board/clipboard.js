  /* ---------- выделить всё, копировать, вставить ---------- */
  function selectAll(){
    S.sel = null; hidePop();
    S.multi = G.nodes.map(function(n){ return { type:'node', id:n.id }; })
      .concat(G.notes.filter(function(t){ return !t.attach; }).map(function(t){ return { type:'note', id:t.id }; }));
    updateSel();
    toast(S.multi.length ? 'Выделено элементов: ' + S.multi.length : 'На доске пока пусто');
  }
  var clip = null, pasteN = 0;
  function copySel(){
    var items = S.multi && S.multi.length ? S.multi : (S.sel && (S.sel.type === 'node' || S.sel.type === 'note') ? [S.sel] : []);
    if(!items.length){ toast('Выделите блок или заметку, чтобы скопировать'); return; }
    var ids = items.filter(function(m){ return m.type === 'node'; }).map(function(m){ return m.id; });
    var nodes = G.nodes.filter(function(n){ return ids.indexOf(n.id) >= 0; });
    var notes = G.notes.filter(function(t){ return items.some(function(m){ return m.type === 'note' && m.id === t.id; }) || ids.indexOf(t.attach) >= 0; });
    var edges = G.edges.filter(function(e){ return ids.indexOf(e.from) >= 0 && ids.indexOf(e.to) >= 0; });
    clip = JSON.parse(JSON.stringify({ nodes:nodes, notes:notes, edges:edges }));
    clip.edges.forEach(function(e){ (e.taps || []).forEach(function(tp){ tp.nodes = tapIds(tp).filter(function(x){ return ids.indexOf(x) >= 0; }); }); });
    pasteN = 0;
    toast('Скопировано: ' + (nodes.length + notes.filter(function(t){ return !t.attach; }).length));
  }
  function pasteClip(){
    if(!clip){ toast('Буфер пуст — сначала скопируйте элементы'); return; }
    pasteN++;
    var off = 40 * pasteN, map = {}, c = JSON.parse(JSON.stringify(clip));
    S.multi = [];
    c.nodes.forEach(function(n){ var nid = newId('n'); map[n.id] = nid; n.id = nid; n.x += off; n.y += off; if(!/\(копия\)$/.test(n.name)) n.name += ' (копия)'; G.nodes.push(n); S.multi.push({ type:'node', id:nid }); });
    c.notes.forEach(function(t){
      t.id = newId('t');
      if(t.attach){ t.attach = map[t.attach]; if(!t.attach) return; }
      else { t.x += off; t.y += off; S.multi.push({ type:'note', id:t.id }); }
      G.notes.push(t);
    });
    c.edges.forEach(function(e){
      e.id = newId('e'); e.from = map[e.from]; e.to = map[e.to];
      (e.taps || []).forEach(function(tp){ tp.id = newId('p'); tp.nodes = tapIds(tp).map(function(x){ return map[x]; }).filter(Boolean); });
      G.edges.push(e);
    });
    S.sel = null; hidePop(); saveGraph(); renderGraph(); updateSel();
    toast('Вставлено: ' + S.multi.length);
  }
