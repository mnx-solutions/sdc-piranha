'use strict';

var config = require('easy-config');

var dtrace = function execute(scope) {
    var Dtrace = scope.api('Dtrace');
    var mantaClient = scope.api('MantaClient');
    var server = scope.api('Server');
    var httpServer = scope.get('httpServer');
    var WebSocket = require('ws');

    var SCRIPTS_FILE_PATH = '~~/stor/.joyent/dtrace/scripts.json';
    var FLAMEGRAPH_PATH = '~~/stor/.joyent/dtrace/flameGraph';

    var uuid = require('../../static/vendor/uuid/uuid.js');

    var defaultScriptsList = [{name: 'all syscall'}, {name: 'all syscall for process', pid: true}];
    var DTRACE_PORT = 8000;

    function getScriptsList(call, client, type, callback) {
        if (type === 'default') {
            return callback(null, defaultScriptsList);
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
                scriptsList = [].concat(defaultScriptsList, scripts || []);
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
            var retries = 5;
            Dtrace.createClient(call, host, function (error, client) {
                if (error) {
                    return call.done(error);
                }
                var pingHost = function () {
                    client.ping(function (err) {
                        if (err) {
                            if (retries > 0) {
                                retries -= 1;
                                setTimeout(pingHost, 5000);
                                return;
                            }
                            return call.done(err);
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
                        return call.done(err);
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
                });
        }
    });

    server.onCall('DtraceClose', {
        verify: function (data) {
            return data.id && data.id.length && data.host && data.host.length;
        },
        handler: function (call) {
            Dtrace.createClient(call, call.data.host, function (error, client) {
                if (error) {
                    return call.done(error);
                }
                client.close({uuid: call.data.id}, function (err) {
                    call.done(err);
                });
            });
        }
    });

    server.onCall('DtraceExecute', {
        verify: function (data) {
            return data.host && data.host.length && data.dtraceObj && data.dtraceObj.length;
        },
        handler: function (call) {
            var id = uuid();
            var host = call.data.host;
            var path = '/main/dtrace/exec/' + id;
            httpServer.setMaxListeners(0);

            var wss = new WebSocket.Server({
                server: httpServer,
                path: path
            });

            Dtrace.createClient(call, host, function (error, client) {
                if (error) {
                    return call.done(error);
                }
                client.setup({uuid: id}, function (err) {
                    if (err) {
                        return call.done(err);
                    }
                    wss.once('connection', function (socket) {
                        var wsc = new WebSocket('ws://' + host + ':' + DTRACE_PORT + '/' + id);
                        var parsedDtraceObj;
                        try {
                            parsedDtraceObj = JSON.parse(call.data.dtraceObj);
                        } catch (ex) {
                            call.log.error('Error while JSON parsing dtrace object', ex);
                            closeSocket();
                            return;
                        }

                        var execType = parsedDtraceObj.type;

                        call.log.info('User executed %s', execType);
                        if (execType === 'heatmap') {
                            call.log.info({
                                scriptName: parsedDtraceObj.name,
                                scriptBody: parsedDtraceObj.message
                            }, 'Script executed');
                        }
                        wsc.on('ping', wsc.pong);

                        var pingClient = setInterval(function () {
                            if (socket.readyState === WebSocket.OPEN) {
                                socket.send('ping');
                            } else {
                                closeSocket();
                            }
                        }, 10 * 1000);

                        function closeSocket () {
                            clearInterval(pingClient);
                            wsc.close();
                            socket.close();
                        }

                        wsc.onmessage = function (event) {
                            if (socket.readyState === WebSocket.OPEN) {
                                socket.send(event.data);
                                if (execType === 'flamegraph') {
                                    wsc.send(call.data.dtraceObj);
                                }
                            }
                        };
                        wsc.onopen = function () {
                            if (wsc.readyState === WebSocket.OPEN) {
                                wsc.send(call.data.dtraceObj);
                            }
                        };
                        wsc.onerror = function (err) {
                            if (socket.readyState === WebSocket.OPEN) {
                                socket.send(err.data || 'Error');
                            }
                            closeSocket();
                        };
                        wsc.onclose = function () {
                            closeSocket();
                        };
                        socket.on('error', closeSocket);
                        // not working if using loadBalancer
                        socket.on('close', closeSocket);
                    });
                    call.done(null, {path: path, id: id});
                });
            });
        }
    });
};

if (!config.features || config.features.dtrace !== 'disabled') {
    module.exports = dtrace;
}
