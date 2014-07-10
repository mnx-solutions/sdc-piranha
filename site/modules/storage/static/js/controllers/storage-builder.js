'use strict';

(function (app) {
    app.controller(
        'Storage.JobBuilderController',
        ['$rootScope', '$scope', 'Account', 'requestContext', 'localization', '$q', 'Storage', 'PopupDialog', '$location',
            function ($rootScope, $scope, Account, requestContext, localization, $q, Storage, PopupDialog, $location) {
                localization.bind('storage', $scope);
                requestContext.setUpRenderContext('storage.builder', $scope);

                $scope.jobName = '';
                $scope.dataInputs = [];
                $scope.dataAssets = [];
                $scope.filePath = '';
                $scope.mapStep = '';
                $scope.reduceStep = '';
                $scope.loading = true;
                var cloneJob = $rootScope.popCommonConfig('cloneJob');
                Account.getAccount().then(function (account) {
                    $scope.loading = false;
                    $scope.account = account;
                    if ($scope.account.provisionEnabled) {
                        Storage.ping().then(angular.noop, function () {
                            $location.url('/manta/intro');
                            $location.replace();
                        });
                    }
                });
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
                            return {filePath: asset};
                        });
                    }
                    var inputs = cloneJob.inputs;
                    if (inputs) {
                        $scope.dataInputs = inputs.map(function (input) {
                            return {filePath: input};
                        });
                    }
                }

                $scope.completeAccount = function () {
                    var submitBillingInfo = {
                        btnTitle: 'Submit and Access Job Builder',
                        appendPopupMessage: 'Manta access will now be granted.'
                    };
                    Account.checkProvisioning(submitBillingInfo, null, null, null, false);
                };

                $scope.createJob = function () {
                    var dataAssets = $scope.dataAssets.map(function (dataAsset) {
                        return dataAsset.filePath;
                    });
                    var dataInputs = $scope.dataInputs.map(function (dataInput) {
                        return dataInput.filePath;
                    });

                    var errorMessage = '';
                    if (dataInputs.length === 0) {
                        errorMessage = 'You must add at least one input file.';
                    } else if ($scope.mapStep.length === 0 && $scope.reduceStep.length === 0) {
                        errorMessage = 'You must fill in Map Step and/or Reduce Step fields.';
                    }

                    if (errorMessage) {
                        return PopupDialog.error(
                            localization.translate(
                                $scope,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                $scope,
                                null,
                                errorMessage
                            )
                        );
                    }
                    var job = {
                        name: $scope.jobName,
                        mapStep: $scope.mapStep,
                        assets: dataAssets,
                        reduceStep: $scope.reduceStep,
                        inputs: dataInputs
                    };
                    $q.when(Storage.createJob(job, true)).then(
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
                                    res.message
                                ),
                                function () {
                                    $location.url('/manta/jobs/' + res.id);
                                    $location.replace();
                                }
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
                                )
                            );
                        }
                    );
                    return job;
                };
            }]
    );
}(window.JP.getModule('Storage')));
