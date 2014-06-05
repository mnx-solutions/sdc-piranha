'use strict';

(function (app) {
    app.controller('LimitsController', [
        '$scope',
        'PopupDialog',
        'Limits',
        '$rootScope',
        'Account',
        function ($scope, PopupDialog, Limits, $rootScope, Account) {
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

            $scope.gridUserConfig = Account.getUserConfig().$child('limits');

            $scope.gridOrder = ['datacenter'];
            $scope.exportFields = {};

            $scope.gridProps = [
                {
                    id: 'criteria',
                    name: 'Criteria',
                    active: true,
                    sequence: 1,
                    _getter: function (limit) {
                        return limit.check + ': ' + limit[limit.check];
                    }
                },
                {
                    id: 'limit',
                    name: 'Limit',
                    active: true,
                    sequence: 2,
                    _getter: function (limit) {
                        return limit.value + ' ' + limit.by;
                    }
                },
                {
                    id: 'datacenter',
                    name: 'Datacenter',
                    active: false,
                    sequence: 3
                }
            ];
            $scope.gridActionButtons = [];
            $scope.columnsButton = false;
            $scope.tabFilterField = 'datacenter';
            $scope.tabFilterDefault = $rootScope.commonConfig($scope.tabFilterField);
            $scope.$on('gridViewChangeTab', function (event, tab) {
                if (tab === 'all') {
                    $rootScope.clearCommonConfig($scope.tabFilterField);
                } else {
                    $rootScope.commonConfig($scope.tabFilterField, tab);
                }
            });

        }
    ]);
}(window.JP.getModule('Limits')));