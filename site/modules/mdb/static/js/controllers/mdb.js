'use strict';

(function (app) {
    app.controller('mdbController', [
        '$scope',
        'Account',
        function ($scope, Account) {
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
            
            $scope.getFilePath = function () {
                var filename = $scope.objects.length ? $scope.objects[0].filePath : '';
                filename = filename.replace(/.*\/([^$]+)$/g, '$1');
                return filename;
            };
        }
    ]);
}(window.JP.getModule('mdb')));