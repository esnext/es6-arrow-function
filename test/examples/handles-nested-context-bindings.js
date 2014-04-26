/* jshint esnext:true */

var obj = {
  method: function() {
    return () => (this, () => this);
  }
};

assert.strictEqual(obj.method()()(), obj);
