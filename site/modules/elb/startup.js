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
            url: 'https://us-east.manta.joyent.com',
            rejectUnauthorized: false
        });

        function waitForManta(startTime) {
            startTime = startTime || new Date().getTime();
            if (new Date().getTime() - startTime > 2 * 60 * 1000) {
                callback(new Error('Time for removing elb config timed out'));
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
        verify: function (data) {
            return data && typeof data.datacenter === 'string';
        },
        handler: function (call) {
            call.getImmediate(false);
            machine.PackageList(call, {datacenter: call.data.datacenter}, function (packagesErr, packagesData) {
                if (packagesErr) {
                    call.done(packagesErr);
                    return;
                }

                var chosenPackages = packagesData.filter(function (pack) {
                    return pack.name === config.elb.ssc_package;
                });

                if (chosenPackages.length !== 1) {
                    call.done('Cannot find only one package for name: ' + config.elb.ssc_package);
                    return;
                }

                var ccsPackageId = chosenPackages[0].id;

                var sscKeyPair = createKeyPairs();
                var portalKeyPair = createKeyPairs();
                var data = {
                    datacenter: call.data.datacenter,
                    dataset: config.elb.ssc_image,
                    name: hardControllerName,
                    'package': ccsPackageId,
                    'metadata.ssc_private_key': sscKeyPair.privateKey,
                    'metadata.ssc_public_key': sscKeyPair.publicSsh,
                    'metadata.portal_public_key': (new Buffer(portalKeyPair.publicSsh).toString('base64')),
                    'metadata.account_name': config.elb.account || call.req.session.userName,
                    'metadata.datacenter_name': call.data.datacenter,
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

                Metadata.set(call.req.session.userId, Metadata.PORTAL_PRIVATE_KEY, portalKeyPair.privateKey, function (err) {
                    if (err) {
                        call.req.log.warn(err);
                    }
                    Metadata.set(call.req.session.userId, Metadata.PORTAL_FINGERPRINT, portalFingerprint, function (err) {
                        if (err) {
                            call.req.log.warn(err);
                        }
                        addSscKey(call, sscKeyPair.publicSsh, function (err) {
                            if (err) {
                                call.done(err);
                                return;
                            }
                            removeSscConfig(data, function (err) {
                                if (err) {
                                    call.done(err);
                                    return;
                                }
                                machine.Create(call, data, function (err, result) {
                                    if (err) {
                                        call.done(err);
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
            machine.Stop(call, data, function (err) {
                if (err) {
                    callback(err);
                    return;
                }
                machine.Delete(call, data, function (err, result) {
                    if (err) {
                        callback(err);
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
            client.del('/loadbalancers', function (err, creq, cres, obj) {
                if (err) {
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