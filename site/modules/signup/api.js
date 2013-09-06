'use strict';
// This is not useful if it is not used in other modules
module.exports = function execute(scope, register) {
    register('Metadata', require('./lib/metadata'));
};