'use strict';

(function (app) {
    app.controller(
        'Docker.RegistriesController', [
            '$scope',
            'Docker',
            'Account',
            'PopupDialog',
            'localization',

            function ($scope, Docker, Account, PopupDialog, localization) {

                $scope.loading = true;
                $scope.registries = [];
                $scope.errorText = '';

                var newRegistry = function () {
                    $scope.registry = {
                        api: null,
                        host: null,
                        port: null,
                        username: null,
                        password: null
                    };
                };
                newRegistry();

                var errorCallback = function (err, dialog) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                $scope.registries = [];

                Docker.getRegistriesList().then(function (list) {
                    $scope.registries = list;
                    $scope.loading = false;
                });

                var addRegistry = function (registry) {
                    if (!registry.username || registry.username.length === 0) {
                        registry.username = 'none';
                    }
                    if (registry.username !== 'none' && registry.password && registry.password.length > 0) {
                        registry.auth = window.btoa(registry.username + ':' + registry.password);
                    }
                    registry.password = null;

                    $scope.registries.push(registry);
                    Docker.saveRegistriesList(angular.copy($scope.registries));
                };

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
                                label: 'Delete',
                                getClass: function () {
                                    return 'btn grid-mini-btn view effect-orange-button';
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

                var checkExists = function (connectedRegistry) {
                    var exist = false;
                    if (!connectedRegistry.username || !connectedRegistry.username.length) {
                        connectedRegistry.username = 'none';
                    }
                    $scope.registries.forEach(function (registry) {
                        if (registry.api === connectedRegistry.api &&
                            registry.host === connectedRegistry.host &&
                            registry.port === connectedRegistry.port &&
                            registry.username === connectedRegistry.username) {
                            exist = true;
                        }
                    });
                    return exist;
                };

                $scope.connectNewRegistry = function () {
                    newRegistry();
                    var opts = {
                        templateUrl: 'docker/static/partials/connect-registry.html',
                        openCtrl: function ($scope, dialog, Docker) {
                            $scope.loadingRegistry = false;
                            $scope.connect = function () {
                                $scope.connectError = false;
                                $scope.loadingRegistry = true;
                                Docker.registryPing($scope.registry).then(function (result) {
                                    if (result) {
                                        $scope.connectError = false;
                                        $scope.loadingRegistry = false;
                                        var registryExist = checkExists($scope.registry);
                                        if (registryExist) {
                                            $scope.loadingRegistry = false;
                                            PopupDialog.error(
                                                localization.translate(
                                                    $scope,
                                                    null,
                                                    'Error'
                                                ),
                                                localization.translate(
                                                    $scope,
                                                    null,
                                                    'Such a registry already exists.'
                                                )
                                            );
                                        } else {
                                            addRegistry($scope.registry);
                                            dialog.close();
                                        }
                                    }
                                }, function (err) {
                                    $scope.errorText = err;
                                    $scope.connectError = true;
                                    $scope.loadingRegistry = false;
                                });
                            };

                            $scope.close = function () {
                                dialog.close();
                            };
                        }
                    };
                    PopupDialog.custom(opts);
                };
            }
        ]);
}(window.JP.getModule('docker')));