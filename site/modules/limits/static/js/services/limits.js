'use strict';

(function (app) {
    app.factory('Limits', [
        'serverTab', 'ErrorService',

        function (serverTab, ErrorService) {
            var service = {};
            service.getUserLimits = function (callback) {
                serverTab.call({
                    name: 'BillingUserLimits',
                    data: {},
                    done: function (error, job) {
                        if (error) {
                            if (!ErrorService.getLastErrors('billingUnreachable', 'billing')) {
                                ErrorService.setLastError('billingUnreachable', 'billing',
                                    'Billing server is currently not available. We are working on getting this data center back on.');
                            }
                            callback(error);
                            return;
                        }

                        ErrorService.flushErrors('billingUnreachable', 'billing');

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
