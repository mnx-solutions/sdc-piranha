'use strict';

(function (ng, app) {
    app.controller(
        'Docker.ContainerCreateController', [
            '$scope',
            'requestContext',
            'localization',
            'Docker',
            '$q',
            'PopupDialog',
            '$location',
            function ($scope, requestContext, localization, Docker, $q, PopupDialog, $location) {
                localization.bind('docker', $scope);
                requestContext.setUpRenderContext('docker.create', $scope, {
                    title: localization.translate(null, 'docker', 'Create Docker Container')
                });
                $scope.loading = true;

                var sourceId = requestContext.getParam('sourceid');
                var hostId = requestContext.getParam('hostid');

                $scope.title = 'Create Container';
                $scope.createImage = false;
                $scope.type = $location.path().search('image/create') === -1 ? 'Containers' : 'Images';
                if ($scope.type === 'Images') {
                    $scope.createImage = true;
                    $scope.title = 'Create Image From Container';
                }

                var errorCallback = function (err) {
                    $scope.loading = false;
                    $scope.creating = false;
                    PopupDialog.errorObj(err);
                };

                var setDefaultValues = function (values) {
                    $scope.commands = values.Command || '';
                };

                var selectSource = function (items, id) {
                    var defaultItem;
                    if (sourceId && Array.isArray(items)) {
                        defaultItem = items.filter(function (item) {
                            return item.Id === sourceId;
                        });
                    }
                    defaultItem = (defaultItem && defaultItem[0]) || items[0];
                    return id ? defaultItem[id] : defaultItem;
                };

                var hostImages = function (host) {
                    if (host && host.primaryIp) {
                        $scope.loadingHostDetails = true;
                        $scope.images = [];
                        $scope.container.container = 'base';
                        Docker.listImages(host).then(function (images) {

                            $scope.images = images.map(function (image) {
                                var tag = image.RepoTags[0];
                                image.ShortId = image.Id.slice(0, 12);
                                image.name = tag === '<none>:<none>' ? image.ShortId : tag;
                                return image;
                            });
                            if ($scope.images.length > 0) {
                                $scope.container.Image = selectSource($scope.images, 'name');
                                setTimeout(function () {
                                    window.jQuery('#imageSelect').select2('val', $scope.container.Image);
                                });
                            } else {
                                errorCallback('This docker host does not have images available for new container.');
                            }
                            $scope.loadingHostDetails = false;
                        });
                    }
                };

                var hostContainers = function (host) {
                    if (host && host.primaryIp) {
                        $scope.loadingHostDetails = true;
                        $scope.container.Image = 'base';
                        $scope.containers = [];
                        Docker.listContainers({host: host, options: {all: true}}).then(function (containers) {
                            $scope.containers = containers.map(function (container) {
                                container.ShortId = container.Id.slice(0, 12);
                                container.Names = container.Names.length ? container.Names.join(', ') : '';
                                return container;
                            });
                            $scope.container.primaryIp = host.primaryIp;
                            if ($scope.containers.length > 0) {
                                $scope.container.container = selectSource($scope.containers, 'Id');
                                setTimeout(function () {
                                    window.jQuery('#containerSelect').select2('val', $scope.container.container);
                                    setDefaultValues($scope.containers[0]);
                                });
                            } else {
                                errorCallback('This docker host does not have containers for new image.');
                            }
                            $scope.loadingHostDetails = false;
                        });
                    }
                };

                $scope.changeHost = function (host) {
                    host = host || {primaryIp: $scope.ip};
                    if ($scope.type === 'Images') {
                        hostContainers(host);
                    } else {
                        hostImages(host);
                    }
                };

                $scope.changeContainer = function () {
                    if ($scope.container.container) {
                        var container = $scope.containers.filter(function (container) {
                            return container.Id === $scope.container.container;
                        });
                        setDefaultValues(container[0]);
                    }
                };

                $scope.portPattern = '(6553[0-5]|655[0-2]\\d|65[0-4]\\d{2}|6[0-4]\\d{3}|[1-5]\\d{4}|[1-9]\\d{0,3})';
                $scope.exposedPattern = '(((\\d{1,3}\.){3}\\d{1,3}\\:)?' + $scope.portPattern + '?\\:)?' + $scope.portPattern;

                Docker.listHosts().then(function (hosts) {
                    $scope.hosts = hosts || [];
                    $scope.loading = false;
                    $scope.memory = 0;
                    $scope.memorySwap = 0;
                    $scope.networkMode = 'bridge';
                    $scope.container = {
                        "Hostname": "",
                        "Domainname": "",
                        "User": "",
                        "Memory": 0,
                        "MemorySwap": 0,
                        "CpuShares": 0,
                        "Cpuset": "",
                        "AttachStdin": true,
                        "AttachStdout": true,
                        "AttachStderr": true,
                        "PortSpecs": [],
                        "Tty": true,
                        "OpenStdin": true,
                        "StdinOnce": false,
                        "Env": null,
                        "Cmd": [],
                        "ExposedPorts": {},
                        "WorkingDir": "",
                        "NetworkDisabled": false,
                        "name": ""
                    };
                    if (hostId) {
                        $scope.hosts.forEach(function (host) {
                            if (hostId === host.id) {
                                $scope.ip = host.primaryIp;
                                $scope.changeHost();
                            }
                        });
                    }
                }, errorCallback);

                function parsePorts(ports) {
                    var portBindings = {};
                    if (ports) {
                        ports.split(' ').map(function (port) {
                            if (port.indexOf(':') !== -1) {
                                port = port.split(':');
                                var hostIp = '';
                                var hostPort = '';
                                var containerPort = '';
                                if (port.length === 2) {
                                    hostPort = port[0];
                                    containerPort = port[1];
                                } else if (port.length === 3) {
                                    hostIp = port[0];
                                    hostPort = port[1];
                                    containerPort = port[2];
                                }
                                var exposedPort = containerPort + '/tcp';
                                $scope.container.ExposedPorts[exposedPort] = {};
                                if (!Array.isArray(portBindings[exposedPort])) {
                                    portBindings[exposedPort] = [];
                                }
                                portBindings[exposedPort].push({"HostPort": hostPort, "HostIp": hostIp});
                            } else {
                                $scope.container.ExposedPorts[port + '/tcp'] = {};
                            }
                        });
                    }
                    return portBindings;
                }

                function parseCommands(commands) {
                    return commands.match(/(?:[^\s"]+|"[^"]*")+/g).map(function (string) {
                        var firstChar = string.substr(0, 1),
                            lastChar = string.substr(-1);

                        if ((firstChar === '"' && lastChar === '"') ||
                            (firstChar === "'" && lastChar === "'")) {
                            string = string.slice(1, -1);
                        }

                        return string;
                    });
                }

                var createContainer = function () {
                    var containerPorts = parsePorts($scope.ports);

                    $scope.container.Memory = $scope.memory * 1024 * 1024;
                    $scope.container.MemorySwap = $scope.memorySwap * 1024 * 1024;

                    Docker.createContainer({host: {primaryIp: $scope.ip}, container: $scope.container}).then(function (response) {
                        var container = {
                            primaryIp: $scope.ip,
                            options: {
                                id: response.Id,
                                "Binds": $scope.binds || [],
                                "Dns": $scope.dns ? $scope.dns.split(' ') : null,
                                "VolumesFrom": $scope.volumesFrom ? $scope.volumesFrom.split(' ') : [],
                                "PortBindings": containerPorts,
                                "NetworkMode": $scope.networkMode
                            }
                        };
                        Docker.startContainer(container).then(function () {
                            $location.path('/docker/containers');
                        }, errorCallback);
                    }, errorCallback);
                };

                var createImage = function () {
                    if ($scope.exposedPorts) {
                        $scope.exposedPorts.split(' ').forEach(function (port) {
                            $scope.container.ExposedPorts[port + '/tcp'] = {};
                        });
                    }

                    Docker.createImage($scope.container).then(function () {
                        $location.path('/docker/images');
                    }, errorCallback);
                };

                $scope.create = function () {
                    if ($scope.commands) {
                        $scope.container.Cmd = parseCommands($scope.commands);
                    }
                    if ($scope.entrypoint) {
                        $scope.container.Entrypoint = parseCommands($scope.entrypoint);
                    }
                    if ($scope.environment) {
                        $scope.container.Env = $scope.environment.split(' ');
                    }

                    if ($scope.volumes) {
                        $scope.binds = $scope.volumes.split(' ');
                        var volumes = {};
                        $scope.binds.forEach(function (volume) {
                            var parsed = volume.split(':'); // containerPath || hostPath:containerPath || hostPath:containerPath:permission
                            volumes[parsed[1] || parsed[0]] = {};
                        });
                        $scope.container.Volumes = volumes;
                    }
                    $scope.creating = true;
                    if ($scope.type === 'Images') {
                        createImage();
                    } else {
                        createContainer();
                    }
                };

                $scope.cancel = function () {
                    $location.path('/docker/' + $scope.type.toLowerCase());
                };
            }
        ]);
}(window.angular, window.JP.getModule('docker')));