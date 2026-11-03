  /* =====================================================================
     ГРАФИЧЕСКИЕ СРЕДЫ: фоторедактор (растр со слоями) и векторная графика.
     Работают на рабочем столе файлов, как «Офис»; файлы можно связывать
     в схеме файлов (картинка → векторный рисунок и обратно).
     ===================================================================== */
  // «Картинка из данных»: записи схемы → диаграмма → готовый файл на рабочем столе
  var OP_GFX = opKind('gfxpic', 'Картинка из данных', 'Рисует диаграмму по записям и кладёт её файлом на рабочий стол',
    { label:'Категория', value:'Сумма', type:'bar', name:'Диаграмма из схемы' },
    [['label', 'Подписи (поле)', 'f'], ['value', 'Значения (поле)', 'f'], ['type', 'Вид', 's', [['bar', 'столбцы'], ['line', 'линия'], ['pie', 'круговая']]], ['name', 'Имя файла', 't']],
    function(rows, p, ctx){
      var list = rows.slice(0, 30), aoa = [[p.label || 'Категория', p.value || 'Значение']].concat(list.map(function(r){ return [sv(r, p.label), nv(r, p.value)]; }));
      var W = 760, H = 420, svg = chartSvg(aoa, p.type || 'bar', p.name || ctx.name, W, H, false);
      if(svg.indexOf('xmlns=') < 0) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      var nm = (p.name || ctx.name) + ' ' + new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
      if(ENV.id === 'photo' || (ENV.office && ENV.office.types[0] === 'image')){
        svgToPng(svg.replace(/(<svg[^>]*>)/, '$1<rect width="100%" height="100%" fill="#fff"/>'), W, H, function(u){ if(!u) return; var c = document.createElement('canvas'); c.width = W; c.height = H; var im = new Image(); im.onload = function(){ c.getContext('2d').drawImage(im, 0, 0, W, H); newFile('image', nm, { w:W, h:H, layers:[{ id:'l' + Date.now().toString(36), name:'Диаграмма', vis:true, op:1, blend:'source-over', src:c.toDataURL('image/png') }] }, null, { silent:true }); saveGraph(); }; im.src = u; });
      } else {
        var san = veSanitizeSvg(svg) || { vb:'0 0 ' + W + ' ' + H, markup:'' };
        newFile('vector', nm, { w:W, h:H, bg:'#ffffff', items:[{ id:'v' + Date.now().toString(36), t:'svg', name:'Диаграмма', vb:san.vb, markup:san.markup, x:0, y:0, w:W, h:H, r:0, op:1 }] }, null, { silent:true });
      }
      ctx.chart({ title:p.name || ctx.name, kind:p.type === 'line' ? 'line' : 'bar', labels:list.map(function(r){ return sv(r, p.label); }), values:list.map(function(r){ return nv(r, p.value); }), unit:p.value });
      ctx.info = 'Файл «' + nm + '» на рабочем столе'; return rows;
    }, function(p){ return 'диаграмма «' + (p.value || '?') + '» по «' + (p.label || '?') + '» → файл'; });
  function gfxEnv(id, o){
    var colors = {}, k; for(k in DOC_COLORS) colors[k] = DOC_COLORS[k]; for(k in CODE_COLORS) colors[k] = CODE_COLORS[k]; for(k in GEN_COLORS) colors[k] = GEN_COLORS[k]; colors.gfxpic = [o.color, '#F472B6'];
    var code = CODE_LANGS.filter(function(l){ return l.id !== 'python'; });
    ENVS[id] = { id:id, name:o.name, short:o.short, color:o.color, ic:o.ic, theme:o.theme, desc:o.desc, newName:o.newName, seed:o.seed, route:true,
      hint:'Соберите обработку на доске: таблица → расчёты → «Картинка из данных» — готовый рисунок появится на рабочем столе. Блоки Python, C++, C# и 1С выполняются вместе со схемой.',
      office:{ types:o.types, tabs:['desk', 'map', 'auto'], noAi:true, noTpl:true },
      defLang:'sheet', langs:[OP_GFX].concat(DOC_KINDS, code, GEN_OPS), colors:colors, plugins:CODE_PLUGINS.filter(function(p){ return p.lang !== 'python' || p.family; }).concat(DOC_PLUGINS.filter(function(p){ return p.lang === 'sheet'; })),
      word:{ lang:'Тип', plugin:'блок', plugins:'блоков', lib:'Библиотека', create:'Создать', newTitle:'Новый блок', kindLabel:'Тип', run:'Запустить схему', runSub:'Выполнить блоки на доске «Автоматизация»', scheme:'Схема файлов', schemeSub:'Связи файлов', open:'Открыть', libOpen:'На доску' } };
  }
  function gfxSeedPhoto(){
    newProj('Фото — пример', null, 'photo');
    var W = 1200, H = 800;
    function layer(name, draw, extra){ var c = document.createElement('canvas'); c.width = W; c.height = H; draw(c.getContext('2d')); return Object.assign({ id:'l' + Math.random().toString(36).slice(2, 8), name:name, vis:true, op:1, blend:'source-over', src:c.toDataURL('image/png') }, extra || {}); }
    var layers = [
      layer('Небо', function(x){ var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1E3A8A'); g.addColorStop(0.55, '#F97316'); g.addColorStop(1, '#FDE68A'); x.fillStyle = g; x.fillRect(0, 0, W, H); }),
      layer('Солнце', function(x){ var g = x.createRadialGradient(820, 470, 10, 820, 470, 220); g.addColorStop(0, 'rgba(255,247,200,1)'); g.addColorStop(0.35, 'rgba(253,224,71,.95)'); g.addColorStop(1, 'rgba(253,186,116,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }, { blend:'screen' }),
      layer('Горы дальние', function(x){ x.fillStyle = '#7C2D12'; x.globalAlpha = 0.55; x.beginPath(); x.moveTo(0, 560); [[120, 430], [260, 520], [420, 380], [560, 500], [700, 410], [860, 520], [1000, 400], [1200, 500], [1200, 800], [0, 800]].forEach(function(p){ x.lineTo(p[0], p[1]); }); x.fill(); }),
      layer('Горы ближние', function(x){ x.fillStyle = '#1C1917'; x.beginPath(); x.moveTo(0, 650); [[180, 520], [330, 610], [520, 470], [690, 640], [880, 540], [1050, 660], [1200, 580], [1200, 800], [0, 800]].forEach(function(p){ x.lineTo(p[0], p[1]); }); x.fill(); }),
      layer('Заголовок', function(x){ x.fillStyle = '#FFFFFF'; x.font = '700 64px Inter, system-ui, sans-serif'; x.textBaseline = 'top'; x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = 12; x.fillText('Triosteum', 70, 80); x.font = '400 28px Inter, system-ui, sans-serif'; x.fillText('Пример: слои, режимы наложения, градиенты', 72, 160); })
    ];
    var f = newFile('image', 'Закат — пример', { w:W, h:H, layers:layers }, null, { silent:true });
    var v = newFile('vector', 'Логотип для фото', gfxLogo(), null, { silent:true });
    ofOpen(f.id); toast('Открыт пример: попробуйте кисть (B), выделение (M) и меню «Коррекция»');
  }
  function gfxLogo(){
    var t = { id:'g3', t:'text', name:'Надпись', text:'Triosteum', x:110, y:440, w:380, h:80, r:0, fill:'#F7F1F2', stroke:'#000000', sw:0, fs:72, ff:'Inter, system-ui, sans-serif', fw:true, op:1 };
    veTextBox(t); t.x = (600 - t.w) / 2;
    return { w:600, h:600, bg:'#12070B', items:[
      { id:'g1', t:'svg', name:'Знак Triosteum', vb:'0 0 200 200', markup:'<g transform="translate(0.00 0.00) scale(1.0000)"><path d="M22.07 61.83 A150 150 0 0 1 177.93 61.83" stroke="#D7263D" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M35.58 84.05 A124 124 0 0 1 57.45 73.53 A22 22 0 0 1 87.00 94.19 L87.00 182" stroke="#E8566A" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M164.42 84.05 A124 124 0 0 0 142.55 73.53 A22 22 0 0 0 113.00 94.19 L113.00 182" stroke="#F39AA8" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>', x:150, y:70, w:300, h:300, r:0, op:1 },
      t
    ] };
  }
  function gfxSeedVector(){
    newProj('Вектор — пример', null, 'vector');
    var wave = { id:'w1', t:'path', name:'Волна', x:0, y:520, w:1200, h:280, r:0, closed:true, fill:'#0EA5E9', fill2:'#6366F1', gang:0, stroke:'#000000', sw:0, op:0.9,
      pts:[{ x:0, y:0.3, c1:null, c2:[0.15, 0] }, { x:0.5, y:0.35, c1:[0.3, 0.7], c2:[0.68, 0.05] }, { x:1, y:0.2, c1:[0.85, 0.6], c2:null }, { x:1, y:1, c1:null, c2:null }, { x:0, y:1, c1:null, c2:null }] };
    var items = [
      { id:'b1', t:'rect', name:'Фон карточки', x:80, y:70, w:640, h:380, r:0, rx:28, fill:'#FFFFFF', stroke:'#E2E8F0', sw:2, op:1, shadow:{ dx:4, dy:10, b:18, c:'#0F172A', o:0.18 } },
      { id:'b2', t:'text', name:'Заголовок', text:'Новая линия\nзапущена', x:120, y:110, w:460, h:120, r:0, fill:'#0F172A', stroke:'#000000', sw:0, fs:48, ff:'Inter, system-ui, sans-serif', fw:true, op:1 },
      { id:'b3', t:'text', name:'Подпись', text:'+18% выпуска · 2026', x:122, y:260, w:360, h:36, r:0, fill:'#64748B', stroke:'#000000', sw:0, fs:28, ff:'Inter, system-ui, sans-serif', op:1 },
      { id:'b4', t:'rect', name:'Кнопка', x:120, y:330, w:220, h:64, r:0, rx:32, fill:'#2563EB', fill2:'#7C3AED', gang:0, stroke:'#000000', sw:0, op:1 },
      { id:'b5', t:'text', name:'Текст кнопки', text:'Подробнее', x:160, y:346, w:150, h:34, r:0, fill:'#FFFFFF', stroke:'#000000', sw:0, fs:28, ff:'Inter, system-ui, sans-serif', fw:true, op:1 },
      { id:'b6', t:'star', name:'Звезда', x:840, y:90, w:240, h:230, r:12, n:7, ir:0.5, fill:'#FBBF24', stroke:'#B45309', sw:3, op:1 },
      { id:'b7', t:'polygon', name:'Шестиугольник', x:880, y:360, w:150, h:150, r:0, n:6, fill:'none', stroke:'#DB2777', sw:6, dash:'8 6', op:1 },
      { id:'b8', t:'line', name:'Стрелка', x:740, y:420, w:120, h:1, r:-20, fill:'none', stroke:'#0F172A', sw:4, arrow:true, op:1 },
      wave
    ];
    items.forEach(function(o){ if(o.t === 'text') veTextBox(o); });
    var f = newFile('vector', 'Баннер — пример', { w:1200, h:800, bg:'#F8FAFC', items:items }, null, { silent:true });
    newFile('vector', 'Логотип', gfxLogo(), null, { silent:true });
    ofOpen(f.id); toast('Открыт пример: двойной клик по тексту — правка, A — правка узлов волны, P — перо');
  }
  gfxEnv('photo', { name:'Фоторедактор', short:'Фото', color:'#0891B2', theme:'graphite', newName:'Фото', types:['image', 'vector'], seed:gfxSeedPhoto,
    ic:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
    desc:'Растровые изображения со слоями: кисти, выделения, штамп, градиенты, коррекция цвета, фильтры, режимы наложения.' });
  gfxEnv('vector', { name:'Векторная графика', short:'Вектор', color:'#DB2777', theme:'midnight', newName:'Вектор', types:['vector', 'image'], seed:gfxSeedVector,
    ic:'<path d="M12 3l8 5v8l-8 5-8-5V8z"/><circle cx="12" cy="3" r="1.6"/><circle cx="20" cy="16" r="1.6"/><circle cx="4" cy="16" r="1.6"/>',
    desc:'Логотипы, баннеры и схемы: фигуры, перо с кривыми, текст, градиенты, тени, группы, выравнивание, экспорт SVG и PNG.' });
  ALLP = null;
