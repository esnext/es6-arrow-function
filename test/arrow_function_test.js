var expect = require('./test_helper');

describe('compile', function() {
  it('empty arrow function returns undefined', function() {
    expect(
      'let empty = () => {};'
    ).to.compileTo(
      'let empty = function() {};'
    );
  });

  it('single parameter case needs no parentheses around parameter list', function() {
    expect(
      'let identity = x => x;'
    ).to.compileTo(
      'let identity = function(x) { return x; };'
    );
  });

  it('no need for parentheses even for lower-precedence expression body', function() {
    expect(
      'let square = x => x * x;'
    ).to.compileTo(
      'let square = function(x) { return x * x; };'
    );
  });

  it('parenthesize the body to return an object literal expression', function() {
    expect(
      'let key_maker = val => ({key: val});'
    ).to.compileTo(
      'let key_maker = function(val) { return {key: val}; };'
    );
  });

  it('statement body needs braces, must use `return` explicitly if not void', function() {
    expect(
      'let odds = evens.map(v => v + 1);'
    ).to.compileTo(
      'let odds = evens.map(function(v) { return v + 1; });'
    );
  });

  it('`=>` has only lexical `this`, no dynamic `this`', function() {
    expect(
      'const obj = { method: function() { return () => this; } };'
    ).to.compileTo(
      'const obj = { method: function() { return (function() { return this; }).bind(this); } };'
    );
  });

  it('handles nested context bindings when `this` is used', function() {
    expect(
      'alert(() => () => this);'
    ).to.compileTo(
      'alert((function() { return (function() { return this; }).bind(this); }.bind(this)));'
    );
  });

  it('does not bind the current context when the `this` is inside a standard function', function() {
    expect(
      '() => function() { return this; };'
    ).to.compileTo(
      '(function() { return function() { return this; }; })'
    );
  });
});

describe('compileAST', function() {
  it('works with an AST instead of strings', function() {
    expect('() => {}').to.compileToAST({
      type: "Program",
      body: [{
        type: "ExpressionStatement",
        expression: {
          type: "FunctionExpression",
          id: null,
          params: [],
          defaults: [],
          body: {
            type: "BlockStatement",
            body: []
          },
          rest: null,
          generator: false,
          expression: false
        }
      }]
    });
  });
});
