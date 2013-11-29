'use strict';

var assert = require('assert');
var config = require('easy-config');
var ursa = require('ursa');
var manta = require('manta');
var ssc = require('./ssc-client');
var getSscMachine = ssc.getSscMachine;
var getSscClient = ssc.getSscClient;

//Logging is done by serverTab itself, no need for additional info/error logging in each request
var elb = function execute(scope) {
    var server = scope.api('Server');
    var machine = scope.api('Machine');
    var Metadata = scope.api('Metadata');

    var hardControllerName = 'elb-ssc';

    ssc.init(Metadata);

    server.onCall('LoadBalancersList', function (call) {
        getSscClient(call, function (err, client) {
            if (err) {
                call.done(err);
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
        call.cloud.deleteKey({name: 'ssc_public_key'}, function () {
            call.cloud.createKey({name: 'ssc_public_key', key: key}, callback);
        });

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
                callback(new Error('Timeout while removing elb config'));
                return;
            }
            client.unlink('/' + data['metadata.account_name'] + '/stor/elb.private/elb.conf', function (err) {
                if (err && err.statusCode !== 404) {
                    setTimeout(waitForManta.bind(this, startTime), 1000);
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
            var datacenter = config.elb.ssc_datacenter || 'us-west-1';
            machine.PackageList(call, {datacenter: datacenter}, function (packagesErr, packagesData) {
                if (packagesErr) {
                    call.done(packagesErr);
                    return;
                }

                var chosenPackages = packagesData.filter(function (pack) {
                    return pack.name === config.elb.ssc_package;
                });

                if (chosenPackages.length !== 1) {
                    call.done('Found no or more than one package with the name: ' + config.elb.ssc_package);
                    return;
                }

                var sscPackageId = chosenPackages[0].id;

                var sscKeyPair = createKeyPairs();
                var portalKeyPair = createKeyPairs();

                var data = {
                    datacenter: datacenter,
                    dataset: config.elb.ssc_image,
                    name: hardControllerName,
                    'package': sscPackageId,
                    'metadata.ssc_private_key': sscKeyPair.privateKey,
                    'metadata.ssc_public_key': sscKeyPair.publicSsh,
                    'metadata.portal_public_key': (new Buffer(portalKeyPair.publicSsh).toString('base64')),
                    'metadata.account_name': config.elb.account || call.req.session.userName,
                    'metadata.datacenter_name': datacenter,
                    'metadata.elb_code_url': config.elb.elb_code_url,
                    'metadata.sdc_url': config.elb.sdc_url || 'https://us-west-1.api.joyentcloud.com',
                    'tag.lbaas': 'ssc'
                };

                if (config.elb.ssc_networks) {
                    data.networks = config.elb.ssc_networks;
                }

                if (config.elb.ssc_private_key && config.elb.ssc_public_key) {
                    data['metadata.ssc_private_key'] = config.elb.ssc_private_key;
                    data['metadata.ssc_public_key'] = config.elb.ssc_public_key;
                }

                var portalFingerprint = '/' + call.req.session.userName + '/keys/' + portalKeyPair.fingerprint;

                call.req.log.info({fingerprint: portalFingerprint}, 'Storing key/fingerprint to metadata');

                Metadata.set(call.req.session.userId, Metadata.PORTAL_PRIVATE_KEY, portalKeyPair.privateKey, function (pKeyError) {
                    if (pKeyError) {
                        call.done(pKeyError);
                        return;
                    }
                    Metadata.set(call.req.session.userId, Metadata.PORTAL_FINGERPRINT, portalFingerprint, function (fPrintError) {
                        if (fPrintError) {
                            call.done(fPrintError);
                            return;
                        }
                        addSscKey(call, sscKeyPair.publicSsh, function (keyError) {
                            if (keyError) {
                                call.done(keyError);
                                return;
                            }
                            removeSscConfig(data, function (configError) {
                                if (configError) {
                                    call.done(configError);
                                    return;
                                }
                                machine.Create(call, data, function (createError, result) {
                                    if (createError) {
                                        call.done(createError);
                                        return;
                                    }
                                    call.done(null, result);
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
            call.update(null, 'Stopping load balancer controller');
            machine.Stop(call, data, function (stopError) {
                if (stopError) {
                    callback(stopError);
                    return;
                }
                call.update(null, 'Destroying load balancer controller');
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
                // Still delete SSC even if ELBAPI is unavailable
                deleteSscMachine(call, call.done);
                return;
            }
            call.update(null, 'Deleting load balancers');
            client.del('/loadbalancers', function (delError, creq, cres, obj) {
                if (delError) {
                    call.log.warn('Cannot disable STMs');
                }
                // Still delete SSC even if ELBAPI returned error
                deleteSscMachine(call, call.done);
            });
        });
    });

    server.onCall('SscMachineLoad', function (call) {
        getSscMachine(call, function (err, sscMachine) {
            if (err) {
                call.done(err);
                return;
            }
            call.done(null, sscMachine);
        });
    });
};

if (!config.features || config.features.elb === 'enabled') {
    assert(config.elb, "elb section is required");
    assert(config.elb.elb_code_url, "elb.elb_code_url is required");
    assert(config.elb.ssc_image, "elb.ssc_image is required");
    assert(config.elb.ssc_package, "elb.ssc_package is required");
    assert(config.elb.ssc_protocol, "elb.ssc_protocol is required");
    assert(config.elb.ssc_port, "elb.ssc_port is required");

    module.exports = elb;
}