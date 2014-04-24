'use strict';

(function (app) {
    app.controller(
        'Storage.JobDetailsController',
        ['$scope', 'requestContext', 'localization', 'Storage', '$location', '$q', 'PopupDialog',
            function ($scope, requestContext, localization, Storage, $location, $q, PopupDialog) {
                localization.bind('storage', $scope);
                requestContext.setUpRenderContext('storage.job', $scope);

                var jobId = requestContext.getParam('jobid');

                $scope.job = null;

                $scope.init = function () {
                    $q.when(Storage.getJob(jobId)).then(
                        function (result) {
                            $scope.job = result;
                            $scope.outputs = Storage.getOutput(jobId);
                            $scope.inputs = Storage.getInput(jobId);
                            $scope.errors = Storage.getErrors(jobId);
                            $scope.failures = Storage.getFailures(jobId);
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
                        phases: $scope.job.phases
                    };

                    $q.when(Storage.cloneJob(job)).then(
                        function (res) {
                            $scope.showMessage('Message', res);
                        },
                        function (err) {
                            $scope.showMessage('Error', err);
                        }
                    );

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
