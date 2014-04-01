var assert = require('assert');
var parse = require('esprima').parse;
var through = require('through');
var guessTabWidth = require('./util').guessTabWidth;
var esprimaHarmony = require("esprima");
var recast = require('recast');
var types = require('ast-types');
var n = types.namedTypes;
var b = types.builders;

assert.ok(
  /harmony/.test(esprimaHarmony.version),
  'looking for esprima harmony but found: ' + esprimaHarmony.version
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

  var body;

  if (n.BlockStatement.check(node.body)) {
    body = node.body;
  } else {
    body = b.blockStatement([b.returnStatement(node.body)]);
  }

  var replacement = b.functionExpression(null, node.params, body);
  var foundThisExpression = false;

  types.traverse(node, function(child) {
    // don't look inside non-arrow functions
    if (n.FunctionExpression.check(child)) {
      return false;
    }

    if (n.ThisExpression.check(child)) {
      foundThisExpression = true;
      return false;
    }
  });

  if (foundThisExpression) {
    replacement = b.callExpression(
      b.memberExpression(replacement, b.identifier('bind'), false),
      [b.thisExpression()]
    );
  }

  this.replace(transform(replacement));
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
    tabWidth: guessTabWidth(source),
    // Use the harmony branch of Esprima that installs with regenerator
    // instead of the master branch that recast provides.
    esprima: esprimaHarmony,

    sourceFileName: mapOptions.sourceFileName,
    sourceMapName: mapOptions.sourceMapName
  };

  var ast = recast.parse(source, recastOptions);
  return recast.print(transform(ast), recastOptions);
}

module.exports = function () {
  var data = '';
  return through(write, end);

  function write (buf) { data += buf }
  function end () {
      this.queue(require('../').compile(data).code);
      this.queue(null);
  }
}

module.exports.compile = compile;
module.exports.transform = transform;
