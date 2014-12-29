'use strict';

(function (ng, app) {
    app.directive('terminal', ['Docker', function (Docker) {
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
                            id: $scope.options.containerId,
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
                        var a = document.createElement('a');
                        a.href = wsPath;
                        a.protocol = a.protocol === 'http:' ? 'ws:' : 'wss:';
                        var socket = io.connect(a.href);
                        socket.on('data', function (data) {
                            if (data) {
                                terminal.write(data);
                            }
                        });
                        terminal.on('data', function (data) {
                            socket.emit('terminal', data);
                        });
                        socket.on('disconnect', function () {
                            terminal.write('\nConnection closed');
                        });
                        $scope.$on('$destroy', function () {
                            socket.disconnect();
                        });
                    });
                };
                $scope.pressEnter = function (keyEvent) {
                    if (keyEvent.which === 13) {
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
                    $scope.isContainerRunning = false;
                    if (containerState === 'running') {
                        $scope.isContainerRunning = true;
                    }
                });
            }
        };
    }]);
}(window.angular, window.JP.getModule('docker')));