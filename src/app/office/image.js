  /* =====================================================================
     ФОТОРЕДАКТОР: растровое изображение со слоями. Кисть, ластик, заливка,
     градиент, штамп, фигуры, текст, выделения (прямоугольник, овал, лассо,
     волшебная палочка), коррекции и фильтры, режимы наложения, история.
     Слои хранятся в файле как PNG (data URL).
     ===================================================================== */
  var IE = { f:null };
  var IE_BLENDS = [['source-over', 'Обычный'], ['multiply', 'Умножение'], ['screen', 'Экран'], ['overlay', 'Перекрытие'], ['darken', 'Затемнение'], ['lighten', 'Замена светлым'],
    ['color-dodge', 'Осветление основы'], ['color-burn', 'Затемнение основы'], ['hard-light', 'Жёсткий свет'], ['soft-light', 'Мягкий свет'], ['difference', 'Разница'], ['exclusion', 'Исключение'],
    ['hue', 'Цветовой тон'], ['saturation', 'Насыщенность'], ['color', 'Цветность'], ['luminosity', 'Яркость']];
  var IE_TOOLS = [
    ['move', 'Перемещение слоя (V)', 'V', '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'],
    ['rect', 'Прямоугольное выделение (M)', 'M', '<rect x="4" y="5" width="16" height="14" stroke-dasharray="3 2"/>'],
    ['ellipse', 'Овальное выделение', '', '<ellipse cx="12" cy="12" rx="8" ry="6" stroke-dasharray="3 2"/>'],
    ['lasso', 'Лассо (L)', 'L', '<path d="M7 17c-3-2-3-7 1-9s10-2 11 2-4 6-8 5" stroke-dasharray="3 2"/><path d="M7 17l-2 4"/>'],
    ['wand', 'Волшебная палочка (W)', 'W', '<path d="M4 20L15 9M15 9l2-5 1 4 4 1-5 2z"/>'],
    ['crop', 'Кадрирование (C)', 'C', '<path d="M6 2v16h16M2 6h16v16"/>'],
    ['brush', 'Кисть (B)', 'B', '<path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-5 2-5 5 0 1-1 2-2 2 4 1 9 0 9-4z"/>'],
    ['pencil', 'Карандаш — жёсткий край', '', '<path d="M4 20l4-1 11-11-3-3L5 16z"/>'],
    ['eraser', 'Ластик (E)', 'E', '<path d="M8 20h12M4 15l9-9 6 6-7 7H8z"/>'],
    ['clone', 'Штамп (S): Alt+клик — источник', 'S', '<path d="M8 21h8M9 17h6l1-5H8zM12 12V9"/><circle cx="12" cy="6" r="3"/>'],
    ['blurb', 'Размытие кистью', '', '<path d="M12 3c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z"/>'],
    ['fill', 'Заливка (G)', 'G', '<path d="M5 12l7-7 7 7-7 7z"/><path d="M19 15c0 1.5 1 2.5 1 3.5a1 1 0 01-2 0c0-1 1-2 1-3.5z"/>'],
    ['gradient', 'Градиент', '', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M11 5v14" opacity=".5"/>'],
    ['shape', 'Фигура: прямоугольник, овал, линия (U)', 'U', '<rect x="3" y="3" width="8" height="8"/><circle cx="16" cy="16" r="5"/>'],
    ['text', 'Текст (T)', 'T', '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'],
    ['picker', 'Пипетка (I)', 'I', '<path d="M14 4l6 6-2 2-6-6zM12 6L4 14v6h6l8-8"/>'],
    ['hand', 'Рука (H, пробел)', 'H', '<path d="M8 13V5a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 11V5.5a1.5 1.5 0 013 0V14c0 4-3 7-7 7s-6-3-7-6l-1-3a1.5 1.5 0 012.7-1L8 13"/>']
  ];
  function ieCanvas(w, hh){ var c = document.createElement('canvas'); c.width = w; c.height = hh; return c; }
  function ieDefault(w, hh, bg){
    var c = ieCanvas(w, hh), x = c.getContext('2d'); if(bg && bg !== 'transparent'){ x.fillStyle = bg; x.fillRect(0, 0, w, hh); }
    return { w:w, h:hh, layers:[{ id:'l1', name:'Фон', vis:true, op:1, blend:'source-over', src:c.toDataURL('image/png') }] };
  }
  function ieLoad(f, cb){
    var d = f.data, left = d.layers.length, layers = d.layers.map(function(L){ return { id:L.id, name:L.name, vis:L.vis !== false, op:L.op === undefined ? 1 : L.op, blend:L.blend || 'source-over', c:ieCanvas(d.w, d.h), lock:!!L.lock }; });
    if(!left){ cb(layers); return; }
    d.layers.forEach(function(L, i){ var im = new Image(); im.onload = im.onerror = function(){ try{ layers[i].c.getContext('2d').drawImage(im, 0, 0); }catch(e){} if(--left === 0) cb(layers); }; im.src = L.src || ''; });
  }
  var ieSaveT = null;
  function ieSave(now){
    clearTimeout(ieSaveT);
    var go = function(){ if(!IE.f || !IE.layers) return; var f = IE.f; f.data.w = IE.w; f.data.h = IE.h;
      f.data.layers = IE.layers.map(function(L){ return { id:L.id, name:L.name, vis:L.vis, op:L.op, blend:L.blend, lock:L.lock, src:L.c.toDataURL('image/png') }; });
      var comp = ieComposite(), t = ieCanvas(160, Math.max(1, Math.round(160 * IE.h / IE.w))); t.getContext('2d').drawImage(comp, 0, 0, t.width, t.height); f.data.thumb = t.toDataURL('image/jpeg', 0.7);
      var k = Math.min(1, 1200 / Math.max(IE.w, IE.h)), pv = ieCanvas(Math.max(1, Math.round(IE.w * k)), Math.max(1, Math.round(IE.h * k))); pv.getContext('2d').drawImage(comp, 0, 0, pv.width, pv.height); f.data.prev = pv.toDataURL('image/png');
      f.t = Date.now(); saveGraph(); };
    if(now) go(); else ieSaveT = setTimeout(go, 600);
  }
  function ieCur(){ return IE.layers ? (IE.layers[IE.cur] || IE.layers[0]) : null; }
  function ieComposite(skipSel){
    var c = IE.comp || (IE.comp = ieCanvas(IE.w, IE.h)); if(c.width !== IE.w || c.height !== IE.h){ c.width = IE.w; c.height = IE.h; }
    var x = c.getContext('2d'); x.clearRect(0, 0, IE.w, IE.h);
    IE.layers.forEach(function(L, i){ if(!L.vis) return; x.save(); x.globalAlpha = L.op; x.globalCompositeOperation = L.blend; var dx = IE.moveOff && i === IE.cur ? IE.moveOff.x : 0, dy = IE.moveOff && i === IE.cur ? IE.moveOff.y : 0; x.drawImage(i === IE.cur && IE.preview ? IE.preview : L.c, dx, dy); x.restore(); });
    return c;
  }
  function ieRender(){ var v = $('ieView'); if(!v) return; var d = $('ieCanvas'), x = d.getContext('2d'); x.clearRect(0, 0, IE.w, IE.h); x.drawImage(ieComposite(), 0, 0); ieOverlay(); }
  // ---------- история ----------
  function ieSnap(){ return { w:IE.w, h:IE.h, cur:IE.cur, layers:IE.layers.map(function(L){ var c = ieCanvas(L.c.width, L.c.height); c.getContext('2d').drawImage(L.c, 0, 0); return { id:L.id, name:L.name, vis:L.vis, op:L.op, blend:L.blend, lock:L.lock, c:c }; }) }; }
  function ieRestore(s){ IE.w = s.w; IE.h = s.h; IE.cur = s.cur; IE.layers = s.layers.map(function(L){ var c = ieCanvas(L.c.width, L.c.height); c.getContext('2d').drawImage(L.c, 0, 0); return { id:L.id, name:L.name, vis:L.vis, op:L.op, blend:L.blend, lock:L.lock, c:c }; }); }
  function iePush(label){ IE.undo.push({ s:ieSnap(), label:label || 'Изменение' }); if(IE.undo.length > 30) IE.undo.shift(); IE.redo = []; }
  function ieUndo(){ if(!IE.undo.length){ toast('Нечего отменять'); return; } var u = IE.undo.pop(); IE.redo.push({ s:ieSnap(), label:u.label }); ieRestore(u.s); ieAfterStruct(); toast('Отменено: ' + u.label); }
  function ieRedo(){ if(!IE.redo.length){ toast('Нечего повторять'); return; } var r = IE.redo.pop(); IE.undo.push({ s:ieSnap(), label:r.label }); ieRestore(r.s); ieAfterStruct(); }
  function ieAfterStruct(){ ieSizeStage(); ieRender(); ieLayersPanel(); ieSave(); ieStatus(); }
  // ---------- выделение ----------
  function ieSelPath(){ return IE.sel ? IE.sel.path : null; }
  function ieClip(x){ var p = ieSelPath(); if(p) x.clip(p, 'evenodd' === IE.sel.rule ? 'evenodd' : 'nonzero'); }
  function ieSetSel(path, bbox, mask){ IE.sel = path ? { path:path, bbox:bbox, mask:mask || null } : null; ieRender(); ieStatus(); }
  function ieOverlay(){
    var o = $('ieOver'); if(!o) return; var x = o.getContext('2d'); x.clearRect(0, 0, IE.w, IE.h);
    var k = 1 / IE.zoom;
    if(IE.sel){ x.save(); x.lineWidth = k; x.setLineDash([5 * k, 4 * k]); x.lineDashOffset = -(IE.ants || 0) * k; x.strokeStyle = '#000'; x.stroke(IE.sel.path); x.lineDashOffset = -(IE.ants || 0) * k + 5 * k; x.strokeStyle = '#fff'; x.stroke(IE.sel.path); x.restore(); }
    if(IE.draft) IE.draft(x, k);
    if(IE.cursor && /brush|pencil|eraser|clone|blurb/.test(IE.tool)){ x.save(); x.lineWidth = k; x.strokeStyle = 'rgba(0,0,0,.7)'; x.beginPath(); x.arc(IE.cursor.x, IE.cursor.y, Math.max(1, IE.size / 2), 0, Math.PI * 2); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.arc(IE.cursor.x, IE.cursor.y, Math.max(1, IE.size / 2) + k, 0, Math.PI * 2); x.stroke(); x.restore(); }
    if(IE.cloneSrc && IE.tool === 'clone'){ x.save(); x.strokeStyle = '#E11D48'; x.lineWidth = 2 * k; var cs = IE.cloneSrc, p = IE.cloneOff && IE.cursor ? { x:IE.cursor.x + IE.cloneOff.x, y:IE.cursor.y + IE.cloneOff.y } : cs; x.beginPath(); x.moveTo(p.x - 8 * k, p.y); x.lineTo(p.x + 8 * k, p.y); x.moveTo(p.x, p.y - 8 * k); x.lineTo(p.x, p.y + 8 * k); x.stroke(); x.restore(); }
  }
  function ieAnts(){ clearInterval(IE.antT); IE.antT = setInterval(function(){ if(!$('ieOver')){ clearInterval(IE.antT); return; } if(IE.sel){ IE.ants = ((IE.ants || 0) + 1) % 9; ieOverlay(); } }, 120); }
  function ieRectPath(a, b, ell){
    var x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), hh = Math.abs(b.y - a.y), p = new Path2D();
    if(ell) p.ellipse(x0 + w / 2, y0 + hh / 2, Math.max(0.5, w / 2), Math.max(0.5, hh / 2), 0, 0, Math.PI * 2); else p.rect(x0, y0, w, hh);
    return { path:p, bbox:{ x:x0, y:y0, w:w, h:hh } };
  }
  // волшебная палочка: соседние пиксели похожего цвета → маска → контур из квадратов
  function ieWand(px, py, tol, contig){
    var L = ieCur(), x = L.c.getContext('2d'), W = IE.w, H = IE.h, d = x.getImageData(0, 0, W, H).data, i0 = (py * W + px) * 4;
    var r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2], a0 = d[i0 + 3], m = new Uint8Array(W * H), t2 = tol * tol * 4;
    function near(i){ var dr = d[i] - r0, dg = d[i + 1] - g0, db = d[i + 2] - b0, da = d[i + 3] - a0; return dr * dr + dg * dg + db * db + da * da <= t2; }
    if(contig){ var st = [px + py * W]; m[st[0]] = 1; while(st.length){ var p = st.pop(), xx = p % W, yy = (p - xx) / W; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function(o){ var nx = xx + o[0], ny = yy + o[1]; if(nx < 0 || ny < 0 || nx >= W || ny >= H) return; var q = nx + ny * W; if(!m[q] && near(q * 4)){ m[q] = 1; st.push(q); } }); } }
    else for(var q = 0; q < W * H; q++) if(near(q * 4)) m[q] = 1;
    return ieMaskPath(m, W, H);
  }
  function ieMaskPath(m, W, H){
    var p = new Path2D(), x0 = W, y0 = H, x1 = 0, y1 = 0, any = false;
    for(var y = 0; y < H; y++){ var run = -1; for(var x = 0; x <= W; x++){ var on = x < W && m[x + y * W]; if(on && run < 0) run = x; if(!on && run >= 0){ p.rect(run, y, x - run, 1); x0 = Math.min(x0, run); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); run = -1; any = true; } } }
    return any ? { path:p, bbox:{ x:x0, y:y0, w:x1 - x0, h:y1 - y0 }, mask:m } : null;
  }
  // ---------- рисование ----------
  function ieStamp(x, ctx, p, size, hard, color, mode){
    var r = Math.max(0.5, size / 2);
    if(mode === 'pencil'){ x.fillStyle = color; x.fillRect(Math.round(p.x - r), Math.round(p.y - r), Math.max(1, Math.round(size)), Math.max(1, Math.round(size))); return; }
    var g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, r), c = hexRgb(color);
    g.addColorStop(0, 'rgba(' + c.join(',') + ',1)'); g.addColorStop(Math.min(0.99, Math.max(0, hard)), 'rgba(' + c.join(',') + ',1)'); g.addColorStop(1, 'rgba(' + c.join(',') + ',0)');
    x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, r, 0, Math.PI * 2); x.fill();
  }
  function ieStroke(a, b){
    var L = ieCur(), dist = Math.hypot(b.x - a.x, b.y - a.y), step = Math.max(1, IE.size * (IE.tool === 'pencil' ? 0.5 : 0.18)), n = Math.max(1, Math.ceil(dist / step));
    var tx = IE.strokeC.getContext('2d');
    for(var i = 1; i <= n; i++){
      var p = { x:a.x + (b.x - a.x) * i / n, y:a.y + (b.y - a.y) * i / n };
      if(IE.tool === 'clone'){ if(!IE.cloneOff) return; var r = IE.size / 2; tx.save(); tx.beginPath(); tx.arc(p.x, p.y, r, 0, Math.PI * 2); tx.clip(); tx.drawImage(IE.cloneSnap, -IE.cloneOff.x, -IE.cloneOff.y); tx.restore(); continue; }
      if(IE.tool === 'blurb'){ var rr = IE.size / 2, lx = L.c.getContext('2d'); lx.save(); ieClip(lx); lx.beginPath(); lx.arc(p.x, p.y, rr, 0, Math.PI * 2); lx.clip(); lx.filter = 'blur(' + Math.max(1, IE.size / 12) + 'px)'; lx.drawImage(L.c, 0, 0); lx.restore(); continue; }
      ieStamp(tx, null, p, IE.size, IE.tool === 'pencil' ? 1 : IE.hard, IE.tool === 'eraser' ? '#000000' : IE.color, IE.tool === 'pencil' ? 'pencil' : '');
    }
    ieStrokePreview();
  }
  function ieStrokePreview(){
    var L = ieCur(), pv = IE.preview || (IE.preview = ieCanvas(IE.w, IE.h)); if(pv.width !== IE.w || pv.height !== IE.h){ pv.width = IE.w; pv.height = IE.h; }
    var x = pv.getContext('2d'); x.clearRect(0, 0, IE.w, IE.h); x.drawImage(L.c, 0, 0);
    if(IE.tool !== 'blurb'){ x.save(); ieClip(x); x.globalAlpha = IE.opacity; x.globalCompositeOperation = IE.tool === 'eraser' ? 'destination-out' : 'source-over'; x.drawImage(IE.strokeC, 0, 0); x.restore(); }
    ieRender();
  }
  function ieCommitPreview(){ var L = ieCur(); if(IE.preview){ var x = L.c.getContext('2d'); x.clearRect(0, 0, IE.w, IE.h); x.drawImage(IE.preview, 0, 0); } IE.preview = null; ieRender(); ieThumbs(); ieSave(); }
  function ieFlood(px, py){
    var L = ieCur(), x = L.c.getContext('2d'), W = IE.w, H = IE.h, img = x.getImageData(0, 0, W, H), d = img.data, i0 = (py * W + px) * 4, t2 = IE.tol * IE.tol * 4;
    var r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2], a0 = d[i0 + 3], c = hexRgb(IE.color), m = new Uint8Array(W * H), st = [px + py * W]; m[st[0]] = 1;
    function near(i){ var dr = d[i] - r0, dg = d[i + 1] - g0, db = d[i + 2] - b0, da = d[i + 3] - a0; return dr * dr + dg * dg + db * db + da * da <= t2; }
    while(st.length){ var p = st.pop(), xx = p % W, yy = (p - xx) / W; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function(o){ var nx = xx + o[0], ny = yy + o[1]; if(nx < 0 || ny < 0 || nx >= W || ny >= H) return; var q = nx + ny * W; if(!m[q] && near(q * 4)){ m[q] = 1; st.push(q); } }); }
    var fc = ieCanvas(W, H), fx = fc.getContext('2d'), fi = fx.createImageData(W, H);
    for(var q = 0; q < W * H; q++) if(m[q]){ fi.data[q * 4] = c[0]; fi.data[q * 4 + 1] = c[1]; fi.data[q * 4 + 2] = c[2]; fi.data[q * 4 + 3] = 255; }
    fx.putImageData(fi, 0, 0); x.save(); ieClip(x); x.globalAlpha = IE.opacity; x.drawImage(fc, 0, 0); x.restore();
  }
  // ---------- коррекции и фильтры (над слоем, в пределах выделения) ----------
  function iePix(fn){ return function(src, p){ var x = src.getContext('2d'), img = x.getImageData(0, 0, src.width, src.height), d = img.data; fn(d, p, src.width, src.height); x.putImageData(img, 0, 0); return src; }; }
  function ieConv(k, div){ return function(src){ var W = src.width, H = src.height, x = src.getContext('2d'), a = x.getImageData(0, 0, W, H), s = a.data, o = x.createImageData(W, H), d = o.data;
    for(var y = 0; y < H; y++) for(var xx = 0; xx < W; xx++){ var r = 0, g = 0, b = 0; for(var ky = -1; ky <= 1; ky++) for(var kx = -1; kx <= 1; kx++){ var sx = Math.min(W - 1, Math.max(0, xx + kx)), sy = Math.min(H - 1, Math.max(0, y + ky)), i = (sy * W + sx) * 4, w = k[(ky + 1) * 3 + kx + 1]; r += s[i] * w; g += s[i + 1] * w; b += s[i + 2] * w; } var j = (y * W + xx) * 4; d[j] = r / div; d[j + 1] = g / div; d[j + 2] = b / div; d[j + 3] = s[j + 3]; }
    x.putImageData(o, 0, 0); return src; }; }
  function rgb2hsl(r, g, b){ r /= 255; g /= 255; b /= 255; var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, hh = 0, s = 0; if(mx !== mn){ var d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh /= 6; } return [hh, s, l]; }
  function hsl2rgb(hh, s, l){ function f(p, q, t){ if(t < 0) t += 1; if(t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; } if(!s) return [l * 255, l * 255, l * 255]; var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, hh + 1 / 3) * 255, f(p, q, hh) * 255, f(p, q, hh - 1 / 3) * 255]; }
  var IE_ADJ = [
    { id:'bc', name:'Яркость и контраст', p:[['b', 'Яркость', -100, 100, 0], ['c', 'Контраст', -100, 100, 0]], fn:iePix(function(d, p){ var b = p.b * 2.55, c = p.c, f = (259 * (c + 255)) / (255 * (259 - c)); for(var i = 0; i < d.length; i += 4){ d[i] = f * (d[i] + b - 128) + 128; d[i + 1] = f * (d[i + 1] + b - 128) + 128; d[i + 2] = f * (d[i + 2] + b - 128) + 128; } }) },
    { id:'hs', name:'Цветовой тон и насыщенность', p:[['h', 'Тон, °', -180, 180, 0], ['s', 'Насыщенность', -100, 100, 0], ['l', 'Яркость', -100, 100, 0]], fn:iePix(function(d, p){ for(var i = 0; i < d.length; i += 4){ var q = rgb2hsl(d[i], d[i + 1], d[i + 2]); q[0] = (q[0] + p.h / 360 + 1) % 1; q[1] = Math.max(0, Math.min(1, q[1] * (1 + p.s / 100))); q[2] = Math.max(0, Math.min(1, q[2] + p.l / 200)); var r = hsl2rgb(q[0], q[1], q[2]); d[i] = r[0]; d[i + 1] = r[1]; d[i + 2] = r[2]; } }) },
    { id:'lv', name:'Уровни', p:[['lo', 'Чёрная точка', 0, 254, 0], ['hi', 'Белая точка', 1, 255, 255], ['g', 'Гамма ×100', 10, 300, 100]], fn:iePix(function(d, p){ var lo = p.lo, hi = Math.max(lo + 1, p.hi), g = 100 / p.g, lut = []; for(var v = 0; v < 256; v++) lut[v] = 255 * Math.pow(Math.max(0, Math.min(1, (v - lo) / (hi - lo))), g); for(var i = 0; i < d.length; i += 4){ d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; } }) },
    { id:'cb', name:'Цветовой баланс', p:[['r', 'Голубой ↔ Красный', -100, 100, 0], ['g', 'Пурпурный ↔ Зелёный', -100, 100, 0], ['b', 'Жёлтый ↔ Синий', -100, 100, 0]], fn:iePix(function(d, p){ for(var i = 0; i < d.length; i += 4){ d[i] += p.r; d[i + 1] += p.g; d[i + 2] += p.b; } }) },
    { id:'ex', name:'Экспозиция', p:[['e', 'Экспозиция ×100', -200, 200, 0]], fn:iePix(function(d, p){ var k = Math.pow(2, p.e / 100); for(var i = 0; i < d.length; i += 4){ d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; } }) },
    { id:'vb', name:'Сочность', p:[['v', 'Сочность', -100, 100, 0]], fn:iePix(function(d, p){ var k = p.v / 100; for(var i = 0; i < d.length; i += 4){ var mx = Math.max(d[i], d[i + 1], d[i + 2]), avg = (d[i] + d[i + 1] + d[i + 2]) / 3, amt = (mx - avg) / 255 * 2 * -k * 3; d[i] += (mx - d[i]) * amt; d[i + 1] += (mx - d[i + 1]) * amt; d[i + 2] += (mx - d[i + 2]) * amt; } }) },
    { id:'inv', name:'Инверсия', p:[], fn:iePix(function(d){ for(var i = 0; i < d.length; i += 4){ d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } }) },
    { id:'gray', name:'Обесцветить', p:[], fn:iePix(function(d){ for(var i = 0; i < d.length; i += 4){ var y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = y; } }) },
    { id:'sepia', name:'Сепия', p:[['a', 'Сила, %', 0, 100, 100]], fn:iePix(function(d, p){ var k = p.a / 100; for(var i = 0; i < d.length; i += 4){ var r = d[i], g = d[i + 1], b = d[i + 2]; d[i] = r + ((r * 0.393 + g * 0.769 + b * 0.189) - r) * k; d[i + 1] = g + ((r * 0.349 + g * 0.686 + b * 0.168) - g) * k; d[i + 2] = b + ((r * 0.272 + g * 0.534 + b * 0.131) - b) * k; } }) },
    { id:'thr', name:'Порог', p:[['t', 'Порог', 0, 255, 128]], fn:iePix(function(d, p){ for(var i = 0; i < d.length; i += 4){ var v = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) >= p.t ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; } }) },
    { id:'post', name:'Постеризация', p:[['n', 'Уровней', 2, 16, 4]], fn:iePix(function(d, p){ var n = Math.max(2, p.n), st = 255 / (n - 1); for(var i = 0; i < d.length; i += 4){ d[i] = Math.round(d[i] / st) * st; d[i + 1] = Math.round(d[i + 1] / st) * st; d[i + 2] = Math.round(d[i + 2] / st) * st; } }) },
    { id:'blur', name:'Размытие по Гауссу', p:[['r', 'Радиус, px', 0, 40, 4]], fn:function(src, p){ var t = ieCanvas(src.width, src.height), x = t.getContext('2d'); x.filter = 'blur(' + p.r + 'px)'; x.drawImage(src, 0, 0); var s = src.getContext('2d'); s.clearRect(0, 0, src.width, src.height); s.drawImage(t, 0, 0); return src; } },
    { id:'sharp', name:'Резкость', p:[], fn:ieConv([0, -1, 0, -1, 5, -1, 0, -1, 0], 1) },
    { id:'emboss', name:'Тиснение', p:[], fn:ieConv([-2, -1, 0, -1, 1, 1, 0, 1, 2], 1) },
    { id:'edges', name:'Выделение краёв', p:[], fn:ieConv([-1, -1, -1, -1, 8, -1, -1, -1, -1], 1) },
    { id:'noise', name:'Шум', p:[['a', 'Сила', 0, 100, 20], ['m', 'Монохромный: 1 — да', 0, 1, 1]], fn:iePix(function(d, p){ for(var i = 0; i < d.length; i += 4){ var n = (Math.random() - 0.5) * p.a * 2.55; if(p.m){ d[i] += n; d[i + 1] += n; d[i + 2] += n; } else { d[i] += n; d[i + 1] += (Math.random() - 0.5) * p.a * 2.55; d[i + 2] += (Math.random() - 0.5) * p.a * 2.55; } } }) },
    { id:'pix', name:'Пикселизация', p:[['s', 'Размер клетки', 2, 80, 12]], fn:function(src, p){ var s = Math.max(2, p.s), W = src.width, H = src.height, t = ieCanvas(Math.ceil(W / s), Math.ceil(H / s)); t.getContext('2d').drawImage(src, 0, 0, t.width, t.height); var x = src.getContext('2d'); x.clearRect(0, 0, W, H); x.imageSmoothingEnabled = false; x.drawImage(t, 0, 0, t.width * s, t.height * s); x.imageSmoothingEnabled = true; return src; } },
    { id:'vig', name:'Виньетка', p:[['a', 'Сила, %', 0, 100, 50], ['r', 'Размер, %', 10, 100, 60]], fn:function(src, p){ var W = src.width, H = src.height, x = src.getContext('2d'), g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * p.r / 200, W / 2, H / 2, Math.hypot(W, H) / 2); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + p.a / 100 + ')'); x.save(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore(); return src; } }
  ];
  function ieApplyFx(def, p, previewOnly){
    var L = ieCur(), base = ieCopy(L.c), work = ieCopy(L.c);
    def.fn(work, p);
    var out = previewOnly ? (IE.preview || (IE.preview = ieCanvas(IE.w, IE.h))) : L.c, x = out.getContext('2d');
    if(out.width !== IE.w || out.height !== IE.h){ out.width = IE.w; out.height = IE.h; }
    x.clearRect(0, 0, IE.w, IE.h); x.drawImage(base, 0, 0);
    x.save(); if(IE.sel) ieClip(x); x.clearRect(0, 0, IE.w, IE.h); x.drawImage(work, 0, 0); x.restore();
    ieRender();
  }
  function ieCopy(c){ var t = ieCanvas(c.width, c.height); t.getContext('2d').drawImage(c, 0, 0); return t; }
  function ieAdjDialog(def){
    if(!def.p.length){ iePush(def.name); ieApplyFx(def, {}); IE.preview = null; ieThumbs(); ieSave(); toast(def.name + ' — готово'); return; }
    var old = $('ieDlg'); if(old) old.remove();
    var vals = {}; def.p.forEach(function(q){ vals[q[0]] = q[4]; });
    var box = h('div', { 'class':'ie-dlg', id:'ieDlg', role:'dialog', 'aria-label':def.name }, [ h('b', { text:def.name }) ]);
    def.p.forEach(function(q){
      var out = h('span', { 'class':'v', text:String(q[4]) }), r = h('input', { type:'range', min:String(q[2]), max:String(q[3]), value:String(q[4]), 'aria-label':q[1] });
      r.addEventListener('input', function(){ vals[q[0]] = +r.value; out.textContent = r.value; ieApplyFx(def, vals, true); });
      box.appendChild(h('label', { 'class':'ie-row' }, [ h('span', { text:q[1] }), r, out ]));
    });
    var close = function(ok){ if(ok){ iePush(def.name); ieApplyFx(def, vals); ieThumbs(); ieSave(); } IE.preview = null; ieRender(); box.remove(); };
    box.appendChild(h('div', { 'class':'bld-acts' }, [ h('button', { type:'button', 'class':'btn primary', text:'Применить', on:{ click:function(){ close(true); } } }), h('button', { type:'button', 'class':'btn', text:'Отмена', on:{ click:function(){ close(false); } } }) ]));
    $('ieView').appendChild(box); ieApplyFx(def, vals, true);
  }
  // ---------- слои ----------
  function ieNewLayer(name, canvas, at){ var L = { id:'l' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name:name || 'Слой ' + (IE.layers.length + 1), vis:true, op:1, blend:'source-over', c:canvas || ieCanvas(IE.w, IE.h) }; var i = at === undefined ? IE.cur + 1 : at; IE.layers.splice(i, 0, L); IE.cur = i; return L; }
  function ieLayerAct(a){
    var L = ieCur(), i = IE.cur;
    if(a === 'add'){ iePush('Новый слой'); ieNewLayer(); }
    else if(a === 'dup'){ iePush('Дубликат слоя'); ieNewLayer(L.name + ' копия', ieCopy(L.c)); ieCur().op = L.op; ieCur().blend = L.blend; }
    else if(a === 'del'){ if(IE.layers.length < 2){ toast('Нельзя удалить единственный слой'); return; } iePush('Удаление слоя'); IE.layers.splice(i, 1); IE.cur = Math.max(0, i - 1); }
    else if(a === 'up'){ if(i >= IE.layers.length - 1) return; iePush('Порядок слоёв'); IE.layers.splice(i + 1, 0, IE.layers.splice(i, 1)[0]); IE.cur = i + 1; }
    else if(a === 'down'){ if(i <= 0) return; iePush('Порядок слоёв'); IE.layers.splice(i - 1, 0, IE.layers.splice(i, 1)[0]); IE.cur = i - 1; }
    else if(a === 'merge'){ if(i <= 0){ toast('Под этим слоем ничего нет'); return; } iePush('Объединение с нижним'); var B = IE.layers[i - 1], x = B.c.getContext('2d'); x.save(); x.globalAlpha = L.op; x.globalCompositeOperation = L.blend; if(L.vis) x.drawImage(L.c, 0, 0); x.restore(); IE.layers.splice(i, 1); IE.cur = i - 1; }
    else if(a === 'flat'){ iePush('Свести слои'); var c = ieCopy(ieComposite()); IE.layers = [{ id:'l1', name:'Фон', vis:true, op:1, blend:'source-over', c:c }]; IE.cur = 0; }
    ieAfterStruct();
  }
  function ieThumbs(){ Array.prototype.forEach.call(document.querySelectorAll('.ie-layer canvas'), function(t){ var L = IE.layers.filter(function(x){ return x.id === t.getAttribute('data-l'); })[0]; if(!L) return; var x = t.getContext('2d'); x.clearRect(0, 0, t.width, t.height); x.drawImage(L.c, 0, 0, t.width, t.height); }); }
  function ieLayersPanel(){
    var p = $('ieLayers'); if(!p) return; p.innerHTML = '';
    var L = ieCur();
    p.appendChild(h('div', { 'class':'ie-lprops' }, [
      h('select', { 'class':'input', 'aria-label':'Режим наложения', on:{ change:function(e){ iePush('Режим наложения'); ieCur().blend = e.target.value; ieRender(); ieSave(); } } }, IE_BLENDS.map(function(b){ var o = h('option', { value:b[0], text:b[1] }); if(b[0] === L.blend) o.selected = true; return o; })),
      h('label', { 'class':'ie-row' }, [ h('span', { text:'Непрозрачность' }), (function(){ var r = h('input', { type:'range', min:'0', max:'100', value:String(Math.round(L.op * 100)), 'aria-label':'Непрозрачность слоя' }); r.addEventListener('pointerdown', function(){ iePush('Непрозрачность'); }); r.addEventListener('input', function(){ ieCur().op = r.value / 100; ieRender(); }); r.addEventListener('change', function(){ ieSave(); }); return r; })() ])
    ]));
    var list = h('div', { 'class':'ie-llist', role:'listbox', 'aria-label':'Слои' });
    IE.layers.slice().reverse().forEach(function(Ly){
      var idx = IE.layers.indexOf(Ly), t = ieCanvas(44, Math.max(8, Math.round(44 * IE.h / IE.w))); t.setAttribute('data-l', Ly.id);
      var row = h('div', { 'class':'ie-layer' + (idx === IE.cur ? ' on' : ''), role:'option', 'aria-selected':idx === IE.cur ? 'true' : 'false', tabindex:'0' }, [
        h('button', { type:'button', 'class':'eye' + (Ly.vis ? '' : ' off'), 'aria-label':Ly.vis ? 'Скрыть слой' : 'Показать слой', html:SVGI(Ly.vis ? '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' : '<path d="M3 3l18 18M10.6 5.1A10 10 0 0122 12s-1.4 2.4-4 4.5M6.6 6.6C3.7 8.4 2 12 2 12s4 7 10 7c1.7 0 3.2-.5 4.5-1.2"/>', 14), on:{ click:function(e){ e.stopPropagation(); Ly.vis = !Ly.vis; ieRender(); ieLayersPanel(); ieSave(); } } }),
        t, h('span', { 'class':'nm', text:Ly.name })
      ]);
      row.addEventListener('click', function(){ IE.cur = idx; ieLayersPanel(); ieStatus(); });
      row.addEventListener('dblclick', function(){ var v = window.prompt ? null : null; var inp = h('input', { 'class':'input', value:Ly.name }); var nm = row.querySelector('.nm'); nm.replaceWith(inp); inp.focus(); inp.select(); var fin = function(){ var s = inp.value.trim(); if(s && s !== Ly.name){ iePush('Переименование'); Ly.name = s.slice(0, 40); ieSave(); } ieLayersPanel(); }; inp.addEventListener('keydown', function(e){ e.stopPropagation(); if(e.key === 'Enter') fin(); if(e.key === 'Escape') ieLayersPanel(); }); inp.addEventListener('blur', fin); });
      list.appendChild(row);
    });
    p.appendChild(list);
    var B = function(label, icon, a){ return h('button', { type:'button', 'class':'rb', title:label, 'aria-label':label, html:icon, on:{ click:function(){ ieLayerAct(a); } } }); };
    p.appendChild(h('div', { 'class':'ie-lbar' }, [ B('Новый слой', SVGI('<path d="M12 5v14M5 12h14"/>', 15), 'add'), B('Дублировать слой', SVGI('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>', 15), 'dup'),
      B('Выше', SVGI('<path d="M12 19V5M5 12l7-7 7 7"/>', 15), 'up'), B('Ниже', SVGI('<path d="M12 5v14M5 12l7 7 7-7"/>', 15), 'down'), B('Объединить с нижним', SVGI('<path d="M7 7l5 5 5-5M7 13l5 5 5-5"/>', 15), 'merge'), B('Удалить слой', SVGI('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 15), 'del') ]));
    ieThumbs();
  }
  // ---------- холст: размеры, вид ----------
  function ieSizeStage(){ var c = $('ieCanvas'), o = $('ieOver'), s = $('ieStage'); if(!c) return; [c, o].forEach(function(x){ if(x.width !== IE.w) x.width = IE.w; if(x.height !== IE.h) x.height = IE.h; }); s.style.width = IE.w + 'px'; s.style.height = IE.h + 'px'; ieApplyView(); }
  function ieApplyView(){ var s = $('ieStage'); if(s) s.style.transform = 'translate(' + IE.pan.x + 'px,' + IE.pan.y + 'px) scale(' + IE.zoom + ')'; var z = $('ieZoom'); if(z) z.textContent = Math.round(IE.zoom * 100) + '%'; }
  function ieFit(){ var v = $('ieView'); if(!v) return; var W = v.clientWidth, H = v.clientHeight; IE.zoom = Math.min(4, Math.max(0.05, Math.min((W - 40) / IE.w, (H - 40) / IE.h))); IE.pan = { x:(W - IE.w * IE.zoom) / 2, y:(H - IE.h * IE.zoom) / 2 }; ieApplyView(); ieOverlay(); }
  function iePt(e){ var c = $('ieCanvas'), r = c.getBoundingClientRect(); return { x:(e.clientX - r.left) * IE.w / r.width, y:(e.clientY - r.top) * IE.h / r.height }; }
  function ieStatus(){ if(!IE.f || !IE.layers || OF.tab !== IE.f.id) return; var L = ieCur(); el.stLeft.textContent = 'Изображение «' + IE.f.name + '» · ' + IE.w + '×' + IE.h + ' · слой «' + (L ? L.name : '') + '»' + (IE.sel ? ' · выделение ' + Math.round(IE.sel.bbox.w) + '×' + Math.round(IE.sel.bbox.h) : '') + (IE.cursor ? ' · x ' + Math.round(IE.cursor.x) + ', y ' + Math.round(IE.cursor.y) : ''); }
  function ieResize(nw, nh, mode){
    nw = Math.max(1, Math.min(6000, Math.round(nw))); nh = Math.max(1, Math.min(6000, Math.round(nh)));
    iePush(mode === 'canvas' ? 'Размер холста' : 'Размер изображения');
    IE.layers.forEach(function(L){ var c = ieCanvas(nw, nh), x = c.getContext('2d'); if(mode === 'canvas') x.drawImage(L.c, Math.round((nw - IE.w) / 2), Math.round((nh - IE.h) / 2)); else { x.imageSmoothingQuality = 'high'; x.drawImage(L.c, 0, 0, nw, nh); } L.c = c; });
    IE.w = nw; IE.h = nh; IE.sel = null; ieAfterStruct(); ieFit();
  }
  function ieTransform(kind){
    iePush(kind === 'rot' ? 'Поворот' : 'Отражение');
    var rot = kind === 'rot', nw = rot ? IE.h : IE.w, nh = rot ? IE.w : IE.h;
    IE.layers.forEach(function(L){ var c = ieCanvas(nw, nh), x = c.getContext('2d'); if(rot){ x.translate(nw, 0); x.rotate(Math.PI / 2); } else if(kind === 'fh'){ x.translate(nw, 0); x.scale(-1, 1); } else { x.translate(0, nh); x.scale(1, -1); } x.drawImage(L.c, 0, 0); L.c = c; });
    IE.w = nw; IE.h = nh; IE.sel = null; ieAfterStruct(); if(rot) ieFit();
  }
  function ieCrop(b){
    b = { x:Math.max(0, Math.round(b.x)), y:Math.max(0, Math.round(b.y)), w:Math.round(b.w), h:Math.round(b.h) }; b.w = Math.min(b.w, IE.w - b.x); b.h = Math.min(b.h, IE.h - b.y); if(b.w < 2 || b.h < 2) return;
    iePush('Кадрирование'); IE.layers.forEach(function(L){ var c = ieCanvas(b.w, b.h); c.getContext('2d').drawImage(L.c, -b.x, -b.y); L.c = c; }); IE.w = b.w; IE.h = b.h; IE.sel = null; ieAfterStruct(); ieFit();
  }
  function ieSizeDialog(mode){
    var old = $('ieDlg'); if(old) old.remove();
    var wI = h('input', { 'class':'input', type:'number', min:'1', max:'6000', value:String(IE.w), 'aria-label':'Ширина' }), hI = h('input', { 'class':'input', type:'number', min:'1', max:'6000', value:String(IE.h), 'aria-label':'Высота' }), keep = h('input', { type:'checkbox', checked:'' });
    wI.addEventListener('input', function(){ if(keep.checked) hI.value = Math.round(wI.value * IE.h / IE.w); }); hI.addEventListener('input', function(){ if(keep.checked) wI.value = Math.round(hI.value * IE.w / IE.h); });
    var box = h('div', { 'class':'ie-dlg', id:'ieDlg', role:'dialog' }, [ h('b', { text:mode === 'canvas' ? 'Размер холста' : 'Размер изображения' }), h('label', { 'class':'ie-row' }, [ h('span', { text:'Ширина, px' }), wI ]), h('label', { 'class':'ie-row' }, [ h('span', { text:'Высота, px' }), hI ]), h('label', { 'class':'ie-row' }, [ keep, h('span', { text:'Сохранять пропорции' }) ]),
      h('div', { 'class':'bld-acts' }, [ h('button', { type:'button', 'class':'btn primary', text:'Применить', on:{ click:function(){ box.remove(); ieResize(+wI.value, +hI.value, mode); } } }), h('button', { type:'button', 'class':'btn', text:'Отмена', on:{ click:function(){ box.remove(); } } }) ]) ]);
    $('ieView').appendChild(box); wI.focus();
  }
  function ieText(p){
    var v = $('ieView'), inp = h('textarea', { 'class':'ie-textin', rows:'2', placeholder:'Текст — Ctrl+Enter, чтобы поставить', 'aria-label':'Текст' }), c = $('ieCanvas').getBoundingClientRect(), vr = v.getBoundingClientRect(), z = UI.scale / 100;
    inp.style.left = ((c.left + p.x * c.width / IE.w) - vr.left) / z + 'px'; inp.style.top = ((c.top + p.y * c.height / IE.h) - vr.top) / z + 'px';
    inp.style.font = (IE.bold ? '700 ' : '') + Math.max(10, IE.fontSize * IE.zoom) + 'px ' + IE.font; inp.style.color = IE.color;
    v.appendChild(inp); setTimeout(function(){ inp.focus(); }, 0);
    var done = false;
    function fin(ok){ if(done) return; done = true; var t = inp.value; inp.remove(); if(!ok || !t.trim()) return; iePush('Текст'); var L = ieNewLayer('Текст: ' + t.slice(0, 16)), x = L.c.getContext('2d'); x.fillStyle = IE.color; x.font = (IE.bold ? '700 ' : '') + IE.fontSize + 'px ' + IE.font; x.textBaseline = 'top'; t.split('\n').forEach(function(line, i){ x.fillText(line, p.x, p.y + i * IE.fontSize * 1.2); }); ieAfterStruct(); }
    inp.addEventListener('keydown', function(e){ e.stopPropagation(); if(e.key === 'Escape') fin(false); if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) fin(true); });
    inp.addEventListener('blur', function(){ fin(true); });
  }
  function ieOptions(){
    var o = $('ieOpts'); if(!o) return; o.innerHTML = '';
    var t = IE.tool, add = function(n){ o.appendChild(n); };
    function rng(label, min, max, val, cb, step){ var r = h('input', { type:'range', min:String(min), max:String(max), step:String(step || 1), value:String(val), 'aria-label':label }), out = h('span', { 'class':'v', text:String(val) }); r.addEventListener('input', function(){ out.textContent = r.value; cb(+r.value); }); return h('label', { 'class':'ie-opt' }, [ h('span', { text:label }), r, out ]); }
    var colors = h('span', { 'class':'ie-colors' }, [
      (function(){ var c = h('input', { type:'color', value:IE.color, title:'Основной цвет', 'aria-label':'Основной цвет' }); c.addEventListener('input', function(){ IE.color = c.value; }); return c; })(),
      (function(){ var c = h('input', { type:'color', value:IE.color2, title:'Фоновый цвет (для градиента)', 'aria-label':'Фоновый цвет' }); c.addEventListener('input', function(){ IE.color2 = c.value; }); return c; })(),
      h('button', { type:'button', 'class':'rb', title:'Поменять цвета местами (X)', 'aria-label':'Поменять цвета местами', html:SVGI('<path d="M7 4L3 8l4 4M3 8h13a4 4 0 014 4M17 20l4-4-4-4M21 16H8a4 4 0 01-4-4"/>', 14), on:{ click:function(){ var a = IE.color; IE.color = IE.color2; IE.color2 = a; ieOptions(); } } })
    ]);
    add(colors);
    if(/brush|pencil|eraser|clone|blurb/.test(t)){ add(rng('Размер', 1, 300, IE.size, function(v){ IE.size = v; })); if(t !== 'pencil' && t !== 'blurb') add(rng('Жёсткость, %', 0, 100, Math.round(IE.hard * 100), function(v){ IE.hard = v / 100; })); if(t !== 'blurb') add(rng('Непрозрачность, %', 1, 100, Math.round(IE.opacity * 100), function(v){ IE.opacity = v / 100; })); }
    if(t === 'fill' || t === 'wand'){ add(rng('Допуск', 0, 255, IE.tol, function(v){ IE.tol = v; })); if(t === 'fill') add(rng('Непрозрачность, %', 1, 100, Math.round(IE.opacity * 100), function(v){ IE.opacity = v / 100; })); }
    if(t === 'wand'){ var cb = h('input', { type:'checkbox' }); if(IE.contig) cb.checked = true; cb.addEventListener('change', function(){ IE.contig = cb.checked; }); add(h('label', { 'class':'ie-opt' }, [ cb, h('span', { text:'Только смежные' }) ])); }
    if(/rect|ellipse|lasso|wand/.test(t)) add(h('span', { 'class':'ie-hint', text:'Shift — добавить к выделению, Alt — вычесть (прямоугольник/овал). Ctrl+D — снять, Ctrl+Shift+I — инвертировать.' }));
    if(t === 'shape'){ var s = h('select', { 'class':'input', 'aria-label':'Фигура' }, [['rect', 'Прямоугольник'], ['ellipse', 'Овал'], ['line', 'Линия'], ['arrow', 'Стрелка']].map(function(x){ var op = h('option', { value:x[0], text:x[1] }); if(IE.shape === x[0]) op.selected = true; return op; })); s.addEventListener('change', function(){ IE.shape = s.value; }); add(s); add(rng('Толщина', 0, 60, IE.stroke, function(v){ IE.stroke = v; })); var fc = h('input', { type:'checkbox' }); if(IE.shapeFill) fc.checked = true; fc.addEventListener('change', function(){ IE.shapeFill = fc.checked; }); add(h('label', { 'class':'ie-opt' }, [ fc, h('span', { text:'Заливка фоновым цветом' }) ])); }
    if(t === 'text'){ var ff = h('select', { 'class':'input', 'aria-label':'Шрифт' }, ['Inter, system-ui, sans-serif', 'Georgia, serif', '"Times New Roman", serif', 'Arial, sans-serif', '"Courier New", monospace', 'Impact, sans-serif'].map(function(x){ var op = h('option', { value:x, text:x.split(',')[0].replace(/"/g, '') }); if(IE.font === x) op.selected = true; return op; })); ff.addEventListener('change', function(){ IE.font = ff.value; }); add(ff); add(rng('Кегль', 8, 300, IE.fontSize, function(v){ IE.fontSize = v; })); var bb = h('input', { type:'checkbox' }); if(IE.bold) bb.checked = true; bb.addEventListener('change', function(){ IE.bold = bb.checked; }); add(h('label', { 'class':'ie-opt' }, [ bb, h('span', { text:'Жирный' }) ])); }
    if(t === 'gradient'){ var gs = h('select', { 'class':'input', 'aria-label':'Вид градиента' }, [['linear', 'Линейный'], ['radial', 'Радиальный']].map(function(x){ var op = h('option', { value:x[0], text:x[1] }); if(IE.grad === x[0]) op.selected = true; return op; })); gs.addEventListener('change', function(){ IE.grad = gs.value; }); add(gs); add(h('span', { 'class':'ie-hint', text:'Протяните линию: от основного цвета к фоновому' })); }
    if(t === 'clone') add(h('span', { 'class':'ie-hint', text:IE.cloneSrc ? 'Источник задан. Рисуйте — копируется участок со смещением' : 'Alt+клик — выбрать источник, затем рисуйте' }));
    if(t === 'crop') add(h('span', { 'class':'ie-hint', text:'Выделите область рамкой и нажмите Enter (или кнопку «Кадрировать»)' }));
    if(t === 'move') add(h('span', { 'class':'ie-hint', text:'Тяните, чтобы сдвинуть слой. Стрелки — на 1 px, Shift+стрелки — на 10 px' }));
  }
  function ieSetTool(t){ IE.tool = t; IE.draft = null; Array.prototype.forEach.call(document.querySelectorAll('.ie-tools .rb'), function(b){ b.classList.toggle('on', b.getAttribute('data-t') === t); b.setAttribute('aria-pressed', b.getAttribute('data-t') === t ? 'true' : 'false'); }); var v = $('ieView'); if(v) v.setAttribute('data-tool', t); ieOptions(); ieOverlay(); }
  function ieMenu(btn, items){ var r = btn.getBoundingClientRect(); openMenuAt(items, r.left, r.bottom + 4); }
  function ieSelOps(op){
    if(op === 'all'){ ieSetSel(ieRectPath({ x:0, y:0 }, { x:IE.w, y:IE.h }).path, { x:0, y:0, w:IE.w, h:IE.h }); return; }
    if(op === 'none'){ ieSetSel(null); return; }
    if(!IE.sel){ toast('Сначала выделите область'); return; }
    var L = ieCur(), x = L.c.getContext('2d');
    if(op === 'inv'){ var p = new Path2D(); p.rect(0, 0, IE.w, IE.h); p.addPath(IE.sel.path); IE.sel = { path:p, bbox:{ x:0, y:0, w:IE.w, h:IE.h }, rule:'evenodd' }; ieRender(); return; }
    if(op === 'clear'){ iePush('Удаление'); x.save(); ieClip(x); x.clearRect(0, 0, IE.w, IE.h); x.restore(); }
    if(op === 'fill'){ iePush('Заливка выделения'); x.save(); ieClip(x); x.fillStyle = IE.color; x.globalAlpha = IE.opacity; x.fillRect(0, 0, IE.w, IE.h); x.restore(); }
    if(op === 'stroke'){ iePush('Обводка выделения'); x.save(); x.strokeStyle = IE.color; x.lineWidth = Math.max(1, IE.stroke || 3); x.stroke(IE.sel.path); x.restore(); }
    if(op === 'layer' || op === 'cut'){ iePush(op === 'cut' ? 'Вырезать на новый слой' : 'Копировать на новый слой'); var c = ieCanvas(IE.w, IE.h), cx = c.getContext('2d'); cx.save(); ieClip(cx); cx.drawImage(L.c, 0, 0); cx.restore(); if(op === 'cut'){ x.save(); ieClip(x); x.clearRect(0, 0, IE.w, IE.h); x.restore(); } ieNewLayer('Фрагмент', c); IE.sel = null; ieAfterStruct(); return; }
    if(op === 'crop'){ ieCrop(IE.sel.bbox); return; }
    ieRender(); ieThumbs(); ieSave();
  }
  function ieExport(fmt){
    var c = ieComposite(), type = fmt === 'jpg' ? 'image/jpeg' : (fmt === 'webp' ? 'image/webp' : 'image/png');
    if(fmt === 'jpg'){ var t = ieCanvas(IE.w, IE.h), x = t.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, IE.w, IE.h); x.drawImage(c, 0, 0); c = t; }
    c.toBlob(function(b){ download(fileBase(IE.f.name, 'image') + '.' + fmt, b, type, 'Изображение сохранено (.' + fmt + ')'); }, type, 0.92);
  }
  function ieImportLayer(){ var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.addEventListener('change', function(){ var f = inp.files[0]; if(!f) return; var u = URL.createObjectURL(f), im = new Image(); im.onload = function(){ iePush('Картинка слоем'); var c = ieCanvas(IE.w, IE.h), k = Math.min(1, IE.w / im.width, IE.h / im.height); c.getContext('2d').drawImage(im, (IE.w - im.width * k) / 2, (IE.h - im.height * k) / 2, im.width * k, im.height * k); ieNewLayer(baseName(f.name).slice(0, 30), c); ieAfterStruct(); URL.revokeObjectURL(u); }; im.src = u; }); inp.click(); }
  // копировать / вырезать выделение (или весь слой) и вставить новым слоем на то же место
  function ieClipCopy(cut){
    var L = ieCur(); if(!L){ toast('Нет активного слоя'); return; }
    var c = ieCanvas(IE.w, IE.h), cx = c.getContext('2d'); cx.save(); if(IE.sel) ieClip(cx); cx.drawImage(L.c, 0, 0); cx.restore();
    IE.clip = { src:c.toDataURL('image/png'), t:Date.now(), name:L.name };
    if(cut){ if(IE.sel) ieSelOps('clear'); else { iePush('Вырезать'); L.c.getContext('2d').clearRect(0, 0, IE.w, IE.h); ieRender(); ieThumbs(); ieSave(); } }
    toast((cut ? 'Вырезано' : 'Скопировано') + (IE.sel ? ' выделение' : ' — слой «' + L.name + '»') + ' · ' + MOD + 'V — вставить новым слоем');
    try{ if(navigator.clipboard && window.ClipboardItem) c.toBlob(function(b){ navigator.clipboard.write([new ClipboardItem({ 'image/png':b })]).then(null, function(){}); }); }catch(e){}
  }
  function iePasteClip(){
    if(!IE.clip){ toast('Буфер пуст'); return; }
    var im = new Image(); im.onload = function(){ iePush('Вставка'); var c = ieCanvas(IE.w, IE.h); c.getContext('2d').drawImage(im, 0, 0); ieNewLayer((IE.clip.name || 'Вставка') + ' (копия)', c); ieAfterStruct(); toast('Вставлено новым слоем'); };
    im.src = IE.clip.src;
  }
  // векторный рисунок → новый слой изображения (для схемы файлов)
  function vecToImageLayer(vf, imf, cb){
    var svg = vecSvgString(vf, false), im = new Image(), u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    im.onload = function(){ var d = imf.data, c = ieCanvas(d.w, d.h), k = Math.min(1, d.w / vf.data.w, d.h / vf.data.h); c.getContext('2d').drawImage(im, (d.w - vf.data.w * k) / 2, (d.h - vf.data.h * k) / 2, vf.data.w * k, vf.data.h * k); d.layers.push({ id:'l' + Date.now().toString(36), name:vf.name, vis:true, op:1, blend:'source-over', src:c.toDataURL('image/png') }); if(IE.f === imf) IE.f = null; cb(); };
    im.onerror = function(){ toast('Не удалось отрисовать векторный рисунок'); };
    im.src = u;
  }
  function renderImageEd(m, f){
    if(IE.f !== f){ IE = { f:f, layers:null, cur:0, tool:'brush', color:'#1D4ED8', color2:'#FFFFFF', size:24, hard:0.6, opacity:1, tol:32, contig:true, shape:'rect', stroke:4, shapeFill:false, font:'Inter, system-ui, sans-serif', fontSize:48, bold:true, grad:'linear', zoom:1, pan:{ x:0, y:0 }, sel:null, undo:[], redo:[], w:f.data.w, h:f.data.h, fitted:false }; }
    var B = function(label, html, fn, cls){ var b = h('button', { type:'button', 'class':'rb' + (cls ? ' ' + cls : ''), title:label, 'aria-label':label, html:html }); b.addEventListener('mousedown', function(e){ e.preventDefault(); }); b.addEventListener('click', fn); return b; };
    m.appendChild(h('div', { 'class':'ribbon', role:'toolbar', 'aria-label':'Изображение' }, [
      B('Отменить (Ctrl+Z)', SVGI('<path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2"/>', 16), ieUndo), B('Повторить (Ctrl+Shift+Z)', SVGI('<path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h2"/>', 16), ieRedo),
      h('span', { 'class':'rsep' }),
      B('Изображение', '<span class="rt">Изображение ▾</span>', function(e){ ieMenu(e.currentTarget, [{ head:'Изображение' }, { label:'Размер изображения…', icon:'layout', act:function(){ ieSizeDialog('image'); } }, { label:'Размер холста…', icon:'layout', act:function(){ ieSizeDialog('canvas'); } }, { label:'Повернуть на 90°', icon:'redo', act:function(){ ieTransform('rot'); } }, { label:'Отразить по горизонтали', icon:'redo', act:function(){ ieTransform('fh'); } }, { label:'Отразить по вертикали', icon:'redo', act:function(){ ieTransform('fv'); } }, { label:'Кадрировать по выделению', icon:'layout', act:function(){ ieSelOps('crop'); } }, { label:'Свести слои', icon:'layout', act:function(){ ieLayerAct('flat'); } }]); }),
      B('Коррекция и фильтры', '<span class="rt">Коррекция ▾</span>', function(e){ ieMenu(e.currentTarget, [{ head:'Коррекция' }].concat(IE_ADJ.slice(0, 11).map(function(d){ return { label:d.name + (d.p.length ? '…' : ''), icon:'edit', act:function(){ ieAdjDialog(d); } }; }), [{ head:'Фильтры' }], IE_ADJ.slice(11).map(function(d){ return { label:d.name + (d.p.length ? '…' : ''), icon:'edit', act:function(){ ieAdjDialog(d); } }; }))); }),
      B('Выделение', '<span class="rt">Выделение ▾</span>', function(e){ ieMenu(e.currentTarget, [{ head:'Выделение' }, { label:'Выделить всё', kb:MOD + 'A', icon:'all', act:function(){ ieSelOps('all'); } }, { label:'Снять выделение', kb:MOD + 'D', icon:'all', act:function(){ ieSelOps('none'); } }, { label:'Инвертировать', icon:'all', act:function(){ ieSelOps('inv'); } }, { sep:true }, { label:'Залить основным цветом', icon:'edit', act:function(){ ieSelOps('fill'); } }, { label:'Обвести', icon:'edit', act:function(){ ieSelOps('stroke'); } }, { label:'Удалить содержимое', kb:'Del', icon:'trash', act:function(){ ieSelOps('clear'); } }, { label:'Скопировать на новый слой', kb:MOD + 'J', icon:'copy', act:function(){ ieSelOps('layer'); } }, { label:'Вырезать на новый слой', icon:'copy', act:function(){ ieSelOps('cut'); } }]); }),
      B('Добавить картинку новым слоем', '<span class="rt">+ Картинка</span>', ieImportLayer),
      h('span', { 'class':'grow' }),
      B('Уменьшить', '<span class="rt">−</span>', function(){ IE.zoom = Math.max(0.05, IE.zoom / 1.25); ieApplyView(); ieOverlay(); }), h('span', { 'class':'ie-zoom', id:'ieZoom' }), B('Увеличить', '<span class="rt">+</span>', function(){ IE.zoom = Math.min(16, IE.zoom * 1.25); ieApplyView(); ieOverlay(); }), B('Вписать (Ctrl+0)', '<span class="rt">Вписать</span>', ieFit),
      B('Скачать', '<span class="rt">Скачать ▾</span>', function(e){ ieMenu(e.currentTarget, [{ head:'Сохранить на компьютер' }, { label:'PNG (с прозрачностью)', icon:'download', act:function(){ ieExport('png'); } }, { label:'JPEG', icon:'download', act:function(){ ieExport('jpg'); } }, { label:'WebP', icon:'download', act:function(){ ieExport('webp'); } }]); }, 'pri')
    ]));
    m.appendChild(h('div', { 'class':'ie-opts', id:'ieOpts' }));
    var tools = h('div', { 'class':'ie-tools', role:'toolbar', 'aria-label':'Инструменты', 'aria-orientation':'vertical' });
    IE_TOOLS.forEach(function(t){ var b = B(t[1], SVGI(t[3], 18), function(){ ieSetTool(t[0]); }); b.setAttribute('data-t', t[0]); tools.appendChild(b); });
    var view = h('div', { 'class':'ie-view', id:'ieView', tabindex:'0', 'aria-label':'Холст. Колесо с Ctrl — масштаб, пробел — рука' }, [
      h('div', { 'class':'ie-stage', id:'ieStage' }, [ h('canvas', { id:'ieCanvas', 'class':'ie-canvas' }), h('canvas', { id:'ieOver', 'class':'ie-over' }) ]) ]);
    var side = h('div', { 'class':'ie-side' }, [ h('div', { 'class':'ie-sh', text:'Слои' }), h('div', { id:'ieLayers' }) ]);
    m.appendChild(h('div', { 'class':'ie-body' }, [ tools, view, side ]));
    var start = function(){ ieSizeStage(); if(!IE.fitted){ ieFit(); IE.fitted = true; } else ieApplyView(); ieSetTool(IE.tool); ieRender(); ieLayersPanel(); ieAnts(); ieStatus(); ieBind(view); };
    if(IE.layers) start(); else { view.appendChild(h('div', { 'class':'of-empty', text:'Загрузка слоёв…' })); ieLoad(f, function(ls){ if(IE.f !== f) return; IE.layers = ls; IE.cur = ls.length - 1; var e = view.querySelector('.of-empty'); if(e) e.remove(); start(); }); }
    OF.commit = function(){ ieSave(true); };
  }
  function ieBind(view){
    var space = false, drag = null;
    view.addEventListener('wheel', function(e){ e.preventDefault(); if(e.ctrlKey || e.metaKey || e.altKey){ var r = view.getBoundingClientRect(), z = UI.scale / 100, mx = (e.clientX - r.left) / z, my = (e.clientY - r.top) / z, k = e.deltaY < 0 ? 1.15 : 1 / 1.15, nz = Math.min(16, Math.max(0.05, IE.zoom * k)); IE.pan.x = mx - (mx - IE.pan.x) * nz / IE.zoom; IE.pan.y = my - (my - IE.pan.y) * nz / IE.zoom; IE.zoom = nz; } else { IE.pan.x -= e.deltaX; IE.pan.y -= e.deltaY; } ieApplyView(); ieOverlay(); }, { passive:false });
    view.addEventListener('pointermove', function(e){ if(e.target.closest('.ie-dlg')) return; IE.cursor = iePt(e); if(!drag){ ieOverlay(); ieStatus(); } });
    view.addEventListener('pointerleave', function(){ IE.cursor = null; ieOverlay(); });
    view.addEventListener('pointerdown', function(e){
      if(e.button === 2 || e.target.closest('.ie-dlg') || e.target.closest('.ie-textin')) return;
      view.focus({ preventScroll:true });
      var p = iePt(e), t = IE.tool, z = UI.scale / 100, L = ieCur();
      if(space || t === 'hand' || e.button === 1){ var sx = e.clientX, sy = e.clientY, px = IE.pan.x, py = IE.pan.y; drag = { mv:function(ev){ IE.pan.x = px + (ev.clientX - sx) / z; IE.pan.y = py + (ev.clientY - sy) / z; ieApplyView(); }, up:function(){} }; }
      else if(t === 'picker'){ var d = ieComposite().getContext('2d').getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data; var hex = '#' + [d[0], d[1], d[2]].map(function(v){ return ('0' + v.toString(16)).slice(-2); }).join(''); if(e.altKey) IE.color2 = hex; else IE.color = hex; ieOptions(); toast('Цвет ' + hex.toUpperCase()); return; }
      else if(t === 'fill'){ if(p.x < 0 || p.y < 0 || p.x >= IE.w || p.y >= IE.h) return; iePush('Заливка'); ieFlood(Math.floor(p.x), Math.floor(p.y)); ieRender(); ieThumbs(); ieSave(); return; }
      else if(t === 'text'){ ieText(p); return; }
      else if(t === 'wand'){ if(p.x < 0 || p.y < 0 || p.x >= IE.w || p.y >= IE.h) return; var w = ieWand(Math.floor(p.x), Math.floor(p.y), IE.tol, IE.contig); if(w){ if(e.shiftKey && IE.sel){ IE.sel.path.addPath(w.path); ieRender(); } else ieSetSel(w.path, w.bbox, w.mask); } return; }
      else if(t === 'clone' && e.altKey){ IE.cloneSrc = p; IE.cloneOff = null; ieOptions(); ieOverlay(); toast('Источник штампа задан'); return; }
      else if(/brush|pencil|eraser|clone|blurb/.test(t)){
        if(L.lock) { toast('Слой закреплён'); return; }
        if(t === 'clone'){ if(!IE.cloneSrc){ toast('Alt+клик — выбрать, откуда копировать'); return; } if(!IE.cloneOff) IE.cloneOff = { x:IE.cloneSrc.x - p.x, y:IE.cloneSrc.y - p.y }; IE.cloneSnap = ieCopy(L.c); }
        iePush(({ brush:'Кисть', pencil:'Карандаш', eraser:'Ластик', clone:'Штамп', blurb:'Размытие' })[t]);
        IE.strokeC = ieCanvas(IE.w, IE.h); var last = p; ieStroke(p, p);
        drag = { mv:function(ev){ var q = iePt(ev); if(ev.shiftKey && drag.first){ q = { x:drag.first.x, y:q.y }; } ieStroke(last, q); last = q; IE.cursor = q; }, up:function(){ if(t === 'blurb'){ IE.preview = null; ieRender(); ieThumbs(); ieSave(); } else ieCommitPreview(); } };
      }
      else if(t === 'move'){ var s0 = p; IE.moveOff = { x:0, y:0 }; drag = { mv:function(ev){ var q = iePt(ev); IE.moveOff = { x:Math.round(q.x - s0.x), y:Math.round(q.y - s0.y) }; ieRender(); }, up:function(){ var o = IE.moveOff; IE.moveOff = null; if(o.x || o.y){ iePush('Перемещение'); var c = ieCanvas(IE.w, IE.h); c.getContext('2d').drawImage(L.c, o.x, o.y); L.c = c; } ieRender(); ieThumbs(); ieSave(); } }; }
      else if(t === 'rect' || t === 'ellipse' || t === 'crop'){
        var a = p, add = e.shiftKey, sub = e.altKey;
        drag = { mv:function(ev){ var q = iePt(ev); if(ev.shiftKey && !add){ var s = Math.max(Math.abs(q.x - a.x), Math.abs(q.y - a.y)); q = { x:a.x + Math.sign(q.x - a.x) * s, y:a.y + Math.sign(q.y - a.y) * s }; } var r = ieRectPath(a, q, t === 'ellipse'); IE.draft = function(x, k){ x.save(); x.lineWidth = k; x.setLineDash([4 * k, 3 * k]); x.strokeStyle = t === 'crop' ? '#F59E0B' : '#2563EB'; x.stroke(r.path); if(t === 'crop'){ x.fillStyle = 'rgba(0,0,0,.45)'; var pp = new Path2D(); pp.rect(0, 0, IE.w, IE.h); pp.addPath(r.path); x.fill(pp, 'evenodd'); } x.restore(); }; drag.r = r; ieOverlay(); },
          up:function(){ IE.draft = null; var r = drag.r; if(!r || r.bbox.w < 2 || r.bbox.h < 2){ if(t !== 'crop' && !add) ieSetSel(null); ieOverlay(); return; } if(t === 'crop'){ IE.cropBox = r.bbox; ieCrop(r.bbox); return; }
            if(add && IE.sel){ IE.sel.path.addPath(r.path); ieRender(); } else if(sub && IE.sel){ var p2 = new Path2D(); p2.addPath(IE.sel.path); p2.addPath(r.path); IE.sel = { path:p2, bbox:IE.sel.bbox, rule:'evenodd' }; ieRender(); } else ieSetSel(r.path, r.bbox); } };
      }
      else if(t === 'lasso'){ var pts = [p]; drag = { mv:function(ev){ pts.push(iePt(ev)); IE.draft = function(x, k){ x.save(); x.lineWidth = k; x.strokeStyle = '#2563EB'; x.beginPath(); pts.forEach(function(q, i){ if(i) x.lineTo(q.x, q.y); else x.moveTo(q.x, q.y); }); x.stroke(); x.restore(); }; ieOverlay(); }, up:function(){ IE.draft = null; if(pts.length < 3){ ieSetSel(null); return; } var path = new Path2D(), xs = pts.map(function(q){ return q.x; }), ys = pts.map(function(q){ return q.y; }); pts.forEach(function(q, i){ if(i) path.lineTo(q.x, q.y); else path.moveTo(q.x, q.y); }); path.closePath(); var bb = { x:Math.min.apply(0, xs), y:Math.min.apply(0, ys) }; bb.w = Math.max.apply(0, xs) - bb.x; bb.h = Math.max.apply(0, ys) - bb.y; if(e.shiftKey && IE.sel){ IE.sel.path.addPath(path); ieRender(); } else ieSetSel(path, bb); } }; }
      else if(t === 'shape' || t === 'gradient'){
        var a2 = p;
        var draw = function(x, q, k){
          if(t === 'gradient'){ var g = IE.grad === 'radial' ? x.createRadialGradient(a2.x, a2.y, 0, a2.x, a2.y, Math.hypot(q.x - a2.x, q.y - a2.y)) : x.createLinearGradient(a2.x, a2.y, q.x, q.y); g.addColorStop(0, IE.color); g.addColorStop(1, IE.color2); x.save(); ieClip(x); x.globalAlpha = IE.opacity; x.fillStyle = g; x.fillRect(0, 0, IE.w, IE.h); x.restore(); return; }
          x.save(); x.lineWidth = IE.stroke; x.strokeStyle = IE.color; x.fillStyle = IE.color2; x.lineCap = 'round'; x.lineJoin = 'round';
          var x0 = Math.min(a2.x, q.x), y0 = Math.min(a2.y, q.y), w = Math.abs(q.x - a2.x), hh = Math.abs(q.y - a2.y);
          if(IE.shape === 'rect'){ if(IE.shapeFill) x.fillRect(x0, y0, w, hh); if(IE.stroke) x.strokeRect(x0, y0, w, hh); }
          else if(IE.shape === 'ellipse'){ x.beginPath(); x.ellipse(x0 + w / 2, y0 + hh / 2, w / 2, hh / 2, 0, 0, Math.PI * 2); if(IE.shapeFill) x.fill(); if(IE.stroke) x.stroke(); }
          else { x.beginPath(); x.moveTo(a2.x, a2.y); x.lineTo(q.x, q.y); x.stroke(); if(IE.shape === 'arrow'){ var an = Math.atan2(q.y - a2.y, q.x - a2.x), s = Math.max(10, IE.stroke * 4); x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q.x - s * Math.cos(an - 0.45), q.y - s * Math.sin(an - 0.45)); x.lineTo(q.x - s * Math.cos(an + 0.45), q.y - s * Math.sin(an + 0.45)); x.closePath(); x.fillStyle = IE.color; x.fill(); } }
          x.restore();
        };
        drag = { mv:function(ev){ var q = iePt(ev); if(ev.shiftKey){ if(t === 'shape' && IE.shape !== 'line' && IE.shape !== 'arrow'){ var s = Math.max(Math.abs(q.x - a2.x), Math.abs(q.y - a2.y)); q = { x:a2.x + Math.sign(q.x - a2.x) * s, y:a2.y + Math.sign(q.y - a2.y) * s }; } else { var an2 = Math.round(Math.atan2(q.y - a2.y, q.x - a2.x) / (Math.PI / 4)) * Math.PI / 4, ds = Math.hypot(q.x - a2.x, q.y - a2.y); q = { x:a2.x + Math.cos(an2) * ds, y:a2.y + Math.sin(an2) * ds }; } } drag.q = q; IE.draft = function(x, k){ if(t === 'gradient'){ x.save(); x.strokeStyle = '#fff'; x.lineWidth = 2 * k; x.beginPath(); x.moveTo(a2.x, a2.y); x.lineTo(q.x, q.y); x.stroke(); x.restore(); return; } draw(x, q, k); }; ieOverlay(); },
          up:function(){ IE.draft = null; if(!drag.q){ ieOverlay(); return; } iePush(t === 'gradient' ? 'Градиент' : 'Фигура'); draw(L.c.getContext('2d'), drag.q); ieRender(); ieThumbs(); ieSave(); } };
      }
      if(!drag) return;
      try{ view.setPointerCapture(e.pointerId); }catch(_){}
      var d0 = drag;
      var mv = function(ev){ d0.mv(ev); }, up = function(ev){ document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); d0.up(ev); drag = null; };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    view.addEventListener('keydown', function(e){
      if(e.target.closest && (e.target.closest('.ie-dlg') || e.target.closest('.ie-textin'))) return;
      var mod = e.ctrlKey || e.metaKey, k = e.key, handled = true;
      if(k === ' '){ space = true; view.classList.add('panning'); }
      else if(mod && !e.shiftKey && (e.code === 'KeyZ')) ieUndo();
      else if(mod && (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ'))) ieRedo();
      else if(mod && (e.code === 'KeyC' || e.code === 'KeyX')){ ieClipCopy(e.code === 'KeyX'); handled = false; }
      else if(mod && e.code === 'KeyV'){ clearTimeout(OF.pasteWait); OF.pasteWait = setTimeout(function(){ OF.pasteWait = null; iePasteClip(); }, 150); handled = false; }
      else if(mod && e.code === 'KeyA') ieSelOps('all');
      else if(mod && e.code === 'KeyD') ieSelOps('none');
      else if(mod && e.shiftKey && e.code === 'KeyI') ieSelOps('inv');
      else if(mod && e.code === 'KeyJ') ieSelOps('layer');
      else if(mod && e.code === 'Digit0') ieFit();
      else if(mod && (k === '=' || k === '+')){ IE.zoom = Math.min(16, IE.zoom * 1.25); ieApplyView(); }
      else if(mod && k === '-'){ IE.zoom = Math.max(0.05, IE.zoom / 1.25); ieApplyView(); }
      else if(k === 'Delete' || k === 'Backspace') ieSelOps('clear');
      else if(k === 'Enter' && IE.tool === 'crop' && IE.sel) ieSelOps('crop');
      else if(k === '[' ){ IE.size = Math.max(1, Math.round(IE.size / 1.2)); ieOptions(); ieOverlay(); }
      else if(k === ']'){ IE.size = Math.min(300, Math.round(IE.size * 1.2)); ieOptions(); ieOverlay(); }
      else if(k === 'x' || k === 'X' || k === 'ч' || k === 'Ч'){ var a = IE.color; IE.color = IE.color2; IE.color2 = a; ieOptions(); }
      else if(/^Arrow/.test(k) && IE.tool === 'move'){ var s = e.shiftKey ? 10 : 1, dx = k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0, dy = k === 'ArrowUp' ? -s : k === 'ArrowDown' ? s : 0; iePush('Сдвиг'); var L = ieCur(), c = ieCanvas(IE.w, IE.h); c.getContext('2d').drawImage(L.c, dx, dy); L.c = c; ieRender(); ieThumbs(); ieSave(); }
      else if(!mod && !e.altKey){ var tl = IE_TOOLS.filter(function(t){ return t[2] && (e.code === 'Key' + t[2]); })[0]; if(tl) ieSetTool(tl[0]); else handled = false; }
      else handled = false;
      if(handled){ e.preventDefault(); e.stopPropagation(); }
    });
    view.addEventListener('keyup', function(e){ if(e.key === ' '){ space = false; view.classList.remove('panning'); } });
  }
