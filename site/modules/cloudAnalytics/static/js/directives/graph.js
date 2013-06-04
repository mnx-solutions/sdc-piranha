'use strict';

(function (app, ng, $) {
     app.directive('graph', function () {
        return {
            restrict: "E",
            replace: true,
            scope: {
                options:'='
            },
            link: function ($scope, ca){

                $scope.instrumentations = $scope.options.instrumentations;
                $scope.initCa = true;
                if ($scope.$parent.ca) {
                    $scope.ca = $scope.$parent.ca;
                    $scope.initCa = false;
                } else {
                    (new ca()).then(function(conf) {
                        $scope.ca = conf.data;
                        $scope.initCa = false;
                    })
                }

                var ticktime = null;
                var heatmaptime = null;
                var graph = false;
                var legend = null;


                $scope.heatmap;
                $scope.showGraph = true;
                $scope.loadingText = 'loading...';
                $scope.details = null;

                $scope.getHeatmapDetails = function(e) {

                    var clickpoint = '.chart_container_'+ $scope.$id + ' #clickpoint';
                    if(e && e.offsetX && e.offsetY && heatmaptime) {
//                        $('#clickpoint_' + $scope.$id).css({'top': e.offsetY, 'left': e.offsetX})
//                        $(popSelector).popover('hide');
                        $scope.ca.getHeatmapDetails({
                            instrumentation: $scope.instrumentations[0],
                            location:{
                                x: e.offsetX,
                                y: e.offsetY
                            },
                            range: $scope.$parent.currentRange,
                            endtime: heatmaptime
                        }, function(values) {
                            if(values && values[0], values[0].present && Object.keys(values[0].present)) {
                                var details = '';
                                for(var name in values[0].present) {
                                    details += name + ':' + values[0].present[name] + '<br/>';
                                }
                                $scope.details = details;
                                if(details != '') {
                                    $(clickpoint).css({'top': e.offsetY, left: e.offsetX});
                                    $(clickpoint).popover('show');
                                } else {
                                    $(clickpoint).popover('hide');
                                }

                            } else {
                                $scope.details = null;
                            }
                        })
                    }


                }

                function renderLegend(graph) {
                    legend = true;
                    if(graph.series[0].name !== 'default') {
                        legend = new Rickshaw.Graph.Legend({
                            graph: graph,
                            element: document.querySelector('#legend_' + $scope.$id)
                        });
                    }
                }

                function renderXAxis(graph) {
                    var axis = new Rickshaw.Graph.Axis.Time({
                        'graph': graph
                    });
                    axis.render();
                    return axis;
                }

                function renderYAxis(graph) {
                    var axis = new Rickshaw.Graph.Axis.Y( {
                        graph: graph,
                        orientation: 'left',
                        tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
                        element: document.getElementById('y_axis_' + $scope.$id)
                    } );
                    axis.render();
                    return axis;
                }

                function renderHover(graph) {
                    new Rickshaw.Graph.HoverDetail( {
                        graph: graph
                    });
                }

                function createGraph(series) {
                    var conf = {
                        element: document.querySelector("#chart_" + $scope.$id),
                        renderer: $scope.activeRenderer,
                        width: $scope.width || 580,
                        height: $scope.height || 180,
                        series: series
                    };
                    var graph = new Rickshaw.Graph(conf);
                    graph.render();

                    if(!$scope.heatmap) {
                        renderLegend(graph);
                    }
                    renderXAxis(graph);
                    renderYAxis(graph);
                    renderHover(graph);

                    return graph;
                }

                $scope.activeRenderer = 'bar';
                $scope.renderers = [
                    'area',
                    'bar',
                    'line'
                ];

                $scope.$watch('activeRenderer', function() {
                    if(graph) {
                        graph.configure({
                            renderer:$scope.activeRenderer
                        });
                        graph.render();
                    }
                });

                $scope.toggleGraph = function () {
                    $scope.showGraph = !$scope.showGraph;
                }

                $scope.deleteGraph = function () {
                    $scope.ca.deleteInstrumentations($scope.instrumentations);
                }

                $scope.changeRenderer = function (renderer) {
                    $scope.activeRenderer = renderer;
                }

                $scope.ready = false;

                function updateGraph() {
                    var series = $scope.ca.getSeries(
                        $scope.instrumentations,
                        ticktime
                    );

                    if ($scope.instrumentations[0]['value-arity'] === 'numeric-decomposition') {
                        $scope.heatmap = $scope.ca.instrumentations[$scope.instrumentations[0]._datacenter][$scope.instrumentations[0].id].heatmap;
                    }

                    if(series && series.length) {
                        if(!graph) {
                            graph = createGraph(series);
                            if($scope.heatmap) {
                                var clickpoint = '.chart_container_'+ $scope.$id + ' #clickpoint';
                                $(clickpoint).popover({
                                    title: 'Details',
                                    html: true,
                                    trigger: 'manual',
                                    content:function() {
                                        return $scope.details;
                                    }
                                })
                            }
                            $scope.ready = true;
                        } else {
                            graph.series.splice(0, graph.series.length);
                            graph.series.push.apply(graph.series, series);
                            graph.render();
                            if(legend) {
                                document.querySelector('#legend_' + $scope.$id).innerHTML = "";
                                renderLegend(graph);
                            }
                        }
                    }
                }

                $scope.$watch('$parent.currentRange', function(newVal) {
                    if(newVal){
                        $scope.ca.changeRange($scope.instrumentations, $scope.$parent.currentRange);
                        if(!$scope.initCa) {
                            updateGraph();
                        }
                    }
                });

                $scope.$watch('$parent.endtime', function(newVal) {

                    if(newVal){
                        if(!ticktime) {

                            ticktime = $scope.$parent.endtime;
                            heatmaptime = ticktime -1;
                        }

                        if(!$scope.$parent.frozen) {
                            if(graph && $scope.ca.polltime() > ticktime && !$scope.initCa) {
                                updateGraph();
                                ticktime++;
                            } else if (!graph){
                                updateGraph();
                            }
                            heatmaptime = ticktime -1;
                        } else {
                            ticktime++;
                        }

                    }
                });

            },
            template:
                '<div>' +
                        '<div class="btn-group" style="width:620px;">' +
                            '<button data-ng-click="toggleGraph()" id="control_{{$id}}" data-ng-class="{disabled: !ready, btn: true}" style="width:90%;">{{ready && options.title || loadingText}}</button>' +
                            '<button data-ng-click="deleteGraph()" class="btn" title="delete graph" style="width:10%;"><i class="icon-remove-circle"></i></button>' +
                        '</div>' +
                        '<br/>' +
                    '<div data-ng-show="showGraph && ready">' +
                            '<div>' +
                            '<div class="btn-group" data-toggle="buttons-radio">' +
                                '<button class="btn btn-mini default-margin default-margin-mini {{renderer == activeRenderer && \'active\' || \'\'}}" data-ng-hide="heatmap" data-ng-repeat="renderer in renderers" data-ng-click="changeRenderer(renderer)">{{renderer}}</button>' +
                            '</div>' +
                            '<br/><br/>' +

                            '<div class="chart_container_{{$id}}" style="position: relative;">' +

                                '<div id="y_axis_{{$id}}" style="position: absolute;top: 0; bottom: 0; width: 40px;"></div>' +
                                '<div id="chart_{{$id}}" style="position: relative; left: 40px;">' +
                                '<div id="clickpoint" style="position:absolute;height:0px;width:0px;"></div>' +
                                '<div class="caOverlaid">' +

                                '<img data-ng-show="heatmap" data-ng-click="getHeatmapDetails($event)" data-ng-src="data:image/jpeg;base64, {{heatmap}}" />' +
                                '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div id="legend_{{$id}}" style="width:620px"></div>' +
                    '</div><hr />' +
                '</div>'
        };
    });
}(window.JP.getModule('cloudAnalytics'), window.angular, window.jQuery));