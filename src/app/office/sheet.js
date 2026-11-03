  /* ---------- редактор таблицы (книга с листами) ---------- */
  var SG = { f:null, idx:0, sel:{ r0:0, c0:0, r1:0, c1:0 }, anchor:null, ed:null, undo:[], redo:[] };
  function shCur(){ return SG.f.data.sheets[SG.idx]; }
  function shPush(){ SG.undo.push(JSON.stringify(SG.f.data)); if(SG.undo.length > 60) SG.undo.shift(); SG.redo = []; }
  function shChanged(){ SG.f.t = Date.now(); saveGraph(); calcReset(); }
  function shSet(r, c, v){
    var rows = shCur().rows;
    while(rows.length <= r) rows.push([]);
    var w = Math.max(c + 1, rows[0].length);
    rows.forEach(function(row){ while(row.length < w) row.push(''); });
    rows[r][c] = v;
  }
  function shTrim(){ var rows = shCur().rows; while(rows.length > 1 && rows[rows.length - 1].every(function(x){ return String(x) === ''; })) rows.pop(); }
  function renderSheetEd(m, f){
    if(SG.f !== f){ SG = { f:f, idx:Math.min(f.data.activeSheet || 0, f.data.sheets.length - 1), sel:{ r0:0, c0:0, r1:0, c1:0 }, anchor:{ r:0, c:0 }, ed:null, undo:[], redo:[] }; }
    var sel = function(id, list, val, ch){ var s = h('select', { 'class':'input rb-sel', id:id, 'aria-label':list.label }); list.items.forEach(function(o){ var op = h('option', { value:o[0], text:o[1] }); if(o[0] === val) op.selected = true; s.appendChild(op); }); s.addEventListener('change', function(){ ch(s.value); }); return s; };
    var B = function(label, icon, fn, extra){ var b = h('button', { type:'button', 'class':'rb', title:label, 'aria-label':label, html:icon }); b.addEventListener('mousedown', function(e){ e.preventDefault(); }); b.addEventListener('click', fn); if(extra) b.classList.add(extra); return b; };
    var ribbon = h('div', { 'class':'ribbon', role:'toolbar', 'aria-label':'Таблица' }, [
      B('Отменить (Ctrl+Z)', SVGI('<path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2"/>', 16), shUndo),
      B('Повторить', SVGI('<path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h2"/>', 16), shRedo),
      h('span', { 'class':'rsep' }),
      B('Жирный (Ctrl+B)', '<b>Ж</b>', function(){ shFmt('b'); }), B('Курсив', '<i>К</i>', function(){ shFmt('i'); }),
      B('Цвет заливки', SVGI('<path d="M5 12l7-7 7 7-7 7z"/><path d="M19 15c0 1.5 1 2.5 1 3.5a1 1 0 01-2 0c0-1 1-2 1-3.5z"/>', 16), function(e){ colorPick(e.currentTarget, 'bg'); }),
      B('Цвет текста', '<span style="border-bottom:3px solid #DC2626;font-weight:700;line-height:1">А</span>', function(e){ colorPick(e.currentTarget, 'fc'); }),
      B('По левому краю', SVGI('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', 16), function(){ shFmt('al', 'left'); }),
      B('По центру', SVGI('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', 16), function(){ shFmt('al', 'center'); }),
      B('По правому краю', SVGI('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>', 16), function(){ shFmt('al', 'right'); }),
      sel('shNf', { label:'Формат чисел', items:NF }, '', function(v){ shFmt('nf', v); }),
      h('span', { 'class':'rsep' }),
      B('Автосумма Σ', '<b style="font-size:16px">Σ</b>', shAutoSum),
      B('Сортировка А→Я по столбцу', SVGI('<path d="M7 4v16M3 16l4 4 4-4M14 6h7M14 11h5M14 16h3"/>', 16), function(){ shSort(1); }),
      B('Сортировка Я→А по столбцу', SVGI('<path d="M7 20V4M3 8l4-4 4 4M14 6h3M14 11h5M14 16h7"/>', 16), function(){ shSort(-1); }),
      h('span', { 'class':'rsep' }),
      B('Вставить строку', '<span class="rt">+ стр</span>', function(){ shInsRow(); }), B('Вставить столбец', '<span class="rt">+ стлб</span>', function(){ shInsCol(); }),
      B('Удалить строки', '<span class="rt">− стр</span>', function(){ shDelRows(); }), B('Удалить столбцы', '<span class="rt">− стлб</span>', function(){ shDelCols(); }),
      h('span', { 'class':'rsep' }),
      B('Схема файлов: связи этой таблицы с другими файлами и компиляция', '<span class="rt">Схема файлов</span>', function(){ FM.sel = SG.f.id; ofSetTab('map'); }),
      B('Диаграмма из выделения', SVGI('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', 16), function(e){ chartMenu(e.currentTarget); }),
      h('span', { 'class':'grow' }),
      B('Импорт Excel / CSV в новый лист', '<span class="rt">Импорт</span>', function(){ shImportIn.click(); }),
      B('Скачать .xlsx', '<span class="rt">.xlsx</span>', function(){ exportFileAs(SG.f, 'xlsx'); }, 'pri')
    ]);
    m.appendChild(ribbon);
    m.appendChild(h('div', { 'class':'fxbar' }, [ h('span', { 'class':'fx-ref', id:'sgRef' }), h('button', { type:'button', 'class':'fx-f fx-btn', id:'sgFxBtn', text:'fx', title:'Вставить функцию (126 функций)', 'aria-label':'Вставить функцию' }),
      h('input', { 'class':'fx-in', id:'sgFx', 'aria-label':'Значение или формула', spellcheck:'false', autocomplete:'off', placeholder:'Значение или формула: =SUM(B2:B9), =\'Другая таблица\'!C4, =Лист2!A1' }) ]));
    m.appendChild(h('div', { 'class':'fx-hint', id:'sgFxHint', hidden:'' }));
    var wrap = h('div', { 'class':'sg-wrap', id:'sgWrap', tabindex:'0', 'aria-label':'Ячейки таблицы. Стрелки — перемещение, Enter или F2 — правка' });
    m.appendChild(wrap);
    var charts = h('div', { 'class':'sg-charts', id:'sgCharts' }); m.appendChild(charts);
    var tabs = h('div', { 'class':'sg-tabs', role:'tablist', 'aria-label':'Листы' }); m.appendChild(tabs);
    renderSheetTabs(); renderGrid(); renderCharts();
    var fx = $('sgFx');
    $('sgFxBtn').addEventListener('mousedown', function(e){ e.preventDefault(); });
    $('sgFxBtn').addEventListener('click', function(e){ if(fx.value === '' || fx.value.charAt(0) !== '='){ fx.dataset.orig = fx.value; } openFxWizard(e.currentTarget, fx); });
    fxHintFor(fx, $('sgFxHint'));
    fx.addEventListener('focus', function(){ fx.dataset.orig = fx.value; });
    fx.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); shPush(); shSet(SG.sel.r0, SG.sel.c0, fx.value); shChanged(); renderGrid(); shMove(1, 0); wrap.focus(); }
      else if(e.key === 'Escape'){ fx.value = fx.dataset.orig || ''; wrap.focus(); }
    });
    fx.addEventListener('change', function(){ if(fx.value !== fx.dataset.orig){ shPush(); shSet(SG.sel.r0, SG.sel.c0, fx.value); shChanged(); renderGrid(); } });
    OF.commit = function(){ shCommitEd(); SG.f.data.activeSheet = SG.idx; };
    setTimeout(function(){ wrap.focus({ preventScroll:true }); }, 0);
  }
  function renderSheetTabs(){
    var t = document.querySelector('.sg-tabs'); if(!t) return; t.innerHTML = '';
    SG.f.data.sheets.forEach(function(s, i){
      var b = h('button', { type:'button', role:'tab', 'class':'sgt' + (i === SG.idx ? ' on' : ''), 'aria-selected':i === SG.idx ? 'true' : 'false', text:s.name });
      b.addEventListener('click', function(){ shCommitEd(); SG.idx = i; SG.sel = { r0:0, c0:0, r1:0, c1:0 }; SG.anchor = { r:0, c:0 }; SG.f.data.activeSheet = i; renderSheetTabs(); renderGrid(); renderCharts(); });
      b.addEventListener('dblclick', function(){ renameSheet(i); });
      b.addEventListener('contextmenu', function(e){ e.preventDefault(); var r = b.getBoundingClientRect(); openMenuAt([
        { label:'Переименовать', icon:'edit', act:function(){ renameSheet(i); } },
        { label:'Дублировать', icon:'copy', act:function(){ shPush(); var c = JSON.parse(JSON.stringify(s)); c.name = s.name + ' (2)'; SG.f.data.sheets.splice(i + 1, 0, c); shChanged(); renderSheetTabs(); } },
        { label:'Удалить лист', icon:'trash', danger:true, disabled:SG.f.data.sheets.length < 2, act:function(){ shPush(); SG.f.data.sheets.splice(i, 1); SG.idx = Math.max(0, Math.min(SG.idx, SG.f.data.sheets.length - 1)); shChanged(); renderSheetTabs(); renderGrid(); renderCharts(); } }
      ], r.left, r.top - 120); });
      t.appendChild(b);
    });
    t.appendChild(h('button', { type:'button', 'class':'sgt add', 'aria-label':'Добавить лист', text:'+', on:{ click:function(){ shPush(); var n = 'Лист' + (SG.f.data.sheets.length + 1); SG.f.data.sheets.push(blankSheet(n)); SG.idx = SG.f.data.sheets.length - 1; shChanged(); renderSheetTabs(); renderGrid(); renderCharts(); } } }));
    t.appendChild(h('span', { 'class':'sg-hint', text:'Ссылки на другие листы и файлы: =Лист2!B3, =\'Бюджет отдела\'!C7, =SUM(\'Реестр\'!E2:E20)' }));
  }
  function renameSheet(i){
    var b = document.querySelectorAll('.sg-tabs .sgt')[i]; if(!b) return;
    var inp = h('input', { 'class':'input sgt-in', 'aria-label':'Имя листа' }); inp.value = SG.f.data.sheets[i].name; b.replaceWith(inp); inp.focus(); inp.select();
    var done = false; function fin(ok){ if(done) return; done = true; var v = inp.value.trim().replace(/[!'\/]/g, ''); if(ok && v){ shPush(); SG.f.data.sheets[i].name = v; shChanged(); } renderSheetTabs(); }
    inp.addEventListener('keydown', function(e){ e.stopPropagation(); if(e.key === 'Enter') fin(true); if(e.key === 'Escape') fin(false); });
    inp.addEventListener('blur', function(){ fin(true); });
  }
  function renderGrid(){
    var wrap = $('sgWrap'); if(!wrap) return;
    var sh = shCur(), u = usedRange(sh), R = Math.max(u.r1 + 16, 30, SG.sel.r1 + 6), C = Math.max(u.c1 + 4, 10, SG.sel.c1 + 3);
    calcReset();
    var fmt = sh.fmt || {}, widths = sh.widths || {}, s = SG.sel;
    var html = ['<table class="sg"><colgroup><col style="width:44px">'];
    for(var c = 0; c < C; c++) html.push('<col style="width:' + (widths[c] || 112) + 'px">');
    html.push('</colgroup><thead><tr><th class="cn"></th>');
    for(c = 0; c < C; c++) html.push('<th data-col="' + c + '"' + (c >= s.c0 && c <= s.c1 ? ' class="hl"' : '') + '>' + colName(c) + '<span class="rz" data-rz="' + c + '"></span></th>');
    html.push('</tr></thead><tbody>');
    for(var r = 0; r < R; r++){
      html.push('<tr><th data-row="' + r + '"' + (r >= s.r0 && r <= s.r1 ? ' class="hl"' : '') + '>' + (r + 1) + '</th>');
      for(c = 0; c < C; c++){
        var raw = sh.rows[r] && sh.rows[r][c] !== undefined ? sh.rows[r][c] : '', v = raw === '' ? '' : cellVal(SG.f, SG.idx, c, r), cf = fmt[r + ':' + c] || {};
        var cls = [], st = [];
        if(typeof v === 'number') cls.push('n'); if(String(v).charAt(0) === '#' && /^#[А-ЯЁ\/0-9]+/.test(String(v))) cls.push('e');
        if(r >= s.r0 && r <= s.r1 && c >= s.c0 && c <= s.c1) cls.push(r === SG.anchor.r && c === SG.anchor.c ? 'act' : 'in');
        if(typeof raw === 'string' && raw.charAt(0) === '=') cls.push('f');
        if(cf.b) st.push('font-weight:700'); if(cf.i) st.push('font-style:italic'); if(cf.bg) st.push('background:' + cf.bg); if(cf.fc) st.push('color:' + cf.fc); else if(cf.bg) st.push('color:' + bestText(cf.bg, '#FFFFFF', '#111827')); if(cf.al) st.push('text-align:' + cf.al);
        html.push('<td data-r="' + r + '" data-c="' + c + '"' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + (st.length ? ' style="' + st.join(';') + '"' : '') + '>' + escHtml(fmtNum(v, cf.nf)) + '</td>');
      }
      html.push('</tr>');
    }
    html.push('</tbody></table>');
    var sl = wrap.scrollLeft, stp = wrap.scrollTop;
    wrap.innerHTML = html.join(''); wrap.scrollLeft = sl; wrap.scrollTop = stp;
    shUpdateBar();
  }
  function shUpdateBar(){
    var ref = $('sgRef'), fx = $('sgFx'); if(!ref) return;
    ref.textContent = rangeStr(SG.sel);
    var raw = (shCur().rows[SG.anchor.r] || [])[SG.anchor.c];
    if(document.activeElement !== fx) fx.value = raw === undefined ? '' : raw;
    var nf = $('shNf'); if(nf){ var cf = (shCur().fmt || {})[SG.anchor.r + ':' + SG.anchor.c] || {}; nf.value = cf.nf || ''; }
    // сумма выделенного, как в строке состояния Excel
    if(SG.sel.r0 !== SG.sel.r1 || SG.sel.c0 !== SG.sel.c1){
      var vals = nums(rangeValues(SG.f, SG.idx, SG.sel));
      el.stLeft.textContent = 'Таблица «' + SG.f.name + '» · ' + shCur().name + ' · ' + rangeStr(SG.sel) + (vals.length ? ' · Сумма: ' + fmtCell(vals.reduce(function(a, b){ return a + b; }, 0)) + ' · Среднее: ' + fmtCell(Math.round(vals.reduce(function(a, b){ return a + b; }, 0) / vals.length * 100) / 100) + ' · Количество: ' + vals.length : '');
    } else el.stLeft.textContent = 'Таблица «' + SG.f.name + '» · ' + shCur().name + ' · ' + rangeStr(SG.sel) + ' · Листов: ' + SG.f.data.sheets.length;
  }
  function shMarkSel(){
    var wrap = $('sgWrap'); if(!wrap) return; var s = SG.sel;
    Array.prototype.forEach.call(wrap.querySelectorAll('td.in,td.act'), function(td){ td.classList.remove('in', 'act'); });
    Array.prototype.forEach.call(wrap.querySelectorAll('th.hl'), function(th){ th.classList.remove('hl'); });
    var maxR = wrap.querySelectorAll('tbody tr').length, maxC = wrap.querySelectorAll('thead th').length - 1;
    if(s.r1 >= maxR - 2 || s.c1 >= maxC - 1){ renderGrid(); }
    for(var r = s.r0; r <= s.r1; r++) for(var c = s.c0; c <= s.c1; c++){ var td = wrap.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]'); if(td) td.classList.add(r === SG.anchor.r && c === SG.anchor.c ? 'act' : 'in'); }
    for(var c2 = s.c0; c2 <= s.c1; c2++){ var hc = wrap.querySelector('th[data-col="' + c2 + '"]'); if(hc) hc.classList.add('hl'); }
    for(var r2 = s.r0; r2 <= s.r1; r2++){ var hr = wrap.querySelector('th[data-row="' + r2 + '"]'); if(hr) hr.classList.add('hl'); }
    var a = wrap.querySelector('td.act'); if(a){ var ar = a.getBoundingClientRect(), wr = wrap.getBoundingClientRect(); if(ar.bottom > wr.bottom) wrap.scrollTop += ar.bottom - wr.bottom + 4; if(ar.top < wr.top + 30) wrap.scrollTop -= wr.top + 30 - ar.top; if(ar.right > wr.right) wrap.scrollLeft += ar.right - wr.right + 4; if(ar.left < wr.left + 44) wrap.scrollLeft -= wr.left + 44 - ar.left; }
    shUpdateBar();
  }
  function shSelect(r, c, extend){
    r = Math.max(0, r); c = Math.max(0, c);
    if(!extend){ SG.anchor = { r:r, c:c }; SG.sel = { r0:r, c0:c, r1:r, c1:c }; }
    else { var a = SG.anchor; SG.sel = { r0:Math.min(a.r, r), c0:Math.min(a.c, c), r1:Math.max(a.r, r), c1:Math.max(a.c, c) }; SG.ext = { r:r, c:c }; }
    shMarkSel();
  }
  function shMove(dr, dc, extend){
    if(extend){ var e = SG.ext || { r:SG.anchor.r, c:SG.anchor.c }; shSelect(e.r + dr, e.c + dc, true); }
    else { SG.ext = null; shSelect(SG.anchor.r + dr, SG.anchor.c + dc); }
  }
  function shStartEd(initial){
    var wrap = $('sgWrap'), td = wrap.querySelector('td[data-r="' + SG.anchor.r + '"][data-c="' + SG.anchor.c + '"]'); if(!td) return;
    shCommitEd();
    var raw = (shCur().rows[SG.anchor.r] || [])[SG.anchor.c];
    var inp = h('input', { 'class':'sg-ed', 'aria-label':'Правка ячейки ' + colName(SG.anchor.c) + (SG.anchor.r + 1), spellcheck:'false', autocomplete:'off' });
    inp.value = initial !== undefined ? initial : (raw === undefined ? '' : raw);
    inp.style.left = td.offsetLeft + 'px'; inp.style.top = td.offsetTop + 'px'; inp.style.width = Math.max(td.offsetWidth, 140) + 'px'; inp.style.height = td.offsetHeight + 'px';
    wrap.appendChild(inp); inp.focus(); var L = inp.value.length; inp.setSelectionRange(L, L);
    SG.ed = { inp:inp, r:SG.anchor.r, c:SG.anchor.c };
    inp.addEventListener('input', function(){ var fx = $('sgFx'); if(fx) fx.value = inp.value; });
    inp.addEventListener('keydown', function(e){
      e.stopPropagation();
      if(e.key === 'Enter'){ e.preventDefault(); shCommitEd(); shMove(e.shiftKey ? -1 : 1, 0); wrap.focus(); }
      else if(e.key === 'Tab'){ e.preventDefault(); shCommitEd(); shMove(0, e.shiftKey ? -1 : 1); wrap.focus(); }
      else if(e.key === 'Escape'){ e.preventDefault(); inp.remove(); SG.ed = null; shUpdateBar(); wrap.focus(); }
    });
    inp.addEventListener('blur', function(){ setTimeout(function(){ if(SG.ed && SG.ed.inp === inp) shCommitEd(); }, 0); });
  }
  function shCommitEd(){
    var ed = SG.ed; if(!ed) return; SG.ed = null;
    var v = ed.inp.value, old = (shCur().rows[ed.r] || [])[ed.c];
    ed.inp.remove();
    if(v !== (old === undefined ? '' : old)){ shPush(); shSet(ed.r, ed.c, v); shTrim(); shChanged(); renderGrid(); renderCharts(); }
  }
  function shEach(fn){ var s = SG.sel; for(var r = s.r0; r <= s.r1; r++) for(var c = s.c0; c <= s.c1; c++) fn(r, c); }
  function shFmt(k, v){
    shPush(); var sh = shCur(); sh.fmt = sh.fmt || {};
    var first = sh.fmt[SG.anchor.r + ':' + SG.anchor.c] || {}, val = v === undefined ? !first[k] : v;
    shEach(function(r, c){ var key = r + ':' + c, o = sh.fmt[key] || {}; if(val === '' || val === false || val === null) delete o[k]; else o[k] = val; if(Object.keys(o).length) sh.fmt[key] = o; else delete sh.fmt[key]; });
    shChanged(); renderGrid();
  }
  function colorPick(btn, k){
    var r = btn.getBoundingClientRect(), cols = k === 'bg' ? ['#FEF3C7', '#DCFCE7', '#DBEAFE', '#FCE7F3', '#FEE2E2', '#E5E7EB', '#FDE68A', '#BBF7D0'] : ['#111827', '#DC2626', '#16A34A', '#2563EB', '#CA8A04', '#9333EA', '#6B7280', '#FFFFFF'];
    openMenuAt([{ head:k === 'bg' ? 'Заливка' : 'Цвет текста' }].concat(cols.map(function(c){ return { label:c, swatch:c, act:function(){ shFmt(k, c); } }; })).concat([{ label:'Без цвета', icon:'trash', act:function(){ shFmt(k, ''); } }]), r.left, r.bottom + 4);
  }
  function shAutoSum(){
    var s = SG.sel, sh = shCur();
    shPush();
    if(s.r0 === s.r1 && s.c0 === s.c1){
      // как в Excel: сумма числового столбца над ячейкой
      var c = s.c0, r = s.r0 - 1, end = r; calcReset();
      while(r >= 0 && typeof cellVal(SG.f, SG.idx, c, r) === 'number') r--;
      if(end - r > 0) shSet(s.r0, c, '=SUM(' + colName(c) + (r + 2) + ':' + colName(c) + (end + 1) + ')');
      else { toast('Над ячейкой нет чисел — выделите диапазон'); SG.undo.pop(); return; }
    } else {
      for(var cc = s.c0; cc <= s.c1; cc++) shSet(s.r1 + 1, cc, '=SUM(' + colName(cc) + (s.r0 + 1) + ':' + colName(cc) + (s.r1 + 1) + ')');
    }
    shChanged(); renderGrid(); renderCharts();
  }
  function shSort(dir){
    var sh = shCur(), c = SG.anchor.c, u = usedRange(sh);
    if(u.r1 < 2){ toast('Мало строк для сортировки'); return; }
    shPush(); calcReset();
    var body = sh.rows.slice(1).map(function(row, i){ return { row:row, v:cellVal(SG.f, SG.idx, c, i + 1) }; });
    var keep = body.filter(function(x){ return /^итог/i.test(String(x.row[0] || '')); }), rest = body.filter(function(x){ return keep.indexOf(x) < 0; });
    rest.sort(function(a, b){ var x = a.v, y = b.v; if(x === '' && y !== '') return 1; if(y === '' && x !== '') return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ru')) * dir; });
    body.forEach(function(x, i){ x.old = i + 1; });
    var order = rest.concat(keep), map = {}; order.forEach(function(x, i){ map[x.old] = i + 1; });
    // формулы «едут» вместе со своими строками: =C2-B2 в строке, ставшей 5-й, превращается в =C5-B5
    refAdjust(SG.f, SG.idx, function(cc, r){ return [cc, map[r] !== undefined ? map[r] : r]; }, function(c1, r1, c2, r2){ return [c1, r1, c2, r2]; });
    sh.rows = [sh.rows[0]].concat(order.map(function(x){ return x.row; }));
    shChanged(); renderGrid(); renderCharts(); toast('Отсортировано по столбцу ' + colName(c) + (keep.length ? ' (строки «Итого» остались внизу)' : '') + ' · формулы пересчитаны');
  }
  // ссылки в формулах сдвигаются при вставке/удалении строк и столбцов и при сортировке — как в Excel
  var REF_RE = /("[^"]*")|(?:'([^']+)'|([A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_.]*))!(\$?)([A-Z]{1,3})(\$?)(\d+)(?:(\s*:\s*)(\$?)([A-Z]{1,3})(\$?)(\d+))?|(\$?)\b([A-Z]{1,3})(\$?)(\d+)\b(?:(\s*:\s*)(\$?)([A-Z]{1,3})(\$?)(\d+))?/g;
  function refWrite(f, ctx, target, mapCell, mapRange){
    return '=' + f.slice(1).replace(REF_RE, function(m, str, qn, wn, d1, c1, d2, r1, sep, d3, c2, d4, r2, ud1, uc1, ud2, ur1, usep, ud3, uc2, ud4, ur2){
      if(str) return m;
      var q = qn || wn, t;
      if(q) t = sheetRef(ctx, q);
      else { t = { file:ctx.file, idx:ctx.idx }; d1 = ud1; c1 = uc1; d2 = ud2; r1 = ur1; sep = usep; d3 = ud3; c2 = uc2; d4 = ud4; r2 = ur2; }
      if(!t || t.file !== target.file || t.idx !== target.idx) return m;
      var pre = q ? (qn ? "'" + qn + "'" : wn) + '!' : '';
      if(c2){ var g = mapRange(colIdx(c1), +r1 - 1, colIdx(c2), +r2 - 1); return g ? pre + d1 + colName(g[0]) + d2 + (g[1] + 1) + sep + d3 + colName(g[2]) + d4 + (g[3] + 1) : '#ССЫЛКА'; }
      var pc = mapCell(colIdx(c1), +r1 - 1); return pc ? pre + d1 + colName(pc[0]) + d2 + (pc[1] + 1) : '#ССЫЛКА';
    });
  }
  function refAdjust(file, idx, mapCell, mapRange){
    var target = { file:file, idx:idx };
    ofItems().forEach(function(F){
      if(F.type !== 'sheet') return;
      F.data.sheets.forEach(function(s, si){
        var ctx = { file:F, idx:si };
        s.rows.forEach(function(row){ row.forEach(function(v, ci){ if(typeof v === 'string' && v.charAt(0) === '=' && v.length > 1) row[ci] = refWrite(v, ctx, target, mapCell, mapRange); }); });
        if(F === file && si === idx) (s.charts || []).forEach(function(ch){ var g = parseRange(ch.range); if(g){ var n = mapRange(g.c0, g.r0, g.c1, g.r1); if(n) ch.range = rangeStr({ c0:n[0], r0:n[1], c1:n[2], r1:n[3] }); } });
      });
    });
  }
  function shiftMaps(axis, at, n){
    // n > 0 — вставка n штук перед at; n < 0 — удаление -n штук начиная с at
    var k = axis === 'row' ? 1 : 0;
    function one(v){ if(n > 0) return v >= at ? v + n : v; var e = at - n; return v < at ? v : (v >= e ? v + n : null); }
    function lo(v){ if(n > 0) return v >= at ? v + n : v; var e = at - n; return v < at ? v : (v >= e ? v + n : at); }
    function hi(v){ if(n > 0) return v >= at ? v + n : v; var e = at - n; return v < at ? v : (v >= e ? v + n : at - 1); }
    return {
      cell:function(c, r){ var p = [c, r]; var nv = one(p[k]); if(nv === null) return null; p[k] = nv; return p; },
      range:function(c1, r1, c2, r2){ var a = [c1, r1], b = [c2, r2]; a[k] = lo(a[k]); b[k] = hi(b[k]); return b[k] < a[k] ? null : [a[0], a[1], b[0], b[1]]; }
    };
  }
  function shStructural(axis, at, n){ var m = shiftMaps(axis, at, n); refAdjust(SG.f, SG.idx, m.cell, m.range); }
  function shInsRow(){ shPush(); var sh = shCur(), r = SG.sel.r0; shStructural('row', r, 1); while(sh.rows.length < r) sh.rows.push([]); sh.rows.splice(r, 0, sh.rows[0].map(function(){ return ''; })); shChanged(); renderGrid(); renderCharts(); }
  function shInsCol(){ shPush(); var c = SG.sel.c0; shStructural('col', c, 1); shCur().rows.forEach(function(row){ while(row.length < c) row.push(''); row.splice(c, 0, ''); }); shChanged(); renderGrid(); renderCharts(); }
  function shDelRows(){ shPush(); var s = SG.sel; shStructural('row', s.r0, -(s.r1 - s.r0 + 1)); shCur().rows.splice(s.r0, s.r1 - s.r0 + 1); if(!shCur().rows.length) shCur().rows = [['']]; shChanged(); shSelect(s.r0, s.c0); renderGrid(); renderCharts(); }
  function shDelCols(){ shPush(); var s = SG.sel; shStructural('col', s.c0, -(s.c1 - s.c0 + 1)); shCur().rows.forEach(function(row){ row.splice(s.c0, s.c1 - s.c0 + 1); }); shChanged(); shSelect(s.r0, s.c0); renderGrid(); renderCharts(); }
  function shUndo(){ shCommitEd(); if(!SG.undo.length){ toast('Нечего отменять'); return; } SG.redo.push(JSON.stringify(SG.f.data)); SG.f.data = JSON.parse(SG.undo.pop()); SG.idx = Math.min(SG.idx, SG.f.data.sheets.length - 1); shChanged(); renderSheetTabs(); renderGrid(); renderCharts(); }
  function shRedo(){ if(!SG.redo.length){ toast('Нечего повторять'); return; } SG.undo.push(JSON.stringify(SG.f.data)); SG.f.data = JSON.parse(SG.redo.pop()); shChanged(); renderSheetTabs(); renderGrid(); renderCharts(); }
  function shCopy(e){
    var s = SG.sel, sh = shCur(), lines = [];
    for(var r = s.r0; r <= s.r1; r++){ var row = []; for(var c = s.c0; c <= s.c1; c++){ var v = (sh.rows[r] || [])[c]; row.push(v === undefined ? '' : v); } lines.push(row.join('\t')); }
    var t = lines.join('\n');
    if(e && e.clipboardData){ e.clipboardData.setData('text/plain', t); e.preventDefault(); } else if(navigator.clipboard) navigator.clipboard.writeText(t);
    toast('Скопировано: ' + rangeStr(s));
  }
  function shPaste(text){
    if(!text) return; shPush();
    var rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(function(l){ return l.split('\t'); });
    rows.forEach(function(row, i){ row.forEach(function(v, j){ shSet(SG.anchor.r + i, SG.anchor.c + j, v); }); });
    SG.sel = { r0:SG.anchor.r, c0:SG.anchor.c, r1:SG.anchor.r + rows.length - 1, c1:SG.anchor.c + rows[0].length - 1 };
    shChanged(); renderGrid(); renderCharts();
  }
  function shClear(){ shPush(); shEach(function(r, c){ if(shCur().rows[r] && shCur().rows[r][c] !== undefined) shCur().rows[r][c] = ''; }); shTrim(); shChanged(); renderGrid(); renderCharts(); }
  function chartMenu(btn){
    var r = btn.getBoundingClientRect();
    openMenuAt([{ head:'Диаграмма из ' + rangeStr(SG.sel) }, { label:'Гистограмма', icon:'grid', act:function(){ addChart('bar'); } }, { label:'График', icon:'redo', act:function(){ addChart('line'); } }, { label:'Круговая', icon:'zoom', act:function(){ addChart('pie'); } }], r.left, r.bottom + 4);
  }
  function addChart(type){
    var s = SG.sel;
    if(s.r0 === s.r1 && s.c0 === s.c1){ s = usedRange(shCur()); toast('Взят весь заполненный диапазон ' + rangeStr(s)); }
    shPush(); var sh = shCur(); sh.charts = sh.charts || [];
    sh.charts.push({ id:'c' + Date.now().toString(36), type:type, range:rangeStr(s), title:'' });
    shChanged(); renderCharts();
    var cs = $('sgCharts'); if(cs) cs.scrollIntoView({ block:'nearest' });
  }
  function renderCharts(){
    var box = $('sgCharts'); if(!box) return; box.innerHTML = '';
    var sh = shCur(), list = sh.charts || []; box.hidden = !list.length;
    list.forEach(function(ch, i){
      var dark = !(THEMES[UI.theme] || {}).light;
      var card = h('figure', { 'class':'chart-card' }, [
        h('div', { 'class':'cc-bar' }, [
          h('input', { 'class':'input cc-title', value:ch.title || '', placeholder:'Название диаграммы', 'aria-label':'Название диаграммы', on:{ change:function(e){ ch.title = e.target.value; shChanged(); renderCharts(); } } }),
          (function(){ var s = h('select', { 'class':'input cc-type', 'aria-label':'Тип диаграммы' }); [['bar', 'Гистограмма'], ['line', 'График'], ['pie', 'Круговая']].forEach(function(o){ var op = h('option', { value:o[0], text:o[1] }); if(o[0] === ch.type) op.selected = true; s.appendChild(op); }); s.addEventListener('change', function(){ ch.type = s.value; shChanged(); renderCharts(); }); return s; })(),
          h('input', { 'class':'input cc-range', value:ch.range, 'aria-label':'Диапазон данных', title:'Диапазон данных', on:{ change:function(e){ if(parseRange(e.target.value)){ ch.range = e.target.value.toUpperCase(); shChanged(); renderCharts(); } else toast('Диапазон вида A1:C7'); } } }),
          h('button', { type:'button', 'class':'icon-btn', 'aria-label':'Удалить диаграмму', html:SVGI('<path d="M6 6l12 12M18 6L6 18"/>', 14), on:{ click:function(){ shPush(); list.splice(i, 1); shChanged(); renderCharts(); } } })
        ]),
        h('div', { 'class':'cc-svg', html:chartSvg(rangeValues(SG.f, SG.idx, parseRange(ch.range) || usedRange(sh)), ch.type, ch.title, 520, 280, dark) })
      ]);
      box.appendChild(card);
    });
  }
  (function gridEvents(){
    var main = $('ofMain'), down = false;
    main.addEventListener('mousedown', function(e){
      var td = e.target.closest('#sgWrap td'); if(!td) return;
      if(SG.ed && e.target === SG.ed.inp) return;
      shCommitEd();
      e.preventDefault(); $('sgWrap').focus({ preventScroll:true });
      shSelect(+td.dataset.r, +td.dataset.c, e.shiftKey); down = true;
    });
    main.addEventListener('mouseover', function(e){ if(!down) return; var td = e.target.closest('#sgWrap td'); if(td) shSelect(+td.dataset.r, +td.dataset.c, true); });
    document.addEventListener('mouseup', function(){ down = false; });
    main.addEventListener('dblclick', function(e){ if(e.target.closest('#sgWrap td')) shStartEd(); });
    main.addEventListener('touchend', function(e){
      var td = e.target.closest('#sgWrap td'); if(!td) return;
      var r = +td.dataset.r, c = +td.dataset.c, now = Date.now();
      if(SG.lastTouch && SG.lastTouch.r === r && SG.lastTouch.c === c && now - SG.lastTouch.t < 400){ e.preventDefault(); shStartEd(); SG.lastTouch = null; return; }
      SG.lastTouch = { r:r, c:c, t:now }; shCommitEd(); shSelect(r, c);
    });
    main.addEventListener('click', function(e){
      var th = e.target.closest('#sgWrap thead th[data-col]'); if(th && !e.target.classList.contains('rz')){ var c = +th.dataset.col; SG.anchor = { r:0, c:c }; SG.sel = { r0:0, c0:c, r1:Math.max(usedRange(shCur()).r1, 0), c1:c }; shMarkSel(); }
      var rh = e.target.closest('#sgWrap tbody th[data-row]'); if(rh){ var r = +rh.dataset.row; SG.anchor = { r:r, c:0 }; SG.sel = { r0:r, c0:0, r1:r, c1:Math.max(usedRange(shCur()).c1, 0) }; shMarkSel(); }
    });
    // ширина столбцов
    main.addEventListener('pointerdown', function(e){
      var rz = e.target.closest('#sgWrap .rz'); if(!rz) return;
      e.preventDefault(); e.stopPropagation();
      var c = +rz.dataset.rz, sx = e.clientX, sh = shCur(), w0 = (sh.widths || {})[c] || 112, col = $('sgWrap').querySelectorAll('col')[c + 1];
      function mv(ev){ var w = Math.max(40, Math.min(600, w0 + ev.clientX - sx)); sh.widths = sh.widths || {}; sh.widths[c] = w; if(col) col.style.width = w + 'px'; }
      function up(){ document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); shChanged(); }
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    main.addEventListener('keydown', function(e){
      if(e.target.id !== 'sgWrap') return;
      var mod = e.ctrlKey || e.metaKey, k = e.key;
      if(mod && e.code === 'KeyZ'){ e.preventDefault(); if(e.shiftKey) shRedo(); else shUndo(); return; }
      if(mod && e.code === 'KeyY'){ e.preventDefault(); shRedo(); return; }
      if(mod && e.code === 'KeyB'){ e.preventDefault(); shFmt('b'); return; }
      if(mod && e.code === 'KeyI'){ e.preventDefault(); shFmt('i'); return; }
      if(mod && e.code === 'KeyA'){ e.preventDefault(); var u = usedRange(shCur()); SG.anchor = { r:0, c:0 }; SG.sel = u; shMarkSel(); return; }
      if(mod) return;
      if(k === 'ArrowDown'){ e.preventDefault(); shMove(1, 0, e.shiftKey); }
      else if(k === 'ArrowUp'){ e.preventDefault(); shMove(-1, 0, e.shiftKey); }
      else if(k === 'ArrowRight'){ e.preventDefault(); shMove(0, 1, e.shiftKey); }
      else if(k === 'ArrowLeft'){ e.preventDefault(); shMove(0, -1, e.shiftKey); }
      else if(k === 'Enter'){ e.preventDefault(); if(e.shiftKey) shMove(-1, 0); else shMove(1, 0); }
      else if(k === 'Tab'){ e.preventDefault(); shMove(0, e.shiftKey ? -1 : 1); }
      else if(k === 'F2'){ e.preventDefault(); shStartEd(); }
      else if(k === 'Delete' || k === 'Backspace'){ e.preventDefault(); shClear(); }
      else if(k.length === 1 && !e.altKey){ e.preventDefault(); shStartEd(k); }
    });
    main.addEventListener('copy', function(e){ if(document.activeElement && document.activeElement.id === 'sgWrap') shCopy(e); });
    main.addEventListener('cut', function(e){ if(document.activeElement && document.activeElement.id === 'sgWrap'){ shCopy(e); shClear(); } });
    main.addEventListener('paste', function(e){ if(document.activeElement && document.activeElement.id === 'sgWrap'){ e.preventDefault(); shPaste(e.clipboardData.getData('text/plain')); } });
  })();
  var shImportIn = document.createElement('input'); shImportIn.type = 'file'; shImportIn.accept = '.xlsx,.xls,.csv'; shImportIn.hidden = true; document.body.appendChild(shImportIn);
  shImportIn.addEventListener('change', function(){
    var file = shImportIn.files[0]; shImportIn.value = ''; if(!file || !SG.f) return;
    function add(name, rows){ shPush(); SG.f.data.sheets.push({ name:name, rows:rows.length ? rows : [['']], fmt:{}, widths:{}, charts:[] }); SG.idx = SG.f.data.sheets.length - 1; shChanged(); renderSheetTabs(); renderGrid(); renderCharts(); toast('Лист «' + name + '» импортирован'); }
    if(/\.csv$/i.test(file.name)) file.text().then(function(t){ t = t.replace(/^﻿/, ''); var l0 = t.split('\n')[0]; add(baseName(file.name).slice(0, 28), parseCsv(t, (l0.match(/;/g) || []).length >= (l0.match(/,/g) || []).length ? ';' : ',').filter(function(r){ return r.some(function(x){ return String(x).trim(); }); })); });
    else Promise.all([loadXLSX(), file.arrayBuffer()]).then(function(a){ var X = a[0], wb = X.read(a[1], { type:'array' }); add(wb.SheetNames[0].slice(0, 28), X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, raw:false, defval:'' })); }, function(){ toast('Модуль Excel недоступен — импортируйте CSV'); });
  });