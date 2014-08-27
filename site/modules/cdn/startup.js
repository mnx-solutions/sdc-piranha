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

        var updateCdnConfig = function (call, config, callback) {
            var client = Manta.createClient(call);
            client.putFileContents(cdnConfigPath, JSON.stringify(config), function (err) {
                if (err) {
                    callback(err, null);
                    return;
                }
                call.done();
            });
        };

        server.onCall('GetApiKey', {
            handler: function (call) {
                getCdnConfig(call, function (error, result) {
                    if (error) {
                        call.done(error);
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
                        call.done(error.message || error, null);
                    } else {
                        configuration.service = service;

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
                                },
                                function header(callback) {
                                    cdn.createHeader(call, callback);
                                }
                            ]
                        }, function (err, results) {
                            if (err) {
                                cdn.deleteService(call, function () {
                                    call.done(err.message || err, null);
                                });
                            } else {
                                results.operations.forEach(function (res) {
                                    configuration[res.funcname] = res.result;
                                });
                                getCdnConfig(call, function (err, config) {
                                    if (err) {
                                        call.done(err, configuration);
                                    } else {
                                        var confToManta = {
                                            name: call.data.name,
                                            service_id: call.data.service_id,
                                            directory: call.data.directory,
                                            domain: call.data.domain,
                                            domainActive: false
                                        };
                                        if (!config.configurations) {
                                            config.configurations = [];
                                        }
                                        config.configurations.push(confToManta);
                                        updateCdnConfig(call, config, function (err) {
                                            if (err) {
                                                call.done(err, configuration);
                                            }
                                            call.done(null, configuration);
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });

        server.onCall('ListServices', {
            handler: function (call) {
                cdn.listServices(call, function (error, services) {
                    if (error) {
                        call.done(error, null);
                    } else {
                        getCdnConfig(call, function (err, data) {
                            var result = [];
                            if (data.configurations) {
                                result = data.configurations;
                                var cache = [];
                                result.forEach(function (configuration) {
                                    services.some(function (service) {
                                        if (service.id === configuration.service_id) {
                                            for (var key in service) {
                                                if (!configuration[key]) {
                                                    configuration[key] = service[key];
                                                }
                                            }
                                            cache.push(configuration);
                                            return true;
                                        }
                                    });
                                });
                                if (result > cache) {
                                    data.configurations = cache;
                                    updateCdnConfig(call, data, function (updateError) {
                                        if (updateError) {
                                            call.done(updateError);
                                        } else {
                                            call.done(null, result);
                                        }
                                    });
                                } else {
                                    call.done(null, result);
                                }
                            } else {
                                call.done(null, result);
                            }
                        });
                    }
                });
            }
        });

        server.onCall('DeleteConfiguration', {
            handler: function (call) {
                var funcs = [];
                call.data.ids.forEach(function (id) {
                    funcs.push(function (callback) {
                        call.data.service_id = id;
                        cdn.deleteService(call, callback);
                    });
                });
                vasync.parallel({
                    'funcs': funcs
                }, function (err) {
                    if (err) {
                        call.done(err.message || err, null);
                    } else {
                        getCdnConfig(call, function (error, result) {
                            if (error) {
                                call.done(error);
                            } else {
                                call.data.ids.forEach(function (id) {
                                    result.configurations.some(function (config) {
                                        if (config.service_id === id) {
                                            result.configurations.splice(result.configurations.indexOf(config), 1);
                                            return true;
                                        }
                                    });
                                });
                                updateCdnConfig(call, result, call.done);
                            }
                        });
                    }
                });
            }
        });
    };

    module.exports = cdnApi;
}