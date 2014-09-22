"use strict";

var restify = require('restify');
var qs = require('querystring');
var vasync = require('vasync');
var fs = require('fs');
var config = require('easy-config');
var ursa = require('ursa');
var exec = require('child_process').exec;
var os = require('os');
var EventEmitter = require('events').EventEmitter;

var requestMap = {
    'GET': 'get',
    'PUT': 'put',
    'POST': 'post',
    'DELETE': 'del',
    'HEAD': 'head'
};

// read sync startup script for Docker
var startupScript = fs.readFileSync(__dirname + '/data/startup.sh', 'utf8');

function formatUrl(url, params) {
    //noinspection JSLint
    return url.replace(/(?::(\w+))/g, function (part, key) {
        var value = params[key];
        delete params[key];
        return value;
    });
}

function createCallback(callback, raw) {
    //noinspection JSLint
    return function (error, req, res, data) {
        if (error) {
            return callback(error);
        }
        if (raw) {
            data = res.body.toString();
        }
        callback(null, data);
    };
}

function createMethod(opts) {
    return function (params, callback) {
        if (!callback) {
            callback = params;
            params = {};
        }
        if (!callback) {
            callback = function () {};
        }


        var options = {
            log: this.client.log,
            path: formatUrl(opts.path, params),
            method: opts.method || 'GET'
        };
        var query = {};
        var param;

        for (param in opts.params) {
            if (opts.params.hasOwnProperty(param)) {
                if (params.hasOwnProperty(param)) {
                    query[param] = params[param];
                    delete params[param];
                } else if (opts.params[param] !== '=') {
                    query[param] = opts.params[param];
                }
            }
        }
        options.path += '?' + qs.stringify(query);
        if (options.method === 'POST' || options.method === 'PUT') {
            options.data = params;
        }

        this.client[requestMap[options.method]](options, createCallback(callback, opts.raw));
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

module.exports = function execute(scope, register) {
    var Manta = scope.api('MantaClient');
    var disableTls = Boolean(config.docker && config.docker.disableTls);
    var queuedRequests = {};
    var api = {};

    // http://docs.docker.com/reference/api/docker_remote_api_v1.14/
    var dockerAPIMethods = {
        containers   : {
            method: 'GET',
            path: '/containers/json',
            params: {
                size   : '=',
                all    : '='
            }
        },
        inspect      : {
            method: 'GET',
            path: '/containers/:id/json'
        },
        logs         : {
            method: 'GET',
            path: '/containers/:id/logs',
            raw: true,
            params: {
                stdout     : true,
                stderr     : true,
                timestamps : true,
                tail       : 100
            }
        },
        top          : {
            method: 'GET',
            path: '/containers/:id/top',
            params: {
                ps_args: '='
            }
        },
        create       : {
            method: 'POST',
            path: '/containers/create',
            params: {
                name   : '='
            }
        },
        changes      : {
            method: 'GET',
            path: '/containers/:id/changes'
        },
        start        : {
            method: 'POST',
            path: '/containers/:id/start'
        },
        stop         : {
            method: 'POST',
            path: '/containers/:id/stop'
        },
        restart      : {
            method: 'POST',
            path: '/containers/:id/restart'
        },
        kill         : {
            method: 'POST',
            path: '/containers/:id/kill'
        },
        destroy     : {
            method: 'DELETE',
            path: '/containers/:id'
        },
        commit      : {
            method: 'POST',
            path: '/commit',
            params: {
                container: '=',
                repo     : '=',
                tag      : '=',
                m        : '=',
                author   : '=',
                run      : '='
            }
        },
        export       : {
            method: 'GET',
            path: '/containers/:id/export'
        },
        images       : {
            method: 'GET',
            path: '/images/json',
            params: {
                all    : '='
            }
        },
        inspectImage : {
            method: 'GET',
            path: '/images/:id/json'
        },
        getImageHistory : {
            method: 'GET',
            path: '/images/:id/history'
        },
        deleteImage  : {
            method: 'DELETE',
            path: '/images/:id'
        },
        searchImage  : {
            method: 'GET',
            path: '/images/search',
            params: {
                term   : '='
            }
        },
        getInfo         : {
            method: 'GET',
            path: '/info'
        },
        getVersion      : {
            method: 'GET',
            path: '/version'
        },
        auth         : {
            method: 'POST',
            path: '/auth'
        }
    };

    function Docker(options) {
        this.client = restify.createJsonClient(options);
    }

    createApi(dockerAPIMethods, Docker.prototype);

    Docker.prototype.getClient = function () {
        return this.client;
    };

    api.getMethods = function () {
        return Object.keys(dockerAPIMethods);
    };

    api.listHosts = function (call, callback) {
        vasync.forEachParallel({
            inputs: Object.keys(call.cloud.listDatacenters()),
            func: function (dcName, callback) {
                call.cloud.separate(dcName).listMachines({}, {JPC_tag: 'DockerHost'}, function (error, machines) {
                    if (error) {
                        return callback(error);
                    }
                    machines.forEach(function (machine) {
                        machine.datacenter = dcName;
                    });
                    callback(null, machines);
                });
            }
        }, function (errors, operations) {
            if (errors) {
                return callback(errors);
            }

            var hosts = [].concat.apply([], operations.successes);

            callback(null, hosts);
        });
    };

    function generateCertificates(call, callback) {

        var client = Manta.createClient(call);
        var tmpDir = os.tmpdir() + '/' + Math.random().toString(16).substr(2);
        var options = {
            env: {
                KEYS_PATH: tmpDir
            }
        };
        var certMap = {
            'ca.pem': 'ca',
            'cert.pem': 'cert',
            'key.pem': 'key'
        };
        var certificates = {};
        function done(error) {
            if (error) {
                call.log.error({error: error}, 'Failed to generate certificates');
            }
            callback(error, certificates);
        }

        var child = exec(__dirname + '/data/generate-certificates.sh', options, function (error) {
            if (error) {
                done(error);
            }
        });

        child.on('error', done);

        child.on('close', function () {
            fs.readdir(tmpDir, function (readDirError, files) {
                if (readDirError) {
                    return done(readDirError);
                }
                vasync.forEachParallel({
                    inputs: files,
                    func: function (file, callback) {
                        var filePath = tmpDir + '/' + file;
                        var fileContent = fs.readFileSync(filePath, 'utf-8');
                        if (certMap[file] && !certificates[certMap[file]]) {
                            certificates[certMap[file]] = fileContent;
                        }
                        client.putFileContents('~~/stor/.joyent/docker/' + file, fileContent, function (putError) {
                            if (putError) {
                                return callback(putError);
                            }
                            fs.unlink(filePath, callback);
                        });
                    }
                }, function (errors) {
                    if (errors) {
                        return done(errors);
                    }
                    fs.rmdir(tmpDir, function (rmError) {
                        done(rmError);
                    });
                });
            });
        });
    }

    function createKeyPairObject(key) {
        return {
            privateKey: key.toPrivatePem('utf8'),
            publicKey: 'ssh-rsa ' + key.toPublicSsh('base64') + ' docker-portal',
            fingerprint: key.toPublicSshFingerprint('hex').replace(/([a-f0-9]{2})/gi, '$1:').slice(0, -1)
        };
    }

    function getKeyPair(call, callback) {
        var client = Manta.createClient(call);
        var key;

        if (call.req.session.privateKey) {
            key = ursa.createPrivateKey(call.req.session.privateKey);
            return callback(createKeyPairObject(key));
        }
        client.getFileContents('~~/stor/.joyent/docker/private.key', function (error, privateKey) {
            if (error && config.manta && config.manta.privateKey) {
                privateKey = fs.readFileSync(config.manta.privateKey, 'utf-8');
            }
            if (!privateKey) {
                key = ursa.generatePrivateKey();
            } else {
                key = ursa.createPrivateKey(privateKey);
            }

            callback(createKeyPairObject(key));
        });
    }

    function uploadKeys(call, keyPair, callback) {
        var client = Manta.createClient(call);
        vasync.parallel({
            funcs: [
                function (callback) {
                    client.putFileContents('~~/stor/.joyent/docker/private.key', keyPair.privateKey, callback);
                },
                function (callback) {
                    call.cloud.listKeys(function (err, keys) {
                        if (err) {
                            return callback(err);
                        }
                        var neededKey = Array.isArray(keys) && keys.find(function (key) {
                            return key.name === 'docker-key' || key.fingerprint === keyPair.fingerprint;
                        });
                        if (!neededKey) {
                            call.cloud.createKey({name: 'docker-key', key: keyPair.publicKey}, callback);
                        } else {
                            if (neededKey.fingerprint === keyPair.fingerprint) {
                                return callback(null);
                            }

                            call.cloud.deleteKey(neededKey.id, function () {
                                call.cloud.createKey({name: 'docker-key', key: keyPair.publicKey}, function (err) {
                                    callback(err);
                                });
                            });
                        }
                    });
                }
            ]
        }, callback);
    }

    api.createHost = function (call, options, callback) {
        delete options.specification;
        // not declared in header, because both modules depend on each other
        var Machine = scope.api('Machine');
        var mantaClient = Manta.createClient(call);

        options.metadata['user-script'] = startupScript;

        options.tags = {
            JPC_tag: 'DockerHost'
        };

        if (disableTls) {
            options.metadata['disable-tls'] = disableTls;
            Machine.Create(call, options, callback);
            return;
        }

        function uploadKeysAndCreateMachine(keyPair, options) {
            uploadKeys(call, keyPair, function (error) {
                if (error) {
                    return callback(error);
                }
                Machine.Create(call, options, callback);
            });
        }

        getKeyPair(call, function (keyPair) {
            call.req.session.privateKey = keyPair.privateKey;
            options.metadata['private-key'] = keyPair.privateKey;
            options.metadata['public-key'] = keyPair.publicKey;
            options.metadata['manta-account'] = mantaClient.user;
            options.metadata['manta-url'] = mantaClient._url;

            api.getCertificates(call, function (error) {
                if (error) {
                    return callback(error);
                }
                uploadKeysAndCreateMachine(keyPair, options);
            }, true);
        });
    };

    api.getCertificates = function (call, callback, noCache) {
        var client = Manta.createClient(call);
        var retries = 3;

        function getFirstKey(object) {
            return Object.getOwnPropertyNames(object)[0];
        }
        function getKeys(callback) {
            if (!noCache && call.req.session.dockerCerts) {
                return callback(null, call.req.session.dockerCerts);
            }
            call.req.session.dockerCerts = {};
            var certificates = {};
            vasync.forEachParallel({
                inputs: [{ca: 'ca.pem'}, {cert: 'cert.pem'}, {key: 'key.pem'}],
                func: function (input, callback) {
                    var key = getFirstKey(input);
                    if (call.req.session.dockerCerts[key]) {
                        certificates[key] = call.req.session.dockerCerts[key];
                        return callback(null);
                    }
                    var filename = input[key];
                    client.getFileContents('~~/stor/.joyent/docker/' + filename, function (error, body) {
                        if (error) {
                            return callback(error);
                        }
                        certificates[key] = body;
                        callback(null);
                    });
                }
            }, function (errors) {
                if (errors) {
                    if (retries-- > 0) {
                        setTimeout(function () {
                            getKeys(callback);
                        }, 1000);
                        return;
                    }
                    generateCertificates(call, function (error, certificates) {
                        if (error) {
                            return callback(error);
                        }
                        call.req.session.dockerCerts = certificates;
                        callback(null, certificates);
                    });
                    return;
                }
                call.req.session.dockerCerts = certificates;
                callback(null, certificates);
            });
        }
        getKeys(callback);
    };

    api.getHostStatus = function (call, machineId, callback) {
        var client = Manta.createClient(call);
        client.getFileContents('~~/stor/.joyent/docker/.status-' + machineId, function (error, result) {
            var status = "unknown";
            if (!error) {
                try {
                    status = JSON.parse(result).status;
                } catch (e) {
                    call.log.error({result: result}, 'Can\'t parse docker status');
                }
            }
            callback(null, status);
        });
    };

    api.createClient = function (call, machine, callback) {
        var qrKey = 'create-client-' + call.req.session.userId;
        var clientRequest = queuedRequests[qrKey];

        if (!clientRequest) {
            clientRequest = queuedRequests[qrKey] = new EventEmitter();
            api.getCertificates(call, function (error, certificates) {
                delete queuedRequests[qrKey];
                clientRequest.emit('getCertificates', error, certificates);
            });
        }

        clientRequest.on('getCertificates', function (error, certificates) {
            if (error) {
                return callback(error);
            }
            callback(null, new Docker({
                url: (disableTls ? 'http://' : 'https://') + machine.primaryIp + ':4243',
                requestCert: true,
                rejectUnauthorized: false,
                ca: certificates.ca,
                cert: certificates.cert,
                key: certificates.key
            }));
        });
    };

    register('Docker', api);
};