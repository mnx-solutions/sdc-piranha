'use strict';
var cache = require('lru-cache')({
    max: 1000,
    maxAge: 60000 //ms
});
var pollerJobs = {};
var EventEmitter = require('events').EventEmitter;

exports.init = function execute(log, config, done) {
    var info = require('../cms').Info;
    var utils = require('../../../lib/utils');

    var api = {};
    var creatingImagesCache = {};

    var IMAGE_CREATE_NOT_SUPPORTED = 'Image creation for %s is not currently supported';
    var STATE_POLL_TIMEOUT = 60 * 60 * 1000;

    function filterFields(machine) {
        ['user-script', 'ufds_ldap_root_dn', 'ufds_ldap_root_pw'].forEach(function (f) {
            if (machine.metadata[f]) {
                machine.metadata[f] = '__cleaned';
            }
        });

        // Clean null networks
        if (machine.networks) {
            machine.networks = machine.networks.filter(function (network) {
                return !!network;
            });
        }

        machine['firewall_supported'] = machine.type === 'smartmachine' ||
            machine.type === 'virtualmachine' && machine['compute_node'] && config.ns['fw-blist'].indexOf(machine['compute_node']) === -1;

        if (new Date(machine.created) < new Date(config.images['earliest_date'])) {
            machine.imageCreateNotSupported = 'Instances created before ' + config.images['earliest_date'] +
                ' are not supported for image creation.';
        }

        return machine;
    }

    function handleCredentials(machine) {
        var systemsToLogins = {
            'mysql' : ['MySQL', 'root'],
            'pgsql' : ['PostgreSQL', 'postgres'],
            'virtualmin' : ['Virtualmin', 'admin']
        };

        var credentials = [];
        if (machine.metadata && machine.metadata.credentials) {
            Object.keys(machine.metadata.credentials).forEach(function (username) {
                var system = systemsToLogins[username] ? systemsToLogins[username][0] : 'Operating System';
                var login = systemsToLogins[username] ? systemsToLogins[username][1] : username;

                credentials.push(
                    {
                        'system' : system,
                        'username' : login.split('_')[0],
                        'password' : machine.metadata.credentials[username]
                    }
                );
            });
        }

        return credentials;
    }

    function createPoller(call, timeout, callback, fn) {
        var poller = setInterval(fn, config.polling.machineState);
        var pollerTimeout = setTimeout(function () {
            clearInterval(poller);
            call.done('Operation timed out');
        }, timeout);

        return function clearPoller(err, result) {
            clearInterval(poller);
            clearTimeout(pollerTimeout);
            callback(err, result);
        };
    }

    /**
     * Waits for machine state, package or name change
     * @param {Object} cloud
     * @param {Object} call - machine ID is taken from call.data.uuid or call.data if it's a string
     * @param {String} prop - what to poll
     * @param {String} expect - what to expect
     * @param {Number} [timeout=300000] - timeout in milliseconds, defaults to 5m
     * @param {String} [type=Machine] - type we are polling, defaults to machine
     * @param {Function} cb
     */
    function pollForObjectStateChange(cloud, call, prop, expect, timeout, type, objectId, cb) {
        objectId = objectId || (typeof call.data === 'object' ? call.data.uuid : call.data);

        timeout = timeout || 5 * 60 * 1000;
        type = type || 'Machine';

        var processNames = {
            name: 'renaming',
            package: 'resizing'
        };

        if (pollerJobs[objectId]) {
            pollerJobs[objectId].on('complete', cb);
            return;
        }

        var job = pollerJobs[objectId] = new EventEmitter;
        var callback = function (error, result) {
            if (pollerJobs[objectId]) {
                delete pollerJobs[objectId];
                job.emit('complete', error, result);
                cb(error, result);
            }
        };

        call.log = call.log.child({datacenter: cloud._currentDC});

        var clearPoller = createPoller(call, timeout, callback, function () {

            // acknowledge what are we doing to logs
            call.log.debug('Polling for %s %s %s to become %s', type.toLowerCase(), objectId, prop, expect);

            var getEntity = function (entityType, poller) {
                if (entityType === 'Image') {
                    return cloud.getImage(objectId, poller, null, true);
                } else {
                    return cloud['get' + entityType](objectId, true, poller, null, true);
                }
            };

            getEntity(type, function (err, object) {
                if (err) {
                    // in case we're waiting for deletion a http 410(Gone) or 404 is good enough
                    if ((err.statusCode === 410 || err.statusCode === 404) && prop === 'state' && expect === 'deleted') {
                        call.log.debug('%s %s is deleted, returning call', type, objectId);
                        clearPoller(null, object);
                        return;
                    }

                    if (err.message === 'socket hang up') {
                        call.log.error({error: err}, 'Cloud polling failed, but polling continues');
                        return;
                    }

                    if (err.name === 'NotAuthorizedError') {
                        call.log.info({error: err}, 'Cloud polling failed, no access');
                    } else {
                        call.log.error({error: err}, 'Cloud polling failed');
                    }

                    clearPoller(err, true);
                    return;
                }
                if (object.state === 'failed') {
                    call.log.error('%s %s fell into failed state', type, objectId);
                    var defaultMessage = type + ' fell into failed state';
                    clearPoller(object.error || defaultMessage);
                    return;
                }
                if (object[prop] === expect) {

                    if (type === 'Machine' && object.package === '') {
                        call.log.error('Machine %s package is empty after %s!', objectId, (processNames[prop] || prop));
                    }

                    call.log.debug('%s %s %s is %s as expected, returing call', type, objectId, prop, expect);
                    if (type === 'Machine') {
                        object.metadata = object.metadata || {};
                        object.metadata.credentials = handleCredentials(object);
                        object = filterFields(object);
                    }
                    clearPoller(null, object);
                } else {
                    call.log.trace('%s %s %s is %s, waiting for %s', type, objectId, prop, object[prop], expect);
                    call.step = {
                        state: processNames[prop] || object.state
                    };
                }

            });
        });
    }

    api.getWithStatus = function (machine, call) {
        var job = pollerJobs[machine.id];
        if (job) {
            call.update(null, machine);
            job.on('complete', call.done.bind(call));
        } else {
            call.done(null, machine);
        }
    };

    api.Create = function (call, options, callback) {
        // Not using immediate for dockerHost creation to prevent haproxy timeout
        if (call.getImmediate && options.specification !== 'dockerhost') {
            call.getImmediate();
        }

        if (options.specification) {
            // not declared in header, because both modules depend on each other
            var service = options.specification === 'dockerhost' ? 'Docker' : 'Dtrace';
            require('../' + service.toLowerCase())[service].createHost(call, options, callback);
            return;
        }

        call.log.info({obj: options}, 'Creating machine %s', options.name || 'with no name.');

        var cloud = call.cloud.separate(options.datacenter);

        var transformCollections = {
            metadata: 'metadata',
            tags: 'tag'
        };

        for (var collectionName in transformCollections) {
            if (options[collectionName]) {
                var collectionPrefix = transformCollections[collectionName];
                for (var itemKey in options[collectionName]) {
                    options[collectionPrefix + '.' + itemKey] = options[collectionName][itemKey];
                }
                delete options[collectionName];
            }
        }

        cloud.createMachine(options, function (err, machine) {
            if (!err) {
                if (call.immediate) {
                    call.immediate(null, {machine: machine});
                }
                // poll for machine status to get running (provisioning)
                pollForObjectStateChange(cloud, call, 'state', 'running', (STATE_POLL_TIMEOUT), null, machine.id, callback);
            } else {
                var noErrorLog = err.message && err.message.indexOf('QuotaExceeded') === 0;
                if (noErrorLog) {
                    // log QuotaExceeded error with level 30 instead of 50 like regular call does
                    call.log.info(err);
                }
                (callback || call.error)(err, noErrorLog);
            }
        });
    };

    api.Rename = function (call, options, callback) {
        var cloud = call.cloud.separate(options.datacenter);
        cloud.renameMachine(options.uuid, options, function (err) {
            if (!err) {
                // poll for machine name change (rename)
                pollForObjectStateChange(cloud, call, 'name', options.name, (STATE_POLL_TIMEOUT), null, options.uuid, callback);
            } else {
                (callback || call.error)(err);
            }
        });
    };

    api.Resize = function (call, options, callback) {
        call.log.info('Resizing machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.resizeMachine(options.uuid, options, function (err) {
            if (!err) {
                // poll for machine package change (resize)
                pollForObjectStateChange(cloud, call, 'package', options.packageName, null, null, options.uuid, callback);
            } else {
                var noErrorLog = err.message && err.message.indexOf('Invalid VM update parameters') !== -1;
                (callback || call.error)(err, noErrorLog);
            }
        });
    };

    api.Start = function (call, options, callback) {
        call.log.debug('Starting machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.startMachine(options.uuid, function (err) {
            if (!err) {
                pollForObjectStateChange(cloud, call, 'state', 'running', null, null, options.uuid, callback);
            } else {
                (callback || call.error)(err);
            }
        });
    };

    api.Stop = function (call, options, callback) {
        call.log.debug('Stopping machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.stopMachine(options.uuid, function (err) {
            if (!err) {
                pollForObjectStateChange(cloud, call, 'state', 'stopped', null, null, options.uuid, callback);
            } else {
                (callback || call.error)(err);
            }
        });
    };

    api.Delete = function (call, options, callback) {
        call.log.debug('Deleting machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cache.set(options.uuid, 'deleting');
        cloud.deleteMachine(options.uuid, function (err) {
            if (!err) {
                pollForObjectStateChange(cloud, call, 'state', 'deleted', null, null, options.uuid, function () {
                    cache.del(options.uuid);
                    callback.apply(this, arguments);
                });
            } else {
                cache.del(options.uuid);
                (callback || call.error)(err);
            }
        });
    };

    api.Reboot = function (call, options, callback) {
        call.log.debug('Rebooting machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.rebootMachine(options.uuid, function (err) {
            if (!err) {
                pollForObjectStateChange(cloud, call, 'state', 'running', null, null, options.uuid, callback);
            } else {
                (callback || call.error)(err);
            }
        });
    };

    api.State = function (call) {
        var machines = [];
        var mapped = {};
        var states = call.data.states ? call.data.states : {};

        api.List(call, false, function listCallback (err, list) {
            if (err) {
                return call.error(err);
            }

            // Machine state change
            list.forEach(function iterateMachine (machine) {
                if (states.hasOwnProperty(machine.id)) {
                    var state = states[machine.id];

                    // State change
                    if (machine.state !== state) {
                        machines.push(machine);
                    }
                } else { // New machine
                    machines.push(machine);
                }

                mapped[machine.id] = machine;
            });

            // Machine removal
            Object.keys(states).forEach(function iterateState (id) {
                if (!mapped.hasOwnProperty(id)) {
                    machines.push({
                        id: id,
                        state: 'deleted'
                    });
                }
            });

            return call.done(null, machines);
        });
    };

    api.List = function (call, progress, callback) {
        if (typeof (progress) === 'function') {
            callback = progress;
            progress = true;
        }

        call.log.info('Handling machine list event');

        call.cloud.listDatacenters(function (error, datacenters) {
            if (error) {
                return callback(error);
            }
            var keys = Object.keys(datacenters || {});
            var count = keys.length;
            var allMachines = [];

            if (count === 0) {
                callback(null, []);
                return;
            }

            keys.forEach(function (datacenterName) {
                var cloud = call.cloud.separate(datacenterName);
                call.log.debug('List machines for data center %s', datacenterName);
                cloud.listMachines({credentials: true}, function (err, machines) {
                    var response = {
                        name: datacenterName,
                        status: 'pending',
                        machines: []
                    };

                    if (err) {
                        call.log.info('List machines failed for data center %s, url %s; err.message: %s', datacenterName, datacenters[datacenterName], err.message, err);
                        response.status = 'error';
                        response.error = err;
                    } else {
                        machines = machines.filter(function (el) {
                            // Don't show SLB SSC machine unless in dev mode
                            var slbTagged = el.tags && (el.tags.lbaas && el.tags.lbaas === 'true' ||
                                el.tags.slb && (el.tags.slb === 'ssc' || el.tags.slb === 'stm'));
                            return el.state !== 'failed' && (config.showSLBObjects || !slbTagged);
                        });

                        machines.forEach(function (machine, i) {
                            machine.datacenter = datacenterName;
                            machine.metadata.credentials = handleCredentials(machine);
                            machines[i] = filterFields(machine);

                            if (info.instances && info.instances.data[machine.id]) {
                                machines[i] = utils.extend(machines[i], info.instances.data[machine.id]);
                            }
                            machine.state = cache.get(machine.id) || machine.state;
                            allMachines.push(machine);
                        });

                        response.status = 'complete';
                        response.machines = machines;

                        call.log.debug('List machines succeeded for data center %s', datacenterName);
                    }

                    if (progress) {
                        call.update(null, response);
                    }

                    if (--count === 0) {
                        callback(null, allMachines);
                    }
                });
            });
        });
    };

    var supportPackages = [];
    var DATACENTERS_WITHOUT_SUPPORT_PACKAGES = ['us-east-3b'];

    if (config.features.createdBySupportPackages === 'enabled') {
        for (var name in info.packages.data.all) {
            if (info.packages.data.all.hasOwnProperty(name) && info.packages.data.all[name].createdBySupport) {
                info.packages.data.all[name].name = info.packages.data.all[name].id = info.packages.data.all[name].id || name;
                supportPackages.push(info.packages.data.all[name]);
            }
        }
    }

    var tritonDataCenters = [];
    if (config.features.sdcDocker === 'enabled') {
        tritonDataCenters = [].concat(config.sdcDocker).map(function (sdcDocker) {
            return sdcDocker.datacenter;
        });
    }

    api.PackageList = function (call, options, callback) {
        call.log.info('Handling list packages event');

        call.cloud.separate(options.datacenter).listPackages(function (err, data) {
            if (err) {
                call.error(err);
                return;
            }
            if (config.features.privateSdc === 'disabled') {
                var datacenter = options.datacenter;
                if (!info.packages.data[datacenter]) {
                    datacenter = 'all';
                }
                if (options && options.datacenter && DATACENTERS_WITHOUT_SUPPORT_PACKAGES.indexOf(options.datacenter.toLowerCase()) === -1) {
                    data = data.concat(supportPackages);
                }

                var filteredPackagesMap = {};
                data.forEach(function (p) {
                    if (info.packages.data[datacenter][p.name]) {
                        filteredPackagesMap[p.name] = utils.extend(p, info.packages.data[datacenter][p.name]);
                    } else {
                        filteredPackagesMap[p.name] = p;
                    }
                });

                var filteredPackages = [];
                for (var packageName in filteredPackagesMap) {
                    if (filteredPackagesMap.hasOwnProperty(packageName)) {
                        filteredPackages.push(filteredPackagesMap[packageName]);
                    }
                }
            } else {
                filteredPackages = data.map(function (pkg) {
                    pkg['short_name'] = pkg['short_name'] || pkg.name;
                    return pkg;
                });
            }

            if (tritonDataCenters.indexOf(options.datacenter) !== -1) {
                filteredPackages = filteredPackages.map(function(pkg) {
                    pkg.type = pkg.type === 'other' ? 'smartos' : pkg.type;
                    return pkg;
                });
            }
            callback(null, filteredPackages);
        });
    };

    api.ImageUpdate = function (call, options, callback) {
        var cloud = call.cloud.separate(options.datacenter);
        cloud.updateImage(options.uuid, options, function (err) {
            if (!err) {
                // poll for image name change (rename)
                pollForObjectStateChange(cloud, call, 'name', options.name, (STATE_POLL_TIMEOUT), 'Image', options.uuid, callback);
            } else {
                call.done(err);
            }
        });
    };

    api.ImageDelete = function (call, options, callback) {
        call.log.info('Deleting image %s', options.imageId);

        var cloud = call.cloud.separate(options.datacenter);
        cloud.deleteImage(options.imageId, function (err) {
            if (!err) {
                var imageId = call.req.session.userId + '-' + options.imageId;
                if (creatingImagesCache[imageId]) {
                    delete creatingImagesCache[imageId];
                }
                pollForObjectStateChange(cloud, call, 'state', 'deleted', (STATE_POLL_TIMEOUT), 'Image', options.imageId, callback);
            } else {
                var result = false;
                if (err.restCode === 'NotAuthorized' && err.statusCode === 403 && cloud._subId) {
                    result = true;
                    call.log.info(err.message);
                }
                callback(err, result);
            }
        });
    };

    api.ImageCreate = function (call, options, callback) {
        if (call.getImmediate) {
            call.getImmediate();
        }
        call.log.info({options: options}, 'Creating image %s', options.name);

        var cloud = call.cloud.separate(options.datacenter);
        cloud.createImageFromMachine(options, function(err, image) {
            if (call.immediate) {
                call.immediate(err, {image: image});
            }
            var imageId = call.req.session.userId + '-' + image.id;
            if (!err) {
                var cachedImage = creatingImagesCache[imageId] = image;
                cachedImage.datacenter = options.datacenter;
                cachedImage['published_at'] = options['published_at'];
                cachedImage.public = false;
                cachedImage.actionInProgress = true;
                pollForObjectStateChange(cloud, call, 'state', 'active', (STATE_POLL_TIMEOUT), 'Image', image.id, function () {
                    delete creatingImagesCache[imageId];
                    callback.apply(this, arguments);
                });
                call.step = {
                    state: image.state
                };
                call.update(null);
            } else {
                delete creatingImagesCache[imageId];
                callback(err);
            }
        });
    };

    api.ImageList = function (call, callback) {
        var userIdPrefix = call.req.session.userId + '-';
        call.cloud.listDatacenters(function (err, datacenters) {
            var keys = Object.keys(datacenters || {});
            var count = keys.length;
            if (err) {
                call.error(err);
                return;
            }
            keys.forEach(function (datacenterName) {
                var cloud = call.cloud.separate(datacenterName);
                call.log.debug('List images for data center %s', datacenterName);

                cloud.listImages(function (err, images) {
                    var response = {
                        name: datacenterName,
                        status: 'pending',
                        images: []
                    };

                    if (err) {
                        var logLevel = err.restCode === 'NotAuthorized' && err.statusCode === 403 && cloud._subId ? 'info' : 'error';
                        call.log[logLevel]('List images failed for data center %s, url %s; err.message: %s', datacenterName, datacenters[datacenterName], err.message, err);
                        response.status = 'error';
                        response.error = err;
                    } else {

                        // Don't show SLB images unless in dev mode
                        if (!config.showSLBObjects) {
                            images = images.filter(function (el) {
                                var slbTagged = el.tags && el.tags.lbaas && el.tags.lbaas === 'true';
                                return !slbTagged;
                            });
                        }

                        var imageCreateConfig = config.images || {types: {}};

                        images.forEach(function (img) {
                            if (info.images.data[img.id]) {
                                img = utils.extend(img, info.images.data[img.id]);
                            }

                            var leastSupportedVersion = imageCreateConfig.types[img.name];
                            if (!img.public) {
                                img.imageCreateNotSupported = 'Instances from custom images are not supported yet by the image API.';
                            } else if (!leastSupportedVersion) {
                                img.imageCreateNotSupported = img.name + ' is not yet supported by the image API.';
                            } else if (utils.cmpVersion(img.version, leastSupportedVersion) < 0) {
                                img.imageCreateNotSupported = 'The ' + img.name + ' image needs to be at least image version ' +
                                    leastSupportedVersion + ' to create an image.';
                            } else if (img.os === 'other') {
                                img.imageCreateNotSupported = IMAGE_CREATE_NOT_SUPPORTED.replace('%s', img.name);
                            }

                            if (img.name) {
                                Object.keys(info.licenses.data['License Portfolio']).forEach(function (k) {
                                    var license = info.licenses.data['License Portfolio'][k];
                                    if (license['API Name'] === img.name) {
                                        img['license_price'] = license['Pan-Instance Price Uplift'];
                                    }
                                });
                            }

                            // add datacenter to every image
                            img.datacenter = datacenterName;

                            var imageId = userIdPrefix + img.id;
                            if (creatingImagesCache[imageId]) {
                                delete creatingImagesCache[imageId];
                            }
                        });

                        for (var imageId in creatingImagesCache) {
                            if (creatingImagesCache.hasOwnProperty(imageId) && imageId.indexOf(userIdPrefix) === 0) {
                                images.push(creatingImagesCache[imageId]);
                            }
                        }
                        response.status = 'complete';
                        response.images = images;

                        call.log.debug('List images succeeded for data center %s', datacenterName);
                    }
                    call.update(null, response);

                    if (--count === 0) {
                        callback();
                    }
                });
            });
        }, !!call.req.session.subId);
    };

    api.enableFirewall = function (call, callback) {
        call.log.info('Enabling firewall for machine %s', call.data.machineId);
        var cloud = call.cloud.separate(call.data.datacenter);
        cloud.enableFirewall(call.data.machineId, function (err) {
            if (!err) {
                pollForObjectStateChange(cloud, call, 'firewall_enabled', true, null, null, call.data.machineId, callback);
            } else {
                call.error(err);
            }
        });
    };

    api.disableFirewall = function (call, callback) {
        call.log.info('Disabling firewall for machine %s', call.data.machineId);
        var cloud = call.cloud.separate(call.data.datacenter);
        cloud.disableFirewall(call.data.machineId, function (err) {
            if (!err) {
                pollForObjectStateChange(cloud, call, 'firewall_enabled', false, null, null, call.data.machineId, callback);
            } else {
                call.error(err);
            }
        });
    };

    api.getImage = function (call, options, callback) {
        call.log.info('Retrieving image info for image %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.getImage(options.uuid, function (err, image) {
            if (!err) {
                if (image.os === 'other') {
                    image.imageCreateNotSupported = IMAGE_CREATE_NOT_SUPPORTED.replace('%s', image.name);
                }
                callback(null, image);
            } else {
                callback(err);
            }
        });
    };

    exports.Machine = api;
    done();
};
