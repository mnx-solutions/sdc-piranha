'use strict';

var vasync = require('vasync');
var restify = require('restify');
var fs = require('fs');
var path = require('path');
var url = require('url');
var certMgmt = require('../../../lib/certificates');

// read sync startup script for DTrace
var startupScript = fs.readFileSync(__dirname + '/data/startup.sh', 'utf8');

var DTRACE_PORT = 8000;
var DTRACE_CERT_PATH = '~~/stor/.joyent/dtrace';
var UNAUTHORIZED_ERROR = 'UnauthorizedError';

var requestMap = {
    GET: 'get',
    PUT: 'put',
    POST: 'post',
    DELETE: 'del',
    HEAD: 'head'
};

function formatUrl(url, params) {
    // noinspection JSLint
    return url.replace(/(?::(\w+))/g, function (part, key) {
        var value = params[key];
        delete params[key];
        return value;
    });
}

exports.init = function execute(log, config, done) {
    var api = {};
    var MantaClient = require('../storage').MantaClient;

    api.createHost = function (call, options, callback) {
        delete options.specification;
        var Machine = require('../machine').Machine;
        var certificates = call.req.session.dtrace;
        var mantaClient = MantaClient.createClient(call);

        options.metadata = options.metadata || {};
        options.metadata['user-script'] = startupScript;
        options.tags = options.tags || {};
        options.tags['JPC_tag'] = 'DTraceHost';

        function done(certificates) {
            ['ca', 'server-cert', 'server-key'].forEach(function (file) {
                options.metadata[file] = certificates[file];
            });
            Machine.Create(call, options, callback);
        }

        if (certificates.ca) {
            return done(certificates);
        }
        certMgmt.generateCertificates(mantaClient, DTRACE_CERT_PATH, function (error, certificates) {
            if (error) {
                return callback(error);
            }
            call.req.session.dtrace = certificates;
            call.req.session.save(function (error) {
                if (error) {
                    return call.done(error);
                }
                done(certificates);
            });
        });
    };

    function createMethod(opts) {
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
                log: log,
                path: formatUrl(opts.path, params),
                method: opts.method || 'GET',
                retries: false,
                connectTimeout: 5000
            };

            var client = restify.createJsonClient(this.options);
            client[requestMap[options.method]](options, function(err, req, res, data) {
                if (err && err.statusCode !== 200) {
                    var message = err.name === UNAUTHORIZED_ERROR ? err.toString() : err.message || 'DTrace host is Unreachable';
                    return callback(new Error(message));
                }
                callback(err, data);
            });
        };
    }

    function createApi(map, container) {
        var name;
        for (name in map) {
            if (map.hasOwnProperty(name)) {
                container[name] = createMethod(map[name]);
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

    createApi(dtraceAPIMethods, Dtrace.prototype);

    api.createClient = function (call, machine, callback) {
        var certificates = call.req.session.dtrace;
        if (!certificates.ca) {
            return callback('Certificates were lost. Cannot connect to dtrace.');
        }

        callback(null, new Dtrace({
            url: 'https://' + machine + ':' + DTRACE_PORT,
            rejectUnauthorized: false,
            requestCert: true,
            ca: certificates.ca,
            cert: certificates.cert,
            key: certificates.key,
            host: machine,
            headers: {
                'Content-type': 'application/json'
            }
        }, call));
    };
    api.DTRACE_CERT_PATH = DTRACE_CERT_PATH;
    exports.Dtrace = api;
    done();
};
