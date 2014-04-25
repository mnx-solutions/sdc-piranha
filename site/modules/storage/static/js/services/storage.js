'use strict';
window.fn = [];

(function (app) {
    app.factory('Storage', [
        'serverTab',
        '$q',
        function (serverTab, $q) {

            var service = {};

            service.listJobs = function () {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'JobList',
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        deferred.resolve(job.__read());
                    }
                });
                return deferred.promise;
            };

            service.getJob = function (path) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'JobGet',
                    data: {
                        path: path
                    },
                    done: function (err, data) {
                        if (err) {
                            return deferred.reject(err);
                        }
                        deferred.resolve(data.__read());
                    }
                });
                return deferred.promise;
            };

            service.getErrors = function (jobId) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'JobErrors',
                    data: {
                        id: jobId
                    },
                    done: function (err, data) {
                        if (err) {
                            return deferred.reject(err);
                        }
                        deferred.resolve(data.__read());
                    }
                });
                return deferred.promise;
            };

            service.getFailures = function (jobId) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'JobFailures',
                    data: {
                        id: jobId
                    },
                    done: function (err, data) {
                        if (err) {
                            return deferred.reject(err);
                        }
                        deferred.resolve(data.__read());
                    }
                });
                return deferred.promise;
            };

            service.getOutput = function (jobId) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'JobOutput',
                    data: {
                        id: jobId
                    },
                    done: function (err, data) {
                        if (err) {
                            return deferred.reject(err);
                        }
                        deferred.resolve(data.__read());
                    }
                });
                return deferred.promise;
            };

            service.getInput = function (jobId) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'JobInputs',
                    data: {
                        id: jobId
                    },
                    done: function (err, data) {
                        if (err) {
                            return deferred.reject(err);
                        }
                        deferred.resolve(data.__read());
                    }
                });
                return deferred.promise;
            };

            service.cancelJob = function (jobId) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'JobCancel',
                    data: {
                        id: jobId
                    },
                    done: function (err, data) {
                        if (err) {
                            return deferred.reject(err);
                        }
                        deferred.resolve(data.__read());
                    }
                });
                return deferred.promise;
            };

            service.cloneJob = function (job) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'JobClone',
                    data: job,
                    done: function (err, jobId) {
                        if (err) {
                            return deferred.reject(err);
                        }
                        deferred.resolve('Job ' + jobId.__read() + ' was successfully created');
                    }
                });
                return deferred.promise;
            };

            service.createJob = function (data) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'JobCreate',
                    data: data,
                    done: function (err, job) {
                        if (err) {
                            return deferred.reject(err);
                        }
                        deferred.resolve('Job ' + job.__read() + ' was successfully created');
                    }
                });
                return deferred.promise;
            };

            return service;
        }
    ]);
}(window.JP.getModule('Storage')));