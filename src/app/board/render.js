  /* ---------- блоки, связи, заметки ---------- */
  var HUB = 48;
  function NWof(n){ return n.kind === 'hub' ? HUB : (n.w || NW); }
  function NHof(n){ return n.kind === 'hub' ? HUB : (n.h || NH); }
  var NMIN_W = 140, NMIN_H = 64, NMAX_W = 640, NMAX_H = 420;
  function portOut(n){ return { x:n.x + NWof(n) - 1, y:n.y + NHof(n) / 2 }; }
  function portIn(n){ return { x:n.x - 2, y:n.y + NHof(n) / 2 }; }
  // Линия выходит из отростка вправо.
  // toPoint: цель — точка на связи или курсор: один плавный изгиб, без «петли» у конца.
  // Иначе цель — вход блока слева: S-образная линия; если блок левее — изгибы минимальные.
  function curve(a, b, toPoint){
    var ddx = b.x - a.x, ady = Math.abs(b.y - a.y);
    if(toPoint){
      var k = Math.max(24, Math.min(90, Math.abs(ddx) * 0.45, 24 + ady * 0.35));
      var c2x = ddx >= 0 ? b.x - Math.min(ddx * 0.35, 60) : b.x;
      return 'M' + a.x + ' ' + a.y + ' C' + (a.x + k) + ' ' + a.y + ' ' + c2x + ' ' + b.y + ' ' + b.x + ' ' + b.y;
    }
    var dx = ddx >= 40 ? Math.max(30, ddx / 2) : Math.min(90, Math.max(36, ady / 3, -ddx / 4));
    return 'M' + a.x + ' ' + a.y + ' C' + (a.x + dx) + ' ' + a.y + ' ' + (b.x - dx) + ' ' + b.y + ' ' + b.x + ' ' + b.y;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs){ var e = document.createElementNS(SVGNS, tag); for(var k in attrs) e.setAttribute(k, attrs[k]); return e; }

  function renderEdges(){
    miniDraw();
    el.edgeDefs.innerHTML = ''; el.edgeLayer.innerHTML = '';
    G.notes.forEach(function(t){
      if(!t.attach || t.hidden) return;
      var n = nodeById(t.attach), d = domOf('note', t.id);
      if(!n || !d) return;
      syncNote(t);
      var x1 = t.x + d.offsetWidth, y1 = t.y + d.offsetHeight / 2, x2 = n.x - 8, y2 = n.y + (n.kind === 'hub' ? HUB / 2 : 14);
      el.edgeLayer.appendChild(svg('path', { 'class':'clink', d:'M' + x1 + ' ' + y1 + ' C' + (x1 + 30) + ' ' + y1 + ' ' + (x2 - 30) + ' ' + y2 + ' ' + x2 + ' ' + y2 }));
    });
    edgePaths = {};
    var tapDraw = [], tlinkHits = [];
    G.edges.forEach(function(e){
      var a = nodeById(e.from), b = nodeById(e.to);
      if(!a || !b) return;
      var p = portOut(a), q = portIn(b), ca = colorsOf(a)[1], cb = colorsOf(b)[0];
      var gid = 'g_' + e.id;
      var gr = svg('linearGradient', { id:gid, gradientUnits:'userSpaceOnUse', x1:p.x, y1:p.y, x2:q.x + (q.x === p.x ? 1 : 0), y2:q.y });
      gr.appendChild(svg('stop', { offset:'0', 'stop-color':ca }));
      gr.appendChild(svg('stop', { offset:'1', 'stop-color':cb }));
      el.edgeDefs.appendChild(gr);
      var g = svg('g', { 'class':'edge-g' + (S.sel && S.sel.type === 'edge' && S.sel.id === e.id ? ' sel' : '') });
      var d = curve(p, q);
      var line = svg('path', { 'class':'edge', d:d, stroke:'url(#' + gid + ')' });
      g.appendChild(line);
      g.appendChild(svg('path', { 'class':'edge-hit', d:d, 'data-edge':e.id }));
      el.edgeLayer.appendChild(g);
      edgePaths[e.id] = line;
      var len = line.getTotalLength();
      g.appendChild(svg('circle', { 'class':'edge-end', cx:q.x, cy:q.y, r:5, fill:cb, stroke:'#12090B', 'stroke-width':2 }));
      g.appendChild(svg('circle', { 'class':'edge-handle', cx:q.x, cy:q.y, r:12, 'data-edge':e.id, 'data-end':'to' }));
      // точки на связи: блоки, подключённые в поток
      sortedTaps(e).forEach(function(tp, i){
        var pt = line.getPointAtLength(tp.t * len), srcs = tapNodes(tp);
        srcs.forEach(function(src){
          var td = curve(portOut(src), pt, true);
          tlinkHits.push(svg('path', { 'class':'tlink-hit', d:td, 'data-edge':e.id, 'data-tap':tp.id, 'data-node':src.id }));
          el.edgeLayer.insertBefore(svg('path', { 'class':'tap-link', d:td, stroke:colorsOf(src)[1] }), el.edgeLayer.firstChild);
        });
        tapDraw.push({ e:e, tp:tp, i:i, pt:pt, n:srcs.length, col:srcs.length ? colorsOf(srcs[0])[1] : '#C29CA4' });
      });
    });
    // точка на отростке нужна, только пока из блока не выходит ни одной связи
    var outs = {};
    G.edges.forEach(function(e){ outs[e.from] = true; (e.taps || []).forEach(function(tp){ tapIds(tp).forEach(function(id){ outs[id] = true; }); }); });
    Array.prototype.forEach.call(el.nodes.children, function(d){ d.classList.toggle('linked', !!outs[d.dataset.id]); });
    // зоны захвата отростков к точкам — поверх связей, чтобы отросток можно было снять в любом месте
    tlinkHits.forEach(function(x){ el.edgeLayer.appendChild(x); });
    tapDraw.forEach(function(o){
      var tp = o.tp, x = o.pt.x, y = o.pt.y, r = TAP_R[tp.size || 'm'];
      var g = svg('g', { 'class':'tap-g' + (S.sel && S.sel.type === 'tap' && S.sel.id === tp.id ? ' sel' : '') });
      g.appendChild(svg('circle', { 'class':'tap-dot', cx:x, cy:y, r:r, fill:tp.color || o.col, stroke:'#12090B', 'stroke-width':2 }));
      if(tp.showNum !== false){
        var tx = svg('text', { 'class':'tap-num', x:x, y:y + (r > 9 ? 4 : 3.5), 'text-anchor':'middle', style:'font-size:' + (r > 9 ? 12 : r < 7 ? 8 : 10) + 'px' }); tx.textContent = String(o.i + 1);
        g.appendChild(tx);
      }
      drawBadge(g, tp, x + r * 0.9, y - r * 0.9, o.n);
      if(tp.name && tp.showLabel !== false){
        var lfs = tp.fs || 11.5;
        var lb = svg('text', { x:x, y:y + r + 4 + lfs, 'text-anchor':'middle', 'pointer-events':'none', style:svgTextStyle(tp.ts, lfs) });
        lb.textContent = tp.name; g.appendChild(lb);
      }
      g.appendChild(svg('circle', { 'class':'tap-handle', cx:x, cy:y, r:Math.max(15, r + 6), 'data-edge':o.e.id, 'data-tap':tp.id }));
      el.edgeLayer.appendChild(g);
    });
    // счётчики входящих подключений у связующих точек (узлов)
    Array.prototype.forEach.call(el.nodes.children, function(d){
      var n = nodeById(d.dataset.id), old = d.querySelector('.hub-badge');
      if(old) old.remove();
      if(!n || n.kind !== 'hub' || !n.showCount) return;
      var cnt = incomingCount(n.id), b = document.createElement('span');
      b.className = 'hub-badge'; b.textContent = cnt; b.style.background = n.badgeColor || BADGE_COLORS[0]; b.style.color = bestText(n.badgeColor || BADGE_COLORS[0]);
      b.title = 'Входящих подключений: ' + cnt;
      d.appendChild(b);
    });
  }
  var edgePaths = {};
  var TAP_R = { s:6.5, m:8.5, l:11 };
  var BADGE_COLORS = ['#B91C1C', '#EA580C', '#CA8A04', '#16A34A', '#2563EB', '#7C3AED', '#6B7280'];
  var DOT_COLORS = ['#F87171', '#FB923C', '#FACC15', '#4ADE80', '#60A5FA', '#C084FC', '#E5E7EB'];
  function incomingCount(id){
    var c = 0;
    G.edges.forEach(function(e){ if(e.to === id) c++; });
    return c;
  }
  function drawBadge(g, tp, bx, by, count){
    if(!tp.showCount) return;
    var t = String(count), w = Math.max(13, 7 + t.length * 6);
    g.appendChild(svg('rect', { x:bx - w / 2, y:by - 6.5, width:w, height:13, rx:6.5, fill:tp.badgeColor || BADGE_COLORS[0], stroke:'#12090B', 'stroke-width':1.5, 'pointer-events':'none' }));
    var c = svg('text', { x:bx, y:by + 3.2, 'text-anchor':'middle', 'pointer-events':'none', style:'font:700 9px Inter,system-ui,sans-serif;fill:' + bestText(tp.badgeColor || BADGE_COLORS[0]) }); c.textContent = t;
    g.appendChild(c);
  }
  function sortedTaps(e){ return (e.taps || []).slice().sort(function(a, b){ return a.t - b.t; }); }
  // к одной точке можно подключить несколько блоков
  function tapIds(tp){
    if(!tp.nodes){ tp.nodes = tp.node ? [tp.node] : []; delete tp.node; }
    return tp.nodes;
  }
  function tapNodes(tp){ return tapIds(tp).map(nodeById).filter(Boolean); }
  function tapById(e, id){ return (e.taps || []).filter(function(x){ return x.id === id; })[0]; }
  function nearestOnEdge(e, w){
    var p = edgePaths[e.id]; if(!p) return null;
    var L = p.getTotalLength(), N = 60, best = null, i, s, q, d;
    for(i = 0; i <= N; i++){ s = i / N * L; q = p.getPointAtLength(s); d = (q.x - w.x) * (q.x - w.x) + (q.y - w.y) * (q.y - w.y); if(!best || d < best.d) best = { s:s, d:d, x:q.x, y:q.y }; }
    var step = L / N, s0 = best.s;
    for(i = -10; i <= 10; i++){ s = Math.max(0, Math.min(L, s0 + i * step / 10)); q = p.getPointAtLength(s); d = (q.x - w.x) * (q.x - w.x) + (q.y - w.y) * (q.y - w.y); if(d < best.d) best = { s:s, d:d, x:q.x, y:q.y }; }
    return { t:best.s / L, x:best.x, y:best.y, dist:Math.sqrt(best.d) };
  }
  function clampT(t){ return Math.max(0.04, Math.min(0.96, t)); }
  function addTap(e, t, nodeId){
    if(!e.taps) e.taps = [];
    var tp = { id:newId('p'), t:clampT(t), nodes:nodeId ? [nodeId] : [] };
    e.taps.push(tp); saveGraph();
    return tp;
  }
  function flowText(e){
    var a = nodeById(e.from), b = nodeById(e.to), parts = [ a ? a.name : '?' ];
    sortedTaps(e).forEach(function(tp, i){ var ns = tapNodes(tp); parts.push('точка ' + (i + 1) + (ns.length ? ': ' + ns.map(function(n){ return n.name; }).join(', ') : ' (пусто)')); });
    parts.push(b ? b.name : '?');
    return parts;
  }

  function nodeEl(n){
    var l = langById(n.lang) || { id:n.lang, name:String(n.lang) }, c = colorsOf(n);
    var d = document.createElement('div');
    d.className = 'node'; d.dataset.id = n.id;
    d.style.setProperty('--c1', c[0]); d.style.setProperty('--c2', c[1]);
    d.style.left = n.x + 'px'; d.style.top = n.y + 'px';
    d.innerHTML = '<div class="node-in"><div class="nh"><span class="ldot"></span><span class="ln"></span></div><div class="nt"></div><div class="nd"></div></div>' +
      '<span class="stem"></span><span class="port-dot" title="Потяните к другому блоку"></span>' +
      '<button type="button" class="xbtn" aria-label="Удалить блок" title="Удалить блок"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<span class="rz" title="Потяните, чтобы изменить размер (Shift — пропорционально)"></span>' +
      '<button type="button" class="cbtn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>';
    var cms = commentsOf(n.id), cb = d.querySelector('.cbtn');
    var filled = cms.filter(function(t){ return String(t.text || '').trim(); }).length;
    cb.setAttribute('aria-label', cms.length ? (cms[0].hidden ? 'Показать комментарии' : 'Скрыть комментарии') + (filled ? ' (' + filled + ')' : '') : 'Добавить комментарий к блоку');
    cb.title = cms.length ? (cms[0].hidden ? 'Показать комментарии' : 'Скрыть комментарии') : 'Комментарий к блоку';
    if(filled){ var cnt = document.createElement('span'); cnt.className = 'cnt'; cnt.textContent = filled; cb.appendChild(cnt); }
    if(cms.length && !cms[0].hidden) cb.classList.add('open');
    if(n.kind === 'hub'){
      d.classList.add('hub');
      d.insertAdjacentHTML('beforeend', '<span class="hub-ico"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M4 7l5 3M4 17l5-3M15.5 12H21"/></svg></span><span class="hub-label"></span><span class="hub-lang"></span>');
      d.querySelector('.hub-label').textContent = n.name;
      if(n.fs) d.querySelector('.hub-label').style.fontSize = n.fs + 'px';
      d.querySelector('.hub-lang').textContent = isDocs() ? 'сбор' : shortName(l);
      d.querySelector('.xbtn').setAttribute('aria-label', 'Удалить связующую точку');
    }
    d.querySelector('.ln').textContent = shortName(l);
    d.querySelector('.nt').textContent = n.name;
    d.querySelector('.nt').title = n.name;
    var nd = d.querySelector('.nd'), ndt = (isDocs() && isParamKind(n.lang) ? autoDesc(n) : '') || n.desc || autoDesc(n) || 'ПКМ — настройки · 2× — открыть · потрясти — отцепить связи';
    nd.textContent = ndt; nd.title = ndt;
    sizeNodeEl(d, n);
    if(n.fs) d.querySelector('.nt').style.fontSize = n.fs + 'px';
    if(n.dfs) nd.style.fontSize = n.dfs + 'px';
    if(n.ts){ styleHtml(d.querySelector('.nt'), n.ts); styleHtml(nd, n.ts, true); var hl = d.querySelector('.hub-label'); if(hl) styleHtml(hl, n.ts); }
    if(isSel('node', n.id)) d.classList.add('sel');
    applyRun(d, n.id);
    return d;
  }
  function sizeNodeEl(d, n){
    if(n.kind === 'hub') return;
    d.style.width = n.w ? n.w + 'px' : ''; d.style.height = n.h ? n.h + 'px' : '';
    var nd = d.querySelector('.nd'); if(!nd) return;
    var tall = NHof(n) >= 100;                  // в высоком блоке описание переносится на несколько строк
    nd.style.whiteSpace = tall ? 'normal' : 'nowrap'; nd.style.overflow = 'hidden'; nd.style.textOverflow = tall ? '' : 'ellipsis';
    nd.style.display = tall ? '-webkit-box' : ''; nd.style.webkitBoxOrient = tall ? 'vertical' : '';
    nd.style.webkitLineClamp = tall ? String(Math.max(1, Math.floor((NHof(n) - 60) / ((n.dfs || 11.5) * 1.35)))) : '';
  }
  function noteFs(t){ return t.fs || FS[t.size] || 14; }
  function commentsOf(nid){ return G.notes.filter(function(t){ return t.attach === nid; }); }
  function syncNote(t){
    if(!t.attach) return;
    var n = nodeById(t.attach);
    if(n){ t.x = n.x + t.dx; t.y = n.y + t.dy; }
  }
  function noteEl(t){
    syncNote(t);
    var d = document.createElement('div');
    d.className = 'note' + (t.attach ? ' comment' : ''); d.dataset.id = t.id;
    if(t.hidden) d.hidden = true;
    d.style.left = t.x + 'px'; d.style.top = t.y + 'px';
    d.style.setProperty('--tint', TINTS[t.tint] || TINTS.grey);
    d.style.setProperty('--fs', noteFs(t) + 'px');
    d.setAttribute('data-ph', t.attach ? 'Комментарий к блоку…' : 'Введите текст…');
    d.textContent = t.text || '';
    if(t.ts) styleHtml(d, t.ts);
    if(isSel('note', t.id)) d.classList.add('sel');
    return d;
  }
  function renderGraph(){
    el.nodes.innerHTML = ''; G.nodes.forEach(function(n){ el.nodes.appendChild(nodeEl(n)); });
    el.notes.innerHTML = ''; el.cnotes.innerHTML = ''; G.notes.forEach(function(t){
      // комментарии к блокам — поверх блоков, обычные заметки — под ними
      var d = noteEl(t); (t.attach ? el.cnotes : el.notes).appendChild(d);
      if(t.attach && t.auto && !t.hidden && d.offsetWidth){ t.dx = -(d.offsetWidth + 44); syncNote(t); d.style.left = t.x + 'px'; }
    });
    renderEdges();
    el.hint.hidden = G.nodes.length + G.notes.length > 0;
    status();
    if(typeof livePaint === 'function') livePaint();
  }
  // выделение: одиночное (S.sel) и групповое (S.multi — после Ctrl/⌘+A или вставки)
  function inMulti(type, id){ return (S.multi || []).some(function(m){ return m.type === type && m.id === id; }); }
  function isSel(type, id){ return !!(S.sel && S.sel.type === type && S.sel.id === id) || inMulti(type, id); }
  function updateSel(){
    Array.prototype.forEach.call(el.nodes.children, function(d){ d.classList.toggle('sel', isSel('node', d.dataset.id)); });
    Array.prototype.forEach.call(el.world.querySelectorAll('#notes > .note, #cnotes > .note'), function(d){ d.classList.toggle('sel', isSel('note', d.dataset.id)); });
    renderEdges(); status();
  }
  function domOf(type, id){ return type === 'note' ? (el.notes.querySelector('[data-id="' + id + '"]') || el.cnotes.querySelector('[data-id="' + id + '"]')) : el.nodes.querySelector('[data-id="' + id + '"]'); }

  function viewCenter(){ var r = el.canvas.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); }
  function addNode(lang, name, x, y, pluginId, kind){
    var p = pluginId && pluginById(pluginId);
    var n = { id:newId('n'), name:name, lang:lang, x:Math.round(x), y:Math.round(y), codes:{},
      pluginId:pluginId || null, family:(p && p.family) || null, desc:(p && p.desc) || '', colors:null };
    if(kind === 'hub'){ n.kind = 'hub'; n.desc = 'Объединяет входящие потоки'; }
    S.multi = [];
    G.nodes.push(n);
    S.sel = { type:'node', id:n.id };
    saveGraph(); renderGraph();
    return n;
  }
  function openOnBoard(pid){
    var p = pluginById(pid);
    S.lib = false;
    if(S.view !== 'canvas'){ S.view = 'canvas'; }
    render();
    var c = viewCenter(), off = (G.nodes.length % 6) * 28;
    if(S.placeAt){ c = S.placeAt; off = 0; S.placeAt = null; }
    var n = addNode(p.lang, p.name, c.x - NW / 2 + off, c.y - NH / 2 + off, p.id);
    toast('«' + p.name + '» добавлен на доску');
    return n;
  }
  function deleteSel(){
    if(S.multi && S.multi.length){
      var ids = S.multi.filter(function(m){ return m.type === 'node'; }).map(function(m){ return m.id; });
      var tids = S.multi.filter(function(m){ return m.type === 'note'; }).map(function(m){ return m.id; });
      G.nodes = G.nodes.filter(function(n){ return ids.indexOf(n.id) < 0; });
      G.edges = G.edges.filter(function(e){ return ids.indexOf(e.from) < 0 && ids.indexOf(e.to) < 0; });
      G.notes = G.notes.filter(function(t){ return tids.indexOf(t.id) < 0 && ids.indexOf(t.attach) < 0; });
      G.edges.forEach(function(e){ (e.taps || []).forEach(function(tp){ tp.nodes = tapIds(tp).filter(function(x){ return ids.indexOf(x) < 0; }); }); });
      toast('Удалено элементов: ' + S.multi.length);
      S.multi = []; S.sel = null; hidePop(); saveGraph(); renderGraph(); return;
    }
    if(!S.sel) return;
    var id = S.sel.id;
    if(S.sel.type === 'node'){
      G.nodes = G.nodes.filter(function(n){ return n.id !== id; });
      G.edges = G.edges.filter(function(e){ return e.from !== id && e.to !== id; });
      G.notes = G.notes.filter(function(t){ return t.attach !== id; });
      G.edges.forEach(function(e){ (e.taps || []).forEach(function(tp){ tp.nodes = tapIds(tp).filter(function(x){ return x !== id; }); }); });
    } else if(S.sel.type === 'edge'){
      G.edges = G.edges.filter(function(e){ return e.id !== id; });
    } else if(S.sel.type === 'tap'){
      var te = edgeById(S.sel.edge); if(te) te.taps = (te.taps || []).filter(function(x){ return x.id !== id; });
    } else {
      G.notes = G.notes.filter(function(t){ return t.id !== id; });
    }
    S.sel = null; hidePop(); saveGraph(); renderGraph();
  }

  function addComment(n){
    var off = commentsOf(n.id).length * 16;
    var t = { id:newId('t'), text:'', attach:n.id, dx:-184 - off, dy:off, size:'s', tint:'grey', hidden:false, auto:true };
    commentsOf(n.id).forEach(function(c){ c.hidden = false; });
    G.notes.push(t);
    S.sel = { type:'note', id:t.id };
    hidePop(); renderGraph(); updateSel(); saveGraph();
    editNote(t.id);
  }
  function toggleComments(n){
    var cms = commentsOf(n.id);
    if(!cms.length){ addComment(n); return; }
    var hide = !cms[0].hidden;
    if(editingNote && document.activeElement) document.activeElement.blur();
    if(hide){
      // пустые комментарии при сворачивании убираем — счётчик показывает только настоящие
      var empty = cms.filter(function(c){ return !String(c.text || '').trim(); }).map(function(c){ return c.id; });
      if(empty.length){ G.notes = G.notes.filter(function(t){ return empty.indexOf(t.id) < 0; }); cms = commentsOf(n.id); }
    }
    cms.forEach(function(c){ c.hidden = hide; });
    if(hide && S.sel && S.sel.type === 'note' && cms.some(function(c){ return c.id === S.sel.id; })){ S.sel = null; hidePop(); }
    saveGraph(); renderGraph();
    if(!hide){ var first = cms[cms.length - 1]; S.sel = { type:'note', id:first.id }; updateSel(); editNote(first.id); }
  }
