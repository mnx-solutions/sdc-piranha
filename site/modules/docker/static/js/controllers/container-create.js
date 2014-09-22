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
                requestContext.setUpRenderContext('docker.container-create', $scope, {
                    title: localization.translate(null, 'docker', 'Create Docker Container')
                });
                $scope.loading = true;

                var errorCallback = function (err) {
                    $scope.loading = false;
                    $scope.creating = false;
                    PopupDialog.errorObj(err);
                };

                $scope.hostImages = function (host) {
                    if (host) {
                        $scope.images = [];
                        Docker.listImages(host).then(function (images) {
                            images.map(function (image) {
                                image.RepoTags.map(function (tag) {
                                    var repoTag = tag.split(':')[0];
                                    if (repoTag !== '<none>' && $scope.images.indexOf(tag) === -1) {
                                        $scope.images.push(tag);
                                    }
                                });
                            });
                            $scope.container.Image = $scope.images[0];
                            setTimeout(function () {
                                window.jQuery('#imageSelect').select2('val', $scope.container.Image);
                            });
                        });
                    }
                };

                Docker.listHosts().then(function (hosts) {
                    $scope.hosts = hosts;
                    $scope.loading = false;
                    $scope.hostImages(hosts[0]);
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
                        "Tag": "latest",
                        "WorkingDir": "",
                        "NetworkDisabled": false,
                        "name": ""
                    };
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

                $scope.createContainer = function () {
                    $scope.container.Cmd = $scope.commands.split(' ');
                    if ($scope.entrypoint) {
                        $scope.container.Entrypoint = $scope.entrypoint.split(' ');
                    }
                    $scope.creating = true;
                    var containerPorts = parsePorts($scope.ports);

                    Docker.createContainer({host: {primaryIp: $scope.ip}, container: $scope.container}).then(function (response) {
                        var containerId = response.Id.slice(0, 12);
                        Docker.inspectContainer({primaryIp: $scope.ip, Id: containerId}).then(function (resp) {
                            var portBindings = ng.copy(resp.Config.ExposedPorts);
                            var host;
                            for (host in portBindings) {
                                if (portBindings.hasOwnProperty(host)) {
                                    portBindings[host] = containerPorts[host] || {"HostPort": "", "HostIp": ""};
                                }
                            }
                            var volumes = resp.Config.Volumes;
                            var binds = [];
                            if (volumes && typeof volumes === 'object') {
                                var volume;
                                for (volume in volumes) {
                                    if (volumes.hasOwnProperty(volume)) {
                                        binds.push(volume + ":" + volume + ":rw");
                                    }
                                }
                            }
                            var container = {
                                primaryIp: $scope.ip,
                                options: {
                                    id: containerId,
                                    "Binds": binds,
                                    "Dns": $scope.dns ? $scope.dns.split(' ') : null,
                                    "PortBindings": portBindings
                                }
                            };
                            Docker.startContainer(container).then(function () {
                                $location.path('/docker/containers');
                            }, errorCallback);
                        }, errorCallback);
                    }, errorCallback);
                };

                $scope.cancel = function () {
                    $location.path('/docker/containers');
                };
            }
        ]);
}(window.angular, window.JP.getModule('docker')));