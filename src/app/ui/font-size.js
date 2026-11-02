  /* ---------- размер шрифта, как в Word ---------- */
  var FS_PRESETS = [8, 9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, 56, 64, 72];
  function fsControl(value, min, max, onChange, label, unit){
    unit = unit || 'pt';
    var cur = value;
    var sel = h('select', { 'aria-label':label || 'Размер шрифта' });
    function fill(){
      sel.innerHTML = '';
      var list = FS_PRESETS.filter(function(v){ return v >= min && v <= max; });
      if(list.indexOf(cur) < 0){ list.push(cur); list.sort(function(a, b){ return a - b; }); }
      list.forEach(function(v){ var o = document.createElement('option'); o.value = v; o.textContent = String(v).replace('.', ',') + (unit === '%' ? '%' : ''); if(v === cur) o.selected = true; sel.appendChild(o); });
    }
    function set(v){ cur = Math.max(min, Math.min(max, v)); fill(); onChange(cur); }
    function step(dir){
      var list = FS_PRESETS.filter(function(v){ return v >= min && v <= max; });
      var nxt = dir > 0 ? list.filter(function(v){ return v > cur; })[0] : list.filter(function(v){ return v < cur; }).slice(-1)[0];
      if(nxt !== undefined) set(nxt);
    }
    if(unit === '%'){
      step = function(dir){ set(Math.round((cur + dir * 10) / 10) * 10); };
      fill = function(){
        sel.innerHTML = '';
        for(var v = min; v <= max; v += 10){ var o = document.createElement('option'); o.value = v; o.textContent = v + '%'; if(v === cur) o.selected = true; sel.appendChild(o); }
      };
    }
    if(unit === 'px'){
      step = function(dir){ set(Math.round((cur + dir * 20) / 20) * 20); };
      fill = function(){
        sel.innerHTML = '';
        var list = []; for(var v = Math.ceil(min / 20) * 20; v <= max; v += 20) list.push(v);
        if(list.indexOf(cur) < 0){ list.push(cur); list.sort(function(a, b){ return a - b; }); }
        list.forEach(function(v){ var o = document.createElement('option'); o.value = v; o.textContent = v + ' px'; if(v === cur) o.selected = true; sel.appendChild(o); });
      };
    }
    fill();
    sel.addEventListener('change', function(){ set(parseFloat(sel.value)); });
    return h('div', { 'class':'fsc' }, [
      h('button', { type:'button', 'class':'btn sm', text:'−', 'aria-label':'Уменьшить: ' + (label || 'размер шрифта'), on:{ click:function(){ step(-1); } } }),
      sel,
      h('button', { type:'button', 'class':'btn sm', text:'+', 'aria-label':'Увеличить: ' + (label || 'размер шрифта'), on:{ click:function(){ step(1); } } })
    ]);
  }
  function fsRow(label, ctl){ return h('div', { 'class':'fsrow' }, [ h('span', { text:label }), ctl ]); }

  var UI = load('triosteum.ui', null);
  // настройки могли сохраниться старой версией без каких-то полей — дополняем значениями по умолчанию,
  // иначе расчёты положения окон и меню получают «не число»
  if(!UI || typeof UI !== 'object' || Array.isArray(UI)) UI = {};
  [['scale', 100, 80, 160], ['code', 14, 10, 28], ['note', 14, 8, 72]].forEach(function(d){
    var v = Number(UI[d[0]]); UI[d[0]] = isFinite(v) && v >= d[2] && v <= d[3] ? v : d[1];
  });
  function applyUI(){
    document.documentElement.style.setProperty('--ui', UI.scale / 100);
    document.documentElement.style.setProperty('--code-fs', UI.code + 'px');
    save('triosteum.ui', UI);
    placePop();
  }
  applyUI();
  var textMenu = $('textMenu'), bTextSize = $('bTextSize');
  function buildTextMenu(){
    $('tmUi').innerHTML = ''; $('tmCode').innerHTML = ''; $('tmNote').innerHTML = '';
    $('tmUi').appendChild(fsControl(UI.scale, 80, 160, function(v){ UI.scale = v; applyUI(); }, 'масштаб окон', '%'));
    $('tmCode').appendChild(fsControl(UI.code, 10, 28, function(v){ UI.code = v; applyUI(); updateGutter(); }, 'шрифт кода'));
    $('tmNote').appendChild(fsControl(UI.note, 8, 72, function(v){ UI.note = v; applyUI(); }, 'шрифт новых заметок'));
  }
  // меню у кнопки панели: справа от неё, но целиком в пределах экрана (у .addmenu сдвиг вверх на 24px в CSS)
  function placeBeside(menu, r){
    var hh = menu.offsetHeight, ww = menu.offsetWidth, vh = window.innerHeight, vw = window.innerWidth;
    var top = Math.max(8 + 24, Math.min(r.top + r.height / 2, vh - hh - 8 + 24));
    menu.style.left = Math.max(8, Math.min(r.right + 12, vw - ww - 8)) + 'px'; menu.style.top = top + 'px';
  }
  function openTextMenu(){
    buildTextMenu(); closeAddMenu();
    var r = bTextSize.getBoundingClientRect();
    textMenu.hidden = false; placeBeside(textMenu, r); bTextSize.setAttribute('aria-expanded', 'true'); bTextSize.classList.add('on'); hideTip();
  }
  function closeTextMenu(){ textMenu.hidden = true; bTextSize.setAttribute('aria-expanded', 'false'); bTextSize.classList.remove('on'); }
  bTextSize.addEventListener('click', function(e){ e.stopPropagation(); textMenu.hidden ? openTextMenu() : closeTextMenu(); });
  $('tmReset').addEventListener('click', function(){ UI = { scale:100, code:14, note:14 }; applyUI(); buildTextMenu(); updateGutter(); });
  textMenu.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ closeTextMenu(); bTextSize.focus(); } });
  document.addEventListener('click', function(e){ if(!textMenu.hidden && !textMenu.contains(e.target) && !bTextSize.contains(e.target)) closeTextMenu(); });
