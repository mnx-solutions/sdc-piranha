'use strict';

var fs = require('fs');
var config = require('easy-config');

module.exports = function execute(scope) {
    var Manta = scope.api('MantaClient');
    var server = scope.api('Server');

    server.onCall('JobList', function (call) {
        var client = Manta.createClient(call);
        client.jobs(function (jobsErr, res) {
            if (jobsErr) {
                call.done(jobsErr);
                return;
            }
            var jobs = [];
            res.on('job', function (job) {
                jobs.push(job);
            });
            res.on('end', function () {
                call.done(null, jobs);
            });
        });
    });

    server.onCall('JobGet', function (call) {
        var jobPath = call.data.path;
        var client = Manta.createClient(call);

        client.job(jobPath, function (jobsErr, res) {
            if (jobsErr) {
                call.done(jobsErr);
                return;
            }
            call.done(null, res);
        });
    });

    server.onCall('JobErrors', function (call) {
        var jobId = call.data.id;
        var client = Manta.createClient(call);

        client.jobErrors(jobId, function (err, res) {
            if (err) {
                call.done(err);
                return;
            }
            var errors = [];

            res.on('err', function (e) {
                errors.push(e);
            });

            res.once('end', function () {
                call.done(null, errors);
            });
        });
    });

    server.onCall('JobFailures', function (call) {
        var jobId = call.data.id;
        var client = Manta.createClient(call);

        client.jobFailures(jobId, function (err, res) {
            if (err) {
                call.done(err);
                return;
            }
            var failures = [];

            res.on('key', function (k) {
                failures.push(k);
            });

            res.once('end', function () {
                call.done(null, failures);
            });
        });
    });

    server.onCall('JobOutput', function (call) {
        var jobId = call.data.id;
        var client = Manta.createClient(call);

        client.jobOutput(jobId, function (err, res) {
            if (err) {
                call.done(err);
                return;
            }
            var outputs = [];

            res.on('key', function (k) {
                outputs.push(k);
            });

            res.once('end', function () {
                call.done(null, outputs);
            });
        });
    });

    server.onCall('JobInputs', function (call) {
        var jobId = call.data.id;
        var client = Manta.createClient(call);
        client.jobInput(jobId, function (err, res) {
            if (err) {
                call.done(err);
                return;
            }
            var inputs = [];

            res.on('key', function (k) {
                inputs.push(k);
            });

            res.once('end', function () {
                call.done(null, inputs);
            });
        });
    });

    server.onCall('JobCancel', function (call) {
        var jobId = call.data.id;
        var client = Manta.createClient(call);

        client.cancelJob(jobId, function (err) {
            if (err) {
                call.done(err);
                return;
            }
            var message = 'Job ' + jobId + ' was successfully canceled';
            call.done(null, message);
        });
    });

    server.onCall('JobCreate', {
        verify: function (data) {
            return typeof data
                && (data.hasOwnProperty('mapStep') || data.hasOwnProperty('reduceStep'))
                && data.hasOwnProperty('inputs')
                && data.inputs.every(function (input) {
                    return input.charAt(0) === '/';
                })
                && data.assets.every(function (asset) {
                    return asset.charAt(0) === '/';
                })
                && data.inputs.length > 0;
        },
        handler: function (call) {
            var mapStep = call.data.mapStep;
            var reduceStep = call.data.reduceStep;
            var assets = call.data.assets;
            var inputs = call.data.inputs;
            var phases = [];
            if (mapStep) {
                phases.push({
                    exec: mapStep,
                    assets: assets
                });
            }
            if (reduceStep) {
                phases.push({
                    type: "reduce",
                    exec: reduceStep,
                    assets: assets
                });
            }
            var job = {
                name: call.data.name,
                phases: phases
            };

            var client = Manta.createClient(call);
            client.createJob(job, function (err, jobId) {
                if (err) {
                    call.done(err);
                    return;
                }
                if (jobId) {
                    client.addJobKey(jobId, inputs, {end: true}, function (err) {
                        if (err) {
                            call.done(err);
                            return;
                        }
                        call.done(null, jobId);
                    });
                }
            });
        }
    });
};