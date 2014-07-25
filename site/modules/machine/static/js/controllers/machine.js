'use strict';

(function (app, ng) {
    app.controller('Machine.DetailsController',[
        '$scope',
        'requestContext',
        'Dataset',
        'Machine',
        'Package',
        'Network',
        'firewall',
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

        function ($scope, requestContext, Dataset, Machine, Package, Network, firewall, $filter, $$track,
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

            if ($scope.features.freetier === 'enabled') {
                $scope.freetier = FreeTier.freetier().then(function(data) {
                    $scope.freetier = data;
                }, function (err) {
                    PopupDialog.errorObj(err, function () {
                        $location.url('/compute/create/simple');
                        $location.replace();
                    });
                });
            }

            $scope.instanceMetadataEnabled = $scope.features.instanceMetadata === 'enabled';

            // Handle case when machine loading fails or machine uuid is invalid
            $q.when($scope.machine).then(function () {
                $scope.loading = false;
                $scope.newInstanceName = $scope.machine.name;
            }, function () {
                $location.url('/compute');
                $location.replace();
            });

            $scope.visiblePasswords = {};

            $scope.$on(
                'event:forceUpdate',
                function () {
                    Machine.updateMachines();
                    Machine.machine(machineid).then(function (m) {
                        $scope.machine = m;
                        if ($scope.features.firewall === 'enabled') {
                            Machine.listFirewallRules(m.id).then(function (rules) {
                                $scope.firewallRules = rules;
                            });
                        }
                    }, function () {
                        $location.url('/compute');
                        $location.replace();
                    });
                }
            );

            $scope.$on(
                'event:pollComplete',
                function () {
                    $q.when(Machine.machine(machineid)).then(function (machine) {
                        $scope.machine = machine;
                    }, function () {
                        $location.url('/compute');
                        $location.replace();
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
                            Machine.listFirewallRules(machine.id).then(function (rules) {
                                $scope.firewallRules = rules;
                            });
                        }
                    }
                );
            }, true);

            $q.when($scope.machine, function (m) {
                if ($scope.features.firewall === 'enabled') {
                    Machine.listFirewallRules(m.id).then(function (rules) {
                        $scope.firewallRules = rules;
                    });
                }

                $scope.dataset = Dataset.dataset({datacenter: m.datacenter}).then(function () {
                    return Dataset.dataset({datacenter: m.datacenter, id: m.image});
                });

                reloadPackages(m.package, m.datacenter);

                $scope.dataset.then(function (ds) {
                    $scope.imageCreateNotSupported = ds.imageCreateNotSupported || m.imageCreateNotSupported;
                    if (ds.tags && ds.tags.default_user) {
                        $scope.defaultSshUser = ds.tags.default_user;
                    } else if (!ds.public && ds.origin) {
                        Dataset.dataset({datacenter: m.datacenter, id: ds.origin}).then(function (dataset) {
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
            });

            $scope.$watch('machine.networks', function (newNetworks,oldNetworks) {
                if (newNetworks && !angular.equals(newNetworks, oldNetworks)) {
                    $scope.networks = [];
                    newNetworks.forEach(function (networkId) {
                        Network.getNetwork($scope.machine.datacenter, networkId).then(function (network) {
                            $scope.networks.push(network);
                        }, function (err) {
                            PopupDialog.errorObj(err);
                        });
                    });
                }
            });

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
                        $scope.retinfo = Machine.resizeMachine(machineid, selected);
                        var job = $scope.retinfo.getJob();
                        job.done(function (error) {
                            $scope.isResizing = false;
                            if (!error) {
                                $scope.machine.freetier = false;
                                reloadPackages(selected.name, $scope.machine.datacenter);
                            }
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
                    $scope.imageJob = Image.createImage($scope.machineid, $scope.machine.datacenter, $scope.imageName, $scope.imageDescription, $scope.imageVersion);
                    $scope.imageJob.done(function () {
                        $scope.imageName = $scope.imageDescription = $scope.imageVersion = '';
                        $scope.imageForm.$pristine = true;
                        $scope.imageForm.$dirty = false;
                    });
                    $location.path('/images');
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
                        Machine.deleteMachine(machineid).then(function (data) {
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
                                                name: $scope.machine['name']
                                            }
                                    ),
                                    function () {
                                    }
                            );

                            if ($location.url() === '/compute/instance/' + machineid) {
                                $location.url('/compute');
                                $location.replace();
                            }
                            if (!$scope.machines.length && ($location.path() === '/compute' || $location.path() === currentLocation)) {
                                Machine.gotoCreatePage();
                            }
                        });
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
        }

    ]);
}(window.JP.getModule('Machine'), window.angular));

