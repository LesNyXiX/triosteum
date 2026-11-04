  // ---------- файлы: сохранить / открыть / картинка ----------
  // имя файла латиницей: некоторые браузеры отбрасывают кириллицу в имени скачиваемого файла
  var TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  function fileBase(s, def){ var t = String(s || '').toLowerCase().split('').map(function(c){ return TR[c] !== undefined ? TR[c] : c; }).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return t || def; }
  // в claude.ai файл отдаётся через безопасное окно подтверждения; вне его — обычной ссылкой
  var dlApi = null, dlReady = (window.claude && window.claude.use) ? window.claude.use('downloads').then(function(d){ dlApi = d; return d; }, function(){ return null; }) : Promise.resolve(null);
  function download(name, text, type, okMsg){
    var blob = new Blob([text], { type:type });
    function plain(){
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      toast(okMsg);
    }
    if(!(window.claude && window.claude.use)){ plain(); return; }
    dlReady.then(function(d){
      if(!d){ toast('Сохранение файла недоступно в этом окне — используйте «Скопировать схему (JSON)»'); return; }
      d.save({ filename:name, data:blob }).then(function(r){ if(r && r.status === 'saved') toast(okMsg); }, function(err){
        var c = err && err.code;
        if(c === 'declined') toast('Сохранение отменено');
        else if(c === 'rate_limited') toast('Окно сохранения уже открыто — подтвердите его');
        else toast('Не удалось сохранить файл — используйте «Скопировать схему (JSON)»');
      });
    });
  }
  function exportFile(){
    flushSave();
    var used = {}; G.nodes.forEach(function(n){ if(n.pluginId) used[n.pluginId] = 1; });
    if(typeof ofCommit === 'function' && ENV.office) ofCommit();
    var data = { app:'Triosteum', format:2, kind:'space', env:ENV.id, name:curProj().name, exported:new Date().toISOString(), graph:G,
      plugins:MY.filter(function(p){ return used[p.id]; }) };
    download(fileBase(curProj().name, 'prostranstvo') + '.tsm', JSON.stringify(data), TSM_MIME, 'Файл пространства сохранён (.tsm) — откройте его в любом Triosteum');
  }
  var TSM_MIME = 'application/x-triosteum';
  // .tsm — собственный формат Triosteum: пространство целиком, набор файлов или блоки доски
  function exportTsmFiles(files, name){
    files = files.filter(function(f){ return f && f.type !== 'folder'; }); if(!files.length){ toast('Нечего сохранять'); return; }
    if(typeof ofCommit === 'function') ofCommit();
    var notes = typeof fmNotes === 'function' ? fmNotes().filter(function(t){ return files.some(function(f){ return f.id === t.attach; }); }) : [];
    var data = { app:'Triosteum', format:2, kind:'files', env:ENV.id, name:name || files[0].name, exported:new Date().toISOString(), files:JSON.parse(JSON.stringify(files)), notes:notes };
    download(fileBase(name || files[0].name, 'fayly') + '.tsm', JSON.stringify(data), TSM_MIME, (files.length === 1 ? 'Файл «' + files[0].name + '»' : 'Файлов: ' + files.length) + ' сохранено в .tsm');
  }
  function exportTsmBlocks(){
    var items = S.multi && S.multi.length ? S.multi : (S.sel ? [S.sel] : []);
    if(!items.length){ toast('Выделите блоки, чтобы сохранить их в .tsm'); return; }
    copySel(); if(!clip) return;
    var data = { app:'Triosteum', format:2, kind:'blocks', env:ENV.id, envName:ENV.name, name:curProj().name, t:Date.now(), proj:'file', projName:curProj().name, nodes:clip.portable.nodes, notes:clip.portable.notes, edges:clip.portable.edges, portable:clip.portable };
    download(fileBase(curProj().name, 'bloki') + '-bloki.tsm', JSON.stringify(data), TSM_MIME, 'Блоки сохранены в .tsm — откройте файл в любом пространстве');
  }
  function importTsmFiles(o){
    var files = o.files || []; if(!files.length){ toast('В файле .tsm нет файлов'); return; }
    if(!(typeof ENV !== 'undefined' && ENV.office)){
      var env = ENVS[o.env] && ENVS[o.env].office ? o.env : 'docs';
      newProj(o.name || 'Файлы', { nodes:[], edges:[], notes:[], seq:1, cam:{ x:0, y:0, k:1 }, files:{ items:[], open:[], active:'desk' } }, env);
    }
    var map = {};
    files.forEach(function(x){ var c = JSON.parse(JSON.stringify(x)); map[x.id] = c.id = ofId(); c.parent = OF.dir || null; c.name = ofUnique(c.name, c.parent); var sp = ofFreeSpot(c.parent); c.x = sp.x; c.y = sp.y; delete c.map; ofItems().push(c); });
    // связи внутри набора сохраняются: ссылки на старые id переводим на новые
    ofItems().forEach(function(f){ if(!map[Object.keys(map).filter(function(k){ return map[k] === f.id; })[0]]) return; var s = JSON.stringify(f.data); Object.keys(map).forEach(function(k){ s = s.split(k).join(map[k]); }); f.data = JSON.parse(s); });
    (o.notes || []).forEach(function(t){ if(map[t.attach]){ var c = JSON.parse(JSON.stringify(t)); c.id = 'mn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); c.attach = map[t.attach]; fmNotes().push(c); } });
    saveGraph(); ofRender(); toast('Открыто из .tsm: файлов ' + files.length);
  }
  var fileIn = document.createElement('input');
  fileIn.type = 'file'; fileIn.accept = '.tsm,.json,application/json'; fileIn.hidden = true; document.body.appendChild(fileIn);
  fileIn.addEventListener('change', function(){ var f = fileIn.files[0]; if(f) importFile(f); fileIn.value = ''; });
  function importFile(f){
    f.text().then(function(txt){
      var o = JSON.parse(txt);
      if(o && o.kind === 'files'){ importTsmFiles(o); return; }
      if(o && o.kind === 'blocks'){ o.t = Date.now(); clip = o; if(typeof officeOn === 'function' && officeOn()) officePasteBlocks(o); else pasteClip(); return; }
      var g = o.graph || (o.nodes ? o : null);
      if(!g || !Array.isArray(g.nodes)) throw new Error('format');
      (o.plugins || []).forEach(function(p){ if(p && p.id && !pluginById(p.id)){ p.my = true; if(!p.codes) p.codes = {}; MY.push(p); } });
      saveMy(); renderChips(); renderList();
      var name = o.name || f.name.replace(/\.triosteum\.json$|\.json$|\.tsm$/i, '');
      newProj(name, g, ENVS[o.env] ? o.env : (g.nodes.some(function(n){ return ['doc', 'sheet', 'step', 'cond', 'send'].indexOf(n.lang) >= 0; }) ? 'docs' : 'code'));
      setTimeout(fitView, 30);
      toast('Открыто пространство «' + curProj().name + '»');
    }).catch(function(){ toast('Не удалось открыть: нужен файл Triosteum (.tsm или .json)'); });
  }
  el.canvas.addEventListener('dragover', function(e){ if(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0){ e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  el.canvas.addEventListener('drop', function(e){
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if(!f) return; e.preventDefault();
    if(/\.(json|tsm)$/i.test(f.name)) importFile(f); else if(/^image\//.test(f.type)) boardPasteImage(f, 0); else toast('Перетащите файл Triosteum (.tsm) или картинку');
  });
  function exportSvg(){
    var xs = [], ys = [];
    G.nodes.forEach(function(n){ xs.push(n.x - 40, n.x + NWof(n) + 40); ys.push(n.y - 30, n.y + NHof(n) + 30); });
    G.notes.forEach(function(t){ if(t.hidden) return; var d = domOf('note', t.id); xs.push(t.x - 10, t.x + (d ? d.offsetWidth : 160) + 10); ys.push(t.y - 10, t.y + (d ? d.offsetHeight : 40) + 10); });
    if(!xs.length){ toast('На доске пусто'); return; }
    var x0 = Math.min.apply(0, xs), y0 = Math.min.apply(0, ys), W = Math.max.apply(0, xs) - x0, H = Math.max.apply(0, ys) - y0;
    var cs = getComputedStyle(document.documentElement), v = function(k){ return cs.getPropertyValue(k).trim(); };
    var esc = function(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(W) + '" height="' + Math.round(H) + '" viewBox="' + x0 + ' ' + y0 + ' ' + W + ' ' + H + '" font-family="Inter,Segoe UI,Arial,sans-serif">',
      '<rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + H + '" fill="' + v('--bg') + '"/>'];
    // связи берём прямо из слоя доски — так картинка совпадает с экраном
    Array.prototype.forEach.call(el.world.querySelectorAll('#edgeLayer path, #edgeLive path'), function(p){
      var st = getComputedStyle(p);
      if(p.classList.contains('edge-hit') || st.display === 'none' || st.stroke === 'none' || +st.strokeOpacity === 0 || st.visibility === 'hidden') return;
      out.push('<path d="' + p.getAttribute('d') + '" fill="none" stroke="' + st.stroke + '" stroke-width="' + st.strokeWidth + '" stroke-linecap="round"' + (st.strokeDasharray && st.strokeDasharray !== 'none' ? ' stroke-dasharray="' + st.strokeDasharray + '"' : '') + '/>');
    });
    G.notes.forEach(function(t){
      if(t.hidden) return; var d = domOf('note', t.id), w = d ? d.offsetWidth : 160, hh = d ? d.offsetHeight : 40;
      out.push('<rect x="' + t.x + '" y="' + t.y + '" width="' + w + '" height="' + hh + '" rx="8" fill="' + v('--panel') + '" stroke="' + v('--line2') + '"/>');
      String(t.text || '').split('\n').slice(0, 12).forEach(function(line, i){ out.push('<text x="' + (t.x + 10) + '" y="' + (t.y + 20 + i * 18) + '" font-size="' + Math.min(noteFs(t), 16) + '" fill="' + v('--ink') + '">' + esc(line.slice(0, 60)) + '</text>'); });
    });
    G.nodes.forEach(function(n){
      var c = colorsOf(n), id = 'g' + n.id, w = NWof(n), hh = NHof(n), l = langById(n.lang);
      out.push('<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient></defs>');
      if(n.kind === 'hub'){
        out.push('<circle cx="' + (n.x + w / 2) + '" cy="' + (n.y + hh / 2) + '" r="' + (w / 2 - 1) + '" fill="' + v('--panel') + '" stroke="url(#' + id + ')" stroke-width="2.5"/>');
        out.push('<text x="' + (n.x + w / 2) + '" y="' + (n.y + hh + 16) + '" text-anchor="middle" font-size="12" font-weight="600" fill="' + v('--ink-strong') + '">' + esc(n.name) + '</text>');
      } else {
        out.push('<rect x="' + (n.x + 1) + '" y="' + (n.y + 1) + '" width="' + (w - 2) + '" height="' + (hh - 2) + '" rx="12" fill="' + v('--panel') + '" stroke="url(#' + id + ')" stroke-width="2"/>');
        out.push('<rect x="' + (n.x + 12) + '" y="' + (n.y + 14) + '" width="10" height="10" rx="3" fill="url(#' + id + ')"/>');
        out.push('<text x="' + (n.x + 28) + '" y="' + (n.y + 23) + '" font-size="11" font-weight="600" fill="' + v('--muted') + '">' + esc(shortName(l).toUpperCase()) + '</text>');
        out.push('<text x="' + (n.x + 12) + '" y="' + (n.y + 46) + '" font-size="14" font-weight="600" fill="' + v('--ink-strong') + '">' + esc(n.name.length > 24 ? n.name.slice(0, 23) + '…' : n.name) + '</text>');
        if(n.desc) out.push('<text x="' + (n.x + 12) + '" y="' + (n.y + 66) + '" font-size="11.5" fill="' + v('--dim') + '">' + esc(n.desc.length > 30 ? n.desc.slice(0, 29) + '…' : n.desc) + '</text>');
      }
    });
    out.push('</svg>');
    download(fileBase(curProj().name, 'shema') + '.svg', out.join('\n'), 'image/svg+xml', 'Картинка схемы сохранена (SVG)');
  }
