  /* ---------- свечение вокруг курсора ---------- */
  (function cursorGlow(){
    var g = $('glow'); if(!g || !window.matchMedia || !matchMedia('(pointer:fine)').matches) return;
    var tx = -500, ty = -500, x = -500, y = -500, raf = null, still = !!(matchMedia('(prefers-reduced-motion:reduce)').matches);
    function step(){ x += (tx - x) * (still ? 1 : 0.45); y += (ty - y) * (still ? 1 : 0.45); g.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)'; raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(step) : null; }
    document.addEventListener('pointermove', function(e){ if(e.pointerType !== 'mouse') return; tx = e.clientX; ty = e.clientY; if(x < -400){ x = tx; y = ty; } g.classList.add('on'); if(!raf) raf = requestAnimationFrame(step); }, { passive:true });
    document.addEventListener('pointerdown', function(e){ if(e.pointerType === 'mouse') g.classList.add('press'); }, { passive:true });
    document.addEventListener('pointerup', function(){ g.classList.remove('press'); }, { passive:true });
    document.documentElement.addEventListener('mouseleave', function(){ g.classList.remove('on'); });
    window.addEventListener('blur', function(){ g.classList.remove('on'); });
  })();