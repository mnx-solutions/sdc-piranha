'use strict';

var Session = require('./lib/session');

module.exports = function execute(scope, app) {
    var server = scope.api('Server');

    app.all('*', Session.get);
    app.get('/call', server.query());
    app.post('/call', server.call());
};