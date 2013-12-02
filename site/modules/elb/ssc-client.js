"use strict";

var vasync = require('vasync');
var restify = require('restify');
var httpSignature = require('http-signature');
var config = require('easy-config');
var sscName = (config.elb && config.elb.sscName) || 'elb-ssc';
var metadata = null;

exports.init = function (mdata) {
    metadata = mdata;
};

var getMachinesList = exports.getMachinesList = function (call, cb) {
    var cloud = call.cloud || call.req.cloud;
    var datacenter = config.elb.ssc_datacenter || 'us-west-1';
    cloud.separate(datacenter).listMachines({ credentials: true }, function (err, machines) {
        machines = machines || [];
        cb(null, machines);
    });
};

var sscMachinesCache = {};

var getSscMachine = exports.getSscMachine = function getSscMachine(call, cb) {
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
            cb('SSC machine not found or multiple SSC machines found');
            return;
        }
        var sscMachine = sscMachines[0];
        sscMachinesCache[call.req.session.userId] = sscMachine;
        cb(null, sscMachine);
    });
};

var sscClientsCache = {};

exports.getSscClient = function (call, sscCallback) {
    function getElbApiKey(keyCall, keyCallback) {
        var result = {};
        vasync.parallel({
            funcs: [
                function (callback) {
                    getSscMachine(keyCall, function (error, machine) {
                        if (!error) {
                            result.primaryIp = machine.primaryIp;
                        }
                        callback(error);
                    });
                },
                function (callback) {
                    metadata.get(keyCall.req.session.userId, metadata.PORTAL_PRIVATE_KEY, function (err, value) {
                        result.privateKey = value;
                        callback(err);
                    });
                },
                function (callback) {
                    metadata.get(keyCall.req.session.userId, metadata.PORTAL_FINGERPRINT, function (err, value) {
                        result.fingerprint = value;
                        callback(err);
                    });
                }
            ]
        }, function (error) {
            keyCallback(error, result);
        });
    }

    function checkSscClient(client, callback, firstStart) {
        firstStart = firstStart || new Date().getTime();
        if (new Date().getTime() - firstStart > 5 * 60 * 1000) {
            callback('Connection Timeout. Try refreshing the page');
            return;
        }
        client.get('/ping', function (err, req, res, body) {
            if (!err && body === 'pong') {
                callback(null, client);
            } else {
                setTimeout(function () {
                    checkSscClient(client, callback, firstStart);
                }, 5000);
            }
        });
    }

    if (sscClientsCache[call.req.session.userId]) {
        checkSscClient(sscClientsCache[call.req.session.userId], sscCallback);
        return;
    }

    getElbApiKey(call, function (error, result) {
        if (error) {
            sscCallback(error);
            return;
        }

        if (!(result.primaryIp && result.privateKey && result.fingerprint)) {
            sscCallback(new Error('Something wrong, re-enabling load balancing required'));
            return;
        }

        call.req.log.info({fingerprint: result.fingerprint, primaryIp: result.primaryIp}, 'Creating ELBAPI client');

        var sscUrl = config.elb.ssc_protocol + '://' + result.primaryIp + ':' + config.elb.ssc_port;
        var sscClient = restify.createJsonClient({
            url: sscUrl,
            rejectUnauthorized: false,
            signRequest: function (req) {
                httpSignature.sign(req, {
                    key: result.privateKey,
                    keyId: result.fingerprint
                });
            }
        });
        sscClientsCache[call.req.session.userId] = sscClient;
        checkSscClient(sscClient, sscCallback);
    });
};

exports.clearCache = function (call) {
    delete sscClientsCache[call.req.session.userId];
    delete sscMachinesCache[call.req.session.userId];
};