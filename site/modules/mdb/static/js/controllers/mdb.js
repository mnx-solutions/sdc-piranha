'use strict';

(function (app) {
    app.controller('mdbController', [
        '$scope',
        'mdb',
        'PopupDialog',
        'Account',
        function ($scope, mdb, PopupDialog, Account) {
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

            $scope.jobId = null;
            $scope.status = 'Not Processed';
            $scope.supportStatus = 'Not signed up';
            $scope.processed = false;

            function flushAll() {
                $scope.status = 'Not Processed';
                $scope.jobId = null;
                $scope.objects = [];
            }

            $scope.getFilePath = function (full) {
                var filename = $scope.inputFile.length ? $scope.inputFile.slice(-1)[0].filePath : '';
                return full ? filename : filename.replace(/.*\/([^$]+)$/g, '$1');
            };

            $scope.process = function () {
                flushAll();
                $scope.processed = true;
                var callJob = mdb.process({coreFile: $scope.getFilePath(true)}, function (error, job) {
                    if (!$scope.processed) {
                        return;
                    }
                    var result = job.__read().slice(-1)[0];
                    if (result) {
                        if (result.status) {
                            $scope.status = result.status;
                        } else if (result.jobId) {
                            $scope.jobId = result.jobId;
                        }
                    }
                });

                callJob.then(function (result) {
                    if (!$scope.processed) {
                        return;
                    }
                    result = result.slice(-1)[0];
                    $scope.counters = {
                        'Heap Objects': result.counters['heap objects'],
                        'JavaScript Objects': result.counters['JavaScript objects'],
                        'Processed Objects': result.counters['processed objects'],
                        'Processed Arrays': result.counters['processed arrays']
                    };
                    $scope.objects = result.data;
                    $scope.jobId = null;
                }, function (error) {
                    PopupDialog.error(null, error, flushAll);
                });
            };

            $scope.cancel = function () {
                $scope.processed = false;
                $scope.status = 'Canceling';
                mdb.cancel($scope.jobId, function () {
                    flushAll();
                });
            };
        }
    ]);
}(window.JP.getModule('mdb')));