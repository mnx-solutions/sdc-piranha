'use strict';

(function (app) {
    app.controller(
        'Utilization.DramController',
        ['$scope', '$location', 'Utilization', function ($scope, $location, Utilization) {
            $scope.gridData = [];
            $scope.chartData = {};

            Utilization.utilization(function (error, utilizationData) {
                $scope.gridData = utilizationData.dram.usage;
                $scope.chartData = utilizationData.dram.amount;
                $scope.gridData.forEach(function (entry) {
                    entry.hours = $scope.chartData.format(entry.hours);
                });
            });

            $scope.gridOrder = [];
            $scope.gridProps = [
                {
                    id: 'uuid',
                    name: 'UUID',
                    sequence: 1,
                    active: true
                },
                {
                    id: 'alias',
                    name: 'Machine',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'package_uuid',
                    name: 'Package UUID',
                    sequence: 3,
                    active: true
                },
                {
                    id: 'package_name',
                    name: 'Package Name',
                    sequence: 4,
                    active: true
                },
                {
                    id: 'ram',
                    name: 'RAM',
                    sequence: 5,
                    active: true
                },
                {
                    id: 'hours',
                    name: 'Hours',
                    sequence: 6,
                    active: true
                }
            ];

            $scope.exportFields = {
                ignore: []
            };
        }]);
}(window.JP.getModule('utilization')));
