'use strict';

(function (ng, app) {
    app.directive('flamegraph', ['$location', 'loggingService', '$compile', '$route', 'DTrace', 'PopupDialog',
        function ($location, loggingService, $compile, $route, DTrace, PopupDialog) {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                options: '=',
                status: '='
            },
            template: function(element, attrs) {
                return '<div class="flamegraph"></div>';
            },
            link: function ($scope, element, attrs) {
                var websocket;
                var dtracePort = 8000;
                function getDscript(pid) {
                    return "-n 'profile-97 /" + (pid ? 'pid == ' + pid : 'arg1') +
                    "/ { @[jstack(150, 8000)] = count(); } tick-60s { exit(0); }'";
                }
                function getFlamegraph (dtraceScript) {
                    DTrace.exucute({
                        host: $scope.options.hostIp + ':' + dtracePort,
                        dtraceObj: JSON.stringify({type: 'flamegraph', message: dtraceScript})
                    }).then(function (path) {
                        var a = document.createElement('a');
                        a.href = path;
                        a.protocol = a.protocol === 'http:' ? 'ws:' : 'wss:';
                        websocket = new WebSocket(a.href);
                        var locationPath = $location.path();
                        websocket.onmessage = function (event) {
                            if (locationPath === $location.path()) {
                                var svg;
                                try {
                                    if (event.data !== 'ping') {
                                        svg = JSON.parse(event.data);
                                    }
                                } catch (err) {
                                    svg = '';
                                }
                                if (svg) {
                                    $scope.options.loading = false;
                                    $scope.$apply(function () {
                                        var svgElement = $compile(svg)($scope);
                                        ng.element(element).html(svgElement).promise().done(function () {
                                            init();
                                        });
                                    });
                                    DTrace.saveFlameGraph({svg: svg, id: $scope.options.hostId}).then(function () {}, function (err) {
                                        PopupDialog.errorObj(err);
                                        closeWebsocket();
                                    });
                                }
                                $scope.options.processing = false;
                            } else {
                                closeWebsocket();
                            }
                        };

                        websocket.onopen = function () {
                            $scope.$apply(function () {
                                $scope.options.processing = false;
                            });
                        };

                        websocket.onerror = function (data) {
                            loggingService.log('error', 'websocket error: ' + data);
                        };

                        websocket.onclose = function () {
                            closeWebsocket();
                        };
                    });
                }

                var closeWebsocket = function () {
                    if (websocket) {
                        websocket.close();
                    }
                    $scope.options.processing = false;
                };

                $scope.$watch('status', function (status) {
                    if (status) {
                        ng.element(element).html('');
                        var options = $scope.options;
                        var dtraceScript = options.script && options.script.body ||
                            getDscript(options.script && options.script.pid || undefined);
                        getFlamegraph(dtraceScript);
                    } else {
                        closeWebsocket();
                    }
                });
                
                $scope.$on('$routeChangeStart', function(next, current) { 
                    closeWebsocket();
                });
            }
        };
    }]);
}(window.angular, window.JP.getModule('dtrace')));