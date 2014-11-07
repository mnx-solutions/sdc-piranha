'use strict';

(function (app) {
    app.controller(
        'Docker.ContainersController', [
            '$scope',
            'requestContext',
            'localization',
            'Docker',
            '$q',
            'PopupDialog',
            '$location',
            '$filter',
            'Account',
            function ($scope, requestContext, localization, Docker, $q, PopupDialog, $location, $filter, Account) {
                localization.bind('docker', $scope);
                requestContext.setUpRenderContext('docker.containers', $scope, {
                    title: localization.translate(null, 'docker', 'See my Joyent Docker Containers')
                });

                $scope.loading = true;

                var errorCallback = function (err) {
                    Docker.errorCallback(err, function () {
                        $scope.loading = false;
                    });
                };

                var listAllContainers = function () {
                    Docker.listContainers({host: 'All', options: {all: true}, suppressErrors: true}).then(function (containers) {
                        Docker.listHosts().then(function (machines) {
                            $scope.containers = containers.map(function (container) {
                                container.ShortId = container.Id.slice(0, 12);
                                var ports = container.Ports.map(function (port) {
                                    return port.IP + ':' + port.PublicPort;
                                });
                                container.PortsStr = ports.length ? ports.join(', ') : '';
                                machines.some(function (machine) {
                                    if (machine.name === container.hostName) {
                                        container.HostId = machine.id;
                                        return true;
                                    }
                                });
                                return container;
                            });
                        }, errorCallback);

                        $scope.loading = false;
                    }, function (err) {
                        errorCallback(err);
                    });
                };

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = Account.getUserConfig().$child('docker-containers');
                }

                $scope.query = requestContext.getParam('host') || '';
                $scope.gridOrder = ['-created'];
                $scope.gridProps = [
                    {
                        id: 'ShortId',
                        name: 'Container ID',
                        sequence: 1,
                        active: true,
                        type: 'html',
                        _getter: function (container) {
                            return '<a href="#!/docker/container/' + container.hostId + '/' + container.Id + '" style="min-width: 140px;">' + container.ShortId + '</a>';
                        }
                    },
                    {
                        id: 'NamesStr',
                        name: 'Names',
                        sequence: 2,
                        active: true
                    },
                    {
                        id: 'hostName',
                        name: 'Host',
                        sequence: 3,
                        active: true
                    },
                    {
                        id: 'Image',
                        name: 'Image',
                        sequence: 4,
                        active: true
                    },
                    {
                        id: 'Command',
                        name: 'Command',
                        sequence: 5
                    },
                    {
                        id: 'Created',
                        name: 'Created',
                        sequence: 6,
                        reverseSort: true,
                        _getter: function (container) {
                            return $filter('humanDate')(container.Created);
                        }
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
                        id: 'PortsStr',
                        name: 'Ports',
                        sequence: 8
                    },
                    {
                        id: 'HostId',
                        name: 'Host Id',
                        sequence: 9,
                        active: true
                    }
                ];
                
                var gridMessages = {
                    start: {
                        single: 'Start selected container?',
                        plural: 'Start selected containers?'
                    },
                    stop : {
                        single: 'Please confirm that you want to stop this container.',
                        plural: 'Please confirm that you want to stop selected containers.'
                    },
                    pause: {
                        single: 'Please confirm that you want to pause this container.',
                        plural: 'Please confirm that you want to pause selected containers.'
                    },
                    unpause: {
                        single: 'Unpause this container?',
                        plural: 'Unpause selected containers?'
                    },
                    remove: {
                        single: 'Please confirm that you want to remove this container.',
                        plural: 'Please confirm that you want to remove selected containers.'
                    },
                    kill: {
                        single: 'Please confirm that you want to kill this container.',
                        plural: 'Please confirm that you want to kill selected containers.'
                    },
                    restart: {
                        single: 'Please confirm that you want to restart this container.',
                        plural: 'Please confirm that you want to restart selected containers.'
                    },
                    createImage: {
                        plural: 'Please confirm that you want to create images from selected containers.'
                    }
                };

                function makeContainerAction(action, messageTitle, messageBody) {
                    if ($scope.checkedItems.length) {
                        if (action === 'createImage' && $scope.checkedItems.length === 1) {
                            var container = $scope.checkedItems[0];
                            $location.path('/docker/image/create/' + container.hostId + '/' + container.Id);
                            return;
                        }
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

                                var promises = [];
                                $scope.checkedItems.forEach(function (container) {
                                    var deferred = $q.defer();
                                    var command = action;
                                    container.actionInProgress = true;
                                    if (action === 'createImage') {
                                        container.container = container.Id;
                                    } else {
                                        command += 'Container';
                                    }
                                    Docker[command](container).then(function (response) {
                                        deferred.resolve(response);
                                    }, function (err) {
                                        deferred.reject(err);
                                        errorCallback(err);
                                        container.actionInProgress = false;
                                        container.checked = false;
                                    });
                                    promises.push(deferred.promise);
                                });

                                $q.all(promises).then(function () {
                                    $scope.checkedItems = [];
                                    if (action === 'createImage') {
                                        return $location.path('/docker/images');
                                    }
                                    listAllContainers();
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
                            'No containers selected for the action.'
                        ), function () {
                        }
                    );
                };

                $scope.gridActionButtons = [
                    {
                        label: 'Start',
                        action: function () {
                            makeContainerAction('start', 'Confirm: Start containers', gridMessages.start);
                        },
                        sequence: 1
                    },
                    {
                        label: 'Stop',
                        action: function () {
                            makeContainerAction('stop', 'Confirm: Stop containers', gridMessages.stop);
                        },
                        sequence: 2
                    },
                    {
                        label: 'Pause',
                        action: function () {
                            makeContainerAction('pause', 'Confirm: Pause containers', gridMessages.pause);
                        },
                        sequence: 3
                    },
                    {
                        label: 'Unpause',
                        action: function () {
                            makeContainerAction('unpause', 'Confirm: Unpause containers', gridMessages.unpause);
                        },
                        sequence: 4
                    },
                    {
                        label: 'Remove',
                        action: function () {
                            makeContainerAction('remove', 'Confirm: Remove containers', gridMessages.remove);
                        },
                        sequence: 5
                    },
                    {
                        label: 'Kill',
                        action: function () {
                            makeContainerAction('kill', 'Confirm: Kill containers', gridMessages.kill);
                        },
                        sequence: 6
                    },
                    {
                        label: 'Restart',
                        action: function () {
                            makeContainerAction('restart', 'Confirm: Restart containers', gridMessages.restart);
                        },
                        sequence: 7
                    },
                    {
                        label: 'Create Image',
                        action: function () {
                            makeContainerAction('createImage', 'Confirm: Create images from containers', gridMessages.createImage);
                        },
                        sequence: 7
                    }
                ];

                $scope.exportFields = {
                    ignore: []
                };
                $scope.searchForm = true;
                $scope.enabledCheckboxes = true;
                $scope.placeHolderText = 'filter containers';
                $scope.tabFilterField = 'containers';
                if (requestContext.getParam('host')) {
                    $scope.forceActive = 'HostId'
                }

                Docker.pingManta(function () {
                    listAllContainers();
                });

                //create container
                $scope.createContainer = function () {
                    $location.path('/docker/container/create');
                };

            }
        ]);
}(window.JP.getModule('docker')));