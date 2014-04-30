'use strict';

var fs = require('fs');
var config = require('easy-config');
var manta = require('manta');

module.exports = function execute(scope) {
    var Manta = scope.api('MantaClient');
    var server = scope.api('Server');

    function getArchivedJobFile(call, jobId, path, callback) {
        var client = Manta.createClient(call);
        var jobPath = manta.jobPath(jobId, call.req.session.userName) + path;

        client.get(jobPath, function (err, stream) {
            if (err) {
                callback(err);
                return;
            }
            var body = '';
            stream.on('data', function (data) {
                body += data;
            });
            stream.on('end', function () {
                try {
                    var result = JSON.parse(body);
                    result = Array.isArray(result) ? result : [result];
                    callback(null, result);
                } catch (error) {
                    callback(null, [body]);
                }
            });
            stream.on('error', function (error) {
                callback(error);
            });
        });

    }

    function processJobRequest(call, dataKey, jobId, fallbackPath) {
        return function (error, res) {
            if (error) {
                call.done(error);
                return;
            }
            var result = [];
            res.on(dataKey, function (data) {
                result.push(data);
            });
            res.once('end', function () {
                call.done(null, result);
            });
            res.once('error', function (error) {
                if (fallbackPath && jobId && error.statusCode === 404) {
                    getArchivedJobFile(call, jobId, fallbackPath, call.done.bind(call));
                    return;
                }
                call.done(error);
            });
        };
    }

    server.onCall('JobList', function (call) {
        var client = Manta.createClient(call);
        client.jobs(processJobRequest(call, 'job'));
    });

    server.onCall('JobGet', function (call) {
        var jobId = call.data.path;
        var client = Manta.createClient(call);

        client.job(jobId, function (jobsErr, res) {
            if (jobsErr) {
                if (jobsErr.statusCode !== 404) {
                    call.done(jobsErr);
                    return;
                }
                getArchivedJobFile(call, jobId, '/job.json', function (error, result) {
                    call.done(error, result && result[0]);
                });
                return;
            }
            call.done(null, res);
        });
    });

    server.onCall('JobErrors', function (call) {
        var jobId = call.data.id;
        var client = Manta.createClient(call);

        client.jobErrors(jobId, processJobRequest(call, 'err', jobId, '/err.txt'));
    });

    server.onCall('JobFailures', function (call) {
        var jobId = call.data.id;
        var client = Manta.createClient(call);

        client.jobFailures(jobId, processJobRequest(call, 'key', jobId, '/fail.txt'));
    });

    server.onCall('JobOutput', function (call) {
        var jobId = call.data.id;
        var client = Manta.createClient(call);

        client.jobOutput(jobId, processJobRequest(call, 'key', jobId, '/out.txt'));
    });

    server.onCall('JobInputs', function (call) {
        var jobId = call.data.id;
        var client = Manta.createClient(call);
        client.jobInput(jobId, processJobRequest(call, 'key', jobId, '/in.txt'));
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

    server.onCall('JobClone', function (call) {
        var job = call.data;
        var client = Manta.createClient(call);

        client.createJob(job, function (err, jobId) {
            if (err) {
                call.done(err);
                return;
            }
            call.done(null, jobId);
        });
    });

    server.onCall('JobCreate', {
        verify: function (data) {
            return typeof data
                && data.hasOwnProperty('mapStep')
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
            var phases = [
                {
                    exec: mapStep,
                    assets: assets
                }
            ];
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