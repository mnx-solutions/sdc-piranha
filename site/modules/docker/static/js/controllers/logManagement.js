'use strict';

(function (app) {
    app.controller(
        'Docker.LogManagementController', [
            '$scope',
            'Docker',
            'PopupDialog',
            'Account',

            function ($scope, Docker, PopupDialog, Account) {
                $scope.loading = true;
                $scope.containers = [];
                var today = new Date();
                var oneWeekAgo = new Date(today.getTime() - (60*60*24*7*1000));
                $scope.date = {
                    start: oneWeekAgo,
                    end: today
                };

                var errorCallback = function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                var dateRangeValidation = function () {
                    $scope.dateError = new Date($scope.date.start).setHours(0, 0, 0, 0) > new Date($scope.date.end).setHours(0, 0, 0, 0);
                };

                $scope.$watch('date.start', function () {
                    dateRangeValidation();
                });
                $scope.$watch('date.end', function () {
                    dateRangeValidation();
                });

                Docker.listContainers({cache: true, host: 'All'}).then(function (containers) {
                    $scope.containers = angular.copy(containers);
                    $scope.containers.forEach(function (container) {
                        container.Created = new Date(container.Created * 1000);
                        container.ShortId = container.Id.slice(0, 12);
                        var ports = [];
                        container.Ports.forEach(function (port) {
                            if (port.IP && port.PrivatePort && port.PublicPort && port.Type) {
                                ports.push(port.IP + ':' + port.PrivatePort + ' -> ' + port.PublicPort + '/' + port.Type);
                            }
                        });
                        if (ports.length === 0) {
                            container.Ports[0] = 'none';
                        } else {
                            container.Ports = ports;
                        }
                    });
                    $scope.loading = false;
                }, errorCallback);

                $scope.viewLog = function (hostId, containerId, action) {
                    var date = {
                        start: Math.floor($scope.date.start.getTime()/1000),
                        end: Math.floor($scope.date.end.getTime()/1000)
                    };
                    if (action === 'show') {
                        window.open('docker/show?host=' + hostId + '&container=' + containerId + '&start=' + date.start + '&end=' + date.end, '_blank');
                    } else {
                        window.location.href = 'docker/download?host=' + hostId + '&container=' + containerId + '&start=' + date.start + '&end=' + date.end;
                    }
                };

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = Account.getUserConfig().$child('dockerLogs');
                }

                $scope.gridOrder = [];
                $scope.gridActionButtons = [];
                $scope.gridProps = [
                    {
                        id: 'hostName',
                        name: 'Host',
                        _order: 'name',
                        sequence: 1,
                        active: true,
                        type: 'html',
                        _getter: function (container) {
                            return '<a href="#!/compute/instance/' + container.hostId + '" style="min-width: 140px;">' + container.hostName + '</a>';
                        }
                    },
                    {
                        id: 'ShortId',
                        name: 'Container ID',
                        sequence: 2,
                        active: true,
                        type: 'html',
                        _getter: function (container) {
                            return '<a href="#!/docker/container/' + container.hostId + '/' + container.ShortId + '" style="min-width: 140px;">' + container.ShortId + '</a>';
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
                        id: 'Status',
                        name: 'Status',
                        sequence: 6,
                        type: 'date',
                        active: true
                    },
                    {
                        id: 'Names',
                        name: 'Names',
                        sequence: 7,
                        type: 'html',
                        _getter: function (object) {
                            var html = '<span>' + object.Names.join(", ") + '</span>';
                            return html;
                        },
                        active: true
                    },
                    {
                        id: 'SizeRw',
                        name: 'File Size',
                        sequence: 8,
                        active: true
                    },
                    {
                        id: 'Ports',
                        name: 'Ports',
                        type: 'html',
                        _getter: function (object) {
                            var html = '<span>' + object.Ports.join(" ,") + '</span>';
                            return html;
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
                                    return 'btn grid-mini-btn view effect-orange-button';
                                },
                                action: function (object) {
                                    $scope.viewLog(object.hostId, object.Id, 'show');
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
                                    $scope.viewLog(object.hostId, object.Id, 'download');
                                },
                                disabled: function (object) {
                                    return $scope.dateError;
                                }
                            }
                        ]
                    }
                ];
                $scope.enabledCheckboxes = false;
                $scope.searchForm = true;
                $scope.placeHolderText = 'filter containers';
                $scope.exportFields = [];
            }
        ]);
}(window.JP.getModule('docker')));