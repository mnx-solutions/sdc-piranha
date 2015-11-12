'use strict';

(function (app) {
    app.factory('dockerClone', ['$rootScope', 'Docker', 'PopupDialog', 'dockerPushImage', '$location',  function ($rootScope, Docker, PopupDialog, dockerPushImage, $location) {
        return function(event) {
            var name = event.name;
            var params = event.parsedParams || {};
            if (name === 'push') {
                delete params.image.progress;
                return dockerPushImage(params.image);
            } else if (name === 'run') {
                params.create.name = '';
                params.host = event.host;
                $rootScope.commonConfig('cloneDockerParams', params);
                $location.path('/docker/container/create');
                return;
            }
            PopupDialog.custom({
                templateUrl: 'docker/static/partials/clone-dialog.html',
                openCtrl: ['$scope', 'dialog', 'Docker', 'notification', function (scope, dialog, Docker, notification) {

                    scope.event = event;
                    scope.hasNameField = name === 'run';
                    scope.containerName = '';
                    scope.params = params;
                    scope.loading = true;

                    scope.close = function () {
                        dialog.close();
                    };

                    scope.isAllowed = false;

                    function isAllowedIp() {
                        var selectedRegistry = scope.registries.find(function (registry) {
                            return registry.id === scope.params.registryId;
                        });
                        if (!selectedRegistry || selectedRegistry.type === 'global' || selectedRegistry.type === 'remote') {
                            return true;
                        }

                        return scope.fullRegistriesList.some(function (registry) {
                            return registry.type === 'local' && registry.host.indexOf(scope.hostIp) !== -1;
                        });
                    }

                    var operationChecks = {
                        pull: function () {
                            if (params.registryId === 'default') {
                                return scope.isAllowed = true;
                            }
                            if (scope.fullRegistriesList) {
                                return scope.isAllowed = isAllowedIp();
                            }
                            Docker.getRegistriesList({aggregate: true}).then(function (result) {
                                scope.fullRegistriesList = result.full;
                                scope.registries = result.short;
                                scope.warning = 'You must have local registry created on this host in order to pull';
                                scope.isAllowed = isAllowedIp()
                            });
                        },
                        run: function () {
                            scope.isAllowed = true;
                        },
                        push: function () {

                        }
                    };

                    scope.changeHost = function (selectedHost) {
                        scope.hostIp = selectedHost.primaryIp || scope.hostIp;
                        scope.isAllowed = false;
                        if (name in operationChecks) {
                            operationChecks[name]();
                        }
                    };

                    Docker.listHosts().then(function (hosts) {
                        scope.hosts = hosts || [];
                        scope.hostIp = scope.hosts.length ? scope.hosts[0].primaryIp : null;
                        if (scope.hostIp) {
                            scope.changeHost(scope.hosts[0]);
                        }
                        scope.loading = false;
                    });

                    scope.clone = function () {
                        if (!scope.hostIp || !scope.isAllowed || scope.cloneForm.$invalid) {
                            return;
                        }
                        var host = Docker.getHost(scope.hosts, scope.hostIp);
                        if (name === 'run') {
                            params.create.name = scope.containerName;
                        }
                        Docker.clone(name, host, params).then(function () {
                            notification.success('Clone operation "' + name + '" is completed.');
                        }, function (error) {
                            notification.error(error.message || 'InternalServerError');
                        });
                        scope.close();
                        PopupDialog.message(null, 'Cloning takes some time. You can continue your work and get notification once ' + name + ' is completed.');
                    };
                }]
            });
        }
    }]);
}(window.JP.getModule('docker')));