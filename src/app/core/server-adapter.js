  /* ---------- адаптер сервера: данные хранятся в облаке Triosteum ---------- */
  // Включается сам, когда страницу отдал сервер Triosteum: сервер вставляет в неё
  // window.TRIOSTEUM_BOOT — пользователя, его пространства и настройки. Без этого
  // (файл открыт с диска или с GitHub Pages) всё работает как раньше, в браузере.
  //
  // Чтение — мгновенно из памяти (данные уже пришли с сервером при загрузке страницы).
  // Запись — в фоне: правки копятся ~0,8 с и уходят на сервер одним запросом.
  // Если пространство тем временем изменил коллега, сервер отвечает 409 — тогда загружаем
  // его версию, а наши правки сохраняем отдельной копией, чтобы ничего не потерять.
  function serverAdapter(boot){
    var P = 'triosteum.', PJ = P + 'proj.', LIST = P + 'projects';
    var api = (boot.api || '') + '/api';
    var spaces = {}, order = [], prefs = {}, cur = boot.cur || null;
    var pending = {}, timers = {}, inflight = {}, listeners = [], offline = false, conflictOpen = false;
    var quiet = {};   // ключи, обновлённые из-за конфликта: своё сообщение уже показано
    (boot.spaces || []).forEach(function(sp){
      var txt = typeof sp.content === 'string' ? sp.content : JSON.stringify(sp.content || {});
      // base — последняя версия, известная и нам, и серверу: от неё считается слияние одновременных правок
      spaces[sp.id] = { id:sp.id, name:sp.name, env:sp.env || 'code', rev:sp.rev || 0, updated_at:sp.updated_at, content:txt, base:txt };
      order.push(sp.id);
    });
    Object.keys(boot.prefs || {}).forEach(function(k){ prefs[k] = JSON.stringify(boot.prefs[k]); });
    if(!cur || !spaces[cur]) cur = order[0] || null;

    function req(method, path, body, keepalive){
      var hd = body === undefined ? {} : { 'Content-Type':'application/json' };
      if(adapter.sid) hd['X-Live-Sid'] = adapter.sid;      // своя же правка не вернётся нам по WebSocket
      return fetch(api + path, { method:method, credentials:'same-origin', keepalive:!!keepalive,
        headers:hd,
        body:body === undefined ? undefined : JSON.stringify(body) }).then(function(r){
          if(r.status === 401){ location.href = (boot.api || '') + '/login?next=' + encodeURIComponent(location.pathname); throw new Error('auth'); }
          return r.text().then(function(t){ var d = null; try{ d = t ? JSON.parse(t) : null; }catch(e){} return { status:r.status, data:d }; });
        });
    }
    function mark(text){ try{ if(el && el.saved) el.saved.textContent = text; }catch(e){} }
    function setOffline(v){
      if(offline === v) return; offline = v;
      if(v){ mark('нет связи — правки ждут'); if(typeof toast === 'function') toast('Нет связи с сервером. Правки сохранятся, когда связь вернётся'); }
      else mark('сохранено');
    }
    // очередь записи: по одному запросу на ключ, последнее значение побеждает
    function queue(key, run, delay){
      pending[key] = run; clearTimeout(timers[key]);
      timers[key] = setTimeout(function(){ flush(key); }, delay == null ? 800 : delay);
    }
    function flush(key, keepalive){
      var run = pending[key]; if(!run) return Promise.resolve();
      if(inflight[key]) return inflight[key].then(function(){ return flush(key, keepalive); });
      delete pending[key]; clearTimeout(timers[key]);
      mark('сохраняется…');
      var p = run(keepalive).then(function(){ setOffline(false); if(!Object.keys(pending).length) mark('сохранено'); }, function(err){
        if(err && err.message === 'auth') return;
        if(!pending[key]) pending[key] = run;       // не получилось — повторим позже
        setOffline(true); clearTimeout(timers[key]);
        timers[key] = setTimeout(function(){ flush(key); }, 5000);
      });
      inflight[key] = p.then(function(){ delete inflight[key]; });
      return p;
    }
    function flushAll(keepalive){ return Promise.all(Object.keys(pending).map(function(k){ return flush(k, keepalive); })); }

    function meta(sp){ return { id:sp.id, name:sp.name, env:sp.env || 'code', t:Date.parse(sp.updated_at || '') || Date.now() }; }
    function saveSpace(id){
      return function(keepalive){
        var sp = spaces[id]; if(!sp) return Promise.resolve();
        var sent = sp.content, sentBase = sp.base;          // основа именно этой правки — для слияния при конфликте
        return req('PUT', '/spaces/' + encodeURIComponent(id), { name:sp.name, env:sp.env || 'code', content:JSON.parse(sent), base_rev:sp.rev || 0 }, keepalive).then(function(r){
          if(r.status === 200 || r.status === 201){ sp.rev = r.data.rev; sp.updated_at = r.data.updated_at; sp.base = sent; return; }
          if(r.status === 409) return conflict(id, sent, r.data, sentBase);
          throw new Error('HTTP ' + r.status);
        });
      };
    }
    // кто-то сохранил это пространство раньше нас: берём его версию, свою — копией
    function conflict(id, mine, theirs, mineBase){
      var sp = spaces[id];
      // сначала пробуем слить: разные блоки и свойства складываются, копия не нужна.
      // Наша правка (mine) — поверх mineBase; а то, что пришло после её отправки, уже учтено в sp.content.
      try{
        var merged = merge3(JSON.parse(mineBase || sp.base || '{}'), JSON.parse(mine), theirs.content);
        if(sp.content !== mine) merged = merge3(JSON.parse(mine), JSON.parse(sp.content), merged);   // правки, сделанные пока запрос был в пути
        sp.rev = theirs.rev; sp.updated_at = theirs.updated_at; sp.base = JSON.stringify(theirs.content);
        sp.content = JSON.stringify(merged);
        queue(PJ + id, saveSpace(id), 0);
      }catch(e){ merged = null; }
      if(merged){
        try{
          if(adapter.onMerged) adapter.onMerged(id, merged, theirs.updated_by_name, theirs.content, mine);
          else { quiet[PJ + id] = true; emit(PJ + id, sp.content); }
        }catch(e){ console.error('LIVE onMerged', e && e.message); }
        return;
      }
      sp.rev = theirs.rev; sp.content = JSON.stringify(theirs.content); sp.updated_at = theirs.updated_at;
      var copyId = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      var who = theirs.updated_by_name ? ' (' + theirs.updated_by_name + ')' : '';
      spaces[copyId] = { id:copyId, name:sp.name + ' — мои правки', env:sp.env, rev:0, content:mine, updated_at:new Date().toISOString() };
      order.push(copyId);
      queue(PJ + copyId, saveSpace(copyId), 0);
      quiet[PJ + id] = true; emit(PJ + id, sp.content); emit(LIST, listJSON());
      if(!conflictOpen && typeof toastAct === 'function'){
        conflictOpen = true; setTimeout(function(){ conflictOpen = false; }, 4000);
        toastAct('Пространство одновременно изменил коллега' + who + '. Открыта его версия, ваши правки — в копии «' + spaces[copyId].name + '»', 'К моей копии', function(){ if(typeof switchProj === 'function') switchProj(copyId); });
      }
    }
    function listJSON(){
      return JSON.stringify({ cur:cur || order[0] || 'p1', list:order.filter(function(id){ return spaces[id]; }).map(function(id){ return meta(spaces[id]); }) });
    }
    function setList(text){
      var v; try{ v = JSON.parse(text); }catch(e){ return true; }
      if(v.cur && v.cur !== cur){ cur = v.cur; queue('pref:cur', function(k){ return req('PUT', '/prefs/cur', { value:cur }, k); }, 400); }
      (v.list || []).forEach(function(m){
        var sp = spaces[m.id];
        if(!sp){                                    // новое пространство: содержимое придёт следом через saveSpace
          spaces[m.id] = { id:m.id, name:m.name, env:m.env || 'code', rev:0, content:'{}', updated_at:new Date().toISOString() };
          order.push(m.id); return;
        }
        if(sp.name !== m.name || (sp.env || 'code') !== (m.env || 'code')){
          sp.name = m.name; sp.env = m.env || 'code';
          if(sp.rev) queue('meta:' + m.id, function(k){ return req('PATCH', '/spaces/' + encodeURIComponent(m.id), { name:sp.name, env:sp.env }, k).then(function(r){ if(r.status >= 400 && r.status !== 404) throw new Error('HTTP ' + r.status); }); }, 300);
        }
      });
      return true;
    }
    function emit(key, val){ listeners.forEach(function(fn){ try{ fn(key, val); }catch(e){} }); }

    window.addEventListener('beforeunload', function(e){
      if(!Object.keys(pending).length && !Object.keys(inflight).length) return;
      flushAll(true);
      e.preventDefault(); e.returnValue = '';      // браузер спросит, точно ли закрыть: правки ещё отправляются
    });
    window.addEventListener('online', function(){ flushAll(); });

    var adapter = {
      name:'server',
      user:boot.user || null, org:boot.org || null, role:boot.role || 'editor',
      get:function(k){
        if(k === LIST) return order.length ? listJSON() : null;
        if(k.indexOf(PJ) === 0){ var sp = spaces[k.slice(PJ.length)]; return sp ? sp.content : null; }
        if(k.indexOf(P) === 0){ var v = prefs[k.slice(P.length)]; return v === undefined ? null : v; }
        return null;
      },
      set:function(k, text){
        if(boot.role === 'viewer' && k.indexOf(PJ) === 0) return true;   // наблюдатель смотрит, но не сохраняет
        if(k === LIST) return setList(text);
        if(k.indexOf(PJ) === 0){
          var id = k.slice(PJ.length), sp = spaces[id];
          if(!sp){ sp = spaces[id] = { id:id, name:'Пространство', env:'code', rev:0, content:'{}' }; order.push(id); }
          if(sp.content === text) return true;
          sp.content = text; queue(k, saveSpace(id)); return true;
        }
        if(k.indexOf(P) === 0){
          var name = k.slice(P.length);
          if(prefs[name] === text) return true;
          prefs[name] = text;
          queue('pref:' + name, function(ka){ return req('PUT', '/prefs/' + encodeURIComponent(name), { value:JSON.parse(text) }, ka).then(function(r){ if(r.status >= 400) throw new Error('HTTP ' + r.status); }); }, 1200);
          return true;
        }
        return true;
      },
      remove:function(k){
        if(k.indexOf(PJ) !== 0) return;
        var id = k.slice(PJ.length); if(!spaces[id]) return;
        var known = spaces[id].rev > 0;
        delete spaces[id]; order = order.filter(function(x){ return x !== id; });
        delete pending[k]; clearTimeout(timers[k]);
        if(known) queue('del:' + id, function(ka){ return req('DELETE', '/spaces/' + encodeURIComponent(id), undefined, ka).then(function(r){ if(r.status >= 400 && r.status !== 404) throw new Error('HTTP ' + r.status); }); }, 0);
      },
      keys:function(prefix){
        var all = [LIST].concat(order.map(function(id){ return PJ + id; })).concat(Object.keys(prefs).map(function(n){ return P + n; }));
        return all.filter(function(k){ return !prefix || k.indexOf(prefix) === 0; });
      },
      watch:function(fn){ listeners.push(fn); },
      // true — обновление вызвано конфликтом, общее «обновлено» показывать не нужно
      quietUpdate:function(k){ var q = !!quiet[k]; delete quiet[k]; return q; },
      flush:flushAll,
      // прямой запрос к API (команда, история версий): ответ {status, data}
      api:function(method, path, body){ return req(method, path, body); },
      // id и номер правки пространства на сервере
      rev:function(id){ return spaces[id] ? spaces[id].rev : 0; },
      logout:function(){ return flushAll().then(function(){ return req('POST', '/auth/logout', {}); }).then(function(){ location.href = (boot.api || '') + '/login'; }, function(){ location.href = (boot.api || '') + '/login'; }); },
      // перенос пространств и настроек из этого браузера в облако
      importLocal:function(){
        var body = { spaces:[], prefs:{} }, list = null;
        try{ list = JSON.parse(localStorage.getItem(LIST) || 'null'); }catch(e){}
        (list && list.list || []).forEach(function(m){
          var c = null; try{ c = JSON.parse(localStorage.getItem(PJ + m.id) || 'null'); }catch(e){}
          if(c) body.spaces.push({ id:m.id, name:m.name, env:m.env || 'code', content:c });
        });
        localAdapter.keys(P).forEach(function(k){
          if(k === LIST || k.indexOf(PJ) === 0 || k === P + 'graph') return;
          try{ body.prefs[k.slice(P.length)] = JSON.parse(localStorage.getItem(k)); }catch(e){}
        });
        return req('POST', '/import', body).then(function(r){ if(r.status >= 400) throw new Error('HTTP ' + r.status); return r.data; });
      },
      // правка коллеги пришла по WebSocket: сливаем с нашей (mineObj — текущее состояние на экране)
      remote:function(id, rev, theirsObj, mineObj){
        var sp = spaces[id];
        if(!sp){ spaces[id] = { id:id, name:'Пространство', env:'code', rev:rev, content:JSON.stringify(theirsObj), base:JSON.stringify(theirsObj) }; order.push(id); return theirsObj; }
        if(rev <= sp.rev) return null;
        var mine = mineObj || JSON.parse(sp.content), baseObj = JSON.parse(sp.base || '{}');
        var merged = merge3(baseObj, mine, theirsObj);
        sp.rev = rev; sp.base = JSON.stringify(theirsObj);
        var strip = function(o){ var c = JSON.parse(JSON.stringify(o)); delete c.cam; if(c.files){ delete c.files.open; delete c.files.active; } return JSON.stringify(c); };
        sp.content = JSON.stringify(merged);
        if(strip(merged) === strip(theirsObj)){ delete pending[PJ + id]; clearTimeout(timers[PJ + id]); }   // своих правок нет
        else queue(PJ + id, saveSpace(id), 300);                                                           // свои правки — дослать поверх
        return merged;
      },
      baseOf:function(id){ var sp = spaces[id]; return sp ? JSON.parse(sp.base || '{}') : null; },
      sid:null, onMerged:null,
      localCount:function(){
        try{ var l = JSON.parse(localStorage.getItem(LIST) || 'null'); return l && l.list ? l.list.filter(function(m){ var c = localStorage.getItem(PJ + m.id); return c && c.length > 60; }).length : 0; }catch(e){ return 0; }
      }
    };
    return adapter;
  }
  var LIVE_TAG = window.TRIOSTEUM_BOOT && window.TRIOSTEUM_BOOT.user ? '_' + Math.random().toString(36).slice(2, 5) : '';
  var SERVER = window.TRIOSTEUM_BOOT && window.TRIOSTEUM_BOOT.user ? serverAdapter(window.TRIOSTEUM_BOOT) : null;
  if(SERVER) Store.use(SERVER);
