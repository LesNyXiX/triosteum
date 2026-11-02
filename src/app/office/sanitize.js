  /* ---------- очистка HTML: никакого исполняемого кода из файлов, ИИ и буфера ---------- */
  var BAD_TAGS = 'script,style,iframe,frame,frameset,object,embed,link,meta,base,form,input,button,select,textarea,math,template,noscript,applet,portal,svg';
  function sanitizeHtml(html){
    var d = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
    d.querySelectorAll(BAD_TAGS).forEach(function(x){ x.remove(); });
    d.body.querySelectorAll('*').forEach(function(x){
      Array.prototype.slice.call(x.attributes).forEach(function(a){
        var n = a.name.toLowerCase(), v = String(a.value || '').replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
        if(n.indexOf('on') === 0 || n === 'srcdoc' || n === 'formaction' || n === 'xlink:href') x.removeAttribute(a.name);
        else if((n === 'href' || n === 'src' || n === 'action' || n === 'background' || n === 'poster') && (/^(javascript|vbscript):/.test(v) || (/^data:/.test(v) && !/^data:image\/(png|jpe?g|gif|webp);/.test(v)))) x.removeAttribute(a.name);
        else if(n === 'style' && /expression\(|javascript:/i.test(a.value)) x.removeAttribute(a.name);
      });
      if(x.tagName === 'A'){ x.setAttribute('target', '_blank'); x.setAttribute('rel', 'noopener noreferrer'); }
    });
    return d.body.innerHTML;
  }
