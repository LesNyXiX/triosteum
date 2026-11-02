  /* ---------- хранилище: единая точка доступа к данным ---------- */
  // Весь код читает и пишет данные только через Store и Repo.
  // Сейчас данные лежат в браузере (localStorage). Для перехода на сервер достаточно
  // написать адаптер с теми же методами и вызвать Store.use(адаптер) — остальной код не меняется.
  //
  // Адаптер — объект с методами:
  //   get(key) → строка или null;  set(key, строка) → true/false;  remove(key);
  //   keys(prefix) → массив ключей;  watch(fn) — fn(key, новаяСтрока) при изменении извне (другая вкладка, сервер).
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
  var Store = (function(){
    var ad = localAdapter, subs = [], warned = 0;
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
  // короткие имена для настроек; полный ключ — 'triosteum.<имя>'
  function load(k, d){ return Store.get(k, d); }
  function save(k, v){ Store.set(k, v); }
