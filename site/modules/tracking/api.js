'use strict';

var marketo = require('./lib/marketo');

exports.init = function execute(log, config, done) {
    exports.Marketo = marketo;
    done();
};
