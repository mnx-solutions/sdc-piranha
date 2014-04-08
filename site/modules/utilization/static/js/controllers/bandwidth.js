'use strict';

(function (app) {
    app.controller(
        'Utilization.BandwidthController',
        ['$scope', '$location', 'Utilization', 'requestContext', 'loggingService', function ($scope, $location, Utilization, requestContext, loggingService) {
            requestContext.setUpRenderContext('utilization.bandwidth', $scope);
            var loadData = function (event, context) {
                if (context && !context.startsWith('utilization.bandwidth')) {
                    return;
                }
                var year = requestContext.getParam('year');
                var month = requestContext.getParam('month');
                Utilization.utilization(year, month, function (error, utilizationData) {
                    $scope.chartData = utilizationData.bandwidth;
                    $scope.gridData = utilizationData.bandwidth.usage;
                });
                loggingService.log('info', 'User navigated to ' + $location.$$path);
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
                    id: 'in',
                    name: 'In',
                    _order: 'in',
                    _getter: function (object) {
                        return $scope.chartData.format(object.in);
                    },
                    sequence: 5,
                    active: true
                },
                {
                    id: 'out',
                    name: 'Out',
                    _order: 'out',
                    _getter: function (object) {
                        return $scope.chartData.format(object.out);
                    },
                    sequence: 6,
                    active: true
                }
            ];


            $scope.searchForm = true;
            $scope.exportFields = {
                ignore: []
            };
        }]);
}(window.JP.getModule('utilization')));
