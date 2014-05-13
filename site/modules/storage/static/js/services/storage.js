'use strict';
window.fn = [];

(function (app) {
    app.factory('Storage', [
        'serverTab',
        '$q',
        'PopupDialog',
        function (serverTab, $q, PopupDialog) {

            var service = {};
            function jobRequest(callName, data, suppressError, resultWrapper) {
                var deferred = $q.defer();
                serverTab.call({
                    name: callName,
                    data: data,
                    done: function (error, job) {
                        if (error) {
                            deferred.reject(error);
                            if (!suppressError) {
                                PopupDialog.error(null, error);
                            }
                            return;
                        }
                        var jobResult = job.__read();
                        deferred.resolve(typeof (resultWrapper) === 'function' ? resultWrapper(jobResult) : jobResult);
                    }
                });
                return deferred.promise;
            }
            service.listJobs = function () {
                return jobRequest('JobList');
            };

            service.getJob = function (path) {
                return jobRequest('JobGet', {path: path});
            };

            service.getErrors = function (jobId) {
                return jobRequest('JobErrors', {id: jobId});
            };

            service.getFailures = function (jobId) {
                return jobRequest('JobFailures', {id: jobId});
            };

            service.getOutput = function (jobId) {
                return jobRequest('JobOutput', {id: jobId});
            };

            service.getInput = function (jobId) {
                return jobRequest('JobInputs', {id: jobId});
            };

            service.cancelJob = function (jobId) {
                return jobRequest('JobCancel', {id: jobId});
            };

            service.createJob = function (data, suppressError) {
                return jobRequest('JobCreate', data, suppressError, function (jobId) {
                    return 'Job ' + jobId + ' was successfully created';
                });
            };

            service.ping = function (suppressError) {
                return jobRequest('StoragePing', null, suppressError);
            };
            return service;
        }
    ]);
}(window.JP.getModule('Storage')));