'use strict';

(function (app) {
     app.directive('graph', function (caBackend, $filter, $timeout) {
        return {
            restrict: "E",
            scope: {
                options:'=',
                ca:'=',
                title: '='
            },
            link: function ($scope){

                $scope.instrumentations = [];

                var graph = false;
                $scope.heatmap;

                function createLegend(graph) {
                    var legend = new Rickshaw.Graph.Legend({
                        graph: graph,
                        element: document.querySelector('#legend_' + $scope.$id)
                    });
//                    var shelving = new Rickshaw.Graph.Behavior.Series.Toggle({
//                        graph: graph,
//                        legend: legend
//                    });
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
                        width: 640,
                        height: 200,
                        series: series
                    };
                    var graph = new Rickshaw.Graph(conf);
                    graph.render();
//                    createRange(graph);
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
                                $scope.ready = true;
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

                    if(!$scope.title) {
                        $scope.options;
                        var opt = $scope.options[0];
                        var title = opt.module + ' ' +  opt.stat
                        if(opt.decomposition.length > 0){
                            title += ' decomposed by ' + opt.decomposition[0]
                        }
                        if(opt.decomposition.length == 2) {
                            title += ' and' + opt.decomposition[1];
                        }

                        $scope.title = title;
                    }

                    $scope.startTime = Math.floor(instrumentations[0].crtime / 1000);
                    $scope.instrumentations = instrumentations;



                    updateGraph();
                });

//                $scope.deleteInstrumentation = function() {
//                    $scope.ca.deleteInstrumentation($scope.instrumentations[0]);
//                }


            },
            template:
                '<div data-ng-show="ready">' +
                    '<select data-ng-hide="heatmap" data-ng-model="renderer" data-ng-options="val as val for (key, val) in renderers"></select>' +
                    '<br/>' +
                    '<div>{{title}}</div>' +
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