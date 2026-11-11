  /* Один путь исполнения кодового блока для доски и тест-кейсов. */
  function blockSnapshot(v){ return v === undefined ? null : JSON.parse(JSON.stringify(v)); }
  function blockPythonSource(code, input, exact){
    var tail = [
      'from triosteum import block as __ts_block',
      '__ts_blocks = __ts_block.__globals__.get("_blocks", [])',
      '__ts_fn = __ts_blocks[-1] if __ts_blocks else globals().get("run")'
    ];
    if(exact) tail.push('if not callable(__ts_fn):', '    raise ValueError("У Python-блока нет функции run(data) или @block")');
    // Общая обёртка сообщает фактический вход, включая sample: такой кейс можно повторить.
    tail.push('import json as __ts_json', '__ts_input = __ts_json.loads(' + JSON.stringify(JSON.stringify(input)) + ')');
    if(!exact) tail.push('if __ts_input is None:', '    __ts_input = getattr(__ts_fn, "_t_sample", None)', '    if __ts_input is None:', '        __ts_input = {"values": [120, 340, 95]}');
    tail.push('if callable(__ts_fn):', '    @__ts_block()', '    def __ts_case(_ignored, _fn=__ts_fn, _data=__ts_input):', '        return {"__triosteum_exec": True, "input": _data, "value": _fn(_data)}');
    return 'run = None\n' + code + '\n\n' + tail.join('\n');
  }
  function executeBlock(n, input, opts){
    opts = opts || {};
    var code = nodeCode(n), space = curId(), original = n, data = blockSnapshot(input);
    function done(r){
      if(n.lang === 'python' && r.ok && r.output && r.output.__triosteum_exec === true){ r.input = r.output.input; r.output = r.output.value; }
      if(opts.capture && r.ok && curId() === space && nodeById(n.id) === original){
        if(!CMP.samples) CMP.samples = {};
        CMP.samples[n.id] = { node:n, space:space, lang:n.lang, code:code, input:blockSnapshot(Object.prototype.hasOwnProperty.call(r, 'input') ? r.input : data), output:blockSnapshot(r.output) };
      }
      return r;
    }
    return Promise.resolve().then(function(){
      if(n.lang === 'python'){
        var source = blockPythonSource(code, data, !!opts.exact);
        if(RUN_SERVER) return serverRun(source, data, 'block');
        return (opts.py ? Promise.resolve(opts.py) : loadPyFor(opts.log || function(){})).then(function(py){
          var stdout = [], stderr = [];
          py.setStdout({ batched:function(t){ stdout.push(t); } });
          py.setStderr({ batched:function(t){ stderr.push(t); } });
          try{
            py.runPython(PY_STUB);
            py.runPython(source);
            py.globals.set('_inp_json', JSON.stringify(data));
            py.runPython(PY_RUN_BOARD);
            var out = py.globals.get('_out_json');
            return { ok:true, output:out ? JSON.parse(out) : null, stdout:stdout.join('\n'), stderr:stderr.join('\n') };
          } catch(e){ return { ok:false, error:String(e && e.message || e), stdout:stdout.join('\n'), stderr:stderr.join('\n') }; }
        });
      }
      if(FOREIGN_LANGS[n.lang]){
        var r = runForeign(n.lang, code, data, { resultName:n.name });
        return { ok:r.ok, output:r.output, error:r.error, stdout:(r.stdout || []).join('\n'), stderr:'', notes:r.notes || [] };
      }
      return { ok:false, error:'Для этого языка нет исполнителя тестов' };
    }).then(done, function(e){ return { ok:false, error:String(e && e.message || e), stdout:'', stderr:'' }; });
  }
