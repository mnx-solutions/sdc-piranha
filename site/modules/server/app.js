'use strict';

var Session = require('./lib/session');

module.exports = function execute(app) {
    var server = require('./').Server;
    app.all('*', Session.get);
    app.get('/call', server.query());
    app.post('/call', server.call());
};
