var expect = require('expect.js');
var recast = require('recast');
var esprimaHarmony = require("esprima");
var compile = require('../lib').compile;
var transform = require('../lib').transform;

var recastOptions = {
  tabWidth: 2,
  esprima: esprimaHarmony
};

function normalize(source) {
  return recast.prettyPrint(recast.parse(source, recastOptions), recastOptions);
}

expect.Assertion.prototype.compileTo = function(expected) {
  this.obj = normalize(compile(this.obj));
  this.be(normalize(expected));
};

module.exports = expect;
