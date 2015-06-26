'use strict';

// TODO: review all
(function (ng, app) {
    app.factory('dockerPullImage', ['Docker', 'PopupDialog', '$q', 'util', function (Docker, PopupDialog, $q, util) {
        return function(givenHost, unreachableHosts, progressHandler, pullDialogOpeningStatus, finalCallback) {
            function setPullProgress(hostId, state, image) {
                if (typeof progressHandler === 'function') {
                    Docker.pullForHosts[hostId] = state;
                    progressHandler(hostId, state, image);
                }
            }

            function doFinalCallback () {
                if (typeof finalCallback === 'function') {
                    finalCallback();
                }
            }

            var getHostname = function(address) {
                return util.rewriteUrl({href: address}).hostname;
            };

            var errorCallback = function(err, scope) {
                scope.loading = false;
                Docker.errorCallback(err, function () {
                    if (typeof pullDialogOpeningStatus === 'function') {
                        pullDialogOpeningStatus(false);
                    }
                });
            };

            var closeSelectsAndDialog = function(selects, dialog) {
                selects.forEach(function (select) {
                    ng.element(select).select2('close');
                });
                dialog.close();
            };

            var setRegistryHost = function(scope, image) {
                var selectedRegistry = getSelectedRegistry(scope);
                if (selectedRegistry) {
                    if (selectedRegistry.type === 'local') {
                        image.name = 'localhost:5000/' + image.name;
                    } else if (selectedRegistry.type === 'remote') {
                        var hostname = getHostname(selectedRegistry.host);
                        if (hostname !== 'index.docker.io') {
                            image.name = hostname + ':' + selectedRegistry.port + '/' + image.name;
                        }
                    }
                }
            };

            var removeUnreachableHosts = function(hosts) {
                if (unreachableHosts && unreachableHosts.length > 0) {
                    hosts = hosts.filter(function (host) {
                        return unreachableHosts.every(function (error) {
                            return error.indexOf(host.primaryIp) === -1;
                        });
                    });
                }
                return hosts;
            };

            var getSelectedRegistry = function(scope) {
                return scope.registries.find(function (registry) {
                    return registry.id === scope.registryId;
                });
            };

            var getHosts = function(scope) {
                var selectedRegistry = getSelectedRegistry(scope);
                return Docker[selectedRegistry && selectedRegistry.type === 'local' ? 'listRunningPrivateRegistryHosts' : 'completedHosts']()
            };

            var findImagesCtrl = function ($scope, dialog, Docker) {
                var registry;
                $scope.term = '';
                $scope.loading = true;
                $scope.searching = false;
                Docker.getRegistriesList({aggregate: true}).then(function (result) {
                    $scope.registries = result.short;
                    $scope.fullRegistriesList = result.full;
                    $scope.registries = Docker.addRegistryUsernames($scope.registries);
                    if (typeof pullDialogOpeningStatus === 'function') {
                        pullDialogOpeningStatus(false);
                    }
                    $scope.registryId = $scope.registries[0].id || null;
                    $scope.loading = false;
                }, function (error) {
                    errorCallback(error, $scope);
                });

                function allowedIP($currentScope) {
                    return function () {
                        var selectedRegistry = getSelectedRegistry($scope);
                        if (!selectedRegistry || !$currentScope.hostIp || selectedRegistry.type === 'global' || selectedRegistry.type === 'remote') {
                            return true;
                        }

                        return $scope.fullRegistriesList.some(function (registry) {
                            return registry.type === 'local' && getHostname(registry.host) === $currentScope.hostIp;
                        });
                    };
                }
                $scope.pull = function () {
                    var image = Docker.parseTag($scope.term);
                    var foundImages =  $scope.foundImages = [];
                    var parentScope = $scope;
                    image.tag = image.tag || 'latest';
                    $scope.pulling = true;
                    PopupDialog.custom({
                        templateUrl: 'docker/static/partials/select-tag.html',
                        openCtrl: function ($scope, dialog, Docker) {
                            $scope.selectedHosts = [];
                            $scope.name = image.name;
                            $scope.tag = 'latest';
                            $scope.hideTags = true;
                            $scope.loading = true;
                            getHosts(parentScope).then(function (hosts) {
                                $scope.hosts = hosts && hosts.length ? removeUnreachableHosts(hosts) : [];
                                $scope.loading = false;
                                $scope.hosts && $scope.hosts.forEach(function (host) {
                                    if (givenHost && host.id === givenHost.id) {
                                        $scope.selectedHosts.push(host);
                                    }
                                });
                            });
                            $scope.allowedIP = allowedIP($scope);
                            $scope.pullImage = function () {
                                foundImages.push(image);
                                image.pullProcesses = {};
                                $scope.close();
                                setRegistryHost(parentScope, image);
                                $scope.selectedHosts.forEach(function (selectedHost) {
                                    var host = Docker.getHost($scope.hosts, selectedHost.primaryIp);
                                    setPullProgress(host.id, true);
                                    image.pullProcesses[host.id] = {
                                        host: host,
                                        processing: true,
                                        processStatus: 'Preparing'
                                    };
                                    Docker.pullImage(host, image, parentScope.registryId).then(function (chunk) {
                                        if (!chunk.length || !host.id) {
                                            image.pullProcesses[host.id].processStatus = 'Download error';
                                        } else if (chunk.length === 1 && chunk[0].status === 'Pulling repository ' + $scope.name) {
                                            image.pullProcesses[host.id].processStatus = 'Repository is empty';
                                        }
                                        if (image.pullProcesses[host.id].processStatus === 'Download complete') {
                                            image.pullProcesses[host.id].processStatus = 'Downloading complete';
                                        }
                                        image.pullProcesses[host.id].processing = false;
                                        if (image.pullProcesses[host.id].progressDetail) {
                                            delete image.pullProcesses[host.id].progressDetail;
                                        }
                                        setPullProgress(host.id, false, image);
                                        doFinalCallback();
                                    }, function (err) {
                                        setPullProgress(host.id, false);
                                        foundImages.splice(0, 1);
                                        if (!err.message) {
                                            if (err.statusCode === 404) {
                                                err.message = 'Image not found';
                                            } else if (err.statusCode === 400 || err.statusCode === 500) {
                                                err.message = 'Wrong image name';
                                            } else if (err.code === 'EHOSTUNREACH' || err.code === 'ETIMEDOUT') {
                                                err.message = 'Docker host "' + (host.name || host.primaryIp) + '" is unreachable.';
                                            }
                                        }
                                        image.processing = false;
                                        image.processStatus = '';
                                        errorCallback(err, $scope);
                                    });
                                });
                            };

                            $scope.close = function () {
                                closeSelectsAndDialog(['#tagSelect', '#hostSelect'], dialog);

                            };
                        }
                    });
                };

                $scope.findImages = function () {
                    $scope.pulling = false;
                    $scope.searching = true;
                    $scope.showResult = false;
                    registry = $scope.registryId;

                    if (!registry) {
                        $scope.searching = false;
                        $scope.showResult = true;
                        return;
                    }

                    var updateImages = function (err, images) {
                        if (err) {
                            errorCallback(err, $scope);
                        }
                        $scope.foundImages = (images && images.results) || [];
                        $scope.searching = false;
                        $scope.showResult = true;
                    };

                    Docker.searchImage(registry, $scope.term).then(updateImages.bind(null, null), updateImages);
                };

                $scope.gridOrder = ['-star_count'];
                $scope.gridProps = [
                    {
                        id: 'name',
                        name: 'Name',
                        sequence: 1,
                        active: true
                    },
                    {
                        id: 'star_count',
                        name: 'Stars',
                        sequence: 2,
                        active: true
                    },
                    {
                        id: 'is_official',
                        name: 'Official',
                        sequence: 3,
                        active: true
                    },
                    {
                        id: 'description',
                        name: 'Description',
                        sequence: 4,
                        active: false
                    },
                    {
                        id: 'is_trusted',
                        name: 'Automated',
                        sequence: 5,
                        active: true
                    },
                    {
                        id: '',
                        name: 'Action',
                        sequence: 6,
                        active: true,
                        type: 'button',
                        btn: {
                            label: 'Pull',
                            getClass: function () {
                                return 'btn grid-mini-btn effect-orange-button';
                            },
                            action: function (object) {
                                $scope.pullImage(object);
                            },
                            disabled: function (object) {
                                if (object.pullProcesses) {
                                    var processing = false;
                                    for (var key in object.pullProcesses) {
                                        if (object.pullProcesses[key].processing) {
                                            processing = object.pullProcesses[key].processing;
                                        }
                                    }
                                    if (processing) {
                                        return processing;
                                    }
                                }
                                return $scope.pulling;
                            }
                        }
                    },
                    {
                        id: '',
                        name: 'Process',
                        sequence: 7,
                        active: true,
                        type: 'multipleProgress',
                        _inProgress: function (object) {
                            return object.processing;
                        },
                        _progressBar: function (object) {
                            return object.progressDetail;
                        },
                        _getter: function (object) {
                            return object.processStatus;
                        }
                    }
                ];

                $scope.exportFields = {
                    ignore: []
                };

                $scope.pullImage = function (image) {
                    var parentScope = $scope;
                    PopupDialog.custom({
                        templateUrl: 'docker/static/partials/select-tag.html',
                        openCtrl: function ($scope, dialog, Docker) {
                            $scope.loading = true;
                            $scope.name = image.name;
                            $scope.selectedHosts = [];
                            $q.all([
                                $q.when(getHosts(parentScope)),
                                $q.when(Docker.getImageTags(registry, $scope.name))
                            ]).then(function (result) {
                                $scope.hosts = result[0] && result[0].length ? removeUnreachableHosts(result[0]) : [];
                                $scope.tags = result[1] || [];
                                $scope.tag = $scope.tags[0].name || null;
                                $scope.loading = false;
                                $scope.hosts && $scope.hosts.forEach(function (host) {
                                    if (givenHost && host.id === givenHost.id) {
                                        $scope.selectedHosts.push(host);
                                    }
                                });
                            });

                            $scope.allowedIP = allowedIP($scope);
                            $scope.pullImage = function () {
                                if (!$scope.tag) {
                                    return false;
                                }
                                $scope.close();
                                image.tag = $scope.tag;

                                setRegistryHost(parentScope, image);
                                image.pullProcesses = {};
                                $scope.selectedHosts.forEach(function (selectedHost) {
                                    var host = Docker.getHost($scope.hosts, selectedHost.primaryIp);
                                    image.pullProcesses[host.id] = {
                                        host: host,
                                        processing: true,
                                        processStatus: 'Preparing'
                                    };
                                    setPullProgress(host.id, true);
                                    parentScope.processing = true;

                                    Docker.pullImage(host, image, parentScope.registryId).then(function (chunk) {
                                        if (!chunk.length) {
                                            image.pullProcesses[host.id].processStatus = 'Download error';
                                        }
                                        if (image.pullProcesses[host.id].processStatus === 'Download complete') {
                                            image.pullProcesses[host.id].processStatus = 'Downloading complete';
                                        }
                                        parentScope.processing = image.pullProcesses[host.id].processing = false;
                                        if (image.pullProcesses[host.id].progressDetail) {
                                            delete image.pullProcesses[host.id].progressDetail;
                                        }
                                        setPullProgress(host.id, false, image);
                                        doFinalCallback();
                                    }, function (err) {
                                        setPullProgress(host.id, false);
                                        errorCallback(err, $scope);
                                    });
                                });
                            };

                            $scope.close = function () {
                                closeSelectsAndDialog(['#tagSelect', '#hostSelect'], dialog);
                            };
                        }
                    });
                };

                $scope.close = function () {
                    closeSelectsAndDialog(['#registrySelect'], dialog);
                };
            };

            PopupDialog.custom({
                templateUrl: 'docker/static/partials/find-images.html',
                openCtrl: ['$scope', 'dialog', 'Docker', 'notification', findImagesCtrl]
            });

        }
    }]);
}(window.angular, window.JP.getModule('docker')));