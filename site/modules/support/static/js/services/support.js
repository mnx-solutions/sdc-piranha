'use strict';

(function (app) {
    var cache = null;
    app.factory('Support', [
        'serverTab',
        function (serverTab) {
            var service = {};

            service.support = function (callback) {
                if (cache) {
                    callback(null, cache);
                    return;
                }
                serverTab.call({
                    name: 'SupportListPackages',
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
}(window.JP.getModule('support')));

