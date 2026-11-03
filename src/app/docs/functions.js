  /* =====================================================================
     БИБЛИОТЕКА ФУНКЦИЙ ТАБЛИЦ: математика, тригонометрия, статистика,
     условия, поиск, логика, текст, даты, финансы. Русские и английские
     имена, как в Excel. Диапазоны приходят плоским массивом с шириной .w
     ===================================================================== */
  function fErr(code){ var e = new Error(code); throw e; }
  function fNum(x){ var v = num(Array.isArray(x) ? x[0] : x); if(typeof v === 'boolean') return v ? 1 : 0; if(v === '' || v === undefined || v === null) return 0; if(typeof v !== 'number') fErr('value'); return v; }
  function fArr(x){ return Array.isArray(x) ? x : [x]; }
  function fRows(x){ var a = fArr(x), w = x && x.w || a.length || 1, out = []; for(var i = 0; i < a.length; i += w) out.push(a.slice(i, i + w)); return out; }
  function fStr(x){ x = Array.isArray(x) ? x[0] : x; return x === undefined || x === null ? '' : (typeof x === 'number' ? fmtCell(x).replace(/[  ]/g, ' ') : String(x)); }
  function fIsErr(x){ return typeof x === 'string' && /^#(ОШИБКА|ДЕЛ\/0|ССЫЛКА|ЦИКЛ|Н\/Д|ЧИСЛО!|ЗНАЧ!)/.test(x); }
  function fDate(x){
    if(x instanceof Date) return x;
    if(typeof x === 'number'){ var d0 = new Date(1899, 11, 30); d0.setDate(d0.getDate() + Math.floor(x)); return d0; }
    var s = String(x || '').trim(), m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if(m){ var y = +m[3]; if(y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return new Date(+m[1], +m[2] - 1, +m[3]);
    fErr('value');
  }
  function fDateStr(d){ return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function fDays(a, b){ return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5); }
  // условие для СУММЕСЛИ и т.п.: ">100", "<>0", "=Склад", "Скл*", "?"
  function fCrit(c){
    if(typeof c === 'number') return function(v){ return num(v) === c; };
    var s = String(c), m = s.match(/^(<=|>=|<>|<|>|=)?(.*)$/), op = m[1] || '=', val = m[2], nv = num(val);
    if(typeof nv === 'number' && val !== '') return function(v){ v = num(v); if(typeof v !== 'number') return op === '<>'; return op === '=' ? v === nv : op === '<>' ? v !== nv : op === '<' ? v < nv : op === '>' ? v > nv : op === '<=' ? v <= nv : v >= nv; };
    var re = new RegExp('^' + val.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return function(v){ var ok = re.test(v === undefined || v === null ? '' : String(v)); return op === '<>' ? !ok : ok; };
  }
  function fIfs(rng, pairs){ var a = fArr(rng); return a.map(function(_, i){ for(var k = 0; k < pairs.length; k += 2){ if(!fCrit(pairs[k + 1])(fArr(pairs[k])[i])) return false; } return true; }); }
  function fMean(a){ return a.reduce(function(s, x){ return s + x; }, 0) / a.length; }
  function fVar(a, pop){ if(a.length < (pop ? 1 : 2)) fErr('div'); var m = fMean(a); return a.reduce(function(s, x){ return s + (x - m) * (x - m); }, 0) / (a.length - (pop ? 0 : 1)); }
  function fPct(a, p){ a = a.slice().sort(function(x, y){ return x - y; }); var i = (a.length - 1) * p, lo = Math.floor(i); return a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo); }
  function fGcd(a, b){ a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while(b){ var t = b; b = a % b; a = t; } return a; }
  function fRound(x, d, mode){ var k = Math.pow(10, d || 0), v = x * k; v = mode === 'up' ? (v < 0 ? -Math.ceil(-v - 1e-9) : Math.ceil(v - 1e-9)) : (v < 0 ? -Math.floor(-v + 1e-9) : Math.floor(v + 1e-9)); return v / k; }
  function fLinReg(ys, xs){ var mx = fMean(xs), my = fMean(ys), sxy = 0, sxx = 0; xs.forEach(function(x, i){ sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) * (x - mx); }); if(!sxx) fErr('div'); var b = sxy / sxx; return { b:b, a:my - b * mx }; }
  function fNpv(r, flows){ return flows.reduce(function(s, f, i){ return s + f / Math.pow(1 + r, i + 1); }, 0); }
  function fLookup(key, list){ var k = num(key); for(var i = 0; i < list.length; i++){ var v = num(list[i]); if(typeof k === 'number' ? v === k : String(v).toLowerCase() === String(k).toLowerCase()) return i; } return -1; }
  function A(args){ return [].slice.call(args); }

  var FF_MORE = {
    // математика
    SQRT:function(x){ x = fNum(x); if(x < 0) fErr('num'); return Math.sqrt(x); },
    POWER:function(x, y){ return Math.pow(fNum(x), fNum(y)); },
    EXP:function(x){ return Math.exp(fNum(x)); },
    LN:function(x){ x = fNum(x); if(x <= 0) fErr('num'); return Math.log(x); },
    LOG:function(x, b){ x = fNum(x); if(x <= 0) fErr('num'); return b === undefined ? Math.log10(x) : Math.log(x) / Math.log(fNum(b)); },
    LOG10:function(x){ x = fNum(x); if(x <= 0) fErr('num'); return Math.log10(x); },
    PI:function(){ return Math.PI; },
    MOD:function(a, b){ a = fNum(a); b = fNum(b); if(!b) fErr('div'); return a - b * Math.floor(a / b); },
    INT:function(x){ return Math.floor(fNum(x)); },
    TRUNC:function(x, d){ return fRound(fNum(x), d === undefined ? 0 : fNum(d), 'down'); },
    ROUNDUP:function(x, d){ return fRound(fNum(x), d === undefined ? 0 : fNum(d), 'up'); },
    ROUNDDOWN:function(x, d){ return fRound(fNum(x), d === undefined ? 0 : fNum(d), 'down'); },
    CEILING:function(x, s){ s = s === undefined ? 1 : fNum(s); return s ? Math.ceil(fNum(x) / s) * s : 0; },
    FLOOR:function(x, s){ s = s === undefined ? 1 : fNum(s); return s ? Math.floor(fNum(x) / s) * s : 0; },
    MROUND:function(x, s){ s = fNum(s); return s ? Math.round(fNum(x) / s) * s : 0; },
    SIGN:function(x){ return Math.sign(fNum(x)); },
    FACT:function(x){ x = Math.floor(fNum(x)); if(x < 0) fErr('num'); var r = 1; for(var i = 2; i <= x; i++) r *= i; return r; },
    COMBIN:function(n, k){ n = Math.floor(fNum(n)); k = Math.floor(fNum(k)); if(k < 0 || k > n) fErr('num'); var r = 1; for(var i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); },
    GCD:function(){ return nums(A(arguments)).reduce(fGcd); },
    LCM:function(){ return nums(A(arguments)).reduce(function(a, b){ return Math.abs(a * b) / fGcd(a, b); }); },
    QUOTIENT:function(a, b){ b = fNum(b); if(!b) fErr('div'); return Math.trunc(fNum(a) / b); },
    EVEN:function(x){ x = fNum(x); var s = x < 0 ? -1 : 1, v = Math.ceil(Math.abs(x)); return s * (v % 2 ? v + 1 : v); },
    ODD:function(x){ x = fNum(x); var s = x < 0 ? -1 : 1, v = Math.ceil(Math.abs(x)); return s * (v % 2 ? v : v + 1); },
    PRODUCT:function(){ return nums(A(arguments)).reduce(function(s, x){ return s * x; }, 1); },
    SUMSQ:function(){ return nums(A(arguments)).reduce(function(s, x){ return s + x * x; }, 0); },
    SUMPRODUCT:function(){ var l = A(arguments).map(fArr), n = l[0].length; var s = 0; for(var i = 0; i < n; i++){ var p = 1; l.forEach(function(a){ var v = num(a[i]); p *= typeof v === 'number' ? v : 0; }); s += p; } return s; },
    RAND:function(){ return Math.random(); },
    RANDBETWEEN:function(a, b){ a = Math.ceil(fNum(a)); b = Math.floor(fNum(b)); return a + Math.floor(Math.random() * (b - a + 1)); },
    RADIANS:function(x){ return fNum(x) * Math.PI / 180; },
    DEGREES:function(x){ return fNum(x) * 180 / Math.PI; },
    // тригонометрия
    SIN:function(x){ return Math.sin(fNum(x)); }, COS:function(x){ return Math.cos(fNum(x)); }, TAN:function(x){ return Math.tan(fNum(x)); },
    COT:function(x){ var t = Math.tan(fNum(x)); if(!t) fErr('div'); return 1 / t; },
    ASIN:function(x){ x = fNum(x); if(Math.abs(x) > 1) fErr('num'); return Math.asin(x); }, ACOS:function(x){ x = fNum(x); if(Math.abs(x) > 1) fErr('num'); return Math.acos(x); },
    ATAN:function(x){ return Math.atan(fNum(x)); }, ATAN2:function(x, y){ return Math.atan2(fNum(y), fNum(x)); },
    SINH:function(x){ return Math.sinh(fNum(x)); }, COSH:function(x){ return Math.cosh(fNum(x)); }, TANH:function(x){ return Math.tanh(fNum(x)); },
    // статистика
    MEDIAN:function(){ var a = nums(A(arguments)); if(!a.length) fErr('num'); return fPct(a, 0.5); },
    MODE:function(){ var a = nums(A(arguments)), c = {}, best = null, n = 1; a.forEach(function(x){ c[x] = (c[x] || 0) + 1; if(c[x] > n){ n = c[x]; best = x; } }); if(best === null) fErr('na'); return best; },
    STDEV:function(){ return Math.sqrt(fVar(nums(A(arguments)))); }, STDEVP:function(){ return Math.sqrt(fVar(nums(A(arguments)), true)); },
    VAR:function(){ return fVar(nums(A(arguments))); }, VARP:function(){ return fVar(nums(A(arguments)), true); },
    LARGE:function(r, k){ var a = nums(fArr(r)).sort(function(x, y){ return y - x; }); k = Math.floor(fNum(k)); if(k < 1 || k > a.length) fErr('num'); return a[k - 1]; },
    SMALL:function(r, k){ var a = nums(fArr(r)).sort(function(x, y){ return x - y; }); k = Math.floor(fNum(k)); if(k < 1 || k > a.length) fErr('num'); return a[k - 1]; },
    RANK:function(x, r, asc){ x = fNum(x); var a = nums(fArr(r)); if(a.indexOf(x) < 0) fErr('na'); return a.filter(function(v){ return asc && fNum(asc) ? v < x : v > x; }).length + 1; },
    PERCENTILE:function(r, p){ p = fNum(p); if(p < 0 || p > 1) fErr('num'); return fPct(nums(fArr(r)), p); },
    QUARTILE:function(r, q){ q = Math.floor(fNum(q)); if(q < 0 || q > 4) fErr('num'); return fPct(nums(fArr(r)), q / 4); },
    COUNTA:function(){ return flat(A(arguments)).filter(function(x){ return x !== '' && x !== undefined && x !== null; }).length; },
    COUNTBLANK:function(r){ return fArr(r).filter(function(x){ return x === '' || x === undefined || x === null; }).length; },
    GEOMEAN:function(){ var a = nums(A(arguments)); if(!a.length || a.some(function(x){ return x <= 0; })) fErr('num'); return Math.exp(a.reduce(function(s, x){ return s + Math.log(x); }, 0) / a.length); },
    CORREL:function(a, b){ a = fArr(a).map(num); b = fArr(b).map(num); var x = [], y = []; a.forEach(function(v, i){ if(typeof v === 'number' && typeof b[i] === 'number'){ x.push(v); y.push(b[i]); } }); var mx = fMean(x), my = fMean(y), sxy = 0, sx = 0, sy = 0; x.forEach(function(v, i){ sxy += (v - mx) * (y[i] - my); sx += (v - mx) * (v - mx); sy += (y[i] - my) * (y[i] - my); }); if(!sx || !sy) fErr('div'); return sxy / Math.sqrt(sx * sy); },
    SLOPE:function(ys, xs){ return fLinReg(nums(fArr(ys)), nums(fArr(xs))).b; },
    INTERCEPT:function(ys, xs){ return fLinReg(nums(fArr(ys)), nums(fArr(xs))).a; },
    FORECAST:function(x, ys, xs){ var l = fLinReg(nums(fArr(ys)), nums(fArr(xs))); return l.a + l.b * fNum(x); },
    // условия
    SUMIF:function(r, c, s){ var a = fArr(r), b = s === undefined ? a : fArr(s), f = fCrit(c); return a.reduce(function(t, v, i){ var x = num(b[i]); return t + (f(v) && typeof x === 'number' ? x : 0); }, 0); },
    COUNTIF:function(r, c){ var f = fCrit(c); return fArr(r).filter(function(v){ return f(v); }).length; },
    AVERAGEIF:function(r, c, s){ var a = fArr(r), b = s === undefined ? a : fArr(s), f = fCrit(c), l = []; a.forEach(function(v, i){ var x = num(b[i]); if(f(v) && typeof x === 'number') l.push(x); }); if(!l.length) fErr('div'); return fMean(l); },
    SUMIFS:function(s){ var ok = fIfs(s, A(arguments).slice(1)); return fArr(s).reduce(function(t, v, i){ var x = num(v); return t + (ok[i] && typeof x === 'number' ? x : 0); }, 0); },
    COUNTIFS:function(){ var p = A(arguments); return fIfs(p[0], p).filter(Boolean).length; },
    AVERAGEIFS:function(s){ var ok = fIfs(s, A(arguments).slice(1)), l = fArr(s).map(num).filter(function(x, i){ return ok[i] && typeof x === 'number'; }); if(!l.length) fErr('div'); return fMean(l); },
    MAXIFS:function(s){ var ok = fIfs(s, A(arguments).slice(1)), l = fArr(s).map(num).filter(function(x, i){ return ok[i] && typeof x === 'number'; }); return l.length ? Math.max.apply(0, l) : 0; },
    MINIFS:function(s){ var ok = fIfs(s, A(arguments).slice(1)), l = fArr(s).map(num).filter(function(x, i){ return ok[i] && typeof x === 'number'; }); return l.length ? Math.min.apply(0, l) : 0; },
    // поиск
    VLOOKUP:function(key, r, col, exact){
      var rows = fRows(r), c = Math.floor(fNum(col)) - 1; if(c < 0 || c >= (r.w || 1)) fErr('ref');
      var approx = exact !== undefined && (exact === true || exact === 'ИСТИНА' || fNum(exact) === 1);
      if(!approx){ var i = fLookup(key, rows.map(function(x){ return x[0]; })); if(i < 0) fErr('na'); return rows[i][c]; }
      var k = fNum(key), best = -1; rows.forEach(function(x, i){ var v = num(x[0]); if(typeof v === 'number' && v <= k) best = i; }); if(best < 0) fErr('na'); return rows[best][c];
    },
    HLOOKUP:function(key, r, row){
      var rows = fRows(r), k = Math.floor(fNum(row)) - 1; if(k < 0 || k >= rows.length) fErr('ref');
      var i = fLookup(key, rows[0]); if(i < 0) fErr('na'); return rows[k][i];
    },
    INDEX:function(r, row, col){ var rows = fRows(r), i = Math.floor(fNum(row)) - 1, j = col === undefined ? 0 : Math.floor(fNum(col)) - 1; if((r.w || 1) === 1 && col === undefined){ j = 0; } if(!rows[i] || rows[i][j] === undefined) fErr('ref'); return rows[i][j]; },
    MATCH:function(key, r, type){
      var a = fArr(r); type = type === undefined ? 1 : fNum(type);
      if(type === 0){ var i = fLookup(key, a); if(i < 0) fErr('na'); return i + 1; }
      var k = fNum(key), best = -1; a.forEach(function(v, i){ v = num(v); if(typeof v === 'number' && (type > 0 ? v <= k : v >= k)) best = i; }); if(best < 0) fErr('na'); return best + 1;
    },
    XLOOKUP:function(key, look, ret, nf){ var i = fLookup(key, fArr(look)); if(i < 0){ if(nf !== undefined) return nf; fErr('na'); } return fArr(ret)[i]; },
    CHOOSE:function(i){ var a = A(arguments); i = Math.floor(fNum(i)); if(i < 1 || i >= a.length) fErr('value'); return a[i]; },
    // логика
    NOT:function(x){ return !(Array.isArray(x) ? x[0] : x); },
    XOR:function(){ return flat(A(arguments)).filter(Boolean).length % 2 === 1; },
    IFERROR:function(v, alt){ return fIsErr(v) ? alt : v; },
    IFNA:function(v, alt){ return v === '#Н/Д' ? alt : v; },
    IFS:function(){ var a = A(arguments); for(var i = 0; i < a.length; i += 2){ if(a[i]) return a[i + 1]; } fErr('na'); },
    SWITCH:function(v){ var a = A(arguments).slice(1); for(var i = 0; i + 1 < a.length; i += 2){ if(num(a[i]) === num(v) || String(a[i]) === String(v)) return a[i + 1]; } if(a.length % 2) return a[a.length - 1]; fErr('na'); },
    ISNUMBER:function(x){ return typeof num(x) === 'number'; }, ISTEXT:function(x){ x = Array.isArray(x) ? x[0] : x; return typeof num(x) !== 'number' && x !== '' && !fIsErr(x); },
    ISBLANK:function(x){ x = Array.isArray(x) ? x[0] : x; return x === '' || x === undefined || x === null; }, ISERROR:function(x){ return fIsErr(Array.isArray(x) ? x[0] : x); },
    TRUE:function(){ return true; }, FALSE:function(){ return false; },
    // текст
    LEN:function(s){ return fStr(s).length; },
    LEFT:function(s, n){ return fStr(s).slice(0, n === undefined ? 1 : fNum(n)); },
    RIGHT:function(s, n){ s = fStr(s); n = n === undefined ? 1 : fNum(n); return n ? s.slice(-n) : ''; },
    MID:function(s, a, n){ return fStr(s).substr(fNum(a) - 1, fNum(n)); },
    UPPER:function(s){ return fStr(s).toUpperCase(); }, LOWER:function(s){ return fStr(s).toLowerCase(); },
    PROPER:function(s){ return fStr(s).toLowerCase().replace(/(^|[^a-zа-яё])([a-zа-яё])/g, function(m, a, b){ return a + b.toUpperCase(); }); },
    TRIM:function(s){ return fStr(s).replace(/\s+/g, ' ').trim(); },
    SUBSTITUTE:function(s, a, b){ return fStr(s).split(fStr(a)).join(fStr(b)); },
    FIND:function(a, s, st){ var i = fStr(s).indexOf(fStr(a), (st === undefined ? 1 : fNum(st)) - 1); if(i < 0) fErr('value'); return i + 1; },
    SEARCH:function(a, s, st){ var i = fStr(s).toLowerCase().indexOf(fStr(a).toLowerCase(), (st === undefined ? 1 : fNum(st)) - 1); if(i < 0) fErr('value'); return i + 1; },
    REPT:function(s, n){ return new Array(Math.max(0, Math.floor(fNum(n))) + 1).join(fStr(s)); },
    VALUE:function(s){ var v = num(fStr(s)); if(typeof v !== 'number') fErr('value'); return v; },
    TEXT:function(v, f){
      f = fStr(f); var x = num(Array.isArray(v) ? v[0] : v);
      if(typeof x !== 'number') return fStr(v);
      if(/%$/.test(f)){ var d = (f.split(/[.,]/)[1] || '').replace('%', '').length; return (x * 100).toFixed(d).replace('.', ',') + '%'; }
      var dec = (f.split(/[.,]/)[1] || '').replace(/[^0#]/g, '').length, grp = /#\s|0\s|# |\s0/.test(f) || /#,##|# ##/.test(f);
      var s = x.toLocaleString('ru-RU', { minimumFractionDigits:dec, maximumFractionDigits:dec, useGrouping:grp }); return s.replace(/[  ]/g, ' ');
    },
    TEXTJOIN:function(sep, skip){ var a = flat(A(arguments).slice(2)).map(fStr); if(skip && fNum(skip)) a = a.filter(function(x){ return x !== ''; }); return a.join(fStr(sep)); },
    // даты (дд.мм.гггг)
    DATE:function(y, m, d){ return fDateStr(new Date(fNum(y), fNum(m) - 1, fNum(d))); },
    YEAR:function(d){ return fDate(Array.isArray(d) ? d[0] : d).getFullYear(); }, MONTH:function(d){ return fDate(Array.isArray(d) ? d[0] : d).getMonth() + 1; }, DAY:function(d){ return fDate(Array.isArray(d) ? d[0] : d).getDate(); },
    WEEKDAY:function(d, t){ var w = fDate(Array.isArray(d) ? d[0] : d).getDay(); return t !== undefined && fNum(t) === 2 ? (w || 7) : w + 1; },
    DAYS:function(b, a){ return fDays(fDate(a), fDate(b)); },
    DATEDIF:function(a, b, u){ a = fDate(a); b = fDate(b); u = fStr(u).toLowerCase(); if(b < a) fErr('num'); if(u === 'd') return fDays(a, b); var m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0); return u === 'm' ? m : Math.floor(m / 12); },
    EDATE:function(d, n){ d = fDate(d); return fDateStr(new Date(d.getFullYear(), d.getMonth() + fNum(n), d.getDate())); },
    EOMONTH:function(d, n){ d = fDate(d); return fDateStr(new Date(d.getFullYear(), d.getMonth() + fNum(n) + 1, 0)); },
    NETWORKDAYS:function(a, b){ a = fDate(a); b = fDate(b); var s = a <= b ? 1 : -1, n = 0, d = new Date(a); while(s > 0 ? d <= b : d >= b){ var w = d.getDay(); if(w && w !== 6) n++; d.setDate(d.getDate() + s); } return n * s; },
    NOW:function(){ var d = new Date(); return fDateStr(d) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); },
    // финансы
    PMT:function(r, n, pv, fv){ r = fNum(r); n = fNum(n); pv = fNum(pv); fv = fv === undefined ? 0 : fNum(fv); if(!r) return -(pv + fv) / n; var k = Math.pow(1 + r, n); return -(pv * k + fv) * r / (k - 1); },
    FV:function(r, n, pmt, pv){ r = fNum(r); n = fNum(n); pmt = fNum(pmt); pv = pv === undefined ? 0 : fNum(pv); if(!r) return -(pv + pmt * n); var k = Math.pow(1 + r, n); return -(pv * k + pmt * (k - 1) / r); },
    PV:function(r, n, pmt, fv){ r = fNum(r); n = fNum(n); pmt = fNum(pmt); fv = fv === undefined ? 0 : fNum(fv); if(!r) return -(fv + pmt * n); var k = Math.pow(1 + r, n); return -(fv + pmt * (k - 1) / r) / k; },
    NPV:function(r){ return fNpv(fNum(r), nums(A(arguments).slice(1))); },
    IRR:function(r){ var f = nums(fArr(r)), lo = -0.99, hi = 10, g = function(x){ return f.reduce(function(s, v, i){ return s + v / Math.pow(1 + x, i); }, 0); }; if(g(lo) * g(hi) > 0) fErr('num'); for(var i = 0; i < 200; i++){ var m = (lo + hi) / 2; if(g(lo) * g(m) <= 0) hi = m; else lo = m; } return (lo + hi) / 2; }
  };
  // имена: русское и английское → внутреннее; [категория, рус, англ, синтаксис, описание]
  var FUNC_DOCS = [
    ['Математика', 'СУММ', 'SUM', 'СУММ(A1:A9)', 'Сумма чисел'], ['Математика', 'ОКРУГЛ', 'ROUND', 'ОКРУГЛ(число; знаков)', 'Округление'],
    ['Математика', 'ОКРУГЛВВЕРХ', 'ROUNDUP', 'ОКРУГЛВВЕРХ(число; знаков)', 'Округление от нуля'], ['Математика', 'ОКРУГЛВНИЗ', 'ROUNDDOWN', 'ОКРУГЛВНИЗ(число; знаков)', 'Округление к нулю'],
    ['Математика', 'ОКРВВЕРХ', 'CEILING', 'ОКРВВЕРХ(число; шаг)', 'Вверх до кратного шагу'], ['Математика', 'ОКРВНИЗ', 'FLOOR', 'ОКРВНИЗ(число; шаг)', 'Вниз до кратного шагу'],
    ['Математика', 'ОКРУГЛТ', 'MROUND', 'ОКРУГЛТ(число; шаг)', 'До ближайшего кратного'], ['Математика', 'ОТБР', 'TRUNC', 'ОТБР(число; знаков)', 'Отбросить дробную часть'],
    ['Математика', 'ЦЕЛОЕ', 'INT', 'ЦЕЛОЕ(число)', 'Целая часть вниз'], ['Математика', 'ОСТАТ', 'MOD', 'ОСТАТ(число; делитель)', 'Остаток от деления'],
    ['Математика', 'ЧАСТНОЕ', 'QUOTIENT', 'ЧАСТНОЕ(число; делитель)', 'Целая часть частного'], ['Математика', 'ABS', 'ABS', 'ABS(число)', 'Модуль числа'],
    ['Математика', 'ЗНАК', 'SIGN', 'ЗНАК(число)', '1, 0 или −1'], ['Математика', 'КОРЕНЬ', 'SQRT', 'КОРЕНЬ(число)', 'Квадратный корень'],
    ['Математика', 'СТЕПЕНЬ', 'POWER', 'СТЕПЕНЬ(число; степень)', 'Возведение в степень (или ^)'], ['Математика', 'EXP', 'EXP', 'EXP(x)', 'e в степени x'],
    ['Математика', 'LN', 'LN', 'LN(x)', 'Натуральный логарифм'], ['Математика', 'LOG', 'LOG', 'LOG(x; основание)', 'Логарифм (по умолчанию десятичный)'],
    ['Математика', 'LOG10', 'LOG10', 'LOG10(x)', 'Десятичный логарифм'], ['Математика', 'ПИ', 'PI', 'ПИ()', 'Число π'],
    ['Математика', 'ФАКТР', 'FACT', 'ФАКТР(n)', 'Факториал'], ['Математика', 'ЧИСЛКОМБ', 'COMBIN', 'ЧИСЛКОМБ(n; k)', 'Число сочетаний'],
    ['Математика', 'НОД', 'GCD', 'НОД(a; b; …)', 'Наибольший общий делитель'], ['Математика', 'НОК', 'LCM', 'НОК(a; b; …)', 'Наименьшее общее кратное'],
    ['Математика', 'ПРОИЗВЕД', 'PRODUCT', 'ПРОИЗВЕД(A1:A9)', 'Произведение'], ['Математика', 'СУММКВ', 'SUMSQ', 'СУММКВ(A1:A9)', 'Сумма квадратов'],
    ['Математика', 'СУММПРОИЗВ', 'SUMPRODUCT', 'СУММПРОИЗВ(A1:A9; B1:B9)', 'Сумма попарных произведений'], ['Математика', 'ЧЁТН', 'EVEN', 'ЧЁТН(число)', 'До ближайшего чётного'],
    ['Математика', 'НЕЧЁТ', 'ODD', 'НЕЧЁТ(число)', 'До ближайшего нечётного'], ['Математика', 'СЛЧИС', 'RAND', 'СЛЧИС()', 'Случайное от 0 до 1'],
    ['Математика', 'СЛУЧМЕЖДУ', 'RANDBETWEEN', 'СЛУЧМЕЖДУ(от; до)', 'Случайное целое'], ['Математика', 'РАДИАНЫ', 'RADIANS', 'РАДИАНЫ(градусы)', 'Градусы в радианы'],
    ['Математика', 'ГРАДУСЫ', 'DEGREES', 'ГРАДУСЫ(радианы)', 'Радианы в градусы'],
    ['Тригонометрия', 'SIN', 'SIN', 'SIN(радианы)', 'Синус'], ['Тригонометрия', 'COS', 'COS', 'COS(радианы)', 'Косинус'], ['Тригонометрия', 'TAN', 'TAN', 'TAN(радианы)', 'Тангенс'],
    ['Тригонометрия', 'COT', 'COT', 'COT(радианы)', 'Котангенс'], ['Тригонометрия', 'ASIN', 'ASIN', 'ASIN(x)', 'Арксинус'], ['Тригонометрия', 'ACOS', 'ACOS', 'ACOS(x)', 'Арккосинус'],
    ['Тригонометрия', 'ATAN', 'ATAN', 'ATAN(x)', 'Арктангенс'], ['Тригонометрия', 'ATAN2', 'ATAN2', 'ATAN2(x; y)', 'Угол точки (x; y)'],
    ['Тригонометрия', 'SINH', 'SINH', 'SINH(x)', 'Гиперболический синус'], ['Тригонометрия', 'COSH', 'COSH', 'COSH(x)', 'Гиперболический косинус'], ['Тригонометрия', 'TANH', 'TANH', 'TANH(x)', 'Гиперболический тангенс'],
    ['Статистика', 'СРЗНАЧ', 'AVERAGE', 'СРЗНАЧ(A1:A9)', 'Среднее'], ['Статистика', 'МИН', 'MIN', 'МИН(A1:A9)', 'Минимум'], ['Статистика', 'МАКС', 'MAX', 'МАКС(A1:A9)', 'Максимум'],
    ['Статистика', 'СЧЁТ', 'COUNT', 'СЧЁТ(A1:A9)', 'Сколько чисел'], ['Статистика', 'СЧЁТЗ', 'COUNTA', 'СЧЁТЗ(A1:A9)', 'Сколько непустых'], ['Статистика', 'СЧИТАТЬПУСТОТЫ', 'COUNTBLANK', 'СЧИТАТЬПУСТОТЫ(A1:A9)', 'Сколько пустых'],
    ['Статистика', 'МЕДИАНА', 'MEDIAN', 'МЕДИАНА(A1:A9)', 'Медиана'], ['Статистика', 'МОДА', 'MODE', 'МОДА(A1:A9)', 'Самое частое значение'],
    ['Статистика', 'СТАНДОТКЛОН', 'STDEV', 'СТАНДОТКЛОН(A1:A9)', 'Стандартное отклонение (выборка)'], ['Статистика', 'СТАНДОТКЛОНП', 'STDEVP', 'СТАНДОТКЛОНП(A1:A9)', 'Стандартное отклонение (совокупность)'],
    ['Статистика', 'ДИСП', 'VAR', 'ДИСП(A1:A9)', 'Дисперсия (выборка)'], ['Статистика', 'ДИСПР', 'VARP', 'ДИСПР(A1:A9)', 'Дисперсия (совокупность)'],
    ['Статистика', 'НАИБОЛЬШИЙ', 'LARGE', 'НАИБОЛЬШИЙ(A1:A9; k)', 'k-е по величине'], ['Статистика', 'НАИМЕНЬШИЙ', 'SMALL', 'НАИМЕНЬШИЙ(A1:A9; k)', 'k-е наименьшее'],
    ['Статистика', 'РАНГ', 'RANK', 'РАНГ(число; A1:A9; 0)', 'Место числа в списке'], ['Статистика', 'ПЕРСЕНТИЛЬ', 'PERCENTILE', 'ПЕРСЕНТИЛЬ(A1:A9; 0,9)', 'Перцентиль'],
    ['Статистика', 'КВАРТИЛЬ', 'QUARTILE', 'КВАРТИЛЬ(A1:A9; 1)', 'Квартиль'], ['Статистика', 'СРГЕОМ', 'GEOMEAN', 'СРГЕОМ(A1:A9)', 'Среднее геометрическое'],
    ['Статистика', 'КОРРЕЛ', 'CORREL', 'КОРРЕЛ(A1:A9; B1:B9)', 'Корреляция'], ['Статистика', 'НАКЛОН', 'SLOPE', 'НАКЛОН(y; x)', 'Наклон линии тренда'],
    ['Статистика', 'ОТРЕЗОК', 'INTERCEPT', 'ОТРЕЗОК(y; x)', 'Сдвиг линии тренда'], ['Статистика', 'ПРЕДСКАЗ', 'FORECAST', 'ПРЕДСКАЗ(x; y; x)', 'Прогноз по линейному тренду'],
    ['Условия', 'СУММЕСЛИ', 'SUMIF', 'СУММЕСЛИ(A1:A9; ">100"; B1:B9)', 'Сумма по условию'], ['Условия', 'СЧЁТЕСЛИ', 'COUNTIF', 'СЧЁТЕСЛИ(A1:A9; "Склад")', 'Количество по условию'],
    ['Условия', 'СРЗНАЧЕСЛИ', 'AVERAGEIF', 'СРЗНАЧЕСЛИ(A1:A9; ">0")', 'Среднее по условию'], ['Условия', 'СУММЕСЛИМН', 'SUMIFS', 'СУММЕСЛИМН(сумма; диапазон1; условие1; …)', 'Сумма по нескольким условиям'],
    ['Условия', 'СЧЁТЕСЛИМН', 'COUNTIFS', 'СЧЁТЕСЛИМН(диапазон1; условие1; …)', 'Количество по нескольким условиям'], ['Условия', 'СРЗНАЧЕСЛИМН', 'AVERAGEIFS', 'СРЗНАЧЕСЛИМН(значения; диапазон1; условие1; …)', 'Среднее по нескольким условиям'],
    ['Условия', 'МАКСЕСЛИ', 'MAXIFS', 'МАКСЕСЛИ(значения; диапазон1; условие1)', 'Максимум по условию'], ['Условия', 'МИНЕСЛИ', 'MINIFS', 'МИНЕСЛИ(значения; диапазон1; условие1)', 'Минимум по условию'],
    ['Поиск', 'ВПР', 'VLOOKUP', 'ВПР(искомое; A1:C9; 3; 0)', 'Найти строку по первому столбцу и вернуть значение'], ['Поиск', 'ГПР', 'HLOOKUP', 'ГПР(искомое; A1:H3; 2)', 'То же по первой строке'],
    ['Поиск', 'ПРОСМОТРX', 'XLOOKUP', 'ПРОСМОТРX(искомое; A1:A9; C1:C9; "нет")', 'Найти и вернуть из другого столбца'], ['Поиск', 'ИНДЕКС', 'INDEX', 'ИНДЕКС(A1:C9; строка; столбец)', 'Значение по номеру'],
    ['Поиск', 'ПОИСКПОЗ', 'MATCH', 'ПОИСКПОЗ(искомое; A1:A9; 0)', 'Номер позиции в списке'], ['Поиск', 'ВЫБОР', 'CHOOSE', 'ВЫБОР(номер; вариант1; вариант2; …)', 'Выбор по номеру'],
    ['Логика', 'ЕСЛИ', 'IF', 'ЕСЛИ(условие; да; нет)', 'Условие'], ['Логика', 'ЕСЛИМН', 'IFS', 'ЕСЛИМН(усл1; знач1; усл2; знач2)', 'Несколько условий подряд'],
    ['Логика', 'ПЕРЕКЛЮЧ', 'SWITCH', 'ПЕРЕКЛЮЧ(значение; вариант1; результат1; …; иначе)', 'Выбор по значению'], ['Логика', 'ЕСЛИОШИБКА', 'IFERROR', 'ЕСЛИОШИБКА(формула; если ошибка)', 'Замена ошибки'],
    ['Логика', 'ЕСНД', 'IFNA', 'ЕСНД(формула; если нет)', 'Замена #Н/Д'], ['Логика', 'И', 'AND', 'И(усл1; усл2)', 'Все условия верны'], ['Логика', 'ИЛИ', 'OR', 'ИЛИ(усл1; усл2)', 'Хотя бы одно верно'],
    ['Логика', 'НЕ', 'NOT', 'НЕ(условие)', 'Отрицание'], ['Логика', 'ИСКЛИЛИ', 'XOR', 'ИСКЛИЛИ(усл1; усл2)', 'Нечётное число верных'],
    ['Логика', 'ЕЧИСЛО', 'ISNUMBER', 'ЕЧИСЛО(A1)', 'Это число?'], ['Логика', 'ЕТЕКСТ', 'ISTEXT', 'ЕТЕКСТ(A1)', 'Это текст?'], ['Логика', 'ЕПУСТО', 'ISBLANK', 'ЕПУСТО(A1)', 'Ячейка пустая?'], ['Логика', 'ЕОШИБКА', 'ISERROR', 'ЕОШИБКА(A1)', 'Это ошибка?'],
    ['Текст', 'СЦЕП', 'CONCAT', 'СЦЕП(A1; " "; B1)', 'Склеить текст (или &)'], ['Текст', 'ОБЪЕДИНИТЬ', 'TEXTJOIN', 'ОБЪЕДИНИТЬ(", "; 1; A1:A9)', 'Склеить через разделитель'],
    ['Текст', 'ДЛСТР', 'LEN', 'ДЛСТР(A1)', 'Длина текста'], ['Текст', 'ЛЕВСИМВ', 'LEFT', 'ЛЕВСИМВ(A1; 3)', 'Первые символы'], ['Текст', 'ПРАВСИМВ', 'RIGHT', 'ПРАВСИМВ(A1; 3)', 'Последние символы'],
    ['Текст', 'ПСТР', 'MID', 'ПСТР(A1; начало; длина)', 'Часть текста'], ['Текст', 'ПРОПИСН', 'UPPER', 'ПРОПИСН(A1)', 'ВСЕ ЗАГЛАВНЫЕ'], ['Текст', 'СТРОЧН', 'LOWER', 'СТРОЧН(A1)', 'все строчные'],
    ['Текст', 'ПРОПНАЧ', 'PROPER', 'ПРОПНАЧ(A1)', 'Каждое Слово С Заглавной'], ['Текст', 'СЖПРОБЕЛЫ', 'TRIM', 'СЖПРОБЕЛЫ(A1)', 'Убрать лишние пробелы'],
    ['Текст', 'ПОДСТАВИТЬ', 'SUBSTITUTE', 'ПОДСТАВИТЬ(A1; "старое"; "новое")', 'Замена текста'], ['Текст', 'НАЙТИ', 'FIND', 'НАЙТИ("x"; A1)', 'Позиция (с учётом регистра)'],
    ['Текст', 'ПОИСК', 'SEARCH', 'ПОИСК("x"; A1)', 'Позиция (без учёта регистра)'], ['Текст', 'ПОВТОР', 'REPT', 'ПОВТОР("-"; 10)', 'Повторить текст'],
    ['Текст', 'ТЕКСТ', 'TEXT', 'ТЕКСТ(A1; "# ##0,00")', 'Число в текст по формату'], ['Текст', 'ЗНАЧЕН', 'VALUE', 'ЗНАЧЕН("123")', 'Текст в число'],
    ['Даты', 'СЕГОДНЯ', 'TODAY', 'СЕГОДНЯ()', 'Сегодняшняя дата'], ['Даты', 'ТДАТА', 'NOW', 'ТДАТА()', 'Дата и время'], ['Даты', 'ДАТА', 'DATE', 'ДАТА(2026; 11; 3)', 'Дата из чисел'],
    ['Даты', 'ГОД', 'YEAR', 'ГОД(A1)', 'Год'], ['Даты', 'МЕСЯЦ', 'MONTH', 'МЕСЯЦ(A1)', 'Месяц'], ['Даты', 'ДЕНЬ', 'DAY', 'ДЕНЬ(A1)', 'День'], ['Даты', 'ДЕНЬНЕД', 'WEEKDAY', 'ДЕНЬНЕД(A1; 2)', 'День недели (2 — с понедельника)'],
    ['Даты', 'ДНИ', 'DAYS', 'ДНИ(конец; начало)', 'Дней между датами'], ['Даты', 'РАЗНДАТ', 'DATEDIF', 'РАЗНДАТ(начало; конец; "m")', 'Разница в днях "d", месяцах "m", годах "y"'],
    ['Даты', 'ДАТАМЕС', 'EDATE', 'ДАТАМЕС(A1; 3)', 'Дата через N месяцев'], ['Даты', 'КОНМЕСЯЦА', 'EOMONTH', 'КОНМЕСЯЦА(A1; 0)', 'Последний день месяца'],
    ['Даты', 'ЧИСТРАБДНИ', 'NETWORKDAYS', 'ЧИСТРАБДНИ(начало; конец)', 'Рабочие дни (пн–пт)'],
    ['Финансы', 'ПЛТ', 'PMT', 'ПЛТ(16%/12; 24; -10000000)', 'Платёж по кредиту'], ['Финансы', 'БС', 'FV', 'БС(ставка; периодов; платёж; пс)', 'Будущая стоимость'],
    ['Финансы', 'ПС', 'PV', 'ПС(ставка; периодов; платёж)', 'Текущая стоимость'], ['Финансы', 'ЧПС', 'NPV', 'ЧПС(18%; B2:B6)', 'Чистая приведённая стоимость'], ['Финансы', 'ВСД', 'IRR', 'ВСД(B1:B6)', 'Внутренняя доходность']
  ];
  var FN_ALIAS = { AVERAGE:'AVG', 'СРЗНАЧ':'AVG', 'СЧЕТ':'COUNT', 'СЧЕТЗ':'COUNTA', 'СЧЕТЕСЛИ':'COUNTIF', 'СЧЕТЕСЛИМН':'COUNTIFS', 'ЧЕТН':'EVEN', 'НЕЧЕТ':'ODD', 'ИСТИНА':'TRUE', 'ЛОЖЬ':'FALSE', 'STDEV.S':'STDEV', 'STDEV.P':'STDEVP', 'VAR.S':'VAR', 'VAR.P':'VARP', 'MODE.SNGL':'MODE', 'CEILING.MATH':'CEILING', 'FLOOR.MATH':'FLOOR', 'СТАНДОТКЛОН.В':'STDEV', 'СТАНДОТКЛОН.Г':'STDEVP' };
  (function(){
    for(var k in FF_MORE) FF[k] = FF_MORE[k];
    FUNC_DOCS.forEach(function(d){ var key = FN[d[2]] || FN[d[1]] || (FF[d[2]] ? d[2] : null) || FN_ALIAS[d[2]]; if(!key) return; FN[d[1]] = key; FN[d[2]] = key; });
    for(var a in FN_ALIAS) FN[a] = FN_ALIAS[a];
  })();
  // функции получают ошибку аргумента → передают её дальше (как в Excel), а ЕСЛИОШИБКА и ЕОШИБКА её ловят
  var FF_SAFE = {}, FF_CATCH = { IFERROR:1, IFNA:1, ISERROR:1, ISBLANK:1, ISTEXT:1, ISNUMBER:1, COUNTA:1, COUNTBLANK:1, IF:1, IFS:1, CHOOSE:1, SWITCH:1 };
  function ffSafe(){
    Object.keys(FF).forEach(function(k){
      if(FF_SAFE[k] && FF_SAFE[k].src === FF[k]) return;
      var fn = FF[k], w = function(){
        if(!FF_CATCH[k]){ var bad = flat([].slice.call(arguments)).filter(fIsErr)[0]; if(bad) return bad; }
        try{ return fn.apply(null, arguments); }catch(e){ return fErrCode(e); }
      };
      w.src = fn; FF_SAFE[k] = w;
    });
    return FF_SAFE;
  }
  // ошибки функций → коды ячеек, как в Excel
  function fErrCode(e){ var m = e && e.message; return m === 'ref' ? '#ССЫЛКА' : m === 'na' ? '#Н/Д' : m === 'num' ? '#ЧИСЛО!' : m === 'div' ? '#ДЕЛ/0' : m === 'value' ? '#ЗНАЧ!' : '#ОШИБКА'; }
  // единый переводчик имён функций и логических констант для обоих движков формул
  function fnPrep(s){
    s = s.replace(/(^|[^A-Za-zА-Яа-яЁё0-9_.])(ИСТИНА|ЛОЖЬ|TRUE|FALSE)(?![A-Za-zА-Яа-яЁё0-9_.(])/g, function(m, a, b){ return a + (b === 'ИСТИНА' || b === 'TRUE' ? 'true' : 'false'); });
    return s.replace(/([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9.]*)\s*\(/g, function(m, name){ var f = FN[name.toUpperCase()]; if(!f) throw new Error('fn'); return 'F.' + f + '('; });
  }
