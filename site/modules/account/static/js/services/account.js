'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('Account', ['$http','$q', 'serverTab', function ($http, $q, serverTab) {
        var service = {};

        var account = {};
        service.getAccount = function() {
            var deferred = $q.defer();

            serverTab.call({
                name: 'getAccount',
                progress: function(err, job) {
                },
                done: function(err, job) {
                    deferred.resolve(job.__read());
                }
            })

            return deferred.promise;
        }

        return service;
    }]);
}(window.JP.getModule('Account')));