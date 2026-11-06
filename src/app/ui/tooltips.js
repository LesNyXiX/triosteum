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
    tipEl.querySelector('span').textContent = sub;
    var r = btn.getBoundingClientRect(), side = typeof dockSideOf === 'function' ? dockSideOf(btn) : 'left';
    tipEl.className = 'tip' + (side === 'left' ? '' : ' s-' + side);
    if(side === 'top'){ tipEl.style.left = (r.left + r.width / 2) + 'px'; tipEl.style.top = (r.bottom + 10) + 'px'; }
    else if(side === 'bottom'){ tipEl.style.left = (r.left + r.width / 2) + 'px'; tipEl.style.top = (r.top - 10) + 'px'; }
    else if(side === 'right'){ tipEl.style.left = (r.left - 10) + 'px'; tipEl.style.top = (r.top + r.height / 2) + 'px'; }
    else { tipEl.style.left = (r.right + 10) + 'px'; tipEl.style.top = (r.top + r.height / 2) + 'px'; }
    tipEl.hidden = false;
    clearTimeout(tipTimer);
    if(ms) tipTimer = setTimeout(hideTip, ms);
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
