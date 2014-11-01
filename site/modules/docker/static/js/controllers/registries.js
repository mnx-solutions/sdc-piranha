'use strict';

(function (ng, app) {
    app.controller(
        'Docker.RegistriesController', [
            '$scope',
            '$q',
            'Docker',
            'Account',
            'PopupDialog',
            'localization',
            '$location',

            function ($scope, $q, Docker, Account, PopupDialog, localization, $location) {

                $scope.loading = true;
                $scope.registries = [];

                var errorCallback = function (err) {
                    Docker.errorCallback(err, function () {
                        $scope.loading = false;
                    });
                };

                $scope.registries = [];

                Docker.pingManta(function () {
                    Docker.getRegistriesList().then(function (list) {
                        $scope.registries = list;
                        $scope.loading = false;
                    }, errorCallback);
                });

                var deleteFromRegistries = function (registry) {
                    PopupDialog.confirm(
                        localization.translate(
                            $scope,
                            null,
                            'Confirm: Delete registry'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'Please confirm that you want to delete this registry.'
                        ), function () {
                            var index = $scope.registries.indexOf(registry);
                            if (index !== -1) {
                                $scope.registries.splice(index, 1);
                                Docker.deleteRegistry(registry);
                            }
                        }
                    );
                };

                $scope.gridUserConfig = Account.getUserConfig().$child('docker-registries');

                $scope.gridOrder = [];
                $scope.gridProps = [
                    {
                        id: 'api',
                        name: 'API Version',
                        sequence: 1,
                        active: true
                    },
                    {
                        id: 'host',
                        name: 'Hostname',
                        sequence: 2,
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.processing;
                        },
                        active: true
                    },
                    {
                        id: 'port',
                        name: 'Port',
                        sequence: 3,
                        active: true
                    },
                    {
                        id: 'username',
                        name: 'Username',
                        sequence: 4,
                        active: true
                    },
                    {
                        id: '',
                        name: 'Action',
                        sequence: 5,
                        active: true,
                        type: 'buttons',
                        buttons: [
                            {
                                label: 'Edit',
                                getClass: function () {
                                    return 'btn grid-mini-btn view effect-orange-button';
                                },
                                disabled: function (object) {
                                    return !object.id || object.processing;
                                },
                                action: function (object) {
                                    $scope.connectNewRegistry(object.id);
                                }
                            },
                            {
                                label: 'Delete',
                                getClass: function () {
                                    return 'btn grid-mini-btn download effect-orange-button';
                                },
                                disabled: function (object) {
                                    return !object.id || object.processing;
                                },
                                action: function (object) {
                                    deleteFromRegistries(object);
                                }
                            }
                        ]
                    }
                ];
                $scope.gridActionButtons = [];
                $scope.exportFields = {
                    ignore: []
                };
                $scope.searchForm = true;
                $scope.enabledCheckboxes = false;
                $scope.placeHolderText = 'filter registries';

                $scope.connectNewRegistry = function (registry) {
                    registry = registry || 'create';
                    $location.path('docker/registry/' + registry);
                };
                $scope.$on('createdRegistry', function (event, data) {
                     $scope.registries.forEach(function (registry) {
                         if (registry.id === data.id) {
                             delete registry.processing;
                         }
                     });
                });

                $scope.$on('failedRegistry', function (event, data) {
                    $scope.registries = $scope.registries.filter(function (registry) {
                         return registry.id !== data.id
                     });
                });

                $scope.createNewRegistry = function () {
                    var list = $scope.registries;
                    var opts = {
                        templateUrl: 'docker/static/partials/new-registry.html',
                        openCtrl: function ($scope, $rootScope, dialog, Docker) {
                            $scope.hosts = [];
                            $scope.registry = {
                                host: '',
                                username: '',
                                password: ''
                            };
                            $scope.loading = true;
                            $q.all([Docker.completedHosts(), Docker.listContainers({cache: true, host: 'All', suppressErrors: true})]).then(function (result) {
                                var hosts = {};
                                var availableHosts = result[0];
                                var containers = result[1];
                                availableHosts.forEach(function (host) {
                                    if (host.memory >= 1024) {
                                        hosts[host.name] = host;
                                    }
                                });

                                containers.forEach(function (container) {
                                    if (container.Names.indexOf('/local-registry') !== -1 || container.Names.indexOf('/private-registry') !== -1) {
                                        delete hosts[container.hostName];
                                    }
                                });

                                Object.keys(hosts).forEach(function (hostName) {
                                    $scope.hosts.push(hosts[hostName]);
                                });

                                $scope.registry.host = $scope.hosts[0];
                                $scope.loading = false;
                            });

                            $scope.close = function () {
                                window.jQuery('#hostSelect').select2('close');
                                dialog.close();
                            };

                            $scope.create = function () {
                                var registryExist = list.some(function (item) {
                                    return item.host === 'https://' + $scope.registry.host.primaryIp && parseInt(item.port, 10) === 5000;
                                });
                                if (registryExist) {
                                    $scope.close();
                                    return PopupDialog.error(
                                        localization.translate(
                                            $scope,
                                            null,
                                            'Error'
                                        ),
                                        localization.translate(
                                            $scope,
                                            null,
                                            'This registry already exists.'
                                        )
                                    );
                                }
                                var registry = {
                                    id: uuid(),
                                    api: 'v1',
                                    host: 'https://' + $scope.registry.host.primaryIp,
                                    port: '5000',
                                    processing: true,
                                    type: 'local'
                                };

                                Docker.saveRegistry(registry);
                                list.push(registry);
                                $scope.close();
                                Docker.createNewRegistry(ng.extend({}, $scope.registry)).then(function () {
                                    $rootScope.$broadcast('createdRegistry', registry);
                                }, function (error) {
                                    $rootScope.$broadcast('failedRegistry', registry);
                                    PopupDialog.error(null, error);
                                });
                            };
                        }
                    };
                    PopupDialog.custom(opts);
                };
            }
        ]
    );
}(window.angular, window.JP.getModule('docker')));
