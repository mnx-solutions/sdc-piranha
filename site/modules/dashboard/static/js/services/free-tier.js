'use strict';
(function (app) {
    app.factory('FreeTier', [
        'serverTab',
        '$q',
        function (serverTab, $q) {
            var service = {};

            var freeTiers = false;

            service.listFreeTierOptions = function () {
                var deferred = $q.defer();
                if (!freeTiers) {
                    serverTab.call({
                        name: 'ListFreeTierOptions',
                        done: function (err, job) {
                            freeTiers = job.__read();
                            deferred.resolve(freeTiers);
                        }
                    });
                } else {
                    deferred.resolve(freeTiers);
                }
                return deferred.promise;
            };

            return service;
        }]);
}(window.JP.getModule('Dashboard')));
