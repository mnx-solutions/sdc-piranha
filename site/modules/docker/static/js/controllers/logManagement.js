'use strict';

(function (app) {
    app.controller(
        'Docker.LogManagementController', [
            '$scope',
            'Docker',
            'PopupDialog',
            'Account',
            'localization',

            function ($scope, Docker, PopupDialog, Account, localization) {
                var REMOVED_CONTAINER_STATUS = 'Deleted';
                $scope.loading = true;
                $scope.containers = [];
                var today = new Date();
                var oneWeekAgo = new Date(today.getTime() - (60*60*24*7*1000));
                $scope.date = {
                    start: oneWeekAgo,
                    end: today
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
                                return name.substring(1);
                            }).join(', ');
                            container.ShortId = container.Id.slice(0, 12);
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

                Docker.pingManta(function () {
                    Docker.listContainers({cache: true, host: 'All', options: {all: true}}).then(function (containers) {
                        $scope.containers = angular.copy(containers);
                        $scope.containers.forEach(function (container) {
                            container.Created = new Date(container.Created * 1000);
                            container.ShortId = container.Id.slice(0, 12);
                            var ports = [];
                            container.Ports.forEach(function (port) {
                                if (port.IP && port.PublicPort) {
                                    ports.push(port.IP + ':' + port.PublicPort);
                                }
                            });
                            container.PortsStr = ports.length ? ports.join(', ') : '';
                            setLogsTab(container);
                        });
                        listRemovedContainers();
                    }, errorCallback);
                });

                $scope.viewLog = function (container, action) {
                    var date = {
                        start: Math.floor($scope.date.start.getTime()/1000),
                        end: Math.floor($scope.date.end.getTime()/1000)
                    };
                    if (action === 'show') {
                        container.primaryIp = container.primaryIp || '';
                        window.open('docker/show?host=' + container.hostId + '&container=' + container.Id + '&ip=' + container.primaryIp + '&start=' + date.start + '&end=' + date.end, '_blank');
                    } else {
                        container.primaryIp = container.primaryIp || '';
                        window.location.href = 'docker/download?host=' + container.hostId + '&container=' + container.Id + '&ip=' + container.primaryIp + '&start=' + date.start + '&end=' + date.end;
                    }
                };

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = Account.getUserConfig().$child('dockerLogs');
                }

                var gridMessages = {
                    remove: {
                        single: 'Please confirm that you want to remove this log.',
                        plural: 'Please confirm that you want to remove selected logs.'
                    }
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
                                var logs = [];
                                var checkedLogs = function (checked) {
                                    $scope.checkedItems.forEach(function (log) {
                                        if (checked) {
                                            logs.push(log);
                                        }
                                        log.actionInProgress = checked;
                                        log.checked = checked;
                                    });
                                };
                                checkedLogs(true);
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

                $scope.noCheckBoxChecked = function () {
                    PopupDialog.error(
                        localization.translate(
                            $scope,
                            null,
                            'Error'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'No logs selected for the action.'
                        ), function () {
                        }
                    );
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
                            if (container.hostState === 'removed') {
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
                            var html = '<a href="#!/docker/container/' + container.hostId + '/' + container.ShortId + '" style="min-width: 140px;">' + container.ShortId + '</a>';
                            if (container.logs === REMOVED_CONTAINER_STATUS) {
                                html = '<span>' + container.ShortId + '</span>';
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
                        active: false
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
                        id: 'PortsStr',
                        name: 'Ports',
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
                                    return 'btn grid-mini-btn view effect-orange-button';
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
                                    return 'btn grid-mini-btn download effect-orange-button';
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
                $scope.exportFields = [];

                $scope.$on('gridViewChangeTab', function (event, tab) {
                    $scope.tab = tab;
                    if ($scope.tab === REMOVED_CONTAINER_STATUS) {
                        $scope.gridOrder = ['-' + REMOVED_CONTAINER_STATUS];
                    }
                    var hideColumns = ['Command', 'Created', 'Status'];
                    $scope.gridProps.forEach(function (el) {
                        if (hideColumns.indexOf(el.id) !== -1) {
                            el.active = $scope.tab !== REMOVED_CONTAINER_STATUS;
                        }
                        if (el.id === REMOVED_CONTAINER_STATUS) {
                            el.active = $scope.tab === REMOVED_CONTAINER_STATUS;
                        }
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