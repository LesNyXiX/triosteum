  // ---------- статусы выполнения на блоках ----------
  var runState = {};
  function applyRun(d, id){
    var old = d.querySelector('.rstat'); if(old) old.remove();
    var st = runState && runState[id]; if(!st) return;
    var s = h('span', { 'class':'rstat ' + st.s, title:st.info, 'aria-label':st.info, text:st.s === 'ok' ? '✓' : (st.s === 'err' ? '!' : '–') });
    d.appendChild(s);
  }
  function setRun(n, s, info){ runState[n.id] = { s:s, info:info }; if(typeof cmpMark === 'function') cmpMark(n, s, info); var d = domOf('node', n.id); if(d) applyRun(d, n.id); }
  function clearRun(){ runState = {}; Array.prototype.forEach.call(el.nodes.querySelectorAll('.rstat'), function(x){ x.remove(); }); }

  // ---------- подсказка на пустой доске ----------
  var hintP = el.hint.querySelector('p');
  if(hintP && window.matchMedia && matchMedia('(pointer:coarse)').matches) hintP.textContent = 'Удерживайте палец на доске, чтобы добавить элемент, или откройте плагин из библиотеки. Кнопка с лупой вверху — поиск и все команды.';
  else if(hintP) hintP.textContent = 'Нажмите правой кнопкой по доске, чтобы добавить элемент, откройте плагин из библиотеки или нажмите ' + (IS_MAC ? '⌘K' : 'Ctrl+K') + ' — поиск и команды. Файл пространства можно перетащить прямо сюда.';
  window.addEventListener('beforeunload', function(){ try{ stashCur(); }catch(e){} });
  showProjName();
