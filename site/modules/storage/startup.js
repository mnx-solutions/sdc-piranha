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
    var Billing = scope.api('Billing');

    function sendError(call, error, suppressErrorLog) {
        function done(error) {
            if (error) {
                call.done(error.message || mantaNotAvailable, suppressErrorLog);
            } else {
                call.done();
            }
        }
        if (error) {
            done(error);
            return;
        }
        return done;
    }

    function checkResponse(call, ignoreNotFound, forceDone) {
        return function (error, result) {
            if (error) {
                if (forceDone && error.statusCode === 404) {
                    call.done();
                    return;
                }
                if (ignoreNotFound && (error.statusCode === 404 || error.statusCode === 403)) {
                    var message = 'The file path not found.';
                    call.req.log.info(message);
                    error.message = message;
                }
                sendError(call, error, ignoreNotFound);
                return;
            }
            call.done(null, forceDone ? null : result);
        };
    }

    function getArchivedJobFile(call, jobId, path, callback, fallback) {
        var client = Manta.createClient(call);
        var jobPath = manta.jobPath(jobId, call.req.session.userName) + path;
        client.getFileContent(jobPath, function (err, body) {
            if (err) {
                if (fallback) {
                    client[fallback](jobId, processJobRequest(call, 'key', jobId));
                } else {
                    sendError(call, err);
                }
                return;
            }
            if (path === '/job.json') {
                try {
                    callback(null, JSON.parse(body));
                } catch (error) {
                    callback('Cannot get job details');
                }
            } else {
                callback(null, (body || '').split('\n').filter(function (item) {
                    return item;
                }));
            }

        });
    }

    function processJobRequest(call, dataKey, jobId, fallbackPath, nameFilterRegex) {
        return function (error, res) {
            if (error) {
                sendError(call, error);
                return;
            }
            var result = [];
            res.on(dataKey, function (data) {
                if (!nameFilterRegex || nameFilterRegex.test(data.name)) {
                    result.push(data);
                }
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
        var NAME_FILTER_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        client.jobs(processJobRequest(call, 'job', null, null, NAME_FILTER_REGEX));
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
                    call.done(null, result);
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
        getArchivedJobFile(call, jobId, '/out.txt', checkResponse(call), 'jobOutput');
    });

    server.onCall('JobInputs', function (call) {
        var jobId = call.data.id;
        getArchivedJobFile(call, jobId, '/in.txt', checkResponse(call), 'jobInput');
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
            console.log(job, inputs, 'CreateJob');
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
        client.rmr(call.data.path, checkResponse(call, null, true));
    });

    server.onCall('FileManDeleteFile', function (call) {
        var client = Manta.createClient(call);
        client.unlink(call.data.path, checkResponse(call, null, true));
    });

    server.onCall('FileManPut', function (call) {
        var fileStream = new MemoryStream(call.data.fileBody);
        var client = Manta.createClient(call);
        client.put(call.data.path, fileStream, {size: call.data.fileBody.length}, checkResponse(call));
    });

    server.onCall('FileManGet', function (call) {
        var client = Manta.createClient(call);
        client.get(call.data.path, checkResponse(call, true));
    });

    server.onCall('FileManInfo', function (call) {
        var client = Manta.createClient(call);
        client.info(call.data.path, checkResponse(call, true));
    });

    server.onCall('FileManCreateFolder', function (call) {
        var client = Manta.createClient(call);
        client.mkdir(call.data.path, sendError(call));
    });

    server.onCall('FileManStorageReport', function (call) {
        var client = Manta.createClient(call);
        var reportPath = '/' + client.user + '/reports/usage/storage/' + call.data.originPath;
        client.getFileContent(reportPath, 'utf8', function (error, data) {
            if (error) {
                sendError(call);
                return;
            }
            call.done(null, data);
        });
    });

    server.onCall('StoragePing', function (call) {
        var client = Manta.createClient(call);
        var retries = 15;
        function pingManta() {
            Billing.isActive(call.req.session.userId, function (error, isActive) {
                if (error || !isActive) {
                    sendError(call, {message: 'Something went wrong.  Please try again in a minute.'});
                    return;
                }
                client.get('/' + client.user, function (error) {
                    if (error) {
                        call.req.log.error(error, 'Ping manta storage');
                        if (error.name === 'AccountBlockedError' || error.name === 'AccountBlocked') {
                            if (retries > 0) {
                                retries -= 1;
                                setTimeout(pingManta, 1000);
                                return;
                            }
                            error = {message: 'Something went wrong.  Please try again in a minute.'};
                        }
                        sendError(call, error);
                        return;
                    }
                    call.done(null, 'pong');
                });
            });
        }
        pingManta();
    });
};