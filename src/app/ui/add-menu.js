  /* ---------- меню «Добавление элементов» ---------- */
  var addMenu = $('addMenu'), bAdd = $('bAdd');
  function openAddMenu(anchor){
    if(typeof closeTextMenu === 'function') closeTextMenu();
    $('amBlockD').textContent = (isDocs() ? 'Тип «' + langById(S.lang).name + '». ' : 'Плагин с кодом на ' + shortName(langById(S.lang)) + '. ') + 'Нажмите на доску, чтобы поставить';
    Array.prototype.forEach.call(addMenu.querySelectorAll('.am-item'), function(b){ b.classList.toggle('on', b.dataset.add === S.tool); });
    addMenu.hidden = false;
    if(anchor && anchor !== bAdd){          // кнопка в центре пустой доски: меню под ней
      var ar = anchor.getBoundingClientRect(), mw = addMenu.offsetWidth;
      addMenu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, ar.left + ar.width / 2 - mw / 2)) + 'px';
      addMenu.style.top = Math.max(8 + 24, Math.min(ar.bottom + 10 + 24, window.innerHeight - addMenu.offsetHeight - 8 + 24)) + 'px';
      anchor.setAttribute('aria-expanded', 'true'); addMenu._anchor = anchor; addMenu.classList.add('below');
    } else {
      addMenu.classList.remove('below');
      var r = bAdd.getBoundingClientRect();
      placeBeside(addMenu, r);
    }
    bAdd.setAttribute('aria-expanded', 'true'); hideTip();
    var first = addMenu.querySelector('.am-item'); if(first) first.focus();
  }
  function closeAddMenu(){ addMenu.hidden = true; bAdd.setAttribute('aria-expanded', 'false'); if(addMenu._anchor){ addMenu._anchor.setAttribute('aria-expanded', 'false'); addMenu._anchor = null; } }
  bAdd.addEventListener('click', function(e){ e.stopPropagation(); addMenu.hidden ? openAddMenu() : closeAddMenu(); });
  $('hintAdd').addEventListener('click', function(e){ e.stopPropagation(); addMenu.hidden ? openAddMenu(this) : closeAddMenu(); });
  Array.prototype.forEach.call(addMenu.querySelectorAll('.am-item'), function(b){
    b.addEventListener('click', function(){
      S.tool = b.dataset.add; closeAddMenu(); closeLang(); hidePop();
      if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); } else render();
    });
  });
  addMenu.addEventListener('keydown', function(e){
    var items = Array.prototype.slice.call(addMenu.querySelectorAll('.am-item')), i = items.indexOf(document.activeElement);
    if(e.key === 'Escape'){ closeAddMenu(); bAdd.focus(); }
    if(e.key === 'ArrowDown'){ e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if(e.key === 'ArrowUp'){ e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  document.addEventListener('click', function(e){ if(!addMenu.hidden && !addMenu.contains(e.target) && e.target !== bAdd) closeAddMenu(); });
  /* ---------- «Блок» → сразу варианты блоков этой среды ---------- */
  var amSub = null, amSubT = null;
  function blockGroups(){
    var code = CODE_LANGS.filter(function(l){ return true; }), codeIds = code.map(function(l){ return l.id; });
    var native = LANGS.slice(), groups = [];
    if(ENV.id === 'code') return [{ head:'Блок с кодом', list:native }];
    var ops = native.filter(function(l){ return l.op && (typeof GEN_OPS === 'undefined' || GEN_OPS.indexOf(l) < 0); }), gen = typeof GEN_OPS === 'undefined' ? [] : native.filter(function(l){ return GEN_OPS.indexOf(l) >= 0; });
    var data = native.filter(function(l){ return !l.op && codeIds.indexOf(l.id) < 0; });
    if(ops.length) groups.push({ head:ENV.ops ? 'Расчёты среды «' + ENV.short + '»' : 'Обработка', list:ops });
    if(data.length) groups.push({ head:isDocs() ? 'Данные, документы, выгрузки' : 'Блоки', list:data });
    if(gen.length) groups.push({ head:'Общие расчёты', list:gen });
    groups.push({ head:'Код — выполняется вместе со схемой', list:code });
    return groups;
  }
  function closeAmSub(){ clearTimeout(amSubT); if(amSub){ amSub.remove(); amSub = null; } var b = addMenu.querySelector('.am-item[data-add="block"]'); if(b) b.setAttribute('aria-expanded', 'false'); }
  function openAmSub(btn, focus){
    clearTimeout(amSubT);
    if(amSub && amSub._btn === btn){ if(focus){ var f0 = amSub.querySelector('.ctx-i'); if(f0) f0.focus(); } return; }
    closeAmSub();
    amSub = document.createElement('div'); amSub.className = 'ctx am-sub'; amSub.setAttribute('role', 'menu'); amSub.setAttribute('aria-label', 'Варианты блоков'); amSub._btn = btn;
    blockGroups().forEach(function(g){
      if(!g.list.length) return;
      var hd = document.createElement('div'); hd.className = 'ctx-h'; hd.textContent = g.head; amSub.appendChild(hd);
      g.list.forEach(function(l){
        var it = document.createElement('button'); it.type = 'button'; it.className = 'ctx-i am-kind' + (S.lang === l.id ? ' on' : ''); it.setAttribute('role', 'menuitem');
        var sw = document.createElement('span'); sw.className = 'am-sw'; sw.style.background = grad(COLORS[l.id] || colorsOf({ lang:l.id }));
        var tx = document.createElement('span'); tx.className = 'am-kt';
        var t1 = document.createElement('b'); t1.textContent = isDocs() || ENV.id !== 'code' ? (l.name || shortName(l)) : shortName(l);
        var t2 = document.createElement('small'); t2.textContent = String(l.tool || '').split(/[:—]/)[0].slice(0, 60);
        tx.appendChild(t1); tx.appendChild(t2); it.appendChild(sw); it.appendChild(tx);
        if(S.lang === l.id){ var ck = document.createElement('span'); ck.className = 'am-ck'; ck.textContent = '✓'; it.appendChild(ck); }
        it.addEventListener('click', function(e){
          e.stopPropagation();
          S.lang = l.id; save('triosteum.lang.' + ENV.id, l.id); S.tool = 'block';
          closeAmSub(); closeAddMenu(); closeLang(); hidePop();
          if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); } else render();
          toast('Нажмите на доску, чтобы поставить блок «' + (l.name || shortName(l)) + '»');
        });
        amSub.appendChild(it);
      });
    });
    amSub.addEventListener('mouseenter', function(){ clearTimeout(amSubT); });
    amSub.addEventListener('mouseleave', function(){ amSubT = setTimeout(function(){ if(!addMenu.matches(':hover')) closeAmSub(); }, 260); });
    amSub.addEventListener('keydown', function(e){
      var items = Array.prototype.slice.call(amSub.querySelectorAll('.ctx-i')), i = items.indexOf(document.activeElement);
      if(e.key === 'Escape' || e.key === 'ArrowLeft'){ e.preventDefault(); e.stopPropagation(); closeAmSub(); btn.focus(); }
      else if(e.key === 'ArrowDown'){ e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
    document.body.appendChild(amSub);
    var r = btn.getBoundingClientRect(), mr = addMenu.getBoundingClientRect(), z = UI.scale / 100 || 1, w = amSub.offsetWidth * z, hh = amSub.offsetHeight * z;
    var x = mr.right + 6; if(x + w > window.innerWidth - 8) x = Math.max(8, mr.left - w - 6);
    var y = Math.max(8, Math.min(r.top - 8, window.innerHeight - hh - 8));
    amSub.style.left = x / z + 'px'; amSub.style.top = y / z + 'px';
    btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'true');
    if(focus){ var f = amSub.querySelector('.ctx-i'); if(f) f.focus(); }
  }
  (function(){
    var bb = addMenu.querySelector('.am-item[data-add="block"]');
    bb.addEventListener('mouseenter', function(){ openAmSub(bb); });
    bb.addEventListener('focus', function(){ if(bb.matches(':focus-visible')) openAmSub(bb); });
    bb.addEventListener('keydown', function(e){ if(e.key === 'ArrowRight' || e.key === 'Enter' && false){ e.preventDefault(); openAmSub(bb, true); } });
    Array.prototype.forEach.call(addMenu.querySelectorAll('.am-item:not([data-add="block"])'), function(o){ o.addEventListener('mouseenter', function(){ amSubT = setTimeout(closeAmSub, 120); }); o.addEventListener('focus', closeAmSub); });
    addMenu.addEventListener('mouseleave', function(){ amSubT = setTimeout(function(){ if(!(amSub && amSub.matches(':hover'))) closeAmSub(); }, 260); });
    var _closeAddMenu = closeAddMenu;
    closeAddMenu = function(){ closeAmSub(); _closeAddMenu(); };
    document.addEventListener('click', function(e){ if(amSub && !amSub.contains(e.target) && !addMenu.contains(e.target)) closeAmSub(); });
  })();
