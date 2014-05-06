'use strict';

(function (app) {
    app.controller(
        'Storage.HistoryController',
        ['$rootScope', '$scope', 'requestContext', 'localization', 'Storage', 'PopupDialog', '$dialog', 'Account', '$location', '$q',
                function ($rootScope, $scope, requestContext, localization, Storage, PopupDialog, $dialog, Account, $location, $q) {
            localization.bind('storage', $scope);
            requestContext.setUpRenderContext('storage.history', $scope);

                $scope.loading = true;
                $scope.placeHolderText = 'filter jobs';

                if ($scope.features.manta === 'enabled') {
                    Account.checkProvisioning({btnTitle: 'Submit and Access Job History'}, function () {
                        Account.getUserConfig().$load(function (err, config) {
                            $scope.jobs = getJobsList();
                            $scope.gridUserConfig = Account.getUserConfig().$child('job_history');
                        });

                        }, function () {
                        }, function (isSuccess) {
                            if (isSuccess) {
                                $location.path('/manta/jobs');
                            } else {
                                $location.path('/manta/intro');
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

                function showMessage(dialog, type, message) {
                    PopupDialog[dialog](
                        localization.translate(
                            $scope,
                            null,
                            type
                        ),
                        localization.translate(
                            $scope,
                            null,
                            message
                        )
                    );
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
                        active: true
                    },
                    {
                        id: 'edit',
                        name: 'Action',
                        type: 'button',
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
                        sequence: 3,
                        active: true
                    }
                ];
                $scope.gridDetailProps = [];

                $scope.gridActionButtons = [];

                $scope.exportFields = {
                    ignore: []
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
