'use strict';
var config = require('easy-config');
var vasync = require('vasync');

var cdnApi = function execute(log, config) {
    var Manta = require('../storage').MantaClient;
    var cdn = require('./').CdnClient;
    var server = require('../server').Server;

    var CDN_CONFIG_PATH = '~~/stor/.joyent/portal/cdn/Fastly/config.json';

    var getCdnConfig = function (call, callback) {
        var message = 'Manta service is not available.';
        if (!config.manta || !config.manta.url) {
            callback(message);
            return;
        }
        var client = Manta.createClient(call);
        client.getFileContents(CDN_CONFIG_PATH, 'utf8', function (err, config) {
            if (err) {
                if (err.message && err.message.indexOf('getaddrinfo ENOTFOUND') !== -1) {
                    err = message;
                } else if (err.statusCode === 404) {
                    err = null;
                }
            } else {
                try {
                    config = JSON.parse(config);
                } catch (parseError) {
                    err = new SyntaxError();
                    err.message = 'Something\'s wrong with your CDN config file. Please check and try again.';
                    err.name = 'JsonParseError';
                    err.stack = parseError.stack;
                }
            }
            return callback(err, config);
        });
    };

    var updateCdnConfig = function (call, config, callback) {
        var client = Manta.createClient(call);
        client.putFileContents(CDN_CONFIG_PATH, JSON.stringify(config), function (err) {
            if (err) {
                callback(err, null);
                return;
            }
            callback();
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
            cdn.listServices(call, function (error) {
                if (error) {
                    call.done(error, null);
                    return;
                }
                var client = Manta.createClient(call);
                var putConfig = function (callObj, mantaClient) {
                    return mantaClient.putFileContents(CDN_CONFIG_PATH, JSON.stringify(callObj.data), function (error) {
                        if (error && error.statusCode === 404) {
                            mantaClient.mkdirp(CDN_CONFIG_PATH.substring(0, CDN_CONFIG_PATH.lastIndexOf('/')), function (err) {
                                if (err) {
                                    call.done(err);
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
            });
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
                client.putFileContents(CDN_CONFIG_PATH, JSON.stringify(config), function (err) {
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

                    call.data['service_id'] = configuration.service.id;
                    call.data.version = 1;

                    vasync.parallel({
                        'funcs': [
                            function domain(callback) {
                                cdn.createDomain(call, callback);
                            },
                            function backend(callback) {
                                call.data.backend = config.manta.url.replace('https://', '');
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
                                        'service_id': call.data['service_id'],
                                        directory: call.data.directory,
                                        domain: call.data.domain
                                    };
                                    if (!config.configurations) {
                                        config.configurations = [];
                                    }
                                    config.configurations.push(confToManta);
                                    updateCdnConfig(call, config, function (err) {
                                        call.done(err, configuration);
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
                                    if (service.id === configuration['service_id']) {
                                        for (var key in service) {
                                            if (configuration[key]) {
                                                configuration[key] = service[key];
                                            }
                                        }
                                        cache.push(configuration);
                                        return true;
                                    }
                                });
                            });
                            if (result.length > cache.length) {
                                data.configurations = cache;
                                updateCdnConfig(call, data, function (updateError) {
                                    call.done(updateError, data.configurations)
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
            var funcs = call.data.ids.map(function (id) {
                return function (callback) {
                    call.data['service_id'] = id;
                    cdn.deleteService(call, callback);
                };
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
                                    if (config['service_id'] === id) {
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

    server.onCall('DomainStatus', {
        handler: function (call) {
            call.data.version = 1;
            var result = false;
            cdn.domainStatus(call, function (err, data) {
                if (err) {
                    call.done(err);
                } else {
                    result = data.some(function (domain) {
                        if (domain[0].name === call.data.domain) {
                            return domain[2];
                        }
                    })
                }
                call.done(null, result);
            });
        }
    });
};
if (!config.features || config.features.cdn !== 'disabled') {
    module.exports = cdnApi;
}
