'use strict';

(function (app, ng) {
    app.controller('Machine.DetailsController',[
        '$scope',
        '$rootScope',
        'requestContext',
        'Machine',
        'Package',
        'Network',
        'firewall',
        'Docker',
        '$filter',
        '$$track',
        'localization',
        '$q',
        '$location',
        'PopupDialog',
        'Image',
        'FreeTier',
        'Account',
        'loggingService',

        function ($scope, $rootScope, requestContext, Machine, Package, Network, firewall, Docker, $filter, $$track,
                  localization, $q, $location, PopupDialog, Image, FreeTier, Account, loggingService) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.details', $scope, {
                title: localization.translate(null, 'machine', 'View Joyent Instance Details')
            });

            var machineid = requestContext.getParam('machineid');
            var currentLocation = $location.path();
            Account.getAccount(true).then(function (account) {
                $scope.account = account;
            });

            $scope.machineid = machineid;
            $scope.machine = Machine.machine(machineid);
            $scope.packages = [];
            $scope.loading = true;
            $scope.changingName = false;
            $scope.loadingNewName = false;
            $scope.newInstanceName = null;
            $scope.networks = [];
            $scope.defaultSshUser = 'root';

            var creatingImages = $rootScope.commonConfig('creatingImages') || {};
            $scope.creatingImage = creatingImages[machineid];
            $scope.imageName = $scope.creatingImage || '';

            var locationReplace = function (path) {
                path = path || '/compute';
                $location.url(path);
                $location.replace();
            };

            var reloadPackages = function (currentPackageName, datacenter) {
                $q.all([Package.package({datacenter: datacenter}), Package.package(currentPackageName)]).then(function (results) {
                    $scope.package = results[1];
                    $scope.packages = results[0].filter(function (item) {
                        if ($scope.package && item.type && item.type === 'smartos' && item.memory > $scope.package.memory) {
                            //Old images don't have currentPackage.type
                            return (!$scope.package.type && item.group === 'High CPU') || (item.group === $scope.package.group);
                        }
                        return false;
                    }).sort(function (a, b) {
                        return parseInt(a.memory, 10) - parseInt(b.memory, 10);
                    });

                    $scope.selectedPackage = $scope.packages[0];

                    var maxPackages = {
                        automatic: null,
                        createdBySupport: null
                    };

                    $scope.packages.forEach(function (pkg) {
                        if (pkg.createdBySupport) {
                            maxPackages.createdBySupport = pkg;
                        } else {
                            maxPackages.automatic = pkg;
                        }
                    });

                    if (!$scope.package.createdBySupport && !maxPackages.automatic) {
                        $scope.package.selectedMaxAutomaticPackage = true;
                    } else if ($scope.package.createdBySupport && !maxPackages.createdBySupport) {
                        $scope.package.selectedMaxPackage = true;
                    }
                });
            };

            var getHostContainers = function (machine) {
                if (!machine.tags || machine.tags.JPC_tag !== 'DockerHost' || !machine.ips.length) {
                    return;
                }
                Docker.hostInfo({host: machine}).then(function (info) {
                    $scope.dockerHostInfo = {
                        containers: info.Containers,
                        debug: Boolean(info.Debug),
                        driver: info.Driver,
                        executionDriver: info.ExecutionDriver,
                        iPv4Forwarding: Boolean(info.IPv4Forwarding),
                        images: info.Images,
                        indexServerAddress: info.IndexServerAddress,
                        initPath: info.InitPath,
                        initSha1: info.InitSha1,
                        kernelVersion: info.KernelVersion,
                        memoryLimit: Boolean(info.MemoryLimit),
                        nEventsListener: info.NEventsListener,
                        nfd: info.NFd,
                        nGoroutines: info.NGoroutines,
                        swapLimit: Boolean(info.SwapLimit)
                    };
                }, function (err) {
                    PopupDialog.errorObj(err);
                });
                Docker.listContainers({host: machine, options: {all: true}}).then(function (containers) {
                    $scope.containers = containers.map(function (container) {
                        container.shortId = container.Id.slice(0, 12);
                        container.Names = Array.isArray(container.Names) ? container.Names.join(', ') : container.Names;
                        if (Array.isArray(container.Ports)) {
                            var ports = container.Ports.map(function (port) {
                                return port.IP + ':' + port.PublicPort;
                            });
                            container.Ports = ports.length ? ports.join(', ') : '';
                        }
                        container.hostId = machine.id;
                        container.hostName = machine.name;
                        return container;
                    });
                }, function (err) {
                    PopupDialog.errorObj(err);
                });
            };

            if ($scope.features.freetier === 'enabled') {
                $scope.freetier = FreeTier.freetier().then(function(data) {
                    $scope.freetier = data;
                }, function (err) {
                    PopupDialog.errorObj(err, function () {
                        locationReplace('/compute/create/simple');
                    });
                });
            }

            $scope.instanceMetadataEnabled = $scope.features.instanceMetadata === 'enabled';

            $scope.visiblePasswords = {};

            $rootScope.$on(
                'createdImage',
                function (event, machineId) {
                    creatingImages[machineId] = false;
                    $rootScope.commonConfig('creatingImages', creatingImages);
                    if (machineId === machineid) {
                        $scope.imageName = $scope.imageDescription = $scope.imageVersion = '';
                        $scope.imageForm.$pristine = true;
                        $scope.imageForm.$dirty = false;
                        $scope.creatingImage = false;
                    }
                }
            );

            $scope.$on(
                'event:forceUpdate',
                function () {
                    Machine.updateMachines();
                    Machine.machine(machineid).then(function (m) {
                        $scope.machine = m;
                        if ($scope.features.firewall === 'enabled') {
                            Machine.listFirewallRules(m).then(function (rules) {
                                $scope.firewallRules = rules;
                            });
                        }
                        if ($scope.features.docker === 'enabled') {
                            getHostContainers(m);
                        }
                    }, function () {
                        locationReplace();
                    });
                }
            );

            $scope.$on(
                'event:pollComplete',
                function () {
                    $q.when(Machine.machine(machineid)).then(function (machine) {
                        $scope.machine = machine;
                    }, function () {
                        locationReplace();
                    });
                }
            );

            $scope.machines = Machine.machine();

            $scope.firewallRules = [];

            $scope.$watch('machines', function () {
                $q.when(Machine.machine(machineid)).then(
                    function (machine) {
                        $scope.machine = machine;

                        if ($scope.features.firewall === 'enabled') {
                            Machine.listFirewallRules(machine).then(function (rules) {
                                $scope.firewallRules = rules;
                            });
                        }

                        if ($scope.features.docker === 'enabled') {
                            getHostContainers(machine);
                        }
                    }
                );
            }, true);

            $q.when($scope.machine, function (m) {
                $scope.machine = m;
                $scope.loading = false;
                if (!$scope.machine.image) {
                    locationReplace();
                }
                if ($scope.machine.name) {
                    $scope.newInstanceName = $scope.machine.name;
                }
                if ($scope.features.firewall === 'enabled') {
                    Machine.listFirewallRules(m).then(function (rules) {
                        $scope.firewallRules = rules;
                    });
                }
                if ($scope.features.docker === 'enabled') {
                    getHostContainers(m);
                }

                $scope.dataset = Image.image({datacenter: m.datacenter, id: m.image});
                reloadPackages(m.package, m.datacenter);

                $scope.dataset.then(function (ds) {
                    $scope.imageCreateNotSupported = ds.imageCreateNotSupported || m.imageCreateNotSupported;
                    if (ds.tags && ds.tags.default_user) {
                        $scope.defaultSshUser = ds.tags.default_user;
                    } else if (!ds.public && ds.origin) {
                        Image.image({datacenter: m.datacenter, id: ds.origin}).then(function (dataset) {
                            if (dataset.tags && dataset.tags.default_user) {
                                $scope.defaultSshUser = dataset.tags.default_user;
                            }
                        });
                    }

                    var type = ds.type;

                    switch (ds.type) {
                        case 'virtualmachine':
                            type = 'kvm';
                            break;

                        case 'smartmachine':
                            type = 'smartos';
                            break;

                        default:
                            break;
                    }

                    $scope.datasetType = type;
                }, function () {
                    $scope.dataset = {name: 'Image gone'};
                    $scope.imageCreateNotSupported = 'Instances without images are not supported by the image API.';
                });
            }, function () {
                locationReplace();
            });

            function loadMachineNetworks() {
                if (!Array.isArray($scope.machine.networks)) {
                    return;
                }
                $scope.machine.networks.forEach(function (machineNetwork) {
                    Network.getNetwork($scope.machine.datacenter, machineNetwork).then(function (network) {
                        if (!$scope.networks.some(function (network) { return network.id === machineNetwork; })) {
                            $scope.networks.push(network);
                        }
                    }, function (err) {
                        PopupDialog.errorObj(err);
                    });
                });
            }
            if ($scope.machine && $scope.machine.networks) {
                loadMachineNetworks();
            } else {
                $scope.$watch('machine.networks', loadMachineNetworks);
            }

            var machineMessages = {
                resizeMessage: 'Resize this instance?',
                stopMessage: 'Please confirm that you want to stop this instance. Once stopped, you can delete the instance in order to halt billing.',
                deleteMessage: 'Destroy the information on this instance and stop billing for this instance?'
            };

            $q.when($scope.freetier, function () {
                if ($scope.machine.freetier) {
                    machineMessages.resizeMessage = 'Resize this instance will start billing.';
                    machineMessages.stopMessage = 'Your instance can be started after it is stopped.';
                    machineMessages.deleteMessage = 'Destroy this instance?';
                }
            });

            $scope.clickStart = function () {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Start instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Start this instance?'
                    ), function () {
                        $$track.event('machine', 'start');
                        Machine.startMachine(machineid);
                    });
            };

            $scope.clickStop = function () {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Stop instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        machineMessages.stopMessage
                    ), function () {
                        Machine.stopMachine(machineid);
                        $$track.event('machine', 'stop');
                    });
            };

            $scope.clickReboot = function () {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirmation'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Restart this instance?'
                    ), function () {
                        $$track.event('machine', 'reboot');
                        Machine.rebootMachine(machineid);
                    });
            };

            $scope.clickResize = function () {
                var selected = JSON.parse($scope.selectedPackage);

                if (!selected) {
                    return;
                }
                if (selected.createdBySupport) {
                    $scope.contactSupport(selected);
                    return;
                }

                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Resize instance'
                    ),

                    localization.translate(
                        $scope,
                        null,
                        machineMessages.resizeMessage
                    ), function () {
                        $scope.isResizing = true;
                        $$track.event('machine', 'resize');
                        Machine.resizeMachine(machineid, selected).then(function () {
                            $scope.isResizing = false;
                            $scope.machine.freetier = false;
                            reloadPackages(selected.name, $scope.machine.datacenter);
                        }, function (err) {
                            $scope.isResizing = false;
                            $scope.machine.state = $scope.machine.prevState;
                            PopupDialog.errorObj(err);
                        });
                    });
            };

            $scope.clickCreateImage = function () {
                if ($scope.imageForm.$invalid) {
                    PopupDialog.message(
                        localization.translate(
                            $scope,
                            null,
                            'Message'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'Please validate your input.'
                        )
                    );
                    return;
                }
                function createImage() {
                    $scope.imageName = $scope.imageName || (Math.random() + 1).toString(36).substr(2, 7);
                    $scope.imageJob = Image.createImage($scope.machineid, $scope.machine.datacenter, $scope.imageName, $scope.imageDescription, $scope.imageVersion, function () {
                        creatingImages[$scope.machineid] = $scope.imageName;
                        $rootScope.commonConfig('creatingImages', creatingImages);
                        $location.path('/images');
                    });
                }

                if ($scope.imageCreateNotSupported || $scope.machine.state !== 'stopped') {
                    var message = $scope.imageCreateNotSupported ||
                        'This instance will be stopped as the first step in creating an image from it.';
                }
                if (!$scope.imageCreateNotSupported) {
                    if ($scope.machine.state === 'stopped') {
                        createImage();
                    } else {
                        PopupDialog.confirm(
                            localization.translate(
                                $scope,
                                null,
                                'Confirm: Create Image'
                            ),
                            localization.translate(
                                $scope,
                                null,
                                message
                            ), function () {
                                createImage();
                            }
                        );
                    }
                } else {
                    PopupDialog.message(
                        localization.translate(
                            $scope,
                            null,
                            'Message'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            message
                        ),
                        function() {}
                    );
                }
            };

            $scope.messageDialog = function () {
                PopupDialog.message(
                    localization.translate(
                        $scope,
                        null,
                        'Message'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Sorry, this is not implemented yet.'
                    ),
                    function() {}
                );
            };

            $scope.isDeleteEnabled = function (state) {
                return (state === 'stopped' || state === 'running');
            };

            $scope.clickDelete = function () {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        machineMessages.deleteMessage
                    ), function () {
                        $$track.event('machine', 'delete');

                        // Redirect if complete
                        var resolvedDeleteAction = function (machineid) {
                            PopupDialog.message(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Message'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Your instance "{{name}}" has been successfully deleted.',
                                    {
                                        name: $scope.machine.name
                                    }
                                )
                            );

                            if ($location.url() === '/compute/instance/' + machineid) {
                                locationReplace();
                            }
                            if (!$scope.machines.length && ($location.path() === '/compute' || $location.path() === currentLocation)) {
                                Machine.gotoCreatePage();
                            }
                        };
                        if ($scope.machine.tags && $scope.machine.tags.JPC_tag === 'DockerHost') {
                            Machine.deleteDockerMachine($scope.machine).then(function () {
                                resolvedDeleteAction(machineid);
                            });
                        } else {
                            Machine.deleteMachine(machineid).then(function () {
                                resolvedDeleteAction(machineid);
                            });
                        }
                    });
            };

            $scope.buttonTooltipText = {
                delete: function () {
                    var result = 'You will lose all information on this instance if you delete it.';
                    if (!$scope.machine.freetier) {
                        result = result + ' Deleting an instance also stops billing.';
                    }
                    return result;
                },
                stop: function () {
                    var result = '';
                    if (!$scope.machine.freetier) {
                        result = 'Stopping an instance does not stop billing. Once stopped, you can delete the instance in order to halt billing.';
                    }
                    return result;
                }
            };

            $scope.togglePassword = function (id) {
                if ($scope.isPasswordVisible(id)) {
                    $scope.visiblePasswords[id] = false;
                } else {
                    $scope.visiblePasswords[id] = true;
                }
            };

            $scope.isPasswordVisible = function (id) {
                return !$scope.visiblePasswords.hasOwnProperty(id) ||
                    $scope.visiblePasswords[id];
            };

            $scope.getSelectedPackageName = function () {
                var packageName = '';
                var sortPackage = '';

                ng.forEach($scope.packages.$$v, function (pkg) {
                    if ($scope.filterPackages(pkg)) {
                        if (!sortPackage || sortPackage > pkg.memory) {
                            sortPackage = pkg.memory;
                            packageName = pkg.name;
                        }
                    }
                });
                return packageName;
            };

            $scope.contactSupport = function (obj) {
                $q.when($scope.account).then(function (account) {
                    var contactSupportParams = ng.copy($scope.zenboxParams);
                    if (obj) {
                        contactSupportParams.request_description = 'API Name: ' + obj.name;
                    }
                    contactSupportParams.dropboxID = contactSupportParams.dropboxOrderPackageId || contactSupportParams.dropboxID;
                    contactSupportParams.request_subject = 'I want to resize instance ' + $scope.machine.id;
                    loggingService.log('info', 'User is ordering instance package from support', obj);
                    Zenbox.show(null, contactSupportParams);
                });
            };

            $scope.tagsArray = [];
            $scope.metadataArray = [];

            if ($scope.features.firewall === 'enabled') {
                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = Account.getUserConfig().$child('firewall-details');
                        }
                $scope.gridOrder = [];
                $scope.gridProps = [
                    {
                        id: 'parsed',
                        id2: 'from',
                        name: 'From',
                        getClass: function () {
                            return 'span4 padding-5';
                        },
                        _getter: function (object) {
                            var arr = object.parsed.from.map(function (from) {
                                return $filter('targetInfo')(from);
                            });
                            return arr.join('; ');
                        },
                        sequence: 2,
                        active: true
                    },
                    {
                        id: 'parsed',
                        id2: 'to',
                        name: 'To',
                        getClass: function () {
                            return 'span4 padding-5';
                        },
                        _getter: function (object) {
                            var arr = object.parsed.to.map(function (to) {
                                return $filter('targetInfo')(to);
                            });
                            return arr.join('; ');
                        },
                        sequence: 4,
                        active: true
                    },
                    {
                        id: 'parsed',
                        id2: 'action',
                        name: 'Action',
                        getClass: function () {
                            return 'span2 padding-5';
                        },
                        sequence: 3,
                        active: true
                    },
                    {
                        id: 'protocol',
                        name: 'Protocol',
                        getClass: function () {
                            return 'span2 padding-5';
                        },
                        _getter: function (object) {
                            return object.parsed.protocol.name + ' ' + object.parsed.protocol.targets.join('; ');
                        },
                        sequence: 1,
                        active: true
                    }
                ];

                $scope.firewallChangeable = function() {
                    return $scope.machine.firewall_supported && $scope.machine.hasOwnProperty('firewall_enabled');
                };

                $scope.toggleFirewallEnabled = function () {
                    $scope.fireWallActionRunning = true;
                    var fn = $scope.machine.firewall_enabled ? 'disable' : 'enable';
                    var expected = !$scope.machine.firewall_enabled;
                    firewall[fn]($scope.machineid, function (err) {
                        if(!err) {
                            $scope.machine.firewall_enabled = expected;
                        }
                        $scope.fireWallActionRunning = false;
                    });
                };

                $scope.exportFields = {
                    ignore: []
                };

                $scope.searchForm = false;

            }

            if ($scope.features.docker === 'enabled') {
                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfigDocker = Account.getUserConfig().$child('docker-machine-containers');
                }
                $scope.gridOrderDocker = ['-created'];
                $scope.gridPropsDocker = [
                    {
                        id: 'Id',
                        name: 'Container ID',
                        sequence: 1,
                        active: true,
                        type: 'html',
                        _getter: function (container) {
                            return '<a href="#!/docker/container/' + container.hostId + '/' + container.Id + '" style="min-width: 140px;">' + container.shortId + '</a>';
                        }
                    },
                    {
                        id: 'NamesStr',
                        name: 'Names',
                        sequence: 2,
                        active: false
                    },
                    {
                        id: 'Image',
                        name: 'Image',
                        sequence: 3,
                        active: true
                    },
                    {
                        id: 'Command',
                        name: 'Command',
                        sequence: 4,
                        active: false
                    },
                    {
                        id: 'Created',
                        name: 'Created',
                        sequence: 5,
                        active: false,
                        reverseSort: true,
                        _getter: function (container) {
                            return $filter('humanDate')(container.Created);
                        }
                    },
                    {
                        id: 'Status',
                        name: 'Status',
                        sequence: 6,
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.actionInProgress;
                        },
                        active: true
                    },
                    {
                        id: 'Ports',
                        name: 'Ports',
                        sequence: 7,
                        active: false
                    }
                ];

                $scope.exportFieldsDocker = {
                    ignore: []
                };

                $scope.searchFormDocker = false;

            }
        }

    ]);
}(window.JP.getModule('Machine'), window.angular));

