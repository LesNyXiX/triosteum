  /* ---------- резервные копии ----------
     Раз в день и перед каждой очисткой приложение само снимает копию всех данных этого браузера:
     пространства, файлы, темы, настройки. Ключи и пароли в копию не попадают.
     Копии лежат в IndexedDB (хранятся последние BK_MAX), любую можно вернуть, скачать файлом
     или загрузить из файла на другом компьютере. */
  var BK_MAX = 10, BK_DAY = 24 * 3600 * 1000;
  function bkDb(){ return window.__tsIDB && window.__tsIDB.ok ? window.__tsIDB.db : null; }
  function bkCollect(){
    var data = {};
    Store.keys('triosteum.').forEach(function(k){ if(idbSecret(k)) return; var v = Store.get(k, undefined); if(v !== undefined) data[k] = v; });
    return data;
  }
  function bkSize(data){ var n = 0; try { n = JSON.stringify(data).length; } catch(e){} return n; }
  function bkFmtSize(n){ return n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ'; }
  function bkFmtDate(t){ var d = new Date(t); return d.toLocaleDateString('ru-RU', { day:'numeric', month:'long' }) + ', ' + d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }); }
  function bkSpaces(data){ var l = data['triosteum.projects']; return l && l.list ? l.list.length : 0; }
  // список копий (без самих данных), новые сверху
  function bkList(cb){
    var db = bkDb(); if(!db) return cb([]);
    try {
      var out = [], rq = db.transaction('snaps', 'readonly').objectStore('snaps').openCursor();
      rq.onsuccess = function(){ var c = rq.result; if(c){ var v = c.value; if(String(v.id).indexOf('ver:') !== 0) out.push({ id:v.id, t:v.t, reason:v.reason, size:v.size, spaces:v.spaces }); c.continue(); } else cb(out.sort(function(a, b){ return b.t - a.t; })); };
      rq.onerror = function(){ cb([]); };
    } catch(e){ cb([]); }
  }
  function bkGet(id, cb){ var db = bkDb(); if(!db) return cb(null); try { var rq = db.transaction('snaps', 'readonly').objectStore('snaps').get(id); rq.onsuccess = function(){ cb(rq.result || null); }; rq.onerror = function(){ cb(null); }; } catch(e){ cb(null); } }
  function bkDel(id, cb){ var db = bkDb(); if(!db) return cb && cb(); try { var t = db.transaction('snaps', 'readwrite'); t.objectStore('snaps').delete(id); t.oncomplete = t.onerror = function(){ if(cb) cb(); }; } catch(e){ if(cb) cb(); } }
  // снять копию сейчас; reason — откуда («Ежедневная», «Перед очисткой: …», «Вручную»)
  function backupNow(reason, cb){
    var db = bkDb(); if(!db){ if(cb) cb(false); return; }
    if(typeof stashCur === 'function') try { stashCur(); } catch(e){}
    var data = bkCollect(), t = Date.now(), snap = { id:'b' + t.toString(36), t:t, reason:reason || 'Вручную', data:data, size:bkSize(data), spaces:bkSpaces(data) };
    try {
      var tx = db.transaction('snaps', 'readwrite'); tx.objectStore('snaps').put(snap);
      tx.oncomplete = function(){ save('triosteum.backup.last', t); bkPrune(function(){ if(cb) cb(true); }); };
      tx.onerror = tx.onabort = function(){ if(cb) cb(false); };
    } catch(e){ if(cb) cb(false); }
  }
  function bkPrune(cb){ bkList(function(l){ var old = l.slice(BK_MAX), n = old.length; if(!n) return cb(); old.forEach(function(s){ bkDel(s.id, function(){ if(--n === 0) cb(); }); }); }); }
  // вернуть данные из копии: текущие сначала сохраняются копией «Перед восстановлением»
  function bkApply(data, label){
    backupNow('Перед восстановлением', function(){
      Store.keys('triosteum.').forEach(function(k){ if(!idbSecret(k) && k !== 'triosteum.backup.last' && !(k in data)) Store.remove(k); });
      Object.keys(data).forEach(function(k){ if(!idbSecret(k) && /^triosteum\./.test(k)) Store.set(k, data[k]); });
      // до перезапуска приложение больше ничего не пишет — иначе при выгрузке оно сохранило бы старую доску поверх копии
      Store.set = Store.remove = function(){};
      toast('Данные возвращены из копии «' + label + '» — перезапускаю…');
      setTimeout(function(){ location.reload(); }, 700);
    });
  }
  function bkRestore(id){
    bkGet(id, function(s){
      if(!s || !s.data) return toast('Копия не найдена');
      askConfirm('Вернуть данные из копии?', 'Пространства и настройки станут такими, как ' + bkFmtDate(s.t) + '. Нынешние данные не пропадут: перед этим снимется ещё одна копия.', 'Вернуть', function(){ bkApply(s.data, bkFmtDate(s.t)); });
    });
  }
  function bkFileOf(data, t){ return { app:'triosteum', kind:'backup', v:1, t:t || Date.now(), data:data }; }
  function bkDownload(obj){
    var name = 'triosteum-копия-' + new Date(obj.t).toISOString().slice(0, 16).replace(/[T:]/g, '-') + '.json';
    var url = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type:'application/json' }));
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  }
  function bkDownloadNow(){ if(typeof stashCur === 'function') try { stashCur(); } catch(e){} bkDownload(bkFileOf(bkCollect())); }
  function bkUpload(){
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.addEventListener('change', function(){
      var f = inp.files && inp.files[0]; if(!f) return;
      var rd = new FileReader();
      rd.onload = function(){
        var o = null; try { o = JSON.parse(rd.result); } catch(e){}
        if(!o || o.app !== 'triosteum' || o.kind !== 'backup' || !o.data || typeof o.data !== 'object') return toast('Это не файл резервной копии Triosteum');
        askConfirm('Загрузить данные из файла?', 'Пространства и настройки станут как в файле от ' + bkFmtDate(o.t) + '. Нынешние данные перед этим сохранятся копией.', 'Загрузить', function(){ bkApply(o.data, 'файл от ' + bkFmtDate(o.t)); });
      };
      rd.readAsText(f);
    });
    inp.click();
  }
  // раздел в Персонализации
  function backupsSection(){
    var box = h('div', { 'class':'bk-box' }), list = h('div', { 'class':'bk-list' });
    var bar = h('div', { 'class':'bk-bar' }, [
      h('button', { type:'button', 'class':'btn sm', text:'Сделать копию сейчас', disabled:bkDb() ? null : 'disabled', on:{ click:function(){ backupNow('Вручную', function(ok){ toast(ok ? 'Копия сохранена' : 'Не удалось сохранить копию'); fill(); }); } } }),
      h('button', { type:'button', 'class':'btn sm', text:'Скачать всё файлом', on:{ click:bkDownloadNow } }),
      h('button', { type:'button', 'class':'btn sm', text:'Загрузить из файла', on:{ click:bkUpload } })
    ]);
    box.appendChild(bar); box.appendChild(list);
    function fill(){
      list.innerHTML = '';
      if(!bkDb()){ list.appendChild(h('p', { 'class':'bk-empty', text:'Браузер не дал место для копий (например, приватный режим). Скачивайте данные файлом.' })); return; }
      bkList(function(l){
        list.innerHTML = '';
        if(!l.length){ list.appendChild(h('p', { 'class':'bk-empty', text:'Копий пока нет. Первая появится сама в течение минуты, дальше — раз в день и перед каждой очисткой.' })); return; }
        l.forEach(function(s){
          list.appendChild(h('div', { 'class':'bk-row' }, [
            h('div', { 'class':'bk-t' }, [ h('b', { text:bkFmtDate(s.t) }), h('small', { text:s.reason + ' · ' + (s.spaces || 0) + ' простр. · ' + bkFmtSize(s.size || 0) }) ]),
            h('button', { type:'button', 'class':'btn sm', text:'Вернуть', 'aria-label':'Вернуть копию от ' + bkFmtDate(s.t), on:{ click:function(){ bkRestore(s.id); } } }),
            h('button', { type:'button', 'class':'icon-btn', title:'Скачать файлом', 'aria-label':'Скачать копию от ' + bkFmtDate(s.t), html:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>', on:{ click:function(){ bkGet(s.id, function(x){ if(x) bkDownload(bkFileOf(x.data, x.t)); }); } } }),
            h('button', { type:'button', 'class':'icon-btn', title:'Удалить копию', 'aria-label':'Удалить копию от ' + bkFmtDate(s.t), html:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>', on:{ click:function(){ bkDel(s.id, fill); } } })
          ]));
        });
      });
    }
    fill();
    return box;
  }
  // перед любой очисткой — полная копия (в дополнение к быстрому «Вернуть»)
  (function(){
    if(typeof clrBackup !== 'function') return;
    var _clr = clrBackup;
    clrBackup = function(label, ids, ui){ backupNow('Перед очисткой: ' + label); return _clr.apply(this, arguments); };
  })();
  // ежедневная копия: через полминуты после запуска, если последней больше суток
  setTimeout(function(){ if(!PANE && bkDb() && Date.now() - (load('triosteum.backup.last', 0) || 0) > BK_DAY) backupNow('Ежедневная'); }, 30000);
  if(window.__tsRestored) setTimeout(function(){ toast('localStorage браузера был очищен — данные возвращены из внутренней копии'); }, 1200);
