'use strict';

(function (app) {
    app.controller(
        'Storage.HistoryController',
        ['$rootScope', '$scope', 'requestContext', 'localization', 'Storage', 'PopupDialog', 'Account', '$location', '$q',
            function ($rootScope, $scope, requestContext, localization, Storage, PopupDialog, Account, $location, $q) {
                localization.bind('storage', $scope);
                requestContext.setUpRenderContext('storage.history', $scope);

                $scope.loading = true;
                $scope.placeHolderText = 'filter jobs';

                if ($scope.features.manta === 'enabled') {
                    Account.getAccount().then(function (account) {
                        $scope.account = account;
                        if ($scope.account.provisionEnabled) {
                            Storage.ping().then(function () {
                                $scope.gridUserConfig = Account.getUserConfig().$child('job_history');
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
                        object.details = Storage.getJob(object.id);
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
                    }, null, null, false);
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
                        name: 'State',
                        sequence: 5,
                        active: true,
                        type: 'async',
                        hideSorter: true,
                        _getter: function (object) {
                            return getJobDetails(object).then(function (details) {
                                return details.state;
                            });
                        }
                    },
                    {
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
                                        $scope.jobs.splice(posErrJob, 1)
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

                $scope.gridActionButtons = [];

                $scope.exportFields = {
                    ignore: 'all'
                };
                $scope.columnsButton = false;
                $scope.actionsButton = true;
                $scope.instForm = true;
                $scope.enabledCheckboxes = false;

                $scope.addNewJob = function () {
                    $location.path('/manta/builder');
                };
        }]
    );
}(window.JP.getModule('Storage')));
