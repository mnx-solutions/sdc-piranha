'use strict';

var ursa = require('ursa');
var config = require('easy-config');

module.exports = function execute(scope, register) {
    var api = {};

    var Metadata = scope.api('Metadata');

    function createKeyPairs() {
        var kp = ursa.generatePrivateKey();
        return {
            privateKey: kp.toPrivatePem('utf8'),
            publicKey: kp.toPublicPem('utf8'),
            publicSsh: 'ssh-rsa ' + kp.toPublicSsh('base64') + ' piranha@portal',
            fingerprint: kp.toPublicSshFingerprint('hex').replace(/(.{2})/g, '$1:').slice(0,-1)
        };
    }

    function filterFields(machine) {
        [ 'user-script', 'ufds_ldap_root_dn', 'ufds_ldap_root_pw' ].forEach(function (f) {
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

    /**
     * Waits for machine state, package or name change
     * @param {Object} client
     * @param {Object} call - machine ID is taken from call.data.uuid or call.data if it's a string
     * @param {Number} [timeout=300000] - timeout in milliseconds, defaults to 5m
     * @param {String} [state=null]
     * @param {Object} [sdcpackage=null]
     * @param {String} [newName=null]
     */
    function pollForMachineStateChange(client, call, machineId, timeout, state, sdcpackage, newName, callback) {
        var timer = setInterval(function () {
            machineId = machineId ? machineId : (typeof call.data === 'object' ? call.data.uuid : call.data);

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
                        callback(null, machine);
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
                    callback(new Error('Machine fell into failed state'));
                    clearTimeout(timerTimeout);
                    clearInterval(timer);
                } else {
                    // machine state check
                    if (state && state === machine.state) {
                        call.log.debug('Machine %s state is %s as expected, returing call', machineId, state);
                        machine.metadata.credentials = handleCredentials(machine);
                        machine = filterFields(machine);
                        callback(null, machine);
                        clearTimeout(timerTimeout);
                        clearInterval(timer);
                    } else if (state && state !== machine.state) {
                        call.log.trace('Machine %s state is %s, waiting for %s', machineId, machine.state, state);
                        call.step = {state: machine.state};
                    }
                }

                if (!err) {
                    // resize check
                    if (sdcpackage && sdcpackage === machine.package) {
                        call.log.debug('Machine %s resized to %s as expected, returing call', machineId, sdcpackage);
                        callback(null, machine);
                        clearTimeout(timerTimeout);
                        clearInterval(timer);
                    } else if (sdcpackage) {
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
                        callback(null, machine);

                    } else if (newName) {
                        call.log.debug('Machine %s name is %s, waiting for %s', machineId, machine.name, newName);
                        call.step = { state: 'renaming' };
                    }
                }

            }, null, null, true);
        }, config.polling.machineState);

        // timeout, so we wouldn't poll cloudapi forever
        var timerTimeout = setTimeout(function () {
            call.log.error('Operation timed out');
            clearInterval(timer);
            call.error(new Error('Operation timed out'));
        }, (timeout || 5 * 60 * 1000));
    }

    function updateUserMetadata(call, metadata) {
        Metadata.set(call.req.session.userId, 'portal_private_key', metadata.portal_private_key);
        Metadata.set(call.req.session.userId, 'portal_fingerprint', metadata.portal_fingerprint);

        call.cloud.createKey({name: 'ssc_public_key', key: metadata.ssc_public_key}, function (err, resp) {
            call.log.warn(err);
        });
    }

    api.Create = function (call, options, callback) {
        if (options.elbController) {
            var sscKeyPair = createKeyPairs();
            var portalKeyPair = createKeyPairs();
            var metadata = {
                ssc_private_key: sscKeyPair.privateKey,
                ssc_public_key: sscKeyPair.publicSsh,
                portal_public_key: (new Buffer(portalKeyPair.publicSsh).toString('base64')),
                account_name: (config.elb && config.elb.account) || call.req.session.userName,
                datacenter_name: call.data.datacenter,
                elb_code_url: (config.elb && config.elb.elb_code_url) || "https://us-east.manta.joyent.com/dbqp/public/elbapi-1.tgz",
                sdc_url: (config.elb && config.elb.sdc_url) || "https://us-west-1.api.joyentcloud.com"
            };

            if (config.elb.ssc_private_key) {
                metadata.ssc_private_key = config.elb.ssc_private_key;
                metadata.ssc_public_key = config.elb.ssc_public_key;
            }

            if (!metadata.datacenter_name) {
                metadata.datacenter_name = 'us-west-x';
            }

            for (var key in metadata) {
                if (metadata.hasOwnProperty(key)) {
                    options['metadata.' + key] = metadata[key];
                }
            }
        }

        call.log.info({options: options}, 'Creating machine %s', options.name);
        call.getImmediate(false);

        var cloud = call.cloud.separate(options.datacenter);
        cloud.createMachine(options, function (err, machine) {
            if (!err) {
                call.immediate(null, {machine: machine});

                // poll for machine status to get running (provisioning)
                pollForMachineStateChange(cloud, call, machine.id, (60 * 60 * 1000), 'running', null, null, callback);
                if (options.elbController) {
                    metadata.portal_private_key = portalKeyPair.privateKey;
                    metadata.portal_fingerprint = '/' + call.req.session.userName + '/keys/' + portalKeyPair.fingerprint;
                    updateUserMetadata(call, metadata);
                }
            } else {
                call.log.error(err);
                call.immediate(err);
            }
        });
    };

    api.Rename = function (call, options, callback) {
        var cloud = call.cloud.separate(options.datacenter);
        cloud.renameMachine(options.uuid, options, function(err) {
            if(!err) {
                // poll for machine name change (rename)
                pollForMachineStateChange(cloud, call, options.uuid, (60 * 60 * 1000), null, null, options.name, callback);
            } else {
                call.log.error(err);
                call.done(err);
            }
        });
    };

    api.Resize = function (call, options, callback) {
        call.log.info('Resizing machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.resizeMachine(options.uuid, options, function (err) {
            if (!err) {
                // poll for machine package change (resize)
                pollForMachineStateChange(cloud, call, options.uuid, null, null, options.package, null, callback);
            } else {
                call.log.error(err);
                call.error(err);
            }
        });
    };

    api.Start = function (call, options, callback) {
        call.log.debug('Starting machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.startMachine(options.uuid, function (err) {
            if (!err) {
                pollForMachineStateChange(cloud, call, options.uuid, null, 'running', null, null, callback);
            } else {
                call.log.error(err);
                call.error(err);
            }
        });
    };

    api.Stop = function (call, options, callback) {
        call.log.debug('Stopping machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.stopMachine(options.uuid, function (err) {
            if (!err) {
                pollForMachineStateChange(cloud, call, options.uuid, null, 'stopped', null, null, callback);
            } else {
                call.log.error(err);
                call.error(err);
            }
        });
    };

    api.Delete = function (call, options, callback) {
        call.log.debug('Deleting machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.deleteMachine(options.uuid, function (err) {
            if (!err) {
                pollForMachineStateChange(cloud, call, options.uuid, null, 'deleted', null, null, callback);
            } else {
                call.log.error(err);
                call.error(err);
            }
        });
    };

    api.Reboot = function (call, options, callback) {
        call.log.debug('Rebooting machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.rebootMachine(options.uuid, function (err) {
            if (!err) {
                pollForMachineStateChange(cloud, call, options.uuid, null, 'running', null, null, callback);
            } else {
                call.log.error(err);
                call.error(err);
            }
        });
    };

    api.List = function (call, callback) {
        call.log.info('Handling machine list event');

        var datacenters = call.cloud.listDatacenters();
        var keys = Object.keys(datacenters);
        var count = keys.length;

        keys.forEach(function (name) {
            var cloud = call.cloud.separate(name);
            call.log.debug('List machines for datacenter %s', name);

            var allMachines = [];

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

                        if (info.instances && info.instances.data[machine.id]) {
                            machines[i] = utils.extend(machines[i], info.instances.data[machine.id]);
                        }

                        allMachines.push(machine);
                    });

                    response.status = 'complete';
                    response.machines = machines;

                    call.log.debug('List machines succeeded for datacenter %s', name);
                }

                call.update(null, response);

                if (--count === 0) {
                    call.done(null, allMachines);
                }
            });
        });
    };

    register('Machine', api);
};
