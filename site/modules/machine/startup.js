'use strict';

var vasync = require('vasync');
var config = require('easy-config');

module.exports = function (scope, callback) {
    var server = scope.api('Server');

    var info = scope.api('Info');

    var utils = scope.get('utils');

    var langs = {};
    var oldLangs = {};
    scope.config.localization.locales.forEach(function (lng) {
        langs[lng] = {};
    });


    function mapImageInfo() {
        Object.keys(info.images.data).forEach(function(id) {
            if(!info.images.data[id].description) {
                return;
            }
            if(typeof info.images.data[id].description === 'string') {
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
            if(!oldLangs[lng]) {
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
            "mysql" : ["MySQL", "root"],
            "pgsql" : ["PostgreSQL", "postgres"],
            "virtualmin" : ["Virtualmin", "admin"]
        };
        var credentials = [];
        if (machine.metadata && machine.metadata.credentials) {
            Object.keys(machine.metadata.credentials).forEach(function (username) {
                var system = systemsToLogins[username] ? systemsToLogins[username][0] : "Operating System";
                var login = systemsToLogins[username] ? systemsToLogins[username][1] : username;

                credentials.push(
                    {
                        "system" : system,
                        "username" : login.split('_')[0],
                        "password" : machine.metadata.credentials[username]
                    }
                );
            });
        }
        return credentials;
    }

    function filterFields(machine) {
        ['user-script', 'ufds_ldap_root_dn', 'ufds_ldap_root_pw'].forEach(function (f) {
            if(machine.metadata[f]) {
                machine.metadata[f] = '__cleaned';
            }
        });
        return machine;
    }

    server.onCall('MachineList', function (call) {
        call.log.info('Handling machine list event');

        var cloud = call.cloud;
        var datacenters = cloud.listDatacenters();
        var keys = Object.keys(datacenters);
        var count = keys.length;

        keys.forEach(function (name) {
            cloud.setDatacenter(name);

            call.log.debug('List machines for datacenter %s', name);

            cloud.listMachines({ 'credentials': true }, function (err, machines) {
                var response = {
                    name: name,
                    status: 'pending',
                    machines: []
                };

                if (err) {
                    call.log.error('List machines failed for datacenter %s; err: %s', name, err.message);
                    call.update(err, response, true);
                    return;
                }

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

        call.cloud.setDatacenter(call.data.datacenter);
        call.cloud.listPackages(function (err, data) {
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

        call.cloud.setDatacenter(call.data.datacenter);
        call.cloud.listDatasets(function (err, data) {
            if(err) {
                call.error(err);
                return;
            }
            data.forEach(function (img, i) {
                if(info.images.data[img.id]) {
                    data[i] = utils.extend(img, info.images.data[img.id]);
                }

                if(data[i].name) {
                    for(var k in info.licenses.data["License Portfolio"]) {
                        var lic = info.licenses.data["License Portfolio"][k];
                        if(lic["API Name"] == data[i].name) {
                            data[i].license_price = lic["Pan-Instance Price Uplift"];
                        }
                    }
                }
            });

            call.done(null, data);
        });
    });

    /* listDatasets */
    server.onCall('DatacenterList', function (call) {
        call.log.info('Handling list datasets event');
        call.cloud.listDatacenters(call.done.bind(call));
    });


    /* listMachineTags */
    server.onCall('MachineTagsList', {
        verify: function (data) {
            return data && "string" === typeof data.uuid;
        },
        handler: function (call) {
            call.log.info('Handling machine tags list call, machine %s', call.data.uuid);
            call.cloud.listMachineTags(call.data.uuid, call.done.bind(call));
        }
    });

    /* listMachineTags */
    server.onCall('MachineTagsSave', {
        verify: function (data) {
            return data &&
                typeof data.uuid === 'string' &&
                typeof data.tags === 'object';
        },
        handler: function (call) {
            call.log.info('Handling machine tags save call, machine %s', call.data.uuid);

            var newTags = JSON.stringify(call.data.tags);
            var oldTags = null;

            call.cloud.replaceMachineTags(call.data.uuid, call.data.tags, function (err) {
                if(err) {
                    call.log.error(err);
                    call.error(err);
                    return;
                }

                var timer = setInterval(function () {
                    call.log.debug('Polling for machine %s tags to become %s', call.data.uuid, newTags);
                    call.cloud.listMachineTags(call.data.uuid, function (tagsErr, tags) {
                        if (!tagsErr) {
                            var json = JSON.stringify(tags);
                            if(json === newTags) {
                                call.log.debug('Machine %s tags changed successfully', call.data.uuid);
                                clearInterval(timer);
                                clearTimeout(timer2);
                                call.done(null, tags);
                            } else if(!oldTags) {
                                oldTags = json;
                            } else if(json !== oldTags) {
                                clearInterval(timer);
                                clearTimeout(timer2);
                                call.done(new Error('Other call changed tags'));
                            }
                        } else {
                            call.log.error('Cloud polling failed %o', tagsErr);
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

            call.cloud.setDatacenter(call.data.datacenter);
            call.cloud.getMachine(machineId, call.done.bind(call));
        }
    });

    function pollForMachineState(client, call, machineId, state) {
        var timer = setInterval(function () {
            call.log.debug('Polling for machine %s to become %s', machineId, state);
            client.getMachine(machineId, function (err, machine) {
                if (err) {
                    // in case we're waiting for deletion a http 410(Gone) is good enough
                    if ( err.statusCode === 410 && state === 'deleted')
                    {
                        call.log.debug('Machine %s is deleted, returning call', machineId);
                        call.done(null, machine);
                        clearInterval(timer);
                        clearTimeout(timer2);
                        return;
                    }

                    call.log.error({error:err}, 'Cloud polling failed');
                    call.error(err);
                    clearInterval(timer);
                    clearTimeout(timer2);
                } else if (machine.state === 'failed') {
                    call.done(new Error('Machine fell into failed state'));
                    clearInterval(timer);
                    clearTimeout(timer2);
                } else {
                    if (state === machine.state) {
                        call.log.debug('Machine %s state is %s as expected, returing call', machineId, state);
                        call.done(null, machine);
                        clearInterval(timer);
                        clearTimeout(timer2);
                    } else {
                        call.log.trace('Machine %s state is %s, waiting for %s', machineId, machine.state, state);
                        call.step = {state: machine.state};
                    }
                }
            }, null, null, true);
        }, config.polling.machineState);

        var timer2 = setTimeout(function () {
            call.log.error('Operation timed out');
            clearInterval(timer);
            call.error(new Error('Operation timed out'));
        }, 5 * 60 * 1000);
    }

    function pollForMachinePackageChange(client, call, sdcpackage) {
        var timer = setInterval(function () {
            var machineId = typeof call.data === 'object' ? call.data.uuid : call.data;

            call.log.debug('Polling for machine %s to resize to %s', machineId, sdcpackage);
            client.getMachine(machineId, function (err, machine) {
                if (!err) {
                    if (sdcpackage === machine.package) {
                        call.log.debug('Machine %s resized to %s as expected, returing call', machineId, sdcpackage);
                        call.done(null, machine);
                        clearTimeout(timer2);
                        clearInterval(timer);
                    } else {
                        call.log.debug('Machine %s package is %s, waiting for %s', machineId, machine.package, sdcpackage);
                        call.step = { state: 'resizing' };
                    }
                } else {
                    call.log.error(err);
                    call.error(err);
                }
            }, null, null, true);
        }, config.polling.packageChange);

        var timer2 = setTimeout(function () {
            call.log.error('Operation timed out');
            clearInterval(timer);
            call.error(new Error('Operation timed out'));
        }, 5 * 60 * 1000);
    }

    function changeState(func, logVerb, endstate, opts) {
        if(!opts) {
            opts = {};
        }
        if(!opts.verify) {
            opts.verify = function(data) {
                return typeof data === 'object' &&
                    data.hasOwnProperty('uuid') &&
                    data.hasOwnProperty('datacenter');
            };
        }
        if(!opts.handler) {
            opts.handler = function (call) {

                var machineId = call.data.uuid;
                call.log.debug(logVerb + ' machine %s', machineId);

                call.cloud.setDatacenter(call.data.datacenter);
                call.cloud[func](machineId, function (err) {
                    if (!err) {
                        pollForMachineState(call.cloud, call, machineId, endstate);
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

            call.cloud.setDatacenter(call.data.datacenter);

            call.cloud.resizeMachine(machineId, options, function (err) {
                if (!err) {
                    pollForMachinePackageChange(call.cloud, call, options.package);
                } else {
                    call.log.error(err);
                    call.error(err);
                }
            });
        }
    });

    /* ResizeMachine */
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
                dataset: call.data.dataset
            };

            call.log.info({options: options}, 'Creating machine %s', call.data.name);
            call.getImmediate(false);

            call.cloud.setDatacenter(call.data.datacenter);
            call.cloud.createMachine(options, function (err, machine) {
                if (!err) {
                    call.immediate(null, {machine: machine});
                    pollForMachineState(call.cloud, call, machine.id, 'running');
                } else {
                    call.log.error(err);
                    call.immediate(err);
                }
            });
        }
    });

    setImmediate(callback);
};
