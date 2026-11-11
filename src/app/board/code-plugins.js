  /* ---------- код блоков и плагинов ---------- */
  function tplFor(lang, name){
    var t = langById(lang).tpl;
    if(!name) return t;
    return t.replace('Мой блок', name).replace('новый блок', name).replace('новый виджет', name);
  }
  function pluginCodeFor(p, lang){
    if(p.my) return p.codes[lang] !== undefined ? p.codes[lang] : (lang === p.lang ? tplFor(lang, p.name) : null);
    if(p.lang !== lang) return null;
    if(p.org && (p.code === null || p.code === undefined)) return tplFor(lang, p.name);
    return p.code;
  }
  function hubTpl(lang, name){
    if(lang === 'python') return '# Связующая точка Triosteum: ' + name + '\n' +
      '# Собирает результаты всех входящих блоков в один поток\n' +
      'from triosteum import block\n\n\n' +
      '@block(name="' + name + '", sample=[{"выручка": 184.6}, {"маржа": 21.4}])\n' +
      'def run(inputs):\n' +
      '    if not isinstance(inputs, list):\n' +
      '        inputs = [inputs]\n' +
      '    merged = {}\n' +
      '    for i, item in enumerate(inputs):\n' +
      '        if isinstance(item, dict):\n' +
      '            merged.update(item)\n' +
      '        else:\n' +
      '            merged["вход_" + str(i + 1)] = item\n' +
      '    print("Объединено потоков:", len(inputs))\n' +
      '    return merged\n';
    return tplFor(lang, name).replace(/\/\/ Плагин Triosteum:|# Плагин Triosteum:|<!-- Плагин Triosteum:/, function(m){ return m.replace('Плагин', 'Связующая точка'); });
  }
  function nodeOriginal(n, lang){
    lang = lang || n.lang;
    if(n.kind === 'hub' && !n.pluginId) return hubTpl(lang, n.name);
    if(n.orig && n.orig[lang] !== undefined && n.orig[lang] !== null) return n.orig[lang];
    var v = n.family && VARIANTS[n.family] && VARIANTS[n.family][lang];
    if(v) return v;
    var p = n.pluginId && pluginById(n.pluginId);
    if(p){ var c = pluginCodeFor(p, lang); if(c !== null) return c; }
    return tplFor(lang, n.name);
  }
  function nodeCode(n){
    if(n.src && G.files && typeof ofFile === 'function'){ var sf = ofFile(n.src); if(sf){ var fc = fileAsBlockCode(sf, n.lang); if(fc !== null) return fc; } }
    return n.codes[n.lang] !== undefined ? n.codes[n.lang] : nodeOriginal(n); }
  function variantKind(n, lang){
    if(n.codes[lang] !== undefined) return { t:'ваш код', ok:true };
    if(n.family && VARIANTS[n.family] && VARIANTS[n.family][lang]) return { t:'аналог готов', ok:true };
    var p = n.pluginId && pluginById(n.pluginId);
    if(p && pluginCodeFor(p, lang) !== null) return { t:'оригинал', ok:true };
    return { t:'шаблон', ok:false };
  }

  /* текущий документ редактора: { kind:'node', id } или { kind:'plugin', id } */
  function docNode(){ return S.doc && S.doc.kind === 'node' ? nodeById(S.doc.id) : null; }
  function docPlugin(){ return S.doc && S.doc.kind === 'plugin' ? pluginById(S.doc.id) : null; }
  function cur(){ var n = docNode(), p = docPlugin(); return langById(n ? n.lang : (p ? p.lang : S.lang)); }
  function original(){
    var n = docNode(), p = docPlugin();
    if(n) return nodeOriginal(n);
    if(p) return p.my ? tplFor(p.lang, p.name) : p.code;
    return cur().tpl;
  }
  function getCode(){
    var n = docNode(), p = docPlugin();
    if(n) return nodeCode(n);
    if(p && p.my) return pluginCodeFor(p, p.lang);
    if(p) return S.codes['p:' + p.id] !== undefined ? S.codes['p:' + p.id] : (p.org ? pluginCodeFor(p, p.lang) : p.code);
    return cur().tpl;
  }
  var saveCodeTimer = null;
  function setCode(v){
    var n = docNode(), p = docPlugin();
    if(n){ n.codes[n.lang] = v; saveGraph(); return; }
    if(p && p.my){ p.codes[p.lang] = v; saveMy(); return; }
    if(p){
      S.codes['p:' + p.id] = v;
      el.saved.textContent = 'сохраняется…';
      clearTimeout(saveCodeTimer);
      saveCodeTimer = setTimeout(function(){ save('triosteum.codes', S.codes); el.saved.textContent = 'сохранено'; }, 400);
    }
  }
  function clearCode(){
    var n = docNode(), p = docPlugin();
    if(n){ delete n.codes[n.lang]; saveGraph(); return; }
    if(p && p.my){ delete p.codes[p.lang]; saveMy(); return; }
    if(p){ delete S.codes['p:' + p.id]; save('triosteum.codes', S.codes); }
  }
  function slug(s){ return s.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '_').replace(/^_|_$/g, '') || 'block'; }
  function fileName(){
    var n = docNode(), p = docPlugin(), base = 'plugin';
    if(n) base = slug(n.name);
    else if(p) base = p.my ? slug(p.name) : p.file;
    return base + '.' + cur().ext;
  }
  function docTitle(){ var n = docNode(), p = docPlugin(); return n ? n.name : (p ? p.name : 'Плагин'); }
