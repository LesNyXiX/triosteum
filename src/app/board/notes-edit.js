  /* ---------- заметки: редактирование ---------- */
  var editingNote = null;
  function editNote(id){
    var t = noteById(id), d = domOf('note', id);
    if(!t || !d) return;
    hidePop();
    editingNote = id;
    d.contentEditable = 'true'; d.classList.add('editing');
    // если заметка за краем экрана — сдвигаем доску, чтобы её было видно
    var cr = el.canvas.getBoundingClientRect(), nr = d.getBoundingClientRect(), shiftX = 0, shiftY = 0;
    if(nr.left < cr.left + 12) shiftX = cr.left + 12 - nr.left;
    else if(nr.right > cr.right - 12) shiftX = Math.max(cr.right - 12 - nr.right, cr.left + 12 - nr.left);
    if(nr.top < cr.top + 12) shiftY = cr.top + 12 - nr.top;
    if(shiftX || shiftY){ G.cam.x += shiftX; G.cam.y += shiftY; applyCam(); }
    d.focus({ preventScroll:true });
    var r = document.createRange(); r.selectNodeContents(d); r.collapse(false);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    d.addEventListener('blur', function onBlur(){
      d.removeEventListener('blur', onBlur);
      d.contentEditable = 'false'; d.classList.remove('editing');
      t.text = d.innerText.replace(/\n$/, '');
      editingNote = null;
      if(!t.text.trim() && !t.attach){ G.notes = G.notes.filter(function(x){ return x.id !== id; }); if(S.sel && S.sel.id === id) S.sel = null; }
      renderGraph(); updateSel();
      saveGraph(); status();
    });
    d.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ e.preventDefault(); d.blur(); } });
    function fit(){
      if(!t.attach || !t.auto) return;
      t.dx = -(d.offsetWidth + 44); syncNote(t); d.style.left = t.x + 'px'; renderEdges();
    }
    d.addEventListener('input', fit); fit();
  }
