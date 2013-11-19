var expect = require('expect.js');
var generate = require('escodegen').generate;
var parse = require('esprima').parse;
var diff = require('json-diff').diffString;
var compile = require('../lib').compile;
var transform = require('../lib').transform;

function normalize(source) {
  return generate(parse(source), { format: { indent: { style: '  ' } } });
}

expect.Assertion.prototype.compileTo = function(expected) {
  this.obj = compile(this.obj);
  this.be(normalize(expected));
};

expect.Assertion.prototype.transform = function(expected) {
  var source = this.obj;
  var actual = transform(parse(source));
  this.assert(
    expect.eql(actual, expected),
    function() {
      return 'expected `' + source + '` to match the given AST, diff:\n' +
        diff(expected, actual);
    },
    function() {
      return 'expected `' + source + '` not to match the given AST, but it did';
    }
  );
};

module.exports = expect;
