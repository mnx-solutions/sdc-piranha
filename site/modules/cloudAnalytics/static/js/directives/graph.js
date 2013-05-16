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
                var ticktime = null;
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
                        width: $scope.width || 580,
                        height: $scope.height || 180,
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
//                    'stack',
//                    'scatterplot',
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

                $scope.deleteGraph = function () {
                    $scope.ca.deletequeue.push($scope.instrumentations[0].id);
                    $scope.ca.deleteInstrumentations($scope.instrumentations);
                }

                $scope.changeRenderer = function (renderer) {
                    $scope.renderer = renderer;
                }

                $scope.ready = false;

                function updateGraph() {

                        var series = $scope.ca.getSeries(
                            $scope.instrumentations,
                            ticktime
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
                        $scope.ca.changeRange([$scope.instrumentations[0].id], $scope.range);
                    }
                });

                $scope.$watch('endtime', function(newVal) {

                    if(newVal){
                        if(!ticktime) {
                            ticktime = $scope.endtime
                        }

                        if(!$scope.frozen) {
                            if(graph && $scope.ca.polltime() > ticktime) {

                                updateGraph();
                                ticktime++;
                            } else if (!graph){
                                updateGraph();
                            }
                        } else {
                            ticktime++;
                        }

                    }
                });

            },
            template:
                '<div class="loading-medium" data-ng-hide="ready"></div>'+
                '<div data-ng-show="ready">' +
                    '<i style="float:right" data-ng-click="deleteGraph()" class="icon-remove-circle" ></i>' +
                    '<br/>' +
                    '<div>{{graphtitle}}</div>' +
                    '<br/>' +
                    '<button  data-ng-hide="heatmap" data-ng-repeat="renderer in renderers" data-ng-click="changeRenderer(renderer)">{{renderer}}</button>' +
                    '<br/><br/>' +
                    '<div class="chart_container_{{$id}}" style="position: relative;">' +
                        '<div id="y_axis_{{$id}}" style="position: absolute;top: 0; bottom: 0; width: 40px;"></div>' +
                        '<div id="chart_{{$id}}" style="position: relative; left: 40px;">' +
                        '<div class="caOverlaid" >' +
                            '<img data-ng-show="heatmap" data-ng-src="data:image/jpeg;base64, {{heatmap}}" />' +
                        '</div>' +
                        '</div>' +
                    '</div><br/>' +
                    '<div id="legend_{{$id}}" style="width:620px;" ></div><br/>' +
                '</div><br/><br/>'
        };
    });
}(window.JP.getModule('cloudAnalytics')));