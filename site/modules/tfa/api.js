'use strict';

module.exports = function execute(scope, register) {

    var api = require('./lib/TFAToggle');
    register('TFA', api);
};