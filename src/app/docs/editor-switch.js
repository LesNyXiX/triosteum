  /* ---------- редактор: какой холст показывать ---------- */
  function paneFor(){ var k = cur().id; return isDocs() && k === 'doc' ? 'doc' : (isDocs() && k === 'sheet' ? 'sheet' : 'code'); }
  function applyPane(){
    var pane = paneFor();
    $('docPane').hidden = pane !== 'doc'; $('sheetPane').hidden = pane !== 'sheet';
    document.querySelector('#editor .code-box').hidden = pane !== 'code';
    if(pane !== 'code') el.preview.hidden = true;
    $('runBtn').textContent = pane === 'doc' ? 'Предпросмотр с данными' : (pane === 'sheet' ? 'Пересчитать' : (isDocs() && isParamKind(cur().id) ? 'Проверить' : 'Запустить код'));
    document.querySelector('#editor .lang').hidden = isDocs();
    el.envLabel.textContent = (isDocs() ? 'Тип: ' : 'Среда: ') + cur().tool;
    if(pane === 'doc') loadDocPane();
    if(pane === 'sheet') loadSheetPane();
  }
  (function docEvents(){
    var paper = $('paper');
    paper.addEventListener('input', saveDocSoon);
    paper.addEventListener('keydown', function(e){ if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){ e.preventDefault(); docPreview(true); } });
    Array.prototype.forEach.call(document.querySelectorAll('#docPane [data-cmd]'), function(b){
      b.addEventListener('mousedown', function(e){ e.preventDefault(); });
      b.addEventListener('click', function(){ if(DP.preview) return; document.execCommand(b.dataset.cmd, false, b.dataset.val || null); paper.focus(); saveDocSoon(); });
    });
    $('dpBlock').addEventListener('change', function(){ if(DP.preview) return; paper.focus(); document.execCommand('formatBlock', false, $('dpBlock').value); saveDocSoon(); $('dpBlock').value = ''; });
    $('dpField').addEventListener('mousedown', function(e){ e.preventDefault(); });
    $('dpField').addEventListener('click', function(){ if(!DP.preview) fieldMenu($('dpField')); });
    $('dpPreview').addEventListener('click', function(){ docPreview(); });
    $('dpExport').addEventListener('click', exportDocHtml);
  })();