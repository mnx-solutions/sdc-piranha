'use strict';

(function (app) {
    app.controller('mdbController', [
        '$scope',
        'requestContext',
        'localization',
        'mdb',
        'Account',
        'PopupDialog',
        '$location',
        function ($scope, requestContext, localization, mdb, Account, PopupDialog, $location) {
            localization.bind('mdb', $scope);
            requestContext.setUpRenderContext('mdb.index', $scope);

            $scope.gridUserConfig = Account.getUserConfig().$child('MdbJobs');
            $scope.objects = [];
            $scope.loading = true;

            $scope.gridProps = [
                {
                    id: 'jobId',
                    name: 'Job',
                    sequence: 0,
                    active: true,
                    type: 'html',
                    _getter: function (item) {
                        return '<a href="#!/mdb/' + item.jobId + '" style="min-width: 140px;">' + item.jobId + '</a>';
                    }
                },
                {
                    id: 'coreFile',
                    name: 'Core File',
                    sequence: 1,
                    active: true
                },
                {
                    id: 'date',
                    name: 'Created',
                    sequence: 2,
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

            mdb.getDebugJobsList().then(function (list) {
                $scope.loading = false;
                $scope.objects = list;
            }, function (error) {
                $scope.loading = false;
                PopupDialog.error(null, error);
            });

            $scope.addNewJob = function () {
                $location.path('/mdb/create');
            };
        }
    ]);
}(window.JP.getModule('mdb')));