'use strict';

(function (app) {
    app.controller(
        'Utilization.DetailsController',
        ['$scope', '$location', 'Utilization', 'requestContext', 'loggingService', 'Account', 'util', function ($scope, $location, Utilization, requestContext, loggingService, Account, util) {
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
                    active: false
                },
                {
                    id: 'package_name',
                    name: 'Package Name',
                    sequence: 4,
                    active: false
                },
                {
                    id: 'datacenter_name',
                    name: 'Data Center',
                    sequence: 5,
                    active: true
                },
                {
                    id: 'cost',
                    name: 'Cost',
                    _order: 'cost',
                    _getter: function (object) {
                        return '$' + util.getReadableCurrencyString(object.cost);
                    },
                    sequence: 9,
                    active: true
                },
                {
                    id: 'first',
                    name: 'First',
                    type: 'date',
                    format: 'yyyy-MM-dd',
                    sequence: 10,
                    active: false
                },
                {
                    id: 'last',
                    name: 'Last',
                    type: 'date',
                    format: 'yyyy-MM-dd',
                    sequence: 11,
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
                                sequence: 6,
                                active: true
                            },
                            {
                                id: 'out',
                                name: 'Out',
                                _order: 'out',
                                _getter: function (object) {
                                    return $scope.chartData.format(object.out);
                                },
                                sequence: 7,
                                active: true
                            }
                        ]
                    );
                } else if ($scope.type === 'compute') {
                    $scope.gridProps = $scope.gridProps.concat([
                        {
                            id: 'ram',
                            name: 'RAM',
                            sequence: 6,
                            active: true
                        },
                        {
                            id: 'hours',
                            name: 'Hours',
                            _order: 'hours',
                            sequence: 7,
                            active: true
                        },
                        {
                            id: 'gb_hours',
                            name: 'GB Hours',
                            _order: 'gb_hours',
                            sequence: 8,
                            active: true
                        }
                    ]);
                } else if ($scope.type === 'currentspend') {
                    $scope.gridProps = ([
                        {
                            id: 'date',
                            name: 'Date',
                            type: 'date',
                            format: 'yyyy-MM-dd',
                            sequence: 1,
                            active: true
                        },
                        {
                            id: 'cost',
                            name: 'Cost',
                            _order: 'cost',
                            _getter: function (object) {
                                return $scope.chartData.format(object.cost);
                            },
                            sequence: 2,
                            active: true
                        }
                    ]);
                } else if ($scope.type === 'manta') {
                    $scope.gridProps = [
                        {
                            id: 'requests',
                            name: 'Requests',
                            sequence: 1,
                            active: true
                        },
                        {
                            id: 'bandwidthIn',
                            name: 'In',
                            sequence: 2,
                            active: true
                        },
                        {
                            id: 'bandwidthOut',
                            name: 'Out',
                            sequence: 3,
                            active: true
                        },
                        {
                            id: 'cost',
                            name: 'Cost',
                            _order: 'cost',
                            _getter: function (object) {
                                return $scope.chartData.format(object.cost);
                            },
                            sequence: 4,
                            active: true
                        },
                        {
                            id: 'date',
                            name: 'Date',
                            type: 'date',
                            format: 'yyyy-MM-dd',
                            sequence: 5,
                            active: true
                        }
                    ];
                }
                var propsChanged = {props: $scope.gridProps};
                if ($scope.features.manta === 'enabled') {
                    propsChanged.gridUserConfig = $scope.gridUserConfig;
                }
                $scope.$broadcast('propsChanged', propsChanged);
            };

            var loadData = function (event, context) {
                if (context && context.hasActionChanged()) {
                    return;
                }
                $scope.type = requestContext.getParam('type');

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = Account.getUserConfig().$child($scope.type);
                }
                refreshProps();
                $scope.caption = {
                    bandwidth: 'Bandwidth Utilized',
                    compute: 'Compute Utilized',
                    currentspend: 'Spend',
                    manta: 'Manta Utilized'
                }[$scope.type];
                $scope.pageTitle = {
                    bandwidth: 'Bandwidth Usage',
                    compute: 'Compute Usage',
                    currentspend: 'Spend',
                    manta: 'Manta Usage'
                }[$scope.type];
                $scope.colorDaily = {
                    currentspend: '#7d2c21'
                }[$scope.type];
                $scope.colorTotal = {
                    currentspend: '#ed4f34'
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

            $scope.gridOrder = ['-date'];
            $scope.searchForm = true;
            $scope.exportFields = {
                ignore: []
            };
        }]
    );
}(window.JP.getModule('utilization')));