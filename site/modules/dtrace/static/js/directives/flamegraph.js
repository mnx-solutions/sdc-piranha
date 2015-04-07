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
            template: function (element, attrs) {
                return '<div class="flamegraph"></div>';
            },
            link: function ($scope, element, attrs) {
                var websocket;
                var id;
                var host;
                function getDscript(pid) {
                    return "-n 'profile-97 /pid == " + pid +
                    "/ { @[jstack(150, 8000)] = count(); } tick-60s { exit(0); }'";
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
                function getFlamegraph(dtraceScript) {
                    host = $scope.options.hostIp;
                    DTrace.execute({
                        host: host,
                        dtraceObj: JSON.stringify({type: 'flamegraph', message: dtraceScript})
                    }).then(function (data) {
                        id = data.id;
                        websocket = new WebSocket(data.path);
                        var locationPath = $location.path();
                        websocket.onmessage = function (event) {
                            var svg;
                            if (event.data !== 'ping') {
                                try {
                                    svg = JSON.parse(event.data);
                                } catch (ex) {
                                    svg = '';
                                    var message = 'Error parsing json for flamegraph';
                                    PopupDialog.errorObj(message + '.');
                                    loggingService.log('error', message);
                                }
                            }
                            if (svg) {
                                $scope.options.loading = false;
                                $scope.$apply(function () {
                                    ng.element(element).html(svg).promise().done(function () {
                                        init();
                                    });
                                });
                                DTrace.saveFlameGraph({
                                    svg: svg,
                                    id: $scope.options.hostId
                                }).then(function () {}, function (err) {
                                    PopupDialog.errorObj(err);
                                    loggingService.log('error', 'Error while saving flamegraph svg to manta');
                                    closeWebsocket();
                                });
                            }
                            $scope.options.processing = false;
                        };

                        websocket.onopen = function () {
                            $scope.$apply(function () {
                                $scope.options.processing = false;
                            });
                        };

                        websocket.onerror = function (data) {
                            loggingService.log('error', 'websocket error: ' + data);
                        };

                        websocket.onclose = closeWebsocket;
                    });
                }


                $scope.$watch('status', function (status) {
                    if (status) {
                        ng.element(element).html('');
                        var options = $scope.options;
                        var dtraceScript = options.script && options.script.body ||
                            getDscript(options.script && options.script.pid);
                        getFlamegraph(dtraceScript);
                    } else {
                        closeWebsocket();
                    }
                });

                $scope.$on('$routeChangeStart', closeWebsocket);
                $scope.$on('$destroy', closeWebsocket);
            }
        };
    }]);
}(window.angular, window.JP.getModule('dtrace')));
