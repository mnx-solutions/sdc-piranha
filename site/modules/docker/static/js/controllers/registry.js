'use strict';

(function (ng, app) {
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
                        email: null,
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
                                $scope.portChanged($scope.registry.port);
                            }
                        });
                    }
                    $scope.loading = false;
                });

                $scope.portChanged = function (port) {
                    $scope.portValid = /^\d+$/.test(port) && port > -1 && port < 65536;
                };

                var addRegistry = function (registry) {
                    if (registry.username && registry.password && registry.password.length > 0) {
                        registry.auth = window.btoa(registry.username + ':' + registry.password);
                    }
                    if (!registry.id) {
                        registry.id = uuid();
                        $scope.registries.push(registry);
                    }
                    registry.password = null;
                    Docker.saveRegistry(registry).then(function () {
                        $location.path('docker/registries');
                    });
                };

                var checkExists = function (connectedRegistry) {
                    var exist = false;
                    $scope.registries.forEach(function (registry) {
                        registry.id = registry.id || '';
                        if (registry.api === connectedRegistry.api &&
                            registry.host === connectedRegistry.host &&
                            registry.port === connectedRegistry.port &&
                            registry.username == connectedRegistry.username &&
                            registry.email == connectedRegistry.email &&
                            registry.id !== connectedRegistry.id) {
                            exist = true;
                        }
                    });
                    return exist;
                };

                $scope.connectRegistry = function () {
                    $scope.loading = true;
                    var registryExist = checkExists($scope.registry);
                    if (registryExist) {
                        $scope.loading = false;
                        return PopupDialog.error(
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
                    }
                    var registry = ng.extend({}, $scope.registry);
                    var action = 'registryPing';
                    if (registry.username && registry.password) {
                        action = 'auth';
                        registry.serveraddress = registry.host + '/' + registry.api + '/';
                        delete registry.host;
                        delete registry.api;
                    }
                    Docker[action](registry).then(function (result) {
                        if (result) {
                            addRegistry($scope.registry);
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
}(window.angular, window.JP.getModule('docker')));
