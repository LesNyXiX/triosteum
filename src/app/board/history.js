  /* ---------- история: отменить / повторить ---------- */
  var hist = { undo:[], redo:[], last:null };
  function snap(){ return JSON.stringify({ nodes:G.nodes, edges:G.edges, notes:G.notes, seq:G.seq }); }
  function commitHist(){
    var s = snap();
    if(hist.last === null){ hist.last = s; return; }
    if(s !== hist.last){ hist.undo.push(hist.last); if(hist.undo.length > 150) hist.undo.shift(); hist.redo = []; hist.last = s; }
  }
  var saveGraphTimer = null;
  function saveGraph(){
    el.saved.textContent = 'сохраняется…';
    clearTimeout(saveGraphTimer);
    saveGraphTimer = setTimeout(function(){ saveGraphTimer = null; commitHist(); Repo.saveSpace(curId(), G); el.saved.textContent = 'сохранено'; }, 300);
  }
  function flushSave(){ if(saveGraphTimer){ clearTimeout(saveGraphTimer); saveGraphTimer = null; commitHist(); Repo.saveSpace(curId(), G); el.saved.textContent = 'сохранено'; } }
  function restoreSnap(s){
    var o = JSON.parse(s);
    G.nodes = o.nodes; G.edges = o.edges; G.notes = o.notes; G.seq = Math.max(G.seq, o.seq);
    S.sel = null; S.multi = []; hidePop(); renderGraph(); Repo.saveSpace(curId(), G);
  }
  function undo(){
    flushSave();
    if(!hist.undo.length){ toast('Нечего отменять'); return; }
    hist.redo.push(hist.last); hist.last = hist.undo.pop(); restoreSnap(hist.last); toast('Действие отменено');
  }
  function redo(){
    flushSave();
    if(!hist.redo.length){ toast('Нечего повторять'); return; }
    hist.undo.push(hist.last); hist.last = hist.redo.pop(); restoreSnap(hist.last); toast('Действие повторено');
  }
  function saveMy(){ save('triosteum.my', MY); }
