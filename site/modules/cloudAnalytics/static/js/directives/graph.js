'use strict';

(function (app) {
     app.directive('graph', function (caBackend, $filter, $timeout) {
        return {
            restrict: "E",
            scope: {
                options:'=',
                ca:'='
            },
            link: function ($scope){

                $scope.instrumentations = [];

                var graph = false;
                $scope.heatmap;

                function createXAxis(graph) {
                    var axis = new Rickshaw.Graph.Axis.Time({
                        'graph': graph
                    });
                    axis.render();
                    return axis;
                }
                function createYAxis(graph) {
                    var axis = new Rickshaw.Graph.Axis.Y( {
                        graph: graph,
                        orientation: 'left',
                        tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
                        element: document.getElementById('y_axis')
                    } );
                    axis.render();
                    return axis;
                }
                function createHover(graph) {
                    new Rickshaw.Graph.HoverDetail( {
                        graph: graph
                    });
                }
                function createGraph(series) {
                    var conf = {
                        element: document.querySelector("#chart"),
                        renderer: $scope.renderer,
                        width: 640,
                        height: 200,
                        series: series
                    };
                    var graph = new Rickshaw.Graph(conf);
                    graph.render();
//                    createRange(graph);
                    createXAxis(graph);
                    createYAxis(graph);
                    createHover(graph);

                    return graph;
                }

                $scope.renderer = 'bar';
                $scope.renderers = [
                    'area',
                    'stack',
                    'scatterplot',
                    'bar',
                    'line'
                ];

                $scope.$watch('renderer', function() {
                    if(graph) {
                        graph.configure({
                            renderer:$scope.renderer
                        });
                        graph.render();
                    }
                });

                var i = -1;
                function updateGraph() {

                    if($scope.ca.hasAnyChanged($scope.instrumentations)) {

                        var series = $scope.ca.getSeries(
                            $scope.instrumentations,
                            $scope.startTime + i
                        );

                        if ($scope.instrumentations[0]['value-arity'] === 'numeric-decomposition') {
                            $scope.heatmap = $scope.ca.instrumentations[$scope.instrumentations[0].id].heatmap;
                        }

                        i++
                        if(series && series.length) {
                            if(!graph) {
                                graph = createGraph(series);
                            } else {
                                graph.series.splice(0, graph.series.length);
                                graph.series.push.apply(graph.series, series);
                                graph.render();
                            }

                        }
                    }

                    $timeout(updateGraph, 1000);
                }

                $scope.ca.createInstrumentations($scope.options, function(instrumentations){
                    $scope.startTime = Math.floor(instrumentations[0].crtime / 1000);
                    $scope.instrumentations = instrumentations;
                    updateGraph();
                });

//                $scope.deleteInstrumentation = function() {
//                    $scope.ca.deleteInstrumentation($scope.instrumentations[0]);
//                }


            },
            template:
                '<select data-ng-model="renderer" data-ng-options="val as val for (key, val) in renderers"></select>' +
                '<div id="instrumentation"></div><div id="slider_{{instrumentation.id}}"></div> <br/><br/>' +
                '<div class="chart_container" style="position: relative;">' +
                    '<div id="y_axis" style="position: absolute;top: 0; bottom: 0; width: 40px;"></div>' +
                    '<div id="chart" style="position: relative; left: 40px;">' +
                    '<div class="caOverlaid" >' +
                        '<img data-ng-show="heatmap" data-ng-src="data:image/jpeg;base64, {{heatmap}}" />' +
                    '</div>' +
                    '</div>' +
                '</div>' +
                '<button data-ng-click="deleteInstrumentation()">Delete</button></div>'
        };
    });
}(window.JP.getModule('cloudAnalytics')));