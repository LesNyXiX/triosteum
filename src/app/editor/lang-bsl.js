  /* =====================================================================
     ВСТРОЕННЫЙ ИСПОЛНИТЕЛЬ 1С (встроенный язык и язык запросов).
     Код блока выполняется прямо в Triosteum. Запросы (ВЫБРАТЬ … ИЗ …)
     работают над данными схемы: таблица «Документ.ЗаказКлиента» берётся
     из входных данных блока (по имени или вся входная таблица).
     ===================================================================== */
  var BSL_KW = {
    'процедура':'proc', 'procedure':'proc', 'функция':'func', 'function':'func', 'конецпроцедуры':'endproc', 'endprocedure':'endproc', 'конецфункции':'endfunc', 'endfunction':'endfunc',
    'экспорт':'export', 'export':'export', 'перем':'var', 'var':'var', 'знач':'val', 'val':'val', 'если':'if', 'if':'if', 'тогда':'then', 'then':'then', 'иначеесли':'elsif', 'elsif':'elsif',
    'иначе':'else', 'else':'else', 'конецесли':'endif', 'endif':'endif', 'для':'for', 'for':'for', 'каждого':'each', 'each':'each', 'из':'in', 'in':'in', 'по':'to', 'to':'to',
    'цикл':'do', 'do':'do', 'конеццикла':'enddo', 'enddo':'enddo', 'пока':'while', 'while':'while', 'прервать':'break', 'break':'break', 'продолжить':'continue', 'continue':'continue',
    'возврат':'return', 'return':'return', 'новый':'new', 'new':'new', 'и':'and', 'and':'and', 'или':'or', 'or':'or', 'не':'not', 'not':'not', 'истина':'true', 'true':'true',
    'ложь':'false', 'false':'false', 'неопределено':'undef', 'undefined':'undef', 'null':'null', 'попытка':'try', 'try':'try', 'исключение':'except', 'except':'except',
    'конецпопытки':'endtry', 'endtry':'endtry', 'вызватьисключение':'raise', 'raise':'raise', 'перейти':'goto', 'goto':'goto'
  };
  function BslErr(msg, line){ var e = new Error(msg + (line ? ' (строка ' + line + ')' : '')); e.bsl = true; return e; }
  function bslTokens(src){
    var t = [], i = 0, n = src.length, line = 1;
    function push(type, v, extra){ var o = { t:type, v:v, line:line }; if(extra) for(var k in extra) o[k] = extra[k]; t.push(o); }
    while(i < n){
      var c = src[i];
      if(c === '\n'){ line++; i++; continue; }
      if(/\s/.test(c)){ i++; continue; }
      if(c === '/' && src[i + 1] === '/'){ while(i < n && src[i] !== '\n') i++; continue; }
      if((c === '#' || c === '&') && (t.length === 0 || t[t.length - 1].line < line)){ while(i < n && src[i] !== '\n') i++; continue; }
      if(c === '"'){
        var s = ''; i++;
        while(i < n){
          if(src[i] === '"'){ if(src[i + 1] === '"'){ s += '"'; i += 2; continue; } i++; break; }
          if(src[i] === '\n'){ line++; s += '\n'; i++; while(i < n && /[ \t]/.test(src[i])) i++; if(src[i] === '|') i++; else if(src[i] === '/' && src[i + 1] === '/'){ while(i < n && src[i] !== '\n') i++; } continue; }
          s += src[i++];
        }
        // строка может продолжаться следующим литералом через перевод строки: "…" \n "|…"
        push('str', s); continue;
      }
      if(c === "'"){ var e2 = src.indexOf("'", i + 1), d = src.slice(i + 1, e2).replace(/\D/g, ''); push('date', new Date(+d.slice(0, 4), +(d.slice(4, 6) || 1) - 1, +(d.slice(6, 8) || 1), +(d.slice(8, 10) || 0), +(d.slice(10, 12) || 0), +(d.slice(12, 14) || 0))); i = e2 + 1; continue; }
      if(/[0-9]/.test(c)){ var m = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i)); push('num', parseFloat(m[0])); i += m[0].length; continue; }
      if(/[A-Za-z_\u0400-\u04FF]/.test(c)){ var m2 = /^[A-Za-z_\u0400-\u04FF][\w\u0400-\u04FF]*/.exec(src.slice(i)), w = m2[0], lw = w.toLowerCase().replace(/ё/g, 'е'); if(BSL_KW[lw]) push('kw', BSL_KW[lw], { raw:w }); else push('id', w, { lo:lw }); i += w.length; continue; }
      var two = src.substr(i, 2);
      if(two === '<>' || two === '<=' || two === '>='){ push('op', two); i += 2; continue; }
      if(c === '~'){ var m3 = /^~[\w\u0400-\u04FF]+:?/.exec(src.slice(i)); i += m3 ? m3[0].length : 1; continue; }
      push('op', c); i++;
    }
    push('eof', null);
    return t;
  }
  function BslParser(src){ this.tk = bslTokens(src); this.p = 0; }
  var BP = BslParser.prototype;
  BP.peek = function(o){ return this.tk[this.p + (o || 0)]; };
  BP.next = function(){ return this.tk[this.p++]; };
  BP.isKw = function(k, o){ var x = this.peek(o); return x.t === 'kw' && x.v === k; };
  BP.isOp = function(v, o){ var x = this.peek(o); return x.t === 'op' && x.v === v; };
  BP.eatKw = function(k){ if(this.isKw(k)){ this.p++; return true; } return false; };
  BP.eatOp = function(v){ if(this.isOp(v)){ this.p++; return true; } return false; };
  var BSL_KW_RU = { then:'Тогда', do:'Цикл', endif:'КонецЕсли', enddo:'КонецЦикла', endfunc:'КонецФункции', endproc:'КонецПроцедуры', 'in':'Из', to:'По', endtry:'КонецПопытки', except:'Исключение' };
  BP.wantKw = function(k){ if(!this.eatKw(k)){ var x = this.peek(); throw BslErr('Ожидалось «' + (BSL_KW_RU[k] || k) + '», а встретилось «' + (x.raw || x.v || 'конец кода') + '»', x.line); } };
  BP.wantOp = function(v){ if(!this.eatOp(v)){ var x = this.peek(); throw BslErr('Ожидалось «' + v + '», а встретилось «' + (x.raw || x.v || 'конец кода') + '»', x.line); } };
  BP.module = function(){
    var mod = { procs:{}, vars:[], body:[] };
    while(this.peek().t !== 'eof'){
      if(this.isKw('proc') || this.isKw('func')){ var pr = this.proc(); mod.procs[pr.lo] = pr; continue; }
      if(this.isKw('var')){ this.p++; do { mod.vars.push(this.next().v); this.eatKw('export'); } while(this.eatOp(',')); this.eatOp(';'); continue; }
      var s = this.stmt(); if(s) mod.body.push(s);
    }
    return mod;
  };
  BP.proc = function(){
    var isFunc = this.next().v === 'func', name = this.next(), ps = [];
    this.wantOp('(');
    while(!this.eatOp(')')){ var byVal = this.eatKw('val'), pn = this.next(); var def = null; if(this.eatOp('=')) def = this.unary(); ps.push({ name:pn.v, lo:pn.lo || String(pn.v).toLowerCase(), def:def, byVal:byVal }); this.eatOp(','); }
    this.eatKw('export');
    var body = this.stmts(isFunc ? ['endfunc'] : ['endproc']);
    this.next();
    return { name:name.v, lo:name.lo || String(name.v).toLowerCase(), params:ps, body:body, isFunc:isFunc };
  };
  BP.stmts = function(ends){
    var out = [];
    while(true){
      var x = this.peek();
      if(x.t === 'eof') throw BslErr('Не хватает «' + (BSL_KW_RU[ends[0]] || ends[0]) + '»', x.line);
      if(x.t === 'kw' && ends.indexOf(x.v) >= 0) return out;
      var s = this.stmt(); if(s) out.push(s);
    }
  };
  BP.stmt = function(){
    var x = this.peek(), line = x.line;
    if(this.eatOp(';')) return null;
    if(x.t === 'kw'){
      switch(x.v){
        case 'if':
          this.p++; var branches = [], c = this.expr(); this.wantKw('then'); var b = this.stmts(['elsif', 'else', 'endif']); branches.push({ c:c, b:b });
          while(this.eatKw('elsif')){ var c2 = this.expr(); this.wantKw('then'); branches.push({ c:c2, b:this.stmts(['elsif', 'else', 'endif']) }); }
          var els = this.eatKw('else') ? this.stmts(['endif']) : null; this.wantKw('endif'); this.eatOp(';');
          return { k:'if', br:branches, els:els, line:line };
        case 'for':
          this.p++;
          if(this.eatKw('each')){ var vn = this.next(); this.wantKw('in'); var coll = this.expr(); this.wantKw('do'); var body = this.stmts(['enddo']); this.wantKw('enddo'); this.eatOp(';'); return { k:'foreach', v:vn.lo || String(vn.v).toLowerCase(), coll:coll, b:body, line:line }; }
          var iv = this.next(); this.wantOp('='); var from = this.expr(); this.wantKw('to'); var to = this.expr(); this.wantKw('do'); var fb = this.stmts(['enddo']); this.wantKw('enddo'); this.eatOp(';');
          return { k:'for', v:iv.lo || String(iv.v).toLowerCase(), from:from, to:to, b:fb, line:line };
        case 'while': this.p++; var wc = this.expr(); this.wantKw('do'); var wb = this.stmts(['enddo']); this.wantKw('enddo'); this.eatOp(';'); return { k:'while', c:wc, b:wb, line:line };
        case 'return': this.p++; var re = (this.isOp(';') || (this.peek().t === 'kw' && /^(endfunc|endproc|endif|enddo|else|elsif|endtry|except)$/.test(this.peek().v))) ? null : this.expr(); this.eatOp(';'); return { k:'return', e:re, line:line };
        case 'break': this.p++; this.eatOp(';'); return { k:'break' };
        case 'continue': this.p++; this.eatOp(';'); return { k:'continue' };
        case 'try': this.p++; var tb = this.stmts(['except']); this.wantKw('except'); var eb = this.stmts(['endtry']); this.wantKw('endtry'); this.eatOp(';'); return { k:'try', b:tb, e:eb };
        case 'raise': this.p++; var rv = this.isOp(';') ? null : this.expr(); this.eatOp(';'); return { k:'raise', e:rv, line:line };
        case 'var': this.p++; var names = []; do { var vt = this.next(); names.push(vt.lo || String(vt.v).toLowerCase()); } while(this.eatOp(',')); this.eatOp(';'); return { k:'vars', names:names };
      }
    }
    var lhs = this.postfix(this.primary());
    if(this.eatOp('=')){ var rhs = this.expr(); this.eatOp(';'); return { k:'assign', l:lhs, r:rhs, line:line }; }
    this.eatOp(';');
    return { k:'call', e:lhs, line:line };
  };
  BP.expr = function(){ return this.or(); };
  BP.or = function(){ var l = this.and(); while(this.eatKw('or')) l = { k:'or', l:l, r:this.and() }; return l; };
  BP.and = function(){ var l = this.not(); while(this.eatKw('and')) l = { k:'and', l:l, r:this.not() }; return l; };
  BP.not = function(){ if(this.eatKw('not')) return { k:'not', e:this.not() }; return this.cmp(); };
  BP.cmp = function(){ var l = this.add(); var x = this.peek(); if(x.t === 'op' && /^(=|<>|<|>|<=|>=)$/.test(x.v)){ this.p++; return { k:'cmp', op:x.v, l:l, r:this.add(), line:x.line }; } return l; };
  BP.add = function(){ var l = this.mul(); while(this.isOp('+') || this.isOp('-')){ var op = this.next().v; l = { k:'bin', op:op, l:l, r:this.mul() }; } return l; };
  BP.mul = function(){ var l = this.unary(); while(this.isOp('*') || this.isOp('/') || this.isOp('%')){ var op = this.next(); l = { k:'bin', op:op.v, l:l, r:this.unary(), line:op.line }; } return l; };
  BP.unary = function(){ if(this.eatOp('-')) return { k:'neg', e:this.unary() }; if(this.eatOp('+')) return this.unary(); return this.postfix(this.primary()); };
  BP.primary = function(){
    var x = this.next();
    if(x.t === 'num') return { k:'lit', v:x.v };
    if(x.t === 'str'){ var s = x.v; while(this.peek().t === 'str') s += this.next().v; return { k:'lit', v:s }; }
    if(x.t === 'date') return { k:'lit', v:x.v };
    if(x.t === 'kw'){
      if(x.v === 'true') return { k:'lit', v:true }; if(x.v === 'false') return { k:'lit', v:false };
      if(x.v === 'undef') return { k:'lit', v:undefined }; if(x.v === 'null') return { k:'lit', v:null };
      if(x.v === 'new'){
        if(this.isOp('(')){ var a0 = this.args(); return { k:'new', nameExpr:a0[0], args:a0.slice(1), line:x.line }; }
        var tn = this.next(); var args = this.isOp('(') ? this.args() : []; return { k:'new', name:String(tn.v).toLowerCase(), raw:tn.v, args:args, line:x.line };
      }
      throw BslErr('Неожиданное «' + x.raw + '»', x.line);
    }
    if(x.t === 'op' && x.v === '('){ var e = this.expr(); this.wantOp(')'); return e; }
    if(x.t === 'op' && x.v === '?'){ var ta = this.args(); return { k:'tern', c:ta[0], a:ta[1], b:ta[2] }; }
    if(x.t === 'id') return { k:'id', n:x.v, lo:x.lo, line:x.line };
    throw BslErr('Неожиданное «' + (x.v === null ? 'конец кода' : x.v) + '»', x.line);
  };
  BP.args = function(){ this.wantOp('('); var a = []; while(!this.eatOp(')')){ if(this.isOp(',')){ this.p++; a.push(undefined); continue; } a.push(this.expr()); if(!this.isOp(')')) this.wantOp(','); } return a; };
  BP.postfix = function(e){
    while(true){
      var x = this.peek();
      if(this.isOp('(')){ e = { k:'call', f:e, args:this.args(), line:x.line }; continue; }
      if(this.isOp('[')){ this.p++; var i = this.expr(); this.wantOp(']'); e = { k:'index', o:e, i:i, line:x.line }; continue; }
      if(this.isOp('.')){ this.p++; var m = this.next(); e = { k:'member', o:e, n:m.t === 'kw' ? m.raw : m.v, lo:String(m.t === 'kw' ? m.raw : m.v).toLowerCase().replace(/ё/g, 'е'), line:x.line }; continue; }
      return e;
    }
  };

  /* ---------- значения 1С ---------- */
  function BArr(a){ this.a = a || []; }
  function BStruct(){ this.m = new Map(); }
  BStruct.prototype.set = function(k, v){ var lo = String(k).toLowerCase().replace(/ё/g, 'е'), o = this.m.get(lo); if(o) o.v = v; else this.m.set(lo, { k:String(k), v:v }); };
  BStruct.prototype.get = function(k){ var o = this.m.get(String(k).toLowerCase().replace(/ё/g, 'е')); return o ? o.v : BSL_MISSING; };
  BStruct.prototype.has = function(k){ return this.m.has(String(k).toLowerCase().replace(/ё/g, 'е')); };
  BStruct.prototype.keys = function(){ var o = []; this.m.forEach(function(x){ o.push(x.k); }); return o; };
  function BMap(){ this.m = new Map(); }
  BMap.prototype.key = function(k){ return k instanceof Date ? 'd' + (+k) : (typeof k === 'object' && k !== null ? JSON.stringify(bslToJson(k)) : typeof k + ':' + k); };
  function BTable(){ this.cols = []; this.rows = []; this.props = new BStruct(); }
  BTable.prototype.addCol = function(n){ if(!this.colOf(n)) this.cols.push(String(n)); };
  BTable.prototype.colOf = function(n){ var lo = String(n).toLowerCase().replace(/ё/g, 'е'); for(var i = 0; i < this.cols.length; i++) if(this.cols[i].toLowerCase().replace(/ё/g, 'е') === lo) return this.cols[i]; return null; };
  BTable.prototype.newRow = function(){ var r = new BRow(this); this.rows.push(r); return r; };
  function BRow(t){ this.t = t; this.v = {}; }
  function BSym(path){ this.path = path; }
  BSym.prototype.toString = function(){ return this.path[this.path.length - 1]; };
  var BSL_MISSING = { missing:true };
  function bslFromJson(v, top){
    if(v === null || v === undefined) return v === null ? null : undefined;
    if(Array.isArray(v)){
      if(v.length && v.every(function(x){ return x && typeof x === 'object' && !Array.isArray(x); })){ var t = new BTable(); v.forEach(function(o){ Object.keys(o).forEach(function(k){ if(k.indexOf('__') !== 0) t.addCol(k); }); }); v.forEach(function(o){ var r = t.newRow(); Object.keys(o).forEach(function(k){ if(k.indexOf('__') !== 0) r.v[t.colOf(k)] = bslFromJson(o[k]); }); }); return t; }
      return new BArr(v.map(function(x){ return bslFromJson(x); }));
    }
    if(typeof v === 'object' && !(v instanceof Date)){ var s = new BStruct(); Object.keys(v).forEach(function(k){ s.set(k, bslFromJson(v[k])); }); return s; }
    if(typeof v === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(v)){ var p = v.split('.'); return new Date(+p[2], +p[1] - 1, +p[0]); }
    return v;
  }
  function bslToJson(v, d){
    d = d || 0; if(d > 30) return null;
    if(v === undefined || v === BSL_MISSING) return null;
    if(v === null || typeof v !== 'object') return typeof v === 'number' ? Math.round(v * 1e10) / 1e10 : v;
    if(v instanceof Date) return ('0' + v.getDate()).slice(-2) + '.' + ('0' + (v.getMonth() + 1)).slice(-2) + '.' + v.getFullYear();
    if(v instanceof BArr) return v.a.map(function(x){ return bslToJson(x, d + 1); });
    if(v instanceof BTable) return v.rows.map(function(r){ var o = {}; v.cols.forEach(function(c){ o[c] = bslToJson(r.v[c], d + 1); }); return o; });
    if(v instanceof BRow){ var o2 = {}; v.t.cols.forEach(function(c){ o2[c] = bslToJson(v.v[c], d + 1); }); return o2; }
    if(v instanceof BStruct){ var o3 = {}; v.m.forEach(function(x){ o3[x.k] = bslToJson(x.v, d + 1); }); return o3; }
    if(v instanceof BMap){ var o4 = {}; v.m.forEach(function(x){ o4[String(x.k)] = bslToJson(x.v, d + 1); }); return o4; }
    if(v instanceof BSym) return String(v);
    if(v.bslType !== undefined) return String(v.bslType);
    if(v.qres) return bslToJson(v.qres, d + 1);
    if(v.kv) return { Ключ:bslToJson(v.k, d + 1), Значение:bslToJson(v.v, d + 1) };
    return null;
  }
  function bslStr(v){
    if(v === undefined || v === BSL_MISSING || v === null) return '';
    if(typeof v === 'boolean') return v ? 'Да' : 'Нет';
    if(typeof v === 'number') return String(Math.round(v * 1e10) / 1e10).replace('.', ',');
    if(v instanceof Date) return bslToJson(v) + (v.getHours() || v.getMinutes() ? ' ' + ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2) + ':' + ('0' + v.getSeconds()).slice(-2) : ' 0:00:00');
    if(v instanceof BArr) return 'Массив';
    if(v instanceof BStruct) return 'Структура';
    if(v instanceof BTable) return 'ТаблицаЗначений';
    if(v instanceof BMap) return 'Соответствие';
    if(v instanceof BSym) return String(v);
    if(v instanceof BRow) return 'СтрокаТаблицыЗначений';
    if(v && v.bslType !== undefined) return String(v.bslType);
    return String(v);
  }
  function BslBreak(){} function BslCont(){} function BslRet(v){ this.v = v; }

  /* ---------- исполнитель ---------- */
  function BslVM(mod, ctx){ this.mod = mod; this.ctx = ctx || {}; this.out = []; this.notes = []; this.steps = 0; this.depth = 0; this.globals = new Map(); var self = this; mod.vars.forEach(function(n){ self.globals.set(String(n).toLowerCase(), undefined); }); }
  var BV = BslVM.prototype;
  BV.note = function(t){ if(this.notes.indexOf(t) < 0) this.notes.push(t); };
  BV.tick = function(){ if(++this.steps > 3e6) throw BslErr('Слишком долгое выполнение — возможен бесконечный цикл'); };
  BV.callProc = function(pr, args, line, back){
    var sc = new Map(), self = this;
    if(++this.depth > 900){ this.depth = 0; throw BslErr('Переполнение стека: слишком глубокая рекурсия', line); }
    pr.params.forEach(function(p, i){ var v = args[i]; if(v === undefined && p.def) v = self.eval(p.def, sc); sc.set(p.lo, v); });
    var ret;
    try { this.block(pr.body, sc); } catch(e){ if(!(e instanceof BslRet)){ this.depth--; throw e; } ret = e.v; }
    this.depth--;
    if(back) back(sc);
    return ret;
  };
  // параметры без «Знач» передаются по ссылке: присваивание внутри процедуры видно снаружи
  BV.callUser = function(pr, e, sc){
    var self = this, args = e.args.map(function(a){ return a === undefined ? undefined : self.eval(a, sc); });
    var back = null;
    if(pr.params.some(function(p, i){ return !p.byVal && e.args[i] && e.args[i].k === 'id'; })) back = function(psc){ pr.params.forEach(function(p, i){ var a = e.args[i]; if(p.byVal || !a || a.k !== 'id') return; var nv = psc.get(p.lo); if(nv !== args[i]) self.assign(a, nv, sc); }); };
    return this.callProc(pr, args, e.line, back);
  };
  BV.block = function(list, sc){ for(var i = 0; i < list.length; i++) this.exec(list[i], sc); };
  BV.exec = function(s, sc){
    this.tick(); var self = this;
    switch(s.k){
      case 'assign': this.assign(s.l, this.eval(s.r, sc), sc); return;
      case 'call':
        // оператор Выполнить("код") — выполняет текст как код 1С в текущем контексте
        if(s.e.k === 'call' && s.e.f.k === 'id' && /^(выполнить|execute)$/.test(s.e.f.lo) && s.e.args.length === 1){ var code = this.eval(s.e.args[0], sc); if(typeof code === 'string'){ this.runCode(code, sc, s.line); return; } var pr0 = this.mod.procs[s.e.f.lo]; if(pr0){ this.callProc(pr0, [code], s.line); return; } }
        this.eval(s.e, sc); return;
      case 'vars': s.names.forEach(function(n){ sc.set(n, undefined); }); return;
      case 'if': for(var i = 0; i < s.br.length; i++){ if(this.truthy(this.eval(s.br[i].c, sc))){ this.block(s.br[i].b, sc); return; } } if(s.els) this.block(s.els, sc); return;
      case 'while': while(this.truthy(this.eval(s.c, sc))){ this.tick(); try { this.block(s.b, sc); } catch(e){ if(e instanceof BslBreak) break; if(e instanceof BslCont) continue; throw e; } } return;
      case 'for':
        var from = this.num(this.eval(s.from, sc)), to = this.num(this.eval(s.to, sc));
        for(var k = from; k <= to; k++){ this.tick(); sc.set(s.v, k); try { this.block(s.b, sc); } catch(e){ if(e instanceof BslBreak) break; if(e instanceof BslCont) continue; throw e; } k = this.num(sc.get(s.v)); }
        return;
      case 'foreach':
        var items = this.items(this.eval(s.coll, sc), s.line);
        for(var j = 0; j < items.length; j++){ this.tick(); sc.set(s.v, items[j]); try { this.block(s.b, sc); } catch(e){ if(e instanceof BslBreak) break; if(e instanceof BslCont) continue; throw e; } }
        return;
      case 'return': throw new BslRet(s.e ? this.eval(s.e, sc) : undefined);
      case 'break': throw new BslBreak();
      case 'continue': throw new BslCont();
      case 'try': try { this.block(s.b, sc); } catch(e){ if(e instanceof BslRet || e instanceof BslBreak || e instanceof BslCont) throw e; if(/долгое выполнение/.test(e.message)) throw e; this.lastErr = e.raw !== undefined ? e.raw : String(e.message || e).replace(/ \(строка \d+\)$/, ''); this.lastErrInfo = e; this.block(s.e, sc); } return;
      case 'raise': var rmsg = s.e ? bslStr(this.eval(s.e, sc)) : (this.lastErr || 'Исключение'), rerr = BslErr(rmsg, s.line); rerr.raw = rmsg; throw rerr;
    }
  };
  BV.items = function(v, line){
    if(v instanceof BArr) return v.a.slice();
    if(v instanceof BTable) return v.rows.slice();
    if(v instanceof BStruct || v instanceof BMap){ var o = []; v.m.forEach(function(x){ o.push({ kv:true, k:x.k, v:x.v }); }); return o; }
    if(v && v.qres) return v.qres.rows.slice();
    if(v && v.cols) return v.cols.slice();
    if(v === undefined || v === BSL_MISSING || v === null) throw BslErr('Для Каждого: коллекция не задана (Неопределено)', line);
    throw BslErr('Для Каждого: значение не является коллекцией', line);
  };
  BV.truthy = function(v){ if(v === BSL_MISSING) return true; return !!v; };
  BV.num = function(v){ if(typeof v === 'number') return v; if(v === undefined || v === null || v === BSL_MISSING) return 0; if(typeof v === 'boolean') return v ? 1 : 0; if(v instanceof Date) return +v / 1000; var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); if(isNaN(n)) throw BslErr('Преобразование значения к типу Число не может быть выполнено: «' + v + '»'); return n; };
  BV.eq = function(a, b){ if(a && a.bslType !== undefined && b && b.bslType !== undefined) return String(a.bslType).toLowerCase().replace(/ё/g, 'е') === String(b.bslType).toLowerCase().replace(/ё/g, 'е'); if(a instanceof BSym) a = String(a); if(b instanceof BSym) b = String(b); if(a instanceof Date && b instanceof Date) return +a === +b; if(a instanceof BRow && b instanceof BRow) return a === b; return a === b || ((a === undefined || a === BSL_MISSING) && (b === undefined || b === BSL_MISSING)); };
  BV.lookupVar = function(lo, sc){ if(sc.has(lo)) return { sc:sc }; if(this.globals.has(lo)) return { sc:this.globals }; return null; };
  BV.assign = function(l, v, sc){
    if(l.k === 'id'){ var r = this.lookupVar(l.lo, sc); (r ? r.sc : sc).set(l.lo, v); return; }
    if(l.k === 'member'){ var o = this.eval(l.o, sc); this.setMember(o, l.n, v, l.line); return; }
    if(l.k === 'index'){ var c = this.eval(l.o, sc), i = this.eval(l.i, sc); this.setIndex(c, i, v, l.line); return; }
    throw BslErr('Сюда нельзя присвоить', l.line);
  };
  BV.setMember = function(o, n, v, line){
    if(o instanceof BRow){ var c = o.t.colOf(n); if(!c){ o.t.addCol(n); c = o.t.colOf(n); } o.v[c] = v; return; }
    if(o instanceof BStruct){ if(!o.has(n)) throw BslErr('Поле объекта не обнаружено (' + n + ')', line); o.set(n, v); return; }
    if(o instanceof BTable){ o.props.set(n, v); return; }
    if(o && o.query){ if(/^(текст|text)$/i.test(n)) o.text = String(v); return; }
    throw BslErr('Нельзя установить поле «' + n + '»', line);
  };
  BV.setIndex = function(c, i, v, line){
    if(c instanceof BArr){ var k = this.num(i); if(k < 0 || k >= c.a.length) throw BslErr('Индекс находится за границами массива', line); c.a[k] = v; return; }
    if(c instanceof BMap){ c.m.set(c.key(i), { k:i, v:v }); return; }
    if(c instanceof BStruct){ c.set(i, v); return; }
    if(c instanceof BRow){ this.setMember(c, typeof i === 'number' ? c.t.cols[i] : i, v, line); return; }
    throw BslErr('Индексация недоступна', line);
  };
  BV.getMember = function(o, n, line){
    var lo = String(n).toLowerCase().replace(/ё/g, 'е');
    if(o instanceof BSym) return new BSym(o.path.concat([n]));
    if(o instanceof BRow){ var c = o.t.colOf(n); if(c) return o.v[c]; var syn = bslSynCol(o.t, n); if(syn) return o.v[syn]; throw BslErr('Поле объекта не обнаружено (' + n + ')', line); }
    if(o instanceof BStruct){ if(o.has(n)) return o.get(n); var ks = o.keys(), sk = bslSynKey(ks, n); if(sk) return o.get(sk); throw BslErr('Поле объекта не обнаружено (' + n + ')', line); }
    if(o instanceof BTable){ if(lo === 'колонки' || lo === 'columns') return { cols:o.cols, table:o }; if(o.props.has(n)) return o.props.get(n); throw BslErr('Поле объекта не обнаружено (' + n + ')', line); }
    if(o && o.kv){ if(lo === 'ключ' || lo === 'key') return o.k; if(lo === 'значение' || lo === 'value') return o.v; }
    if(o && o.query){ if(lo === 'текст' || lo === 'text') return o.text; }
    if(o && o.sel){ var r = o.rows[o.i]; if(!r) throw BslErr('Выборка: сначала вызовите Следующий()', line); return this.getMember(r, n, line); }
    if(o && o.cols && lo === 'количество') return o.cols.length;
    if(o instanceof Date){ var D = { 'год':o.getFullYear(), 'месяц':o.getMonth() + 1, 'день':o.getDate() }; if(lo in D) return D[lo]; }
    if(o === undefined || o === BSL_MISSING) throw BslErr('Поле объекта не обнаружено (' + n + '): значение Неопределено', line);
    throw BslErr('Поле объекта не обнаружено (' + n + ')', line);
  };
  BV.eval = function(e, sc){
    var self = this;
    switch(e.k){
      case 'lit': return e.v;
      case 'id':
        var r = this.lookupVar(e.lo, sc); if(r) return r.sc.get(e.lo);
        if(this.mod.procs[e.lo]) return { proc:this.mod.procs[e.lo] };
        return this.global(e.n, e.lo, e.line);
      case 'member': return this.getMember(this.eval(e.o, sc), e.n, e.line);
      case 'index':
        var c = this.eval(e.o, sc), i = this.eval(e.i, sc);
        if(c instanceof BArr){ var k = this.num(i); if(k < 0 || k >= c.a.length) throw BslErr('Индекс находится за границами массива', e.line); return c.a[k]; }
        if(c instanceof BTable){ var k2 = this.num(i); if(k2 < 0 || k2 >= c.rows.length) throw BslErr('Индекс находится за границами таблицы', e.line); return c.rows[k2]; }
        if(c instanceof BMap){ var x = c.m.get(c.key(i)); return x ? x.v : undefined; }
        if(c instanceof BStruct || c instanceof BRow) return this.getMember(c, typeof i === 'number' && c instanceof BRow ? c.t.cols[i] : i, e.line);
        throw BslErr('Индексация недоступна', e.line);
      case 'tern': return this.truthy(this.eval(e.c, sc)) ? this.eval(e.a, sc) : this.eval(e.b, sc);
      case 'not': return !this.truthy(this.eval(e.e, sc));
      case 'and': return this.truthy(this.eval(e.l, sc)) && this.truthy(this.eval(e.r, sc));
      case 'or': return this.truthy(this.eval(e.l, sc)) || this.truthy(this.eval(e.r, sc));
      case 'neg': return -this.num(this.eval(e.e, sc));
      case 'cmp':
        var a = this.eval(e.l, sc), b = this.eval(e.r, sc);
        if(e.op === '=') return this.eq(a, b); if(e.op === '<>') return !this.eq(a, b);
        if(a instanceof Date || b instanceof Date){ a = +a; b = +b; } else if(typeof a === 'string' && typeof b === 'string'){} else { a = this.num(a); b = this.num(b); }
        return e.op === '<' ? a < b : e.op === '>' ? a > b : e.op === '<=' ? a <= b : a >= b;
      case 'bin':
        var l = this.eval(e.l, sc), rr = this.eval(e.r, sc);
        if(e.op === '+'){ if(typeof l === 'string') return l + bslStr(rr); if(l instanceof Date){ return new Date(+l + this.num(rr) * 1000); } return this.num(l) + this.num(rr); }
        if(e.op === '-'){ if(l instanceof Date && rr instanceof Date) return (l - rr) / 1000; if(l instanceof Date) return new Date(+l - this.num(rr) * 1000); return this.num(l) - this.num(rr); }
        if(e.op === '*') return this.num(l) * this.num(rr);
        if(e.op === '/'){ var dv = this.num(rr); if(dv === 0) throw BslErr('Деление на 0', e.line); return this.num(l) / dv; }
        if(e.op === '%') return this.num(l) % this.num(rr);
        break;
      case 'new': return this.newObj(e.name || String(this.eval(e.nameExpr, sc)).toLowerCase(), e.args.map(function(a){ return a === undefined ? undefined : self.eval(a, sc); }), e.line, e.raw);
      case 'call':
        if(e.f.k === 'id' && this.mod.procs[e.f.lo]) return this.callUser(this.mod.procs[e.f.lo], e, sc);
        var args = e.args.map(function(a){ return a === undefined ? undefined : self.eval(a, sc); });
        if(e.f.k === 'id'){
          var pr = this.mod.procs[e.f.lo];
          if(pr) return this.callUser(pr, e, sc);
          return this.builtin(e.f.n, e.f.lo, args, e.line, e, sc);
        }
        if(e.f.k === 'member') return this.method(this.eval(e.f.o, sc), e.f.n, e.f.lo, args, e.line, e, sc);
        throw BslErr('Это не процедура', e.line);
    }
    throw BslErr('Неподдерживаемое выражение');
  };
  BV.runCode = function(code, sc, line){
    var m; try { m = new BslParser(code).module(); } catch(err){ throw BslErr('Выполнить: ' + String(err.message).replace(/ \(строка \d+\)$/, ''), line); }
    var self = this; Object.keys(m.procs).forEach(function(k){ self.mod.procs[k] = m.procs[k]; });
    this.block(m.body, sc);
  };
  BV.global = function(n, lo, line){
    if(/^(перечисления|справочники|документы|константы|регистрысведений|регистрынакопления|бизнеспроцессы|планывидовхарактеристик|планысчетов|catalogs|documents|enums|constants)$/.test(lo)){ this.note('Обращение к объектам базы 1С («' + n + '») — в Triosteum блок работает с данными схемы'); return new BSym([n]); }
    if(lo === 'входныеданные' && this.ctx.input !== undefined) return this.ctx.input;
    throw BslErr('Переменная не определена (' + n + ')', line);
  };
  BV.newObj = function(lo, args, line, raw){
    switch(lo.replace(/ё/g, 'е')){
      case 'массив': case 'array': var a = new BArr(); if(typeof args[0] === 'number') for(var i = 0; i < args[0]; i++) a.a.push(undefined); return a;
      case 'структура': case 'structure': var s = new BStruct(); if(typeof args[0] === 'string'){ args[0].split(',').forEach(function(k, j){ k = k.trim(); if(k) s.set(k, args[j + 1]); }); } return s;
      case 'фиксированнаяструктура': return args[0] instanceof BStruct ? args[0] : new BStruct();
      case 'соответствие': case 'map': return new BMap();
      case 'таблицазначений': case 'valuetable': return new BTable();
      case 'запрос': case 'query': return { query:true, text:typeof args[0] === 'string' ? args[0] : '', params:new BStruct() };
      case 'описаниетипов': case 'typedescription': return { types:args[0] };
      case 'чтениеjson': case 'jsonreader': return { jsonr:true, text:null };
      case 'записьjson': case 'jsonwriter': return { jsonw:true, buf:null, parts:[] };
      case 'параметрызаписиjson': case 'jsonwritersettings': return { jsonset:true };
      case 'списокзначений': case 'valuelist': return new BArr();
      case 'уникальныйидентификатор': case 'uuid': return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
      case 'текстовыйдокумент': case 'textdocument': return { textdoc:true, lines:[] };
      case 'httpсоединение': case 'httpconnection': case 'httpзапрос': case 'httprequest': throw BslErr('HTTP-запросы из браузера недоступны: сайты обычно не разрешают такие запросы. Блок с HTTPСоединение выполняйте на сервере Triosteum', line);
      case 'интернетпочтовыйпрофиль': case 'интернетпочта': case 'internetmailprofile': case 'internetmail': throw BslErr('Отправка почты из браузера невозможна — почту отправляет сервер Triosteum', line);
      case 'чтениеxml': case 'записьxml': case 'xmlreader': case 'xmlwriter': throw BslErr('Работа с XML пока не поддерживается встроенным исполнителем — используйте JSON', line);
    }
    throw BslErr('Тип не определён (' + (raw || lo) + ')', line);
  };
  BV.method = function(o, n, lo, a, line, e, sc){
    var self = this; lo = lo.replace(/ё/g, 'е');
    if(o instanceof BSym){ this.note('Метод «' + o.path.concat([n]).join('.') + '» базы 1С — заменён значением из схемы'); return a.length ? a[0] : new BSym(o.path.concat([n])); }
    if(o instanceof BArr){
      switch(lo){
        case 'добавить': case 'add': o.a.push(a[0]); return;
        case 'количество': case 'count': return o.a.length;
        case 'получить': case 'get': return o.a[this.num(a[0])];
        case 'установить': case 'set': o.a[this.num(a[0])] = a[1]; return;
        case 'вставить': case 'insert': o.a.splice(this.num(a[0]), 0, a[1]); return;
        case 'удалить': case 'delete': o.a.splice(this.num(a[0]), 1); return;
        case 'найти': case 'find': for(var i = 0; i < o.a.length; i++) if(this.eq(o.a[i], a[0])) return i; return undefined;
        case 'очистить': case 'clear': o.a.length = 0; return;
        case 'вграница': case 'ubound': return o.a.length - 1;
        case 'выгрузитьзначения': case 'unloadvalues': return new BArr(o.a.slice());
        case 'добавитьзначение': o.a.push(a[0]); return;
      }
    }
    if(o instanceof BStruct){
      switch(lo){
        case 'вставить': case 'insert': o.set(a[0], a[1]); return;
        case 'свойство': case 'property': var has = o.has(a[0]) || !!bslSynKey(o.keys(), a[0]); if(e.args[1] && has) this.assign(e.args[1], o.get(o.has(a[0]) ? a[0] : bslSynKey(o.keys(), a[0])), sc); return has;
        case 'количество': case 'count': return o.m.size;
        case 'удалить': case 'delete': o.m.delete(String(a[0]).toLowerCase()); return;
        case 'очистить': case 'clear': o.m.clear(); return;
      }
    }
    if(o instanceof BMap){
      switch(lo){
        case 'вставить': case 'insert': o.m.set(o.key(a[0]), { k:a[0], v:a[1] }); return;
        case 'получить': case 'get': var x = o.m.get(o.key(a[0])); return x ? x.v : undefined;
        case 'удалить': case 'delete': o.m.delete(o.key(a[0])); return;
        case 'количество': case 'count': return o.m.size;
        case 'очистить': case 'clear': o.m.clear(); return;
      }
    }
    if(o instanceof BTable) return this.tableMethod(o, lo, a, line, e, sc);
    if(o instanceof BRow){ if(lo === 'владелец' || lo === 'owner') return o.t; }
    if(o && o.cols && o.table){
      if(lo === 'добавить' || lo === 'add'){ o.table.addCol(a[0]); return; }
      if(lo === 'найти' || lo === 'find') return o.table.colOf(a[0]) ? { name:o.table.colOf(a[0]) } : undefined;
      if(lo === 'количество' || lo === 'count') return o.table.cols.length;
      if(lo === 'удалить' || lo === 'delete'){ var cn = o.table.colOf(a[0] && a[0].name || a[0]); o.table.cols = o.table.cols.filter(function(c){ return c !== cn; }); return; }
    }
    if(o && o.jsonr){
      if(lo === 'установитьстроку' || lo === 'settostring'){ o.text = String(a[0]); return; }
      if(lo === 'открытьфайл' || lo === 'openfile') throw BslErr('Чтение файлов с диска недоступно в браузере — передайте JSON строкой (УстановитьСтроку)', line);
      if(lo === 'закрыть' || lo === 'close') return;
    }
    if(o && o.jsonw){
      if(lo === 'установитьстроку' || lo === 'settostring'){ o.buf = ''; return; }
      if(lo === 'открытьфайл' || lo === 'openfile') throw BslErr('Запись файлов на диск недоступна в браузере — используйте УстановитьСтроку()', line);
      if(lo === 'закрыть' || lo === 'close') return o.buf === null ? undefined : o.buf;
    }
    if(o && o.textdoc){
      if(lo === 'добавитьстроку' || lo === 'addline'){ o.lines.push(bslStr(a[0])); return; }
      if(lo === 'получитьтекст' || lo === 'gettext') return o.lines.join('\n');
      if(lo === 'установитьтекст' || lo === 'settext'){ o.lines = String(a[0]).split('\n'); return; }
      if(lo === 'количествострок' || lo === 'linecount') return o.lines.length;
      if(lo === 'получитьстроку' || lo === 'getline') return o.lines[this.num(a[0]) - 1] || '';
    }
    if(o && o.query){
      if(lo === 'установитьпараметр' || lo === 'setparameter'){ o.params.set(a[0], a[1]); return; }
      if(lo === 'выполнить' || lo === 'execute'){ var t = bslQuery(o.text, o.params, this); return { qres:t }; }
      if(lo === 'выполнитьпакет' || lo === 'executebatch'){ var t2 = bslQuery(o.text, o.params, this, true); return new BArr(t2.map(function(x){ return { qres:x }; })); }
    }
    if(o && o.qres){
      if(lo === 'выгрузить' || lo === 'unload') return bslCopyTable(o.qres);
      if(lo === 'пустой' || lo === 'isempty') return !o.qres.rows.length;
      if(lo === 'выбрать' || lo === 'select') return { sel:true, rows:o.qres.rows, i:-1 };
    }
    if(o && o.sel){
      if(lo === 'следующий' || lo === 'next'){ o.i++; return o.i < o.rows.length; }
      if(lo === 'количество' || lo === 'count') return o.rows.length;
    }
    if(o === undefined || o === BSL_MISSING) throw BslErr('Метод объекта не обнаружен (' + n + '): значение Неопределено', line);
    throw BslErr('Метод объекта не обнаружен (' + n + ')', line);
  };
  BV.tableMethod = function(t, lo, a, line, e, sc){
    var self = this;
    switch(lo){
      case 'добавить': case 'add': return t.newRow();
      case 'количество': case 'count': return t.rows.length;
      case 'получить': case 'get': return t.rows[this.num(a[0])];
      case 'итог': case 'total': var c = t.colOf(a[0]); return t.rows.reduce(function(s, r){ var v = r.v[c]; return s + (typeof v === 'number' ? v : (parseFloat(v) || 0)); }, 0);
      case 'очистить': case 'clear': t.rows.length = 0; return;
      case 'удалить': case 'delete': var idx = typeof a[0] === 'number' ? a[0] : t.rows.indexOf(a[0]); if(idx >= 0) t.rows.splice(idx, 1); return;
      case 'выгрузитьколонку': case 'unloadcolumn': var cc = t.colOf(a[0] && a[0].name || a[0]); return new BArr(t.rows.map(function(r){ return r.v[cc]; }));
      case 'загрузитьколонку': case 'loadcolumn': var lc = t.colOf(a[1]); t.addCol(a[1]); lc = t.colOf(a[1]); a[0].a.forEach(function(v, i){ (t.rows[i] || t.newRow()).v[lc] = v; }); return;
      case 'скопировать': case 'copy': case 'выгрузить': case 'unload': return bslCopyTable(t, a[0]);
      case 'найти': case 'find': var cols = a[1] ? String(a[1]).split(',').map(function(x){ return t.colOf(x.trim()); }) : t.cols; for(var i = 0; i < t.rows.length; i++) for(var j = 0; j < cols.length; j++) if(this.eq(t.rows[i].v[cols[j]], a[0])) return t.rows[i]; return undefined;
      case 'найтистроки': case 'findrows': var f = a[0]; return new BArr(t.rows.filter(function(r){ var ok = true; f.m.forEach(function(x){ if(!self.eq(r.v[t.colOf(x.k)], x.v)) ok = false; }); return ok; }));
      case 'сортировать': case 'sort':
        var spec = String(a[0]).split(',').map(function(x){ var p = x.trim().split(/\s+/); return { c:t.colOf(p[0]), d:/^(убыв|desc)/i.test(p[1] || '') }; });
        t.rows.sort(function(x, y){ for(var i = 0; i < spec.length; i++){ var A = x.v[spec[i].c], B = y.v[spec[i].c]; if(A instanceof Date) A = +A; if(B instanceof Date) B = +B; if(A < B) return spec[i].d ? 1 : -1; if(A > B) return spec[i].d ? -1 : 1; } return 0; }); return;
      case 'свернуть': case 'groupby':
        var gc = String(a[0] || '').split(',').map(function(x){ return t.colOf(x.trim()); }).filter(Boolean), sc2 = String(a[1] || '').split(',').map(function(x){ return t.colOf(x.trim()); }).filter(Boolean), g = {}, order = [];
        t.rows.forEach(function(r){ var k = JSON.stringify(gc.map(function(c){ return bslToJson(r.v[c]); })); if(!g[k]){ g[k] = { v:{} }; gc.forEach(function(c){ g[k].v[c] = r.v[c]; }); sc2.forEach(function(c){ g[k].v[c] = 0; }); order.push(k); } sc2.forEach(function(c){ g[k].v[c] += self.num(r.v[c]); }); });
        t.cols = gc.concat(sc2); t.rows = order.map(function(k){ var r = new BRow(t); r.v = g[k].v; return r; }); return;
      case 'индекс': case 'index': return t.rows.indexOf(a[0]);
      case 'свойство': case 'property': var key = t.props.has(a[0]) ? a[0] : bslSynKey(t.props.keys(), a[0]); if(key && e.args[1]) this.assign(e.args[1], t.props.get(key), sc); return !!key;
      case 'вставить': case 'insert': var nr = new BRow(t); t.rows.splice(this.num(a[0]), 0, nr); return nr;
      case 'заполнитьзначения': case 'fillvalues': var fc = a[1] ? String(a[1]).split(',').map(function(x){ return t.colOf(x.trim()); }) : t.cols; t.rows.forEach(function(r){ fc.forEach(function(c){ r.v[c] = a[0]; }); }); return;
    }
    if(t.props.has(lo)) return this.method(t.props.get(lo), lo, lo, a, line, e, sc);
    throw BslErr('Метод объекта не обнаружен (' + lo + ')', line);
  };
  function bslCopyTable(t, filter){ var c = new BTable(); c.cols = t.cols.slice(); c.props = t.props; (filter instanceof BArr ? filter.a : t.rows).forEach(function(r){ var nr = new BRow(c); for(var k in r.v) nr.v[k] = r.v[k]; c.rows.push(nr); }); return c; }
  function bslSynCol(t, n){ var syn = typeof fieldSyn === 'function' ? fieldSyn(n) : []; for(var i = 0; i < syn.length; i++){ var c = t.colOf(syn[i]); if(c) return c; } return null; }
  function bslSynKey(keys, n){ var lo = String(n).toLowerCase(), syn = typeof fieldSyn === 'function' ? fieldSyn(n) : []; for(var i = 0; i < keys.length; i++){ var k = keys[i].toLowerCase(); if(k === lo || syn.indexOf(k) >= 0) return keys[i]; } return null; }
  BV.builtin = function(n, lo, a, line, e, sc){
    var self = this, s0 = a[0] === undefined || a[0] === null ? '' : a[0];
    lo = lo.replace(/ё/g, 'е');
    switch(lo){
      case 'сообщить': case 'message': this.out.push(bslStr(a[0])); return;
      case 'строка': case 'string': return bslStr(a[0]);
      case 'число': case 'number': return this.num(a[0]);
      case 'булево': case 'boolean': return !!a[0] && a[0] !== 'Ложь' && a[0] !== 'false';
      case 'дата': case 'date': if(typeof a[0] === 'string'){ var d = a[0].replace(/\D/g, ''); return new Date(+d.slice(0, 4), +(d.slice(4, 6) || 1) - 1, +(d.slice(6, 8) || 1)); } if(a[0] instanceof Date) return a[0]; return new Date(a[0], (a[1] || 1) - 1, a[2] || 1, a[3] || 0, a[4] || 0, a[5] || 0);
      case 'текущаядата': case 'currentdate': case 'текущаядатасеанса': return new Date();
      case 'год': case 'year': return a[0].getFullYear(); case 'месяц': case 'month': return a[0].getMonth() + 1; case 'день': case 'day': return a[0].getDate();
      case 'началомесяца': case 'begofmonth': return new Date(a[0].getFullYear(), a[0].getMonth(), 1);
      case 'конецмесяца': case 'endofmonth': return new Date(a[0].getFullYear(), a[0].getMonth() + 1, 0, 23, 59, 59);
      case 'началогода': case 'begofyear': return new Date(a[0].getFullYear(), 0, 1);
      case 'началодня': case 'begofday': return new Date(a[0].getFullYear(), a[0].getMonth(), a[0].getDate());
      case 'добавитьмесяц': case 'addmonth': var dm = new Date(+a[0]); dm.setMonth(dm.getMonth() + this.num(a[1])); return dm;
      case 'стрдлина': case 'strlen': return String(s0).length;
      case 'сокрлп': case 'trimall': return String(s0).trim(); case 'сокрл': case 'triml': return String(s0).replace(/^\s+/, ''); case 'сокрп': case 'trimr': return String(s0).replace(/\s+$/, '');
      case 'врег': case 'upper': return String(s0).toUpperCase(); case 'нрег': case 'lower': return String(s0).toLowerCase(); case 'трег': case 'title': return String(s0).replace(/(^|\s)(\S)/g, function(m, p, c){ return p + c.toUpperCase(); });
      case 'лев': case 'left': return String(s0).slice(0, a[1]); case 'прав': case 'right': return String(s0).slice(-a[1]);
      case 'сред': case 'mid': return a.length > 2 ? String(s0).substr(a[1] - 1, a[2]) : String(s0).substr(a[1] - 1);
      case 'стрнайти': case 'strfind': case 'найти': case 'find': return String(s0).indexOf(a[1]) + 1;
      case 'стрзаменить': case 'strreplace': return String(s0).split(a[1]).join(a[2]);
      case 'стрразделить': case 'strsplit': return new BArr(String(s0).split(new RegExp('[' + String(a[1] || ',').replace(/[\]\\^-]/g, '\\$&') + ']')).filter(function(x){ return a[2] === false ? true : x !== ''; }));
      case 'стрсоединить': case 'strconcat': return a[0].a.map(bslStr).join(a[1] === undefined ? '' : a[1]);
      case 'стрчисловхождений': case 'stroccurrencecount': return String(s0).split(a[1]).length - 1;
      case 'стрначинаетсяс': case 'strstartswith': return String(s0).indexOf(a[1]) === 0;
      case 'стрзаканчиваетсяна': case 'strendswith': return String(s0).slice(-String(a[1]).length) === String(a[1]);
      case 'стршаблон': case 'strtemplate': return String(s0).replace(/%(\d)/g, function(m, i){ return bslStr(a[+i]); });
      case 'формат': case 'format': return bslFormat(a[0], a[1] || '');
      case 'окр': case 'round': var k = Math.pow(10, a[1] || 0), x = this.num(a[0]) * k; return (x < 0 ? -Math.round(-x) : Math.round(x)) / k;
      case 'цел': case 'int': return Math.trunc(this.num(a[0]));
      case 'макс': case 'max': return Math.max.apply(null, a.map(function(v){ return self.num(v); }));
      case 'мин': case 'min': return Math.min.apply(null, a.map(function(v){ return self.num(v); }));
      case 'pow': return Math.pow(this.num(a[0]), this.num(a[1])); case 'sqrt': return Math.sqrt(this.num(a[0])); case 'log': return Math.log(this.num(a[0])); case 'log10': return Math.log10(this.num(a[0])); case 'exp': return Math.exp(this.num(a[0]));
      case 'значениезаполнено': case 'valueisfilled': var v = a[0]; return !(v === undefined || v === null || v === '' || v === 0 || v === false || v === BSL_MISSING || (v instanceof BArr && !v.a.length) || (v instanceof BTable && !v.rows.length) || (v instanceof Date && +v === +new Date(1, 0, 1)));
      case 'предопределенноезначение': case 'predefinedvalue': return new BSym(String(a[0]).split('.'));
      case 'описаниеошибки': case 'errordescription': return this.lastErr || '';
      case 'вычислить': case 'eval': var ep; try { ep = new BslParser(String(a[0])).expr(); } catch(err){ throw BslErr('Вычислить: ' + String(err.message).replace(/ \(строка \d+\)$/, ''), line); } return this.eval(ep, sc);
      case 'выполнить': case 'execute': if(typeof a[0] === 'string'){ this.runCode(a[0], sc, line); return; } break;
      case 'прочитатьjson': case 'readjson': if(!a[0] || !a[0].jsonr || a[0].text === null) throw BslErr('ПрочитатьJSON: сначала вызовите УстановитьСтроку() у ЧтениеJSON', line); var pj; try { pj = JSON.parse(a[0].text); } catch(err){ throw BslErr('Ошибка разбора JSON: ' + err.message, line); } return bslJsonIn(pj, !!a[1]);
      case 'записатьjson': case 'writejson': if(!a[0] || !a[0].jsonw) throw BslErr('ЗаписатьJSON: первый параметр — ЗаписьJSON', line); if(a[0].buf === null) a[0].buf = ''; a[0].buf += JSON.stringify(bslToJson(a[1])); return;
      case 'заполнитьзначениясвойств': case 'fillpropertyvalues':
        var dst = a[0], srcv = a[1], only = a[2] ? String(a[2]).split(',').map(function(x){ return x.trim(); }).filter(Boolean) : null, excl = a[3] ? String(a[3]).split(',').map(function(x){ return x.trim().toLowerCase(); }) : [];
        var dkeys = only || (dst instanceof BRow ? dst.t.cols.slice() : dst instanceof BStruct ? dst.keys() : []);
        dkeys.forEach(function(k){ if(excl.indexOf(k.toLowerCase()) >= 0) return; var v = bslPropOf(srcv, k); if(v === BSL_MISSING) return; if(dst instanceof BRow){ var c = dst.t.colOf(k); if(c) dst.v[c] = v; } else if(dst instanceof BStruct) dst.set(k, v); });
        return;
      case 'типзнч': case 'typeof': var tv = a[0]; return { bslType:bslTypeName(tv) };
      case 'тип': case 'type': return { bslType:String(a[0]) };
      case 'xmlстрока': case 'xmlstring': return a[0] instanceof Date ? a[0].toISOString().slice(0, 19) : (typeof a[0] === 'boolean' ? String(a[0]) : (typeof a[0] === 'number' ? String(a[0]) : bslStr(a[0])));
      case 'получитьсекрет': case 'getsecret': var sec = typeof secretGet === 'function' ? secretGet(a[0]) : undefined; if(sec === undefined) throw BslErr('Секрет «' + a[0] + '» не задан. Добавьте его: Настройки (шестерёнка) → Секреты для блоков', line); return sec;
      case 'символ': case 'char': return String.fromCharCode(this.num(a[0]));
      case 'кодсимвола': case 'charcode': return String(s0).charCodeAt((a[1] || 1) - 1);
      case 'символы': return undefined;
      case 'перевод': return undefined;
      case 'abs': case 'модуль': return Math.abs(this.num(a[0]));
      case 'начатьтранзакцию': case 'зафиксироватьтранзакцию': case 'отменитьтранзакцию': this.note('Транзакции базы 1С в Triosteum не нужны — пропущено'); return;
      case 'нстр': case 'nstr': var ns = String(s0), mm = /ru\s*=\s*'([^']*)'/i.exec(ns); return mm ? mm[1] : ns;
      case 'стрповторить': return new Array(this.num(a[1]) + 1).join(String(s0));
      case 'конецдня': case 'endofday': return new Date(a[0].getFullYear(), a[0].getMonth(), a[0].getDate(), 23, 59, 59);
      case 'деньнедели': case 'weekday': var wd = a[0].getDay(); return wd === 0 ? 7 : wd;
      case 'час': case 'hour': return a[0].getHours(); case 'минута': case 'minute': return a[0].getMinutes(); case 'секунда': case 'second': return a[0].getSeconds();
      case 'началонедели': case 'begofweek': var bw = new Date(a[0].getFullYear(), a[0].getMonth(), a[0].getDate()); bw.setDate(bw.getDate() - ((bw.getDay() + 6) % 7)); return bw;
      case 'началоквартала': case 'begofquarter': return new Date(a[0].getFullYear(), Math.floor(a[0].getMonth() / 3) * 3, 1);
      case 'конецгода': case 'endofyear': return new Date(a[0].getFullYear(), 11, 31, 23, 59, 59);
    }
    throw BslErr('Процедура или функция с указанным именем не определена (' + n + ')', line);
  };
  function bslTypeName(v){ return v === undefined || v === BSL_MISSING ? 'Неопределено' : v === null ? 'Null' : typeof v === 'number' ? 'Число' : typeof v === 'string' ? 'Строка' : typeof v === 'boolean' ? 'Булево' : v instanceof Date ? 'Дата' : v instanceof BArr ? 'Массив' : v instanceof BStruct ? 'Структура' : v instanceof BMap ? 'Соответствие' : v instanceof BTable ? 'ТаблицаЗначений' : v instanceof BRow ? 'СтрокаТаблицыЗначений' : v && v.bslType ? 'Тип' : bslStr(v); }
  function bslPropOf(o, k){ if(o instanceof BRow){ var c = o.t.colOf(k); return c ? o.v[c] : BSL_MISSING; } if(o instanceof BStruct) return o.has(k) ? o.get(k) : BSL_MISSING; return BSL_MISSING; }
  // JSON → значения 1С: объект → Структура (или Соответствие), массив → Массив
  function bslJsonIn(v, asMap){
    if(Array.isArray(v)) return new BArr(v.map(function(x){ return bslJsonIn(x, asMap); }));
    if(v && typeof v === 'object'){ var o = asMap ? new BMap() : new BStruct(); Object.keys(v).forEach(function(k){ var x = bslJsonIn(v[k], asMap); if(asMap) o.m.set(o.key(k), { k:k, v:x }); else o.set(k, x); }); return o; }
    return v;
  }
  function bslFormat(v, f){
    var p = {}; String(f).split(';').forEach(function(x){ var m = /^\s*([А-ЯA-Z]+)\s*=\s*'?([^']*)'?\s*$/i.exec(x); if(m) p[m[1].toUpperCase()] = m[2]; });
    if(v instanceof Date){ var df = p['ДФ'] || p.DF || 'dd.MM.yyyy'; return df.replace(/yyyy|гггг/g, v.getFullYear()).replace(/MM/g, ('0' + (v.getMonth() + 1)).slice(-2)).replace(/dd|дд/g, ('0' + v.getDate()).slice(-2)).replace(/HH|чч/g, ('0' + v.getHours()).slice(-2)).replace(/mm|мм/g, ('0' + v.getMinutes()).slice(-2)); }
    if(typeof v === 'number'){ var d = p['ЧДЦ'] !== undefined ? +p['ЧДЦ'] : (p.ND !== undefined ? +p.ND : null); var s = v.toLocaleString('ru-RU', { minimumFractionDigits:d === null ? 0 : d, maximumFractionDigits:d === null ? 10 : d, useGrouping:p['ЧГ'] !== '0' }).replace(/\u00a0/g, p['ЧРГ'] !== undefined ? p['ЧРГ'] : ' '); if(p['ЧРД']) s = s.replace(',', p['ЧРД']); return s; }
    if(typeof v === 'boolean') return v ? (p['БИ'] || 'Да') : (p['БЛ'] || 'Нет');
    return bslStr(v);
  }

  /* ---------- язык запросов над данными схемы ---------- */
  var BQ_KW = { 'выбрать':'SELECT', 'select':'SELECT', 'различные':'DISTINCT', 'distinct':'DISTINCT', 'первые':'TOP', 'top':'TOP', 'разрешенные':'ALLOWED', 'allowed':'ALLOWED', 'как':'AS', 'as':'AS', 'из':'FROM', 'from':'FROM', 'где':'WHERE', 'where':'WHERE',
    'сгруппировать':'GROUP', 'group':'GROUP', 'по':'BY', 'by':'BY', 'имеющие':'HAVING', 'having':'HAVING', 'упорядочить':'ORDER', 'order':'ORDER', 'убыв':'DESC', 'desc':'DESC', 'возр':'ASC', 'asc':'ASC',
    'и':'AND', 'and':'AND', 'или':'OR', 'or':'OR', 'не':'NOT', 'not':'NOT', 'в':'IN', 'in':'IN', 'между':'BETWEEN', 'between':'BETWEEN', 'подобно':'LIKE', 'like':'LIKE', 'есть':'IS', 'is':'IS', 'null':'NULL',
    'выбор':'CASE', 'case':'CASE', 'когда':'WHEN', 'when':'WHEN', 'тогда':'THEN', 'then':'THEN', 'иначе':'ELSE', 'else':'ELSE', 'конец':'END', 'end':'END', 'истина':'TRUE', 'true':'TRUE', 'ложь':'FALSE', 'false':'FALSE',
    'неопределено':'UNDEF', 'undefined':'UNDEF', 'поместить':'INTO', 'into':'INTO', 'итоги':'TOTALS', 'totals':'TOTALS', 'объединить':'UNION', 'union':'UNION', 'все':'ALL', 'all':'ALL',
    'левое':'LEFT', 'left':'LEFT', 'правое':'RIGHT', 'right':'RIGHT', 'внутреннее':'INNER', 'inner':'INNER', 'полное':'FULL', 'full':'FULL', 'соединение':'JOIN', 'join':'JOIN', 'для':'FOR', 'изменения':'UPDATE', 'индексировать':'INDEX' };
  function bqTokens(src){
    var t = [], i = 0, n = src.length;
    while(i < n){
      var c = src[i];
      if(/\s/.test(c)){ i++; continue; }
      if(c === '/' && src[i + 1] === '/'){ while(i < n && src[i] !== '\n') i++; continue; }
      if(c === '"'){ var s = ''; i++; while(i < n){ if(src[i] === '"'){ if(src[i + 1] === '"'){ s += '"'; i += 2; continue; } i++; break; } s += src[i++]; } t.push({ t:'str', v:s }); continue; }
      if(c === '&'){ var m = /^&[\w\u0400-\u04FF]+/.exec(src.slice(i)); t.push({ t:'param', v:m[0].slice(1) }); i += m[0].length; continue; }
      if(/[0-9]/.test(c)){ var m2 = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i)); t.push({ t:'num', v:parseFloat(m2[0]) }); i += m2[0].length; continue; }
      if(/[A-Za-z_\u0400-\u04FF]/.test(c)){ var m3 = /^[A-Za-z_\u0400-\u04FF][\w\u0400-\u04FF]*/.exec(src.slice(i)), w = m3[0], lw = w.toLowerCase().replace(/ё/g, 'е'); t.push(BQ_KW[lw] ? { t:'kw', v:BQ_KW[lw], raw:w } : { t:'id', v:w }); i += w.length; continue; }
      var two = src.substr(i, 2); if(two === '<>' || two === '<=' || two === '>='){ t.push({ t:'op', v:two }); i += 2; continue; }
      t.push({ t:'op', v:c }); i++;
    }
    t.push({ t:'eof' });
    return t;
  }
  function BQP(src){ this.tk = bqTokens(src); this.p = 0; }
  BQP.prototype.peek = function(o){ return this.tk[this.p + (o || 0)]; };
  BQP.prototype.next = function(){ return this.tk[this.p++]; };
  BQP.prototype.kw = function(k, o){ var x = this.peek(o); return x.t === 'kw' && x.v === k; };
  BQP.prototype.eat = function(k){ if(this.kw(k)){ this.p++; return true; } return false; };
  BQP.prototype.op = function(v){ var x = this.peek(); return x.t === 'op' && x.v === v; };
  BQP.prototype.eatOp = function(v){ if(this.op(v)){ this.p++; return true; } return false; };
  BQP.prototype.want = function(k){ if(!this.eat(k)){ var x = this.peek(); throw BslErr('Ошибка в тексте запроса: ожидалось ' + ({ FROM:'ИЗ', BY:'ПО', END:'КОНЕЦ', THEN:'ТОГДА', AS:'КАК' }[k] || k) + ', а встретилось «' + (x.raw || x.v || 'конец текста') + '»'); } };
  BQP.prototype.batch = function(){ var qs = []; while(this.peek().t !== 'eof'){ if(this.eatOp(';')) continue; qs.push(this.select()); } return qs; };
  BQP.prototype.select = function(){
    this.want('SELECT'); var q = { items:[], distinct:false, top:null, joins:[] };
    this.eat('ALLOWED'); if(this.eat('DISTINCT')) q.distinct = true; if(this.eat('TOP')) q.top = this.next().v; this.eat('ALLOWED'); if(this.eat('DISTINCT')) q.distinct = true;
    do {
      if(this.eatOp('*')){ q.items.push({ star:true }); continue; }
      var e = this.expr(), as = null; if(this.eat('AS')) as = this.next().v; else if(this.peek().t === 'id') as = this.next().v;
      q.items.push({ e:e, as:as || (e.k === 'path' ? e.p[e.p.length - 1] : 'Поле' + (q.items.length + 1)) });
    } while(this.eatOp(','));
    if(this.eat('INTO')) q.into = this.next().v;
    if(this.eat('FROM')){
      q.from = this.source();
      while(this.kw('LEFT') || this.kw('INNER') || this.kw('RIGHT') || this.kw('FULL') || this.kw('JOIN')){ var jt = this.next().v; if(jt !== 'JOIN') this.eat('OUTER'); this.want('JOIN'); var src = this.source(); this.want('BY'); q.joins.push({ type:jt === 'JOIN' ? 'INNER' : jt, src:src, on:this.expr() }); }
      while(this.eatOp(',')){ q.joins.push({ type:'CROSS', src:this.source(), on:null }); }
    }
    if(this.eat('WHERE')) q.where = this.expr();
    if(this.eat('GROUP')){ this.want('BY'); q.group = []; do { q.group.push(this.expr()); } while(this.eatOp(',')); }
    if(this.eat('HAVING')) q.having = this.expr();
    if(this.eat('UNION')){ var all = this.eat('ALL'); q.union = { all:all, q:this.select() }; return q; }
    if(this.eat('ORDER')){ this.want('BY'); q.order = []; do { var oe = this.expr(), desc = this.eat('DESC'); this.eat('ASC'); q.order.push({ e:oe, desc:desc }); } while(this.eatOp(',')); }
    if(this.eat('TOTALS')){ while(this.peek().t !== 'eof' && !this.op(';')) this.p++; }
    if(this.eat('FOR')){ while(this.peek().t !== 'eof' && !this.op(';')) this.p++; }
    if(this.eat('INDEX')){ while(this.peek().t !== 'eof' && !this.op(';')) this.p++; }
    return q;
  };
  BQP.prototype.source = function(){
    if(this.peek().t === 'param'){ var pn = this.next().v; var asP = this.eat('AS') ? this.next().v : (this.peek().t === 'id' ? this.next().v : pn); return { param:pn, path:[pn], as:asP }; }
    if(this.eatOp('(')){ var sub = this.select(); this.eatOp(')'); var as0 = this.eat('AS') ? this.next().v : 'Вложенный'; return { sub:sub, as:as0 }; }
    var path = [this.next().v]; while(this.eatOp('.')) path.push(this.next().v);
    var args = null; if(this.eatOp('(')){ args = []; var d = 1; while(d > 0 && this.peek().t !== 'eof'){ var x = this.next(); if(x.t === 'op' && x.v === '(') d++; else if(x.t === 'op' && x.v === ')') d--; } }
    var as = this.eat('AS') ? this.next().v : (this.peek().t === 'id' ? this.next().v : path[path.length - 1]);
    return { path:path, as:as };
  };
  BQP.prototype.expr = function(){ return this.or(); };
  BQP.prototype.or = function(){ var l = this.and(); while(this.eat('OR')) l = { k:'or', l:l, r:this.and() }; return l; };
  BQP.prototype.and = function(){ var l = this.not(); while(this.eat('AND')) l = { k:'and', l:l, r:this.not() }; return l; };
  BQP.prototype.not = function(){ if(this.eat('NOT')) return { k:'not', e:this.not() }; return this.cmp(); };
  BQP.prototype.cmp = function(){
    var l = this.add(), x = this.peek();
    if(x.t === 'op' && /^(=|<>|<|>|<=|>=)$/.test(x.v)){ this.p++; return { k:'cmp', op:x.v, l:l, r:this.add() }; }
    var neg = false; if(this.kw('NOT') && (this.kw('IN', 1) || this.kw('BETWEEN', 1) || this.kw('LIKE', 1))){ this.p++; neg = true; }
    if(this.eat('IN')){ this.eat('HIERARCHY'); this.eatOp('('); var list = []; if(this.kw('SELECT')){ list.push({ k:'sub', q:this.select() }); } else { do { list.push(this.add()); } while(this.eatOp(',')); } this.eatOp(')'); return { k:'in', e:l, list:list, neg:neg }; }
    if(this.eat('BETWEEN')){ var a = this.add(); this.want('AND'); var b = this.add(); return { k:'between', e:l, a:a, b:b, neg:neg }; }
    if(this.eat('LIKE')){ return { k:'like', e:l, pat:this.add(), neg:neg }; }
    if(this.eat('IS')){ var n2 = this.eat('NOT'); this.want('NULL'); return { k:'isnull', e:l, neg:n2 }; }
    return l;
  };
  BQP.prototype.add = function(){ var l = this.mul(); while(this.op('+') || this.op('-')){ var o = this.next().v; l = { k:'bin', op:o, l:l, r:this.mul() }; } return l; };
  BQP.prototype.mul = function(){ var l = this.un(); while(this.op('*') || this.op('/')){ var o = this.next().v; l = { k:'bin', op:o, l:l, r:this.un() }; } return l; };
  BQP.prototype.un = function(){ if(this.eatOp('-')) return { k:'neg', e:this.un() }; return this.prim(); };
  BQP.prototype.prim = function(){
    var x = this.next();
    if(x.t === 'num' || x.t === 'str') return { k:'lit', v:x.v };
    if(x.t === 'param') return { k:'param', n:x.v };
    if(x.t === 'kw'){
      if(x.v === 'TRUE') return { k:'lit', v:true }; if(x.v === 'FALSE') return { k:'lit', v:false }; if(x.v === 'NULL' || x.v === 'UNDEF') return { k:'lit', v:null };
      if(x.v === 'CASE'){ var whens = [], els = null; while(this.eat('WHEN')){ var c = this.expr(); this.want('THEN'); whens.push({ c:c, v:this.expr() }); } if(this.eat('ELSE')) els = this.expr(); this.want('END'); return { k:'case', whens:whens, els:els }; }
    }
    if(x.t === 'op' && x.v === '('){ var e = this.expr(); this.eatOp(')'); return e; }
    if(x.t === 'id'){
      var lo = x.v.toLowerCase();
      if(this.op('(')){
        this.p++;
        if(/^(значение|value)$/.test(lo)){ var parts = []; while(!this.eatOp(')')){ var y = this.next(); if(y.v !== '.') parts.push(y.v); } return { k:'lit', v:new BSym(parts) }; }
        if(/^(выразить|cast)$/.test(lo)){ var ce = this.expr(); this.want('AS'); var d = 1; while(d && this.peek().t !== 'eof'){ var z = this.next(); if(z.v === '(') d++; else if(z.v === ')') d--; } return ce; }
        var distinct = this.eat('DISTINCT'), args = [];
        if(this.eatOp('*')) args.push({ k:'star' }); else if(!this.op(')')){ do { if(this.kw('MONTH') || this.peek().t === 'id' && /^(месяц|год|день|неделя|квартал)$/i.test(this.peek().v) && (this.op(')', 1) || this.peek(1).v === ',')) args.push({ k:'lit', v:this.next().v }); else args.push(this.expr()); } while(this.eatOp(',')); }
        this.eatOp(')');
        return { k:'fn', n:lo, args:args, distinct:distinct };
      }
      var path = [x.v]; while(this.op('.') && this.peek(1).t !== 'eof'){ this.p++; path.push(this.next().v); }
      return { k:'path', p:path };
    }
    throw BslErr('Ошибка в тексте запроса: неожиданное «' + (x.raw || x.v) + '»');
  };
  var BQ_AGG = { 'сумма':1, 'sum':1, 'количество':1, 'count':1, 'максимум':1, 'max':1, 'минимум':1, 'min':1, 'среднее':1, 'avg':1 };
  var BQ_SUFFIX = ['НачальныйОстаток', 'КонечныйОстаток', 'Остаток', 'Оборот', 'Приход', 'Расход'];
  function bqHasAgg(e){ if(!e || typeof e !== 'object') return false; if(e.k === 'fn' && BQ_AGG[e.n]) return true; for(var k in e){ var v = e[k]; if(Array.isArray(v)){ for(var i = 0; i < v.length; i++) if(bqHasAgg(v[i])) return true; } else if(v && typeof v === 'object' && v.k && bqHasAgg(v)) return true; } return false; }
  // таблица-источник запроса: по имени из входных данных или вся входная таблица
  function bqSource(src, vm, temps, params){
    if(src.param){ var pv = params && params.get ? params.get(src.param) : BSL_MISSING; if(pv === BSL_MISSING || pv === undefined) throw BslErr('Ошибка в запросе: параметр «&' + src.param + '» не установлен (УстановитьПараметр)'); if(pv instanceof BTable) return pv; if(pv && pv.qres) return pv.qres; if(pv instanceof BArr) { var ct = bslFromJson(bslToJson(pv)); if(ct instanceof BTable) return ct; var t1 = new BTable(); t1.addCol('Значение'); pv.a.forEach(function(x){ t1.newRow().v['Значение'] = x; }); return t1; } throw BslErr('Ошибка в запросе: параметр «&' + src.param + '» должен быть таблицей'); }
    var data = vm.ctx.input, path = src.path, last = path[path.length - 1];
    var lo = function(s){ return String(s).toLowerCase().replace(/ё/g, 'е'); };
    if(temps[lo(path.join('.'))]) return temps[lo(path.join('.'))];
    var names = [path.slice(1).join('.'), path.slice(1).join(''), last];
    if(/^(остатки|обороты|остаткииобороты|срезпоследних|срезпервых|balance|turnovers)$/i.test(last) && path.length > 2) names.push(path[path.length - 2]);
    if(path.length > 2) names.push(path[1]);
    var props = data instanceof BTable ? data.props : (data instanceof BStruct ? data : null);
    if(props){ for(var i = 0; i < names.length; i++){ if(names[i] && props.has(names[i])){ var v = props.get(names[i]); if(v instanceof BTable) return v; if(v instanceof BArr) return bslFromJson(bslToJson(v)); } } }
    if(data instanceof BTable){ if(path.length) vm.note('Источник «' + path.join('.') + '» — взяты входные данные блока (' + data.rows.length + ' записей)'); return data; }
    vm.note('Источник «' + path.join('.') + '» не найден во входных данных — результат пуст');
    var t = new BTable(); return t;
  }
  function bqResolve(ctx, path, vm, single){
    var row = null, rest = path;
    var a0 = String(path[0]).toLowerCase().replace(/ё/g, 'е');
    if(ctx.aliases[a0] !== undefined){ row = ctx.aliases[a0]; rest = path.slice(1); }
    else if(single){ row = ctx.aliases[single]; }
    if(!rest.length) return row;
    rest = rest.filter(function(s){ return !/^(ссылка|ref)$/i.test(s); });
    if(!rest.length) return row;
    var cur = row;
    for(var i = 0; i < rest.length; i++){
      if(cur === null || cur === undefined || cur === BSL_MISSING) return BSL_MISSING;
      var nm = rest[i], v = bqField(cur, nm);
      if(v === BSL_MISSING && i < rest.length - 1){ continue; }       // «Контрагент.Наименование» — строка сама себе представление
      if(v === BSL_MISSING && i > 0 && /^(наименование|представление|description|presentation|код|code)$/i.test(nm) && (typeof cur !== 'object')) return cur;
      if(v === BSL_MISSING){ vm.note('Поля «' + rest.join('.') + '» нет во входных данных — условия с ним не применялись'); return BSL_MISSING; }
      cur = v;
    }
    return cur;
  }
  function bqField(r, nm){
    if(r instanceof BRow){
      var c = r.t.colOf(nm); if(c) return r.v[c];
      for(var i = 0; i < BQ_SUFFIX.length; i++){ var sfx = BQ_SUFFIX[i]; if(nm.length > sfx.length && nm.slice(-sfx.length).toLowerCase() === sfx.toLowerCase()){ var c2 = r.t.colOf(nm.slice(0, -sfx.length)); if(c2) return r.v[c2]; } }
      var syn = bslSynCol(r.t, nm); if(syn) return r.v[syn];
      return BSL_MISSING;
    }
    if(r instanceof BStruct){ return r.has(nm) ? r.get(nm) : BSL_MISSING; }
    return BSL_MISSING;
  }
  function bslQuery(text, params, vm, batch){
    var qs = new BQP(String(text || '')).batch(), temps = vm.qtemps || (vm.qtemps = {}), res = [];
    if(!qs.length) throw BslErr('Текст запроса пуст');
    qs.forEach(function(q){ var t = bqRun(q, params, vm, temps); if(q.into) temps[String(q.into).toLowerCase()] = t; res.push(t); });
    return batch ? res : res[res.length - 1];
  }
  function bqRun(q, params, vm, temps){
    var srcT = q.from ? (q.from.sub ? bqRun(q.from.sub, params, vm, temps) : bqSource(q.from, vm, temps, params)) : null;
    var main = q.from ? String(q.from.as).toLowerCase().replace(/ё/g, 'е') : null;
    var ctxs = srcT ? srcT.rows.map(function(r){ var a = {}; a[main] = r; return { aliases:a }; }) : [{ aliases:{} }];
    q.joins.forEach(function(j){
      var jt = j.src.sub ? bqRun(j.src.sub, params, vm, temps) : bqSource(j.src, vm, temps, params), ja = String(j.src.as).toLowerCase().replace(/ё/g, 'е'), out = [];
      ctxs.forEach(function(c){
        var hit = false;
        jt.rows.forEach(function(r){ var a = Object.assign({}, c.aliases); a[ja] = r; var nc = { aliases:a }; if(!j.on || bqTruth(bqEval(j.on, nc, params, vm, null))){ out.push(nc); hit = true; } });
        if(!hit && (j.type === 'LEFT' || j.type === 'FULL')){ var a2 = Object.assign({}, c.aliases); a2[ja] = null; out.push({ aliases:a2 }); }
      });
      ctxs = out;
    });
    var single = q.joins.length ? null : main;
    if(q.where) ctxs = ctxs.filter(function(c){ return bqTruth(bqEval(q.where, c, params, vm, single)); });
    var t = new BTable(), grouped = !!q.group || q.items.some(function(it){ return it.e && bqHasAgg(it.e); });
    var items = [];
    q.items.forEach(function(it){ if(it.star && srcT){ srcT.cols.forEach(function(c){ items.push({ e:{ k:'path', p:[c] }, as:c }); }); } else if(!it.star) items.push(it); });
    items.forEach(function(it){ t.addCol(it.as); });
    if(grouped){
      var groups = [], idx = {};
      ctxs.forEach(function(c){ var key = JSON.stringify((q.group || []).map(function(g){ return bslToJson(bqEval(g, c, params, vm, single)); })); if(!idx[key]){ idx[key] = []; groups.push(idx[key]); } idx[key].push(c); });
      if(!groups.length && !q.group) groups.push([]);
      groups.forEach(function(gr){
        var hv = q.having ? bqTruth(bqEval(q.having, gr[0] || { aliases:{} }, params, vm, single, gr)) : true; if(!hv) return;
        var r = t.newRow(); items.forEach(function(it){ var v = bqEval(it.e, gr[0] || { aliases:{} }, params, vm, single, gr); r.v[t.colOf(it.as)] = v === BSL_MISSING ? null : v; });
      });
    } else {
      ctxs.forEach(function(c){ var r = t.newRow(); items.forEach(function(it){ var v = bqEval(it.e, c, params, vm, single); r.v[t.colOf(it.as)] = v === BSL_MISSING ? null : v; }); r.__ctx = c; });
    }
    if(q.distinct){ var seen = {}; t.rows = t.rows.filter(function(r){ var k = JSON.stringify(bslToJson(r)); if(seen[k]) return false; seen[k] = 1; return true; }); }
    if(q.order){
      t.rows.sort(function(x, y){
        for(var i = 0; i < q.order.length; i++){
          var o = q.order[i], A = bqOrderVal(o.e, x, t, params, vm, single), B = bqOrderVal(o.e, y, t, params, vm, single);
          if(A instanceof Date) A = +A; if(B instanceof Date) B = +B;
          if(A === B) continue; if(A === null || A === undefined) return o.desc ? 1 : -1; if(B === null || B === undefined) return o.desc ? -1 : 1;
          return (A < B ? -1 : 1) * (o.desc ? -1 : 1);
        }
        return 0;
      });
    }
    t.rows.forEach(function(r){ delete r.__ctx; });
    if(q.top) t.rows = t.rows.slice(0, q.top);
    if(q.union){ var u = bqRun(q.union.q, params, vm, temps); u.rows.forEach(function(r){ var nr = t.newRow(); t.cols.forEach(function(c, i){ nr.v[c] = r.v[u.cols[i]]; }); }); if(!q.union.all){ var s2 = {}; t.rows = t.rows.filter(function(r){ var k = JSON.stringify(bslToJson(r)); if(s2[k]) return false; s2[k] = 1; return true; }); } }
    return t;
  }
  function bqOrderVal(e, r, t, params, vm, single){ if(e.k === 'path' && e.p.length === 1 && t.colOf(e.p[0])) return r.v[t.colOf(e.p[0])]; if(r.__ctx) return bqEval(e, r.__ctx, params, vm, single); if(e.k === 'path'){ var c = t.colOf(e.p[e.p.length - 1]); if(c) return r.v[c]; } return null; }
  function bqTruth(v){ return v === BSL_MISSING ? true : !!v; }
  function bqEval(e, c, params, vm, single, group){
    var ev = function(x){ return bqEval(x, c, params, vm, single, group); };
    switch(e.k){
      case 'lit': return e.v instanceof BSym ? String(e.v) : e.v;
      case 'param': if(!params.has(e.n)) throw BslErr('Не установлено значение параметра «' + e.n + '»'); var pv = params.get(e.n); return pv instanceof BSym ? String(pv) : pv;
      case 'path': return bqResolve(c, e.p, vm, single);
      case 'and': return bqTruth(ev(e.l)) && bqTruth(ev(e.r));
      case 'or': return bqTruth(ev(e.l)) || bqTruth(ev(e.r));
      case 'not': var nv = ev(e.e); return nv === BSL_MISSING ? true : !nv;
      case 'neg': return -vm.num(ev(e.e));
      case 'cmp':
        var a = ev(e.l), b = ev(e.r); if(a === BSL_MISSING || b === BSL_MISSING) return BSL_MISSING;
        if(a instanceof BSym) a = String(a); if(b instanceof BSym) b = String(b);
        if(a instanceof Date) a = +a; if(b instanceof Date) b = +b;
        if(typeof a === 'string' && typeof b === 'string' && e.op === '=') return a.replace(/\s/g, '').toLowerCase() === b.replace(/\s/g, '').toLowerCase();
        if(typeof a === 'string' && typeof b === 'number' && !isNaN(parseFloat(a))) a = parseFloat(a);
        switch(e.op){ case '=': return a === b; case '<>': return a !== b; case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b; }
        break;
      case 'bin': var l = ev(e.l), r = ev(e.r); if(l === BSL_MISSING || r === BSL_MISSING) return null; if(e.op === '+' && (typeof l === 'string' || typeof r === 'string')) return bslStr(l) + bslStr(r); l = vm.num(l); r = vm.num(r); return e.op === '+' ? l + r : e.op === '-' ? l - r : e.op === '*' ? l * r : (r === 0 ? 0 : l / r);
      case 'in':
        var v = ev(e.e); if(v === BSL_MISSING) return BSL_MISSING;
        var list = [];
        e.list.forEach(function(x){ if(x.k === 'sub'){ var st = bqRun(x.q, params, vm, vm.qtemps || {}); st.rows.forEach(function(rr){ list.push(rr.v[st.cols[0]]); }); return; } var lv = ev(x); if(lv instanceof BArr) list = list.concat(lv.a); else if(lv instanceof BTable) lv.rows.forEach(function(rr){ list.push(rr.v[lv.cols[0]]); }); else list.push(lv); });
        var hit = list.some(function(x){ return vm.eq(x instanceof BSym ? String(x) : x, v); });
        return e.neg ? !hit : hit;
      case 'between': var bv = ev(e.e), lo = ev(e.a), hi = ev(e.b); if(bv === BSL_MISSING) return BSL_MISSING; if(bv instanceof Date){ bv = +bv; lo = +lo; hi = +hi; } var inb = bv >= lo && bv <= hi; return e.neg ? !inb : inb;
      case 'like': var sv = ev(e.e); if(sv === BSL_MISSING) return BSL_MISSING; var re = new RegExp('^' + String(ev(e.pat)).replace(/[.*+?^${}()|\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i'); var lk = re.test(bslStr(sv)); return e.neg ? !lk : lk;
      case 'isnull': var iv = ev(e.e), isn = iv === null || iv === undefined || iv === BSL_MISSING; return e.neg ? !isn : isn;
      case 'case': for(var i = 0; i < e.whens.length; i++) if(bqTruth(ev(e.whens[i].c)) && ev(e.whens[i].c) !== BSL_MISSING) return ev(e.whens[i].v); return e.els ? ev(e.els) : null;
      case 'fn':
        if(BQ_AGG[e.n]){
          var rows = group || [c], vals = [];
          rows.forEach(function(gc){ if(e.args[0] && e.args[0].k === 'star'){ vals.push(1); return; } var x = bqEval(e.args[0], gc, params, vm, single, null); if(x !== null && x !== undefined && x !== BSL_MISSING) vals.push(x); });
          if(e.distinct){ var sd = {}; vals = vals.filter(function(x){ var k = JSON.stringify(bslToJson(x)); if(sd[k]) return false; sd[k] = 1; return true; }); }
          if(/^(количество|count)$/.test(e.n)) return vals.length;
          if(!vals.length) return null;
          var nums = vals.map(function(x){ return x instanceof Date ? +x : (typeof x === 'number' ? x : vm.num(x)); });
          if(/^(сумма|sum)$/.test(e.n)) return Math.round(nums.reduce(function(s, x){ return s + x; }, 0) * 1e8) / 1e8;
          if(/^(среднее|avg)$/.test(e.n)) return nums.reduce(function(s, x){ return s + x; }, 0) / nums.length;
          var best = vals[0]; vals.forEach(function(x, i){ if(/^(максимум|max)$/.test(e.n) ? nums[i] > (best instanceof Date ? +best : vm.num(best)) : nums[i] < (best instanceof Date ? +best : vm.num(best))) best = x; }); return best;
        }
        var A = e.args.map(ev);
        switch(e.n){
          case 'естьnull': case 'isnull': return A[0] === null || A[0] === undefined || A[0] === BSL_MISSING ? A[1] : A[0];
          case 'год': case 'year': return A[0] instanceof Date ? A[0].getFullYear() : null;
          case 'месяц': case 'month': return A[0] instanceof Date ? A[0].getMonth() + 1 : null;
          case 'день': case 'dayofmonth': return A[0] instanceof Date ? A[0].getDate() : null;
          case 'началопериода': case 'beginofperiod': var d = A[0]; if(!(d instanceof Date)) return d; var per = String(A[1]).toLowerCase(); return /год|year/.test(per) ? new Date(d.getFullYear(), 0, 1) : /месяц|month/.test(per) ? new Date(d.getFullYear(), d.getMonth(), 1) : /квартал|quarter/.test(per) ? new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1) : new Date(d.getFullYear(), d.getMonth(), d.getDate());
          case 'подстрока': case 'substring': return bslStr(A[0]).substr(A[1] - 1, A[2]);
          case 'представление': case 'presentation': return bslStr(A[0]);
          case 'датавремя': case 'datetime': return new Date(A[0], (A[1] || 1) - 1, A[2] || 1, A[3] || 0, A[4] || 0, A[5] || 0);
          case 'разностьдат': case 'datediff': var ms = A[1] - A[0], u = String(A[2]).toLowerCase(); return Math.floor(ms / (/день|day/.test(u) ? 864e5 : /час|hour/.test(u) ? 36e5 : /минут|minute/.test(u) ? 6e4 : 1e3));
          case 'добавитькдате': case 'dateadd': var dd = new Date(+A[0]), uu = String(A[1]).toLowerCase(); if(/месяц|month/.test(uu)) dd.setMonth(dd.getMonth() + A[2]); else if(/год|year/.test(uu)) dd.setFullYear(dd.getFullYear() + A[2]); else dd.setDate(dd.getDate() + A[2]); return dd;
        }
        throw BslErr('Функция «' + e.n + '» в запросе не поддерживается');
    }
    throw BslErr('Ошибка вычисления запроса');
  }
