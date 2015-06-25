'use strict';

var vasync = require('vasync');
var restify = require('restify');
var fs = require('fs');
var path = require('path');
var url = require('url');
var certMgmt = require('../../../lib/certificates');
var subuser = require('../../../lib/subuser');
var keys = require('../../../lib/keys');
var config = require('easy-config');

// read sync startup script for DTrace
var startupScript = fs.readFileSync(__dirname + '/data/startup.sh', 'utf8');

var DTRACE_PORT = 8000;
var UNAUTHORIZED_ERROR = 'UnauthorizedError';

var requestMap = {
    GET: 'get',
    PUT: 'put',
    POST: 'post',
    DELETE: 'del',
    HEAD: 'head'
};

var SUBUSER_LOGIN = 'dtrace';
var SUBUSER_OBJ_NAME = 'dtrace';
var SUBUSER_LIST_RULES = [
    'can putobject',
    'can putdirectory', 
    'can getobject', 
    'can getdirectory', 
    'can deleteobject', 
    'can deletedirectory'
];
var DEVTOOLS_MANTA_PATH = '~~/stor/.joyent/devtools';

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
        var certificates = call.req.session.devtoolsCerts;
        var mantaClient = MantaClient.createClient(call);

        options.metadata = options.metadata || {};
        options.metadata['user-script'] = startupScript;
        options.tags = options.tags || {};
        options.tags['JPC_tag'] = 'DTraceHost';

        function uploadKeysAndSetupSubuser(call, keyPair, uploadCallback) {
            vasync.waterfall([
                function (callback) {
                    mantaClient.putFileContents(DEVTOOLS_MANTA_PATH + '/private.key', keyPair.privateKey, function (err) {
                        callback(err);
                    });
                },
                function (callback) {
                    mantaClient.safeMkdirp(DEVTOOLS_MANTA_PATH + '/coreDump', {}, function (err) {
                        callback(err);
                    });
                },
                function (callback) {
                    mantaClient.safeMkdirp(DEVTOOLS_MANTA_PATH + '/flameGraph', {}, function (err) {
                        callback(err);
                    });
                },
                function (callback) {
                    var options = {
                        subuserLogin: SUBUSER_LOGIN,
                        subuserObjName: SUBUSER_OBJ_NAME,
                        path: DEVTOOLS_MANTA_PATH,
                        listRules: SUBUSER_LIST_RULES,
                        keyPair: keyPair
                    };
                    subuser.setupSubuserForManta(call, mantaClient, options, function (err) {
                        callback(err);
                    });
                }
            ], uploadCallback);
        }

        function done(certificates) {
            keys.getKeyPair(mantaClient, call, DEVTOOLS_MANTA_PATH + '/private.key', 'dtrace', function (keyPair) {
                call.req.session.privateKey = keyPair.privateKey;
                options.metadata = certMgmt.setMetadata(options.metadata, certificates);
                options.metadata = subuser.setMetadata(options.metadata, keyPair,
                    SUBUSER_LOGIN, mantaClient.user, mantaClient._url);

                uploadKeysAndSetupSubuser(call, keyPair, function (error) {
                    if (error) {
                        return callback(error);
                    }
                    Machine.Create(call, options, callback);
                });
            });
        }

        if (!certMgmt.areCertificatesLost(certificates)) {
            return done(certificates);
        }
        certMgmt.generateCertificates(mantaClient, DEVTOOLS_MANTA_PATH, function (error, certificates) {
            if (error) {
                return callback(error);
            }
            call.req.session.devtoolsCerts = certificates;
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

            this.jsonClient[requestMap[options.method]](options, function(err, req, res, data) {
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
        this.jsonClient = restify.createJsonClient(this.options);
    }

    createApi(dtraceAPIMethods, Dtrace.prototype);

    api.createClient = function (call, machine, callback) {
        var certificates = call.req.session.devtoolsCerts;
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
    api.DTRACE_CERT_PATH = DEVTOOLS_MANTA_PATH;
    exports.Dtrace = api;
    done();
};
