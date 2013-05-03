'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var config = require('easy-config');
var express = require('express');
var bunyan = require('bunyan');
var Rack = require('easy-asset').Rack;
var Modulizer = require('express-modulizer');
var util = require('util');
var utils = require('./lib/utils');
var redisStore = require('connect-redis')(express);
var app = express(); // main app

app.use(express.bodyParser());
app.use(express.cookieParser());

app.use(express.session({
    store: new redisStore({
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db
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
    apps: ['main','landing','signup']
};


var m = new Modulizer(opts);
m.set('utils', utils);

m.init(opts, function (err) {
    m.run(config.server.port);
});
