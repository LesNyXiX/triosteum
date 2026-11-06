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
  /* свои клавиши: Персонализация → нажать на клавишу у кнопки. Хранятся в UI.keys: { sel:{code,shift,mod} | null } */
  TOOL_KEYS.forEach(function(k){ k.def = { code:k.code, shift:!!k.shift, mod:!!k.mod, label:k.label }; var b = document.querySelector(k.sel); if(b) k.btn = b; });
  var KEY_NAMES = { Comma:',', Period:'.', Slash:'/', Semicolon:';', Quote:"'", BracketLeft:'[', BracketRight:']', Backslash:'\\', Minus:'-', Equal:'=', Backquote:'`', Space:'Пробел' };
  function keyLabel(c){
    if(!c || !c.code) return '';
    var base = /^Key[A-Z]$/.test(c.code) ? c.code.slice(3) : /^Digit\d$/.test(c.code) ? c.code.slice(5) : /^F\d+$/.test(c.code) ? c.code : KEY_NAMES[c.code] || c.code;
    if(c.code === 'Slash' && c.shift && !c.mod) return '?';
    return (c.mod ? MOD : '') + (c.shift ? (IS_MAC ? '⇧' : 'Shift+') : '') + base;
  }
  // сочетания, которые уже заняты самой доской и браузером, — их кнопкам не отдаём
  var KEY_RESERVED = ['KeyA', 'KeyC', 'KeyV', 'KeyX', 'KeyZ', 'KeyY', 'KeyR', 'KeyK', 'KeyS', 'KeyO', 'KeyD', 'KeyP', 'KeyF', 'KeyW', 'KeyT', 'KeyN', 'KeyL', 'KeyQ', 'Tab'];
  function keyFree(c){
    if(!c || !c.code) return 'Нажмите букву, цифру или знак';
    if(/^(Escape|Enter|Backspace|Delete|Tab|Space|Arrow|Shift|Control|Alt|Meta|CapsLock|Context)/.test(c.code)) return 'Эта клавиша уже работает на доске — выберите другую';
    if(c.mod && KEY_RESERVED.indexOf(c.code) >= 0) return keyLabel(c) + ' уже занято (копирование, отмена, поиск и т. п.)';
    return '';
  }
  function toolKeysApply(){
    var over = (UI && UI.keys) || {};
    TOOL_KEYS.forEach(function(k){
      if(k.shown) return;
      var o = Object.prototype.hasOwnProperty.call(over, k.sel) ? over[k.sel] : undefined, c = o === undefined ? k.def : o;
      if(c){ k.code = c.code; k.shift = !!c.shift; k.mod = !!c.mod; k.label = keyLabel(c) || k.def.label; } else { k.code = null; k.label = ''; }
    });
    TOOL_KEYS.forEach(function(k){ if(k.btn){ if(k.label) k.btn.dataset.key = k.label; else delete k.btn.dataset.key; } });
    var kb = $('bKeys'); if(kb && typeof KEYS_TEXT !== 'undefined'){ KEYS_TEXT = keysText(); kb.setAttribute('data-tip', 'Горячие клавиши|' + KEYS_TEXT); }
  }
  // задать клавишу кнопке sel; c = {code,shift,mod} или null (без клавиши). Тот, у кого она была, остаётся без неё.
  function toolKeySet(sel, c){
    UI.keys = UI.keys || {};
    var taken = null;
    if(c) TOOL_KEYS.forEach(function(k){ if(k.sel !== sel && k.code === c.code && !!k.shift === !!c.shift && !!k.mod === !!c.mod) taken = k; });
    if(taken){ UI.keys[taken.sel] = null; }
    UI.keys[sel] = c;
    save('triosteum.ui', UI); toolKeysApply();
    return taken;
  }
  function toolKeysReset(){ delete UI.keys; save('triosteum.ui', UI); toolKeysApply(); }
  function toolKeyFor(sel){ var k = TOOL_KEYS.filter(function(x){ return x.sel === sel; })[0]; return k || null; }
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
  function keysText(){ return [
    'Кнопки инструментов: ' + TOOL_KEYS.filter(function(k){ return !k.shown && k.label; }).map(function(k){ return k.label + ' — ' + k.name; }).join(', ') + ' (свои — в Персонализации)',
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
  ].join('\n'); }
  var KEYS_TEXT = keysText();
  toolKeysApply();
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