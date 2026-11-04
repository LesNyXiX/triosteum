  /* ---------- «желе»: элемент мягко вытягивается по ходу движения и пружинит ----------
     Без наклонов и поворотов — только растяжение вдоль направления движения.
     Значения сглаживаются пружиной в requestAnimationFrame, поэтому на телефоне
     (частые события касания) блок не дёргается и не «корёжится». */
  var JELLY = { max:0.03, gain:0.012, stiff:0.18, damp:0.72 };
  function jellyOff(){ return document.body.classList.contains('noanim') || (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches); }
  function jellyApply(el, s, hor){ el.style.transform = s < 0.002 ? '' : 'scale(' + (hor ? 1 + s : 1 - s * 0.6).toFixed(4) + ',' + (hor ? 1 - s * 0.6 : 1 + s).toFixed(4) + ')'; }
  function jellyLoop(st, el){
    if(st.jraf) return;
    st.jraf = requestAnimationFrame(function step(){
      st.jraf = 0;
      if(!el.isConnected || !el.classList.contains('jelly-on')){ el.style.transform = ''; return; }
      var idle = performance.now() - st.jt > 60;                       // курсор остановился — цель «ноль»
      var target = idle ? 0 : Math.min(JELLY.max, st.speed * JELLY.gain);
      st.jv = (st.jv + (target - st.js) * JELLY.stiff) * JELLY.damp;
      st.js = Math.max(0, st.js + st.jv);
      jellyApply(el, st.js, st.hor);
      if(st.jlive || st.js > 0.001 || Math.abs(st.jv) > 0.0005) st.jraf = requestAnimationFrame(step);
      else el.style.transform = '';
    });
  }
  function jellyMove(st, e, el){
    if(!el || jellyOff()) return;
    var now = performance.now();
    if(st.jel !== el){ if(st.jel) st.jel.style.transform = ''; st.jel = el; st.js = st.js || 0; st.jv = st.jv || 0; }
    if(st.jt === undefined){ st.jx = e.clientX; st.jy = e.clientY; st.jt = now; st.speed = 0; st.js = 0; st.jv = 0; st.hor = true; st.jlive = true; el.classList.remove('jelly-end'); el.classList.add('jelly-on'); return; }
    var dt = now - st.jt; if(dt < 4) return;
    var vx = (e.clientX - st.jx) / dt, vy = (e.clientY - st.jy) / dt;
    st.vx = (st.vx || 0) * 0.7 + vx * 0.3; st.vy = (st.vy || 0) * 0.7 + vy * 0.3;
    st.speed = Math.min(3, Math.hypot(st.vx, st.vy)); st.hor = Math.abs(st.vx) >= Math.abs(st.vy);
    st.jx = e.clientX; st.jy = e.clientY; st.jt = now; st.jlive = true;
    jellyLoop(st, el);
  }
  // отпустили — короткая затухающая пружинка
  function jellyEnd(st, el){
    if(st){ st.jlive = false; if(st.jraf){ cancelAnimationFrame(st.jraf); st.jraf = 0; } }
    if(!el) return;
    el.style.transform = ''; el.classList.remove('jelly-on');
    if(jellyOff()) return;
    el.classList.remove('jelly-end'); void el.offsetWidth; el.classList.add('jelly-end');
    setTimeout(function(){ el.classList.remove('jelly-end'); }, 520);
  }
  document.addEventListener('pointerup', function(){ setTimeout(function(){ Array.prototype.forEach.call(document.querySelectorAll('.jelly-on'), function(x){ if(!x.classList.contains('dragging')){ x.style.transform = ''; x.classList.remove('jelly-on'); } }); }, 0); }, true);
