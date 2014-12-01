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
                if ($location.path() === '/docker/containers/running') {
                    $scope.forceTabActive = 'running';
                }

                var errorCallback = function (err) {
                    Docker.errorCallback(err, function () {
                        $scope.loading = false;
                    });
                };

                var listAllContainers = function (cache) {
                    Docker.listContainers({host: 'All', cache: cache, options: {all: true}, suppressErrors: true}).then(function (containers) {
                        $scope.containers = containers.map(function (container) {
                            container.ShortId = container.Id.slice(0, 12);
                            container.state = 'stopped';
                            var statuses = [{label: 'Up', state: 'running'}, {label: 'Paused', state: 'paused'}];
                            statuses.forEach(function (status) {
                                if (container.Status.indexOf(status.label) !== -1) {
                                    container.state = status.state;
                                }
                            });
                            var ports = [];
                            container.Ports.forEach(function (port) {
                                if (port.IP && port.PublicPort) {
                                    ports.push(port.IP + ':' + port.PublicPort);
                                }
                            });
                            container.PortsStr = ports.length ? ports.join(', ') : '';
                            return container;
                        });

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
                        id: 'state',
                        name: 'Status',
                        sequence: 7,
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.actionInProgress;
                        },
                        active: true
                    },
                    {
                        id: 'Status',
                        name: 'Duration',
                        sequence: 8,
                        active: true
                    },
                    {
                        id: 'PortsStr',
                        name: 'Ports',
                        sequence: 9
                    },
                    {
                        id: 'hostId',
                        name: 'Host Id',
                        sequence: 10,
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

                function isCAdvisorAction(container, action) {
                    return container.NamesStr === 'cAdvisor' && ['stop', 'pause', 'kill', 'remove'].indexOf(action) !== -1;
                }

                function processContainerAction(action) {
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
                        container.checked = false;
                        Docker[command](container).then(function (response) {
                            $scope.containers.some(function (container) {
                                if (container.Id === response.containerId) {
                                    container.actionInProgress = false;
                                }
                            });
                            deferred.resolve(response);
                        }, function (err) {
                            deferred.reject(err);
                            errorCallback(err);
                            container.actionInProgress = false;
                            container.checked = false;
                            listAllContainers(false);
                        });
                        promises.push(deferred.promise);
                    });

                    $q.all(promises).then(function () {
                        if (action === 'createImage') {
                            return $location.path('/docker/images');
                        }
                        var hasContainersInProgress = $scope.containers.some(function (container) {
                            return container.actionInProgress;
                        });
                        if (!hasContainersInProgress) {
                            listAllContainers(true);
                        }
                    });
                }

                function getMessageBody(messages, containers, action) {
                    var message = messages[containers.length > 1 ? 'plural' : 'single'];
                    var cAdvisorMessage = '';
                    if (containers.length === 1) {
                        cAdvisorMessage = 'Docker analytics will be unavailable. Are you sure you want to ' + action + ' it?';
                        message = isCAdvisorAction(containers[0], action) ? cAdvisorMessage : message;
                    } else {
                        cAdvisorMessage = 'Some of these containers are cAdvisor and Docker analytics will be unavailable after you ' + action + ' it. Are you sure you want to continue?';
                        message = containers.some(function (container) { return isCAdvisorAction(container, action); }) ? cAdvisorMessage : message;
                    }
                    return message;
                }

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
                                getMessageBody(messageBody, $scope.checkedItems, action)
                            ), function () {
                                processContainerAction(action);
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
                    $scope.forceActive = 'hostId';
                }

                Docker.pingManta(function () {
                    listAllContainers(true);
                });

                //create container
                $scope.createContainer = function () {
                    $location.path('/docker/container/create');
                };

            }
        ]);
}(window.JP.getModule('docker')));