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
                $scope.selectOptions = [{value: true, 'text': 'yes'}, {value: false, 'text': 'no'}];

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

                var imageHosts = function (imageId) {
                    $scope.loadingHostDetails = true;
                    $scope.images = [];
                    $scope.container.container = 'base';
                    Docker.listAllImages({cache: true}).then(function (images) {
                        $scope.image = images.find(function (image) {
                            return imageId === image.Id && $scope.ip === image.primaryIp;
                        });
                        var hosts = [];
                        images.forEach(function (image) {
                            if (hosts.indexOf(image.hostId) === -1 && image.Id === $scope.image.Id) {
                                hosts.push(image.hostId);
                            }
                        });
                        $scope.hosts = $scope.hosts.filter(function (host) {
                            return hosts.indexOf(host.id) !== -1;
                        });
                        var tag = $scope.image.RepoTags[0];
                        $scope.image.ShortId = $scope.image.Id.slice(0, 12);
                        $scope.image.name = tag === '<none>:<none>' ? $scope.image.ShortId : tag;
                        $scope.images = [$scope.image];
                        $scope.container.Image = $scope.image.name;
                        setTimeout(function () {
                            window.jQuery('#imageSelect').select2('val', $scope.container.Image);
                            window.jQuery('#imageSelect').select2('disable');
                        });
                        $scope.loadingHostDetails = false;
                    });
                };

                var hostContainers = function (host) {
                    if (host && host.primaryIp) {
                        $scope.loadingHostDetails = true;
                        $scope.container.Image = 'base';
                        $scope.containers = [];
                        Docker.listContainers({host: host, options: {all: true}}).then(function (containers) {
                            $scope.containers = containers.map(function (container) {
                                container.ShortId = container.Id.slice(0, 12);
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
                        if (sourceId) {
                            imageHosts(sourceId);
                        } else {
                            hostImages(host);
                        }
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

                function removeQuotes(str) {
                    var firstChar = str.substr(0, 1),
                        lastChar = str.substr(-1);

                    if ((firstChar === '"' && lastChar === '"') ||
                        (firstChar === "'" && lastChar === "'")) {
                        str = str.slice(1, -1);
                    }
                    return str;
                }

                function parseCommands(commands) {
                    if (!commands) {
                        return [];
                    }
                    return commands.match(/(?:[^\s"']+|"([^"]*)"|'([^']*)')+/g).map(function (string) {
                        return removeQuotes(string);
                    });
                }

                function parseEnvironments(environments) {
                    if (!environments) {
                        return [];
                    }
                    var parsedEnvironments = [];
                    environments.match(/(?:[^\s"]+|"[^"]*")+/g).forEach(function (string) {

                        if (string.length > 3 && string.indexOf("=") > 0) {
                            var envValue = string.split('=');
                            string = envValue[0] + '=';
                            if (envValue[1]) {
                                string += removeQuotes(envValue[1]);
                            }
                            parsedEnvironments.push(string);
                        }
                    });
                    return parsedEnvironments;
                }

                function parseContainerLinks(links) {
                    if (!links) {
                        return [];
                    }
                    return links.match(/(?:[^\s"]+|"[^"]*")+/g).map(function (string) {
                        if (string && string.indexOf(':') === -1) {
                            string += ':' + string;
                        }
                        return string;
                    });
                }

                function parseLxcConf(lxcConf) {
                    if (!lxcConf) {
                        return [];
                    }
                    var lxcOptions = [];
                    lxcConf.match(/(?:[^\s"]+|"[^"]*")+/g).forEach(function (string) {
                        if (string && string.indexOf('=') !== -1) {
                            var lxcConfParams = string.split('=');
                            var lxcKey = lxcConfParams[0];
                            var lxcValue = lxcConfParams[1];
                            var lxcOption = {"Key":lxcKey,"Value":lxcValue};
                            lxcOptions.push(lxcOption);
                        }
                    });
                    return lxcOptions;
                }

                var createContainer = function () {
                    var containerPorts = parsePorts($scope.ports);
                    var containerLinks = parseContainerLinks($scope.containerLinks);
                    var lxcConf = parseLxcConf($scope.lxcConf);

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
                                "NetworkMode": $scope.networkMode,
                                "ContainerIDFile": $scope.containerIDFile,
                                "Links": containerLinks,
                                "LxcConf": lxcConf,
                                "PublishAllPorts": $scope.publishAllPorts,
                                "Privileged": $scope.privileged
                            }
                        };
                        Docker.startContainer(container).then(function () {
                            $location.path('/docker/containers');
                        }, function (err) {
                            if (typeof(err) === 'string' && err.indexOf('cpuset.cpus: invalid') !== -1) {
                                err = 'Cannot start container, invalid argument: Cpuset.';
                            }
                            errorCallback(err);
                        });
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

                    $scope.container.Cmd = parseCommands($scope.commands);
                    $scope.container.Entrypoint = parseCommands($scope.entrypoint);
                    $scope.container.Env = parseEnvironments($scope.environment);

                    if ($scope.volumes) {
                        $scope.binds = [];
                        var volumes = {};
                        $scope.volumes.split(' ').forEach(function (volume) {
                            var parsed = volume.split(':'); // containerPath || hostPath:containerPath || hostPath:containerPath:permission
                            volumes[parsed[1] || parsed[0]] = {};
                            if (parsed[1]) {
                                $scope.binds.push(volume);
                            }
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