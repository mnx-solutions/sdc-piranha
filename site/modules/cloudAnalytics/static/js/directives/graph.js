'use strict';

(function (app) {
     app.directive('graph', function (caBackend, $filter, $timeout) {
        return {
            restrict: "E",
            scope: {
                instrumentations:'=',
                ca:'=',
                endtime:'=',
                frozen:'=',
                range:'=',
                graphtitle: '='
            },
            link: function ($scope){

                var graph = false;
                $scope.heatmap;

                function createLegend(graph) {
                    var legend = new Rickshaw.Graph.Legend({
                        graph: graph,
                        element: document.querySelector('#legend_' + $scope.$id)
                    });
                }

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
                        element: document.getElementById('y_axis_' + $scope.$id)
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
                        element: document.querySelector("#chart_" + $scope.$id),
                        renderer: $scope.renderer,
                        width: $scope.width || 640,
                        height: $scope.height || 200,
                        series: series
                    };
                    var graph = new Rickshaw.Graph(conf);
                    graph.render();

                    if(!$scope.heatmap) {
                        createLegend(graph);
                    }

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
                $scope.ready = false;

                function updateGraph() {

                        var series = $scope.ca.getSeries(
                            $scope.instrumentations,
                            $scope.endtime
                        );

                        if ($scope.instrumentations[0]['value-arity'] === 'numeric-decomposition') {
                            $scope.heatmap = $scope.ca.instrumentations[$scope.instrumentations[0].id].heatmap;
                        }

                        if(series && series.length) {
                            if(!graph) {
                                graph = createGraph(series);
                                $scope.ready = true;
                            } else {
                                graph.series.splice(0, graph.series.length);
                                graph.series.push.apply(graph.series, series);
                                graph.render();
                            }
                        }
                }


                $scope.$watch('range', function(newVal) {
                    if(newVal){
                        $scope.ca.instrumentations[$scope.instrumentations[0].id].range = $scope.range;
                    }
                });

                $scope.$watch('endtime', function(newVal) {
                    if(newVal){
                        if(!$scope.frozen) {
                            updateGraph();
                        }

                    }
                });

            },
            template:
                '<div class="loading-medium" data-ng-hide="ready"></div>'+
                '<div data-ng-show="ready">' +
                    '<select data-ng-hide="heatmap" data-ng-model="renderer" data-ng-options="val as val for (key, val) in renderers"></select>' +
                    '<br/>' +
                    '<div>{{graphtitle}}</div>' +
                    '<br/>' +
                    '<div class="chart_container_{{$id}}" style="position: relative;">' +
                        '<div id="y_axis_{{$id}}" style="position: absolute;top: 0; bottom: 0; width: 40px;"></div>' +
                        '<div id="chart_{{$id}}" style="position: relative; left: 40px;">' +
                        '<div class="caOverlaid" >' +
                            '<img data-ng-show="heatmap" data-ng-src="data:image/jpeg;base64, {{heatmap}}" />' +
                        '</div>' +
                        '</div>' +
                    '</div><br/>' +
                    '<div id="legend_{{$id}}" style="width:680px;" ></div><br/>' +
//                    '<button data-ng-click="deleteInstrumentation()">Delete</button></div>' +
                '</div><br/><br/>'
        };
    });
}(window.JP.getModule('cloudAnalytics')));