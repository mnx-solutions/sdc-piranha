'use strict';

var restify = require('restify');
var url = require('url');
var util = require('util');
var qs = require('querystring');
var vasync = require('vasync');
var fs = require('fs');
var path = require('path');
var config = require('easy-config');
var exec = require('child_process').exec;
var os = require('os');
var EventEmitter = require('events').EventEmitter;
var certMgmt = require('../../../lib/certificates');
var subuser = require('../../../lib/subuser');
var keys = require('../../../lib/keys');
var Auditor = require('./libs/auditor.js');
var utils = require('../../../lib/utils');
var cache = require('lru-cache')({
    max: 1000,
    maxAge: 10 * 60
});
var apiMethods = require(__dirname + '/data/api-methods');

var mantaPrivateKey;
if (config.manta.privateKey) {
    mantaPrivateKey = fs.readFileSync(config.manta.privateKey, 'utf-8');
}
var DOCKER_TCP_PORT = 4240;
var DOCKER_HUB_HOST = 'https://index.docker.io';
var SUBUSER_LOGIN = 'docker';
var SUBUSER_REGISTRY_LOGIN = SUBUSER_LOGIN + '_registry';
var SUBUSER_OBJ_NAME = 'docker';
var SUBUSER_OBJ_NAME_REGISTRY = SUBUSER_OBJ_NAME + '-registry';
var SUBUSER_LIST_RULES = ['can putobject', 'can putdirectory'];
var SUBUSER_LIST_RULES_REGISTRY = SUBUSER_LIST_RULES.concat([
    'can getobject',
    'can getdirectory',
    'can deleteobject',
    'can deletedirectory'
]);
var SDC_DOCKER_ID = '00000000-0000-0000-0000-000000000000';
var SDC_DOCKER_PATH = '~~/stor/.joyent/docker';
var SDC_DOCKER_REGISTRY_PATH = SDC_DOCKER_PATH + '/registry';
var sdcDockerConfig = config.features.sdcDocker === 'enabled' ?
    {
        id: SDC_DOCKER_ID,
        name: config.sdcDocker.name,
        datacenter: config.sdcDocker.datacenter,
        primaryIp: config.sdcDocker.ip,
        isSdc: true,
        prohibited: false
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

function createCallback(dockerInstance, opts, auditParams, callback) {
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
        if (!auditParams.silent && dockerInstance.auditor && (opts.auditType === 'docker' ||
            (opts.auditType && opts.auditType !== 'docker' && (auditParams.id || auditParams.Id)))) {
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

function createMethod(log, opts, selfName) {
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
        if (params.silent) {
            auditParams.silent = true;
            delete params.silent;
        }
        var path = opts.path;
        if (this.options.isSdc && path !== '/_ping') {
            path = '/v2' + path;
        }
        var options = {
            log: log,
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
            args.push(createCallback(self, opts, auditParams, callback));
        }

        client[requestMap[options.method]].apply(client, args);
    };
}

function createApi(log, map, container) {
    var name;
    for (name in map) {
        if (map.hasOwnProperty(name)) {
            container[name] = createMethod(log, map[name], name);
        }
    }
}

exports.init = function execute(log, config, done) {
    var disableTls = Boolean(config.docker && config.docker.disableTls);
    var Manta = require('../storage').MantaClient;
    var api = {};

    api.registriesCache = {
        getCache: function (call) {
            var userId = call && call.req.session.userId;
            return registriesCache[userId] || {};
        },
        getItem: function (call, registryId) {
            var cache = this.getCache(call);
            return cache[registryId];
        },
        length: function (call) {
            var cache = this.getCache(call);
            return Object.keys(cache).length;
        },
        list: function (call) {
            var cache = this.getCache(call);
            return Object.keys(cache).map(function (key) {return cache[key];})
        },
        put: function (call, id, registry) {
            var cache = this.getCache(call);
            cache[id] = registry;
            return cache;
        },
        delete: function (call, id) {
            var cache = this.getCache(call);
            delete cache[id];
        }
    };

    api.DockerHostUnreachable = DockerHostUnreachable;
    api.CAdvisorUnreachable = CAdvisorUnreachable;

    function Docker(options, call) {
        this.options = options;
        if (call) {
            var mantaClient = require('../storage').MantaClient.createClient(call);
            this.auditor = new Auditor(call, mantaClient);
        }
    }

    Docker.prototype.usePort = function (port) {
        var options = JSON.parse(JSON.stringify(this.options));
        var parsedUrl = url.parse(options.url);
        parsedUrl.port = port;
        delete parsedUrl.host;
        options.url = url.format(parsedUrl);

        var service = new Docker(options);
        service.auditor = this.auditor;
        return service;
    };

    function Registry(options) {
        this.options = options;
    }

    function Index(options) {
        this.options = options;
    }

    createApi(log, apiMethods.docker, Docker.prototype);

    createApi(log, apiMethods.registry, Registry.prototype);

    createApi(log, apiMethods.index, Index.prototype);
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

    api.privateRegistryImages = function (call, term, callback) {
        var client = Manta.createClient(call);
        // term = google/cadvisor
        // repo = google
        // name = cadvisor
        // else full search
        var repo = path.dirname(term);
        var opts = {
            type: 'd',
            mindepth: 1,
            maxdepth: 2
        };
        var result = [];
        var search = path.join(SDC_DOCKER_REGISTRY_PATH, 'repositories');
        if (repo !== '.') {
            search = path.join(search, repo);
            delete opts.mindepth;
            opts.maxdepth = 1;
            opts.name = new RegExp(path.basename(term) + '.*');
        }

        client.ftw(search, opts, function (err, res) {
            if (err) {
                if (err.statusCode === 404) {
                    return callback(null, []);
                }
                return callback(err);
            }
            res.on('entry', function (obj) {
                var name = path.join(path.basename(obj.parent), obj.name);
                if (!term || name.indexOf(term) !== -1) {
                    result.push({
                        description: null,
                        name: name
                    });
                }
            });
            res.on('end', function () {
                callback(null, result);
            });
            res.on('error', callback);
        });
    };

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
        return Object.keys(apiMethods.docker);
    };

    function verifySDCDockerAvailability(call, host, callback) {
        var showProhibited = call.data && call.data.prohibited;
        if (!host) {
            return callback(null, host);
        }
        host = utils.clone(host);
        api.createClient(call, host, function (error, client) {
            if (error) {
                return callback(error, host);
            }
            client.ping(function (error) {
                if (error &&
                    String(error.message || error).indexOf('Forbidden (This service') === 0) {
                    host.prohibited = true;
                }
                callback(error, (showProhibited || !host.prohibited) && host);
            });
        });
    }

    api.listHosts = function (call, callback) {
        var hostId = call.data && call.data.id;
        if (hostId === SDC_DOCKER_ID) {
            return verifySDCDockerAvailability(call, sdcDockerConfig, function (error, host) {
                callback(null, host);
            });
        }
        call.cloud.listDatacenters(function (error, datacenters) {
            if (error) {
                return callback(error);
            }
            vasync.forEachParallel({
                inputs: Object.keys(datacenters),
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
                verifySDCDockerAvailability(call, sdcDockerConfig, function (error, availableHost) {
                    var hosts = [].concat.apply(availableHost || [], operations.successes);
                    if (hostId) {
                        var host = hosts.find(function(host) {
                            return hostId === host.id;
                        });
                        return callback(host ? null : 'Docker host not found', host);
                    }
                    callback(null, hosts);
                });
            });
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
                } else if (status === 'unreachable') {
                    delete waitForHosts[pollerKey];
                    return poller.emit('error');
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

    function uploadKeysAndSetupSubusers(call, keyPair, uploadCallback) {
        var client = require('../storage').MantaClient.createClient(call);

        function setup(subuserLogin, subuserObjName, path, listRules, callback) {
            var options = {
                keyPair: keyPair,
                subuserLogin: subuserLogin,
                subuserObjName: subuserObjName,
                path: path,
                listRules: listRules
            }
            subuser.setupSubuserForManta(call, client, options, function (err) {
                callback(err);
            });
        }
        vasync.waterfall(
            [
                function (callback) {
                    client.putFileContents(SDC_DOCKER_PATH + '/private.key', keyPair.privateKey, function (err) {
                        callback(err);
                    });
                },
                function (callback) {
                    client.safeMkdirp(SDC_DOCKER_REGISTRY_PATH, {}, function (err) {
                        callback(err);
                    });
                },
                function (callback) {
                    setup(SUBUSER_LOGIN, SUBUSER_OBJ_NAME, SDC_DOCKER_PATH, SUBUSER_LIST_RULES, callback);
                },
                function (callback) {
                    setup(SUBUSER_REGISTRY_LOGIN, SUBUSER_OBJ_NAME_REGISTRY, SDC_DOCKER_REGISTRY_PATH, SUBUSER_LIST_RULES_REGISTRY, callback)
                }
            ],
        uploadCallback);
    }

    api.createHost = function (call, options, callback) {
        delete options.specification;
        // not declared in header, because both modules depend on each other
        var Machine = require('../machine').Machine;
        var mantaClient = require('../storage').MantaClient.createClient(call);

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
            uploadKeysAndSetupSubusers(call, keyPair, function (error) {
                if (error) {
                    return callback(error);
                }
                Machine.Create(call, options, callback);
            });
        }

        keys.getKeyPair(mantaClient, call, SDC_DOCKER_PATH + '/private.key', 'docker-portal', function (keyPair) {
            call.req.session.privateKey = keyPair.privateKey;
            options.metadata['docker-version'] = config.docker.dockerVersion;
            options.metadata['cadvisor-version'] = config.docker.cadvisorVersion;

            var certificates = call.req.session.dockerCerts;

            function done(certificates) {
                options.metadata = certMgmt.setMetadata(options.metadata, certificates);
                options.metadata = subuser.setMetadata(options.metadata, keyPair,
                    SUBUSER_LOGIN, mantaClient.user, mantaClient._url);
                uploadKeysAndCreateMachine(keyPair, options);
            }

            if (!certMgmt.checkCertificates(certificates)) {
                return done(certificates);
            }

            certMgmt.generateCertificates(mantaClient, SDC_DOCKER_PATH, function (error, certificates) {
                if (error) {
                    return callback(error);
                }
                call.req.session.dockerCerts = certificates;
                call.req.session.save(function (error) {
                    if (error) {
                        return call.done(error);
                    }
                    done(certificates);
                });
            });
        });
    };

    api.getHostStatus = function (call, machineId, callback) {
        if (machineId === SDC_DOCKER_ID) {
            setImmediate(function () {
                callback(null, 'completed');
            });
            return;
        }
        var client = require('../storage').MantaClient.createClient(call);
        client.getFileContents(SDC_DOCKER_PATH + '/.status-' + machineId, function (error, result) {
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

    api.setHostStatus = function (call, machineId, status, callback) {
        if (!callback || typeof callback !== 'function') {
            callback = function () {};
        }
        if (machineId === SDC_DOCKER_ID) {
            setImmediate(function () {
                callback(null);
            });
            return;
        }
        var client = require('../storage').MantaClient.createClient(call);
        client.safePutFileContents(SDC_DOCKER_PATH + '/.status-' + machineId, JSON.stringify({status: status}), function () {
            return callback();
        });
    };

    function createClient(call, Service, opts, callback) {
        var cacheKey = Service.name + opts.url;
        var cachedClient = cache.get(cacheKey);
        var certificates = call.req.session.dockerCerts;
        if (cachedClient) {
            return callback(null, cachedClient);
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
            if (!certificates.ca) {
                return callback('Certificates were lost. Cannot connect to docker.');
            }
            serviceConfig.requestCert = true;
            serviceConfig.ca = certificates.ca;
            serviceConfig.cert = certificates.cert;
            serviceConfig.key = certificates.key;
        }

        var service = new Service(serviceConfig, call);
        cache.set(cacheKey, service);
        callback(null, service);
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

    api.isSdcHost = function (hostId) {
        return hostId === SDC_DOCKER_ID;
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
                if (code > 4 && code < 2048) {
                    break;
                }
            }

            logs += getLogFormat(response.substr(i), inputStr);
        });
        return logs;
    };

    api.getRegistries = function (call, client, callback, fromCache) {

        if (typeof (client) === 'function') {
            fromCache = callback;
            callback = client;
            client = require('../storage').MantaClient.createClient(call);
        }

        if (fromCache && api.registriesCache.length(call)) {
            return callback(null, api.registriesCache.list(call));
        }
        client.getFileJson(SDC_DOCKER_PATH + '/registries.json', function (error, list) {
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
        client = client || require('../storage').MantaClient.createClient(call);
        client.putFileContents(SDC_DOCKER_PATH + '/registries.json', JSON.stringify(data), function (error) {
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
                api.registriesCache.delete(call, id);
                return updateRegistriesList(call, list, callback);
            } else {
                callback(null);
            }
        }, true);
    };

    // search on all hosts
    api.searchPrivateImage = function searchPrivateImage(call, term, callback) {
        api.privateRegistryImages(call, term, function (error, images) {
            if (error) {
                return callback(error);
            }
            callback(null, {
                'num_results': images.length,
                query: term,
                results: images
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
    api.DOCKER_TCP_PORT = DOCKER_TCP_PORT;
    api.DOCKER_HUB_HOST = DOCKER_HUB_HOST;
    exports.Docker = api;
    done();
};
