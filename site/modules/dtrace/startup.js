'use strict';
var config = require('easy-config');

var dtrace = function execute(scope) {
    var Dtrace = scope.api('Dtrace');
    var mantaClient = scope.api('MantaClient');
    var server = scope.api('Server');

    var filePath = '~~/stor/.joyent/dtrace/scripts.json';
    var flameGraphPath = '~~/stor/.joyent/dtrace/flameGraph';

    function getScriptsList (call, client, callback) {
        client.getFileJson(filePath, function (error, scripts) {
            if (error) {
                call.log.warn('DTrace scripts list is corrupted');
                return callback(error, scripts);
            }
            callback(null, scripts);
        });
    }

    server.onCall('SaveScript', {
        verify: function (data) {
            return data.id && data.name && data.body;
        },
        handler: function (call) {
            var scriptToSave = call.data;
            var client = mantaClient.createClient(call);
            getScriptsList(call, client, function (error, list) {
                if (error) {
                    return call.done(error, true);
                }
                var targetScript = list.find(function (script) {
                    return script.id === scriptToSave.id;
                });
                if (targetScript) {
                    targetScript.name = scriptToSave.name;
                    targetScript.body = scriptToSave.body;
                } else {
                    scriptToSave.created = new Date();
                    list.push(scriptToSave);
                }
                client.putFileContents(filePath, list, function (error) {
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
            getScriptsList(call, client, function (error, list) {
                if (error) {
                    return call.done(error, true);
                }
                var itemsToPreserve = list.filter(function (el) {
                    return call.data.ids.indexOf(el.id) === - 1;
                });
                client.putFileContents(filePath, itemsToPreserve, function (error) {
                    call.done(error && error.message, true);
                });
            });
        }
    });

    server.onCall('GetScripts', function (call) {
        getScriptsList(call, mantaClient.createClient(call), call.done.bind(call));
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
            client.putFileContents(flameGraphPath + '/' + call.data.id + '/' + new Date().toISOString() + '.svg',
                call.data.svg,
                function (err) {
                    if (err) {
                        return call.done(err);
                    } 
                    call.done();
            });
        }
    });

};

if (!config.features || config.features.dtrace !== 'disabled') {
    module.exports = dtrace;
}