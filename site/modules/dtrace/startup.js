'use strict';

var config = require('easy-config');

var dtrace = function execute() {
    var Dtrace = require('../dtrace').Dtrace;
    var mantaClient = require('../storage').MantaClient;
    var server = require('../server').Server;
    var WebSocket = require('ws');

    var SCRIPTS_FILE_PATH = '~~/stor/.joyent/devtools/scripts.json';
    var FLAMEGRAPH_PATH = '~~/stor/.joyent/devtools/flameGraph';

    var uuid = require('../../static/vendor/uuid/uuid.js');
    var DTRACE_PORT = 8000;
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
            callback(error, scriptsList);
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
                var targetScript = list.find(function (script) {
                    return script.id === scriptToSave.id;
                });
                var action = 'Updating';
                if (targetScript) {
                    targetScript.name = scriptToSave.name;
                    targetScript.body = scriptToSave.body;
                } else {
                    scriptToSave.created = new Date();
                    list.push(scriptToSave);
                    action = 'Creating';
                }
                call.log.info({script: scriptToSave}, action + ' user dtrace script');
                client.putFileContents(SCRIPTS_FILE_PATH, list, function (error) {
                    call.done(error && error.message, true);
                });
            });
        }
    });

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
                    return call.data.ids.indexOf(el.id) === -1;
                });
                client.putFileContents(SCRIPTS_FILE_PATH, itemsToPreserve, function (error) {
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
                var pingHost = function () {
                    client.ping(function (err) {
                        if (err) {
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

    server.onCall('SaveFlameGraph', {
        verify: function (data) {
            return data.id && data.svg;
        },
        handler: function (call) {
            var client = mantaClient.createClient(call);
            client.putFileContents(FLAMEGRAPH_PATH + '/' + call.data.id + '/' + new Date().toISOString() + '.svg',
                call.data.svg,
                function (err) {
                    if (err) {
                        return call.done(err);
                    }
                    call.done();
                }
            );
        }
    });
};

if (!config.features || config.features.dtrace !== 'disabled') {
    module.exports = dtrace;
}
