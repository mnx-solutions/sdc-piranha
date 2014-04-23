'use strict';

(function (app) {
    app.controller('LimitsController', [
        '$scope',
        'PopupDialog',
        'Limits',
        function ($scope, PopupDialog, Limits) {
            $scope.limits = [];
            $scope.loading = true;

            Limits.getUserLimits(function (error, limits) {
                $scope.loading = false;
                if (error) {
                    PopupDialog.error('Error', error);
                    return;
                }
                $scope.limits = limits;
            });

            $scope.gridOrder = ['datacenter'];
            $scope.exportFields = {};

            $scope.gridProps = [
                {
                    id: 'imageName',
                    name: 'Name',
                    active: true,
                    sequence: 1
                },
                {
                    id: 'type',
                    name: 'Type',
                    active: true,
                    sequence: 2
                },
                {
                    id: 'limit',
                    name: 'Limit',
                    active: true,
                    sequence: 3
                },
                {
                    id: 'datacenter',
                    name: 'Datacenter',
                    active: true,
                    sequence: 4
                }
            ];
            $scope.gridActionButtons = [];
            $scope.columnsButton = false;

        }
    ]);
}(window.JP.getModule('Limits')));