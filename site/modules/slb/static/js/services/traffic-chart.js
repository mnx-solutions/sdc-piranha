'use strict';

(function (app) {
    app.factory('slb.trafficChart', function () {
        return function ($element, title, traffic) {
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
            var data = {
                inbound: [{x: 0, y: 0}],
                outbound: [{x: 0, y: 0}]
            };

            function setTraffic(traffic) {
                if (!traffic || !traffic.inbound || !traffic.outbound) {
                    return;
                }

                data.inbound.splice(0);
                data.outbound.splice(0);

                traffic.inbound.slice(-16).forEach(function (i) {
                    data.inbound.push(i);
                });
                if (data.inbound.length < 1) {
                    data.inbound.push({x: new Date() / 1000, y: 0});
                }

                traffic.outbound.slice(-16).forEach(function (i) {
                    data.outbound.push(i);
                });
                if (data.outbound.length < 1) {
                    data.outbound.push({x: new Date() / 1000, y: 0});
                }
            }

            setTraffic(traffic);

            function createSeries(inColor, outColor) {
                return [
                    {
                        color: inColor,
                        data: data.inbound,
                        name: 'inbound'
                    },
                    {
                        color: outColor,
                        data: data.outbound,
                        name: 'outbound'
                    }
                ];
            }

            var graphConfig = createConfig({
                element: $element.get()[0],
                renderer: 'line',
                series: createSeries('lightblue', 'gray')
            });

            var scatterPlotConfig = createConfig({
                element: document.createElement('div'),
                renderer: 'scatterplot',
                series: createSeries('blue', 'black')
            });

            var graph = new Rickshaw.Graph(graphConfig);

            var scatterPlot = new Rickshaw.Graph(scatterPlotConfig);

            graph.render();
            scatterPlot.render();

            scatterPlot.element.firstChild.style.position = 'absolute';
            $element.prepend(scatterPlot.element.firstChild);

            if (title) {
                $element.prepend('<div style="position: absolute; padding-left: 8px;">' + title + '</div>');
            }
            var hoverDetail = new Rickshaw.Graph.HoverDetail({
                graph: graph
            });

            var legend = new Rickshaw.Graph.Legend({
                graph: graph,
                element: document.createElement('div')
            });

            var toggle = new Rickshaw.Graph.Behavior.Series.Toggle({
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

            return {
                setTraffic: setTraffic,
                update: function () {
                    graph.update();
                    scatterPlot.update();
                }
            };
        };
    });
}(window.JP.getModule('slb')));