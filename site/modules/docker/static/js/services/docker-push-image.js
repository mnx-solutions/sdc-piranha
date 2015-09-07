'use strict';

(function (ng, app) {
    app.factory('dockerPushImage', ['Docker', 'PopupDialog', function (Docker, PopupDialog) {
        return function (image) {
            if (!Docker.registriesPushInProgress) {
                Docker.registriesPushInProgress = [];
            }
            PopupDialog.custom({
                templateUrl: 'docker/static/partials/push-image.html',
                openCtrl: ['$scope', 'dialog', 'Docker', 'notification', function (scope, dialog, Docker, notification) {
                    var parsedTag = Docker.parseTag(image.RepoTag);
                    scope.loading = true;
                    scope.registries = [];
                    scope.tag = '';
                    scope.imageName = parsedTag.name;
                    scope.input = {
                        registryId: '',
                        name: parsedTag.name || ''
                    };
                    scope.image = image;
                    scope.userHost = '';

                    Docker.getRegistriesList({aggregate: true}, image.primaryIp).then(function (result) {
                        scope.registries = result.short;
                        scope.registries = Docker.addRegistryUsernames(scope.registries, true);
                        scope.input.registryId = scope.registries[0] && scope.registries[0].id || '';
                        scope.loading = false;
                    });

                    scope.close = function () {
                        dialog.close();
                    };
                    scope.validateName = function () {
                        var viewValue = scope.newRegistryForm.name.$viewValue;
                        var parsedTag = Docker.parseTag(viewValue);
                        var isValid = !!parsedTag;

                        if (parsedTag) {
                            if (parsedTag.repository && !/^[a-z0-9_]{4,30}$/.test(parsedTag.repository)) {
                                scope.errorMessage = 'Namespace error: only [a-z0-9_] are allowed, size between 4 and 30';
                            } else if (!/^[a-z0-9-_\.]+$/.test(parsedTag.onlyname)) {
                                scope.errorMessage = 'Name error: only [a-z0-9-_.] are allowed';
                            } else if (parsedTag.tag && !/^[A-Za-z0-9_\.\-]{2,30}$/.test(parsedTag.tag)) {
                                scope.errorMessage = 'Tag error: only [A-Za-z0-9_.-] are allowed, minimum 2, maximum 30 in length';
                            } else {
                                scope.errorMessage = '';
                            }
                            isValid = false;
                        }

                        scope.newRegistryForm.$setValidity('name', isValid);
                    };
                    scope.push = function () {
                        if (scope.loading || !scope.input.name || scope.errorMessage ||
                            scope.registries && !scope.registries.length) {
                            return;
                        }
                        if (Docker.registriesPushInProgress[scope.input.registryId]) {
                            return PopupDialog.message('Message', 'Another image is being pushed to this registry, please let it finish.');
                        }
                        Docker.registriesPushInProgress[scope.input.registryId] = true;
                        var registry;
                        if (scope.input.registryId === Docker.REGISTRY_LOCAL) {
                            registry = {
                                id: Docker.REGISTRY_LOCAL,
                                host: 'http://localhost',
                                port: Docker.DEFAULT_REGISTRY_PORT,
                                type: Docker.REGISTRY_LOCAL
                            };
                        } else {
                            registry = scope.registries.find(function (registry) {
                                return registry.id === scope.input.registryId;
                            });
                        }
                        var logElement = ng.element('div.push-image-log');
                        var isScrolledDown = true;
                        scope.$on('LastRepeaterElement', function () {
                            if (isScrolledDown) {
                                logElement.scrollTop(999999);
                            }
                        });
                        logElement.bind('scroll', function () {
                            isScrolledDown = logElement.scrollTop() + logElement.innerHeight() >= logElement[0].scrollHeight;
                        });
                        image.progress = ['Pushing of image "' + scope.input.name + '" started...'];
                        Docker.pushImage({
                            host: {primaryIp: image.primaryIp, id: image.hostId},
                            options: {
                                image: image,
                                registry: registry,
                                tag: parsedTag.tag,
                                name: scope.input.name
                            }
                        }, function (error) {
                            Docker.registriesPushInProgress[scope.input.registryId] = false;
                            if (error) {
                                notification.error(error.message || error);
                            }
                        }).then(function () {
                            Docker.registriesPushInProgress[scope.input.registryId] = false;
                            var completedMessage = 'Pushing of image "' + scope.input.name + '" is completed.';
                            if (dialog && dialog.isOpen()) {
                                image.progress.push(completedMessage);
                            } else {
                                notification.success(completedMessage);
                            }
                        }, function (error) {
                            Docker.registriesPushInProgress[scope.input.registryId] = false;
                            notification.error(error.message || 'InternalServerError');
                        });
                    };
                }]
            });
        };
    }]);
}(window.angular, window.JP.getModule('docker')));
