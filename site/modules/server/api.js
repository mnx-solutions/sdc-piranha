'use strict';

var Server = require('./lib/server');

module.exports = function (scope, register, callback) {

  register('Server', new Server({log: scope.log}));

  setImmediate(callback);
};