var server = require('./lib/http-server');
var loadAPIs = require('./lib/api');
var version = require('./lib/version');

var gulp = require('gulp');
var fs = require('fs');
var path = require('path');
var util = require('util');
var es = require('event-stream');
var less = require('less');

var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var cssmin = require('gulp-cssmin');
var gzip = require('gulp-gzip');

var config = require('easy-config');
var bunyan = require('bunyan');
var express = require('express');
var logger = bunyan.createLogger(config.extend({log: {
        src: true,
        serializers: {
            error: function (err) {
                var result;
                if (typeof err === 'string') {
                    result = {
                        message: err
                    };
                } else {
                    result = bunyan.stdSerializers.err(err);
                }
                return result;
            },
            obj: function (obj) {
                var cloneNode = function (node) {
                    var result;
                    if (!node || typeof (node) !== 'object') {
                        result = node;
                    } else {
                        result = {};
                        for (var key in node) {
                            if (node.hasOwnProperty(key) && key !== 'metadata') {
                                result[key] = cloneNode(node[key]);
                            }
                        }
                    }

                    return result;
                };
                return cloneNode(obj);
            }
        }
    }}).log);

var features = require('./lib/features');
var utils = require('./lib/utils');
var redirect = require('./lib/redirect');
var oldBrowserRoutes = require('./lib/old-browser');
var displayError = require('./lib/error');
var resolveIfExists = utils.resolveIfExists;
var requireIfExists = utils.requireIfExists;
var sync = utils.sync;

var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);

var lifespan = config.session && config.session.lifespan ? config.session.lifespan : 120; // minutes

server.set('view engine', 'jade');
server.use(function (req, res, next) {
    req.log = logger;
    req.config = config;
    next();
});
server.use(bodyParser.urlencoded({extended: false}));
server.use(bodyParser.json());
server.use(cookieParser());

server.use(session({
    resave: false,
    saveUninitialized: true,
    store: new RedisStore({
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
        pass: config.redis.password,
        'retry_max_delay': 1000,
        'connect_timeout': 1000,
        'debug_mode': true,
        ttl: lifespan * 60
    }),
    secret: 'secret'
}));

server.use(function (req, res, next) {
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

server.get('/healthcheck', function(req, res, next) {
    res.send('ok');
});

server.get('/version', function (req, res, next) {

    var ret = {};
    version(function (err, gitInfo) {

        if (err) {
            res.sendStatus(500).send(err);
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

server.get('/old-browser', oldBrowserRoutes);

redirect(server); //Add redirects for old urls

var defaults = {
    site: path.resolve('./site'),
    apps: path.resolve('./site/apps'),
    modules: path.resolve('./site/modules')
};

function getAppMiddleware(appPath, parentMiddleware) {
    parentMiddleware = parentMiddleware || {};
    var appConfig = requireIfExists(appPath, 'package.json'),
        modules = appConfig.modules,
        middleware = {
            beforeAuth: requireIfExists(appPath, 'before-auth.js') || parentMiddleware.beforeAuth,
            auth: requireIfExists(appPath, 'auth.js') || parentMiddleware.auth,
            afterAuth: requireIfExists(appPath, 'after-auth.js') || parentMiddleware.afterAuth,
            other: [].concat(parentMiddleware.other || [])
        };

    if (modules) {
        modules.forEach(function (module) {
            var moduleMiddleware = requireIfExists(defaults.modules, module, 'middleware.js');
            if (typeof moduleMiddleware === 'function' || Array.isArray(moduleMiddleware)) {
                middleware.other = middleware.other.concat(moduleMiddleware)
                    .filter(function (middleware) {
                        return typeof middleware === 'function';
                    });
            }
        });
    }

    return middleware;
}

function normalizeMiddleware(middleware) {
    var other = [].slice.call(arguments, 1);
    return [].concat.call([], middleware.beforeAuth, middleware.auth, middleware.afterAuth, middleware.other, other)
        .filter(function (middleware) {
            return typeof middleware === 'function';
        });
}

function loadDir(root, dir, out) {
    out = Array.isArray(out) ? out : [];
    fs.readdirSync(dir).forEach(function (file) {
        var filePath = path.join(dir, file);
        out.push({
            _id: filePath.slice(root.length + 1),
            _content: fs.readFileSync(filePath, 'utf8')
        });
    });
    return out;
}

function populateLocals(options) {
    var index = resolveIfExists(options.path, 'index.html');

    if (index) {
        options.app.locals.layouts.push({
            module: options.name,
            data: fs.readFileSync(index, 'utf8')
        });
    }
    ['partials', 'lang'].forEach(function (dirName) {
        var dir = resolveIfExists(options.path, 'static', dirName);
        if (dir) {
            loadDir(defaults.modules, dir, options.app.locals[dirName]);
        }
    });
}

function compileJs(js) {
    var stream = gulp.src(js)
        .pipe(concat('cache/all-' + Math.random().toString(16).substr(2) + '.js'));

    if (config.assets.js.minify) {
        stream = stream.pipe(uglify({
            fromString: true,
            mangle: false
        }));
    }
    if (config.assets.js.gzip) {
        stream = stream.pipe(gzip({append: false}))
    }
    return stream;
}

function transformCss(options) {
    var stream = sync(function (data, done) {
        var root;
        var isModule;
        var isVendor = data.path.indexOf('static/vendor') > -1;
        if (data.path.indexOf(defaults.modules) === 0) {
            root = defaults.modules;
            isModule = true;
        } else if (data.path.indexOf(defaults.apps) === 0) {
            root = defaults.apps;
        } else if (data.path.indexOf(defaults.site) === 0) {
            root = defaults.site;
        }

        var contents = data.contents.toString();
        // replace all relative paths to absolute
        contents = contents.replace(/url\(([^\)]+)\)/g, function (orig, url) {
            url = url.replace(/^['"]|["']$/g, '');
            if (!url.indexOf('data:')) {
                return orig;
            }
            var base = data.path.substr(root.length),
                result;
            if (url.indexOf('//') === 0) {
                result = url;
            } else
            if (url.indexOf('http') === 0) {
                result = url.replace(/(?:https?:?\/\/)/g, '//');
            } else
            // relative: /img/image.jpg
            // absolute: /static/img/image.jpg
            if (url.charAt(0) === '/') {
                result = '/' + path.join('static', url);
            } else
            // relative: img/image.jpg
            // absolute: /main/account/static/img/image.jpg
            if (isModule) {
                result = path.join(options.config.route, base, '../', url);
            } else {
                // relative: img/image.jpg
                // absolute: /main/static/img/image.jpg
                result = path.join('/', base, '../', url);
            }

            return 'url("' + result + '")';
        });

        if (!isVendor && isModule) {
            var moduleName = data.path.substr(defaults.modules.length + 1).split('/')[0];
            less.render('.modulizer-module-' + moduleName + '{' + contents + '}', function (error, contents) {
                if (error) {
                    logger.error({error: error, module: moduleName, path: data.path}, 'Less compilation error');
                    return done(null, data);
                }
                data.contents = new Buffer(contents);
                done(null, data);
            });
            return;
        }
        data.contents = new Buffer(contents);
        done(null, data);
    });
    return stream;
}

function compileCss(options, css) {
    var stream = gulp.src(css)
        .pipe(transformCss(options))
        .pipe(concat('cache/all-' + Math.random().toString(16).substr(2) + '.css'));

    if (config.assets.css.minify) {
        stream = stream.pipe(cssmin());
    }
    if (config.assets.css.gzip) {
        stream = stream.pipe(gzip({append: false}));
    }
    return stream;
}

function normalizePath() {
    var args = [].slice.call(arguments);
    return function (file) {
        return file && path.join.apply(path, [].concat(args, file));
    }
}

function getStaticScripts(options, type) {
    var config = options.config.static;
    var scripts = config ? config[type] : [];
    return [].concat(scripts).map(normalizePath(options.path, 'static'));
}

function prepareCache(options) {
    var optsCopy = options;
    var js = [];
    var vendorCss = [];
    var css = [];
    var modules;
    var moduleJs;
    var moduleVendorCss;
    var moduleCss;

    function collectScripts(folder) {
        moduleJs = moduleJs.concat(
            path.resolve(folder, 'vendor', '**/*.js'),
            path.resolve(folder, 'js', '*.js'),
            path.resolve(folder, 'js', '**/*.js')
        );
        moduleVendorCss = moduleVendorCss.concat(
            path.resolve(folder, 'vendor', '**/*.css')
        );
        moduleCss = moduleCss.concat(
            path.resolve(folder, '**/*.css')
        );
    }

    do {
        modules = options.config.modules || [];
        moduleJs = getStaticScripts(options, 'js');
        moduleVendorCss = [];
        moduleCss = getStaticScripts(options, 'css');

        collectScripts(path.join(options.path, 'static'));
        modules.reverse().forEach(function (module) {
            var staticDir = resolveIfExists(defaults.modules, module, 'static');
            if (staticDir) {
                collectScripts(staticDir);
            }
        });
        js = js.concat(moduleJs.reverse());
        vendorCss = vendorCss.concat(moduleVendorCss.reverse());
        css = css.concat(moduleCss.reverse());
        options = options.parent;
    } while (options);

    js = js.reverse().filter(function (str) {
        return str;
    });

    css = [].concat(vendorCss.reverse(), css.reverse()).filter(function (str) {
        return str;
    });

    return es.merge(
        compileJs(js),
        compileCss(optsCopy, css)
    );
}

function registerCache(options) {
    var cachePath = [].slice.call(arguments, 1);
    var contentTypes = {
        js: 'application/javascript',
        css: 'text/css'
    };
    return sync(function (cache, done) {
        var filename = path.join.apply(path, [].concat(cachePath, path.basename(cache.path)));
        filename = path.join('/', filename);
        var localName = path.extname(filename).substr(1);
        options.app.get(filename, function (req, res) {
            res.set('Content-Type', contentTypes[localName]);
            if (config.assets[localName].gzip) {
                res.set('Content-Encoding', 'gzip');
                res.set('Vary', 'Accept-Encoding');
            }
            res.end(cache.contents);
        });

        options.app.locals[localName].push({
            _url: path.join(options.config.route, filename)
        });
        done();
    });
}

function applyModule(options, complete) {
    function done() {
        complete.apply(this, arguments);
    }
    var moduleConfig = requireIfExists(options.path, 'package.json');
    var staticDir = resolveIfExists(options.path, 'static');
    var appRoutes = requireIfExists(options.path, 'app.js');
    var webSocketRoutes = requireIfExists(options.path, 'ws.js');
    var startup = requireIfExists(options.path, 'startup.js');
    var appMiddleware = getAppMiddleware(options.path, options.middleware);
    var index = resolveIfExists(options.path, 'index.jade');

    options.config = moduleConfig;
    if (staticDir) {
        options.app.use('/static', normalizeMiddleware(appMiddleware, express.static(staticDir)));
    }
    if (typeof appRoutes === 'function') {
        appRoutes(options.app, options.log, config);
    }
    if (typeof webSocketRoutes === 'function') {
        webSocketRoutes(options.app, options.log, config);
    }
    if (typeof startup === 'function') {
        startup(options.log, config);
    }

    if (index) {
        options.app.get('/', normalizeMiddleware(appMiddleware, function (req, res) {
            if (req.originalUrl.substr(-1) !== '/') {
                return res.redirect(req.originalUrl + '/');
            }
            res.render(index);
        }));
    }

    populateLocals(options);
    var stream;
    if (moduleConfig.applications) {
        stream = sync(function (application, callback) {
            var appConfig = requireIfExists(defaults.apps, application, 'package.json');
            options.log.debug('Registering application "%s" -> %s', application, appConfig.route);
            applyModule({
                name: application,
                parent: options,
                app: server.child(appConfig.route, null, {locals: {
                    js: [],
                    jss: [],
                    css: [],
                    partials: [],
                    layouts: []
                }}),
                root: defaults.apps,
                path: path.resolve(defaults.apps, application),
                log: options.log.child({app: application}),
                middleware: appMiddleware
            }, callback);
        }, done);
        moduleConfig.applications.forEach(stream.write.bind(stream));
        stream.end();
    } else if (moduleConfig.modules) {
        stream = sync(function (module, callback) {
            applyModule({
                name: module,
                parent: options,
                app: options.app.child('/' + module, normalizeMiddleware(appMiddleware)),
                root: defaults.modules,
                path: path.resolve(defaults.modules, module),
                log: options.log.child({module: module})
            }, callback);
        }, function () {
            prepareCache(options)
                .pipe(registerCache(options, 'cache'))
                .on('finish', done);
        });
        loadAPIs(options.path, {log: options.log}, function () {
            options.log.info('Loading api complete.');
            moduleConfig.modules.forEach(stream.write.bind(stream));
            stream.end();
        });
    } else {
        done();
    }
}

function error(err, req, res, next) {
    if (err.statusCode === 404) {
        logger.warn('Requested path not found @' + req.originalUrl);
    } else if (err.statusCode === 403 && err.message && err.message.indexOf('getuser') !== -1) {
        logger.info('Not authorized to access this path', err);
    } else {
        logger.error('Request ended with error', err);
    }
    displayError(err, req, res, next);
}

function throwNotFound(req, res, next) {
    var err = new Error('Page not found');
    err.statusCode = 404;
    error(err, req, res, next);
}

gulp.task('serve', function (done) {
    applyModule({
        name: 'site',
        root: defaults.site,
        path: defaults.site,
        app: server,
        log: logger.child({lvl: 'site'})
    }, function () {
        server.use(throwNotFound);
        server.use(error);
        server.all('*', error);

        server.listen(config.server.port, function () {
            logger.info('Server listening on ' + config.server.port);
            if (typeof done === 'function') {
                done();
            }
        });
    });
});

var events = require('events');
var EventEmitter = events.EventEmitter;
var NewEventEmitter = function NewEventEmitter() {
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
