'use strict';

(function (app) {
    app.controller(
        'Utilization.SpendController',
        ['$scope', '$location', 'Utilization', function ($scope, $location, Utilization) {
            $scope.cpu = [];
            $scope.manta = [];
            $scope.bandwidth = [];
            $scope.disk = [];
            $scope.io = [];

            Utilization.utilization(function (error, utilizationData) {
                $scope.utilizationData = utilizationData;
                for (name in $scope.utilizationData) {
                    if ($scope[name]) {
                        $scope[name].push($scope.utilizationData[name]);
                    }
                }
            });

            $scope.days = [];
            for (var i = 1; i <= 30; i++) {
                $scope.days.push(i);
            };

            $scope.gridOrder = [];
            $scope.gridProps = [
                {
                    id: 'item',
                    name: 'Item',
                    sequence: 1,
                    active: true
                },
                {
                    id: 'description',
                    name: 'Description',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'utilization',
                    name: 'Utilization',
                    sequence: 3,
                    active: true
                },
                {
                    id: 'cost',
                    name: 'Cost',
                    sequence: 4,
                    active: true
                }
            ];

            $scope.gridActionButtons = [];

            $scope.enabledCheckboxes = false;
            $scope.searchForm = false;
            $scope.exportFields = {
                ignore: []
            };



        }]);
}(window.JP.getModule('utilization')));
