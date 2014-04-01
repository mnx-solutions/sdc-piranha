'use strict';

(function (app) {
    app.controller(
        'Utilization.DramController',
        ['$scope', '$location', 'Utilization', 'requestContext', function ($scope, $location, Utilization, requestContext) {
            requestContext.setUpRenderContext('utilization.dram', $scope);
            var loadData = function () {
                var year = requestContext.getParam('year');
                var month = requestContext.getParam('month');
                Utilization.utilization(year, month, function (error, utilizationData) {
                    $scope.chartData = utilizationData.dram;
                    $scope.gridData = utilizationData.dram.usage;
                });
                $scope.backLink = '#!/utilization/' + year + '/' + month;
            };
            $scope.$on('requestContextChanged', loadData);
            loadData();

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
                    _getter: function (object) {
                        return $scope.chartData.format(object.hours);
                    },
                    sequence: 6,
                    active: true
                }
            ];

            $scope.exportFields = {
                ignore: []
            };
        }]);
}(window.JP.getModule('utilization')));
