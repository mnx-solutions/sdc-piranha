'use strict';

var config = require('easy-config');
var path = require('path');
var vasync = require('vasync');
var util = require('util');
var ursa = require('ursa');
var fs = require('fs');
var uuid = require('../../../static/vendor/uuid/uuid.js');
var registryConfig = fs.readFileSync(path.join(__dirname, '..', 'data/registry-config.yml'), 'utf-8');
var api = require('../');
var utils = require('../../../../lib/utils');

var MESSAGE_WRONG_IMAGE_NAME = 'Wrong image name';
var REGEX_OBJECTS_SEPARATOR = /(?:\}\s*\{|\}\s*$)/;
var DOCKER_HUB_URL = 'index.docker.io';
var DEFAULT_REGISTRY_ID = 'default';
var AuditorType = {
    IMAGE: 'image',
    CONTAINER: 'container',
    DOCKER: 'docker'
};

function jsonStreamParser(res, callback) {
    var accumulatedData = '';
    function parse(part) {
        try {
            return JSON.parse(part);
        } catch (e) {
            return undefined;
        }
    }

    function regexIndexOf(str, regex, start) {
        start = start || 0;
        var index = str.substring(start).search(regex);
        return index >= 0 ? index + start : index;
    }

    res.on('data', function (data) {
        var nextLine = 0;
        var index;
        accumulatedData += data.toString();
        //noinspection JSLint
        while ((index = regexIndexOf(accumulatedData, REGEX_OBJECTS_SEPARATOR, nextLine)) !== -1) {
            var part = accumulatedData.slice(nextLine, index + 1);
            var json = parse(part.trim());
            if (json === undefined) {
                break;
            }
            callback(json);
            nextLine = index + 1;
        }
    });
}

function parseTag(tag) {
    var parts = /(?:([^:]+:\d+)\/)?((?:([^\/]+)\/)?([^:]+))(?::(.+$))?/.exec(tag);
    if (!parts) {
        return {};
    }

    return {
        tag: parts[5],
        name: parts[4],
        repository: parts[3] || '',
        fullname: parts[2],
        registry: parts[1]
    };
}

var getImageInfo = function (call, Docker, registryId, image, callback) {
    var registry = Docker.registriesCache.getItem(call, registryId);
    var infoOptions = {registry: registry, name: image.name, tag: image.tag};
    Docker.getImageInfo(call, infoOptions, callback);
};

var pullImage = function (call, options, auth) {
    var auditEntry = {
        host: call.data.host.id,
        entry: options.id,
        type: options.id ? 'image' : 'docker',
        name: 'pull'
    };
    var client = api.Docker.createClient(call, call.data.host);
    var createImageCallback = function (error) {
        return putToAudit(call, client.auditor, auditEntry, options, error, true);
    };
    client.createImage(options, function (err, req) {
        if (err) {
            return createImageCallback(err);
        }
        if (auth) {
            req.setHeader('X-Registry-Auth', auth);
        }
        req.on('result', function (error, res) {
            var layersMap = {};
            if (error) {
                return createImageCallback(error);
            }

            jsonStreamParser(res, function (chunk) {
                if (chunk.id) {
                    var oldChunk = layersMap[chunk.id];
                    if (!oldChunk ||
                        oldChunk.status !== chunk.status ||
                        chunk.progressDetail && oldChunk.progressDetail &&
                        chunk.progressDetail.current - oldChunk.progressDetail.current > 5000000) {
                        call.update(null, chunk);
                        layersMap[chunk.id] = chunk;
                    }
                } else {
                    if (chunk.error) {
                        error = chunk.errorDetail;
                    }
                    call.update(null, chunk);
                }
            });

            res.on('end', function () {
                createImageCallback(null);
            });
            res.on('error', function (err) {
                createImageCallback(err);
            });
        });
        req.end();
    });
};

function putToAudit (call, auditor, entry, params, error, finish) {
    var result = false;
    if (error) {
        params.error = true;
        params.errorMessage = error.message || error;
        if (error.statusCode === 404 || error === 'Unable to pull empty repository' ||
            error.message === MESSAGE_WRONG_IMAGE_NAME) {
            result = true;
            call.log.info(params.errorMessage);
        }
    }
    auditor.put(entry, params);
    if (finish) {
        call.done(error, result);
    }
}

var uploadImage = function (call) {
    var Docker = api.Docker;
    var options = call.data.options;
    var imageId = options.image.Id;
    var registry = options.registry;
    var name = options.name;
    var parsedTag = parseTag(name);
    var pipeline = [];
    var registryUrl = Docker.getRegistryUrl(registry);
    var taggedName = parsedTag.repository + '/' + parsedTag.name;
    var entry = {
        host: call.data.host.id,
        entry: imageId,
        type: AuditorType.IMAGE,
        name: 'push'
    };
    var client = Docker.createClient(call, call.data.host);
    if ((registryUrl === DOCKER_HUB_URL || registry.type === Docker.REGISTRY_GLOBAL) && !parsedTag.repository) {
        taggedName = registry.username + '/' + parsedTag.name;
    } else if (registryUrl !== DOCKER_HUB_URL) {
        registry.type = registry.type || Docker.REGISTRY_LOCAL;
        registryUrl = registry.type === Docker.REGISTRY_LOCAL ? 'localhost:' + Docker.DEFAULT_REGISTRY_PORT : registryUrl;
        taggedName = registryUrl + '/' + parsedTag.fullname;
    }

    pipeline.push(function getRegistry(collector, callback) {
        if (registry.type === Docker.REGISTRY_LOCAL) {
            collector.registryAuth = new Buffer(JSON.stringify({auth: '', email: ''})).toString('base64');
            return callback();
        }
        Docker.getRegistry(call, registry.id, function (error, registryRecord) {
            if (error || !registryRecord) {
                return callback('Registry not found!');
            }
            if (registryRecord.auth) {
                collector.registryAuth = registryRecord.auth;
            }

            callback();
        });
    });

    pipeline.push(function addTag(collector, callback) {
        client.tagImage({
            name: imageId,
            repo: taggedName,
            tag: (parsedTag.tag || 'latest'),
            force: true
        }, callback);
    });

    pipeline.push(function getImageSlices(collector, callback) {
        client.historyImage({id: imageId}, function (error, slices) {
            collector.slices = slices;
            callback(error);
        });
    });

    pipeline.push(function pushImage(collector, callback) {
        var images = {};
        var total = 0;
        var buffer = 0;
        collector.slices.forEach(function (slice) {
            total += slice.Size;
            images[slice.Id.substr(0, 12)] = slice;
        });
        var uploaded = total;
        client = client.usePort(Docker.DOCKER_TCP_PORT);
        client.pushImage({
            tag: parsedTag.tag || 'latest',
            name: taggedName
        }, function (error, req) {
            if (error) {
                return callback(error);
            }
            if (collector.registryAuth) {
                req.setHeader('X-Registry-Auth', collector.registryAuth);
            }

            req.on('result', function (error, res) {
                var result;
                if (error) {
                    return callback(error);
                }
                res.on('error', callback);
                res.on('end', callback);
                jsonStreamParser(res, function (chunk) {
                    var currentImage = images[chunk.id];
                    if (chunk.error) {
                        return call.update(chunk.error);
                    }
                    if (!chunk.id || !currentImage) {
                        return call.update(null, {status: chunk.status});
                    }

                    if (chunk.status === 'Image already pushed, skipping') {
                        uploaded -= currentImage.Size;
                    } else if (chunk.progressDetail) {
                        var progressDetail = chunk.progressDetail;
                        if (chunk.status === 'Pushing') {
                            uploaded -= progressDetail.current || 0;
                        } else if (chunk.status === 'Buffering to disk') {
                            buffer += progressDetail.current || 0;
                        }
                    }

                    result = {
                        status: chunk.status,
                        total: total,
                        uploaded: total - uploaded,
                        percents: Math.floor((total - uploaded) * 100 / total),
                        buffer: buffer
                    };
                    call.update(null, result);
                });
            });
            req.end();
        });
    });
    vasync.pipeline({
        funcs: pipeline,
        arg: {}
    }, function (error) {
        if (error) {
            if (error.statusCode === 500 && !error.message) {
                error.message = 'Private registry is corrupted';
            }
        }
        putToAudit(call, client.auditor, entry, options, error, true);
    });
};

var forceRemoveImage = function (call) {
    var image;
    var imageShortId = call.data.options.id.substr(0, 12);
    var dockerClient = api.Docker.createClient(call, call.data.host);
    vasync.waterfall([
        function (callback) {
            dockerClient.images(function (imagesErr, images) {
                callback(imagesErr, images);
            });
        },
        function (images, callback) {
            image = images.find(function (img) {
                return img.Id.substr(0, 12) === imageShortId;
            });
            if (!image) {
                return callback('Image "' + imageShortId + '" not found.', true);
            }
            dockerClient.containers({all: true}, function (containersErr, containers) {
                callback(containersErr, containers);
            });
        },
        function (containers, callback) {
            var usedByContainer = containers.find(function (container) {
                return container.Image.substr(0, 12) === imageShortId || image.RepoTags && image.RepoTags.indexOf(container.Image) !== -1;
            });
            if (usedByContainer) {
                callback('Image "' + imageShortId + '" is used by container "' + usedByContainer.Id.substr(0, 12) + '" and cannot be deleted.');
            } else {
                callback();
            }
        },
        function (callback) {
            var tags = image.RepoTags || [image.Id];
            var tagsMap = {};
            var funcs = [];
            tags.forEach(function (tag) {
                var tagRepository = tag.split(':')[0];
                tagsMap[tagRepository] = true;
            });
            Object.keys(tagsMap).forEach(function () {
                funcs.push(function (callback) {
                    dockerClient.removeImage({id: image.Id, force: true}, function (error) {
                        callback(error);
                    });
                });
            });
            vasync.parallel({
                funcs: funcs
            }, callback);
        }
    ], call.done.bind(call));
};

var run = function (call, callback) {
    var Docker = api.Docker;
    var host = call.data.host;
    var options = call.data.options;
    var createOptions = options.create;
    var startOptions = options.start;
    var pipeline = [];
    var dockerClient = Docker.createClient(call, host);
    var auditor = dockerClient.auditor;
    var containerId;

    pipeline.push(function listImages(collector, callback) {
        dockerClient.images({}, function (error, images) {
            collector.hostImages = images || [];
            callback(error);
        });
    });

    pipeline.push(function pullImageIfNecessary(collector, callback) {
        var doesImageExist = collector.hostImages.some(function (image) {
            return image.RepoTags.some(function(tag) {
                return createOptions.Image === tag;
            });
        });
        if (doesImageExist) {
            return callback();
        }
        var image = parseTag(options.create.Image);
        dockerClient.pullImage({fromImage: image.name, tag: image.tag, registry: image.registry, repo: image.repository}, function (error) {
            callback(error);
        });
    });

    pipeline.push(function createContainer(collector, callback) {
        dockerClient.create(createOptions, function (error, response) {
            containerId = startOptions.id = response && response.Id;
            callback(error);
        });
    });

    pipeline.push(function startContainer(collector, callback) {
        dockerClient.startImmediate(util._extend({}, startOptions), function (error) {
            callback(error);
        });
    });

    pipeline.push(function setAudit(collector, callback) {
        var entry = startOptions.id;
        delete startOptions.id;
        auditor.put({
            host: host.id,
            entry: entry,
            type: AuditorType.CONTAINER,
            name: 'run'
        }, options);
        callback();
    });

    vasync.pipeline({
        funcs: pipeline,
        arg: {}
    }, function (error) {
        if (error) {
            auditor.put({
                host: host.id,
                entry: startOptions.id,
                type: startOptions.id ? AuditorType.CONTAINER : AuditorType.DOCKER,
                name: 'run'
            }, util._extend(options, {error: true, errorMessage: error.message || error}));
        }
        if (typeof callback === 'function') {
            callback(error, containerId);
        } else {
            call.done(error, containerId);
        }
    });
};

var pull = function (call) {
    var Docker = api.Docker;
    var dockerClient = Docker.createClient(call, call.data.host);
    var options = call.data.options;
    var registryId = options.registryId;
    var entry = {
        host: call.data.host.id,
        entry: options.id,
        type: options.id ? AuditorType.IMAGE : AuditorType.DOCKER,
        name: 'pull'
    };
    call.data.authNotRequired = call.data.host.isSdc;
    if (!registryId || registryId === Docker.REGISTRY_LOCAL) {
        return pullImage(call, options);
    }
    Docker.getRegistry(call, registryId, function (error, registryRecord) {
        if (error && error.statusCode !== 404) {
            return call.done(error.message);
        }
        if (!registryRecord && registryId === DEFAULT_REGISTRY_ID) {
            return putToAudit(call, dockerClient.auditor, entry, options, 'Please fill authentication information for the registry.', true);
        }

        registryRecord = registryRecord || {};
        var auth = registryRecord.auth || new Buffer(JSON.stringify({auth: '', email: ''})).toString('base64');

        getImageInfo(call, Docker, registryId, {name: call.data.options.fromImage, tag: call.data.options.tag}, function (err, result) {
            if (!err) {
                call.update(null, {totalSize: result.size});
            }
            pullImage(call, options, auth);
        });
    });
};

var createRegistry = function (call) {
    if (call.data.options.api === 'v2') {
        return createRegistryV2(call);
    }
    var Docker = api.Docker;
    var mantaClient = require('../../storage').MantaClient.createClient(call);
    var dockerClient = Docker.createClient(call, call.data.host);
    var pipeline = [];
    var installConfig = config.docker;
    var tcpRegistryPort = Docker.DEFAULT_REGISTRY_PORT + '/tcp';
    var hostConfig = {
        ExposedPorts: {},
        Binds: ['/root/.ssh:/root/.ssh:ro'],
        PortBindings: {},
        RestartPolicy: {Name: 'always', MaximumRetryCount: 0}
    };
    hostConfig.ExposedPorts[tcpRegistryPort] = {};
    hostConfig.PortBindings[tcpRegistryPort] = [{HostIp: Docker.DEFAULT_REGISTRY_HOST, HostPort: Docker.DEFAULT_REGISTRY_PORT}];

    pipeline.push(function getFingerprint(collector, callback) {
        mantaClient.getFileContents(Docker.SDC_DOCKER_PATH + '/private.key', function (error, privateKey) {
            if (error) {
                return callback(error);
            }
            var key = ursa.createPrivateKey(privateKey);
            collector.fingerprint = key.toPublicSshFingerprint('hex').replace(/([a-f0-9]{2})/gi, '$1:').slice(0, -1);
            callback();
        });
    });

    pipeline.push(function pullRegistryImage(collector, callback) {
        dockerClient.createImage({fromImage: 'registry', tag: (installConfig.registryVersion || 'latest')}, function (err, req) {
            if (err) {
                return callback(err);
            }
            req.on('result', function (error, res) {
                if (error) {
                    return callback(error);
                }

                res.on('data', function () {
                    // this event should exist
                });
                res.on('error', callback);
                res.on('end', callback);
            });
            req.end();
        });
    });

    pipeline.push(function createPrivateRegistryContainer(collector, callback) {
        var startupScript = 'if [ ! -f /.installed ];then apt-get update && apt-get install -y python-pip python-dev && ' +
            'pip install docker-registry docker-registry-driver-joyent_manta' + (installConfig.registryDriverVersion ? '==' + installConfig.registryDriverVersion : '') + ' && ' +
            'echo "' + registryConfig.replace(/\n/g, '\n').replace(/ {4}/g, '\t') + '" | sed -e \'s/\t/    /g\'>/config.yml;' +
            'touch /.installed;else docker-registry;fi';
        dockerClient.create({
            name: 'private-registry',
            Image: 'registry:' + (installConfig.registryVersion || 'latest'),
            Env: [
                'MANTA_KEY_ID=' + collector.fingerprint,
                'MANTA_PRIVATE_KEY=/root/.ssh/user_id_rsa',
                'MANTA_USER=' + mantaClient.user,
                'MANTA_SUBUSER=' + Docker.SUBUSER_REGISTRY_LOGIN,
                'SETTINGS_FLAVOR=dev',
                'SEARCH_BACKEND=',
                'DOCKER_REGISTRY_CONFIG=/config.yml',
                'REGISTRY_PORT=' + Docker.DEFAULT_REGISTRY_PORT,
                'STARTUP_SCRIPT=' + startupScript
            ],
            Cmd: ['/bin/bash', '-c', 'printenv STARTUP_SCRIPT | /bin/bash'],
            Volumes: {
                '/root/.ssh': {}
            },
            AttachStderr: true,
            AttachStdin: true,
            AttachStdout: true,
            OpenStdin: true,
            StdinOnce: true,
            Tty: true,
            HostConfig: hostConfig
        }, function (error, registry) {
            collector.registry = registry;
            callback(error);
        });
    });

    pipeline.push(function installRegistryDriver(collector, callback) {
        dockerClient.start(util._extend({id: collector.registry.Id}, hostConfig), callback);
    });

    pipeline.push(function waitInstalling(collector, callback) {
        dockerClient.logs({id: collector.registry.Id, follow: true}, callback);
    });

    vasync.pipeline({
        funcs: pipeline,
        arg: {}
    }, function (error) {
        var host = 'https://' + call.data.host.primaryIp;
        if (error) {
            return Docker.deleteRegistry(call, 'host', host, function () {
                return call.done(error);
            });
        }
        Docker.getRegistries(call, mantaClient, function (error, list) {
            var registry;
            list = list.map(function (item) {
                if (item.host === host) {
                    delete item.actionInProgress;
                    registry = item;
                }
                return item;
            });
            registry = registry || {};

            if (!registry.id) {
                registry = {
                    id: uuid.v4(),
                    api: registry.api || 'v1',
                    host: host,
                    port: registry.port || Docker.DEFAULT_REGISTRY_PORT,
                    type: Docker.REGISTRY_LOCAL
                };
                list.push(registry);
            }
            Docker.registriesCache.put(call, registry.id, registry);
            Docker.saveRegistries(call, list, mantaClient);
        });
    });
};

var createRegistryV2 = function (call) {
    var Docker = api.Docker;
    var mantaClient = require('../../storage').MantaClient.createClient(call);
    var dockerClient = Docker.createClient(call, call.data.host);
    var installConfig = config.docker || {};
    var pipeline = [];
    var importOptions = {
        fromImage: installConfig.registryV2Image,
        tag: (installConfig.registryV2Tag)
    };
    var tcpRegistryPort = Docker.DEFAULT_REGISTRY_PORT + '/tcp';
    var hostConfig = {
        Dns: ['8.8.8.8', '8.8.4.4'],
        ExposedPorts: {},
        PortBindings: {},
        RestartPolicy: {Name: 'always', MaximumRetryCount: 0}
    };
    hostConfig.ExposedPorts[tcpRegistryPort] = {};
    hostConfig.PortBindings[tcpRegistryPort] = [{HostIp: Docker.DEFAULT_REGISTRY_HOST, HostPort: Docker.DEFAULT_REGISTRY_PORT}];

    pipeline.push(function getFingerprint(collector, callback) {
        mantaClient.getFileContents(Docker.SDC_DOCKER_PATH + '/private.key', function (error, privateKey) {
            if (error) {
                return callback(error);
            }
            var key = ursa.createPrivateKey(privateKey);
            collector.privateKey = privateKey;
            collector.fingerprint = key.toPublicSshFingerprint('hex').replace(/([a-f0-9]{2})/gi, '$1:').slice(0, -1);
            callback();
        });
    });

    pipeline.push(function pullDockerImage(collector, callback) {
        dockerClient.createImage(importOptions, function (err, req) {
            if (err) {
                return callback(err);
            }
            req.on('result', function (error, res) {
                if (error) {
                    return callback(error);
                }

                res.on('data', function () {
                    // this event should exist
                });
                res.on('error', callback);
                res.on('end', callback);
            });
            req.end();
        });
    });
    pipeline.push(function createPrivateRegistryContainer(collector, callback) {
        dockerClient.create({
            name: 'private-registry',
            Image: importOptions.fromImage + ':' + importOptions.tag,
            Env: [
                'MANTA_KEY_ID=' + collector.fingerprint,
                'MANTA_KEY_DATA=' + collector.privateKey,
                'MANTA_USER=' + mantaClient.user,
                'MANTA_SUBUSER=' + Docker.SUBUSER_REGISTRY_LOGIN,
                'MANTA_URL=' + mantaClient._url
            ],
            AttachStderr: true,
            AttachStdin: true,
            AttachStdout: true,
            OpenStdin: true,
            StdinOnce: true,
            Tty: true,
            HostConfig: hostConfig
        }, function (error, registry) {
            collector.registry = registry;
            callback(error);
        });
    });

    pipeline.push(function startRegistry(collector, callback) {
        dockerClient.start(util._extend({id: collector.registry.Id}, hostConfig), callback);
    });

    vasync.pipeline({funcs: pipeline, arg: {}}, function (error) {
        var host = 'https://' + call.data.host.primaryIp;
        if (error) {
            return Docker.deleteRegistry(call, 'host', host, function () {
                return call.done(error);
            });
        }
        Docker.getRegistries(call, mantaClient, function (error, list) {
            var registry;
            list = list.map(function (item) {
                if (item.host === host) {
                    delete item.actionInProgress;
                    registry = item;
                }
                return item;
            });
            if (!registry || !registry.id) {
                registry = {
                    id: uuid.v4(),
                    api: 'v2',
                    host: host,
                    port: Docker.DEFAULT_REGISTRY_PORT,
                    type: Docker.REGISTRY_LOCAL
                };
                list.push(registry);
            }
            Docker.registriesCache.put(call, registry.id, registry);
            Docker.saveRegistries(call, list, mantaClient);
        });
    });
};

var getRegistryImages = function (call) {
    var Docker = api.Docker;
    var registryId = call.data.registryId;
    var searchQuery = {};
    function updateImagesInfo(images) {
        vasync.forEachParallel({
            inputs: images,
            func: function (image, callback) {
                getImageInfo(call, Docker, registryId, image, function (err, result) {
                    image.info = result;
                    call.update(null, image);
                    callback();
                });
            }
        }, function (vasyncErrors) {
            var error = utils.getVasyncData(vasyncErrors).error;
            call.done(error, error && error !== vasyncErrors && error instanceof Docker.DockerHostUnreachable);
        });
    }
    function updateImagesInfoV2(client, images) {
        var pipeline = [];
        var collector = {images: {}, tags: {}};
        var taggedImages = [];
        pipeline.push(function getImageTags(collector, callback) {
            vasync.forEachParallel({
                inputs: images,
                func: function (image, vasyncCallback) {
                    var imageName = image.name;
                    client.getImageTags({name: imageName}, function (error, tags) {
                        if (error || !tags) {
                            return vasyncCallback();
                        }
                        var image = collector.images[imageName] = collector.images[imageName] || {name: imageName, tags: []};
                        image.tags = tags;
                        Object.keys(tags).forEach(function (tag) {
                            var taggedImage = {
                                name: imageName,
                                tag: tag
                            };
                            taggedImages.push(taggedImage);
                            collector.tags[imageName + ':' + tag] = taggedImage;
                        });
                        vasyncCallback();
                    });
                }
            }, function () {
                call.update(null, {images: taggedImages});
                callback();
            });
        });
        pipeline.push(function getImageManifests(collector, callback) {
            var results = {};
            vasync.forEachParallel({
                inputs: Object.keys(collector.tags),
                func: function (tag, vasyncCallback) {
                    var image = collector.tags[tag];
                    var result = results[tag] = results[tag] || {
                        name: image.name,
                        tag: image.tag,
                        info: {
                            images: [],
                            length: 0,
                            size: 0
                        }
                    };

                    client.getImageInfo({name: image.name, tag: image.tag}, function (error, info) {
                        result.info = info;
                        call.update(null, result);
                        vasyncCallback();
                    });
                }
            }, function () {
                callback();
            });
        });

        vasync.pipeline({
            funcs: pipeline,
            arg: collector
        }, function () {
            call.done(null, {});
        });
    }

    function getImageTagsAndUpdateInfo(client, records) {
        var images = [];
        if (!records.length) {
            call.update(null, []);
            return call.done(null);
        }
        vasync.forEachParallel({
            inputs: records,
            func: function (image, callback) {
                client.getImageTags({name: image.name}, function (error, tags) {
                    if (error || !tags) {
                        return callback();
                    }
                    if (!Array.isArray(tags)) {
                        tags = Object.keys(tags);
                    }
                    if (tags.length === 0) {
                        images.push(util._extend({tag: ''}, image));
                    }
                    tags.forEach(function (tag) {
                        var imageCopy = util._extend({}, image);
                        imageCopy.tag = tag.name || tag;
                        images.push(imageCopy);
                    });
                    callback();
                });
            }
        }, function () {
            call.update(null, {images: images});
            updateImagesInfo(images);
        });

    }
    Docker.getRegistry(call, registryId, function (error, registryRecord) {
        if (error || !registryRecord  && registryId !== DEFAULT_REGISTRY_ID) {
            return call.done('Registry not found.');
        }
        registryRecord = registryRecord || {};
        if (registryRecord.type === Docker.REGISTRY_GLOBAL || registryId === DEFAULT_REGISTRY_ID ||
            registryRecord.host.indexOf(DOCKER_HUB_URL) > -1) {
            if (!registryRecord.username) {
                return call.done(null, {images: []});
            }
            searchQuery.q = registryRecord.username;
        } else if (registryRecord.api === 'v2') {
            var client = Docker.createRegistryClient(call, registryRecord);
            client.searchImage({}, function (error, response) {
                if (error || !response || !Array.isArray(response.results) || !response.results.length) {
                    return call.update(error, {images: []});
                }

                updateImagesInfoV2(client, response.results);
            });
            return;
        } else if (registryRecord.type === Docker.REGISTRY_LOCAL) {
            Docker.privateRegistryImages(call, searchQuery.q, function (error, records) {
                if (error) {
                    return call.done(error);
                }
                var client = Docker.createRegistryClient(call, registryRecord);
                getImageTagsAndUpdateInfo(client, records);
            });
            return;
        }

        var registryClient = Docker.createRegistryClient(call, registryRecord);
        registryClient.searchImage(searchQuery, function (error, response) {
            if (error && (error.statusCode === 404 || String(error).indexOf('404 page not found') > -1)) {
                // this occurred because trying to connect to different registry version
                error = response = null;
            }
            if (error || !response || !response.results) {
                return call.done(error, {images: []});
            }

            var results = response.results;
            if (registryRecord.host === Docker.DOCKER_HUB_HOST) {
                results = results.filter(function (image) {
                    return image.name.indexOf(registryRecord.username + '/') === 0;
                });
            }
            getImageTagsAndUpdateInfo(registryClient, results);
        });
    });
};

var removeRegistryImage = function (call) {
    var Docker = api.Docker;
    var registryId = call.data.registryId;
    Docker.getRegistry(call, registryId, function (error, registryRecord) {
        if (error) {
            return call.done(error.message || error);
        }

        if (registryRecord.api === 'v2') {
            var client = Docker.createRegistryClient(call, registryRecord);
            client.removeImage({name: call.data.name, id: call.data.id}, call.done.bind(call));
            return;
        }
        registryRecord = registryRecord || {};
        var opts = {registry: registryRecord, image: call.data.name, access: 'DELETE'};
        if (registryRecord.type === Docker.REGISTRY_LOCAL) {
            opts.access = 'GET';
        }
        Docker.createIndexClient(call, opts, function (error, clients) {
            if (error) {
                return call.done(error.message || error, true);
            }
            var removeOpts = {name: call.data.name};
            var removeMethod = 'removeImage';

            if (call.data.tag) {
                removeOpts.tag = call.data.tag;
                removeMethod = 'removeImageTag';
            }

            clients.registry[removeMethod](removeOpts, function (error) {
                call.done(error && error !== '""' && error || null);
            });
        });
    });
};

var tagRegistryImage = function (call) {
    var Docker = api.Docker;
    Docker.getRegistry(call, call.data.registryId, function (error, registryRecord) {
        if (error) {
            return call.done(error.message || error);
        }

        registryRecord = registryRecord || {};
        var opts = {registry: registryRecord, image: call.data.options.name, access: 'POST'};
        if (registryRecord.type === Docker.REGISTRY_LOCAL) {
            opts.access = 'GET';
        } else if (registryRecord.type === Docker.REGISTRY_REMOTE && call.data.action === 'addImageTag') {
            opts.access = 'PUT';
        }
        Docker.createIndexClient(call, opts, function (error, clients) {
            if (error) {
                return call.done(error.message || error, true);
            }

            clients.registry[call.data.action]({name: call.data.options.name, tag: call.data.options.tagName, forceRaw: true}, function (error, req) {
                if (error) {
                    return call.done(error.message || error, true);
                }
                if (call.data.action === 'addImageTag') {
                    req.useChunkedEncodingByDefault = false;
                    req.setSocketKeepAlive(false);
                    req.setHeader('Content-type', 'text/plain');
                    req.setHeader('Content-length', call.data.options.layoutId.length);
                }
                req.write(call.data.options.layoutId);
                req.on('result', function (err, res) {
                    if (err) {
                        return call.done(err.message || err.body.code || err);
                    }
                    res.on('data', function () {});
                    res.on('error', call.done.bind(call));
                    res.on('end', call.done.bind(call));
                });
                req.end();
            });
        });
    });
};

if (!config.features || config.features.docker !== 'disabled') {
    module.exports = {
        run: run,
        pull: pull,
        uploadImage: uploadImage,
        forceRemoveImage: forceRemoveImage,
        createRegistry: createRegistry,
        createRegistryV2: createRegistryV2,
        getRegistryImages: getRegistryImages,
        tagRegistryImage: tagRegistryImage,
        removeRegistryImage: removeRegistryImage
    };
}
