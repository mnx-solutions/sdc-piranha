'use strict';

var Server = require('./lib/server');

module.exports = function execute(scope, register) {
    register('Server', new Server({log: scope.log}));
};