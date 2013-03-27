'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var config = require('easy-config');
var express = require('express');
var bunyan = require('bunyan');
var Rack = require('easy-asset').Rack;
var Modulizer = require('express-modulizer');
var Cloud = require('./lib/cloud');
var util = require('util');
var utils = require('./lib/utils');
var app = express(); // main app

app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret:"secret"}));

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
    apps: ['login','main','signup']
};

Cloud.init({
    log: log,
    api: config.cloudapi
}, function (err, cloud) {
    if (err) {
        log.error(err);
        return;
    }

    var m = new Modulizer(opts);
    m.set('cloud', cloud);
    m.set('utils', utils);

    m.init(opts, function (err) {
        m.run(config.server.port);
    });
});