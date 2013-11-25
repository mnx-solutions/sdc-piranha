'use strict';

var config = require('easy-config');

module.exports = function execute(scope) {
    var server = scope.api('Server');
    var info = scope.api('Info');
    var utils = scope.get('utils');
    var machine = scope.api('Machine');

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
                // Don't show ELB images unless in dev mode
                var lbaasTagged = el.tags && el.tags.lbaas && (el.tags.lbaas === 'ssc' || el.tags.lbaas === 'stm');
                return config.showLBaaSObjects || !lbaasTagged;
            });

            data.forEach(function (img, i) {
                if (info.images.data[img.id]) {
                    data[i] = utils.extend(img, info.images.data[img.id]);
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
            } else {
                // Serialize datacenters
                var datacenterList = [];

                Object.keys(datacenters).forEach(function (name) {
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
            }
        });
    });

    /* listMachineTags */
    server.onCall('MachineTagsList', {
        verify: function (data) {
            return data &&
                typeof data.uuid === 'string' &&
                typeof data.datacenter === 'string';
        },
        handler: function (call) {
            var machineId = call.data.uuid;
            var machineInfo = {'datacenter': call.data.datacenter};
            call.log.info(machineInfo, 'Handling machine tags list call, machine %s', machineId);
            call.cloud.separate(call.data.datacenter).listMachineTags(call.data.uuid, call.done.bind(call));
        }
    });

    /* listMachineTags */
    server.onCall('MachineTagsSave', {
        verify: function (data) {
            return data &&
                typeof data.uuid === 'string' &&
                typeof data.tags === 'object' &&
                typeof data.datacenter === 'string';
        },
        handler: function (call) {
            call.log.info('Handling machine tags save call, machine %s', call.data.uuid);

            var newTags = JSON.stringify(call.data.tags);
            var oldTags = null;
            var cloud = call.cloud.separate(call.data.datacenter);
            var machineInfo = {
                'datacenter': call.data.datacenter
            };

            function updateState () {
                var timer = setInterval(function () {
                    call.log.debug(machineInfo, 'Polling for machine %s tags to become %s', call.data.uuid, newTags);
                    cloud.listMachineTags(call.data.uuid, function (tagsErr, tags) {
                        if (!tagsErr) {
                            var json = JSON.stringify(tags);
                            if (json === newTags) {
                                call.log.debug(machineInfo, 'Machine %s tags changed successfully', call.data.uuid);
                                clearInterval(timer);
                                clearTimeout(timer2);
                                call.done(null, tags);
                            } else if (!oldTags) {
                                oldTags = json;
                            } else if (json !== oldTags) {
                                clearInterval(timer);
                                clearTimeout(timer2);
                                call.log.warn(machineInfo, 'Other call changed tags, returning new tags %j', tags);
                                call.done(null, tags);
                            }
                        } else {
                            call.log.error(machineInfo, 'Cloud polling failed for %s , %o', call.data.uuid, tagsErr);
                        }
                    }, undefined, true);
                }, config.polling.machineTags);

                var timer2 = setTimeout(function () {
                    call.log.error(machineInfo, 'Operation timed out');
                    clearInterval(timer);
                    call.error(new Error('Operation timed out'));
                }, 1 * 60 * 1000);
            }

            if (Object.keys(call.data.tags).length > 0) {
                cloud.replaceMachineTags(call.data.uuid, call.data.tags, function (err) {
                    if (err) {
                        call.log.error(err);
                        call.error(err);
                        return;
                    }

                    updateState();
                });
            } else {
                cloud.deleteMachineTags(call.data.uuid, function (err) {
                    if (err) {
                        call.log.error(err);
                        call.error(err);
                        return;
                    }

                    updateState();
                });
            }
        }
    });

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
            machine.Create(call, call.data, call.done);
        }
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
                    version: '1.0.0', // We default to version 1.0.0
                    description: (call.data.description || 'Default image description'),
                    datacenter: call.data.datacenter
                };

                machine.ImageCreate(call, options, call.done);
            }
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
};