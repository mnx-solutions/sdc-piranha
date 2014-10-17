'use strict';

(function (app) {
    app.directive('adviserGraph', function ($timeout) {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                type: '=',
                showDeleteBtn: '=?'
            },
            link: function ($scope, $element, $attr) {
                $scope.showGraph = true;
                $scope.loadingText = 'Loading...';
                var graph = false;
                var legend = null;
                var units = {
                    'seconds': [
                        { mag: -9, str: 'n'},
                        { mag: -6, str: 'µ' },
                        { mag: -3, str: 'm' },
                        { mag: 0, str: ''}
                    ],
                    'bytes': [
                        { mag: 0, str: ''},
                        { mag: 10, str: 'K' },
                        { mag: 20, str: 'M' },
                        { mag: 30, str: 'G' },
                        { mag: 40, str: 'T' },
                        { mag: 50, str: 'P' }
                    ]
                };
                function getMagnitude(value, base) {
                    var magnitude = Math.log(value) / Math.log(base);
                    if ((Math.abs(Math.round(magnitude) - magnitude)) < 0.000000001) {
                        magnitude = Math.round(magnitude);
                    }
                    return magnitude;
                }

                function formatUnit(y) {
                    var type = $scope.type.options.type;
                    if (type && typeof (type) === 'object') {
                        var unitstr = '';
                        if (y === 0) {
                            return 0;
                        }

                        if (!type.base) {
                            if (type.abbr) {
                                unitstr = type.abbr;
                            } else if (type.unit) {
                                unitstr = type.unit;
                            }
                        } else {
                            var power = type.power || 0;
                            var mag = getMagnitude(y, type.base) + power;

                            if (units[type.unit]) {
                                var unit = units[type.unit].reduce(function (cur, obj) {
                                    return (obj.mag <= mag) ? obj : cur;
                                });

                                mag = unit.mag;
                                unitstr = unit.str + (type.abbr || " " + type.unit);
                            }

                            y = y / Math.pow(type.base, mag - power);
                            y = Math.round(parseFloat(y) * 100) / 100;
                        }

                        return y + unitstr;
                    }

                    return y;
                }
                function formatYAxis(y) {
                    return formatUnit(y, true);
                }
                function renderXAxis(graph) {
                    var axis = new Rickshaw.Graph.Axis.Time({
                        'graph': graph
                    });

                    axis.render();
                    return axis;
                }
                function renderYAxis(graph) {
                    var axis = new Rickshaw.Graph.Axis.Y({
                        element: $element.find('#y_axis_' + $scope.$id)[0],
                        graph: graph,
                        orientation: 'left',
                        tickFormat: formatYAxis
                    });

                    axis.render();
                    axis.setSize({width: 60, height: 170});
                    return axis;
                }
                var initGraph = function () {
                    $scope.activeRenderer = 'line';
                    var series = [];
                    $scope.type.data.forEach(function (array, index) {
                        series.push({
                            name: $scope.type.options.legends[index],
                            color: $scope.type.options.colors[index],
                            data: array
                        });
                    });
                    var graph = new Rickshaw.Graph({
                        element: $element.find('#chart_' + $scope.$id)[0],
                        renderer: $scope.activeRenderer,
                        width: 410,
                        height: 150,
                        stroke: true,
                        preserve: true,
                        series: series
                    });
                    renderXAxis(graph);
                    renderYAxis(graph);

                    legend = new Rickshaw.Graph.Legend({
                        graph: graph,
                        element: $element.find('#legend_' + $scope.$id)[0]
                    });

                    graph.render();

                    $scope.$watchCollection('type.data[0]', function () {
                        graph.update();
                    });

                    $scope.renderers = [
                        'area', 'bar', 'line'
                    ];

                    $scope.ready = true;

                    $scope.$watch('activeRenderer', function () {
                        if (graph) {
                            graph.configure({
                                renderer: $scope.activeRenderer
                            });
                            graph.render();
                        }
                    });

                };

                $scope.changeRenderer = function (renderer) {
                    $timeout(function () {
                        $scope.activeRenderer = renderer;
                    });
                };
                $scope.toggleGraph = function () {
                    $scope.showGraph = !$scope.showGraph;
                };

                $scope.deleteGraph = function () {
                    delete $scope.$parent.graphs[$scope.type.metric];
                };

                $scope.$watchCollection('type', function (item) {
                    if (item.data && item.data.length) {
                        $timeout(function () {
                            initGraph();
                        });
                    }
                });

            },
            templateUrl: 'docker/static/partials/docker-chart.html'
        };
    });
}(window.JP.getModule('docker')));