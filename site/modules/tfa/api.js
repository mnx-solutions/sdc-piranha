'use strict';

module.exports = function execute(scope, register) {
    register('TFA', require('../../modules/account/lib/metadata'));
};