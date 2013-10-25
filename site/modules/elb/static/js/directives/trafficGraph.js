'use strict';

(function (app) {
    app.directive('trafficgrid', function () {
        return {
            priority: 500,
            restrict: 'A',
            transclude: true,
            replace: true,
            scope: {
                traffic: '=trafficgrid'
            },

            link: function ($scope, $element, $attrs) {
                function drawGraph(inbound, outbound) {

                    function createConfig(config) {
                        return angular.extend({
                            stroke: true,
                            preserve: true,
                            width: 272,
                            height: 176,
                            strokeWidth: 2,
                            dotSize: 2
                        }, config);
                    }


                    var graph = new Rickshaw.Graph(createConfig({
                        element: $element.get()[0],
                        renderer: 'line',
                        series: [
                            {
                                color: 'lightblue',
                                data: inbound,
                                name: 'inbound'
                            },
                            {
                                color: 'gray',
                                data: outbound,
                                name: 'outbound'
                            }
                        ]
                    }));
                    var scatterPlot = new Rickshaw.Graph(createConfig({
                        element: $('<div></div>').get()[0],
                        renderer: 'scatterplot',
                        series: [
                            {
                                color: 'blue',
                                data: inbound,
                                name: 'inbound'
                            },
                            {
                                color: 'black',
                                data: outbound,
                                name: 'outbound'
                            }
                        ]
                    }));

                    graph.render();
                    scatterPlot.render();

                    scatterPlot.element.firstChild.style.position = 'absolute';
                    $element.prepend(scatterPlot.element.firstChild);

                    if ($attrs.title) {
                        $element.prepend('<div style="position: absolute; padding-left: 8px;">' + $attrs.title + '</div>')
                    }

                    new Rickshaw.Graph.HoverDetail({
                        graph: graph
                    });

                    var legend = new Rickshaw.Graph.Legend({
                        graph: graph,
                        element: $('<div>').get()[0]
                    });

                    new Rickshaw.Graph.Behavior.Series.Toggle({
                        graph: graph,
                        legend: legend
                    });

                    var xAxis = new Rickshaw.Graph.Axis.Time({
                        graph: graph
                    });
                    xAxis.render();

                    var yAxis = new Rickshaw.Graph.Axis.Y({
                        graph: graph,
                        tickFormat: Rickshaw.Fixtures.Number.formatKMBT
                    });

                    yAxis.render();
                }

                $scope.$watch('traffic', function (data) {

                    if (!data) {
                        return;
                    }

                    drawGraph(data.inbound, data.outbound);
                });
            }
        };
    });
}(window.JP.getModule('elb')));