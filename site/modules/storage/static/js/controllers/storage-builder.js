'use strict';

(function (app) {
    app.controller(
        'Storage.JobBuilderController',
        ['$scope', 'requestContext', 'localization', '$q', 'Storage', 'PopupDialog',
            function ($scope, requestContext, localization, $q, Storage, PopupDialog) {
                localization.bind('storage', $scope);
                requestContext.setUpRenderContext('storage.builder', $scope);

                $scope.jobName = '';
                $scope.dataInputs = [];
                $scope.dataAssets = [];
                $scope.filePath = '';
                $scope.mapStep = '';
                $scope.reduceStep = '';

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
                            PopupDialog.error(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    err
                                ),
                                function () {}
                            );
                        }
                    );

                };

            }]
    );
}(window.JP.getModule('Storage')));
