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
        var module = angular.module('httpBackendMock', [ 'JoyentPortal', 'ngMockE2E' ]);

        module.value('handlers', $$handlers);
        module.run(function ($httpBackend, handlers) {
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
                                delete sessions[sessionId][context.id];
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
                    $httpBackend.when(request.method, request.url, request.body, request.headers).respond(request.data);
                }
            }

            $httpBackend.whenGET(/^(.*)$/i).passThrough();
            $httpBackend.whenPOST(/^(.*)$/i).passThrough();
            $httpBackend.whenJSONP(/^(.*)$/i).passThrough();
        });
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