/**
 * We pull in example files from test/examples/*.js. Write your assertions in
 * the file alongside the ES6 class "setup" code. The node `assert` library
 * will already be in the context.
 */

var compile = require('../lib').compile;
var recast = require('recast');
var esprima = require('esprima');

require('example-runner').runCLI({
  context: {
    normalize: function(source) {
      var ast = recast.parse(source, { esprima: esprima });
      return recast.prettyPrint(ast, { esprima: esprima }).code;
    }
  },

  transform: function(source) {
    return compile(source).code;
  }
});
