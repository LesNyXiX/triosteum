  /* ---------- мастер функций (кнопка fx) и подсказка синтаксиса ---------- */
  var FXW = { cat:'Все', q:'' };
  function fxCats(){ var c = ['Все']; FUNC_DOCS.forEach(function(d){ if(c.indexOf(d[0]) < 0) c.push(d[0]); }); return c; }
  function fxDoc(name){ name = String(name || '').toUpperCase(); return FUNC_DOCS.filter(function(d){ return d[1] === name || d[2] === name; })[0]; }
  // вставка функции в строку формул: в позицию курсора, с «=» в начале при необходимости
  function fxInsert(inp, d){
    var v = inp.value, a = inp.selectionStart === undefined || document.activeElement !== inp ? v.length : inp.selectionStart, b = inp.selectionEnd === undefined || document.activeElement !== inp ? v.length : inp.selectionEnd;
    var pre = v.slice(0, a), post = v.slice(b);
    if(!/^=/.test(v)){ pre = '='; post = ''; }
    var ins = d[1] + '(';
    inp.value = pre + ins + (post.charAt(0) === ')' ? '' : ')') + post;
    inp.focus(); var at = (pre + ins).length; inp.setSelectionRange(at, at);
    inp.dispatchEvent(new Event('input', { bubbles:true }));
  }
  function openFxWizard(btn, inp){
    var old = $('fxw'); if(old){ old.remove(); return; }
    var box = h('div', { 'class':'fxw', id:'fxw', role:'dialog', 'aria-label':'Вставка функции' });
    var q = h('input', { 'class':'input', placeholder:'Найти функцию: сумм, впр, корень, дата…', 'aria-label':'Поиск функции' }); q.value = FXW.q;
    var cats = h('div', { 'class':'fxw-cats' }), list = h('div', { 'class':'fxw-list', role:'listbox' }), info = h('div', { 'class':'fxw-info' });
    function paint(){
      cats.innerHTML = ''; fxCats().forEach(function(c){ cats.appendChild(h('button', { type:'button', 'class':'chip' + (FXW.cat === c ? ' on' : ''), text:c, on:{ click:function(){ FXW.cat = c; paint(); } } })); });
      var s = FXW.q.trim().toLowerCase();
      var hits = FUNC_DOCS.filter(function(d){ return (FXW.cat === 'Все' || d[0] === FXW.cat) && (!s || (d[1] + ' ' + d[2] + ' ' + d[4]).toLowerCase().indexOf(s) >= 0); });
      list.innerHTML = '';
      if(!hits.length) list.appendChild(h('div', { 'class':'of-empty', text:'Ничего не найдено' }));
      hits.forEach(function(d, i){
        var it = h('button', { type:'button', 'class':'fxw-i', role:'option' }, [ h('b', { text:d[1] }), h('span', { text:d[4] }) ]);
        it.addEventListener('mouseenter', function(){ show(d); });
        it.addEventListener('focus', function(){ show(d); });
        it.addEventListener('click', function(){ box.remove(); fxInsert(inp, d); });
        list.appendChild(it); if(i === 0) show(d);
      });
    }
    function show(d){ info.innerHTML = ''; info.appendChild(h('div', { 'class':'fxw-syn', text:'=' + d[3] })); info.appendChild(h('div', { text:d[4] + ' · ' + d[0] + (d[2] !== d[1] ? ' · англ. ' + d[2] : '') })); }
    q.addEventListener('input', function(){ FXW.q = q.value; paint(); });
    q.addEventListener('keydown', function(e){ e.stopPropagation(); if(e.key === 'Escape') box.remove(); if(e.key === 'Enter'){ var f = list.querySelector('.fxw-i'); if(f) f.click(); } if(e.key === 'ArrowDown'){ e.preventDefault(); var g = list.querySelector('.fxw-i'); if(g) g.focus(); } });
    list.addEventListener('keydown', function(e){ e.stopPropagation(); var a = document.activeElement; if(e.key === 'ArrowDown' && a.nextSibling){ e.preventDefault(); a.nextSibling.focus(); } if(e.key === 'ArrowUp'){ e.preventDefault(); (a.previousSibling || q).focus(); } if(e.key === 'Escape') box.remove(); });
    box.appendChild(h('div', { 'class':'fxw-h' }, [ h('b', { text:'Функции · ' + FUNC_DOCS.length }), h('button', { type:'button', 'class':'x', 'aria-label':'Закрыть', html:SVGI('<path d="M6 6l12 12M18 6L6 18"/>', 14), on:{ click:function(){ box.remove(); } } }) ]));
    box.appendChild(q); box.appendChild(cats); box.appendChild(h('div', { 'class':'fxw-body' }, [ list, info ]));
    box.appendChild(h('div', { 'class':'fxw-foot', text:'Аргументы разделяйте «;», дробная часть — запятая. Другой лист: Лист2!A1, другой файл: \'Бюджет\'!B4.' }));
    document.body.appendChild(box);
    var r = btn.getBoundingClientRect(), z = UI.scale / 100;
    box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - box.offsetWidth * z - 8)) / z + 'px'; box.style.top = (r.bottom + 6) / z + 'px';
    paint(); q.focus(); q.select();
    setTimeout(function(){ document.addEventListener('pointerdown', function off(e){ if(!box.contains(e.target) && e.target !== btn){ box.remove(); document.removeEventListener('pointerdown', off, true); } }, true); }, 0);
  }
  // подсказка: какая функция сейчас под курсором и её синтаксис
  function fxHintFor(inp, hint){
    function upd(){
      var v = inp.value, at = inp.selectionStart || v.length, depth = 0, name = null;
      if(v.charAt(0) !== '='){ hint.hidden = true; return; }
      for(var i = at - 1; i >= 0; i--){
        var ch = v.charAt(i);
        if(ch === ')') depth++;
        else if(ch === '('){ if(depth){ depth--; continue; } var m = v.slice(0, i).match(/([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9.]*)\s*$/); name = m && m[1]; break; }
      }
      var d = name && fxDoc(name);
      if(!d){ var w = v.slice(0, at).match(/([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9.]*)$/); if(w && w[1].length >= 2){ var up = w[1].toUpperCase(), sug = FUNC_DOCS.filter(function(x){ return x[1].indexOf(up) === 0 || x[2].indexOf(up) === 0; }).slice(0, 6); if(sug.length){ hint.hidden = false; hint.textContent = 'Функции: ' + sug.map(function(x){ return x[1]; }).join(', ') + ' — кнопка fx покажет все'; return; } } hint.hidden = true; return; }
      hint.hidden = false; hint.textContent = '=' + d[3] + ' — ' + d[4];
    }
    ['input', 'keyup', 'click', 'focus'].forEach(function(ev){ inp.addEventListener(ev, upd); });
    inp.addEventListener('blur', function(){ setTimeout(function(){ hint.hidden = true; }, 150); });
  }
