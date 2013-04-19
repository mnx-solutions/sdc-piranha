'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('Account', ['$http','$q', 'serverTab', '$$track', function ($http, $q, serverTab, $$track) {
        var service = {};

        var account = {};
        service.getAccount = function() {
            var deferred = $q.defer();

            serverTab.call({
                name: 'getAccount',
                progress: function(err, job) {
                },
                done: function(err, job) {
                    var resolver = job.__read();
                    deferred.resolve(resolver);
                    $$track.marketing_lead(resolver);
                }
            })

            return deferred.promise;
        }

        return service;
    }]);
}(window.JP.getModule('Account')));