'use strict';

var config = require('easy-config');
var vasync = require('vasync');

module.exports = function execute(log, config) {
    var server = require('../server').Server;
    var info = require('../cms').Info;
    var utils = require('../../../lib/utils');
    var machine = require('./').Machine;
    var metadata = require('../account').Metadata;

    var langs = {};
    var oldLangs = {};

    config.localization.locales.forEach(function (lng) {
        langs[lng] = {};
    });

    function mapImageInfo() {
        Object.keys(info.images.data).forEach(function (id) {
            if (!info.images.data[id].description) {
                return;
            }

            if (typeof info.images.data[id].description === 'string') {
                langs[config.localization.defaultLocale][id] = info.images.data[id].description;
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

    /* listNetworks */
    server.onCall('NetworksList', function(call) {
        call.log.info({'datacenter': call.data.datacenter}, 'Retrieving networks list');
        call.cloud.separate(call.data.datacenter).listNetworks(call.done.bind(call));
    });

    function sortDatacenters(datacenters) {
        var dcPrefixes = ['us-', 'eu-'];
        var sortedDatacenters = [];
        function customSort(arr) {
            arr.sort(function (a, b) {
                return a.name > b.name;
            });
        }

        if (datacenters.length >= 1) {
            dcPrefixes.forEach(function (dcPrefix) {
                var datacentersByPrefix = datacenters.filter(function (datacenter) {
                    return datacenter.name.indexOf(dcPrefix) > -1;
                });
                customSort(datacentersByPrefix);
                sortedDatacenters = sortedDatacenters.concat(datacentersByPrefix);
            });
            customSort(datacenters);
            datacenters.forEach(function (otherDatacenter) {
                if (sortedDatacenters.indexOf(otherDatacenter) === -1) {
                    sortedDatacenters.push(otherDatacenter);
                }
            });
        }

        return sortedDatacenters;
    }

    /* listDatasets */
    server.onCall('DatacenterList', function (call) {
        call.log.info('Handling list datacenters event');
        call.cloud.listDatacenters(function (err, datacenters) {
            if (err) {
                call.log.debug('Unable to list datacenters', err);
                call.done(err, true);
                return;
            }
            // Serialize datacenters
            var datacenterList = [];
            var keys = Object.keys(datacenters || {});
            keys.forEach(function (name) {
                var url = datacenters[name];
                var index = config.cloudapi.urls ?
                    config.cloudapi.urls.indexOf(url) : -1;

                datacenterList.push({
                    name: name,
                    url: url,
                    index: index
                });
            });

            // Sort by prefixes
            datacenterList = sortDatacenters(datacenterList);

            call.log.debug('Got datacenters list %j', datacenters);
            call.done(null, datacenterList);

        }, !!call.req.session.subId);
    });

    server.onCall('DatacenterPing', function (call) {
        var cloud = call.cloud.separate(call.data.datacenter);
        cloud._client.client.get('/--ping', function (error, req, res, result) {
            call.done(null, result && result.ping);
        });
    });

    function bindCollectionCRUD(collectionName, listMethod, createMethod, updateMethod, deleteMethod) {
        var upperCollectionName = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

        function verifier(collectionName, hasData) {
            return function (data) {
                var isValid = typeof (data.uuid) === 'string' && typeof (data.datacenter) === 'string';
                if (isValid && hasData) {
                    isValid = typeof (data[collectionName]) !== 'undefined';
                }
                return isValid;

            };
        }

        function collectionPoller(call, method, items, callback) {
            var overallTimeout = false;
            var overallTimer;
            var pollerTimeout = config.polling['machine' + upperCollectionName + 'Timeout'];
            if (pollerTimeout) {
                overallTimer = setTimeout(function () {
                    overallTimeout = true;
                }, pollerTimeout);
            }
            return function poller(error) {
                if (overallTimeout) {
                    return callback(new Error(collectionName + ' ' + method + ' timeout'));
                }
                if (error) {
                    return callback(error);
                }

                call.cloud.separate(call.data.datacenter)[listMethod](call.data.uuid, function (error, data) {
                    var key;
                    var dataEquals = true;
                    if (!error) {
                        if (typeof (items) === 'string') {
                            var tmpKey = items;
                            items = {};
                            items[tmpKey] = true;
                        }
                        for (key in items) {
                            switch (method) {
                                case 'save':
                                case 'create':
                                case 'update':
                                case 'add':
                                    dataEquals = data[key] === items[key];
                                    break;
                                case 'delete':
                                    dataEquals = !data.hasOwnProperty(key);
                                    break;
                            }
                        }
                        if (dataEquals) {
                            clearTimeout(overallTimer);
                            callback(null, data);
                            return;
                        }
                    }
                    setTimeout(poller, config.polling['machine' + upperCollectionName]);
                }, null, null, true);
            };
        }

        server.onCall('Machine' + upperCollectionName + 'List', {
            verify: verifier(collectionName, false),
            handler: function (call) {
                var machineId = call.data.uuid;
                var machineInfo = {'datacenter': call.data.datacenter};
                call.log.info(machineInfo, 'Handling machine ' + collectionName + ' list call, machine %s', machineId);
                call.cloud.separate(call.data.datacenter)[listMethod](call.data.uuid, call.done.bind(call));
            }
        });

        var methods = {
            create: createMethod,
            delete: deleteMethod
        };
        Object.keys(methods).forEach(function (method) {
            var upperCaseMethodName = method.charAt(0).toUpperCase() + method.slice(1);
            server.onCall('Machine' + upperCollectionName + upperCaseMethodName, {
                verify: verifier(collectionName, true),
                handler: function (call) {
                    var items = call.data[collectionName];
                    call.cloud.separate(call.data.datacenter)[methods[method]](call.data.uuid, items, collectionPoller(call, method, items, call.done.bind(call)));
                }
            });
        });

        server.onCall('Machine' + upperCollectionName + 'Update', {
            verify: function (data) {
                return verifier(collectionName, true)(data) && data.keyToUpdate;
            },
            handler: function (call) {
                var keyToUpdate = call.data.keyToUpdate;
                var item = call.data[collectionName];
                var cloud = call.cloud.separate(call.data.datacenter);
                var pool = [];
                if (!item.hasOwnProperty(keyToUpdate)) {
                    pool.push(function (input, callback) {
                        cloud[deleteMethod](call.data.uuid, keyToUpdate, collectionPoller(call, 'delete', keyToUpdate, function (error) {
                            if (error) {
                                callback(error);
                                return;
                            }
                            callback();
                        }));
                    });
                }
                pool.push(function (input, callback) {
                    cloud[createMethod](call.data.uuid, item, collectionPoller(call, 'create', item, function (error, data) {
                        callback(error, data);
                    }));
                });

                vasync.pipeline({funcs: pool}, function (error, result) {
                    call.done(error, result.successes.slice(-1));
                });
            }
        });
    }

    bindCollectionCRUD('tags', 'listMachineTags', 'addMachineTags', 'replaceMachineTags', 'deleteMachineTag');
    bindCollectionCRUD('metadata', 'getMachineMetadata', 'updateMachineMetadata', 'updateMachineMetadata', 'deleteMachineMetadata');

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
                data.hasOwnProperty('sdcpackageId') &&
                data.hasOwnProperty('sdcpackageName');
        },
        handler: function (call) {
            var options = {
                package: call.data.sdcpackageId,
                packageName: call.data.sdcpackageName,
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
        var accountId = req.session.parentAccountId || req.session.userId;
        metadata.get(accountId, metadata.FIRST_INSTANCE, function (err, instance) {
            if (instance) {
                call.done(null, instance);
                return;
            }
            metadata.set(accountId, metadata.FIRST_INSTANCE, uuid, function (setErr) {
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

    if (!config.features || config.features.imageCreate !== 'disabled') {

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

    /* UpdateImage */
    server.onCall('ImageUpdate', {
        verify: function (data) {
            return typeof data
                && data.uuid
                && data.datacenter
        },
        handler: function (call) {
            var options = call.data;
            machine.ImageUpdate(call, options, call.done.bind(call));
        }
    });

    /* GetImage */
    server.onCall('GetImage', {
        verify: function (data) {
            return data && typeof data.uuid === 'string' && typeof data.datacenter === 'string';
        },
        handler: function (call) {
            call.cloud.separate(call.data.datacenter).getImage(call.data.uuid, call.done.bind(call));
        }
    });

};
