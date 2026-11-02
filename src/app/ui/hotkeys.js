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
    'Esc — снять выделение'
  ].join('\n');
  $('bKeys').setAttribute('data-tip', 'Горячие клавиши|' + KEYS_TEXT);
  $('bKeys').addEventListener('click', function(){ showTip($('bKeys'), 5000); });
