"use strict";

var vasync = require('vasync');
var restify = require('restify');
var httpSignature = require('http-signature');
var config = require('easy-config');
var sscName = (config.slb && config.slb.sscName) || 'slb-ssc';
var metadata = null;

var sscInitialPingTimeout = 60 * 1000;
var sscRegularPingTimeout = 20 * 1000;
var sscOperationTimeout = 5 * 60 * 1000;

module.exports = function execute(scope, register) {
    var api = {};

    api.init = function (mdata) {
        metadata = mdata;
    };

    var SscJsonClient = (function () {
        function SscJsonClient(options) {
            this.client = restify.createJsonClient(options);
        }
        SscJsonClient.prototype.wrap = function (callback, timeout) {
            timeout = timeout || sscOperationTimeout;
            var timer = setTimeout(function () {
                callback('Operation Timeout. Try repeating the operation');
            }, timeout);
            return function () {
                clearTimeout(timer);
                callback.apply(this, arguments);
            };
        };
        SscJsonClient.prototype.get = function (options, callback) {
            this.client.get(options, this.wrap(callback, options.connectTimeout));
        };
        SscJsonClient.prototype.post = function (options, body, callback) {
            this.client.post(options, body, this.wrap(callback, options.connectTimeout));
        };
        SscJsonClient.prototype.put = function (options, body, callback) {
            this.client.put(options, body, this.wrap(callback, options.connectTimeout));
        };
        SscJsonClient.prototype.del = function (options, callback) {
            this.client.del(options, this.wrap(callback, options.connectTimeout));
        };
        SscJsonClient.prototype.ping = function (callback) {
            this.get({path: '/ping', connectTimeout: 2000}, callback);
        };
        return SscJsonClient;
    })();

    var getMachinesList = api.getMachinesList = function getMachinesList(call, cb) {
        var cloud = call.cloud || call.req.cloud;
        var datacenter = config.slb.ssc_datacenter || 'us-west-1';
        cloud.separate(datacenter).listMachines({ credentials: true }, function (err, machines) {
            machines = machines || [];
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
            if (sscMachines.length !== 1) {
                cb('SSC machine not found', null);
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
                callback(error, result);
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
                        clearCache(call);
                        wrappedCallback('Connection Timeout. Try refreshing the page');
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
                callback(new Error('Something wrong, re-enabling load balancing required'));
                return;
            }

            call.req.log.info({fingerprint: result.fingerprint, primaryIp: result.primaryIp}, 'Creating SLBAPI client');

            var sscUrl = config.slb.ssc_protocol + '://' + result.primaryIp + ':' + config.slb.ssc_port;
            var sscClient = new SscJsonClient({
                url: sscUrl,
                rejectUnauthorized: false,
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
