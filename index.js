'use strict';

//var agent = require('webkit-devtools-agent');
var config = require('easy-config');
var express = require('express');
var bunyan = require('bunyan');
var Modulizer = require('express-modulizer');
var util = require('util');
var utils = require('./lib/utils');
var redirect = require('./lib/redirect');
var SmartCloud = require('./lib/smartcloud');
var version = require('./lib/version');
var RedisStore = require('connect-redis')(express);
var app = express(); // main app

var features = {};

//Modify features to allow 'yes' and 'no'
Object.keys(config.features).forEach(function (feature) {
    var tmp = config.features[feature];
    features[feature] = (tmp === 'yes' || tmp === 'enabled' ? 'enabled' : 'disabled');
});
config.modify({features: features});

app.use(app.router);
app.use(express.urlencoded());
app.use(express.json());
app.use(express.cookieParser());

var lifespan = config.session && config.session.lifespan ? config.session.lifespan : 120; // minutes
app.use(express.session({
    store: new RedisStore({
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
        pass: config.redis.password,
        retry_max_delay: 1000,
        connect_timeout: 1000,
        debug_mode: true,
        ttl: lifespan * 60
    }),
    secret: 'secret'
}));

app.use(function (req, res, next) {
    // Don't save session on res.end, only explicitly
    var end = res.end;
    res.end = function (data, encoding) {
        res.end = end;
        if (!req.session) {
            return res.end(data, encoding);
        }
        req.session.reload(function () {
            res.end(data, encoding);
        });
    };
    next();
});

app.get('/healthcheck', function(req, res, next) {
    res.send('ok');
});

app.get('/version', function (req, res, next) {

    var ret = {};
    version(function (err, gitInfo) {

        if (err) {
            res.send(500, err);
            return;
        }

        if (features.fullVersion !== 'enabled') {
            ret = {
                git: {
                    commitId: gitInfo.commitId
                }
            }
        } else {
            ret = {
                git: gitInfo,
                features: features,
                hostname: require('os').hostname()
            }
        }

        res.send(ret);

    });
});

app.get('/old-browser', require('./lib/old-browser'));

redirect(app); //Add redirects for old urls

config.log.serializers = {
    error: function (err) {
        if (typeof err === 'string') {
            return {
                message: err
            };
        } else {
            return bunyan.stdSerializers.err(err);
        }
    }
};

var log = bunyan.createLogger(config.log);

var opts = {
    root: 'site',
    config: config,
    log: log,
    main: app,
    extensions: config.extensions,
    assets: config.assets,
    apps: ['main','landing','signup']
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
        console.log(err.stack);
    }
    libErr(err, req, res, next);
}

m.init(opts, function (err) {
	if(err) {
		logger.fatal('Failed to initialize modulizer -> %s', err.message);
		process.exit();
	}
    app.use(function (res, req, next) {
        var err = new Error('Page not found');
        err.statusCode = 404;

        error(err, res, req, next);
    });

    app.use(error);

    app.all('*', error);

    m.run(config.server.port);
});

// this code should discover all unhandled error events
var events = require('events'),
    EventEmitter = events.EventEmitter,
    NewEventEmitter = function NewEventEmitter() {
        EventEmitter.apply(this);
        this._events = {
            error: function defaultEmptyErrorHandler(error) {
                if (typeof this._events.error === 'function' || (Array.isArray(this._events.error) && this._events.error.length === 1)) {
                    logger.fatal({error: error}, 'Unhandled error event!');
                }
            }
        };
    };
util.inherits(NewEventEmitter, EventEmitter);
events.EventEmitter = NewEventEmitter;
