'use strict';
window.fn = [];

(function (app) {
    app.factory('Storage', [
        'serverTab',
        '$q',
        'PopupDialog',
        '$location',
        function (serverTab, $q, PopupDialog, $location) {

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

            service.getJob = function (path, suppressError) {
                return jobRequest('JobGet', {path: path}, suppressError);
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
                    return {message: 'Job ' + jobId + ' was successfully created', id: jobId};
                });
            };

            service.ping = function (data, suppressError) {
                return jobRequest('StoragePing', data, suppressError);
            };

            service.listPing = function (suppressError) {
                return jobRequest('StorageListPing', null, suppressError);
            };

            service.getAfterBillingHandler = function (pageUrl) {
                return function (isSuccess) {
                    if (isSuccess) {
                        var fallback = function () {
                            $location.path('/manta/intro');
                        };
                        service.listPing().then(function () {
                            service.listPing().then(function () {
                                service.listPing().then(function () {
                                    $location.path(pageUrl);
                                }, fallback);
                            }, fallback);
                        }, fallback);
                    } else {
                        $location.path('/manta/intro');
                    }
                };
            };

            service.getMantaUrl = function () {
                return serverTab.call({
                    name: 'StorageMantaUrl'
                }).promise;
            };

            return service;
        }
    ]);
}(window.JP.getModule('Storage')));
