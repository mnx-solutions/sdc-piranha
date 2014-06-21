'use strict';

(function (app) {
    app.controller('mdbDetailController', [
        '$scope',
        'mdb',
        'PopupDialog',
        'Account',
        'localization',
        'requestContext',
        '$location',
        function ($scope, mdb, PopupDialog, Account, localization, requestContext, $location) {
            localization.bind('mdb', $scope);
            requestContext.setUpRenderContext('mdb.index', $scope);
            var jobId = requestContext.getParam('jobId');
            $scope.inputFile = [];
            $scope.objects = [];
            $scope.gridUserConfig = Account.getUserConfig().$child('mdb');
            $scope.gridProps = [
                {
                    id: 'object',
                    name: 'Object',
                    sequence: 0,
                    active: false
                },
                {
                    id: 'objects',
                    name: '# Objects',
                    sequence: 1,
                    active: true
                },
                {
                    id: 'props',
                    name: '# Properties',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'constr',
                    name: 'Constructor',
                    sequence: 3,
                    active: true
                }
            ];
            $scope.gridActionButtons = [];
            $scope.exportFields = {
                ignore: 'all'
            };

            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter';

            $scope.jobId = jobId !== 'create' ? jobId : null;
            $scope.status = 'Not Processed';
            $scope.supportStatus = 'Not signed up';
            $scope.processing = false;

            function flushAll() {
                $scope.loading = false;
                $scope.status = 'Not Processed';
                $scope.jobId = null;
                $scope.objects = [];
            }

            $scope.getFilePath = function (full) {
                // get last object from (Array)inputFile and return filePath 
                var filename = $scope.inputFile.length ? $scope.inputFile.slice(-1)[0].filePath : '';
                return full ? filename : filename.replace(/.*\/([^$]+)$/g, '$1');
            };

            function processResult(result) {
                $scope.loading = false;
                if (result.coreFile) {
                    $scope.inputFile = [{filePath: result.coreFile}];
                }
                if (result.status) {
                    $scope.status = result.status;
                }
                $scope.counters = {
                    'Heap Objects': result.counters['heap objects'],
                    'JavaScript Objects': result.counters['JavaScript objects'],
                    'Processed Objects': result.counters['processed objects'],
                    'Processed Arrays': result.counters['processed arrays']
                };
                $scope.objects = result.data;
                $scope.jobId = null;
            }

            $scope.process = function () {
                flushAll();
                $scope.processing = true;
                var callJob = mdb.process({coreFile: $scope.getFilePath(true)}, function (error, job) {
                    if (!$scope.processing) {
                        return;
                    }
                    var result = job.__read().slice(-1)[0];
                    if (result) {
                        if (result.status) {
                            $scope.status = result.status;
                        }
                        if (result.jobId) {
                            $scope.jobId = result.jobId;
                        }
                    }
                });

                callJob.then(function (result) {
                    if (!$scope.processing) {
                        return;
                    }
                    result = result.slice(-1)[0];
                    processResult(result);
                }, function (error) {
                    PopupDialog.error(null, error, flushAll);
                });
            };

            $scope.cancel = function () {
                $scope.processing = false;
                $scope.status = 'Canceling';
                mdb.cancel($scope.jobId, flushAll);
            };

            if ($scope.jobId) {
                $scope.processing = false;
                $scope.loading = true;
                mdb.getDebugJob($scope.jobId).then(processResult, function (error) {
                    PopupDialog.error(null, error, flushAll);
                });
            }

            $scope.$watch('jobId', function (val) {
                if (!val || val === 'create') {
                    return;
                }
                $location.path('/mdb' + (val ? '/' + val : ''), true);
            });
        }
    ]);
}(window.JP.getModule('mdb')));