'use strict';

var assert = require('assert');
var config = require('easy-config');
var ssc = require('./ssc-client');
var getSscMachine = ssc.getSscMachine;
var getSscClient = ssc.getSscClient;

//Logging is done by serverTab itself, no need for additional info/error logging in each request
var elb = function execute(scope) {
    var server = scope.api('Server');
    var machine = scope.api('Machine');
    var metadata = scope.api('Metadata');

    var hardControllerName = 'elb-ssc';

    ssc.init(metadata);

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

    server.onCall('SscMachineCreate', {
        verify: function (data) {
            return data && typeof data.datacenter === 'string';
        },
        handler: function (call) {
            var data = {
                datacenter: call.data.datacenter,
                dataset: config.elb.ssc_image,
                name: hardControllerName,
                package: config.elb.ssc_package,
                elbController: true
            };
            if (config.elb.ssc_networks) {
                data.networks = config.elb.ssc_networks;
            }
            machine.Create(call, data, function (err, result) {
                if (err) {
                    call.done(err);
                    return;
                }
                call.done(null, result);
            });
        }

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
    assert(config.elb, "elb section is required");
    assert(config.elb.elb_code_url, "elb.elb_code_url is required");
    assert(config.elb.ssc_image, "elb.ssc_image is required");
    assert(config.elb.ssc_package, "elb.ssc_package is required");
    assert(config.elb.ssc_protocol, "elb.ssc_protocol is required");
    assert(config.elb.ssc_port, "elb.ssc_port is required");

    module.exports = elb;
}