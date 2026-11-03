  /* ---------- слияние одновременных правок (трёхстороннее) ---------- */
  // base — версия, от которой оба начали; mine — наша; theirs — пришла с сервера.
  // Правило: изменения разных объектов и разных свойств складываются. Если одно и то же свойство
  // изменили оба — побеждает наше (оно сохраняется позже). Списки объектов с id (блоки, связи,
  // заметки, файлы) сливаются по id: добавленное с обеих сторон остаётся, удалённое — удаляется,
  // но если объект удалили с одной стороны, а изменили с другой — он остаётся.
  // Личные настройки вида (камера, открытые вкладки) не синхронизируются: всегда наши.
  var MERGE_LOCAL = { 'cam':1, 'files.open':1, 'files.active':1 };
  function mEq(a, b){ return a === b || JSON.stringify(a) === JSON.stringify(b); }
  function mObj(x){ return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function mIdList(x){ return Array.isArray(x) && x.length > 0 && x.every(function(v){ return mObj(v) && typeof v.id === 'string'; }); }
  function merge3(base, mine, theirs, path){
    path = path || '';
    if(MERGE_LOCAL[path]) return mine === undefined ? theirs : mine;
    if(mEq(mine, theirs)) return mine;
    if(mEq(base, mine)) return theirs;
    if(mEq(base, theirs)) return mine;
    if(path === 'seq') return Math.max(Number(mine) || 0, Number(theirs) || 0);
    if(mObj(mine) && mObj(theirs)){
      var b = mObj(base) ? base : {}, out = {}, keys = {};
      Object.keys(mine).concat(Object.keys(theirs), Object.keys(b)).forEach(function(k){ keys[k] = 1; });
      Object.keys(keys).forEach(function(k){
        var inM = k in mine, inT = k in theirs, inB = k in b, p = path ? path + '.' + k : k;
        if(!inM && !inT) return;
        if(!inM){ if(inB && mEq(b[k], theirs[k])) return; out[k] = theirs[k]; return; }   // мы удалили, они не трогали — удалено
        if(!inT){ if(inB && mEq(b[k], mine[k])) return; out[k] = mine[k]; return; }       // они удалили, мы не трогали
        out[k] = merge3(inB ? b[k] : undefined, mine[k], theirs[k], p);
      });
      return out;
    }
    var bl = Array.isArray(base) ? base : [];
    if((mIdList(mine) || mine && mine.length === 0) && (mIdList(theirs) || theirs && theirs.length === 0) && Array.isArray(mine) && Array.isArray(theirs) && (mine.length || theirs.length)){
      var byB = {}, byM = {}, res = [], seen = {};
      bl.forEach(function(v){ if(mObj(v) && v.id) byB[v.id] = v; });
      mine.forEach(function(v){ byM[v.id] = v; });
      function take(id, m, t){
        if(seen[id]) return; seen[id] = 1;
        var bb = byB[id];
        if(m && t){ res.push(merge3(bb, m, t, path + '[]')); return; }
        if(m && !t){ if(bb && mEq(bb, m)) return; res.push(m); return; }   // они удалили; мы не меняли — удаляем
        if(t && !m){ if(bb && mEq(bb, t)) return; res.push(t); return; }   // мы удалили; они не меняли — удаляем
      }
      var byT = {}; theirs.forEach(function(v){ byT[v.id] = v; });
      theirs.forEach(function(v){ take(v.id, byM[v.id], v); });
      mine.forEach(function(v){ take(v.id, v, byT[v.id]); });
      return res;
    }
    return mine;                                                            // одно и то же изменили оба — наше
  }
