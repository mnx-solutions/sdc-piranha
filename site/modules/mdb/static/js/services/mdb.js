'use strict';

(function (app) {
    app.factory('mdb', [
        'serverTab',
        function (serverTab) {
            var service = {};

            service.process = function (data, progressCallback) {
                return serverTab.call({
                    name: 'mdbProcess',
                    data: data,
                    progress: progressCallback
                }).deferred;
            };

            return service;
        }
    ]);
}(window.JP.getModule('mdb')));