  /* ---------- таблицы: формулы как в Excel ---------- */
  function colName(i){ var s = ''; i++; while(i > 0){ var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function colIdx(s){ var n = 0; for(var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n - 1; }
  function parseSheet(txt){
    var o; try{ o = typeof txt === 'string' ? JSON.parse(txt) : txt; }catch(e){ o = null; }
    if(Array.isArray(o)) o = { rows:o };
    if(!o || !Array.isArray(o.rows) || !o.rows.length) o = { rows:[['Колонка A', 'Колонка B'], ['', '']] };
    var w = 0; o.rows.forEach(function(r){ w = Math.max(w, r.length); });
    o.rows = o.rows.map(function(r){ r = r.map(function(v){ return v === null || v === undefined ? '' : String(v); }); while(r.length < w) r.push(''); return r; });
    return o;
  }
  function num(v){
    if(typeof v === 'number') return v;
    var s = String(v).replace(/[\s ]/g, '').replace(',', '.');
    return s !== '' && !isNaN(s) ? +s : v;
  }
  var FN = {
    SUM:'SUM', 'СУММ':'SUM', AVERAGE:'AVG', 'СРЗНАЧ':'AVG', MIN:'MIN', 'МИН':'MIN', MAX:'MAX', 'МАКС':'MAX',
    COUNT:'COUNT', 'СЧЁТ':'COUNT', 'СЧЕТ':'COUNT', ROUND:'ROUND', 'ОКРУГЛ':'ROUND', IF:'IF', 'ЕСЛИ':'IF', ABS:'ABS',
    CONCAT:'CONCAT', 'СЦЕП':'CONCAT', 'СЦЕПИТЬ':'CONCAT', TODAY:'TODAY', 'СЕГОДНЯ':'TODAY', AND:'AND', 'И':'AND', OR:'OR', 'ИЛИ':'OR'
  };
  function flat(a){ var o = []; (function f(x){ if(Array.isArray(x)) x.forEach(f); else o.push(x); })(a); return o; }
  function nums(a){ return flat(a).map(num).filter(function(x){ return typeof x === 'number'; }); }
  var FF = {
    SUM:function(){ return nums([].slice.call(arguments)).reduce(function(s, x){ return s + x; }, 0); },
    AVG:function(){ var n = nums([].slice.call(arguments)); return n.length ? n.reduce(function(s, x){ return s + x; }, 0) / n.length : 0; },
    MIN:function(){ var n = nums([].slice.call(arguments)); return n.length ? Math.min.apply(0, n) : 0; },
    MAX:function(){ var n = nums([].slice.call(arguments)); return n.length ? Math.max.apply(0, n) : 0; },
    COUNT:function(){ return nums([].slice.call(arguments)).length; },
    ROUND:function(x, d){ var k = Math.pow(10, d || 0); return Math.round(num(x) * k) / k; },
    IF:function(c, a, b){ return c ? a : (b === undefined ? false : b); },
    ABS:function(x){ return Math.abs(num(x)); },
    CONCAT:function(){ return flat([].slice.call(arguments)).join(''); },
    TODAY:function(){ return new Date().toLocaleDateString('ru-RU'); },
    AND:function(){ return flat([].slice.call(arguments)).every(Boolean); },
    OR:function(){ return flat([].slice.call(arguments)).some(Boolean); }
  };
  function translateF(src){
    var strs = [], s = src.replace(/"[^"]*"/g, function(m){ strs.push(m); return '\u0001' + (strs.length - 1) + '\u0001'; });
    s = s.replace(/;/g, ',');
    s = s.replace(/([A-Za-zА-Яа-яЁё]+)\s*\(/g, function(m, name){ var f = FN[name.toUpperCase()]; if(!f) throw new Error('fn'); return 'F.' + f + '('; });
    s = s.replace(/\$?\b([A-Z]{1,3})\$?(\d+)\s*:\s*\$?([A-Z]{1,3})\$?(\d+)\b/g, function(m, a, b, c, d){ return 'R("' + a + '",' + b + ',"' + c + '",' + d + ')'; });
    s = s.replace(/\$?\b([A-Z]{1,3})\$?(\d+)\b/g, function(m, a, b){ return 'V("' + a + '",' + b + ')'; });
    s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)').replace(/<>/g, '!=').replace(/([^<>!=])=(?!=)/g, '$1==').replace(/\^/g, '**').replace(/&/g, '+');
    var check = s.replace(/"[^"]*"/g, '').replace(/\u0001\d+\u0001/g, '');
    (check.match(/[A-Za-z_][A-Za-z_0-9.]*/g) || []).forEach(function(id){ if(id !== 'V' && id !== 'R' && !/^F\.[A-Z]+$/.test(id)) throw new Error('id'); });
    if(/[^\s\d.+\-*/(),<>=!?:A-Za-z_"\u0001%]/.test(check)) throw new Error('chars');
    return s.replace(/\u0001(\d+)\u0001/g, function(m, i){ return strs[+i]; });
  }
  function computeSheet(rows){
    var cache = {}, busy = {};
    function val(c, r){
      var k = c + ':' + r; if(k in cache) return cache[k];
      if(busy[k]) return '#ЦИКЛ';
      var v = rows[r] && rows[r][c] !== undefined ? rows[r][c] : '';
      if(typeof v === 'string' && v.charAt(0) === '=' && v.length > 1){ busy[k] = 1; v = evalF(v.slice(1)); busy[k] = 0; }
      else v = num(v);
      cache[k] = v; return v;
    }
    function V(col, row){ return val(colIdx(col), row - 1); }
    function R(c1, r1, c2, r2){
      var out = [], a = colIdx(c1), b = colIdx(c2);
      for(var r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) for(var c = Math.min(a, b); c <= Math.max(a, b); c++) out.push(val(c, r - 1));
      return out;
    }
    function evalF(src){
      try{ var fn = new Function('V', 'R', 'F', '"use strict";return (' + translateF(src) + ');'); var v = fn(V, R, FF);
        if(typeof v === 'number' && !isFinite(v)) return '#ДЕЛ/0'; if(typeof v === 'boolean') return v ? 'ИСТИНА' : 'ЛОЖЬ'; return v; }
      catch(e){ return '#ОШИБКА'; }
    }
    return rows.map(function(row, r){ return row.map(function(x, c){ return val(c, r); }); });
  }
  function fmtCell(v){
    if(typeof v === 'number'){ return Math.abs(v) >= 1000 || v % 1 ? v.toLocaleString('ru-RU', { maximumFractionDigits:2 }) : String(v); }
    return v === undefined || v === null ? '' : String(v);
  }
  function sheetObjects(txt){
    var d = parseSheet(txt), vals = computeSheet(d.rows), head = vals[0].map(function(x, i){ return String(x || colName(i)).trim(); });
    return vals.slice(1).filter(function(r){ return r.some(function(x){ return String(x).trim() !== ''; }); }).map(function(r){
      var o = {}; head.forEach(function(k, i){ o[k] = r[i]; }); return o;
    });
  }
  function rowsToAoa(rows){
    var head = []; rows.forEach(function(r){ Object.keys(r).forEach(function(k){ if(k.indexOf('__') !== 0 && head.indexOf(k) < 0) head.push(k); }); });
    return [head].concat(rows.map(function(r){ return head.map(function(k){ var v = r[k]; return v === undefined || v === null ? '' : v; }); }));
  }
  function csvOf(aoa){ return '﻿' + aoa.map(function(r){ return r.map(function(v){ v = String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n'); }
  var xlsxP = null;
  function loadXLSX(){
    if(window.XLSX) return Promise.resolve(window.XLSX);
    if(xlsxP) return xlsxP;
    xlsxP = new Promise(function(res, rej){
      var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = function(){ window.XLSX ? res(window.XLSX) : rej(new Error('xlsx')); };
      s.onerror = function(){ xlsxP = null; rej(new Error('Не удалось загрузить модуль Excel')); };
      document.head.appendChild(s);
    });
    return xlsxP;
  }
  function saveXlsx(name, aoa, sheetName){
    loadXLSX().then(function(X){
      var wb = X.utils.book_new(), ws = X.utils.aoa_to_sheet(aoa.map(function(r){ return r.map(function(v){ var n = num(v); return typeof n === 'number' ? n : v; }); }));
      ws['!cols'] = (aoa[0] || []).map(function(h, i){ var w = 8; aoa.forEach(function(r){ w = Math.max(w, String(r[i] === undefined ? '' : r[i]).length + 2); }); return { wch:Math.min(48, w) }; });
      X.utils.book_append_sheet(wb, ws, String(sheetName || 'Лист1').slice(0, 31).replace(/[\\\/?*\[\]:]/g, ' '));
      var buf = X.write(wb, { bookType:'xlsx', type:'array' });
      download(name + '.xlsx', buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Файл Excel сохранён');
    }, function(){ download(name + '.csv', csvOf(aoa), 'text/csv', 'Модуль Excel недоступен — сохранено в CSV (открывается в Excel)'); });
  }
