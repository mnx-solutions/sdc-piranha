'use strict';

(function (app) {
    app.controller('mdbController', [
        '$scope',
        'mdb',
        'Account',
        function ($scope, mdb, Account) {
            $scope.inputFile = [];
            $scope.objects = [];
            $scope.gridUserConfig = Account.getUserConfig().$child('mdb');
            $scope.gridProps = [
                {
                    id: 'objects',
                    name: '# Objects',
                    sequence: 1,
                    active: true
                },
                {
                    id: 'properties',
                    name: '# Properties',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'constructor',
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

            $scope.status = 'Not Processed';
            $scope.supportStatus = 'Not signed up';

            $scope.getFilePath = function (full) {
                var filename = $scope.inputFile.length ? $scope.inputFile[0].filePath : '';
                return full ? filename : filename.replace(/.*\/([^$]+)$/g, '$1');
            };

            $scope.process = function () {
                var callJob = mdb.process({coreFile: $scope.getFilePath(true)}, function (error, job) {
                    $scope.status = job.__read().slice(-1)[0];
                });
                console.warn(callJob);
                callJob.then(function (job) {
                    console.log(job);
                });
            };
        }
    ]);
}(window.JP.getModule('mdb')));