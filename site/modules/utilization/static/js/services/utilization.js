'use strict';

(function (app) {
    var cache = null;
    app.factory('Utilization', [
        'serverTab',
        function (serverTab) {
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
                        callback(null, cache);
                    }
                });
            };

            return service;
        }]);
}(window.JP.getModule('utilization')));

