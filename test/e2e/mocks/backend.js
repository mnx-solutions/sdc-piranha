var fs = require('fs');

function serializeFunction (func, params) {
    var template = func.toString();

    if (params && Object.keys(params).length > 0) {
        for (var key in params) {
            if (typeof(params[key]) === 'object') {
                template = template.replace('$$' + key, JSON.stringify(params[key]));
            } else {
                template = template.replace('$$' + key, params[key]);
            }
        }
    }

    return '(' + template + ')();';
}

var handlers = {
    calls: [],
    requests: []
};

var backend = module.exports =  {
    clientHandlers: function handlers () {
        var module = angular.module('httpBackendMock', [ 'JoyentPortal', 'ngMockE2E', 'ngCookies' ]);

        module.value('handlers', $$handlers);
        module.run(function ($httpBackend, handlers, stats) {
            var sessions = {};

            // Handle service calls
            if (angular.isArray(handlers.calls)) {
                var createPattern = new RegExp('^server\\/call\\?tab=(.*)$', 'i');
                var pollPattern = new RegExp('^server\\/call\\?rnd=(.*)\\&tab=(.*)$', 'i');

                for (var i = 0, c = handlers.calls.length; i < c; i++) {
                    var call = handlers.calls[i];

                    // Registration
                    (function wrapPOSTHandler (call) {
                        $httpBackend.when(
                                'POST',
                                createPattern,
                                new RegExp('"name"\\:"' + call.name, 'ig')
                            )
                            .respond(function respondCallCreate (method, url, data, headers) {
                                var sessionId = url.match(createPattern)[1];
                                var payload = {};

                                try {
                                    payload = JSON.parse(data);
                                } catch (err) {
                                    // Ignore
                                }

                                if (!sessions.hasOwnProperty(sessionId)) {
                                    sessions[sessionId] = {};
                                }

                                sessions[sessionId][payload.id] = {
                                    id: payload.id,
                                    params: payload.data,
                                    call: call,
                                    state: 0
                                };

                                stats.track('start', call.name, payload.data);
                                return [ 202, null, null ];
                            });
                    })(call);
                }

                // Polling
                $httpBackend.when(
                        'GET',
                        pollPattern
                    )
                    .respond(function respondCallPoll (method, url, data, headers) {
                        var pollMatches = url.match(pollPattern);
                        var sessionId = pollMatches[2];

                        var session = sessions[sessionId];
                        var results = [];

                        function formatResult (data, type, status) {
                            if (typeof(status) === 'undefined') {
                                status = 'finished';
                            }

                            var isChunked = (type === 'chunked') ? true : false;
                            var isError = (type === 'error') ? true : false;

                            return {
                                id: context.id,
                                name: context.call.name,
                                finished: true,
                                chunked: isChunked,
                                error: isError ? data : null,
                                step: data.step ? data.step : null,
                                status: status,
                                result: !isError ? data : {}
                            };
                        }

                        for (var name in session) {
                            var context = session[name];
                            var type = 'chunked';
                            var status = 'finished';
                            var data = null;

                            if (context.call.response instanceof Array) {
                                // Chunked responses
                                if (context.call.response.length > 1) {
                                    // Final step
                                    if ((context.state + 1) >= context.call.response.length) {
                                        data = context.call.response[context.state++];
                                        status = 'finished';
                                    } else { // Update
                                        data = context.call.response[context.state++];
                                        status = 'updated';
                                    }

                                    // Error
                                    if (data.type && data.type === 'error') {
                                        type = 'error';
                                        status = 'finished';
                                        data = context.call.response.message;
                                    }

                                    results.push(formatResult(data, type, status));
                                } else { // Return array
                                    status = 'finished';
                                    results.push(formatResult(context.call.response[0]));
                                }
                            } else if (context.call.response.type && context.call.response.type === 'error') {
                                results.push(formatResult(context.call.response.message, 'error'));
                            } else {
                                results.push(formatResult(context.call.response));
                            }

                            if (status === 'finished') {
                                stats.track('finish', context.call.name);
                                delete sessions[sessionId][context.id];
                            } else {
                                stats.track('progress', context.call.name);
                            }
                        }

                        if (results.length > 0) {
                            return [ 200, {
                                results: results
                            }, headers ];
                        } else {
                            return [ 202, {}, headers ];
                        }
                    });
            }

            // Handle service calls
            if (angular.isArray(handlers.requests)) {
                for (var i = 0, c = handlers.requests.length; i < c; i++) {
                    var request = handlers.requests[i];

                    switch (request.method) {
                        case 'GET':
                            $httpBackend.when(request.method, request.url).respond(function respondRequest (method, url, data, headers) {
                                stats.track('start', method + ':' + url);
                                stats.track('finish', method + ':' + url);
                                return [ 200, request.data, headers ];
                            });
                            break;

                        case 'POST':
                            $httpBackend.when(request.method, request.url, request.body, request.headers).respond(function respondRequest (method, url, data, headers) {
                                stats.track('start', method + ':' + url);
                                stats.track('finish', method + ':' + url);
                                return [ 200, request.data, headers ];
                            });
                            break;
                    }
                }
            }

            $httpBackend.whenGET(/^(.*)$/i).passThrough();
            $httpBackend.whenPOST(/^(.*)$/i).passThrough();
            $httpBackend.whenJSONP(/^(.*)$/i).passThrough();
        });

        module.service('stats', [ '$cookieStore', function stats ($cookieStore) {
            var service = {
                _getStats: function getStats () {
                    var stats = {};

                    try {
                        stats = JSON.parse(window.localStorage.stats);
                    } catch (err) {

                    }

                    return stats;
                },

                _setStats: function setStats (stats) {
                    window.localStorage.stats = JSON.stringify(stats);
                    return this._getStats();
                },

                _count: function countActions (data) {
                    var actions = { start: 0, progress: 0, finish: 0 };

                    for (var i = 0, c = data.length; i < c; i++) {
                        if (actions.hasOwnProperty(data[i].action)) {
                            actions[data[i].action]++;
                        }
                    }

                    return actions;
                },

                _filter: function filterStats (data, params) {
                    var result = [];

                    function compare (obj1, obj2) {
                        var match = true;

                        for (var key in obj2) {

                            if (obj1[key]) {
                                if (obj1[key] === obj2[key]) {
                                    match = true;
                                } else {
                                    match = false;
                                }
                            }
                        }

                        return match;
                    }

                    for (var i = 0, c = data.length; i < c; i++) {
                        if (data[i].hasOwnProperty('params')) {
                            if (compare(params, data[i].params)) {
                                result.push(data[i]);
                            }
                        }
                    }

                    return result;
                },

                setup: function setup () {
                    if (!window.localStorage.stats) {
                        window.localStorage.stats = {};
                    }
                },

                query: function query (key, opts) {
                    var stats = this._getStats();
                    var data = null;

                    try {
                        opts = JSON.parse(opts);
                    } catch (err) {

                    }

                    if (!opts.hasOwnProperty('rule')) {
                        throw new Error('Invalid options for key "' + key + '"');
                    }

                    if (stats.hasOwnProperty(key)) {
                        data = stats[key];
                    } else {
                        throw new Error('Invalid stats key "' + key + '"');
                    }

                    switch (opts.rule) {
                        case 'call-count':
                            var loose = false;
                            var times = 1;

                            if (opts.hasOwnProperty('loose')) {
                                loose = opts.loose;
                            }

                            if (opts.hasOwnProperty('value')) {
                                times = parseInt(opts.value) || 1;
                            }

                            var counts = this._count(data);
                            if (counts.start >= counts.finish) {
                                if (loose) {
                                    return  counts.start >= times;
                                } else {
                                    return (counts.start === counts.finish
                                        && counts.start === times);
                                }
                            } else {
                                return false;
                            }
                            break;

                        case 'call-params':
                            if (!opts.hasOwnProperty('value')) {
                                throw new Error('Invalid value for key "' + key + '"');
                            }

                            return this._filter(data, opts.value).length > 0;
                            break;

                        case 'pending':
                            var counts = this._count(data);
                            if (counts.start === counts.finish) {
                                return false;
                            } else {
                                return true;
                            }
                            break;

                        case 'clear':
                            stats[key] = [];
                            this._setStats(stats);
                            break;

                        case 'debug':
                            return {
                                counts: this._count(data),
                                data: data
                            };
                            break;
                    }

                    return true;
                },

                track: function track (action, name, params) {
                    var stats = this._getStats();
                    var key = null;

                    if (typeof(name) !== 'string') {
                        if (name.url && name.method) {
                            key = name.method + ':' + name.url;
                        }
                    } else {
                        key = name;
                    }

                    if (!stats.hasOwnProperty(key)) {
                        stats[key] = [];
                    }

                    stats[key].push({
                        action: action,
                        params: params
                    });

                    this._setStats(stats);
                }
            };

            service.setup();
            return service;
        }]);
    },

    track: function track (protractor) {
        function toKey (opts) {
            switch (opts.type) {
                case 'request':
                    return opts.props.method + ':' + opts.props.url;
                    break;

                default:
                case 'call':
                    return opts.props.name;
                    break;
            }
        }

        function query (key, opts) {
            var promise = protractor.executeScript(function (key, opts) {
                var $injector = angular.injector([ 'httpBackendMock' ]);
                var stats = $injector.get('stats');

                return stats.query(key, opts);
            }, key, JSON.stringify(opts));

            /*
            promise.then(function (value) {
                if (opts.rule === 'call-params') {
                    console.log(value);
                }
            });
            */

            return promise;
        }

        function wrap (opts) {
            return {
                debug: function () {
                    return query(toKey(opts), {
                        rule: 'debug'
                    });
                },

                clear: function () {
                    return query(toKey(opts), {
                        rule: 'clear'
                    });
                },

                pending: function () {
                    return query(toKey(opts), {
                        rule: 'pending'
                    });
                },

                calledOnce: function (loose) {
                    return query(toKey(opts), {
                        rule: 'call-count',
                        value: 1,
                        loose: loose
                    });
                },

                calledTwice: function (loose) {
                    return query(toKey(opts), {
                        rule: 'call-count',
                        value: 2,
                        loose: loose
                    });
                },

                calledTimes: function (times, loose) {
                    return query(toKey(opts), {
                        rule: 'call-count',
                        value: times,
                        loose: loose
                    });
                },

                calledWithParams: function (params) {
                    return query(toKey(opts), {
                        rule: 'call-params',
                        value: params
                    });
                },
            }
        }

        return {
            request: function request (method, url) {
                return wrap({
                    type: 'request',
                    props: {
                        method: method,
                        url: url
                    }
                });
            },

            call: function call (name) {
                return wrap({
                    type: 'call',
                    props: {
                        name: name
                    }
                });
            }
        };
    },

    stub: function stub (protractor) {
        var context = {
            call: function call (name, response) {
                handlers.calls.push({
                    name: name,
                    response: response
                });

                return context;
            },

            request: function request (method, url, body, headers, data) {
                handlers.requests.push({
                    method: method,
                    url: url,
                    body: body,
                    headers: headers,
                    data: data
                });

                return context;
            },

            flush: function endMockChain () {
                protractor.addMockModule('httpBackendMock', serializeFunction(backend.clientHandlers, {
                    handlers: handlers
                }));
                return context;
            }
        };

        return context;
    },

    data: function loadData (name) {
        var fileName = __dirname + '/data/' + name + '.json';
        if (fs.existsSync(fileName)) {
            return require(fileName);
        } else {
            return {};
        }
    }
};