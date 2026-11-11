  function btEqual(a, b, subset){
    if(a === b) return true;
    if(a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if(Array.isArray(a) !== Array.isArray(b)) return false;
    var keys = Object.keys(b);
    if((!subset || Array.isArray(b)) && Object.keys(a).length !== keys.length) return false;
    return keys.every(function(k){ return Object.prototype.hasOwnProperty.call(a, k) && btEqual(a[k], b[k], subset); });
  }
  function btMatches(actual, test){
    if(test.mode === 'number') return typeof actual === 'number' && typeof test.expected === 'number' && isFinite(actual) && isFinite(test.expected) && isFinite(test.tolerance) && test.tolerance >= 0 && Math.abs(actual - test.expected) <= test.tolerance;
    return btEqual(actual, test.expected, test.mode === 'subset');
  }
