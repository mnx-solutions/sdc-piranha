'use strict';

(function (app) {
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

                var errorCallback = function (err, dialog) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                $scope.registries = [];

                Docker.getRegistriesList().then(function (list) {
                    $scope.registries = list;
                    $scope.loading = false;
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
                            }
                            Docker.saveRegistriesList(angular.copy($scope.registries));
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
                                    return !object.id;
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

                $scope.createNewRegistry = function () {
                    var opts = {
                        templateUrl: 'docker/static/partials/new-registry.html',
                        openCtrl: function ($scope, dialog, Docker) {
                            $scope.hosts = [];
                            $scope.registry = {
                                host: '',
                                username: '',
                                password: ''
                            };
                            $scope.loading = true;
                            $q.all([Docker.listHosts(), Docker.listContainers({cache: true, host: 'All'})]).then(function (result) {
                                var hosts = {};
                                var availableHosts = result[0];
                                var containers = result[1];
                                availableHosts.forEach(function (host) {
                                    hosts[host.name] = host;
                                });

                                containers.forEach(function (container) {
                                    if (container.Names.indexOf('/local-registry') !== -1 || container.Names.indexOf('/private-registry') !== -1) {
                                        delete hosts[container.hostName];
                                    }
                                });

                                Object.keys(hosts).forEach(function (hostName) {
                                    $scope.hosts.push(hosts[hostName]);
                                });

                                $scope.loading = false;
                            });

                            $scope.close = function () {
                                dialog.close();
                            };
                            $scope.create = function () {
                                dialog.close();

                                Docker.createNewRegistry(angular.extend({}, $scope.registry)).then(
                                    function () {
                                        Docker.getRegistriesList().then(function (list) {
                                            list.push({
                                                api: 'v1',
                                                host: 'http://' + $scope.registry.host.primaryIp,
                                                port: 5000
                                            });
                                            Docker.saveRegistriesList(list);
                                        });
                                    },
                                    function (error) {
                                        PopupDialog.error(null, error);
                                    }
                                );
                            };
                        }
                    };
                    PopupDialog.custom(opts);
                };
            }
        ]
    );
}(window.JP.getModule('docker')));