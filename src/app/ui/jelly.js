  /* ---------- «желе» на настоящей физике пружин (библиотека wobble) ----------
     Две независимые пружины — ширина и высота. Цель каждой зависит от скорости
     по своей оси, поэтому форма меняется плавно и не «перескакивает» при смене
     направления. Пружины решаются аналитически: на телефоне с частыми касаниями
     и на мониторах 60/120 Гц движение одинаково ровное. После отпускания пружины
     сами доигрывают затухающее колебание — это и есть «желе». */
  var JELLY = { max:0.04, drag:{ stiffness:520, damping:30, mass:1 }, release:{ stiffness:380, damping:9, mass:1 } };
  function jellyOff(){ return document.body.classList.contains('noanim') || (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches) || typeof Wobble === 'undefined'; }
  function jellySprings(st, el){
    if(st.jel === el && st.jsx) return;
    jellyStop(st);
    st.jel = el;
    var paint = function(){ var x = st.jsx.currentValue, y = st.jsy.currentValue; el.style.transform = Math.abs(x - 1) < 0.0008 && Math.abs(y - 1) < 0.0008 ? '' : 'scale(' + x.toFixed(4) + ',' + y.toFixed(4) + ')'; };
    st.jsx = new Wobble.Spring(Object.assign({ fromValue:1, toValue:1, restDisplacementThreshold:0.00005, restVelocityThreshold:0.00002 }, JELLY.drag));
    st.jsy = new Wobble.Spring(Object.assign({ fromValue:1, toValue:1, restDisplacementThreshold:0.00005, restVelocityThreshold:0.00002 }, JELLY.drag));
    st.jsx.onUpdate(paint); st.jsy.onUpdate(paint);
    st.jsx.onStop(paint); st.jsy.onStop(paint);
  }
  function jellyTarget(st, tx, ty, cfg){
    [[st.jsx, tx], [st.jsy, ty]].forEach(function(p){
      var s = p[0];
      if(Math.abs(s.currentValue - p[1]) < 0.0004 && Math.abs(s.currentVelocity) < 0.0004 && !s.isAnimating) return;
      s.updateConfig(Object.assign({ toValue:p[1] }, cfg || {})).start();
    });
  }
  function jellyStop(st){ if(st && st.jsx){ st.jsx.stop(); st.jsy.stop(); st.jsx.removeAllListeners && st.jsx.removeAllListeners(); st.jsy.removeAllListeners && st.jsy.removeAllListeners(); if(st.jel) st.jel.style.transform = ''; st.jsx = st.jsy = null; } }
  function jellyMove(st, e, el){
    if(!el || jellyOff()) return;
    var now = performance.now();
    jellySprings(st, el);
    if(st.jt === undefined){ st.jx = e.clientX; st.jy = e.clientY; st.jt = now; st.vx = 0; st.vy = 0; el.classList.remove('jelly-end'); el.classList.add('jelly-on'); return; }
    var dt = now - st.jt; if(dt < 4) return;
    var vx = (e.clientX - st.jx) / dt, vy = (e.clientY - st.jy) / dt;
    st.vx = st.vx * 0.6 + vx * 0.4; st.vy = st.vy * 0.6 + vy * 0.4; st.jx = e.clientX; st.jy = e.clientY; st.jt = now;
    // вытягивание вдоль движения и сжатие поперёк (объём почти сохраняется); сила плавно насыщается
    var sp = Math.hypot(st.vx, st.vy), str = JELLY.max * (1 - Math.exp(-sp / 1.1));
    if(sp > 0.01){ var ux = st.vx / sp, uy = st.vy / sp, d = ux * ux - uy * uy; jellyTarget(st, 1 + str * d, 1 - str * d, JELLY.drag); }
    // палец остановился — форма мягко возвращается
    clearTimeout(st.jidle);
    st.jidle = setTimeout(function(){ st.vx = st.vy = 0; if(st.jsx) jellyTarget(st, 1, 1, JELLY.drag); }, 70);
  }
  // отпустили — пружины доигрывают затухающее колебание от текущей скорости
  function jellyEnd(st, el){
    if(!el) return;
    clearTimeout(st && st.jidle);
    el.classList.remove('jelly-on');
    if(jellyOff() || !st || !st.jsx){ el.style.transform = ''; return; }
    jellyTarget(st, 1, 1, JELLY.release);
    var sx = st.jsx, sy = st.jsy;
    setTimeout(function(){ if(st.jsx === sx){ jellyStop(st); } }, 1400);
  }
  // страховка: элементы, которые уже не перетаскиваются, без остаточной деформации
  document.addEventListener('pointerup', function(){ setTimeout(function(){ Array.prototype.forEach.call(document.querySelectorAll('.jelly-on'), function(x){ if(!x.classList.contains('dragging')){ x.style.transform = ''; x.classList.remove('jelly-on'); } }); }, 1500); }, true);
