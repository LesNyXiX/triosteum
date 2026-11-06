/* ---------- запуск: сначала поднимаем копию данных из IndexedDB ----------
   localStorage маленький (около 5–10 МБ) и иногда теряется. Поэтому всё, что приложение
   сохраняет, дублируется в IndexedDB, а то, что не влезло в localStorage, живёт только там.
   Перед стартом приложения копия читается в память — дальше всё работает синхронно, как раньше.
   Если IndexedDB недоступна (приватный режим, запрет браузера), приложение просто стартует без неё. */
(function(){
  var DB = 'triosteum', KV = 'kv', SNAPS = 'snaps';
  window.__tsIDB = { db:null, map:null, ok:false };
  window.__tsBoot = function(start){
    var done = false;
    function go(){ if(done) return; done = true; start(); }
    var timer = setTimeout(go, 1500);                     // не ждём вечно: зависшая база не должна мешать работе
    try {
      if(!window.indexedDB){ clearTimeout(timer); return go(); }
      var rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = function(){ var db = rq.result; if(!db.objectStoreNames.contains(KV)) db.createObjectStore(KV); if(!db.objectStoreNames.contains(SNAPS)) db.createObjectStore(SNAPS, { keyPath:'id' }); };
      rq.onerror = rq.onblocked = function(){ clearTimeout(timer); go(); };
      rq.onsuccess = function(){
        var db = rq.result, map = {};
        try {
          var cur = db.transaction(KV, 'readonly').objectStore(KV).openCursor();
          cur.onsuccess = function(){ var c = cur.result; if(c){ if(typeof c.value === 'string') map[c.key] = c.value; c.continue(); } else { window.__tsIDB = { db:db, map:map, ok:true }; clearTimeout(timer); go(); } };
          cur.onerror = function(){ clearTimeout(timer); go(); };
        } catch(e){ clearTimeout(timer); go(); }
      };
    } catch(e){ clearTimeout(timer); go(); }
  };
})();
