  /* ---------- окна: перемещение за заголовок и размер за угол ---------- */
  // mode 'fixed' — окно на экране (left/top), 'canvas' — внутри доски, 'shift' — смещение от центра
  function makeWindow(win, handleSel, key, mode, onReset){
    var geo = load('triosteum.win.' + key, null), mv = null, rz = false, handleAt = 0;
    function persist(){ save('triosteum.win.' + key, geo); }
    function apply(){
      if(!geo || window.innerWidth <= 640) return;
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
    win.addEventListener('pointerdown', function(e){
      if(window.innerWidth <= 640 || e.button !== 0) return;
      var r = win.getBoundingClientRect();
      if(e.clientX > r.right - 18 && e.clientY > r.bottom - 18){ rz = true; return; }   // угол изменения размера
      var hd = e.target.closest(handleSel);
      if(!hd || !win.contains(hd) || e.target.closest('button, input, select, textarea, a, label')) return;
      e.preventDefault(); handleAt = Date.now();
      var b = bounds(), cur = geo || {};
      mv = { sx:e.clientX, sy:e.clientY, l:mode === 'shift' ? (cur.l || 0) : r.left - b.left, t:mode === 'shift' ? (cur.t || 0) : r.top - b.top };
      win.setPointerCapture(e.pointerId);
    });
    win.addEventListener('pointermove', function(e){
      if(!mv) return;
      var b = bounds(), l = mv.l + e.clientX - mv.sx, t = mv.t + e.clientY - mv.sy;
      if(mode !== 'shift'){
        l = Math.max(-win.offsetWidth + 80, Math.min(b.width - 80, l));
        t = Math.max(mode === 'canvas' ? 0 : 52, Math.min(b.height - 40, t));
      }
      geo = geo || {}; geo.l = l; geo.t = t; apply();
    });
    win.addEventListener('pointerup', function(){ if(mv){ mv = null; persist(); } });
    window.addEventListener('pointerup', function(){
      if(!rz) return; rz = false;
      if(window.innerWidth <= 640) return;
      geo = geo || {}; geo.w = win.offsetWidth; geo.h = win.offsetHeight;
      if(mode === 'fixed' && geo.l === undefined){ var r = win.getBoundingClientRect(); geo.l = r.left; geo.t = r.top; }
      persist();
    });
    win.addEventListener('dblclick', function(e){
      if(Date.now() - handleAt > 700) return;          // двойной клик был не по заголовку
      geo = null; persist();
      ['width','height','maxHeight','left','top','bottom','transform'].forEach(function(p){ win.style[p] = ''; });
      if(onReset) onReset();
    });
    return { apply:apply, pinned:function(){ return !!(geo && geo.l !== undefined) && window.innerWidth > 640; } };
  }
