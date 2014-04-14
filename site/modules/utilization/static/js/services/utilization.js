'use strict';

(function (app) {
    var cache = null;
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
                        utilizationCache[month].dram.format = function (num) {
                            return num.toFixed(2);
                        };
                        utilizationCache[month].bandwidth.format = function (num) {
                            var formatted = util.getReadableFileSizeString(num);
                            if (formatted.value > 0) {
                                return formatted.value + ' ' + formatted.measure;
                            }
                            return formatted;
                        };
                        callback(null, utilizationCache[month]);
                    }
                });
            };

            return service;
        }]);
}(window.JP.getModule('utilization')));

