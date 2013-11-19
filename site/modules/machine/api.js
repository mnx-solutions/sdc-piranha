'use strict';

var ursa = require('ursa');
var config = require('easy-config');

module.exports = function execute(scope, register) {
    var info = scope.api('Info');
    var utils = scope.get('utils');

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
     * @param {Object} client
     * @param {Object} call - machine ID is taken from call.data.uuid or call.data if it's a string
     * @param {String} prop - what to poll
     * @param {String} expect - what to expect
     * @param {Number} [timeout=300000] - timeout in milliseconds, defaults to 5m
     * @param {String} [type=Machine] - type we are polling, defaults to machine
     * @param {Function} callback
     */
    function pollForObjectStateChange(client, call, prop, expect, timeout, type, callback) {
        var objectId = typeof call.data === 'object' ? call.data.uuid : call.data;

        timeout = timeout || 5 * 60 * 1000;
        type = type || 'Machine';

        var processNames = {
            name: 'renaming',
            package: 'resizing'
        };

        call.log = call.log.child({datacenter: client._currentDC});

        var clearPoller = createPoller(call, timeout, callback, function () {

            // acknowledge what are we doing to logs
            call.log.debug('Polling for %s %s %s to become %s', type.toLowerCase(), objectId, prop, expect);

            client['get' + type](objectId, true, function (err, object) {
                if (err) {
                    // in case we're waiting for deletion a http 410(Gone) or 404 is good enough
                    if ((err.statusCode === 410 || err.statusCode === 404) && prop === 'state' && expect === 'deleted') {
                        call.log.debug('%s %s is deleted, returning call', type, objectId);
                        clearPoller(null, object);
                        return;
                    }

                    call.log.error({error:err}, 'Cloud polling failed');
                    clearPoller(err, true);
                    return;
                }
                if (object.state === 'failed') {
                    call.log.error('%s %s fell into failed state', type, objectId);
                    clearPoller(new Error('Machine fell into failed state'));
                    return;
                }
                if (object[prop] === expect) {

                    if (type === 'Machine' && object.package === '') {
                        call.log.error('Machine %s package is empty after %s!', objectId, (processNames[prop] || prop));
                    }

                    call.log.debug('%s %s %s is %s as expected, returing call', type, objectId, prop, expect);
                    if (type === 'Machine') {
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

            }, null, true);
        });
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
                call.data.uuid = machine.id;

                // poll for machine status to get running (provisioning)
                pollForObjectStateChange(cloud, call, 'state', 'running', (60 * 60 * 1000), null, callback);
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
                pollForObjectStateChange(cloud, call, 'name', options.name, (60 * 60 * 1000), null, callback);
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
                pollForObjectStateChange(cloud, call, 'package', options.package, null, null, callback);
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
                pollForObjectStateChange(cloud, call, 'state', 'running', null, null, callback);
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
                pollForObjectStateChange(cloud, call, 'state', 'stopped', null, null, callback);
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
                pollForObjectStateChange(cloud, call, 'state', 'deleted', null, null, callback);
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
                pollForObjectStateChange(cloud, call, 'state', 'running', null, null, callback);
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
                    callback(null, allMachines);
                }
            });
        });
    };

    api.ImageDelete = function (call, options, callback) {
        call.log.info('Deleting image %s', options.imageId);

        var cloud = call.cloud.separate(options.datacenter);
        call.cloud.deleteImage(options.imageId, function (err) {
            if (!err) {
                call.data.uuid = options.imageId;
                // TODO: enable poller back

                pollForObjectStateChange(cloud, call, 'state', 'deleted', (60 * 60 * 1000), 'Image', callback);
            } else {
                call.log.error(err);
                callback(err);
            }
        });
    };

    api.ImageCreate = function (call, options, callback) {

        call.log.info({ options: options }, 'Creating image %s', options.name);

        var cloud = call.cloud.separate(options.datacenter);
        call.cloud.createImageFromMachine(options, function(err, image) {
            if (!err) {
                call.data.uuid = image.id;
                // TODO: enable poller back
                pollForObjectStateChange(cloud, call, 'state', 'active', (60 * 60 * 1000), 'Image', callback);
            } else {
                call.log.error(err);
                callback(err);
            }
        });
    };

    api.ImageList = function (call, callback) {
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
                    callback();
                }
            });
        });
    };

    register('Machine', api);
};
