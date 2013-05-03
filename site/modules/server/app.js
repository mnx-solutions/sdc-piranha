'use strict';

var Session = require('./lib/session');

module.exports = function (scope, app, callback) {

    var server = scope.api('Server');

    app.all('*', Session.get);

    app.get('/call', server.query());

    app.post('/call', server.call());

    setImmediate(callback);
};