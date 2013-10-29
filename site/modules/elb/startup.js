'use strict';

var config = require('easy-config');
var restify = require('restify');
var fs = require('fs');
var httpSignature = require('http-signature');
//FIXME: Even if feature flag is disabled then this will break code.
var key = fs.readFileSync(config.elb.keyPath).toString();

//FIXME: Where is logging?

module.exports = function execute(scope, app) {
    var server = scope.api('Server');

    //FIXME: Even if feature flag is disabled then this will break code.
    var client = restify.createJsonClient({
        url: config.elb.url,
        rejectUnauthorized: false,
        signRequest: function (req) {
            httpSignature.sign(req, {
                key: key,
                keyId: config.elb.keyId
            });
        }
    });

    server.onCall('LoadBalancersList', function (call) {
        client.get('/loadbalancers', function getLoadBalancers(err, creq, cres, obj) {
            if (err) {
                call.done(err);
                return;
            }
            call.done(null, obj);
        });
    });

    server.onCall('LoadBalancerLoad', function (call) {
        //FIXME: Should't this send 400 ? And use the onCall built in request verifier for that matter machine/startup.js:230 for example
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

    server.onCall('LoadBalancerAdd', function (call) {
        client.post('/loadbalancers', call.data, function addLoadBalancer(err, creq, cres, obj) {
            if (err) {
                call.done(err);
                return;
            }
            call.done(null, obj);
        });
    });

    server.onCall('LoadBalancerUpdate', function (call) {
        client.put('/loadbalancers/' + call.data.id, call.data, function updateLoadBalancer(err, creq, cres, obj) {
            if (err) {
                call.done(err);
                return;
            }
            call.done(null, obj);
        });
    });

    server.onCall('LoadBalancerDelete', function (call) {
        client.del('/loadbalancers/' + call.data.id, function deleteLoadBalancer(err, creq, cres, obj) {
            if (err) {
                call.done(err);
                return;
            }
            call.done(null, obj);
        });
    });

    server.onCall('LoadBalancerUsage', function (call) {
        //FIXME: Why aren't the calls done in parallel?
        client.get('/loadbalancers/' + call.data.id + '/usage?metric=bytesin', function getBytesIn(err, creq, cres, obj) {
            if (err) {
                call.done(err);
                return;
            }
            var result = [obj];
            client.get('/loadbalancers/' + call.data.id + '/usage?metric=bytesout', function getBytesOut(err, creq, cres, obj) {
                if (err) {
                    call.done(err);
                    return;
                }
                result.push(obj);
                call.done(null, result);
            });
        });
    });

    server.onCall('LoadBalancerMachineAdd', function (call) {
        client.put('/loadbalancers/' + call.data.id + '/machines/' + call.data.host, function addMachine(err, creq, cres, obj) {
            if (err) {
                call.done(err);
                return;
            }
            call.done(null, obj);
        });
    });

    server.onCall('LoadBalancerMachineDelete', function (call) {
        client.del('/loadbalancers/' + call.data.id + '/machines/' + call.data.host, function deleteMachine(err, creq, cres, obj) {
            if (err) {
                call.done(err);
                return;
            }
            call.done(null, obj);
        });
    });
};