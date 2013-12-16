'use strict';

(function (app) {
    app.controller(
        'Storage.HistoryController',
        ['$scope', 'requestContext', 'localization', 'Storage','util','$dialog',
                function ($scope, requestContext, localization, Storage, util, $dialog) {
            localization.bind('storage', $scope);
            requestContext.setUpRenderContext('storage.history', $scope);

                    $scope.jobs = Storage.listJobs();

                    //temporarily function
                    $scope.$watch('jobs', function (jobs) {
                        if(jobs){
                            jobs.forEach(function (job) {
                                job.id = job.name;
                            });
                        }

                    }, true);
                    //end

                    $scope.actionButton = function(){
                        var flag = false;
                        $scope.jobs.$$v.forEach(function (el) {
                            if(el.checked){
                                flag = true;
                            }
                        });
                        return flag;
                    };

                    $scope.noCheckBoxChecked = function(){
                        util.error(
                            localization.translate(
                                $scope,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                $scope,
                                null,
                                'No jobs selected for the action.'
                            ),function(){
                            }
                        );
                    };

                    $scope.gridOrder = ['created'];
                    $scope.gridProps = [
                        {
                            id: 'mtime',
                            name: 'Date',
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
                                if($scope.actionButton()) {
                                    util.confirm(
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
                                                if(el.checked){
                                                    el.checked = false;
                                                }
                                            });
                                        });
                                }else $scope.noCheckBoxChecked();
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


        }]
    );
}(window.JP.getModule('Storage')));
