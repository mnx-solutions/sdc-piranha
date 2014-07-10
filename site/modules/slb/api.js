"use strict";

var vasync = require('vasync');
var restify = require('restify');
var httpSignature = require('http-signature');
var config = require('easy-config');
var sscName = (config.slb && config.slb.sscName) || 'slb-ssc';
var metadata = null;

var sscInitialPingTimeout = 90 * 1000;
var sscRegularPingTimeout = 20 * 1000;
var sscOperationTimeout = 5 * 60 * 1000;
var SSCMachineNotFound = 'SSC machine not found';
module.exports = function execute(scope, register) {
    var api = {};

    api.init = function (mdata) {
        metadata = mdata;
    };

    var SscJsonClient = function (options) {
        options.connectTimeout = options.connectTimeout || 10000;
        var client = restify.createJsonClient(options);
        client.ping = function ping(callback) {
            client.get({path: '/ping', connectTimeout: 2000, retry: false}, callback);
        };

        return client;
    };
    var getMachinesList = api.getMachinesList = function getMachinesList(call, cb) {
        var cloud = call.cloud || call.req.cloud;
        var datacenter = config.slb.ssc_datacenter || 'us-west-1';
        cloud.separate(datacenter).listMachines({ credentials: true }, function (err, machines) {
            machines = (machines && machines.length) ? machines : [];
            machines.forEach(function (machine) {
                machine.datacenter = datacenter;
            });
            cb(null, machines);
        });
    };

    var sscMachinesCache = {};
    var sscClientsCache = {};

    var clearCache = api.clearCache = function clearCache(call) {
        delete sscClientsCache[call.req.session.userId];
        delete sscMachinesCache[call.req.session.userId];
    };

    var getSscMachine = api.getSscMachine = function getSscMachine(call, cb) {
        if (sscMachinesCache[call.req.session.userId]) {
            cb(null, sscMachinesCache[call.req.session.userId]);
            return;
        }
        getMachinesList(call, function (err, machines) {
            if (err) {
                cb(err);
                return;
            }
            var sscMachines = machines.filter(function (machine) {
                return machine.name === sscName;
            });
            if (sscMachines.length === 0) {
                cb(SSCMachineNotFound, null);
                return;
            }
            var sscMachine = sscMachines[0];
            if (sscMachine.state === 'stopped') {
                var machineApi = scope.api('Machine');
                var options = {
                    uuid: sscMachine.id,
                    datacenter: sscMachine.datacenter
                };
                machineApi.Start(call, options, function (err) {
                    if (err) {
                        cb('Load balancer was stopped, failed to restart');
                        return;
                    }
                    cb(null, sscMachine);
                });
                return;
            }
            sscMachinesCache[call.req.session.userId] = sscMachine;
            cb(null, sscMachine);
        });
    };

    api.getSscClient = function (call, callback) {
        function getSlbApiKey(call, callback) {
            var result = {};
            vasync.parallel({
                funcs: [
                    function (callback) {
                        getSscMachine(call, function (error, machine) {
                            result.primaryIp = machine && machine.primaryIp;
                            callback(error);
                        });
                    },
                    function (callback) {
                        metadata.get(call.req.session.userId, metadata.PORTAL_PRIVATE_KEY, function (err, value) {
                            result.privateKey = value;
                            callback(err);
                        });
                    },
                    function (callback) {
                        metadata.get(call.req.session.userId, metadata.PORTAL_FINGERPRINT, function (err, value) {
                            result.fingerprint = value;
                            callback(err);
                        });
                    }
                ]
            }, function (error) {
                if (error === SSCMachineNotFound) {
                    call.req.log.info('Load balancer not installed');
                }
                callback(error, result);
            });
        }

        function restartSscMachine(call, cb) {
            getSscMachine(call, function (error, sscMachine) {
                if (error) {
                    cb('Failed to get load balancer machine.');
                    return;
                }
                var now = new Date().getTime();
                var updated = new Date(sscMachine.updated).getTime();
                if (sscMachine.state === 'running' && now - updated > 5 * 60 * 1000) {
                    var machineApi = scope.api('Machine');
                    var options = {
                        uuid: sscMachine.id,
                        datacenter: sscMachine.datacenter
                    };
                    machineApi.Reboot(call, options, function (err) {
                        if (err) {
                            cb('Load balancer not responding, failed to restart');
                            return;
                        }
                        cb('Load balancer was not responding, restarted. Try refreshing the page.');
                    });
                } else {
                    cb('Connection Timeout. Try refreshing the page.');
                }
            });
        }

        function checkSscClient(checkClient, checkTimeout, checkCallback) {
            var timer;
            var called = false;
            var wrappedCallback = function () {
                if (!called) {
                    called = true;
                    checkCallback.apply(this, arguments);
                }
            };
            var pingUntil = new Date().getTime() + checkTimeout;
            function pingSscClient() {
                call.log.info('Pinging SLBAPI');
                checkClient.ping(function (err, req, res, body) {
                    if (!err && body === 'pong') {
                        clearInterval(timer);
                        call.log.info('Got pong from SLBAPI');
                        wrappedCallback(null, checkClient);
                    } else if (new Date().getTime() > pingUntil) {
                        clearInterval(timer);
                        restartSscMachine(call, wrappedCallback);
                        clearCache(call);
                    }
                });
            }
            timer = setInterval(pingSscClient, 5000);
            pingSscClient();
        }

        if (sscClientsCache[call.req.session.userId]) {
            checkSscClient(sscClientsCache[call.req.session.userId], sscRegularPingTimeout, callback);
            return;
        }

        getSlbApiKey(call, function (error, result) {
            if (error) {
                callback(error);
                return;
            }

            if (!(result.primaryIp && result.privateKey && result.fingerprint)) {
                callback('Something wrong, reinstalling load balancing required');
                return;
            }

            call.req.log.info({fingerprint: result.fingerprint, primaryIp: result.primaryIp}, 'Creating SLBAPI client');

            var sscUrl = config.slb.ssc_protocol + '://' + result.primaryIp + ':' + config.slb.ssc_port;
            var sscClient = new SscJsonClient({
                url: sscUrl,
                rejectUnauthorized: false,
                serializers: restify.bunyan.serializers,
                signRequest: function (req) {
                    httpSignature.sign(req, {
                        key: result.privateKey,
                        keyId: result.fingerprint
                    });
                },
                log: call.log
            });
            sscClientsCache[call.req.session.userId] = sscClient;
            checkSscClient(sscClient, sscInitialPingTimeout, callback);
        });
    };

    register('SLB', api);
};
