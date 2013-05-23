'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var config = require('easy-config');
var express = require('express');
var bunyan = require('bunyan');
var Rack = require('easy-asset').Rack;
var Modulizer = require('express-modulizer');
var util = require('util');
var utils = require('./lib/utils');
var RedisStore = require('connect-redis')(express);
var app = express(); // main app

app.use(app.router);
app.use(express.bodyParser());
app.use(express.cookieParser());

app.use(express.session({
    store: new RedisStore({
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
        pass: config.redis.password,
        retry_max_delay: 1000,
        connect_timeout: 1000,
        debug_mode: true,
        ttl: (15 * 60) // 15 minutes
    }),
    secret: 'secret'
}));

var rack = new Rack();
rack.addMiddleware(app);

var log = bunyan.createLogger(config.log);
var compiler = require('./lib/compiler')(rack, config);

var opts = {
    root: 'site',
    config: config,
    log: log,
    main: app,
    extensions: config.extensions,
    compiler: compiler,
    apps: ['main','landing','signup','tropo']
};


var m = new Modulizer(opts);
m.set('utils', utils);

m.init(opts, function (err) {
    app.use(function (res, req, next) {
        var err = new Error('Page not found');
        err.statusCode = 404;

        require('./lib/error')(err, res, req, next);
    });

    app.use(function (err, res, req, next) {
        require('./lib/error')(err, res, req, next);
    });

    app.all('*', function (err, res, req, next) {
        require('./lib/error')(err, res, req, next);
    });

    m.run(config.server.port);
});
