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

        function ($scope, requestContext, Dataset, Machine, Package, Network, rule, firewall, $filter, $$track,
                  localization, $q, $location, PopupDialog, Image, FreeTier, $timeout) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.details', $scope, {
                title: localization.translate(null, 'machine', 'View Joyent Instance Details')
            });

            var machineid = requestContext.getParam('machineid');

            $scope.machineid = machineid;
            $scope.machine = Machine.machine(machineid);
            $scope.freeTierOptions = $scope.features.freetier === 'yes' || $scope.features.freetier === 'enabled' ?
                FreeTier.listFreeTierOptions() : [];
            $scope.packages = Package.package();
            $scope.loading = true;
            $scope.changingName = false;
            $scope.loadingNewName = false;
            $scope.newInstanceName = null;
            $scope.networks = [];
            $scope.defaultSshUser = 'root';
            $scope.allowResize = true;


            // Handle case when machine loading fails or machine uuid is invalid
            $q.all([
                $q.when($scope.machine),
                $q.when($scope.freeTierOptions),
                $q.when($scope.packages)
            ]).then(function (results) {
                $scope.loading = false;
                $scope.newInstanceName = $scope.machine.name;
                var machine = results[0];
                var freeTierOptions = results[1];
                var packages = results[2];
                var getPackageIdByName = function (name) {
                    var result = null;
                    packages.forEach(function (machinePackage) {
                        if (machinePackage.name === name) {
                            result = machinePackage.id;
                        }
                    });
                    return result;
                };
                var machinePackageId = getPackageIdByName(machine.package);
                freeTierOptions.forEach(function (option) {
                    if (option.dataset === machine.image && option.package === machinePackageId) {
                        $scope.allowResize = false;
                    }
                });
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

                if(m.networks) {
                    m.networks.forEach(function(networkId) {
                       $scope.networks.push(Network.getNetwork(m.datacenter, networkId));
                    });
                }

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
                });
            });

            $scope.$watch('selectedPackageName', function (pkgName) {
                if(pkgName) {
                    Package.package(pkgName).then(function (pkg) {
                        $scope.selectedPackageName = pkg.name;
                        $scope.selectedPackage = pkg;
                    });
                }
            });

            $scope.accordionIcon={
                0:true
            };
            $scope.collapseTrigger = function(item){
                $scope.accordionIcon = {
                    0:false,
                    1:false,
                    2:false,
                    3:false,
                    4:false
                };
                return $scope.accordionIcon[item] = true;
            };

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
                        'Start this instance'
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
                        'Stopping an instance does not stop billing, your instance can be started after it is stopped.'
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
                        'Restart this instance'
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
                        'Resize this instance'
                    ), function () {
                        $scope.isResizing = true;
                        $$track.event('machine', 'resize');
                        $scope.retinfo = Machine.resizeMachine(machineid, selected);

                        var job = $scope.retinfo.getJob();
                        job.done(function () {
                            $scope.isResizing = false;
                            $scope.currentPackageName = selected.name;
                            $scope.currentPackage = selected;
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
                            $scope.machine.name = $scope.newInstanceName;
                            $scope.changingName = false;
	                        $scope.renaming = false;
                            $scope.loadingNewName = false;
                        });
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
                        'Destroy the information on this instance and stop billing for this instance.'
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
                            if ($location.url() === '/compute/instance/'+ machineid) {
                                $location.url('/compute');
                                $location.replace();
                            }
                            if(!$scope.machines.length) {
                                $location.path('/compute/create')
                            }
                        });
                    });
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

            $scope.tagsArray = [];
            $scope.showTagSave = false;
            // Tags
            function initTags(tags) {
                $scope.tagsArray = [];
                $scope.tagsave = false;
                Object.keys(tags).forEach(function (key) {
                    $scope.tagsArray.push({key: key, val: tags[key], conflict: false, edit: false});
                });
                $scope.showTagSave = !!$scope.tagsArray.length;
                $scope.tagSaveOk = $scope.showTagSave;
            }

            // Enable features
            // Instance tagging
            if ($scope.features.instanceTagging === 'enabled') {
                Machine.tags(machineid).then(initTags);

                $scope.$watch('tagsArray', function (newVal, oldVal){
                    var tagSaveOk = true;
                    // Search for conflicts
                    var keyMap = {};
                    newVal.forEach(function (tag, index) {
                        if (keyMap[tag.key]) {
                            tag.conflict = true;
                            keyMap[tag.key].conflict = true;
                            tagSaveOk = false;
                        } else if (!tag.key && index !== (newVal.length - 1)){
                            tag.conflict = true;
                            tagSaveOk = false;
                        } else {
                            tag.conflict = false;
                            keyMap[tag.key] = tag;
                        }
                    });
                    $scope.tagSaveOk = tagSaveOk;

                }, true);

                $scope.addTag = function() {
                    $scope.tagsArray.push({key:'', val: '', edit: true, conflict:false});
                    $scope.showTagSave = true;
                };

                $scope.editTag = function (index) {
                    $scope.tagsArray[index].edit = true;
                };

                $scope.removeTag = function (index) {
                    $scope.tagsArray.splice(index, 1);
                };

                $scope.saveTags = function () {
                    $$track.event('machine', 'saveTags');

                    var data = {};
                    $scope.tagsArray.forEach(function (tag){
                        if(tag.key && tag.val) {
                            data[tag.key] = tag.val;
                        }
                    });

                    $scope.tagsave = true;
                    Machine.tags(machineid, data).then(initTags);
                };
            }

            if ($scope.features.firewall === 'enabled') {
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
                        sequence: 1,
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
                        sequence: 2,
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
                        sequence: 4,
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

            }
        }

    ]);
}(window.JP.getModule('Machine'), window.angular));
