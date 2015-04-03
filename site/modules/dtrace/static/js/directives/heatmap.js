'use strict';

(function (ng, app) {
    app.directive('heatmap', ['$location', 'loggingService', 'DTrace', function ($location, loggingService, DTrace) {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                options: '=',
                status: '=?'
            },
            template: function (element, attrs) {
                var width = parseInt(attrs.width, 10) || 1024;
                var height = (attrs.height || 512) + 20;
                return '<canvas id="canvas-heatmap" width="' + width + '" height="' + height + '"></canvas>';
            },
            link: function ($scope, element, attrs) {
                var heatMapSize = {
                    x: $scope.options.size && $scope.options.size.x ? $scope.options.size.x : 64,
                    y: $scope.options.size && $scope.options.size.y ? $scope.options.size.y : 32
                };
                var width = parseInt(attrs.width);
                var height = parseInt(attrs.height);
                var console_columns = [];
                var websocket;
                var canvas = document.getElementById('canvas-heatmap');
                var ctx = canvas.getContext('2d');
                var dscriptBeginPart = 'syscall:::entry';
                var dscriptEndPart = '{self->syscall_entry_ts[probefunc] = vtimestamp;}syscall:::return/self->syscall_entry_ts[probefunc]/{@time[probefunc] = lquantize((vtimestamp - self->syscall_entry_ts[probefunc] ) / 1000, 0, 63, 2);self->syscall_entry_ts[probefunc] = 0;}';
                var host;
                var id;
                /* On load we create our web socket (or flash socket if your browser doesn't support it ) and
                 send the d script we wish to be tracing. This extremely powerful and *insecure*. */
                if (!$scope.status && $scope.options.hostIp) {
                    heat_tracer($scope.options.hostIp);
                }

                function getDscript(pid) {
                    return dscriptBeginPart + (pid ? '/pid ==' + pid + '/' : '') + dscriptEndPart;
                }

                function closeWebsocket() {
                    if (id) {
                        DTrace.close({host: host, id: id}).then(function () {}, function (err) {
                            PopupDialog.errorObj(err);
                        });
                    }
                    $scope.options.processing = false;
                    if (websocket && websocket.readyState !== WebSocket.CLOSED) {
                        websocket.close();
                    }
                };

                $scope.$watch('status', function (status) {
                    if (status) {
                        var dscript = $scope.options.script.body || getDscript($scope.options.pid);
                        var name = $scope.options.script.name +
                            ($scope.options.pid ? ' PID:' + $scope.options.pid : '');
                        heat_tracer($scope.options.hostIp, dscript, $scope.options.continuation, name);
                    } else {
                        closeWebsocket();
                    }
                });

                function heat_tracer(hostIp, dscript, continuation, name) {
                    if (!hostIp) {
                        return;
                    }
                    var locationPath = $location.path();
                    if (!continuation || !console_columns.length) {
                        console_columns = [];
                        setup();
                        ctx.fillRect(0, 0, width, height);
                    }
                    loggingService.log('info', 'Trying to execute dtrace script \'' + name + '\' for heatmap');
                    host = $scope.options.hostIp;

                    DTrace.execute({
                        host: host,
                        dtraceObj: JSON.stringify({type: 'heatmap', message: dscript})
                    }).then(function (data) {
                        id = data.id;
                        websocket = new WebSocket(data.path);
                        websocket.onmessage = function (event) {
                            var data = {};
                            if (event.data !== 'ping') {
                                try {
                                    data = JSON.parse(event.data);
                                    $scope.options.isDataOk = true;
                                } catch (ex) {
                                    $scope.options.isDataOk = false;
                                    var message = 'Error parsing json for heatmap';
                                    PopupDialog.errorObj(message + '.');
                                    loggingService.log('error', message);
                                }
                            }
                            $scope.options.processing = false;
                            draw(data);
                            $scope.$apply(function () {
                                $scope.options.loading = false;
                            });
                        };

                        websocket.onopen = function () {
                            $scope.$apply(function () {
                                $scope.options.processing = false;
                            });
                            dscript = dscript || getDscript();

                            // Draw  script name and host
                            ctx.beginPath();
                            ctx.strokeStyle = '#fff';
                            ctx.moveTo(0, 20);
                            ctx.lineTo(width, 20);
                            ctx.stroke();
                            ctx.font = '12px serif';
                            ctx.fillStyle = '#fff';
                            ctx.textAlign = 'left';
                            name = name || 'all syscall';
                            ctx.fillText('host :' + hostIp + '; dtrace script :' + name, 5, 14);
                        };

                        websocket.onerror = function (data) {
                            loggingService.log('error', 'websocket error: ' + data);
                        };

                        websocket.onclose = closeWebsocket;
                    });
                }

                $scope.$on('$routeChangeStart', closeWebsocket);
                $scope.$on('$destroy', closeWebsocket);

                /* Take the aggregation data and update the heatmap */
                function draw(message) {
                    /* Latest data goes in the right most column, initialize it */
                    var syscalls_by_latency = [];
                    for (var index = 0; index < heatMapSize.y; index++) {
                        syscalls_by_latency[index] = 0;
                    }

                    /* Presently we have the latency for each system call quantized in our message. Merge the data
                     such that we have all the system call latency quantized together. This gives us the number
                     of syscalls made with latencies in each particular band. */
                    for (var syscall in message) {
                        var val = message[syscall];
                        for (var result_index in val) {
                            var latency_start = val[result_index][0][0];
                            var count =  val[result_index][1];
                            /* The d script we're using lquantizes from 0 to 63 in steps of two. So dividing by 2
                             tells us which row this result belongs in */
                            syscalls_by_latency[Math.floor(latency_start / 2)] += count;
                        }
                    }

                    /* We just created a new column, shift the console to the left and add it. */
                    console_columns.shift();
                    console_columns.push(syscalls_by_latency);
                    drawArray(console_columns);
                }

                /* Draw the columns and rows that map up the heatmap on to the canvas element */
                function drawArray(console_columns) {
                    if (canvas.getContext) {
                        for (var column_index in console_columns) {
                            var column = console_columns[column_index];
                            for (var entry_index in column) {
                                var entry = column[entry_index];

                                /* We're using a logarithmic scale for the brightness. This was all arrived at by
                                 trial and error and found to work well on my Mac.  In the future this
                                 could all be adjustable with controls */
                                var red_value = 0;
                                if (entry !== 0) {
                                    red_value = Math.floor(Math.log(entry) / Math.log(2));
                                }
                                ctx.fillStyle = 'rgb(' + (red_value * 25) + ',0,0)';
                                ctx.fillRect(column_index * 16, 516 - (entry_index * 16), 16, 16);
                            }
                        }
                    }
                }

                /* The heatmap is is really a default 64x32 grid. Initialize the array which contains the grid data. */
                function setup() {
                    for (var i = 0; i < heatMapSize.x; i++) {
                        var column = [];
                        for (var j = 0; j < heatMapSize.y; j++) {
                            column[j] = 0;
                        }
                        console_columns.push(column);
                    }
                }

            }
        };
    }]);
}(window.angular, window.JP.getModule('dtrace')));
