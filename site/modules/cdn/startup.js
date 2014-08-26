'use strict';
var config = require('easy-config');

if (!config.features || config.features.cdn !== 'disabled') {

    var cdnApi = function execute(scope) {
        var Manta = scope.api('MantaClient');
        var server = scope.api('Server');

        var cdnConfigPath = '~~/stor/.joyent/portal/cdn/Fastly/config.json';

        var getCdnConfig = function (call, callback) {
            var client = Manta.createClient(call);
            client.getFileContents(cdnConfigPath, 'utf8', function (err, config) {
                if (err) {
                    callback(err, config);
                    return;
                }
                callback(null, JSON.parse(config));
            });

        };

        server.onCall('GetApiKey', {
            handler: function (call) {
                getCdnConfig(call, function (error, result) {
                    if (error) {
                        call(error);
                        return;
                    }
                    if (result && result.key) {
                        result = result.key;
                    }
                    call.done(null, result);
                });
            }
        });

        server.onCall('AddApiKey', {
            handler: function (call) {
                var client = Manta.createClient(call);
                var putConfig = function (callObj, mantaClient) {
                    return mantaClient.putFileContents(cdnConfigPath, JSON.stringify(callObj.data), function (error) {
                        if (error && error.statusCode === 404) {
                            mantaClient.mkdirp(cdnConfigPath.substring(0, cdnConfigPath.lastIndexOf('/')), function (err) {
                                if (err) {
                                    call.done(error);
                                } else {
                                    putConfig(callObj, mantaClient);
                                }
                            });
                        } else {
                            call.done(error);
                        }
                    });
                };
                putConfig(call, client);
            }
        });

        server.onCall('UpdateApiKey', {
            handler: function (call) {
                getCdnConfig(call, function (error, config) {
                    if (error) {
                        call.done(error, null);
                        return;
                    }
                    config.key = call.data.key;
                    var client = Manta.createClient(call);
                    client.putFileContents(cdnConfigPath, JSON.stringify(config), function (err) {
                        if (error) {
                            call.done(err);
                            return;
                        }
                        call.done();
                    });
                });
            }
        });
    };

    module.exports = cdnApi;
}