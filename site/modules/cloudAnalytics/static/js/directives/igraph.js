'use strict';

(function (app) {
    app.directive('igraph', function ($filter, $timeout) {
        return {
            restrict: "E",
            scope: {
                graph:'=graph'
            },
            link: function ($scope){
                console.log('graph inited');
                var g = false;
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

                function createHover(graph) {
                    new Rickshaw.Graph.HoverDetail( {
                        graph: graph
                    });
                }
                function createGraph() {
                    var conf = {
                        element: document.querySelector("#chart"),
                        renderer: 'bar',
                        width: 600,
                        height: 300,
                        series: $scope.graph.series
                    };
                    var g = new Rickshaw.Graph(conf);
                    g.render();
//                    createRange(g);
                    createXAxis(g);
                    createYAxis(g);
                    createHover(g);

                    return g;
                }
                $scope.$watch('graph.values.length', function(newValue, oldValue) {
                    console.log('values changed');
//                    console.log($scope.graph);
                    if(newValue > 1) {
                        if(g) {
                            g.render();
                        } else if(newValue){
                            g = createGraph();
                        }
                    }

                });
            },
            template: '<div id="chart"><div class="caOverlaid"></div></div>'
        };
    });
}(window.JP.getModule('cloudAnalytics')));