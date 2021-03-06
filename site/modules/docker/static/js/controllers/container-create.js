'use strict';

(function (ng, app) {
    app.controller(
        'Docker.ContainerCreateController', [
            '$scope',
            '$rootScope',
            'requestContext',
            'localization',
            'Account',
            'Docker',
            'Provision',
            '$q',
            'PopupDialog',
            '$filter',
            '$location',
            'CloudAnalytics',
            'Package',
            'dockerPullImage',
            function ($scope, $rootScope, requestContext, localization, Account, Docker, Provision, $q, PopupDialog, $filter, $location, CloudAnalytics, Package, dockerPullImage) {
                localization.bind('docker', $scope);
                requestContext.setUpRenderContext('docker.create', $scope, {
                    title: localization.translate(null, 'docker', 'Create Docker Container')
                });
                $scope.loading = true;
                $scope.isCurrentLocation = Provision.isCurrentLocation;

                var sourceId = requestContext.getParam('sourceid');
                var hostId = requestContext.getParam('hostid');
                var accountId;
                var images = {};
                var containers = {};
                var hostsStats = {};
                var notations = {
                    NAME: 'Enter Container Name (optional)',
                    IMAGE: 'Image to use for the container.',
                    MEMORY: 'Memory limit in MB',
                    MEMORY_SWAP: 'Total memory usage (memory + swap)',
                    HOST: 'Choose data center & host where you create container',
                    VOLUMES_FROM: 'A list of volumes to inherit from another container.',
                    VOLUMES_URL: '"Host" volumes list in format <strong>http[s]://example/file:/container/file</strong>' + '' +
                        '<br />Said file will be downloaded and written to a new directory in the zone\'s dataset but ' +
                        'not in the zoneroot, and will be mounted at container\'s /container/file.',
                    ENTRYPOINT: 'Overwrite the default ENTRYPOINT of the image. Use space as delimiter.',
                    CMD: 'Command to run specified',
                    PUBLISH_ALL_PORTS: 'Allocates a random host port for all of a container\'s exposed ports.',
                    SDC_PUBLISH_ALL_PORTS: 'Allocates a random host port for all of a container\'s exposed ports.<br />' +
                        'PublishAllPorts is the way the SDC-Docker knows to assign a public IP address to the ' +
                        'container, without that you can not get to the container from the internet.',
                    ENV: 'A list of environment variables in the form of <strong>VAR=value</strong> or ' +
                        '<strong>VAR="value"</strong><br />Press <strong>Enter</strong> button for adding value.',
                    EXPOSED_PORTS: 'Ports accessible from the host by default',
                    PORTS: 'Publish a container\'s port to the host. Format: <strong>ip:hostPort:containerPort</strong>' +
                        ' | <strong> ip::containerPort</strong> | <strong>hostPort:containerPort</strong> | ' +
                        '<strong>containerPort</strong><br />Press <strong>Enter</strong> button for adding value.',
                    VOLUMES_IMAGE: 'A mount point with the specified name and marks it as holding externally mounted ' +
                        'volumes from native host or other containers',
                    VOLUMES: 'Mountpoint paths (strings) inside the container<br />' +
                        '<strong>container_path</strong> to create a new volume for the container,<br />' +
                        '<strong>host_path:container_path</strong> to bind-mount a host path into the container,<br />' +
                        '<strong>host_path:container_path:&#60ro|rw&#62</strong> to make the bind-mount ' +
                        '&#60read-only|read-write&#62 inside the container.',
                    RESTART_POLICY: 'The behavior to apply when the container exits. The value is an object with a ' +
                        'Name property of either <strong>"always"</strong> to always restart or ' +
                        '<strong>"on-failure"</strong> to restart only when the container exit code is non-zero. ' +
                        'If <strong>on-failure</strong> is used, <strong>MaximumRetryCount</strong> controls the ' +
                        'number of times to retry before giving up. The default is not to restart. (optional) ' +
                        'An ever increasing delay (double the previous delay, starting at 100mS) is added before ' +
                        'each restart to prevent flooding the server.',
                    NETWORK: 'Set the Network mode for the container<br />' +
                        '<strong>bridge</strong>: creates a new network stack for the container on the docker bridge<br />' +
                        '<strong>none</strong>: no networking for this container<br />' +
                        '<strong>container:&#60name|id&#62</strong>: reuses another container network stack<br />' +
                        '<strong>host</strong>: use the host network stack inside the container. ' +
                        'Note: the host mode gives the container full access to local system services such as ' +
                        'D-bus and is therefore considered insecure.',
                    TAG: 'Tag an image into a repository.',
                    REPOSITORY: 'Enter Repository',
                    MESSAGE: 'Commit message',
                    AUTHOR: 'Author',
                    LABELS: 'Adds a map of labels to a container. To specify a map: <strong>key:value</strong>',
                    LINKS: 'Add link to another container (name:alias)',
                    LOG_DRIVER: 'Available log driver types.',
                    LOG_OPTIONS: 'Adds a config options to log driver. To specify option: <strong>key:value</strong>'
                };
                var selectImageEl = ng.element('#imageSelect').eq(0);

                $scope.tooltips = {
                    ATTACH_STDIN: 'Boolean value, attaches to stdin.',
                    ATTACH_STDOUT: 'Boolean value, attaches to stdout.',
                    ATTACH_STDERR: 'Boolean value, attaches to stderr.',
                    PRIVILEGED: 'Gives the container full access to the host.',
                    NETWORK_DISABLED: 'Boolean value, when true disables neworking for the container'
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

                var ITEM_SEPARATOR = ':';

                var parseItems = function (items) {
                    var containerItems = {};
                    if (isArrayNotEmpty(items)) {
                        items.forEach(function (item) {
                            var itemKey = item.split(ITEM_SEPARATOR, 1)[0];
                            var itemValue = item.substr(itemKey.length + 1);
                            containerItems[itemKey] = itemValue;
                        });
                    }
                    return containerItems;
                };

                var unParseItems = function (items) {
                    var containerItems = [];
                    for (var item in items) {
                        containerItems.push(item + ITEM_SEPARATOR + items[item]);
                    }
                    return containerItems;
                };

                function unParseVolumes(volumes, binds) {
                    var output = [];
                    var i = 0;
                    for (var path in volumes) {
                        if (binds && binds[i] && binds[i].indexOf(path) !== -1) {
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
                            if (string.length > 2 && string.indexOf('=') > 0) {
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
                        links.forEach(function (string) {
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
                    var volumes = null;
                    if (isArrayNotEmpty(containerVolumes)) {
                        volumes = {};
                        containerVolumes.forEach(function (volume) {
                            var parsed = volume.split(':'); // containerPath || hostPath:containerPath || hostPath:containerPath:permission
                            volumes[parsed[1] || parsed[0]] = {};
                            if (parsed[1]) {
                                $scope.container.HostConfig.Binds.push(volume);
                            }
                        });
                    }
                    return volumes;
                }

                $scope.setNotation = function (name) {
                    $scope.notation = notations[name] || '';
                    if ($scope.createImage && notations[name + '_IMAGE']) {
                        $scope.notation = notations[name + '_IMAGE'];
                    }
                };

                $scope.hidePackageInfo = function (isSdc) {
                    var host = $scope.host;
                    return $scope.createImage || !host || host && (isSdc ? host.isSdc : !host.isSdc);
                };

                $scope.preSelectedData = $rootScope.popCommonConfig('cloneDockerParams');

                $scope.title = 'Docker Container';
                if (!$scope.isCurrentLocation('compute/container/create')) {
                    $scope.title = 'Start ' + $scope.title;
                }
                $scope.createImage = false;
                $scope.type = $location.path().search('image/create') === -1 ? 'Containers' : 'Images';
                if ($scope.type === 'Images') {
                    $scope.createImage = true;
                    $scope.title = 'Create Image From Container';
                }
                $scope.ATTACHES = ['Stdin', 'Stdout', 'Stderr'];
                $scope.RESTART_OPTIONS = ['no', 'on-failure', 'always'];
                $scope.LOG_DRIVER_NAMES = ['', 'fluentd', 'syslog', 'gelf'];
                $scope.NETWORK_TYPES = ['none', 'bridge', 'host'];
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
                    Labels: {},
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
                        LogConfig: {
                            Type: 'json-file',
                            Config: null
                        },
                        LxcConf: [],
                        Memory: 0,
                        MemorySwap: 0,
                        CapAdd: [],
                        CapDrop:  [],
                        RestartPolicy:  {'Name': 'no'},
                        PublishAllPorts: true,
                        Privileged: false
                    }
                };
                $scope.input = {
                    Memory: 0,
                    MemorySwap: 0,
                    Env: [],
                    NetworkMode: 'bridge',
                    Links: [],
                    LogConfig: [],
                    LogConfigType: ''
                };

                if ($scope.preSelectedData) {
                    var createData = $scope.preSelectedData.create;
                    var startData = $scope.preSelectedData.start;
                    $scope.container = ng.extend($scope.container, createData);

                    $scope.input.Cmd = isArrayNotEmpty(createData.Cmd) ? unParseCommands(createData.Cmd) : '';
                    $scope.input.Labels = unParseItems(createData.Labels);
                    $scope.input.Links = startData.Links;
                    $scope.input.Entrypoint = isArrayNotEmpty(createData.Entrypoint) ? unParseCommands(createData.Entrypoint) : '';
                    $scope.input.Memory = Math.floor(createData.Memory / 1024 / 1024);
                    $scope.input.MemorySwap = Math.floor(createData.MemorySwap / 1024 / 1024);
                    $scope.input.Env = createData.Env || [];
                    $scope.input.Volumes = unParseVolumes(createData.Volumes, startData.Binds);
                    $scope.input.PortBindings = unParsePorts(startData.PortBindings);
                    $scope.input.LxcConf = isArrayNotEmpty(startData.LxcConf) ? unParseLxcConf(startData.LxcConf) : '';
                    var restartPolicy = startData.RestartPolicy;
                    if (restartPolicy && $scope.RESTART_OPTIONS.indexOf(restartPolicy.Name) !== -1) {
                        $scope.container.HostConfig.RestartPolicy = restartPolicy;
                    }
                    if (startData.LogConfig) {
                        $scope.input.LogConfigType = startData.LogConfig.Type;
                        $scope.input.LogConfig = unParseItems(startData.LogConfig.Config);
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

                var selectSource = function (items, id, defaultSelectedImage) {
                    var defaultItem;
                    if (sourceId && Array.isArray(items)) {
                        defaultItem = items.filter(function (item) {
                            return item.Id === sourceId;
                        });
                    }
                    if (typeof defaultSelectedImage === 'string') {
                        defaultItem = items.find(function (item) {
                            return item.name === defaultSelectedImage;
                        });
                    }
                    defaultItem = defaultItem || items[0];
                    return id ? defaultItem[id] : defaultItem;
                };

                var loadHostImages = function (host, defaultSelectedImage) {
                    if (host && host.primaryIp) {
                        $scope.loadingHostDetails = true;
                        $scope.images = [];
                        $scope.container.container = 'base';
                        Docker.listImages(host).then(function (images) {

                            $scope.images = images.map(function (image) {
                                return setImageData(image);
                            });
                            $scope.container.Image = null;
                            if ($scope.images.length > 0) {
                                $scope.images = $filter('orderBy')($scope.images, 'name');
                                $scope.container.Image = selectSource($scope.images, 'name', defaultSelectedImage);
                            }
                            $scope.loadingHostDetails = false;
                        }, errorCallback);
                    }
                };

                $scope.customOptions = {
                    inProgress: function () {
                        return Boolean($scope.host && $scope.isPullingInProgress[$scope.host.id]);
                    },
                    click: function () {
                        dockerPullImage($scope.host, $scope.unreachableHosts, pullImageProgressHandler);
                    }
                };

                var loadImageHosts = function (imageId) {
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
                            if (image.suppressErrors) {
                                $scope.unreachableHosts = image.suppressErrors;
                            }
                        });
                        $scope.hosts = $scope.hosts.filter(function (host) {
                            return hosts.indexOf(host.id) !== -1;
                        });
                        setImageData($scope.image);
                        $scope.images = [$scope.image];
                        $scope.container.Image = $scope.image.name;

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
                                setDefaultValues($scope.containers[0]);
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
                        $scope.loadingHostDetails = false;
                    }, errorCallback);
                };

                function updateNetworkTypes () {
                    var containersCount = $scope.containers.length;
                    var indexContainerNetwork = $scope.NETWORK_TYPES.indexOf('container');
                    if (containersCount > 0 && indexContainerNetwork === -1) {
                        $scope.NETWORK_TYPES.push('container');
                    } else if (containersCount === 0 && indexContainerNetwork !== -1) {
                        $scope.NETWORK_TYPES.pop();
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
                    } else if (host.isSdc) {
                        host.analyticsUnavailable = true;
                    } else {
                        Docker.memStat({host: host, direct: true, suppressErrors: true}).then(function (data) {
                            hostsStats[host.id] = {
                                cadvisorUnavailable: false,
                                cpuLoad: data.cpuUsage + '%',
                                memoryLoad: data.memoryUsage + '%',
                                stats: true
                            };
                            host = ng.extend(host, hostsStats[host.id]);
                        }, function (err) {
                            if (err && err.indexOf('404') === 0) {
                                Docker.showUpgradeAnalyticsMessage(host.name);
                            }
                            host.stats = host.analyticsUnavailable = true;
                        });
                    }
                };

                var focusOnTag = function () {
                    setTimeout(function () {
                        ng.element('#tag').focus();
                    });
                };

                $scope.changeHost = function (host) {
                    focusOnTag();
                    $scope.ip = host && host.primaryIp || $scope.ip;
                    $scope.container.container = '';
                    host = host || Docker.getHost($scope.hosts, $scope.ip);
                    if (!host.id || !host.primaryIp) {
                        return;
                    }
                    $scope.isSdc = host.isSdc;
                    $scope.host = host;
                    $scope.container.HostConfig.VolumesFrom = [];

                    if ($scope.preSelectedData) {
                        if ($scope.preSelectedData.host !== host.id) {
                            if (!$scope.originLinks) {
                                $scope.originLinks = $scope.input.Links;
                                $scope.input.Links = [];
                            }
                        } else if ($scope.originLinks) {
                            $scope.input.Links = $scope.originLinks;
                        }
                        getHostStats($scope.host);
                        return;
                    }
                    if ($scope.type === 'Images') {
                        hostContainers(host);
                    } else {
                        getHostStats($scope.host);
                        if (sourceId) {
                            loadImageHosts(sourceId);
                        } else {
                            loadHostImages(host);
                        }
                    }
                };

                $scope.changeContainer = function () {
                    focusOnTag();
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

                var hostsPromise = Docker.completedHosts().then(function (hosts) {
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

                Account.getAccount().then(function (account) {
                    accountId = account.id;
                });

                var setMemory = function () {
                    if ($scope.host.isSdc && $scope.package) {
                        $scope.container.HostConfig.Memory = $scope.container.Memory = $scope.package.memory * 1024 * 1024;
                        $scope.container.HostConfig.MemorySwap = $scope.container.MemorySwap = $scope.package.swap * 1024 * 1024;
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
                    if (containerImageName && containerPackage) {
                        $scope.container.Image = containerImageName;
                        $scope.package = containerPackage;
                    }

                    $scope.container.HostConfig.Links = parseContainerLinks($scope.input.Links);

                    setMemory();

                    var volumesFrom = $scope.container.HostConfig.VolumesFrom;

                    $scope.container.HostConfig.VolumesFrom = isArrayNotEmpty(volumesFrom) ? volumesFrom : null;

                    var binds = $scope.container.HostConfig.Binds;

                    $scope.container.HostConfig.Binds = isArrayNotEmpty(binds) ? binds : null;

                    Docker.run($scope.host, {create: $scope.container, start: $scope.container.HostConfig}, accountId);
                    if ($scope.host.isSdc) {
                        $rootScope.$emit('clearMachinesCache');
                    }
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

                $scope.isLogConfigDisabled = function () {
                    var logConfig = $scope.container.HostConfig.LogConfig;
                    return !logConfig || logConfig.Type === 'json-file';
                };

                $scope.setLogConfigType = function () {
                    var logConfig = $scope.container.HostConfig.LogConfig;
                    if (logConfig) {
                        logConfig.Type = $scope.input.LogConfigType || 'json-file';
                    }
                };

                $scope.isButtonDisabled = function () {
                    return $scope.containerCreateForm.$invalid || $scope.creating ||
                        !$scope.container.Image && $scope.type == 'Containers' ||
                        !$scope.container.container && $scope.type == 'Images';
                };

                $scope.create = function () {
                    $scope.container.Cmd = Docker.parseCmd($scope.input.Cmd);
                    $scope.container.Labels = parseItems($scope.input.Labels);
                    $scope.container.Entrypoint = Docker.parseCmd($scope.input.Entrypoint);
                    $scope.container.Env = parseEnvironments($scope.input.Env);
                    $scope.container.Volumes = parseVolumes($scope.input.Volumes);
                    $scope.container.HostConfig.NetworkMode = $scope.input.NetworkMode;
                    $scope.container.HostConfig.PortBindings = parsePorts($scope.input.PortBinding);
                    if (!$scope.isLogConfigDisabled()) {
                        $scope.container.HostConfig.LogConfig.Config = parseItems($scope.input.LogConfig);
                    }

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

                if ($scope.isCurrentLocation('compute/container')) {
                    var containerImageName;
                    var containerPackage;
                    $rootScope.$on('createContainer', function (event, data) {
                        hostsPromise.then(function () {
                            var host = $scope.hosts.find(function (host) {
                                return host.id === data.hostId;
                            });
                            if (host) {
                                $scope.changeHost(host);
                            }
                        });
                        containerImageName = data.image;
                        containerPackage = data.pkg;
                    });
                    $rootScope.$emit('containerLaunchButton', {
                        isButtonDisabled: $scope.isButtonDisabled,
                        createContainer: $scope.create
                    });
                }

                $scope.cancel = function () {
                    $location.path('/docker/' + ($scope.preSelectedData ? 'audit' : $scope.type.toLowerCase()));
                };

                $scope.isPullingInProgress = Docker.pullForHosts;

                function pullImageProgressHandler(hostId, pullState, pulledImage) {
                    $scope.isPullingInProgress[hostId] = pullState;
                    if (!pullState && pulledImage) {
                        loadHostImages($scope.host, pulledImage.name + ':' + pulledImage.tag);
                    }
                }
            }
        ]);
}(window.angular, window.JP.getModule('docker')));
