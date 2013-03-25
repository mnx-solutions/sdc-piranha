'use strict';

(function (app) {
    app.filter('graphScope', function(){
        return function(buffer, range){
//            console.log('filter');

            if(range) {
                if(buffer.length > range) {
                    return buffer.slice(buffer.length - range);
                } else {
                    return buffer;
                }
            } else {
                return buffer;
            }
        }
    });

    app.directive('instrumentation', function (caBackend, $filter) {
        return {
            restrict: "E",
            scope: {
                module:'=module',
                stat: '=stat',
                type: '=type',
                metric: '=metric',
                decomposition: '=decomposition',
                predicate: '=predicate'
            },
            link: function ($scope, element, attrs){
                var palette = new Rickshaw.Color.Palette( { scheme: 'spectrum2001' } );

                // create instrumentation
                var instr = new caBackend.instr();
                var graphScope = $filter('graphScope');
                $scope.graphRange = 10;
//                for(var i = 295; i< 305; i++) {
//                    instr.$delete({id:i});
//                }
//                return;
                if(!$scope.type) {
                    var type = 'raw';
                    if($scope.decomposition && $scope.decomposition.length === 1) {
                        type = 'decomposed';
                    } else if($scope.decomposition.length > 1){
                        type = 'heatmap';
                    }
                    $scope.type = type;
                }

                instr.module = $scope.module;
                instr.stat = $scope.stat;
                instr.decomposition = $scope.decomposition || [];
                instr.duration = 1;

                // if 2 decompositions, heatmap is expected
                instr.create($scope.type, function(){});

                $scope.instrumentation = instr;
                $scope.instrumentation.buffer = [];
//                $scope.instrumentation.rangeValues = [];



                // create and update graph
                var graph = false;

                function createXAxis(graph) {
                    var axis = new Rickshaw.Graph.Axis.Time({
                        'graph': graph,
                        'timeUnit': new Rickshaw.Fixtures.Time().unit('second')
                    });
                    axis.render();
                    return axis;
                }
                function createYAxis(graph) {

                }
                function createRange(graph) {
                    var slider = new Rickshaw.Graph.RangeSlider({
                        element: $('#slider_' + $scope.instrumentation.id),
                        graph: graph

                    });
//                    slider.render();
                    return slider;
                }
                function createHover(graph) {
                    new Rickshaw.Graph.HoverDetail( {
                        graph: graph
                    });
                }

                var series= [];

                function createGraph() {

                    var conf = {
                        element: document.querySelector("#chart_" + $scope.instrumentation.id),
//                        renderer: 'bar',
                        width: 580,
                        height: 250,
                        series: series
                    };
                    var graph = new Rickshaw.Graph(conf);
                    graph.render();
                    createRange(graph);
                    createXAxis(graph);
                    createYAxis(graph);
                    createHover(graph);

                    return graph;
                }

                var usedColors = [];
                function getColor(key) {
                    if(usedColors[key]) {
                        return usedColors[key];
                    } else {
                        usedColors[key] = palette.color();
                        return usedColors[key];
                    }
                }
                function updateGraphValues() {
                    var newVals = graphScope($scope.instrumentation.buffer, $scope.graphRange);

                    switch($scope.type) {
                        case 'raw':
                            var data = [];
                            var previousStart = null;
                            for( var i in newVals ) {
                                var obj = {
                                    x: newVals[i].start_time,
                                    y: newVals[i].value
                                }
                                data.push(obj);
                            }

                            if(!series.length) {
                                series.push({
                                    color: 'steelblue',
                                    data: data,
                                    name: $scope.metric.unit
                                });
                            } else {
                                series[0].data = data;
                            }

                            break;
                        case 'decomposed':
                            var seriesData = [];

                            for( var i in newVals ) {
                                for(var decomp in newVals[i].value) {
                                    if(!seriesData[decomp]) {
                                        seriesData[decomp] = []
                                    }
                                }

                            }
                            for( var i in newVals ) {
                                for (var lab in seriesData) {
                                    if(!newVals[i].value[lab]) {
                                        seriesData[lab].push({
                                            x: newVals[i].start_time,
                                            y: 0
                                        })
                                    }
                                }
                                for(var decomp in newVals[i].value) {
                                    if(!seriesData[decomp]) {
                                        seriesData[decomp] = []
                                    }
                                    var obj = {
                                        x: newVals[i].start_time,
                                        y: newVals[i].value[decomp]
                                    }
                                    seriesData[decomp].push(obj);
                                }

                            }
                            series.splice(0, series.length);
                            for(var val in seriesData) {
                                series.push({
                                    color: getColor(val),
                                    data: seriesData[val],
                                    name: val
                                })
                            }
                            if(!series.length) {
                                series.push({
                                    color: getColor('no values'),
                                    data: [{x:0,y:0}],
                                    name: 'no values'
                                })
                            }
                            console.log(series);

                            break;
                        case 'heatmap':
                            break;

                    }

                }
                $scope.deleteInstrumentation = function() {
                    $scope.instrumentation.$delete();
                    $scope.$destroy();
                }
                $scope.graphValues = [];
                $scope.$watch('instrumentation.buffer.length', function(newValue, oldValue) {

                    if(newValue > 1) {
                        updateGraphValues();

                        if(graph) {
                            graph.render();
                        } else if(newValue && !graph){
                            graph = createGraph();
                        }
                    }

                });


            },
            template: '<div id="instrumentation_{{instrumentation.id}}"></div><div id="slider_{{instrumentation.id}}"></div> <br/><br/>' +
                '<div id="chart_{{instrumentation.id}}"></div>' +
                '<button data-ng-click="deleteInstrumentation()">Delete</button></div>'
        };
    });
}(window.JP.getModule('cloudAnalytics')));