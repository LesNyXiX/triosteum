  /* =====================================================================
     ВЕКТОРНАЯ ГРАФИКА: монтажная область с объектами SVG. Фигуры, перо
     с кривыми Безье, карандаш, звёзды и многоугольники, текст, картинки.
     Выделение, масштаб и поворот рамкой, правка узлов, группы, выравнивание,
     распределение, слои, градиенты, тени, привязки, история, экспорт SVG/PNG.
     ===================================================================== */
  var VE = { f:null };
  var VE_TOOLS = [
    ['select', 'Выделение (V)', 'V', '<path d="M5 3l14 8-6 2-2 6z"/>'],
    ['node', 'Правка узлов (A)', 'A', '<path d="M5 3l14 8-6 2-2 6z" fill="currentColor"/>'],
    ['rect', 'Прямоугольник (M)', 'M', '<rect x="4" y="5" width="16" height="14" rx="1"/>'],
    ['ellipse', 'Эллипс (L)', 'L', '<ellipse cx="12" cy="12" rx="8" ry="7"/>'],
    ['line', 'Линия (\\)', '', '<path d="M5 19L19 5"/>'],
    ['star', 'Звезда (S)', 'S', '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'],
    ['polygon', 'Многоугольник (Y)', 'Y', '<path d="M12 3l8 6-3 10H7L4 9z"/>'],
    ['pen', 'Перо (P): клик — угол, протяжка — кривая', 'P', '<path d="M12 3l7 7-7 11-7-11z"/><circle cx="12" cy="11" r="1.5"/>'],
    ['pencil', 'Карандаш (N)', 'N', '<path d="M4 20l4-1 11-11-3-3L5 16z"/>'],
    ['text', 'Текст (T)', 'T', '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'],
    ['picker', 'Пипетка (I): взять стиль объекта', 'I', '<path d="M14 4l6 6-2 2-6-6zM12 6L4 14v6h6l8-8"/>'],
    ['hand', 'Рука (H, пробел)', 'H', '<path d="M8 13V5a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 11V5.5a1.5 1.5 0 013 0V14c0 4-3 7-7 7s-6-3-7-6l-1-3a1.5 1.5 0 012.7-1L8 13"/>']
  ];
  var VE_FONTS = ['Inter, system-ui, sans-serif', 'Georgia, serif', '"Times New Roman", serif', 'Arial, sans-serif', '"Courier New", monospace', 'Impact, sans-serif'];
  function veId(){ return 'v' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
  function veItems(){ return VE.f.data.items; }
  function veById(id, list){ list = list || veItems(); for(var i = 0; i < list.length; i++){ if(list[i].id === id) return list[i]; } return null; }
  function veSelItems(){ return VE.sel.map(function(id){ return veById(id); }).filter(Boolean); }
  function veEsc(s){ return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function veNum(v){ return Math.round(v * 100) / 100; }
  // ---------- геометрия ----------
  function veRot(p, c, deg){ var a = deg * Math.PI / 180, s = Math.sin(a), co = Math.cos(a), dx = p.x - c.x, dy = p.y - c.y; return { x:c.x + dx * co - dy * s, y:c.y + dx * s + dy * co }; }
  function veCorners(o){ var c = { x:o.x + o.w / 2, y:o.y + o.h / 2 }; return [{ x:o.x, y:o.y }, { x:o.x + o.w, y:o.y }, { x:o.x + o.w, y:o.y + o.h }, { x:o.x, y:o.y + o.h }].map(function(p){ return veRot(p, c, o.r || 0); }); }
  function veBBox(list){ var xs = [], ys = []; list.forEach(function(o){ veCorners(o).forEach(function(p){ xs.push(p.x); ys.push(p.y); }); }); if(!xs.length) return null; var x0 = Math.min.apply(0, xs), y0 = Math.min.apply(0, ys); return { x:x0, y:y0, w:Math.max.apply(0, xs) - x0, h:Math.max.apply(0, ys) - y0 }; }
  function veStarPts(n, ir, poly){ var pts = [], k = poly ? n : n * 2; for(var i = 0; i < k; i++){ var a = -Math.PI / 2 + i * Math.PI * 2 / k, r = poly || i % 2 === 0 ? 0.5 : 0.5 * ir; pts.push({ x:0.5 + r * Math.cos(a), y:0.5 + r * Math.sin(a) }); } return pts; }
  function vePathD(o){
    var w = o.w, hh = o.h, P = o.pts || [], d = '';
    P.forEach(function(p, i){
      var x = p.x * w, y = p.y * hh;
      if(!i){ d += 'M' + veNum(x) + ' ' + veNum(y); return; }
      var q = P[i - 1]; if(q.c2 || p.c1){ var a = q.c2 || [q.x, q.y], b = p.c1 || [p.x, p.y]; d += ' C' + veNum(a[0] * w) + ' ' + veNum(a[1] * hh) + ' ' + veNum(b[0] * w) + ' ' + veNum(b[1] * hh) + ' ' + veNum(x) + ' ' + veNum(y); }
      else d += ' L' + veNum(x) + ' ' + veNum(y);
    });
    if(o.closed && P.length > 1){ var l = P[P.length - 1], f = P[0]; if(l.c2 || f.c1){ var a2 = l.c2 || [l.x, l.y], b2 = f.c1 || [f.x, f.y]; d += ' C' + veNum(a2[0] * w) + ' ' + veNum(a2[1] * hh) + ' ' + veNum(b2[0] * w) + ' ' + veNum(b2[1] * hh) + ' ' + veNum(f.x * w) + ' ' + veNum(f.y * hh); } d += ' Z'; }
    return d;
  }
  // нормализация точек в рамку 0..1 (после создания пером или карандашом)
  function veFromWorld(pts, closed, style){
    var xs = [], ys = []; pts.forEach(function(p){ xs.push(p.x); ys.push(p.y); if(p.c1){ xs.push(p.c1[0]); ys.push(p.c1[1]); } if(p.c2){ xs.push(p.c2[0]); ys.push(p.c2[1]); } });
    var x0 = Math.min.apply(0, xs), y0 = Math.min.apply(0, ys), w = Math.max(1, Math.max.apply(0, xs) - x0), hh = Math.max(1, Math.max.apply(0, ys) - y0);
    var n = function(a){ return [(a[0] - x0) / w, (a[1] - y0) / hh]; };
    return Object.assign({ id:veId(), t:'path', x:x0, y:y0, w:w, h:hh, r:0, closed:closed, pts:pts.map(function(p){ return { x:(p.x - x0) / w, y:(p.y - y0) / hh, c1:p.c1 ? n(p.c1) : null, c2:p.c2 ? n(p.c2) : null }; }) }, style);
  }
  function veSimplify(pts, eps){
    if(pts.length < 3) return pts;
    function dist(p, a, b){ var dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy; if(!l) return Math.hypot(p.x - a.x, p.y - a.y); var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); }
    var md = 0, idx = 0; for(var i = 1; i < pts.length - 1; i++){ var d = dist(pts[i], pts[0], pts[pts.length - 1]); if(d > md){ md = d; idx = i; } }
    if(md > eps){ var a = veSimplify(pts.slice(0, idx + 1), eps), b = veSimplify(pts.slice(idx), eps); return a.slice(0, -1).concat(b); }
    return [pts[0], pts[pts.length - 1]];
  }
  function veSmooth(pts){ return pts.map(function(p, i){ var a = pts[i - 1] || p, b = pts[i + 1] || p, k = 1 / 6; var o = { x:p.x, y:p.y }; if(i > 0) o.c1 = [p.x - (b.x - a.x) * k, p.y - (b.y - a.y) * k]; if(i < pts.length - 1) o.c2 = [p.x + (b.x - a.x) * k, p.y + (b.y - a.y) * k]; return o; }); }
  function veToCurves(o){
    if(o.t === 'path') return o;
    var pts;
    if(o.t === 'rect') pts = [{ x:0, y:0 }, { x:1, y:0 }, { x:1, y:1 }, { x:0, y:1 }];
    else if(o.t === 'line') pts = [{ x:0, y:0 }, { x:1, y:1 }];
    else if(o.t === 'star' || o.t === 'polygon') pts = veStarPts(o.n || 5, o.ir || 0.5, o.t === 'polygon');
    else if(o.t === 'ellipse'){ var k = 0.5523 / 2; pts = [{ x:0.5, y:0, c1:[0.5 - k, 0], c2:[0.5 + k, 0] }, { x:1, y:0.5, c1:[1, 0.5 - k], c2:[1, 0.5 + k] }, { x:0.5, y:1, c1:[0.5 + k, 1], c2:[0.5 - k, 1] }, { x:0, y:0.5, c1:[0, 0.5 + k], c2:[0, 0.5 - k] }]; }
    else return o;
    if(o.t === 'line' && o.flip) pts = [{ x:0, y:1 }, { x:1, y:0 }];
    var n = Object.assign({}, o, { t:'path', pts:pts.map(function(p){ return { x:p.x, y:p.y, c1:p.c1 || null, c2:p.c2 || null }; }), closed:o.t !== 'line' });
    delete n.n; delete n.ir; delete n.rx; return n;
  }
  // ---------- отрисовка SVG ----------
  function veFillAttr(o, defs){
    if(!o.fill || o.fill === 'none') return 'none';
    if(o.fill2){ var gid = 'g' + o.id; defs.push('<linearGradient id="' + gid + '" gradientTransform="rotate(' + (o.gang || 0) + ' .5 .5)"><stop offset="0" stop-color="' + veEsc(o.fill) + '"/><stop offset="1" stop-color="' + veEsc(o.fill2) + '"/></linearGradient>'); return 'url(#' + gid + ')'; }
    return veEsc(o.fill);
  }
  function veShape(o, defs, live){
    var w = Math.max(0.01, o.w), hh = Math.max(0.01, o.h), st = ' fill="' + veFillAttr(o, defs) + '" stroke="' + (o.stroke && o.sw ? veEsc(o.stroke) : 'none') + '" stroke-width="' + (o.sw || 0) + '"' + (o.dash ? ' stroke-dasharray="' + veEsc(o.dash) + '"' : '') + ' stroke-linecap="' + (o.cap || 'round') + '" stroke-linejoin="' + (o.join || 'round') + '"';
    if(o.t === 'rect') return '<rect width="' + veNum(w) + '" height="' + veNum(hh) + '" rx="' + (o.rx || 0) + '"' + st + '/>';
    if(o.t === 'ellipse') return '<ellipse cx="' + veNum(w / 2) + '" cy="' + veNum(hh / 2) + '" rx="' + veNum(w / 2) + '" ry="' + veNum(hh / 2) + '"' + st + '/>';
    if(o.t === 'line') return '<line x1="0" y1="' + (o.flip ? veNum(hh) : 0) + '" x2="' + veNum(w) + '" y2="' + (o.flip ? 0 : veNum(hh)) + '"' + st.replace(/ fill="[^"]*"/, ' fill="none"') + (o.arrow ? ' marker-end="url(#ar' + o.id + ')"' : '') + '/>' + (o.arrow ? (defs.push('<marker id="ar' + o.id + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="' + veEsc(o.stroke) + '"/></marker>'), '') : '');
    if(o.t === 'star' || o.t === 'polygon') return '<polygon points="' + veStarPts(o.n || 5, o.ir || 0.5, o.t === 'polygon').map(function(p){ return veNum(p.x * w) + ',' + veNum(p.y * hh); }).join(' ') + '"' + st + '/>';
    if(o.t === 'path') return '<path d="' + vePathD(o) + '"' + (o.closed ? st : st.replace(/ fill="[^"]*"/, ' fill="' + (o.fill && o.fill !== 'none' ? veFillAttr(o, defs) : 'none') + '"')) + '/>';
    if(o.t === 'text'){ var lines = String(o.text || '').split('\n'), anchor = o.al === 'middle' ? 'middle' : (o.al === 'end' ? 'end' : 'start'), ax = anchor === 'middle' ? w / 2 : (anchor === 'end' ? w : 0);
      return '<text x="' + veNum(ax) + '" y="0" font-family="' + veEsc(o.ff || VE_FONTS[0]) + '" font-size="' + (o.fs || 32) + '" font-weight="' + (o.fw ? 700 : 400) + '" font-style="' + (o.fi ? 'italic' : 'normal') + '" text-anchor="' + anchor + '" dominant-baseline="hanging"' + st.replace(/ stroke-linecap="[^"]*" stroke-linejoin="[^"]*"/, '') + (o.sw ? ' paint-order="stroke"' : '') + '>' + lines.map(function(l, i){ return '<tspan x="' + veNum(ax) + '" dy="' + (i ? (o.fs || 32) * 1.2 : 0) + '">' + veEsc(l || ' ') + '</tspan>'; }).join('') + '</text>'; }
    if(o.t === 'image'){ var src = o.data || ''; if(!src && o.src){ var f = ofFile(o.src); src = f && (f.data.prev || f.data.thumb) || ''; } return '<image href="' + veEsc(src) + '" width="' + veNum(w) + '" height="' + veNum(hh) + '" preserveAspectRatio="none"/>'; }
    if(o.t === 'svg') return '<svg viewBox="' + veEsc(o.vb) + '" width="' + veNum(w) + '" height="' + veNum(hh) + '" preserveAspectRatio="none" overflow="visible">' + o.markup + '</svg>';
    if(o.t === 'group'){ var sx = w / (o.w0 || w), sy = hh / (o.h0 || hh); return '<g transform="scale(' + veNum(sx * 1000) / 1000 + ' ' + veNum(sy * 1000) / 1000 + ')">' + (o.children || []).map(function(c){ return veItemSvg(c, defs, live); }).join('') + '</g>'; }
    return '';
  }
  function veItemSvg(o, defs, live){
    if(o.hidden) return '';
    var filt = '';
    if(o.shadow){ var fid = 'sh' + o.id; defs.push('<filter id="' + fid + '" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="' + (o.shadow.dx || 4) + '" dy="' + (o.shadow.dy || 6) + '" stdDeviation="' + (o.shadow.b || 6) + '" flood-color="' + veEsc(o.shadow.c || '#000') + '" flood-opacity="' + (o.shadow.o === undefined ? 0.35 : o.shadow.o) + '"/></filter>'); filt = ' filter="url(#' + fid + ')"'; }
    var tr = 'translate(' + veNum(o.x) + ' ' + veNum(o.y) + ')' + (o.r ? ' rotate(' + veNum(o.r) + ' ' + veNum(o.w / 2) + ' ' + veNum(o.h / 2) + ')' : '');
    return '<g' + (live ? ' data-id="' + o.id + '"' : '') + ' transform="' + tr + '"' + (o.op !== undefined && o.op < 1 ? ' opacity="' + o.op + '"' : '') + (o.blend && o.blend !== 'normal' ? ' style="mix-blend-mode:' + veEsc(o.blend) + '"' : '') + filt + '>' + veShape(o, defs, live) + '</g>';
  }
  function vecSvgString(f, live){
    var d = f.data, defs = [], body = (d.items || []).map(function(o){ return veItemSvg(o, defs, live); }).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + d.w + ' ' + d.h + '" width="' + d.w + '" height="' + d.h + '">' + (defs.length ? '<defs>' + defs.join('') + '</defs>' : '') + (d.bg && d.bg !== 'transparent' ? '<rect width="100%" height="100%" fill="' + veEsc(d.bg) + '"/>' : '') + body + '</svg>';
  }
  var veRaf = null;
  function veRender(){ if(veRaf) return; veRaf = requestAnimationFrame(function(){ veRaf = null; veRenderNow(); }); }
  function veRenderNow(){
    var art = $('veArt'); if(!art || !VE.f) return;
    var d = VE.f.data, defs = [];
    art.setAttribute('viewBox', '0 0 ' + d.w + ' ' + d.h); art.setAttribute('width', d.w); art.setAttribute('height', d.h);
    var grid = '';
    if(VE.grid){ var g = VE.gridSize; grid = '<defs><pattern id="veGrid" width="' + g + '" height="' + g + '" patternUnits="userSpaceOnUse"><path d="M' + g + ' 0H0V' + g + '" fill="none" stroke="rgba(100,116,139,.25)" stroke-width="' + (1 / VE.zoom) + '"/></pattern></defs>'; }
    var body = d.items.map(function(o){ return veItemSvg(o, defs, true); }).join('');
    art.innerHTML = (defs.length ? '<defs>' + defs.join('') + '</defs>' : '') + grid + '<rect class="ve-bg" width="' + d.w + '" height="' + d.h + '" fill="' + (d.bg && d.bg !== 'transparent' ? veEsc(d.bg) : 'url(#veChk)') + '"/>' + (d.bg === 'transparent' ? '' : '') + body + (VE.grid ? '<rect width="' + d.w + '" height="' + d.h + '" fill="url(#veGrid)" pointer-events="none"/>' : '');
    if(d.bg === 'transparent'){ art.querySelector('.ve-bg').setAttribute('fill', '#fff'); art.querySelector('.ve-bg').setAttribute('fill-opacity', '0.04'); }
    veHandles();
  }
  // рамка выделения, ручки, узлы, направляющие
  function veHandles(){
    var hs = $('veHud'); if(!hs) return; var d = VE.f.data, k = 1 / VE.zoom, out = '';
    hs.setAttribute('viewBox', '0 0 ' + d.w + ' ' + d.h); hs.setAttribute('width', d.w); hs.setAttribute('height', d.h);
    (VE.guides || []).forEach(function(g){ out += g.v ? '<line x1="' + g.v + '" y1="-10000" x2="' + g.v + '" y2="10000" stroke="#EC4899" stroke-width="' + k + '"/>' : '<line x1="-10000" y1="' + g.h + '" x2="10000" y2="' + g.h + '" stroke="#EC4899" stroke-width="' + k + '"/>'; });
    if(VE.marquee){ var m = VE.marquee; out += '<rect x="' + Math.min(m.a.x, m.b.x) + '" y="' + Math.min(m.a.y, m.b.y) + '" width="' + Math.abs(m.b.x - m.a.x) + '" height="' + Math.abs(m.b.y - m.a.y) + '" fill="rgba(37,99,235,.08)" stroke="#2563EB" stroke-width="' + k + '" stroke-dasharray="' + 4 * k + ' ' + 3 * k + '"/>'; }
    if(VE.draft) out += VE.draft(k);
    var sel = veSelItems();
    if(sel.length && VE.tool !== 'node'){
      var one = sel.length === 1 ? sel[0] : null, b = one ? { x:one.x, y:one.y, w:one.w, h:one.h, r:one.r || 0 } : Object.assign(veBBox(sel), { r:0 });
      var c = { x:b.x + b.w / 2, y:b.y + b.h / 2 };
      out += '<g transform="rotate(' + b.r + ' ' + c.x + ' ' + c.y + ')"><rect x="' + b.x + '" y="' + b.y + '" width="' + Math.max(0, b.w) + '" height="' + Math.max(0, b.h) + '" fill="none" stroke="#2563EB" stroke-width="' + 1.2 * k + '"/>';
      if(!(one && one.locked)){
        var s = 8 * k; [['nw', b.x, b.y], ['n', b.x + b.w / 2, b.y], ['ne', b.x + b.w, b.y], ['e', b.x + b.w, b.y + b.h / 2], ['se', b.x + b.w, b.y + b.h], ['s', b.x + b.w / 2, b.y + b.h], ['sw', b.x, b.y + b.h], ['w', b.x, b.y + b.h / 2]].forEach(function(p){ out += '<rect class="ve-h" data-h="' + p[0] + '" x="' + (p[1] - s / 2) + '" y="' + (p[2] - s / 2) + '" width="' + s + '" height="' + s + '" fill="#fff" stroke="#2563EB" stroke-width="' + k + '"/>'; });
        out += '<line x1="' + (b.x + b.w / 2) + '" y1="' + b.y + '" x2="' + (b.x + b.w / 2) + '" y2="' + (b.y - 26 * k) + '" stroke="#2563EB" stroke-width="' + k + '"/><circle class="ve-h" data-h="rot" cx="' + (b.x + b.w / 2) + '" cy="' + (b.y - 26 * k) + '" r="' + 5 * k + '" fill="#fff" stroke="#2563EB" stroke-width="' + k + '"/>';
      }
      out += '</g>';
    }
    if(VE.tool === 'node' && sel.length === 1 && sel[0].t === 'path'){
      var o = sel[0], cc = { x:o.x + o.w / 2, y:o.y + o.h / 2 }, W = function(p){ return veRot({ x:o.x + p[0] * o.w, y:o.y + p[1] * o.h }, cc, o.r || 0); };
      o.pts.forEach(function(p, i){
        var P = W([p.x, p.y]);
        ['c1', 'c2'].forEach(function(cn){ if(p[cn]){ var Q = W(p[cn]); out += '<line x1="' + P.x + '" y1="' + P.y + '" x2="' + Q.x + '" y2="' + Q.y + '" stroke="#94A3B8" stroke-width="' + k + '"/><circle class="ve-h" data-n="' + i + '" data-c="' + cn + '" cx="' + Q.x + '" cy="' + Q.y + '" r="' + 4 * k + '" fill="#fff" stroke="#64748B" stroke-width="' + k + '"/>'; } });
        out += '<rect class="ve-h" data-n="' + i + '" x="' + (P.x - 5 * k) + '" y="' + (P.y - 5 * k) + '" width="' + 10 * k + '" height="' + 10 * k + '" fill="' + (VE.node === i ? '#2563EB' : '#fff') + '" stroke="#2563EB" stroke-width="' + k + '"/>';
      });
      out += '<path d="' + vePathD(o) + '" transform="translate(' + o.x + ' ' + o.y + ')' + (o.r ? ' rotate(' + o.r + ' ' + o.w / 2 + ' ' + o.h / 2 + ')' : '') + '" fill="none" stroke="#2563EB" stroke-width="' + k + '" pointer-events="none"/>';
    }
    hs.innerHTML = out;
  }
  // ---------- история и сохранение ----------
  function vePush(label){ VE.undo.push({ d:JSON.stringify(VE.f.data), sel:VE.sel.slice(), label:label || 'Изменение' }); if(VE.undo.length > 80) VE.undo.shift(); VE.redo = []; }
  function veUndo(){ if(!VE.undo.length){ toast('Нечего отменять'); return; } var u = VE.undo.pop(); VE.redo.push({ d:JSON.stringify(VE.f.data), sel:VE.sel.slice(), label:u.label }); VE.f.data = JSON.parse(u.d); VE.sel = u.sel.filter(function(id){ return veById(id); }); veChanged(true); toast('Отменено: ' + u.label); }
  function veRedo(){ if(!VE.redo.length){ toast('Нечего повторять'); return; } var r = VE.redo.pop(); VE.undo.push({ d:JSON.stringify(VE.f.data), sel:VE.sel.slice(), label:r.label }); VE.f.data = JSON.parse(r.d); VE.sel = r.sel.filter(function(id){ return veById(id); }); veChanged(true); }
  var veSaveT = null;
  function veChanged(all){ veRender(); if(all !== false){ vePanels(); } clearTimeout(veSaveT); veSaveT = setTimeout(function(){ if(VE.f){ VE.f.t = Date.now(); saveGraph(); } }, 400); veStatus(); }
  function veStatus(){ if(!VE.f || OF.tab !== VE.f.id) return; var s = veSelItems(); el.stLeft.textContent = 'Векторный рисунок «' + VE.f.name + '» · ' + VE.f.data.w + '×' + VE.f.data.h + ' · объектов ' + veItems().length + (s.length ? ' · выделено ' + s.length + (s.length === 1 ? ' (' + veTypeName(s[0]) + ' ' + Math.round(s[0].w) + '×' + Math.round(s[0].h) + ')' : '') : '') + (VE.cursor ? ' · x ' + Math.round(VE.cursor.x) + ', y ' + Math.round(VE.cursor.y) : ''); }
  function veTypeName(o){ return ({ rect:'прямоугольник', ellipse:'эллипс', line:'линия', star:'звезда', polygon:'многоугольник', path:'кривая', text:'текст', image:'картинка', group:'группа', svg:'SVG' })[o.t] || o.t; }
  // ---------- вид ----------
  function veApplyView(){ var s = $('veStage'); if(s) s.style.transform = 'translate(' + VE.pan.x + 'px,' + VE.pan.y + 'px) scale(' + VE.zoom + ')'; var z = $('veZoom'); if(z) z.textContent = Math.round(VE.zoom * 100) + '%'; }
  function veFit(){ var v = $('veView'); if(!v) return; var d = VE.f.data, W = v.clientWidth, H = v.clientHeight; VE.zoom = Math.min(4, Math.max(0.05, Math.min((W - 60) / d.w, (H - 60) / d.h))); VE.pan = { x:(W - d.w * VE.zoom) / 2, y:(H - d.h * VE.zoom) / 2 }; veApplyView(); veRender(); }
  function vePt(e){ var a = $('veArt'), r = a.getBoundingClientRect(), d = VE.f.data; return { x:(e.clientX - r.left) * d.w / r.width, y:(e.clientY - r.top) * d.h / r.height }; }
  // привязки: сетка, края и центры монтажной области и других объектов
  function veSnap(p, skip){
    VE.guides = [];
    if(!VE.snap) return p;
    var d = VE.f.data, t = 6 / VE.zoom, xs = [0, d.w / 2, d.w], ys = [0, d.h / 2, d.h];
    veItems().forEach(function(o){ if(skip && skip.indexOf(o.id) >= 0) return; var b = veBBox([o]); xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h); });
    var q = { x:p.x, y:p.y }, bx = null, by = null;
    xs.forEach(function(x){ if(Math.abs(x - p.x) < t && (bx === null || Math.abs(x - p.x) < Math.abs(bx - p.x))) bx = x; });
    ys.forEach(function(y){ if(Math.abs(y - p.y) < t && (by === null || Math.abs(y - p.y) < Math.abs(by - p.y))) by = y; });
    if(bx !== null){ q.x = bx; VE.guides.push({ v:bx }); } else if(VE.grid) q.x = Math.round(p.x / VE.gridSize) * VE.gridSize;
    if(by !== null){ q.y = by; VE.guides.push({ h:by }); } else if(VE.grid) q.y = Math.round(p.y / VE.gridSize) * VE.gridSize;
    return q;
  }
  function veSnapBox(b, skip){
    // привязываем ближайшую из характерных точек рамки
    var cands = [[b.x, b.y], [b.x + b.w / 2, b.y + b.h / 2], [b.x + b.w, b.y + b.h]], best = { dx:0, dy:0 }, guides = [], bdx = Infinity, bdy = Infinity;
    cands.forEach(function(c){ var s = veSnap({ x:c[0], y:c[1] }, skip); var dx = s.x - c[0], dy = s.y - c[1]; if(Math.abs(dx) > 0 && Math.abs(dx) < Math.abs(bdx)){ bdx = dx; } if(Math.abs(dy) > 0 && Math.abs(dy) < Math.abs(bdy)){ bdy = dy; } guides = guides.concat(VE.guides); });
    VE.guides = guides.filter(function(g){ return (g.v !== undefined && isFinite(bdx)) || (g.h !== undefined && isFinite(bdy)); });
    return { dx:isFinite(bdx) ? bdx : 0, dy:isFinite(bdy) ? bdy : 0 };
  }
  // ---------- операции ----------
  function veStyle(){ return { fill:VE.fill, stroke:VE.stroke, sw:VE.sw, op:1, r:0 }; }
  function veAdd(o, label){ vePush(label || 'Новый объект'); o.name = o.name || veTypeName(o); veItems().push(o); VE.sel = [o.id]; veChanged(); }
  function veDelete(){ var s = VE.sel.slice(); if(!s.length) return; vePush('Удаление'); VE.f.data.items = veItems().filter(function(o){ return s.indexOf(o.id) < 0; }); VE.sel = []; veChanged(); }
  function veClone(o, dx){ var c = JSON.parse(JSON.stringify(o)); (function re(x){ x.id = veId(); (x.children || []).forEach(re); })(c); c.x += dx || 0; c.y += dx || 0; return c; }
  function veDuplicate(){ var s = veSelItems(); if(!s.length) return; vePush('Дублирование'); var ids = s.map(function(o){ var c = veClone(o, 16); veItems().push(c); return c.id; }); VE.sel = ids; veChanged(); }
  function veCopy(cut){ var s = veSelItems(); if(!s.length) return; VE.clip = JSON.stringify(s); VE.clipT = Date.now(); if(cut) veDelete(); toast(cut ? 'Вырезано' : 'Скопировано: ' + s.length); }
  function vePaste(){ if(!VE.clip) return; vePush('Вставка'); var ids = JSON.parse(VE.clip).map(function(o){ var c = veClone(o, 20); veItems().push(c); return c.id; }); VE.sel = ids; veChanged(); }
  function veOrder(where){
    var s = VE.sel; if(!s.length) return; vePush('Порядок'); var it = veItems(), picked = it.filter(function(o){ return s.indexOf(o.id) >= 0; }), rest = it.filter(function(o){ return s.indexOf(o.id) < 0; });
    if(where === 'front') VE.f.data.items = rest.concat(picked);
    else if(where === 'back') VE.f.data.items = picked.concat(rest);
    else { var arr = it.slice(); (where === 'up' ? picked.slice().reverse() : picked).forEach(function(o){ var i = arr.indexOf(o), j = where === 'up' ? Math.min(arr.length - 1, i + 1) : Math.max(0, i - 1); if(s.indexOf(arr[j].id) >= 0) return; arr.splice(i, 1); arr.splice(j, 0, o); }); VE.f.data.items = arr; }
    veChanged();
  }
  function veGroup(){
    var s = veSelItems(); if(s.length < 2){ toast('Выделите два объекта или больше (Shift+клик)'); return; }
    vePush('Группировка'); var b = veBBox(s), it = veItems(), at = Math.max.apply(0, s.map(function(o){ return it.indexOf(o); }));
    var g = { id:veId(), t:'group', name:'Группа', x:b.x, y:b.y, w:b.w, h:b.h, w0:b.w, h0:b.h, r:0, op:1, children:s.map(function(o){ var c = JSON.parse(JSON.stringify(o)); c.x -= b.x; c.y -= b.y; return c; }) };
    VE.f.data.items = it.filter(function(o){ return s.indexOf(o) < 0; }); VE.f.data.items.splice(Math.min(at - s.length + 1, VE.f.data.items.length), 0, g); VE.sel = [g.id]; veChanged();
  }
  function veUngroup(){
    var gs = veSelItems().filter(function(o){ return o.t === 'group'; }); if(!gs.length){ toast('Выделите группу'); return; }
    vePush('Разгруппировка'); var ids = [];
    gs.forEach(function(g){
      var sx = g.w / (g.w0 || g.w), sy = g.h / (g.h0 || g.h), c = { x:g.x + g.w / 2, y:g.y + g.h / 2 }, it = veItems(), at = it.indexOf(g);
      var kids = g.children.map(function(o){
        var n = JSON.parse(JSON.stringify(o)); n.x = g.x + o.x * sx; n.y = g.y + o.y * sy; n.w = o.w * sx; n.h = o.h * sy; if(n.t === 'text') n.fs = (o.fs || 32) * sy;
        if(g.r){ var oc = veRot({ x:n.x + n.w / 2, y:n.y + n.h / 2 }, c, g.r); n.x = oc.x - n.w / 2; n.y = oc.y - n.h / 2; n.r = ((n.r || 0) + g.r) % 360; }
        if(g.op !== undefined && g.op < 1) n.op = (n.op === undefined ? 1 : n.op) * g.op;
        ids.push(n.id); return n;
      });
      it.splice.apply(it, [at, 1].concat(kids));
    });
    VE.sel = ids; veChanged();
  }
  function veAlign(how){
    var s = veSelItems(); if(!s.length) return; vePush('Выравнивание');
    var ref = s.length === 1 ? { x:0, y:0, w:VE.f.data.w, h:VE.f.data.h } : veBBox(s);
    s.forEach(function(o){ var b = veBBox([o]), dx = 0, dy = 0;
      if(how === 'l') dx = ref.x - b.x; if(how === 'c') dx = ref.x + ref.w / 2 - (b.x + b.w / 2); if(how === 'r') dx = ref.x + ref.w - (b.x + b.w);
      if(how === 't') dy = ref.y - b.y; if(how === 'm') dy = ref.y + ref.h / 2 - (b.y + b.h / 2); if(how === 'b') dy = ref.y + ref.h - (b.y + b.h);
      o.x += dx; o.y += dy; });
    veChanged();
  }
  function veDistribute(axis){
    var s = veSelItems(); if(s.length < 3){ toast('Для распределения выделите три объекта или больше'); return; } vePush('Распределение');
    var bs = s.map(function(o){ return { o:o, b:veBBox([o]) }; }).sort(function(a, b){ return axis === 'h' ? a.b.x - b.b.x : a.b.y - b.b.y; });
    var first = bs[0].b, last = bs[bs.length - 1].b, total = bs.reduce(function(t, x){ return t + (axis === 'h' ? x.b.w : x.b.h); }, 0);
    var gap = ((axis === 'h' ? last.x + last.w - first.x : last.y + last.h - first.y) - total) / (bs.length - 1), pos = axis === 'h' ? first.x : first.y;
    bs.forEach(function(x){ if(axis === 'h'){ x.o.x += pos - x.b.x; pos += x.b.w + gap; } else { x.o.y += pos - x.b.y; pos += x.b.h + gap; } });
    veChanged();
  }
  function veFlip(axis){
    var s = veSelItems(); if(!s.length) return; vePush('Отражение');
    s.forEach(function(o){
      if(o.t === 'line'){ o.flip = !o.flip; return; }
      var p = veToCurves(o); if(p !== o){ Object.keys(o).forEach(function(k){ delete o[k]; }); Object.assign(o, p); }
      if(o.t === 'path') o.pts.forEach(function(q){ var f = function(a){ return axis === 'h' ? [1 - a[0], a[1]] : [a[0], 1 - a[1]]; }; var xy = f([q.x, q.y]); q.x = xy[0]; q.y = xy[1]; if(q.c1) q.c1 = f(q.c1); if(q.c2) q.c2 = f(q.c2); });
    });
    veChanged();
  }
  function veCurves(){ var s = veSelItems().filter(function(o){ return /rect|ellipse|star|polygon|line/.test(o.t); }); if(!s.length){ toast('Выделите фигуру: прямоугольник, эллипс, звезду, многоугольник или линию'); return; } vePush('В кривые'); s.forEach(function(o){ var p = veToCurves(o); Object.keys(o).forEach(function(k){ delete o[k]; }); Object.assign(o, p); }); VE.tool = 'node'; veSetTool('node'); veChanged(); toast('Фигура преобразована в кривую — тяните узлы'); }
  function veTextBox(o){ var c = veTextBox.c || (veTextBox.c = document.createElement('canvas').getContext('2d')); c.font = (o.fi ? 'italic ' : '') + (o.fw ? '700 ' : '400 ') + (o.fs || 32) + 'px ' + (o.ff || VE_FONTS[0]); var lines = String(o.text || ' ').split('\n'); o.w = Math.max(10, Math.max.apply(0, lines.map(function(l){ return c.measureText(l || ' ').width; }))); o.h = (o.fs || 32) * (1 + (lines.length - 1) * 1.2) * 1.05; }
  // ---------- инструменты ----------
  function veSetTool(t){
    if(VE.pen && t !== 'pen') vePenFinish(false);
    VE.tool = t; VE.node = null;
    Array.prototype.forEach.call(document.querySelectorAll('.ve-tools .rb'), function(b){ b.classList.toggle('on', b.getAttribute('data-t') === t); b.setAttribute('aria-pressed', b.getAttribute('data-t') === t ? 'true' : 'false'); });
    var v = $('veView'); if(v) v.setAttribute('data-tool', t); veHandles(); veStatus();
  }
  function vePenFinish(close){
    var P = VE.pen; VE.pen = null; VE.draft = null;
    if(P && P.length >= 2){ var o = veFromWorld(P, !!close, Object.assign(veStyle(), { fill:close ? VE.fill : 'none' })); o.name = 'Кривая'; veAdd(o, 'Перо'); }
    else veHandles();
  }
  function veTextEdit(o, isNew){
    var v = $('veView'), a = $('veArt').getBoundingClientRect(), vr = v.getBoundingClientRect(), z = UI.scale / 100, d = VE.f.data, k = a.width / d.w;
    var ta = h('textarea', { 'class':'ve-textin', rows:'1', 'aria-label':'Текст' }); ta.value = o.text || '';
    ta.style.left = ((a.left + o.x * k) - vr.left) / z + 'px'; ta.style.top = ((a.top + o.y * k) - vr.top) / z + 'px';
    ta.style.font = (o.fi ? 'italic ' : '') + (o.fw ? '700 ' : '400 ') + (o.fs || 32) * k / z + 'px ' + (o.ff || VE_FONTS[0]); ta.style.color = o.fill && o.fill !== 'none' ? o.fill : '#111';
    ta.style.minWidth = Math.max(80, o.w * k / z) + 'px';
    o.hidden = true; veRender(); v.appendChild(ta); setTimeout(function(){ ta.focus(); ta.select(); }, 0);
    var done = false;
    function fin(ok){ if(done) return; done = true; var t = ta.value; ta.remove(); o.hidden = false;
      if(ok && t.trim()){ if(!isNew) vePush('Текст'); o.text = t; veTextBox(o); if(isNew){ VE.f.data.items.push(o); VE.sel = [o.id]; } }
      else if(isNew){ VE.undo.pop(); }
      veChanged(); }
    ta.addEventListener('input', function(){ ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
    ta.addEventListener('keydown', function(e){ e.stopPropagation(); if(e.key === 'Escape') fin(true); if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) fin(true); });
    ta.addEventListener('blur', function(){ fin(true); });
  }
  // ---------- панели свойств и слоёв ----------
  function veField(label, val, cb, type, extra){
    var i = h('input', Object.assign({ 'class':'input', type:type || 'number', 'aria-label':label }, extra || {})); i.value = val === undefined || val === null ? '' : val;
    var first = true; i.addEventListener('focus', function(){ first = true; });
    i.addEventListener(type === 'color' || type === 'range' ? 'input' : 'change', function(){ if(first){ vePush(label); first = false; } cb(type === 'number' || type === 'range' ? +i.value : i.value); veChanged(false); veHandles(); });
    return h('label', { 'class':'ve-f' }, [ h('span', { text:label }), i ]);
  }
  function veProps(){
    var p = $('veProps'); if(!p) return; p.innerHTML = '';
    var s = veSelItems(), d = VE.f.data, sec = function(t){ p.appendChild(h('div', { 'class':'ie-sh', text:t })); }, row = function(){ var r = h('div', { 'class':'ve-row' }); [].slice.call(arguments).forEach(function(x){ if(x) r.appendChild(x); }); p.appendChild(r); return r; };
    var B = function(label, html, fn){ return h('button', { type:'button', 'class':'rb', title:label, 'aria-label':label, html:html, on:{ click:fn } }); };
    if(!s.length){
      sec('Монтажная область');
      row(veField('Ширина', d.w, function(v){ d.w = Math.max(16, Math.min(8000, Math.round(v))); }), veField('Высота', d.h, function(v){ d.h = Math.max(16, Math.min(8000, Math.round(v))); }));
      var tr = d.bg === 'transparent';
      row(veField('Фон', tr ? '#ffffff' : d.bg, function(v){ d.bg = v; }, 'color'), (function(){ var c = h('input', { type:'checkbox' }); if(tr) c.checked = true; c.addEventListener('change', function(){ vePush('Фон'); d.bg = c.checked ? 'transparent' : '#ffffff'; veChanged(); }); return h('label', { 'class':'ve-f ck' }, [ c, h('span', { text:'Прозрачный' }) ]); })());
      var sizes = h('select', { 'class':'input', 'aria-label':'Готовый размер' }, [['', 'Готовый размер…'], ['1080x1080', 'Пост 1080×1080'], ['1920x1080', 'Слайд 1920×1080'], ['1200x630', 'Обложка 1200×630'], ['794x1123', 'A4 794×1123'], ['512x512', 'Иконка 512×512'], ['1000x400', 'Баннер 1000×400']].map(function(x){ return h('option', { value:x[0], text:x[1] }); }));
      sizes.addEventListener('change', function(){ if(!sizes.value) return; vePush('Размер области'); var a = sizes.value.split('x'); d.w = +a[0]; d.h = +a[1]; veChanged(); veFit(); });
      row(sizes);
      sec('Привязки');
      row((function(){ var c = h('input', { type:'checkbox' }); if(VE.grid) c.checked = true; c.addEventListener('change', function(){ VE.grid = c.checked; veRender(); }); return h('label', { 'class':'ve-f ck' }, [ c, h('span', { text:'Сетка' }) ]); })(), veField('Шаг', VE.gridSize, function(v){ VE.gridSize = Math.max(2, v); }), (function(){ var c = h('input', { type:'checkbox' }); if(VE.snap) c.checked = true; c.addEventListener('change', function(){ VE.snap = c.checked; }); return h('label', { 'class':'ve-f ck' }, [ c, h('span', { text:'Привязка' }) ]); })());
      sec('Стиль новых объектов');
      row(h('label', { 'class':'ve-f' }, [ h('span', { text:'Заливка' }), (function(){ var c = h('input', { type:'color', value:VE.fill === 'none' ? '#ffffff' : VE.fill, 'aria-label':'Заливка новых объектов' }); c.addEventListener('input', function(){ VE.fill = c.value; }); return c; })() ]),
        h('label', { 'class':'ve-f' }, [ h('span', { text:'Обводка' }), (function(){ var c = h('input', { type:'color', value:VE.stroke, 'aria-label':'Обводка новых объектов' }); c.addEventListener('input', function(){ VE.stroke = c.value; }); return c; })() ]),
        h('label', { 'class':'ve-f' }, [ h('span', { text:'Толщина' }), (function(){ var c = h('input', { 'class':'input', type:'number', min:'0', value:String(VE.sw), 'aria-label':'Толщина обводки новых объектов' }); c.addEventListener('change', function(){ VE.sw = Math.max(0, +c.value); }); return c; })() ]));
      p.appendChild(hintRows('Ctrl+A — выделить всё · Shift+клик — добавить к выделению · Протяжка по пустому — рамка выделения · Ctrl+колесо — масштаб', h('div', { 'class':'ie-hint hk' })));
      return;
    }
    var o = s[0], one = s.length === 1, bb = one ? o : veBBox(s);
    sec(one ? veTypeName(o).charAt(0).toUpperCase() + veTypeName(o).slice(1) + (o.name && o.name !== veTypeName(o) ? ' · ' + o.name : '') : 'Выделено объектов: ' + s.length);
    if(one){
      row(veField('X', veNum(o.x), function(v){ o.x = v; }), veField('Y', veNum(o.y), function(v){ o.y = v; }));
      row(veField('Ш', veNum(o.w), function(v){ if(o.t === 'text'){ o.fs = (o.fs || 32) * v / o.w; veTextBox(o); } else o.w = Math.max(0.5, v); }), veField('В', veNum(o.h), function(v){ if(o.t === 'text'){ o.fs = (o.fs || 32) * v / o.h; veTextBox(o); } else o.h = Math.max(0.5, v); }), veField('Угол', veNum(o.r || 0), function(v){ o.r = v % 360; }));
    }
    if(!s.some(function(x){ return x.t === 'image' || x.t === 'svg' || x.t === 'group'; })){
      sec('Заливка и обводка');
      var noFill = h('input', { type:'checkbox' }); if(o.fill === 'none' || !o.fill) noFill.checked = true;
      noFill.addEventListener('change', function(){ vePush('Заливка'); s.forEach(function(x){ x.fill = noFill.checked ? 'none' : (VE.fill === 'none' ? '#3B82F6' : VE.fill); }); veChanged(); });
      row(veField('Заливка', o.fill && o.fill !== 'none' ? o.fill : '#ffffff', function(v){ s.forEach(function(x){ x.fill = v; }); }, 'color'), h('label', { 'class':'ve-f ck' }, [ noFill, h('span', { text:'Без заливки' }) ]));
      var gr = h('input', { type:'checkbox' }); if(o.fill2) gr.checked = true;
      gr.addEventListener('change', function(){ vePush('Градиент'); s.forEach(function(x){ x.fill2 = gr.checked ? '#EC4899' : null; if(gr.checked && (!x.fill || x.fill === 'none')) x.fill = '#3B82F6'; }); veChanged(); });
      row(h('label', { 'class':'ve-f ck' }, [ gr, h('span', { text:'Градиент' }) ]), o.fill2 ? veField('Второй цвет', o.fill2, function(v){ s.forEach(function(x){ x.fill2 = v; }); }, 'color') : null, o.fill2 ? veField('Угол', o.gang || 0, function(v){ s.forEach(function(x){ x.gang = v; }); }) : null);
      row(veField('Обводка', o.stroke || '#111111', function(v){ s.forEach(function(x){ x.stroke = v; }); }, 'color'), veField('Толщина', o.sw || 0, function(v){ s.forEach(function(x){ x.sw = Math.max(0, v); }); }));
      var dash = h('select', { 'class':'input', 'aria-label':'Пунктир' }, [['', 'Сплошная'], ['8 6', 'Пунктир'], ['2 6', 'Точки'], ['16 6 2 6', 'Штрих-точка']].map(function(x){ var op = h('option', { value:x[0], text:x[1] }); if((o.dash || '') === x[0]) op.selected = true; return op; }));
      dash.addEventListener('change', function(){ vePush('Пунктир'); s.forEach(function(x){ x.dash = dash.value; }); veChanged(false); });
      row(h('label', { 'class':'ve-f' }, [ h('span', { text:'Линия' }), dash ]));
      if(s.some(function(x){ return x.t === 'line'; })){ var ar = h('input', { type:'checkbox' }); if(o.arrow) ar.checked = true; ar.addEventListener('change', function(){ vePush('Стрелка'); s.forEach(function(x){ if(x.t === 'line') x.arrow = ar.checked; }); veChanged(false); }); row(h('label', { 'class':'ve-f ck' }, [ ar, h('span', { text:'Стрелка на конце' }) ])); }
    }
    sec('Вид');
    row(veField('Непрозрачность, %', Math.round((o.op === undefined ? 1 : o.op) * 100), function(v){ s.forEach(function(x){ x.op = Math.max(0, Math.min(100, v)) / 100; }); }, 'range', { min:'0', max:'100' }));
    var sh = h('input', { type:'checkbox' }); if(o.shadow) sh.checked = true; sh.addEventListener('change', function(){ vePush('Тень'); s.forEach(function(x){ x.shadow = sh.checked ? { dx:4, dy:6, b:6, c:'#000000', o:0.35 } : null; }); veChanged(); });
    row(h('label', { 'class':'ve-f ck' }, [ sh, h('span', { text:'Тень' }) ]), o.shadow ? veField('Размытие', o.shadow.b, function(v){ s.forEach(function(x){ if(x.shadow) x.shadow.b = Math.max(0, v); }); }) : null, o.shadow ? veField('Сдвиг', o.shadow.dy, function(v){ s.forEach(function(x){ if(x.shadow){ x.shadow.dy = v; x.shadow.dx = v * 0.66; } }); }) : null);
    if(one && o.t === 'rect') row(veField('Скругление', o.rx || 0, function(v){ o.rx = Math.max(0, v); }));
    if(one && (o.t === 'star' || o.t === 'polygon')) row(veField(o.t === 'star' ? 'Лучей' : 'Углов', o.n || 5, function(v){ o.n = Math.max(3, Math.min(60, Math.round(v))); }), o.t === 'star' ? veField('Глубина, %', Math.round((o.ir || 0.5) * 100), function(v){ o.ir = Math.max(5, Math.min(95, v)) / 100; }) : null);
    if(one && o.t === 'text'){
      sec('Текст');
      var ta = h('textarea', { 'class':'input', rows:'3', 'aria-label':'Текст' }); ta.value = o.text || ''; var f1 = true; ta.addEventListener('focus', function(){ f1 = true; }); ta.addEventListener('input', function(){ if(f1){ vePush('Текст'); f1 = false; } o.text = ta.value; veTextBox(o); veChanged(false); });
      p.appendChild(ta);
      var ff = h('select', { 'class':'input', 'aria-label':'Шрифт' }, VE_FONTS.map(function(x){ var op = h('option', { value:x, text:x.split(',')[0].replace(/"/g, '') }); if(o.ff === x) op.selected = true; return op; })); ff.addEventListener('change', function(){ vePush('Шрифт'); o.ff = ff.value; veTextBox(o); veChanged(false); });
      row(h('label', { 'class':'ve-f' }, [ h('span', { text:'Шрифт' }), ff ]), veField('Кегль', o.fs || 32, function(v){ o.fs = Math.max(4, v); veTextBox(o); }));
      row(B('Жирный', '<b>Ж</b>', function(){ vePush('Жирный'); o.fw = !o.fw; veTextBox(o); veChanged(); }), B('Курсив', '<i>К</i>', function(){ vePush('Курсив'); o.fi = !o.fi; veTextBox(o); veChanged(); }),
        B('По левому краю', SVGI('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', 15), function(){ vePush('Выключка'); o.al = 'start'; veChanged(); }), B('По центру', SVGI('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', 15), function(){ vePush('Выключка'); o.al = 'middle'; veChanged(); }), B('По правому краю', SVGI('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>', 15), function(){ vePush('Выключка'); o.al = 'end'; veChanged(); }));
    }
    sec('Упорядочить');
    row(B('Выровнять по левому краю', SVGI('<path d="M4 3v18M8 7h12M8 15h7"/>', 15), function(){ veAlign('l'); }), B('Выровнять по центру', SVGI('<path d="M12 3v18M6 7h12M8 15h8"/>', 15), function(){ veAlign('c'); }), B('Выровнять по правому краю', SVGI('<path d="M20 3v18M4 7h12M9 15h7"/>', 15), function(){ veAlign('r'); }),
      B('По верхнему краю', SVGI('<path d="M3 4h18M7 8v12M15 8v7"/>', 15), function(){ veAlign('t'); }), B('По середине', SVGI('<path d="M3 12h18M7 6v12M15 8v8"/>', 15), function(){ veAlign('m'); }), B('По нижнему краю', SVGI('<path d="M3 20h18M7 4v12M15 9v7"/>', 15), function(){ veAlign('b'); }));
    row(B('Распределить по горизонтали', SVGI('<path d="M4 4v16M20 4v16M10 8v8M14 8v8"/>', 15), function(){ veDistribute('h'); }), B('Распределить по вертикали', SVGI('<path d="M4 4h16M4 20h16M8 10h8M8 14h8"/>', 15), function(){ veDistribute('v'); }),
      B('На передний план', SVGI('<rect x="8" y="8" width="12" height="12" rx="1" fill="currentColor"/><rect x="4" y="4" width="12" height="12" rx="1"/>', 15), function(){ veOrder('front'); }), B('Выше', SVGI('<path d="M12 19V5M5 12l7-7 7 7"/>', 15), function(){ veOrder('up'); }), B('Ниже', SVGI('<path d="M12 5v14M5 12l7 7 7-7"/>', 15), function(){ veOrder('down'); }), B('На задний план', SVGI('<rect x="4" y="4" width="12" height="12" rx="1" fill="currentColor"/><rect x="8" y="8" width="12" height="12" rx="1"/>', 15), function(){ veOrder('back'); }));
    row(B('Сгруппировать (Ctrl+G)', '<span class="rt">Группа</span>', veGroup), B('Разгруппировать (Ctrl+Shift+G)', '<span class="rt">Разгр.</span>', veUngroup), B('Преобразовать в кривые — для правки узлов', '<span class="rt">В кривые</span>', veCurves), B('Отразить по горизонтали', '<span class="rt">⇋</span>', function(){ veFlip('h'); }), B('Отразить по вертикали', '<span class="rt">⇵</span>', function(){ veFlip('v'); }));
    row(B('Дублировать (Ctrl+D)', '<span class="rt">Дублировать</span>', veDuplicate), B('Закрепить / открепить', '<span class="rt">' + (o.locked ? 'Открепить' : 'Закрепить') + '</span>', function(){ vePush('Закрепление'); s.forEach(function(x){ x.locked = !o.locked; }); veChanged(); }), B('Удалить (Del)', '<span class="rt">Удалить</span>', veDelete));
  }
  function veLayers(){
    var p = $('veLayers'); if(!p) return; p.innerHTML = '';
    veItems().slice().reverse().forEach(function(o){
      var on = VE.sel.indexOf(o.id) >= 0;
      var r = h('div', { 'class':'ie-layer' + (on ? ' on' : ''), role:'option', 'aria-selected':on ? 'true' : 'false', tabindex:'0' }, [
        h('button', { type:'button', 'class':'eye' + (o.hidden ? ' off' : ''), 'aria-label':o.hidden ? 'Показать' : 'Скрыть', html:SVGI(o.hidden ? '<path d="M3 3l18 18M10.6 5.1A10 10 0 0122 12s-1.4 2.4-4 4.5M6.6 6.6C3.7 8.4 2 12 2 12s4 7 10 7c1.7 0 3.2-.5 4.5-1.2"/>' : '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 14), on:{ click:function(e){ e.stopPropagation(); vePush('Видимость'); o.hidden = !o.hidden; veChanged(); } } }),
        h('span', { 'class':'ve-sw', style:'background:' + (o.t === 'image' || o.t === 'group' || o.t === 'svg' ? 'transparent' : (o.fill && o.fill !== 'none' ? o.fill : (o.stroke || '#999'))) }),
        h('span', { 'class':'nm', text:(o.name || veTypeName(o)) + (o.t === 'text' ? ': ' + String(o.text || '').slice(0, 18) : '') }),
        o.locked ? h('span', { 'class':'lk', text:'🔒' }) : null
      ].filter(Boolean));
      r.addEventListener('click', function(e){ if(e.shiftKey){ var i = VE.sel.indexOf(o.id); if(i < 0) VE.sel.push(o.id); else VE.sel.splice(i, 1); } else VE.sel = [o.id]; veChanged(); });
      r.addEventListener('dblclick', function(){ var inp = h('input', { 'class':'input', value:o.name || '' }), nm = r.querySelector('.nm'); nm.replaceWith(inp); inp.focus(); inp.select(); var fin = function(){ var v = inp.value.trim(); if(v && v !== o.name){ vePush('Имя'); o.name = v.slice(0, 40); } veChanged(); }; inp.addEventListener('keydown', function(e){ e.stopPropagation(); if(e.key === 'Enter') fin(); if(e.key === 'Escape') veChanged(); }); inp.addEventListener('blur', fin); });
      p.appendChild(r);
    });
    if(!veItems().length) p.appendChild(h('div', { 'class':'of-empty', text:'Объектов нет — выберите фигуру слева и протяните на холсте' }));
  }
  function vePanels(){ veProps(); veLayers(); }
  // ---------- экспорт и импорт ----------
  function veExport(fmt, scale){
    var svg = vecSvgString(VE.f, false), name = fileBase(VE.f.name, 'vector');
    if(fmt === 'svg'){ download(name + '.svg', svg, 'image/svg+xml', 'Векторный рисунок сохранён (.svg)'); return; }
    var im = new Image(), d = VE.f.data;
    im.onload = function(){ var c = document.createElement('canvas'); c.width = d.w * scale; c.height = d.h * scale; var x = c.getContext('2d'); if(fmt === 'jpg'){ x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } x.drawImage(im, 0, 0, c.width, c.height); c.toBlob(function(b){ download(name + (scale > 1 ? '@' + scale + 'x' : '') + '.' + fmt, b, fmt === 'jpg' ? 'image/jpeg' : 'image/png', 'Картинка сохранена (.' + fmt + ')'); }, fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.92); };
    im.onerror = function(){ toast('Не удалось отрисовать рисунок'); };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  // безопасный импорт SVG: только графика, без скриптов, событий и внешних ссылок
  function veSanitizeSvg(text){
    var doc = new DOMParser().parseFromString(text, 'image/svg+xml'), root = doc.documentElement;
    if(!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;
    var OK = /^(svg|g|defs|path|rect|circle|ellipse|line|polyline|polygon|text|tspan|lineargradient|radialgradient|stop|clippath|mask|pattern|symbol|use|title|desc|filter|fegaussianblur|feoffset|feblend|fecolormatrix|fedropshadow|femerge|femergenode|feflood|fecomposite|style|image)$/i;
    (function walk(n){ Array.prototype.slice.call(n.children).forEach(function(c){
      if(!OK.test(c.nodeName)){ c.remove(); return; }
      Array.prototype.slice.call(c.attributes).forEach(function(a){ var nm = a.name.toLowerCase(), v = a.value; if(/^on/.test(nm) || ((nm === 'href' || nm === 'xlink:href') && !/^(#|data:image\/(png|jpe?g|gif|webp);)/i.test(v.trim())) || /javascript:|url\(\s*['"]?(?!#)/i.test(v)) c.removeAttribute(a.name); });
      if(c.nodeName.toLowerCase() === 'style'){ c.textContent = c.textContent.replace(/@import[^;]*;?/gi, '').replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, 'none'); }
      walk(c); }); })(root);
    var vb = root.getAttribute('viewBox'), w = parseFloat(root.getAttribute('width')) || 0, hh = parseFloat(root.getAttribute('height')) || 0;
    if(!vb){ vb = '0 0 ' + (w || 300) + ' ' + (hh || 300); }
    var p = vb.split(/[\s,]+/).map(Number); if(!w) w = p[2]; if(!hh) hh = p[3];
    return { vb:vb, w:w, h:hh, markup:root.innerHTML };
  }
  function veImport(){
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.svg,image/*';
    inp.addEventListener('change', function(){ var f = inp.files[0]; if(!f) return; var d = VE.f.data;
      if(/\.svg$/i.test(f.name) || f.type === 'image/svg+xml'){ f.text().then(function(t){ var s = veSanitizeSvg(t); if(!s){ toast('Не удалось прочитать SVG'); return; } var k = Math.min(1, d.w * 0.8 / s.w, d.h * 0.8 / s.h); veAdd({ id:veId(), t:'svg', name:baseName(f.name).slice(0, 30), vb:s.vb, markup:s.markup, x:(d.w - s.w * k) / 2, y:(d.h - s.h * k) / 2, w:s.w * k, h:s.h * k, r:0, op:1 }, 'Импорт SVG'); }); return; }
      var rd = new FileReader(); rd.onload = function(){ var im = new Image(); im.onload = function(){ var k = Math.min(1, d.w * 0.8 / im.width, d.h * 0.8 / im.height), c = document.createElement('canvas'), mk = Math.min(1, 1600 / Math.max(im.width, im.height)); c.width = Math.round(im.width * mk); c.height = Math.round(im.height * mk); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); veAdd({ id:veId(), t:'image', name:baseName(f.name).slice(0, 30), data:c.toDataURL(/png|gif|webp/.test(f.type) ? 'image/png' : 'image/jpeg', 0.9), x:(d.w - im.width * k) / 2, y:(d.h - im.height * k) / 2, w:im.width * k, h:im.height * k, r:0, op:1 }, 'Картинка'); }; im.src = rd.result; }; rd.readAsDataURL(f);
    });
    inp.click();
  }
  // ---------- редактор ----------
  function renderVectorEd(m, f){
    if(VE.f !== f){ VE = { f:f, sel:[], tool:'select', fill:'#3B82F6', stroke:'#0F172A', sw:2, zoom:1, pan:{ x:0, y:0 }, undo:[], redo:[], grid:false, gridSize:20, snap:true, fitted:false, clip:VE.clip || null }; }
    f.data.items = f.data.items || [];
    var B = function(label, html, fn, cls){ var b = h('button', { type:'button', 'class':'rb' + (cls ? ' ' + cls : ''), title:label, 'aria-label':label, html:html }); b.addEventListener('mousedown', function(e){ e.preventDefault(); }); b.addEventListener('click', fn); return b; };
    var menu = function(btn, items){ var r = btn.getBoundingClientRect(); openMenuAt(items, r.left, r.bottom + 4); };
    m.appendChild(h('div', { 'class':'ribbon', role:'toolbar', 'aria-label':'Векторный рисунок' }, [
      B('Отменить (Ctrl+Z)', SVGI('<path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2"/>', 16), veUndo), B('Повторить (Ctrl+Shift+Z)', SVGI('<path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h2"/>', 16), veRedo),
      h('span', { 'class':'rsep' }),
      B('Объект', '<span class="rt">Объект ▾</span>', function(e){ menu(e.currentTarget, [{ head:'Объект' }, { label:'Дублировать', kb:MOD + 'D', icon:'copy', act:veDuplicate }, { label:'Копировать', kb:MOD + 'C', icon:'copy', act:function(){ veCopy(false); } }, { label:'Вставить', kb:MOD + 'V', icon:'paste', act:vePaste }, { sep:true }, { label:'Сгруппировать', kb:MOD + 'G', icon:'layout', act:veGroup }, { label:'Разгруппировать', kb:MOD + '⇧G', icon:'layout', act:veUngroup }, { label:'Преобразовать в кривые', icon:'edit', act:veCurves }, { sep:true }, { label:'На передний план', icon:'redo', act:function(){ veOrder('front'); } }, { label:'На задний план', icon:'undo', act:function(){ veOrder('back'); } }, { sep:true }, { label:'Удалить', kb:'Del', icon:'trash', danger:true, act:veDelete }]); }),
      B('Добавить картинку или SVG', '<span class="rt">+ Картинка / SVG</span>', veImport),
      h('span', { 'class':'grow' }),
      B('Уменьшить', '<span class="rt">−</span>', function(){ VE.zoom = Math.max(0.05, VE.zoom / 1.25); veApplyView(); veHandles(); }), h('span', { 'class':'ie-zoom', id:'veZoom' }), B('Увеличить', '<span class="rt">+</span>', function(){ VE.zoom = Math.min(32, VE.zoom * 1.25); veApplyView(); veHandles(); }), B('Вписать (Ctrl+0)', '<span class="rt">Вписать</span>', veFit),
      B('Скачать', '<span class="rt">Скачать ▾</span>', function(e){ menu(e.currentTarget, [{ head:'Сохранить на компьютер' }, { label:'SVG (вектор)', icon:'download', act:function(){ veExport('svg'); } }, { label:'PNG 1×', icon:'download', act:function(){ veExport('png', 1); } }, { label:'PNG 2× (для экранов Retina)', icon:'download', act:function(){ veExport('png', 2); } }, { label:'JPEG', icon:'download', act:function(){ veExport('jpg', 1); } }]); }, 'pri')
    ]));
    var tools = h('div', { 'class':'ie-tools ve-tools', role:'toolbar', 'aria-label':'Инструменты', 'aria-orientation':'vertical' });
    VE_TOOLS.forEach(function(t){ var b = B(t[1], SVGI(t[3], 18), function(){ veSetTool(t[0]); }); b.setAttribute('data-t', t[0]); tools.appendChild(b); });
    var NS = 'http://www.w3.org/2000/svg', art = document.createElementNS(NS, 'svg'), hud = document.createElementNS(NS, 'svg');
    art.setAttribute('id', 'veArt'); art.setAttribute('class', 've-art'); hud.setAttribute('id', 'veHud'); hud.setAttribute('class', 've-hud'); hud.setAttribute('overflow', 'visible');
    var view = h('div', { 'class':'ie-view ve-view', id:'veView', tabindex:'0', 'aria-label':'Монтажная область. Колесо с Ctrl — масштаб, пробел — рука' }, [ h('div', { 'class':'ve-stage', id:'veStage' }, [ art, hud ]) ]);
    var side = h('div', { 'class':'ie-side ve-side' }, [ h('div', { id:'veProps', 'class':'ve-props' }), h('div', { 'class':'ie-sh', text:'Слои' }), h('div', { id:'veLayers', 'class':'ie-llist' }) ]);
    m.appendChild(h('div', { 'class':'ie-body' }, [ tools, view, side ]));
    veSetTool(VE.tool); veRenderNow(); vePanels();
    setTimeout(function(){ if(!VE.fitted){ veFit(); VE.fitted = true; } else { veApplyView(); } }, 0);
    veBind(view); veStatus();
    OF.commit = function(){ if(VE.pen) vePenFinish(false); };
  }
  function veHit(e){ var g = e.target.closest && e.target.closest('#veArt [data-id]'); if(!g) return null; var top = g; while(top.parentNode && top.parentNode.closest && top.parentNode.closest('#veArt [data-id]')) top = top.parentNode.closest('#veArt [data-id]'); return veById(top.getAttribute('data-id')); }
  function veBind(view){
    var space = false;
    view.addEventListener('wheel', function(e){ e.preventDefault(); if(e.ctrlKey || e.metaKey || e.altKey){ var r = view.getBoundingClientRect(), z = UI.scale / 100, mx = (e.clientX - r.left) / z, my = (e.clientY - r.top) / z, nz = Math.min(32, Math.max(0.05, VE.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); VE.pan.x = mx - (mx - VE.pan.x) * nz / VE.zoom; VE.pan.y = my - (my - VE.pan.y) * nz / VE.zoom; VE.zoom = nz; } else { VE.pan.x -= e.deltaX; VE.pan.y -= e.deltaY; } veApplyView(); veHandles(); }, { passive:false });
    view.addEventListener('pointermove', function(e){ if(!VE.f || e.target.closest('.ve-textin')) return; VE.cursor = vePt(e); if(VE.pen){ var P = VE.pen, q = VE.cursor; VE.draft = function(k){ return '<path d="' + vePenD(P.concat([{ x:q.x, y:q.y }])) + '" fill="none" stroke="#2563EB" stroke-width="' + k + '"/>' + P.map(function(p, i){ return '<rect x="' + (p.x - 4 * k) + '" y="' + (p.y - 4 * k) + '" width="' + 8 * k + '" height="' + 8 * k + '" fill="' + (i ? '#fff' : '#2563EB') + '" stroke="#2563EB" stroke-width="' + k + '"/>'; }).join(''); }; veHandles(); } veStatus(); });
    view.addEventListener('dblclick', function(e){ var o = veHit(e); if(VE.pen){ vePenFinish(false); return; } if(o && o.t === 'text' && !o.locked){ veTextEdit(o, false); return; } if(o && o.t === 'path'){ VE.sel = [o.id]; veSetTool('node'); veChanged(); } if(o && o.t === 'group'){ toast('Группа: Ctrl+Shift+G — разгруппировать'); } });
    view.addEventListener('pointerdown', function(e){
      if(e.button === 2 || e.target.closest('.ve-textin')) return;
      view.focus({ preventScroll:true });
      var p = vePt(e), t = VE.tool, z = UI.scale / 100, hnd = e.target.closest && e.target.closest('.ve-h'), drag = null;
      if(space || t === 'hand' || e.button === 1){ var sx = e.clientX, sy = e.clientY, px = VE.pan.x, py = VE.pan.y; drag = { mv:function(ev){ VE.pan.x = px + (ev.clientX - sx) / z; VE.pan.y = py + (ev.clientY - sy) / z; veApplyView(); }, up:function(){} }; }
      else if(hnd && hnd.getAttribute('data-n') !== null && VE.tool === 'node'){
        var o = veSelItems()[0], ni = +hnd.getAttribute('data-n'), cn = hnd.getAttribute('data-c'), pt = o.pts[ni], c0 = { x:o.x + o.w / 2, y:o.y + o.h / 2 };
        if(e.altKey && !cn){ vePush('Тип узла'); if(pt.c1 || pt.c2){ pt.c1 = null; pt.c2 = null; } else { var a = o.pts[ni - 1] || o.pts[ni], b = o.pts[ni + 1] || o.pts[ni]; pt.c1 = [pt.x - (b.x - a.x) / 6, pt.y - (b.y - a.y) / 6]; pt.c2 = [pt.x + (b.x - a.x) / 6, pt.y + (b.y - a.y) / 6]; } veChanged(); return; }
        VE.node = ni; vePush('Правка узла');
        drag = { mv:function(ev){ var q = veRot(vePt(ev), c0, -(o.r || 0)), nx = (q.x - o.x) / o.w, ny = (q.y - o.y) / o.h;
          if(cn){ pt[cn] = [nx, ny]; if(!ev.altKey){ var other = cn === 'c1' ? 'c2' : 'c1'; if(pt[other]){ var L = Math.hypot(pt[other][0] - pt.x, pt[other][1] - pt.y); var dx = pt.x - nx, dy = pt.y - ny, l2 = Math.hypot(dx, dy) || 1; pt[other] = [pt.x + dx / l2 * L, pt.y + dy / l2 * L]; } } }
          else { var ddx = nx - pt.x, ddy = ny - pt.y; pt.x = nx; pt.y = ny; if(pt.c1){ pt.c1 = [pt.c1[0] + ddx, pt.c1[1] + ddy]; } if(pt.c2){ pt.c2 = [pt.c2[0] + ddx, pt.c2[1] + ddy]; } }
          veRender(); }, up:function(){ veNormalizePath(o); veChanged(); } };
      }
      else if(hnd && VE.tool !== 'node'){
        var hk = hnd.getAttribute('data-h'), sel = veSelItems(); if(!sel.length) return;
        vePush(hk === 'rot' ? 'Поворот' : 'Масштаб');
        var one = sel.length === 1 ? sel[0] : null, start = JSON.parse(JSON.stringify(sel)), bb = one ? { x:one.x, y:one.y, w:one.w, h:one.h, r:one.r || 0 } : Object.assign(veBBox(sel), { r:0 }), cc = { x:bb.x + bb.w / 2, y:bb.y + bb.h / 2 };
        if(hk === 'rot'){ var a0 = Math.atan2(p.y - cc.y, p.x - cc.x); drag = { mv:function(ev){ var q = vePt(ev), da = (Math.atan2(q.y - cc.y, q.x - cc.x) - a0) * 180 / Math.PI; if(ev.shiftKey) da = Math.round(da / 15) * 15; sel.forEach(function(o, i){ var s0 = start[i], oc = veRot({ x:s0.x + s0.w / 2, y:s0.y + s0.h / 2 }, cc, da); o.r = (((s0.r || 0) + da) % 360 + 360) % 360; o.x = oc.x - s0.w / 2; o.y = oc.y - s0.h / 2; }); veRender(); }, up:function(){ veChanged(); } }; }
        else {
          var hx = /w/.test(hk) ? -1 : (/e/.test(hk) ? 1 : 0), hy = /n/.test(hk) ? -1 : (/s/.test(hk) ? 1 : 0);
          var anchorL = { x:bb.w / 2 * -hx, y:bb.h / 2 * -hy }, anchorW = veRot({ x:cc.x + anchorL.x, y:cc.y + anchorL.y }, cc, bb.r);
          drag = { mv:function(ev){
            var q = veRot(vePt(ev), anchorW, -bb.r), nw = hx ? Math.max(1, (q.x - anchorW.x) * hx) : bb.w, nh = hy ? Math.max(1, (q.y - anchorW.y) * hy) : bb.h;
            if(ev.shiftKey || (one && (one.t === 'image' || one.t === 'text' || one.t === 'svg') && !ev.altKey) ){ if(hx && hy){ var kk = Math.max(nw / bb.w, nh / bb.h); nw = bb.w * kk; nh = bb.h * kk; } else if(hx){ nh = bb.h * nw / bb.w; } else { nw = bb.w * nh / bb.h; } }
            var sx = nw / bb.w, sy = nh / bb.h, nc = veRot({ x:anchorW.x + hx * nw / 2, y:anchorW.y + hy * nh / 2 }, anchorW, bb.r);
            if(one){ var s0 = start[0]; one.w = nw; one.h = nh; one.x = nc.x - nw / 2; one.y = nc.y - nh / 2; if(one.t === 'text') one.fs = (s0.fs || 32) * nh / s0.h; }
            else { var ax = hx < 0 ? bb.x + bb.w : bb.x, ay = hy < 0 ? bb.y + bb.h : bb.y; sel.forEach(function(o, i){ var s1 = start[i]; o.x = ax + (s1.x - ax) * sx; o.y = ay + (s1.y - ay) * sy; o.w = s1.w * sx; o.h = s1.h * sy; if(o.t === 'text') o.fs = (s1.fs || 32) * sy; }); }
            veRender(); }, up:function(){ veSelItems().forEach(function(o){ if(o.t === 'text') veTextBox(o); }); veChanged(); } };
        }
      }
      else if(t === 'select' || t === 'node'){
        var o2 = veHit(e);
        if(t === 'node' && o2 && o2.t !== 'path'){ VE.sel = [o2.id]; veChanged(); toast('Чтобы править узлы, преобразуйте фигуру в кривые'); return; }
        if(o2){
          if(e.shiftKey){ var ix = VE.sel.indexOf(o2.id); if(ix < 0) VE.sel.push(o2.id); else VE.sel.splice(ix, 1); veChanged(); return; }
          if(VE.sel.indexOf(o2.id) < 0){ VE.sel = [o2.id]; veChanged(); }
          var mov = veSelItems().filter(function(x){ return !x.locked; }); if(!mov.length || t === 'node') return;
          if(e.altKey){ vePush('Копия перетаскиванием'); mov = mov.map(function(x){ var c = veClone(x, 0); veItems().push(c); return c; }); VE.sel = mov.map(function(x){ return x.id; }); }
          var st0 = mov.map(function(x){ return { x:x.x, y:x.y }; }), b0 = veBBox(mov), pushed = !!e.altKey, a = p;
          drag = { mv:function(ev){ var q = vePt(ev), dx = q.x - a.x, dy = q.y - a.y; if(ev.shiftKey){ if(Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; } if(!pushed && Math.abs(dx) + Math.abs(dy) > 1){ vePush('Перемещение'); pushed = true; }
            var sn = veSnapBox({ x:b0.x + dx, y:b0.y + dy, w:b0.w, h:b0.h }, VE.sel); dx += sn.dx; dy += sn.dy;
            mov.forEach(function(x, i){ x.x = st0[i].x + dx; x.y = st0[i].y + dy; }); veRender(); }, up:function(){ VE.guides = []; veChanged(); } };
        } else {
          if(!e.shiftKey) VE.sel = [];
          var a3 = p; VE.marquee = { a:a3, b:a3 };
          drag = { mv:function(ev){ VE.marquee.b = vePt(ev); veHandles(); }, up:function(){ var m = VE.marquee, x0 = Math.min(m.a.x, m.b.x), y0 = Math.min(m.a.y, m.b.y), x1 = Math.max(m.a.x, m.b.x), y1 = Math.max(m.a.y, m.b.y); VE.marquee = null; if(x1 - x0 > 2 || y1 - y0 > 2) veItems().forEach(function(o){ if(o.hidden) return; var b = veBBox([o]); if(b.x >= x0 && b.y >= y0 && b.x + b.w <= x1 && b.y + b.h <= y1 && VE.sel.indexOf(o.id) < 0) VE.sel.push(o.id); }); veChanged(); } };
        }
      }
      else if(t === 'picker'){ var src = veHit(e), tg = veSelItems(); if(!src) return; if(tg.length){ vePush('Стиль'); tg.forEach(function(x){ ['fill', 'fill2', 'gang', 'stroke', 'sw', 'dash', 'op', 'shadow', 'ff', 'fs', 'fw', 'fi'].forEach(function(k){ if(src[k] !== undefined && (k.charAt(0) !== 'f' || k === 'fill' || k === 'fill2' || x.t === 'text')) x[k] = JSON.parse(JSON.stringify(src[k])); }); if(x.t === 'text') veTextBox(x); }); veChanged(); } else { VE.fill = src.fill || VE.fill; VE.stroke = src.stroke || VE.stroke; VE.sw = src.sw || VE.sw; vePanels(); toast('Стиль взят для новых объектов'); } }
      else if(t === 'text'){ var o3 = veHit(e); if(o3 && o3.t === 'text'){ veTextEdit(o3, false); return; } vePush('Текст'); var tx = { id:veId(), t:'text', name:'Текст', text:'', x:p.x, y:p.y, w:200, h:40, r:0, fill:VE.fill === 'none' ? '#0F172A' : VE.fill, stroke:VE.stroke, sw:0, fs:40, ff:VE_FONTS[0], fw:true, op:1 }; veTextEdit(tx, true); }
      else if(t === 'pen'){
        var q0 = veSnap(p), P = VE.pen || (VE.pen = []);
        if(P.length > 2 && Math.hypot(q0.x - P[0].x, q0.y - P[0].y) < 8 / VE.zoom){ vePenFinish(true); return; }
        var node = { x:q0.x, y:q0.y }; P.push(node);
        drag = { mv:function(ev){ var q = vePt(ev), dx = q.x - node.x, dy = q.y - node.y; if(Math.hypot(dx, dy) > 2 / VE.zoom){ node.c2 = [node.x + dx, node.y + dy]; node.c1 = [node.x - dx, node.y - dy]; } VE.draft = function(k){ return '<path d="' + vePenD(P) + '" fill="none" stroke="#2563EB" stroke-width="' + k + '"/>' + (node.c1 ? '<line x1="' + node.c1[0] + '" y1="' + node.c1[1] + '" x2="' + node.c2[0] + '" y2="' + node.c2[1] + '" stroke="#94A3B8" stroke-width="' + k + '"/>' : ''); }; veHandles(); }, up:function(){} };
      }
      else if(t === 'pencil'){ var pts = [p]; drag = { mv:function(ev){ pts.push(vePt(ev)); VE.draft = function(k){ return '<polyline points="' + pts.map(function(q){ return q.x + ',' + q.y; }).join(' ') + '" fill="none" stroke="' + VE.stroke + '" stroke-width="' + Math.max(VE.sw, 1) + '"/>'; }; veHandles(); }, up:function(){ VE.draft = null; if(pts.length < 2){ veHandles(); return; } var sp = veSmooth(veSimplify(pts, 2.5 / VE.zoom)), closed = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 10 / VE.zoom && pts.length > 6; var o = veFromWorld(sp, closed, Object.assign(veStyle(), { fill:closed ? VE.fill : 'none', sw:Math.max(VE.sw, 2) })); o.name = 'Рисунок'; veAdd(o, 'Карандаш'); } }; }
      else if(/rect|ellipse|line|star|polygon/.test(t)){
        var a4 = veSnap(p);
        var mk = function(q){ var x0 = Math.min(a4.x, q.x), y0 = Math.min(a4.y, q.y), o = Object.assign({ id:'draft', t:t, x:x0, y:y0, w:Math.max(1, Math.abs(q.x - a4.x)), h:Math.max(1, Math.abs(q.y - a4.y)) }, veStyle()); if(t === 'line'){ o.fill = 'none'; o.sw = Math.max(1, VE.sw); o.flip = (q.x - a4.x) * (q.y - a4.y) < 0; } if(t === 'star'){ o.n = 5; o.ir = 0.45; } if(t === 'polygon'){ o.n = 6; } if(t === 'rect') o.rx = 0; return o; };
        drag = { mv:function(ev){ var q = veSnap(vePt(ev)); if(ev.shiftKey){ var s = Math.max(Math.abs(q.x - a4.x), Math.abs(q.y - a4.y)); q = { x:a4.x + Math.sign(q.x - a4.x || 1) * s, y:a4.y + Math.sign(q.y - a4.y || 1) * s }; } if(ev.altKey){ a4 = { x:a4.x, y:a4.y }; } drag.o = mk(q); VE.draft = function(){ var defs = []; return veItemSvg(drag.o, defs, false); }; veHandles(); },
          up:function(){ VE.draft = null; VE.guides = []; var o = drag.o; if(!o || (o.w < 3 && o.h < 3)){ o = mk({ x:a4.x + 120, y:a4.y + (t === 'line' ? 0 : 80) }); if(t === 'line') o.h = 1; } o.id = veId(); veAdd(o, veTypeName(o)); } };
      }
      if(!drag) return;
      // захват указателя: холст перерисовывается во время перетаскивания, а события должны идти дальше
      try{ view.setPointerCapture(e.pointerId); }catch(_){}
      var d0 = drag, mv = function(ev){ d0.mv(ev); }, up = function(ev){ document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); try{ view.releasePointerCapture(e.pointerId); }catch(_){} d0.up(ev); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    view.addEventListener('keydown', function(e){
      if(e.target.closest && e.target.closest('.ve-textin')) return;
      var mod = e.ctrlKey || e.metaKey, k = e.key, c = e.code, handled = true, s = veSelItems();
      if(k === ' '){ space = true; view.classList.add('panning'); }
      else if(mod && !e.shiftKey && c === 'KeyZ') veUndo();
      else if(mod && (c === 'KeyY' || (e.shiftKey && c === 'KeyZ'))) veRedo();
      else if(mod && c === 'KeyA'){ VE.sel = veItems().filter(function(o){ return !o.hidden && !o.locked; }).map(function(o){ return o.id; }); veChanged(); }
      else if(mod && c === 'KeyD') veDuplicate();
      else if(mod && c === 'KeyC'){ veCopy(false); handled = false; }
      else if(mod && c === 'KeyX'){ veCopy(true); handled = false; }
      else if(mod && c === 'KeyV'){ clearTimeout(OF.pasteWait); OF.pasteWait = setTimeout(function(){ OF.pasteWait = null; vePaste(); }, 150); handled = false; }
      else if(mod && e.shiftKey && c === 'KeyG') veUngroup();
      else if(mod && c === 'KeyG') veGroup();
      else if(mod && c === 'BracketRight') veOrder(e.shiftKey ? 'front' : 'up');
      else if(mod && c === 'BracketLeft') veOrder(e.shiftKey ? 'back' : 'down');
      else if(mod && c === 'Digit0') veFit();
      else if(mod && (k === '=' || k === '+')){ VE.zoom = Math.min(32, VE.zoom * 1.25); veApplyView(); veHandles(); }
      else if(mod && k === '-'){ VE.zoom = Math.max(0.05, VE.zoom / 1.25); veApplyView(); veHandles(); }
      else if((k === 'Delete' || k === 'Backspace') && VE.tool === 'node' && VE.node !== null && s[0] && s[0].t === 'path' && s[0].pts.length > 2){ vePush('Удаление узла'); s[0].pts.splice(VE.node, 1); VE.node = null; veNormalizePath(s[0]); veChanged(); }
      else if(k === 'Delete' || k === 'Backspace') veDelete();
      else if(k === 'Enter' && VE.pen) vePenFinish(false);
      else if(k === 'Escape'){ if(VE.pen) vePenFinish(false); else { VE.sel = []; veChanged(); } }
      else if(/^Arrow/.test(k) && s.length){ var st = e.shiftKey ? 10 : 1; vePush('Сдвиг'); s.forEach(function(o){ if(o.locked) return; if(k === 'ArrowLeft') o.x -= st; if(k === 'ArrowRight') o.x += st; if(k === 'ArrowUp') o.y -= st; if(k === 'ArrowDown') o.y += st; }); veChanged(false); veProps(); }
      else if(!mod && !e.altKey && k === '\\') veSetTool('line');
      else if(!mod && !e.altKey){ var tl = VE_TOOLS.filter(function(t){ return t[2] && c === 'Key' + t[2]; })[0]; if(tl) veSetTool(tl[0]); else handled = false; }
      else handled = false;
      if(handled){ e.preventDefault(); e.stopPropagation(); }
    });
    view.addEventListener('keyup', function(e){ if(e.key === ' '){ space = false; view.classList.remove('panning'); } });
  }
  function vePenD(P){ var d = ''; P.forEach(function(p, i){ if(!i){ d += 'M' + p.x + ' ' + p.y; return; } var q = P[i - 1]; if(q.c2 || p.c1){ var a = q.c2 || [q.x, q.y], b = p.c1 || [p.x, p.y]; d += ' C' + a[0] + ' ' + a[1] + ' ' + b[0] + ' ' + b[1] + ' ' + p.x + ' ' + p.y; } else d += ' L' + p.x + ' ' + p.y; }); return d; }
  // после правки узлов рамка пересчитывается, чтобы ручки снова совпадали с фигурой
  function veNormalizePath(o){
    var c = { x:o.x + o.w / 2, y:o.y + o.h / 2 }, W = function(a){ return veRot({ x:o.x + a[0] * o.w, y:o.y + a[1] * o.h }, c, o.r || 0); };
    if(o.r){ return; }
    var wp = o.pts.map(function(p){ var P = W([p.x, p.y]); return { x:P.x, y:P.y, c1:p.c1 ? (function(q){ return [q.x, q.y]; })(W(p.c1)) : null, c2:p.c2 ? (function(q){ return [q.x, q.y]; })(W(p.c2)) : null }; });
    var n = veFromWorld(wp, o.closed, {}); o.x = n.x; o.y = n.y; o.w = n.w; o.h = n.h; o.pts = n.pts;
  }
