  /* ---------- расширения компании («Triosteum как пластилин», слой 3) ----------
     Расширение — небольшая программа компании на JavaScript: свои команды (Ctrl+K) и, если нужно, своя панель.
     Публикует владелец организации (библиотека компании, вид «ext»), включает каждый сотрудник сам — после того,
     как увидит, что расширению разрешено.
     Песочница: iframe sandbox="allow-scripts" без allow-same-origin — у расширения своё «пустое» происхождение,
     оно не видит страницу Triosteum, её хранилище (ключи ИИ, пространства), куки и не ходит на сервер от имени
     пользователя. Политика безопасности внутри закрывает сеть (connect-src и прочее — 'none').
     С приложением расширение говорит только сообщениями: triosteum.board.get() → проверка разрешения → ответ.
     Уход со своей страницы (единственный оставшийся способ что-то вынести) замечаем и расширение останавливаем. */
  var EXT_PERMS = {
    'board.read':'читать блоки, связи и заметки открытого пространства',
    'board.write':'добавлять и менять блоки, связи и заметки (всё отменяется Ctrl+Z)',
    'selection':'видеть, какие блоки выделены',
    'storage':'хранить свои настройки на этом устройстве',
    'panel':'показывать свою боковую панель'
  };
  var EXT_DENY = 'Расширению недоступны: интернет, сервер от вашего имени, другие пространства, ваши ключи и пароли.';
  var EXT_CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; form-action 'none'";
  var EXT_STORE_MAX = 256 * 1024;
  var EXT = { list:[], run:{}, pref:load('triosteum.ext', {}) || {}, seq:0 };

  // SDK внутри песочницы: самодостаточная функция — в iframe уходит её текст
  function extSdk(){
    var P = window.parent, seq = 0, wait = {}, cmds = {}, evs = {};
    function send(o){ o.tsx = 1; P.postMessage(o, '*'); }
    function safe(v){ try { return v === undefined ? null : JSON.parse(JSON.stringify(v)); } catch(e){ return null; } }
    function call(m, a){ return new Promise(function(res, rej){ var id = ++seq; wait[id] = [res, rej]; send({ id:id, m:m, a:safe(a) }); }); }
    function log(level, args){
      var t = Array.prototype.map.call(args, function(x){ if(typeof x === 'string') return x; if(x instanceof Error) return x.message; try { return JSON.stringify(x); } catch(e){ return String(x); } }).join(' ');
      try { send({ log:level, text:t.slice(0, 2000) }); } catch(e){}
    }
    ['log', 'info', 'warn', 'error'].forEach(function(k){ var o = console[k]; console[k] = function(){ log(k, arguments); try { o.apply(console, arguments); } catch(e){} }; });
    window.addEventListener('error', function(e){ log('error', [ (e.message || 'Ошибка') + (e.lineno ? ' (строка ' + e.lineno + ')' : '') ]); });
    window.addEventListener('unhandledrejection', function(e){ var r = e.reason; log('error', [ 'Ошибка: ' + (r && r.message || r) ]); });
    window.addEventListener('message', function(e){
      if(e.source !== P) return;
      var d = e.data; if(!d || d.tsx !== 1) return;
      if(d.re){ var w = wait[d.re]; if(!w) return; delete wait[d.re]; if(d.err) w[1](new Error(d.err)); else w[0](d.v); return; }
      if(d.init !== undefined){
        var th = d.theme || {}, st = document.documentElement.style;
        for(var k in th) st.setProperty('--' + k, th[k]);
        try { (0, eval)(String(d.init) + '\n//# sourceURL=extension.js'); } catch(x){ log('error', [ x && x.message || String(x) ]); }
        send({ ready:1 }); return;
      }
      if(d.cmd){
        var f = cmds[d.cmd];
        Promise.resolve().then(function(){ if(!f) throw new Error('команда «' + d.cmd + '» не зарегистрирована — вызовите triosteum.command("' + d.cmd + '", функция)'); return f(d.a); })
          .then(function(v){ send({ done:d.run, v:safe(v) }); }, function(x){ send({ done:d.run, err:String(x && x.message || x) }); });
        return;
      }
      if(d.ev) (evs[d.ev] || []).forEach(function(f){ try { f(d.a); } catch(x){ log('error', [ x && x.message || String(x) ]); } });
    });
    window.triosteum = {
      board:{
        get:function(){ return call('board.get'); },
        selection:function(){ return call('board.selection'); },
        add:function(b){ return call('board.add', b || {}); },
        update:function(id, patch){ return call('board.update', { id:id, patch:patch || {} }); },
        remove:function(id){ return call('board.remove', { id:id }); },
        connect:function(from, to){ return call('board.connect', { from:from, to:to }); },
        note:function(n){ return call('board.note', typeof n === 'string' ? { text:n } : (n || {})); }
      },
      ui:{
        toast:function(t){ return call('ui.toast', { text:String(t) }); },
        openPanel:function(){ return call('ui.panel', { open:true }); },
        closePanel:function(){ return call('ui.panel', { open:false }); }
      },
      storage:{
        get:function(k){ return call('storage.get', { k:String(k) }); },
        set:function(k, v){ return call('storage.set', { k:String(k), v:v }); }
      },
      command:function(id, fn){ cmds[String(id)] = fn; },
      on:function(ev, fn){ (evs[ev] = evs[ev] || []).push(fn); }
    };
  }
  var EXT_BASE_CSS = 'html{color-scheme:dark light}body{margin:0;padding:12px;font:13px/1.45 Inter,system-ui,sans-serif;color:var(--ink,#eee);background:var(--panel,#1b1b1f)}' +
    'button{font:inherit;color:inherit;background:var(--line,#333);border:1px solid var(--line2,#444);border-radius:8px;padding:6px 10px;cursor:pointer}' +
    'input,textarea,select{font:inherit;color:inherit;background:var(--bg,#111);border:1px solid var(--line2,#444);border-radius:8px;padding:6px 8px}' +
    'a{color:var(--red-soft,#f87171)}.muted{color:var(--muted,#aaa)}';
  function extSrcdoc(){
    return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + EXT_CSP + '">' +
      '<style>' + EXT_BASE_CSS + '</style><script>(' + extSdk.toString() + ')();<\/script></head><body></body></html>';
  }
  function extTheme(){
    var cs = getComputedStyle(document.documentElement), o = {};
    ['bg', 'panel', 'line', 'line2', 'ink', 'muted', 'red-soft'].forEach(function(k){ var v = cs.getPropertyValue('--' + k).trim(); if(v && v.indexOf('var(') < 0) o[k] = v; });
    var pv = getComputedStyle(document.body).backgroundColor; if(!o.panel && pv) o.panel = pv;
    return o;
  }

  // ---------- список и включение ----------
  function extFromItems(items){
    EXT.list = (items || []).filter(function(it){ return it && it.kind === 'ext' && it.data && /^x[a-z0-9]{5,15}$/.test(it.data.id || ''); })
      .map(function(it){ return { id:it.data.id, item:it.id, by:it.by, byName:it.by_name || '', def:it.data }; });
    // убранные, выключенные и обновлённые — останавливаем (новая версия запустится при следующем вызове)
    Object.keys(EXT.run).forEach(function(id){
      var r = EXT.run[id]; if(r.x.draft) return;
      var x = extById(id);
      if(!x || !extOn(x) || (x.def.ver || 0) !== (r.x.def.ver || 0)) extStop(id);
    });
  }
  extFromItems(SERVER && window.TRIOSTEUM_BOOT && window.TRIOSTEUM_BOOT.org_items);
  function extById(id){ return EXT.list.filter(function(x){ return x.id === id; })[0] || null; }
  function extNeedsOk(x){ var p = EXT.pref[x.id]; return !!(p && p.on) && (x.def.perms || []).some(function(k){ return (p.perms || []).indexOf(k) < 0; }); }
  function extOn(x){ var p = EXT.pref[x.id]; return !!(p && p.on) && !extNeedsOk(x); }
  function extSetOn(x, on){
    if(on) EXT.pref[x.id] = { on:true, perms:(x.def.perms || []).slice() }; else delete EXT.pref[x.id];
    save('triosteum.ext', EXT.pref);
    if(!on) extStop(x.id);
  }
  function extRefresh(){
    if(!SERVER) return Promise.resolve();
    return SERVER.api('GET', '/org/items?kind=ext').then(function(r){ if(r.status === 200) extFromItems(r.data.items); }, function(){});
  }

  // ---------- запуск в песочнице ----------
  function extHostEl(){
    var c = $('extHost');
    if(!c){ c = h('div', { id:'extHost', 'class':'ext-host' }); document.body.appendChild(c); }
    return c;
  }
  function extStart(x){
    var r = EXT.run[x.id];
    if(r) return r.ready;
    var name = x.def.name;
    var fr = h('iframe', { sandbox:'allow-scripts', title:'Расширение «' + name + '»', referrerpolicy:'no-referrer', 'class':'ext-frame' });
    var close = h('button', { type:'button', 'class':'ext-x', 'aria-label':'Закрыть панель', html:'&times;' });
    var pane = h('section', { 'class':'ext-pane', 'aria-label':'Панель расширения «' + name + '»' }, [
      h('header', null, [ h('b', { text:x.def.panel || name }), h('span', { 'class':'ext-by', text:x.draft ? 'черновик' : 'расширение компании' }), close ]), fr ]);
    close.addEventListener('click', function(){ pane.classList.remove('open'); });
    r = EXT.run[x.id] = { x:x, fr:fr, pane:pane, loads:0, win:0, winAt:0, runs:{}, log:[] };
    r.ready = new Promise(function(res, rej){
      r.ok = res;
      r.fail = rej;
      r.timer = setTimeout(function(){ rej(new Error('расширение не запустилось за 10 секунд')); extStop(x.id); }, 10000);
    });
    r.ready.catch(function(){});
    fr.addEventListener('load', function(){
      r.loads++;
      if(r.loads === 1){ extPost(r, { init:x.def.code, theme:extTheme() }); return; }
      // второй load — расширение ушло со своей страницы: останавливаем
      extLog(r, 'error', 'Расширение попыталось перейти на другую страницу и остановлено');
      toast('Расширение «' + name + '» пыталось перейти на другую страницу — остановлено');
      extStop(x.id, 'пыталось перейти на другую страницу — остановлено');
    });
    fr.srcdoc = extSrcdoc();
    extHostEl().appendChild(pane);
    return r.ready;
  }
  // why — почему остановлено: это же увидит пользователь вместо ответа выполнявшейся команды
  function extStop(id, why){
    var r = EXT.run[id]; if(!r) return;
    delete EXT.run[id];
    clearTimeout(r.timer);
    why = why || 'расширение остановлено';
    try { r.fail(new Error(why)); } catch(e){}
    Object.keys(r.runs).forEach(function(k){ try { r.runs[k]({ err:why }); } catch(e){} });
    r.pane.remove();
  }
  function extPost(r, o){ o.tsx = 1; try { r.fr.contentWindow.postMessage(o, '*'); } catch(e){} }
  function extLog(r, level, text){
    r.log.push({ t:Date.now(), level:level, text:String(text) });
    if(r.log.length > 200) r.log.shift();
    if(typeof r.x.onLog === 'function') try { r.x.onLog(level, String(text)); } catch(e){}
  }
  function extRunOf(src){ for(var k in EXT.run) if(EXT.run[k].fr.contentWindow === src) return EXT.run[k]; return null; }
  window.addEventListener('message', function(e){
    var d = e.data; if(!d || d.tsx !== 1) return;
    var r = extRunOf(e.source); if(!r) return;
    if(d.ready){ clearTimeout(r.timer); r.ok(); return; }
    if(d.log){ extLog(r, String(d.log), d.text); return; }
    if(d.done){ var cb = r.runs[d.done]; if(cb){ delete r.runs[d.done]; cb(d); } return; }
    if(!d.id) return;
    var reply = function(v, err){ extPost(r, err ? { re:d.id, err:String(err) } : { re:d.id, v:v === undefined ? null : v }); };
    var now = Date.now();
    if(now - r.winAt > 1000){ r.winAt = now; r.win = 0; }
    if(++r.win > 200){ reply(null, 'слишком много запросов — не больше 200 в секунду'); return; }
    var res;
    try { res = extApi(r, String(d.m), d.a || {}); } catch(x){ reply(null, x && x.message || x); return; }
    Promise.resolve(res).then(function(v){ reply(v); }, function(x){ reply(null, x && x.message || x); });
  });

  // ---------- что расширение может делать ----------
  function extApi(r, m, a){
    var def = r.x.def, perms = def.perms || [];
    var need = function(p){ if(perms.indexOf(p) < 0) throw new Error('нет разрешения «' + p + '» — добавьте его в описание расширения'); };
    // id блоков повторяются в разных пространствах: менять по id можно только то, что расширение узнало
    // в открытом сейчас пространстве (из board.get/selection или создав само)
    var write = function(ids){
      need('board.write');
      if(SERVER && SERVER.role === 'viewer') throw new Error('у вас доступ только для просмотра — доску менять нельзя');
      (ids || []).forEach(function(id){
        if(!extKnows(r, id)) throw new Error(r.known && r.known.space !== curId() ? 'пространство сменилось — прочитайте доску заново (board.get)'
          : 'элемент «' + id + '» расширению не известен — получите его через board.get или board.selection');
      });
    };
    // команда привязана к пространству, в котором её запустили: после переключения — останавливаем расширение целиком
    if(r.active && r.cmdSpace && r.cmdSpace !== curId() && /^board\./.test(m)){
      setTimeout(function(){ toast('«' + def.name + '»: пространство сменилось во время команды — расширение остановлено'); extStop(r.x.id, 'пространство сменилось во время команды — расширение остановлено'); }, 0);
      throw new Error('пространство сменилось во время команды');
    }
    switch(m){
      case 'board.get': {
        need('board.read');
        var bd = extBoard();
        extKnow(r, bd.nodes.concat(bd.edges, bd.notes).map(function(x){ return x.id; }), true);
        return bd;
      }
      case 'board.selection': {
        if(perms.indexOf('selection') < 0) need('board.read');
        var sl = extSelection(); extKnow(r, sl.ids); return sl;
      }
      case 'board.add': { write(); var an = extTx(r, function(){ return extAdd(r, a); }); extKnow(r, [ an.id ]); return an; }
      case 'board.update': write([ String(a.id) ]); return extTx(r, function(){ return extUpdate(a, perms.indexOf('board.read') >= 0); });
      case 'board.remove': write([ String(a.id) ]); return extTx(r, function(){ return extRemove(a); });
      case 'board.connect': { write([ String(a.from), String(a.to) ]); var ce = extTx(r, function(){ return extConnect(a); }); extKnow(r, [ ce.id ]); return ce; }
      case 'board.note': { write(a.attach ? [ String(a.attach) ] : []); var nt = extTx(r, function(){ return extNote(a); }); extKnow(r, [ nt.id ]); return nt; }
      case 'ui.toast': toast('«' + def.name + '»: ' + String(a.text || '').slice(0, 200)); return true;
      case 'ui.panel': need('panel'); extPanel(r.x, a.open !== false); return true;
      case 'storage.get': need('storage'); return extStore(r.x)[String(a.k)] === undefined ? null : extStore(r.x)[String(a.k)];
      case 'storage.set': {
        need('storage');
        var all = extStore(r.x);
        if(a.v === null || a.v === undefined) delete all[String(a.k)]; else all[String(a.k)] = a.v;
        if(JSON.stringify(all).length > EXT_STORE_MAX) throw new Error('хранилище расширения переполнено (больше 256 КБ)');
        save(extStoreKey(r.x), all); return true;
      }
    }
    throw new Error('неизвестный вызов «' + m + '»');
  }
  function extKnow(r, ids, reset){
    if(reset || !r.known || r.known.space !== curId()) r.known = { space:curId(), ids:{} };
    ids.forEach(function(id){ r.known.ids[id] = 1; });
  }
  function extKnows(r, id){ return !!(r.known && r.known.space === curId() && r.known.ids[id]); }
  function extStoreKey(x){ return 'triosteum.extdata.' + (x.draft ? 'draft.' : '') + x.id; }
  function extStore(x){ var v = load(extStoreKey(x), {}); return v && typeof v === 'object' ? v : {}; }
  function extNodeOut(n){
    return { id:n.id, name:n.name || '', lang:n.lang, kind:n.kind || 'block', code:typeof nodeCode === 'function' ? String(nodeCode(n) || '') : String((n.codes || {})[n.lang] || ''),
      desc:n.desc || '', x:n.x, y:n.y };
  }
  function extBoard(){
    var p = typeof curProj === 'function' ? curProj() : null;
    return {
      space:p ? { id:p.id, name:p.name, env:ENV.id } : { env:ENV.id },
      nodes:G.nodes.map(extNodeOut),
      edges:G.edges.map(function(e){ return { id:e.id, from:e.from, to:e.to }; }),
      notes:G.notes.map(function(t){ return { id:t.id, text:t.text || '', x:t.x, y:t.y, attach:t.attach || null }; }),
      langs:LANGS.map(function(l){ return { id:l.id, name:l.name }; })
    };
  }
  function extSelection(){
    var ids = (S.multi || []).filter(function(m){ return m.type === 'node'; }).map(function(m){ return m.id; });
    if(!ids.length && S.sel && S.sel.type === 'node') ids = [ S.sel.id ];
    return { ids:ids };
  }
  function extStr(v, max){ return v === undefined || v === null ? '' : String(v).slice(0, max); }
  function extNum(v){ return typeof v === 'number' && isFinite(v) ? Math.round(Math.max(-1e6, Math.min(1e6, v))) : null; }
  function extAdd(r, a){
    var now = Date.now();
    r.adds = (r.adds || []).filter(function(t){ return now - t < 60000; });
    if(r.adds.length >= 500) throw new Error('не больше 500 новых блоков в минуту');
    r.adds.push(now);
    var lang = langById(a.lang) && LANGS.some(function(l){ return l.id === a.lang; }) ? a.lang : (LANGS[0] && LANGS[0].id);
    if(!lang) throw new Error('в этой среде нет типов блоков');
    var x = extNum(a.x), y = extNum(a.y);
    if(x === null || y === null){ var c = viewCenter(), off = (G.nodes.length % 6) * 28; x = Math.round(c.x - NW / 2 + off); y = Math.round(c.y - NH / 2 + off); }
    var n = { id:newId('n'), name:extStr(a.name, 200) || 'Блок', lang:lang, x:x, y:y, codes:{}, pluginId:null, family:null, desc:extStr(a.desc, 1000), colors:null };
    if(a.code !== undefined && a.code !== null) n.codes[lang] = extStr(a.code, 200000);
    G.nodes.push(n);
    saveGraph(); renderGraph();
    return extNodeOut(n);
  }
  // без разрешения «читать доску» содержимое существующего блока не отдаём — только id
  function extUpdate(a, canRead){
    var n = nodeById(a.id); if(!n) throw new Error('блока с id «' + a.id + '» нет на доске');
    var p = a.patch || {};
    // блок показывает файл пространства — его код живёт в файле, а не в блоке
    if(p.code !== undefined && n.src && typeof ofFile === 'function' && ofFile(n.src))
      throw new Error('блок «' + (n.name || n.id) + '» связан с файлом — его содержимое меняется в самом файле, а не через код блока');
    if(p.name !== undefined) n.name = extStr(p.name, 200) || n.name;
    if(p.desc !== undefined) n.desc = extStr(p.desc, 1000);
    if(p.code !== undefined) n.codes[n.lang] = extStr(p.code, 200000);
    if(extNum(p.x) !== null) n.x = extNum(p.x);
    if(extNum(p.y) !== null) n.y = extNum(p.y);
    saveGraph(); renderGraph();
    // блок открыт в редакторе — показываем новый код, иначе следующее нажатие клавиши вернуло бы старый
    if((p.code !== undefined || p.name !== undefined) && extEditing(n)) try { loadDoc(); } catch(e){}
    return canRead ? extNodeOut(n) : { id:n.id };
  }
  function extEditing(n){ return !el.editor.hidden && typeof docNode === 'function' && docNode() === n; }
  function extRemove(a){
    var id = String(a.id || '');
    if(nodeById(id)){
      if(extEditing(nodeById(id))) try { backToCanvas(); } catch(e){}
      G.nodes = G.nodes.filter(function(n){ return n.id !== id; });
      G.edges = G.edges.filter(function(e){ return e.from !== id && e.to !== id; });
      G.notes = G.notes.filter(function(t){ return t.attach !== id; });
      G.edges.forEach(function(e){ (e.taps || []).forEach(function(tp){ tp.nodes = tapIds(tp).filter(function(x){ return x !== id; }); }); });
    } else if(G.edges.some(function(e){ return e.id === id; })) G.edges = G.edges.filter(function(e){ return e.id !== id; });
    else if(G.notes.some(function(t){ return t.id === id; })) G.notes = G.notes.filter(function(t){ return t.id !== id; });
    else throw new Error('на доске нет элемента с id «' + id + '»');
    if(S.sel && S.sel.id === id) S.sel = null;
    S.multi = (S.multi || []).filter(function(m){ return m.id !== id; });
    hidePop(); saveGraph(); renderGraph();
    return true;
  }
  function extConnect(a){
    var f = nodeById(a.from), t = nodeById(a.to);
    if(!f || !t) throw new Error('связать можно только блоки, которые есть на доске');
    if(f === t) throw new Error('блок нельзя связать с самим собой');
    var ex = G.edges.filter(function(e){ return e.from === f.id && e.to === t.id; })[0];
    if(ex) return { id:ex.id, from:ex.from, to:ex.to };
    var e = { id:newId('e'), from:f.id, to:t.id, taps:[] };
    G.edges.push(e); saveGraph(); renderGraph();
    return { id:e.id, from:e.from, to:e.to };
  }
  function extNote(a){
    var at = a.attach && nodeById(a.attach);
    var x = extNum(a.x), y = extNum(a.y);
    if(!at && (x === null || y === null)){ var c = viewCenter(); x = Math.round(c.x); y = Math.round(c.y); }
    var t = at ? { id:newId('t'), text:extStr(a.text, 4000), attach:at.id, dx:-184, dy:0, size:'s', tint:'grey', hidden:false }
               : { id:newId('t'), text:extStr(a.text, 4000), x:x, y:y, fs:UI.note, tint:'grey' };
    G.notes.push(t); saveGraph(); renderGraph();
    return { id:t.id, text:t.text, attach:t.attach || null };
  }
  function extPanel(x, open){
    var r = EXT.run[x.id]; if(!r) return;
    if(open) Object.keys(EXT.run).forEach(function(k){ if(k !== x.id) EXT.run[k].pane.classList.remove('open'); });
    r.pane.classList.toggle('open', !!open);
  }
  // изменения доски — расширениям, которым можно её читать (не чаще раза в полсекунды)
  var extChangeTimer = 0;
  function extChanged(){
    clearTimeout(extChangeTimer);
    extChangeTimer = setTimeout(function(){
      Object.keys(EXT.run).forEach(function(k){ var r = EXT.run[k]; if((r.x.def.perms || []).indexOf('board.read') >= 0) extPost(r, { ev:'change', a:null }); });
    }, 500);
  }
  /* История и расширения. Каждое изменение расширения фиксируется отдельным снимком сразу (до него — фиксируем то,
     что успел сделать пользователь), и снимок помечается группой: одна команда — одна группа. Ctrl+Z снимает
     подряд идущие снимки одной группы разом. Поэтому правки пользователя во время команды остаются отдельными
     записями отмены и не пропадают вместе с результатом команды. Пока команда выполняется, отмена и повтор ждут. */
  EXT.hold = 0; EXT.tags = []; EXT.rtags = []; EXT.tagNow = null; EXT.lastTagged = null;
  function extFitTags(){
    var fit = function(t, n){ if(t.length > n) return t.slice(t.length - n); while(t.length < n) t.unshift(null); return t; };
    EXT.tags = fit(EXT.tags, hist.undo.length); EXT.rtags = fit(EXT.rtags, hist.redo.length);
  }
  var extCommit0 = commitHist;
  commitHist = function(){
    extFitTags();
    // следующее изменение той же команды сразу за её же снимком — не новая запись, а продолжение прежней:
    // так у команды остаётся одна запись с её началом, и длинная команда не вытесняет его из истории (150 записей)
    if(EXT.tagNow && hist.last !== null && EXT.tags[EXT.tags.length - 1] === EXT.tagNow && EXT.lastTagged === hist.last){
      var s = snap();
      if(s !== hist.last){ hist.last = s; hist.redo = []; EXT.rtags = []; EXT.lastTagged = s; }
      return;
    }
    var was = hist.last, v = extCommit0.apply(this, arguments);
    if(was !== null && hist.last !== was){ EXT.tags.push(EXT.tagNow); EXT.rtags = []; extFitTags(); }
    if(hist.last !== was) EXT.lastTagged = EXT.tagNow ? hist.last : null;   // ничего не изменилось — прежняя запись команды остаётся последней
    return v;
  };
  function extTx(r, fn){
    var now = Date.now();
    var g = r.group || (r.burstG && now - r.burstAt < 1000 ? r.burstG : 'b' + (++EXT.seq));   // панель: серия правок за секунду — одна группа
    if(!r.group){ r.burstG = g; r.burstAt = now; }
    flushSave(); commitHist();        // сначала — то, что успел изменить пользователь (отдельной записью)
    var v = fn();
    EXT.tagNow = g; try { flushSave(); commitHist(); } finally { EXT.tagNow = null; }
    return v;
  }
  var extUndo0 = undo, extRedo0 = redo;
  undo = function(){
    if(EXT.hold > 0){ toast('Подождите: расширение ещё выполняет команду — отменить можно будет после неё'); return; }
    flushSave(); extFitTags();
    var g = EXT.tags[EXT.tags.length - 1];
    do {
      var n = hist.undo.length; extUndo0.apply(this, arguments);
      if(hist.undo.length === n) break;
      EXT.rtags.push(EXT.tags.pop());
    } while(g && EXT.tags.length && EXT.tags[EXT.tags.length - 1] === g);
  };
  redo = function(){
    if(EXT.hold > 0){ toast('Подождите: расширение ещё выполняет команду'); return; }
    flushSave(); extFitTags();
    var g = EXT.rtags[EXT.rtags.length - 1];
    do {
      var n = hist.redo.length; extRedo0.apply(this, arguments);
      if(hist.redo.length === n) break;
      EXT.tags.push(EXT.rtags.pop());
    } while(g && EXT.rtags.length && EXT.rtags[EXT.rtags.length - 1] === g);
  };
  function extHold(){ EXT.hold++; var done = false; return function(){ if(done) return; done = true; EXT.hold = Math.max(0, EXT.hold - 1); }; }
  var extSaveGraph0 = saveGraph;
  saveGraph = function(){ var v = extSaveGraph0.apply(this, arguments); if(Object.keys(EXT.run).length) extChanged(); return v; };

  // ---------- команды и панели ----------
  function extInvoke(x, cmd){
    var name = x.def.name, slow = setTimeout(function(){ toast('«' + name + '»: выполняется…'); }, 800);
    return extStart(x).then(function(){
      var r = EXT.run[x.id]; if(!r) throw new Error('расширение остановлено');
      var rid = 'r' + (++EXT.seq), hold = extHold();
      r.active = (r.active || 0) + 1; r.cmdSpace = curId(); r.group = 'c' + rid;
      var release = function(){ hold(); r.active = Math.max(0, (r.active || 1) - 1); if(!r.active) r.group = null; };
      return new Promise(function(res, rej){
        // не ответила за минуту — останавливаем расширение целиком, чтобы зависшая команда не дописала доску потом
        var to = setTimeout(function(){ extStop(x.id, 'команда не ответила за минуту — расширение остановлено'); }, +window.__tsExtCmdTimeout || 60000   /* в тестах — короче */);
        r.runs[rid] = function(d){ clearTimeout(to); release(); if(d.err) rej(new Error(d.err)); else res(d.v); };
        extPost(r, { cmd:cmd, run:rid, a:null });
      });
    }).then(function(v){ clearTimeout(slow); return v; }, function(err){
      clearTimeout(slow);
      var r = EXT.run[x.id]; if(r) extLog(r, 'error', err.message);
      if(typeof x.onLog === 'function' && !r) try { x.onLog('error', err.message); } catch(e){}
      toast('«' + name + '»: ' + err.message);
      throw err;
    });
  }
  function extOpenPanel(x){ return extStart(x).then(function(){ extPanel(x, true); }, function(err){ toast('«' + x.def.name + '»: ' + err.message); }); }
  function extCommands(){
    var C = [ { sec:'ext', label:'Мастерская расширений', d:'Собрать своё расширение: команды, панель, код — и пробный запуск', icon:'edit', act:function(){ openWorkshop(); }, k:'мастерская расширение создать написать код ext' } ];
    if(!SERVER) return C;
    C.push({ sec:'ext', label:'Расширения компании', d:'Включить или выключить расширения вашей организации', icon:'plug', act:openExtMgr, k:'расширения плагины компании ext' });
    EXT.list.filter(extOn).forEach(function(x){
      (x.def.commands || []).forEach(function(c){
        C.push({ sec:'ext', label:x.def.name + ': ' + c.label, d:c.desc || '', icon:'plug', act:function(){ extInvoke(x, c.id).catch(function(){}); }, k:'расширение ' + x.def.name });
      });
      if((x.def.perms || []).indexOf('panel') >= 0)
        C.push({ sec:'ext', label:'Панель «' + (x.def.panel || x.def.name) + '»', d:'Расширение «' + x.def.name + '»', icon:'layout', act:function(){ extOpenPanel(x); }, k:'расширение панель ' + x.def.name });
    });
    return C;
  }

  // ---------- окно «Расширения компании» ----------
  function extPermList(perms){
    var ul = h('ul', { 'class':'ext-perms' });
    (perms || []).forEach(function(p){ ul.appendChild(h('li', { text:EXT_PERMS[p] || p })); });
    if(!(perms || []).length) ul.appendChild(h('li', { text:'ничего не читать и не менять — только свои команды' }));
    return ul;
  }
  function openExtMgr(){
    var back = h('div', { 'class':'cenv-back ext-back', role:'dialog', 'aria-modal':'true', 'aria-label':'Расширения компании' });
    var list = h('div', { 'class':'ext-list' });
    var close = h('button', { type:'button', 'class':'btn', text:'Закрыть' });
    var shop = h('button', { type:'button', 'class':'btn ghost', text:'Мастерская расширений' });
    shop.addEventListener('click', function(){ shut(); openWorkshop(); });
    back.appendChild(h('div', { 'class':'cenv ext-mgr' }, [
      h('header', { 'class':'cenv-h' }, [ h('h2', { text:'Расширения компании' }),
        h('p', { text:'Программы вашей организации: свои команды и панели в Triosteum. Работают в песочнице; что можно каждому — вы решаете сами.' }) ]),
      h('div', { 'class':'cenv-body' }, [ list ]),
      h('footer', { 'class':'cenv-f' }, [ shop, close ]) ]));
    function shut(){ back.remove(); document.removeEventListener('keydown', onEsc, true); }
    function onEsc(ev){ if(ev.key === 'Escape' && document.contains(back)){ ev.stopPropagation(); ev.preventDefault(); shut(); } }
    document.addEventListener('keydown', onEsc, true);
    close.addEventListener('click', shut);
    back.addEventListener('mousedown', function(ev){ if(ev.target === back) shut(); });
    back.addEventListener('keydown', function(ev){ ev.stopPropagation(); });
    function card(x){
      var d = x.def, on = extOn(x), ask = extNeedsOk(x);
      var state = h('span', { 'class':'ext-state' + (on ? ' on' : ask ? ' ask' : ''), text:on ? 'включено' : ask ? 'просит новые разрешения' : 'выключено' });
      var box = h('article', { 'class':'ext-card', 'data-ext':x.id }, [
        h('div', { 'class':'ext-card-h' }, [ h('b', { text:d.name }), h('span', { 'class':'ext-ver', text:'версия ' + (d.ver || 1) + (x.byName ? ' · ' + x.byName : '') }), state ]),
        d.desc ? h('p', { 'class':'ext-desc', text:d.desc }) : null ]);
      var cmds = (d.commands || []).map(function(c){ return c.label; });
      if(cmds.length) box.appendChild(h('p', { 'class':'ext-cmds', text:'Команды (Ctrl+K): ' + cmds.join(', ') }));
      var acts = h('div', { 'class':'ext-acts' });
      var confirm = h('div', { 'class':'ext-confirm', hidden:'' }, [
        h('b', { text:'Расширению будет разрешено:' }), extPermList(d.perms), h('p', { 'class':'ext-deny', text:EXT_DENY }) ]);
      var yes = h('button', { type:'button', 'class':'btn primary', text:'Разрешить и включить' });
      var no = h('button', { type:'button', 'class':'btn', text:'Отмена' });
      confirm.appendChild(h('div', { 'class':'ext-acts' }, [ no, yes ]));
      if(on){
        var off = h('button', { type:'button', 'class':'btn', text:'Выключить' });
        off.addEventListener('click', function(){ extSetOn(x, false); toast('Расширение «' + d.name + '» выключено'); draw(x.id); });
        acts.appendChild(off);
      } else {
        var en = h('button', { type:'button', 'class':'btn primary', text:ask ? 'Посмотреть разрешения' : 'Включить…' });
        en.addEventListener('click', function(){ confirm.hidden = false; acts.hidden = true; yes.focus(); });
        acts.appendChild(en);
      }
      no.addEventListener('click', function(){ confirm.hidden = true; acts.hidden = false; });
      yes.addEventListener('click', function(){ extSetOn(x, true); toast('Расширение «' + d.name + '» включено — его команды в Ctrl+K'); draw(x.id); });
      if(SERVER && SERVER.role === 'owner'){
        var del = h('button', { type:'button', 'class':'btn danger', text:'Убрать из компании' }), armed = 0;
        del.addEventListener('click', function(){
          if(Date.now() - armed > 4000){ armed = Date.now(); del.textContent = 'Точно убрать у всех?'; return; }
          SERVER.api('DELETE', '/org/items/' + x.item).then(function(r){
            if(r.status !== 200){ toast((r.data && r.data.detail) || 'Не получилось убрать'); return; }
            extSetOn(x, false); toast('Расширение «' + d.name + '» убрано из компании'); extRefresh().then(function(){ draw(); });
          });
        });
        acts.appendChild(del);
      }
      box.appendChild(acts); box.appendChild(confirm);
      return box;
    }
    // после перерисовки фокус остаётся в окне (иначе Escape не закроет его)
    function draw(focusId){
      list.textContent = '';
      setTimeout(function(){ var f = focusId && list.querySelector('[data-ext="' + focusId + '"] .ext-acts button'); (f || close).focus(); }, 0);
      if(!EXT.list.length){ list.appendChild(h('p', { 'class':'ext-empty', text:'В компании пока нет расширений. Собрать своё можно в мастерской расширений.' })); return; }
      EXT.list.forEach(function(x){ list.appendChild(card(x)); });
    }
    draw();
    document.body.appendChild(back);
    close.focus();
    extRefresh().then(function(){ if(document.contains(back) && !list.querySelector('.ext-confirm:not([hidden])')) draw(); });
  }
