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
                $scope.newRegistryDialogOpening = false;
                $scope.registries = [];

                var errorCallback = function (err) {
                    Docker.errorCallback(err, function () {
                        $scope.loading = false;
                        $scope.newRegistryDialogOpening = false;
                    });
                };

                $scope.registries = [];

                Docker.pingManta(function () {
                    Docker.getRegistriesList({cache: true}).then(function (list) {
                        $scope.registries = ng.copy(list);
                        $scope.registries.forEach(function (registry) {
                            registry['api_version'] = registry.api;
                            registry.hostname = registry.host;
                            registry.login = registry.username || '';
                        });
                        $scope.loading = false;
                    }, errorCallback);
                });

                $scope.gridUserConfig = Account.getUserConfig().$child('docker-registries');

                $scope.gridOrder = [];
                $scope.gridProps = [
                    {
                        id: 'api',
                        name: 'API Version',
                        sequence: 4,
                        active: false
                    },
                    {
                        id: 'host',
                        name: 'Hostname',
                        sequence: 1,
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.actionInProgress;
                        },
                        _getter: function (object) {
                            return object.actionInProgress ? object.host : '<a href="#!/docker/registry/' + object.id + '">' + object.host + '</a>';
                        },
                        active: true
                    },
                    {
                        id: 'port',
                        name: 'Port',
                        sequence: 2,
                        active: true
                    },
                    {
                        id: 'username',
                        name: 'Username',
                        sequence: 3,
                        active: true
                    }
                ];

                $scope.noCheckBoxChecked = function () {
                    PopupDialog.noItemsSelectedError('registries');
                };
                var gridMessages = {
                    delete: {
                        single: 'Please confirm that you want to delete this registry.',
                        plural: 'Please confirm that you want to delete selected registries.'
                    }
                };
                $scope.gridActionButtons = [
                    {
                        label: 'Delete',
                        action: function () {
                            if (!$scope.checkedItems.length) {
                                return $scope.noCheckBoxChecked();
                            }
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Delete registry'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    gridMessages.delete[$scope.checkedItems.length > 1 ? 'plural' : 'single']
                                ),
                                function () {
                                    $scope.checkedItems.forEach(function (registry) {
                                        registry.actionInProgress = true;
                                        registry.checked = false;
                                        Docker.deleteRegistry(registry).then(function () {
                                            $scope.registries.splice($scope.registries.indexOf(registry), 1);
                                        }, errorCallback);
                                    });
                                }
                            );
                        },
                        sequence: 1
                    }
                ];
                $scope.exportFields = {
                    ignore: ['password', 'auth', 'api', 'host']
                };
                $scope.searchForm = true;
                $scope.enabledCheckboxes = true;
                $scope.placeHolderText = 'filter registries';

                $scope.connectNewRegistry = function (registry) {
                    registry = registry || 'create';
                    $location.path('docker/registry/' + registry);
                };
                $scope.$on('createdRegistry', function (event, data) {
                    $scope.registries.forEach(function (registry) {
                        if (registry.id === data.id) {
                            delete registry.actionInProgress;
                        }
                    });
                });

                $scope.$on('failedRegistry', function (event, data) {
                    $scope.registries = $scope.registries.filter(function (registry) {
                        return registry.id !== data.id;
                    });
                });

                function newRegistryDialogOpeningStatus(status) {
                    $scope.newRegistryDialogOpening = status;
                }

                $scope.createNewRegistry = function () {
                    $scope.newRegistryDialogOpening = true;
                    var list = $scope.registries;
                    var opts = {
                        templateUrl: 'docker/static/partials/new-registry.html',
                        openCtrl: function ($scope, $rootScope, dialog, Docker) {
                            $scope.version = Docker.version;
                            $scope.hosts = [];
                            $scope.registry = {
                                host: '',
                                username: '',
                                password: ''
                            };
                            $scope.loading = true;
                            $q.all([Docker.completedHosts({version: true}), Docker.getRegistriesList()]).then(function (result) {
                                var hosts = {};
                                var availableHosts = result[0];
                                var registries = result[1];
                                var parser = document.createElement('a');
                                availableHosts.forEach(function (host) {
                                    if (host.memory >= 1024) {
                                        hosts[host.primaryIp] = host;
                                    } else {
                                        $scope.hasDockerHost = true;
                                    }
                                    if (Docker.version && host.dockerVersion.Version < Docker.version) {
                                        host.versionMismatch = true;
                                    }
                                });

                                registries.forEach(function (registry) {
                                    if (registry.type === 'local') {
                                        parser.href = registry.host;
                                        delete hosts[parser.hostname];
                                    }
                                });

                                Object.keys(hosts).forEach(function (hostName) {
                                    var host = hosts[hostName];
                                    var registryExist = list.some(function (item) {
                                        return item.host === 'https://' + host.primaryIp && parseInt(item.port, 10) === 5000;
                                    });
                                    if (!registryExist) {
                                        $scope.hosts.push(host);
                                    }
                                });

                                $scope.registry.host = $scope.hosts[0];
                                newRegistryDialogOpeningStatus(false);
                                $scope.loading = false;
                            });

                            $scope.close = function () {
                                newRegistryDialogOpeningStatus(false);
                                window.jQuery('#hostSelect').select2('close');
                                dialog.close();
                            };

                            $scope.create = function () {
                                var registry = {
                                    id: uuid(),
                                    api: 'v1',
                                    host: 'https://' + $scope.registry.host.primaryIp,
                                    port: '5000',
                                    actionInProgress: true,
                                    type: 'local'
                                };

                                list.push(registry);
                                $scope.close();
                                Docker.createNewRegistry(ng.extend({registry: registry}, $scope.registry)).then(function () {
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
