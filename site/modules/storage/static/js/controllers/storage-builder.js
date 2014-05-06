'use strict';

(function (app) {
    app.controller(
        'Storage.JobBuilderController',
        ['$rootScope', '$scope', 'requestContext', 'localization', '$q', 'Storage', 'PopupDialog',
            function ($rootScope, $scope, requestContext, localization, $q, Storage, PopupDialog) {
                localization.bind('storage', $scope);
                requestContext.setUpRenderContext('storage.builder', $scope);

                $scope.jobName = '';
                $scope.dataInputs = [];
                $scope.dataAssets = [];
                $scope.filePath = '';
                $scope.mapStep = '';
                $scope.reduceStep = '';

                var cloneJob = $rootScope.popCommonConfig('cloneJob');

                if (cloneJob) {
                    $scope.jobName = cloneJob.name;

                    cloneJob.phases.forEach(function (data) {
                        if (data.type === 'map') {
                            $scope.mapStep = data.exec;
                        }
                        if (data.type === 'reduce') {
                            $scope.reduceStep = data.exec;
                        }
                    });

                    var assets = cloneJob.phases[0].assets;
                    if (assets) {
                        $scope.dataAssets = assets.map(function (asset) {
                            return {'filePath': asset};
                        });
                    }
                    var inputs = cloneJob.inputs;
                    if (inputs) {
                        $scope.dataInputs = inputs.map(function (input) {
                            return {'filePath': input};
                        });
                    }
                }

                $scope.createJob = function () {
                    var dataAssets = $scope.dataAssets.map(function (dataAsset) {
                        return dataAsset.filePath;
                    });
                    var inputs = $scope.dataInputs.map(function (dataInput) {
                        return dataInput.filePath;
                    });
                    var job = {
                        name: $scope.jobName,
                        mapStep: $scope.mapStep,
                        assets: dataAssets,
                        reduceStep: $scope.reduceStep,
                        inputs: inputs
                    };

                    $q.when(Storage.createJob(job)).then(
                        function (res) {
                            PopupDialog.message(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Message'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    res
                                ),
                                function () {}
                            );
                        },
                        function (err) {
                            var message = err;
                            if ($scope.mapStep.length === 0 && $scope.reduceStep.length === 0) {
                                message = 'You must fill in Map Step and/or Reduce Step fields.'
                            }
                            PopupDialog.error(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    message
                                ),
                                function () {}
                            );
                        }
                    );

                };

            }]
    );
}(window.JP.getModule('Storage')));
