'use strict';

(function (app) {
    app.controller(
        'Docker.RegistryController', [
            '$scope',
            'Docker',
            'Account',
            'PopupDialog',
            'localization',
            '$location',
            'requestContext',

            function ($scope, Docker, Account, PopupDialog, localization, $location, requestContext) {

                $scope.registryId = requestContext.getParam('id');

                $scope.loading = true;
                $scope.registries = [];
                $scope.registryApiVersions = ['v1'];

                var newRegistry = function () {
                    $scope.registry = {
                        api: $scope.registryApiVersions[0],
                        host: null,
                        port: null,
                        username: null,
                        password: null
                    };
                };

                var errorCallback = function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                $scope.registries = [];

                Docker.getRegistriesList().then(function (list) {
                    $scope.registries = list;
                    if ($scope.registryId === 'create') {
                        $scope.registryId = null;
                        newRegistry();
                    } else {
                        $scope.registries.forEach(function (registry) {
                            if (registry.id === $scope.registryId) {
                                $scope.registry = registry;
                            }
                        });
                    }
                    $scope.loading = false;
                });

                var addRegistry = function (registry) {
                    if (!registry.username || registry.username.length === 0) {
                        registry.username = 'none';
                    }
                    if (registry.username !== 'none' && registry.password && registry.password.length > 0) {
                        registry.auth = window.btoa(registry.username + ':' + registry.password);
                    }
                    if (!registry.id) {
                        registry.id = uuid();
                        $scope.registries.push(registry);
                    } else {
                        $scope.registries.forEach(function (existingRegistry) {
                            if (registry.id === existingRegistry.id) {
                                if (registry.username !== 'none' && registry.password && registry.password.length > 0) {
                                    registry.auth = window.btoa(registry.username + ':' + registry.password);
                                }
                                existingRegistry = registry;
                            }
                        });
                    }
                    registry.password = null;
                    Docker.saveRegistriesList(angular.copy($scope.registries)).then(function () {
                        $location.path('docker/registries');
                    });
                };

                var checkExists = function (connectedRegistry) {
                    var exist = false;
                    if (!connectedRegistry.username || !connectedRegistry.username.length) {
                        connectedRegistry.username = 'none';
                    }
                    $scope.registries.forEach(function (registry) {
                        registry.id = registry.id || '';
                        if (registry.api === connectedRegistry.api &&
                            registry.host === connectedRegistry.host &&
                            registry.port === connectedRegistry.port &&
                            registry.username === connectedRegistry.username &&
                            registry.id !== connectedRegistry.id) {
                            exist = true;
                        }
                    });
                    return exist;
                };

                $scope.connectRegistry = function () {
                    $scope.loading = true;
                    Docker.registryPing($scope.registry).then(function (result) {
                        if (result) {
                            $scope.loading = false;
                            var registryExist = checkExists($scope.registry);
                            if (registryExist) {
                                $scope.loading = false;
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
                            }
                        }
                    }, function (err) {
                        if (err.indexOf('html') > -1 || err.toLowerCase().indexOf('not found') > -1) {
                            err = 'The requested URL <code>/v1/_ping</code> was not found.';
                        } else if (err.indexOf('Internal Server') > -1) {
                            err = 'Internal Server Error';
                        }
                        PopupDialog.errorObj('Failed to connect: ' + err);
                        $scope.loading = false;
                    });
                };
            }
        ]);
}(window.JP.getModule('docker')));