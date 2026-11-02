  /* ---------- связи между файлами ---------- */
  function linksOf(f){
    var out = [];
    ofItems().forEach(function(x){
      if(x.id === f.id) return;
      var s = '';
      if(x.type === 'doc') s = x.data.html || '';
      else if(x.type === 'sheet') s = JSON.stringify(x.data.sheets.map(function(q){ return q.rows; }));
      else if(x.type === 'slides') s = JSON.stringify(x.data.slides);
      else if(x.type === 'form') s = x.data.target || '';
      if(s.indexOf(f.id) >= 0 || (f.type === 'sheet' && (s.indexOf("'" + f.name + "'!") >= 0 || s.indexOf("'" + f.name + '/') >= 0))) out.push(x);
    });
    G.nodes.forEach(function(n){ if(n.src === f.id) out.push({ name:'Блок «' + n.name + '» во вкладке «Автоматизация»', type:'auto' }); });
    return out;
  }
  function showLinks(f){
    var l = linksOf(f);
    toast(l.length ? '«' + f.name + '» используется: ' + l.map(function(x){ return x.name; }).join(', ') : '«' + f.name + '» пока нигде не используется');
  }
