  /* ---------- плавное закрытие окон и панелей ---------- */
  var NATIVE_HIDDEN = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
  var CLOSE_MS = { tip:140, toast:280, ctx:200, addMenu:200, textMenu:200, ofSide:300, ofAi:320 };
  function noAnim(){ return document.body.classList.contains('noanim') || (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches); }
  function animHidden(node, ms){
    if(!node || node._animHidden) return; node._animHidden = true;
    Object.defineProperty(node, 'hidden', { configurable:true,
      get:function(){ return this._hideT ? true : NATIVE_HIDDEN.get.call(this); },
      set:function(v){
        var self = this; v = !!v;
        if(v && self._hideT) return;                // уже закрывается
        if(self._hideT){
          clearTimeout(self._hideT); self._hideT = null; self.classList.remove('closing');
          if(!v){ self.style.animation = 'none'; void self.offsetWidth; self.style.animation = ''; }   // открыли снова во время закрытия — заново проигрываем появление
        }
        if(v && !NATIVE_HIDDEN.get.call(self) && !noAnim()){
          self.classList.add('closing');
          self._hideT = setTimeout(function(){ self._hideT = null; self.classList.remove('closing'); NATIVE_HIDDEN.set.call(self, true); }, ms);
        } else NATIVE_HIDDEN.set.call(self, v);
      } });
  }
  ['pop', 'ctx', 'addMenu', 'textMenu', 'lib', 'pers', 'builder', 'arcW', 'schemeW', 'resW', 'tplW', 'cmdk', 'eco', 'newModal', 'runp', 'mini', 'tip', 'toast', 'ofSide', 'ofAi']
    .forEach(function(id){ animHidden($(id), CLOSE_MS[id] || 300); });
  function animRemove(node, ms){
    if(!node) return; if(noAnim()){ node.remove(); return; }
    node.classList.add('closing'); node.style.pointerEvents = 'none'; setTimeout(function(){ node.remove(); }, ms || 200);
  }