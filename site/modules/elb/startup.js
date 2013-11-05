'use strict';

var config = require('easy-config');
var restify = require('restify');
var fs = require('fs');
var vasync = require('vasync');
var httpSignature = require('http-signature');
var key = config.elb && config.elb.keyPath ? fs.readFileSync(config.elb.keyPath).toString() : null;
var sscName = config.elb && config.elb.sscName || 'elb-ssc';

//Logging is done by serverTab itself, no need for additional info/error logging in each request
var elb = function execute(scope) {
    var server = scope.api('Server');
    var machine = scope.api('Machine');
    var metadata = scope.api('Metadata');

    var hardDataCenter = 'us-west-x';
    var hardControllerName = 'elb-ssc';

    function getMachinesList(call, cb) {
        var datacenterKeys = Object.keys(call.cloud.listDatacenters());
        var datacentersCount = datacenterKeys.length;
        var result = [];
        var errs = [];
        datacenterKeys.forEach(function (name) {
            call.cloud.separate(name).listMachines({ credentials: true }, function (err, machines) {
                machines = machines || [];
                machines.forEach(function (machine) {
                    machine.datacenter = name;
                    result.push(machine);
                });
                datacentersCount -= 1;
                if (datacentersCount === 0) {
                    cb(null, result);
                }
            });
        });
    }

    function getSscMachine(call, cb) {
        getMachinesList(call, function (err, machines) {
            if (err) {
                cb(err);
                return;
            }
            var sscMachines = machines.filter(function (machine) {
                return machine.name === sscName;
            });
            if (sscMachines.length !== 1) {
                cb('SSC machine not found or multiple SSC machines');
                return;
            }
            cb(null, sscMachines[0]);
        });
    }

    var sscClient = null;
    function getSscClient(call, cb) {
        function getElbApiKey(call, callback) {
            var result = {};
            vasync.parallel({
                funcs: [
                    function _getSscMachine(callback) {
                        getSscMachine(call, function(error, machine) {
                            result.primaryIp = machine.primaryIp;
                            callback(error);
                        });
                    },
                    function _getElbAPIKey(callback) {
                        vasync.forEachParallel({
                            func: function(key, callback) {
                                metadata.get(call.req.session.userId, key, callback);
                            },
                            inputs: ['portal_private_key', 'portal_fingerprint']
                        }, function(error, response) {
                            result.privateKey = response.successes[0];
                            result.fingerprint = response.successes[1];
                            callback(error);
                        });
                    }
                ]
            }, function(error) {
                callback(error, result);
            });
        }
        getElbApiKey(call, function(error, result) {
            console.log(error, result);
            if (error) {
                cb(error);
                return;
            }
            var sscUrl = 'http://' + result.primaryIp + ':4000';
//            var sscUrl = 'https://localhost:4000';
            sscClient = restify.createJsonClient({
                url: sscUrl,
                rejectUnauthorized: false,
                signRequest: function (req) {
                    httpSignature.sign(req, {
                        key: result.privateKey,
                        keyId: result.fingerprint
                    });
                }
            });
            cb(null, sscClient);
        });
    }

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

    server.onCall('SscMachineCreate', function (call) {
        var data = {
            datacenter: hardDataCenter,
            dataset: '0132c5b0-4586-11e3-ad73-b360f35434c7',
            name: hardControllerName,
            package: '5d367f42-867b-4cc3-883c-b329cbaad9d4',
            networks: ['7cb0dfa0-a5a5-4533-86dc-dedbe6bb662f'],
            elbController: true
        };
        machine.Create(call, data, function (err, result) {
            if (err) {
                call.done(err);
                return;
            }
            call.done(null, result);
        });
    });

    server.onCall('SscMachineDelete', function (call) {
        getSscMachine(call, function (err, sscMachine) {
            if (err) {
                call.done(err);
                return;
            }
            var data = {
                uuid: sscMachine.id,
                datacenter: sscMachine.datacenter
            };
            machine.Stop(call, data, function (err) {
                if (err) {
                    call.done(err);
                    return;
                }
                machine.Delete(call, data, function (err, result) {
                    if (err) {
                        call.done(err);
                        return;
                    }
                    call.done(null, result);
                });
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
    module.exports = elb;
}