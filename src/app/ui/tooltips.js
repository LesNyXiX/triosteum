  /* ---------- подсказки у кнопок панели ---------- */
  var tipEl = $('tip'), tipTimer = null;
  function showTip(btn, ms){
    if(document.body.classList.contains('docking')) return;
    var parts = btn.getAttribute('data-tip').split('|');
    var sub = parts[1] || '';
    if(btn.dataset.tool === 'block') sub = 'Нажмите на доску, чтобы поставить (' + shortName(langById(S.lang)) + ')';
    tipEl.innerHTML = '<b></b><span></span>';
    tipEl.querySelector('b').textContent = parts[0];
    if(btn.dataset.key && btn.id !== 'bKeys'){ var kb = document.createElement('kbd'); kb.className = 'tip-key'; kb.textContent = btn.dataset.key; tipEl.querySelector('b').appendChild(kb); }
    var rows = /\n/.test(sub) && sub.split('\n').filter(function(l){ return l.indexOf(' — ') > 0; }).length >= 4;
    if(rows){ var sp = tipEl.querySelector('span'); sp.className = 'hk'; hintRows(sub, sp); }
    else tipEl.querySelector('span').textContent = sub;
    var r = btn.getBoundingClientRect(), side = typeof dockSideOf === 'function' ? dockSideOf(btn) : 'left';
    tipEl.className = 'tip' + (side === 'left' ? '' : ' s-' + side) + (rows ? ' rows' : '');
    tipEl.style.removeProperty('--ay'); tipEl.style.removeProperty('--ax');
    if(side === 'top'){ tipEl.style.left = (r.left + r.width / 2) + 'px'; tipEl.style.top = (r.bottom + 10) + 'px'; }
    else if(side === 'bottom'){ tipEl.style.left = (r.left + r.width / 2) + 'px'; tipEl.style.top = (r.top - 10) + 'px'; }
    else if(side === 'right'){ tipEl.style.left = (r.left - 10) + 'px'; tipEl.style.top = (r.top + r.height / 2) + 'px'; }
    else { tipEl.style.left = (r.right + 10) + 'px'; tipEl.style.top = (r.top + r.height / 2) + 'px'; }
    tipEl.hidden = false;
    tipFit();
    clearTimeout(tipTimer);
    if(ms) tipTimer = setTimeout(hideTip, ms);
  }
  // большая подсказка не вылезает за экран: сдвигаем её целиком, а стрелку оставляем у кнопки
  function tipFit(){
    tipEl.style.animation = 'none';                    // мерить без анимации появления: она уменьшает окно
    var r = tipEl.getBoundingClientRect(), m = 8, dy = 0, dx = 0;
    tipEl.style.animation = '';
    if(r.top < m) dy = m - r.top; else if(r.bottom > window.innerHeight - m) dy = window.innerHeight - m - r.bottom;
    if(r.left < m) dx = m - r.left; else if(r.right > window.innerWidth - m) dx = window.innerWidth - m - r.right;
    if(dy){ tipEl.style.top = (parseFloat(tipEl.style.top) + dy) + 'px'; tipEl.style.setProperty('--ay', (-dy) + 'px'); }
    if(dx){ tipEl.style.left = (parseFloat(tipEl.style.left) + dx) + 'px'; tipEl.style.setProperty('--ax', (-dx) + 'px'); }
  }
  /* Текст подсказки строками «клавиши — что делают» (через перевод строки или « · ») → аккуратная таблица:
     слева клавиши плашками, справа пояснение; «# Раздел» — заголовок. Остальные строки — обычный текст. */
  function hintRows(text, box){
    box.textContent = '';
    String(text).split(/\n| · /).forEach(function(l){
      l = l.trim();
      if(l.charAt(0) === '#'){ var t = l.replace(/^#\s*/, ''); box.appendChild(h('div', { 'class':'hk-h' + (t ? '' : ' gap'), text:t })); return; }
      if(!l) return;
      var i = l.indexOf(' — ');
      if(i < 1 || i > 44){ box.appendChild(h('div', { 'class':'hk-t', text:l })); return; }
      var kc = h('span', { 'class':'hk-k' });
      l.slice(0, i).split(/ \/ |, /).forEach(function(k, j){ if(j) kc.appendChild(h('i', { text:'/' })); kc.appendChild(h('kbd', { 'class':/^[а-яё ]+$/i.test(k) ? 'w' : null, text:k })); });
      box.appendChild(h('div', { 'class':'hk-r' }, [kc, h('span', { 'class':'hk-d', text:l.slice(i + 3) })]));
    });
    return box;
  }
  function hideTip(){ clearTimeout(tipTimer); tipEl.hidden = true; }
  Array.prototype.forEach.call(document.querySelectorAll('[data-tip]'), function(btn){
    btn.setAttribute('aria-describedby', 'tip');
    btn.addEventListener('pointerenter', function(e){ if(e.pointerType === 'mouse') showTip(btn); });
    btn.addEventListener('pointerleave', function(e){ if(e.pointerType === 'mouse') hideTip(); });
    btn.addEventListener('focus', function(){ showTip(btn); });
    btn.addEventListener('blur', hideTip);
    btn.addEventListener('click', function(e){ if(e.pointerType && e.pointerType !== 'mouse') showTip(btn, 1800); });
  });
  el.canvas.addEventListener('pointerdown', hideTip, true);
