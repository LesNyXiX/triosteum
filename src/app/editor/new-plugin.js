  /* ---------- создание собственного плагина ---------- */
  var newLang = S.lang;
  function renderNewLangs(){
    el.newLangs.innerHTML = '';
    LANGS.forEach(function(l){
      var on = l.id === newLang;
      el.newLangs.appendChild(h('button', { type:'button', 'class':'lchip' + (on ? ' on' : ''), role:'radio', 'aria-checked':on ? 'true' : 'false',
        on:{ click:function(){ newLang = l.id; renderNewLangs(); } } }, [
        h('span', { 'class':'lt' }, [ h('i', { style:'background:' + grad(COLORS[l.id]) }), h('span', { text:shortName(l) }) ]),
        h('span', { 'class':'sub' + (l.real ? ' ok' : ''), text:isDocs() && !IDE[l.id] ? l.tool.split(':')[0].split(',')[0] : (l.real ? 'запуск в браузере' : 'на сервере') }),
        IDE[l.id] || !isDocs() ? (function(){ var p = ideFor(l.id), sw = h('span', { 'class':'ide-chip', title:'Среда написания кода: ' + p.ide + ' · ' + p.theme }); sw.style.background = p.bg; sw.style.color = p.fg; sw.style.borderColor = p.border; sw.innerHTML = '<i style="background:' + (p.c.kw || p.fg) + '"></i><i style="background:' + (p.c.str || p.fg) + '"></i><i style="background:' + (p.c.fn || p.c.com || p.fg) + '"></i><span>' + escHtml(p.ide) + '</span>'; return sw; })() : null
      ].filter(Boolean)));
    });
  }
  function openCreate(){
    newLang = S.lang; el.newName.value = ''; el.newDesc.value = '';
    renderNewLangs(); el.modal.hidden = false; hidePop();
    setTimeout(function(){ el.newName.focus(); }, 0);
  }
  function closeCreate(){ el.modal.hidden = true; }
  $('newCancel').addEventListener('click', closeCreate);
  el.modal.addEventListener('click', function(e){ if(e.target === el.modal) closeCreate(); });
  el.modal.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeCreate(); });
  el.form.addEventListener('submit', function(e){
    e.preventDefault();
    var name = el.newName.value.trim();
    if(!name){ el.newName.focus(); return; }
    var p = { id:'my-' + Date.now(), my:true, name:name, lang:newLang, desc:el.newDesc.value.trim(), family:null, codes:{} };
    MY.unshift(p); saveMy(); S.lang = newLang; save('triosteum.lang.' + ENV.id, newLang);
    closeCreate(); renderChips(); renderList();
    openPlugin(p.id);
    toast('Плагин «' + name + '» создан и сохранён в «Мои плагины»');
  });
