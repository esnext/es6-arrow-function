var expect = require('expect.js');
var diff = require('json-diff').diffString;
var compile = require('../lib').compile;
var compileAST = require('../lib').compileAST;

describe('compile', function() {
  it('works without arguments', function() {
    expect(compile('$(() => main());')).to.be('$(function () {\n  return main();\n});');
  });

  it('works with a single argument', function() {
    expect(compile('[1, 2, 3].map(n => n * 2);')).to.be('[\n  1,\n  2,\n  3\n].map(function (n) {\n  return n * 2;\n});');
  });

  it('works with a single argument', function() {
    expect(compile('[1, 2, 3].map((n, i) => n * i);')).to.be('[\n  1,\n  2,\n  3\n].map(function (n, i) {\n  return n * i;\n});');
  });
});

describe('compileAST', function() {
  function runFeature(name) {
    var expected = require('./features/expected/'+name+'.json');
    var actual = compileAST(require('./features/inputs/'+name+'.json'));

    try {
      expect(actual).to.eql(expected);
    } catch (ex) {
      console.log('Found a difference in generated AST:', diff(expected, actual));
      throw ex;
    }
  }

  it('works without arguments', function() {
    runFeature('no_arguments');
  });

  it('works with a single argument', function() {
    runFeature('single_argument');
  });

  it('works with multiple arguments', function() {
    runFeature('multiple_arguments');
  });

  it('binds the context when "this" is used', function() {
    runFeature('bind_context');
  });

  it('handles nested context bindings when "this" is used', function() {
    runFeature('nested_context_binding');
  });
});
