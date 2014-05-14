'use strict';

var fs = require('fs');
var path = require('path');
var config = require('easy-config');
var manta = require('manta');
var MemoryStream = require('memorystream');
var mantaNotAvailable = 'Manta service is not available.';
module.exports = function execute(scope) {
    var Manta = scope.api('MantaClient');
    var server = scope.api('Server');

    function sendError(call, error) {
        function done(error) {
            call.done(error.message || mantaNotAvailable);
        }
        if (error) {
            done(error);
            return;
        }
        return done;
    }

    function checkResponse(call) {
        return function (error, result) {
            if (error) {
                sendError(call, error);
                return;
            }
            call.done(null, result);
        };
    }

    function getArchivedJobFile(call, jobId, path, callback) {
        var client = Manta.createClient(call);
        var jobPath = manta.jobPath(jobId, call.req.session.userName) + path;

        client.get(jobPath, function (err, stream) {
            if (err) {
                sendError(call, err);
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
            stream.on('error', sendError(call));
        });

    }

    function processJobRequest(call, dataKey, jobId, fallbackPath) {
        return function (error, res) {
            if (error) {
                sendError(call, error);
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
                    getArchivedJobFile(call, jobId, fallbackPath, checkResponse(call));
                    return;
                }
                sendError(call, error);
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
                    sendError(call, jobsErr);
                    return;
                }
                getArchivedJobFile(call, jobId, '/job.json', function (error, result) {
                    if (error) {
                        sendError(call, error);
                        return;
                    }
                    call.done(null, result && result[0]);
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
                sendError(call, err);
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
                    sendError(call, err);
                    return;
                }
                if (jobId) {
                    client.addJobKey(jobId, inputs, {end: true}, function (err) {
                        if (err) {
                            sendError(call, err);
                            return;
                        }
                        call.done(null, jobId);
                    });
                }
            });
        }
    });

    server.onCall('FileManGetUser', function (call) {
        //TODO: User specific cache of manta client
        var client = Manta.createClient(call);
        call.done(null, {user: client.user});
    });

    server.onCall('FileManList', function (call) {
        var client = Manta.createClient(call);
        client.ls(call.data.path, function (err, res) {
            if (err) {
                sendError(call, err);
                return;
            }
            var files = [];
            function onEntry(e) {
                files.push(e);
            }

            res.on('directory', onEntry);
            res.on('object', onEntry);
            res.once('error', sendError(call));
            res.once('end', function () {
                files.forEach(function (file) {
                    file.path = file.name;
                });
                call.done(null, files);
            });
        });
    });

    server.onCall('FileManDeleteTree', function (call) {
        var client = Manta.createClient(call);
        client.rmr(call.data.path, sendError(call));
    });

    server.onCall('FileManDeleteFile', function (call) {
        var client = Manta.createClient(call);
        client.unlink(call.data.path, sendError(call));
    });

    server.onCall('FileManPut', function (call) {
        var fileStream = new MemoryStream(call.data.fileBody);
        var client = Manta.createClient(call);
        client.put(call.data.path, fileStream, {size: call.data.fileBody.length}, checkResponse(call));
    });

    server.onCall('FileManGet', function (call) {
        var client = Manta.createClient(call);
        client.get(call.data.path, checkResponse(call));
    });

    server.onCall('FileManInfo', function (call) {
        var client = Manta.createClient(call);
        client.info(call.data.path, checkResponse(call));
    });

    server.onCall('FileManCreateFolder', function (call) {
        var client = Manta.createClient(call);
        client.mkdir(call.data.path, sendError(call));
    });

    server.onCall('FileManStorageReport', function (call) {
        var client = Manta.createClient(call);
        var reportPath = '/' + client.user + '/reports/usage/storage/' + call.data.originPath;
        client.get(reportPath, function (err, stream) {
            if (err) {
                sendError(call, err);
                return;
            }
            var data = '';
            stream.setEncoding('utf8');
            stream.on('data', function (chunk) {
                data += chunk;
            });
            stream.on('end', function () {
                call.done(null, data);
            });
            stream.on('error', sendError(call));
        });
    });

    server.onCall('StoragePing', function (call) {
        var client = Manta.createClient(call);
        var retries = 3;
        function pingManta() {
            client.get('/' + client.user, function (error) {
                if (error) {
                    if (error.name === 'AccountBlockedError' && call.req.session.provisionEnabled && retries > 0) {
                        retries -= 1;
                        setTimeout(pingManta, 1000);
                        return;
                    }
                    sendError(call, error);
                    return;
                }
                call.done(null, 'pong');
            });
        }
        pingManta();
    });
};