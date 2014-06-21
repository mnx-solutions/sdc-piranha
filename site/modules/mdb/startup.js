'use strict';
var config = require('easy-config');
var restify = require('restify');
var path = require('path');
var generalErrorMessage = 'Something went wrong, please try again.';
var mdbJobsListPath = '/stor/.joyent/portal/MdbJobs.json';

function objectsParser(data) {
    var result = {counters: {}, data: []};

    data.split('\n').forEach(function (line) {
        if (line.indexOf('findjsobjects:') === 0) {
            // example: findjsobjects:               processed arrays => 191922
            line = /\s*[^:]+:\s*(.*) => (\d+).*$/.exec(line);
            if (line) {
                result.counters[line[1]] = parseInt(line[2], 10);
            }
        } else {
            // example: 81924609    28618        8 <anonymous> (as tree.Rule): name, value, ...
            line = /\s*([0-9a-f]+)\s*(\d+)\s*(\d+)\s*(.*)/.exec(line);
            if (line) {
                result.data.push({
                    object: line[1],
                    objects: line[2],
                    props: line[3],
                    constr: line[4]
                });
            }
        }
    });
    return result;
}

var mdbApi = function execute(scope) {
    var Manta = scope.api('MantaClient');
    var server = scope.api('Server');

    function waitForJob(call, jobId, callback) {
        var client = Manta.createClient(call);
        function getJob() {
            client.job(jobId, function (error, jobInfo) {
                if (error) {
                    if (error.statusCode === 404) {
                        error.message = generalErrorMessage;
                    }
                    error.message = error.message || generalErrorMessage;
                    callback(error);
                } else if (jobInfo.cancelled) {
                    call.done(null, {status: 'Cancelled'});
                } else if (jobInfo.state === 'done') {
                    callback(null, jobInfo);
                } else {
                    setTimeout(getJob, config.polling.mantaJob);
                }
            });
        }
        getJob();
    }

    function getDebugJSObjects(call, jobId, callback) {
        var client = Manta.createClient(call);
        client.getFileContents('/' + client.user + '/jobs/' + jobId + '/findjsobjects.txt', function (error, data) {
            if (error) {
                if (error.statusCode === 404) {
                    error.message = generalErrorMessage;
                }
                callback(error);
                return;
            }

            callback(null, objectsParser(data));
        });
    }

    function sendError(call, error) {
        call.update(null, {status: 'Failed'});
        call.done(error.message || error);
    }

    function getJobsList(call, callback) {
        var client = Manta.createClient(call);
        client.getFileContents('/' + client.user + '/' + mdbJobsListPath, function (error, list) {
            if (error && error.statusCode !== 404) {
                callback(error);
                return;
            }
            list = list || '[]';
            try {
                list = JSON.parse(list);
            } catch (e) {
                call.req.log.error({error: e, list: list}, 'Unable to parse MDB jobs list');
                list = [];
            }
            callback(null, list);
        });
    }
    function appendJobToList(call, jobId, callback) {
        var client = Manta.createClient(call);
        callback = callback || function () {};
        getJobsList(call, function (error, list) {
            if (error && error.statusCode !== 404) {
                callback(error);
                return;
            }

            list.push({
                coreFile: call.data.coreFile,
                date: new Date(),
                jobId: jobId
            });
            client.putFileContents('/' + client.user + '/' + mdbJobsListPath, list, callback);
        });
    }

    server.onCall('MdbDebugJobsList', function (call) {
        getJobsList(call, call.done.bind(call));
    });

    server.onCall('getDebugJob', {
        verify: function (data) {
            return data && data.jobId;
        },
        handler: function (call) {
            getJobsList(call, function (error, list) {
                if (error) {
                    sendError(call, error);
                    return;
                }

                var thisJob = list.filter(function (job) {
                    return job.jobId === call.data.jobId;
                })[0];
                getDebugJSObjects(call, call.data.jobId, function (getObjectsError, stats) {
                    if (getObjectsError) {
                        sendError(call, getObjectsError);
                        return;
                    }
                    stats.status = 'Processed';
                    stats.coreFile = thisJob && thisJob.coreFile;
                    call.done(getObjectsError, stats);
                });
            });
        }
    });
    server.onCall('MdbProcess', {
        verify: function (data) {
            return data.coreFile;
        },
        handler: function (call) {
            var client = Manta.createClient(call);

            call.update(null, {status: 'Starting'});
            client.createJob({
                phases: [{
                    type: 'map',
                    assets: [config.mdb.processor],
                    exec: 'bash /assets/' + config.mdb.processor + ' | mdb $MANTA_INPUT_FILE'
                }]
            }, function (error, jobId) {
                if (error) {
                    sendError(call, error);
                    return;
                }
                call.update(null, {jobId: jobId});
                client.addJobKey(jobId, call.data.coreFile, {end: true}, function (addJobKeyError) {
                    if (addJobKeyError) {
                        client.cancelJob(jobId, function () {
                            sendError(call, addJobKeyError);
                        });
                        return;
                    }

                    appendJobToList(call, jobId);

                    call.update(null, {status: 'Processing'});
                    waitForJob(call, jobId, function (err) {
                        if (err) {
                            sendError(call, err);
                            return;
                        }
                        call.update(null, {status: 'Parsing'});
                        getDebugJSObjects(call, jobId, function (getObjectsError, stats) {
                            if (getObjectsError) {
                                sendError(call, getObjectsError);
                                return;
                            }
                            stats.status = 'Processed';
                            call.done(getObjectsError, stats);
                        });
                    });
                });
            });
        }
    });

    server.onCall('MdbCancel', {
        verify: function (data) {
            return data.jobId;
        },
        handler: function (call) {
            var client = Manta.createClient(call);
            client.cancelJob(call.data.jobId, call.done.bind(call));
        }
    });
};

if (!config.features || config.features.mdb !== 'disabled') {
    module.exports = mdbApi;
}