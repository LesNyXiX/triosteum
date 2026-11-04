  /* =====================================================================
     ВСТРОЕННЫЙ ИСПОЛНИТЕЛЬ C++ И C#: разбор кода блока и выполнение
     прямо в браузере, без сервера. Поддерживается то, что нужно блокам:
     структуры и записи, классы, функции, лямбды, std::vector / std::map,
     List / Dictionary, LINQ, строки, математика, вывод в консоль.
     ===================================================================== */
  var CF_KW = { 'if':1, 'else':1, 'for':1, 'foreach':1, 'while':1, 'do':1, 'return':1, 'break':1, 'continue':1, 'new':1, 'switch':1, 'case':1, 'default':1, 'try':1, 'catch':1, 'finally':1, 'throw':1, 'using':1, 'in':1, 'is':1, 'as':1, 'await':1, 'true':1, 'false':1, 'null':1, 'nullptr':1, 'this':1, 'class':1, 'struct':1, 'record':1, 'namespace':1, 'typeof':1, 'sizeof':1, 'operator':1, 'template':1, 'typename':1 };
  var CF_MODS = { 'public':1, 'private':1, 'protected':1, 'internal':1, 'static':1, 'readonly':1, 'virtual':1, 'override':1, 'async':1, 'sealed':1, 'abstract':1, 'partial':1, 'extern':1, 'inline':1, 'constexpr':1, 'volatile':1, 'mutable':1, 'explicit':1, 'friend':1, 'unsafe':1, 'required':1, 'noexcept':1, 'implicit':1, 'new':0 };
  var CF_INT = { 'int':1, 'long':1, 'short':1, 'unsigned':1, 'signed':1, 'size_t':1, 'uint':1, 'ulong':1, 'byte':1, 'sbyte':1, 'ushort':1, 'char':1, 'int32_t':1, 'int64_t':1, 'uint32_t':1, 'uint64_t':1, 'ptrdiff_t':1, 'size_type':1, 'Int32':1, 'Int64':1, 'uint8_t':1, 'int8_t':1, 'int16_t':1, 'uint16_t':1, 'nint':1 };
  var CF_BASE = { 'int':1, 'double':1, 'float':1, 'bool':1, 'char':1, 'void':1, 'long':1, 'short':1, 'unsigned':1, 'signed':1, 'auto':1, 'var':1, 'string':1, 'decimal':1, 'object':1, 'byte':1, 'uint':1, 'ulong':1, 'size_t':1, 'dynamic':1, 'sbyte':1, 'ushort':1, 'int32_t':1, 'int64_t':1, 'uint32_t':1, 'uint64_t':1, 'ptrdiff_t':1 };
  var CF_OPS = ['>>=', '<<=', '...', '::', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '=>', '??=', '??', '?.'];
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
        var m = /^(0[xX][0-9a-fA-F']+|[0-9][0-9']*(\.(?![A-Za-z_])[0-9']*)?([eE][+-]?[0-9]+)?|\.[0-9]+([eE][+-]?[0-9]+)?)([fFdDmMuUlL]*)/.exec(src.slice(i));
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
  CP.closeAngle = function(){ var x = this.peek(); if(x.t !== 'op') return false; if(x.v === '>'){ this.p++; return true; } var rest = { '>>':'>', '>=':'=', '>>=':'>=' }[x.v]; if(rest === undefined) return false; this.tk.splice(this.p, 1, { t:'op', v:'>', line:x.line, sp:1 }, { t:'op', v:rest, line:x.line, sp:1 }); this.p++; return true; };
  // склеивает обратно «>>», разрезанный при пробном разборе шаблона
  CP.merge = function(){ var x = this.tk[this.p], y = this.tk[this.p + 1]; if(x && y && x.sp && y.sp){ this.tk.splice(this.p, 2, { t:'op', v:x.v + y.v, line:x.line }); } };
  CP.skipAngles = function(){ var d = 0; do { var x = this.peek(); if(x.t === 'eof' || x.v === ';' || x.v === '{') return false; this.p++; if(x.v === '<') d++; else if(x.v === '>') d--; else if(x.v === '>>') d -= 2; else if(x.v === '>=') d--; } while(d > 0); return true; };
  CP.tryType = function(){
    var save = this.p, t = this.typeInner();
    if(!t) this.p = save;
    return t;
  };
  CP.typeInner = function(){
    while(this.is('const') || this.is('volatile') || this.is('typename') || this.is('struct') && this.peek(1).t === 'id' && this.peek(2).v !== '{') this.p++;
    if(this.cs && this.is('(')){
      // кортеж: (int a, string b)
      var ts = this.p; this.p++; var its = [], nms = [], okT = true;
      while(true){ var it = this.typeInner(); if(!it){ okT = false; break; } its.push(it); nms.push(this.peek().t === 'id' && !CF_KW[this.peek().v] ? this.next().v : null); if(this.eat(',')) continue; if(this.eat(')')) break; okT = false; break; }
      if(!okT || its.length < 2){ this.p = ts; return null; }
      var tt0 = { name:'ValueTuple', args:its, names:nms }; if(this.is('?')) this.p++; return tt0;
    }
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
      if(!ok){ this.p = save; if(/(^|::)function$/.test(name) || /^(Func|Action|Predicate)$/.test(name)){ if(this.skipAngles()) return { name:'function', args:[] }; this.p = save; } return CF_BASE[name] || this.types[name] || /^std::/.test(name) ? { name:name, args:[] } : null; }
    }
    var tn = name.replace(/^std::/, '').replace(/^System\.(Collections\.Generic\.)?/, '');
    if(tn.indexOf('::') >= 0) tn = tn.split('::').pop(); else if(this.cs && tn.indexOf('.') >= 0 && !this.types[tn]) tn = tn.split('.').pop();
    var t = { name:tn, args:args };
    while(true){
      if(this.is('const')){ this.p++; continue; }
      if(this.is('&') || this.is('&&') || this.is('*')){ if(this.is('&') && !this.cs) t.byRef = true; this.p++; continue; }
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
    for(var i = 0; i < this.tk.length - 1; i++){ var a = this.tk[i]; if(a.t === 'id' && (a.v === 'struct' || a.v === 'class' || a.v === 'record' || a.v === 'interface' || a.v === 'enum') && this.tk[i + 1].t === 'id' && this.tk[i + 1].v !== 'class') this.types[this.tk[i + 1].v] = 1; }
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
    var td = { k:'type', kind:kind, name:name, fields:[], methods:{}, statics:[], params:null, bases:[], ctors:[] };
    if(kind === 'record' && this.is('(')){ td.params = this.params(); td.params.forEach(function(p){ td.fields.push({ name:p.name, type:p.type }); }); }
    if(this.eat(':')){ do { this.skipMods(); var bt = this.tryType(); if(bt){ td.bases.push(bt.name); if(this.is('(')) this.args(); } } while(this.eat(',')); }
    while(this.is('where')){ while(!this.is('{') && !this.is(';')) this.p++; }
    if(this.eat(';')) return td;
    this.want('{');
    while(!this.eat('}')){
      if(this.eat(';')) continue;
      if(this.is('public') && this.is(':', 1) || this.is('private') && this.is(':', 1) || this.is('protected') && this.is(':', 1)){ this.p += 2; continue; }
      this.skipAttrs();
      var st = false; while(this.peek().t === 'id' && (CF_MODS[this.peek().v] || this.peek().v === 'const')){ if(this.peek().v === 'static' || this.peek().v === 'const') st = st || this.peek().v === 'static' || (this.cs && this.peek().v === 'const'); this.p++; }
      if(this.is('~') && this.peek(1).v === name){ this.p += 2; this.params(); if(this.is('{')) this.block(); else this.eat(';'); continue; }
      if(this.is('struct') || this.is('class') || this.is('record') || this.is('enum') || this.is('interface')){ var nested = this.typeDecl(); (td.nested = td.nested || []).push(nested); continue; }
      // конструктор
      if(this.peek().t === 'id' && this.peek().v === name && this.is('(', 1)){
        this.p++; var ps = this.params(), inits = [], chain = null;
        if(this.eat(':')){
          do { var iname = this.ident(); while(this.is('::')){ this.p++; iname = this.ident(); } if(this.is('<')) this.skipAngles(); if(iname === 'base' || iname === 'this' || td.bases.indexOf(iname) >= 0){ chain = { target:iname === 'this' ? 'this' : 'base', args:this.is('{') ? this.braceList().items : this.args() }; continue; } var iargs = this.is('{') ? this.braceList().items : this.args(); inits.push({ k:'expr', e:{ k:'assign', op:'=', l:{ k:'member', o:{ k:'this' }, n:iname }, r:iargs.length === 1 ? iargs[0] : { k:'list', items:iargs } } }); } while(this.eat(','));
        }
        while(this.is('noexcept')) this.p++;
        var body = this.is('{') ? this.block() : (this.eat('=>') ? (function(e){ return { k:'block', body:[{ k:'expr', e:e }] }; })(this.expr()) : { k:'block', body:[] }); this.eat(';');
        if(inits.length) body = { k:'block', body:inits.concat(body.body) };
        var ctor = { params:ps, body:body, chain:chain }; td.ctors.push(ctor); if(!td.ctor) td.ctor = ctor; continue;
      }
      var m = this.memberDecl(td, st); if(!m) continue;
      if(m.k === 'func'){ if(td.methods[m.name] && td.methods[m.name].body && m.body){ (td.overloads = td.overloads || {})[m.name] = (td.overloads[m.name] || [td.methods[m.name]]).concat([m]); } if(!td.methods[m.name] || m.body) td.methods[m.name] = m; m.static = st; }
      else if(m.k === 'vars'){ m.list.forEach(function(v){ (st ? td.statics : td.fields).push(v); }); }
    }
    this.eat(';');
    return td;
  };
  CP.params = function(){
    this.want('('); var ps = [];
    while(!this.eat(')')){
      this.skipAttrs(); var isThis = false, byRef = false; while(this.is('this') || this.is('params') || this.is('ref') || this.is('out') || this.is('in')){ if(this.is('this')) isThis = true; if(this.is('ref') || this.is('out')) byRef = true; this.p++; }
      var t = this.tryType() || { name:'auto', args:[] }, nm = this.peek().t === 'id' ? this.ident() : ('_' + ps.length), def = null;
      if(t.byRef) byRef = true;
      if(this.is('[')){ this.p++; while(!this.eat(']')) this.p++; t = { name:'array', args:[t] }; }
      if(this.eat('=')) def = this.assign();
      ps.push({ name:nm, type:t, def:def, isThis:isThis, byRef:byRef }); this.eat(',');
    }
    return ps;
  };
  CP.memberDecl = function(td, st){
    var save = this.p, t = this.tryType();
    if(!t){ var x = this.peek(); throw CfErr('Непонятная конструкция «' + x.v + '»', x.line); }
    if(this.is('operator')){
      this.p++; var opn = '';
      if(this.is('(') && this.is(')', 1)){ opn = '()'; this.p += 2; } else if(this.is('[') && this.is(']', 1)){ opn = '[]'; this.p += 2; } else { while(!this.is('(')){ opn += this.next().v; } }
      var opPs = this.params(); this.skipMods(); while(this.is('const') || this.is('noexcept') || this.is('override')) this.p++;
      var ob = null; if(this.is('{')) ob = this.block(); else if(this.eat('=>')){ ob = { k:'block', body:[{ k:'return', e:this.expr() }] }; this.eat(';'); } else this.eat(';');
      return { k:'func', name:'operator' + opn, params:opPs, ret:t, body:ob };
    }
    if(this.peek().t !== 'id'){ var y = this.peek(); throw CfErr('Ожидалось имя после типа «' + t.name + '», а встретилось «' + y.v + '»', y.line); }
    var name = this.ident();
    while(this.is('::')){ this.p++; name = this.ident(); }
    if(this.is('<') && this.cs){ var d = 0; do { var z = this.next(); if(z.v === '<') d++; else if(z.v === '>') d--; } while(d > 0); }
    if(this.is('(')){
      var ps = this.params(); while(this.is('const') || this.is('override') || this.is('noexcept') || this.is('final')) this.p++;
      while(this.is('where')){ this.p++; while(!this.is('{') && !this.is('=>') && !this.is(';') && !this.is('where') && this.peek().t !== 'eof') this.p++; }
      if(this.is('=') && (this.is('0', 1) || this.peek(1).v === 0 || this.is('default', 1) || this.is('delete', 1))){ this.p += 2; }
      if(this.is('->')){ this.p++; this.tryType(); }
      var body = null;
      if(this.is('{')) body = this.block();
      else if(this.eat('=>')){ var ex = this.expr(); this.eat(';'); body = { k:'block', body:[{ k:'return', e:ex }] }; }
      else this.eat(';');
      return { k:'func', name:name, params:ps, ret:t, body:body };
    }
    // свойство C#: { get; set; } или => выражение
    if(this.cs && this.is('{')){
      var getter = null, setter = null; this.p++;
      while(!this.eat('}')){
        this.skipAttrs(); this.skipMods();
        if(this.is('get') || this.is('set') || this.is('init')){
          var acc = this.next().v, body = null;
          if(this.eat('=>')){ var ae = this.expr(); this.eat(';'); body = acc === 'get' ? ae : { k:'block', body:[{ k:'expr', e:ae }] }; }
          else if(this.is('{')) body = this.block();
          else this.eat(';');
          if(acc === 'get') getter = body; else setter = body;
          continue;
        }
        if(this.peek().t === 'eof') break;
        this.p++;
      }
      var init = null; if(this.eat('=')){ init = this.is('{') ? this.braceList() : this.expr(); } this.eat(';');
      return { k:'vars', list:[{ name:name, type:t, init:init, getter:getter, setter:setter }] };
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
        case 'try': this.p++; var tb = this.block(), cl = [], fb = null; while(this.is('catch')){ this.p++; var cty = null, cnm = null, cw = null; if(this.eat('(')){ cty = this.tryType(); if(this.peek().t === 'id') cnm = this.ident(); while(!this.eat(')')) this.p++; } if(this.is('when')){ this.p++; this.want('('); cw = this.expr(); this.want(')'); } cl.push({ type:cty, name:cnm, when:cw, b:this.block() }); } if(this.eat('finally')) fb = this.block(); return { k:'try', b:tb, cl:cl, f:fb };
        case 'switch': return this.switchStmt();
        case 'using':
          this.p++;
          if(this.eat('(')){ var us = this.declAhead() ? this.declStmt(true) : { k:'expr', e:this.expr() }; this.want(')'); return { k:'block', body:[us, this.stmt()] }; }
          return this.declStmt();
      }
      if(CF_MODS[x.v] && x.v !== 'static'){ this.skipMods(); return this.stmt(); }
      if(x.v === 'static' && !this.cs){ this.p++; var sst = this.stmt(); if(sst && sst.k === 'decl') sst.isStatic = true; return sst; }
      if(x.v === 'static' || x.v === 'const' || x.v === 'constexpr'){ this.p++; return this.stmt(); }
      if(this.cs && (x.v === 'var') && this.is('(', 1)){ this.p += 2; var dn = []; while(!this.eat(')')){ dn.push(this.ident()); this.eat(','); } this.want('='); var de = this.expr(); this.eat(';'); return { k:'bind', names:dn, e:de }; }
      if(this.declAhead()){ var lf = this.localFn(); return lf || this.declStmt(); }
    }
    if(this.cs && this.is('(') && this.declAhead()){ var lf2 = this.localFn(); return lf2 || this.declStmt(); }
    var e = this.expr(); this.eat(';'); return { k:'expr', e:e, line:line };
  };
  CP.localFn = function(){ if(!this.cs) return null; var sv0 = this.p, lt = this.tryType(); if(lt && this.peek().t === 'id' && (this.is('(', 1) || this.is('<', 1))){ this.p = sv0; var lf = this.memberDecl(null); if(lf && lf.k === 'func') return { k:'localfn', f:lf }; } this.p = sv0; return null; };
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
      if(this.eat('case')){ if(this.cs){ var pt = this.pattern(), wh = this.eat('when') ? this.expr() : null; this.want(':'); cur = { pat:pt, when:wh, body:[] }; cases.push(cur); continue; } var v = this.expr(); this.want(':'); cur = { v:v, body:[] }; cases.push(cur); continue; }
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
    this.merge(); var x = this.peek();
    if(x.t === 'op' && /^([+\-*\/%&|^]|<<|>>|\?\?)?=$/.test(x.v) && x.v !== '==' && x.v !== '<=' && x.v !== '>=' && x.v !== '!='){ this.p++; var r = this.is('{') ? this.braceList() : this.assign(); return { k:'assign', op:x.v, l:l, r:r, line:x.line }; }
    return l;
  };
  // выражение switch C#: x switch { > 5 => "a", _ => "b" }
  CP.switchExpr = function(subj){
    var line = this.peek().line; this.p++; this.want('{'); var arms = [];
    while(!this.eat('}')){ var pt = this.pattern(), wh = this.eat('when') ? this.expr() : null; this.want('=>'); var ex = this.is('throw') ? (this.p++, { k:'throwx', e:this.expr() }) : this.expr(); arms.push({ pat:pt, when:wh, e:ex }); this.eat(','); }
    return { k:'switchx', e:subj, arms:arms, line:line };
  };
  // образцы C#: константа, > 5, int n, var x, _, null, not, and, or, { Поле: образец }, (a, b)
  CP.pattern = function(){ var l = this.patAnd(); while(this.eat('or')) l = { pk:'or', l:l, r:this.patAnd() }; return l; };
  CP.patAnd = function(){ var l = this.patUn(); while(this.eat('and')) l = { pk:'and', l:l, r:this.patUn() }; return l; };
  CP.patUn = function(){
    var x = this.peek();
    if(this.eat('not')) return { pk:'not', p:this.patUn() };
    if(x.t === 'op' && /^(<|>|<=|>=)$/.test(x.v)){ this.p++; return { pk:'rel', op:x.v, e:this.binary(9) }; }
    if(x.t === 'id' && x.v === '_' ) { this.p++; return { pk:'any' }; }
    if(x.t === 'id' && x.v === 'null'){ this.p++; return { pk:'const', e:{ k:'lit', v:null } }; }
    if(x.t === 'id' && x.v === 'var'){ this.p++; if(this.is('(')){ this.p++; var vn = []; while(!this.eat(')')){ vn.push(this.ident()); this.eat(','); } return { pk:'tuple', items:vn.map(function(n){ return { pk:'bind', name:n }; }) }; } return { pk:'bind', name:this.ident() }; }
    if(this.is('{')){ this.p++; var props = []; while(!this.eat('}')){ var pn = this.ident(); while(this.eat('.')) pn += '.' + this.ident(); this.want(':'); props.push({ n:pn, p:this.pattern() }); this.eat(','); } var bn = this.peek().t === 'id' && !/^(when|and|or)$/.test(this.peek().v) && !CF_KW[this.peek().v] ? this.ident() : null; return { pk:'prop', props:props, name:bn }; }
    if(this.is('(')){
      var sv = this.p; this.p++; var first = this.pattern();
      if(this.eat(',')){ var items = [first]; do { items.push(this.pattern()); } while(this.eat(',')); this.want(')'); return { pk:'tuple', items:items }; }
      if(this.eat(')')) return first; this.p = sv;
    }
    if(x.t === 'id' && !CF_KW[x.v]){
      var sv2 = this.p, t = this.tryType();
      if(t && (CF_BASE[t.name] || this.types[t.name] || /^(string|String|object|List|Dictionary|Exception|DateTime|IEnumerable|Array|Int32|Double|Decimal|Boolean)$/.test(t.name) || /Exception$/.test(t.name))){
        var tn = this.peek().t === 'id' && !/^(when|and|or)$/.test(this.peek().v) && !CF_KW[this.peek().v] ? this.ident() : null;
        if(this.is('{')){ var pp = this.patUn(); pp.type = t; if(tn) pp.name = tn; return pp; }
        return { pk:'type', type:t, name:tn };
      }
      this.p = sv2;
    }
    return { pk:'const', e:this.binary(9) };
  };
  // запрос LINQ: from x in src where … orderby … select …
  CP.linq = function(){
    var cl = [];
    while(true){
      if(this.eat('from')){ if(this.peek(1).t === 'id' && this.peek(1).v !== 'in') this.tryType(); var v = this.ident(); this.want('in'); cl.push({ c:'from', v:v, e:this.expr() }); continue; }
      if(this.eat('where')){ cl.push({ c:'where', e:this.expr() }); continue; }
      if(this.eat('let')){ var lv = this.ident(); this.want('='); cl.push({ c:'let', v:lv, e:this.expr() }); continue; }
      if(this.eat('join')){ if(this.peek(1).t === 'id' && this.peek(1).v !== 'in') this.tryType(); var jv = this.ident(); this.want('in'); var js = this.expr(); this.want('on'); var ja = this.expr(); this.want('equals'); var jb = this.expr(); var into = this.eat('into') ? this.ident() : null; cl.push({ c:'join', v:jv, e:js, a:ja, b:jb, into:into }); continue; }
      if(this.eat('orderby')){ var keys = []; do { var ke = this.expr(), desc = false; if(this.eat('descending')) desc = true; else this.eat('ascending'); keys.push({ e:ke, desc:desc }); } while(this.eat(',')); cl.push({ c:'orderby', keys:keys }); continue; }
      if(this.eat('select')){ cl.push({ c:'select', e:this.expr() }); if(this.eat('into')){ cl.push({ c:'into', v:this.ident() }); continue; } break; }
      if(this.eat('group')){ var ge = this.expr(); this.want('by'); var gk = this.expr(); cl.push({ c:'group', e:ge, key:gk }); if(this.eat('into')){ cl.push({ c:'into', v:this.ident() }); continue; } break; }
      break;
    }
    return { k:'linq', cl:cl };
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
      this.merge();
      var x = this.peek();
      if(this.cs && x.t === 'id' && x.v === 'switch' && this.is('{', 1)){ l = this.switchExpr(l); continue; }
      if(this.cs && x.t === 'id' && x.v === 'with' && this.is('{', 1)){ this.p++; l = { k:'with', e:l, init:this.braceList() }; continue; }
      if(x.t !== 'op' && !(x.t === 'id' && (x.v === 'is' || x.v === 'as'))) break;
      var pr = CF_BIN[x.v]; if(!pr || pr <= min) break;
      this.p++;
      if(x.v === 'is' && this.cs){ l = { k:'isp', e:l, pat:this.pattern() }; continue; }
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
    if(x.t === 'op' && x.v === '*' && !this.cs){ this.p++; return { k:'deref', e:this.unary() }; }
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
      if(this.is('[')){ this.p++; var idx = this.expr(); while(this.cs && this.eat(',')){ e = { k:'index', o:e, i:idx, line:x.line }; idx = this.expr(); } this.want(']'); e = { k:'index', o:e, i:idx, line:x.line }; continue; }
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
    if(x.t === 'interp') return { k:'interp', parts:x.v.map(function(p){ if(typeof p === 'string') return p; var m = /^(.*?)(?::([^:}]+))?$/.exec(p.expr), fmt = null, ex = p.expr; var colon = cfTopColon(p.expr); if(colon >= 0){ ex = p.expr.slice(0, colon); fmt = p.expr.slice(colon + 1); } var al = null, cm = cfTopComma(ex); if(cm >= 0){ al = parseInt(ex.slice(cm + 1), 10); ex = ex.slice(0, cm); } var sub = new CfParser(ex, 'csharp'); return { e:sub.expr(), fmt:fmt, align:al }; }) };
    if(x.t === 'op' && x.v === '('){
      var tnames = [], tn0 = null; if(this.cs && this.peek().t === 'id' && this.is(':', 1)){ tn0 = this.ident(); this.p++; }
      var e = this.expr();
      if(this.is(',') && this.cs){ var items = [e]; tnames.push(tn0); while(this.eat(',')){ var tnn = null; if(this.peek().t === 'id' && this.is(':', 1)){ tnn = this.ident(); this.p++; } tnames.push(tnn); items.push(this.expr()); } this.want(')'); return { k:'tuple', items:items, names:tnames }; }
      this.want(')'); return e;
    }
    if(x.t === 'op' && x.v === '{'){ this.p--; return this.braceList(); }
    if(x.t === 'op' && x.v === '['){
      // лямбда C++: [&](...) { ... }
      if(!this.cs){ while(!this.eat(']')) this.p++; var ps = this.is('(') ? this.params() : []; while(this.is('mutable') || this.is('->')){ if(this.eat('->')) this.tryType(); else this.p++; } return { k:'lambda', params:ps.map(function(p){ return p.name; }), body:this.block() }; }
      var arr = []; while(!this.eat(']')){ arr.push(this.assign()); this.eat(','); } return { k:'list', items:arr };
    }
    if(x.t === 'id'){
      if(this.cs && x.v === 'from' && this.peek().t === 'id' && (this.is('in', 1) || (this.peek(1).t === 'id' && this.is('in', 2)) || this.is('<', 1))){ this.p--; return this.linq(); }
      if(this.cs && x.v === 'throw'){ return { k:'throwx', e:this.expr() }; }
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
  function cfTopComma(s){ var d = 0, q = false; for(var i = 0; i < s.length; i++){ var c = s[i]; if(c === '"') q = !q; if(q) continue; if(c === '(' || c === '[' || c === '{' || c === '<') d++; else if(c === ')' || c === ']' || c === '}' || c === '>') d--; else if(c === ',' && d === 0 && /^\s*-?\d+\s*$/.test(s.slice(i + 1))) return i; } return -1; }
  function cfAlign(s, n){ if(n === null || n === undefined || isNaN(n)) return s; return n < 0 ? s.padEnd(-n) : s.padStart(n); }
  function cfTopColon(s){ var d = 0, q = false; for(var i = 0; i < s.length; i++){ var c = s[i]; if(c === '"') q = !q; if(q) continue; if(c === '(' || c === '[' || c === '{') d++; else if(c === ')' || c === ']' || c === '}') d--; else if(c === '?' ) d += 100; else if(c === ':' && d === 0) return i; else if(c === ':' && d >= 100) d -= 100; } return -1; }
  CP.newExpr = function(){
    var line = this.peek().line;
    if(this.is('{')){ var bl = this.braceList(); return { k:'anon', items:bl.items }; }
    if(this.is('[')){ this.p++; this.want(']'); return { k:'list', items:this.braceList().items }; }
    if(this.is('(')){ return { k:'new', type:null, args:this.args(), init:this.is('{') ? this.braceList() : null, line:line }; }
    var t = this.typeInner();
    if(this.is('[')){ this.p++; var dims = []; if(!this.is(']')){ dims.push(this.expr()); while(this.eat(',')) dims.push(this.expr()); } this.want(']'); var et = t; while(this.is('[') && (this.is(']', 1) || this.is(',', 1))){ this.p++; while(this.eat(',')){} this.want(']'); et = { name:'array', args:[et] }; } var init = this.is('{') ? this.braceList() : null; return { k:'newarr', type:et, n:dims[0] || null, dims:dims, init:init }; }
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
  function CfPair(a, b, cs){ this.first = a; this.second = b; if(cs) Object.defineProperty(this, '__cs', { value:true }); }
  ['Key', 'Item1'].forEach(function(k){ Object.defineProperty(CfPair.prototype, k, { get:function(){ return this.first; }, set:function(v){ this.first = v; }, enumerable:false }); });
  ['Value', 'Item2'].forEach(function(k){ Object.defineProperty(CfPair.prototype, k, { get:function(){ return this.second; }, set:function(v){ this.second = v; }, enumerable:false }); });
  function CfEnum(type, name, v){ this.__enum = type; this.name = name; this.v = v; }
  CfEnum.prototype.valueOf = function(){ return this.v; };
  CfEnum.prototype.toString = function(){ return this.name; };
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
    // наследование: поля, методы и свойства базового класса
    var done = {};
    function flat(td){ if(!td || td.k !== 'type' || done[td.name]) return; done[td.name] = 1; (td.bases || []).forEach(function(bn){ var b = self.types[bn]; if(!b || b.k !== 'type') return; flat(b); var own = {}; td.fields.forEach(function(f){ own[f.name] = 1; }); td.fields = b.fields.filter(function(f){ return !own[f.name]; }).concat(td.fields); for(var m in b.methods) if(!td.methods[m] || !td.methods[m].body) td.methods[m] = b.methods[m]; td.statics = (td.statics || []).concat(b.statics || []); if(!td.baseTd) td.baseTd = b; }); }
    Object.keys(this.types).forEach(function(n){ flat(self.types[n]); });
    this.ext = {};
    Object.keys(this.types).forEach(function(n){ var td = self.types[n]; if(td.k !== 'type') return; for(var m in td.methods){ var f = td.methods[m]; if(f.params[0] && f.params[0].isThis) self.ext[m] = { f:f, td:td }; } });
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
    if(/^(vector|List|deque|list|IEnumerable|IList|ICollection|Queue|Stack|IReadOnlyList|array|queue|stack|priority_queue|LinkedList|ObservableCollection)$/.test(n)){ var ar = []; if(/^(Queue|queue)$/.test(n)) Object.defineProperty(ar, '__kind', { value:'queue' }); else if(/^(Stack|stack)$/.test(n)) Object.defineProperty(ar, '__kind', { value:'stack' }); else if(n === 'priority_queue') Object.defineProperty(ar, '__kind', { value:'pq' }); return ar; }
    if(/^(map|unordered_map|Dictionary|SortedDictionary|IDictionary|IReadOnlyDictionary)$/.test(n)){ var m = new CfMap(); m.sorted = /^(map|SortedDictionary)$/.test(n); return m; }
    if(/^(set|unordered_set|HashSet|SortedSet|multiset)$/.test(n)){ var st0 = new CfMap(); st0.isSet = true; st0.sorted = /^(set|SortedSet|multiset)$/.test(n); return st0; }
    if(/^(string|String)$/.test(n)) return this.cs ? null : '';
    if(n === 'bool') return false;
    if(/^(Data|json|JsonObject)$/.test(n) && !this.types[n]) return {};
    if(/^(stringstream|istringstream|ostringstream|StringBuilder)$/.test(n)) return this.builtinNew(t, [], null, null);
    if(n === 'ValueTuple'){ var tv = {}, vm0 = this; t.args.forEach(function(a, i){ tv['Item' + (i + 1)] = vm0.defVal(a); if(t.names && t.names[i]) tv[t.names[i]] = tv['Item' + (i + 1)]; }); return tv; }
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
    else if(d.init) v = this.copyVal(d, this.eval(d.init, sc));
    else v = this.defVal(t);
    return this.coerce(t, v);
  };
  VM.copyVal = function(d, v){ if(this.cs || !d.init || !/^(id|index|member)$/.test(d.init.k) || (d.type && d.type.byRef)) return v; return (v instanceof CfObj || Array.isArray(v) || v instanceof CfMap) ? cfClone(v) : v; };
  VM.coerce = function(t, v){ if(t && t.name === 'char' && typeof v === 'number') return String.fromCharCode(v); if(t && typeof v === 'number' && this.isIntType(t)) return Math.trunc(v); if(t && /^(string|String)$/.test(t.name) && typeof v === 'number' && !this.cs) return v; return v; };
  VM.fromList = function(t, l, sc){
    var self = this, n = t ? t.name : 'auto';
    if(t && (this.types[n] && this.types[n].k === 'type')) return this.construct(this.types[n], l.items.map(function(x){ return x.k === 'list' ? x : self.eval(x, sc); }), null, sc, true);
    if(/^(set|unordered_set|HashSet|SortedSet|multiset)$/.test(n)){ var ss = this.defVal(t); l.items.forEach(function(x){ ss.set(self.eval(x, sc), true); }); return ss; }
    if(/^(map|unordered_map|Dictionary|SortedDictionary)$/.test(n)){ var m = new CfMap(); l.items.forEach(function(x){ if(x.k === 'kv') m.set(self.eval(x.key, sc), self.eval(x.val, sc)); else if(x.k === 'list') m.set(self.eval(x.items[0], sc), self.eval(x.items[1], sc)); }); return m; }
    var el = t && t.args && t.args[0];
    if(t && /^(pair|KeyValuePair)$/.test(n)) return new CfPair(this.eval(l.items[0], sc), this.eval(l.items[1], sc), this.cs);
    return l.items.map(function(x){ return x.k === 'list' ? self.fromList(el || null, x, sc) : self.coerce(el, self.eval(x, sc)); });
  };
  VM.construct = function(td, args, init, sc, positional){
    if(td.k === 'enum') return 0;
    var o = new CfObj(td.name), self = this;
    var fs = td.fields;
    var inner = { vars:new Map(), up:{ vars:this.globals, up:null } };
    fs.forEach(function(f){ o[f.name] = f.init || f.ctorArgs ? self.initVar(f, inner) : self.defVal(f.type); });
    if(td.params){ td.params.forEach(function(p, i){ o[p.name] = self.coerce(p.type, args[i] !== undefined ? args[i] : (p.def ? self.eval(p.def, sc) : self.defVal(p.type))); }); }
    else if(!positional && (td.ctors && td.ctors.length || (td.bases && td.bases.length && args.length))){ this.runCtor(td, args, o); }
    else if(args.length){ args.forEach(function(a, i){ var f = fs[i]; if(f) o[f.name] = a && a.k === 'list' ? self.fromList(f.type, a, sc) : self.coerce(f.type, a); }); }
    if(init) this.applyInit(o, init, sc);
    return o;
  };
  VM.pickCtor = function(list, n){ return list.filter(function(c){ return c.params.length === n; })[0] || list.filter(function(c){ return c.params.length >= n && c.params.slice(n).every(function(p){ return p.def; }); })[0] || list[0]; };
  VM.runCtor = function(td, args, o){
    if(!td.ctors || !td.ctors.length){ if(td.baseTd) return this.runCtor(td.baseTd, args, o); if(td.bases && td.bases.some(function(b){ return /Exception|exception|error$/.test(b); })){ o.Message = args[0] !== undefined ? args[0] : ''; o.what = o.Message; } return; }
    var c = this.pickCtor(td.ctors, args.length), vm = this;
    if(c.chain){
      var sc = { vars:new Map(), up:{ vars:this.globals, up:null }, self:o, td:td };
      c.params.forEach(function(p, i){ var v = args[i]; if(v === undefined && p.def) v = vm.eval(p.def, sc); sc.vars.set(p.name, { v:vm.coerce(p.type, v), t:p.type }); });
      var ca = c.chain.args.map(function(a){ return a.k === 'list' ? vm.fromList(null, a, sc) : vm.eval(a, sc); });
      if(c.chain.target === 'this') this.runCtor(td, ca, o);
      else if(td.baseTd) this.runCtor(td.baseTd, ca, o);
      else if(td.bases.some(function(b){ return /Exception|exception|error$/.test(b); })){ o.Message = ca[0] !== undefined ? ca[0] : ''; o.what = o.Message; }
    }
    this.callFunc({ params:c.params, body:c.body, name:td.name }, args, o, td);
  };
  VM.applyInit = function(o, init, sc){
    var self = this;
    init.items.forEach(function(x){
      if(x.k === 'assign' && x.l.k === 'id'){ var v = x.r.k === 'list' ? self.fromList(null, x.r, sc) : self.eval(x.r, sc); if(o instanceof CfMap) o.set(x.l.n, v); else self.setField(o, x.l.n, v); }
      else if(x.k === 'kv'){ o.set(self.eval(x.key, sc), self.eval(x.val, sc)); }
      else if(x.k === 'list' && o instanceof CfMap){ o.set(self.eval(x.items[0], sc), self.eval(x.items[1], sc)); }
      else if(Array.isArray(o)) o.push(self.eval(x, sc));
      else if(o instanceof CfMap && o.isSet) o.set(self.eval(x, sc), true);
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
    if(/^(vector|List|deque|list|Queue|Stack|HashSet|IEnumerable|queue|stack|priority_queue|LinkedList)$/.test(n) || /^(map|unordered_map|Dictionary|SortedDictionary|set|unordered_set|SortedSet|multiset)$/.test(n)){
      var v = this.defVal(t);
      if(v instanceof CfMap && v.isSet && args.length){ (args[0] instanceof CfIter ? args[0].arr.slice(args[0].i, args[1].i) : this.iterable(args[0])).forEach(function(x){ v.set(x, true); }); }
      else if(v instanceof CfMap && args[0] instanceof CfMap){ args[0].pairs().forEach(function(p){ v.set(p.k, p.v); }); }
      if(Array.isArray(v)){ if(args.length === 2 && typeof args[0] === 'number' && !this.cs){ for(var i = 0; i < args[0]; i++) v.push(cfClone(args[1])); } else if(args.length === 1 && typeof args[0] === 'number' && !this.cs){ for(var j = 0; j < args[0]; j++) v.push(this.defVal(t.args[0])); } else if(args.length === 1 && Array.isArray(args[0])) v = args[0].slice(); else if(args.length === 2 && args[0] instanceof CfIter) v = args[0].arr.slice(args[0].i, args[1].i); }
      if(init) this.applyInit(v, init, sc);
      return v;
    }
    if(/^(string|String)$/.test(n)) return args.length === 2 && typeof args[0] === 'number' ? String(args[1]).repeat(args[0]) : String(args[0] || '');
    if(/^(stringstream|istringstream|ostringstream)$/.test(n)) return { __t:'sstream', buf:args[0] !== undefined ? String(args[0]) : '', pos:0, fail:false };
    if(/^(StringBuilder)$/.test(n)){ var sb = { __t:'StringBuilder', s:args[0] ? String(args[0]) : '' }; return sb; }
    if(/^(pair|KeyValuePair)$/.test(n)) return new CfPair(args[0], args[1], this.cs);
    if(/^(Tuple|tuple)$/.test(n)){ var tp0 = {}; args.forEach(function(x, i){ tp0['Item' + (i + 1)] = x; }); return tp0; }
    if(/^(Random)$/.test(n)) return { __t:'Random' };
    if(/^(Data|json|JObject|ExpandoObject|JsonObject)$/.test(n)) return {};
    if(n === 'ValueTuple') return this.defVal(t);
    if(/^(object)$/.test(n)) return {};
    if(/^(DateTime)$/.test(n)) return args.length ? new Date(args[0], (args[1] || 1) - 1, args[2] || 1) : new Date();
    if(/Exception$|^(runtime_error|invalid_argument|logic_error|exception|out_of_range|domain_error|overflow_error|range_error|length_error)$/.test(n)) return { __t:n, __exc:true, Message:args[0] || '', what:args[0] || '', InnerException:args[1] || null };
    if(this.io.newObj){ var r = this.io.newObj(n, args, this); if(r !== undefined) return r; }
    return undefined;
  };
  VM.callFunc = function(f, args, self, td, refs){
    if(!f.body) throw CfErr('У функции «' + f.name + '» нет тела');
    var sc = { vars:new Map(), up:{ vars:this.globals, up:null }, self:self, td:td, fn:f };
    var vm = this;
    f.params.forEach(function(p, i){
      if(refs && refs[i] && p.byRef){ var r = refs[i]; sc.vars.set(p.name, { get v(){ return r.get(); }, set v(x){ r.set(x); }, t:p.type }); return; }
      var v = args[i]; if(v === undefined && p.def) v = vm.eval(p.def, sc); if(v === undefined) v = vm.defVal(p.type); sc.vars.set(p.name, { v:vm.coerce(p.type, v), t:p.type });
    });
    var keep = this.curFunc; this.curFunc = f;
    try { this.exec(f.body, sc); } catch(e){ if(e instanceof CfRet) return this.nameTuple(f.ret, e.v); throw e; } finally { this.curFunc = keep; }
    return undefined;
  };
  VM.nameTuple = function(t, v){ if(t && t.name === 'ValueTuple' && t.names && v && typeof v === 'object'){ t.names.forEach(function(n, i){ if(n) v[n] = v['Item' + (i + 1)]; }); } return v; };
  VM.argRefs = function(f, args, sc){ var vm = this; if(!f.params.some(function(p){ return p.byRef; })) return null; return args.map(function(a, i){ var p = f.params[i]; if(!p || !p.byRef || !a) return null; if(a.k === 'out'){ var sl = vm.lookup(sc, a.n); if(!sl){ sc.vars.set(a.n, { v:undefined }); } return vm.ref({ k:'id', n:a.n }, sc); } if(a.k === 'id' || a.k === 'member' || a.k === 'index'){ try { return vm.ref(a, sc); } catch(_){ return null; } } return null; }); };
  VM.setField = function(o, n, v){ if(o && o.__t && this.types[o.__t]){ var pr = this.findProp(this.types[o.__t], n); if(pr && pr.setter){ this.runSetter(pr, o, this.types[o.__t], v); return; } } o[n] = v; };
  VM.findProp = function(td, n){ var all = td.fields.concat(td.statics || []); for(var i = 0; i < all.length; i++) if(all[i].name === n && (all[i].getter || all[i].setter)) return all[i]; return null; };
  VM.runSetter = function(f, self, td, v){ var sc = { vars:new Map(), up:{ vars:this.globals, up:null }, self:self, td:td }; sc.vars.set('value', { v:v }); try { this.exec(f.setter, sc); } catch(e){ if(!(e instanceof CfRet)) throw e; } };
  VM.callFn = function(fn, args){
    if(typeof fn === 'function') return fn.apply(null, args);
    if(fn && fn.__lambda) return fn.call(args);
    throw CfErr('Это не функция');
  };
  VM.lambda = function(node, sc){
    var vm = this;
    var L = { __lambda:true, call:function(args){
      var s2 = { vars:new Map(), up:sc, self:sc.self, td:sc.td };
      node.params.forEach(function(p, i){ var pt = node.ptypes && node.ptypes[i]; s2.vars.set(p, { v:pt ? vm.coerce(pt, args[i]) : args[i], t:pt || null }); });
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
      case 'block': var inner = { vars:new Map(), up:sc, self:sc.self, td:sc.td };
        for(var h = 0; h < s.body.length; h++){ var lf = s.body[h]; if(lf && lf.k === 'localfn') inner.vars.set(lf.f.name, { v:this.lambda({ params:lf.f.params.map(function(p){ return p.name; }), ptypes:lf.f.params.map(function(p){ return p.type; }), body:lf.f.body, ret:lf.f.ret }, inner) }); }
        for(var i = 0; i < s.body.length; i++) this.exec(s.body[i], inner); return;
      case 'localfn': return;
      case 'expr': this.eval(s.e, sc); return;
      case 'decl': if(s.isStatic){ var stl = s.slots || (s.slots = {}); s.list.forEach(function(d){ if(!stl[d.name]) stl[d.name] = { v:vm.initVar(d, sc), t:d.type }; sc.vars.set(d.name, stl[d.name]); }); return; }
        s.list.forEach(function(d){ var v = vm.initVar(d, sc); if(d.init && d.init.k === 'list' && (!d.type || d.type.name === 'auto' || d.type.name === 'var')) v = vm.fromList(null, d.init, sc); sc.vars.set(d.name, { v:v, t:d.type && d.type.name !== 'auto' && d.type.name !== 'var' ? d.type : vm.guessType(d.init, sc) }); }); return;
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
        var raw = this.eval(s.e, sc), coll = this.iterable(raw), byRef = !this.cs && s.type && s.type.byRef && Array.isArray(raw);
        for(var k = 0; k < coll.length; k++){
          this.tick();
          var ls = { vars:new Map(), up:sc, self:sc.self, td:sc.td };
          if(Array.isArray(s.name)) s.name.forEach(function(n, j){ ls.vars.set(n, { v:vm.part(coll[k], j) }); });
          else if(byRef){ (function(ix){ ls.vars.set(s.name, { get v(){ return coll[ix]; }, set v(x){ coll[ix] = x; }, t:null }); })(k); }
          else ls.vars.set(s.name, { v:coll[k], t:s.type && s.type.name !== 'auto' && s.type.name !== 'var' ? s.type : null });
          try { this.exec(s.b, ls); } catch(e){ if(e instanceof CfBreak) break; if(e instanceof CfCont) continue; throw e; }
        }
        return;
      case 'return': throw new CfRet(s.e ? (s.e.k === 'list' ? this.fromRet(s.e, sc) : this.eval(s.e, sc)) : undefined);
      case 'break': throw new CfBreak();
      case 'continue': throw new CfCont();
      case 'throw': if(!s.e){ for(var q0 = sc; q0; q0 = q0.up) if(q0.curExc) throw q0.curExc; } this.throwVal(s.e ? this.eval(s.e, sc) : { __t:'Exception', Message:'исключение' }, s.line);
      case 'try':
        try { this.exec(s.b, sc); }
        catch(e){
          if(e instanceof CfRet || e instanceof CfBreak || e instanceof CfCont || !s.cl.length) throw e;
          if(/долгое выполнение/.test(e.message)) throw e;
          var exv = e.cfVal || { __t:/Деление на ноль/.test(e.message) ? 'DivideByZeroException' : (/диапазон/.test(e.message) ? 'IndexOutOfRangeException' : (/null/.test(e.message) ? 'NullReferenceException' : 'Exception')), __exc:true, Message:String(e.message || e).replace(/ \(строка \d+\)$/, ''), what:String(e.message || e) };
          var hit = null, cs2 = null;
          for(var ci = 0; ci < s.cl.length && !hit; ci++){ var C = s.cl[ci]; if(C.type && !this.excIs(exv, C.type.name)) continue; cs2 = { vars:new Map(), up:sc, self:sc.self, td:sc.td, curExc:e }; if(C.name) cs2.vars.set(C.name, { v:exv }); if(C.when && !this.truthy(this.eval(C.when, cs2))) continue; hit = C; }
          if(!hit) throw e;
          this.exec(hit.b, cs2);
        }
        finally { if(s.f) this.exec(s.f, sc); }
        return;
      case 'switch':
        var sv = this.eval(s.e, sc), hit = false;
        try { for(var c = 0; c < s.cases.length; c++){ var cs = s.cases[c]; if(!hit && !cs.def && (cs.pat ? this.match(cs.pat, sv, sc) && (!cs.when || this.truthy(this.eval(cs.when, sc))) : this.eq(this.eval(cs.v, sc), sv))) hit = true; if(hit) cs.body.forEach(function(st){ vm.exec(st, sc); }); }
          if(!hit){ var d = s.cases.filter(function(x){ return x.def; })[0]; if(d) d.body.forEach(function(st){ vm.exec(st, sc); }); } }
        catch(e){ if(!(e instanceof CfBreak)) throw e; }
        return;
    }
  };
  VM.throwVal = function(v, line){ var msg = v && typeof v === 'object' ? (v.Message !== undefined ? v.Message : v.what) : v; var err = CfErr('Исключение' + (v && v.__t && !/^(Exception|exception)$/.test(v.__t) ? ' ' + v.__t : '') + ': ' + this.str(msg), line); err.cfVal = v && typeof v === 'object' ? v : { __t:typeof v === 'string' ? 'string' : 'Exception', Message:this.str(v), what:this.str(v), raw:v }; throw err; };
  VM.excIs = function(v, tn){ if(/^(Exception|exception|SystemException)$/.test(tn)) return true; if(!v) return false; if(v.__t === tn) return true; if(tn === 'string' || tn === 'char' || tn === 'int') return v.__t === tn || (tn === 'string' && typeof v.raw === 'string') || (tn === 'int' && typeof v.raw === 'number'); var td = this.types[v.__t]; while(td){ if(td.bases && td.bases.indexOf(tn) >= 0) return true; td = td.baseTd; } if(/^(runtime_error|logic_error)$/.test(tn) && /error|argument|range/.test(v.__t)) return true; return false; };
  // сопоставление с образцом C#
  VM.match = function(p, v, sc){
    var vm = this;
    switch(p.pk){
      case 'any': return true;
      case 'const': var c = this.eval(p.e, sc); if(typeof c === 'number' && typeof v === 'number') return c === v; return this.eq(v, c) || (v != null && c != null && JSON.stringify(cfToJson(v)) === JSON.stringify(cfToJson(c)) && typeof v !== 'object');
      case 'rel': var r = this.eval(p.e, sc); if(v == null) return false; return p.op === '<' ? v < r : p.op === '>' ? v > r : p.op === '<=' ? v <= r : v >= r;
      case 'not': return !this.match(p.p, v, sc);
      case 'and': return this.match(p.l, v, sc) && this.match(p.r, v, sc);
      case 'or': return this.match(p.l, v, sc) || this.match(p.r, v, sc);
      case 'bind': sc.vars.set(p.name, { v:v }); return true;
      case 'type': if(!this.isType(v, p.type)) return false; if(p.name) sc.vars.set(p.name, { v:v, t:p.type }); return true;
      case 'tuple': return p.items.every(function(ip, i){ return vm.match(ip, vm.part(v, i), sc); });
      case 'prop': if(v == null) return false; if(p.type && !this.isType(v, p.type)) return false; if(!p.props.every(function(pp){ var cur = v; pp.n.split('.').forEach(function(k){ cur = cur == null ? null : vm.getMember(cur, k, { opt:true }, sc); }); return vm.match(pp.p, cur, sc); })) return false; if(p.name) sc.vars.set(p.name, { v:v }); return true;
    }
    return false;
  };
  VM.linq = function(e, sc){
    var vm = this, envs = null, result = null;
    var scope = function(env){ var s2 = { vars:new Map(), up:sc, self:sc.self, td:sc.td }; for(var k in env) s2.vars.set(k, { v:env[k] }); return s2; };
    var ext = function(env, k, v){ var o = {}; for(var x in env) o[x] = env[x]; o[k] = v; return o; };
    e.cl.forEach(function(c){
      switch(c.c){
        case 'from': if(!envs) envs = vm.iterable(vm.eval(c.e, sc)).map(function(v){ var o = {}; o[c.v] = v; return o; }); else { var ne = []; envs.forEach(function(env){ vm.iterable(vm.eval(c.e, scope(env))).forEach(function(v){ ne.push(ext(env, c.v, v)); }); }); envs = ne; } break;
        case 'where': envs = envs.filter(function(env){ return vm.truthy(vm.eval(c.e, scope(env))); }); break;
        case 'let': envs = envs.map(function(env){ return ext(env, c.v, vm.eval(c.e, scope(env))); }); break;
        case 'join': var src = vm.iterable(vm.eval(c.e, sc)), ne2 = []; envs.forEach(function(env){ var ka = JSON.stringify(cfToJson(vm.eval(c.a, scope(env)))), hits = src.filter(function(y){ var o = {}; o[c.v] = y; return JSON.stringify(cfToJson(vm.eval(c.b, scope(ext(env, c.v, y))))) === ka; }); if(c.into) ne2.push(ext(env, c.into, hits)); else hits.forEach(function(y){ ne2.push(ext(env, c.v, y)); }); }); envs = ne2; break;
        case 'orderby': var keyed = envs.map(function(env, i){ return { env:env, i:i, k:c.keys.map(function(kk){ return vm.eval(kk.e, scope(env)); }) }; }); keyed.sort(function(a, b){ for(var j = 0; j < c.keys.length; j++){ var A = a.k[j], B = b.k[j]; if(A instanceof Date) A = +A; if(B instanceof Date) B = +B; if(A < B) return c.keys[j].desc ? 1 : -1; if(A > B) return c.keys[j].desc ? -1 : 1; } return a.i - b.i; }); envs = keyed.map(function(x){ return x.env; }); break;
        case 'select': result = envs.map(function(env){ return vm.eval(c.e, scope(env)); }); break;
        case 'group': var groups = [], idx = {}; envs.forEach(function(env){ var s2 = scope(env), k = vm.eval(c.key, s2), ks = JSON.stringify(cfToJson(k)); if(!idx[ks]){ idx[ks] = { __group:true, Key:k, items:[] }; groups.push(idx[ks]); } idx[ks].items.push(vm.eval(c.e, s2)); }); result = groups; break;
        case 'into': envs = result.map(function(v){ var o = {}; o[c.v] = v; return o; }); result = null; break;
      }
    });
    return result || [];
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
    if(v instanceof CfMap && v.isSet){ var ks = v.pairs().map(function(p){ return p.k; }); if(v.sorted || !this.cs) ks.sort(function(a, b){ return a < b ? -1 : (a > b ? 1 : 0); }); return ks; }
    if(v instanceof CfMap){ var cs0 = this.cs, ps = v.pairs().map(function(p){ return new CfPair(p.k, p.v, cs0); }); if(v.sorted || !this.cs) ps.sort(function(a, b){ return a.first < b.first ? -1 : (a.first > b.first ? 1 : 0); }); return ps; }
    if(typeof v === 'string') return v.split('');
    if(v && v.__group) return v.items;
    if(v && typeof v === 'object') return Object.keys(v).filter(function(k){ return k !== '__t'; }).map(function(k){ return { first:k, second:v[k], Key:k, Value:v[k] }; });
    return [];
  };
  VM.truthy = function(v){ if(v && v.__t === 'sstream') return !v.fail; if(v instanceof CfEnum) return !!v.v; return !!v; };
  VM.eq = function(a, b){ if(a instanceof Date && b instanceof Date) return +a === +b; if(a instanceof CfIter && b instanceof CfIter) return a.i === b.i; if(a instanceof CfEnum || b instanceof CfEnum) return a != null && b != null && +a === +b; if(a instanceof CfPair && b instanceof CfPair) return this.eq(a.first, b.first) && this.eq(a.second, b.second); if(a && a.__t && this.types[a.__t] && b && b.__t === a.__t){ var ov = this.findOp(a.__t, '==', 2); if(ov) return this.truthy(this.callFunc(ov.f, ov.f.params.length === 2 ? [a, b] : [b], ov.f.params.length === 2 ? null : a, ov.td)); if(this.types[a.__t].params || this.types[a.__t].kind === 'struct') return JSON.stringify(cfToJson(a)) === JSON.stringify(cfToJson(b)); } return a === b || (a == null && b == null); };
  VM.isCharExpr = function(e, sc){ if(!e) return false; if(e.k === 'str') return !!e.chr; if(e.k === 'id'){ var sl = this.lookup(sc, e.n); return !!(sl && sl.t && sl.t.name === 'char'); } if(e.k === 'index'){ return false; } if(e.k === 'cast') return e.type.name === 'char'; return false; };
  VM.isIntExpr = function(e, sc){
    if(!e) return false;
    switch(e.k){
      case 'num': return !!e.isInt;
      case 'str': return !!e.chr;
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
  VM.num = function(v){ if(typeof v === 'number') return v; if(typeof v === 'boolean') return v ? 1 : 0; if(typeof v === 'string' && v.length === 1) return v.charCodeAt(0); if(v instanceof CfEnum) return v.v; if(v instanceof Date) return +v; if(v == null) return 0; var n = Number(v); return n; };
  VM.binop = function(op, a, b, e, sc){
    if(a && a.__t && !(a instanceof Date)){ var ov = this.findOp(a.__t, op, 2) ; if(ov) return ov.td ? this.callFunc(ov.f, ov.f.params.length === 2 ? [a, b] : [b], ov.f.params.length === 2 ? null : a, ov.td) : this.callFunc(ov.f, [a, b], null, null); if(op === '!=' && (ov = this.findOp(a.__t, '==', 2))) return !this.binop('==', a, b, e, sc); }
    else if(b && b.__t && !(b instanceof Date)){ var ov2 = this.findOp(b.__t, op, 2, true); if(ov2) return this.callFunc(ov2.f, [a, b], null, ov2.td); }
    switch(op){
      case '+': if(typeof a === 'string' && typeof b === 'number' && a.length === 1 && this.isCharExpr(e.l, sc)) return a.charCodeAt(0) + b; if(typeof b === 'string' && typeof a === 'number' && b.length === 1 && this.isCharExpr(e.r, sc)) return a + b.charCodeAt(0); if(typeof a === 'string' && typeof b === 'string' && a.length === 1 && b.length === 1 && this.isCharExpr(e.l, sc) && this.isCharExpr(e.r, sc)) return a.charCodeAt(0) + b.charCodeAt(0); if(typeof a === 'string' || typeof b === 'string') return (a == null ? '' : this.str(a)) + (b == null ? '' : this.str(b)); if(a instanceof CfIter) return new CfIter(a.arr, a.i + b); return this.num(a) + this.num(b);
      case '-': if(a instanceof CfIter && b instanceof CfIter) return a.i - b.i; if(a instanceof CfIter) return new CfIter(a.arr, a.i - b); if(a instanceof Date && b instanceof Date) return { __t:'TimeSpan', ms:a - b, TotalDays:(a - b) / 864e5, Days:Math.floor((a - b) / 864e5), TotalHours:(a - b) / 36e5 }; return this.num(a) - this.num(b);
      case '*': return this.num(a) * this.num(b);
      case '/': var bb = this.num(b); if(bb === 0 && this.isIntExpr(e.l, sc) && this.isIntExpr(e.r, sc)) throw CfErr('Деление на ноль', e.line); var r = this.num(a) / bb; return this.isIntExpr(e.l, sc) && this.isIntExpr(e.r, sc) ? Math.trunc(r) : r;
      case '%': return this.num(a) % this.num(b);
      case '==': return this.eq(a, b);
      case '!=': return !this.eq(a, b);
      case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
      case '&': return this.num(a) & this.num(b); case '|': return this.num(a) | this.num(b); case '^': return this.num(a) ^ this.num(b);
      case '<<': if(a && a.__t === 'ostream'){ a.write(b); return a; } if(a && a.__t === 'sstream'){ if(b && b.__manip) return a; a.buf += this.str(b); return a; } return this.num(a) << this.num(b);
      case '>>': return this.num(a) >> this.num(b);
    }
    throw CfErr('Неизвестная операция ' + op);
  };
  VM.readInto = function(st, target, sc){
    if(st.__t === 'istream'){ st.fail = true; return; }
    var rest = st.buf.slice(st.pos), m = /^\s*(\S+)/.exec(rest);
    if(!m){ st.fail = true; return; }
    st.pos += m[0].length;
    var r = this.ref(target, sc), sl = target.k === 'id' ? this.lookup(sc, target.n) : null, t = sl && sl.t;
    if(t && /^(string|String)$/.test(t.name)) r.set(m[1]);
    else if(t && t.name === 'char'){ r.set(m[1][0]); st.pos -= m[1].length - 1; }
    else { var nv = parseFloat(m[1]); if(isNaN(nv)){ st.fail = true; st.pos -= m[0].length; return; } r.set(t && this.isIntType(t) ? Math.trunc(nv) : nv); }
  };
  VM.findOp = function(tn, op, n, rightOnly){
    var name = 'operator' + op, td = this.types[tn];
    if(td && td.methods && td.methods[name] && !rightOnly){ var m = td.methods[name]; return { f:m, td:td }; }
    if(td && td.methods && td.methods[name] && td.methods[name].params.length === 2) return { f:td.methods[name], td:td };
    var fs = this.funcs[name]; if(fs){ var f = fs.filter(function(x){ return x.params.length === 2 && x.body; })[0]; if(f) return { f:f, td:null }; }
    return null;
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
      if(this.fixed && this.prec !== undefined) return v.toFixed(this.prec);
      if(this.prec !== undefined) return String(Number(v.toPrecision(Math.max(1, this.prec))));
      return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
    }
    if(v instanceof Date) return v.toLocaleDateString('ru-RU');
    if(v instanceof CfEnum) return this.cs ? v.name : String(v.v);
    if(typeof v === 'object' && (v.__t === 'sstream')) return v.buf;
    if(Array.isArray(v)) return this.cs ? 'System.Collections.Generic.List`1[' + (v.length && typeof v[0] === 'number' ? 'System.Int32' : 'System.Object') + ']' : v.map(function(x){ return this.str(x); }, this).join(' ');
    if(v && !v.__t && v.Item1 !== undefined && this.cs){ var its = []; for(var ti = 1; ('Item' + ti) in v; ti++) its.push(this.str(v['Item' + ti])); return '(' + its.join(', ') + ')'; }
    if(v && v.__exc) return (v.__t || 'Exception') + ': ' + v.Message;
    if(v && v.__t && this.types[v.__t] && this.types[v.__t].methods && this.types[v.__t].methods.ToString && this.types[v.__t].methods.ToString.body) return this.str(this.callFunc(this.types[v.__t].methods.ToString, [], v, this.types[v.__t]));
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
      if(sc.self && sc.td){ var pr0 = this.findProp(sc.td, e.n); if(pr0) return { get:function(){ return pr0.getter ? vm.runGetter(pr0, sc.self, sc.td) : sc.self[e.n]; }, set:function(v){ if(pr0.setter) vm.runSetter(pr0, sc.self, sc.td, v); else sc.self[e.n] = v; } }; }
      if(sc.self && sc.self[e.n] !== undefined) return { get:function(){ return sc.self[e.n]; }, set:function(v){ sc.self[e.n] = v; } };
      if(sc.self && sc.td && sc.td.fields.some(function(f){ return f.name === e.n; })) return { get:function(){ return sc.self[e.n]; }, set:function(v){ sc.self[e.n] = v; } };
      if(sc.td && this.statics[sc.td.name] && e.n in this.statics[sc.td.name]){ var st = this.statics[sc.td.name]; return { get:function(){ return st[e.n]; }, set:function(v){ st[e.n] = v; } }; }
      throw CfErr('Неизвестная переменная «' + e.n + '»', e.line);
    }
    if(e.k === 'member'){ var o = this.eval(e.o, sc); if(o && o.__type && this.statics[o.__type]){ var stt = this.statics[o.__type]; return { get:function(){ return stt[e.n]; }, set:function(v){ stt[e.n] = v; } }; } return { get:function(){ return vm.getMember(o, e.n, e); }, set:function(v){ if(o == null) throw CfErr('Обращение к пустому объекту', e.line); vm.setField(o, e.n, v); } }; }
    if(e.k === 'index'){
      var oo = this.eval(e.o, sc), ix = this.eval(e.i, sc);
      if(oo instanceof CfMap) return { get:function(){ if(!oo.has(ix)){ if(vm.cs) throw CfErr('Ключ «' + ix + '» не найден в словаре', e.line); oo.set(ix, 0); } return oo.get(ix); }, set:function(v){ oo.set(ix, v); } };
      return { get:function(){ return vm.index(oo, ix, e); }, set:function(v){ if(Array.isArray(oo) && (ix < 0 || ix >= oo.length) && vm.cs) throw CfErr('Индекс ' + ix + ' вне диапазона', e.line); oo[ix] = v; } };
    }
    if(e.k === 'deref'){ var di = this.eval(e.e, sc); if(di instanceof CfIter) return { get:function(){ return di.arr[di.i]; }, set:function(v){ di.arr[di.i] = v; } }; return this.ref(e.e, sc); }
    if(e.k === 'un' || e.k === 'cast') return this.ref(e.e, sc);
    throw CfErr('Сюда нельзя присвоить', e.line);
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
      case 'interp': return e.parts.map(function(p){ return typeof p === 'string' ? p : cfAlign(vm.str(vm.eval(p.e, sc), p.fmt), p.align); }).join('');
      case 'tuple': var tp = {}; e.items.forEach(function(x, i){ tp['Item' + (i + 1)] = vm.eval(x, sc); if(e.names && e.names[i]) tp[e.names[i]] = tp['Item' + (i + 1)]; else if(x.k === 'id' && vm.cs) tp[x.n] = tp['Item' + (i + 1)]; else if(x.k === 'member' && vm.cs) tp[x.n] = tp['Item' + (i + 1)]; }); return tp;
      case 'switchx': var sxv = this.eval(e.e, sc); for(var ai = 0; ai < e.arms.length; ai++){ var A = e.arms[ai], asc = { vars:new Map(), up:sc, self:sc.self, td:sc.td }; if(this.match(A.pat, sxv, asc) && (!A.when || this.truthy(this.eval(A.when, asc)))) return this.eval(A.e, asc); } this.throwVal({ __t:'SwitchExpressionException', Message:'Ни один вариант switch не подошёл для значения ' + this.str(sxv) }, e.line);
      case 'isp': return this.match(e.pat, this.eval(e.e, sc), sc);
      case 'with': var wo = this.eval(e.e, sc), wc = wo instanceof CfObj ? new CfObj(wo.__t) : {}; for(var wk in wo) wc[wk] = wo[wk]; this.applyInit(wc, e.init, sc); return wc;
      case 'linq': return this.linq(e, sc);
      case 'throwx': this.throwVal(this.eval(e.e, sc), e.line);
      case 'list': return this.fromList(null, e, sc);
      case 'anon': var ao = {}; e.items.forEach(function(x){ if(x.k === 'assign') ao[x.l.n] = vm.eval(x.r, sc); else if(x.k === 'member') ao[x.n] = vm.eval(x, sc); else if(x.k === 'id') ao[x.n] = vm.eval(x, sc); }); return ao;
      case 'id': return this.getId(e, sc);
      case 'default': return this.defVal(e.type);
      case 'seq': var lv; e.l.forEach(function(x){ lv = vm.eval(x, sc); }); return lv;
      case 'assign':
        if(e.l.k === 'tuple' && e.op === '='){ var tvv = this.eval(e.r, sc), tvs = e.l.items.map(function(x, i){ return vm.part(tvv, i); }); e.l.items.forEach(function(x, i){ if(x.k === 'id' && x.n === '_') return; vm.ref(x, sc).set(tvs[i]); }); return tvv; }
        if(e.l.k === 'call' && e.l.f.k === 'id' && /^(std::)?tie$/.test(e.l.f.n)){ var tr = this.eval(e.r, sc); e.l.args.forEach(function(x, i){ if(x.k === 'id' && /^(std::)?ignore$/.test(x.n)) return; vm.ref(x, sc).set(vm.part(tr, i)); }); return tr; }
        if(e.op === '??='){ var rq = this.ref(e.l, sc), cur = rq.get(); if(cur != null) return cur; var nvq = this.eval(e.r, sc); rq.set(nvq); return nvq; }
        var rf = this.ref(e.l, sc), rv = e.r.k === 'list' ? this.fromList(null, e.r, sc) : this.eval(e.r, sc);
        if(e.op !== '='){ var op = e.op.slice(0, -1); rv = this.binop(op, rf.get(), rv, { l:e.l, r:e.r, line:e.line }, sc); }
        rf.set(rv); return rv;
      case 'cond': return this.truthy(this.eval(e.c, sc)) ? this.eval(e.a, sc) : this.eval(e.b, sc);
      case 'bin':
        if(e.op === '&&') return this.truthy(this.eval(e.l, sc)) && this.truthy(this.eval(e.r, sc));
        if(e.op === '||') return this.truthy(this.eval(e.l, sc)) || this.truthy(this.eval(e.r, sc));
        if(e.op === '??'){ var lv2 = this.eval(e.l, sc); return lv2 != null ? lv2 : this.eval(e.r, sc); }
        if(e.op === '>>' && !this.cs){ var sl0 = this.eval(e.l, sc); if(sl0 && (sl0.__t === 'sstream' || sl0.__t === 'istream')){ this.readInto(sl0, e.r, sc); return sl0; } return this.binop('>>', sl0, this.eval(e.r, sc), e, sc); }
        return this.binop(e.op, this.eval(e.l, sc), this.eval(e.r, sc), e, sc);
      case 'is': var iv = this.eval(e.e, sc), res = e.null ? iv == null : (e.type ? this.isType(iv, e.type) : false); return e.neg ? !res : res;
      case 'as': var av = this.eval(e.e, sc); return this.isType(av, e.type) ? av : null;
      case 'un': var u = this.eval(e.e, sc); if(e.op === '!') return !this.truthy(u); if(e.op === '-') return -this.num(u); if(e.op === '~') return ~this.num(u); return this.num(u);
      case 'pre': case 'post':
        var r2 = this.ref(e.e, sc), old = r2.get(), nv = old instanceof CfIter ? new CfIter(old.arr, old.i + (e.op === '++' ? 1 : -1)) : (typeof old === 'string' && old.length === 1 ? String.fromCharCode(old.charCodeAt(0) + (e.op === '++' ? 1 : -1)) : this.num(old) + (e.op === '++' ? 1 : -1)); r2.set(nv); return e.k === 'pre' ? nv : old;
      case 'cast': var cv = this.eval(e.e, sc); if(e.type.name === 'char') return typeof cv === 'string' ? cv : String.fromCharCode(Math.trunc(this.num(cv))); if(this.types[e.type.name] && this.types[e.type.name].k === 'enum'){ var etd = this.types[e.type.name], en = Object.keys(etd.vals).filter(function(k){ return etd.vals[k] === vm.num(cv); })[0]; return en ? this.enumVal(etd, en) : this.num(cv); } if(this.isIntType(e.type)) return Math.trunc(this.num(cv)); if(/^(double|float|decimal)$/.test(e.type.name)) return this.num(cv); if(e.type.name === 'string') return this.str(cv); return cv;
      case 'index': return this.index(this.eval(e.o, sc), this.eval(e.i, sc), e);
      case 'member': var mo = this.eval(e.o, sc); if(mo == null && e.opt) return null; return this.getMember(mo, e.n, e, sc);
      case 'lambda': return this.lambda(e, sc);
      case 'deref': var dv = this.eval(e.e, sc); return dv instanceof CfIter ? dv.arr[dv.i] : dv;
      case 'construct': return e.init ? (this.types[e.type.name] ? this.fromList(e.type, e.init, sc) : this.fromList(e.type, e.init, sc)) : this.constructType(e.type, [], null, sc);
      case 'new':
        var na = e.args.map(function(a){ return a.k === 'list' ? a : vm.eval(a, sc); });
        if(!e.type){ return {}; }
        return this.constructType(e.type, na, e.init, sc);
      case 'newarr': if(e.init) return this.fromList({ name:'array', args:[e.type] }, e.init, sc);
        var dims = (e.dims && e.dims.length ? e.dims : [e.n]).map(function(d){ return vm.num(vm.eval(d, sc)); });
        var mk = function(di){ var out = []; for(var i = 0; i < dims[di]; i++) out.push(di + 1 < dims.length ? mk(di + 1) : vm.defVal(e.type)); return out; };
        return mk(0);
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
    var bare = this.unNs(n);
    if(bare.indexOf('::') >= 0){ var segs = bare.split('::'), base0 = this.getId({ k:'id', n:segs[0], line:e.line }, sc); for(var si = 1; si < segs.length; si++) base0 = this.getMember(base0, segs[si], e, sc); return base0; }
    if(this.funcs[bare]) return { __fn:bare };
    if(n === 'base' && sc.td && sc.td.baseTd) return { __base:sc.td.baseTd, self:sc.self };
    if(/^(fixed|scientific|defaultfloat|boolalpha|noboolalpha|left|right|showpoint|ws|flush|setw|setprecision|setfill)$/.test(bare) && !this.cs) return { __manip:bare };
    if(sc.td && sc.td.methods[n]) return { __method:n, self:sc.self, td:sc.td };
    if(this.types[bare]) return { __type:bare };
    if(bare === 'cout' || bare === 'cerr' || bare === 'clog') return this.ostream();
    if(bare === 'cin') return { __t:'istream', fail:true };
    if(bare === 'endl') return '\n';
    if(/^(npos|string::npos)$/.test(bare)) return -1;
    if(/^numeric_limits/.test(bare)) return { __t:'limits' };
    var g = this.builtinGlobal(bare); if(g !== undefined) return g;
    if(this.io.global){ var r = this.io.global(bare, this); if(r !== undefined) return r; }
    throw CfErr('Неизвестное имя «' + n + '»', e.line);
  };
  VM.enumVal = function(td, n){ var c = td.objs || (td.objs = {}); if(!c[n]) c[n] = new CfEnum(td.name, n, td.vals[n]); return c[n]; };
  VM.unNs = function(n){ n = String(n).replace(/^std::/, ''); if(n.indexOf('::') < 0) return n; var p = n.split('::'); while(p.length > 1 && !this.types[p[0]]) p.shift(); return p.join('::'); };
  VM.findGetter = function(td, n){ var all = td.fields.concat(td.statics || []); for(var i = 0; i < all.length; i++) if(all[i].name === n && all[i].getter) return all[i]; return null; };
  VM.runGetter = function(f, self, td){ var sc = { vars:new Map(), up:{ vars:this.globals, up:null }, self:self, td:td }; if(f.getter.k === 'block'){ try { this.exec(f.getter, sc); } catch(e){ if(e instanceof CfRet) return e.v; throw e; } return undefined; } return this.eval(f.getter, sc); };
  VM.ostream = function(){ var vm = this; return { __t:'ostream', write:function(v){
    if(v && v.__manip){ var mn = v.__manip; if(mn === 'fixed') vm.fixed = true; else if(mn === 'scientific' || mn === 'defaultfloat') vm.fixed = false; else if(mn === 'setprecision') vm.prec = v.n; else if(mn === 'setw') vm.width = v.n; else if(mn === 'setfill') vm.fill = v.n; else if(mn === 'left' || mn === 'right') vm.align = mn; return; }
    var s = vm.str(v); if(vm.width){ var fl = vm.fill === undefined ? ' ' : String(vm.fill); while(s.length < vm.width) s = vm.align === 'left' ? s + fl : fl + s; vm.width = 0; } var last = vm.out.length ? vm.out[vm.out.length - 1] : null; if(last !== null && !/\n$/.test(last)) vm.out[vm.out.length - 1] = last + s; else vm.out.push(s); } }; };
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
      var n = this.unNs(f.n), sl = this.lookup(sc, f.n);
      if(n.indexOf('::') >= 0){ var segs = n.split('::'), mname = segs.pop(); return this.method(this.getId({ k:'id', n:segs.join('::'), line:f.line }, sc), mname, argv(), f, sc, e); }
      if(sl && sl.v && (sl.v.__lambda || typeof sl.v === 'function')) return this.callFn(sl.v, argv());
      if(sl && sl.v && sl.v.__t && this.types[sl.v.__t] && this.types[sl.v.__t].methods['operator()']) return this.callFunc(this.types[sl.v.__t].methods['operator()'], argv(), sl.v, this.types[sl.v.__t]);
      var dyn = sc.self && sc.self.__t && this.types[sc.self.__t]; if(dyn && dyn !== sc.td && dyn.methods && dyn.methods[n] && dyn.methods[n].body && sc.td && sc.td.methods[n]){ var dm = this.pickOver(dyn, n, e.args.length); return this.callFunc(dm, argv(), dm.static ? null : sc.self, dyn, this.argRefs(dm, e.args, sc)); }
      if(sc.td && sc.td.methods[n]){ var m = this.pickOver(sc.td, n, e.args.length); return this.callFunc(m, argv(), m.static ? null : sc.self, sc.td, this.argRefs(m, e.args, sc)); }
      if(this.funcs[n]){ var cand = this.funcs[n], args = argv(), fn = cand.filter(function(x){ return x.params.length === args.length && x.body; })[0] || cand.filter(function(x){ return x.body && x.params.length >= args.length; })[0] || cand.filter(function(x){ return x.body; })[0]; if(!fn) throw CfErr('У функции «' + n + '» нет тела', f.line); return this.callFunc(fn, args, null, null, this.argRefs(fn, e.args, sc)); }
      if(this.types[n]) return this.constructType({ name:n, args:f.targs || [] }, argv(), null, sc);
      if(f.targs || /^(vector|string|pair|map|set|list|deque|unordered_map|unordered_set|stringstream|istringstream|ostringstream)$/.test(n) || /Exception$|^(runtime_error|invalid_argument|logic_error|exception|out_of_range|domain_error|overflow_error|range_error|length_error)$/.test(n)){ var bn = this.builtinNew({ name:n, args:f.targs || [] }, argv(), null, sc); if(bn !== undefined) return bn; }
      return this.builtinCall(n, argv(), f, sc, e);
    }
    if(f.k === 'member'){
      if(f.o.k === 'id' && (f.o.n === 'std' )) return this.builtinCall(f.n, argv(), f, sc, e);
      var o = this.eval(f.o, sc);
      if(o == null && f.opt) return null;
      if(Array.isArray(o) && /^(emplace_back|emplace|push_back|Add)$/.test(f.n) && e.args.length > 1 && f.n !== 'emplace' && elemT){ o.push(this.constructType(elemT, argv(), null, sc)); return undefined; }
      if(Array.isArray(o) && f.n === 'emplace_back' && e.args.length > 1){ var ea = argv(); o.push(ea.length === 2 ? new CfPair(ea[0], ea[1]) : ea); return undefined; }
      return this.method(o, f.n, argv(), f, sc, e);
    }
    var fv = this.eval(f, sc);
    return this.callFn(fv, argv());
  };
  VM.pickOver = function(td, n, cnt){ var ol = td.overloads && td.overloads[n]; if(!ol) return td.methods[n]; return ol.filter(function(m){ return m.params.length === cnt; })[0] || td.methods[n]; };
  VM.less = function(a, b){ if(a && a.__t && this.types[a.__t]){ var ov = this.findOp(a.__t, '<', 2); if(ov) return this.truthy(this.binop('<', a, b, { l:{}, r:{} }, null)); } if(a instanceof CfPair && b instanceof CfPair) return this.less(a.first, b.first) || (!this.less(b.first, a.first) && this.less(a.second, b.second)); return a < b; };
  VM.sortCmp = function(cmp){ var vm = this; if(!cmp) return function(a, b){ return vm.less(a, b) ? -1 : (vm.less(b, a) ? 1 : 0); }; return function(a, b){ var r = vm.callFn(cmp, [a, b]); if(typeof r === 'boolean') return r ? -1 : (vm.callFn(cmp, [b, a]) ? 1 : 0); return r; }; };
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
      case 'make_pair': return new CfPair(a[0], a[1]);
      case 'make_tuple': var mt = []; a.forEach(function(x){ mt.push(x); }); return mt;
      case 'printf': var fmt = String(a[0]), ai = 1; this.ostream().write(fmt.replace(/%[-+ 0#]*\d*(?:\.(\d+))?[dioufFeEgGsc%]/g, function(m, prec){ if(m === '%%') return '%'; var v = a[ai++]; if(/[fFeEgG]$/.test(m)) return Number(v).toFixed(prec !== undefined ? +prec : 6); return vm.str(v); })); return 0;
      case 'setprecision': case 'setw': case 'setfill': return { __manip:n, n:a[0] };
      case 'toupper': case 'tolower': var ch0 = typeof a[0] === 'number' ? String.fromCharCode(a[0]) : String(a[0]); return n === 'toupper' ? ch0.toUpperCase() : ch0.toLowerCase();
      case 'isdigit': case 'isalpha': case 'isspace': case 'isupper': case 'islower': case 'isalnum': case 'ispunct': var c1 = typeof a[0] === 'number' ? String.fromCharCode(a[0]) : String(a[0]); return ({ isdigit:/^[0-9]$/, isalpha:/^[A-Za-zА-Яа-яЁё]$/, isspace:/^\s$/, isupper:/^[A-ZА-ЯЁ]$/, islower:/^[a-zа-яё]$/, isalnum:/^[0-9A-Za-zА-Яа-яЁё]$/, ispunct:/^[!-\/:-@\[-`{-~]$/ })[n].test(c1);
      case 'iota': for(var io = a[0].i, iv = a[2]; io < a[1].i; io++) a[0].arr[io] = iv++; return undefined;
      case 'fill': for(var fl = a[0].i; fl < a[1].i; fl++) a[0].arr[fl] = cfClone(a[2]); return undefined;
      case 'transform': var src0 = a[0], out0 = a[2], fnT = a[3]; for(var ti = src0.i; ti < a[1].i; ti++){ var tv = this.callFn(fnT, [src0.arr[ti]]); if(out0.back) out0.arr.push(tv); else out0.arr[out0.i + ti - src0.i] = tv; } return undefined;
      case 'back_inserter': return { arr:a[0], i:a[0].length, back:true };
      case 'unique': var ua = a[0].arr, w = a[0].i; for(var ui = a[0].i; ui < a[1].i; ui++){ if(ui === a[0].i || !this.eq(ua[ui], ua[w - 1])) ua[w++] = ua[ui]; } return new CfIter(ua, w);
      case 'lower_bound': case 'upper_bound': var lb = a[0].i; while(lb < a[1].i && (n === 'lower_bound' ? a[0].arr[lb] < a[2] : a[0].arr[lb] <= a[2])) lb++; return new CfIter(a[0].arr, lb);
      case 'binary_search': return a[0].arr.slice(a[0].i, a[1].i).indexOf(a[2]) >= 0;
      case 'gcd': var g1 = Math.abs(a[0]), g2 = Math.abs(a[1]); while(g2){ var gt = g2; g2 = g1 % g2; g1 = gt; } return g1;
      case 'lcm': var l1 = Math.abs(a[0]), l2 = Math.abs(a[1]), lg = l1, lh = l2; while(lh){ var lt = lh; lh = lg % lh; lg = lt; } return lg ? l1 / lg * l2 : 0;
      case 'fmod': return a[0] % a[1]; case 'cbrt': return Math.cbrt(a[0]); case 'asin': return Math.asin(a[0]); case 'acos': return Math.acos(a[0]); case 'atan': return Math.atan(a[0]); case 'log2': return Math.log2(a[0]);
      case 'move': case 'ref': case 'cref': case 'forward': return a[0];
      case 'tie': var tieRefs = e.args.map(function(x){ return vm.ref(x, sc); }); return { __tie:tieRefs };
      case 'get': if(f.targs && f.targs[0] && f.targs[0].name === '#') {} return a[0];
      case 'to_upper': return String(a[0]).toUpperCase();
      case 'rand': return Math.floor(Math.random() * 32768); case 'srand': case 'time': return 0;
      case 'getline': var gs0 = a[0]; if(!gs0 || gs0.__t !== 'sstream' || gs0.pos >= gs0.buf.length){ if(gs0) gs0.fail = true; return gs0 || false; } var dl = a[2] !== undefined ? String(a[2]) : '\n', ix = gs0.buf.indexOf(dl, gs0.pos), piece = ix < 0 ? gs0.buf.slice(gs0.pos) : gs0.buf.slice(gs0.pos, ix); gs0.pos = ix < 0 ? gs0.buf.length : ix + dl.length; this.ref(e.args[1], sc).set(piece); return gs0;
      case 'char': return typeof a[0] === 'string' ? a[0] : String.fromCharCode(Math.trunc(this.num(a[0])));
      case 'int': case 'long': case 'short': case 'size_t': case 'unsigned': return Math.trunc(this.num(a[0]));
      case 'double': case 'float': return this.num(a[0]);
      case 'bool': return this.truthy(a[0]);
      case 'isnan': return isNaN(a[0]);
      case 'nameof': return f.n;
    }
    throw CfErr('Неизвестная функция «' + n + '»', f.line);
  };
  // методы стандартных типов: строки, массивы и списки (с LINQ), словари, статические классы
  VM.method = function(o, n, a, f, sc, e){
    var vm = this, fn = function(x){ return function(){ return vm.callFn(x, Array.prototype.slice.call(arguments)); }; };
    if(o && o.__base){ var bm = o.__base.methods[n]; if(!bm || !bm.body) throw CfErr('У базового класса нет метода «' + n + '»', f.line); return this.callFunc(bm, a, o.self, o.__base); }
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
    if(this.ext[n] && !(o && o.__t && this.types[o.__t] && this.types[o.__t].methods[n])){ var X = this.ext[n]; return this.callFunc(X.f, [o].concat(a), null, X.td); }
    if(n === 'get' && f.targs && f.targs[0] && !this.cs){ var T0 = f.targs[0].name; if(/^(double|float|int|long|size_t|unsigned)/.test(T0)) return typeof o === 'number' ? (this.isIntType(f.targs[0]) ? Math.trunc(o) : o) : (parseFloat(String(o).replace(',', '.')) || 0); if(T0 === 'string') return o == null ? '' : String(o); if(T0 === 'bool') return !!o; return o; }
    if(o && o.__exc && (n === 'what' || n === 'GetMessage')) return o.Message;
    if(o && o.__exc && n === 'ToString') return this.str(o);
    if(o && o.__t === 'ostream' && n === 'flush') return o;
    if(this.io.method){ var ir = this.io.method(o, n, a, this, f); if(ir !== undefined) return ir === CF_VOID ? undefined : ir; }
    if(typeof o === 'string') return this.strMethod(o, n, a, f);
    if(typeof o === 'number'){ if(n === 'ToString') return this.str(o, a[0]); if(n === 'CompareTo') return o < a[0] ? -1 : (o > a[0] ? 1 : 0); if(n === 'Equals') return o === a[0]; }
    if(o instanceof Date) return this.dateMethod(o, n, a, f);
    if(o instanceof CfIter){ if(n === 'base') return o.i; }
    if(o && o.__t === 'sstream'){ if(n === 'str'){ if(a.length){ o.buf = String(a[0]); o.pos = 0; o.fail = false; return CF_VOID; } return o.buf; } if(n === 'clear'){ o.fail = false; return CF_VOID; } if(n === 'eof') return o.pos >= o.buf.length; if(n === 'good') return !o.fail; }
    if(o && o.__t === 'StringBuilder'){ if(n === 'Append'){ o.s += this.str(a[0]); return o; } if(n === 'AppendLine'){ o.s += (a.length ? this.str(a[0]) : '') + '\n'; return o; } if(n === 'ToString') return o.s; if(n === 'Clear'){ o.s = ''; return o; } }
    if(o && o.__t === 'Random'){ if(n === 'Next') return a.length === 2 ? a[0] + Math.floor(Math.random() * (a[1] - a[0])) : Math.floor(Math.random() * (a[0] || 2147483647)); if(n === 'NextDouble') return Math.random(); }
    if(o instanceof CfMap) return this.mapMethod(o, n, a, f, sc, e);
    if(Array.isArray(o) || (o && o.__group)) return this.listMethod(o.__group ? o.items : o, n, a, f, sc, e, fn);
    if(o && typeof o === 'object' && !Array.isArray(o) && !(o instanceof CfMap) && !this.cs){ if(n === 'contains' || n === 'count') return cfFindKey(o, a[0]) !== null ? (n === 'count' ? 1 : true) : (n === 'count' ? 0 : false); if(n === 'is_object') return true; if(n === 'size') return Object.keys(o).length; if(n === 'value') { var kk = cfFindKey(o, a[0]); return kk !== null ? o[kk] : a[1]; } }
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
      case 'c_str': case 'str': case 'ToString': return s;
      case 'Trim': case 'TrimStart': case 'TrimEnd': var chs = a.length ? a.map(function(x){ return Array.isArray(x) ? x.join('') : String(x); }).join('') : null, cls = chs === null ? '\\s' : chs.replace(/[\]\\^-]/g, '\\$&'); var res0 = s; if(n !== 'TrimEnd') res0 = res0.replace(new RegExp('^[' + cls + ']+'), ''); if(n !== 'TrimStart') res0 = res0.replace(new RegExp('[' + cls + ']+$'), ''); return res0;
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
      case 'find': var fl = this.iterable(m), fk = -1; for(var fi = 0; fi < fl.length; fi++) if(this.eq(m.isSet ? fl[fi] : fl[fi].first, a[0])){ fk = fi; break; } return new CfIter(fl, fk < 0 ? fl.length : fk);
      case 'end': case 'cend': return new CfIter(this.iterable(m), m.m.size);
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
      case 'pop_back': arr.pop(); return CF_VOID; case 'Pop': return arr.pop(); case 'Dequeue': return arr.shift(); case 'Peek': return arr.__kind === 'queue' ? arr[0] : arr[arr.length - 1];
      case 'pop': if(arr.__kind === 'queue') arr.shift(); else if(arr.__kind === 'pq'){ var mi = 0; for(var pi = 1; pi < arr.length; pi++) if(arr[pi] > arr[mi]) mi = pi; arr.splice(mi, 1); } else arr.pop(); return CF_VOID;
      case 'top': if(arr.__kind === 'pq') return arr.reduce(function(m, x){ return x > m ? x : m; }); return arr[arr.length - 1];
      case 'pop_front': arr.shift(); return CF_VOID; case 'push_front': case 'AddFirst': arr.unshift(a[0]); return CF_VOID; case 'AddLast': arr.push(a[0]); return CF_VOID;
      case 'TryDequeue': case 'TryPop': case 'TryPeek': var tq = arr.length ? (n === 'TryDequeue' ? arr.shift() : (n === 'TryPop' ? arr.pop() : (arr.__kind === 'queue' ? arr[0] : arr[arr.length - 1]))) : undefined; if(e.args[0] && e.args[0].k === 'out'){ var tsl = this.lookup(sc, e.args[0].n); if(!tsl){ sc.vars.set(e.args[0].n, { v:undefined }); tsl = sc.vars.get(e.args[0].n); } tsl.v = tq; } return tq !== undefined;
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
  VM.fmtArgs = function(a){ if(a.length > 1 && typeof a[0] === 'string' && /\{\d/.test(a[0])){ var vm = this; return a[0].replace(/\{\{/g, '\u0001').replace(/\}\}/g, '\u0002').replace(/\{(\d+)(?:,\s*(-?\d+))?(?::([^}]+))?\}/g, function(m, i, al, fmt){ return cfAlign(vm.str(a[+i + 1], fmt), al === undefined ? null : +al); }).replace(/\u0001/g, '{').replace(/\u0002/g, '}'); } return this.str(a[0]); };
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
      if(td && td.k === 'enum' && n in td.vals) return this.enumVal(td, n);
      if(this.statics[o.__type] && n in this.statics[o.__type]) return this.statics[o.__type][n];
      if(td && td.methods && td.methods[n]) return { __fn2:true, td:td, n:n };
      if(this.io.staticMember){ var sm = this.io.staticMember(o.__type, n, this); if(sm !== undefined) return sm; }
      return { __type:o.__type + '.' + n };
    }
    if(o.__t === 'limits'){ return { __static:'limits' }; }
    if(o instanceof CfIter) return this.getMember(o.arr[o.i], n, e, sc);
    if(o instanceof CfEnum){ if(n === 'name') return o.name; }
    if(Array.isArray(o)){ if(n === 'Count' || n === 'Length' || n === 'size') return o.length; }
    if(typeof o === 'string'){ if(n === 'Length' || n === 'length') return o.length; }
    if(o instanceof CfMap){ if(n === 'Count') return o.m.size; if(n === 'Keys') return o.pairs().map(function(p){ return p.k; }); if(n === 'Values') return o.pairs().map(function(p){ return p.v; }); }
    if(o instanceof Date){ var D = { Year:o.getFullYear(), Month:o.getMonth() + 1, Day:o.getDate(), Hour:o.getHours(), Minute:o.getMinutes(), DayOfWeek:o.getDay(), DayOfYear:Math.floor((o - new Date(o.getFullYear(), 0, 0)) / 864e5) }; if(n in D) return D[n]; if(n === 'Date'){ var c = new Date(+o); c.setHours(0, 0, 0, 0); return c; } }
    if(o.__group){ if(n === 'Key') return o.Key; if(n === 'Count') return o.items.length; }
    if(o.__exc){ if(n === 'Message') return o.Message; if(n === 'InnerException') return o.InnerException || null; if(n === 'StackTrace') return ''; }
    if(o.__t && this.types[o.__t]){ var g = this.findGetter(this.types[o.__t], n); if(g) return this.runGetter(g, o, this.types[o.__t]); }
    if(this.io.member){ var r = this.io.member(o, n, this); if(r !== undefined) return r; }
    if(n in o) return o[n];
    // поля строк данных: регистр и синонимы
    var k = cfFindKey(o, n); if(k !== null) return o[k];
    if(o.__t) throw CfErr('У «' + o.__t + '» нет поля «' + n + '»', e && e.line);
    return undefined;
  };
  function cfClone(v){ if(Array.isArray(v)) return v.map(cfClone); if(v instanceof CfMap){ var m = new CfMap(); m.sorted = v.sorted; v.pairs().forEach(function(p){ m.set(p.k, cfClone(p.v)); }); return m; } if(v instanceof CfObj){ var o = new CfObj(v.__t); for(var k in v) o[k] = cfClone(v[k]); return o; } return v; }
  function cfFindKey(o, n){ if(!o || typeof o !== 'object') return null; var lo = String(n).toLowerCase().replace(/_/g, ''); for(var k in o){ if(String(k).toLowerCase().replace(/[_\s]/g, '') === lo) return k; } var syn = typeof fieldSyn === 'function' ? fieldSyn(n) : []; for(var i = 0; i < syn.length; i++){ for(var k2 in o){ if(String(k2).toLowerCase() === syn[i]) return k2; } } return null; }
  function cfToJson(v, depth){
    depth = depth || 0; if(depth > 30) return null;
    if(v === undefined || v === null) return null;
    if(typeof v === 'number') return isFinite(v) ? Math.round(v * 1e10) / 1e10 : null;
    if(typeof v !== 'object') return v;
    if(v instanceof Date) return v.toLocaleDateString('ru-RU');
    if(Array.isArray(v)) return v.map(function(x){ return cfToJson(x, depth + 1); });
    if(v instanceof CfMap && v.isSet) return v.pairs().map(function(p){ return cfToJson(p.k, depth + 1); });
    if(v instanceof CfMap){ var o = {}; v.pairs().forEach(function(p){ o[String(p.k)] = cfToJson(p.v, depth + 1); }); return o; }
    if(v.__group) return { Key:cfToJson(v.Key, depth + 1), Items:cfToJson(v.items, depth + 1) };
    if(v.__lambda || v.__static || v.__type) return null;
    if(v instanceof CfEnum) return v.name;
    if(v instanceof CfIter) return cfToJson(v.arr[v.i], depth + 1);
    if(v.__t === 'StringBuilder') return v.s;
    if(v instanceof CfPair) return v.__cs ? { Key:cfToJson(v.first, depth + 1), Value:cfToJson(v.second, depth + 1) } : { first:cfToJson(v.first, depth + 1), second:cfToJson(v.second, depth + 1) };
    var r = {}; for(var k in v){ if(k === '__t') continue; r[k] = cfToJson(v[k], depth + 1); } return r;
  }
