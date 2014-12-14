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
 * In order to optimize the visitor we use a specific one for parsing the body
 * of the arrow function. This way very common types like Identifier are only
 * visited under the subtree we're interested in.
 *
 * @returns {BodyVisitor}
 */
ArrowFunctionExpressionVisitor.prototype.getBodyVisitor = function() {
  if (!this.bodyVisitor) {
    this.bodyVisitor = new BodyVisitor();
  }
  return this.bodyVisitor;
};

/**
 * Visits arrow function expressions and replaces them with normal functions.
 *
 * @param {NodePath} path
 * @return {?Node}
 */
ArrowFunctionExpressionVisitor.prototype.visitArrowFunctionExpression = function(path) {
  // Descend into the body using a specific visitor
  this.traverse(path, this.getBodyVisitor());

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
 * Visits the body of an arrow function expressions.
 *
 * @constructor
 * @private
 * @extends PathVisitor
 */
function BodyVisitor() {
  PathVisitor.call(this);
}
BodyVisitor.prototype = Object.create(ArrowFunctionExpressionVisitor.prototype);
BodyVisitor.prototype.constructor = ArrowFunctionExpressionVisitor;

/**
 * Body visitor traverses arrow function bodies with itself.
 *
 * @returns {BodyVisitor}
 */
BodyVisitor.prototype.getBodyVisitor = function() {
  return this;
};

/**
 * Ensures that `arguments` directly contained in arrow functions is hoisted.
 *
 * @param {NodePath} path
 * @return {?Node|boolean}
 */
BodyVisitor.prototype.visitIdentifier = function(path) {
  var node = path.node;

  if (node.name === 'arguments' && util.isReference(path)) {
    var functionScope = this.associatedFunctionScope(path);
    if (functionScope) {
      return util.sharedFor(functionScope, node.name);
    }
  }

  return false;  // nothing else to look at here
};

/**
 * @private
 * @param {NodePath} path
 * @return {?Scope} The nearest non-arrow function scope above `path`.
 */
BodyVisitor.prototype.associatedFunctionScope = function(path) {
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
