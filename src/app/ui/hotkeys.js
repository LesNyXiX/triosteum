  /* ---------- горячие клавиши (Windows: Ctrl, Mac: ⌘) ---------- */
  var IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
  var MOD = IS_MAC ? '⌘' : 'Ctrl+';
  var KEYS_TEXT = [
    MOD + 'A — выделить всё',
    MOD + 'C / ' + MOD + 'V — копировать / вставить',
    MOD + 'Z — отменить',
    (IS_MAC ? '⌘⇧Z или ⌘Y' : 'Ctrl+Y') + ' — повторить',
    MOD + 'R — компиляция всей доски',
    MOD + 'K — поиск и команды',
    MOD + 'D — дублировать выделенное',
    MOD + 'S / ' + MOD + 'O — сохранить / открыть файл',
    'Shift+клик, Shift+рамка — выделить несколько',
    'Стрелки — сдвинуть (Shift — на 10)',
    'Delete / Backspace — удалить',
    'Esc — закрыть окно или снять выделение'
  ].join('\n');
  $('bKeys').setAttribute('data-tip', 'Горячие клавиши|' + KEYS_TEXT);
  $('bKeys').addEventListener('click', function(){ showTip($('bKeys'), 5000); });
  // Esc закрывает верхнее открытое окно (библиотеку, экосистему, ИИ, шаблоны и т. п.) его же кнопкой «Закрыть»
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape' || e.defaultPrevented) return;
    var t = e.target;
    if(t && (t.isContentEditable || /^(TEXTAREA)$/.test(t.tagName)) && !(t.closest && t.closest('.pers,.eco,.modal,.cmdk'))) return;
    var best = null, bestZ = -1;
    Array.prototype.forEach.call(document.querySelectorAll('button[aria-label="Закрыть"],button[aria-label^="Закрыть "]'), function(b){
      if(!b.offsetParent || b.closest('[hidden]') || b.closest('.closing')) return;
      var host = b.closest('section,[role=dialog],.pers,.lib,.eco,.pop,.modal,.cmdk,.runp') || b.parentNode, z = 0, n = host;
      while(n && n !== document.body){ var zi = parseInt(getComputedStyle(n).zIndex, 10); if(!isNaN(zi)){ z = zi; break; } n = n.parentElement; }
      if(z >= bestZ){ best = b; bestZ = z; }
    });
    if(best){ e.preventDefault(); best.click(); }
  });