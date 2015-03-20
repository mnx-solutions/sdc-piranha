'use strict';

(function (app) {
    app.controller(
        'Storage.JobBuilderController',
        ['$rootScope', '$scope', 'Account', 'requestContext', 'localization', '$q', 'Storage', 'PopupDialog', '$location', 'notification',
            function ($rootScope, $scope, Account, requestContext, localization, $q, Storage, PopupDialog, $location, notification) {
                localization.bind('storage', $scope);
                requestContext.setUpRenderContext('storage.builder', $scope);

                var JOB_BUILDER_PATH = '/manta/builder';
                $scope.jobName = '';
                $scope.dataInputs = [];
                $scope.dataAssets = [];
                $scope.filePath = '';
                $scope.mapStep = '';
                $scope.reduceStep = '';
                $scope.loading = true;
                $scope.jobCreating = false;
                $scope.numberOfReducers = '';
                $scope.amountOfDramOptions = ['', 256, 512, 1024, 2048, 4096, 8192];
                $scope.amountOfDram = $scope.amountOfDramOptions[0];
                $scope.amountOfDiskSpaceOptions = ['', 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
                $scope.amountOfDiskSpace = $scope.amountOfDiskSpaceOptions[0];
                var cloneJob = $rootScope.popCommonConfig('cloneJob');
                var analyzeLogsJob = $rootScope.popCommonConfig('analyzeLogsJob');
                Account.getAccount().then(function (account) {
                    $scope.account = account;
                    if ($scope.account.provisionEnabled) {
                        Storage.ping().then(function () {
                            $scope.loading = false;
                        }, function () {
                            $location.url('/manta/intro');
                            $location.replace();
                        });
                    } else {
                        $scope.loading = false;
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
                            if (data.count) {
                                $scope.numberOfReducers = data.count;
                            }
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
                    var memory = cloneJob.phases[0].memory;
                    if (memory) {
                        $scope.amountOfDram = memory;
                    }
                    var disk = cloneJob.phases[0].disk;
                    if (disk) {
                        $scope.amountOfDiskSpace = disk;
                    }
                }

                if (analyzeLogsJob && analyzeLogsJob.inputs) {
                    $scope.dataInputs = analyzeLogsJob.inputs.map(function (input) {
                        input = input.replace('~~', '/' + $scope.account.login);
                        return {filePath: input};
                    });
                }

                $scope.completeAccount = function () {
                    var submitBillingInfo = {
                        btnTitle: 'Submit and Access Job Builder',
                        appendPopupMessage: 'Manta access will now be granted.'
                    };
                    Account.checkProvisioning(submitBillingInfo, null, null, Storage.getAfterBillingHandler('/manta/builder'), false);
                };

                $scope.createJob = function () {
                    $scope.jobCreating = true;
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
                    } else if (!$scope.advancedForm.numberOfReducers.$valid) {
                        errorMessage = 'Please provide numeric of reducers (1 ... 1024).';
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
                            ), function () {
                                $scope.jobCreating = false;
                            }
                        );
                    }
                    var job = {
                        name: $scope.jobName,
                        mapStep: $scope.mapStep,
                        assets: dataAssets,
                        reduceStep: $scope.reduceStep,
                        inputs: dataInputs,
                        count: $scope.numberOfReducers,
                        memory: Number($scope.amountOfDram),
                        disk: Number($scope.amountOfDiskSpace)
                    };
                    $q.when(Storage.createJob(job, true)).then(function (res) {
                        $scope.jobCreating = false;
                        notification.popup(true, false, JOB_BUILDER_PATH, null, res.message, function () {
                            $location.url('/manta/jobs/' + res.id);
                            $location.replace();
                        });
                    }, function (err) {
                        $scope.jobCreating = false;
                        notification.popup(true, err, JOB_BUILDER_PATH, null, err.message || err);
                    });
                    return job;
                };
            }]
    );
}(window.JP.getModule('Storage')));
