  /* =====================================================================
     ОФОРМЛЕНИЕ КОДА ПОД ЯЗЫК: у каждого языка — своя среда, как в
     оригинальных программах (PyCharm для Python, Visual Studio для C++ и C#,
     VS Code для HTML/JavaScript/JSON, Конфигуратор для 1С) и подсветка
     команд в их цветах. Применяется автоматически по языку блока/плагина.
     ===================================================================== */
  var IDE = {
    python:{ short:'PyCharm', ide:'PyCharm', theme:'Darcula', ext:'py', font:"'JetBrains Mono', Consolas, monospace", bg:'#2B2B2B', fg:'#A9B7C6', gutBg:'#313335', gutFg:'#606366', line:'#323232', sel:'#214283', caret:'#BBBBBB', border:'#3C3F41', bar:'#3C3F41', barFg:'#BBBBBB',
      c:{ kw:'#CC7832', ctl:'#CC7832', type:'#A9B7C6', fn:'#FFC66D', call:'#A9B7C6', str:'#6A8759', num:'#6897BB', com:'#808080', doc:'#629755', deco:'#BBB529', bi:'#8888C6', self:'#94558D', op:'#A9B7C6', const:'#9876AA', param:'#AA4926', esc:'#CC7832' } },
    cpp:{ short:'VS 2022', ide:'Visual Studio', theme:'Тёмная', ext:'cpp', font:"'Cascadia Mono', Consolas, 'JetBrains Mono', monospace", bg:'#1E1E1E', fg:'#DCDCDC', gutBg:'#1E1E1E', gutFg:'#2B91AF', line:'#262626', sel:'#264F78', caret:'#DCDCDC', border:'#3F3F46', bar:'#2D2D30', barFg:'#F1F1F1',
      c:{ kw:'#569CD6', ctl:'#D8A0DF', type:'#4EC9B0', fn:'#DCDCAA', call:'#DCDCAA', str:'#D69D85', num:'#B5CEA8', com:'#57A64A', doc:'#57A64A', deco:'#BEB7FF', bi:'#4EC9B0', self:'#569CD6', op:'#B4B4B4', const:'#BEB7FF', pre:'#9B9B9B', inc:'#E8C9BB', esc:'#FFD68F' } },
    csharp:{ short:'VS 2022', ide:'Visual Studio', theme:'Тёмная', ext:'cs', font:"'Cascadia Mono', Consolas, 'JetBrains Mono', monospace", bg:'#1E1E1E', fg:'#DCDCDC', gutBg:'#1E1E1E', gutFg:'#2B91AF', line:'#262626', sel:'#264F78', caret:'#DCDCDC', border:'#3F3F46', bar:'#2D2D30', barFg:'#F1F1F1',
      c:{ kw:'#569CD6', ctl:'#D8A0DF', type:'#4EC9B0', fn:'#DCDCAA', call:'#DCDCAA', str:'#D69D85', num:'#B5CEA8', com:'#57A64A', doc:'#608B4E', deco:'#4EC9B0', bi:'#4EC9B0', self:'#569CD6', op:'#B4B4B4', const:'#B8D7A3', pre:'#9B9B9B', esc:'#FFD68F', interp:'#DCDCDC' } },
    html:{ ide:'VS Code', theme:'Dark+', ext:'html', font:"Menlo, Consolas, 'JetBrains Mono', monospace", bg:'#1E1E1E', fg:'#D4D4D4', gutBg:'#1E1E1E', gutFg:'#858585', line:'#282828', sel:'#264F78', caret:'#AEAFAD', border:'#2B2B2B', bar:'#252526', barFg:'#CCCCCC',
      c:{ tag:'#569CD6', attr:'#9CDCFE', aval:'#CE9178', punct:'#808080', com:'#6A9955', ent:'#569CD6', kw:'#569CD6', ctl:'#C586C0', type:'#4EC9B0', fn:'#DCDCAA', call:'#DCDCAA', str:'#CE9178', num:'#B5CEA8', bi:'#4EC9B0', self:'#569CD6', op:'#D4D4D4', var:'#9CDCFE', prop:'#9CDCFE', cssval:'#CE9178', sel:'#D7BA7D', const:'#4FC1FF' } },
    js:{ ide:'VS Code', theme:'Dark+', ext:'js', font:"Menlo, Consolas, 'JetBrains Mono', monospace", bg:'#1E1E1E', fg:'#D4D4D4', gutBg:'#1E1E1E', gutFg:'#858585', line:'#282828', sel:'#264F78', caret:'#AEAFAD', border:'#2B2B2B', bar:'#252526', barFg:'#CCCCCC',
      c:{ kw:'#569CD6', ctl:'#C586C0', type:'#4EC9B0', fn:'#DCDCAA', call:'#DCDCAA', str:'#CE9178', num:'#B5CEA8', com:'#6A9955', bi:'#4EC9B0', self:'#569CD6', op:'#D4D4D4', var:'#9CDCFE', const:'#4FC1FF' } },
    json:{ ide:'VS Code', theme:'Dark+', ext:'json', font:"Menlo, Consolas, 'JetBrains Mono', monospace", bg:'#1E1E1E', fg:'#D4D4D4', gutBg:'#1E1E1E', gutFg:'#858585', line:'#282828', sel:'#264F78', caret:'#AEAFAD', border:'#2B2B2B', bar:'#252526', barFg:'#CCCCCC',
      c:{ key:'#9CDCFE', str:'#CE9178', num:'#B5CEA8', kw:'#569CD6', punct:'#D4D4D4' } },
    '1c':{ short:'Конфигуратор', ide:'Конфигуратор 1С', theme:'Классическая', ext:'bsl', font:"'Courier New', Consolas, monospace", bg:'#FFFFFF', fg:'#0000FF', gutBg:'#F7F7F7', gutFg:'#9A9A9A', line:'#FFFFE0', sel:'#ADD6FF', caret:'#000000', border:'#C8C8C8', bar:'#F0F0F0', barFg:'#1F1F1F', light:true,
      c:{ kw:'#FF0000', ctl:'#FF0000', str:'#000000', num:'#000000', com:'#008000', pre:'#963200', op:'#FF0000', date:'#000000', id:'#0000FF', fn:'#0000FF', qkw:'#FF0000' } }
  };
  function ideFor(lang){ return IDE[lang] || (lang === 'javascript' ? IDE.js : (/^(step|cond|send|sheet)$/.test(lang) || (typeof isParamKind === 'function' && isParamKind(lang)) ? IDE.json : IDE.js)); }
  function hlEsc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function W(list){ var o = {}; list.split(/\s+/).forEach(function(w){ if(w) o[w] = 1; }); return o; }
  var HL = {
    py:{ kw:W('False None True and as assert async await class def del from global import in is lambda nonlocal not or pass'), ctl:W('break continue elif else except finally for if raise return try while with yield'),
      bi:W('abs all any bool dict enumerate filter float format int isinstance len list map max min open print range repr reversed round set sorted str sum tuple type zip super Exception ValueError KeyError TypeError object') },
    cpp:{ kw:W('alignas alignof auto bool char char16_t char32_t class const constexpr const_cast decltype delete double dynamic_cast enum explicit export extern false float friend inline int long mutable namespace new noexcept nullptr operator private protected public register reinterpret_cast short signed sizeof static static_assert static_cast struct template this thread_local true typedef typeid typename union unsigned using virtual void volatile wchar_t'),
      ctl:W('break case catch continue default do else for goto if return switch throw try while co_await co_return'),
      type:W('string vector map unordered_map set unordered_set pair tuple size_t array deque list optional variant function shared_ptr unique_ptr ostream istream int32_t int64_t uint32_t uint64_t Data cout cin endl') },
    cs:{ kw:W('abstract as base bool byte char checked class const decimal delegate double enum event explicit extern false fixed float implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly record ref sbyte sealed short sizeof stackalloc static string struct this true typeof uint ulong unchecked unsafe ushort using var virtual void volatile async get set init value where required'),
      ctl:W('await break case catch continue default do else finally for foreach goto if return switch throw try while yield when'),
      type:W('List Dictionary HashSet IEnumerable Task Console Math String Int32 Double Decimal DateTime TimeSpan Exception Convert StringBuilder HttpClient Data IBlock Secrets Enumerable Linq Block XLWorkbook FormUrlEncodedContent SmtpClient MailMessage NetworkCredential KeyValuePair Tuple Random Guid') },
    js:{ kw:W('var let const function class new this typeof instanceof in of void delete true false null undefined async extends super static get set'), ctl:W('if else for while do return break continue switch case default try catch finally throw await yield'),
      type:W('Math JSON Array Object String Number Date Promise Map Set document window console') },
    bsl:{ kw:W('процедура конецпроцедуры функция конецфункции экспорт перем знач если тогда иначеесли иначе конецесли для каждого из по цикл конеццикла пока прервать продолжить возврат новый и или не истина ложь неопределено null попытка исключение конецпопытки вызватьисключение перейти procedure endprocedure function endfunction export var val if then elsif else endif for each in to do enddo while break continue return new and or not true false undefined try except endtry raise goto'),
      q:W('выбрать различные первые разрешенные как из где сгруппировать по имеющие упорядочить убыв возр поместить объединить все левое правое внутреннее полное соединение выбор когда тогда иначе конец между подобно есть null в итоги значение выразить сумма количество максимум минимум среднее естьnull') }
  };
  // C-подобные языки: C++, C#, JavaScript
  function hlC(src, kind){
    var K = HL[kind], out = [], i = 0, n = src.length, prev = '', user = {}, um, ure = /\b(?:struct|class|record|enum|interface)\s+([A-Za-z_\u0400-\u04FF][\w\u0400-\u04FF]*)/g;
    while((um = ure.exec(src))) user[um[1]] = 1;
    function put(c, t){ out.push(c ? '<span class="h-' + c + '">' + hlEsc(t) + '</span>' : hlEsc(t)); if(t.trim()) prev = t; }
    while(i < n){
      var ch = src[i], rest = src.slice(i), m;
      if(ch === '/' && src[i + 1] === '/'){ var e = src.indexOf('\n', i); if(e < 0) e = n; var cmt = src.slice(i, e); put(kind === 'cs' && /^\/\/\//.test(cmt) ? 'doc' : 'com', cmt); i = e; continue; }
      if(ch === '/' && src[i + 1] === '*'){ var e2 = src.indexOf('*/', i + 2); e2 = e2 < 0 ? n : e2 + 2; put('com', src.slice(i, e2)); i = e2; continue; }
      if(kind === 'cpp' && ch === '#' && /(^|\n)[ \t]*$/.test(src.slice(Math.max(0, i - 40), i))){
        var e3 = src.indexOf('\n', i); if(e3 < 0) e3 = n; var line = src.slice(i, e3), mm = /^(#\s*\w+)(\s*)(.*)$/.exec(line);
        if(mm){ put('pre', mm[1]); put('', mm[2]); if(/^#\s*include/.test(mm[1])) put('inc', mm[3]); else out.push(hlC(mm[3], kind)); } else put('pre', line);
        i = e3; continue;
      }
      if(kind === 'cs' && ch === '#' && /(^|\n)[ \t]*$/.test(src.slice(Math.max(0, i - 40), i))){ var e4 = src.indexOf('\n', i); if(e4 < 0) e4 = n; put('pre', src.slice(i, e4)); i = e4; continue; }
      if(kind === 'cs' && (m = /^\$@?"|^@\$?"/.exec(rest))){
        // интерполированная строка: выражения в {} подсвечиваются как код
        var j = i + m[0].length, buf = m[0], verb = m[0].indexOf('@') >= 0, interp = m[0].indexOf('$') >= 0;
        while(j < n){
          var c2 = src[j];
          if(c2 === '"'){ if(verb && src[j + 1] === '"'){ buf += '""'; j += 2; continue; } buf += '"'; j++; break; }
          if(!verb && c2 === '\\'){ buf += src.substr(j, 2); j += 2; continue; }
          if(interp && c2 === '{' && src[j + 1] !== '{'){ put('str', buf); buf = ''; var d = 1, k = j + 1; while(k < n && d){ if(src[k] === '{') d++; else if(src[k] === '}') d--; if(d) k++; } put('esc', '{'); out.push(hlC(src.slice(j + 1, k), kind)); put('esc', '}'); j = k + 1; continue; }
          if(c2 === '\n' && !verb) break;
          buf += c2; j++;
        }
        put('str', buf); i = j; continue;
      }
      if(kind === 'cs' && ch === '@' && src[i + 1] === '"'){ var j2 = i + 2; while(j2 < n && !(src[j2] === '"' && src[j2 + 1] !== '"')){ if(src[j2] === '"') j2++; j2++; } put('str', src.slice(i, j2 + 1)); i = j2 + 1; continue; }
      if(ch === '"' || ch === "'" || (kind === 'js' && ch === '`')){
        var q = ch, j3 = i + 1, s = q;
        while(j3 < n && src[j3] !== q && (src[j3] !== '\n' || q === '`')){ if(src[j3] === '\\'){ if(s.length) put('str', s); s = ''; put('esc', src.substr(j3, 2)); j3 += 2; continue; } s += src[j3++]; }
        s += j3 < n ? src[j3] : ''; put('str', s); i = j3 + 1; continue;
      }
      if((m = /^(0[xX][0-9a-fA-F']+|\d[\d']*(\.\d+)?([eE][+-]?\d+)?[fFdDmMuUlL]*|\.\d+[fFdDmM]?)/.exec(rest)) && !/[\w$]/.test(src[i - 1] || '')){ put('num', m[0]); i += m[0].length; continue; }
      if((m = /^[A-Za-z_Ѐ-ӿ$][\wЀ-ӿ$]*/.exec(rest))){
        var w = m[0], after = src.slice(i + w.length), nx = /^\s*(<[^<>()]*>)?\s*\(/.test(after);
        var cls = K.ctl[w] ? 'ctl' : K.kw[w] ? 'kw' : (w === 'this' || w === 'self') ? 'self' : null;
        var lineStart = src.lastIndexOf('\n', i - 1) + 1, curLine = src.slice(lineStart, (src.indexOf('\n', i) + 1 || n + 1) - 1);
        if(!cls && kind === 'cs' && /^\s*(using|namespace)\s+[\w.]+\s*[;{]?\s*$/.test(curLine)){ put('', w); i += w.length; continue; }
        if(!cls){
          if(K.type[w] || user[w]) cls = 'type';
          else if(kind === 'cpp' && /^[A-Z_][A-Z0-9_]{2,}$/.test(w)) cls = 'const';
          else if(/^(class|struct|record|enum|interface|new|namespace)$/.test(prev) && /^[A-ZА-Я]/.test(w)) cls = 'type';
          else if(nx) cls = (/^(class|struct|new)$/.test(prev) || (kind !== 'js' && /^[A-Z]/.test(w) && prev === 'new')) ? 'type' : 'fn';
          else if(kind === 'cpp' && /^[A-Z_][A-Z0-9_]{2,}$/.test(w)) cls = 'const';
          else if(kind === 'cs' && /^[A-Z]/.test(w) && /^\s*[<\w]/.test(after) && !/^\s*(=|\.|\)|;|,)/.test(after)) cls = 'type';
          else if(kind === 'cs' && /^[A-Z]/.test(w) && (/^\s*\./.test(after) || /^\s*>/.test(after))) cls = 'type';
          else if(kind === 'js') cls = 'var';
        }
        put(cls, w); i += w.length; continue;
      }
      if(kind === 'cs' && ch === '[' && /(^|\n)[ \t]*$/.test(src.slice(Math.max(0, i - 40), i))){
        var e5 = src.indexOf(']', i); if(e5 > 0 && src.slice(i, e5).indexOf('\n') < 0){ put('op', '['); var inner = src.slice(i + 1, e5), am = /^(\w+)([\s\S]*)$/.exec(inner); if(am){ put('type', am[1]); out.push(hlC(am[2], kind)); } else out.push(hlC(inner, kind)); put('op', ']'); i = e5 + 1; continue; }
      }
      if(/[+\-*\/%=&|<>!?:^~]/.test(ch)){ var om = /^(<<=|>>=|=>|->|::|\+\+|--|<<|>>|<=|>=|==|!=|&&|\|\||\+=|-=|\*=|\/=|\?\?|[+\-*\/%=&|<>!?:^~])/.exec(rest); put('op', om[0]); i += om[0].length; continue; }
      put('', ch); i++;
    }
    return out.join('');
  }
  function hlPy(src){
    var K = HL.py, out = [], i = 0, n = src.length, prev = '';
    function put(c, t){ out.push(c ? '<span class="h-' + c + '">' + hlEsc(t) + '</span>' : hlEsc(t)); if(t.trim()) prev = t; }
    while(i < n){
      var ch = src[i], rest = src.slice(i), m;
      if(ch === '#'){ var e = src.indexOf('\n', i); if(e < 0) e = n; put('com', src.slice(i, e)); i = e; continue; }
      if((m = /^([rRbBuUfF]{0,2})("""|''')/.exec(rest))){ var q3 = m[2], e2 = src.indexOf(q3, i + m[0].length); e2 = e2 < 0 ? n : e2 + 3; put(/^\s*$/.test(src.slice(src.lastIndexOf('\n', i - 1) + 1, i)) && /:\s*$/.test(src.slice(0, i).replace(/\s+$/, '').split('\n').slice(-1)[0] || '') ? 'doc' : 'str', src.slice(i, e2)); i = e2; continue; }
      if((m = /^([rRbBuUfF]{0,2})(["'])/.exec(rest))){
        var q = m[2], j = i + m[0].length, f = /[fF]/.test(m[1]), s = m[0];
        while(j < n && src[j] !== q && src[j] !== '\n'){
          if(src[j] === '\\'){ put('str', s); s = ''; put('esc', src.substr(j, 2)); j += 2; continue; }
          if(f && src[j] === '{' && src[j + 1] !== '{'){ put('str', s); s = ''; var k = src.indexOf('}', j); if(k < 0) k = n; put('esc', '{'); out.push(hlPy(src.slice(j + 1, k))); put('esc', '}'); j = k + 1; continue; }
          s += src[j++];
        }
        s += j < n && src[j] === q ? q : ''; put('str', s); i = j + 1; continue;
      }
      if(ch === '@' && /(^|\n)[ \t]*$/.test(src.slice(Math.max(0, i - 40), i))){ var dm = /^@[\w.]+/.exec(rest); put('deco', dm[0]); i += dm[0].length; continue; }
      if((m = /^(0[xXoObB][\da-fA-F_]+|\d[\d_]*(\.\d*)?([eE][+-]?\d+)?j?|\.\d+)/.exec(rest)) && !/\w/.test(src[i - 1] || '')){ put('num', m[0]); i += m[0].length; continue; }
      if((m = /^[A-Za-z_Ѐ-ӿ][\wЀ-ӿ]*/.exec(rest))){
        var w = m[0], after = src.slice(i + w.length), cls = K.ctl[w] ? 'kw' : K.kw[w] ? 'kw' : null;
        if(!cls){
          if(prev === 'def') cls = 'fn';
          else if(prev === 'class') cls = 'type';
          else if(w === 'self' || w === 'cls') cls = 'self';
          else if(K.bi[w] && /^\s*\(/.test(after)) cls = 'bi';
          else if(/^__\w+__$/.test(w)) cls = 'const';
          else if(/^\s*=[^=]/.test(after) && /\(\s*$|,\s*$/.test(src.slice(Math.max(0, i - 60), i)) && src.slice(0, i).split('(').length > src.slice(0, i).split(')').length) cls = 'param';
        }
        put(cls, w); i += w.length; continue;
      }
      put('', ch); i++;
    }
    return out.join('');
  }
  function hlHtml(src){
    var out = [], i = 0, n = src.length;
    function put(c, t){ out.push(c ? '<span class="h-' + c + '">' + hlEsc(t) + '</span>' : hlEsc(t)); }
    while(i < n){
      if(src.substr(i, 4) === '<!--'){ var e = src.indexOf('-->', i); e = e < 0 ? n : e + 3; put('com', src.slice(i, e)); i = e; continue; }
      if(src[i] === '<' && /^<\/?[A-Za-z!]/.test(src.slice(i, i + 3))){
        var m = /^(<\/?)([!A-Za-z][\w:-]*)/.exec(src.slice(i)), tag = m[2].toLowerCase();
        put('punct', m[1]); put('tag', m[2]); i += m[0].length;
        while(i < n && src[i] !== '>'){
          var rest = src.slice(i), am;
          if((am = /^\s+/.exec(rest))){ put('', am[0]); i += am[0].length; continue; }
          if((am = /^[^\s=>\/"']+/.exec(rest))){ put('attr', am[0]); i += am[0].length; continue; }
          if(src[i] === '='){ put('punct', '='); i++; continue; }
          if(src[i] === '"' || src[i] === "'"){ var q = src[i], e2 = src.indexOf(q, i + 1); e2 = e2 < 0 ? n : e2 + 1; put('aval', src.slice(i, e2)); i = e2; continue; }
          put('punct', src[i]); i++;
        }
        if(i < n){ put('punct', '>'); i++; }
        if((tag === 'script' || tag === 'style') && m[1] === '<'){
          var close = src.toLowerCase().indexOf('</' + tag, i); if(close < 0) close = n;
          var body = src.slice(i, close); out.push(tag === 'script' ? hlC(body, 'js') : hlCss(body)); i = close;
        }
        continue;
      }
      if(src[i] === '&'){ var em = /^&[#\w]+;/.exec(src.slice(i)); if(em){ put('ent', em[0]); i += em[0].length; continue; } }
      var t = /^[^<&]+/.exec(src.slice(i)); if(t){ put('', t[0]); i += t[0].length; continue; }
      put('', src[i]); i++;
    }
    return out.join('');
  }
  function hlCss(src){
    return hlEsc(src).replace(/(\/\*[\s\S]*?\*\/)|([^{};\n]+)(?=\{)|([\w-]+)(\s*:\s*)([^;{}]+)/g, function(m, c, sel, prop, colon, val){
      if(c) return '<span class="h-com">' + c + '</span>';
      if(sel) return '<span class="h-sel">' + sel + '</span>';
      return '<span class="h-prop">' + prop + '</span>' + colon + '<span class="h-cssval">' + val + '</span>';
    });
  }
  function hlJson(src){
    return hlEsc(src).replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, function(m, s, colon, kw, num){
      if(s) return colon ? '<span class="h-key">' + s + '</span>' + colon : '<span class="h-str">' + s + '</span>';
      if(kw) return '<span class="h-kw">' + kw + '</span>';
      return '<span class="h-num">' + num + '</span>';
    });
  }
  function hlBsl(src){
    var K = HL.bsl, out = [], i = 0, n = src.length;
    function put(c, t){ out.push(c ? '<span class="h-' + c + '">' + hlEsc(t) + '</span>' : hlEsc(t)); }
    while(i < n){
      var ch = src[i], rest = src.slice(i), m;
      if(ch === '/' && src[i + 1] === '/'){ var e = src.indexOf('\n', i); if(e < 0) e = n; put('com', src.slice(i, e)); i = e; continue; }
      if((ch === '#' || ch === '&') && /(^|\n)[ \t]*$/.test(src.slice(Math.max(0, i - 40), i))){ var e2 = src.indexOf('\n', i); if(e2 < 0) e2 = n; put('pre', src.slice(i, e2)); i = e2; continue; }
      if(ch === '"' || (ch === '|' && /(^|\n)[ \t]*$/.test(src.slice(Math.max(0, i - 40), i)))){
        // строки, в том числе многострочные с «|»; внутри — язык запросов
        var j = i + 1, s = ch;
        while(j < n){ if(src[j] === '"'){ if(src[j + 1] === '"'){ s += '""'; j += 2; continue; } s += '"'; j++; break; } if(src[j] === '\n') break; s += src[j++]; }
        out.push('<span class="h-str">' + hlEsc(s).replace(/[A-Za-zА-Яа-яЁё]+/g, function(w){ return K.q[w.toLowerCase().replace(/ё/g, 'е')] ? '<span class="h-qkw">' + w + '</span>' : w; }) + '</span>');
        i = j; continue;
      }
      if(ch === "'"){ var e3 = src.indexOf("'", i + 1); e3 = e3 < 0 ? n : e3 + 1; put('date', src.slice(i, e3)); i = e3; continue; }
      if((m = /^\d+(\.\d+)?/.exec(rest)) && !/[\wА-Яа-яЁё]/.test(src[i - 1] || '')){ put('num', m[0]); i += m[0].length; continue; }
      if((m = /^[A-Za-z_Ѐ-ӿ][\wЀ-ӿ]*/.exec(rest))){ var w = m[0]; put(K.kw[w.toLowerCase().replace(/ё/g, 'е')] ? 'kw' : 'id', w); i += w.length; continue; }
      if(/[+\-*\/%=<>(),;.\[\]?]/.test(ch)){ put('op', ch); i++; continue; }
      put('', ch); i++;
    }
    return out.join('');
  }
  function hlCode(src, lang){
    src = String(src || '');
    if(src.length > 200000) return hlEsc(src);
    try {
      switch(lang){
        case 'python': return hlPy(src);
        case 'cpp': return hlC(src, 'cpp');
        case 'csharp': return hlC(src, 'cs');
        case 'html': return hlHtml(src);
        case '1c': return hlBsl(src);
        case 'js': case 'javascript': return hlC(src, 'js');
      }
      if(/^\s*[\[{]/.test(src)) return hlJson(src);
      return hlEsc(src);
    } catch(e){ return hlEsc(src); }
  }
  // цвета среды — CSS-переменные на контейнере
  // читаемость: цвет текста, который сливается с фоном (контраст ниже 4.5:1 — норма WCAG AA),
  // чуть высветляется (на тёмном) или затемняется (на светлом). Оттенок темы IDE сохраняется.
  function hexRgb(c){ var m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim()); if(!m) return null; var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function relLum(rgb){ return rgb.map(function(v){ v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function(a, v, i){ return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0); }
  function contrastOf(a, b){ var la = relLum(a), lb = relLum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
  function readable(fg, bg, need){
    var f = hexRgb(fg), b = hexRgb(bg); if(!f || !b) return fg;
    need = need || 4.5;
    if(contrastOf(f, b) >= need) return fg;
    var to = relLum(b) < 0.4 ? 255 : 0, c = f;
    for(var t = 0.05; t <= 1.0001 && contrastOf(c, b) < need; t += 0.05) c = f.map(function(v){ return Math.round(v + (to - v) * t); });
    return '#' + c.map(function(v){ return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  function ideVars(lang){
    var p = ideFor(lang), v = { '--ide-bg':p.bg, '--ide-fg':readable(p.fg, p.bg), '--ide-gut-bg':p.gutBg, '--ide-gut-fg':readable(p.gutFg, p.gutBg), '--ide-line':p.line, '--ide-sel':p.sel, '--ide-caret':p.caret, '--ide-border':p.border, '--ide-bar':p.bar, '--ide-bar-fg':readable(p.barFg, p.bar, 7), '--ide-font':p.font };
    for(var k in p.c) v['--h-' + k] = readable(p.c[k], p.bg);
    return v;
  }
  function applyIde(node, lang){
    var v = ideVars(lang), p = ideFor(lang);
    for(var k in v) node.style.setProperty(k, v[k]);
    node.setAttribute('data-ide', lang); node.classList.toggle('ide-light', !!p.light); node.classList.add('ide');
  }
  // блок кода с подсветкой — для окон ИИ, кода схемы и документов
  function hlBlock(pre, code, lang){ pre.innerHTML = hlCode(code, lang); applyIde(pre, lang); pre.classList.add('ide-pre'); return pre; }
  // для документов: цвета прямо в разметке (документ живёт отдельно от приложения)
  function hlInline(code, lang){
    var p = ideFor(lang);
    return '<pre data-lang="' + hlEsc(lang) + '" style="background:' + p.bg + ';color:' + p.fg + ';padding:12px 14px;border-radius:8px;font:13px/1.55 ' + p.font.replace(/"/g, "'") + ';white-space:pre;overflow:auto">' +
      hlCode(code, lang).replace(/<span class="h-([\w-]+)">/g, function(m, c){ return '<span style="color:' + (p.c[c] || p.fg) + (c === 'com' && lang !== '1c' ? ';font-style:italic' : '') + '">'; }) + '</pre>';
  }
  function langOfFence(tag){ tag = String(tag || '').toLowerCase(); return ({ py:'python', python:'python', cpp:'cpp', 'c++':'cpp', cs:'csharp', csharp:'csharp', 'c#':'csharp', html:'html', bsl:'1c', '1c':'1c', '1с':'1c', js:'js', javascript:'js', json:'json' })[tag] || tag; }
