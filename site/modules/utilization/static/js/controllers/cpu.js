'use strict';

(function (app) {
    app.controller(
        'Utilization.CpuController',
        ['$scope', '$location', 'Utilization', function ($scope, $location, Utilization) {
            $scope.cpu = [];
            $scope.days = [];

            Utilization.utilization(function (error, utilizationData) {
                $scope.cpu.push(utilizationData.cpu);
                $scope.daily = utilizationData.cpu.daily;
            });


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
