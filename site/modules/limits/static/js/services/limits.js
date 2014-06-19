'use strict';

(function (app) {
    app.factory('Limits', [
        'serverTab',
        function (serverTab) {
            var service = {};
            service.getUserLimits = function (callback) {
                serverTab.call({
                    name: 'BillingUserLimits',
                    data: {},
                    done: function (error, job) {
                        if (error) {
                            callback(error);
                            return;
                        }
                        var jobResult = job.__read();
                        var limits = [];
                        for (var datacenter in jobResult) {
                            jobResult[datacenter].forEach(function (limit) {
                                limits.push(limit);
                            });
                        }

                        callback(null, limits);
                    }
                });
            };
            return service;
        }
    ]);
})(window.JP.getModule('Limits'));