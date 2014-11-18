"use strict";

var restify = require('restify');
var url = require('url');
var util = require('util');
var qs = require('querystring');
var vasync = require('vasync');
var fs = require('fs');
var config = require('easy-config');
var ursa = require('ursa');
var exec = require('child_process').exec;
var os = require('os');
var EventEmitter = require('events').EventEmitter;

var SUBUSER_LOGIN = 'docker';
var SUBUSER_REGISTRY_LOGIN = SUBUSER_LOGIN + '_registry';
var SUBUSER_OBJ_NAME = 'docker';
var SUBUSER_OBJ_NAME_REGISTRY = SUBUSER_OBJ_NAME + '-registry';

var requestMap = {
    'GET': 'get',
    'PUT': 'put',
    'POST': 'post',
    'DELETE': 'del',
    'HEAD': 'head'
};

var registriesCache = {};

// read sync startup script for Docker
var startupScript = fs.readFileSync(__dirname + '/data/startup.sh', 'utf8');

function DockerHostUnreachable(host) {
    this.message = 'Docker host "' + (host.name || host.primaryIp) + '" is unreachable.';
}
util.inherits(DockerHostUnreachable, Error);

function CAdvisorUnreachable() {
    this.message = 'CAdvisor unavailable';
}
util.inherits(CAdvisorUnreachable, Error);

function formatUrl(url, params) {
    //noinspection JSLint
    return url.replace(/(?::(\w+))/g, function (part, key) {
        var value = params[key];
        delete params[key];
        return value;
    });
}

function createCallback(client, opts, callback, options) {
    //noinspection JSLint
    return function (error, req, res, data) {
        if (!opts.raw) {
            client.close();
        }
        if (error) {
            if (error.statusCode && res.headers['content-type'] === 'text/html') {
                var httpError = restify.errors.codeToHttpError(error.statusCode);
                if (httpError && httpError.name) {
                    error.message = httpError.name.replace(/([A-Z])/g, ' $1').trim().replace(' Error', '');

                }
            }
            if (error.statusCode === 502 || error.statusCode === 504 || error.statusCode === 400 || error.name === 'RequestTimeoutError') {
                if (req.path.indexOf('/utilization') === 0) {
                    error = new CAdvisorUnreachable();
                } else {
                    error = new DockerHostUnreachable({name: req.hostname});
                }
            }
            if ((error.message && error.message.indexOf('bad certificate') >= 0) ||
                (error.statusCode === 400)) {
                error.message = 'Manta service is not available.';
            }
            return callback(error.message || error);
        }
        if (opts.noParse) {
            data = res.body.toString();
        }
        callback(null, data);
    };
}

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
            method: opts.method || 'GET',
            retries: opts.retries || false,
            connectTimeout: opts.timeout
        };
        var query = {};
        var param;
        for (param in opts.params) {
            if (opts.params.hasOwnProperty(param)) {
                if (params.hasOwnProperty(param)) {
                    query[param] = params[param];
                } else if (opts.params[param] !== '=') {
                    query[param] = opts.params[param];
                }
            }
        }
        options.path += qs.stringify(query) ? '?' + qs.stringify(query) : '';
        var client = opts.raw ? restify.createClient(this.options) : restify.createJsonClient(this.options);
        var args = [options];
        if ((options.method === 'POST' || options.method === 'PUT') && !opts.raw) {
            args.push(params);
        }
        if (opts.raw) {
            args.push(callback);
        } else {
            args.push(createCallback(client, opts, callback, options));
        }

        client[requestMap[options.method]].apply(client, args);
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

module.exports = function execute(scope, register) {
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
        list         : {
            method: 'GET',
            path: '/containers/json',
            params: {
                all    : true
            }
        },
        inspect      : {
            method: 'GET',
            path: '/containers/:id/json'
        },
        logs         : {
            method: 'GET',
            path: '/containers/:id/logs',
            noParse: true,
            params: {
                stdout     : true,
                stderr     : true,
                timestamps : true,
                tail       : 100,
                follow     : 0
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
        pause        : {
            method: 'POST',
            path: '/containers/:id/pause'
        },
        unpause         : {
            method: 'POST',
            path: '/containers/:id/unpause'
        },
        restart      : {
            method: 'POST',
            path: '/containers/:id/restart'
        },
        kill         : {
            method: 'POST',
            path: '/containers/:id/kill'
        },
        remove     : {
            method: 'DELETE',
            path: '/containers/:id',
            params: {
                v: '=',
                force: '='
            }
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
        containerUtilization: {
            method: 'POST',
            path: '/utilization/docker/:id',
            timeout: 3000,
            params: {
                num_stats: 60,
                num_samples: 0
            }
        },
        hostUtilization: {
            method: 'POST',
            path: '/utilization/',
            timeout: 3000,
            params: {
                num_stats: 60,
                num_samples: 0
            }
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
        tagImage: {
            method: 'POST',
            path: '/images/:name/tag',
            params: {
                repo: '=',
                tag: '=',
                force: '='
            }
        },
        pushImage : {
            raw: true,
            method: 'POST',
            path: '/images/:name/push',
            params: {
                tag: '='
            }
        },
        createImage : {
            raw: true,
            method: 'POST',
            path: '/images/create',
            params: {
                fromImage: '=',
                tag: '=',
                registry: '=',
                repo: '='
            }
        },
        buildImage: {
            method: 'POST',
            path: '/build',
            raw: true,
            params: {
                t: '=',         // repository name (and optionally a tag) to be applied to the resulting image in case of success
                rm: '=',        // remove intermediate containers after a successful build (default behavior)
                nocache: '=',   // do not use the cache when building the image
                q: '='          // suppress verbose build output
            }
        },
        historyImage : {
            method: 'GET',
            path: '/images/:id/history'
        },
        removeImage  : {
            method: 'DELETE',
            path: '/images/:id',
            params: {
                force: '=',
                noprune: '='
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
        },
        ping         : {
            method: 'GET',
            retries: false,
            timeout: 3000,
            path: '/_ping'
        }
    };

    var registryAPIMethods = {
        searchImage  : {
            method: 'GET',
            path: '/v1/search',
            params: {
                q   : '='
            }
        },
        imageTags  : {
            method: 'GET',
            path: '/v1/repositories/:name/tags'
        },
        ping: {
            method: 'GET',
            retries: false,
            timeout: 3000,
            path: '/v1/_ping'
        }
    };

    api.DockerHostUnreachable = DockerHostUnreachable;
    api.CAdvisorUnreachable = CAdvisorUnreachable;

    function Docker(options) {
        this.options = options;
    }

    function Registry(options) {
        this.client = restify.createJsonClient(options);
    }

    createApi(scope, dockerAPIMethods, Docker.prototype);

    createApi(scope, registryAPIMethods, Registry.prototype);

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
                    var createdMachines = machines.filter(function (machine) {
                        return machine.primaryIp && machine.state === 'running';
                    });
                    callback(null, createdMachines);
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

    var waitForHosts = {};

    api.waitHost = function waitHost(call, host, updateFunc, callback) {
        var pollerKey = call.req.session.userId + '-' + host.id;
        var poller = waitForHosts[pollerKey];
        function installCallbacks() {
            if (updateFunc) {
                poller.on('state-update', updateFunc);
            }
            poller.on('completed', callback);
            poller.on('error', callback);
        }

        if (poller) {
            installCallbacks();
            return;
        }

        poller = new EventEmitter();
        waitForHosts[pollerKey] = poller;
        installCallbacks();
        poller.status = 'initializing';
        poller.started = new Date();
        setTimeout(function () {
            var pollerExists = !!waitForHosts[pollerKey];
            delete waitForHosts[pollerKey];
            if (pollerExists) {
                poller.emit('error', 'The installation of Docker host "' + host.name + '" has timed out. Please refresh the page.');
            }
        }, config.polling.dockerHostTimeout);
        function getHostStatus() {
            api.getHostStatus(call, host.id, function (error, status) {
                if (status === 'completed') {
                    delete waitForHosts[pollerKey];
                    return poller.emit('completed');
                }

                if (status !== poller.status) {
                    poller.status = status;
                    poller.emit('state-update', status);
                }

                if (waitForHosts[pollerKey]) {
                    setTimeout(getHostStatus, config.polling.dockerHost);
                }
            });
        }
        getHostStatus();
    };

    function generateCertificates(call, callback) {

        var client = scope.api('MantaClient').createClient(call);
        var tmpDir = os.tmpdir() + '/' + Math.random().toString(16).substr(2);
        var options = {
            env: {
                KEYS_PATH: tmpDir
            }
        };
        var certMap = {
            'ca.pem': 'ca',
            'cert.pem': 'cert',
            'key.pem': 'key',
            'server-cert.pem': 'server-cert',
            'server-key.pem': 'server-key'
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
        var client = scope.api('MantaClient').createClient(call);
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

    function keyPoller(call, subId, keyExists, callback) {
        var start = new Date();
        return function (error) {
            if (error) {
                return callback(error);
            }

            function retry() {
                if (new Date() - start > config.polling.sshCreateKeyTimeout) {
                    return callback(new Error('Poller error: SSH ' + (keyExists ? 'create' : 'delete') + ' key timeout'));
                }
                setTimeout(function () {
                    keyPoller(call, subId, keyExists, callback);
                }, config.polling.sshCreateKey);
            }

            function isDockerKeyExists(keys) {
                return keys.some(function (key) {
                    return key.name === SUBUSER_OBJ_NAME;
                });
            }

            call.cloud.listUserKeys(subId, function (error, keys) {
                if (!error && Array.isArray(keys) && isDockerKeyExists(keys) === keyExists) {
                    callback();
                    return;
                }
                retry();
            }, true);
        };
    }

    function deleteSubAccount(call, subId, deleteCallback) {
        vasync.waterfall([
            function (callback) {
                call.cloud.listUserKeys(subId, function (listErr, keys) {
                    callback(listErr, keys);
                });
            },
            function (keys, callback) {
                vasync.forEachPipeline({
                    inputs: keys,
                    func: function (key, pipeCallback) {
                        call.cloud.deleteUserKey(subId, key.fingerprint, pipeCallback);
                    }
                }, callback);
            },
            function (_, callback) {
                call.cloud.listRoles(function (listErr, roles) {
                    callback(listErr, roles);
                });
            },
            function (roles, callback) {
                var dockerRole = roles.find(function (role) { return role.name === SUBUSER_OBJ_NAME; });
                if (dockerRole) {
                    call.cloud.deleteRole(dockerRole.id, callback);
                } else {
                    callback();
                }
            },
            function (callback) {
                call.cloud.listPolicies(function (listErr, policies) {
                    callback(listErr, policies);
                });
            },
            function (policies, callback) {
                var dockerPolicy = policies.find(function (policy) { return policy.name === SUBUSER_OBJ_NAME; });
                if (dockerPolicy) {
                    call.cloud.deletePolicy(dockerPolicy.id, callback);
                } else {
                    callback();
                }
            },
            function (callback) {
                call.cloud.deleteUser(subId, callback);
            }
        ], deleteCallback);
    }

    function setupManta(call, setupCallback) {
        var client = scope.api('MantaClient').createClient(call);
        var dockerPath = '/' + call.req.session.userName + '/stor/.joyent/docker';
        var registryPath = dockerPath + '/registry';
        vasync.waterfall([
            function (callback) {
                client.mkdirp(registryPath, function (mkdirErr) {
                    callback(mkdirErr);
                });
            },
            function (callback) {
                var overallTimeout = Date.now() + 5 * 60 * 1000;
                var trySettingRoleTag = function (cb) {
                    client.setRoleTags(dockerPath, [SUBUSER_OBJ_NAME], false, function () {
                        client.getRoleTags(dockerPath, function (getErr, roles) {
                            if (roles.length === 1) {
                                cb(null);
                            } else if (Date.now() > overallTimeout) {
                                cb('Cannot set role tags for docker folder');
                            } else {
                                trySettingRoleTag(cb);
                            }
                        });
                    });
                };
                trySettingRoleTag(callback);
            },
            function (callback) {
                client.setRoleTags(dockerPath, [SUBUSER_OBJ_NAME], true, function (setErr) {
                    callback(setErr);
                });
            },
            function (callback) {
                client.setRoleTags(registryPath, [SUBUSER_OBJ_NAME_REGISTRY], true, function (setRegErr) {
                    callback(setRegErr);
                });
            }
        ], setupCallback);
    }

    function setupSubAccounts(call, keyPair, setupCallback) {
        var dockerUser;
        var dockerRegistryUser;
        vasync.waterfall([
            function (callback) {
                call.cloud.getAccount(function (accountErr, acccount) {
                    callback(accountErr, acccount);
                });
            },
            function (account, callback) {
                var emailParts = account.email.split('@');
                emailParts[0] += '+' + SUBUSER_REGISTRY_LOGIN;
                var userData = {
                    lastName: SUBUSER_REGISTRY_LOGIN,
                    email: emailParts.join('@'),
                    login: SUBUSER_REGISTRY_LOGIN,
                    password: (Math.random().toString(36) + 'ABC123').substr(2)
                };
                call.cloud.createUser(userData, function (error, user) {
                    dockerRegistryUser = user;
                    callback(error, account);
                });
            },
            function (account, callback) {
                var emailParts = account.email.split('@');
                emailParts[0] += '+' + SUBUSER_LOGIN;
                var userData = {
                    lastName: SUBUSER_LOGIN,
                    email: emailParts.join('@'),
                    login: SUBUSER_LOGIN,
                    password: (Math.random().toString(36) + 'ABC123').substr(2)
                };
                call.cloud.createUser(userData, callback);
            },
            function (user, callback) {
                dockerUser = user;
                call.cloud.createPolicy({
                    name: SUBUSER_OBJ_NAME,
                    rules: ['can putobject', 'can putdirectory']
                }, function () {
                    callback();
                });
            },
            function (callback) {
                call.cloud.createRole({
                    name: SUBUSER_OBJ_NAME,
                    policies: [SUBUSER_OBJ_NAME],
                    members: [dockerUser.login],
                    default_members: [dockerUser.login]
                }, function () {
                    callback();
                });
            },
            function (callback) {
                call.cloud.createPolicy({
                    name: SUBUSER_OBJ_NAME_REGISTRY,
                    rules: ['can putobject', 'can putdirectory', 'can getobject', 'can getdirectory', 'can deleteobject', 'can deletedirectory']
                }, function () {
                    callback();
                });
            },
            function (callback) {
                call.cloud.createRole({
                    name: SUBUSER_OBJ_NAME_REGISTRY,
                    policies: [SUBUSER_OBJ_NAME_REGISTRY],
                    members: [dockerRegistryUser.login],
                    default_members: [dockerRegistryUser.login]
                }, function () {
                    callback();
                });
            },
            function (callback) {
                setupManta(call, callback);
            },
            function (callback) {
                call.cloud.uploadUserKey(dockerUser.id, {
                    name: SUBUSER_OBJ_NAME,
                    key: keyPair.publicKey
                }, callback);
            },
            function (_, callback) {
                keyPoller(call, dockerUser.id, true, function (error) {
                    callback(error);
                })();
            },
            function (callback) {
                call.cloud.uploadUserKey(dockerRegistryUser.id, {
                    name: SUBUSER_OBJ_NAME,
                    key: keyPair.publicKey
                }, callback);
            },
            function (_, callback) {
                keyPoller(call, dockerRegistryUser.id, true, callback)();
            }
        ], setupCallback);
    }

    function checkAndCreateSubAccount(call, keyPair, callback) {
        call.cloud.listUsers(function (listErr, users) {
            if (listErr) {
                return callback(listErr);
            }
            var dockerUser = users.find(function (user) {
                return user.login === SUBUSER_LOGIN;
            });
            var dockerRegistryUser = users.find(function (user) {
                return user.login === SUBUSER_REGISTRY_LOGIN;
            });
            var deleteRegUserAndSetup = function () {
                if (dockerRegistryUser) {
                    deleteSubAccount(call, dockerRegistryUser.id, function (deleteRegErr) {
                        if (deleteRegErr) {
                            return callback(deleteRegErr);
                        }
                        setupSubAccounts(call, keyPair, callback);
                    });
                } else {
                    setupSubAccounts(call, keyPair, callback);
                }
            };
            if (dockerUser) {
                call.cloud.listUserKeys(dockerUser.id, function (listErr, keys) {
                    if (listErr) {
                        return callback(listErr);
                    }
                    var dockerKey = keys.find(function (key) {
                        return key.name === SUBUSER_OBJ_NAME;
                    });
                    if (dockerKey) {
                        setupManta(call, callback);
                    } else {
                        deleteSubAccount(call, dockerUser.id, function (deleteErr) {
                            if (deleteErr) {
                                return callback(deleteErr);
                            }
                            deleteRegUserAndSetup();
                        });
                    }
                });
            } else {
                deleteRegUserAndSetup();
            }
        });
    }

    function uploadKeys(call, keyPair, uploadCallback) {
        vasync.parallel({
            funcs: [
                function (callback) {
                    var client = scope.api('MantaClient').createClient(call);
                    client.putFileContents('~~/stor/.joyent/docker/private.key', keyPair.privateKey, callback);
                },
                function (callback) {
                    checkAndCreateSubAccount(call, keyPair, callback);
                }
            ]
        }, uploadCallback);
    }

    api.createHost = function (call, options, callback) {
        delete options.specification;
        // not declared in header, because both modules depend on each other
        var Machine = scope.api('Machine');
        var mantaClient = scope.api('MantaClient').createClient(call);

        options.metadata = options.metadata || {};
        options.metadata['user-script'] = startupScript;

        options.tags = options.tags || {};
        options.tags.JPC_tag = 'DockerHost';

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
            options.metadata['manta-subuser'] = SUBUSER_LOGIN;
            options.metadata['manta-url'] = mantaClient._url;
            options.metadata['docker-version'] = config.docker.dockerVersion;
            options.metadata['cadvisor-version'] = config.docker.cadvisorVersion;

            api.getCertificates(call, function (error, certificates) {
                if (error) {
                    return callback(error);
                }
                options.metadata['ca'] = certificates.ca;
                options.metadata['server-cert'] = certificates['server-cert'];
                options.metadata['server-key'] = certificates['server-key'];
                uploadKeysAndCreateMachine(keyPair, options);
            }, true);
        });
    };

    api.getCertificates = function (call, callback, noCache) {
        var client = scope.api('MantaClient').createClient(call);
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
            var certArr = [
                {ca: 'ca.pem'},
                {cert: 'cert.pem'},
                {key: 'key.pem'},
                {'server-cert': 'server-cert.pem'},
                {'server-key': 'server-key.pem'}
            ];
            vasync.forEachParallel({
                inputs: certArr,
                func: function (input, callback) {
                    var key = getFirstKey(input);
                    if (!noCache && call.req.session.dockerCerts[key]) {
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
        var client = scope.api('MantaClient').createClient(call);
        client.getFileContents('~~/stor/.joyent/docker/.status-' + machineId, function (error, result) {
            var status = "initializing";
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

    function createClient(call, Service, url, callback) {
        var qrKey = 'create-' + Service.name + '-client-' + call.req.session.userId;
        var clientRequest = queuedRequests[qrKey];

        if (!clientRequest) {
            clientRequest = queuedRequests[qrKey] = new EventEmitter();
            clientRequest.setMaxListeners(100);
            api.getCertificates(call, function (error, certificates) {
                delete queuedRequests[qrKey];
                clientRequest.emit('getCertificates', error, certificates);
            });
        }

        clientRequest.once('getCertificates', function (error, certificates) {
            if (error) {
                return callback(error);
            }
            callback(null, new Service({
                url: url,
                requestCert: true,
                rejectUnauthorized: false,
                ca: certificates.ca,
                cert: certificates.cert,
                key: certificates.key,
                headers: {
                    'Content-type': 'application/json'
                }
            }));
        });
    }

    api.createClient = function (call, machine, callback) {
        createClient(call, Docker, (disableTls ? 'http://' : 'https://') + machine.primaryIp + ':4243', callback);
    };

    api.createRegistryClient = function (call, credentials, callback) {
        var parsedUrl = url.parse(credentials.host);
        var port = parseInt(credentials.port || parsedUrl.port, 10);
        if (port) {
            delete parsedUrl.host;
            parsedUrl.port = port;
        }

        if (credentials.auth) {
            parsedUrl.auth = new Buffer(credentials.auth, 'base64').toString('ascii');
        }

        createClient(call, Registry, url.format(parsedUrl), callback);
    };

    function pad(measure) {
        return measure < 10 ? '0' + measure : measure;
    }

    function getTime(str) {
        str += ' ' + new Date().getFullYear();
        var date = new Date(str);
        var time = '';
        if (!isNaN(date.getTime())) {
            time = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' +
                pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds()) +
                ':' + date.getMilliseconds() + 'Z';
        }
        return time;
    }

    function getLogFormat(log, inputStr) {
        inputStr = inputStr || 'stdout';
        var endBracketPosition = log.indexOf(']') || 1;
        var time = getTime(log.slice(log.indexOf('[') + 1 || 1, endBracketPosition));

        return '{"log": "' + log.slice(endBracketPosition + 2, log.length - 1) + '", "stream":"' + inputStr  + '", "time":"' + time + '"}\n';
    }

    api.dateFormat = function (sourceDate) {
        sourceDate = new Date(sourceDate);
        return sourceDate.getFullYear() + '-' + pad(sourceDate.getMonth() + 1) + '-' + pad(sourceDate.getDate());
    };

    api.parseLogResponse = function (response) {
        var responses = response.split('\n');
        var code;
        var logs = '';
        var inputStr = null;
        responses.pop();
        responses.forEach(function (response) {
            var i;
            for (i = 0; i < response.length; i++) {
                code = response.charCodeAt(i);
                if (code === 2) {
                    inputStr = 'stderr';
                }
                if (code > 4 || code < 2048) {
                    break;
                }
            }

            logs += getLogFormat(response.substr(i), inputStr);
        });
        return logs;
    };

    api.registriesCache = registriesCache;
    api.getRegistries = function (call, client, callback) {
        if (typeof (client) === 'function') {
            callback = client;
            client = scope.api('MantaClient').createClient(call);
        }

        client.getFileContents('~~/stor/.joyent/docker/registries.json', function (error, list) {
            if (error && error.statusCode !== 404) {
                return call.done(error.message, true);
            }

            try {
                list = JSON.parse(list);
            } catch (e) {
                call.log.warn('Registries list is corrupted');
                list = [];
            }
            callback(error, list);
        });
    };

    api.saveRegistries = function (call, data, client, callback) {
        if (typeof (client) === 'function') {
            callback = client;
            client = null;
        }
        callback = callback || call.done;
        client = client || scope.api('MantaClient').createClient(call);
        client.putFileContents('~~/stor/.joyent/docker/registries.json', JSON.stringify(data), function (error) {
            return callback(error && error.message, true);
        });
    };

    api.deleteRegistry = function (call, key, value, callback) {
        api.getRegistries(call, function (error, list) {
            var id;
            list = list.filter(function (item) {
                var condition = key === 'host' ? item.host === value && parseInt(item.port, 10) === 5000 : item[key] === value;
                if (condition) {
                    id = item.id;
                }
                return !condition;
            });
            if (id) {
                delete registriesCache[id];
                return api.saveRegistries(call, list, callback);
            }
        });
    };

    // search on all hosts
    api.searchPrivateImage = function searchPrivateImage(call, term, callback) {
        api.getRegistries(call, function (error, registries) {
            if (error) {
                return callback(error);
            }
            vasync.forEachParallel({
                inputs: registries.filter(function (registry) {
                    return registry.type === 'local';
                }),
                func: function (registry, callback) {

                    api.createRegistryClient(call, registry, function (error, client) {
                        if (error) {
                            return callback(null, []);
                        }
                        client.searchImage({q: term}, callback);
                    });
                }
            }, function (errors, operations) {
                var results = [],
                    names = {};
                [].concat.apply([], operations.successes).map(function (response) {
                    response.results.forEach(function (item) {
                        if (names[item.name]) {
                            return;
                        }
                        names[item.name] = true;
                        results.push(item);
                    });
                });
                callback(null, {
                    num_results: results.length,
                    query: term,
                    results: results
                });
            });
        });
    };

    api.SUBUSER_LOGIN = SUBUSER_LOGIN;
    api.SUBUSER_REGISTRY_LOGIN = SUBUSER_REGISTRY_LOGIN;

    register('Docker', api);
};