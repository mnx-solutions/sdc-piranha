'use strict';
var config = require('easy-config');

var dtrace = function execute(scope) {
    var mantaClient = scope.api('MantaClient');
    var server = scope.api('Server');

    var filePath = '~~/stor/.joyent/dtrace/scripts.json';

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

};

if (!config.features || config.features.dtrace !== 'disabled') {
    module.exports = dtrace;
}