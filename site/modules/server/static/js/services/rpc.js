'use strict';

(function (app) {
    // XXX for debug
    var callHistory = [];

    var calls = {};

    // give reference of internals for debuggin purposes
    app.factory('serverCallInternals', function(){
        return function(){
            return {calls:calls, history: callHistory};
        }
    });

    function handleResults(resultList){
        resultList.forEach(function (result) {
            var _call = calls[result.id];
            if (!_call) {
                return;
            }

            _call.listener(result.error, result.result);

            // XXX debug
            callHistory.push({name: _call.name, id: _call.id, failed: !result.error});
            delete calls[result.id];
        });
    }

    // I provide information about the current route request.
    app.factory('serverCall', ["$http", "$rootScope", "$timeout", function ($http, $rootScope, $timeout) {

        // polling function, polls for rpc-call answers
        (function () {
            $timeout(function myFunction() {

                // if we have unanswered calls
                if (Object.keys(calls).length != 0) {

                    // TODO remove timed out calls.

                    // get call results
                    $http.get('/server/call').success(handleResults);
                }

                $timeout(myFunction, 1000);
            }, 1000);
        })();

        // make a serverside rpc call
        return function (name, data, listener) {
            var _call = {
                id: uuid.v4(),
                name: name,
                listener: listener
            }

            $http.post('/server/call', {name: name, data: data, id:_call.id}
            ).success(function (resultList) {
                    // store call if successful
                    calls[_call.id] = _call;
                    // handle direct results
                    handleResults(resultList);
                }
            ).error(function () {
                    listener("call failed");
            });
        }
    }]);
}(window.JP.getModule('Server')));
