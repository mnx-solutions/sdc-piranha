'use strict';

var vasync = require('vasync');
var restify = require('restify');
var fs = require('fs');
var qs = require('querystring');

// read sync startup script for DTrace
var startupScript = fs.readFileSync(__dirname + '/data/startup.sh', 'utf8');

var DTRACEPORT = 8000;

var requestMap = {
    GET: 'get',
    PUT: 'put',
    POST: 'post',
    DELETE: 'del',
    HEAD: 'head'
};

function HostUnreachable(host) {
    this.message = 'DTrace host "' + (host.name || host.primaryIp) + '" is unreachable.';
}

function formatUrl(url, params) {
    // noinspection JSLint
    return url.replace(/(?::(\w+))/g, function (part, key) {
        var value = params[key];
        delete params[key];
        return value;
    });
}

module.exports = function execute(scope, register) {
    var api = {};

    api.createHost = function (call, options, callback) {
        delete options.specification;
        var Machine = scope.api('Machine');

        options.metadata = options.metadata || {};
        options.metadata['user-script'] = startupScript;
        options.tags = options.tags || {};
        options.tags['JPC_tag'] = 'DTraceHost';

        Machine.Create(call, options, callback);
    };

    function createMethod(scope, opts) {
        return function (params, callback) {
            if (!callback) {
                callback = params;
                params = {};
            }
            if (!callback) {
                callback = function () {};
            }
            if (!params) {
                params = {};
            }

            var options = {
                log: scope.log,
                path: formatUrl(opts.path, params),
                method: opts.method || 'GET'
            };

            var client = restify.createJsonClient(this.options);
            client[requestMap[options.method]](options, function (err, req, res, data) {
                callback(err, data);
            });
        };
    }

    function createApi(scope, map, container) {
        var name;
        for (name in map) {
            if (map.hasOwnProperty(name)) {
                container[name] = createMethod(scope, map[name]);
            }
        }
    }

    var dtraceAPIMethods = {
        ping: {
            path: '/healthcheck'
        },
        listProcesses: {
            path: '/process-list'
        }
    };

    function Dtrace(options) {
        this.options = options;
    }

    createApi(scope, dtraceAPIMethods, Dtrace.prototype);

    api.createClient = function (call, machine, callback) {
        return callback(null, new Dtrace({
            url: 'http://' + machine + ':' + DTRACEPORT,
            host: machine,
            headers: {
                'Content-type': 'application/json'
            }
        }, call));
    };

    register('Dtrace', api);
};
