'use strict';

(function (app) {
    app.controller(
        'Docker.LogManagementController', [
            '$scope',
            'Docker',
            'PopupDialog',
            'Account',
            '$rootScope',
            '$location',
            'localization',
            'Storage',

            function ($scope, Docker, PopupDialog, Account, $rootScope, $location, localization, Storage) {
                var REMOVED_CONTAINER_STATUS = 'Deleted';
                $scope.loading = true;
                $scope.containers = [];
                var initialGridProps = null;
                var today = new Date();
                var oneWeekAgo = new Date(today.getTime() - (60 * 60 * 24 * 7 * 1000));
                $scope.date = {
                    start: oneWeekAgo,
                    end: today + 86400
                };

                var errorCallback = function (err) {
                    Docker.errorCallback(err, function () {
                        $scope.loading = false;
                    });
                };

                var dateRangeValidation = function () {
                    $scope.dateError = new Date($scope.date.start).setHours(0, 0, 0, 0) > new Date($scope.date.end).setHours(0, 0, 0, 0);
                };

                var listRemovedContainers = function () {
                    Docker.getRemovedContainers().then(function (removedContainers) {
                        if ($scope.containers.length === 0 && removedContainers.length > 0) {
                            $scope.tab = $scope.tabFilterUpdate = 'Deleted';
                        }
                        removedContainers.forEach(function (container) {
                            container.NamesStr = container.Names.map(function (name) {
                                return name[0] === '/' ? name.substring(1) : name;
                            }).join(', ');
                            container.logs = REMOVED_CONTAINER_STATUS;
                        });
                        $scope.containers = $scope.containers.filter(function (container) {
                            return container.logs !== REMOVED_CONTAINER_STATUS;
                        });
                        $scope.containers = $scope.containers.concat(removedContainers);
                        $scope.loading = false;
                    }, errorCallback);
                };

                function setLogsTab(container) {
                    container.logs = 'All existing';
                    if ($scope.tab === 'Running' && container.Status.indexOf('Up') !== -1) {
                        container.logs = 'Running';
                    }
                }

                $scope.$watch('date.start', function () {
                    dateRangeValidation();
                });
                $scope.$watch('date.end', function () {
                    dateRangeValidation();
                });

                Storage.pingManta(function () {
                    Docker.listContainers({cache: true, host: 'All', options: {all: true}}).then(function (containers) {
                        $scope.containers = angular.copy(containers);
                        $scope.containers.forEach(function (container) {
                            container.Created = new Date(container.Created * 1000);
                            setLogsTab(container);
                        });
                        listRemovedContainers();
                    }, errorCallback);
                });

                function unixtimeToDate(seconds) {
                    var customDate = new Date(seconds * 1000);
                    var year = customDate.getFullYear();
                    var month = customDate.getMonth() + 1 < 10 ? '0' + (customDate.getMonth() + 1) : customDate.getMonth() + 1;
                    var date = customDate.getDate() < 10 ? '0' + customDate.getDate() : customDate.getDate();
                    customDate = year + '-' + month + '-' + date;
                    return customDate.toString();
                }

                $scope.viewLog = function (container, action) {
                    var date = {
                        start: Math.floor($scope.date.start.getTime() / 1000),
                        end: Math.floor($scope.date.end.getTime() / 1000)
                    };
                    if (action === 'show') {
                        container.primaryIp = container.primaryIp || '';
                        window.open('docker/show?host=' + container.hostId + '&container=' + container.Id + '&ip=' + container.primaryIp +
                                '&start=' + unixtimeToDate(date.start) + '&end=' + unixtimeToDate(date.end), '_blank');
                    } else {
                        container.primaryIp = container.primaryIp || '';
                        window.location.href = 'docker/download?host=' + container.hostId + '&container=' + container.Id + '&ip=' + container.primaryIp +
                                '&start=' + unixtimeToDate(date.start) + '&end=' + unixtimeToDate(date.end);
                    }
                };

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = 'dockerLogs';
                    // The next needed to handle change of the config grid properties
                    Account.getUserConfig($scope.gridUserConfig, function (config) {
                        $scope.userConfig = config;
                    });
                    $scope.$watch('userConfig', function () {
                        initialGridProps = angular.copy($scope.gridProps);
                    });
                }

                var gridMessages = {
                    remove: {
                        single: 'Please confirm that you want to remove this log.',
                        plural: 'Please confirm that you want to remove selected logs.'
                    }
                };

                var checkedLogs = function (checked) {
                    var logs = [];
                    $scope.checkedItems.forEach(function (log) {
                        if (checked) {
                            logs.push(log);
                        }
                        log.actionInProgress = checked;
                        log.checked = checked;
                    });
                    return logs;
                };

                function removeContainerLogs(messageTitle, messageBody) {
                    if ($scope.checkedItems.length) {
                        PopupDialog.confirm(
                            localization.translate(
                                $scope,
                                null,
                                messageTitle
                            ),
                            localization.translate(
                                $scope,
                                null,
                                messageBody[$scope.checkedItems.length > 1 ? 'plural' : 'single']
                            ), function () {
                                var logs = checkedLogs(true);
                                Docker.removeDeletedContainerLogs(logs).then(function () {
                                    $scope.checkedItems = [];
                                    listRemovedContainers();
                                }, function (err) {
                                    checkedLogs(false);
                                    errorCallback(err);
                                });
                            }
                        );
                    } else {
                        $scope.noCheckBoxChecked();
                    }
                }

                function analyzeContainerLogs() {
                    var selectedContainers = $scope.checkedItems.length;
                    if (selectedContainers) {
                        var logs = checkedLogs(true);
                        var dates = {
                            start: Math.floor($scope.date.start.getTime() / 1000),
                            end: Math.floor($scope.date.end.getTime() / 1000)
                        };
                        Docker.analyzeLogs({logs: logs, dates: dates}).then(function (logFiles) {
                            if (logFiles.length > 0) {
                                $scope.checkedItems = [];
                                var job = {
                                    inputs: logFiles
                                };
                                $rootScope.commonConfig('analyzeLogsJob', job);
                                $location.path('/manta/builder');
                            } else {
                                checkedLogs(false);
                                PopupDialog.message('Message', 'The log files for selected containers have not been uploaded to manta just yet.');
                            }
                        }, function (err) {
                            checkedLogs(false);
                            errorCallback(err);
                        });
                    } else {
                        $scope.noCheckBoxChecked();
                    }
                }

                $scope.noCheckBoxChecked = function () {
                    PopupDialog.noItemsSelectedError('logs');
                };

                $scope.gridOrder = [];
                $scope.gridActionButtons = [
                    {
                        label: 'Remove',
                        action: function () {
                            removeContainerLogs('Confirm: Remove logs', gridMessages.remove);
                        },
                        show: function () {
                            return $scope.tab !== 'Running' && $scope.tab !== 'All existing';
                        },
                        sequence: 1
                    },
                    {
                        label: 'Analyze logs',
                        action: function () {
                            analyzeContainerLogs();
                        },
                        show: function () {
                            return $scope.tab !== REMOVED_CONTAINER_STATUS;
                        },
                        sequence: 2
                    }
                ];
                $scope.gridProps = [
                    {
                        id: 'hostName',
                        name: 'Host',
                        _order: 'hostName',
                        sequence: 1,
                        active: true,
                        type: 'html',
                        _getter: function (container) {
                            var html = '<a href="#!/compute/instance/' + container.hostId + '" style="min-width: 140px;">' + container.hostName + '</a>';
                            if (container.hostState === 'removed' || container.isSdc) {
                                html = '<span>' + container.hostName + '</span>';
                            }
                            return html;
                        }
                    },
                    {
                        id: 'ShortId',
                        name: 'Container ID',
                        sequence: 2,
                        active: true,
                        type: 'html',
                        _getter: function (container) {
                            var shortId = container.ShortId || container.Id.slice(0, 12);
                            var html = '<a href="#!/docker/container/' + container.hostId + '/' + shortId + '" style="min-width: 140px;">' + shortId + '</a>';
                            if (container.logs === REMOVED_CONTAINER_STATUS) {
                                html = '<span>' + shortId + '</span>';
                            }
                            return html;
                        }
                    },
                    {
                        id: 'Image',
                        name: 'Image',
                        sequence: 3,
                        active: true
                    },
                    {
                        id: 'Command',
                        name: 'Command',
                        sequence: 4,
                        active: true
                    },
                    {
                        id: 'Created',
                        name: 'Created',
                        type: 'date',
                        sequence: 5,
                        active: true
                    },
                    {
                        id: 'Deleted',
                        name: 'Deleted',
                        type: 'date',
                        sequence: 6,
                        active: true
                    },
                    {
                        id: 'Status',
                        name: 'Status',
                        sequence: 7,
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.actionInProgress;
                        },
                        active: true
                    },
                    {
                        id: 'NamesStr',
                        name: 'Names',
                        sequence: 8,
                        active: true
                    },
                    {
                        id: 'Ports',
                        name: 'Ports',
                        _getter: function (container) {
                            return Docker.parsePorts(container.Ports);
                        },
                        sequence: 9,
                        active: false
                    },
                    {
                        id: '',
                        name: 'Action',
                        sequence: 10,
                        active: true,
                        type: 'buttons',
                        buttons: [
                            {
                                label: 'View',
                                getClass: function () {
                                    return 'btn grey';
                                },
                                action: function (object) {
                                    $scope.viewLog(object, 'show');
                                },
                                disabled: function (object) {
                                    return $scope.dateError;
                                }
                            },
                            {
                                label: 'Download',
                                getClass: function () {
                                    return 'btn grey';
                                },
                                action: function (object) {
                                    $scope.viewLog(object, 'download');
                                },
                                disabled: function (object) {
                                    return $scope.dateError;
                                }
                            }
                        ]
                    }
                ];
                $scope.enabledCheckboxes = true;
                $scope.searchForm = true;
                $scope.placeHolderText = 'filter containers';
                $scope.tabFilterField = 'logs';
                $scope.exportFields = {
                    ignore: ['Action']
                };
                initialGridProps = angular.copy($scope.gridProps);

                $scope.$on('gridViewChangeTab', function (event, tab) {
                    if ($scope.tab && $scope.tab === tab || !$scope.userConfig) {
                        return;
                    }
                    $scope.tab = tab;
                    var isDeletedTab = $scope.tab === REMOVED_CONTAINER_STATUS;
                    if (isDeletedTab) {
                        $scope.gridOrder = ['-' + REMOVED_CONTAINER_STATUS];
                    }
                    $scope.gridProps.forEach(function (el) {
                        for (var i = 0; i < initialGridProps.length; i++) {
                            if (initialGridProps[i].id === el.id) {
                                return initialGridProps[i] = angular.copy(el);
                            }
                        }
                    });
                    var hiddenColumns = ['Command', 'Created', 'Status'];
                    $scope.gridProps = angular.copy(initialGridProps);
                    $scope.gridProps = $scope.gridProps.filter(function (el) {
                        return hiddenColumns.indexOf(el.id) === -1 && isDeletedTab ||
                            el.id !== REMOVED_CONTAINER_STATUS && !isDeletedTab;
                    });
                    $scope.containers.forEach(function (container) {
                        if (container.logs !== REMOVED_CONTAINER_STATUS) {
                            setLogsTab(container);
                        }
                    });
                });

            }
        ]);
}(window.JP.getModule('docker')));
