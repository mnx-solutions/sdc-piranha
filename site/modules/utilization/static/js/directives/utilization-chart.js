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
                    var now = new Date();
                    var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                    $scope.format = function (num) { return num; };
                    var initGraph = function () {
                        graph = new Rickshaw.Graph({
                            element: $element.find('#chart_' + $scope.$id)[0],
                            renderer: 'bar',
                            width: 570,
                            height: 200,
                            series: [
                                {
                                    color: '#274c5c',
                                    data: graphData.daily
                                },
                                {
                                    color: '#549dc0',
                                    data: graphData.cumulative
                                }
                            ]
                        });
                        var ticksData = [];
                        for (var i = 1; i <= daysInMonth; i++) {
                            ticksData.push(i);
                        }
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
                        graph.render();
                    };
                    var pad = function (num) {
                        return num < 10 ? '0' + num : num;
                    };

                    $scope.$watch('usage', function (data) {
                        if (!data) {
                            return;
                        }
                        if (!graph) {
                            initGraph();
                        }
                        if (data.format) {
                            $scope.format = data.format;
                        }
                        graphData.daily.splice(0);
                        graphData.cumulative.splice(0);
                        var cumulativeAmount = 0;
                        for (var day = 1; day <= daysInMonth; day++) {
                            var dayStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(day);
                            var amount = data[dayStr] || 0;
                            graphData.daily.push({x: day, y: amount});
                            graphData.cumulative.push({x: day, y: amount ? cumulativeAmount : 0});
                            cumulativeAmount += amount;
                        }
                        $scope.totalAmount = cumulativeAmount;
                        graph.update();
                    });

                    $scope.navigateDetails = function () {
                        if ($scope.name) {
                            $location.path('/utilization/' + $scope.name);
                        }
                    };
                },

                templateUrl: 'utilization/static/partials/utilization-chart.html'
            };
        }
    ]);
}(window.JP.getModule('utilization')));