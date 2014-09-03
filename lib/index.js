/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var through = require('through');
var esprima = require('esprima-fb');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var PathVisitor = types.PathVisitor;

var util = require('ast-util');

assert.ok(
  /harmony/.test(esprima.version),
  'looking for esprima harmony but found: ' + esprima.version
);

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
  var node = path.node;

  this.traverse(path);

  // In the future, ArrowFunctionExpression and FunctionExpression nodes may
  // get new fields (like .async) that we can't anticipate yet, so we simply
  // switch the type and let all the other fields carry over.
  node.type = 'FunctionExpression';

  if (node.expression) {
    node.expression = false;
    node.body = b.blockStatement([b.returnStatement(node.body)]);
  }

  if (node.hasThisExpression) {
    return b.callExpression(
      b.memberExpression(node, b.identifier('bind'), false),
      [b.thisExpression()]
    );
  }
};

/**
 * Ensures that any arrow function directly containing `this` is appropriately
 * marked as such.
 *
 * @param {types.NodePath} path
 * @return {?Node}
 */
ArrowFunctionExpressionVisitor.prototype.visitThisExpression = function(path) {
  var arrowFnPath = this.associatedArrowFunctionPath(path);
  if (arrowFnPath) {
    arrowFnPath.node.hasThisExpression = true;
  }
  this.traverse(path);
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
 * @return {?types.NodePath} The arrow function directly `path`, if any.
 */
ArrowFunctionExpressionVisitor.prototype.associatedArrowFunctionPath = function(path) {
  var scope = path.scope;
  if (n.ArrowFunctionExpression.check(scope.path.node)) {
    return scope.path;
  }
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
    // Use the harmony branch of Esprima that installs with this project
    // instead of the master branch that recast provides.
    esprima: esprima,

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
