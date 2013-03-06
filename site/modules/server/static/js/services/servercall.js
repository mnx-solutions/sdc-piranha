'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('serverCall', ["$http", "$rootScope", "$timeout", function ($http, $rootScope, $timeout) {
        var calls = {};

        // polling function, polls for rpc-call answers
        (function () {
            $timeout(function myFunction() {
                // if we have unanswered calls
                if (calls.keys.length != 0) {
                    // get call results
                    $http.get('/server/call').success(function (resultList) {
                        resultList.forEach(function (result) {
                            var _call = calls[result.id];
                            if (!_call) {
                                return;
                            }

                            _call.listener(result.error, result.result)
                            delete calls[result.id];
                        });
                    });
                }

                $timeout(myFunction, 1000);
            }, 1000);
        })();

        // serverside call
        return function (name, data, listener) {
            var _call = {
                id: uuid.v4(),
                name: name,
                listener: listener
            }

            $http.post('/server/call', {name: name, data: data}
            ).success(function () {
                    calls[_call.id] = call;
                }
            ).error(function () {
                    listener("call failed");
                });
        }
    }]);
}(window.JP.getModule('Events')));
