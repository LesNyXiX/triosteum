  /* ---------- редактор таблицы ---------- */
  var SHP = { d:null, sel:{ c:0, r:1 }, timer:null };
  function loadSheetPane(){ SHP.d = parseSheet(getCode()); SHP.sel = { c:0, r:Math.min(1, SHP.d.rows.length - 1) }; renderSheetPane(); sheetInfo(); }
  function saveSheetSoon(){ clearTimeout(SHP.timer); SHP.timer = setTimeout(function(){ setCode(JSON.stringify({ rows:SHP.d.rows })); var n = docNode(); if(n) refreshNode(n); }, 300); }
  function renderSheetPane(focus){
    var d = SHP.d, rows = d.rows, w = rows[0].length, vals = computeSheet(rows), t = $('sheetGrid');
    var html = '<thead><tr><th class="corner"></th>';
    for(var c = 0; c < w; c++) html += '<th scope="col">' + colName(c) + '</th>';
    html += '</tr></thead><tbody>';
    rows.forEach(function(row, r){
      html += '<tr' + (r === 0 ? ' class="hdr"' : '') + '><th scope="row">' + (r + 1) + '</th>';
      row.forEach(function(raw, c){
        var v = vals[r][c], isF = typeof raw === 'string' && raw.charAt(0) === '=', isN = typeof v === 'number';
        html += '<td><input data-c="' + c + '" data-r="' + r + '" class="' + (isN ? 'n' : '') + (isF ? ' f' : '') + (String(v).charAt(0) === '#' ? ' e' : '') + '" value="' + escHtml(fmtCell(v)) + '" aria-label="' + colName(c) + (r + 1) + '" spellcheck="false"></td>';
      });
      html += '</tr>';
    });
    t.innerHTML = html + '</tbody>';
    markSel();
    if(focus){ var i = cellInput(SHP.sel.c, SHP.sel.r); if(i) i.focus(); }
  }
  function cellInput(c, r){ return $('sheetGrid').querySelector('input[data-c="' + c + '"][data-r="' + r + '"]'); }
  function markSel(){
    $('fxRef').textContent = colName(SHP.sel.c) + (SHP.sel.r + 1);
    var raw = (SHP.d.rows[SHP.sel.r] || [])[SHP.sel.c]; $('fxIn').value = raw === undefined ? '' : raw;
    Array.prototype.forEach.call($('sheetGrid').querySelectorAll('td.on'), function(x){ x.classList.remove('on'); });
    var i = cellInput(SHP.sel.c, SHP.sel.r); if(i) i.parentNode.classList.add('on');
  }
  function refreshVals(){
    var vals = computeSheet(SHP.d.rows);
    Array.prototype.forEach.call($('sheetGrid').querySelectorAll('input'), function(i){
      var c = +i.dataset.c, r = +i.dataset.r; if(i === document.activeElement) return;
      var v = vals[r][c], raw = SHP.d.rows[r][c];
      i.value = fmtCell(v); i.className = (typeof v === 'number' ? 'n' : '') + (typeof raw === 'string' && raw.charAt(0) === '=' ? ' f' : '') + (String(v).charAt(0) === '#' ? ' e' : '');
    });
  }
  function sheetInfo(){
    var d = SHP.d, vals = computeSheet(d.rows), f = 0, err = 0;
    d.rows.forEach(function(r, ri){ r.forEach(function(x, ci){ if(typeof x === 'string' && x.charAt(0) === '='){ f++; if(String(vals[ri][ci]).charAt(0) === '#') err++; } }); });
    el.out.textContent = '';
    print('> Таблица: ' + (d.rows.length - 1) + ' строк данных, ' + d.rows[0].length + ' столбцов, формул: ' + f + (err ? ', с ошибками: ' + err : ''), err ? 'warn' : 'ok');
    print('> Первая строка — заголовки: ' + vals[0].join(' · '), 'dim');
    print('> Формулы как в Excel: =B2*C2, =SUM(D2:D9) или =СУММ(D2:D9), =ROUND(…;1), =IF(B2>100;"да";"нет"), %', 'dim');
  }
  (function sheetEvents(){
    var g = $('sheetGrid');
    g.addEventListener('focusin', function(e){
      var i = e.target; if(i.tagName !== 'INPUT') return;
      SHP.sel = { c:+i.dataset.c, r:+i.dataset.r }; i.value = SHP.d.rows[SHP.sel.r][SHP.sel.c]; markSel(); setTimeout(function(){ try{ i.select(); }catch(x){} }, 0);
    });
    g.addEventListener('input', function(e){ var i = e.target; SHP.d.rows[+i.dataset.r][+i.dataset.c] = i.value; $('fxIn').value = i.value; saveSheetSoon(); });
    g.addEventListener('focusout', function(e){ if(e.target.tagName === 'INPUT') setTimeout(refreshVals, 0); });
    g.addEventListener('keydown', function(e){
      var i = e.target; if(i.tagName !== 'INPUT') return;
      var c = +i.dataset.c, r = +i.dataset.r, nr = r, nc = c;
      if(e.key === 'Enter' || e.key === 'ArrowDown'){ nr = e.shiftKey && e.key === 'Enter' ? r - 1 : r + 1; }
      else if(e.key === 'ArrowUp') nr = r - 1;
      else if(e.key === 'ArrowRight' && i.selectionStart === i.value.length) nc = c + 1;
      else if(e.key === 'ArrowLeft' && i.selectionStart === 0 && i.selectionEnd === 0) nc = c - 1;
      else if(e.key === 'Escape'){ i.blur(); return; }
      else return;
      if(nr === SHP.d.rows.length && e.key === 'Enter'){ SHP.d.rows.push(SHP.d.rows[0].map(function(){ return ''; })); saveSheetSoon(); SHP.sel = { c:c, r:nr }; renderSheetPane(true); e.preventDefault(); return; }
      var t = cellInput(Math.max(0, nc), Math.max(0, nr)); if(t){ e.preventDefault(); t.focus(); }
    });
    $('fxIn').addEventListener('input', function(){
      var s = SHP.sel; SHP.d.rows[s.r][s.c] = $('fxIn').value; var i = cellInput(s.c, s.r); if(i) i.value = $('fxIn').value; saveSheetSoon();
    });
    $('fxIn').addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); refreshVals(); var i = cellInput(SHP.sel.c, Math.min(SHP.sel.r + 1, SHP.d.rows.length - 1)); if(i) i.focus(); } });
    $('fxIn').addEventListener('blur', function(){ setTimeout(refreshVals, 0); });
    function act(id, fn){ $(id).addEventListener('click', function(){ fn(); saveSheetSoon(); renderSheetPane(true); sheetInfo(); }); }
    act('shRow', function(){ var r = SHP.sel.r + 1; SHP.d.rows.splice(r, 0, SHP.d.rows[0].map(function(){ return ''; })); SHP.sel.r = r; });
    act('shCol', function(){ var c = SHP.sel.c + 1; SHP.d.rows.forEach(function(row, i){ row.splice(c, 0, i === 0 ? 'Столбец ' + colName(c) : ''); }); SHP.sel.c = c; });
    act('shDelRow', function(){ if(SHP.d.rows.length > 1 && SHP.sel.r > 0){ SHP.d.rows.splice(SHP.sel.r, 1); SHP.sel.r = Math.min(SHP.sel.r, SHP.d.rows.length - 1); } else toast('Строку заголовков удалить нельзя'); });
    act('shDelCol', function(){ if(SHP.d.rows[0].length > 1){ SHP.d.rows.forEach(function(row){ row.splice(SHP.sel.c, 1); }); SHP.sel.c = Math.min(SHP.sel.c, SHP.d.rows[0].length - 1); } });
    act('shSum', function(){
      var w = SHP.d.rows[0].length, last = SHP.d.rows.length, vals = computeSheet(SHP.d.rows);
      var row = SHP.d.rows[0].map(function(x, c){
        if(c === 0) return 'Итого';
        var numeric = vals.slice(1).some(function(r){ return typeof r[c] === 'number'; });
        return numeric ? '=SUM(' + colName(c) + '2:' + colName(c) + last + ')' : '';
      });
      SHP.d.rows.push(row); SHP.sel = { c:Math.min(1, w - 1), r:last };
    });
    $('shXlsx').addEventListener('click', function(){ var t = docTitle(); saveXlsx(fileBase(t, 'tablitsa'), computeSheet(SHP.d.rows).map(function(r){ return r.map(fmtExport); }), t); });
    $('shCsv').addEventListener('click', function(){ download(fileBase(docTitle(), 'tablitsa') + '.csv', csvOf(computeSheet(SHP.d.rows).map(function(r){ return r.map(fmtExport); })), 'text/csv', 'Файл CSV сохранён'); });
    var fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.xlsx,.xls,.csv'; fi.hidden = true; document.body.appendChild(fi);
    $('shImport').addEventListener('click', function(){ fi.click(); });
    fi.addEventListener('change', function(){
      var f = fi.files[0]; fi.value = ''; if(!f) return;
      function apply(aoa){
        aoa = aoa.filter(function(r){ return r && r.some(function(x){ return String(x).trim() !== ''; }); });
        if(!aoa.length){ toast('В файле нет данных'); return; }
        SHP.d = parseSheet({ rows:aoa.slice(0, 1000) }); SHP.sel = { c:0, r:1 }; saveSheetSoon(); renderSheetPane(); sheetInfo();
        toast('Импортировано строк: ' + (SHP.d.rows.length - 1) + (aoa.length > 1000 ? ' (первые 1000)' : ''));
      }
      if(/\.csv$/i.test(f.name)) f.text().then(function(t){ var sep = (t.split('\n')[0].match(/;/g) || []).length >= (t.split('\n')[0].match(/,/g) || []).length ? ';' : ','; apply(parseCsv(t.replace(/^﻿/, ''), sep)); });
      else Promise.all([loadXLSX(), f.arrayBuffer()]).then(function(a){
        var X = a[0], wb = X.read(a[1], { type:'array' }), ws = wb.Sheets[wb.SheetNames[0]];
        apply(X.utils.sheet_to_json(ws, { header:1, raw:false, defval:'' }));
      }, function(){ toast('Не удалось открыть Excel-файл — сохраните его как CSV и импортируйте'); });
    });
  })();
  function fmtExport(v){ return typeof v === 'number' ? v : (v === undefined || v === null ? '' : String(v)); }
  function parseCsv(t, sep){
    var rows = [], row = [], cell = '', q = false;
    for(var i = 0; i < t.length; i++){
      var ch = t[i];
      if(q){ if(ch === '"'){ if(t[i + 1] === '"'){ cell += '"'; i++; } else q = false; } else cell += ch; }
      else if(ch === '"') q = true;
      else if(ch === sep){ row.push(cell); cell = ''; }
      else if(ch === '\n' || ch === '\r'){ if(ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if(cell !== '' || row.length){ row.push(cell); rows.push(row); }
    return rows;
  }
