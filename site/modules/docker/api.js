'use strict';

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
var Auditor = require('./libs/auditor.js');
var cache = require('lru-cache')({
    max: 1000,
    maxAge: 10 * 60
});

var SUBUSER_LOGIN = 'docker';
var SUBUSER_REGISTRY_LOGIN = SUBUSER_LOGIN + '_registry';
var SUBUSER_OBJ_NAME = 'docker';
var SUBUSER_OBJ_NAME_REGISTRY = SUBUSER_OBJ_NAME + '-registry';
var SDC_DOCKER_ID = '00000000-0000-0000-0000-000000000000';

var SDC_DOCKER = config.features.sdcDocker === 'enabled' ?
    {
        id: SDC_DOCKER_ID,
        name: config.sdcDocker.name,
        datacenter: config.sdcDocker.datacenter,
        primaryIp: config.sdcDocker.ip,
        isSdc: true
    } : null;

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

function createCallback(scope, dockerInstance, opts, auditParams, callback) {
    //noinspection JSLint
    return function (error, req, res, data) {
        if (error) {
            if (error.statusCode && res.headers['content-type'] === 'text/html') {
                var httpError = restify.errors.codeToHttpError(error.statusCode);
                if (httpError && httpError.name) {
                    error.message = httpError.name.replace(/([A-Z])/g, ' $1').trim().replace(' Error', '');

                }
            }
            if (['ECONNRESET', 'ENOTFOUND', 'ESOCKETTIMEDOUT', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH'].indexOf(error.code) !== -1 ||
                error.statusCode > 500 || error.statusCode === 400 ||
                error.name === 'RequestTimeoutError' || error.name === 'ConnectTimeoutError') {
                if (req.path.indexOf('/utilization') === 0) {
                    error = new CAdvisorUnreachable();
                } else {
                    error = new DockerHostUnreachable({name: req.getHeader('host')});
                }
            }
            if ((error.message && error.message.indexOf('bad certificate') >= 0) ||
                (error.statusCode === 400)) {
                error.message = 'Manta service is not available.';
            }
            auditParams.error = true;
            auditParams.errorMessage = error.body && error.body.error || error.message || error;
        }
        if (dockerInstance.auditor && (opts.auditType === 'docker' || (opts.auditType && opts.auditType !== 'docker' && (auditParams.id || auditParams.Id)))) {
            if (!(dockerInstance.options.host && dockerInstance.options.host.id)) {
                req.log.warn({opts: opts, dockerOpts: dockerInstance.options}, 'Host not defined');
            } else {
                setImmediate(function () {
                    dockerInstance.auditor.put({
                        host: dockerInstance.options.host.id,
                        entry: auditParams.Id || auditParams.id,
                        type: opts.auditType,
                        name: dockerInstance.options.methodName
                    }, auditParams);
                });
            }
        }
        if (opts.noParse) {
            data = res.body.toString();
        }
        callback(auditParams.errorMessage, data);
    };
}

function createMethod(scope, opts, selfName) {
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

        var raw = params.forceRaw || opts.raw;
        delete params.forceRaw;

        var self = this;
        var auditParams = JSON.parse(JSON.stringify(params));
        var path = opts.path;
        if (this.options.isSdc && path !== '/_ping') {
            path = '/v2' + path;
        }
        var options = {
            log: scope.log,
            path: formatUrl(path, params),
            method: opts.method || 'GET',
            retries: opts.retries || false,
            connectTimeout: opts.timeout,
            headers: opts.headers || {}
        };
        var query = {};
        var param, header;
        if (params.forceMethod) {
            options.method = params.forceMethod;
            delete params.forceMethod;
        }
        if (params.headers) {
            for (header in params.headers) {
                if (params.headers.hasOwnProperty(header)) {
                    options.headers[header] = params.headers[header];
                }
            }
            delete params.headers;
        }
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
        var client = raw ? restify.createClient(this.options) : restify.createJsonClient(this.options);
        var args = [options];
        if ((options.method === 'POST' || options.method === 'PUT') && !raw) {
            args.push(params);
        }
        self.options.methodName = selfName;
        if (raw) {
            args.push(callback);
        } else {
            args.push(createCallback(scope, self, opts, auditParams, callback));
        }

        client[requestMap[options.method]].apply(client, args);
    };
}

function createApi(scope, map, container) {
    var name;
    for (name in map) {
        if (map.hasOwnProperty(name)) {
            container[name] = createMethod(scope, map[name], name);
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
            auditType: 'docker',
            path: '/containers/json',
            params: {
                size   : '=',
                all    : '='
            }
        },
        list         : {
            auditType: 'docker',
            path: '/containers/json',
            params: {
                all    : true
            }
        },
        inspect      : {
            auditType: 'container',
            path: '/containers/:id/json'
        },
        logs         : {
            auditType: 'container',
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
            auditType: 'container',
            path: '/containers/:id/top',
            params: {
                'ps_args': '='
            }
        },
        create       : {
            method: 'POST',
            path: '/containers/create',
            params: {
                name   : '='
            }
        },
        startImmediate : {
            method: 'POST',
            path: '/containers/:id/start'
        },
        changes      : {
            auditType: 'container',
            path: '/containers/:id/changes'
        },
        start        : {
            auditType: 'container',
            method: 'POST',
            path: '/containers/:id/start'
        },
        stop         : {
            auditType: 'container',
            method: 'POST',
            path: '/containers/:id/stop'
        },
        pause        : {
            auditType: 'container',
            method: 'POST',
            path: '/containers/:id/pause'
        },
        unpause         : {
            auditType: 'container',
            method: 'POST',
            path: '/containers/:id/unpause'
        },
        restart      : {
            auditType: 'container',
            method: 'POST',
            path: '/containers/:id/restart'
        },
        exec: {
            path: '/containers/:id/exec',
            method: 'POST'
        },
        execStart: {
            method: 'POST',
            path: '/exec/:id/start',
            raw: true
        },
        kill         : {
            auditType: 'container',
            method: 'POST',
            path: '/containers/:id/kill'
        },
        remove     : {
            auditType: 'container',
            method: 'DELETE',
            path: '/containers/:id',
            params: {
                v: '=',
                force: '='
            }
        },
        commit      : {
            auditType: 'docker',
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
            auditType: 'container',
            method: 'GET',
            path: '/containers/:id/export'
        },
        containerUtilization: {
            method: 'POST',
            path: '/utilization/docker/:id',
            timeout: 3000,
            params: {
                'num_stats': 60,
                'num_samples': 0
            }
        },
        hostUtilization: {
            method: 'POST',
            path: '/utilization/',
            timeout: 3000,
            params: {
                'num_stats': 60,
                'num_samples': 0
            }
        },
        images       : {
            auditType: 'docker',
            path: '/images/json',
            params: {
                all    : '='
            }
        },
        inspectImage : {
            auditType: 'image',
            path: '/images/:id/json'
        },
        tagImage: {
            auditType: 'image',
            method: 'POST',
            path: '/images/:name/tag',
            params: {
                repo: '=',
                tag: '=',
                force: '='
            }
        },
        pushImage : {
            auditType: 'image',
            raw: true,
            method: 'POST',
            path: '/images/:name/push',
            params: {
                tag: '='
            }
        },
        createImage : {
            auditType: 'docker',
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
        pullImage : {
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
            auditType: 'docker',
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
            auditType: 'image',
            method: 'GET',
            path: '/images/:id/history'
        },
        removeImage  : {
            auditType: 'image',
            method: 'DELETE',
            path: '/images/:id',
            params: {
                force: '=',
                noprune: '='
            }
        },
        getInfo         : {
            auditType: 'docker',
            method: 'GET',
            path: '/info'
        },
        getVersion      : {
            auditType: 'docker',
            method: 'GET',
            path: '/version'
        },
        auth         : {
            auditType: 'docker',
            method: 'POST',
            path: '/auth'
        },
        ping         : {
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
        removeImage: {
            method: 'DELETE',
            path: '/v1/repositories/:name/'
        },
        imageTags  : {
            method: 'GET',
            path: '/v1/repositories/:name/tags'
        },
        removeImageTag  : {
            method: 'DELETE',
            path: '/v1/repositories/:name/tags/:tag'
        },
        addImageTag  : {
            method: 'PUT',
            raw: true,
            path: '/v1/repositories/:name/tags/:tag'
        },
        imageTagId: {
            path: '/v1/repositories/:name/tags/:tag'
        },
        ancestry: {
            path: '/v1/images/:id/ancestry'
        },
        inspect: {
            path: '/v1/images/:id/json'
        },
        ping: {
            method: 'GET',
            retries: false,
            timeout: 3000,
            path: '/v1/_ping'
        }
    };

    var indexAPIMethods = {
        images: {
            method: 'GET',
            path: '/v1/repositories/:name/images'
        },
        tokenRequest: {
            method: 'GET',
            headers: {
                'X-Docker-Token': true
            },
            path: '/v1/repositories/:name/:type'
        }
    };

    api.DockerHostUnreachable = DockerHostUnreachable;
    api.CAdvisorUnreachable = CAdvisorUnreachable;

    function Docker(options, call) {
        this.options = options;
        var mantaClient = scope.api('MantaClient').createClient(call);
        this.auditor = new Auditor(call, mantaClient);
    }

    function Registry(options) {
        this.options = options;
    }

    function Index(options) {
        this.options = options;
    }

    createApi(scope, dockerAPIMethods, Docker.prototype);

    createApi(scope, registryAPIMethods, Registry.prototype);

    createApi(scope, indexAPIMethods, Index.prototype);
    /**
     * Authorize, and get token
     * curl -i -H'X-Docker-Token: true' https://index.docker.io/v1/repositories/google/cadvisor/images
     * >> X-Docker-Token: signature=7c438fd617eb7a8f2ad7476a9a3f2c6f8c1961fa,repository="google/cadvisor",access=read
     * Get tags
     * curl -i -H'Authorization: Token signature=7c438fd617eb7a8f2ad7476a9a3f2c6f8c1961fa,repository="google/cadvisor",access=read' https://registry-1.docker.io/v1/repositories/google/cadvisor/tags
     * Get image ancestry
     * curl -i -H'Authorization: Token signature=7c438fd617eb7a8f2ad7476a9a3f2c6f8c1961fa,repository="google/cadvisor",access=read' https://registry-1.docker.io/v1/images/cdcf3d027523f5437e2799253334769b5933b9da2c424a23f13b9c7f21079263/ancestry
     *
     */

    Index.prototype.getAuthToken = function getAuthToken(name, access, callback) {
        var opts = {name: name, forceRaw: true, type: ''};
        if (!callback && typeof (access) === 'function') {
            callback = access;
            access = undefined;
        }

        if (access) {
            opts.forceMethod = access;
        }
        if (!access || access === 'GET') {
            opts.type = 'images';
        }

        this.tokenRequest(opts, function (error, req) {
            if (error) {
                return callback(error);
            }
            req.on('result', function (err, res) {
                if (err) {
                    return callback(err);
                }
                res.destroy();
                callback(null, {
                    token: res.headers['x-docker-token'],
                    endpoint: res.headers['x-docker-endpoints']
                });
            });
            if (access === 'PUT') {
                req.write('[]');
                req.end();
            }
        });
    };

    api.getImageInfo = function getImageInfo(call, options, callback) {
        var pipeline = [];
        pipeline.push(function getIndexClient(collector, callback) {
            api.createIndexClient(call, {registry: options.registry, image: options.name}, function (indexErr, clients) {
                if (indexErr) {
                    return callback(indexErr);
                }
                collector.client = clients.registry;

                clients.index.images({name: options.name}, function (imagesError, images) {
                    if (images && images.length) {
                        collector.ancestry = images.map(function (image) {
                            return image.id;
                        });
                    }
                    callback(imagesError);
                });
            });
        });
        if (options.tag) {
            pipeline.push(function getImageId(collector, callback) {
                var opts = {
                    name: options.name,
                    tag: options.tag
                };
                collector.client.imageTagId(opts, function (error, id) {
                    collector.imageId = id;
                    callback(error);
                });
            });
            pipeline.push(function getAncestry(collector, callback) {
                var opts = {
                    id: collector.imageId
                };
                collector.client.ancestry(opts, function (error, images) {
                    collector.ancestry = images;
                    callback(error);
                });
            });
        }
        pipeline.push(function getImageConfig(collector, callback) {
            collector.result = {images: []};
            var queue = vasync.queue(function (imageId, cb) {
                collector.client.inspect({id: imageId}, function (err, data) {
                    if (!err) {
                        collector.result.images.push(data);
                    }
                    cb(err);
                });
            }, 2);
            queue.drain = function (error) {
                callback(error);
            };
            if (!collector.ancestry || !collector.ancestry.length) {
                return callback('Unable to pull empty repository');
            }
            collector.ancestry.forEach(function (image) {
                queue.push(image);
            });
        });
        pipeline.push(function finalize(collector, callback) {
            collector.count = collector.result.images.length;
            collector.size = collector.result.images.reduce(function (a, b) {
                return a + (b.Size || 0);
            }, 0);
            callback();
        });
        var result = {};
        vasync.pipeline({
            funcs: pipeline,
            arg: result
        }, function (err) {
            callback(err, {
                id: result.imageId,
                images: result && result.result && result.result.images,
                length: result.count,
                size: result.size
            });
        });
    };

    api.getMethods = function () {
        return Object.keys(dockerAPIMethods);
    };

    api.listHosts = function (call, callback) {
        var hostId = call.data && call.data.id;
        if (hostId === SDC_DOCKER_ID) {
            return callback(null, SDC_DOCKER);
        }
        vasync.forEachParallel({
            inputs: Object.keys(call.cloud.listDatacenters()),
            func: function (dcName, callback) {
                call.cloud.separate(dcName).listMachines({}, {'JPC_tag': 'DockerHost'}, function (error, machines) {
                    if (error) {
                        return callback(error);
                    }
                    machines = machines || [];
                    var createdMachines = machines.filter(function (machine) {
                        machine.datacenter = dcName;
                        return machine.primaryIp && machine.state === 'running';
                    });
                    callback(null, createdMachines);
                });
            }
        }, function (errors, operations) {
            if (errors) {
                return callback(errors);
            }
            var hosts = [].concat.apply(SDC_DOCKER ? [SDC_DOCKER] : [], operations.successes);
            if (hostId) {
                var host = hosts.find(function(host) {
                    return hostId === host.id;
                });
                return callback(host ? null : 'Docker host not found', host);
            }
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

    function deleteSubAccount(call, subId, name, deleteCallback) {
        function deleteRolePolicy(action, rolePolicyList, callback) {
            var rolePolicyNames = [SUBUSER_OBJ_NAME, SUBUSER_OBJ_NAME_REGISTRY];
            if (name) {
                rolePolicyNames = [name];
            }
            vasync.forEachPipeline({
                inputs: rolePolicyNames,
                func: function (rolePolicyName, pipeCallback) {
                    var dockerRolePolicy = rolePolicyList.find(function (item) { return item.name === rolePolicyName; });
                    if (dockerRolePolicy) {
                        call.cloud[action](dockerRolePolicy.id, pipeCallback);
                    } else {
                        pipeCallback();
                    }
                }
            }, callback);
        }
        vasync.waterfall([
            function (callback) {
                if (!subId) {
                    return callback(null, null);
                }
                call.cloud.listUserKeys(subId, function (listErr, keys) {
                    callback(listErr, keys);
                });
            },
            function (keys, callback) {
                if (!keys) {
                    return callback(null, null);
                }
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
                deleteRolePolicy('deleteRole', roles, callback);
            },
            function (_, callback) {
                call.cloud.listPolicies(function (listErr, policies) {
                    callback(listErr, policies);
                });
            },
            function (policies, callback) {
                deleteRolePolicy('deletePolicy', policies, callback);
            },
            function (_, callback) {
                if (!subId) {
                    return callback();
                }
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
                client.safeMkdirp(registryPath, {}, function (mkdirErr) {
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
                    'default_members': [dockerUser.login]
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
                    'default_members': [dockerRegistryUser.login]
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
                    deleteSubAccount(call, dockerRegistryUser.id, SUBUSER_OBJ_NAME_REGISTRY, function (deleteRegErr) {
                        if (deleteRegErr) {
                            return callback(deleteRegErr);
                        }
                        setupSubAccounts(call, keyPair, callback);
                    });
                } else {
                    deleteSubAccount(call, null, null, function (deleteError) {
                        if (deleteError) {
                            return callback(deleteError);
                        }
                        setupSubAccounts(call, keyPair, callback);
                    });
                }
            };
            if (dockerUser) {
                var isFirstCheck = true;
                var checkDockerKey = function () {
                    call.cloud.listUserKeys(dockerUser.id, function (listErr, keys) {
                        if (listErr) {
                            return callback(listErr);
                        }
                        var dockerKey = keys.find(function (key) {
                            return key.name === SUBUSER_OBJ_NAME && keyPair.fingerprint === key.fingerprint;
                        });
                        if (dockerKey) {
                            setupManta(call, callback);
                        } else {
                            if (isFirstCheck) {
                                isFirstCheck = false;
                                setTimeout(checkDockerKey, 10000);
                                return;
                            }
                            deleteSubAccount(call, dockerUser.id, SUBUSER_OBJ_NAME, function (deleteErr) {
                                if (deleteErr) {
                                    return callback(deleteErr);
                                }
                                deleteRegUserAndSetup();
                            });
                        }
                    });
                };
                checkDockerKey();
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
        options.tags['JPC_tag'] = 'DockerHost';

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
                return setImmediate(function () {
                    callback(null, call.req.session.dockerCerts);
                });
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
        if (machineId === SDC_DOCKER_ID) {
            setImmediate(function () {
                callback(null, 'completed');
            });
            return;
        }
        var client = scope.api('MantaClient').createClient(call);
        client.getFileContents('~~/stor/.joyent/docker/.status-' + machineId, function (error, result) {
            var status = 'initializing';
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

    function createClient(call, Service, opts, callback) {
        var qrKey = 'create-' + Service.name + '-client-' + call.req.session.userId;
        var clientRequest = queuedRequests[qrKey];
        var cacheKey = Service.name + opts.url;
        var cachedClient = cache.get(cacheKey);
        if (cachedClient) {
            return callback(null, cachedClient);
        }

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
            var serviceConfig = {
                isSdc: opts.isSdc,
                url: opts.url,
                rejectUnauthorized: false,
                host: opts.host,
                headers: util._extend({
                    'Content-type': 'application/json'
                }, opts.headers)
            };

            if (serviceConfig.isSdc) {
                serviceConfig.headers = util._extend(serviceConfig.headers, {
                    'X-Auth-Token': call.req.session.token || call.req.cloud._token
                });
            } else {
                serviceConfig.requestCert = true;
                serviceConfig.ca = certificates.ca;
                serviceConfig.cert = certificates.cert;
                serviceConfig.key = certificates.key;
            }
            var service = new Service(serviceConfig, call);
            cache.set(cacheKey, service);
            callback(null, service);
        });
    }

    api.createClient = function (call, machine, callback) {
        var isSdc = machine.isSdc || machine.id === SDC_DOCKER_ID;
        var opts = {
            url: 'https://' + machine.primaryIp + (isSdc ? ':2376' : ':4243'),
            host: machine,
            isSdc: isSdc
        };
        createClient(call, Docker, opts, callback);
    };

    function parseAuthData(auth) {
        try {
            return JSON.parse(new Buffer(auth, 'base64').toString('utf8'));
        } catch (e) {
            return {};
        }
    }

    api.createRegistryClient = function (call, credentials, callback) {
        var parsedUrl = url.parse(credentials.host);
        var port = parseInt(credentials.port || parsedUrl.port, 10);
        if (port) {
            delete parsedUrl.host;
            parsedUrl.port = port;
        }

        if (credentials.auth) {
            var auth = parseAuthData(credentials.auth);
            if (auth.username && auth.password) {
                parsedUrl.auth = [auth.username, auth.password].join(':');
            }
        }
        var opts = {
            url: url.format(parsedUrl),
            headers: credentials.headers
        };
        createClient(call, Registry, opts, callback);
    };

    api.createIndexClient = function (call, options, callback) {
        var credentials = options.registry;
        var imageName = options.image;
        var access = options.access;
        var basicAuth = null;
        var parsedHost = url.parse(credentials.host);
        parsedHost.port = credentials.port || parsedHost.port;
        if (credentials.auth) {
            var auth = parseAuthData(credentials.auth);
            if (auth.username && auth.password) {
                parsedHost.auth = [auth.username, auth.password].join(':');
                basicAuth = new Buffer(parsedHost.auth).toString('base64');
            }
        }
        delete parsedHost.host;
        var createClientOpts = {url: url.format(parsedHost)};
        if (basicAuth) {
            createClientOpts.headers = {'Authorization': 'Basic ' + basicAuth};
        }
        createClient(call, Index, createClientOpts, function (error, indexClient) {
            indexClient.getAuthToken(imageName, access || 'GET', function (authError, authResult) {
                if (authError) {
                    return callback(authError);
                }
                var registryCredentials = JSON.parse(JSON.stringify(credentials));
                registryCredentials.headers = {Authorization: 'Token ' + authResult.token};
                if (authResult.endpoint && registryCredentials.type !== 'local') {
                    var parsedUrl = url.parse(credentials.host);
                    if (authResult.endpoint.indexOf('http') !== 0) {
                        registryCredentials.host = parsedUrl.protocol + '//' + authResult.endpoint + '/';
                    } else {
                        registryCredentials.host = authResult.endpoint;
                    }
                    delete registryCredentials.auth;
                }

                api.createRegistryClient(call, registryCredentials, function (clientErr, client) {
                    callback(clientErr, {index: indexClient, registry: client});
                });
            });
        });
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
    api.getRegistries = function (call, client, callback, fromCache) {

        if (typeof (client) === 'function') {
            fromCache = callback;
            callback = client;
            client = scope.api('MantaClient').createClient(call);
        }

        if (typeof (fromCache) === 'boolean' && fromCache && Object.keys(api.registriesCache).length) {
            return callback(null, Object.keys(api.registriesCache).map(function (key) {return api.registriesCache[key];}));
        }
        client.getFileJson('~~/stor/.joyent/docker/registries.json', function (error, list) {
            if (error) {
                call.log.warn('Registries list is corrupted');
                return callback(error, list);
            }
            callback(null, list);
        });
    };

    api.getRegistry = function (call, registryId, callback) {
        api.getRegistries(call, function (error, list) {
            if (error && error.statusCode !== 404) {
                return callback(error);
            }
            var registry = list.find(function (registry) {
                return registry.id === registryId;
            });
            if (!registry) {
                if (registryId === 'default') {
                    return callback(null, {});
                }
                error = new Error('Registry "' + registryId + '" not found');
                error.statusCode = 404;
                return callback(new Error('Registry "' + registryId + '" not found'));
            }
            callback(null, registry);
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

    var timeout = api.timeout;

    function updateRegistriesList(call, data, callback) {
        setImmediate(callback);

        clearTimeout(timeout);
        timeout = setTimeout(function () {
            timeout = null;
            data = data.filter(function (item) {
                return api.registriesCache.hasOwnProperty(item.id);
            });
            api.saveRegistries(call, data, function () {});
        }, 500);
    }

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
                delete api.registriesCache[id];
                return updateRegistriesList(call, list, callback);
            } else {
                callback(null);
            }
        }, true);
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
                        client.ping(function(err) {
                            if (err) {
                                return callback(null, []);
                            }
                            client.searchImage({q: term}, callback);
                        });
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
                    'num_results': results.length,
                    query: term,
                    results: results
                });
            });
        });
    };

    // search tags on all hosts
    api.searchPrivateImageTags = function searchPrivateImageTags(call, name, callback) {
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
                            return callback(null);
                        }
                        client.ping(function(err) {
                            if (err) {
                                return callback(null);
                            }
                            client.imageTags({name: name}, callback);
                        });
                    });
                }
            }, function (errors, operations) {
                var results = [],
                    names = {};
                [].concat.apply([], operations.successes).forEach(function (response) {
                    if (response) {
                        for (name in response) {
                            if (names[name]) {
                                return;
                            }
                            names[name] = true;
                            results.push({name: name, layer: response[name]});
                        }
                    }
                });
                callback(null, results);
            });
        });
    };

    api.SUBUSER_LOGIN = SUBUSER_LOGIN;
    api.SUBUSER_REGISTRY_LOGIN = SUBUSER_REGISTRY_LOGIN;

    register('Docker', api);
};
