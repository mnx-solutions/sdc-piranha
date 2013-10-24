'use strict';

var vasync = require('vasync');
var config = require('easy-config');

module.exports = function execute(scope) {
    var server = scope.api('Server');
    var info = scope.api('Info');
    var utils = scope.get('utils');

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

    function filterFields(machine) {
        [ 'user-script', 'ufds_ldap_root_dn', 'ufds_ldap_root_pw' ].forEach(function (f) {
            if (machine.metadata[f]) {
                machine.metadata[f] = '__cleaned';
            }
        });

	    // Clean null networks
	    if(machine.networks) {
		    machine.networks = machine.networks.filter(function (network) {
			    return !!network;
		    });
	    }

        return machine;
    }

    server.onCall('MachineList', function (call) {
        call.log.info('Handling machine list event');

        var datacenters = call.cloud.listDatacenters();
        var keys = Object.keys(datacenters);
        var count = keys.length;

        keys.forEach(function (name) {
            var cloud = call.cloud.separate(name);
            call.log.debug('List machines for datacenter %s', name);

            cloud.listMachines({ credentials: true }, function (err, machines) {
                var response = {
                    name: name,
                    status: 'pending',
                    machines: []
                };

                if (err) {
                    call.log.error('List machines failed for datacenter %s, url %s; err.message: %s', name, datacenters[name], err.message, err);
                    response.status = 'error';
                    response.error = err;
                } else {
                    machines = machines.filter(function (el) {
                        return el.state !== 'failed';
                    });

                    machines.forEach(function (machine, i) {
                        machine.datacenter = name;
                        machine.metadata.credentials = handleCredentials(machine);
                        machines[i] = filterFields(machine);
                    });

                    response.status = 'complete';
                    response.machines = machines;

                    call.log.debug('List machines succeeded for datacenter %s', name);
                }

                call.update(null, response);

                if (--count === 0) {
                    call.done();
                }
            });
        });

    });

    /* listPackages */
    server.onCall('PackageList', function (call) {
        call.log.info('Handling list packages event');

        call.cloud.separate(call.data.datacenter).listPackages(function (err, data) {
            if (err) {
                call.error(err);
                return;
            }

            if (!info.packages.data[call.data.datacenter]) {
                call.data.datacenter = 'all';
            }

            var filteredPackages = [];
            data.forEach(function (p) {
                if(info.packages.data[call.data.datacenter][p.name]) {
                    filteredPackages.push(utils.extend(p, info.packages.data[call.data.datacenter][p.name]));
                } else {
                    filteredPackages.push(p);
                }
            });
            call.done(null, filteredPackages);
        });
    });

    /* listDatasets */
    server.onCall('DatasetList', function (call) {
        call.log.info('Handling list datasets event');

        call.cloud.separate(call.data.datacenter).listImages(function (err, data) {
            if (err) {
                call.error(err);
                return;
            }

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
        call.log.info('Retrieving networks list');
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
            call.log.info('Handling machine tags list call, machine %s', call.data.uuid);
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

            cloud.replaceMachineTags(call.data.uuid, call.data.tags, function (err) {
                if (err) {
                    call.log.error(err);
                    call.error(err);
                    return;
                }

                var timer = setInterval(function () {
                    call.log.debug('Polling for machine %s tags to become %s', call.data.uuid, newTags);
                    cloud.listMachineTags(call.data.uuid, function (tagsErr, tags) {
                        if (!tagsErr) {
                            var json = JSON.stringify(tags);
                            if (json === newTags) {
                                call.log.debug('Machine %s tags changed successfully', call.data.uuid);
                                clearInterval(timer);
                                clearTimeout(timer2);
                                call.done(null, tags);
                            } else if (!oldTags) {
                                oldTags = json;
                            } else if (json !== oldTags) {
                                clearInterval(timer);
                                clearTimeout(timer2);
	                              call.log.warn('Other call changed tags, returning new tags %j', tags);
                                call.done(null, tags);
                            }
                        } else {
                            call.log.error('Cloud polling failed for %s , %o', call.data.uuid, tagsErr);
                        }
                    }, undefined, true);
                }, config.polling.machineTags);

                var timer2 = setTimeout(function () {
                    call.log.error('Operation timed out');
                    clearInterval(timer);
                    call.error(new Error('Operation timed out'));
                }, 1 * 60 * 1000);
            });
        }
    });

    /* GetMachine */
    server.onCall('MachineDetails', {
        verify: function (data) {
            return data && typeof data.uuid === 'string';
        },
        handler: function (call) {
            var machineId = call.data.uuid;
            call.log.info('Handling machine details call, machine %s', machineId);
            call.cloud.separate(call.data.datacenter).getMachine(machineId, call.done.bind(call));
        }
    });

    /* GetNetwork */
    server.onCall('getNetwork', {
        verify: function(data) {
            return data && typeof data.uuid === 'string';
        },
        handler: function(call) {
            var networkId = call.data.uuid;
            call.log.info('Handling network call, network %s', networkId);
            call.cloud.separate(call.data.datacenter).getNetwork(networkId, call.done.bind(call));
        }
    });

    /**
     * Waits for machine state, package or name change
     * @param {Object} client
     * @param {Object} call - machine ID is taken from call.data.uuid or call.data if it's a string
     * @param {Number} [timeout=300000] - timeout in milliseconds, defaults to 5m
     * @param {String} [state=null]
     * @param {Object} [sdcpackage=null]
     * @param {String} [newName=null]
     */
    function pollForMachineStateChange(client, call, timeout, state, sdcpackage, newName) {
        var timer = setInterval(function () {
            var machineId = typeof call.data === 'object' ? call.data.uuid : call.data;

            // acknowledge what are we doing to logs
            if (state) {
                call.log.debug('Polling for machine %s to become %s', machineId, state);
            }

            if (sdcpackage) {
                call.log.debug('Polling for machine %s to resize to %s', machineId, sdcpackage);
            }

            if (newName) {
                call.log.debug('Polling for machine %s to rename to %s', machineId, newName);
            }

            client.getMachine(machineId, true, function (err, machine) {
                if (err) {
                    // in case we're waiting for deletion a http 410(Gone) is good enough
                    if (err.statusCode === 410 && state === 'deleted') {
                        call.log.debug('Machine %s is deleted, returning call', machineId);
                        call.done(null, machine);
                        clearTimeout(timerTimeout);
                        clearInterval(timer);
                        return;
                    }

                    call.log.error({error:err}, 'Cloud polling failed');
                    call.error(err);
                    clearTimeout(timerTimeout);
                    clearInterval(timer);
                } else if (machine.state === 'failed') {
                    call.log.error('Machine %s fell into failed state', machineId);
                    call.done(new Error('Machine fell into failed state'));
                    clearTimeout(timerTimeout);
                    clearInterval(timer);
                } else {
                    // machine state check
                    if (state && state === machine.state) {
                        call.log.debug('Machine %s state is %s as expected, returing call', machineId, state);
                        machine.metadata.credentials = handleCredentials(machine);
	                    machine = filterFields(machine);
                        call.done(null, machine);
                        clearTimeout(timerTimeout);
                        clearInterval(timer);
                    } else if(state && state !== machine.state) {
                        call.log.trace('Machine %s state is %s, waiting for %s', machineId, machine.state, state);
                        call.step = {state: machine.state};
                    }
                }

                if (!err) {
                    // resize check
                    if (sdcpackage && sdcpackage === machine.package) {
                        call.log.debug('Machine %s resized to %s as expected, returing call', machineId, sdcpackage);
                        call.done(null, machine);
                        clearTimeout(timerTimeout);
                        clearInterval(timer);
                    } else if(sdcpackage) {
                        call.log.debug('Machine %s package is %s, waiting for %s', machineId, machine.package, sdcpackage);
                        call.step = { state: 'resizing' };
                    }

                    // name change check
                    if (newName && newName === machine.name) {
                        // make sure machine package didn't go lost
                        if (machine.package === '') {
                            call.log.error('Machine %s package is empty after rename!', machineId);
                        }

                        call.log.debug('Machine %s renamed to %s as expected, returing call', machineId, newName);
                        clearTimeout(timerTimeout);
                        clearInterval(timer);
                        call.done(null, machine);

                    } else if(newName) {
                        call.log.debug('Machine %s name is %s, waiting for %s', machineId, machine.name, newName);
                        call.step = { state: 'renaming' };
                    }
                }

            }, null, true);
        }, config.polling.machineState);

        // timeout, so we wouldn't poll cloudapi forever
        var timerTimeout = setTimeout(function() {
            call.log.error('Operation timed out');
            clearInterval(timer);
            call.error(new Error('Operation timed out'));
        }, (timeout || 5 * 60 * 1000));
    }

    function changeState(func, logVerb, endstate, opts) {
        if (!opts) {
            opts = {};
        }

        if (!opts.verify) {
            opts.verify = function(data) {
                return typeof data === 'object' &&
                    data.hasOwnProperty('uuid') &&
                    data.hasOwnProperty('datacenter');
            };
        }

        if (!opts.handler) {
            opts.handler = function (call) {
                var machineId = call.data.uuid;
                call.log.debug(logVerb + ' machine %s', machineId);

                var cloud = call.cloud.separate(call.data.datacenter);
                cloud[func](machineId, function (err) {
                    if (!err) {
                        pollForMachineStateChange(cloud, call, null, endstate, null, null);
                    } else {
                        call.log.error(err);
                        call.error(err);
                    }
                });
            };
        }

        return opts;
    }

    /* GetMachine */
    server.onCall('MachineStart', changeState('startMachine','Starting', 'running'));

    /* GetMachine */
    server.onCall('MachineStop', changeState('stopMachine','Stopping', 'stopped'));

    /* GetMachine */
    server.onCall('MachineDelete', changeState('deleteMachine','Deleting', 'deleted'));

    server.onCall('MachineReboot', changeState('rebootMachine','Rebooting', 'running'));

    /* ResizeMachine */
    server.onCall('MachineResize', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('uuid') &&
                data.hasOwnProperty('datacenter') &&
                data.hasOwnProperty('sdcpackage');
        },
        handler: function (call) {
            var machineId = call.data.uuid;
            var options = {
                package: call.data.sdcpackage
            };

            call.log.info('Resizing machine %s', machineId);

            var cloud = call.cloud.separate(call.data.datacenter);
            cloud.resizeMachine(machineId, options, function (err) {
                if (!err) {
                    // poll for machine package change (resize)
                    pollForMachineStateChange(cloud, call, null, null, options.package, null);
                } else {
                    call.log.error(err);
                    call.error(err);
                }
            });
        }
    });

    /* RenameMachine */
    server.onCall('MachineRename', {
        verify: function(data) {
            return true;
        },
        handler: function(call) {
            var machineId = call.data.uuid;
            var options = {
                name: call.data.name
            };

            var cloud = call.cloud.separate(call.data.datacenter);
            cloud.renameMachine(machineId, options, function(err) {
                if(!err) {
                    // poll for machine name change (rename)
                    pollForMachineStateChange(cloud, call, (60 * 60 * 1000), null, null, options.name);
                } else {
                    call.log.error(err);
                    call.done(err);
                }

            });
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
            var options = {
                name: call.data.name,
                package: call.data.package,
                dataset: call.data.dataset, // !TODO: Replace this with image as dataset is deprecated in SDC 7.0
                networks: call.data.networks
            };

            call.log.info({options: options}, 'Creating machine %s', call.data.name);
            call.getImmediate(false);

            var cloud = call.cloud.separate(call.data.datacenter);
            cloud.createMachine(options, function (err, machine) {
                if (!err) {
                    call.immediate(null, {machine: machine});
                    call.data.uuid = machine.id;

                    // poll for machine status to get running (provisioning)
                    pollForMachineStateChange(cloud, call, (60 * 60 * 1000), 'running', null, null);
                } else {
                    call.log.error(err);
                    call.immediate(err);
                }
            });
        }
    });


    /* Images */

    /**
     * Waits for image state
     * @param {Object} client
     * @param {Object} call - image ID is taken from call.data.uuid or call.data if it's a string
     * @param {Number} [timeout=300000] - timeout in milliseconds, defaults to 5m
     * @param {String} [state=null]
     */
    function pollForImageStateChange(client, call, timeout, state) {
        var timer = setInterval(function () {
            var imageId = typeof call.data === 'object' ? call.data.uuid : call.data;

            if (state) {
                call.log.debug('Polling for image %s to become %s', imageId, state);
            }

            client.getImage(imageId, function (err, image) {
                if (err) {
                    // in case we're waiting for deletion a http 410(Gone) is good enough
                    if (err.statusCode === 404 && state === 'deleted') {
                        call.log.debug('Image %s is deleted, returning call', imageId);
                        call.done(null, image);
                        clearInterval(timer);
                        clearTimeout(timerTimeout);
                        return;
                    }

                    call.log.error({ error:err }, 'Cloud polling failed');
                    call.error(err);
                    clearInterval(timer);
                    clearTimeout(timerTimeout);
                } else if (image.state === 'failed') {
                    call.log.error('Image %s fell into failed state', imageId);
                    call.done(new Error('Image fell into failed state'));
                    clearInterval(timer);
                    clearTimeout(timerTimeout);
                } else {
                    // machine state check
                    if (state && state === image.state) {
                        call.log.debug('Image %s state is %s as expected, returing call', imageId, state);
                        call.done(null, image);
                        clearTimeout(timer);
                        clearInterval(timerTimeout);
                    } else if (state && state !== image.state) {
                        call.log.trace('Image %s state is %s, waiting for %s', imageId, image.state, state);
                        call.step = { state: image.state };
                    }
                }
            }, null, null, true);
        }, config.polling.machineState);

        // timeout, so we wouldn't poll cloudapi forever
        var timerTimeout = setTimeout(function() {
            call.log.error('Operation timed out');
            clearInterval(timer);
            call.error(new Error('Operation timed out'));
        }, (timeout || 5 * 60 * 1000));
    }

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
                    description: (call.data.description || 'Default image description')
                };

                call.log.info({ options: options }, 'Creating image %s', options.name);

                var cloud = call.cloud.separate(call.data.datacenter);
                call.cloud.createImageFromMachine(options, function(err, image) {
                    if (!err) {
                        call.data.uuid = image.id;
                        pollForImageStateChange(cloud, call, (60 * 60 * 1000), 'active', null, null);
                    } else {
                        call.log.error(err);
                        call.done(err);
                    }
                });

            }
        });
    }

    if(!config.features || config.features.imageUse !== 'disabled') {

        /* DeleteImage */
        server.onCall('ImageDelete', {
            verify: function(data) {
                return typeof data === 'object' &&
                    data.hasOwnProperty('imageId');
            },

            handler: function(call) {
                call.log.info('Deleting image %s', call.data.imageId);

                var cloud = call.cloud.separate(call.data.datacenter);
                call.cloud.deleteImage(call.data.imageId, function(err) {
                    if (!err) {
                        call.data.uuid = call.data.imageId;
                        pollForImageStateChange(cloud, call, (60 * 60 * 1000), 'deleted', null, null);
                    } else {
                        call.log.error(err);
                        call.done(err);
                    }
                });

            }
        });

        /* images list */
        server.onCall('ImagesList', function(call) {

            var datacenters = call.cloud.listDatacenters();
            var keys = Object.keys(datacenters);
            var count = keys.length;

            keys.forEach(function (name) {
                var cloud = call.cloud.separate(name);
                call.log.debug('List images for datacenter %s', name);

                cloud.listImages(function (err, images) {
                    var response = {
                        name: name,
                        status: 'pending',
                        images: []
                    };

                    if (err) {
                        call.log.error('List images failed for datacenter %s, url %s; err.message: %s', name, datacenters[name], err.message, err);
                        response.status = 'error';
                        response.error = err;
                    } else {
                        /* add datacenter to every image */
                        images.forEach(function (image) {
                            image.datacenter = name;
                        });

                        response.status = 'complete';
                        response.images = images;

                        call.log.debug('List images succeeded for datacenter %s', name);
                    }
                    call.update(null, response);

                    if (--count === 0) {
                        call.done();
                    }
                });
            });


        });
    }
};
