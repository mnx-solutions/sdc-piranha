'use strict';

(function (ng, app) {
    app.directive('terminal', ['Docker', 'util', function (Docker, util) {
        return {
            templateUrl: 'docker/static/partials/terminal-accordion.html',
            restrict: 'E',
            scope: {
                options: '='
            },
            link: function ($scope, el) {
                $scope.isHostAccessible = false;
                $scope.isContainerRunning = false;
                $scope.execute = function () {
                    var opts = {
                        host: $scope.options.machine,
                        options: {
                            User: '',
                            Privileged: false,
                            Tty: true,
                            Container: $scope.options.containerId,
                            AttachStdin: true,
                            AttachStderr: true,
                            AttachStdout: true,
                            Detach: false,
                            Cmd: Docker.parseCmd($scope.execCmd)
                        }
                    };
                    var terminal = new Terminal({
                        cols: 0,
                        rows: 0,
                        useStyle: true,
                        screenKeys: true
                    });
                    var termElem = document.getElementById('terminal');
                    termElem.innerHTML = '';
                    terminal.open(termElem);
                    Docker.execute(opts).then(function (wsPath) {
                        var url = util.rewriteUrl({
                            href: wsPath,
                            isWS: true
                        });
                        var socket = new WebSocket(url.href);

                        socket.onmessage = function (event) {
                            if (event.data === 'ready') {
                                socket.send(JSON.stringify(opts));
                                return;
                            }
                            terminal.write(event.data);
                        };
                        terminal.on('data', function (data) {
                            if (socket.readyState === 1) {
                                socket.send(data);
                            }
                        });
                        socket.onclose = function () {
                            terminal.write('\r\nConnection closed');
                            socket.close();
                        };
                    });
                };

                $scope.pressEnter = function (keyEvent) {
                    if (keyEvent.which === 13 && $scope.execCmd) {
                        $scope.execute();
                    }
                };

                $scope.$watch('options', function (opts) {
                    if (opts) {
                        Docker.terminalPing(opts).then(function () {
                            $scope.isHostAccessible = true;
                        }, function () {
                            $scope.isHostAccessible = false;
                        });
                    }
                });

                $scope.$watch('options.containerState', function (containerState) {
                    $scope.isContainerRunning = containerState === 'running';
                });
            }
        };
    }]);
}(window.angular, window.JP.getModule('docker')));
