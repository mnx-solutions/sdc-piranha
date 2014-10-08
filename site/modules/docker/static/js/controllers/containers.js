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
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                var listAllContainers = function () {
                    Docker.listAllContainers().then(function (containers) {
                        $scope.containers = containers.map(function (container) {
                            container.Id = container.Id.slice(0, 12);
                            container.Names = container.Names.length ? container.Names.join(', ') : '';
                            var ports = container.Ports.map(function (port) {
                                return port.IP + ':' + port.PublicPort;
                            });
                            container.Ports = ports.length ? ports.join(', ') : '';
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

                $scope.gridOrder = ['-created'];
                $scope.gridProps = [
                    {
                        id: 'hostName',
                        name: 'Host',
                        sequence: 1,
                        active: true,
                        type: 'html',
                        _getter: function (container) {
                            return '<a href="#!/docker/container/' + container.hostId + '/' + container.Id + '" style="min-width: 140px;">' + container.hostName + '</a>';
                        }
                    },
                    {
                        id: 'Id',
                        name: 'Container ID',
                        sequence: 2,
                        active: true
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
                        sequence: 5,
                        active: true,
                        reverseSort: true,
                        _getter: function (container) {
                            return $filter('humanDate')(container.Created);
                        }
                    },
                    {
                        id: 'Status',
                        name: 'Status',
                        sequence: 6,
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.actionInProgress;
                        },
                        active: true
                    },
                    {
                        id: 'Ports',
                        name: 'Ports',
                        sequence: 7,
                        active: true
                    },
                    {
                        id: 'Names',
                        name: 'Names',
                        sequence: 8,
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
                    }
                };

                function makeContainerAction(action, messageTitle, messageBody) {
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

                                var promises = [];
                                $scope.checkedItems.forEach(function (container) {
                                    var deferred = $q.defer();
                                    container.actionInProgress = true;
                                    Docker[action + 'Container'](container).then(function (response) {
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
                    }
                ];

                $scope.exportFields = {
                    ignore: []
                };
                $scope.searchForm = true;
                $scope.enabledCheckboxes = true;
                $scope.placeHolderText = 'filter containers';
                $scope.tabFilterField = 'containers';


                listAllContainers();

                //create container
                $scope.createContainer = function () {
                    $location.path('/docker/container/create');
                };

            }
        ]);
}(window.JP.getModule('docker')));