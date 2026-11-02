  /* ---------- оформление текста: шрифт, цвет, обводка ---------- */
  var FONTS = [
    { id:'', name:'Inter (стандартный)', css:'Inter, system-ui, sans-serif' },
    { id:'Roboto', name:'Roboto', css:"'Roboto', sans-serif" },
    { id:'Montserrat', name:'Montserrat', css:"'Montserrat', sans-serif" },
    { id:'Rubik', name:'Rubik', css:"'Rubik', sans-serif" },
    { id:'PT Sans', name:'PT Sans', css:"'PT Sans', sans-serif" },
    { id:'Oswald', name:'Oswald (узкий)', css:"'Oswald', sans-serif" },
    { id:'Comfortaa', name:'Comfortaa (округлый)', css:"'Comfortaa', sans-serif" },
    { id:'PT Serif', name:'PT Serif (с засечками)', css:"'PT Serif', serif" },
    { id:'Playfair Display', name:'Playfair Display', css:"'Playfair Display', serif" },
    { id:'Lora', name:'Lora', css:"'Lora', serif" },
    { id:'Caveat', name:'Caveat (рукописный)', css:"'Caveat', cursive" },
    { id:'Marck Script', name:'Marck Script', css:"'Marck Script', cursive" },
    { id:'JetBrains Mono', name:'JetBrains Mono (моноширинный)', css:"'JetBrains Mono', monospace" }
  ];
  var TEXT_COLORS = ['#FBF1F2', '#F87171', '#FB923C', '#FACC15', '#4ADE80', '#60A5FA', '#C084FC', '#12090B'];
  var STROKE_COLORS = ['#12090B', '#FBF1F2', '#B91C1C', '#FACC15', '#2563EB', '#16A34A'];
  var loadedFonts = {};
  function ensureFont(id){
    if(!id || loadedFonts[id]) return;
    loadedFonts[id] = true;
    var l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(id).replace(/%20/g, '+') + ':ital,wght@0,400;0,700;1,400;1,700&display=swap';
    document.head.appendChild(l);
  }
  function fontCss(id){ var f = FONTS.filter(function(x){ return x.id === (id || ''); })[0]; return f ? f.css : FONTS[0].css; }
  function outlineShadow(w, c){
    if(!w) return '';
    var out = [], steps = 16;
    for(var i = 0; i < steps; i++){ var a = i / steps * Math.PI * 2; out.push((Math.cos(a) * w).toFixed(2) + 'px ' + (Math.sin(a) * w).toFixed(2) + 'px 0 ' + c); }
    return out.join(',');
  }
  // применяет стиль к HTML-элементу (заметки, названия блоков, подписи узлов)
  function styleHtml(elm, st, isSecondary){
    if(!elm) return;
    st = st || {};
    ensureFont(st.font);
    elm.style.fontFamily = st.font ? fontCss(st.font) : '';
    elm.style.color = st.color ? st.color : '';
    if(st.color && isSecondary) elm.style.opacity = '.8';
    if(!isSecondary){ elm.style.fontWeight = st.bold === undefined ? '' : (st.bold ? '700' : '400'); }
    elm.style.fontStyle = st.italic ? 'italic' : '';
    elm.style.textShadow = st.sw ? outlineShadow(st.sw, st.sc || '#12090B') : '';
  }
  // стиль для подписей в SVG (точки на связях)
  function svgTextStyle(st, size){
    st = st || {};
    ensureFont(st.font);
    return 'font-family:' + fontCss(st.font) + ';font-size:' + size + 'px;font-weight:' + (st.bold === false ? 400 : 600) + ';font-style:' + (st.italic ? 'italic' : 'normal') +
      ';fill:' + (st.color || '#FBF1F2') + ';paint-order:stroke;stroke:' + (st.sw ? (st.sc || '#12090B') : '#12090B') + ';stroke-width:' + (st.sw ? st.sw * 2 : 3) + 'px;stroke-linejoin:round';
  }
  // раздел «Оформление текста» для окна настроек
  function textStyleSection(st, change, opts){
    opts = opts || {};
    var box = h('div', { style:'display:flex;flex-direction:column;gap:10px' });
    var fsel = h('select', { 'class':'input', 'aria-label':'Шрифт', style:'min-height:36px' });
    FONTS.forEach(function(f){
      var o = document.createElement('option'); o.value = f.id; o.textContent = f.name; o.style.fontFamily = f.css;
      if((st.font || '') === f.id) o.selected = true; fsel.appendChild(o);
    });
    fsel.addEventListener('change', function(){ st.font = fsel.value || undefined; ensureFont(st.font); change(false); });
    box.appendChild(h('div', null, [ h('div', { 'class':'flabel', text:'Шрифт' }), fsel ]));
    var bOn = st.bold === undefined ? !!opts.boldDefault : st.bold;
    box.appendChild(h('div', { 'class':'seg' }, [
      h('button', { type:'button', 'class':'btn sm' + (bOn ? ' on' : ''), 'aria-pressed':bOn ? 'true' : 'false', style:'font-weight:800', text:'Ж', title:'Жирный',
        on:{ click:function(){ st.bold = !bOn; change(true); } } }),
      h('button', { type:'button', 'class':'btn sm' + (st.italic ? ' on' : ''), 'aria-pressed':st.italic ? 'true' : 'false', style:'font-style:italic;font-family:Georgia,serif', text:'К', title:'Курсив',
        on:{ click:function(){ st.italic = !st.italic; change(true); } } })
    ]));
    box.appendChild(h('div', null, [ h('div', { 'class':'flabel', text:'Цвет текста' }),
      colorRow(TEXT_COLORS, st.color || null, function(c, live){ st.color = c || undefined; change(!live); }, 'Цвет текста', 'Цвет по умолчанию', 'linear-gradient(135deg,#FBF1F2 50%,#C29CA4 50%)') ]));
    var seg = h('div', { 'class':'seg' });
    [[0,'Нет'],[1,'Тонкая'],[2,'Средняя'],[3,'Толстая']].forEach(function(o){
      var on = (st.sw || 0) === o[0];
      seg.appendChild(h('button', { type:'button', 'class':'btn sm' + (on ? ' on' : ''), 'aria-pressed':on ? 'true' : 'false', text:o[1], on:{ click:function(){ st.sw = o[0] || undefined; change(true); } } }));
    });
    box.appendChild(h('div', null, [ h('div', { 'class':'flabel', text:'Обводка текста' }), seg ]));
    if(st.sw) box.appendChild(h('div', null, [ h('div', { 'class':'flabel', text:'Цвет обводки' }),
      colorRow(STROKE_COLORS, st.sc || '#12090B', function(c, live){ st.sc = c || '#12090B'; change(!live); }, 'Цвет обводки') ]));
    box.appendChild(h('button', { type:'button', 'class':'btn sm', text:'Сбросить оформление', on:{ click:function(){
      Object.keys(st).forEach(function(k){ delete st[k]; }); change(true); } } }));
    return box;
  }
