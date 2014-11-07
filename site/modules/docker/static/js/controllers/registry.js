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
            'notification',
            function ($scope, Docker, Account, PopupDialog, localization, $location, requestContext, notification) {

                $scope.registryId = requestContext.getParam('id');

                $scope.loading = true;
                $scope.registries = [];
                $scope.registryApiVersions = ['v1'];

                var newRegistry = function (type) {
                    $scope.registry = {
                        api: $scope.registryApiVersions[0],
                        host: null,
                        port: null,
                        username: null,
                        email: null,
                        password: null,
                        type: type
                    };
                };

                $scope.registries = [];

                Docker.getRegistriesList().then(function (list) {
                    $scope.registries = list;
                    if ($scope.registryId === 'create') {
                        $scope.registryId = null;
                        newRegistry('remote');
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
                    if (!registry.id) {
                        registry.id = uuid();
                        $scope.registries.push(registry);
                    }
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
                            var hubMessage = result.Status || result.toString();
                            if (action === 'auth' && hubMessage.indexOf('Account created') !== -1) {
                                notification.success(hubMessage);
                            }
                            if (action === 'registryPing') {
                                delete $scope.registry.username;
                                delete $scope.registry.password;
                                delete $scope.registry.email;
                            }
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
