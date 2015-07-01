'use strict';

var config = require('easy-config');
var manta = require('manta');
var path = require('path');
var utils = require('../../../lib/utils');
var vasync = require('vasync');

var dtrace = function execute() {
    var Dtrace = require('../dtrace').Dtrace;
    var mantaClient = require('../storage').MantaClient;
    var server = require('../server').Server;

    var SCRIPTS_FILE_PATH = '~~/stor/.joyent/devtools/scripts.json';
    var SHARED_SCRIPTS_DIR_PATH = '/' + config.dtraceScripts.user + '/stor/dtraceScripts';
    var SCRIPT_NAME_DELIMITER = '@';

    var mantaSharedScriptsClient = mantaClient.createClient(null, config.dtraceScripts);

    var uuid = require('../../static/vendor/uuid/uuid.js');
    var DEFAULT_SCRIPT_LIST = [
        {name: 'all syscall'},
        {name: 'syscall for process', pid: true, execname: true},
        {name: 'fs-latency', body: 'syscall::*write*:entry,syscall::*read*:entry{self->syscall_entry_ts[probefunc] = vtimestamp;}syscall::*write*:return,syscall::*read*:return/self->syscall_entry_ts[probefunc]/{@time[probefunc] = lquantize((vtimestamp - self->syscall_entry_ts[probefunc] ) / 1024, 0, 63, 2); self->syscall_entry_ts[probefunc] = 0;}'},
        {name: 'dtrace-cpu', body: 'sched:::on-cpu { self->ts = vtimestamp; } sched:::off-cpu /self->ts/ { @[cpu] = lquantize((vtimestamp - self->ts) /1024, 0, 63, 2); self->ts = 0; }'},
        {name: 'node-slatency', body: 'node*:::http-server-request { ts[args[1]->fd] = vtimestamp; } node*:::http-server-response /this->start = ts[args[0]->fd]/{ @["ns"] = lquantize((vtimestamp - this->start )/ 2000000, 0, 63, 2); ts[pid, args[0]->fd] = 0;}'},
        {name: 'memory-leak', body: 'pid$PID::malloc:entry,pid$PID::calloc:entry,pid$PID::realloc:entry { self->size[probefunc] = vtimestamp; } pid$PID::malloc:return,pid$PID::calloc:return,pid$PID::realloc:return /self->size[probefunc]/ { @time[probefunc] = lquantize((vtimestamp - self->size[probefunc]) / 1024, 0, 63, 2); self->size[probefunc] = 0; }'},
        {name: 'read-write block', body: 'plockstat$PID:::rw-block { self->ts[probefunc] = vtimestamp; } plockstat$PID:::rw-acquire /self->ts[probefunc]/ { @time[probefunc] = lquantize((vtimestamp - self->ts[probefunc]), 0, 63, 2); self->ts[probefunc] = 0; }'},
        {name: 'mutex block', body: 'plockstat$PID:::mutex-block { self->ts[probefunc] = vtimestamp; } plockstat$PID:::mutex-acquire /self->ts[probefunc]/ { @time[probefunc] = lquantize((vtimestamp - self->ts[probefunc]), 0, 63, 2); self->ts[probefunc] = 0; }'}
    ];
    var SCRIPT_TYPES = {shared: 'shared', remote: 'remote'};

    function getScriptFilePath(call, scriptName) {
        return path.join(SHARED_SCRIPTS_DIR_PATH, call.req.session.userName + SCRIPT_NAME_DELIMITER + scriptName);
    }

    function getScriptsList(call, client, type, callback) {
        if (type === 'default') {
            return callback(null, DEFAULT_SCRIPT_LIST);
        }
        client.getFileJson(SCRIPTS_FILE_PATH, function (error, scripts) {
            if (error) {
                if (error.code === 'AccountDoesNotExist' || error.code === 'AccountBlocked') {
                    error = null;
                } else {
                    call.log.warn('DTrace scripts list is corrupted');
                }
            }
            var scriptsList = scripts;
            if (type === 'all') {
                scriptsList = [].concat(DEFAULT_SCRIPT_LIST, scripts || []);
            }
            mantaSharedScriptsClient.listDirectory(SHARED_SCRIPTS_DIR_PATH, function (err, sharedScriptFiles) {
                if (err) {
                    if (err.statusCode === 404) {
                        return mantaSharedScriptsClient.safeMkdirp(SHARED_SCRIPTS_DIR_PATH, {}, function (error) {
                            callback(error, scriptsList);
                        });
                    }
                    return callback(err, scriptsList);
                }
                vasync.forEachParallel({
                    inputs: sharedScriptFiles,
                    func: function (sharedScript, callback) {
                        mantaSharedScriptsClient.getFileJson(path.join(SHARED_SCRIPTS_DIR_PATH, sharedScript.name), callback);
                    }
                }, function (errors, operations) {
                    if (errors) {
                        return callback(errors, scriptsList);
                    }
                    var sharedScripts = [].concat.apply([], operations.successes);
                    var scriptIds = scriptsList.map(function (script) {
                        return script.id;
                    });
                    sharedScripts = sharedScripts.filter(function (sharedScript) {
                        return scriptIds.indexOf(sharedScript.id) === -1;
                    });
                    scriptsList = [].concat(scriptsList, sharedScripts);
                    callback(error, scriptsList);
                });
            });
        });
    }

    server.onCall('SaveScript', {
        verify: function (data) {
            return data.id && data.name && data.body;
        },
        handler: function (call) {
            var scriptToSave = call.data;
            var client = mantaClient.createClient(call);
            getScriptsList(call, client, 'manta', function (error, list) {
                if (error) {
                    return call.done(error, true);
                }
                function findScriptIndex(scriptsList) {
                    for (var index = 0; index < scriptsList.length; index++) {
                        if (scriptsList[index].id === scriptToSave.id) {
                            return index;
                        }
                    }
                    return -1;
                }
                var targetScriptIndex = findScriptIndex(list);
                var oldSharedScript = {};
                var action = 'Updating';
                if (targetScriptIndex !== -1) {
                    oldSharedScript = utils.clone(list[targetScriptIndex]);
                    list[targetScriptIndex] = utils.clone(scriptToSave);
                } else {
                    scriptToSave.created = new Date();
                    list.push(scriptToSave);
                    action = 'Creating';
                }
                list = list.filter(function (script) {
                    return script.type !== SCRIPT_TYPES.remote;
                });
                call.log.info({script: scriptToSave}, action + ' user dtrace script');
                client.putFileContents(SCRIPTS_FILE_PATH, list, function (error) {
                    if (!error) {
                        if (scriptToSave.type === SCRIPT_TYPES.shared) {
                            var putSharedScriptsContent = function () {
                                var scriptFilePath = getScriptFilePath(call, scriptToSave.name);
                                scriptToSave.type = SCRIPT_TYPES.remote;
                                mantaSharedScriptsClient.safePutFileContents(scriptFilePath, scriptToSave, function (err) {
                                    call.done(err && err.message, true);
                                });
                            };
                            if (oldSharedScript.name) {
                                return deleteSharedScripts(call, [oldSharedScript], function (error) {
                                    if (error) {
                                        return call.done(err && err.message, true);
                                    }
                                    putSharedScriptsContent();
                                });
                            }
                            return putSharedScriptsContent();
                        } else if (oldSharedScript.type === SCRIPT_TYPES.shared) {
                            return deleteSharedScripts(call, [oldSharedScript], function (error) {
                                call.done(error && error.message, true);
                            });
                        }
                    }
                    call.done(error && error.message, true);
                });
            });
        }
    });

    function deleteSharedScripts(call, sharedScriptFiles, callback) {
        vasync.forEachParallel({
            inputs: sharedScriptFiles,
            func: function (sharedScript, callback) {
                mantaSharedScriptsClient.unlink(getScriptFilePath(call, sharedScript.name), function (error) {
                    if (error && error.statusCode !== 404) {
                        return callback(error.message, true);
                    }
                    callback();
                });
            }
        }, callback);
    }

    server.onCall('DeleteScripts', {
        verify: function (data) {
            return data.ids && data.ids.length;
        },
        handler: function (call) {
            var client = mantaClient.createClient(call);
            getScriptsList(call, client, 'manta', function (error, list) {
                if (error) {
                    return call.done(error, true);
                }
                var itemsToPreserve = list.filter(function (el) {
                    return call.data.ids.indexOf(el.id) === -1 && el.type !== SCRIPT_TYPES.remote;
                });
                client.putFileContents(SCRIPTS_FILE_PATH, itemsToPreserve, function (error) {
                    if (!error) {
                        var sharedScriptsToRemove = list.filter(function (el) {
                            return call.data.ids.indexOf(el.id) !== -1 && el.type === SCRIPT_TYPES.shared;
                        });
                        if (sharedScriptsToRemove.length) {
                            return deleteSharedScripts(call, sharedScriptsToRemove, function (error) {
                                call.done(error && error.message, true);
                            });
                        }
                    }
                    call.done(error && error.message, true);
                });
            });
        }
    });

    server.onCall('GetScripts', function (call) {
        getScriptsList(call, mantaClient.createClient(call), call.data.type, call.done.bind(call));
    });

    server.onCall('DtraceHostStatus', {
        verify: function (data) {
            return data.host && data.host.length;
        },
        handler: function (call) {
            var host = call.data.host;
            Dtrace.createClient(call, host, function (error, client) {
                if (error) {
                    return call.done(error);
                }
                // Will make a 5 attempts if host status is unreachable
                // When host just created, it needs some time to be available via ping
                var attemptsCount = 5;
                var pingHost = function () {
                    client.ping(function (err) {
                        if (err) {
                            if (attemptsCount > 0) {
                                attemptsCount -= 1;
                                return setTimeout(pingHost, 5000);
                            }
                            return call.done(null, 'unreachable');
                        }
                        call.done(null, 'completed');
                    });
                };
                pingHost();
            });
        }
    });

    server.onCall('DtraceListProcesses', {
        verify: function (data) {
            return data.host && data.host.length;
        },
        handler: function (call) {
            var host = call.data.host;
            Dtrace.createClient(call, host, function (error, client) {
                if (error) {
                    return call.done(error);
                }
                client.listProcesses(function (err, list) {
                    if (err) {
                        return call.done(err.toString());
                    }
                    call.done(null, list);
                });
            });
        }
    });
};

if (!config.features || config.features.dtrace !== 'disabled') {
    module.exports = dtrace;
}
