'use strict';

module.exports = function execute(scope, register) {
    register('Metadata', require('./lib/metadata'));
};