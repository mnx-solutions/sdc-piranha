'use strict';
var config = require('easy-config');
var restify = require('restify');
var vasync = require('vasync');
var path = require('path');
var generalErrorMessage = 'Something went wrong, please try again.';
var mantaNotAvailable = 'Manta service is not available.';
var mdbJobsListPath = '/stor/.joyent/portal/MdbJobs.json';
var delimiter = '-delimiter-';

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

function modulesParser(rawModulesContent) {
    var modules = {};
    function normalize(text) {
        if (!text || text === 'undefined' || !isNaN(parseFloat(text))) {
            return undefined;
        }

        return text ? text.replace(/^"|"$/g, '') : text;
    }

    function parseModuleFile(filePath) {
        filePath = normalize(filePath);
        if (typeof filePath !== 'string') {
            return;
        }

        var raw = filePath.split(/\/node_modules\/([^\/]+)/g).filter(function (e) {
            return !!e;
        });
        var lib = raw.pop();
        var name = raw.slice(-1)[0];

        if (modules[name] && modules[name].libs) {
            if (modules[name].libs.indexOf(lib) === -1) {
                modules[name].libs.push(lib);
            }
            return modules[name];
        }
        raw.shift(); // remove first part of path

        if (raw.length) {
            modules[name] = {
                name: name,
                file: filePath,
                level: raw.length,
                node_modules: raw,
                parent: raw.slice(-2, -1)[0],
                libs: [lib],
                children: (modules[name] && modules[name].children) || []
            };
        }

        return modules[name] || filePath;
    }

    function getModule(name) {
        modules[name] = modules[name] || {name: name, children: []};
        return modules[name];
    }

    modules.root = getModule('root');
    rawModulesContent.split(delimiter).forEach(function (rec) {
        var parsed = rec.split('\n').filter(function (e) {return e.trim(); });

        if (!parsed[1]) {
            return;
        }
        var module = parseModuleFile(parsed[1]);
        var parentModule = parseModuleFile(parsed[3]);
        if (!module) {
            return;
        }
        if (module.level === 0) {
            module.name = 'root';
            module.lib = parsed[1];
        }
        if (typeof module.name !== 'string') {
            return;
        }

        if ((parentModule === '.' && module.parent) || !parentModule.children) {
            parentModule = getModule(module.parent || 'root');
        }

        if (module !== parentModule && parentModule.children.indexOf(module) === -1) {
            parentModule.children.push(module);
        }
    });

    function destroyCycles(modules, includedModules) {
        modules.forEach(function (module, index) {
            if (includedModules) {
                if (includedModules.indexOf(module) > -1) {
                    modules[index] = {name: module.name, children: []};
                }
                includedModules.push(module);
            }

            destroyCycles(module.children, includedModules || []);
        });
    }

    destroyCycles(modules.root.children);
    return {modules: modules.root.children};
}

var mdbApi = function execute(scope) {
    var Manta = scope.api('MantaClient');
    var server = scope.api('Server');

    function copyObjects(distination, source) {
        distination = distination || {};
        Object.getOwnPropertyNames(source || {}).forEach(function (key) {
            distination[key] = source[key];
        });
    }

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

    function getDebugObjectsFile(call, jobId, filename, parser, callback) {
        var client = Manta.createClient(call);
        client.getFileContents('~~/jobs/' + jobId + '/' + filename + '.txt', function (error, data) {
            if (error) {
                if (error.statusCode === 404) {
                    error.message = generalErrorMessage;
                }
                callback(error);
                return;
            }
            try {
                callback(null, parser(data));
            } catch (e) {
                call.req.log.error(e, 'Error parsing file: "' + filename + '"');
                callback(e);
            }
        });
    }

    function sendError(call, error) {
        if (error.code === 'ENOTFOUND') {
            error.message = mantaNotAvailable;
        }
        call.done(error.message || error);
    }

    function getJobsList(call, callback) {
        var client = Manta.createClient(call);
        client.getFileContents('~~/' + mdbJobsListPath, function (error, list) {
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
            client.putFileContents('~~/' + mdbJobsListPath, list, callback);
        });
    }

    function removeJobFromList(call, jobIds, callback) {
        var client = Manta.createClient(call);
        callback = callback || function () {};
        getJobsList(call, function (error, list) {
            if (error && error.statusCode !== 404) {
                callback(error);
                return;
            }
            jobIds = Array.isArray(jobIds) ? jobIds : [jobIds];
            jobIds.forEach(function (jobId) {
                list.forEach(function (item, index) {
                    if (item.jobId === jobId) {
                        list.splice(index, 1);
                    }
                });
            });
            client.putFileContents('~~/' + mdbJobsListPath, list, callback);
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
                    copyObjects(job, updateData);
                    return true;
                }
                return false;
            });
            client.putFileContents('~~/' + mdbJobsListPath, list, callback);
        });
    }

    function parseObjects(call, status, jobInfo) {
        var jsObjects = {};

        copyObjects(jsObjects, jobInfo);

        var jobData = {status: status || jobInfo.status};
        if (jobData.status === 'Cancelled' || jobData.status === 'Failed') {
            copyObjects(jobData, {
                jobId: jobInfo.jobId,
                coreFile: jobInfo.coreFile
            });
            call.done(null, jobData);
            return;
        }

        vasync.forEachParallel({
            inputs: [
                {file: 'findjsobjects', parser: objectsParser},
                {file: 'modules', parser: modulesParser}
            ],
            func: function (work, callback) {
                getDebugObjectsFile(call, jobInfo.jobId, work.file, work.parser, function (error, result) {
                    if (error) {
                        return callback(error);
                    }
                    copyObjects(jsObjects, result);
                    callback(null);
                });
            }
        }, function (error) {
            jobData.status = jsObjects.status = 'Failed';
            if (!error) {
                jobData.status = jsObjects.status = 'Processed';
                jobData.dateEnd = jsObjects.dateEnd = jobInfo.dateEnd || new Date();
            }

            updateJobInList(call, jobInfo.jobId, jobData, function () {
                call.done(null, jsObjects);
            });
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
                var job = list.find(function (job) {
                    return job.jobId === call.data.jobId;
                });
                if (job) {
                    var client = Manta.createClient(call);
                    client.jobInfo(job.jobId, function (getJobError, jobInfo) {
                        var status;
                        if (getJobError || jobInfo.state === 'failed') {
                            status = 'Failed';
                        } else if (jobInfo.cancelled) {
                            status = 'Cancelled';
                        } else if (jobInfo.state === 'done') {
                            status = 'Processed';
                        } else if (jobInfo.state === 'running') {
                            status = 'Processing';
                        }
                        if (status !== 'Processing') {
                            parseObjects(call, status, job);
                        } else {
                            call.done(null, job);
                        }
                    });
                } else {
                    call.done(null, job);
                }
            });
        }
    });

    server.onCall('MdbGetJobsList', function (call) {
        getJobsList(call, function (error, list) {
            if (error) {
                sendError(call, error);
                return;
            }
            var client = Manta.createClient(call);
            client.ls('~~/jobs', function (err, res) {
                if (err) {
                    call.done(err, list);
                    return;
                }
                var deletedMdbJob = false;
                var mdbList = [];
                var jobs = [];

                res.on('directory', function (e) {
                    jobs.push(e.name);
                });

                res.once('end', function () {
                    list.forEach(function (item) {
                       if (jobs.some(function (job) { return job === item.jobId; })) {
                           mdbList.push(item);
                       } else {
                           deletedMdbJob = true;
                       }
                    });

                    if (deletedMdbJob) {
                        client.putFileContents('~~/' + mdbJobsListPath, mdbList, function () {});
                    }
                    call.done(null, mdbList);
                });
            });
        });
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

                parseObjects(call, 'Processed', thisJob || {jobId: call.data.jobId});
            });
        }
    });
    server.onCall('MdbDeleteJob', {
        verify: function (data) {
            return data && data.jobIds;
        },
        handler: function (call) {
            removeJobFromList(call, call.data.jobIds, function (error) {
                if (error) {
                    sendError(call, error);
                    return;
                }
                call.done(null, 'Deleted');
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
                            parseObjects(call, 'Parsing', {jobId: jobId});
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
