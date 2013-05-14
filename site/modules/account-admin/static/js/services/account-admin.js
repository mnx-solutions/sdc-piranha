'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('AccountAdmin', ['$http','$q', 'serverTab', function ($http, $q, serverTab) {
        var service = {};

        var account = null;
        service.getSignupStep = function(id) {

            var deferred = $q.defer();
            serverTab.call({
                name: 'getSignupStep',
                data: {id: id},
                progress: function(err, job) {
                },
                done: function(err, job) {
                    deferred.resolve(job.__read());
                }
            });

            return deferred.promise;
        };

        service.setSignupStep = function(id, step) {

            var deferred = $q.defer();
            serverTab.call({
                name: 'setSignupStep',
                data: {id: id, step: step},
                progress: function(err, job) {
                },
                done: function(err, job) {
                    deferred.resolve(job.__read());
                }
            });

            return deferred.promise;
        };

        return service;
    }]);
}(window.JP.getModule('AccountAdmin')));