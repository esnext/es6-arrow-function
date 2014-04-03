/* jshint esnext:true */

var dynamicThisGetter = () => function(){ return this; };
assert.equal(
  dynamicThisGetter.toString().replace(/\s+/g, ' '),
  'function () { return function(){ return this; } }'
);
