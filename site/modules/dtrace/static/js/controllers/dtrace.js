'use strict';

(function (app) {
    app.controller(
        'DTrace.DtraceController', [
            '$scope',
            'Account',
            'DTrace',
            'Storage',
            '$q',
            'requestContext',
            'localization',
            'PopupDialog',
            '$route',
            'loggingService',
            function ($scope, Account, DTrace, Storage, $q, requestContext, localization, PopupDialog, $route, loggingService) {
                localization.bind('dtrace', $scope);
                requestContext.setUpRenderContext('dtrace.script', $scope, {
                    title: localization.translate(null, 'dtrace', 'See my Joyent DTrace Heatmap')
                });
                $scope.title = $route.current.$$route.title;
                $scope.devToolsPath = DTrace.devToolsLink();

                var DTRACE_SCRIPTS = {
                    'heatmap': function (pid) {
                        return 'syscall:::entry' + (pid ? '/pid ==' + pid + '/' : '') + 
                            '{self->syscall_entry_ts[probefunc] = vtimestamp;}' +
                            'syscall:::return/self->syscall_entry_ts[probefunc]/{@time[probefunc] = lquantize((vtimestamp -' +
                            ' self->syscall_entry_ts[probefunc] ) / 1000, 0, 63, 2);self->syscall_entry_ts[probefunc] = 0;}';
                    },
                    'flamegraph': function (pid) {
                        return "-n 'profile-97 /pid == " + pid + " / { @[jstack(150, 8000)] = count(); } tick-60s { exit(0); }'"
                    }
                };

                $scope.loading = true;
                $scope.processing = false;
                $scope.options = {};
                $scope.data = '';
                var processes = {};
                var pidPlaceholder = '$PID';
                var dtraceId;
                var websocket;
                var type;
                
                var errorCallback = function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                var getScriptsListType = 'all';
                if ($scope.title === 'Flame Graph') {
                    getScriptsListType = 'default';
                    type = 'flamegraph';
                } else if ($scope.title === 'Heatmap') {
                    type = 'heatmap';
                }

                Account.getAccount(true).then(function (account) {
                    $scope.provisionEnabled = account.provisionEnabled;
                    if ($scope.provisionEnabled) {
                        Storage.pingManta(function () {
                            $q.all([DTrace.listHosts(), DTrace.getScriptsList(getScriptsListType)]).then(function (result) {
                                $scope.hosts = result[0] || [];
                                $scope.scripts = result[1] || [];
                                $scope.scriptName = 'all syscall';
                                $scope.host = JSON.stringify($scope.hosts[0]);
                                if ($scope.title === 'Flame Graph') {
                                    $scope.scriptName = 'all syscall for process';
                                    updateScripts();
                                }
                                $scope.loading = false;
                            }, function (error) {
                                $scope.hosts = [];
                                errorCallback(error);
                            });
                        });
                    } else {
                        $scope.hosts = [];
                        $scope.loading = false;
                    }
                });

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

                function closeWebsocket() {
                    if (dtraceId && $scope.options.hostIp) {
                        $scope.processing = true;
                        DTrace.close({host: $scope.options.hostIp, id: dtraceId}).then(function () {}, function (err) {
                            PopupDialog.errorObj(err);
                            loggingService.log('error', err);
                            $scope.processing = false;
                        });
                    }
                    $scope.isRunning = false;
                    $scope.options.loading = false;
                }

                $scope.start = function () {
                    if ($scope.host) {
                        var host = JSON.parse($scope.host);
                        var script = getCurrentScript();
                        if (script && script.body) {
                            script.body = script.body.replace(pidPlaceholder, $scope.pid);
                        } else if (script && script.pid) {
                            script.pid = $scope.pid;
                        }
                        $scope.options = {
                            script: script,
                            hostIp: host.primaryIp,
                            hostId: host.id,
                            start: true
                        };

                        if ($scope.pid) {
                            $scope.options.selectedProcessName = $scope.processes.find(function (process) {
                                return process.pid === $scope.pid;
                            }).name;
                        }
                        $scope.isRunning = $scope.processing = true;

                        var getDscript = function () {
                            return DTRACE_SCRIPTS[type]($scope.pid);;
                        };

                        $scope.options.loading = true;
                        DTrace.execute({
                            host: $scope.options.hostIp,
                            dtraceObj: JSON.stringify({type: type, message: script.body || getDscript()})
                        }).then(function (data) {
                            websocket = new WebSocket(data.path);
                            dtraceId = data.id;
                            $scope.data = '';

                            websocket.onclose = function () {
                                if (websocket && websocket.readyState !== WebSocket.CLOSED) {
                                    websocket.close();
                                }
                                $scope.$apply(function () {
                                    $scope.processing = false;
                                });
                            }

                            websocket.onerror = function (error) {
                                PopupDialog.errorObj(error);
                                loggingService.log('error', 'websocket error: ' + error);
                                closeWebsocket();
                            }

                            websocket.onmessage = function (event) {
                                if (event.data !== 'ping' && event.data !== 'started') {
                                    $scope.$apply(function () {
                                        $scope.options.loading = false;
                                        $scope.data = event.data;
                                    });
                                }
                                $scope.$apply(function () {
                                    $scope.processing = false; 
                                });
                            }
                        }, function (err) {
                            PopupDialog.errorObj(err);
                            loggingService.log('error', 'websocket error: ' + err);
                        });
                    }
                };

                $scope.stop = closeWebsocket;

                $scope.$on('$routeChangeStart', closeWebsocket);
                $scope.$on('$destroy', closeWebsocket);
            }
        ]);
}(window.JP.getModule('dtrace')));
