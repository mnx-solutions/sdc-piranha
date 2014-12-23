'use strict';

(function (app) {
    app.factory('dockerClone', ['Docker', 'PopupDialog', 'dockerPushImage',  function (Docker, PopupDialog, dockerPushImage) {
        return function(event) {

            var name = event.name;
            var params = event.parsedParams || JSON.parse(event.Params);
            if (name === 'push') {
                return dockerPushImage(params.image);
            }
            PopupDialog.custom({
                templateUrl: 'docker/static/partials/clone-dialog.html',
                openCtrl: ['$scope', 'dialog', 'Docker', 'notification', function (scope, dialog, Docker, notification) {

                    scope.event = event;

                    scope.hasNameField = name === 'run';
                    scope.containerName = '';
                    scope.params = params;

                    scope.close = function () {
                        window.jQuery('#hostSelect').select2('close');
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

                    scope.changeHost = function () {
                        scope.isAllowed = false;
                        if (name in operationChecks) {
                            operationChecks[name]();
                        }
                    };

                    Docker.listHosts().then(function (hosts) {
                        scope.hosts = hosts || [];
                    });

                    scope.clone = function () {
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