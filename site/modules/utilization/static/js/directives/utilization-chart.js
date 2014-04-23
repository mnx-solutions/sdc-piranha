'use strict';

(function (app) {
    app.directive('utilizationChart', ['$location',
        function ($location) {
            return {
                scope: {
                    usage: '=',
                    name: '=',
                    caption: '=',
                    unit: '='
                },
                restrict: 'EA',

                link: function ($scope, $element, $attrs) {
                    var graph = null;
                    var graphData = {daily: [{x: 0, y: 0}], cumulative: [{x: 0, y: 0}]};
                    var ticksData = [];
                    for (var i = 1; i <= 31; i++) {
                        ticksData.push(i);
                    }
                    $scope.chartLoading = true;
                    $scope.format = function (num) { return num; };
                    var initGraph = function () {
                        graph = new Rickshaw.Graph({
                            element: $element.find('#chart_' + $scope.$id)[0],
                            renderer: 'bar',
                            width: 570,
                            height: 200,
                            series: [
                                {
                                    name: 'Daily',
                                    color: '#274c5c',
                                    data: graphData.daily
                                },
                                {
                                    name: 'Total',
                                    color: '#549dc0',
                                    data: graphData.cumulative
                                }
                            ]
                        });
                        new Rickshaw.Graph.Axis.X({
                            element: $element.find('#x_axis_' + $scope.$id)[0],
                            graph: graph,
                            orientation: 'bottom',
                            tickValues: ticksData
                        });
                        new Rickshaw.Graph.Axis.Y({
                            element: $element.find('#y_axis_' + $scope.$id)[0],
                            orientation: 'left',
                            tickFormat: function (num) {
                                return $scope.format(num);
                            },
                            graph: graph
                        });
                        new Rickshaw.Graph.Legend({
                            graph: graph,
                            element: $element.find('#legend_' + $scope.$id)[0]
                        });

                        graph.render();
                    };
                    var pad = function (num) {
                        num = parseInt(num, 10);
                        return num < 10 ? '0' + num : num;
                    };

                    $scope.$watch('usage', function (data) {
                        if (!data) {
                            return;
                        }
                        if (!graph) {
                            initGraph();
                        }
                        var daysMax = data.days;
                        if (data.format) {
                            $scope.format = data.format;
                        }
                        $scope.total = data.total;
                        $scope.year = data.year;
                        $scope.month = data.month;
                        var currentMonthDaysMax = daysMax;
                        var now = new Date();
                        if (now.getFullYear() === data.year && now.getMonth() + 1 === data.month) {
                            currentMonthDaysMax = now.getDate();
                        }
                        var amountData = data.amount;
                        graphData.daily.splice(0);
                        graphData.cumulative.splice(0);
                        var cumulativeAmount = 0;
                        ticksData.splice(0);
                        for (var day = 1; day <= daysMax; day++) {
                            var dayStr = data.year + '-' + pad(data.month) + '-' + pad(day);
                            var zeroValue = day < currentMonthDaysMax ? 0.00000000000000001 : 0;
                            var amount = amountData[dayStr] || zeroValue;
                            ticksData.push(day);
                            graphData.daily.push({x: day, y: amount});
                            graphData.cumulative.push({x: day, y: amount ? cumulativeAmount : 0});
                            cumulativeAmount += amount;
                        }
                        graph.update();
                        $scope.chartLoading = false;
                    });

                    $scope.$on('requestContextChanged', function() {
                        $scope.chartLoading = true;
                    });

                    $scope.navigateDetails = function () {
                        if ($scope.name) {
                            $location.path('/usage/' + $scope.name + '/' + $scope.year + '/' + $scope.month);
                        }
                    };

                    $scope.getMonthDesc = function () {
                        var now = new Date();
                        if (!$scope.year || $scope.year === now.getFullYear() && $scope.month === now.getMonth() + 1) {
                            return 'this month';
                        }
                        var monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];
                        return 'in ' + monthNames[$scope.month] + ' ' + $scope.year;
                    }
                },

                templateUrl: 'utilization/static/partials/utilization-chart.html'
            };
        }
    ]);
}(window.JP.getModule('utilization')));