'use strict';

(function (angular, app) {
    app.service('http', [
        '$http',
        function ($http) {
            var Config = {
                url: ''
            };
            var xhRequests = {};
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
                    var url = createUrl(config.url || Config.url, params),
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
                    if (config.headers) {
                        options.headers = config.headers;
                    }
                    if (config.transformRequest) {
                        options.transformRequest = config.transformRequest;
                    }
                    function cb(status) {
                        return function () {
                            var args = [].slice.call(arguments),
                                error = null;
                            if (status === 'error') {
                                error = args.splice(0, 1)[0];
                            }
                            args.unshift(error);
                            callback.apply(this, args);
                        };
                    }

                    return $http(options)
                        .success(function (response) {
                            var status = response.error ? 'error' : 'success';
                            cb(status)(response);
                        })
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

            function uploadFiles(url, path, files, cb) {
                var data = new FormData();
                var metadata = {path: path, files: {}};
                var fileIndex;

                files.forEach(function (file) {
                    metadata.files[file.name] = file.size;
                });
                data.append('metadata', JSON.stringify(metadata));
                // we have two cycles going over files cause metadata must go first (before files payload)
                files.forEach(function (file) {
                    data.append('uploadInput', file);
                });

                var shortNames = files.map(function (file) { return file.name; }).join(', ');
                if (shortNames.length > 100) {
                    shortNames = shortNames.substr(0, 100) + '...';
                }

                var chunkId = Math.random();

                var xhr = new XMLHttpRequest();
                xhRequests[chunkId] = xhr;
                xhr.upload.addEventListener('progress', function (e) {
                    if (e.lengthComputable) {
                        var progress = {
                            loaded: e.loaded,
                            total: e.total,
                            id: chunkId,
                            name: shortNames,
                            path: path
                        };
                        cb(null, {status: 'progress', progress: progress, id: chunkId});
                    }
                }, false);
                xhr.addEventListener('load', function () {
                    if (xhr.status === 200) {
                        cb(null, {status: 'success', id: chunkId, path: path});
                    } else {
                        var message = 'Failed to upload ' + shortNames + ': ' + xhr.responseText || xhr.statusText;
                        cb(null, {status: 'error', message: message, id: chunkId, path: path});
                    }
                }, false);
                xhr.addEventListener('abort', function () {
                    cb(null, {status: 'success', id: chunkId, path: path});
                }, false);
                xhr.open('post', url, true);
                xhr.send(data);
            }

            function abortUploadFiles(id) {
                var xhr = xhRequests[id];
                setTimeout(function () {
                    xhr.abort();
                    delete xhRequests[id];
                });
            }

            return {
                createMethod: createMethod,
                config: function (config) {
                    angular.extend(Config, config);
                },
                createService: createService,
                uploadFiles: uploadFiles,
                abortUploadFiles: abortUploadFiles
            };
        }
    ]);
})(window.angular, window.JP.main);
