  /* =====================================================================
     ВСТРОЕННЫЙ ИСПОЛНИТЕЛЬ C++ И C#: разбор кода блока и выполнение
     прямо в браузере, без сервера. Поддерживается то, что нужно блокам:
     структуры и записи, классы, функции, лямбды, std::vector / std::map,
     List / Dictionary, LINQ, строки, математика, вывод в консоль.
     ===================================================================== */
  var CF_KW = { 'if':1, 'else':1, 'for':1, 'foreach':1, 'while':1, 'do':1, 'return':1, 'break':1, 'continue':1, 'new':1, 'switch':1, 'case':1, 'default':1, 'try':1, 'catch':1, 'finally':1, 'throw':1, 'using':1, 'in':1, 'is':1, 'as':1, 'await':1, 'true':1, 'false':1, 'null':1, 'nullptr':1, 'this':1, 'class':1, 'struct':1, 'record':1, 'namespace':1, 'typeof':1, 'sizeof':1, 'operator':1, 'template':1, 'typename':1 };
  var CF_MODS = { 'public':1, 'private':1, 'protected':1, 'internal':1, 'static':1, 'readonly':1, 'virtual':1, 'override':1, 'async':1, 'sealed':1, 'abstract':1, 'partial':1, 'extern':1, 'inline':1, 'constexpr':1, 'volatile':1, 'mutable':1, 'explicit':1, 'friend':1, 'unsafe':1, 'required':1, 'noexcept':1 };
  var CF_INT = { 'int':1, 'long':1, 'short':1, 'unsigned':1, 'signed':1, 'size_t':1, 'uint':1, 'ulong':1, 'byte':1, 'sbyte':1, 'ushort':1, 'char':1, 'int32_t':1, 'int64_t':1, 'uint32_t':1, 'uint64_t':1, 'ptrdiff_t':1 };
  var CF_BASE = { 'int':1, 'double':1, 'float':1, 'bool':1, 'char':1, 'void':1, 'long':1, 'short':1, 'unsigned':1, 'signed':1, 'auto':1, 'var':1, 'string':1, 'decimal':1, 'object':1, 'byte':1, 'uint':1, 'ulong':1, 'size_t':1, 'dynamic':1, 'sbyte':1, 'ushort':1, 'int32_t':1, 'int64_t':1, 'uint32_t':1, 'uint64_t':1, 'ptrdiff_t':1 };
  var CF_OPS = ['>>=', '<<=', '...', '::', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '=>', '??', '?.'];
  function CfErr(msg, line){ var e = new Error(msg + (line ? ' (строка ' + line + ')' : '')); e.cf = true; return e; }

  function cfTokens(src, cs){
    var t = [], i = 0, n = src.length, line = 1;
    function push(type, v, extra){ var o = { t:type, v:v, line:line }; if(extra) for(var k in extra) o[k] = extra[k]; t.push(o); }
    while(i < n){
      var c = src[i];
      if(c === '\n'){ line++; i++; continue; }
      if(/\s/.test(c)){ i++; continue; }
      if(c === '/' && src[i + 1] === '/'){ while(i < n && src[i] !== '\n') i++; continue; }
      if(c === '/' && src[i + 1] === '*'){ i += 2; while(i < n && !(src[i] === '*' && src[i + 1] === '/')){ if(src[i] === '\n') line++; i++; } i += 2; continue; }
      if(c === '#'){ var e0 = src.indexOf('\n', i); if(e0 < 0) e0 = n; var dir = src.slice(i, e0); var dm = /^#\s*define\s+([A-Za-z_]\w*)\s+(.+)$/.exec(dir.trim()); if(dm) push('define', dm[1], { body:dm[2] }); i = e0; continue; }
      if(cs && (c === '$' || c === '@') && (src[i + 1] === '"' || ((src[i + 1] === '$' || src[i + 1] === '@') && src[i + 2] === '"'))){
        var interp = src.slice(i, i + 3).indexOf('$') >= 0, verb = src.slice(i, i + 3).indexOf('@') >= 0; i = src.indexOf('"', i) + 1;
        var parts = [], buf = '';
        while(i < n){
          var ch = src[i];
          if(ch === '"'){ if(verb && src[i + 1] === '"'){ buf += '"'; i += 2; continue; } i++; break; }
          if(!verb && ch === '\\'){ buf += cfEsc(src[i + 1]); i += 2; continue; }
          if(interp && ch === '{'){ if(src[i + 1] === '{'){ buf += '{'; i += 2; continue; } parts.push(buf); buf = ''; var depth = 1, j = i + 1, ex = ''; while(j < n && depth){ if(src[j] === '{') depth++; else if(src[j] === '}'){ depth--; if(!depth) break; } ex += src[j]; j++; } parts.push({ expr:ex }); i = j + 1; continue; }
          if(interp && ch === '}' && src[i + 1] === '}'){ buf += '}'; i += 2; continue; }
          if(ch === '\n') line++;
          buf += ch; i++;
        }
        parts.push(buf);
        push(interp ? 'interp' : 'str', interp ? parts : parts.join(''));
        continue;
      }
      if(c === '"'){ var s = ''; i++; while(i < n && src[i] !== '"'){ if(src[i] === '\\'){ s += cfEsc(src[i + 1]); i += 2; } else s += src[i++]; } i++; push('str', s); continue; }
      if(c === "'"){ var ch2 = src[i + 1] === '\\' ? cfEsc(src[i + 2]) : src[i + 1]; i = src.indexOf("'", i + 2) + 1; push('chr', ch2); continue; }
      if(/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))){
        var m = /^(0[xX][0-9a-fA-F']+|[0-9][0-9']*(\.[0-9']*)?([eE][+-]?[0-9]+)?|\.[0-9]+([eE][+-]?[0-9]+)?)([fFdDmMuUlL]*)/.exec(src.slice(i));
        var raw = m[1].replace(/'/g, ''), val = /^0[xX]/.test(raw) ? parseInt(raw, 16) : parseFloat(raw);
        push('num', val, { isInt:!/[.eE]/.test(raw) && !/[fFdDmM]/.test(m[5]) && !/^0[xX]/.test(raw) ? true : /^0[xX]/.test(raw) });
        i += m[0].length; continue;
      }
      if(/[A-Za-z_Ѐ-ӿ]/.test(c)){ var m2 = /^[A-Za-z_Ѐ-ӿ][\wЀ-ӿ]*/.exec(src.slice(i)); push('id', m2[0]); i += m2[0].length; continue; }
      var op = null; for(var k = 0; k < CF_OPS.length; k++){ if(src.substr(i, CF_OPS[k].length) === CF_OPS[k]){ op = CF_OPS[k]; break; } }
      if(!op) op = c;
      push('op', op); i += op.length;
    }
    push('eof', null);
    return t;
  }
  function cfEsc(c){ return ({ n:'\n', t:'\t', r:'\r', '0':'\0', '\\':'\\', '"':'"', "'":"'" })[c] !== undefined ? ({ n:'\n', t:'\t', r:'\r', '0':'\0', '\\':'\\', '"':'"', "'":"'" })[c] : c; }

  /* ---------- разбор ---------- */
  function CfParser(src, lang){
    this.cs = lang === 'csharp'; this.tk = cfTokens(src, this.cs); this.p = 0; this.types = {}; this.defines = {};
    var self = this; this.tk = this.tk.filter(function(x){ if(x.t === 'define'){ self.defines[x.v] = x.body; return false; } return true; });
  }
  var CP = CfParser.prototype;
  CP.peek = function(o){ return this.tk[this.p + (o || 0)]; };
  CP.next = function(){ return this.tk[this.p++]; };
  CP.is = function(v, o){ var x = this.peek(o); return x && (x.t === 'op' || x.t === 'id') && x.v === v; };
  CP.eat = function(v){ if(this.is(v)){ this.p++; return true; } return false; };
  CP.want = function(v){ if(!this.eat(v)){ var x = this.peek(); throw CfErr('Ожидалось «' + v + '», а встретилось «' + (x.v === null ? 'конец кода' : (x.t === 'str' ? '"' + x.v + '"' : x.v)) + '»', x.line); } };
  CP.ident = function(){ var x = this.next(); if(x.t !== 'id') throw CfErr('Ожидалось имя, а встретилось «' + x.v + '»', x.line); return x.v; };
  CP.skipMods = function(){ while(this.peek().t === 'id' && CF_MODS[this.peek().v]) this.p++; };
  CP.skipAttrs = function(){ while(this.cs && this.is('[') ){ var d = 0; do { var x = this.next(); if(x.v === '[') d++; else if(x.v === ']') d--; } while(d > 0 && this.peek().t !== 'eof'); } };
  // splits '>>' when closing nested generics
  CP.closeAngle = function(){ var x = this.peek(); if(x.v === '>'){ this.p++; return true; } if(x.v === '>>'){ x.v = '>'; return true; } if(x.v === '>='){ x.v = '='; return true; } if(x.v === '>>='){ x.v = '>='; return true; } return false; };
  CP.tryType = function(){
    var save = this.p, t = this.typeInner();
    if(!t) this.p = save;
    return t;
  };
  CP.typeInner = function(){
    while(this.is('const') || this.is('volatile') || this.is('typename') || this.is('struct') && this.peek(1).t === 'id' && this.peek(2).v !== '{') this.p++;
    var x = this.peek(); if(x.t !== 'id' || (CF_KW[x.v] && x.v !== 'string')) return null;
    var name = x.v; this.p++;
    if(CF_BASE[name]){ while(this.peek().t === 'id' && (this.peek().v === 'long' || this.peek().v === 'int' || this.peek().v === 'short' || this.peek().v === 'char' || this.peek().v === 'double')) { name += ' ' + this.peek().v; this.p++; } }
    while(this.is('::') || (this.is('.') && this.peek(1).t === 'id' && !this.cfCallLike())){ var sep = this.next().v; var y = this.peek(); if(y.t !== 'id') return null; name += sep === '::' ? '::' + y.v : '.' + y.v; this.p++; }
    var args = [];
    if(this.is('<')){
      var save = this.p; this.p++;
      var ok = true;
      if(!this.closeAngle()){
        do { var a = this.typeInner(); if(!a){ if(this.peek().t === 'num'){ this.p++; a = { name:'#' }; } else { ok = false; break; } } args.push(a); } while(this.eat(','));
        if(ok && !this.closeAngle()) ok = false;
      }
      if(!ok){ this.p = save; return CF_BASE[name] || this.types[name] || /^std::/.test(name) ? { name:name, args:[] } : null; }
    }
    var t = { name:name.replace(/^std::/, '').replace(/^System\.(Collections\.Generic\.)?/, ''), args:args };
    while(true){
      if(this.is('const')){ this.p++; continue; }
      if(this.is('&') || this.is('&&') || this.is('*')){ this.p++; continue; }
      if(this.cs && this.is('?') && !(this.peek(1).t === 'id' && (this.peek(2).v === ':' ))){ var nx = this.peek(1); if(nx.t === 'id' || nx.v === '[' || nx.v === '>' || nx.v === ',' || nx.v === ')'){ this.p++; t.nullable = true; continue; } }
      if(this.cs && this.is('[') && this.is(']', 1)){ this.p += 2; t = { name:'array', args:[t] }; continue; }
      break;
    }
    return t;
  };
  CP.cfCallLike = function(){ return false; };
  // объявление переменной в начале оператора?
  CP.declAhead = function(){
    var save = this.p, t = this.tryType(), ok = false;
    if(t){
      var x = this.peek();
      if(x.t === 'id' && !CF_KW[x.v]){ var y = this.peek(1); ok = y.v === '=' || y.v === ';' || y.v === ',' || y.v === '(' || y.v === '{' || y.v === ':' || y.v === 'in' || y.v === ')'; }
      else if(this.is('[') && !this.cs && t.name === 'auto'){ ok = true; }   // структурное связывание: auto [k, v]
    }
    this.p = save; return ok;
  };
  CP.program = function(){
    var items = [];
    // сначала собираем имена типов, чтобы отличать объявления
    for(var i = 0; i < this.tk.length - 1; i++){ var a = this.tk[i]; if(a.t === 'id' && (a.v === 'struct' || a.v === 'class' || a.v === 'record') && this.tk[i + 1].t === 'id') this.types[this.tk[i + 1].v] = 1; }
    while(this.peek().t !== 'eof') { var it = this.topItem(); if(it) items.push(it); }
    return items;
  };
  CP.topItem = function(){
    if(this.eat(';')) return null;
    if(this.is('using') && !this.is('(', 1)){ while(!this.eat(';')) this.p++; return null; }
    if(this.is('namespace')){ this.p++; while(!this.is('{') && !this.is(';')) this.p++; if(this.eat(';')) return null; this.p++; var inner = []; while(!this.eat('}')){ var it = this.topItem(); if(it) inner.push(it); } return { k:'ns', items:inner }; }
    if(this.is('template')){ this.p++; this.want('<'); var d = 1; while(d){ var x = this.next(); if(x.v === '<') d++; else if(x.v === '>') d--; else if(x.v === '>>') d -= 2; } }
    this.skipAttrs(); this.skipMods();
    if(this.is('struct') || this.is('class') || this.is('record') || this.is('interface') || this.is('enum')) return this.typeDecl();
    // макрос блока: TRIOSTEUM_BLOCK("...")
    if(this.peek().t === 'id' && /^[A-Z_][A-Z0-9_]+$/.test(this.peek().v) && this.is('(', 1) && !this.defines[this.peek().v]){ this.p++; var d2 = 0; do { var z = this.next(); if(z.v === '(') d2++; else if(z.v === ')') d2--; } while(d2 > 0); this.eat(';'); return null; }
    return this.memberDecl(null);
  };
  CP.typeDecl = function(){
    var kind = this.next().v; if(kind === 'record' && (this.is('class') || this.is('struct'))) this.p++;
    if(kind === 'enum'){ if(this.is('class')) this.p++; var en = this.ident(), vals = {}, k = 0; if(this.eat(':')) this.tryType(); this.want('{'); while(!this.eat('}')){ var vn = this.ident(); if(this.eat('=')) k = this.expr().v; vals[vn] = k++; this.eat(','); } this.eat(';'); return { k:'enum', name:en, vals:vals }; }
    var name = this.ident(); this.types[name] = 1;
    if(this.is('<')){ var d = 0; do { var x = this.next(); if(x.v === '<') d++; else if(x.v === '>') d--; } while(d > 0); }
    var td = { k:'type', kind:kind, name:name, fields:[], methods:{}, statics:[], params:null };
    if(kind === 'record' && this.is('(')){ td.params = this.params(); td.params.forEach(function(p){ td.fields.push({ name:p.name, type:p.type }); }); }
    if(this.eat(':')){ do { this.tryType(); } while(this.eat(',')); }
    while(this.is('where')){ while(!this.is('{') && !this.is(';')) this.p++; }
    if(this.eat(';')) return td;
    this.want('{');
    while(!this.eat('}')){
      if(this.eat(';')) continue;
      if(this.is('public') && this.is(':', 1) || this.is('private') && this.is(':', 1) || this.is('protected') && this.is(':', 1)){ this.p += 2; continue; }
      this.skipAttrs();
      var st = false; while(this.peek().t === 'id' && (CF_MODS[this.peek().v] || this.peek().v === 'const')){ if(this.peek().v === 'static' || this.peek().v === 'const') st = st || this.peek().v === 'static' || (this.cs && this.peek().v === 'const'); this.p++; }
      if(this.is('struct') || this.is('class') || this.is('record') || this.is('enum')){ var nested = this.typeDecl(); (td.nested = td.nested || []).push(nested); continue; }
      // конструктор
      if(this.peek().t === 'id' && this.peek().v === name && this.is('(', 1)){
        this.p++; var ps = this.params(), inits = [];
        if(this.eat(':')){
          do { var iname = this.ident(); if(this.cs && (iname === 'base' || iname === 'this')){ this.args(); continue; } var iargs = this.is('{') ? this.braceList().items : this.args(); inits.push({ k:'expr', e:{ k:'assign', op:'=', l:{ k:'member', o:{ k:'this' }, n:iname }, r:iargs.length === 1 ? iargs[0] : { k:'list', items:iargs } } }); } while(this.eat(','));
        }
        while(this.is('noexcept')) this.p++;
        var body = this.is('{') ? this.block() : (this.eat(';'), { k:'block', body:[] });
        if(inits.length) body = { k:'block', body:inits.concat(body.body) };
        td.ctor = { params:ps, body:body }; continue;
      }
      var m = this.memberDecl(td, st); if(!m) continue;
      if(m.k === 'func'){ td.methods[m.name] = m; m.static = st; }
      else if(m.k === 'vars'){ m.list.forEach(function(v){ (st ? td.statics : td.fields).push(v); }); }
    }
    this.eat(';');
    return td;
  };
  CP.params = function(){
    this.want('('); var ps = [];
    while(!this.eat(')')){
      this.skipAttrs(); while(this.is('this') || this.is('params') || this.is('ref') || this.is('out') || this.is('in')) this.p++;
      var t = this.tryType() || { name:'auto', args:[] }, nm = this.peek().t === 'id' ? this.ident() : ('_' + ps.length), def = null;
      if(this.is('[')){ this.p++; while(!this.eat(']')) this.p++; t = { name:'array', args:[t] }; }
      if(this.eat('=')) def = this.assign();
      ps.push({ name:nm, type:t, def:def }); this.eat(',');
    }
    return ps;
  };
  CP.memberDecl = function(td, st){
    var save = this.p, t = this.tryType();
    if(!t){ var x = this.peek(); throw CfErr('Непонятная конструкция «' + x.v + '»', x.line); }
    if(this.is('operator')){ this.p++; while(!this.is('(')) this.p++; var opPs = this.params(); this.skipMods(); while(this.is('const')) this.p++; if(this.is('{')) this.block(); else this.eat(';'); return null; }
    if(this.peek().t !== 'id'){ var y = this.peek(); throw CfErr('Ожидалось имя после типа «' + t.name + '», а встретилось «' + y.v + '»', y.line); }
    var name = this.ident();
    while(this.is('::')){ this.p++; name = this.ident(); }
    if(this.is('<') && this.cs){ var d = 0; do { var z = this.next(); if(z.v === '<') d++; else if(z.v === '>') d--; } while(d > 0); }
    if(this.is('(')){
      var ps = this.params(); while(this.is('const') || this.is('override') || this.is('noexcept')) this.p++;
      if(this.is('->')){ this.p++; this.tryType(); }
      var body = null;
      if(this.is('{')) body = this.block();
      else if(this.eat('=>')){ var ex = this.expr(); this.eat(';'); body = { k:'block', body:[{ k:'return', e:ex }] }; }
      else this.eat(';');
      return { k:'func', name:name, params:ps, ret:t, body:body };
    }
    // свойство C#: { get; set; } или => выражение
    if(this.cs && this.is('{')){
      var p0 = this.p, getter = null; this.p++;
      while(!this.eat('}')){ if(this.is('get') && this.is('=>', 1)){ this.p += 2; getter = this.expr(); this.eat(';'); } else if(this.is('get') && this.is('{', 1)){ this.p++; getter = this.block(); } else this.p++; }
      var init = null; if(this.eat('=')){ init = this.expr(); } this.eat(';');
      return { k:'vars', list:[{ name:name, type:t, init:init, getter:getter }] };
    }
    if(this.cs && this.is('=>')){ this.p++; var g = this.expr(); this.eat(';'); return { k:'vars', list:[{ name:name, type:t, getter:g }] }; }
    var list = [this.varRest(t, name)];
    while(this.eat(',')) list.push(this.varRest(t, this.ident()));
    this.eat(';');
    return { k:'vars', list:list };
  };
  CP.varRest = function(t, name){
    var v = { name:name, type:t, init:null };
    if(this.is('[') && !this.cs){ this.p++; var n = this.is(']') ? null : this.expr(); this.want(']'); v.type = { name:'carray', args:[t], n:n }; }
    if(this.eat('=')) v.init = this.is('{') ? this.braceList() : this.assign();
    else if(this.is('(')){ this.p++; var args = []; while(!this.eat(')')){ args.push(this.assign()); this.eat(','); } v.ctorArgs = args; }
    else if(this.is('{')) v.init = this.braceList();
    return v;
  };
  CP.braceList = function(){ var line = this.peek().line; this.want('{'); var items = []; while(!this.eat('}')){ if(this.is('{')) items.push(this.braceList()); else if(this.is('[') && this.cs){ this.p++; var key = this.expr(); this.want(']'); this.want('='); items.push({ k:'kv', key:key, val:this.assign() }); } else items.push(this.assign()); this.eat(','); } return { k:'list', items:items, line:line }; };
  CP.block = function(){ this.want('{'); var body = []; while(!this.eat('}')){ if(this.peek().t === 'eof') throw CfErr('Не закрыта фигурная скобка «{»'); var s = this.stmt(); if(s) body.push(s); } return { k:'block', body:body }; };
  CP.stmt = function(){
    var x = this.peek(), line = x.line;
    if(this.eat(';')) return null;
    if(this.is('{')) return this.block();
    if(x.t === 'id'){
      switch(x.v){
        case 'if': this.p++; this.want('('); var c = this.expr(); this.want(')'); var th = this.stmt(), el = this.eat('else') ? this.stmt() : null; return { k:'if', c:c, t:th, e:el, line:line };
        case 'while': this.p++; this.want('('); var wc = this.expr(); this.want(')'); return { k:'while', c:wc, b:this.stmt(), line:line };
        case 'do': this.p++; var db = this.stmt(); this.want('while'); this.want('('); var dc = this.expr(); this.want(')'); this.eat(';'); return { k:'dowhile', c:dc, b:db, line:line };
        case 'for': return this.forStmt();
        case 'foreach': this.p++; this.want('('); var ft = this.tryType(), fn; if(this.is('(')){ this.p++; fn = []; while(!this.eat(')')){ fn.push(this.ident()); this.eat(','); } } else fn = this.ident(); this.want('in'); var fe = this.expr(); this.want(')'); return { k:'forin', name:fn, e:fe, b:this.stmt(), line:line };
        case 'return': this.p++; var re = this.is(';') ? null : (this.is('{') ? this.braceList() : this.expr()); this.eat(';'); return { k:'return', e:re, line:line };
        case 'break': this.p++; this.eat(';'); return { k:'break' };
        case 'continue': this.p++; this.eat(';'); return { k:'continue' };
        case 'throw': this.p++; var te = this.is(';') ? null : this.expr(); this.eat(';'); return { k:'throw', e:te, line:line };
        case 'try': this.p++; var tb = this.block(), cb = null, cn = null, fb = null; while(this.is('catch')){ this.p++; if(this.eat('(')){ var tt = this.tryType(); if(this.peek().t === 'id') cn = this.ident(); while(!this.eat(')')) this.p++; } if(this.is('when')){ this.p++; this.want('('); this.expr(); this.want(')'); } cb = this.block(); } if(this.eat('finally')) fb = this.block(); return { k:'try', b:tb, c:cb, cn:cn, f:fb };
        case 'switch': return this.switchStmt();
        case 'using':
          this.p++;
          if(this.eat('(')){ var us = this.declAhead() ? this.declStmt(true) : { k:'expr', e:this.expr() }; this.want(')'); return { k:'block', body:[us, this.stmt()] }; }
          return this.declStmt();
      }
      if(CF_MODS[x.v] && x.v !== 'static'){ this.skipMods(); return this.stmt(); }
      if(x.v === 'static' || x.v === 'const' || x.v === 'constexpr'){ this.p++; return this.stmt(); }
      if(this.declAhead()) return this.declStmt();
    }
    var e = this.expr(); this.eat(';'); return { k:'expr', e:e, line:line };
  };
  CP.declStmt = function(noSemi){
    var t = this.tryType();
    if(this.is('[')){ this.p++; var names = []; while(!this.eat(']')){ names.push(this.ident()); this.eat(','); } this.want('='); var e = this.expr(); if(!noSemi) this.eat(';'); return { k:'bind', names:names, e:e }; }
    var list = [this.varRest(t, this.ident())];
    while(this.eat(',')) list.push(this.varRest(t, this.ident()));
    if(!noSemi) this.eat(';');
    return { k:'decl', list:list, line:list[0] ? this.peek().line : 0 };
  };
  CP.forStmt = function(){
    var line = this.peek().line; this.p++; this.want('(');
    var init = null;
    if(!this.is(';')){
      if(this.declAhead()){
        var save = this.p, t = this.tryType();
        if(this.is('[')){ this.p++; var names = []; while(!this.eat(']')){ names.push(this.ident()); this.eat(','); } this.want(':'); var re = this.expr(); this.want(')'); return { k:'forin', name:names, e:re, b:this.stmt(), line:line }; }
        var nm = this.ident();
        if(this.eat(':')){ var re2 = this.expr(); this.want(')'); return { k:'forin', name:nm, type:t, e:re2, b:this.stmt(), line:line }; }
        this.p = save; init = this.declStmt(true);
      } else init = { k:'expr', e:this.exprList() };
    }
    this.want(';');
    var cond = this.is(';') ? null : this.expr(); this.want(';');
    var step = this.is(')') ? null : this.exprList(); this.want(')');
    return { k:'for', init:init, c:cond, s:step, b:this.stmt(), line:line };
  };
  CP.exprList = function(){ var l = [this.expr()]; while(this.eat(',')) l.push(this.expr()); return l.length === 1 ? l[0] : { k:'seq', l:l }; };
  CP.switchStmt = function(){
    var line = this.peek().line; this.p++; this.want('('); var e = this.expr(); this.want(')'); this.want('{');
    var cases = [], cur = null;
    while(!this.eat('}')){
      if(this.eat('case')){ var v = this.expr(); this.want(':'); cur = { v:v, body:[] }; cases.push(cur); continue; }
      if(this.is('default') && this.is(':', 1)){ this.p += 2; cur = { def:true, body:[] }; cases.push(cur); continue; }
      var s = this.stmt(); if(s && cur) cur.body.push(s);
    }
    return { k:'switch', e:e, cases:cases, line:line };
  };
  /* ---------- выражения ---------- */
  var CF_BIN = { '||':3, '??':3, '&&':4, '|':5, '^':6, '&':7, '==':8, '!=':8, '<':9, '>':9, '<=':9, '>=':9, 'is':9, 'as':9, '<<':10, '>>':10, '+':11, '-':11, '*':12, '/':12, '%':12 };
  CP.expr = function(){ return this.assign(); };
  CP.assign = function(){
    // лямбды C#: x => ..., (a, b) => ...
    if(this.cs && this.peek().t === 'id' && this.is('=>', 1)){ var pn = this.ident(); this.p++; return this.lambdaBody([pn]); }
    if(this.cs && this.is('(')){ var save = this.p, ok = false, ps = []; this.p++; while(this.peek().t === 'id' || this.is(',')){ if(this.peek().t === 'id'){ if(this.peek(1).t === 'id'){ this.tryType(); } ps.push(this.ident()); } else this.p++; } if(this.eat(')') && this.is('=>')){ this.p++; return this.lambdaBody(ps); } this.p = save; }
    var l = this.ternary();
    var x = this.peek();
    if(x.t === 'op' && /^([+\-*\/%&|^]|<<|>>)?=$/.test(x.v) && x.v !== '==' && x.v !== '<=' && x.v !== '>=' && x.v !== '!='){ this.p++; var r = this.is('{') ? this.braceList() : this.assign(); return { k:'assign', op:x.v, l:l, r:r, line:x.line }; }
    return l;
  };
  CP.lambdaBody = function(ps){ if(this.is('{')) return { k:'lambda', params:ps, body:this.block() }; return { k:'lambda', params:ps, body:{ k:'block', body:[{ k:'return', e:this.assign() }] } }; };
  CP.ternary = function(){
    var c = this.binary(0);
    if(this.is('?')){ this.p++; var a = this.assign(); this.want(':'); var b = this.assign(); return { k:'cond', c:c, a:a, b:b }; }
    return c;
  };
  CP.binary = function(min){
    var l = this.unary();
    while(true){
      var x = this.peek(); if(x.t !== 'op' && !(x.t === 'id' && (x.v === 'is' || x.v === 'as'))) break;
      var pr = CF_BIN[x.v]; if(!pr || pr <= min) break;
      this.p++;
      if(x.v === 'is' || x.v === 'as'){ var neg = this.eat('not'); var ty = this.tryType(); if(this.peek().t === 'id' && x.v === 'is' && !CF_BIN[this.peek().v]) this.p++; l = { k:x.v, e:l, type:ty, neg:neg, null:!ty && this.eat('null') }; if(!ty && x.v === 'is' && l.null === false && this.is('null')){ this.p++; l.null = true; } continue; }
      var r = this.binary(pr);
      l = { k:'bin', op:x.v, l:l, r:r, line:x.line };
    }
    return l;
  };
  CP.unary = function(){
    var x = this.peek();
    if(x.t === 'op' && (x.v === '!' || x.v === '-' || x.v === '+' || x.v === '~')){ this.p++; return { k:'un', op:x.v, e:this.unary() }; }
    if(x.t === 'op' && (x.v === '++' || x.v === '--')){ this.p++; return { k:'pre', op:x.v, e:this.unary() }; }
    if(x.t === 'op' && (x.v === '*' || x.v === '&')){ this.p++; return this.unary(); }
    if(x.t === 'id' && x.v === 'await'){ this.p++; return this.unary(); }
    if(x.t === 'id' && (x.v === 'sizeof' || x.v === 'typeof')){ this.p++; this.want('('); this.tryType(); this.want(')'); return { k:'num', v:8 }; }
    // приведение типа: (double)x
    if(this.is('(')){
      var save = this.p; this.p++;
      var t = this.tryType();
      if(t && this.eat(')') && (CF_BASE[t.name.split(' ')[0]] || t.name === 'string' || this.types[t.name]) && !(this.peek().t === 'op' && /^([+*\/%<>=!&|^?:.,;)\]}]|==|!=|<=|>=|&&|\|\|)$/.test(this.peek().v) && this.peek().v !== '(' )) return { k:'cast', type:t, e:this.unary() };
      this.p = save;
    }
    return this.postfix(this.primary());
  };
  CP.postfix = function(e){
    while(true){
      var x = this.peek();
      if(this.is('(')){ e = { k:'call', f:e, args:this.args(), line:x.line }; continue; }
      if(this.is('[')){ this.p++; var idx = this.expr(); this.want(']'); e = { k:'index', o:e, i:idx, line:x.line }; continue; }
      if(this.is('.') || this.is('->') || this.is('?.') || this.is('::')){
        var op = this.next().v, nm = this.ident(), targs = null;
        if(this.is('<')){ var sv = this.p; this.p++; var ta = []; var ok = true; do { var tt = this.typeInner(); if(!tt){ ok = false; break; } ta.push(tt); } while(this.eat(',')); if(ok && this.closeAngle() && this.is('(')) targs = ta; else this.p = sv; }
        e = { k:'member', o:e, n:nm, opt:op === '?.', targs:targs, line:x.line }; continue;
      }
      if(x.t === 'op' && (x.v === '++' || x.v === '--')){ this.p++; e = { k:'post', op:x.v, e:e }; continue; }
      if(this.cs && x.t === 'op' && x.v === '!' && (this.peek(1).v === '.' || this.peek(1).v === ')' || this.peek(1).v === ';')){ this.p++; continue; }
      break;
    }
    return e;
  };
  CP.args = function(){ this.want('('); var a = []; while(!this.eat(')')){ if(this.is('out') || this.is('ref')){ var kind = this.next().v; if(this.is('var') || this.declAhead()){ this.tryType(); } a.push({ k:'out', n:this.ident() }); } else if(this.peek().t === 'id' && this.is(':', 1) && this.cs){ this.p += 2; a.push(this.assign()); } else a.push(this.is('{') ? this.braceList() : this.assign()); this.eat(','); } return a; };
  CP.primary = function(){
    var x = this.next();
    if(x.t === 'num') return { k:'num', v:x.v, isInt:x.isInt };
    if(x.t === 'str'){ var s = x.v; while(this.peek().t === 'str'){ s += this.next().v; } return { k:'str', v:s }; }
    if(x.t === 'chr') return { k:'str', v:x.v, chr:true };
    if(x.t === 'interp') return { k:'interp', parts:x.v.map(function(p){ if(typeof p === 'string') return p; var m = /^(.*?)(?::([^:}]+))?$/.exec(p.expr), fmt = null, ex = p.expr; var colon = cfTopColon(p.expr); if(colon >= 0){ ex = p.expr.slice(0, colon); fmt = p.expr.slice(colon + 1); } var sub = new CfParser(ex, 'csharp'); return { e:sub.expr(), fmt:fmt }; }) };
    if(x.t === 'op' && x.v === '('){ var e = this.expr(); if(this.is(',') && this.cs){ var items = [e]; while(this.eat(',')) items.push(this.expr()); this.want(')'); return { k:'tuple', items:items }; } this.want(')'); return e; }
    if(x.t === 'op' && x.v === '{'){ this.p--; return this.braceList(); }
    if(x.t === 'op' && x.v === '['){
      // лямбда C++: [&](...) { ... }
      if(!this.cs){ while(!this.eat(']')) this.p++; var ps = this.is('(') ? this.params() : []; while(this.is('mutable') || this.is('->')){ if(this.eat('->')) this.tryType(); else this.p++; } return { k:'lambda', params:ps.map(function(p){ return p.name; }), body:this.block() }; }
      var arr = []; while(!this.eat(']')){ arr.push(this.assign()); this.eat(','); } return { k:'list', items:arr };
    }
    if(x.t === 'id'){
      if(x.v === 'true') return { k:'lit', v:true };
      if(x.v === 'false') return { k:'lit', v:false };
      if(x.v === 'null' || x.v === 'nullptr') return { k:'lit', v:null };
      if(x.v === 'this') return { k:'this' };
      if(x.v === 'default'){ if(this.eat('(')){ var dt = this.tryType(); this.want(')'); return { k:'default', type:dt }; } return { k:'lit', v:null }; }
      if(x.v === 'new') return this.newExpr();
      if(this.defines[x.v] !== undefined){ var sub = new CfParser(this.defines[x.v], this.cs ? 'csharp' : 'cpp'); return sub.expr(); }
      // вызов шаблона: static_cast<double>(x), Get<string>("k"), std::vector<int>{...}
      var name = x.v;
      while(this.is('::') && this.peek(1).t === 'id'){ this.p++; name += '::' + this.next().v; }
      if(this.is('<')){
        var sv = this.p; this.p++; var ta = [], ok = true;
        if(!this.closeAngle()){ do { var tt = this.typeInner(); if(!tt){ if(this.peek().t === 'num'){ this.p++; continue; } ok = false; break; } ta.push(tt); } while(this.eat(',')); ok = ok && this.closeAngle(); }
        if(ok && (this.is('(') || this.is('{'))){ if(this.is('{')) return { k:'construct', type:{ name:name.replace(/^std::/, ''), args:ta }, init:this.braceList() }; return { k:'id', n:name, targs:ta, line:x.line }; }
        this.p = sv;
      }
      if(this.is('{') && (this.types[name] || /^std::/.test(name)) && !this.cs) return { k:'construct', type:{ name:name.replace(/^std::/, ''), args:[] }, init:this.braceList() };
      return { k:'id', n:name, line:x.line };
    }
    throw CfErr('Неожиданное «' + x.v + '»', x.line);
  };
  function cfTopColon(s){ var d = 0, q = false; for(var i = 0; i < s.length; i++){ var c = s[i]; if(c === '"') q = !q; if(q) continue; if(c === '(' || c === '[' || c === '{') d++; else if(c === ')' || c === ']' || c === '}') d--; else if(c === '?' ) d += 100; else if(c === ':' && d === 0) return i; else if(c === ':' && d >= 100) d -= 100; } return -1; }
  CP.newExpr = function(){
    var line = this.peek().line;
    if(this.is('{')){ var bl = this.braceList(); return { k:'anon', items:bl.items }; }
    if(this.is('[')){ this.p++; this.want(']'); return { k:'list', items:this.braceList().items }; }
    if(this.is('(')){ return { k:'new', type:null, args:this.args(), init:this.is('{') ? this.braceList() : null, line:line }; }
    var t = this.typeInner();
    if(this.is('[')){ this.p++; var n = this.is(']') ? null : this.expr(); this.want(']'); var init = this.is('{') ? this.braceList() : null; return { k:'newarr', type:t, n:n, init:init }; }
    var args = this.is('(') ? this.args() : [];
    var init2 = this.is('{') ? this.braceList() : null;
    return { k:'new', type:t, args:args, init:init2, line:line };
  };

  /* ---------- выполнение ---------- */
  function CfMap(){ this.m = new Map(); }
  CfMap.prototype.key = function(k){ return typeof k === 'object' && k !== null ? JSON.stringify(k) : k; };
  CfMap.prototype.get = function(k){ return this.m.has(this.key(k)) ? this.m.get(this.key(k)).v : undefined; };
  CfMap.prototype.has = function(k){ return this.m.has(this.key(k)); };
  CfMap.prototype.set = function(k, v){ this.m.set(this.key(k), { k:k, v:v }); };
  CfMap.prototype.del = function(k){ return this.m.delete(this.key(k)); };
  CfMap.prototype.pairs = function(){ var out = []; this.m.forEach(function(x){ out.push(x); }); return out; };
  CfMap.prototype.sorted = false;
  function CfSet(){ this.s = new Map(); }
  function CfIter(arr, i){ this.arr = arr; this.i = i; }
  function CfBreak(){} function CfCont(){} function CfRet(v){ this.v = v; }
  function CfObj(type){ this.__t = type; }

  function CfVM(prog, lang, io){
    this.cs = lang === 'csharp'; this.lang = lang; this.out = []; this.io = io || {}; this.types = {}; this.funcs = {}; this.globals = new Map(); this.steps = 0;
    var self = this;
    (function reg(items){ items.forEach(function(it){
      if(it.k === 'ns') reg(it.items);
      else if(it.k === 'type'){ self.types[it.name] = it; (it.nested || []).forEach(function(n){ if(n.k === 'type') self.types[n.name] = n; else if(n.k === 'enum') self.types[n.name] = n; }); }
      else if(it.k === 'enum') self.types[it.name] = it;
      else if(it.k === 'func') (self.funcs[it.name] = self.funcs[it.name] || []).push(it);
      else if(it.k === 'vars') it.list.forEach(function(v){ self.globals.set(v.name, { v:undefined, t:v.type, decl:v }); });
    }); })(prog);
    var gs = { vars:this.globals, up:null };
    this.statics = {};
    this.globals.forEach(function(slot){ slot.v = slot.decl.init || slot.decl.ctorArgs ? self.initVar(slot.decl, gs) : self.defVal(slot.t); });
    Object.keys(this.types).forEach(function(n){ var td = self.types[n]; if(td.k !== 'type') return; var st = self.statics[n] = {}; (td.statics || []).forEach(function(v){ if(v.getter) return; st[v.name] = v.init || v.ctorArgs ? self.initVar(v, { vars:new Map(), up:gs, td:td }) : self.defVal(v.type); }); });
  }
  var VM = CfVM.prototype;
  VM.tick = function(){ if(++this.steps > 3e6) throw CfErr('Слишком долгое выполнение — возможен бесконечный цикл'); };
  VM.isIntType = function(t){ return !!(t && (CF_INT[t.name] || CF_INT[t.name.split(' ')[0]] || /^(size_t|std::size_t|Int32|Int64)$/.test(t.name))); };
  VM.defVal = function(t){
    if(!t) return undefined; var n = t.name;
    if(n === 'array' || n === 'carray'){ var a = []; if(t.n){ var len = this.eval(t.n, { vars:this.globals, up:null }); for(var i = 0; i < len; i++) a.push(this.defVal(t.args[0])); } return a; }
    if(/^(vector|List|deque|list|IEnumerable|IList|ICollection|Queue|Stack|IReadOnlyList|array)$/.test(n)) return [];
    if(/^(map|unordered_map|Dictionary|SortedDictionary|IDictionary|IReadOnlyDictionary)$/.test(n)){ var m = new CfMap(); m.sorted = /^(map|SortedDictionary)$/.test(n); return m; }
    if(/^(set|unordered_set|HashSet|SortedSet)$/.test(n)) return new CfMap();
    if(/^(string|String)$/.test(n)) return this.cs ? null : '';
    if(n === 'bool') return false;
    if(CF_BASE[n.split(' ')[0]] && n !== 'auto' && n !== 'var' && n !== 'object' && n !== 'dynamic' && n !== 'void') return 0;
    if(this.types[n] && this.types[n].k === 'type' && !this.cs) return this.construct(this.types[n], [], null, { vars:this.globals, up:null });
    return this.cs ? (this.types[n] && this.types[n].kind === 'struct' ? this.construct(this.types[n], [], null, { vars:this.globals, up:null }) : null) : undefined;
  };
  VM.lookup = function(sc, n){ for(var s = sc; s; s = s.up){ if(s.vars.has(n)) return s.vars.get(n); } return null; };
  VM.declare = function(sc, n, v, t){ sc.vars.set(n, { v:v, t:t }); };
  VM.initVar = function(d, sc){
    var t = d.type, v;
    if(d.ctorArgs){ var args = d.ctorArgs.map(function(a){ return this.eval(a, sc); }, this); v = this.constructType(t, args, null, sc); }
    else if(d.init && d.init.k === 'list') v = this.fromList(t, d.init, sc);
    else if(d.init) v = this.eval(d.init, sc);
    else v = this.defVal(t);
    return this.coerce(t, v);
  };
  VM.coerce = function(t, v){ if(t && typeof v === 'number' && this.isIntType(t)) return Math.trunc(v); if(t && /^(string|String)$/.test(t.name) && typeof v === 'number' && !this.cs) return v; return v; };
  VM.fromList = function(t, l, sc){
    var self = this, n = t ? t.name : 'auto';
    if(t && (this.types[n] && this.types[n].k === 'type')) return this.construct(this.types[n], l.items.map(function(x){ return x.k === 'list' ? x : self.eval(x, sc); }), null, sc, true);
    if(/^(map|unordered_map|Dictionary|SortedDictionary)$/.test(n)){ var m = new CfMap(); l.items.forEach(function(x){ if(x.k === 'kv') m.set(self.eval(x.key, sc), self.eval(x.val, sc)); else if(x.k === 'list') m.set(self.eval(x.items[0], sc), self.eval(x.items[1], sc)); }); return m; }
    var el = t && t.args && t.args[0];
    if(t && /^(pair|tuple|KeyValuePair)$/.test(n)) return { first:this.eval(l.items[0], sc), second:this.eval(l.items[1], sc) };
    return l.items.map(function(x){ return x.k === 'list' ? self.fromList(el || null, x, sc) : self.coerce(el, self.eval(x, sc)); });
  };
  VM.construct = function(td, args, init, sc, positional){
    if(td.k === 'enum') return 0;
    var o = new CfObj(td.name), self = this;
    var fs = td.fields;
    var inner = { vars:new Map(), up:{ vars:this.globals, up:null } };
    fs.forEach(function(f){ o[f.name] = f.init || f.ctorArgs ? self.initVar(f, inner) : self.defVal(f.type); });
    if(td.params){ td.params.forEach(function(p, i){ o[p.name] = self.coerce(p.type, args[i] !== undefined ? args[i] : (p.def ? self.eval(p.def, sc) : self.defVal(p.type))); }); }
    else if(td.ctor && !positional){ this.callFunc({ params:td.ctor.params, body:td.ctor.body, name:td.name }, args, o, td); }
    else if(args.length){ args.forEach(function(a, i){ var f = fs[i]; if(f) o[f.name] = a && a.k === 'list' ? self.fromList(f.type, a, sc) : self.coerce(f.type, a); }); }
    if(init) this.applyInit(o, init, sc);
    return o;
  };
  VM.applyInit = function(o, init, sc){
    var self = this;
    init.items.forEach(function(x){
      if(x.k === 'assign' && x.l.k === 'id'){ var v = x.r.k === 'list' ? self.fromList(null, x.r, sc) : self.eval(x.r, sc); if(o instanceof CfMap) o.set(x.l.n, v); else o[x.l.n] = v; }
      else if(x.k === 'kv'){ o.set(self.eval(x.key, sc), self.eval(x.val, sc)); }
      else if(x.k === 'list' && o instanceof CfMap){ o.set(self.eval(x.items[0], sc), self.eval(x.items[1], sc)); }
      else if(Array.isArray(o)) o.push(self.eval(x, sc));
    });
  };
  VM.constructType = function(t, args, init, sc){
    var n = t ? t.name : null;
    if(!n) return {};
    if(this.types[n]) return this.construct(this.types[n], args, init, sc);
    var b = this.builtinNew(t, args, init, sc); if(b !== undefined) return b;
    throw CfErr('Неизвестный тип «' + n + '»');
  };
  VM.builtinNew = function(t, args, init, sc){
    var n = t.name, self = this;
    if(/^(vector|List|deque|list|Queue|Stack|HashSet|IEnumerable)$/.test(n) || /^(map|unordered_map|Dictionary|SortedDictionary|set|unordered_set|SortedSet)$/.test(n)){
      var v = this.defVal(t);
      if(Array.isArray(v)){ if(args.length === 2 && typeof args[0] === 'number' && !this.cs){ for(var i = 0; i < args[0]; i++) v.push(args[1]); } else if(args.length === 1 && typeof args[0] === 'number' && !this.cs){ for(var j = 0; j < args[0]; j++) v.push(this.defVal(t.args[0])); } else if(args.length === 1 && Array.isArray(args[0])) v = args[0].slice(); else if(args.length === 2 && args[0] instanceof CfIter) v = args[0].arr.slice(args[0].i, args[1].i); }
      if(init) this.applyInit(v, init, sc);
      return v;
    }
    if(/^(string|String)$/.test(n)) return args.length === 2 && typeof args[0] === 'number' ? String(args[1]).repeat(args[0]) : String(args[0] || '');
    if(/^(StringBuilder)$/.test(n)){ var sb = { __t:'StringBuilder', s:args[0] ? String(args[0]) : '' }; return sb; }
    if(/^(pair|KeyValuePair|Tuple)$/.test(n)) return { first:args[0], second:args[1], Key:args[0], Value:args[1], Item1:args[0], Item2:args[1] };
    if(/^(Random)$/.test(n)) return { __t:'Random' };
    if(/^(object)$/.test(n)) return {};
    if(/^(DateTime)$/.test(n)) return args.length ? new Date(args[0], (args[1] || 1) - 1, args[2] || 1) : new Date();
    if(/^(Exception|ArgumentException|InvalidOperationException|runtime_error|invalid_argument|logic_error|exception)$/.test(n)) return { __t:'Exception', Message:args[0] || '', what:args[0] || '' };
    if(this.io.newObj){ var r = this.io.newObj(n, args, this); if(r !== undefined) return r; }
    return undefined;
  };
  VM.callFunc = function(f, args, self, td){
    if(!f.body) throw CfErr('У функции «' + f.name + '» нет тела');
    var sc = { vars:new Map(), up:{ vars:this.globals, up:null }, self:self, td:td };
    var vm = this;
    f.params.forEach(function(p, i){ var v = args[i]; if(v === undefined && p.def) v = vm.eval(p.def, sc); if(v === undefined) v = vm.defVal(p.type); sc.vars.set(p.name, { v:vm.coerce(p.type, v), t:p.type }); });
    try { this.exec(f.body, sc); } catch(e){ if(e instanceof CfRet) return f.ret && e.v && e.v.k === 'list' ? e.v : e.v; throw e; }
    return undefined;
  };
  VM.callFn = function(fn, args){
    if(typeof fn === 'function') return fn.apply(null, args);
    if(fn && fn.__lambda) return fn.call(args);
    throw CfErr('Это не функция');
  };
  VM.lambda = function(node, sc){
    var vm = this;
    var L = { __lambda:true, call:function(args){
      var s2 = { vars:new Map(), up:sc, self:sc.self, td:sc.td };
      node.params.forEach(function(p, i){ s2.vars.set(p, { v:args[i] }); });
      try { vm.exec(node.body, s2); } catch(e){ if(e instanceof CfRet) return e.v; throw e; }
      return undefined;
    } };
    return L;
  };
  VM.exec = function(s, sc){
    if(!s) return;
    this.tick();
    var vm = this;
    switch(s.k){
      case 'block': var inner = { vars:new Map(), up:sc, self:sc.self, td:sc.td }; for(var i = 0; i < s.body.length; i++) this.exec(s.body[i], inner); return;
      case 'expr': this.eval(s.e, sc); return;
      case 'decl': s.list.forEach(function(d){ var v = vm.initVar(d, sc); if(d.init && d.init.k === 'list' && (!d.type || d.type.name === 'auto' || d.type.name === 'var')) v = vm.fromList(null, d.init, sc); sc.vars.set(d.name, { v:v, t:d.type && d.type.name !== 'auto' && d.type.name !== 'var' ? d.type : vm.guessType(d.init, sc) }); }); return;
      case 'bind': var bv = this.eval(s.e, sc); s.names.forEach(function(n, i){ sc.vars.set(n, { v:vm.part(bv, i) }); }); return;
      case 'if': if(this.truthy(this.eval(s.c, sc))) this.exec(s.t, sc); else if(s.e) this.exec(s.e, sc); return;
      case 'while': while(this.truthy(this.eval(s.c, sc))){ this.tick(); try { this.exec(s.b, sc); } catch(e){ if(e instanceof CfBreak) break; if(e instanceof CfCont) continue; throw e; } } return;
      case 'dowhile': do { this.tick(); try { this.exec(s.b, sc); } catch(e){ if(e instanceof CfBreak) break; if(e instanceof CfCont) continue; throw e; } } while(this.truthy(this.eval(s.c, sc))); return;
      case 'for':
        var fs = { vars:new Map(), up:sc, self:sc.self, td:sc.td };
        if(s.init) this.exec(s.init, fs);
        while(!s.c || this.truthy(this.eval(s.c, fs))){ this.tick(); try { this.exec(s.b, fs); } catch(e){ if(e instanceof CfBreak) break; if(!(e instanceof CfCont)) throw e; } if(s.s) this.eval(s.s, fs); }
        return;
      case 'forin':
        var coll = this.iterable(this.eval(s.e, sc));
        for(var k = 0; k < coll.length; k++){
          this.tick();
          var ls = { vars:new Map(), up:sc, self:sc.self, td:sc.td };
          if(Array.isArray(s.name)) s.name.forEach(function(n, j){ ls.vars.set(n, { v:vm.part(coll[k], j) }); }); else ls.vars.set(s.name, { v:coll[k], t:s.type && s.type.name !== 'auto' && s.type.name !== 'var' ? s.type : null });
          try { this.exec(s.b, ls); } catch(e){ if(e instanceof CfBreak) break; if(e instanceof CfCont) continue; throw e; }
        }
        return;
      case 'return': throw new CfRet(s.e ? (s.e.k === 'list' ? this.fromRet(s.e, sc) : this.eval(s.e, sc)) : undefined);
      case 'break': throw new CfBreak();
      case 'continue': throw new CfCont();
      case 'throw': var ev = s.e ? this.eval(s.e, sc) : { Message:'исключение' }; throw CfErr('Исключение: ' + (ev && (ev.Message || ev.what) || ev), s.line);
      case 'try':
        try { this.exec(s.b, sc); }
        catch(e){ if(e instanceof CfRet || e instanceof CfBreak || e instanceof CfCont) throw e; if(!s.c) throw e; var cs2 = { vars:new Map(), up:sc, self:sc.self, td:sc.td }; if(s.cn) cs2.vars.set(s.cn, { v:{ Message:String(e.message || e), what:String(e.message || e) } }); this.exec(s.c, cs2); }
        finally { if(s.f) this.exec(s.f, sc); }
        return;
      case 'switch':
        var sv = this.eval(s.e, sc), hit = false;
        try { for(var c = 0; c < s.cases.length; c++){ var cs = s.cases[c]; if(!hit && (cs.def || this.eq(this.eval(cs.v, sc), sv))) hit = true; if(hit) cs.body.forEach(function(st){ vm.exec(st, sc); }); }
          if(!hit){ var d = s.cases.filter(function(x){ return x.def; })[0]; if(d) d.body.forEach(function(st){ vm.exec(st, sc); }); } }
        catch(e){ if(!(e instanceof CfBreak)) throw e; }
        return;
    }
  };
  VM.fromRet = function(l, sc){
    // return {a, b}; — по типу результата функции
    var f = this.curFunc; if(f && f.ret) return this.fromList(f.ret, l, sc);
    return this.fromList(null, l, sc);
  };
  VM.guessType = function(e, sc){ if(!e) return null; if(e.k === 'num') return e.isInt ? { name:'int' } : { name:'double' }; if(e.k === 'id'){ var sl = this.lookup(sc, e.n); return sl ? sl.t : null; } if(e.k === 'call' && e.f.k === 'member' && /^(size|Count|Length|length|count)$/.test(e.f.n)) return { name:'size_t' }; return null; };
  VM.part = function(v, i){ if(v && v.k !== undefined && v.v !== undefined && i < 2) return i ? v.v : v.k; if(v && v.first !== undefined) return i ? v.second : v.first; if(v && v.Key !== undefined) return i ? v.Value : v.Key; if(Array.isArray(v)) return v[i]; if(v && v.Item1 !== undefined) return v['Item' + (i + 1)]; return undefined; };
  VM.iterable = function(v){
    if(Array.isArray(v)) return v;
    if(v instanceof CfMap){ var ps = v.pairs().map(function(p){ return { first:p.k, second:p.v, Key:p.k, Value:p.v }; }); if(v.sorted || !this.cs) ps.sort(function(a, b){ return a.first < b.first ? -1 : (a.first > b.first ? 1 : 0); }); return ps; }
    if(typeof v === 'string') return v.split('');
    if(v && v.__group) return v.items;
    if(v && typeof v === 'object') return Object.keys(v).filter(function(k){ return k !== '__t'; }).map(function(k){ return { first:k, second:v[k], Key:k, Value:v[k] }; });
    return [];
  };
  VM.truthy = function(v){ return !!v && !(v instanceof CfMap && false); };
  VM.eq = function(a, b){ if(a instanceof Date && b instanceof Date) return +a === +b; return a === b || (a == null && b == null); };
  VM.isIntExpr = function(e, sc){
    if(!e) return false;
    switch(e.k){
      case 'num': return !!e.isInt;
      case 'id': var sl = this.lookup(sc, e.n); return !!(sl && this.isIntType(sl.t));
      case 'cast': return this.isIntType(e.type);
      case 'bin': return '+-*/%'.indexOf(e.op) >= 0 && this.isIntExpr(e.l, sc) && this.isIntExpr(e.r, sc);
      case 'un': return this.isIntExpr(e.e, sc);
      case 'post': case 'pre': return this.isIntExpr(e.e, sc);
      case 'call': return !!(e.f.k === 'member' && /^(size|Count|Length|length|count|IndexOf|find)$/.test(e.f.n));
      case 'member': if(/^(Count|Length)$/.test(e.n)) return true; var ov = null; try { ov = this.eval(e.o, sc); } catch(_){} if(ov && ov.__t && this.types[ov.__t]){ var fd = this.types[ov.__t].fields.filter(function(f){ return f.name === e.n; })[0]; return !!(fd && this.isIntType(fd.type)); } return false;
    }
    return false;
  };
  VM.num = function(v){ if(typeof v === 'number') return v; if(typeof v === 'boolean') return v ? 1 : 0; if(typeof v === 'string' && v.length === 1 && !this.cs) return v.charCodeAt(0); if(v instanceof Date) return +v; if(v == null) return 0; var n = Number(v); return n; };
  VM.binop = function(op, a, b, e, sc){
    switch(op){
      case '+': if(typeof a === 'string' || typeof b === 'string') return (a == null ? '' : this.str(a)) + (b == null ? '' : this.str(b)); if(a instanceof CfIter) return new CfIter(a.arr, a.i + b); return this.num(a) + this.num(b);
      case '-': if(a instanceof CfIter && b instanceof CfIter) return a.i - b.i; if(a instanceof CfIter) return new CfIter(a.arr, a.i - b); if(a instanceof Date && b instanceof Date) return { __t:'TimeSpan', ms:a - b, TotalDays:(a - b) / 864e5, Days:Math.floor((a - b) / 864e5), TotalHours:(a - b) / 36e5 }; return this.num(a) - this.num(b);
      case '*': return this.num(a) * this.num(b);
      case '/': var bb = this.num(b); if(bb === 0 && this.isIntExpr(e.l, sc) && this.isIntExpr(e.r, sc)) throw CfErr('Деление на ноль', e.line); var r = this.num(a) / bb; return this.isIntExpr(e.l, sc) && this.isIntExpr(e.r, sc) ? Math.trunc(r) : r;
      case '%': return this.num(a) % this.num(b);
      case '==': return this.eq(a, b);
      case '!=': return !this.eq(a, b);
      case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
      case '&': return this.num(a) & this.num(b); case '|': return this.num(a) | this.num(b); case '^': return this.num(a) ^ this.num(b);
      case '<<': if(a && a.__t === 'ostream'){ a.write(b); return a; } return this.num(a) << this.num(b);
      case '>>': return this.num(a) >> this.num(b);
    }
    throw CfErr('Неизвестная операция ' + op);
  };
  VM.str = function(v, fmt){
    if(v === null || v === undefined) return '';
    if(typeof v === 'boolean') return this.cs ? (v ? 'True' : 'False') : (v ? '1' : '0');
    if(typeof v === 'number'){
      if(fmt){
        var m = /^([NnFfPpCcDdEe0#])(\d*)/.exec(fmt);
        if(m && /[NnFfPpCcDd]/.test(m[1])){ var d = m[2] === '' ? (/[Dd]/.test(m[1]) ? 0 : 2) : +m[2], x = /[Pp]/.test(m[1]) ? v * 100 : v; var s = x.toLocaleString('ru-RU', { minimumFractionDigits:d, maximumFractionDigits:d, useGrouping:/[NnCcPp]/.test(m[1]) }).replace(/ /g, ' '); return s + (/[Pp]/.test(m[1]) ? '%' : (/[Cc]/.test(m[1]) ? ' ₽' : '')); }
        if(/^[0#,]+(\.[0#]+)?$/.test(fmt)){ var dec = (fmt.split('.')[1] || '').length; return v.toFixed(dec); }
      }
      if(this.cs) return String(Math.round(v * 1e10) / 1e10).replace('.', ',');
      return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
    }
    if(v instanceof Date) return v.toLocaleDateString('ru-RU');
    if(Array.isArray(v)) return this.cs ? 'System.Collections.Generic.List' : v.map(this.str, this).join(' ');
    if(v && v.__t === 'StringBuilder') return v.s;
    if(v && v.__t && this.types[v.__t] && this.types[v.__t].params){ var self = this, td = this.types[v.__t]; return td.name + ' { ' + td.params.map(function(p){ return p.name + ' = ' + self.str(v[p.name]); }).join(', ') + ' }'; }
    if(typeof v === 'object') return JSON.stringify(cfToJson(v));
    return String(v);
  };
  VM.ref = function(e, sc){
    // ссылка для присваивания
    var vm = this;
    if(e.k === 'id'){
      var sl = this.lookup(sc, e.n);
      if(sl) return { get:function(){ return sl.v; }, set:function(v){ sl.v = vm.coerce(sl.t, v); } };
      if(sc.self && sc.self[e.n] !== undefined) return { get:function(){ return sc.self[e.n]; }, set:function(v){ sc.self[e.n] = v; } };
      if(sc.td && this.statics[sc.td.name] && e.n in this.statics[sc.td.name]){ var st = this.statics[sc.td.name]; return { get:function(){ return st[e.n]; }, set:function(v){ st[e.n] = v; } }; }
      throw CfErr('Неизвестная переменная «' + e.n + '»', e.line);
    }
    if(e.k === 'member'){ var o = this.eval(e.o, sc); return { get:function(){ return vm.getMember(o, e.n, e); }, set:function(v){ if(o == null) throw CfErr('Обращение к пустому объекту', e.line); o[e.n] = v; } }; }
    if(e.k === 'index'){
      var oo = this.eval(e.o, sc), ix = this.eval(e.i, sc);
      if(oo instanceof CfMap) return { get:function(){ if(!oo.has(ix)){ if(vm.cs) throw CfErr('Ключ «' + ix + '» не найден в словаре', e.line); oo.set(ix, 0); } return oo.get(ix); }, set:function(v){ oo.set(ix, v); } };
      return { get:function(){ return vm.index(oo, ix, e); }, set:function(v){ if(Array.isArray(oo) && (ix < 0 || ix >= oo.length) && vm.cs) throw CfErr('Индекс ' + ix + ' вне диапазона', e.line); oo[ix] = v; } };
    }
    throw CfErr('Сюда нельзя присвоить');
  };
  VM.index = function(o, i, e){
    if(o instanceof CfMap){ if(!o.has(i)){ if(this.cs) throw CfErr('Ключ «' + i + '» не найден в словаре', e && e.line); o.set(i, 0); } return o.get(i); }
    if(Array.isArray(o)){ if(typeof i === 'object' && i && i.__t === 'Index') i = o.length - i.n; if(i < 0 || i >= o.length){ if(this.cs) throw CfErr('Индекс ' + i + ' вне диапазона (элементов ' + o.length + ')', e && e.line); return undefined; } return o[i]; }
    if(typeof o === 'string') return o[i];
    if(o && typeof o === 'object') return o[i];
    throw CfErr('Индексация пустого значения', e && e.line);
  };
  VM.eval = function(e, sc){
    var vm = this;
    switch(e.k){
      case 'num': return e.v;
      case 'str': return e.v;
      case 'lit': return e.v;
      case 'this': return sc.self;
      case 'interp': return e.parts.map(function(p){ return typeof p === 'string' ? p : vm.str(vm.eval(p.e, sc), p.fmt); }).join('');
      case 'tuple': var tp = {}; e.items.forEach(function(x, i){ tp['Item' + (i + 1)] = vm.eval(x, sc); }); return tp;
      case 'list': return this.fromList(null, e, sc);
      case 'anon': var ao = {}; e.items.forEach(function(x){ if(x.k === 'assign') ao[x.l.n] = vm.eval(x.r, sc); else if(x.k === 'member') ao[x.n] = vm.eval(x, sc); else if(x.k === 'id') ao[x.n] = vm.eval(x, sc); }); return ao;
      case 'id': return this.getId(e, sc);
      case 'default': return this.defVal(e.type);
      case 'seq': var lv; e.l.forEach(function(x){ lv = vm.eval(x, sc); }); return lv;
      case 'assign':
        var rf = this.ref(e.l, sc), rv = e.r.k === 'list' ? this.fromList(null, e.r, sc) : this.eval(e.r, sc);
        if(e.op !== '='){ var op = e.op.slice(0, -1); rv = this.binop(op, rf.get(), rv, { l:e.l, r:e.r, line:e.line }, sc); }
        rf.set(rv); return rv;
      case 'cond': return this.truthy(this.eval(e.c, sc)) ? this.eval(e.a, sc) : this.eval(e.b, sc);
      case 'bin':
        if(e.op === '&&') return this.truthy(this.eval(e.l, sc)) && this.truthy(this.eval(e.r, sc));
        if(e.op === '||') return this.truthy(this.eval(e.l, sc)) || this.truthy(this.eval(e.r, sc));
        if(e.op === '??'){ var lv2 = this.eval(e.l, sc); return lv2 != null ? lv2 : this.eval(e.r, sc); }
        return this.binop(e.op, this.eval(e.l, sc), this.eval(e.r, sc), e, sc);
      case 'is': var iv = this.eval(e.e, sc), res = e.null ? iv == null : (e.type ? this.isType(iv, e.type) : false); return e.neg ? !res : res;
      case 'as': var av = this.eval(e.e, sc); return this.isType(av, e.type) ? av : null;
      case 'un': var u = this.eval(e.e, sc); if(e.op === '!') return !this.truthy(u); if(e.op === '-') return -this.num(u); if(e.op === '~') return ~this.num(u); return this.num(u);
      case 'pre': case 'post':
        var r2 = this.ref(e.e, sc), old = r2.get(), nv = old instanceof CfIter ? new CfIter(old.arr, old.i + (e.op === '++' ? 1 : -1)) : this.num(old) + (e.op === '++' ? 1 : -1); r2.set(nv); return e.k === 'pre' ? nv : old;
      case 'cast': var cv = this.eval(e.e, sc); if(this.isIntType(e.type)) return Math.trunc(this.num(cv)); if(/^(double|float|decimal)$/.test(e.type.name)) return this.num(cv); if(e.type.name === 'string') return this.str(cv); return cv;
      case 'index': return this.index(this.eval(e.o, sc), this.eval(e.i, sc), e);
      case 'member': var mo = this.eval(e.o, sc); if(mo == null && e.opt) return null; return this.getMember(mo, e.n, e, sc);
      case 'lambda': return this.lambda(e, sc);
      case 'construct': return e.init ? (this.types[e.type.name] ? this.fromList(e.type, e.init, sc) : this.fromList(e.type, e.init, sc)) : this.constructType(e.type, [], null, sc);
      case 'new':
        var na = e.args.map(function(a){ return a.k === 'list' ? a : vm.eval(a, sc); });
        if(!e.type){ return {}; }
        return this.constructType(e.type, na, e.init, sc);
      case 'newarr': if(e.init) return this.fromList({ name:'array', args:[e.type] }, e.init, sc); var len = this.num(this.eval(e.n, sc)), arr = []; for(var i = 0; i < len; i++) arr.push(this.defVal(e.type)); return arr;
      case 'call': return this.call(e, sc);
    }
    throw CfErr('Неподдерживаемое выражение ' + e.k);
  };
  VM.isType = function(v, t){ var n = t.name; if(/^(int|long|double|float|decimal)$/.test(n)) return typeof v === 'number'; if(n === 'string') return typeof v === 'string'; if(n === 'bool') return typeof v === 'boolean'; return !!(v && v.__t === n); };
  VM.getId = function(e, sc){
    var n = e.n, sl = this.lookup(sc, n);
    if(sl) return sl.v;
    if(sc.self && typeof sc.self === 'object' && n in sc.self) return sc.self[n];
    if(sc.self && sc.td){ var gt = this.findGetter(sc.td, n); if(gt) return this.runGetter(gt, sc.self, sc.td); }
    if(sc.td && this.statics[sc.td.name] && n in this.statics[sc.td.name]) return this.statics[sc.td.name][n];
    var bare = n.replace(/^std::/, '');
    if(this.funcs[bare]) return { __fn:bare };
    if(sc.td && sc.td.methods[n]) return { __method:n, self:sc.self, td:sc.td };
    if(this.types[bare]) return { __type:bare };
    if(bare === 'cout' || bare === 'cerr') return this.ostream();
    if(bare === 'endl') return '\n';
    if(/^(npos|string::npos)$/.test(bare)) return -1;
    if(/^numeric_limits/.test(bare)) return { __t:'limits' };
    var g = this.builtinGlobal(bare); if(g !== undefined) return g;
    if(this.io.global){ var r = this.io.global(bare, this); if(r !== undefined) return r; }
    throw CfErr('Неизвестное имя «' + n + '»', e.line);
  };
  VM.findGetter = function(td, n){ var all = td.fields.concat(td.statics || []); for(var i = 0; i < all.length; i++) if(all[i].name === n && all[i].getter) return all[i]; return null; };
  VM.runGetter = function(f, self, td){ var sc = { vars:new Map(), up:{ vars:this.globals, up:null }, self:self, td:td }; if(f.getter.k === 'block'){ try { this.exec(f.getter, sc); } catch(e){ if(e instanceof CfRet) return e.v; throw e; } return undefined; } return this.eval(f.getter, sc); };
  VM.ostream = function(){ var vm = this; return { __t:'ostream', write:function(v){ var s = vm.str(v); var last = vm.out.length ? vm.out[vm.out.length - 1] : null; if(last !== null && !/\n$/.test(last)) vm.out[vm.out.length - 1] = last + s; else vm.out.push(s); } }; };
  VM.builtinGlobal = function(n){
    var M = { Math:'Math', Console:'Console', Convert:'Convert', String:'String', string:'String', double:'Double', Double:'Double', decimal:'Double', Decimal:'Double', int:'Int', Int32:'Int', long:'Int', Int64:'Int', DateTime:'DateTime', Enumerable:'Enumerable', TimeSpan:'TimeSpan', StringComparison:'SC', Environment:'Environment' };
    if(M[n]) return { __static:M[n] };
    return undefined;
  };
  VM.call = function(e, sc){
    var vm = this, f = e.f;
    var elemT = null;
    if(f.k === 'member' && f.o.k === 'id'){ var s0 = this.lookup(sc, f.o.n) || (sc.self && sc.td ? { t:(sc.td.fields.filter(function(x){ return x.name === f.o.n; })[0] || {}).type } : null); if(s0 && s0.t && s0.t.args && s0.t.args.length) elemT = s0.t.args.length === 2 && /map|Dictionary/.test(s0.t.name) ? { name:'pair', args:s0.t.args } : s0.t.args[0]; }
    var argv = function(){ return e.args.map(function(a){ return a.k === 'out' ? a : (a.k === 'list' ? vm.fromList(elemT, a, sc) : vm.eval(a, sc)); }); };
    if(f.k === 'id'){
      var n = f.n.replace(/^std::/, ''), sl = this.lookup(sc, f.n);
      if(sl && sl.v && (sl.v.__lambda || typeof sl.v === 'function')) return this.callFn(sl.v, argv());
      if(sc.td && sc.td.methods[n]){ var m = sc.td.methods[n]; var keep = this.curFunc; this.curFunc = m; try { return this.callFunc(m, argv(), m.static ? null : sc.self, sc.td); } finally { this.curFunc = keep; } }
      if(this.funcs[n]){ var cand = this.funcs[n], args = argv(), fn = cand.filter(function(x){ return x.params.length === args.length && x.body; })[0] || cand.filter(function(x){ return x.body; })[0]; var keep2 = this.curFunc; this.curFunc = fn; try { return this.callFunc(fn, args, null, null); } finally { this.curFunc = keep2; } }
      if(this.types[n]) return this.constructType({ name:n, args:f.targs || [] }, argv(), null, sc);
      return this.builtinCall(n, argv(), f, sc, e);
    }
    if(f.k === 'member'){
      if(f.o.k === 'id' && (f.o.n === 'std' )) return this.builtinCall(f.n, argv(), f, sc, e);
      var o = this.eval(f.o, sc);
      if(o == null && f.opt) return null;
      return this.method(o, f.n, argv(), f, sc, e);
    }
    var fv = this.eval(f, sc);
    return this.callFn(fv, argv());
  };
  VM.sortCmp = function(cmp){ var vm = this; if(!cmp) return function(a, b){ return a < b ? -1 : (a > b ? 1 : 0); }; return function(a, b){ var r = vm.callFn(cmp, [a, b]); if(typeof r === 'boolean') return r ? -1 : (vm.callFn(cmp, [b, a]) ? 1 : 0); return r; }; };
  VM.builtinCall = function(n, a, f, sc, e){
    var vm = this, targ = f.targs && f.targs[0];
    switch(n){
      case 'static_cast': case 'dynamic_cast': case 'reinterpret_cast': case 'const_cast': return targ && this.isIntType(targ) ? Math.trunc(this.num(a[0])) : (targ && targ.name === 'string' ? this.str(a[0]) : a[0]);
      case 'sqrt': return Math.sqrt(a[0]); case 'pow': return Math.pow(a[0], a[1]); case 'abs': case 'fabs': case 'llabs': return Math.abs(a[0]);
      case 'round': return Math.round(a[0]); case 'floor': return Math.floor(a[0]); case 'ceil': return Math.ceil(a[0]); case 'trunc': return Math.trunc(a[0]);
      case 'log': return Math.log(a[0]); case 'log10': return Math.log10(a[0]); case 'exp': return Math.exp(a[0]); case 'sin': return Math.sin(a[0]); case 'cos': return Math.cos(a[0]); case 'tan': return Math.tan(a[0]); case 'atan2': return Math.atan2(a[0], a[1]); case 'hypot': return Math.hypot.apply(null, a);
      case 'max': if(Array.isArray(a[0])) return Math.max.apply(null, a[0]); return a.length > 2 && a[2] && a[2].__lambda ? (this.callFn(a[2], [a[0], a[1]]) ? a[1] : a[0]) : (a[0] > a[1] ? a[0] : a[1]);
      case 'min': if(Array.isArray(a[0])) return Math.min.apply(null, a[0]); return a.length > 2 && a[2] && a[2].__lambda ? (this.callFn(a[2], [a[1], a[0]]) ? a[1] : a[0]) : (a[0] < a[1] ? a[0] : a[1]);
      case 'swap': var r0 = this.ref(e.args[0], sc), r1 = this.ref(e.args[1], sc), t = r0.get(); r0.set(r1.get()); r1.set(t); return undefined;
      case 'to_string': return this.str(a[0]);
      case 'stod': case 'stof': case 'atof': return parseFloat(String(a[0]).replace(',', '.'));
      case 'stoi': case 'stol': case 'atoi': return parseInt(a[0], 10);
      case 'accumulate': var it0 = a[0], it1 = a[1], acc = a[2]; for(var i = it0.i; i < it1.i; i++) acc = a[3] ? this.callFn(a[3], [acc, it0.arr[i]]) : this.binop('+', acc, it0.arr[i], { l:e.args[2], r:{ k:'num' } }, sc); return acc;
      case 'sort': case 'stable_sort': var arr = a[0].arr, part = arr.slice(a[0].i, a[1].i).sort(this.sortCmp(a[2])); for(var k = 0; k < part.length; k++) arr[a[0].i + k] = part[k]; return undefined;
      case 'reverse': var ra = a[0].arr, rp = ra.slice(a[0].i, a[1].i).reverse(); for(var k2 = 0; k2 < rp.length; k2++) ra[a[0].i + k2] = rp[k2]; return undefined;
      case 'count_if': return a[0].arr.slice(a[0].i, a[1].i).filter(function(x){ return vm.truthy(vm.callFn(a[2], [x])); }).length;
      case 'count': return a[0].arr.slice(a[0].i, a[1].i).filter(function(x){ return vm.eq(x, a[2]); }).length;
      case 'find': var fi = a[0].arr.indexOf(a[2], a[0].i); return new CfIter(a[0].arr, fi < 0 || fi >= a[1].i ? a[1].i : fi);
      case 'find_if': for(var j = a[0].i; j < a[1].i; j++) if(this.truthy(this.callFn(a[2], [a[0].arr[j]]))) return new CfIter(a[0].arr, j); return new CfIter(a[0].arr, a[1].i);
      case 'any_of': return a[0].arr.slice(a[0].i, a[1].i).some(function(x){ return vm.truthy(vm.callFn(a[2], [x])); });
      case 'all_of': return a[0].arr.slice(a[0].i, a[1].i).every(function(x){ return vm.truthy(vm.callFn(a[2], [x])); });
      case 'max_element': case 'min_element': var best = a[0].i; for(var q = a[0].i + 1; q < a[1].i; q++){ var less = a[2] ? this.truthy(this.callFn(a[2], [a[0].arr[best], a[0].arr[q]])) : a[0].arr[best] < a[0].arr[q]; if(n === 'max_element' ? less : !less && a[0].arr[q] !== a[0].arr[best] && (a[2] ? this.truthy(this.callFn(a[2], [a[0].arr[q], a[0].arr[best]])) : a[0].arr[q] < a[0].arr[best])) best = q; } return new CfIter(a[0].arr, best);
      case 'distance': return a[1].i - a[0].i;
      case 'make_pair': case 'make_tuple': return { first:a[0], second:a[1], Item1:a[0], Item2:a[1] };
      case 'printf': var fmt = String(a[0]), ai = 1; this.ostream().write(fmt.replace(/%[-+ 0#]*\d*(?:\.(\d+))?[dioufFeEgGsc%]/g, function(m, prec){ if(m === '%%') return '%'; var v = a[ai++]; if(/[fFeEgG]$/.test(m)) return Number(v).toFixed(prec !== undefined ? +prec : 6); return vm.str(v); })); return 0;
      case 'getline': return false;
      case 'isnan': return isNaN(a[0]);
      case 'nameof': return f.n;
    }
    throw CfErr('Неизвестная функция «' + n + '»', f.line);
  };
  // методы стандартных типов: строки, массивы и списки (с LINQ), словари, статические классы
  VM.method = function(o, n, a, f, sc, e){
    var vm = this, fn = function(x){ return function(){ return vm.callFn(x, Array.prototype.slice.call(arguments)); }; };
    if(o && o.__fn) return this.call({ f:{ k:'id', n:o.__fn }, args:e.args }, sc);
    if(o && o.__static) return this.staticCall(o.__static, n, a, f, sc, e);
    if(o && o.__type){
      var td = this.types[o.__type];
      if(td && td.methods && td.methods[n]){ var m = td.methods[n]; var keep = this.curFunc; this.curFunc = m; try { return this.callFunc(m, a, null, td); } finally { this.curFunc = keep; } }
      if(this.io.staticCall){ var sr = this.io.staticCall(o.__type, n, a, this, f); if(sr !== undefined) return sr; }
      throw CfErr('У типа «' + o.__type + '» нет метода «' + n + '»', f.line);
    }
    if(o && o.__t && this.types[o.__t] && this.types[o.__t].methods && this.types[o.__t].methods[n]){ var td2 = this.types[o.__t], mm = td2.methods[n]; var keep2 = this.curFunc; this.curFunc = mm; try { return this.callFunc(mm, a, o, td2); } finally { this.curFunc = keep2; } }
    if(o && o.__lambda && (n === 'Invoke' || n === 'operator()')) return this.callFn(o, a);
    if(o && o.__t === 'ostream' && n === 'flush') return o;
    if(this.io.method){ var ir = this.io.method(o, n, a, this, f); if(ir !== undefined) return ir === CF_VOID ? undefined : ir; }
    if(typeof o === 'string') return this.strMethod(o, n, a, f);
    if(typeof o === 'number'){ if(n === 'ToString') return this.str(o, a[0]); if(n === 'CompareTo') return o < a[0] ? -1 : (o > a[0] ? 1 : 0); if(n === 'Equals') return o === a[0]; }
    if(o instanceof Date) return this.dateMethod(o, n, a, f);
    if(o instanceof CfIter){ if(n === 'base') return o.i; }
    if(o && o.__t === 'StringBuilder'){ if(n === 'Append'){ o.s += this.str(a[0]); return o; } if(n === 'AppendLine'){ o.s += (a.length ? this.str(a[0]) : '') + '\n'; return o; } if(n === 'ToString') return o.s; if(n === 'Clear'){ o.s = ''; return o; } }
    if(o && o.__t === 'Random'){ if(n === 'Next') return a.length === 2 ? a[0] + Math.floor(Math.random() * (a[1] - a[0])) : Math.floor(Math.random() * (a[0] || 2147483647)); if(n === 'NextDouble') return Math.random(); }
    if(o instanceof CfMap) return this.mapMethod(o, n, a, f, sc, e);
    if(Array.isArray(o) || (o && o.__group)) return this.listMethod(o.__group ? o.items : o, n, a, f, sc, e, fn);
    if(o && typeof o === 'object'){ if(n === 'ToString') return this.str(o); if(n === 'Equals') return JSON.stringify(o) === JSON.stringify(a[0]); if(n === 'GetHashCode') return 0; if(typeof o[n] === 'function') return o[n].apply(o, a); if(o[n] && o[n].__lambda) return this.callFn(o[n], a); }
    if(o == null) throw CfErr('Вызов «' + n + '» у пустого значения (null)', f.line);
    throw CfErr('Неизвестный метод «' + n + '»', f.line);
  };
  var CF_VOID = { __void:true };
  VM.strMethod = function(s, n, a, f){
    switch(n){
      case 'size': case 'length': return s.length;
      case 'empty': return !s.length;
      case 'substr': return a.length > 1 ? s.substr(a[0], a[1]) : s.substr(a[0]);
      case 'Substring': return a.length > 1 ? s.substr(a[0], a[1]) : s.substring(a[0]);
      case 'find': case 'IndexOf': return s.indexOf(a[0], a[1] || 0);
      case 'rfind': case 'LastIndexOf': return s.lastIndexOf(a[0]);
      case 'c_str': case 'str': case 'ToString': case 'Trim': if(n === 'Trim') return s.trim(); return s;
      case 'TrimStart': return s.replace(/^\s+/, ''); case 'TrimEnd': return s.replace(/\s+$/, '');
      case 'ToUpper': case 'ToUpperInvariant': return s.toUpperCase(); case 'ToLower': case 'ToLowerInvariant': return s.toLowerCase();
      case 'Contains': return s.indexOf(a[0]) >= 0; case 'StartsWith': case 'starts_with': return s.indexOf(a[0]) === 0; case 'EndsWith': case 'ends_with': return s.slice(-String(a[0]).length) === String(a[0]);
      case 'Replace': return s.split(a[0]).join(a[1]);
      case 'Split': return s.split(a.length > 1 && typeof a[0] === 'string' && a[0].length === 1 && typeof a[1] === 'string' ? new RegExp('[' + a.map(function(x){ return String(x).replace(/[\]\\^-]/g, '\\$&'); }).join('') + ']') : (a[0] === undefined ? /\s+/ : a[0]));
      case 'PadLeft': return s.padStart(a[0], a[1] || ' '); case 'PadRight': return s.padEnd(a[0], a[1] || ' ');
      case 'append': case 'push_back': return s + a[0];
      case 'at': return s[a[0]];
      case 'Equals': return s === a[0];
      case 'CompareTo': return s < a[0] ? -1 : (s > a[0] ? 1 : 0);
      case 'compare': return s < a[0] ? -1 : (s > a[0] ? 1 : 0);
      case 'ToCharArray': return s.split('');
    }
    throw CfErr('Неизвестный метод строки «' + n + '»', f.line);
  };
  VM.dateMethod = function(d, n, a){
    var c = new Date(+d);
    switch(n){
      case 'AddDays': c.setDate(c.getDate() + a[0]); return c; case 'AddMonths': c.setMonth(c.getMonth() + a[0]); return c; case 'AddYears': c.setFullYear(c.getFullYear() + a[0]); return c; case 'AddHours': c.setHours(c.getHours() + a[0]); return c;
      case 'ToString': return a[0] ? String(a[0]).replace(/dd/g, String(d.getDate()).padStart(2, '0')).replace(/MM/g, String(d.getMonth() + 1).padStart(2, '0')).replace(/yyyy/g, d.getFullYear()) : d.toLocaleDateString('ru-RU');
    }
    throw CfErr('Неизвестный метод даты «' + n + '»');
  };
  VM.mapMethod = function(m, n, a, f, sc, e){
    switch(n){
      case 'ContainsKey': case 'count': case 'Contains': return n === 'count' ? (m.has(a[0]) ? 1 : 0) : m.has(a[0]);
      case 'Add': if(a.length === 1){ m.set(a[0], true); return true; } if(m.has(a[0])) throw CfErr('Ключ «' + a[0] + '» уже есть в словаре', f.line); m.set(a[0], a[1]); return CF_VOID;
      case 'insert': case 'emplace': case 'TryAdd': if(a.length === 1 && a[0] && a[0].first !== undefined){ if(!m.has(a[0].first)) m.set(a[0].first, a[0].second); return CF_VOID; } if(!m.has(a[0])) m.set(a[0], a.length > 1 ? a[1] : true); return true;
      case 'Remove': case 'erase': return m.del(a[0]);
      case 'Clear': case 'clear': m.m.clear(); return CF_VOID;
      case 'size': return m.m.size;
      case 'empty': return !m.m.size;
      case 'at': if(!m.has(a[0])) throw CfErr('Ключ «' + a[0] + '» не найден', f.line); return m.get(a[0]);
      case 'GetValueOrDefault': return m.has(a[0]) ? m.get(a[0]) : (a.length > 1 ? a[1] : 0);
      case 'TryGetValue': var out = e.args[1]; var has = m.has(a[0]); if(out && out.k === 'out'){ var sl = this.lookup(sc, out.n); if(!sl){ sc.vars.set(out.n, { v:undefined }); sl = sc.vars.get(out.n); } sl.v = has ? m.get(a[0]) : 0; } return has;
      case 'find': return m.has(a[0]) ? { first:a[0], second:m.get(a[0]) } : null;
      case 'end': return null;
      case 'ToList': case 'ToArray': return this.iterable(m);
    }
    return this.listMethod(this.iterable(m), n, a, f, sc, e);
  };
  VM.listMethod = function(arr, n, a, f, sc, e){
    var vm = this, call = function(fn, args){ return vm.callFn(fn, args); }, key = function(fn){ return function(x){ return call(fn, [x]); }; };
    var cmp = function(kf, desc){ return function(x, y){ var A = kf(x), B = kf(y), r = A < B ? -1 : (A > B ? 1 : 0); return desc ? -r : r; }; };
    switch(n){
      case 'push_back': case 'emplace_back': case 'Add': case 'Enqueue': case 'Push': case 'push': arr.push(a.length > 1 ? a : a[0]); return CF_VOID;
      case 'AddRange': case 'insert': if(n === 'insert' && a[0] instanceof CfIter){ if(a.length === 3 && a[1] instanceof CfIter){ Array.prototype.splice.apply(arr, [a[0].i, 0].concat(a[1].arr.slice(a[1].i, a[2].i))); } else arr.splice(a[0].i, 0, a[1]); return CF_VOID; } Array.prototype.push.apply(arr, this.iterable(a[0])); return CF_VOID;
      case 'Insert': arr.splice(a[0], 0, a[1]); return CF_VOID;
      case 'pop_back': arr.pop(); return CF_VOID; case 'Pop': return arr.pop(); case 'Dequeue': return arr.shift(); case 'Peek': return n === 'Peek' ? arr[arr.length - 1] : arr[0];
      case 'size': case 'Count': if(n === 'Count' && a.length) return arr.filter(key(a[0])).length; return arr.length;
      case 'LongCount': return arr.length;
      case 'empty': return !arr.length;
      case 'reserve': case 'shrink_to_fit': return CF_VOID;
      case 'resize': while(arr.length < a[0]) arr.push(a.length > 1 ? a[1] : 0); arr.length = a[0]; return CF_VOID;
      case 'clear': case 'Clear': arr.length = 0; return CF_VOID;
      case 'back': return arr[arr.length - 1]; case 'front': return arr[0];
      case 'at': case 'ElementAt': if(a[0] < 0 || a[0] >= arr.length) throw CfErr('Индекс ' + a[0] + ' вне диапазона', f.line); return arr[a[0]];
      case 'begin': case 'cbegin': return new CfIter(arr, 0); case 'end': case 'cend': return new CfIter(arr, arr.length);
      case 'rbegin': return new CfIter(arr.slice().reverse(), 0); case 'rend': return new CfIter(arr, arr.length);
      case 'erase': if(a[0] instanceof CfIter){ arr.splice(a[0].i, a[1] instanceof CfIter ? a[1].i - a[0].i : 1); return new CfIter(arr, a[0].i); } return CF_VOID;
      case 'Remove': var ri = arr.indexOf(a[0]); if(ri >= 0) arr.splice(ri, 1); return ri >= 0;
      case 'RemoveAt': arr.splice(a[0], 1); return CF_VOID;
      case 'RemoveAll': var before = arr.length, keep = arr.filter(function(x){ return !vm.truthy(call(a[0], [x])); }); arr.length = 0; Array.prototype.push.apply(arr, keep); return before - arr.length;
      case 'Contains': return arr.some(function(x){ return vm.eq(x, a[0]); });
      case 'IndexOf': return arr.indexOf(a[0]);
      case 'Sort': arr.sort(a[0] ? function(x, y){ return call(a[0], [x, y]); } : function(x, y){ return x < y ? -1 : (x > y ? 1 : 0); }); return CF_VOID;
      case 'Reverse': if(a.length || e.f.o.k !== 'id'){ return arr.slice().reverse(); } arr.reverse(); return CF_VOID;
      case 'ToList': case 'ToArray': case 'AsEnumerable': case 'ToHashSet': case 'ToImmutableList': return arr.slice();
      case 'Select': return arr.map(function(x, i){ return call(a[0], [x, i]); });
      case 'SelectMany': var sm = []; arr.forEach(function(x){ Array.prototype.push.apply(sm, vm.iterable(call(a[0], [x]))); }); return sm;
      case 'Where': return arr.filter(function(x, i){ return vm.truthy(call(a[0], [x, i])); });
      case 'Sum': return arr.reduce(function(s, x){ return s + vm.num(a[0] ? call(a[0], [x]) : x); }, 0);
      case 'Average': if(!arr.length) throw CfErr('Average: последовательность пуста', f.line); return arr.reduce(function(s, x){ return s + vm.num(a[0] ? call(a[0], [x]) : x); }, 0) / arr.length;
      case 'Max': case 'Min': if(!arr.length) throw CfErr(n + ': последовательность пуста', f.line); var vals = arr.map(function(x){ return a[0] ? call(a[0], [x]) : x; }); return vals.reduce(function(m, x){ return n === 'Max' ? (x > m ? x : m) : (x < m ? x : m); });
      case 'MaxBy': case 'MinBy': var bx = arr[0]; arr.forEach(function(x){ var A = call(a[0], [x]), B = call(a[0], [bx]); if(n === 'MaxBy' ? A > B : A < B) bx = x; }); return bx;
      case 'OrderBy': return arr.slice().sort(cmp(key(a[0]), false)); case 'OrderByDescending': return arr.slice().sort(cmp(key(a[0]), true));
      case 'ThenBy': case 'ThenByDescending': return arr;
      case 'Order': return arr.slice().sort(cmp(function(x){ return x; }, false));
      case 'First': case 'FirstOrDefault': var fx = a[0] ? arr.filter(key(a[0])) : arr; if(!fx.length){ if(n === 'First') throw CfErr('First: подходящих элементов нет', f.line); return null; } return fx[0];
      case 'Last': case 'LastOrDefault': var lx = a[0] ? arr.filter(key(a[0])) : arr; if(!lx.length){ if(n === 'Last') throw CfErr('Last: подходящих элементов нет', f.line); return null; } return lx[lx.length - 1];
      case 'Single': case 'SingleOrDefault': var sx = a[0] ? arr.filter(key(a[0])) : arr; return sx[0] === undefined ? null : sx[0];
      case 'Any': return a[0] ? arr.some(function(x){ return vm.truthy(call(a[0], [x])); }) : arr.length > 0;
      case 'All': return arr.every(function(x){ return vm.truthy(call(a[0], [x])); });
      case 'Skip': return arr.slice(a[0]); case 'Take': return arr.slice(0, a[0]); case 'TakeLast': return arr.slice(Math.max(0, arr.length - a[0])); case 'SkipLast': return arr.slice(0, Math.max(0, arr.length - a[0]));
      case 'TakeWhile': var tw = []; for(var i = 0; i < arr.length && vm.truthy(call(a[0], [arr[i]])); i++) tw.push(arr[i]); return tw;
      case 'SkipWhile': var j = 0; while(j < arr.length && vm.truthy(call(a[0], [arr[j]]))) j++; return arr.slice(j);
      case 'Distinct': var seen = {}; return arr.filter(function(x){ var k = JSON.stringify(x); if(seen[k]) return false; seen[k] = 1; return true; });
      case 'DistinctBy': var seen2 = {}; return arr.filter(function(x){ var k = JSON.stringify(call(a[0], [x])); if(seen2[k]) return false; seen2[k] = 1; return true; });
      case 'Concat': case 'Union': return arr.concat(this.iterable(a[0]));
      case 'Append': return arr.concat([a[0]]);
      case 'Zip': var other = this.iterable(a[0]); return arr.slice(0, Math.min(arr.length, other.length)).map(function(x, i){ return a[1] ? call(a[1], [x, other[i]]) : { Item1:x, Item2:other[i], First:x, Second:other[i] }; });
      case 'Aggregate': var acc = a.length > 1 ? a[0] : arr[0], fnA = a.length > 1 ? a[1] : a[0]; (a.length > 1 ? arr : arr.slice(1)).forEach(function(x){ acc = call(fnA, [acc, x]); }); return acc;
      case 'GroupBy': var groups = [], idx = {}; arr.forEach(function(x){ var k = call(a[0], [x]), ks = JSON.stringify(k); if(!idx[ks]){ idx[ks] = { __group:true, Key:k, items:[] }; groups.push(idx[ks]); } idx[ks].items.push(a[1] ? call(a[1], [x]) : x); }); return groups;
      case 'ToDictionary': var d = new CfMap(); arr.forEach(function(x){ d.set(call(a[0], [x]), a[1] ? call(a[1], [x]) : x); }); return d;
      case 'ToLookup': return this.listMethod(arr, 'GroupBy', a, f, sc, e);
      case 'Join': if(typeof a[0] === 'string') return arr.map(function(x){ return vm.str(x); }).join(a[0]); break;
      case 'ForEach': arr.forEach(function(x){ call(a[0], [x]); }); return CF_VOID;
      case 'Exists': return arr.some(function(x){ return vm.truthy(call(a[0], [x])); });
      case 'Find': var ff = arr.filter(key(a[0])); return ff.length ? ff[0] : null;
      case 'FindAll': return arr.filter(key(a[0]));
      case 'FindIndex': for(var q = 0; q < arr.length; q++) if(vm.truthy(call(a[0], [arr[q]]))) return q; return -1;
      case 'ToString': return this.str(arr);
      case 'Cast': case 'OfType': return arr;
      case 'Chunk': var ch = []; for(var c = 0; c < arr.length; c += a[0]) ch.push(arr.slice(c, c + a[0])); return ch;
    }
    if(arr && arr.Key !== undefined && n === 'Key') return arr.Key;
    throw CfErr('Неизвестный метод списка «' + n + '»', f.line);
  };
  VM.staticCall = function(cls, n, a, f, sc, e){
    var vm = this;
    if(cls === 'Math'){
      var M = { Sqrt:Math.sqrt, Pow:Math.pow, Abs:Math.abs, Floor:Math.floor, Ceiling:Math.ceil, Truncate:Math.trunc, Log:Math.log, Log10:Math.log10, Exp:Math.exp, Sin:Math.sin, Cos:Math.cos, Tan:Math.tan, Atan2:Math.atan2, Sign:Math.sign };
      if(M[n]) return M[n].apply(null, a);
      if(n === 'Max') return Math.max(a[0], a[1]); if(n === 'Min') return Math.min(a[0], a[1]);
      if(n === 'Round'){ var d = typeof a[1] === 'number' ? a[1] : 0, k = Math.pow(10, d), x = a[0] * k, r = Math.round(x); if(Math.abs(x % 1) === 0.5) r = 2 * Math.round(x / 2); return r / k; }
      if(n === 'Clamp') return Math.min(Math.max(a[0], a[1]), a[2]);
    }
    if(cls === 'Console'){ if(n === 'WriteLine'){ this.ostream().write((a.length ? this.fmtArgs(a) : '') + '\n'); return CF_VOID; } if(n === 'Write'){ this.ostream().write(this.fmtArgs(a)); return CF_VOID; } if(n === 'ReadLine') return null; }
    if(cls === 'Convert'){ if(/^To(Double|Decimal|Single)$/.test(n)) return parseFloat(String(a[0]).replace(',', '.')) || 0; if(/^ToInt(32|64|16)$/.test(n)) return Math.round(parseFloat(String(a[0]).replace(',', '.')) || 0); if(n === 'ToString') return this.str(a[0]); if(n === 'ToBoolean') return !!a[0] && a[0] !== 'false'; if(n === 'ToDateTime') return new Date(a[0]); }
    if(cls === 'Double' || cls === 'Int'){ if(n === 'Parse'){ var p = parseFloat(String(a[0]).replace(/\s/g, '').replace(',', '.')); if(isNaN(p)) throw CfErr('Не число: «' + a[0] + '»', f.line); return cls === 'Int' ? Math.trunc(p) : p; } if(n === 'TryParse'){ var p2 = parseFloat(String(a[0]).replace(/\s/g, '').replace(',', '.')), out = e.args[1]; if(out && out.k === 'out'){ var sl = this.lookup(sc, out.n); if(!sl){ sc.vars.set(out.n, { v:0 }); sl = sc.vars.get(out.n); } sl.v = isNaN(p2) ? 0 : p2; } return !isNaN(p2); } if(n === 'IsNaN') return isNaN(a[0]); }
    if(cls === 'String'){ if(n === 'Join') return this.iterable(a[1]).concat(a.slice(2)).map(function(x){ return vm.str(x); }).join(a[0]); if(n === 'IsNullOrEmpty') return a[0] == null || a[0] === ''; if(n === 'IsNullOrWhiteSpace') return a[0] == null || !String(a[0]).trim(); if(n === 'Format') return this.fmtArgs(a); if(n === 'Concat') return a.map(function(x){ return vm.str(x); }).join(''); }
    if(cls === 'DateTime'){ if(n === 'Parse') return new Date(String(a[0]).replace(/^(\d\d)\.(\d\d)\.(\d{4})/, '$3-$2-$1')); if(n === 'DaysInMonth') return new Date(a[0], a[1], 0).getDate(); }
    if(cls === 'Enumerable'){ if(n === 'Range'){ var rr = []; for(var i = 0; i < a[1]; i++) rr.push(a[0] + i); return rr; } if(n === 'Repeat'){ var rp = []; for(var j = 0; j < a[1]; j++) rp.push(a[0]); return rp; } if(n === 'Empty') return []; }
    if(cls === 'TimeSpan' && n === 'FromDays') return { __t:'TimeSpan', ms:a[0] * 864e5, TotalDays:a[0] };
    if(this.io.staticCall){ var r2 = this.io.staticCall(cls, n, a, this, f); if(r2 !== undefined) return r2; }
    throw CfErr('Неизвестный метод «' + cls + '.' + n + '»', f.line);
  };
  VM.fmtArgs = function(a){ if(a.length > 1 && typeof a[0] === 'string' && /\{\d/.test(a[0])){ var vm = this; return a[0].replace(/\{(\d+)(?::([^}]+))?\}/g, function(m, i, fmt){ return vm.str(a[+i + 1], fmt); }); } return this.str(a[0]); };
  VM.getMember = function(o, n, e, sc){
    if(o == null){ if(e && e.opt) return null; throw CfErr('Обращение к «' + n + '» у пустого значения (null)', e && e.line); }
    if(o.__static){
      if(o.__static === 'Math'){ if(n === 'PI') return Math.PI; if(n === 'E') return Math.E; }
      if(o.__static === 'DateTime'){ if(n === 'Now') return new Date(); if(n === 'Today'){ var t = new Date(); t.setHours(0, 0, 0, 0); return t; } }
      if(o.__static === 'String' && n === 'Empty') return '';
      if(o.__static === 'Double'){ if(n === 'MaxValue') return Number.MAX_VALUE; if(n === 'MinValue') return -Number.MAX_VALUE; if(n === 'NaN') return NaN; }
      if(o.__static === 'Int'){ if(n === 'MaxValue') return 2147483647; if(n === 'MinValue') return -2147483648; }
      if(o.__static === 'Environment' && n === 'NewLine') return '\n';
      return { __static:o.__static + '.' + n };
    }
    if(o.__type){
      var td = this.types[o.__type];
      if(td && td.k === 'enum' && n in td.vals) return td.vals[n];
      if(this.statics[o.__type] && n in this.statics[o.__type]) return this.statics[o.__type][n];
      if(td && td.methods && td.methods[n]) return { __fn2:true, td:td, n:n };
      if(this.io.staticMember){ var sm = this.io.staticMember(o.__type, n, this); if(sm !== undefined) return sm; }
      return { __type:o.__type + '.' + n };
    }
    if(o.__t === 'limits'){ return { __static:'limits' }; }
    if(Array.isArray(o)){ if(n === 'Count' || n === 'Length' || n === 'size') return o.length; }
    if(typeof o === 'string'){ if(n === 'Length' || n === 'length') return o.length; }
    if(o instanceof CfMap){ if(n === 'Count') return o.m.size; if(n === 'Keys') return o.pairs().map(function(p){ return p.k; }); if(n === 'Values') return o.pairs().map(function(p){ return p.v; }); }
    if(o instanceof Date){ var D = { Year:o.getFullYear(), Month:o.getMonth() + 1, Day:o.getDate(), Hour:o.getHours(), Minute:o.getMinutes(), DayOfWeek:o.getDay(), DayOfYear:Math.floor((o - new Date(o.getFullYear(), 0, 0)) / 864e5) }; if(n in D) return D[n]; if(n === 'Date'){ var c = new Date(+o); c.setHours(0, 0, 0, 0); return c; } }
    if(o.__group){ if(n === 'Key') return o.Key; if(n === 'Count') return o.items.length; }
    if(o.__t && this.types[o.__t]){ var g = this.findGetter(this.types[o.__t], n); if(g) return this.runGetter(g, o, this.types[o.__t]); }
    if(this.io.member){ var r = this.io.member(o, n, this); if(r !== undefined) return r; }
    if(n in o) return o[n];
    // поля строк данных: регистр и синонимы
    var k = cfFindKey(o, n); if(k !== null) return o[k];
    if(o.__t) throw CfErr('У «' + o.__t + '» нет поля «' + n + '»', e && e.line);
    return undefined;
  };
  function cfFindKey(o, n){ if(!o || typeof o !== 'object') return null; var lo = String(n).toLowerCase().replace(/_/g, ''); for(var k in o){ if(String(k).toLowerCase().replace(/[_\s]/g, '') === lo) return k; } var syn = typeof fieldSyn === 'function' ? fieldSyn(n) : []; for(var i = 0; i < syn.length; i++){ for(var k2 in o){ if(String(k2).toLowerCase() === syn[i]) return k2; } } return null; }
  function cfToJson(v, depth){
    depth = depth || 0; if(depth > 30) return null;
    if(v === undefined || v === null) return null;
    if(typeof v === 'number') return isFinite(v) ? Math.round(v * 1e10) / 1e10 : null;
    if(typeof v !== 'object') return v;
    if(v instanceof Date) return v.toLocaleDateString('ru-RU');
    if(Array.isArray(v)) return v.map(function(x){ return cfToJson(x, depth + 1); });
    if(v instanceof CfMap){ var o = {}; v.pairs().forEach(function(p){ o[String(p.k)] = cfToJson(p.v, depth + 1); }); return o; }
    if(v.__group) return { Key:cfToJson(v.Key, depth + 1), Items:cfToJson(v.items, depth + 1) };
    if(v.__lambda || v.__static || v.__type) return null;
    if(v.__t === 'StringBuilder') return v.s;
    var r = {}; for(var k in v){ if(k === '__t') continue; r[k] = cfToJson(v[k], depth + 1); } return r;
  }
