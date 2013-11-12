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
                    vasync.forEachParallel({
                        func: function (key, callback) {
                            metadata.get(call.req.session.userId, key, callback);
                        },
                        inputs: ['portal_private_key', 'portal_fingerprint']
                    }, function (error, response) {
                        result.privateKey = response.successes[0];
                        result.fingerprint = response.successes[1];
                        callback(error);
                    });
                }
            ]
        }, function (error) {
            callback(error, result);
        });
    }
    getElbApiKey(call, function (error, result) {
        console.log(error, result);
        if (error) {
            callback(error);
            return;
        }

        if (!(result.primaryIp && result.privateKey && result.fingerprint)) {
            callback(new Error('Something wrong, re-enabling load balancing required'));
            return;
        }

        var sscUrl = 'http://' + result.primaryIp + ':4000';
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
        callback(null, sscClient);
    });
};