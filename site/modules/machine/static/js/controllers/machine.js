'use strict';

(function (app, ng) {
    app.controller('Machine.DetailsController',[
        '$scope',
        'requestContext',
        'Dataset',
        'Machine',
        'Package',
        'Network',
        'rule',
        'firewall',
        '$filter',
        '$$track',
        'localization',
        '$q',
        '$location',
        'PopupDialog',
        'Image',
        'FreeTier',
        '$timeout',
        'Account',

        function ($scope, requestContext, Dataset, Machine, Package, Network, rule, firewall, $filter, $$track,
                  localization, $q, $location, PopupDialog, Image, FreeTier, $timeout, Account) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.details', $scope, {
                title: localization.translate(null, 'machine', 'View Joyent Instance Details')
            });

            var machineid = requestContext.getParam('machineid');

            Account.getAccount(true).then(function (account) {
                $scope.account = account;
            });

            $scope.machineid = machineid;
            $scope.machine = Machine.machine(machineid);
            $scope.packages = Package.package();
            $scope.loading = true;
            $scope.changingName = false;
            $scope.loadingNewName = false;
            $scope.newInstanceName = null;
            $scope.networks = [];
            $scope.defaultSshUser = 'root';
            $scope.incorrectNameMessage = "name can contain only letters, digits and signs like '.' and '-'.";

            if ($scope.features.freetier === 'enabled') {
                $scope.freetier = FreeTier.freetier();
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
                function (){
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
                function (){
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

            $scope.$watch('machines', function (machines) {
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
                $scope.package = Package.package(m.package);

                $scope.dataset.then(function(ds){
                    $scope.imageCreateNotSupported = ds.imageCreateNotSupported || m.imageCreateNotSupported;

                    if(ds.tags && ds.tags.default_user) {
                        $scope.defaultSshUser = ds.tags.default_user;
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
                });

                $scope.package.then(function (pkg) {
                    $scope.currentPackageName = pkg.name;
                    $scope.currentPackage = pkg;
                    if (!$scope.selectedPackageName) {
                       $scope.selectedPackageName = [$scope.getSelectedPackageName()];
                    }
                });
            });

            $scope.$watch('machine.networks', function (networks) {
                if (networks) {
                    $scope.networks = networks.map(function (networkId) {
                        return Network.getNetwork($scope.machine.datacenter, networkId);
                    });
                }
            });

            $scope.$watch('selectedPackageName', function (pkgName) {
                if(pkgName) {
                    pkgName = ng.isArray(pkgName) ? pkgName[0] : pkgName;
                    Package.package(pkgName).then(function (pkg) {
                        $scope.selectedPackageName = pkg.name;
                        $scope.selectedPackage = pkg;
                    });
                }
            });

            var machineMessages = {
                resizeMessage: 'Resize this instance?',
                stopMessage: 'Stopping this instance does not stop billing, your instance can be started after it is stopped.',
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
                        var job = Machine.startMachine(machineid);
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
                        var job  = Machine.rebootMachine(machineid);
                    });
            };

            $scope.clickResize = function () {
                var selected = $scope.selectedPackage;
                if(!selected) {
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
                                $scope.currentPackageName = selected.name;
                                $scope.currentPackage = selected;
                                $scope.machine.freetier = false;
                                $scope.selectedPackageName = $scope.getSelectedPackageName();
                            }
                        });
                    });
            };

            $scope.clickCreateImage = function () {
                function createImage() {
                    $scope.imageName = $scope.imageName || (Math.random() + 1).toString(36).substr(2, 7);
                    $scope.imageJob = Image.createImage($scope.machineid, $scope.machine.datacenter, $scope.imageName, $scope.imageDescription);
                    $scope.imageJob.done(function () {
                        $scope.imageName = $scope.imageDescription = '';
                        $scope.imageForm.$pristine = true;
                        $scope.imageForm.$dirty = false;
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

            $scope.renameClass = function() {
                if($scope.features.instanceRename === 'enabled') {
                    return 'machine-name-rename';
                } else {
                    return '';
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
            
            $scope.enableRename = function(name) {
                if($scope.features.instanceRename === 'enabled') {
                    $scope.changingName = true;
                    $scope.newInstanceName = name;
                    $timeout(function () {
                        angular.element('#instanceRename').focus();
                    });
                }
            };

            $scope.cancelRename = function() {
                $scope.changingName = false;
            };

            $scope.clickRename = function() {
                if ($scope.machine.name === $scope.newInstanceName) {
                    return;
                }
                var currentMachineName = $scope.machine.name;
                $scope.machine.name = $scope.newInstanceName;
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Rename instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Rename this instance'
                    ), function () {
                        $scope.loadingNewName = true;
                        $scope.changingName = false;
                        $$track.event('machine', 'rename');
		                $scope.renaming = true;
                        var job = Machine.renameMachine($scope.machineid, $scope.newInstanceName);

                        job.getJob().done(function() {
                            $scope.changingName = false;
	                        $scope.renaming = false;
                            $scope.loadingNewName = false;
                        })
                    }, function () {
                        $scope.machine.name = currentMachineName;
                    }
                );
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
                        Machine.deleteMachine(machineid).getJob().done(function () {
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
                                function () {}
                            );
                            if($location.url() === '/compute/instance/'+ machineid) {
                                $location.url('/compute');
                                $location.replace();
                            }
                            if(!$scope.machines.length) {
                                $location.path('/compute/create')
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
                    var result = 'You can start your instance after stopping it.';
                    if (!$scope.machine.freetier) {
                        result = 'Stopping an instance does not stop billing. ' + result;
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

            $scope.sortPackages = function(pkg) {
                return parseInt(pkg.memory, 10);
            };

            $scope.filterPackages = function (item) {
                if($scope.currentPackage && item.type && item.type === 'smartos' && item.memory > $scope.currentPackage.memory) {
                    //Old images don't have currentPackage.type
                    return (!$scope.currentPackage.type && item.group === 'High CPU') || (item.group === $scope.currentPackage.group);
                }
                return false;
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

            $scope.contactSupport = function () {
                var contactSupportParams = ng.copy(window.zenbox_params);
                contactSupportParams.request_subject = 'I want to resize instance ' + $scope.machine.id;
                contactSupportParams.requester_name = $scope.account.firstName;
                contactSupportParams.requester_email = $scope.account.email;
                Zenbox.show(null, contactSupportParams);
            }

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
                    return $scope.machine.type !== 'virtualmachine' && $scope.machine.hasOwnProperty('firewall_enabled');
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
