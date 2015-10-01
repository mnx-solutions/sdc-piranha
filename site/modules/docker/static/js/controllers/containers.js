'use strict';

(function (app) {
    app.controller(
        'Docker.ContainersController', [
            '$scope',
            'requestContext',
            'localization',
            'Docker',
            '$q',
            'PopupDialog',
            'Storage',
            '$location',
            '$filter',
            '$rootScope',
            function ($scope, requestContext, localization, Docker, $q, PopupDialog, Storage, $location, $filter, $rootScope) {
                var CURRENT_PAGE_ACTION = 'docker.containers';

                localization.bind('docker', $scope);
                requestContext.setUpRenderContext(CURRENT_PAGE_ACTION, $scope, {
                    title: localization.translate(null, 'docker', 'See my Joyent Docker Containers')
                });

                var hostId = requestContext.getParam('host') || '';
                var updateContainersInfo;
                $scope.loading = true;
                $scope.permittedHosts = [];
                $scope.availableSearchParams = [];
                if ($location.path() === '/docker/containers/running') {
                    $scope.forceTabActive = 'running';
                }
                var sdcDatacenter;
                $scope.searchParams = {};
                $scope.editSearchParam = false;

                var errorCallback = function (err) {
                    Docker.errorCallback(err, function () {
                        $scope.loading = false;
                    });
                };

                var hasContainersInProgress = function () {
                    return $scope.containers.some(function (container) {
                        return container.actionInProgress;
                    }) || false;
                };

                var hasCheckedContainers = function () {
                    return $scope.containers.some(function (container) {
                        return container.checked;
                    }) || false;
                };

                var getStatsWithInterval = function (start) {
                    clearInterval(updateContainersInfo);
                    if (!start) {
                        return;
                    }
                    var INTERVAL = 30000; // ms
                    updateContainersInfo = setInterval(function () {
                        if (!hasCheckedContainers() && !$scope.editSearchParam) {
                            listAllContainers(false);
                        }
                        if (hasContainersInProgress()) {
                            clearInterval(updateContainersInfo);
                        }
                    }, INTERVAL);
                };

                var getContainerState = function (container, isUpdate) {
                    if (isUpdate) {
                        return Docker.inspectContainer(container).then(function (info) {
                            return Docker.getContainerState(info);
                        }, errorCallback);
                    } else {
                        if (container.Status.indexOf('Up') > -1) {
                            if (container.Status.indexOf('Paused') > -1) {
                                container.state = 'paused';
                            } else {
                                container.state = 'running';
                            }
                        } else {
                            container.state = 'stopped';
                        }
                        return container.state;
                    }
                };

                var getLabelsFromContainers = function (containers) {
                    var labels = {};
                    containers.forEach(function (container) {
                        Object.keys(container.Labels || {}).forEach(function (key) {
                            if (labels[key]) {
                                if (labels[key].indexOf(container.Labels[key]) === -1) {
                                    labels[key].push(container.Labels[key]);
                                }
                            } else {
                                labels[key] = [container.Labels[key]];
                            }
                        });
                    });
                    return labels;
                };

                var addProvisioningContainers = function (containers, provisioningContainers) {
                    var provisioningContainerIds = Object.keys(provisioningContainers);
                    provisioningContainerIds.forEach(function (containerId) {
                        var container = provisioningContainers[containerId];
                        if (container.error) {
                            var err = container.error;
                            if (typeof err === 'string') {
                                if (err.indexOf('cpuset.cpus: invalid') !== -1) {
                                    err = 'Cannot start container. Invalid argument: Cpuset.';
                                } else if (err.indexOf('cpuset.cpus: numerical result') !== -1) {
                                    err = 'Cannot start container. CPUset value is out of numerical range.';
                                }
                            }
                            errorCallback(err);
                            Docker.removeDockerContainersProvisioning(containerId);
                        } else {
                            containers.push(container);
                        }
                    });
                    if (provisioningContainerIds.length) {
                        delete Docker.cache.containers;
                    }
                };

                var listAllContainers = function (cache) {

                    Docker.listContainers({host: 'All', cache: cache, options: {all: true}, suppressErrors: true}).then(function (containers) {
                        $q.all([
                            Docker.listHosts({prohibited: true}),
                            Docker.listHosts(),
                            Docker.loadPredefinedSearchParams(),
                            Docker.getDockerContainersProvisioning()
                        ]).then(function (result) {
                            containers = containers || [];
                            var hosts = result[0] || [];
                            $scope.permittedHosts = result[1] || [];
                            $scope.host = $scope.permittedHosts[0];
                            $scope.searchParams = result[2];
                            var provisioningContainers = result[3] || {};

                            $scope.showRequestTritonBtn = hosts.find(function (host) {
                                return host.isSdc && host.prohibited;
                            });
                            hosts.some(function (host) {
                                if (host.isSdc) {
                                    sdcDatacenter = host.datacenter;
                                    return true;
                                }
                            });

                            if (hostId) {
                                containers = containers.filter(function (container) {
                                    return container.hostId === hostId;
                                });
                            }
                            $scope.containersFilter = Docker.getHostFilter(hostId, hosts);
                            $scope.containers = containers.map(function (container) {
                                container.state = getContainerState(container, false);
                                container.actionInProgress = container.isRemoving;
                                return container;
                            });

                            addProvisioningContainers($scope.containers, provisioningContainers);

                            var labels = getLabelsFromContainers($scope.containers);
                            Object.keys($scope.searchParams).forEach(function (key) {
                                if (key !== 'query') {
                                    if (labels[key]) {
                                        $scope.searchParams[key] = $scope.searchParams[key].filter(function (value) {
                                            return labels[key].indexOf(value) !== -1 || value === '';
                                        });
                                    } else {
                                        delete $scope.searchParams[key];
                                    }
                                }
                            });
                            $scope.availableSearchParams = Object.keys(labels).map(function (label) {
                                return {
                                    key: label,
                                    name: label,
                                    placeholder: 'label',
                                    values: labels[label]
                                };
                            });

                            $scope.loading = false;
                            getStatsWithInterval(true);
                        }, function (err) {
                            errorCallback(err);
                        });
                    }, function (err) {
                        errorCallback(err);
                    });
                };

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = 'docker-containers';
                }

                var getContainerType = function (container) {
                    return container.isSdc ? 'Triton' : 'KVM';
                };

                $scope.gridOrder = ['-created'];
                $scope.gridProps = [
                    {
                        id: 'ShortId',
                        name: 'Container ID',
                        sequence: 1,
                        active: true,
                        type: 'html',
                        _getter: function (container) {
                            var html = '<a href="#!/docker/container/' + container.hostId + '/' + container.Id + '" style="min-width: 140px;">' + container.ShortId + '</a>';
                            if (container.isRemoving || ['Removal In Progress', 'Dead', 'Created'].indexOf(container.Status) > -1) {
                                html = container.ShortId;
                            }
                            return html;
                        }
                    },
                    {
                        id: 'NamesStr',
                        name: 'Names',
                        sequence: 2,
                        active: true
                    },
                    {
                        id: 'type',
                        name: 'Type',
                        sequence: 3,
                        type: 'html',
                        _export: function (container) {
                            return getContainerType(container);
                        },
                        _getter: function (container) {
                            var type = getContainerType(container);
                            return '<div class="' + type.toLowerCase() + '-type' + '">' + type + '</div>';
                        },
                        active: true
                    },
                    {
                        id: 'ipAddress',
                        name: 'IP',
                        entryType: 'ipAddress',
                        sequence: 4,
                        active: true
                    },
                    {
                        id: 'hostName',
                        name: 'Host',
                        sequence: 5,
                        active: true
                    },
                    {
                        id: 'Image',
                        name: 'Image',
                        sequence: 6,
                        active: true
                    },
                    {
                        id: 'Command',
                        name: 'Command',
                        sequence: 7
                    },
                    {
                        id: 'Created',
                        name: 'Created',
                        sequence: 8,
                        reverseSort: true,
                        _getter: function (container) {
                            return container.Created ? $filter('humanDate')(container.Created) : '';
                        }
                    },
                    {
                        id: 'state',
                        name: 'Status',
                        sequence: 9,
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.actionInProgress;
                        },
                        active: true
                    },
                    {
                        id: 'Status',
                        name: 'Duration',
                        sequence: 10,
                        active: true
                    },
                    {
                        id: 'Ports',
                        name: 'Ports',
                        sequence: 11
                    },
                    {
                        id: 'hostId',
                        name: 'Host ID',
                        sequence: 12,
                        active: true,
                        exportGetter: true,
                        _getter: function (container) {
                            return container.isSdc ? 'N/A' : container.hostId;
                        }
                    },
                    {
                        id: 'Labels',
                        name: 'Labels',
                        sequence: 13
                    }
                ];
                var gridMessages = {
                    start: {
                        single: 'Start selected container?',
                        plural: 'Start selected containers?'
                    },
                    stop : {
                        single: 'Please confirm that you want to stop this container.',
                        plural: 'Please confirm that you want to stop selected containers.'
                    },
                    pause: {
                        single: 'Please confirm that you want to pause this container.',
                        plural: 'Please confirm that you want to pause selected containers.'
                    },
                    unpause: {
                        single: 'Unpause this container?',
                        plural: 'Unpause selected containers?'
                    },
                    remove: {
                        single: 'Please confirm that you want to remove this container.',
                        plural: 'Please confirm that you want to remove selected containers.'
                    },
                    kill: {
                        single: 'Please confirm that you want to kill this container.',
                        plural: 'Please confirm that you want to kill selected containers.'
                    },
                    restart: {
                        single: 'Please confirm that you want to restart this container.',
                        plural: 'Please confirm that you want to restart selected containers.'
                    },
                    createImage: {
                        plural: 'Please confirm that you want to create images from selected containers.'
                    }
                };

                var processContainerComplete = function (container) {
                    getContainerState(container, true).then(function (state) {
                        container.state = state;
                        container.actionInProgress = false;
                        getStatsWithInterval(true);
                        delete Docker.cache.containers;
                    });
                };

                function processContainerAction(action) {
                    var promises = [];
                    var bothKvmAndTritonSelected = $scope.checkedItems.length > 1 && $scope.checkedItems.some(function (item) {
                        return !item.isSdc;
                    });
                    $scope.checkedItems.forEach(function (container) {
                        container.checked = false;
                        if (container.isSdc) {
                            var message = null;
                            if (action.indexOf('pause') > -1) {
                                message = 'Pausing of containers is not presently supported in SDC-Docker.';
                            } else if (action === 'createImage') {
                                message = bothKvmAndTritonSelected ?
                                    'Some of the selected containers are at SDC-Docker and do not support image creation.' :
                                    'Creating image from container is not presently supported in SDC-Docker.';
                            }
                            if (message) {
                                return errorCallback(message);
                            }
                        }
                        var deferred = $q.defer();
                        var command = action;
                        container.actionInProgress = true;
                        if (action === 'createImage') {
                            container.container = container.Id;
                        } else {
                            command += 'Container';
                        }
                        getStatsWithInterval(false);
                        Docker[command](container).then(function (response) {
                            if (action === 'remove') {
                                $scope.containers = $scope.containers.filter(function (item) {
                                    return container.Id !== item.Id;
                                });
                                listAllContainers(false);
                            }
                            $scope.containers.some(function (container) {
                                if (container.Id === response.containerId) {
                                    container.ipAddress = response.NetworkSettings ? response.NetworkSettings.IPAddress : container.ipAddress;
                                    processContainerComplete(container);
                                }
                            });
                            deferred.resolve(response);
                        }, function (err) {
                            deferred.reject(err);
                            errorCallback(err);
                            processContainerComplete(container);
                            listAllContainers(false);
                        });
                        promises.push(deferred.promise);
                    });

                    $q.all(promises).then(function () {
                        if (action === 'createImage' && bothKvmAndTritonSelected) {
                            return $location.path('/docker/images');
                        }

                        if (!hasContainersInProgress()) {
                            listAllContainers(false);
                        }
                    });
                }

                function makeContainerAction(action, messageTitle, messageBody) {
                    if ($scope.checkedItems.length) {
                        if (action === 'createImage' && $scope.checkedItems.length === 1) {
                            var container = $scope.checkedItems[0];
                            $location.path('/docker/image/create/' + container.hostId + '/' + container.Id);
                            return;
                        }
                        PopupDialog.confirmAction(
                            messageTitle,
                            action,
                            'container',
                            $scope.checkedItems.length,
                            messageBody,
                            function () {
                                processContainerAction(action);
                            }
                        );
                    } else {
                        $scope.noCheckBoxChecked();
                    }
                }

                $scope.noCheckBoxChecked = function () {
                    PopupDialog.noItemsSelectedError('containers');
                };

                $scope.gridActionButtons = [
                    {
                        label: 'Start',
                        action: function () {
                            makeContainerAction('start', 'Start containers');
                        },
                        sequence: 1
                    },
                    {
                        label: 'Stop',
                        action: function () {
                            makeContainerAction('stop', 'Stop containers');
                        },
                        sequence: 2
                    },
                    {
                        label: 'Pause',
                        action: function () {
                            makeContainerAction('pause', 'Pause containers');
                        },
                        sequence: 3
                    },
                    {
                        label: 'Unpause',
                        action: function () {
                            makeContainerAction('unpause', 'Unpause containers');
                        },
                        sequence: 4
                    },
                    {
                        label: 'Remove',
                        action: function () {
                            makeContainerAction('remove', 'Remove containers');
                        },
                        sequence: 5
                    },
                    {
                        label: 'Kill',
                        action: function () {
                            makeContainerAction('kill', 'Kill containers');
                        },
                        sequence: 6
                    },
                    {
                        label: 'Restart',
                        action: function () {
                            makeContainerAction('restart', 'Restart containers');
                        },
                        sequence: 7
                    },
                    {
                        label: 'Create Image',
                        action: function () {
                            makeContainerAction('createImage', 'Create images from containers',
                                'Please confirm that you want to create images from selected containers.');
                        },
                        sequence: 7
                    }
                ];

                $scope.exportFields = {
                    ignore: []
                };
                $scope.searchForm = $scope.advancedSearchBox = true;
                $scope.enabledCheckboxes = true;
                $scope.placeHolderText = 'filter containers';
                $scope.tabFilterField = 'state';

                Storage.pingManta(function () {
                    listAllContainers(true);
                });

                $scope.$watchCollection('searchParams', function (searchParams) {
                    if (searchParams) {
                        Docker.savePredefinedSearchParams(searchParams);
                    }
                });

                $scope.$on('$routeChangeSuccess', function(next, current) {
                    if (current.$$route.action === CURRENT_PAGE_ACTION) {
                        hostId = requestContext.getParam('host') || '';
                        listAllContainers(true);
                    }
                });

                $rootScope.$on('clearDockerCache', function () {
                    listAllContainers(true);
                });

                //create container
                $scope.createContainer = function () {
                    $location.path('/docker/container/create');
                };
                $scope.$on('$destroy', function () {
                    clearInterval(updateContainersInfo);
                });

            }
        ]);
}(window.JP.getModule('docker')));
