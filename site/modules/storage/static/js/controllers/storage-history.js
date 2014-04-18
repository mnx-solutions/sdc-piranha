'use strict';

(function (app) {
    app.controller(
        'Storage.HistoryController',
        ['$scope', 'requestContext', 'localization', 'Storage', 'PopupDialog', '$dialog', 'Account', '$location',
                function ($scope, requestContext, localization, Storage, PopupDialog, $dialog, Account, $location) {
            localization.bind('storage', $scope);
            requestContext.setUpRenderContext('storage.history', $scope);

                $scope.loading = true;

                $scope.jobs = [];

                Storage.listJobs().then(function (jobs) {
                    $scope.loading = false;
                    $scope.jobs = jobs.map(function (job) {
                        job.id = job.name;
                        return job;
                    });
                });

                $scope.actionButton = function () {
                    var flag = false;
                    $scope.jobs.$$v.forEach(function (el) {
                        if (el.checked) {
                            flag = true;
                        }
                    });
                    return flag;
                };

                $scope.noCheckBoxChecked = function () {
                    PopupDialog.error(
                        localization.translate(
                            $scope,
                            null,
                            'Error'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'No jobs selected for the action.'
                        ), function () {
                        }
                    );
                };

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = Account.getUserConfig().$child('job_history');
                }

                $scope.gridOrder = ['created'];
                $scope.gridProps = [
                    {
                        id: 'mtime',
                        name: 'Date',
                        type: 'date',
                        sequence: 1,
                        active: true
                    },
                    {
                        id: 'name',
                        name: 'Name',
                        sequence: 2,
                        active: true
                    },
                    {
                        id: 'id',
                        name: 'ID',
                        sequence: 3,
                        active: true
                    },
                    {
                        id: 'tasks',
                        name: '#Tasks',
                        sequence: 4,
                        active: true
                    },
                    {
                        id: 'done',
                        name: '#Done',
                        sequence: 5,
                        active: true
                    },
                    {
                        id: 'error',
                        name: '#Errors',
                        sequence: 6,
                        active: true
                    },
                    {
                        id: 'outputs',
                        name: '#Outputs',
                        sequence: 7,
                        active: true
                    }
                ];
                $scope.gridDetailProps = [];

                $scope.gridActionButtons = [
                    {
                        label: 'Clone',
                        disabled: function (object) {
                            return false;
                        },
                        action: function (object) {
                            if ($scope.actionButton()) {
                                PopupDialog.confirm(
                                    localization.translate(
                                        $scope,
                                        null,
                                        'Confirm: Clone this task'
                                    ),
                                    localization.translate(
                                        $scope,
                                        null,
                                        'Clone this task'
                                    ), function () {
                                        $scope.jobs.$$v.forEach(function (el) {
                                            if (el.checked) {
                                                el.checked = false;
                                            }
                                        });
                                    });
                            } else {
                                $scope.noCheckBoxChecked();
                            }
                        },
                        show: function (object) {
                            return true;
                        },
                        tooltip: 'Clone this task',
                        sequence: 1
                    }
                ];

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
