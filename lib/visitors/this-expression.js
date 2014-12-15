var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var PathVisitor = types.PathVisitor;

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
  types.visit(node, this.visitor);
  return this.visitor.hasThisExpression;
};

ThisExpressionVisitor.visitor = new ThisExpressionVisitor();

module.exports = ThisExpressionVisitor;