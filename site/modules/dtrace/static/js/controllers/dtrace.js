'use strict';

(function (ng, app) {
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
            function ($scope, Account, DTrace, Storage, $q, requestContext, localization, PopupDialog, $route) {
                localization.bind('dtrace', $scope);
                requestContext.setUpRenderContext('dtrace.script', $scope, {
                    title: localization.translate(null, 'dtrace', 'See my Joyent DTrace Heatmap')
                });
                $scope.title = $route.current.$$route.title;
                $scope.devToolsPath = DTrace.devToolsLink();

                var DTRACE_SCRIPTS = {
                    'heatmap': function (script) {
                        return 'syscall:::entry' + (script.pid ? '/' + (script.execname ? 'execname == "' + script.pid + '"'  : 'pid == ' + script.pid) + '/' : '') +
                            '{self->syscall_entry_ts[probefunc] = vtimestamp;}' +
                            'syscall:::return/self->syscall_entry_ts[probefunc]/{@time[probefunc] = lquantize((vtimestamp -' +
                            ' self->syscall_entry_ts[probefunc] ) / 1000, 0, 63, 2);self->syscall_entry_ts[probefunc] = 0;}';
                    },
                    'flamegraph': function (script) {
                        return "-n 'profile-97 /" + (script.pid ? (script.execname ? 'execname == "' + script.pid + '"'  : 'pid == ' + script.pid) : 'arg1') + "/ { @[jstack(150, 8000)] = count(); } tick-60s { exit(0); }'"
                    }
                };

                $scope.loading = true;
                $scope.processing = false;
                $scope.options = {};
                $scope.data = '';
                var processes = {};
                var PID_PLACEHOLDER = '$PID';
                var EXECNAME_PLACEHOLDER = '$EXECNAME';
                var PID_PATTERN = /\$PID/g;
                var EXECNAME_PATTERN = /\$EXECNAME/g;
                var FLAME_GRAPH_TITLE = 'Flame Graph';
                var FLAME_GRAPH_SCRIPT_NAME = 'syscall for process';
                var UNAUTHORIZED_ERROR = 'UnauthorizedError';
                var websocket;
                var type;

                var errorCallback = function (err) {
                    var message = err;
                    if ($scope.host) {
                        var host = JSON.parse($scope.host);
                        message = 'DTrace Instance "' + host.name + '" is currently unreachable.';
                        if (err.indexOf(UNAUTHORIZED_ERROR) !== -1 || err.indexOf('401') !== -1) {
                            message = 'DTrace certificates are invalid for Instance "' + host.name + '".';
                        }
                    }
                    DTrace.reportError(message, 'websocket error: ' + err);
                    $scope.loadingHostProcesses = $scope.processing = $scope.loading = false;
                };

                var getScriptsListType = 'all';
                if ($scope.title === FLAME_GRAPH_TITLE) {
                    getScriptsListType = 'default';
                    type = 'flamegraph';
                } else if ($scope.title === 'Heatmap') {
                    type = 'heatmap';
                }
                var getDscript = function () {
                    return DTRACE_SCRIPTS[type]($scope.options.script);
                };

                Account.getAccount(true).then(function (account) {
                    $scope.provisionEnabled = account.provisionEnabled;
                    if ($scope.provisionEnabled) {
                        Storage.pingManta(function () {
                            $q.all([DTrace.listHosts(), DTrace.getScriptsList(getScriptsListType)]).then(function (result) {
                                $scope.hosts = result[0] || [];
                                $scope.scripts = result[1] || [];
                                $scope.scriptName = $scope.scripts ? $scope.scripts[0].name : '';
                                $scope.host = JSON.stringify($scope.hosts[0]);
                                if ($scope.title === FLAME_GRAPH_TITLE) {
                                    $scope.scriptName = FLAME_GRAPH_SCRIPT_NAME;
                                }
                                updateScripts();
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
                    if (!$scope.scriptName) {
                        $scope.loadingHostProcesses = false;
                        return;
                    }
                    $scope.loadingHostProcesses = true;
                    var script = getCurrentScript();
                    $scope.hasPid = script && script.pid || script.body && script.body.indexOf(PID_PLACEHOLDER) !== -1;
                    $scope.hasExecname = script && script.execname || script.body && script.body.indexOf(EXECNAME_PLACEHOLDER) !== -1;
                    if (!$scope.hasPid && !$scope.hasExecname) {
                        $scope.loadingHostProcesses = false;
                    } else if (!$scope.processes) {
                        if ($scope.host) {
                            var host = JSON.parse($scope.host);
                            DTrace.listProcesses({primaryIp: host.primaryIp}).then(function (list) {
                                $scope.pid = $scope.hasExecname ? list[0].execname :list[0].pid;
                                list.forEach(function (process) {
                                    process.name = ' PID: ' + process.pid + ' CMD: ' + process.cmd;
                                });
                                processes[host.primaryIp] = list;
                                $scope.processes = list;
                                $scope.loadingHostProcesses = false;
                            }, errorCallback);
                        }
                    }
                };

                var getScriptsListType = 'all';
                if ($scope.title === FLAME_GRAPH_TITLE) {
                    getScriptsListType = 'default';
                }

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
                    if (websocket) {
                        $scope.processing = true;
                        websocket.close();
                    }
                    $scope.isRunning = false;
                    $scope.options.loading = false;
                }

                $scope.start = function () {
                    if ($scope.host) {
                        var host = JSON.parse($scope.host);
                        var script = ng.copy(getCurrentScript());
                        if (script && script.body && $scope.pid) {
                            script.body = script.body.replace(EXECNAME_PATTERN, '\"' + $scope.pid + '\"');
                            script.body = script.body.replace(PID_PATTERN, $scope.pid);
                        } else if (script && script.pid && $scope.processes) {
                            script.execname = $scope.processes.some(function (process) {
                                return process.execname === $scope.pid;
                            });
                            script.pid = $scope.pid;
                        }
                        $scope.options = {
                            script: script,
                            hostIp: host.primaryIp,
                            hostId: host.id,
                            start: true
                        };

                        if ($scope.pid && $scope.processes) {
                            $scope.options.selectedProcessName = script.execname ? 'EXECNAME: ' + $scope.pid : $scope.processes.find(function (process) {
                                return process.pid === $scope.pid;
                            }).name;
                        }
                        $scope.isRunning = $scope.processing = true;

                        $scope.options.loading = true;

                        var link = document.createElement('a');
                        link.href = '/main/dtrace/exec/' + window.uuid.v4() + '/' + $scope.options.hostIp;

                        // Magical setting protocol for the href.
                        link.protocol = link.protocol === 'http:' ? 'ws:' : 'wss:';

                        websocket = new WebSocket(link.href);

                        $scope.data = '';

                        websocket.onclose = function () {
                            if (websocket && websocket.readyState !== WebSocket.CLOSED) {
                                websocket.close();
                            }
                            $scope.$apply(function () {
                                $scope.processing = false;
                            });
                        };

                        websocket.onerror = function (error) {
                            DTrace.reportError(error, 'websocket error: ' + error);
                            closeWebsocket();
                        };

                        websocket.onmessage = function (event) {
                            var message = JSON.stringify({type: type, message: script.body || getDscript()});
                            if (event.data === 'connection') {
                                return websocket.send(message);
                            }
                            if (event.data !== 'ping') {
                                if (event.data !== 'started') {
                                    var data = JSON.parse(event.data);
                                    if (data.error) {
                                        $scope.options.loading = $scope.isRunning = false;
                                        return errorCallback(data.error);
                                    }
                                    $scope.$apply(function () {
                                        $scope.options.loading = false;
                                        $scope.data = event.data;
                                    });
                                    if (type === 'flamegraph') {
                                        websocket.send(message);
                                    }
                                }
                                if ($scope.isRunning) {
                                    $scope.$apply(function () {
                                        $scope.processing = false;
                                    });
                                }
                            }
                        };
                    }
                };

                $scope.stop = closeWebsocket;

                $scope.$on('$routeChangeStart', closeWebsocket);
                $scope.$on('$destroy', closeWebsocket);
            }
        ]);
}(window.angular, window.JP.getModule('dtrace')));
