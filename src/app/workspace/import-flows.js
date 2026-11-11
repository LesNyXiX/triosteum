  /* Импорт структуры n8n/Make. Исходные сценарии не исполняются при переносе. */
  var FLOW_IMPORT = { ui:null, plan:null, space:null, back:null };
  function flowFormat(o){if(!o||typeof o!=='object')return '';if(Array.isArray(o.nodes)&&o.connections&&typeof o.connections==='object')return 'n8n';if(Array.isArray(o.flow))return 'Make';return '';}
  function flowPlugin(type){
    var rules=[[/httprequest|http[:.]|http\.action/i,/http|веб-запрос|веб запрос/i],[/webhook/i,/webhook|вебхук/i],[/schedule|cron/i,/расписан|schedule|cron/i],[/\.if$|:router|builtin:basicrouter/i,/условие|ветвлен|condition/i],[/\.set$|setvariable/i,/переменн|set variable/i]];
    var rule=rules.filter(function(r){return r[0].test(type);})[0];if(!rule)return null;
    return PLUGINS.filter(function(p){return p.lang==='python'&&rule[1].test(p.name+' '+p.desc);})[0]||null;
  }
  function flowComment(text){return String(text||'').split(/\r?\n/).map(function(l){return '# '+l;}).join('\n');}
  function flowCode(type,params,python,foreign){
    var header='# Импортировано из '+type+'; проверьте совместимость перед включением блока.\n';
    if(python){
      if(/^\s*def\s+run\s*\(/m.test(python)||/@(?:\w+\.)?block\b/.test(python))return header+python;
      return header+'# API исходной платформы (_input, items и т. п.) нужно адаптировать.\ndef run(data):\n'+python.split(/\r?\n/).map(function(l){return '    '+l;}).join('\n')+'\n';
    }
    var description='Из '+type+'\nПараметры:\n'+JSON.stringify(params||{},null,2);
    return header+(foreign?flowComment('Исходный JavaScript:\n'+foreign)+'\n':'')+'def run(data):\n    '+JSON.stringify(description)+'\n    raise NotImplementedError("Импортированный блок требует настройки: '+type.replace(/[^A-Za-zА-Яа-яЁё0-9_.: -]/g,'')+'")\n';
  }
  function flowParse(o){
    var format=flowFormat(o);if(!format)throw new Error('Неизвестный формат: нужен экспорт n8n с nodes/connections или Make с flow.');
    var nodes=[],edges=[],warnings=[],names=Object.create(null),ids=Object.create(null),counter=0;
    function add(name,type,params,pos,python,foreign,originalId){
      if(nodes.length>=500)throw new Error('В одном импорте допускается до 500 блоков. Разделите сценарий.');
      if(typeof type!=='string'||!type)throw new Error('У модуля не указан тип.');
      var id='flow'+(++counter),p=flowPlugin(type),x=Array.isArray(pos)?Number(pos[0]):NaN,y=Array.isArray(pos)?Number(pos[1]):NaN;
      var n={id:id,name:String(name||type).slice(0,200),kind:'block',lang:'python',x:isFinite(x)?Math.max(-100000,Math.min(100000,x)):100+(counter-1)*280,y:isFinite(y)?Math.max(-100000,Math.min(100000,y)):160,codes:{python:flowCode(format+': '+type,params,python,foreign)},off:true,desc:'Из '+format+': '+type+' · требуется проверка',imported:{platform:format,type:type,sourceId:String(originalId===undefined?'':originalId),parameters:params||{}}};
      if(p)n.imported.suggestedPlugin=p.id;else if(!python)warnings.push(n.name+': нет готового аналога');
      if(python)n.imported.python=true;
      if(p)warnings.push(n.name+': похожий плагин «'+p.name+'», параметры нужно перенести вручную');
      if(python)warnings.push(n.name+': проверьте API Python исходной платформы');
      nodes.push(n);return n;
    }
    function link(a,b,label){if(!a||!b)throw new Error('Связь ссылается на отсутствующий узел. Проверьте экспорт.');if(edges.length>=2000)throw new Error('Слишком много связей для одного импорта.');edges.push({id:'flowedge'+(edges.length+1),from:a.id,to:b.id,taps:[],label:label||''});}
    if(format==='n8n'){
      o.nodes.forEach(function(n){
        if(!n||typeof n.name!=='string'||names[n.name])throw new Error('В n8n должны быть уникальные имена узлов.');
        var p=n.parameters||{},type=n.type||'',code=/\.(code|function|functionItem)$/.test(type),py=code&&(p.pythonCode||(/python/i.test(p.language||'')?p.jsCode:'')),js=code&&!py&&(p.jsCode||p.functionCode);
        names[n.name]=add(n.name,type,p,n.position,typeof py==='string'?py:'',typeof js==='string'?js:'',n.id);
      });
      Object.keys(o.connections).forEach(function(name){var groups=o.connections[name];if(!groups||typeof groups!=='object')throw new Error('Неверный формат connections.');Object.keys(groups).forEach(function(channel){
        var ports=groups[channel];if(!Array.isArray(ports))throw new Error('Неверный список портов n8n.');
        ports.forEach(function(targets,port){if(!Array.isArray(targets))throw new Error('Неверный список связей n8n.');targets.forEach(function(t){link(names[name],t&&names[t.node],channel+' '+(port+1));});});
      });});
    }else{
      function sequence(flow,previous,depth){
        if(depth>30)throw new Error('Слишком глубокое ветвление Make.');if(!Array.isArray(flow))throw new Error('У ветки Make отсутствует flow.');
        var last=previous?previous.slice():[];
        flow.forEach(function(m){
          if(!m||!m.module)throw new Error('У модуля Make не указан module.');
          if(m.id!==undefined&&Object.prototype.hasOwnProperty.call(ids,String(m.id)))throw new Error('Повторяется id модуля Make.');
          var pos=m.metadata&&m.metadata.designer,n=add(m.name||String(m.module),String(m.module),{mapper:m.mapper||{},parameters:m.parameters||{}},pos?[pos.x,pos.y]:null,'','',m.id);if(m.id!==undefined)ids[String(m.id)]=n;
          last.forEach(function(a){link(a,n);});last=[n];
          if(Array.isArray(m.routes)&&m.routes.length){var ends=[];m.routes.forEach(function(r){ends=ends.concat(sequence(r.flow,[n],depth+1));});last=ends;}
        });return last;
      }
      sequence(o.flow,[],0);
    }
    if(!nodes.length)throw new Error('В сценарии нет модулей для импорта.');
    return {format:format,name:String(o.name||format+' — импорт').slice(0,150),nodes:nodes,edges:edges,warnings:warnings,unmatched:nodes.filter(function(n){return !n.imported.suggestedPlugin&&!n.imported.python;}).length};
  }
  function flowClose(){ if(document.activeElement && document.activeElement.blur) document.activeElement.blur();if(FLOW_IMPORT.ui)FLOW_IMPORT.ui.layer.hidden=true;FLOW_IMPORT.plan=null;if(FLOW_IMPORT.back&&document.contains(FLOW_IMPORT.back))FLOW_IMPORT.back.focus();}
  function flowApply(mode,versioned){
    var p=FLOW_IMPORT.plan;if(!p)return;
    if(curId()!==FLOW_IMPORT.space){FLOW_IMPORT.ui.status.textContent='Текущее пространство изменилось. Откройте импорт заново.';return;}
    if(running||CMP.busy){FLOW_IMPORT.ui.status.textContent='Дождитесь завершения запуска схемы.';return;}
    if(!versioned&&typeof verBefore==='function')return verBefore('Перед импортом '+p.format,function(){if(FLOW_IMPORT.plan===p)flowApply(mode,true);},null,[],true);
    var graph={nodes:JSON.parse(JSON.stringify(p.nodes)),edges:JSON.parse(JSON.stringify(p.edges)),notes:[],seq:1,cam:{x:0,y:0,k:1}},map=Object.create(null);
    if(mode==='new'){
      // Пространство создаётся до перенумерации: идентификаторы берём из его собственного счётчика.
      newProj(p.name,null,'code');
    }
    graph.nodes.forEach(function(n){var old=n.id;map[old]=n.id=newId('n');});graph.edges.forEach(function(e){e.id=newId('e');e.from=map[e.from];e.to=map[e.to];});
    G.nodes=G.nodes.concat(graph.nodes);G.edges=G.edges.concat(graph.edges);S.sel=null;S.multi=[];
    saveGraph();flushSave();render();renderGraph();setTimeout(fitView,20);
    if(typeof audAppend==='function'&&typeof audEntry==='function')audAppend([audEntry('import',p.format,'Импорт: '+p.nodes.length+' блоков, '+p.edges.length+' связей')]);
    flowClose();toast('Импортировано: '+p.nodes.length+' блоков. Они выключены до проверки совместимости.');
  }
  function flowPreview(o){
    var p;try{p=flowParse(o);}catch(e){toast(e.message||'Не удалось разобрать сценарий');return false;}
    FLOW_IMPORT.back=document.activeElement;FLOW_IMPORT.space=curId();FLOW_IMPORT.plan=p;
    if(!FLOW_IMPORT.ui){
      var layer=h('div',{'class':'flowimp-layer',hidden:''}),box=h('section',{'class':'flowimp-window',role:'dialog','aria-modal':'true','aria-labelledby':'flowimpTitle'}),body=h('div',{'class':'flowimp-body'}),status=h('p',{role:'status'});
      box.appendChild(h('div',{'class':'flowimp-head'},[h('h2',{id:'flowimpTitle',text:'Импорт n8n / Make'}),h('button',{type:'button','class':'icon-btn','aria-label':'Закрыть импорт',text:'×',on:{click:flowClose}})]));box.appendChild(body);box.appendChild(status);
      box.appendChild(h('div',{'class':'acts'},[h('button',{type:'button','class':'btn sm',text:'В текущее пространство',on:{click:function(){flowApply('current');}}}),h('button',{type:'button','class':'btn sm primary',text:'В новое пространство',on:{click:function(){flowApply('new');}}})]));layer.appendChild(box);document.body.appendChild(layer);FLOW_IMPORT.ui={layer:layer,box:box,body:body,status:status};
      box.addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Escape'){e.preventDefault();flowClose();}if(e.key==='Tab'){var a=box.querySelectorAll('button');if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a[a.length-1].focus();}else if(!e.shiftKey&&document.activeElement===a[a.length-1]){e.preventDefault();a[0].focus();}}});
    }
    var ui=FLOW_IMPORT.ui;ui.layer.hidden=false;ui.status.textContent='';ui.body.textContent='';ui.body.appendChild(h('p',{text:p.format+' · Будет создано: '+p.nodes.length+' блоков, '+p.edges.length+' связей; без аналога: '+p.unmatched}));
    ui.body.appendChild(h('p',{text:'Переносится структура, код и параметры. Учётные записи, выражения платформы и внешние действия требуют ручной настройки. Все импортированные блоки будут выключены. Оригинальный файл не изменяется.'}));
    p.warnings.slice(0,100).forEach(function(t){ui.body.appendChild(h('p',{'class':'flowimp-warning',text:t}));});ui.box.querySelector('button').focus();return true;
  }
  var flowIn=document.createElement('input');flowIn.type='file';flowIn.accept='.json,application/json';flowIn.hidden=true;document.body.appendChild(flowIn);
  function flowRead(f,fallback){if(fallback&&/\.tsm$/i.test(f.name))return fallback(f);if(!fallback&&f.size>5*1024*1024){toast('Файл больше 5 МБ. Разделите сценарий.');return;}return f.text().then(function(text){var o=JSON.parse(text);if(flowFormat(o)||!fallback){if(f.size>5*1024*1024){toast('Файл больше 5 МБ. Разделите сценарий.');return;}return flowPreview(o);}return fallback(f);}).catch(function(){toast('Не удалось прочитать JSON сценария.');});}
  flowIn.addEventListener('change',function(){if(flowIn.files[0])flowRead(flowIn.files[0]);flowIn.value='';});
  (function(){
    var file=importFile;importFile=function(f){return flowRead(f,file);};
    var paste=boardPasteText;boardPasteText=function(text){var o;try{o=JSON.parse(text);}catch(e){return paste(text);}if(flowFormat(o))return flowPreview(o);return paste(text);};
    var cmd=cmdCommands;cmdCommands=function(){return cmd().concat([{sec:'space',label:'Импорт n8n / Make',icon:'file',act:function(){flowIn.click();},k:'импорт workflow json n8n make'}]);};
    var items=projItems;projItems=function(){return items().concat([{label:'Импорт n8n / Make…',icon:'file',act:function(){flowIn.click();}}]);};
  })();
