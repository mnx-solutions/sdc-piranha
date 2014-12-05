'use strict';

var fs = require('fs');
var path = require('path');
var config = require('easy-config');
var manta = require('manta');
var mantaNotAvailable = 'Manta service is not available.';
var MANTA_PING_RETRIES = 15;
var PING_ERROR_MESSAGE = 'Something went wrong.  Please try again in a minute.';
var vasync = require('vasync');

module.exports = function execute(scope) {
    var Manta = scope.api('MantaClient');
    var server = scope.api('Server');

    function sendError(call, error, suppressErrorLog) {
        function done(err) {
            if (err) {
                var message = err.message || '';
                if (err.code === 'NoMatchingRoleTag' && message && call.data && call.data.path) {
                    err.message = message.substring(0, message.length - 1) + " '" + call.data.path + "'.";
                }
                call.req.log.debug('sendError', err);
                call.done(err.message || mantaNotAvailable, suppressErrorLog);
            } else {
                call.done();
            }
        }
        if (error) {
            return done(error);
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
                var message;
                if (error.code === 'ForbiddenError') {
                    message = 'None of your active roles are present on the resource ' + call.data.path;
                } else if (error.code === 'AuthorizationFailed' && error.message) {
                    message = error.message;
                } else if (ignoreNotFound && (error.statusCode === 404 || error.statusCode === 403)) {
                    message = 'The file path not found.';
                }
                if (message) {
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
        var jobPath = manta.jobPath(jobId, client.user) + path;
        client.getFileContents(jobPath, function (err, body) {
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
            res.once('error', function (err) {
                if (fallbackPath && jobId && err.statusCode === 404) {
                    getArchivedJobFile(call, jobId, fallbackPath, checkResponse(call));
                    return;
                }
                sendError(call, err);
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
            var count = call.data.count;
            var memory = call.data.memory;
            var disk = call.data.disk;
            var phases = [];
            if (mapStep) {
                var phasesPropsMap = {
                    exec: mapStep,
                    assets: assets
                };
                if (memory) {
                    phasesPropsMap.memory = memory;
                }
                if (disk) {
                    phasesPropsMap.disk = disk;
                }
                phases.push(phasesPropsMap);
            }
            if (reduceStep) {
                var phasesPropsReduce = {
                    type: "reduce",
                    exec: reduceStep,
                    assets: assets
                };
                if (count) {
                    phasesPropsReduce.count = count;
                }
                if (memory) {
                    phasesPropsReduce.memory = memory;
                }
                if (disk) {
                    phasesPropsReduce.disk = disk;
                }
                phases.push(phasesPropsReduce);
            }
            var job = {
                name: call.data.name,
                phases: phases
            };

            var client = Manta.createClient(call);
            console.log(job, inputs, 'CreateJob');
            client.createJob(job, function (error, jobId) {
                if (error) {
                    sendError(call, error);
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

    var ls = function (call, client) {
        client = client || Manta.createClient(call);
        client.listDirectory(call.data.path, function(err, list) {
            if (err) {
                sendError(call, err);
                return;
            }
            call.done(null, list);
        });
    };

    server.onCall('FileManList', function (call) {
        if (call.data.originPath === '/') {
            var directories = ['jobs', 'public', 'reports', 'stor'];
            var files = directories.map(function (directory) {
                return {
                    path: directory,
                    type: 'directory',
                    parent: call.req.session.parentAccount || call.req.session.userName,
                    name: directory
                };
            });
            call.done(null, files);
            return;
        }
        if (call.req.session.parentAccount) {
            var client = Manta.createClient(call);
            client.get(call.data.path, function (err) {
                if (err) {
                    sendError(call, err);
                    return;
                }
                ls(call, client);
            });
            return;
        }
        ls(call);
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
        var client = Manta.createClient(call);
        client.putFileContents(call.data.path, call.data.fileBody, checkResponse(call));
    });

    server.onCall('FileManGet', function (call) {
        var client = Manta.createClient(call);
        client.get(call.data.path, checkResponse(call, null));
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
        var reportPath = '~~/reports/usage/storage/' + call.data.originPath;
        client.getFileContents(reportPath, 'utf8', function (error, data) {
            if (error) {
                sendError(call);
                return;
            }
            call.done(null, data);
        });
    });

    server.onCall('FileManGetRoles', function (call) {
        var client = Manta.createClient(call);
        client.getRoleTags(call.data.path, function (err, roles) {
            if (err) {
                checkResponse(call, true)(err);
                return;
            }
            call.done(null, roles);
        });
    });

    server.onCall('FileManSetRoles', function (call) {
        var client = Manta.createClient(call);
        client.setRoleTags(call.data.path, call.data.roles, call.data.recursive, call.done.bind(call));
    });

    var pingStorage = function (call, pingFunc) {
        var Billing = scope.api('Billing');
        var retries = MANTA_PING_RETRIES;

        var pingManta = function () {
            pingFunc(function (error) {
                if (error) {
                    if (error.name === 'AccountBlockedError' || error.name === 'AccountBlocked' ||
                        error.name === 'ForbiddenError') {
                        if (retries > 0) {
                            retries -= 1;
                            call.req.log.debug(error, 'Ping manta storage');
                            setTimeout(pingManta, 1000);
                            return;
                        }
                        error = {message: PING_ERROR_MESSAGE};
                    }
                    sendError(call, error); // This will also log the error
                    return;
                }
                call.done(null, 'pong');
            });
        };
        if (call.data) {
            pingManta();
        } else {
            Billing.isActive(call.req.session.userId, function (err, isActive) {
                if (err || !isActive) {
                    sendError(call, {message: PING_ERROR_MESSAGE});
                    return;
                }
                pingManta();
            });
        }
    };

    server.onCall('StoragePing', function (call) {
        var client = Manta.createClient(call);
        pingStorage(call, function (callback) {
            client.get('~~/public', callback);
        });
    });

    server.onCall('StorageListPing', function (call) {
        var client = Manta.createClient(call);
        pingStorage(call, function (callback) {
            client.ls('~~/public', callback);
        });
    });

    server.onCall('FileManMfind', {
        verify: function (data) {
            return data &&
                   typeof (data.path) === 'string' &&
                   typeof (data.mfind) === 'string';
        },
        handler: function (call) {
            var client = Manta.createClient(call);
            var path = call.data.path;
            var opts = {};
            var optsMap = {
                l: 'limit',
                n: 'name',
                p: 'parallel',
                s: 'size',
                t: 'type',
                limit: 'limit',
                name: 'name',
                parallel: 'parallel',
                size: 'size',
                type: 'type',
                maxdepth: 'maxdepth',
                mindepth: 'mindepth'
            };

            var parts = call.data.mfind.split('-');
            parts.forEach(function (part) {
                part = part.split(' ');
                var key = optsMap[part[0]];
                var value = part[1];

                if (key && value) {
                    if (key === 'name') {
                        value = new RegExp(value);
                    }
                    opts[key] = value;
                }
            });

            if (Object.keys(opts).length === 0) {
                return call.done(null, []);
            }

            return client.info(path, function (error, response) {
                if (error) {
                    return call.done(error);
                }
                if (response.extension !== 'directory') {
                    path = path.slice(0, path.lastIndexOf('/') + 1);
                }

                return client.ftw(path, opts, function (err, res) {
                    if (err) {
                        return call.done(err);
                    }

                    var files = [];

                    function onEntry(e) {
                        e.path = e.name;
                        files.push(e);
                    }

                    res.on('object', onEntry);

                    res.once('error', sendError(call));

                    res.once('end', function () {
                        return call.done(null, files);
                    });
                });
            });
        }
    });
};