'use strict';

(function (app) {
    app.controller(
        'Storage.JobDetailsController',
        ['$rootScope', '$scope', 'requestContext', 'localization', 'Storage', '$location', '$q', 'PopupDialog',
            function ($rootScope, $scope, requestContext, localization, Storage, $location, $q, PopupDialog) {
                localization.bind('storage', $scope);
                requestContext.setUpRenderContext('storage.job', $scope);

                var jobId = requestContext.getParam('jobid');

                $scope.job = null;
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
                            $scope.job.phases.forEach(function(step) {
                                if (!$scope.steps[step.type] ) {
                                    $scope.steps[step.type] = [];
                                }
                                $scope.steps[step.type].push(step.exec);
                            });
                            $scope.loading = false;
                        },
                        function () {
                            $location.url('/manta/jobs');
                            $location.replace();
                        }
                    );
                };

                $scope.init();

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
                                    },
                                    function (err) {
                                        $scope.showMessage('Error', err);
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
                        ),
                        function () {}
                    );
                };

            }]
    );
}(window.JP.getModule('Storage')));
