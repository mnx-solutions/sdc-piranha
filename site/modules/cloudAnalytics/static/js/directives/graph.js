'use strict';

(function (app, ng, $) {
     app.directive('graph', function (util, ca, localization) {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                options:'='
            },

            link: function ($scope) {
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
                var units = {
                    'seconds' : [
                        { mag : -9, str : 'n'},
                        { mag : -6, str : 'µ' },
                        { mag : -3, str : 'm' },
                        { mag : 0, str : ''}
                    ],
                    'bytes' : [
                        { mag : 0, str : ''},
                        { mag : 10, str : 'K' },
                        { mag : 20, str : 'M' },
                        { mag : 30, str : 'G' },
                        { mag : 40, str : 'T' },
                        { mag : 50, str : 'P' }
                    ]
                };

                $scope.heatmap; //REVIEW: Wut?
                $scope.showGraph = true;
                $scope.loadingText = 'loading...';
                $scope.details = null;

                $scope.getHeatmapDetails = function(e) {
                    var clickpoint = '.chart_container_'+ $scope.$id + ' #clickpoint';
                    if (e && e.offsetX && e.offsetY && heatmaptime) {
                        $scope.ca.getHeatmapDetails({
                            instrumentation: $scope.instrumentations[0],
                            location:{
                                x: e.offsetX,
                                y: e.offsetY
                            },
                            range: $scope.$parent.currentRange,
                            endtime: heatmaptime
                        }, function(err, values) {
                            if (err) {
                                util.error(
                                    localization.translate(
                                        null,
                                        null,
                                        'Error'
                                    ),
                                    localization.translate(
                                        null,
                                        null,
                                        err
                                    ),
                                    function () {}
                                );
                            } else {
                                if (values &&
                                    values[0] &&
                                    values[0].present &&
                                    Object.keys(values[0].present)) {
                                        var details = '';
                                        for (var name in values[0].present) {
                                            details += name + ':' + values[0].present[name] + '<br/>';
                                        }

                                        $scope.details = details;
                                        if (details !== '') {
                                            $(clickpoint).css({'top': e.offsetY, left: e.offsetX});
                                            $(clickpoint).popover('show');
                                        } else {
                                            $(clickpoint).popover('hide');
                                        }

                                } else {
                                    $scope.details = null;
                                }
                            }
                        });
                    }
                };

                function renderLegend(graph) {
                    legend = true;
                    if (graph.series[0].name !== 'default') {
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

                function formatUnit(y, hover) {
                    var type = $scope.instrumentations[0].type;
                    if (type && typeof(type) === 'object') {
                        var unitstr = '';
                        if (y === 0) {
                            return 0;
                        }

                        if (!type.base) {
                            if (type.abbr) {
                                unitstr = type.abbr;
                            } else if(type.unit) {
                                unitstr = type.unit;
                            }
                        } else {
                            var power = type.power || 0;
                            var mag = getMagnitude(y, type.base) + power;

                            if (units[type.unit]) {
                                var unit = units[type.unit].reduce(function(cur, obj) {
                                    return (obj.mag <= mag) ? obj : cur;
                                });

                                mag = unit.mag;
                                unitstr = unit.str + (type.abbr || " " + type.unit);
                            }

                            y = y / Math.pow(type.base, mag - power);
                        }

                        if (hover) {
                            y = y.toFixed(2);
                        } else {
                            y = Math.round(y);
                        }

                        return y + unitstr;
                    }

                    return y;
                }

                function formatHover(y) {
                    return formatUnit(y, true);
                }

                function formatYAxis(y) {
                    return formatUnit(y);
                }

                function renderYAxis(graph) {
                    var axis = new Rickshaw.Graph.Axis.Y({
                        graph: graph,
                        orientation: 'left',
                        tickFormat: formatYAxis,
                        element: document.getElementById('y_axis_' + $scope.$id)
                    });

                    axis.render();
                    return axis;
                }

                function getMagnitude(value, base) {
                    var magnitude = Math.log(value) / Math.log(base);
                    if ((Math.abs(Math.round(magnitude) - magnitude)) < 0.000000001) {
                        magnitude = Math.round(magnitude);
                    }

                    return magnitude;
                }

                function renderHover(graph) {
                    new Rickshaw.Graph.HoverDetail( {
                        graph: graph,
                        yFormatter:formatHover
                    });
                }

                function createGraph(series) {
                    var conf = {
                        element: document.querySelector('#chart_' + $scope.$id),
                        renderer: $scope.activeRenderer,
                        width: $scope.width || 410,
                        height: $scope.height || 150,
                        series: series
                    };

                    var graph = new Rickshaw.Graph(conf);
                    graph.render();

                    if (!$scope.heatmap) {
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
                };

                $scope.deleteGraph = function () {
                    $scope.ca.deleteInstrumentations($scope.instrumentations);
                };

                $scope.changeRenderer = function (renderer) {
                    $scope.activeRenderer = renderer;
                };

                $scope.ready = false;

                function updateGraph() {
                    var series = $scope.ca.getSeries(
                        $scope.instrumentations,
                        ticktime
                    );

                    if ($scope.instrumentations[0]['value-arity'] === 'numeric-decomposition') {
                        $scope.heatmap = $scope.ca.instrumentations[$scope.instrumentations[0]._datacenter][$scope.instrumentations[0].id].heatmap;

                        var clickpoint = '.chart_container_'+ $scope.$id + ' #clickpoint';
                        $(clickpoint).popover({
                            title: 'Details',
                            html: true,
                            trigger: 'manual',
                            content:function() {
                                return $scope.details;
                            }
                        });
                    }

                    if (series && series.length) {
                        if (!graph) {
                            graph = createGraph(series);
                            $scope.ready = true;
                        } else {
                            graph.series.splice(0, graph.series.length);
                            graph.series.push.apply(graph.series, series);
                            graph.render();

                            if (legend) {
                                document.querySelector('#legend_' + $scope.$id).innerHTML = "";
                                renderLegend(graph);
                            }
                        }
                    }
                }

                $scope.$watch('$parent.currentRange', function(newVal) {
                    if (newVal){
                        $scope.ca.changeRange($scope.instrumentations, $scope.$parent.currentRange);
                        if (!$scope.initCa) {
                            updateGraph();
                        }
                    }
                });

                $scope.$watch('$parent.endtime', function(newVal) {
                    if (newVal){
                        if (!ticktime) {
                            ticktime = $scope.$parent.endtime;
                            heatmaptime = ticktime -1;
                        }

                        if (!$scope.$parent.frozen) {
                            if (graph && $scope.ca.polltime() > ticktime && !$scope.initCa) {
                                updateGraph();
                                ticktime++;
                            } else if (!graph) {
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
                '<div class="chart-padding">' +
                    '<div class="btn-group margin_btn_0 toggle-graf-width">' +
                    '<button data-ng-click="toggleGraph()" id="control_{{$id}}" data-ng-class="{disabled: !ready, btn: true}" class="toggle-graf-btn toggle-btn-bg"><i class="toggle" data-ng-class="{active: showGraph}"></i><p>{{ready && options.title || loadingText}}</p></button>' +
                       '<button data-ng-click="deleteGraph()" class="btn del-btn-graf toggle-btn-bg" title="delete graph" ><div class="pull-right remove-icon"></div></button>' +
                    '</div>' +
                    // '<br/>' +
                    '<div data-ng-show="showGraph && ready" class="toggle-btn-bg" style="padding-top: 10px;">' +
                    '<div class="toggle-btn-bg" style="padding-bottom: 7px;">' +


                    '<div class="chart_container_{{$id}}" style="position: relative;margin-bottom:10px;width: 450px;display: inline-block;">' +

                    '<div id="y_axis_{{$id}}" style="position: absolute;top: 0; bottom: 0; width: 50px;"></div>' +
                    '<div id="chart_{{$id}}" style="position: relative; left: 50px;">' +
                    '<div id="clickpoint" style="position:absolute;height:0;width:0;"></div>' +
                    '<div class="caOverlaid">' +
                    '<img data-ng-show="heatmap" data-ng-click="getHeatmapDetails($event)" class="toggle-btn-bg" data-ng-src="data:image/jpeg;base64, {{heatmap}}" />' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '<div data-ng-hide="heatmap" id="legend_{{$id}}" class="heatmap-pos"></div>' +
                    '<div class="graf-radio-group" data-toggle="buttons-radio">' +
                    '<button class="btn default-margin default-margin-mini graf-radio-btn {{renderer == activeRenderer && \'active\' || \'\'}}" data-ng-hide="heatmap" data-ng-repeat="renderer in renderers" data-ng-click="changeRenderer(renderer)">{{renderer}}</button>' +
                    '</div>' +
                    '</div>' +

                    '</div>'
        };
    });
}(window.JP.getModule('cloudAnalytics'), window.angular, window.jQuery));