'use strict';

(function (app) {
    // XXX for debug
    var callHistory = [];

    var calls = {};

    // give reference of internals for debuggin purposes
    app.factory('serverCallInternals', function () {
        return function () {
            return {calls: calls, history: callHistory};
        }
    });

    function handleResults(data) {

        if (!data) {
            return;
        }


        data.progress.forEach(function (result) {
            var _call = calls[result.id];
            if (!_call || !_call.progress) {
                return;
            }

            _call.progress(result.result);
        });

        data.results.forEach(function (result) {
            var _call = calls[result.id];
            if (!_call) {
                return;
            }

            _call.listener(result.error, result.result);

            // XXX debug
            callHistory.push({name: _call.name, id: _call.id, failed: !result.error, startTime: _call.startTime, endTime: new Date().getTime()
            });
            delete calls[result.id];
        });
    }

    // I provide information about the current route request.
    app.factory('serverCall', ["$http", "$rootScope", "$timeout", function ($http, $rootScope, $timeout) {

        var polling = false;

        // polling function, polls for rpc-call answers
        function pollResults() {
            // if we have unanswered calls
            if (Object.keys(calls).length != 0) {
                // TODO remove timed out calls.
                polling = true;
                // get call results
                $http({timeout: 5000, method: 'get', url: '/server/call'})
                    .success(function (data) {
                        handleResults(data);
                        $timeout(pollResults, 100);
                    })
                    .error(function () {
                        $timeout(pollResults, 1000);
                    });
            } else {
                polling = false;
            }
        };

        pollResults();

        // make a serverside rpc call
        return function (name, data, listener, progress) {
            var _call = {
                id: uuid.v4(),
                name: name,
                listener: listener,
                progress: progress,
                startTime: new Date().getTime()
            }

            $http.post('/server/call', {name: name, data: data, id: _call.id}
            ).success(function (resultList) {
                    // store call if successful
                    calls[_call.id] = _call;
                    // handle direct results
                    // handleResults(resultList);
                    if (!polling) {
                        pollResults();
                    };
                }
            ).error(function () {
                    listener("call failed");
                });
        }
    }]);
}(window.JP.getModule('Server')));
