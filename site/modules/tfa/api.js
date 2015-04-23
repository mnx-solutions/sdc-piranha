'use strict';

exports.init = function execute(log, config, done) {
    exports.TFA = require('../../modules/account/lib/metadata');
    done();
};
