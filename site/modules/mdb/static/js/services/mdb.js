'use strict';

(function (app) {
    app.factory('mdb', [
        'serverTab',
        function (serverTab) {
            var service = {};

            service.getDebugJobsList = function (callback) {
                return serverTab.call({
                    name: 'MdbGetJobsList',
                    data: {},
                    done: callback
                }).deferred;
            };

            service.getJobFromList = function (jobId) {
                return serverTab.call({
                    name: 'MdbGetJobFromList',
                    data: {jobId: jobId}
                }).deferred;
            };

            service.getDebugJob = function (jobId) {
                return serverTab.call({
                    name: 'MdbGetJob',
                    data: {jobId: jobId}
                }).deferred;
            };

            service.process = function (data, progressCallback) {
                return serverTab.call({
                    name: 'MdbProcess',
                    data: data,
                    progress: progressCallback
                }).deferred;
            };

            service.cancel = function (jobId, callback) {
                return serverTab.call({
                    name: 'MdbCancel',
                    data: {jobId: jobId},
                    done: callback
                }).deferred;
            };
            return service;
        }
    ]);
}(window.JP.getModule('mdb')));