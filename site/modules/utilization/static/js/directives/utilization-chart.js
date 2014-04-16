'use strict';

(function (app) {
    app.directive('utilizationChart', ['$location',
        function ($location) {
            return {
                scope: {
                    usage: '=',
                    name: '=',
                    colorTotal: '=',
                    colorDaily: '=',
                    caption: '='
                },
                restrict: 'EA',

                link: function ($scope, $element, $attrs) {
                    var graph = null;
                    var legend = null;
                    var now = new Date();
                    var graphData = {daily: [
                        {x: 0, y: 0}
                    ], cumulative: [
                        {x: 0, y: 0}
                    ]};
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
                                    color: $scope.colorDaily || '#274c5c',
                                    data: graphData.daily
                                },
                                {
                                    name: 'Total',
                                    color: $scope.colorTotal || '#549dc0',
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
                            width: 95,
                            tickFormat: function (num) {
                                return $scope.format(num);
                            },
                            graph: graph
                        });
                        legend = new Rickshaw.Graph.Legend({
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
                        graph.series[0].color = $scope.colorDaily || '#274c5c';
                        graph.series[1].color = $scope.colorTotal || '#549dc0';
                        legend.render();
                        var daysMax = data.days;
                        if (data.format) {
                            $scope.format = data.format;
                        }
                        $scope.total = data.total;
                        $scope.year = data.year;
                        $scope.month = data.month;
                        var currentMonthDaysMax = daysMax;
                        if (now.getFullYear() === data.year && now.getMonth() + 1 === data.month) {
                            currentMonthDaysMax = now.getDate() - 1;
                        }
                        var amountData = data.amount;
                        graphData.daily.splice(0);
                        graphData.cumulative.splice(0);
                        var cumulativeAmount = 0;
                        ticksData.splice(0);
                        for (var day = 1; day <= daysMax; day++) {
                            var dayStr = data.year + '-' + pad(data.month) + '-' + pad(day);
                            var amount = amountData[dayStr] || 0;
                            ticksData.push(day);
                            graphData.daily.push({x: day, y: amount});
                            graphData.cumulative.push({x: day, y: day <= currentMonthDaysMax ? cumulativeAmount : 0});
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

                    $scope.getMonthTitle = function () {
                        var output = '';
                        if ($scope.month !== now.getMonth() + 1 || $scope.year !== now.getFullYear()) {
                            var monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'];
                            output += monthNames[$scope.month] + ' ';
                        }
                        if ($scope.name === 'currentspend') {
                            output += (output) ? 'Monthly ' : 'Current ';
                        }
                        return output;
                    };

                    $scope.getMonthDesc = function () {
                        return ($scope.name === 'currentspend') ? 'month to date' : 'this month';
                    };

                    $scope.projected = function (num) {
                        var days = daysInMonth(now.getFullYear(), now.getMonth() + 1);
                        return $scope.format((num * days) / now.getDate());
                    };

                    $scope.showProjected = function () {
                        return ($scope.total >= 0 && $scope.name === 'currentspend' && $scope.month === now.getMonth() + 1);
                    };

                    function daysInMonth(year, month) {
                        return new Date(year, month, 0).getDate();
                    }

                },

                templateUrl: 'utilization/static/partials/utilization-chart.html'
            };
        }
    ]);
}(window.JP.getModule('utilization')));