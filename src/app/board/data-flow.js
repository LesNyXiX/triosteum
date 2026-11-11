  /* =====================================================================
     ДАННЫЕ НА СВЯЗЯХ — что прошло по схеме при последнем запуске
     • На середине связи — плашка: сколько записей передал блок («12 записей», «объект», «число»).
     • Щелчок по связи или плашке — таблица данных в окне связи; в настройках блока — его результат.
     Помогает отлаживать без чтения журнала: сразу видно, где данные пропали или стали не те.
     Данные берутся из CMP.last (результаты последнего запуска) и не сохраняются отдельно.
     ===================================================================== */
  var DF = { layer:null, t:0, max:300 };
  DF.layer = document.createElement('div');
  DF.layer.className = 'df-layer'; DF.layer.setAttribute('aria-hidden', 'false');
  el.world.appendChild(DF.layer);

  function dfOn(){ return UI.flowChips !== false; }
  function dfHas(id){ return CMP && CMP.last && Object.prototype.hasOwnProperty.call(CMP.last, id) && CMP.last[id] !== undefined; }
  function dfKind(v){
    if(v === null) return { n:0, t:'пусто' };
    if(Array.isArray(v)) return { n:v.length, t:v.length + ' ' + plural(v.length, 'запись', 'записи', 'записей') };
    if(typeof v === 'object') return { n:1, t:'объект · ' + Object.keys(v).length + ' ' + plural(Object.keys(v).length, 'поле', 'поля', 'полей') };
    if(typeof v === 'number') return { n:1, t:String(Math.round(v * 1000) / 1000).replace('.', ',') };
    if(typeof v === 'boolean') return { n:1, t:v ? 'да' : 'нет' };
    var s = String(v); return { n:1, t:'«' + (s.length > 18 ? s.slice(0, 18) + '…' : s) + '»' };
  }

  // плашки на серединах связей — пересчёт с задержкой после перерисовки связей (не каждый кадр перетаскивания)
  function dfSchedule(){ clearTimeout(DF.t); DF.t = setTimeout(dfChips, 140); }
  function dfChips(){
    DF.layer.textContent = '';
    if(!dfOn() || G.edges.length > DF.max) return;
    G.edges.forEach(function(e){
      if(!dfHas(e.from) || !nodeById(e.to)) return;
      var p = edgePaths[e.id]; if(!p) return;
      var pt; try { pt = p.getPointAtLength(p.getTotalLength() / 2); } catch(er){ return; }
      var k = dfKind(CMP.last[e.from]);
      var b = h('button', { type:'button', 'class':'df-chip' + (k.n === 0 ? ' empty' : ''), 'data-edge':e.id, text:k.t, title:'Данные по связи после последнего запуска — щёлкните, чтобы посмотреть',
        'aria-label':'Данные по связи: ' + k.t + '. Показать' });
      b.style.left = pt.x + 'px'; b.style.top = pt.y + 'px';
      b.addEventListener('pointerdown', function(ev){ ev.stopPropagation(); });
      b.addEventListener('click', function(ev){ ev.stopPropagation(); S.multi = []; S.sel = { type:'edge', id:e.id }; updateSel(); renderEdges(); showPop(); });
      DF.layer.appendChild(b);
    });
  }

  // таблица или JSON — предпросмотр значения
  function dfView(v){
    var box = h('div', { 'class':'df-view' });
    if(v === undefined){ box.appendChild(h('div', { 'class':'df-none', text:'Запусков ещё не было — запустите схему, и здесь появятся данные.' })); return box; }
    var k = dfKind(v);
    box.appendChild(h('div', { 'class':'df-k', text:k.t }));
    var rows = Array.isArray(v) ? v : null;
    if(rows && rows.length && rows.every(function(r){ return r && typeof r === 'object' && !Array.isArray(r); })){
      var cols = []; rows.slice(0, 50).forEach(function(r){ Object.keys(r).forEach(function(c){ if(c.indexOf('__') !== 0 && cols.indexOf(c) < 0 && cols.length < 8) cols.push(c); }); });
      var t = h('table', { 'class':'df-tbl' });
      t.appendChild(h('thead', null, [ h('tr', null, [ h('th', { scope:'col', text:'#' }) ].concat(cols.map(function(c){ return h('th', { scope:'col', text:c }); }))) ]));
      var tb = h('tbody');
      rows.slice(0, 20).forEach(function(r, i){ tb.appendChild(h('tr', null, [ h('td', { 'class':'df-i', text:String(i + 1) }) ].concat(cols.map(function(c){ var x = r[c]; return h('td', { text:x === undefined || x === null ? '' : typeof x === 'object' ? JSON.stringify(x) : String(x) }); })))); });
      t.appendChild(tb);
      box.appendChild(h('div', { 'class':'df-scroll' }, [ t ]));
      if(rows.length > 20) box.appendChild(h('div', { 'class':'df-more', text:'показаны первые 20 из ' + rows.length }));
    } else {
      var j; try { j = JSON.stringify(v, null, 2); } catch(e){ j = String(v); }
      var pre = h('pre', { 'class':'df-json' }); pre.textContent = j && j.length > 3000 ? j.slice(0, 3000) + '\n…' : j; box.appendChild(pre);
    }
    box.appendChild(h('div', { 'class':'acts' }, [ h('button', { type:'button', 'class':'btn sm', text:'Скопировать JSON', on:{ click:function(){
      var s; try { s = JSON.stringify(v, null, 2); } catch(e){ s = String(v); }
      (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(s) : Promise.reject()).then(function(){ toast('Данные скопированы'); }, function(){ toast('Браузер не дал доступ к буферу обмена'); });
    } } }) ]));
    return box;
  }

  (function(){
    var _re = renderEdges;
    renderEdges = function(){ var r = _re.apply(this, arguments); dfSchedule(); return r; };
    var _em = edgesMoved;   // быстрый путь перетаскивания (edgeFast) обходит renderEdges — плашки догоняют после остановки
    edgesMoved = function(){ var r = _em.apply(this, arguments); if(DF.layer.firstChild) dfSchedule(); return r; };
    var _end = cmpEnd;
    cmpEnd = function(){ var r = _end.apply(this, arguments); dfSchedule(); return r; };
    var _sg = setGraph;   // другое пространство (или новое содержимое) — результаты прошлого запуска к нему не относятся: ID блоков повторяются между пространствами
    setGraph = function(o){ if(CMP) CMP.last = {}; return _sg.apply(this, arguments); };
    var _ep = renderEdgePop;
    renderEdgePop = function(p, e){
      _ep(p, e);
      if(!e) return;
      var a = nodeById(e.from), sec = section('Данные по связи — последний запуск' + (a ? ' (из «' + a.name + '»)' : ''), dfView(dfHas(e.from) ? CMP.last[e.from] : undefined));
      sec.classList.add('df-sec');
      p.insertBefore(sec, p.children[1] || null);   // сразу под заголовком: ради данных окно связи обычно и открывают
    };
    var _np = renderNodePop;
    renderNodePop = function(p, n){
      _np(p, n);
      if(!n || n.kind === 'hub' || !dfHas(n.id)) return;
      var sec = section('Результат последнего запуска', dfView(CMP.last[n.id])); sec.classList.add('df-sec');
      var host = p.querySelector('#popDesc'); while(host && host.parentNode !== p) host = host.parentNode;
      if(host) p.insertBefore(sec, host.nextSibling); else p.appendChild(sec);
    };
    var _cc = cmdCommands;
    cmdCommands = function(){
      return _cc().concat([{ sec:'board', label:dfOn() ? 'Скрыть данные на связях' : 'Показать данные на связях', d:'Плашки с числом записей, переданных по связи при последнем запуске', icon:'run', k:'данные связи записи поток отладка flow',
        act:function(){ UI.flowChips = !dfOn(); try { applyTheme(); } catch(e){} dfChips(); toast(dfOn() ? 'Данные на связях показаны' : 'Данные на связях скрыты'); } }]);
    };
  })();
