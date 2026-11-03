  /* ---------- состояние, клавиши, запуск ---------- */
  function ofStatus(){
    var f = ofFile(OF.tab);
    if(OF.tab === 'map'){ var fe = fmEdges(); el.stLeft.textContent = 'Схема файлов · Файлов: ' + fmFiles().length + ' · Связей: ' + fe.length; }
    else if(!f){ el.stLeft.textContent = 'Рабочий стол' + (OF.dir && ofFile(OF.dir) ? ' / ' + ofFile(OF.dir).name : '') + ' · Файлов: ' + ofItems().filter(function(x){ return x.type !== 'folder'; }).length + ' · Папок: ' + ofItems().filter(function(x){ return x.type === 'folder'; }).length; }
    else if(f.type === 'sheet' && SG.f === f){ if($('sgRef')) shUpdateBar(); }
    else if(f.type === 'slides') el.stLeft.textContent = 'Презентация «' + f.name + '» · Слайд ' + (SE.i + 1) + ' из ' + f.data.slides.length;
    else if(f.type === 'image') ieStatus();
    else if(f.type === 'vector') veStatus();
    else if(f.type === 'form') el.stLeft.textContent = 'Форма «' + f.name + '» · Вопросов: ' + f.data.fields.length;
    else if(f.type === 'doc' && $('dePaper')) { deCount(); }
    el.stRight.textContent = ENV.name + ' · сохраняется автоматически';
  }
  function officeRun(){
    var f = ofFile(OF.tab);
    if(OF.tab === 'map'){ fmCompile(); return; }
    if(!f && ENV.office && ENV.office.tabs && ENV.office.tabs.indexOf('auto') < 0){ var r = $('topRun').getBoundingClientRect(); openMenuAt(newItems(), r.left, r.bottom + 6); return; }
    if(!f){ OF.tab = 'auto'; ofSetTab('auto'); runBoard(); return; }
    if(f.type === 'doc') dePreview();
    else if(f.type === 'sheet'){ calcReset(); renderGrid(); renderCharts(); toast('Формулы пересчитаны'); }
    else if(f.type === 'slides') slShow(SE.f === f ? SE.i : 0);
    else if(f.type === 'form'){ FE.mode = 'fill'; ofRender(); }
    else if(f.type === 'image') ieExport('png');
    else if(f.type === 'vector') veExport('svg');
  }
  function officeKey(e){
    var mod = e.ctrlKey || e.metaKey, code = e.code || '', t = e.target;
    var typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
    if(mod && !e.altKey && code === 'KeyS'){ e.preventDefault(); var f = ofFile(OF.tab); if(f) exportFileAs(f, ({ doc:'docx', sheet:'xlsx', slides:'pptx', form:'xlsx', image:'png', vector:'svg' })[f.type]); else exportFile(); return true; }
    if(mod && !e.altKey && code === 'KeyO'){ e.preventDefault(); ofImportIn.click(); return true; }
    if(mod && !e.altKey && code === 'KeyR'){ e.preventDefault(); officeRun(); return true; }
    if(mod && e.altKey && code === 'KeyN'){ e.preventDefault(); var r = $('ofrNew').getBoundingClientRect(); openMenuAt(newItems(), r.right + 8, r.top); return true; }
    if(mod && !e.shiftKey && code === 'KeyW' && ofFile(OF.tab)){ e.preventDefault(); ofClose(OF.tab); return true; }
    // горячие клавиши редакторов работают, даже если фокус ушёл на ленту или вкладки
    var fv = ofFile(OF.tab), view = fv && (fv.type === 'image' ? $('ieView') : (fv.type === 'vector' ? $('veView') : null));
    if(view && !typing && !view.contains(t) && !$('howW') && (mod || /^(Delete|Backspace|Escape|Enter|Arrow|\[|\]| )/.test(e.key) || (!e.altKey && e.key.length === 1))){
      view.focus({ preventScroll:true });
      var ke = new KeyboardEvent('keydown', { key:e.key, code:e.code, ctrlKey:e.ctrlKey, metaKey:e.metaKey, shiftKey:e.shiftKey, altKey:e.altKey, bubbles:true, cancelable:true });
      view.dispatchEvent(ke); if(ke.defaultPrevented){ e.preventDefault(); return true; }
      return false;
    }
    if(!typing && (OF.tab === 'desk' || OF.tab === 'map') && mod && !e.shiftKey && code === 'KeyZ'){ e.preventDefault(); ofUndo(); return true; }
    if(!typing && (OF.tab === 'desk' || OF.tab === 'map') && mod && (code === 'KeyY' || (e.shiftKey && code === 'KeyZ'))){ e.preventDefault(); ofRedo(); return true; }
    if(!typing && OF.tab === 'desk' && mod && code === 'KeyD' && OF.sel.length){ e.preventDefault(); ofSnapPush(); OF.sel.slice().forEach(function(id){ ofDuplicate(id); }); return true; }
    if(!typing && OF.tab === 'map' && !t.closest('#fmWrap') && $('fmWrap') && (mod || e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Escape' || /^Arrow/.test(e.key))){ fmKey(e); if(e.defaultPrevented) return true; }
    if(!typing && OF.tab === 'desk' && mod && code === 'KeyA'){ e.preventDefault(); OF.sel = ofChildren(OF.dir).map(function(x){ return x.id; }); Array.prototype.forEach.call(document.querySelectorAll('.fcard'), function(x){ x.classList.add('sel'); }); return true; }
    return false;
  }