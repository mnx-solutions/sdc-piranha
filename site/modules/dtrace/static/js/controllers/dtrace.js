'use strict';

(function (app) {
    app.controller(
        'DTrace.DtraceController', [
            '$scope',
            'DTrace',
            '$q',
            'requestContext',
            'localization',
            'PopupDialog',
            '$route',
            function ($scope, DTrace, $q, requestContext, localization, PopupDialog, $route) {
                localization.bind('dtrace', $scope);
                requestContext.setUpRenderContext('dtrace.script', $scope, {
                    title: localization.translate(null, 'dtrace', 'See my Joyent DTrace Heatmap')
                });
                $scope.title = $route.current.$$route.title;
                
                $scope.loading = true;
                $scope.processing = false;
                var processes = {};
                var pidPlaceholder = '$PID';

                var errorCallback = function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                $scope.options = {};

                var getScriptsListType = 'all';
                if ($scope.title === 'Flamegraph') {
                   getScriptsListType = 'default';
                }

                $q.all([DTrace.listHosts(), DTrace.getScriptsList(getScriptsListType)]).then(function (result) {
                    $scope.hosts = result[0] || [];
                    $scope.scripts = result[1] || [];

                    $scope.scriptName = 'all syscall';
                    $scope.host = JSON.stringify($scope.hosts[0]);
                    if ($scope.title === 'Flamegraph') {
                        $scope.scriptName = 'all syscall for process';
                        updateScripts();
                    }
                    $scope.loading = false;
                }, errorCallback);

                var getCurrentScript = function () {
                    return $scope.scripts.find(function (script) {
                        return script.name === $scope.scriptName;
                    });
                };

                var updateScripts = function () {
                    $scope.processes = null;
                    if ($scope.loadingHostProcesses || !$scope.scriptName) {
                        $scope.loadingHostProcesses = false;
                        return;
                    }
                    $scope.loadingHostProcesses = true;
                    var script = getCurrentScript();
                    if ((!script.body || script.body.indexOf(pidPlaceholder) === -1) && !script.pid) {
                        $scope.loadingHostProcesses = false;
                    } else if (!$scope.processes) {
                        if ($scope.host) {
                            var host = JSON.parse($scope.host);
                            DTrace.listProcesses({primaryIp: host.primaryIp}).then(function (list) {
                                list.forEach(function(process) {
                                    process.name = ' PID: ' + process.pid + ' CMD: ' + process.cmd;
                                });
                                processes[host.primaryIp] = list;
                                $scope.processes = list;
                                $scope.loadingHostProcesses = false;
                            }, errorCallback);
                        }
                    }
                };

                $scope.changeHost = function () {
                    if ($scope.host) {
                        var host = JSON.parse($scope.host);
                        if (processes[host.primaryIp]) {
                            $scope.processes = processes[host.primaryIp];
                        } else {
                            updateScripts();
                        }
                    }
                };

                $scope.changeScript = function () {
                    updateScripts();
                };

                $scope.start = function () {
                    if ($scope.host) {
                        var host = JSON.parse($scope.host);
                        $scope.options.hostIp = host.primaryIp;
                        $scope.options.hostId = host.id;
                        var script = getCurrentScript();
                        if (script && script.body) {
                            script.body = script.body.replace(pidPlaceholder, $scope.pid);
                        } else if (script && script.pid) {
                            script.pid = $scope.pid;
                        }
                        $scope.options.script = script;
                        $scope.starting = true;
                        $scope.options.loading = true;
                        $scope.options.isDataOk = false;
                    }
                    
                };

                $scope.stop = function () {
                    $scope.starting = false;
                    $scope.options.loading = false;
                };
            }
        ]);
}(window.JP.getModule('dtrace')));
