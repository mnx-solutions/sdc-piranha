'use strict';

(function (app) {
    app.controller(
        'Storage.HistoryController',
        ['$rootScope', '$scope', 'requestContext', 'localization', 'Storage', 'PopupDialog', 'Account', 'fileman', '$location', '$q',
            function ($rootScope, $scope, requestContext, localization, Storage, PopupDialog, Account, fileman, $location, $q) {
                localization.bind('storage', $scope);
                requestContext.setUpRenderContext('storage.history', $scope);

                $scope.loading = true;
                $scope.placeHolderText = 'filter jobs';
                $scope.suppressErrors = false;

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = Account.getUserConfig().$child('job_history');
                    Account.getAccount().then(function (account) {
                        $scope.account = account;
                        if ($scope.account.provisionEnabled) {
                            Storage.ping().then(function () {
                                getJobsList().then(function (jobs) {
                                    $scope.jobs = jobs;
                                });

                            }, function () {
                                $location.url('/manta/intro');
                                $location.replace();
                            });
                        } else {
                            $scope.loading = false;
                        }
                    });
                } else {
                    $location.path('/');
                }


                function getJobsList() {
                    var deferred = $q.defer();
                    Storage.listJobs().then(function (jobs) {
                        $scope.loading = false;
                        deferred.resolve(
                            jobs.map(function (job) {
                                job.id = job.name;
                                return job;
                            })
                        );
                    });
                    return deferred.promise;
                }

                var getJobDetails = function (object) {
                    if (!object.details) {
                        object.details = Storage.getJob(object.id, true);
                        object.details.then(angular.noop, function (error) {
                            if (!$scope.suppressErrors) {
                                PopupDialog.error(null, error, function () {
                                    $scope.suppressErrors = true;
                                });
                            }
                        })
                    }
                    return object.details;
                };

                $scope.completeAccount = function () {
                    var submitBillingInfo = {
                        btnTitle: 'Submit and Access Job History',
                        appendPopupMessage: 'Manta access will now be granted.'
                    };
                    Account.checkProvisioning(submitBillingInfo, function () {
                        $scope.gridUserConfig = Account.getUserConfig().$child('job_history');
                        getJobsList().then(function (jobs) {
                            $scope.jobs = jobs;
                        });
                    }, null, Storage.getAfterBillingHandler('/manta/jobs'), false);
                };


                $scope.gridOrder = ['-mtime'];
                $scope.gridProps = [
                    {
                        id: 'mtime',
                        name: 'Date',
                        type: 'date',
                        sequence: 1,
                        active: true
                    },
                    {
                        id: 'id',
                        name: 'ID',
                        sequence: 2,
                        active: true,
                        hideSorter: true,
                        type: 'html',
                        _getter: function (object) {
                            return '<a href="#!/manta/jobs/' + object.name + '">' + object.name + '</a>';
                        }
                    },
                    {
                        id: 'label',
                        name: 'Name',
                        sequence: 3,
                        active: true,
                        type: 'async',
                        hideSorter: true,
                        _getter: function (object) {
                            return getJobDetails(object).then(function (details) {
                                return details.name;
                            });
                        }
                    },
                    {
                        id: 'tasks',
                        name: 'Tasks',
                        sequence: 4,
                        active: true,
                        type: 'async',
                        hideSorter: true,
                        _getter: function (object) {
                            return getJobDetails(object).then(function (details) {
                                return details.stats.tasks;
                            });
                        }
                    },
                    {
                        id: 'status',
                        name: 'State',
                        sequence: 5,
                        active: true,
                        type: 'async',
                        hideSorter: true,
                        _getter: function (object) {
                            if (object.deleteJob) {
                                return 'deleting';
                            }
                            return getJobDetails(object).then(function (details) {
                                return details.state;
                            });
                        }
                    },
                    {
                        id: 'errors',
                        name: 'Errors',
                        sequence: 6,
                        active: true,
                        type: 'async',
                        hideSorter: true,
                        _getter: function (object) {
                            return getJobDetails(object).then(function (details) {
                                return details.stats.errors;
                            });
                        }
                    },
                    {
                        id: 'outputs',
                        name: 'Outputs',
                        sequence: 7,
                        active: true,
                        type: 'async',
                        hideSorter: true,
                        _getter: function (object) {
                            return getJobDetails(object).then(
                                function (details) {
                                    return details.stats.outputs;
                                },
                                function () {
                                    var posErrJob = $scope.jobs.indexOf(object);
                                    if (posErrJob !== -1) {
                                        $scope.jobs.splice(posErrJob, 1);
                                    }
                                }
                            );
                        }
                    },
                    {
                        id: 'edit',
                        name: 'Action',
                        type: 'button',
                        hideSorter: true,
                        btn: {
                            label: 'Clone',
                            getClass: function () {
                                return 'btn-edit ci effect-orange-button';
                            },
                            disabled: function () {
                                return $scope.loading;
                            },
                            action: function (object) {
                                Storage.getJob(object.id).then(function (result) {
                                    Storage.getInput(object.id).then(function (inputs) {
                                            var job = {
                                                name: result.name,
                                                phases: result.phases,
                                                inputs: inputs
                                            };
                                            $rootScope.commonConfig('cloneJob', job);
                                            $location.path('/manta/builder');
                                    });
                                });

                            }
                        },
                        sequence: 8,
                        active: true
                    }
                ];
                $scope.gridDetailProps = [];

                var gridMessages = {
                    delete: {
                        single: 'Delete selected job?',
                        plural: 'Delete selected jobs?',
                        all: 'Delete all jobs?'
                    }
                };

                $scope.gridActionButtons = [
                    {
                        label: 'Delete',
                        action: function () {
                            deleteRecord(gridMessages.delete, 'delete');
                        },
                        sequence: 1
                    }
//                    ,{
//                        label: 'Delete All',
//                        action: function () {
//                            deleteRecord(gridMessages.delete, 'deleteAll');
//                        },
//                        sequence: 2
//                    }
                ];

                function showPopupDialog(level, title, message, callback) {
                    if (level === 'error') {
                        $scope.loading = false;
                    }
                    return PopupDialog[level](
                        title ? localization.translate(
                            $scope,
                            null,
                            title
                        ) : null,
                        message ? localization.translate(
                            $scope,
                            null,
                            message
                        ) : null,
                        callback
                    );
                }

                var deleteRecord = function (messageBody, action) {
                    if ($scope.checkedItems.length > 0 || action === 'deleteAll') {
                        var message = messageBody.single;
                        if ($scope.checkedItems.length > 1) {
                            message = messageBody.plural;
                        }
                        if (action === 'deleteAll') {
                            message = messageBody.all;
                        }
                        PopupDialog.confirm(
                            localization.translate(
                                $scope,
                                null,
                                'Confirm: ' + message
                            ),
                            localization.translate(
                                $scope,
                                null,
                                message
                            ), function () {
                                var setCheckboxChecked = function () {
                                    if ($scope.jobs.length > 0) {
                                        $scope.jobs.forEach(function (job) {
                                            job.checked = true;
                                        });
                                    }
                                };
                                var deleteJobFolder = function (job) {
                                    var path = '/jobs/' + job.id;
                                    var deferred = $q.defer();
                                    job.checked = false;
                                    fileman.rmr(path, function (error) {
                                        if (error) {
                                            job.deleteJob = false;
                                            showPopupDialog('error', 'Error', error.message);
                                            deferred.reject(error);
                                        }
                                        deferred.resolve(job.id);
                                    });
                                    promises.push(deferred.promise);
                                };

                                if (action === 'deleteAll') {
                                    setCheckboxChecked();
                                    $scope.checkedItems = $scope.jobs;
                                }
                                var promises = [];
                                $scope.checkedItems.forEach(function (job) {
                                    job.deleteJob = true;
                                    deleteJobFolder(job);
                                });

                                $q.all(promises).then(function (deletedJobIds) {
                                    $scope.jobs = $scope.jobs.filter(function (el) {
                                        return !el.deleteJob;
                                    });
                                    $scope.checkedItems = [];
                                    var locationPath =  $location.path();
                                    if (locationPath.search('/manta/jobs/') !== -1) {
                                        var currentId = locationPath.slice(12);
                                        deletedJobIds.forEach(function (jobId) {
                                            if (currentId === jobId) {
                                                $location.path('/manta/jobs');
                                            }
                                        });
                                    }
                                });
                            }
                        );
                    } else {
                        showPopupDialog('error', 'Error', 'No item selected for the action.');
                    }
                };

                $scope.exportFields = {
                    ignore: 'all'
                };
                $scope.columnsButton = false;
                $scope.actionsButton = true;
                $scope.instForm = true;
                $scope.enabledCheckboxes = true;

                $scope.addNewJob = function () {
                    $location.path('/manta/builder');
                };
        }]
    );
}(window.JP.getModule('Storage')));
