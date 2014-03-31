'use strict';

(function (app) {
    var cache = null;
    app.factory('Utilization', [
        'serverTab',
        'util',
        function (serverTab, util) {
            var service = {};

            service.utilization = function (callback) {
                if (cache) {
                    callback(null, cache);
                    return;
                }
                serverTab.call({
                    name: 'UtilizationData',
                    done: function (err, job) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        cache = job.__read();
                        cache.dram.amount.format = function (num) {
                            return Math.round(num);
                        };
                        cache.bandwidth.amount.format = function (num) {
                            var formatted = util.getReadableFileSizeString(num);
                            if (formatted.value > 0) {
                                return formatted.value + ' ' + formatted.measure;
                            }
                            return formatted;
                        }
                        callback(null, cache);
                    }
                });
            };

            return service;
        }]);
}(window.JP.getModule('utilization')));

