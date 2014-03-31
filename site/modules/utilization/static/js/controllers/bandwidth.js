'use strict';

(function (app) {
    app.controller(
        'Utilization.BandwidthController',
        ['$scope', '$location', 'Utilization', function ($scope, $location, Utilization) {
            $scope.gridData = [];
            $scope.chartData = {};

            Utilization.utilization(function (error, utilizationData) {
                $scope.chartData = utilizationData.bandwidth.amount;
                $scope.gridData = utilizationData.bandwidth.usage.map(function (entry) {
                    entry.in = $scope.chartData.format(entry.in);
                    entry.out = $scope.chartData.format(entry.out);
                    return entry;
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
                    id: 'in',
                    name: 'In',
                    sequence: 5,
                    active: true
                },
                {
                    id: 'out',
                    name: 'Out',
                    sequence: 6,
                    active: true
                }
            ];

            $scope.exportFields = {
                ignore: []
            };
        }]);
}(window.JP.getModule('utilization')));
