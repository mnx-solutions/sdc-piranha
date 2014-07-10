'use strict';

var assert = require('assert');
var config = require('easy-config');
var ursa = require('ursa');
var manta = require('manta');
var vasync = require('vasync');

//Logging is done by serverTab itself, no need for additional info/error logging in each request
var slb = function execute(scope) {
    var server = scope.api('Server');
    var machine = scope.api('Machine');
    var Metadata = scope.api('Metadata');
    var ssc = scope.api('SLB');

    var getSscMachine = ssc.getSscMachine;
    var getSscClient = ssc.getSscClient;

    var hardControllerName = 'slb-ssc';

    ssc.init(Metadata);

    server.onCall('LoadBalancersList', function (call) {
        getSscClient(call, function (err, client) {
            if (err) {
                call.done(err, true);
                return;
            }
            client.get('/loadbalancers', function getLoadBalancers(err, creq, cres, obj) {
                if (err) {
                    call.done(err);
                    return;
                }
                call.done(null, obj);
            });
        });
    });

    server.onCall('LoadBalancerLoad', function (call) {
        getSscClient(call, function (err, client) {
            if (err) {
                call.done(err);
                return;
            }
            //Get empty load balancer template is it's new load balancer
            if (!call.data.id) {
                call.done(null, {});
                return;
            }
            client.get('/loadbalancers/' + call.data.id, function getLoadBalancer(err, creq, cres, obj) {
                if (err) {
                    call.done(err);
                    return;
                }
                call.done(null, obj);
            });
        });
    });

    server.onCall('LoadBalancerAdd', function (call) {
        getSscClient(call, function (err, client) {
            if (err) {
                call.done(err);
                return;
            }
            client.post('/loadbalancers', call.data, function addLoadBalancer(err, creq, cres, obj) {
                if (err) {
                    call.done(err);
                    return;
                }
                call.done(null, obj);
            });
        });
    });

    server.onCall('LoadBalancerUpdate', function (call) {
        getSscClient(call, function (err, client) {
            if (err) {
                call.done(err);
                return;
            }
            client.put('/loadbalancers/' + call.data.id, call.data, function updateLoadBalancer(err, creq, cres, obj) {
                if (err) {
                    call.done(err);
                    return;
                }
                call.done(null, obj);
            });
        });
    });

    server.onCall('LoadBalancerDelete', function (call) {
        getSscClient(call, function (err, client) {
            if (err) {
                call.done(err);
                return;
            }
            client.del('/loadbalancers/' + call.data.id, function deleteLoadBalancer(err, creq, cres, obj) {
                if (err) {
                    call.done(err);
                    return;
                }
                call.done(null, obj);
            });
        });
    });

    server.onCall('LoadBalancerUsage', function (call) {
        getSscClient(call, function (err, client) {
            if (err) {
                call.done(err);
                return;
            }
            var result = [];
            client.get('/loadbalancers/' + call.data.id + '/usage?metric=bytesin', function getBytesIn(err, creq, cres, obj) {
                if (err) {
                    call.done(err);
                    return;
                }
                result.push(obj);
                if (result.length === 2) {
                    call.done(null, result);
                }
            });
            client.get('/loadbalancers/' + call.data.id + '/usage?metric=bytesout', function getBytesOut(err, creq, cres, obj) {
                if (err) {
                    call.done(err);
                    return;
                }
                result.push(obj);
                if (result.length === 2) {
                    call.done(null, result);
                }
            });
        });
    });

    server.onCall('LoadBalancerMachineAdd', function (call) {
        getSscClient(call, function (err, client) {
            if (err) {
                call.done(err);
                return;
            }
            client.put('/loadbalancers/' + call.data.id + '/machines/' + call.data.host, function addMachine(err, creq, cres, obj) {
                if (err) {
                    call.done(err);
                    return;
                }
                call.done(null, obj);
            });
        });
    });

    server.onCall('LoadBalancerMachineDelete', function (call) {
        getSscClient(call, function (err, client) {
            if (err) {
                call.done(err);
                return;
            }
            client.del('/loadbalancers/' + call.data.id + '/machines/' + call.data.host, function deleteMachine(err, creq, cres, obj) {
                if (err) {
                    call.done(err);
                    return;
                }
                call.done(null, obj);
            });
        });
    });

    function createKeyPairs() {
        var kp = ursa.generatePrivateKey();
        return {
            privateKey: kp.toPrivatePem('utf8'),
            publicKey: kp.toPublicPem('utf8'),
            publicSsh: 'ssh-rsa ' + kp.toPublicSsh('base64') + ' piranha@portal',
            fingerprint: kp.toPublicSshFingerprint('hex').replace(/([a-f0-9]{2})/gi, '$1:').slice(0, -1)
        };
    }

    function addSscKey(call, key, callback) {
        var slbmKey = {name: call.req.session.userName + '_ssc_public_key', key: key};
        key = {name: 'ssc_public_key', key: key};

        var pool = [
            function (cb) {
                var meteringsUser = 'slb_meterings';
                call.cloud.getAccount(meteringsUser, function (err, account) {
                    if (err) {
                        var errorMessage = 'Cannot add public key to user "%s"';
                        if (err.statusCode === 404) {
                            errorMessage = errorMessage + ' because user not found';
                        }
                        else if (err.statusCode === 401) {
                            errorMessage = errorMessage + '.  Access denied';
                        }
                        call.req.log.error(errorMessage, meteringsUser);
                        return cb(null);
                    }
                    call.cloud.listKeys(account.id, function (err, keys) {
                        if (err) {return cb(err); }
                        var neededKey = Array.isArray(keys) && keys.filter(function (key) {
                            return key.name === slbmKey.name;
                        })[0];
                        if (!neededKey) {
                            call.cloud.createKey(account.id, slbmKey, function (err) {
                                cb(err);
                            });
                        } else {
                            call.cloud.deleteKey(account.id, neededKey.id, function () {
                                call.cloud.createKey(account.id, slbmKey, function (err) {
                                    cb(err);
                                });
                            });
                        }
                    });
                });
            },
            function (cb) {
                call.cloud.deleteKey(key, function () {
                    call.cloud.createKey(key, cb);
                });
            }
        ];
        vasync.parallel({funcs: pool}, callback);
    }

    function removeSscConfig(data, callback) {
        var fingerprint = ursa.createPrivateKey(data['metadata.ssc_private_key'])
            .toPublicSshFingerprint('hex').replace(/([a-f0-9]{2})/gi, '$1:').slice(0, -1);
        var client = manta.createClient({
            sign: manta.privateKeySigner({
                key: data['metadata.ssc_private_key'],
                keyId: fingerprint,
                user: data['metadata.account_name']
            }),
            user: data['metadata.account_name'],
            // TODO: manta configuration
            url: 'https://us-east.manta.joyent.com',
            rejectUnauthorized: false
        });

        function waitForManta(startTime) {
            startTime = startTime || new Date().getTime();
            if (new Date().getTime() - startTime > 2 * 60 * 1000) {
                callback(new Error('Timeout while removing slb config'));
                return;
            }
            client.unlink('/' + data['metadata.account_name'] + '/stor/slb.private/slb.conf', function (err) {
                if (err && err.statusCode >= 500) {
                    setTimeout(waitForManta.bind(this, startTime), 1000);
                } else if (err && err.statusCode === 403) {
                    callback('Manta user "' + data['metadata.account_name'] + '" does not exist');
                } else {
                    callback();
                }
            });
        }

        waitForManta();
    }

    server.onCall('SscMachineCreate', {
        handler: function (call) {
            call.update(null, 'Provisioning load balancer controller');
            var datacenter = config.slb.ssc_datacenter || 'us-west-1';
            machine.PackageList(call, {datacenter: datacenter}, function (packagesErr, packagesData) {
                if (packagesErr) {
                    call.done(packagesErr);
                    return;
                }

                var chosenPackages = packagesData.filter(function (pack) {
                    return pack.name === config.slb.ssc_package;
                });

                if (chosenPackages.length !== 1) {
                    call.done('Found no or more than one package with the name: ' + config.slb.ssc_package);
                    return;
                }

                var sscPackageId = chosenPackages[0].id;

                var sscKeyPair = createKeyPairs();
                var portalKeyPair = createKeyPairs();

                if (config.slb.ssc_private_key && config.slb.ssc_public_key) {
                    sscKeyPair.privateKey = config.slb.ssc_private_key;
                    sscKeyPair.publicSsh = config.slb.ssc_public_key;
                    sscKeyPair.fingerprint = ursa.openSshPublicKey(config.slb.ssc_public_key)
                        .toPublicSshFingerprint('hex').replace(/([a-f0-9]{2})/gi, '$1:').slice(0, -1);
                }

                var data = {
                    datacenter: datacenter,
                    dataset: config.slb.ssc_image,
                    name: hardControllerName,
                    'package': sscPackageId,
                    'metadata.ssc_private_key': sscKeyPair.privateKey,
                    'metadata.ssc_public_key': sscKeyPair.publicSsh,
                    'metadata.portal_public_key': (new Buffer(portalKeyPair.publicSsh).toString('base64')),
                    'metadata.account_name': call.req.session.userName,
                    'metadata.manta_account': call.req.session.userName,
                    'metadata.datacenter_name': datacenter,
                    'metadata.slb_code_url': config.slb.slb_code_url,
                    // TODO: remove this line after renaming code in image
                    'metadata.elb_code_url': config.slb.slb_code_url,
                    'metadata.sdc_url': config.slb.sdc_url || 'https://us-west-1.api.joyentcloud.com',
                    'tag.slb': 'ssc'
                };

                if (config.slb.ssc_networks) {
                    data.networks = config.slb.ssc_networks;
                }

                var portalFingerprint = '/' + call.req.session.userName + '/keys/' + portalKeyPair.fingerprint;

                call.req.log.info({fingerprint: portalFingerprint}, 'Storing key/fingerprint to metadata');

                Metadata.set(call.req.session.userId, Metadata.PORTAL_PRIVATE_KEY, portalKeyPair.privateKey, function (pKeyError) {
                    var setMetadataError = 'Something wrong, reinstalling load balancing required';
                    if (pKeyError) {
                        call.req.log.error(pKeyError);
                        call.done(setMetadataError);
                        return;
                    }
                    Metadata.set(call.req.session.userId, Metadata.PORTAL_FINGERPRINT, portalFingerprint, function (fPrintError) {
                        if (fPrintError) {
                            call.req.log.error(fPrintError);
                            call.done(setMetadataError);
                            return;
                        }
                        addSscKey(call, sscKeyPair.publicSsh, function (keyError) {
                            if (keyError) {
                                call.done(keyError);
                                return;
                            }
                            removeSscConfig(data, function (configError) {
                                if (configError) {
                                    call.req.log.warn('Cannot remove user slb config from manta.');
                                }
                                call.cloud.separate(datacenter).listNetworks(function (networksError, networks) {
                                    if (networksError) {
                                        call.done(networksError);
                                        return;
                                    }
                                    data.networks = networks.map(function (network) {
                                        return network.id;
                                    });
                                    call.req.log.info("Creating SSC machine", data);
                                    machine.Create(call, data, function (createError, result) {
                                        if (createError) {
                                            call.done(createError);
                                            return;
                                        }
                                        getSscClient(call, function (clientErr) {
                                            if (clientErr) {
                                                call.done(clientErr);
                                                return;
                                            }
                                            call.done(null, 'Load balancer controller is up');
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }
    });

    function deleteSscMachine(call, callback) {
        getSscMachine(call, function (err, sscMachine) {
            if (err) {
                callback(err);
                return;
            }
            var data = {
                uuid: sscMachine.id,
                datacenter: sscMachine.datacenter
            };
            ssc.clearCache(call);
            call.update(null, 'Removing load balancer infrastructure.');
            machine.Stop(call, data, function (stopError) {
                if (stopError) {
                    callback(stopError);
                    return;
                }
                call.update(null, 'You will not incur any future charges for Joyent Simple Load Balancer.');
                machine.Delete(call, data, function (delError, result) {
                    if (delError) {
                        callback(delError);
                        return;
                    }
                    callback(null, result);
                });
            });
        });
    }

    server.onCall('SscMachineDelete', function (call) {
        getSscClient(call, function (err, client) {
            if (err) {
                // Still delete SSC even if SLBAPI is unavailable
                deleteSscMachine(call, call.done);
                return;
            }
            call.update(null, 'Deleting load balancers.');
            client.del('/loadbalancers', function (delError, creq, cres, obj) {
                if (delError) {
                    call.log.warn('Cannot disable STMs');
                }
                // Still delete SSC even if SLBAPI returned error
                deleteSscMachine(call, call.done);
            });
        });
    });

    server.onCall('SscMachineLoad', function (call) {
        getSscMachine(call, function (err, sscMachine) {
            if (err) {
                call.req.log.info(err);
                call.done(err, true);
                return;
            }
            call.done(null, sscMachine);
        });
    });
};

if (!config.features || config.features.slb === 'enabled') {
    assert(config.slb, "slb section is required");
    assert(config.slb.slb_code_url, "slb.slb_code_url is required");
    assert(config.slb.ssc_image, "slb.ssc_image is required");
    assert(config.slb.ssc_package, "slb.ssc_package is required");
    assert(config.slb.ssc_protocol, "slb.ssc_protocol is required");
    assert(config.slb.ssc_port, "slb.ssc_port is required");

    module.exports = slb;
}
