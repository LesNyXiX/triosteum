  /* ---------- хранилище: единая точка доступа к данным ---------- */
  // Весь код читает и пишет данные только через Store и Repo.
  // Сейчас данные лежат в браузере (localStorage). Для перехода на сервер достаточно
  // написать адаптер с теми же методами и вызвать Store.use(адаптер) — остальной код не меняется.
  //
  // Адаптер — объект с методами:
  //   get(key) → строка или null;  set(key, строка) → true/false;  remove(key);
  //   keys(prefix) → массив ключей;  watch(fn) — fn(key, новаяСтрока) при изменении извне (другая вкладка, сервер).
  // вторая среда рядом: этот же Triosteum, открытый в окне главного (index.html?pane=<id пространства>)
  var PANE = (function(){ try { var m = /[?&]pane=([^&#]+)/.exec(location.search); return m && window.parent !== window ? decodeURIComponent(m[1]) : null; } catch(e){ return null; } })();
  if(PANE) document.documentElement.classList.add('in-pane');
  var localAdapter = {
    name:'local',
    get:function(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
    set:function(k, v){ try{ localStorage.setItem(k, v); return true; }catch(e){ return false; } },
    remove:function(k){ try{ localStorage.removeItem(k); }catch(e){} },
    keys:function(prefix){
      var out = [];
      try{ for(var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if(k && (!prefix || k.indexOf(prefix) === 0)) out.push(k); } }catch(e){}
      return out;
    },
    watch:function(fn){
      window.addEventListener('storage', function(e){ try{ if(e.key && e.storageArea === localStorage) fn(e.key, e.newValue); }catch(x){} });
    }
  };
  // localStorage + копия в IndexedDB (см. idb-boot.js). Что не влезло в localStorage — хранится только в IndexedDB.
  // Ключи и пароли в копию не попадают: они остаются только в этом браузере, как и раньше.
  function idbSecret(k){ return /^triosteum\.(secrets|claude\.key|ai\.key\.|claude\.on)/.test(k); }
  var IDBK = (function(){
    var I = window.__tsIDB || {}, chan = null;
    try { chan = new BroadcastChannel('triosteum-idb'); } catch(e){}
    function tx(fn){ try { var db = (window.__tsIDB || {}).db; if(!db) return; var t = db.transaction('kv', 'readwrite'); fn(t.objectStore('kv')); } catch(e){} }
    return {
      on:function(){ return !!(window.__tsIDB && window.__tsIDB.ok); },
      map:function(){ return (window.__tsIDB && window.__tsIDB.map) || {}; },
      put:function(k, v){ if(idbSecret(k)) return; this.map()[k] = v; tx(function(st){ st.put(v, k); }); },
      del:function(k){ delete this.map()[k]; tx(function(st){ st.delete(k); }); },
      chan:chan
    };
  })();
  var idbAdapter = {
    name:'local',
    get:function(k){ var v = localAdapter.get(k); if(v != null) return v; var m = IDBK.map(); return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    set:function(k, v){
      var ok = localAdapter.set(k, v);
      if(!IDBK.on() || idbSecret(k)) return ok;
      IDBK.put(k, v);
      if(!ok){ localAdapter.remove(k); if(IDBK.chan) try { IDBK.chan.postMessage({ k:k, v:v }); } catch(e){} }   // не влезло — живёт только в IndexedDB; другим вкладкам сообщаем сами
      return true;
    },
    remove:function(k){ localAdapter.remove(k); if(IDBK.on()){ IDBK.del(k); if(IDBK.chan) try { IDBK.chan.postMessage({ k:k, v:null }); } catch(e){} } },
    keys:function(prefix){
      var out = localAdapter.keys(prefix), seen = {};
      out.forEach(function(k){ seen[k] = 1; });
      Object.keys(IDBK.map()).forEach(function(k){ if(!seen[k] && (!prefix || k.indexOf(prefix) === 0)) out.push(k); });
      return out;
    },
    watch:function(fn){
      // другая вкладка записала в localStorage — обновляем и свою копию в памяти
      localAdapter.watch(function(k, v){ var m = IDBK.map(); if(v == null) delete m[k]; else if(!idbSecret(k)) m[k] = v; fn(k, v); });
      if(IDBK.chan) IDBK.chan.onmessage = function(e){ var d = e.data || {}; if(!d.k) return; var m = IDBK.map(); if(d.v == null) delete m[d.k]; else m[d.k] = d.v; fn(d.k, d.v); };
    }
  };
  // localStorage потерялся (очистка браузера, сбой) — возвращаем данные из копии
  (function restoreFromIdb(){
    if(!IDBK.on()) return;
    var m = IDBK.map(), back = 0;
    Object.keys(m).forEach(function(k){ if(localAdapter.get(k) == null && localAdapter.set(k, m[k])) back++; });
    // и наоборот: то, что есть только в localStorage (записано до появления копии), кладём в копию
    localAdapter.keys('triosteum.').forEach(function(k){ if(!idbSecret(k) && !Object.prototype.hasOwnProperty.call(m, k)){ var v = localAdapter.get(k); if(v != null) IDBK.put(k, v); } });
    if(back) window.__tsRestored = back;
  })();
  var Store = (function(){
    var ad = IDBK.on() ? idbAdapter : localAdapter, subs = [], warned = 0;
    function fail(){
      // браузер не дал записать (закончилось место или запрещено хранилище) — сообщаем, но не чаще раза в минуту
      if(Date.now() - warned < 60000) return; warned = Date.now();
      setTimeout(function(){ if(typeof toast === 'function' && el && el.toast) toast('Не удалось сохранить: в браузере закончилось место для данных. Удалите лишние пространства или картинки'); }, 0);
    }
    var api = {
      get:function(k, d){ var raw = ad.get(k); if(raw == null) return d; try{ return JSON.parse(raw); }catch(e){ return d; } },
      set:function(k, v){ if(!ad.set(k, JSON.stringify(v))) fail(); },
      remove:function(k){ ad.remove(k); },
      keys:function(prefix){ return ad.keys(prefix); },
      // fn(key, значение) — данные изменились извне; значение уже разобрано (null — ключ удалён)
      watch:function(fn){ subs.push(fn); },
      use:function(adapter){ ad = adapter; ad.watch(emit); },
      adapter:function(){ return ad.name; }
    };
    function emit(k, raw){ var v = null; try{ v = raw == null ? null : JSON.parse(raw); }catch(e){ return; } subs.forEach(function(fn){ fn(k, v); }); }
    ad.watch(emit);
    return api;
  })();
  // Что именно хранится. Сервер должен уметь то же самое — это и есть будущий API:
  //   список пространств, содержимое пространства, удаление, личные настройки.
  var KEY = 'triosteum.';
  var Repo = {
    spaceList:function(){ return Store.get(KEY + 'projects', null); },
    saveSpaceList:function(v){ Store.set(KEY + 'projects', v); },
    space:function(id){ return Store.get(KEY + 'proj.' + id, null); },
    saveSpace:function(id, g){ Store.set(KEY + 'proj.' + id, g); },
    removeSpace:function(id){ Store.remove(KEY + 'proj.' + id); },
    isSpaceKey:function(k, id){ return k === KEY + 'proj.' + id; },
    isSpaceListKey:function(k){ return k === KEY + 'projects'; },
    // личные настройки пользователя: тема, окна, последние языки, свои плагины и т. п.
    pref:function(name, d){ return Store.get(KEY + name, d); },
    setPref:function(name, v){ Store.set(KEY + name, v); }
  };
  // во второй среде своё «текущее пространство» живёт только в памяти: главное окно после перезагрузки откроет своё
  if(PANE){ var _saveList = Repo.saveSpaceList; Repo.saveSpaceList = function(v){ var st = Store.get(KEY + 'projects', null), cp = JSON.parse(JSON.stringify(v)); if(st && st.cur) cp.cur = st.cur; _saveList(cp); }; }
  // короткие имена для настроек; полный ключ — 'triosteum.<имя>'
  function load(k, d){ return Store.get(k, d); }
  function save(k, v){ Store.set(k, v); }
