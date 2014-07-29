'use strict';

var config = require('easy-config');

module.exports = function execute(scope) {
    var server = scope.api('Server');
    var info = scope.api('Info');
    var utils = scope.get('utils');
    var machine = scope.api('Machine');
    var metadata = scope.api('Metadata');

    var langs = {};
    var oldLangs = {};

    scope.config.localization.locales.forEach(function (lng) {
        langs[lng] = {};
    });

    function mapImageInfo() {
        Object.keys(info.images.data).forEach(function (id) {
            if (!info.images.data[id].description) {
                return;
            }

            if (typeof info.images.data[id].description === 'string') {
                langs[scope.config.localization.defaultLocale][id] = info.images.data[id].description;
            } else {
                Object.keys(info.images.data[id].description).forEach(function (lng) {
                    langs[lng][id] = info.images.data[id].description[lng];
                });
            }

            info.images.data[id].description = id;
        });

        Object.keys(langs).forEach(function (lng) {
            var m = require('./static/lang/' + lng + '.json');
            if (!oldLangs[lng]) {
                oldLangs[lng] = utils.clone(m);
            } else {
                Object.keys(m).forEach(function (k) {
                    delete m[k];
                });

                Object.keys(oldLangs[lng]).forEach(function (k) {
                    m[k] = utils.clone(oldLangs[lng][k]);
                });
            }

            utils.extend(m, langs[lng], true);
        });
    }

    mapImageInfo();
    info.images.pointer.__listen('change', mapImageInfo);
    info.images.pointer.__startWatch();

    server.onCall('MachineState', function (call) {
        machine.State(call, function () {
            call.done();
        });
    });

    server.onCall('MachineList', function (call) {
        machine.List(call, function () {
            call.done();
        });
    });

    /* listPackages */
    server.onCall('PackageList', function (call) {
        var options = {
            datacenter: call.data.datacenter
        };
        machine.PackageList(call, options, call.done);
    });

    /* listDatasets */
    server.onCall('DatasetList', function (call) {
        call.log.info('Handling list datasets event');

        call.cloud.separate(call.data.datacenter).listImages(function (err, data) {
            if (err) {
                call.error(err);
                return;
            }

            data = data.filter(function (el) {
                // Don't show SLB images unless in dev mode
                var slbTagged = el.tags && el.tags.lbaas && el.tags.lbaas === 'true';
                return config.showSLBObjects || !slbTagged;
            });

            var imageCreateConfig = config.images || {types: {}};

            data.forEach(function (img, i) {
                if (info.images.data[img.id]) {
                    data[i] = utils.extend(img, info.images.data[img.id]);
                }

                var leastSupportedVersion = imageCreateConfig.types[img.name];
                if (!img['public']) {
                    img.imageCreateNotSupported = 'Instances from custom images are not supported yet by the image API.';
                } else if (!leastSupportedVersion) {
                    img.imageCreateNotSupported = img.name + ' is not yet supported by the image API.';
                } else if (utils.cmpVersion(img.version, leastSupportedVersion) < 0) {
                    img.imageCreateNotSupported = 'The ' + img.name + ' image needs to be at least image version ' +
                        leastSupportedVersion + ' to create an image.';
                }

                if (data[i].name) {
                    Object.keys(info.licenses.data['License Portfolio']).forEach(function (k) {
                        var lic = info.licenses.data['License Portfolio'][k];
                        if (lic['API Name'] === data[i].name) {
                            data[i].license_price = lic['Pan-Instance Price Uplift'];
                        }
                    });
                }
            });

            call.done(null, data);
        });
    });

    /* listNetworks */
    server.onCall('NetworksList', function(call) {
        call.log.info({'datacenter': call.data.datacenter}, 'Retrieving networks list');
        call.cloud.separate(call.data.datacenter).listNetworks(call.done.bind(call));
    });

    /* listDatasets */
    server.onCall('DatacenterList', function (call) {
        call.log.info('Handling list datacenters event');
        call.cloud.listDatacenters(function (err, datacenters) {
            if (err) {
                call.log.debug('Unable to list datacenters');
                call.log.error(err);
                call.done(err);
                return;
            }
            // Serialize datacenters
            var datacenterList = [];
            var keys = Object.keys(datacenters || {});
            keys.forEach(function (name) {
                var url = datacenters[name];
                var index = scope.config.cloudapi.urls ?
                    scope.config.cloudapi.urls.indexOf(url) : -1;

                datacenterList.push({
                    name: name,
                    url: url,
                    index: index
                });
            });

            // Sort by index
            datacenterList.sort(function (dc1, dc2) {
                if (dc1.index > dc2.index) {
                    return 1;
                } else if (dc1.index === dc2.index) {
                    return 0;
                } else {
                    return -1;
                }
            });

            call.log.debug('Got datacenters list %j', datacenters);
            call.done(null, datacenterList);

        }, !!call.req.session.subId);
    });

    var bindCollectionList = function (collectionName, listMethod) {
        collectionName = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);
        server.onCall('Machine' + collectionName + 'List', {
            verify: function (data) {
                return data &&
                    typeof (data.uuid) === 'string' &&
                    typeof (data.datacenter) === 'string';
            },
            handler: function (call) {
                var machineId = call.data.uuid;
                var machineInfo = {'datacenter': call.data.datacenter};
                call.log.info(machineInfo, 'Handling machine ' + collectionName + ' list call, machine %s', machineId);
                call.cloud.separate(call.data.datacenter)[listMethod](call.data.uuid, call.done.bind(call));
            }
        });
    };

    bindCollectionList('tags', 'listMachineTags');

    bindCollectionList('metadata', 'getMachineMetadata');

    var bindCollectionSave = function (collectionName, listMethod, updateMethod, deleteMethod, deleteAllMethod) {
        var upperCollectionName = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);
        server.onCall('Machine' + upperCollectionName + 'Save', {
            verify: function (data) {
                return data &&
                    typeof (data.uuid) === 'string' &&
                    typeof (data[collectionName]) === 'object' &&
                    typeof (data.datacenter) === 'string';
            },
            handler: function (call) {
                call.log.info('Handling machine ' + collectionName + ' save call, machine %s', call.data.uuid);

                var newCollection = call.data[collectionName];
                var newCollectionStr = JSON.stringify(newCollection);
                var oldCollectionStr = null;
                var cloud = call.cloud.separate(call.data.datacenter);
                var machineInfo = {
                    datacenter: call.data.datacenter
                };

                var readCollection = function (callback) {
                    cloud[listMethod](call.data.uuid, function (collectionErr, collection) {
                        if (collection) {
                            delete collection.root_authorized_keys;
                        }
                        callback(collectionErr, collection);
                    }, null, true, true);
                };

                function updateState() {
                    var overallTimer;
                    var timer = setInterval(function () {
                        call.log.debug(machineInfo, 'Polling for machine %s ' + collectionName + ' to become %s', call.data.uuid, newCollectionStr);
                        readCollection(function (collectionErr, collection) {
                            if (!collectionErr) {
                                var readCollectionStr = JSON.stringify(collection);
                                if (readCollectionStr === newCollectionStr) {
                                    call.log.debug(machineInfo, 'Machine %s ' + collectionName + ' changed successfully', call.data.uuid);
                                    clearInterval(timer);
                                    clearTimeout(overallTimer);
                                    call.done(null, collection);
                                } else if (!oldCollectionStr) {
                                    oldCollectionStr = readCollectionStr;
                                } else if (readCollectionStr !== oldCollectionStr) {
                                    clearInterval(timer);
                                    clearTimeout(overallTimer);
                                    call.log.warn(machineInfo, 'Other call changed ' + collectionName + ', returning new ' + collectionName + ' %j', collection);
                                    call.done(null, collection);
                                }
                            } else {
                                call.log.error(machineInfo, 'Cloud polling failed for %s , %o', call.data.uuid, collectionErr);
                            }
                        });
                    }, config.polling['machine' + upperCollectionName]);

                    //TODO: Move overall timeout (1 minute for now) to config
                    overallTimer = setTimeout(function () {
                        var timeoutMessage = 'Polling for ' + collectionName + ' operation timed out';
                        call.log.error(machineInfo, timeoutMessage);
                        clearInterval(timer);
                        call.error(new Error(timeoutMessage));
                    }, config.polling['machine' + upperCollectionName + 'Timeout'] || 60 * 1000);
                }

                var updateCollection = function () {
                    if (Object.keys(newCollection).length === 0) {
                        updateState();
                        return;
                    }
                    cloud[updateMethod](call.data.uuid, newCollection, function (err) {
                        if (err) {
                            call.log.error(err);
                            call.error(err);
                            return;
                        }
                        updateState();
                    });
                };

                if (Object.keys(newCollection).length === 0 && deleteAllMethod) {
                    cloud[deleteAllMethod](call.data.uuid, function (err) {
                        if (err) {
                            call.log.error(err);
                            call.error(err);
                            return;
                        }

                        updateState();
                    });
                } else if (deleteMethod) {
                    readCollection(function (collErr, oldCollection) {
                        for (var key in oldCollection) {
                            if (!newCollection[key]) {
                                cloud[deleteMethod](call.data.uuid, key, function () {});
                            }
                        }
                        updateCollection();
                    });
                } else {
                    updateCollection();
                }
            }
        });
    };

    bindCollectionSave('tags', 'listMachineTags', 'replaceMachineTags', null, 'deleteMachineTags');

    bindCollectionSave('metadata', 'getMachineMetadata', 'updateMachineMetadata', 'deleteMachineMetadata', null);

    /* GetMachine */
    server.onCall('MachineDetails', {
        verify: function (data) {
            return data && typeof data.uuid === 'string';
        },
        handler: function (call) {
            var machineId = call.data.uuid;
            var machineInfo = {'datacenter': call.data.datacenter};
            call.log.info(machineInfo, 'Handling machine details call, machine %s', machineId);
            call.cloud.separate(call.data.datacenter).getMachine(machineId, call.done.bind(call));
        }
    });

    /* GetNetwork */
    server.onCall('getNetwork', {
        verify: function (data) {
            return data && typeof data.uuid === 'string';
        },
        handler: function (call) {
            var networkId = call.data.uuid;
            var machineInfo = {'datacenter': call.data.datacenter};
            call.log.info(machineInfo, 'Handling network call, network %s', networkId);
            call.cloud.separate(call.data.datacenter).getNetwork(networkId, call.done.bind(call));
        }
    });

    function machineAction(func) {
        var opts = {};

        opts.verify = function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('uuid') &&
                data.hasOwnProperty('datacenter');
        };

        opts.handler = function (call) {
            var options = {
                uuid: call.data.uuid,
                datacenter: call.data.datacenter
            };

            machine[func](call, options, call.done);
        };

        return opts;
    }

    server.onCall('MachineStart', machineAction('Start'));

    server.onCall('MachineStop', machineAction('Stop'));

    server.onCall('MachineDelete', machineAction('Delete'));

    server.onCall('MachineReboot', machineAction('Reboot'));

    /* ResizeMachine */
    server.onCall('MachineResize', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('uuid') &&
                data.hasOwnProperty('datacenter') &&
                data.hasOwnProperty('sdcpackage');
        },
        handler: function (call) {
            var options = {
                package: call.data.sdcpackage,
                datacenter: call.data.datacenter,
                uuid: call.data.uuid
            };
            machine.Resize(call, options, call.done);
        }
    });

    /* RenameMachine */
    server.onCall('MachineRename', {
        verify: function (data) {
            return true;
        },
        handler: function (call) {
            var options = {
                uuid: call.data.uuid,
                name: call.data.name,
                datacenter: call.data.datacenter
            };

            machine.Rename(call, options, call.done);
        }
    });

    /* CreateMachine */
    server.onCall('MachineCreate', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('name') &&
                data.hasOwnProperty('package') &&
                data.hasOwnProperty('dataset') &&
                data.hasOwnProperty('datacenter');
        },
        handler: function (call) {
            machine.Create(call, call.data, function (err, result) {
                return (call.immediate || call.done)(err, result);
            });
        }
    });

    server.onCall('ImagesSimpleList', function (call) {
        var images = config.ns.images;
        call.done(null, images);
    });

    /* FirstInstance */
    server.onCall('checkFirstInstanceCreated', function (call) {
        var uuid = call.data.uuid;
        var req = (call.done && call.req) || call;
        metadata.get(req.session.userId, metadata.FIRST_INSTANCE, function (err, instance) {
            if (instance) {
                call.done(null, instance);
                return;
            }
            metadata.set(req.session.userId, metadata.FIRST_INSTANCE, uuid, function (setErr) {
                if (setErr) {
                    call.log.error(setErr);
                } else {
                    call.log.info('Set first instance in metadata uuid: %s', uuid);
                }
            });
            call.done(null);
        });
    });


    /* Images */

    if(!config.features || config.features.imageCreate !== 'disabled') {

        /* CreateImage */
        server.onCall('ImageCreate', {
            verify: function(data) {
                return typeof data === 'object' &&
                    data.hasOwnProperty('machineId');
            },
            handler: function(call) {
                var options = {
                    machine: call.data.machineId,
                    name: (call.data.name || 'My Image'),
                    version: (call.data.version || '1.0.0'), // We default to version 1.0.0
                    description: (call.data.description || ''),
                    datacenter: call.data.datacenter
                };

                machine.ImageCreate(call, options, call.done);
            }
        });

        server.onCall('ImageCreateConfig', function (call) {
            call.done(null, config.images);
        });
    }

    /* DeleteImage */
    server.onCall('ImageDelete', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('imageId');
        },

        handler: function(call) {
            var options = {
                imageId: call.data.imageId,
                datacenter: call.data.datacenter
            };

            machine.ImageDelete(call, options, call.done);

        }
    });

    /* images list */
    server.onCall('ImagesList', function(call) {
        machine.ImageList(call, call.done);
    });

    /* RenameImage */
    server.onCall('ImageRename', {
        verify: function (data) {
            return typeof data
                && data.id
                && data.name
                && data.datacenter;
        },
        handler: function (call) {
            var options = {
                uuid: call.data.id,
                name: call.data.name,
                datacenter: call.data.datacenter
            };
            machine.ImageRename(call, options, call.done.bind(call));
        }
    });
};
