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

    app.directive('instrumentation', function (caBackend, $filter, $timeout) {
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
                // create instrumentation
                var graphScope = $filter('graphScope');
                $scope.graphRange = 10;
                var ca = new caBackend();
//                instr.module = $scope.module;
//                instr.stat = $scope.stat;
//                instr.decomposition = $scope.decomposition || [];
//                instr.duration = 1;
                var iOptions = {
                    unit: $scope.metric.unit,
                    stat: $scope.stat,
                    module: $scope.module,
                    decomposition: $scope.decomposition || []
                }
                // if 2 decompositions, heatmap is expected
                ca.createInstrumentation(iOptions, function(instrumentation){
                    $scope.instrumentation = instrumentation;

//                    $scope.$watch('instrumentation.buffer.length', function(){
//                        console.log($scope.instrumentation.buffer);
//                    })

                });

//                $scope.instrumentation = instr;
//                $scope.instrumentation.range = 10;
//                $scope.instrumentation.buffer = [];
//                $scope.instrumentation.rangeValues = [];




//                var series= [];
//
//                function createGraph() {
//
//                    var conf = {
//                        element: document.querySelector("#chart_" + $scope.instrumentation.id),
////                        renderer: 'bar',
//                        width: 600,
//                        height: 300,
//                        series: $scope.instrumentation.series
//                    };
//                    var graph = new Rickshaw.Graph(conf);
//                    graph.render();
//                    createRange(graph);
//                    createXAxis(graph);
//                    createYAxis(graph);
//                    createHover(graph);
//
//                    return graph;
//                }

//                var usedColors = [];
//                function getColor(key) {
//                    if(usedColors[key]) {
//                        return usedColors[key];
//                    } else {
//                        usedColors[key] = palette.color();
//                        return usedColors[key];
//                    }
//                }

//                $scope.deleteInstrumentation = function() {
//                    $scope.instrumentation.$delete();
//                    $scope.$destroy();
//                }
//                $scope.graphValues = [];

//                $scope.$watch('instrumentation.currentEndTime', function(newValue, oldValue) {
//                    console.log($scope.instrumentation.seriesData);
//                    console.log($scope.instrumentation.series);
//
////                    console.log($scope.instrumentation);
//                    if(newValue) {
//////                        series = $scope.series;
////                        //updateGraphValues();
////
//                        if(graph) {
//                            graph.render();
//                        } else if(newValue && !graph){
//                            graph = createGraph();
//                        }
//                    }
//
//                });


            },
            template: '<div id="instrumentation_{{instrumentation.id}}"></div><div id="slider_{{instrumentation.id}}"></div> <br/><br/>' +
                '<div id="chart_{{instrumentation.id}}"><div class="caOverlaid"></div></div>' +
                '<button data-ng-click="deleteInstrumentation()">Delete</button></div>'
        };
    });
}(window.JP.getModule('cloudAnalytics')));