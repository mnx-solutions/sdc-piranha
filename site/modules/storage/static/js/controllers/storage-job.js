'use strict';

(function (app) {
    app.controller(
        'Storage.JobDetailsController',
        ['$rootScope', '$scope', 'requestContext', 'localization', 'Storage', '$location', '$q', 'PopupDialog',
            function ($rootScope, $scope, requestContext, localization, Storage, $location, $q, PopupDialog) {
                localization.bind('storage', $scope);
                requestContext.setUpRenderContext('storage.job', $scope);

                var jobId = requestContext.getParam('jobid');
                var jobPoller = null;
                // polling interval in seconds
                var POLL_INTERVAL = 15;

                $scope.job = null;
                $scope.assets = [];
                $scope.loading = true;

                $scope.init = function () {
                    $q.all([
                        $q.when(Storage.getJob(jobId)),
                        $q.when(Storage.getOutput(jobId)),
                        $q.when(Storage.getInput(jobId)),
                        $q.when(Storage.getErrors(jobId)),
                        $q.when(Storage.getFailures(jobId))
                    ]).then(
                        function (results) {
                            $scope.job = results[0];
                            $scope.outputs = results[1];
                            $scope.inputs = results[2];
                            $scope.errors = results[3];
                            $scope.failures = results[4];
                            $scope.steps = {};
                            $scope.job.phases.forEach(function (step) {
                                if (!$scope.steps[step.type]) {
                                    $scope.steps[step.type] = [];
                                }
                                $scope.steps[step.type].push(step.exec);

                                if (step.assets) {
                                    step.assets.forEach(function (asset) {
                                        if ($scope.assets.indexOf(asset) === -1) {
                                            $scope.assets.push(asset);
                                        }
                                    });
                                }
                            });
                            var inputTasks = $scope.job.stats.tasks;
                            if ($scope.steps.reduce && $scope.steps.reduce.length) {
                                inputTasks -= $scope.steps.reduce.length;
                            }
                            $scope.inputsCount = Math.max(inputTasks, $scope.inputs.length);
                            $scope.loading = false;
                        },
                        function () {
                            $location.url('/manta/jobs');
                            $location.replace();
                        }
                    );
                };
                Storage.ping().then($scope.init, function () {
                    $location.url('/manta/jobs');
                    $location.replace();
                });

                $scope.$watch('job.state', function (state) {
                    if (state === 'running') {
                        jobPoller = setInterval($scope.init, POLL_INTERVAL * 1000);
                    } else {
                        if (jobPoller) {
                            clearInterval(jobPoller);
                        }
                    }
                });

                $scope.cancelJob = function () {
                    var state = $scope.job.state;

                    if (state !== 'done' && state !== 'canceled') {
                        PopupDialog.confirm(
                            localization.translate(
                                $scope,
                                null,
                                'Confirm: Cancel job'
                            ),
                            localization.translate(
                                $scope,
                                null,
                                'Cancels a job, which means input will be closed, and all processing will be cancelled. You should not expect output from a job that has been cancelled.'
                            ),
                            function () {
                                $q.when(Storage.cancelJob(jobId)).then(
                                    function (message) {
                                        $scope.init();
                                        $scope.showMessage('Message', message);
                                    }
                                );
                            }
                        );
                    }
                };

                $scope.cloneJob = function () {
                    var job = {
                        name: $scope.job.name,
                        phases: $scope.job.phases,
                        inputs: $scope.inputs
                    };
                    $rootScope.commonConfig('cloneJob', job);
                    $location.path('/manta/builder');
                };

                $scope.showMessage = function (type, message) {
                    PopupDialog.message(
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

            }]
    );
}(window.JP.getModule('Storage')));
