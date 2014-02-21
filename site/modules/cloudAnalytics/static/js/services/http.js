'use strict';
/**
 * User: Vladimir Bulyga <zero@ccxx.cc>
 * Project: piranha
 * Date: 25.02.14 18:33
 */
(function (app, ng) {
    app.service('ca.http', [
        '$http',
        function ($http) {
            var Config = {
                url: ''
            };
            function createUrl(map, params) {
                return map.replace(/(\/:[^\/]+)/g, function (a, s) {
                    var key = s.substr(2);
                    if (params.hasOwnProperty(key)) {
                        var value = params[key];
                        delete params[key];
                        return '/' + value;
                    }
                    return '';
                });
            }

            function createParams(map, data) {
                var params = {},
                    keys = Object.getOwnPropertyNames(map),
                    length = keys.length,
                    k;

                for (k = 0; k < length; k += 1) {
                    var key = keys[k],
                        dataKey = map[key],
                        value = dataKey;

                    if (dataKey[0] === '@') {
                        value = data[dataKey.substr(1)];
                    } else if (dataKey[0] === '=') {
                        dataKey = key;
                        value = data[dataKey];
                    }

                    if (value !== undefined) {
                        params[key] = value;
                    }
                }
                return params;
            }

            function createMethod(config) {
                return function (params, data, callback) {
                    if (!callback) {
                        callback = data;
                        data = params;
                    }
                    // this is check after checking
                    if (!callback) {
                        callback = data;
                        data = params = {};
                    }
                    params = createParams(angular.extend({}, config.params), params);
                    var url = createUrl(Config.url, params),
                        options = {
                            method: config.method,
                            url: url,
                            params: params
                        };
                    if (config.target) {
                        if (config.target === 'self') {
                            location.href = options.url;
                            return undefined;
                        }
                    }
                    if (config.method === 'POST') {
                        options.data = data;
                    }
                    if (config.withCredentials) {
                        options.withCredentials = true;
                    }
                    if (config.responseType) {
                        options.responseType = config.responseType;
                    }
                    if (config.timeout) {
                        options.timeout = config.timeout;
                    }
                    function cb(status) {
                        return function () {
                            var args = [].slice.call(arguments),
                                error = null;
                            if (status === 'error') {
                                error = new Error(args[1]);
                            }
                            args.unshift(error);
                            callback.apply(this, args);
                        };
                    }

                    return $http(options)
                        .success(cb('success'))
                        .error(cb('error'));
                };
            }

            function createService(methods) {
                var service = {};
                var method;
                for (method in methods) {
                    if (methods.hasOwnProperty(method)) {
                        service[method] = createMethod(methods[method]);
                    }
                }
                return service;
            }

            return {
                createMethod: createMethod,
                config: function (config) {
                    angular.extend(Config, config);
                },
                createService: createService
            };
        }
    ]);
})(window.JP.getModule('cloudAnalytics'), angular);

