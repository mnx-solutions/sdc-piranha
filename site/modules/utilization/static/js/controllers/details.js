'use strict';

(function (app) {
    app.controller(
        'Utilization.DetailsController',
        ['$scope', '$location', 'Utilization', 'requestContext', 'loggingService', function ($scope, $location, Utilization, requestContext, loggingService) {
            requestContext.setUpRenderContext('utilization.details', $scope);
            var baseProps = [
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
                    id: 'datacenter_name',
                    name: 'Data Center',
                    sequence: 5,
                    active: false
                },
                {
                    id: 'brand',
                    name: 'Brand',
                    sequence: 6,
                    active: false
                },
                {
                    id: 'running',
                    name: 'Running',
                    sequence: 7,
                    active: false
                },
                {
                    id: 'first',
                    name: 'First',
                    type: 'date',
                    sequence: 8,
                    active: false
                },
                {
                    id: 'last',
                    name: 'Last',
                    type: 'date',
                    sequence: 9,
                    active: false
                }
            ];

            var refreshProps = function () {
                $scope.gridProps = angular.copy(baseProps);
                if ($scope.type === 'bandwidth') {
                    $scope.gridProps = $scope.gridProps.concat(
                        [
                            {
                                id: 'in',
                                name: 'In',
                                _order: 'in',
                                _getter: function (object) {
                                    return $scope.chartData.format(object.in);
                                },
                                sequence: 10,
                                active: true
                            },
                            {
                                id: 'out',
                                name: 'Out',
                                _order: 'out',
                                _getter: function (object) {
                                    return $scope.chartData.format(object.out);
                                },
                                sequence: 11,
                                active: true
                            }
                        ]
                    );
                } else if ($scope.type === 'dram') {
                    $scope.gridProps = $scope.gridProps.concat([
                        {
                            id: 'ram',
                            name: 'RAM',
                            sequence: 10,
                            active: true
                        },
                        {
                            id: 'hours',
                            name: 'Hours',
                            _order: 'hours',
                            _getter: function (object) {
                                return $scope.chartData.format(object.hours);
                            },
                            sequence: 11,
                            active: true
                        }
                    ]);
                }
                $scope.$broadcast('propsChanged', $scope.gridProps);
            };

            var loadData = function (event, context) {
                if (context && context.hasActionChanged()) {
                    return;
                }
                $scope.type = requestContext.getParam('type');
                refreshProps();
                $scope.caption = {
                    'bandwidth': 'Bandwidth',
                    'dram': 'DRAM'
                }[$scope.type];
                $scope.unit = {
                    'bandwidth': '',
                    'dram': 'GB Hours'
                }[$scope.type];
                var year = requestContext.getParam('year');
                var month = requestContext.getParam('month');
                Utilization.utilization(year, month, function (error, utilizationData) {
                    $scope.chartData = utilizationData[$scope.type];
                    $scope.gridData = utilizationData[$scope.type].usage;
                });
                loggingService.log('info', 'User navigated to ' + $location.$$path);
                $scope.backLink = '#!/usage/' + year + '/' + month;
            };
            $scope.$on('requestContextChanged', loadData);
            loadData();

            $scope.gridOrder = [];
            $scope.searchForm = true;
            $scope.exportFields = {
                ignore: []
            };
        }]
    );
}(window.JP.getModule('utilization')));