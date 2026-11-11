  /* Версии одного пространства в IndexedDB; личные настройки и ключи сюда не входят. */
  var VERS = { max:50, seq:0, ui:null, view:null, back:null, pending:false, base:{} };
  function verGraph(){ flushSave(); return JSON.parse(JSON.stringify(G)); }
  function verPrefix(space){ return 'ver:' + space + ':'; }
  function verList(space, cb){
    var db = bkDb(); if(!db) return cb([], 'IndexedDB недоступна');
    try{
      var list = [], rq = db.transaction('snaps', 'readonly').objectStore('snaps').openCursor(IDBKeyRange.bound(verPrefix(space), verPrefix(space) + '\uffff'));
      rq.onsuccess = function(){ var c = rq.result; if(c){ if(c.value.space === space && c.value.graph) list.push(c.value); c.continue(); } else cb(list.sort(function(a,b){ return b.t-a.t; })); };
      rq.onerror = function(){ cb([], 'Не удалось прочитать версии'); };
    } catch(e){ cb([], 'Не удалось прочитать версии'); }
  }
  function verOldIds(list, keep){
    var a = list.slice().sort(function(x,y){ return x.t-y.t || String(x.id).localeCompare(String(y.id)); }), gone = [];
    while(a.length > VERS.max){ var ix = a.findIndex(function(x){ return !!x.auto && x.id !== keep; }); if(ix < 0) ix = a.findIndex(function(x){ return x.id !== keep; }); gone.push(a.splice(ix,1)[0].id); }
    return gone;
  }
  function verSave(label, auto, cb){
    var callback=cb||function(){},settled=false;
    cb=function(ok,msg){if(settled)return;settled=true;callback(ok,msg);};
    var db = bkDb(), space = curId(), graph = verGraph();
    if(!db){ cb(false, 'IndexedDB недоступна — версия не сохранена'); return; }
    var record = { id:verPrefix(space) + Date.now().toString(36) + '-' + (++VERS.seq) + '-' + Math.random().toString(36).slice(2,7), space:space, t:Date.now(), label:String(label || 'Без подписи').slice(0,200), auto:!!auto, graph:graph };
    try{
      var tx = db.transaction('snaps', 'readwrite'), store = tx.objectStore('snaps'), all = [];
      store.put(record);
      var cursor = store.openCursor(IDBKeyRange.bound(verPrefix(space), verPrefix(space) + '\uffff'));
      cursor.onsuccess = function(){ var c = cursor.result; if(c){ if(c.value.space === space) all.push(c.value); c.continue(); } else verOldIds(all,record.id).forEach(function(id){ store.delete(id); }); };
      tx.oncomplete = function(){ VERS.base[space] = JSON.stringify(graph); cb(true, record); };
      tx.onerror = tx.onabort = function(){ cb(false, 'Не удалось сохранить версию: проверьте свободное место в браузере'); };
    } catch(e){ cb(false, 'Не удалось сохранить версию'); }
  }
  function verLineDiff(before, after){
    var a = String(before || '').split('\n'), b = String(after || '').split('\n');
    if(a.length>2000 || b.length>2000 || a.length*b.length > 250000) return [{type:'info',text:'Большой файл: показаны первые 200 удалённых и добавленных строк.'}].concat(a.slice(0,200).map(function(t){ return {type:'del',text:t}; }),b.slice(0,200).map(function(t){ return {type:'add',text:t}; }));
    var matrix = [], i, j; for(i=0;i<=a.length;i++){ matrix[i]=[]; for(j=0;j<=b.length;j++) matrix[i][j]=0; }
    for(i=a.length-1;i>=0;i--) for(j=b.length-1;j>=0;j--) matrix[i][j]=a[i]===b[j]?matrix[i+1][j+1]+1:Math.max(matrix[i+1][j],matrix[i][j+1]);
    var out=[];i=0;j=0;
    while(i<a.length || j<b.length){
      if(i<a.length && j<b.length && a[i]===b[j]){out.push({type:'same',text:a[i]});i++;j++;}
      else if(i<a.length && (j>=b.length || matrix[i+1][j]>=matrix[i][j+1])) out.push({type:'del',text:a[i++]});
      else out.push({type:'add',text:b[j++]});
    }
    return out;
  }
  function verMap(a){ var m=Object.create(null); (a || []).forEach(function(x){m[x.id]=x;});return m; }
  function verDiff(a,b){
    var changes=[],old=verMap(a.nodes),now=verMap(b.nodes);
    Object.keys(now).forEach(function(id){
      var n=now[id],p=old[id]; if(!p){changes.push({text:'Добавлен блок: '+n.name});return;}
      if(p.name!==n.name)changes.push({text:'Переименован блок: '+p.name+' → '+n.name});
      var langs=Object.keys(p.codes||{}).concat(Object.keys(n.codes||{})).filter(function(k,i,v){return v.indexOf(k)===i;});
      langs.forEach(function(k){var x=(p.codes||{})[k]||'',y=(n.codes||{})[k]||'';if(x!==y)changes.push({text:'Изменён код: '+n.name+' · '+k,lines:verLineDiff(x,y)});});
      var meta=function(o){var r=Object.assign({},o);delete r.name;delete r.codes;return JSON.stringify(r);};
      if(meta(p)!==meta(n))changes.push({text:'Изменены параметры или положение блока: '+n.name});
    });
    Object.keys(old).forEach(function(id){if(!now[id])changes.push({text:'Удалён блок: '+old[id].name});});
    var edgeOld=verMap(a.edges),edgeNow=verMap(b.edges);
    Object.keys(edgeOld).forEach(function(id){if(!edgeNow[id])changes.push({text:'Удалена связь: '+id});else if(JSON.stringify(edgeOld[id])!==JSON.stringify(edgeNow[id]))changes.push({text:'Изменена связь: '+id});});
    Object.keys(edgeNow).forEach(function(id){if(!edgeOld[id])changes.push({text:'Добавлена связь: '+id});});
    var other=function(g){var c=Object.assign({},g);delete c.nodes;delete c.edges;return JSON.stringify(c);};
    if(other(a)!==other(b))changes.push({text:'Изменены заметки, файлы или другие данные пространства'});
    return changes;
  }
  function verClose(){ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); if(VERS.ui) VERS.ui.layer.hidden=true; if(VERS.back && document.contains(VERS.back)) VERS.back.focus(); }
  function verOpen(focus){
    VERS.back=document.activeElement;VERS.view=curId();
    if(!VERS.ui){
      var layer=h('div',{'class':'ver-layer',hidden:''}),box=h('section',{'class':'ver-window',role:'dialog','aria-modal':'true','aria-labelledby':'verTitle'});
      var label=h('input',{'class':'input','aria-label':'Название версии',maxlength:'200',placeholder:'Например: перед изменением расчёта'});
      var status=h('p',{'class':'ver-caption',role:'status','aria-live':'polite'}),list=h('div',{'class':'ver-list'}),diff=h('div',{'class':'ver-diff'});
      box.appendChild(h('div',{'class':'ver-head'},[h('h2',{id:'verTitle',text:'Версии схемы'}),h('button',{type:'button','class':'icon-btn',text:'×','aria-label':'Закрыть версии',on:{click:verClose}})]));
      box.appendChild(h('p',{'class':'ver-caption',text:'Локальные версии текущего пространства в этом браузере. До 50 снимков; старые автоматические удаляются первыми.'}));
      var save=h('button',{type:'button','class':'btn primary sm',text:'Сохранить версию',on:{click:function(){
        if(!label.value.trim()){label.focus();status.textContent='Подпишите версию';return;}
        if(VERS.view!==curId())return verClose();save.disabled=true;label.disabled=true;
        verSave(label.value.trim(),false,function(ok,msg){save.disabled=false;label.disabled=false;status.textContent=ok?'Версия сохранена':msg;if(ok){label.value='';verRender();}});
      }}});
      box.appendChild(h('div',{'class':'ver-save'},[label,save]));box.appendChild(status);box.appendChild(list);box.appendChild(diff);
      layer.appendChild(box);document.body.appendChild(layer);VERS.ui={layer:layer,box:box,label:label,status:status,list:list,diff:diff};
      box.addEventListener('keydown',function(e){
        e.stopPropagation();
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();verClose();}
        if(e.key==='Tab'){var all=box.querySelectorAll('button:not([disabled]),input');if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all[all.length-1].focus();}else if(!e.shiftKey&&document.activeElement===all[all.length-1]){e.preventDefault();all[0].focus();}}
      });
    }
    VERS.ui.layer.hidden=false;VERS.ui.diff.textContent='';VERS.ui.status.textContent='';verRender();VERS.ui.label.focus();
  }
  function verRender(){
    if(!VERS.ui)return;var space=VERS.view;VERS.ui.list.textContent='Загрузка…';
    verList(space,function(list,error){
      if(VERS.view!==space)return;var body=VERS.ui.list;body.textContent='';if(error)VERS.ui.status.textContent=error;
      if(!list.length)body.appendChild(h('p',{'class':'ver-caption',text:'Версий пока нет'}));
      list.forEach(function(v){
        body.appendChild(h('article',{'class':'ver-row'},[h('b',{text:v.label+(v.auto?' · авто':'')}),h('small',{text:bkFmtDate(v.t)+' · блоков '+(v.graph.nodes||[]).length+' · связей '+(v.graph.edges||[]).length}),
          h('div',{'class':'acts'},[h('button',{type:'button','class':'btn sm',text:'Сравнить с текущей',on:{click:function(){verCompare(v);}}}),h('button',{type:'button','class':'btn sm',text:'Вернуть эту версию',on:{click:function(){verRestore(v);}}})]) ]));
      });
      if(SERVER){
        var server=h('section',{'class':'ver-server'},[h('h3',{text:'Серверные версии'}),h('button',{type:'button','class':'btn sm',text:'Открыть серверную историю',on:{click:function(){verClose();openHistory();}}})]);body.appendChild(server);
        SERVER.flush().then(function(){return SERVER.api('GET','/spaces/'+encodeURIComponent(space)+'/versions');}).then(function(r){
          if(VERS.view!==space || !document.contains(server))return;
          if(r.status!==200 || !Array.isArray(r.data)){server.appendChild(h('p',{'class':'ver-caption',text:'Не удалось загрузить серверные версии'}));return;}
          r.data.forEach(function(v){server.appendChild(h('p',{text:(v.label||'Автосохранение')+' · '+fmtWhen(v.created_at)+' · правка '+v.rev}));});
        },function(){server.appendChild(h('p',{'class':'ver-caption',text:'Нет связи с сервером'}));});
      }
    });
  }
  function verCompare(v){
    if(v.space!==curId())return;var changes=verDiff(v.graph,verGraph()),box=VERS.ui.diff;box.textContent='';
    box.appendChild(h('h3',{text:'Сравнение: «'+v.label+'» → текущая схема'}));
    if(!changes.length)box.appendChild(h('p',{text:'Изменений нет'}));
    changes.forEach(function(c){box.appendChild(h('p',{text:c.text}));if(c.lines){var pre=h('pre',{'class':'ver-code'});c.lines.forEach(function(l){pre.appendChild(h('span',{'class':'ver-'+l.type,text:(l.type==='add'?'+ ':l.type==='del'?'− ':'  ')+l.text+'\n'}));});box.appendChild(pre);}});
  }
  function verRestore(v){
    if(VERS.pending || v.space!==curId())return;
    askConfirm('Вернуть версию «'+v.label+'»?','Сначала текущее состояние будет сохранено как «Перед возвратом».','Вернуть',function(){
      var before=JSON.stringify(verGraph()),space=curId();VERS.pending=true;
      verSave('Перед возвратом',false,function(ok,msg){
        VERS.pending=false;if(!ok){VERS.ui.status.textContent=msg;return;}
        if(curId()!==space || JSON.stringify(verGraph())!==before){VERS.ui.status.textContent='Схема изменилась во время сохранения. Повторите возврат.';return;}
        setGraph(v.graph);saveGraph();flushSave();verOpen();VERS.ui.status.textContent='Версия возвращена; прежнее состояние сохранено';
      });
    });
  }
  function verBefore(reason,fn,self,args,optional){
    if(VERS.pending){toast('Подождите сохранения версии');return;}
    if(!bkDb()){toast('Автоверсия недоступна: IndexedDB не работает');return fn.apply(self,args);}
    VERS.pending=true;var space=curId(),before=JSON.stringify(verGraph());
    verSave(reason,true,function(ok,msg){VERS.pending=false;if(curId()!==space||(!optional&&JSON.stringify(verGraph())!==before)){toast('Схема изменилась; повторите действие');return;}if(!ok){toast(msg+(optional?' — импорт продолжен без автоверсии':''));if(!optional)return;}fn.apply(self,args);});
  }
  (function(){
    VERS.base[curId()]=JSON.stringify(G);
    var graph=setGraph;setGraph=function(){var r=graph.apply(this,arguments);if(VERS.base[curId()]===undefined)VERS.base[curId()]=JSON.stringify(G);if(VERS.ui)VERS.ui.layer.hidden=true;return r;};
    var apply=applyArc;applyArc=function(){if(!ARC.res)return;var res=ARC.res,self=this,args=arguments;return verBefore('Перед применением схемы ИИ',function(){if(ARC.res!==res){toast('Предложение ИИ изменилось; повторите применение');return;}return apply.apply(self,args);},this,arguments);};
    var file=importFile;importFile=function(){return verBefore('Перед импортом',file,this,arguments,true);};
    setInterval(function(){if(!running && !CMP.busy && !VERS.pending && VERS.base[curId()]!==JSON.stringify(G))verSave('Автоматическая версия',true,function(ok,msg){if(!ok)toast(msg);});},30*60*1000);
    document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.altKey&&!e.repeat&&(e.code==='KeyS'||e.key.toLowerCase()==='s')){e.preventDefault();verOpen(true);}});
    var commands=cmdCommands;cmdCommands=function(){return commands().concat([{sec:'space',label:'Сохранить версию схемы',icon:'file',kb:'Ctrl+Alt+S',act:function(){verOpen(true);},k:'снимок версия сохранить'}, {sec:'space',label:'Версии схемы',icon:'undo',act:verOpen,k:'история откат сравнение'}]);};
    var menu=projItems;projItems=function(){return menu().concat([{label:'Версии схемы',icon:'undo',act:verOpen}]);};
  })();
