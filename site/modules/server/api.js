'use strict';

var Server = require('./lib/server');

exports.init = function execute(log, config, done) {
    exports.Server = new Server({log: log});
    done();
};
