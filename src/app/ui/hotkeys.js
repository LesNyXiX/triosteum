  /* ---------- горячие клавиши (Windows: Ctrl, Mac: ⌘) ---------- */
  var IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
  var MOD = IS_MAC ? '⌘' : 'Ctrl+';
  // клавиши кнопок панелей инструментов: по физической клавише (e.code), поэтому работают и в русской раскладке
  var TOOL_KEYS = [
    { sel:'[data-tool=select]', code:'KeyV', label:'V', name:'выбор и перемещение' },
    { sel:'#bAdd', code:'KeyA', label:'A', name:'добавление элементов' },
    { sel:'[data-tool=text]', code:'KeyT', label:'T', name:'текст (заметка)' },
    { sel:'#bTextSize', code:'KeyT', shift:true, label:'Shift+T', name:'размер текста' },
    { sel:'#bBuild', code:'KeyB', label:'B', name:'конструктор схемы' },
    { sel:'#bLib', code:'KeyL', label:'L', name:'библиотека плагинов' },
    { sel:'#bScheme', code:'KeyC', label:'C', name:'целостный код схемы' },
    { sel:'#bCreate', code:'KeyP', label:'P', name:'создать плагин' },
    { sel:'#bFit', code:'KeyF', label:'F', name:'вписать всё в экран' },
    { sel:'#bGrid', code:'KeyG', label:'G', name:'сетка доски' },
    { sel:'#bRun', mod:true, code:'KeyR', label:MOD + 'R', name:'компиляция доски', shown:true },
    { sel:'#bUndo', mod:true, code:'KeyZ', label:MOD + 'Z', name:'отменить', shown:true },
    { sel:'#bRedo', mod:true, code:'KeyY', label:IS_MAC ? '⌘⇧Z' : 'Ctrl+Y', name:'повторить', shown:true },
    { sel:'#bAll', mod:true, code:'KeyA', label:MOD + 'A', name:'выделить всё', shown:true },
    { sel:'#bPers', mod:true, code:'Comma', label:IS_MAC ? '⌘,' : 'Ctrl+,', name:'персонализация' },
    { sel:'#bKeys', code:'Slash', shift:true, label:'?', name:'горячие клавиши' }
  ];
  TOOL_KEYS.forEach(function(k){ var b = document.querySelector(k.sel); if(b){ b.dataset.key = k.label; k.btn = b; } });
  function toolKeyOf(btn){ return btn && btn.dataset ? btn.dataset.key || '' : ''; }
  document.addEventListener('keydown', function(e){
    if(e.defaultPrevented || e.repeat || e.altKey) return;
    var mod = e.ctrlKey || e.metaKey, code = e.code || '';
    var k = null;
    TOOL_KEYS.forEach(function(x){ if(!k && !x.shown && x.code === code && !!x.mod === mod && !!x.shift === e.shiftKey) k = x; });
    if(!k || !k.btn) return;
    var t = e.target;
    if(!k.mod && t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    // однобуквенные — только на доске разработки, когда не открыто окно поверх
    if(!k.mod){
      if(typeof officeOn === 'function' && officeOn()) return;
      if(typeof cmdOpen === 'function' && cmdOpen()) return;
      if(S.view !== 'canvas' || (el.modal && !el.modal.hidden)) return;
      if(document.querySelector('.eco-back:not([hidden]),.modal-back:not([hidden]),#askModal:not([hidden])')) return;
    }
    e.preventDefault();
    if(k.btn.id === 'bKeys'){ showTip(k.btn, 8000); return; }
    k.btn.click();
  });
  var KEYS_TEXT = [
    'Кнопки инструментов: ' + TOOL_KEYS.filter(function(k){ return !k.shown; }).map(function(k){ return k.label + ' — ' + k.name; }).join(', '),
    MOD + 'A — выделить всё',
    MOD + 'C / ' + MOD + 'V — копировать / вставить (между любыми пространствами и средами; картинки, текст и код из системного буфера)',
    MOD + 'Z — отменить',
    (IS_MAC ? '⌘⇧Z или ⌘Y' : 'Ctrl+Y') + ' — повторить',
    MOD + 'R — компиляция всей доски',
    MOD + 'K — поиск и команды',
    MOD + 'D — дублировать выделенное',
    MOD + 'S / ' + MOD + 'O — сохранить / открыть файл (.tsm)',
    'Shift+клик, Shift+рамка — выделить несколько',
    'Двойной клик по блоку — открыть (блок другой среды — в его родной среде)',
    'Зажать блок и потрясти — связи перейдут на узел; потрясти узел — связи отцепятся',
    'Точка на связи: потрясти — отцепить блоки (пустая — снять); утянуть от связи — станет узлом',
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