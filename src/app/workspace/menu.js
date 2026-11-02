  /* =====================================================================
     Пространства (проекты), файлы, поиск и команды, мини-карта,
     выравнивание, авто-раскладка, рамка выделения, статусы выполнения
     ===================================================================== */
  var GRID = 24;

  // ---------- универсальное выпадающее меню (на базе контекстного) ----------
  function openMenuAt(items, x, y, anchor){
    closeAddMenu(); closeTextMenu(); closeCtx();
    ctxEl.innerHTML = ''; items.filter(Boolean).forEach(function(o){ ctxEl.appendChild(ctxItem(o)); });
    ctxEl.hidden = false;
    var z = UI.scale / 100, w = ctxEl.offsetWidth * z, hh = ctxEl.offsetHeight * z;
    x = Math.min(x, window.innerWidth - w - 8); y = Math.min(y, window.innerHeight - hh - 8);
    ctxEl.style.left = (Math.max(8, x) / z) + 'px'; ctxEl.style.top = (Math.max(8, y) / z) + 'px';
    if(anchor){
      anchor.setAttribute('aria-expanded', 'true');
      var mo = new MutationObserver(function(){ if(ctxEl.hidden){ anchor.setAttribute('aria-expanded', 'false'); mo.disconnect(); } });
      mo.observe(ctxEl, { attributes:true, attributeFilter:['hidden'] });
    }
    var f = ctxEl.querySelector('.ctx-i:not([disabled])'); if(f) f.focus();
  }
