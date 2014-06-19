'use strict';
var config = require('easy-config');
var restify = require('restify');
var path = require('path');
var errorMessage = 'Something went wrong, please try again.';

function objectsParser(data) {
    var result = {counters: {}, data: []};
    var i, tmp;
    data = data.split(/\n/);
    for (i = 0; i < data.length; i += 1) {
        tmp = data[i];
        if (tmp.indexOf('findjsobjects:') === 0) {
            tmp = /\s*[^:]+:\s*(.*) => (\d+).*$/.exec(tmp);
            if (tmp) {
                result.counters[tmp[1]] = parseInt(tmp[2], 10);
            }
        } else {
            tmp = /\s*([0-9a-f]+)\s*(\d+)\s*(\d+)\s*(.*)/.exec(tmp);
            if (tmp) {
                result.data.push({
                    object: tmp[1],
                    objects: tmp[2],
                    props: tmp[3],
                    constr: tmp[4]
                });
            }
        }
    }
    return result;
}

var mdb = function execute(scope) {
    var Manta = scope.api('MantaClient');
    var server = scope.api('Server');

    function waitJob(call, jobId, callback) {
        var client = Manta.createClient(call);
        function getJob() {
            client.job(jobId, function (error, status) {
                if (error) {
                    if (error.statusCode === 404) {
                        callback(new Error(errorMessage));
                    }
                    error.message = error.message || errorMessage;
                    callback(error);
                } else if (status.cancelled) {
                    call.done(null, {status: 'Cancelled'});
                } else if (status.state === 'done') {
                    callback(null, status);
                } else {
                    setTimeout(getJob, config.polling.mantaJob);
                }
            });
        }
        getJob();
    }

    function getDebugJSObjects(call, jobId, callback) {
        var client = Manta.createClient(call);
        client.get('/' + client.user + '/jobs/' + jobId + '/findjsobjects.txt', function (error, stream) {
            if (error) {
                if (error.statusCode === 404) {
                    callback(new Error(errorMessage));
                    return;
                }
                callback(error);
                return;
            }
            var data = '';
            stream.on('data', function (chunk) {
                data += chunk;
            });
            stream.on('end', function () {
                callback(null, objectsParser(data));
            });
            stream.on('error', function (err) {
                callback(err);
            });
        });
    }

    function sendError(call, error) {
        call.update(null, {status: 'Failed'});
        call.done(error.message || error);
    }

    server.onCall('mdbProcess', function (call) {
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
            client.addJobKey(jobId, call.data.coreFile, {end: true}, function (error) {
                if (error) {
                    client.cancelJob(jobId, function () {
                        sendError(call, error);
                    });
                    return;
                }
                call.update(null, {status: 'Processing'});
                waitJob(call, jobId, function (error) {
                    if (error) {
                        sendError(call, error);
                        return;
                    }
                    call.update(null, {status: 'Parsing'});
                    getDebugJSObjects(call, jobId, function (error, stats) {
                        if (error) {
                            sendError(call, error);
                            return;
                        }
                        call.update(null, {status: 'Complete'});
                        call.done(error, stats);
                    });
                });
            });
        });
    });

    server.onCall('mdbCancel', function (call) {
        var client = Manta.createClient(call);
        client.cancelJob(call.data.jobId, call.done.bind(call));
    });
};

if (!config.features || config.features.mdb !== 'disabled') {
    module.exports = mdb;
}