'use strict';

(function (app) {
    app.controller(
        'DTrace.HeatmapController', [
            '$scope',
            'DTrace',
            '$q',
            'requestContext',
            'localization',
            'PopupDialog',
            function ($scope, DTrace, $q, requestContext, localization, PopupDialog) {
                localization.bind('dtrace', $scope);
                requestContext.setUpRenderContext('dtrace.script', $scope, {
                    title: localization.translate(null, 'dtrace', 'See my Joyent DTrace Heatmap')
                });

                $scope.loading = true;
                var processes = {};
                var script;
                var pidPlaceholder = '$PID';

                var errorCallback = function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                $scope.heatmapOptions = {};

                $q.all([DTrace.listHosts(), DTrace.getScriptsList()]).then(function (result) {
                    $scope.hosts = result[0] || [];
                    $scope.scripts = [].concat([{name: 'all syscall'}, {name: 'all syscall for process', pid: true}], result[1] || []);
                    $scope.loading = false;
                }, errorCallback);

                var updateScripts = function () {
                    $scope.processes = null;
                    if ($scope.loadingHostProcesses || !$scope.scriptName) {
                        $scope.loadingHostProcesses = false;
                        return;
                    }
                    $scope.loadingHostProcesses = true;
                    script = $scope.scripts.find(function(script) {
                        return script.name === $scope.scriptName;
                    });
                    if ((!script.body || script.body.indexOf(pidPlaceholder) === -1) && !script.pid) {
                        $scope.loadingHostProcesses = false;
                        return;
                    }
                    if (processes[$scope.hostIp]) {
                        $scope.processes = processes[$scope.hostIp];
                        $scope.loadingHostProcesses = false;
                    } else {
                        DTrace.listProcesses({primaryIp: $scope.hostIp}).then(function (list) {
                            list.forEach(function(process) {
                                process.name = ' PID: ' + process.pid + ' CMD: ' + process.cmd;
                            });
                            processes[$scope.hostIp] = list;
                            $scope.processes = list;
                            $scope.loadingHostProcesses = false;
                        }, errorCallback);
                    }
                };

                $scope.changeScript = function () {
                    updateScripts();
                };

                $scope.start = function () {
                    $scope.heatmapOptions.host = $scope.hostIp;
                    if (script.body) {
                        script.body = script.body.replace(pidPlaceholder, $scope.pid);
                    } else if (script.pid) {
                        script.pid = $scope.pid;
                    }
                    $scope.heatmapOptions.script = script;
                    $scope.starting = true;
                };

                $scope.stop = function () {
                    $scope.starting = false;
                };
            }
        ]);
}(window.JP.getModule('dtrace')));
