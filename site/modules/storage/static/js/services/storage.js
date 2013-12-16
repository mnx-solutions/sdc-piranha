'use strict';
window.fn = [];

(function (app) {
    app.factory('Storage', [
        'serverTab',
        '$q',
        function (serverTab, $q) {

            var service = {};

            service.listJobs = function () {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'JobList',
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        deferred.resolve(job.__read());
                    }
                });
                return deferred.promise;
            };

            return service;
        }]);
}(window.JP.getModule('Storage')));