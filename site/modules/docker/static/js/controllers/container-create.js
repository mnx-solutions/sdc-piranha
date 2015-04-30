'use strict';

(function (ng, app) {
    app.controller(
        'Docker.ContainerCreateController', [
            '$scope',
            '$rootScope',
            'requestContext',
            'localization',
            'Docker',
            '$q',
            'PopupDialog',
            '$location',
            function ($scope, $rootScope, requestContext, localization, Docker, $q, PopupDialog, $location) {
                localization.bind('docker', $scope);
                requestContext.setUpRenderContext('docker.create', $scope, {
                    title: localization.translate(null, 'docker', 'Create Docker Container')
                });
                $scope.loading = true;

                var sourceId = requestContext.getParam('sourceid');
                var hostId = requestContext.getParam('hostid');
                var images = {};
                var containers = {};
                var hostsStats = {};
                var notations = {
                    name: 'Enter Container Name (optional)',
                    image: 'Image to use for the container.',
                    memory: 'Memory limit in MB',
                    memorySwap: 'Total memory usage (memory + swap)',
                    host: 'Choose datacenter & host where you create container',
                    volumesFrom: 'A list of volumes to inherit from another container.',
                    entrypoint: 'Overwrite the default ENTRYPOINT of the image. Use space as delimiter.',
                    cmd: 'Command to run specified',
                    PublishAllPorts: 'Allocates a random host port for all of a container\'s exposed ports.',
                    sdcPublishAllPorts: 'Allocates a random host port for all of a container\'s exposed ports.<br /> \
                            PublishAllPorts is the way the SDC-Docker knows to assign a public IP address to the container, without that you can not get to the container from the internet.',
                    Privileged: 'Gives the container full access to the host.',
                    NetworkDisabled: 'Boolean value, when true disables neworking for the container',
                    env: 'A list of environment variables in the form of <strong>VAR=value</strong> or <strong>VAR="value"</strong><br />Press <strong>Enter</strong> button for adding value.',
                    exposedPorts: 'Ports accessible from the host by default',
                    ports: 'Publish a container\'s port to the host. Format: <strong>ip:hostPort:containerPort</strong> | <strong> ip::containerPort</strong> | <strong>hostPort:containerPort</strong> |  <strong>containerPort</strong> \
                            <br />Press <strong>Enter</strong> button for adding value.',
                    volumesImage: 'A mount point with the specified name and marks it as holding externally mounted volumes from native host or other containers',
                    volumes: 'Mountpoint paths (strings) inside the container<br /> \
                            <strong>container_path</strong> to create a new volume for the container,<br /> \
                            <strong>host_path:container_path</strong> to bind-mount a host path into the container,<br /> \
                            <strong>host_path:container_path:&#60ro|rw&#62</strong> to make the bind-mount &#60read-only|read-write&#62 inside the container.',
                    restartPolicy: 'The behavior to apply when the container exits. The value is an object with a Name property of either \
                            <strong>"always"</strong> to always restart or <strong>"on-failure"</strong> to restart only when the container exit code is non-zero. \
                            If <strong>on-failure</strong> is used, <strong>MaximumRetryCount</strong> controls the number of times to retry before giving up. The default is not to restart. \
                            (optional) An ever increasing delay (double the previous delay, starting at 100mS) is added before each restart to prevent flooding the server.',
                    network: 'Set the Network mode for the container<br /> \
                            <strong>bridge</strong>: creates a new network stack for the container on the docker bridge<br />\
                            <strong>none</strong>: no networking for this container<br /> \
                            <strong>container:&#60name|id&#62</strong>: reuses another container network stack<br /> \
                            <strong>host</strong>: use the host network stack inside the container. Note: the host mode gives the container full access to local system services such as D-bus and is therefore considered insecure.',
                    tag: 'Tag an image into a repository.',
                    repository: 'Enter Repository',
                    message: 'Commit message',
                    author: 'Author'
                };

                var isArrayNotEmpty = function (data) {
                    return data && Array.isArray(data) && data.length;
                };

                var getJoinedStr = function (data) {
                    return isArrayNotEmpty(data) ? data.join(' ') : '';
                };

                function addQuotes(str) {
                    if (str.indexOf(' ') !== -1) {
                        str = '"' + str + '"';
                    }
                    return str;
                }

                function removeQuotes(str) {
                    var firstChar = str.substr(0, 1),
                        lastChar = str.substr(-1);

                    if ((firstChar === '"' && lastChar === '"') ||
                        (firstChar === '\'' && lastChar === '\'')) {
                        str = str.slice(1, -1);
                    }
                    return str;
                }

                function parsePorts(ports) {
                    var portBindings = {};
                    if (isArrayNotEmpty(ports)) {
                        ports.forEach(function (port) {
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
                                portBindings[exposedPort].push({HostPort: hostPort, HostIp: hostIp});
                            } else {
                                $scope.container.ExposedPorts[port + '/tcp'] = {};
                            }
                        });
                    }
                    return portBindings;
                }

                function unParsePorts(portBindings) {
                    var ports = [];
                    for (var port in portBindings) {
                        portBindings[port].forEach(function (bind) {
                            var ip = bind.HostIp ? bind.HostIp + ':' : '';
                            var hostPort = bind.HostPort ? bind.HostPort + ':' : ip ? ':' : '';
                            ports.push(ip + hostPort + port.substring(0, port.indexOf('/')));
                        });

                    }
                    return ports;
                }

                function unParseVolumes(volumes, binds) {
                    var output = [];
                    var i = 0;
                    for (var path in volumes) {
                        if (binds[i] && binds[i].indexOf(path) !== -1) {
                            output.push(binds[i]);
                            i++;
                        } else {
                            output.push(path);
                        }
                    }
                    return output;
                }

                function unParseLxcConf(configs) {
                    var output = '';
                    configs.forEach(function (config) {
                        output = output ? output + '\n' : '';
                        output += config.Key + '=' + config.Value;
                    });
                    return output;
                }

                function unParseCommands(commands) {
                    var output = '';
                    commands.forEach(function (command) {
                        output = output ? output + ' ' : '';
                        output += addQuotes(command);
                    });
                    return output;
                }

                function parseCommands(commands) {
                    var output = null;
                    if (isArrayNotEmpty(commands)) {
                        output = commands.match(/(?:[^\s"']+|"([^"]*)"|'([^']*)')+/g).map(function (string) {
                            return removeQuotes(string);
                        });
                    }
                    return output;
                }

                function parseEnvironments(environments) {
                    var output = null;
                    if (isArrayNotEmpty(environments)) {
                        output = [];
                        environments.forEach(function (string) {
                            if (string.length > 3 && string.indexOf('=') > 0) {
                                var envValue = string.split('=');
                                string = envValue[0] + '=';
                                if (envValue[1]) {
                                    string += removeQuotes(envValue[1]);
                                }
                                output.push(string);
                            }
                        });
                    }
                    return output;
                }

                function parseContainerLinks(links) {
                    var output = [];
                    if (isArrayNotEmpty(links)) {
                        links.match(/(?:[^\s"]+|"[^"]*")+/g).forEach(function (string) {
                            if (string && string.indexOf(':') === -1) {
                                string += ':' + string;
                            }
                            output.push(string);
                        });
                    }
                    return output;
                }

                function parseLxcConf(lxcConf) {
                    var lxcOptions = [];
                    if (isArrayNotEmpty(lxcConf)) {
                        lxcConf.split('\n').forEach(function (line) {
                            if (line && line.indexOf('=') !== -1) {
                                var lxcConfParams = line.split('=');
                                var lxcKey = lxcConfParams[0];
                                var lxcValue = lxcConfParams[1];
                                var lxcOption = {Key: lxcKey.trim(), Value: lxcValue.trim()};
                                lxcOptions.push(lxcOption);
                            }
                        });
                    }
                    return lxcOptions;
                }

                function parseVolumes(containerVolumes) {
                    var binds = [];
                    var volumes = null;
                    if (isArrayNotEmpty(containerVolumes)) {
                        volumes = {};
                        containerVolumes.forEach(function (volume) {
                            var parsed = volume.split(':'); // containerPath || hostPath:containerPath || hostPath:containerPath:permission
                            volumes[parsed[1] || parsed[0]] = {};
                            if (parsed[1]) {
                                binds.push(volume);
                            }
                        });
                    }
                    $scope.container.HostConfig.Binds = binds;
                    return volumes;
                }

                $scope.setNotation = function (name) {
                    $scope.notation = notations[name] || '';
                    if ($scope.isSdc && notations['sdc' + name]) {
                        $scope.notation = notations['sdc' + name];
                    }
                    if ($scope.createImage && notations[name + 'Image']) {
                        $scope.notation = notations[name + 'Image'];
                    }
                };

                $scope.preSelectedData = $rootScope.popCommonConfig('cloneDockerParams');

                $scope.title = 'Start Docker Container';
                $scope.createImage = false;
                $scope.type = $location.path().search('image/create') === -1 ? 'Containers' : 'Images';
                if ($scope.type === 'Images') {
                    $scope.createImage = true;
                    $scope.title = 'Create Image From Container';
                }
                $scope.attaches = ['Stdin', 'Stdout', 'Stderr'];
                $scope.restartOptions = ['no', 'on-failure', 'always'];
                $scope.networkTypes = ['none', 'bridge', 'host'];
                $scope.container = {
                    Hostname: '',
                    Domainname: '',
                    User: '',
                    Memory: 0,
                    MemorySwap: 0,
                    CpuShares: 0,
                    Cpuset: '',
                    AttachStdin: false,
                    AttachStdout: false,
                    AttachStderr: false,
                    PortSpecs: [],
                    Tty: true,
                    OpenStdin: true,
                    StdinOnce: false,
                    Env: null,
                    Cmd: [],
                    ExposedPorts: {},
                    WorkingDir: '',
                    NetworkDisabled: false,
                    Volumes: null,
                    name: '',
                    HostConfig: {
                        Binds: [],
                        Dns: [],
                        DnsSearch: [],
                        VolumesFrom: [],
                        PortBindings: {},
                        NetworkMode: 'bridge',
                        Links: [],
                        LxcConf: [],
                        CapAdd: [],
                        CapDrop:  [],
                        RestartPolicy:  {'Name': 'no'},
                        PublishAllPorts: false,
                        Privileged: false
                    }
                };
                $scope.input = {
                    Memory: 0,
                    MemorySwap: 0,
                    Env: [],
                    NetworkMode: 'bridge'
                };

                if ($scope.preSelectedData) {
                    var createData = $scope.preSelectedData.create;
                    var startData = $scope.preSelectedData.start;
                    $scope.container = ng.extend($scope.container, createData);

                    $scope.input.Cmd = isArrayNotEmpty(createData.Cmd) ? unParseCommands(createData.Cmd) : '';
                    $scope.input.Entrypoint = isArrayNotEmpty(createData.Entrypoint) ? unParseCommands(createData.Entrypoint) : '';
                    $scope.input.Memory = Math.floor(createData.Memory / 1024 / 1024);
                    $scope.input.MemorySwap = Math.floor(createData.MemorySwap / 1024 / 1024);
                    $scope.input.Env = createData.Env || [];
                    $scope.input.Volumes = unParseVolumes(createData.Volumes, startData.Binds);
                    $scope.input.PortBindings = unParsePorts(startData.PortBindings);
                    $scope.input.LxcConf = isArrayNotEmpty(startData.LxcConf) ? unParseLxcConf(startData.LxcConf) : '';
                    var restartPolicy = startData.RestartPolicy;
                    if (restartPolicy && $scope.restartOptions.indexOf(restartPolicy.Name) !== -1) {
                        $scope.container.HostConfig.RestartPolicy = restartPolicy;
                    }
                    if (startData.NetworkMode) {
                        $scope.input.NetworkMode = startData.NetworkMode;
                        if (startData.NetworkMode.indexOf('container') !== -1) {
                            $scope.input.networkContainer = $scope.container.HostConfig.NetworkMode.slice(10);
                            $scope.input.NetworkMode = 'container';
                        }
                    }
                }

                function setImageData (image) {
                    if (image && typeof (image) === 'object') {
                        var tag = Array.isArray(image.RepoTags) && image.RepoTags[0];
                        image.ShortId = image.Id.slice(0, 12);
                        image.name = !tag || tag === '<none>:<none>' ? image.ShortId : tag;
                    }
                    return image;
                }
                var errorCallback = function (err) {
                    $scope.loading = false;
                    $scope.loadingHostDetails = false;
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
                                return setImageData(image);
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
                        }, errorCallback);
                    }
                };

                var imageHosts = function (imageId) {
                    $scope.loadingHostDetails = true;
                    $scope.images = [];
                    $scope.container.container = 'base';
                    Docker.listAllImages({all: true, cache: true}).then(function (images) {
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
                        setImageData($scope.image);
                        $scope.images = [$scope.image];
                        $scope.container.Image = $scope.image.name;
                        setTimeout(function () {
                            window.jQuery('#imageSelect').select2('val', $scope.container.Image);
                            window.jQuery('#imageSelect').select2('disable');
                        });
                        $scope.loadingHostDetails = false;
                    }, errorCallback);
                };

                var hostContainers = function (host) {
                    if (host && host.primaryIp) {
                        $scope.loadingHostDetails = true;
                        $scope.container.Image = 'base';
                        $scope.containers = [];
                        Docker.listContainers({host: host, options: {all: true}}).then(function (containers) {
                            $scope.containers = containers.map(function (container) {
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
                        }, errorCallback);
                    }
                };

                var setImage = function (name) {
                    $scope.loadingHostDetails = true;
                    $scope.images = [];
                    $scope.container.container = 'base';
                    Docker.listAllImages({cache: true}).then(function (images) {
                        $scope.images = images || [];
                        $scope.images.forEach(function (image) {
                            if (image.Id || !image.suppressErrors) {
                                setImageData(image);
                                if (!$scope.image && image.RepoTags.indexOf(name) !== -1) {
                                    image.name = name;
                                    $scope.container.Image = name;
                                    $scope.image = image;
                                }
                            }
                        });
                        setTimeout(function () {
                            window.jQuery('#imageSelect').select2('val', $scope.container.Image);
                        });
                        $scope.loadingHostDetails = false;
                    }, errorCallback);
                };

                function updateNetworkTypes () {
                    var containersCount = $scope.containers.length;
                    var indexContainerNetwork = $scope.networkTypes.indexOf('container');
                    if (containersCount > 0 && indexContainerNetwork === -1) {
                        $scope.networkTypes.push('container');
                    } else if (containersCount === 0 && indexContainerNetwork !== -1) {
                        $scope.networkTypes.pop();
                    }
                    $scope.input.NetworkMode = $scope.input.NetworkMode === 'container' ? 'bridge' : $scope.input.NetworkMode;
                }

                var getHostStats = function (host) {
                    $scope.containers = null;
                    if (containers[host.id]) {
                        $scope.containers = containers[host.id];
                        updateNetworkTypes();
                    } else {
                        Docker.listContainers({host: host, options: {all: true}}).then(function (containers) {
                            containers[host.id] = containers.map(function (container) {
                                container.ShortId = container.Id.slice(0, 12);
                                return container;
                            });
                            $scope.containers = containers[host.id];
                            updateNetworkTypes();
                        });
                    }

                    if (hostsStats[host.id]) {
                        host = ng.extend(host, hostsStats[host.id]);
                    } else {
                        Docker.hostUsage({host: host, wait: true, suppressErrors: true}).then(function (usage) {
                            usage = Array.isArray(usage) ? usage.slice(-1)[0] : usage;
                            hostsStats[host.id] = {
                                cadvisorUnavailable: false,
                                cpuLoad: usage.cpu + '%',
                                memoryLoad: usage.memory + '%',
                                stats: true
                            };
                            host = ng.extend(host, hostsStats[host.id]);
                        }, function (error) {
                            hostsStats[host.id] = {
                                cadvisorUnavailable: true
                            };
                            host.cadvisorUnavailable = true;
                        });
                    }
                };

                $scope.changeHost = function (host) {
                    host = host || Docker.getHost($scope.hosts, $scope.ip);
                    $scope.isSdc = host.isSdc;
                    $scope.host = host;
                    $scope.container.HostConfig.VolumesFrom = [];

                    if ($scope.preSelectedData) {
                        getHostStats($scope.host);
                        return;
                    }
                    if ($scope.type === 'Images') {
                        hostContainers(host);
                    } else {
                        getHostStats($scope.host);
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
                // TODO: make function
                $scope.portPattern = '(6553[0-5]|655[0-2]\\d|65[0-4]\\d{2}|6[0-4]\\d{3}|[1-5]\\d{4}|[1-9]\\d{0,3})';
                $scope.exposedPattern = '(((\\d{1,3}\.){3}\\d{1,3}\\:)?' + $scope.portPattern + '?\\:)?' + $scope.portPattern;

                Docker.completedHosts().then(function (hosts) {
                    $scope.hosts = hosts || [];
                    $scope.loading = false;
                    if ($scope.preSelectedData) {
                        setImage($scope.preSelectedData.create.Image);
                    }
                    if (hostId) {
                        $scope.hosts.forEach(function (host) {
                            if (hostId === host.id) {
                                $scope.ip = host.primaryIp;
                                $scope.isSdc = host.isSdc;
                                $scope.changeHost(host);
                            }
                        });
                    } else {
                        $scope.changeHost(hosts[0]);
                    }
                }, errorCallback);

                var setMemory = function () {
                    if ($scope.host.isSdc && $scope.package) {
                        $scope.container.Memory = $scope.package.memory * 1024 * 1024;
                        $scope.container.MemorySwap = $scope.package.swap * 1024 * 1024;
                    } else {
                        var memorySwap = $scope.input.MemorySwap;
                        $scope.container.Memory = $scope.input.Memory * 1024 * 1024;
                        $scope.container.MemorySwap = memorySwap > 0 ?  $scope.container.Memory + memorySwap * 1024 * 1024 : memorySwap;
                    }
                };

                var createContainer = function () {
                    var containerNamePattern = /^[\.\_\-]/;
                    if (containerNamePattern.test($scope.container.name)) {
                        return errorCallback('Container name can not start with \'.\' or \'-\' or \'_\'');
                    }
                    if ($scope.container.name.length === 1) {
                        return errorCallback('Container name should be more than one character.');
                    }

                    $scope.container.HostConfig.PortBindings = parsePorts($scope.input.PortBindings);
                    $scope.container.HostConfig.Links = parseContainerLinks($scope.input.Links);
                    $scope.container.HostConfig.LxcConf = parseLxcConf($scope.input.LxcConf);

                    setMemory();
                    var volumesFrom = $scope.container.HostConfig.VolumesFrom;
                    $scope.container.HostConfig.VolumesFrom = isArrayNotEmpty(volumesFrom) ? volumesFrom : null;
                    Docker.run($scope.host, {create: $scope.container, start: $scope.container.HostConfig}).then(function () {
                        $location.path('/docker/containers');
                    }, function (err) {
                        if (typeof (err) === 'string') {
                            if (err.indexOf('cpuset.cpus: invalid') !== -1) {
                                err = 'Cannot start container. Invalid argument: Cpuset.';
                            } else if (err.indexOf('cpuset.cpus: numerical result') !== -1) {
                                err = 'Cannot start container. CPUset value is out of numerical range.';
                            }else if (err === 'Docker host "' + $scope.ip + ':4243" is unreachable.' && lxcConf.length) {
                                err = 'Unable to start created container as invalid LxcConf parameters provided.';
                            }
                        }
                        errorCallback(err);
                    });
                };

                var createImage = function () {
                    if ($scope.host.isSdc) {
                        errorCallback('Creating image from container is not presently supported in SDC-Docker.');
                        return;
                    }
                    if ($scope.input.exposedPorts.length) {
                        $scope.input.exposedPorts.forEach(function (port) {
                            $scope.container.ExposedPorts[port + '/tcp'] = {};
                        });
                    }
                    $scope.container.hostId = $scope.host.id;
                    Docker.createImage($scope.container).then(function () {
                        $location.path('/docker/images');
                    }, errorCallback);
                };

                $scope.create = function () {
                    $scope.container.Cmd = Docker.parseCmd($scope.input.Cmd);
                    $scope.container.Entrypoint = Docker.parseCmd($scope.input.Entrypoint);
                    $scope.container.Env = parseEnvironments($scope.input.Env);
                    $scope.container.Volumes = parseVolumes($scope.input.Volumes);
                    $scope.container.HostConfig.NetworkMode = $scope.input.NetworkMode;
                    $scope.container.HostConfig.PortBindings = parsePorts($scope.input.PortsBinding);

                    if ($scope.input.NetworkMode === 'container') {
                        if ($scope.input.networkContainer) {
                            $scope.container.HostConfig.NetworkMode = 'container:' + $scope.input.networkContainer;
                        } else {
                            $scope.container.HostConfig.NetworkMode = 'bridge';
                        }
                    }

                    $scope.creating = true;
                    if ($scope.type === 'Images') {
                        createImage();
                    } else {
                        createContainer();
                    }
                };

                $scope.cancel = function () {
                    $location.path('/docker/' + ($scope.preSelectedData ? 'audit' : $scope.type.toLowerCase()));
                };
            }
        ]);
}(window.angular, window.JP.getModule('docker')));
