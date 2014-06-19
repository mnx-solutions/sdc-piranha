'use strict';

(function (app) {
    app.factory('mdb', [
        'serverTab',
        function (serverTab) {
            var service = {};

            service.process = function (data, progressCallback) {
                return serverTab.call({
                    name: 'MdbProcess',
                    data: data,
                    progress: progressCallback
                }).deferred;
            };

            service.cancel = function (jobId, callback) {
                serverTab.call({
                    name: 'MdbCancel',
                    data: {jobId: jobId},
                    done: callback
                });
            };
            return service;
        }
    ]);
}(window.JP.getModule('mdb')));