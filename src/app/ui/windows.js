  /* ---------- окна: перемещение за заголовок и размер за угол ---------- */
  // mode 'fixed' — окно на экране (left/top), 'canvas' — внутри доски, 'shift' — смещение от центра
  // сохранённое положение окна: только конечные числа, иначе считаем, что его нет
  function cleanGeo(g){
    if(!g || typeof g !== 'object') return null;
    var out = {}, ok = false;
    ['l', 't', 'w', 'h'].forEach(function(k){ var v = Number(g[k]); if(g[k] !== undefined && g[k] !== null && isFinite(v)){ out[k] = v; ok = true; } });
    if((out.l === undefined) !== (out.t === undefined)){ delete out.l; delete out.t; }
    if((out.w === undefined) !== (out.h === undefined) || out.w < 120 || out.h < 80){ delete out.w; delete out.h; }
    if(SNAP_SIDES.indexOf(g.snap) >= 0){ out.snap = g.snap; ok = true; var p = cleanGeo(g.prev); if(p && !p.snap) out.prev = p; }
    return ok && Object.keys(out).length ? out : null;
  }

  /* ---------- прилипание окон к краям, как в Windows ----------
     Окно, брошенное к левому, правому, верхнему или нижнему краю рабочей области, занимает
     её половину; в угол — четверть. Доска (и любая среда) ужимается в оставшуюся часть.
     Границу между окном и средой можно тянуть; потянуть окно за заголовок — оно отлипнет. */
  var SNAP_SIDES = ['l', 'r', 't', 'b', 'tl', 'tr', 'bl', 'br'];
  var SNAP_WINS = [], SNAP_R = (function(){ var r = load('triosteum.snapR', null) || {}, o = {}; ['l', 'r', 't', 'b'].forEach(function(k){ var v = Number(r[k]); o[k] = isFinite(v) && v >= 0.15 && v <= 0.85 ? v : 0.5; }); return o; })();
  var snapRow = null, snapGhost = null, snapSplits = {}, snapBusy = false, snapSlots = [];
  function snapOn(){ return window.innerWidth > 640; }
  function snapArea(){
    if(!snapRow){ snapRow = document.querySelector('.row'); snapRow.addEventListener('transitionend', function(e){ if(e.target === snapRow && /^padding/.test(e.propertyName) && !snapBusy) window.dispatchEvent(new Event('resize')); }); } var r = snapRow.getBoundingClientRect(); return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; }
  function snapCol(s){ return s === 'l' || s === 'tl' || s === 'bl' ? 'l' : (s === 'r' || s === 'tr' || s === 'br' ? 'r' : s); }
  // раскладка: какие края заняты, сколько места у каждого и где стоит каждое прилипшее окно
  function snapPlan(){
    var A = snapArea(), live = SNAP_WINS.filter(function(w){ return w.snap() && !w.win.hidden && snapOn(); });
    var has = { l:false, r:false, t:false, b:false }, cols = { l:{ t:0, b:0, f:0 }, r:{ t:0, b:0, f:0 } };
    live.forEach(function(w){ var s = w.snap(), c = snapCol(s); has[c] = true; if(c === 'l' || c === 'r') cols[c][s.length === 2 ? s[0] : 'f']++; });
    var L = has.l ? SNAP_R.l * A.width : 0, R = has.r ? SNAP_R.r * A.width : 0;
    if(L + R > A.width * 0.8){ var k = A.width * 0.8 / (L + R); L *= k; R *= k; }
    var x0 = A.left + L, x1 = A.right - R;
    var T = has.t ? SNAP_R.t * A.height : 0, B = has.b ? SNAP_R.b * A.height : 0;
    if(T + B > A.height * 0.8){ var q = A.height * 0.8 / (T + B); T *= q; B *= q; }
    var rects = [], free = [];
    live.forEach(function(w){
      var s = w.snap(), c = snapCol(s), r;
      if(c === 'l' || c === 'r'){
        var x = c === 'l' ? A.left : A.right - R, wd = c === 'l' ? L : R, half = s.length === 2 && cols[c].t && cols[c].b;
        r = { x:x, y:A.top, w:wd, h:A.height };
        if(s.length === 2){ r.h = A.height / 2; if(s[0] === 'b') r.y = A.top + A.height / 2; if(!half) free.push({ x:r.x, y:s[0] === 'b' ? A.top : A.top + A.height / 2, w:r.w, h:A.height / 2 }); }
      } else if(c === 't') r = { x:x0, y:A.top, w:x1 - x0, h:T };
      else r = { x:x0, y:A.bottom - B, w:x1 - x0, h:B };
      rects.push({ w:w, r:r });
    });
    return { A:A, has:has, L:L, R:R, T:T, B:B, x0:x0, x1:x1, rects:rects, free:free };
  }
  function snapLayout(){
    if(!document.querySelector('.row')) return;
    var P = snapPlan(), st = document.documentElement.style;
    st.setProperty('--snap-l', P.L + 'px'); st.setProperty('--snap-r', P.R + 'px'); st.setProperty('--snap-t', P.T + 'px'); st.setProperty('--snap-b', P.B + 'px');
    document.body.classList.toggle('snapped', P.rects.length > 0);
    P.rects.forEach(function(o){ o.w.place(o.r); });
    // свободная четверть рядом с угловым окном: подсказка, что сюда можно поставить ещё одно
    snapSlots = snapSlots.filter(function(d, i){ if(i < P.free.length) return true; d.remove(); return false; });
    P.free.forEach(function(r, i){
      var d = snapSlots[i];
      if(!d){ d = document.createElement('div'); d.className = 'snap-slot'; d.innerHTML = '<span>Свободное место — перетащите сюда окно</span>'; document.body.appendChild(d); snapSlots.push(d); }
      d.style.left = (r.x + 8) + 'px'; d.style.top = (r.y + 8) + 'px'; d.style.width = Math.max(0, r.w - 16) + 'px'; d.style.height = Math.max(0, r.h - 16) + 'px';
    });
    // перетаскиваемые границы между окнами и средой
    ['l', 'r', 't', 'b'].forEach(function(s){
      var on = P.has[s], d = snapSplits[s];
      if(!on){ if(d) d.hidden = true; return; }
      if(!d){ d = snapSplits[s] = snapSplitter(s); }
      d.hidden = false;
      if(s === 'l' || s === 'r'){ d.style.left = ((s === 'l' ? P.A.left + P.L : P.A.right - P.R) - 5) + 'px'; d.style.top = P.A.top + 'px'; d.style.height = P.A.height + 'px'; d.style.width = '10px'; }
      else { d.style.top = ((s === 't' ? P.A.top + P.T : P.A.bottom - P.B) - 5) + 'px'; d.style.left = P.x0 + 'px'; d.style.width = (P.x1 - P.x0) + 'px'; d.style.height = '10px'; }
    });
  }
  // раскладка поменялась — доска, миникарта и панели пересчитывают свои размеры
  function snapNotify(){
    if(snapBusy) return; snapBusy = true;
    try { snapLayout(); window.dispatchEvent(new Event('resize')); } finally { snapBusy = false; }
  }
  function snapSplitter(s){
    var d = document.createElement('div'); d.className = 'snap-split ss-' + s; d.setAttribute('role', 'separator');
    d.setAttribute('aria-orientation', s === 'l' || s === 'r' ? 'vertical' : 'horizontal'); d.setAttribute('aria-label', 'Граница окна и среды — тяните, двойной щелчок вернёт половину');
    d.tabIndex = 0;
    var on = false, raf = 0;
    d.addEventListener('pointerdown', function(e){ if(e.button !== 0) return; e.preventDefault(); on = true; d.setPointerCapture(e.pointerId); d.classList.add('drag'); document.body.classList.add('snap-resizing'); });
    d.addEventListener('pointermove', function(e){
      if(!on) return;
      var A = snapArea(), v = s === 'l' ? (e.clientX - A.left) / A.width : s === 'r' ? (A.right - e.clientX) / A.width : s === 't' ? (e.clientY - A.top) / A.height : (A.bottom - e.clientY) / A.height;
      SNAP_R[s] = Math.max(0.15, Math.min(0.85, v));
      if(!raf) raf = requestAnimationFrame(function(){ raf = 0; snapNotify(); });
    });
    function end(){ if(!on) return; on = false; d.classList.remove('drag'); document.body.classList.remove('snap-resizing'); save('triosteum.snapR', SNAP_R); snapNotify(); }
    d.addEventListener('pointerup', end); d.addEventListener('pointercancel', end);
    d.addEventListener('dblclick', function(){ SNAP_R[s] = 0.5; save('triosteum.snapR', SNAP_R); snapNotify(); });
    d.addEventListener('keydown', function(e){
      var grow = { l:'ArrowRight', r:'ArrowLeft', t:'ArrowDown', b:'ArrowUp' }[s], shrink = { l:'ArrowLeft', r:'ArrowRight', t:'ArrowUp', b:'ArrowDown' }[s];
      if(e.key !== grow && e.key !== shrink) return; e.preventDefault();
      SNAP_R[s] = Math.max(0.15, Math.min(0.85, SNAP_R[s] + (e.key === grow ? 0.05 : -0.05))); save('triosteum.snapR', SNAP_R); snapNotify();
    });
    document.body.appendChild(d); return d;
  }
  // куда прилипнет окно, если отпустить его здесь
  function snapTarget(x, y){
    if(!snapOn()) return null;
    var A = snapArea(), E = 26, C = 90;
    var nl = x <= A.left + E, nr = x >= A.right - E, nt = y <= A.top + E, nb = y >= A.bottom - E;
    var cl = x <= A.left + C, cr = x >= A.right - C, ct = y <= A.top + C, cb = y >= A.bottom - C;
    if((nl || nt) && cl && ct) return 'tl';
    if((nr || nt) && cr && ct) return 'tr';
    if((nl || nb) && cl && cb) return 'bl';
    if((nr || nb) && cr && cb) return 'br';
    return nl ? 'l' : nr ? 'r' : nt ? 't' : nb ? 'b' : null;
  }
  // предпросмотр места: та же раскладка, как если бы окно уже прилипло
  function snapPreview(w, s){
    if(!s){ if(snapGhost) snapGhost.classList.remove('on'); return; }
    if(!snapGhost){ snapGhost = document.createElement('div'); snapGhost.className = 'snap-ghost'; snapGhost.setAttribute('aria-hidden', 'true'); document.body.appendChild(snapGhost); }
    var was = w.trySnap; w.trySnap = s;
    var P = snapPlan(), hit = P.rects.filter(function(o){ return o.w === w; })[0];
    w.trySnap = was;
    if(!hit) return;
    var r = hit.r;
    snapGhost.style.left = (r.x + 6) + 'px'; snapGhost.style.top = (r.y + 6) + 'px'; snapGhost.style.width = Math.max(0, r.w - 12) + 'px'; snapGhost.style.height = Math.max(0, r.h - 12) + 'px';
    snapGhost.classList.add('on');
  }
  window.addEventListener('resize', function(){ if(!snapBusy) snapLayout(); });

  function makeWindow(win, handleSel, key, mode, onReset){
    var geo = cleanGeo(load('triosteum.win.' + key, null)), mv = null, rz = false, handleAt = 0, rz0 = null;
    function persist(){ save('triosteum.win.' + key, geo); }
    var W = {
      win:win, trySnap:null,
      snap:function(){ return W.trySnap || (mode === 'fixed' && geo && geo.snap) || null; },
      place:function(r){
        var g = 4;
        win.style.left = (r.x + g) + 'px'; win.style.top = (r.y + g) + 'px';
        win.style.width = Math.max(120, r.w - g * 2) + 'px'; win.style.height = Math.max(80, r.h - g * 2) + 'px';
        win.style.maxHeight = 'none'; win.style.maxWidth = 'none'; win.style.transform = '';
      }
    };
    if(mode === 'fixed'){
      SNAP_WINS.push(W);
      win.classList.add('snappable');
      // открыли или закрыли прилипшее окно — среда занимает освободившееся место
      // (закрытие с анимацией: место освобождается сразу, пока окно тает)
      var wasShown = !win.hidden;
      new MutationObserver(function(){ var shown = !win.hidden; if(shown === wasShown) return; wasShown = shown; win.classList.toggle('is-snapped', !!W.snap()); if(geo && geo.snap) snapNotify(); }).observe(win, { attributes:true, attributeFilter:['hidden', 'class'] });
    }
    function apply(){
      win.classList.toggle('is-snapped', !!(geo && geo.snap && snapOn()));
      if(!geo || window.innerWidth <= 640) return;
      if(geo.snap && mode === 'fixed'){ snapNotify(); return; }
      if(mode !== 'shift'){                             // окно, сохранённое на большом экране, не должно оказаться за краем
        var bb = bounds(), ww = geo.w || win.offsetWidth || 320;
        if(geo.w) geo.w = Math.min(geo.w, Math.max(260, bb.width - 16));
        if(geo.h) geo.h = Math.min(geo.h, Math.max(160, bb.height - (mode === 'canvas' ? 16 : 64)));
        var hh0 = geo.h || win.offsetHeight || 200, top0 = mode === 'canvas' ? 0 : 52;
        ww = geo.w || win.offsetWidth || 320;
        if(geo.l !== undefined) geo.l = Math.max(mode === 'canvas' ? 0 : 8, Math.min(bb.width - ww - 8, geo.l));
        if(geo.t !== undefined) geo.t = Math.max(top0, Math.min(bb.height - Math.min(hh0, bb.height - top0 - 8) - 8, geo.t));
      }
      win.style.maxWidth = '';
      if(geo.w){ win.style.width = geo.w + 'px'; win.style.height = geo.h + 'px'; win.style.maxHeight = 'none'; }
      if(geo.l !== undefined){
        if(mode === 'shift') win.style.transform = 'translate(' + geo.l + 'px,' + geo.t + 'px)';
        else { win.style.left = geo.l + 'px'; win.style.top = geo.t + 'px'; if(mode === 'canvas') win.style.bottom = 'auto'; }
      }
      if(mode === 'fixed' && geo.t !== undefined){   // окно не уходит за нижний край экрана — угол размера всегда доступен
        var room = Math.max(160, window.innerHeight - geo.t - 12);
        if(geo.h) win.style.height = Math.min(geo.h, room) + 'px'; else win.style.maxHeight = room + 'px';
      }
    }
    function bounds(){ return mode === 'canvas' ? el.canvas.getBoundingClientRect() : { left:0, top:0, width:window.innerWidth, height:window.innerHeight }; }
    window.addEventListener('resize', function(){ if(!win.hidden && !(geo && geo.snap)) apply(); });
    win.addEventListener('pointerdown', function(e){
      if(window.innerWidth <= 640 || e.button !== 0) return;
      var r = win.getBoundingClientRect();
      if(e.clientX > r.right - 18 && e.clientY > r.bottom - 18){ rz = true; rz0 = { w:r.width, h:r.height }; return; }   // угол изменения размера
      var hd = e.target.closest(handleSel);
      if(!hd || !win.contains(hd) || e.target.closest('button, input, select, textarea, a, label')) return;
      e.preventDefault(); handleAt = Date.now();
      var b = bounds(), cur = geo || {};
      mv = { sx:e.clientX, sy:e.clientY, l:mode === 'shift' ? (cur.l || 0) : r.left - b.left, t:mode === 'shift' ? (cur.t || 0) : r.top - b.top, fx:(e.clientX - r.left) / r.width, fy:e.clientY - r.top, on:false };
      win.setPointerCapture(e.pointerId);
    });
    win.addEventListener('pointermove', function(e){
      if(!mv) return;
      if(!mv.on){ if(Math.abs(e.clientX - mv.sx) + Math.abs(e.clientY - mv.sy) < 6) return; mv.on = true; }
      // прилипшее окно отлипает и возвращает свой прежний размер — под курсором, как в Windows
      if(geo && geo.snap){
        var p = geo.prev || {}, pw = p.w || Math.min(560, win.offsetWidth), ph = p.h || Math.min(Math.round(window.innerHeight * 0.7), win.offsetHeight);
        geo = { w:pw, h:ph, l:0, t:0 };
        win.classList.remove('is-snapped'); win.style.maxWidth = '';
        win.style.width = pw + 'px'; win.style.height = ph + 'px';
        mv.l = e.clientX - pw * mv.fx; mv.t = e.clientY - Math.min(mv.fy, 30); mv.sx = e.clientX; mv.sy = e.clientY;
        snapNotify();
      }
      var b = bounds(), l = mv.l + e.clientX - mv.sx, t = mv.t + e.clientY - mv.sy;
      if(mode !== 'shift'){
        l = Math.max(-win.offsetWidth + 80, Math.min(b.width - 80, l));
        t = Math.max(mode === 'canvas' ? 0 : 52, Math.min(b.height - 40, t));
      }
      geo = geo || {}; geo.l = l; geo.t = t; apply();
      if(mode === 'fixed'){ mv.snap = snapTarget(e.clientX, e.clientY); snapPreview(W, mv.snap); document.body.classList.toggle('snap-dragging', true); }
    });
    function dropWin(){
      if(!mv) return;
      var s = mv.snap, moved = mv.on; mv = null;
      document.body.classList.remove('snap-dragging'); snapPreview(W, null);
      if(s && moved){
        var r = win.getBoundingClientRect();
        geo = { snap:s, prev:{ l:geo && geo.l !== undefined ? geo.l : r.left, t:geo && geo.t !== undefined ? geo.t : r.top, w:r.width, h:r.height }, l:r.left, t:r.top };
        win.classList.add('is-snapped'); persist(); snapNotify(); return;
      }
      persist();
    }
    win.addEventListener('pointerup', dropWin);
    win.addEventListener('pointercancel', function(){ if(mv){ mv.snap = null; dropWin(); } });
    window.addEventListener('pointerup', function(){
      if(!rz) return; rz = false;
      if(window.innerWidth <= 640) return;
      // размер прилипшего окна за угол — это сдвиг границы со средой
      if(geo && geo.snap){
        var c = snapCol(geo.snap), A = snapArea();
        if(c === 'l' || c === 'r'){ if(Math.abs(win.offsetWidth - rz0.w) > 2) SNAP_R[c] = Math.max(0.15, Math.min(0.85, (win.offsetWidth + 8) / A.width)); }
        else if(Math.abs(win.offsetHeight - rz0.h) > 2) SNAP_R[c] = Math.max(0.15, Math.min(0.85, (win.offsetHeight + 8) / A.height));
        save('triosteum.snapR', SNAP_R); snapNotify(); return;
      }
      geo = geo || {}; geo.w = win.offsetWidth; geo.h = win.offsetHeight;
      if(mode === 'fixed' && geo.l === undefined){ var r = win.getBoundingClientRect(); geo.l = r.left; geo.t = r.top; }
      persist();
    });
    win.addEventListener('dblclick', function(e){
      if(Date.now() - handleAt > 700) return;          // двойной клик был не по заголовку
      var was = !!(geo && geo.snap);
      geo = null; persist(); win.classList.remove('is-snapped');
      ['width','height','maxHeight','maxWidth','left','top','bottom','transform'].forEach(function(p){ win.style[p] = ''; });
      if(was) snapNotify();
      if(onReset) onReset();
    });
    // прилепить окно с клавиатуры или из меню: side — l, r, t, b, tl, tr, bl, br или null
    W.setSnap = function(s){
      if(mode !== 'fixed') return;
      var r = win.getBoundingClientRect();
      if(s){ geo = { snap:s, prev:geo && !geo.snap ? { l:geo.l, t:geo.t, w:geo.w || r.width, h:geo.h || r.height } : (geo && geo.prev) || { w:r.width, h:r.height }, l:r.left, t:r.top }; win.classList.add('is-snapped'); }
      else if(geo && geo.snap){ var p = geo.prev || {}; geo = { l:p.l !== undefined ? p.l : Math.max(8, (window.innerWidth - (p.w || 560)) / 2), t:p.t !== undefined ? p.t : 80, w:p.w, h:p.h }; if(!geo.w){ delete geo.w; delete geo.h; } win.classList.remove('is-snapped'); win.style.maxWidth = ''; apply(); }
      persist(); snapNotify();
    };
    if(mode === 'fixed') snapKeys(W, win);
    return { apply:apply, pinned:function(){ return !!(geo && (geo.l !== undefined || geo.snap)) && window.innerWidth > 640; }, snap:W.setSnap };
  }
  // Ctrl+Alt+стрелки в окне — прилепить к краю (как Win+стрелки); стрелка к противоположному краю — отлепить
  function snapKeys(W, win){
    win.addEventListener('keydown', function(e){
      if(!(e.ctrlKey && e.altKey) || !/^Arrow/.test(e.key) || !snapOn()) return;
      e.preventDefault(); e.stopPropagation();
      var cur = W.snap(), d = { ArrowLeft:'l', ArrowRight:'r', ArrowUp:'t', ArrowDown:'b' }[e.key];
      var opp = { l:'r', r:'l', t:'b', b:'t' };
      if(!cur) return W.setSnap(d);
      // половина + вверх/вниз → четверть, как в Windows 11
      if((cur === 'l' || cur === 'r') && (d === 't' || d === 'b')) return W.setSnap(d + cur);
      if(cur.length === 2 && (d === 'l' || d === 'r') && cur[1] !== d) return W.setSnap(cur[0] + d);
      if(cur.length === 2 && (d === 't' || d === 'b') && cur[0] !== d) return W.setSnap(cur[1]);
      if(opp[cur] === d) return W.setSnap(null);
      W.setSnap(d);
    });
  }
