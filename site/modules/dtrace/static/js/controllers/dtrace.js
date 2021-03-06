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
            'util',
            function ($scope, Account, DTrace, Storage, $q, requestContext, localization, PopupDialog, $route, util) {
                localization.bind('dtrace', $scope);
                requestContext.setUpRenderContext('dtrace.script', $scope, {
                    title: localization.translate(null, 'dtrace', 'See my ' + $scope.company.name + ' DTrace Heatmap')
                });
                $scope.title = $route.current.$$route.title;
                $scope.devToolsPath = DTrace.devToolsLink();

                var DTRACE_SCRIPTS = {
                    'heatmap': function (script) {
                        return 'syscall:::entry' + (script.pid ? '/' + (script.execname ? 'execname == "' + script.pid + '"'  : 'pid == ' + script.pid) + '/' : '') +
                            '{self->syscall_entry_ts[probefunc] = vtimestamp;}' +
                            'syscall:::return/self->syscall_entry_ts[probefunc]/{@time[probefunc] = lquantize((vtimestamp - ' +
                            'self->syscall_entry_ts[probefunc] ) / 1000, 0, 63, 2);self->syscall_entry_ts[probefunc] = 0;}';
                    },
                    'flamegraph': function (script) {
                        return '-n \'profile-97 /' +
                            (script.pid ? (script.execname ? 'execname == "' + script.pid + '"'  : 'pid == ' + script.pid) : 'arg1') +
                            '/ { @[jstack(150, 8000)] = count(); } tick-30s { exit(0); }\''
                    }
                };

                var TITLES = {
                    heatmap: 'Heatmap',
                    flamegraph: 'Flame Graph',
                    coreDump: 'Core Dump'
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
                var FLAME_GRAPH_SCRIPT_NAME = 'syscall for process';
                var UNAUTHORIZED_ERROR = 'UnauthorizedError';
                var DTRACE_ERROR = 'DTrace error';
                var scriptsListType = 'all';
                var websocket;
                var type;

                var errorCallback = function (err) {
                    var logLevel;
                    var message = err;
                    if ($scope.host) {
                        message = 'DTrace Instance "' + $scope.host.name + '" is currently unreachable.';
                        if (err.indexOf(UNAUTHORIZED_ERROR) !== -1 || err.indexOf('401') !== -1) {
                            message = 'DTrace certificates are invalid for Instance "' + $scope.host.name + '".';
                        }
                        if (err.indexOf(DTRACE_ERROR) !== -1) {
                            message = err;
                        } else if (err.indexOf('Error parsing json for Heatmap') !== -1) {
                            message = 'Currently \'' + $scope.scriptName + '\' can\'t be executed on ' + $scope.host.name + '.';
                            logLevel = 'info';
                        }
                    }
                    DTrace.reportError(message, 'websocket error: ' + err, logLevel);
                    $scope.loadingHostProcesses = $scope.processing = $scope.loading = false;
                };

                if ($scope.title === TITLES.heatmap) {
                    type = 'heatmap';
                } else if ($scope.title === TITLES.flamegraph || $scope.title === TITLES.coreDump) {
                    scriptsListType = 'default';
                    type = $scope.title === TITLES.flamegraph ? 'flamegraph' : 'coreDump';
                }

                var setGroupForScript = function () {
                    $scope.scripts.forEach(function (script) {
                        if (!script.type) {
                            script.type = 'private';
                        }
                    });
                };

                Account.getAccount(true).then(function (account) {
                    $scope.provisionEnabled = account.provisionEnabled;
                    if ($scope.provisionEnabled) {
                        Storage.pingManta(function () {
                            $q.all([DTrace.listHosts(), DTrace.getScriptsList(scriptsListType)]).then(function (result) {
                                $scope.hosts = result[0] || [];
                                $scope.scripts = result[1] || [];
                                setGroupForScript();
                                $scope.scriptName = $scope.scripts ? $scope.scripts[0].name : '';
                                $scope.host = $scope.hosts[0];
                                if ($scope.title !== TITLES.heatmap) {
                                    $scope.scriptName = FLAME_GRAPH_SCRIPT_NAME;
                                }
                                updateProcesses();
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
                    var script = $scope.scripts.find(function (script) {
                        return script.name === $scope.scriptName;
                    });
                    if ($scope.title === TITLES.coreDump) {
                        script.execname = false;
                    }
                    return script;
                };
                var updateProcesses = function () {
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
                            DTrace.listProcesses({primaryIp: $scope.host.primaryIp}).then(function (list) {
                                $scope.pid = $scope.hasExecname ? list[0].execname : list[0].pid;
                                list.forEach(function (process) {
                                    process.name = ' PID: ' + process.pid + ' CMD: ' + process.cmd;
                                });
                                processes[$scope.host.primaryIp] = list;
                                var processList = [];
                                list.forEach(function (process) {
                                    if ($scope.hasPid) {
                                        var pidProcess = angular.copy(process);
                                        pidProcess.group = 'pid';
                                        processList.push(pidProcess);
                                    }
                                    if ($scope.hasExecname) {
                                        var execnameProcess = angular.copy(process);
                                        execnameProcess.group = 'execname';
                                        processList.push(execnameProcess);
                                    }
                                });
                                $scope.processes = processList;
                                $scope.loadingHostProcesses = false;
                            }, errorCallback);
                        }
                    }
                };

                scriptsListType = 'all';
                if ($scope.title === TITLES.flamegraph) {
                    scriptsListType = 'default';
                }

                $scope.refreshScripts = function () {
                    if ($scope.isRunning) {
                        $scope.stop();
                    }
                    updateProcesses();
                };

                $scope.changeHost = function (selectedHost) {
                    $scope.host = selectedHost;
                    if ($scope.host) {
                        if (processes[$scope.host.primaryIp]) {
                            $scope.processes = processes[$scope.host.primaryIp];
                        } else {
                            updateProcesses();
                        }
                    }
                };

                $scope.changeScript = function (scriptName) {
                    $scope.scriptName = scriptName;
                    updateProcesses();
                };

                $scope.changeProcess = function (process) {
                    $scope.pid = process.group === 'pid' ? process.pid : process.execname;
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
                            hostIp: $scope.host.primaryIp,
                            hostId: $scope.host.id,
                            start: true
                        };

                        if ($scope.pid && $scope.processes) {
                            $scope.options.selectedProcessName = script.execname ? 'EXECNAME: ' + $scope.pid : $scope.processes.find(function (process) {
                                return process.pid === $scope.pid;
                            }).name;
                        }
                        $scope.isRunning = $scope.processing = true;

                        var getDScript = function () {
                            return DTRACE_SCRIPTS[type](script);
                        };

                        $scope.options.loading = true;

                        var url = util.rewriteUrl({
                            href: '/main/dtrace/exec/' + window.uuid.v4() + '/' + $scope.options.hostIp,
                            isWS: true
                        });
                        websocket = new WebSocket(url.href);

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
                            var message = JSON.stringify({
                                type: type,
                                message: type === 'coreDump' ? $scope.pid : script.body || getDScript(),
                                hostId: $scope.options.hostId
                            });

                            if (event.data === 'connection') {
                                return websocket.send(message);
                            }

                            if (event.data !== 'ping') {
                                if (event.data !== 'started') {
                                    var parsedResult;
                                    var errorMessage;
                                    try {
                                        parsedResult = JSON.parse(event.data);
                                    } catch (ex) {
                                        errorMessage = 'Error parsing json for ' + $scope.title + '.';
                                    }
                                    if (errorMessage || parsedResult.error) {
                                        var err =  errorMessage || parsedResult.error;
                                        $scope.options.loading = $scope.isRunning = false;
                                        return errorCallback(err);
                                    } else {
                                        $scope.$apply(function () {
                                            $scope.options.loading = false;
                                            $scope.data = parsedResult;
                                        });
                                    }
                                    if (type === 'coreDump') {
                                        closeWebsocket();
                                    } else if (type === 'flamegraph') {
                                        websocket.send(message);
                                    }
                                }

                                if ($scope.isRunning) {
                                    $scope.$apply(function () {
                                        $scope.processing = false;
                                    });
                                }
                            }
                        }
                    }
                };

                $scope.stop = closeWebsocket;

                $scope.$on('$routeChangeStart', closeWebsocket);
                $scope.$on('$destroy', closeWebsocket);
            }
        ]);
}(window.angular, window.JP.getModule('dtrace')));
