'use strict';

(function (app) {
    app.factory('Utilization', [
        'serverTab',
        'util',
        function (serverTab, util) {
            var service = {};
            var utilizationCache = {};

            service.utilization = function (year, month, callback) {
                if (utilizationCache[month]) {
                    callback(null, utilizationCache[month]);
                    return;
                }
                serverTab.call({
                    name: 'UtilizationData',
                    data: {
                        year: year,
                        month: month
                    },
                    done: function (err, job) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        utilizationCache[month] = job.__read();
                        var utilizationCacheByMonth = utilizationCache[month];
                        utilizationCacheByMonth.compute.format = function (num) {
                            return util.getReadableDramUsage(num) + ' GB Hours';
                        };
                        utilizationCacheByMonth.manta.format = utilizationCacheByMonth.currentspend.format = function (num) {
                            return '$' + util.getReadableCurrencyString(num);
                        };
                        utilizationCacheByMonth.bandwidth.formatTotal = utilizationCacheByMonth.bandwidth.format = function (num) {
                            return util.getReadableFileSizeString(num);
                        };
                        callback(null, utilizationCacheByMonth);
                    }
                });
            };

            return service;
        }]);
}(window.JP.getModule('utilization')));

