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
        updateJobInList(call, call.jobId, {status: 'Failed'}, function (err) {
            if (err) {
                call.done(err);
                return;
            }
            call.done(error.message || error);
        });
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
                jobId: jobId,
                status: 'Processing'
            });
            client.putFileContents('/' + client.user + '/' + mdbJobsListPath, list, callback);
        });
    }

    function waitForJobInList(call, jobId, callback) {
        var jobList = function () {
            getJobsList(call, function (error, list) {
                if (error) {
                    callback(error);
                    return;
                }
                var matchingJobs = list.filter(function (item) {
                    return item.jobId === jobId;
                });
                if (matchingJobs.length > 0) {
                    callback(null, list);
                    return;
                } else {
                    setTimeout(jobList, config.polling.mantaJob);
                }
            });
        };
        jobList();
    }

    function updateJobInList(call, jobId, updateData, callback) {
        var client = Manta.createClient(call);
        callback = callback || function () {};
        waitForJobInList(call, jobId, function (err, list) {
            if (err) {
                callback(err);
                return;
            }
            list.some(function (job) {
                if (job.jobId === jobId) {
                    Object.keys(updateData).forEach(function (key) {
                        job[key] = updateData[key];
                    });
                    return true;
                }
                return false;
            });
            client.putFileContents('/' + client.user + '/' + mdbJobsListPath, list, callback);
        });
    }

    server.onCall('MdbGetJobFromList', {
        verify: function (data) {
            return data.jobId;
        },
        handler: function (call) {
            getJobsList(call, function (error, list) {
                if (error) {
                    call.done(error);
                    return;
                }
                var result = list.find(function (job) {
                    return job.jobId === call.data.jobId;
                });
                if (result) {
                    var client = Manta.createClient(call);
                    client.job(result.jobId, function (getJobError, jobInfo) {
                        var status;
                        if (getJobError) {
                            status = 'Failed';
                        } else if (jobInfo.cancelled) {
                            status = 'Cancelled';
                        } else if (jobInfo.state === 'done') {
                            status = 'Processed';
                        } else if (jobInfo.state === 'running') {
                            status = 'Processing';
                        }
                        if (status !== 'Processing') {
                            getDebugJSObjects(call, result.jobId, function (getObjectsError) {
                                if (getObjectsError) {
                                    status = (status === 'Cancelled' ? 'Cancelled' : 'Failed');
                                }
                                var data = {status: status};
                                if (status === 'Processed') {
                                    data.dateEnd = jobInfo.timeDone;
                                }
                                if (!status || result.status !== status) {
                                    updateJobInList(call, result.jobId, data, function (updateJobError) {
                                        if (updateJobError) {
                                            sendError(call, updateJobError);
                                            return;
                                        }
                                        call.done(null, result);
                                    });
                                } else {
                                    call.done(null, result);
                                }
                            });
                        } else {
                            call.done(null, result);
                        }
                    });
                } else {
                    call.done(null, result);
                }
            });
        }
    });

    server.onCall('MdbGetJobsList', function (call) {
        getJobsList(call, call.done.bind(call));
    });

    server.onCall('MdbGetJob', {
        verify: function (data) {
            return data && data.jobId;
        },
        handler: function (call) {
            getJobsList(call, function (error, list) {
                if (error) {
                    sendError(call, error);
                    return;
                }

                var thisJob = list.find(function (job) {
                    return job.jobId === call.data.jobId;
                });
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
                        updateJobInList(call, jobId, {status: 'Parsing'}, function (firstUpdateJobError) {
                            if (firstUpdateJobError) {
                                sendError(call, firstUpdateJobError);
                                return;
                            }
                            getDebugJSObjects(call, jobId, function (getObjectsError, stats) {
                                if (getObjectsError) {
                                    sendError(call, getObjectsError);
                                    return;
                                }
                                stats.status = 'Processed';
                                updateJobInList(call, jobId, {status: 'Processed', dateEnd: new Date()}, function (secondUpdateJobError) {
                                    if (secondUpdateJobError) {
                                        sendError(call, secondUpdateJobError);
                                        return;
                                    }
                                    call.done(getObjectsError, stats);
                                });
                            });
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
            client.cancelJob(call.data.jobId, function (error) {
                if (error) {
                    call.done(error);
                    return;
                }
                call.done(null, 'Cancelled');
            });
        }
    });
};

if (!config.features || config.features.mdb !== 'disabled') {
    module.exports = mdbApi;
}