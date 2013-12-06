'use strict';

var marketo = require('./lib/marketo');

module.exports = function execute(scope, register) {
    register('Marketo', marketo);
};