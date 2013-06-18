'use strict';

var config = require('easy-config');
var express = require('express');
var bunyan = require('bunyan');
var Rack = require('easy-asset').Rack;
var Modulizer = require('express-modulizer');
var util = require('util');
var utils = require('./lib/utils');
var redirect = require('./lib/redirect');
var SmartCloud = require('./lib/smartcloud');
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

app.get('/healthcheck', function(req, res, next) {
    res.send('ok');
});

var oldBrowser = require('./lib/oldBrowser');
app.get('/old-browser', function(req, res, next) {
   oldBrowser(req, res, next);
});

redirect(app); //Add redirects for old urls

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


if(!config.cloudapi || !config.cloudapi.keyPath || typeof config.cloudapi.keyPath !== 'string') {
    throw new TypeError('cloudapi configuration (.keyPath) must be defined');
}

var logger = bunyan.createLogger(config.log);
var smartCloud = new SmartCloud({
    log: logger,
    api: config.cloudapi
});
m.set('smartCloud', smartCloud);

var libErr = require('./lib/error');

function error(err, req, res, next) {
    if(err.statusCode === 404) {
        logger.warn('Requested path not found @' + req.originalUrl);
    } else {
        logger.error('Request ended with error', err);
    }
    libErr(err, req, res, next);
}

m.init(opts, function (err) {
    app.use(function (res, req, next) {
        var err = new Error('Page not found');
        err.statusCode = 404;

        error(err, res, req, next);
    });

    app.use(error);

    app.all('*', error);

    m.run(config.server.port);
});
