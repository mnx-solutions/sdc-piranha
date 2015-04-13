var http = require('http');
var methods = http.METHODS || require('methods');
var util = require('util');
var utils = require('./utils');

methods.push('ws');

var application = require('express/lib/application');
var router = require('express/lib/router');
var express = require('express');

router.child = application.child = function (route, middleware, options) {
    options = options || {};
    var child = express();

    if (!middleware) {
        middleware = [];
    }
    if (Array.isArray(route) || typeof route === 'function') {
        middleware = middleware.concat(route);
        route = '/';
    }
    if (!route) {
        route = '/';
    }

    if (options.locals) {
        Object.keys(options.locals).forEach(function (key) {
            child.locals[key] = options.locals[key];
        });
    } else {
        child.locals = this.locals;
    }

    middleware.unshift(function presetLocals(req, res, next) {
        res.locals = util.clone(child.locals);
        next();
    });

    middleware.push(child);
    this.use(route, middleware);
    return child;
};

var app = express();
var httpServer = http.createServer(app);
var WebSocket = require('ws');
var wss = new WebSocket.Server({noServer: true});
var originalWs = application.ws;

function abortConnection(socket, code, name) {
    try {
        var response = [
            'HTTP/1.1 ' + code + ' ' + name,
            'Content-type: text/html'
        ];
        socket.write(response.concat('', '').join('\r\n'));
    }
    catch (e) { /* ignore errors - we've aborted this connection */ }
    finally {
        // ensure that an early aborted connection is shut down completely
        try { socket.destroy(); } catch (e) {}
    }
}

application.ws = function (route, middleware, callback) {
    if (!callback && typeof middleware === 'function') {
        callback = middleware;
        middleware = [];
    } else if (!callback && middleware.length) {
        callback = middleware.splice(-1)[0];
    }
    if (typeof callback !== 'function') {
        var type = {}.toString.call(callback);
        var msg = 'Route.ws() requires callback functions but got a ' + type;
        throw new Error(msg);
    }

    originalWs.call(this, route, middleware, function (req, res, next) {
        res.progress = true;
        callback(req.wsock, req, next);
    });
};

httpServer.on('upgrade', function (req, socket, upgradeHead) {
    req.method = 'ws';
    var head = new Buffer(upgradeHead.length);
    upgradeHead.copy(head);
    var res = new http.ServerResponse(req);

    wss.handleUpgrade(req, socket, upgradeHead, function (client) {
        req.res = res;
        req.wsock = client;
        res.status = function status(status) {
            if (status !== 200) {
                abortConnection(socket, status, http.STATUS_CODES[status]);
            }
            return this;
        };
        res.end = function end() {
            client.close();
        };
        app.handle(req, res, function (error) {
            if (error) {
                return abortConnection(socket, 500, error.message);
            }
            if (!res.progress) {
                return abortConnection(socket, 404, http.STATUS_CODES[404]);
            }
        });
    });
});

app.listen = function () {
    httpServer.listen.apply(httpServer, arguments);
};

module.exports = app;
