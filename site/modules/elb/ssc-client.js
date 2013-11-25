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

var getMachinesList = exports.getMachinesList = function getMachinesList(call, cb) {
    var cloud = call.cloud || call.req.cloud;
    var datacenterKeys = Object.keys(cloud.listDatacenters());
    var datacentersCount = datacenterKeys.length;
    var result = [];
    datacenterKeys.forEach(function (name) {
        cloud.separate(name).listMachines({ credentials: true }, function (err, machines) {
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
};

var getSscMachine = exports.getSscMachine = function getSscMachine(call, cb) {
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
};

exports.getSscClient = function (call, callback) {
    function getElbApiKey(call, callback) {
        var result = {};
        vasync.parallel({
            funcs: [
                function (callback) {
                    getSscMachine(call, function (error, machine) {
                        result.primaryIp = machine.primaryIp;
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
    function checkSscClient(client, callback, firstStart) {
        firstStart = firstStart || new Date().getTime();
        if (new Date().getTime() - firstStart > 3 * 60 * 1000) {
            callback(new Error('SSC Connection Timeout'));
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
    getElbApiKey(call, function (error, result) {
        if (error) {
            callback(error);
            return;
        }

        if (!(result.primaryIp && result.privateKey && result.fingerprint)) {
            callback(new Error('Something wrong, re-enabling load balancing required'));
            return;
        }

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
        checkSscClient(sscClient, callback);
    });
};