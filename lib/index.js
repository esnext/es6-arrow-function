var parse = require('esprima').parse;
var generate = require('escodegen').generate;

/**
 * Helper to determine the type of the given object. This handles arrays,
 * custom classes, objects, null, undefined, numbers, strings, etc. unlike the
 * native "typeof".
 *
 * @param {*} obj
 * @return {string}
 */
function typeOf(obj) {
  var type = typeof obj;

  switch (type) {
    case 'undefined': case 'number': case 'string':
      return type;
  }

  if (obj === null) {
    return 'null';
  }

  if ((type = obj.constructor.name)) {
    return type.toLowerCase();
  }

  var asString = {}.toString.call(type);
  var spaceIndex = asString.indexOf(' ');

  if (spaceIndex !== -1) {
    return asString.slice(spaceIndex+1, -2).toLowerCase();
  }

  return 'unknown';
}

/**
 * Walks an AST recursively by calling each node with the given iterator. The
 * given iterator can return a replacement node if it wishes to replace the
 * current node inside its parent. To stop walking, return false.
 *
 *   // Replace all "this" with "42".
 *   walk({
 *     type: 'Program',
 *     body: [{
 *       type: 'ExpressionStatement',
 *       expression: { type: 'ThisExpression' }
 *     }]
 *   }, function(node) {
 *     if (node.type === 'ThisExpression') {
 *      return { type: 'Literal', value: 42, raw: '42' };
 *     }
 *   });
 *
 * @param {Object} ast
 * @param {function(Object)} iterator
 * @return {Object}
 */
function walk(ast, iterator) {
  var replacement;

  if (ast && typeof ast.type === 'string') {
    replacement = iterator(ast);

    if (replacement === false) {
      // false === stop walking
      return false;
    }

    if (replacement && typeof replacement.type === 'string') {
      ast = replacement;
    }
  }

  for (var key in ast) {
    if (!ast.hasOwnProperty(key)) { continue; }

    var value = ast[key];
    var r;

    switch (typeOf(value)) {
      case 'object':
        r = walk(value, iterator);
        if (r) { ast[key] = r; }
        break;

      case 'array':
        for (var i = 0; i < value.length; i++) {
          r = walk(value[i], iterator);
          if (r) { value[i] = r; }
        }
        break;
    }
  }

  return ast;
}

/**
 * Transform an Esprima AST generated from ES6 by replacing all
 * ArrowFunctionExpression usages with the non-shorthand FunctionExpression.
 *
 * NOTE: The argument may be modified by this function. To prevent modification
 * of your AST, pass a copy instead of a direct reference:
 *
 *   // instead of compileAST(ast), pass a copy
 *   compileAST(JSON.parse(JSON.stringify(ast));
 *
 * @param {Object} ast
 * @return {Object}
 */
function compileAST(ast) {
  walk(ast, function(node) {
    if (node.type === 'ArrowFunctionExpression') {
      var body;

      if (node.body.type === 'BlockStatement') {
        body = node.body;
      } else {
        body = {
          type: 'BlockStatement',
          body: [
            {
              type: 'ReturnStatement',
              argument: node.body
            }
          ]
        };
      }

      var replacement = {
        type: 'FunctionExpression',
        id: null,
        params: node.params,
        defaults: [],
        body: body,
        rest: null,
        generator: false,
        expression: false
      };

      var foundThisExpression = false;

      walk(node, function(child) {
        // don't look inside non-arrow functions
        if (child.type === 'FunctionExpression') {
          return false;
        }

        if (child.type === 'ThisExpression') {
          foundThisExpression = true;
          return false;
        }
      });

      if (foundThisExpression) {
        replacement = {
          type: 'CallExpression',
          callee: {
            property: {
              type: 'Identifier',
              name: 'bind'
            },
            type: 'MemberExpression',
            computed: false,
            object: replacement
          },
          arguments: [
            {
              type: 'ThisExpression'
            }
          ]
        }
      };

      return replacement;
    }
  });

  return ast;
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
function compile(source) {
  var ast = parse(source);
  ast = compileAST(ast);
  return generate(ast, { format: { indent: { style: '  ' } } });
}

module.exports = {
  compile: compile,
  compileAST: compileAST
};
