  var TOOL_NAMES = { select:'Выбор и перемещение', block:'Блок', hub:'Связующая точка', text:'Текст' };
  var COLORS = {
    python: ['#3776AB', '#FFD43B'],
    html:   ['#E34F26', '#F0DB4F'],
    cpp:    ['#00599C', '#7FB3E8'],
    csharp: ['#512BD4', '#C063C9'],
    '1c':   ['#FFD400', '#E30613']
  };
  var PALETTES = [
    ['#DC2626', '#7F1D1D'], ['#F97316', '#FACC15'], ['#22C55E', '#14B8A6'],
    ['#3B82F6', '#A855F7'], ['#EC4899', '#F43F5E'], ['#E5E7EB', '#6B7280']
  ];
  var TINTS = { grey:'rgba(170,160,165,.16)', red:'rgba(220,38,38,.20)', yellow:'rgba(250,204,21,.16)', blue:'rgba(59,130,246,.18)' };
  var FS = { s:12, m:14, l:18 };
  var NW = 200, NH = 88, STEM = 24;


  var MY = load('triosteum.my', []);
  MY.forEach(function(p){ p.my = true; if(!p.codes) p.codes = {}; });
  var S = {
    view:'canvas', lib:false, tool:'select',
    lang: load('triosteum.lang', 'python'),
    codes: load('triosteum.codes', {}),
    doc: null,
    langOpen:false, filter:'all', q:'',
    graph: load('triosteum.graph', { nodes:[], edges:[], notes:[], cam:{ x:0, y:0, k:1 }, seq:1 }),
    sel: null,     // { type:'node'|'edge'|'note'|'tap', id }
    multi: [],
    pop: false
  };
  if(!LANGS.some(function(l){ return l.id === S.lang; })) S.lang = 'python';
  var G = S.graph;
  // новый номер объекта; при совместной работе к нему добавляется метка вкладки — номера двух людей не совпадут
  function newId(prefix){ return prefix + (G.seq++) + LIVE_TAG; }
  if(!G.cam) G.cam = { x:0, y:0, k:1 };
  if(!G.seq) G.seq = 1;
  if(!G.notes) G.notes = [];
  G.nodes.forEach(function(n){ if(!n.codes) n.codes = {}; });

  var $ = function(id){ return document.getElementById(id); };
  var el = {
    lib:$('lib'), canvas:$('canvas'), editor:$('editor'), bLib:$('bLib'), bCreate:$('bCreate'),
    zVal:$('zVal'), code:$('code'), gutter:$('gutter'), fileName:$('fileName'), docTitle:$('docTitle'), backBtn:$('backBtn'), toBoard:$('toBoard'),
    langBtn:$('langBtn'), langLabel:$('langLabel'), langList:$('langList'), envLabel:$('envLabel'), out:$('out'),
    stLeft:$('stLeft'), stRight:$('stRight'), preview:$('preview'), frame:$('frame'), saved:$('saved'),
    chips:$('chips'), plist:$('plist'), search:$('libSearch'),
    world:$('world'), nodes:$('nodes'), notes:$('notes'), cnotes:$('cnotes'), edgeDefs:$('edgeDefs'), edgeLayer:$('edgeLayer'), tempLayer:$('tempLayer'),
    hint:$('hint'), pop:$('pop'), toast:$('toast'),
    modal:$('newModal'), form:$('newForm'), newName:$('newName'), newDesc:$('newDesc'), newLangs:$('newLangs')
  };
  var toolBtns = Array.prototype.slice.call(document.querySelectorAll('[data-tool]'));

  function newBlockName(lang){ var l = langById(lang); return (isDocs() && l ? l.name : 'Новый блок') + ' ' + (G.nodes.length + 1); }
  function langById(id){ return LANGS.filter(function(l){ return l.id === id; })[0] || foreignLang(id); }
  // блок из другой среды: язык и цвета берутся из его родной среды
  function foreignLang(id){
    if(typeof ENVS === 'undefined') return undefined;
    var keys = Object.keys(ENVS);
    for(var i = 0; i < keys.length; i++){ var l = (ENVS[keys[i]].langs || []).filter(function(x){ return x.id === id; })[0]; if(l) return l; }
    return undefined;
  }
  function langHomeEnv(id){
    if(typeof ENVS === 'undefined') return null;
    if(ENVS.code && ENVS.code.langs.some(function(l){ return l.id === id; })) return 'code';
    var keys = Object.keys(ENVS);
    for(var i = 0; i < keys.length; i++) if((ENVS[keys[i]].langs || []).some(function(l){ return l.id === id; })) return keys[i];
    return null;
  }
  function nativeLang(id){ return LANGS.some(function(l){ return l.id === id; }); }
  function pluginById(id){ return (CODE_PLUGINS ? allPlugins() : PLUGINS).filter(function(p){ return p.id === id; })[0] || MY.filter(function(p){ return p.id === id; })[0]; }
  function nodeById(id){ return G.nodes.filter(function(n){ return n.id === id; })[0]; }
  function noteById(id){ return G.notes.filter(function(n){ return n.id === id; })[0]; }
  function edgeById(id){ return G.edges.filter(function(e){ return e.id === id; })[0]; }
  function shortName(l){ return l.id === 'csharp' ? 'C#' : l.name; }
  function colorsOf(n){ return n.colors || COLORS[n.lang] || foreignColors(n.lang) || ['#8A8A8A', '#555555']; }
  function foreignColors(id){ if(typeof ENVS === 'undefined') return null; var h = langHomeEnv(id); return h && ENVS[h].colors ? ENVS[h].colors[id] : null; }
  function grad(c){ return 'linear-gradient(135deg,' + c[0] + ',' + c[1] + ')'; }

  var toastTimer = null;
  function toastAct(t, label, fn){
    toast(t);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'toast-act'; b.textContent = label;
    b.addEventListener('click', function(){ el.toast.hidden = true; fn(); });
    el.toast.appendChild(b); clearTimeout(toastTimer); toastTimer = setTimeout(function(){ el.toast.hidden = true; }, 5000);
  }
  function toast(t){ el.toast.textContent = t; el.toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function(){ el.toast.hidden = true; }, 2200); }
