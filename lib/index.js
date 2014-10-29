/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var through = require('through');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var PathVisitor = types.PathVisitor;

var util = require('ast-util');

/**
 * Visits a node of an AST looking for arrow function expressions. This is
 * intended to be used with the ast-types `visit()` function.
 *
 * @constructor
 * @extends PathVisitor
 */
function ArrowFunctionExpressionVisitor() {
  PathVisitor.call(this);
}
ArrowFunctionExpressionVisitor.prototype = Object.create(PathVisitor.prototype);
ArrowFunctionExpressionVisitor.prototype.constructor = ArrowFunctionExpressionVisitor;

/**
 * Visits arrow function expressions and replaces them with normal functions.
 *
 * @param {types.NodePath} path
 * @return {?Node}
 */
ArrowFunctionExpressionVisitor.prototype.visitArrowFunctionExpression = function(path) {
  this.traverse(path);

  var node = path.node;
  var hasThisExpression = ThisExpressionVisitor.hasThisExpression(node);

  // In the future, ArrowFunctionExpression and FunctionExpression nodes may
  // get new fields (like .async) that we can't anticipate yet, so we simply
  // switch the type and let all the other fields carry over.
  node.type = 'FunctionExpression';

  if (node.expression) {
    node.expression = false;
    node.body = b.blockStatement([b.returnStatement(node.body)]);
  }

  if (hasThisExpression) {
    return b.callExpression(
      b.memberExpression(node, b.identifier('bind'), false),
      [b.thisExpression()]
    );
  }
};

/**
 * Ensures that `arguments` directly contained in arrow functions is hoisted.
 *
 * @param {types.NodePath} path
 * @return {?Node}
 */
ArrowFunctionExpressionVisitor.prototype.visitIdentifier = function(path) {
  var node = path.node;

  if (node.name === 'arguments' && util.isReference(path)) {
    var functionScope = this.associatedFunctionScope(path);
    if (functionScope) {
      return util.sharedFor(functionScope, node.name);
    }
  }

  this.traverse(path);
};

/**
 * @private
 * @param {types.NodePath} path
 * @return {?types.Scope} The nearest non-arrow function scope above `path`.
 */
ArrowFunctionExpressionVisitor.prototype.associatedFunctionScope = function(path) {
  var scope = path.scope;
  while (scope && n.ArrowFunctionExpression.check(scope.path.node)) {
    scope = scope.parent;
  }
  return scope;
};

/**
 * Assists ArrowFunctionExpressionVisitor by finding `this`.
 *
 * @extends PathVisitor
 * @constructor
 */
function ThisExpressionVisitor() {
  PathVisitor.call(this);
}
ThisExpressionVisitor.prototype = Object.create(PathVisitor.prototype);
ThisExpressionVisitor.prototype.constructor = ThisExpressionVisitor;

/**
 * Indicates whether this visitor has visited a `this` expression.
 *
 * @type {boolean}
 */
ThisExpressionVisitor.prototype.hasThisExpression = false;

/**
 * Marks this visitor as having seen a `this` expression.
 *
 * @param {NodePath} path
 */
ThisExpressionVisitor.prototype.visitThisExpression = function(path) {
  this.visitor.hasThisExpression = true;
  return false;
};

/**
 * Traverses deeper into arrow functions because they share `this` with their
 * containing environment, but does not traverse into regular functions.
 *
 * @param {NodePath} path
 * @returns {boolean}
 */
ThisExpressionVisitor.prototype.visitFunction = function(path) {
  if (n.ArrowFunctionExpression.check(path.node)) {
    this.traverse(path);
  } else {
    return false;
  }
};

/**
 * Convenience method for determining whether the given node has a `this`
 * referred to at its scope.
 *
 * @example
 *
 * Given this code, this method would return `true`:
 *
 *    ```js
 *    var a = () => this;
 *    ```
 *
 * But this code would make it return `false`:
 *
 *    ```js
 *    var a = () => function() { return this; };
 *    ```
 *
 * @param node
 * @returns {boolean}
 */
ThisExpressionVisitor.hasThisExpression = function(node) {
  var visitor = new ThisExpressionVisitor();
  types.visit(node, visitor);
  return visitor.hasThisExpression;
};

/**
 * Transform an Esprima AST generated from ES6 by replacing all
 * ArrowFunctionExpression usages with the non-shorthand FunctionExpression.
 *
 * NOTE: The argument may be modified by this function. To prevent modification
 * of your AST, pass a copy instead of a direct reference:
 *
 *   // instead of transform(ast), pass a copy
 *   transform(JSON.parse(JSON.stringify(ast));
 *
 * @param {Object} ast
 * @return {Object}
 */
function transform(ast) {
  return types.visit(ast, new ArrowFunctionExpressionVisitor());
}

/**
 * Transform JavaScript written using ES6 by replacing all arrow function
 * usages with the non-shorthand "function" keyword.
 *
 *   compile('() => 42'); // 'function() { return 42; };'
 *
 * @param {string} source
 * @param {object} mapOptions
 * @return {string}
 */
function compile(source, mapOptions) {
  mapOptions = mapOptions || {};

  var recastOptions = {
    sourceFileName: mapOptions.sourceFileName,
    sourceMapName: mapOptions.sourceMapName
  };

  var ast = recast.parse(source, recastOptions);
  return recast.print(transform(ast), recastOptions);
}

module.exports = function() {
  var data = '';
  return through(write, end);

  function write(buf) { data += buf; }
  function end() {
      this.queue(module.exports.compile(data).code);
      this.queue(null);
  }
};

module.exports.compile = compile;
module.exports.transform = transform;
