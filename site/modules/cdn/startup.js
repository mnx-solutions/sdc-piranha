'use strict';
var config = require('easy-config');
var vasync = require('vasync');

if (!config.features || config.features.cdn !== 'disabled') {

    var cdnApi = function execute(scope) {
        var Manta = scope.api('MantaClient');
        var cdn = scope.api('CdnClient');
        var server = scope.api('Server');

        var cdnConfigPath = '~~/stor/.joyent/portal/cdn/Fastly/config.json';
        var mantaDomain = 'us-east.manta.joyent.com';

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

        server.onCall('CreateConfiguration', {
            handler: function (call) {
                var configuration = {};
                cdn.createService(call, function (error, service) {
                    if (error) {
                        call.done(error, null);
                    } else {
                        configuration.service = JSON.parse(service);

                        call.data.service_id = configuration.service.id;
                        call.data.version = 1;

                        vasync.parallel({
                            'funcs': [
                                function domain(callback) {
                                    cdn.createDomain(call, callback);
                                },
                                function backend(callback) {
                                    call.data.backend = mantaDomain;
                                    cdn.createBackend(call, callback);
                                }
                            ]
                        }, function (err, results) {
                            if (err) {
                                call.done(err, null);
                            } else {
                                results.operations.forEach(function (res) {
                                    configuration[res.funcname] = JSON.parse(res.result);
                                });
                                call.done(null, configuration);
                            }
                        });
                    }
                });
            }
        });
    };

    module.exports = cdnApi;
}