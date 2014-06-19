'use strict';
var config = require('easy-config');
var restify = require('restify');
var path = require('path');
var errorMessage = 'Something went wrong, please try again.';

function objectsParser(data) {
    var result = {counters: {}, data: []};
    var i, line;
    data = data.split('\n');
    for (i = 0; i < data.length; i += 1) {
        line = data[i];
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
    }
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
                        error.message = errorMessage;
                    }
                    error.message = error.message || errorMessage;
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
        client.getFileContent('/' + client.user + '/jobs/' + jobId + '/findjsobjects.txt', function (error, data) {
            if (error) {
                if (error.statusCode === 404) {
                    error.message = errorMessage;
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