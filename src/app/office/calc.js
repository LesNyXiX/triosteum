  /* ---------- вычисления: формулы со ссылками на листы и другие файлы ---------- */
  var CALC = { cache:{}, busy:{} };
  function calcReset(){ CALC.cache = {}; CALC.busy = {}; }
  function sheetRef(ctx, name){
    name = String(name).trim(); var low = name.toLowerCase();
    var f = ctx.file, i;
    if(f && f.type === 'sheet') for(i = 0; i < f.data.sheets.length; i++) if(f.data.sheets[i].name.toLowerCase() === low) return { file:f, idx:i };
    var parts = name.split('/'), tf = ofByName(parts[0], 'sheet');
    if(!tf && parts.length === 1){
      // «Файл.Лист» не поддерживаем, но ищем лист с таким именем в любой книге
      var any = ofItems().filter(function(x){ return x.type === 'sheet' && x.data.sheets.some(function(s){ return s.name.toLowerCase() === low; }); })[0];
      if(any) return { file:any, idx:any.data.sheets.map(function(s){ return s.name.toLowerCase(); }).indexOf(low) };
      return null;
    }
    if(!tf) return null;
    if(parts[1]){ var j = tf.data.sheets.map(function(s){ return s.name.toLowerCase(); }).indexOf(parts[1].trim().toLowerCase()); return j < 0 ? null : { file:tf, idx:j }; }
    return { file:tf, idx:0 };
  }
  function cellVal(file, idx, c, r){
    var key = file.id + '#' + idx + ':' + c + ':' + r;
    if(key in CALC.cache) return CALC.cache[key];
    if(CALC.busy[key]) return '#ЦИКЛ';
    var sh = file.data.sheets[idx], row = sh && sh.rows[r], v = row && row[c] !== undefined ? row[c] : '';
    if(typeof v === 'string' && v.charAt(0) === '=' && v.length > 1){ CALC.busy[key] = 1; v = evalFormula2(v.slice(1), { file:file, idx:idx }); CALC.busy[key] = 0; }
    else v = num(v);
    CALC.cache[key] = v; return v;
  }
  function translateF2(src){
    var strs = [], s = src.replace(/"[^"]*"/g, function(m){ strs.push(m); return '\u0001' + (strs.length - 1) + '\u0001'; });
    var refs = [];
    s = s.replace(/(?:'([^']+)'|([A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_.]*))!\$?([A-Z]{1,3})\$?(\d+)(?:\s*:\s*\$?([A-Z]{1,3})\$?(\d+))?/g, function(m, q, w, c1, r1, c2, r2){
      refs.push('X(' + JSON.stringify(q || w) + ',"' + c1 + '",' + r1 + (c2 ? ',"' + c2 + '",' + r2 : '') + ')');
      return '\u0002' + (refs.length - 1) + '\u0002';
    });
    s = s.replace(/;/g, ',');
    s = s.replace(/([A-Za-zА-Яа-яЁё]+)\s*\(/g, function(m, name){ var f = FN[name.toUpperCase()]; if(!f) throw new Error('fn'); return 'F.' + f + '('; });
    s = s.replace(/\$?\b([A-Z]{1,3})\$?(\d+)\s*:\s*\$?([A-Z]{1,3})\$?(\d+)\b/g, function(m, a, b, c, d){ return 'R("' + a + '",' + b + ',"' + c + '",' + d + ')'; });
    s = s.replace(/\$?\b([A-Z]{1,3})\$?(\d+)\b/g, function(m, a, b){ return 'V("' + a + '",' + b + ')'; });
    s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)').replace(/<>/g, '!=').replace(/([^<>!=])=(?!=)/g, '$1==').replace(/\^/g, '**').replace(/&/g, '+');
    var check = s.replace(/"[^"]*"/g, '').replace(/\u0001\d+\u0001/g, '').replace(/\u0002\d+\u0002/g, '');
    (check.match(/[A-Za-z_][A-Za-z_0-9.]*/g) || []).forEach(function(id){ if(id !== 'V' && id !== 'R' && !/^F\.[A-Z]+$/.test(id)) throw new Error('id'); });
    if(/[^\s\d.+\-*/(),<>=!?:A-Za-z_"%]/.test(check)) throw new Error('chars');
    return s.replace(/\u0002(\d+)\u0002/g, function(m, i){ return refs[+i]; }).replace(/\u0001(\d+)\u0001/g, function(m, i){ return strs[+i]; });
  }
  function evalFormula2(src, ctx){
    if(src.indexOf('#ССЫЛКА') >= 0) return '#ССЫЛКА';
    try{
      var V = function(col, row){ return cellVal(ctx.file, ctx.idx, colIdx(col), row - 1); };
      var range = function(file, idx, c1, r1, c2, r2){ var out = [], a = colIdx(c1), b = colIdx(c2); for(var r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) for(var c = Math.min(a, b); c <= Math.max(a, b); c++) out.push(cellVal(file, idx, c, r - 1)); return out; };
      var R = function(c1, r1, c2, r2){ return range(ctx.file, ctx.idx, c1, r1, c2, r2); };
      var X = function(name, c1, r1, c2, r2){
        var t = sheetRef(ctx, name); if(!t) throw new Error('ref');
        return c2 ? range(t.file, t.idx, c1, r1, c2, r2) : cellVal(t.file, t.idx, colIdx(c1), r1 - 1);
      };
      var fn = new Function('V', 'R', 'X', 'F', '"use strict";return (' + translateF2(src) + ');');
      var v = fn(V, R, X, FF);
      if(typeof v === 'number' && !isFinite(v)) return '#ДЕЛ/0';
      if(typeof v === 'boolean') return v ? 'ИСТИНА' : 'ЛОЖЬ';
      if(Array.isArray(v)) return v[0];
      return v;
    }catch(e){ return e && e.message === 'ref' ? '#ССЫЛКА' : '#ОШИБКА'; }
  }
  function sheetValues(file, idx){
    var sh = file.data.sheets[idx || 0]; if(!sh) return [];
    return sh.rows.map(function(row, r){ return row.map(function(x, c){ return cellVal(file, idx || 0, c, r); }); });
  }
  function parseRange(s){
    var m = /^\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/.exec(String(s || '').trim().toUpperCase()); if(!m) return null;
    var c0 = colIdx(m[1]), r0 = +m[2] - 1, c1 = m[3] ? colIdx(m[3]) : c0, r1 = m[4] ? +m[4] - 1 : r0;
    return { c0:Math.min(c0, c1), r0:Math.min(r0, r1), c1:Math.max(c0, c1), r1:Math.max(r0, r1) };
  }
  function rangeStr(g){ return colName(g.c0) + (g.r0 + 1) + (g.c0 === g.c1 && g.r0 === g.r1 ? '' : ':' + colName(g.c1) + (g.r1 + 1)); }
  function usedRange(sh){ var r1 = 0, c1 = 0; sh.rows.forEach(function(row, r){ row.forEach(function(x, c){ if(String(x).trim() !== ''){ r1 = Math.max(r1, r); c1 = Math.max(c1, c); } }); }); return { c0:0, r0:0, c1:c1, r1:r1 }; }
  function rangeValues(file, idx, g){
    calcReset(); var out = [];
    for(var r = g.r0; r <= g.r1; r++){ var row = []; for(var c = g.c0; c <= g.c1; c++) row.push(cellVal(file, idx, c, r)); out.push(row); }
    return out;
  }
  var NF = [['', 'Общий'], ['num', 'Число 1 234,56'], ['int', 'Целое 1 235'], ['money', 'Деньги ₽'], ['pct', 'Процент %']];
  function fmtNum(v, nf){
    if(typeof v !== 'number') return fmtCell(v);
    if(nf === 'num') return v.toLocaleString('ru-RU', { minimumFractionDigits:2, maximumFractionDigits:2 });
    if(nf === 'int') return Math.round(v).toLocaleString('ru-RU');
    if(nf === 'money') return v.toLocaleString('ru-RU', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' ₽';
    if(nf === 'pct') return (v * 100).toLocaleString('ru-RU', { maximumFractionDigits:1 }) + '%';
    return fmtCell(v);
  }
