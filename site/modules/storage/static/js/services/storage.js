'use strict';
window.fn = [];

(function (app) {
    app.factory('Storage', [
        'serverTab',
        '$q',
        'Account',
        'errorContext',
        'localization',
        'PopupDialog',
        '$location',
        function (serverTab, $q, Account, errorContext, localization, PopupDialog, $location) {

            var service = {};
            var resourceErrors = [];
            function jobRequest(callName, data, suppressError, resultWrapper) {
                var deferred = $q.defer();
                serverTab.call({
                    name: callName,
                    data: data,
                    done: function (error, job) {
                        if (error) {
                            if (error.indexOf('None of your active roles are present on the resource') !== -1 &&
                                error.indexOf('~~/jobs') === -1) {
                                var jobPath = job.data.path;
                                if (resourceErrors.indexOf(jobPath) !== -1) {
                                    resourceErrors = [];
                                }
                                resourceErrors.push(jobPath);
                                error = 'None of your active roles are present on the resources ~~/jobs/: <br>' + jobPath;
                                if (resourceErrors.length > 1) {
                                    error = jobPath;
                                }
                            }
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
                    return {message: 'Job "' + jobId + '" was successfully created', id: jobId};
                });
            };

            service.ping = function (data, suppressError) {
                return jobRequest('StoragePing', data, suppressError);
            };

            service.listPing = function (suppressError) {
                return jobRequest('StorageListPing', null, suppressError);
            };

            service.getAfterBillingHandler = function (pageUrl, callback) {
                callback = callback || angular.noop;
                return function (isSuccess) {
                    if (isSuccess) {
                        var fallback = function () {
                            $location.path('/manta/intro');
                        };
                        service.listPing().then(function () {
                            service.listPing().then(function () {
                                service.listPing().then(function () {
                                    if (pageUrl) {
                                        $location.path(pageUrl);
                                    }
                                    callback();
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

            var billingIsActive = false;
            var mantaIsActive;

            service.pingManta = function (callback) {
                callback = callback || angular.noop;
                function errorPingManta() {
                    var path = $location.path();
                    if (path.indexOf('/dashboard') !== 0 && path.indexOf('/compute') !== 0 &&
                        path.indexOf('/usage') !== 0) {
                        var err = new Error(localization.translate(null,
                            'docker',
                            'Our operations team is investigating.'
                        ));
                        err.isMantaNotAvailable = true;
                        errorContext.emit(err);
                    }
                }
                function storagePing(billingEnabled) {
                    service.ping(billingEnabled, true).then(function () {
                        mantaIsActive = true;
                        callback();
                    }, function () {
                        mantaIsActive = false;
                        if (billingEnabled) {
                            errorPingManta();
                        }
                    });
                }
                if (billingIsActive && mantaIsActive !== undefined) {
                    if (mantaIsActive) {
                        callback();
                    } else {
                        errorPingManta();
                    }
                } else {
                    Account.getAccount().then(function (account) {
                        var billingEnabled = account.provisionEnabled;
                        if (billingEnabled) {
                            billingIsActive = true;
                        }
                        storagePing(billingEnabled);
                    }, function () {
                        errorPingManta();
                    });
                }
            };

            return service;
        }
    ]);
}(window.JP.getModule('Storage')));
