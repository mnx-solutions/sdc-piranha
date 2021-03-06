'use strict';

(function (ng, app) {
    app.directive('heatmap', ['DTrace', function (DTrace) {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                options: '=',
                data: '=?'
            },
            template: function (element, attrs) {
                var width = parseInt(attrs.width, 10) || 1024;
                var height = (attrs.height || 512) + 20;
                return '<canvas id="canvas-heatmap" width="' + (width + 100) + '" height="' + (height + 50) + '"></canvas>';
            },
            link: function ($scope, element, attrs) {
                var heatMapSize = {
                    x: $scope.options.size && $scope.options.size.x ? $scope.options.size.x : 64,
                    y: $scope.options.size && $scope.options.size.y ? $scope.options.size.y : 32
                };
                var width = parseInt(attrs.width - 100);
                var height = parseInt(attrs.height - 50);
                var consoleСolumns = [];
                var scaleY = [];
                var canvas = document.getElementById('canvas-heatmap');
                var ctx = canvas.getContext('2d');

                $scope.$watch('data', function (data) {
                    if (data) {
                        heatTracer(data);
                    }
                });

                function heatTracer(data) {
                    if ($scope.options.start || !consoleСolumns.length) {
                        consoleСolumns = [];
                        scaleY = [];
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, width + 100, height + 50);
                        ctx.fillStyle = '#3d3d3d';
                        ctx.fillRect(0, 0, width, height);
                        setup();
                        $scope.options.start = false;
                    }

                    draw(data || {});
                }

                /* Take the aggregation data and update the heatmap */
                function draw(message) {
                    /* Latest data goes in the right most column, initialize it */
                    var syscallsByLatency = [];
                    for (var index = 0; index < heatMapSize.y; index++) {
                        syscallsByLatency[index] = 0;
                    }

                    /* Presently we have the latency for each system call quantized in our message. Merge the data
                     such that we have all the system call latency quantized together. This gives us the number
                     of syscalls made with latencies in each particular band. */
                    for (var syscall in message) {
                        var val = message[syscall];
                        for (var resultIndex in val) {
                            var latencyStart = val[resultIndex][0][0];
                            var count =  val[resultIndex][1];
                            /* The d script we're using lquantizes from 0 to 63 in steps of two. So dividing by 2
                             tells us which row this result belongs in */
                            var syscallRow = Math.floor(latencyStart / 2);
                            syscallsByLatency[syscallRow] += count;
                            if (scaleY[syscallRow] === undefined) {
                                scaleY[syscallRow] = syscall;
                            }
                        }
                    }

                    syscallsByLatency.scaleX = new Date().toISOString().slice(11, 19);

                    /* We just created a new column, shift the console to the left and add it. */
                    consoleСolumns.shift();
                    consoleСolumns.push(syscallsByLatency);
                    drawArray(consoleСolumns);
                }

                /* Draw the columns and rows that map up the heatmap on to the canvas element */
                function drawArray(columns) {
                    if (canvas.getContext) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 532, 1024, 50);
                        for (var columnIndex in columns) {
                            var column = columns[columnIndex];
                            for (var entryIndex in column) {
                                var entry = column[entryIndex];

                                /* We're using a logarithmic scale for the brightness. This was all arrived at by
                                 trial and error and found to work well on my Mac.  In the future this
                                 could all be adjustable with controls */
                                var orangeValue = 0;
                                if (entry !== 0) {
                                    orangeValue = Math.floor(Math.log(entry) / Math.log(2));
                                }
                                if (orangeValue) {
                                    ctx.fillStyle = 'rgb(' + orangeValue * 25 + ',' + orangeValue * 10 + ',0)';
                                    ctx.fillRect(columnIndex * 16, 516 - entryIndex * 16, 16, 16);
                                    if (scaleY[entryIndex]) {
                                        ctx.fillStyle = '#000000';
                                        ctx.fillText(scaleY[entryIndex], 1026, 526 - entryIndex * 16);
                                        scaleY[entryIndex] = null;
                                    }
                                }
                            }
                            if (column.scaleX) {
                                ctx.save();
                                ctx.rotate(-Math.PI / 2);
                                ctx.textAlign = 'right';
                                ctx.fillStyle = '#000000';
                                ctx.fillText(column.scaleX, -535, columnIndex * 16 + 13);
                                ctx.restore();
                            }
                        }
                    }
                }

                /* The heatmap is is really a default 64x32 grid. Initialize the array which contains the grid data. */
                function setup() {

                    var options = $scope.options;
                    // Draw  script name and host
                    ctx.beginPath();
                    ctx.strokeStyle = '#fff';
                    ctx.moveTo(0, 20);
                    ctx.lineTo(width, 20);
                    ctx.stroke();
                    ctx.font = '12px serif';
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'left';
                    var selectedProcessName = options.selectedProcessName || '';
                    var heatmapGraphTitle = 'host: ' + options.hostIp + '; dtrace script: ' + options.script.name;
                    if (selectedProcessName) {
                        heatmapGraphTitle += '; ' + selectedProcessName;
                    }
                    ctx.fillText(heatmapGraphTitle, 5, 14);

                    for (var i = 0; i < heatMapSize.x; i++) {
                        var column = [];
                        for (var j = 0; j < heatMapSize.y; j++) {
                            column[j] = 0;
                        }
                        consoleСolumns.push(column);
                    }
                }

            }
        };
    }]);
}(window.angular, window.JP.getModule('dtrace')));
