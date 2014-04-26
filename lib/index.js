/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var through = require('through');
var esprima = require('esprima');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;

var util = require('ast-util');

assert.ok(
  /harmony/.test(esprima.version),
  'looking for esprima harmony but found: ' + esprima.version
);

/**
 * Visits a node of an AST looking for arrow function expressions. This is
 * intended to be used with the ast-types `traverse()` function.
 *
 * @param {Object} node
 * @this {ast-types.Path}
 */
function visitNode(node) {
  if (!n.ArrowFunctionExpression.check(node)) {
    return;
  }

  if (node.expression) {
    node.expression = false;
    node.body = b.blockStatement([b.returnStatement(node.body)]);
  }

  // In the future, ArrowFunctionExpression and FunctionExpression nodes
  // may get new fields (like .async) that we can't anticipate yet, so we
  // simply switch the type and let all the other fields carry over.
  node.type = 'FunctionExpression';

  var foundThisExpression = false;
  var scope = this.scope.parent;

  types.traverse(node.body, function(child) {
    // don't look inside non-arrow functions
    if (n.Function.check(child) && !n.ArrowFunctionExpression.check(child)) {
      return false;
    }

    if (n.ThisExpression.check(child)) {
      foundThisExpression = true;
    }

    if (util.isReference(this) && child.name === 'arguments') {
      this.replace(util.sharedFor(scope, 'arguments'));
    }
  });

  if (foundThisExpression) {
    this.replace(b.callExpression(
      b.memberExpression(node, b.identifier('bind'), false),
      [b.thisExpression()]
    ));
  }
}

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
  return types.traverse(ast, visitNode);
}

/**
 * Transform JavaScript written using ES6 by replacing all arrow function
 * usages with the non-shorthand "function" keyword.
 *
 *   compile('() => 42'); // 'function() { return 42; };'
 *
 * @param {string} source
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
