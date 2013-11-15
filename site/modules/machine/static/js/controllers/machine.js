'use strict';

(function (app, $) {
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
        '$dialog',
        '$$track',
        'localization',
        '$q',
        '$location',
        'util',
        'Image',
        'notification',

        function ($scope, requestContext, Dataset, Machine, Package, Network, rule, firewall, $filter, $dialog, $$track, localization, $q, $location, util, Image, notification) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.details', $scope, {
                title: localization.translate(null, 'machine', 'View Joyent Instance Details')
            });

            var machineid = requestContext.getParam('machineid');

            $scope.machineid = machineid;
            $scope.machine = Machine.machine(machineid);
            $scope.loading = true;
            $scope.changingName = false;
            $scope.newInstanceName = null;
            $scope.networks = [];
            $scope.defaultSshUser = 'root';


            // Handle case when machine loading fails or machine uuid is invalid
            $q.when($scope.machine).then(function () {
                    $scope.loading = false;
                    $scope.newInstanceName = $scope.machine.name;
                }, function () {
                    $location.url('/compute');
                    $location.replace();
                }
            );

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
                    });
                }
            );

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

            $scope.packages = Package.package();

            $q.when($scope.machine, function (m) {
                if ($scope.features.firewall === 'enabled') {
                    Machine.listFirewallRules(m.id).then(function (rules) {
                        $scope.firewallRules = rules;
                    });
                }

                if(m.maintenanceStartTime && !m.compute_node) {
                    notification.push('maintenance', {type: 'warning', group: 'maintenance'}, 'This instance is scheduled for maintenance on '+ m.maintenanceStartTime + '. The physical server this instance resides on will be rebooted. This instance will be unavailable approximately 15 minutes.');
                }

                $scope.dataset = Dataset.dataset(m.image);
                $scope.package = Package.package(m.package);

                if(m.networks) {
                    m.networks.forEach(function(networkId) {
                       $scope.networks.push(Network.getNetwork(m.datacenter, networkId));
                    });
                }

                $scope.dataset.then(function(ds){
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
                    $scope.selectedPackageName = pkg.name;
                    $scope.selectedPackage = pkg;
                    $scope.currentPackageName = pkg.name;
                    $scope.currentPackage = pkg;
                });
            });

            $scope.$watch('selectedPackageName', function (pkgName) {
                Package.package(pkgName).then(function (pkg) {
                    $scope.selectedPackageName = pkg.name;
                    $scope.selectedPackage = pkg;
                });
            });

            $scope.clickStart = function () {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Start instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Restart this instance'
                    ), function () {
                        $$track.event('machine', 'start');
                        var job = Machine.startMachine(machineid);
                    });
            };

            $scope.clickStop = function () {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Stop instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Stopping an instance does not stop billing, your instance can be restarted after it is stopped.'
                    ), function () {
                        Machine.stopMachine(machineid);
                        $$track.event('machine', 'stop');
                    });
            };

            $scope.clickReboot = function () {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Restart instance'
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
                util.confirm(
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
                        $scope.retinfo = Machine.resizeMachine(machineid, $scope.selectedPackage);

                        var job = $scope.retinfo.getJob();
                        job.done(function () {
                            $scope.isResizing = false;
                            $scope.currentPackageName = $scope.selectedPackageName;
                            $scope.currentPackage = $scope.selectedPackage;
                        });
                    });
            };

            $scope.clickCreateImage = function() {
                $scope.imageJob = Image.createImage($scope.machineid, $scope.imageName, $scope.imageDescription);
            };

            $scope.renameClass = function() {
                if($scope.features.instanceRename === 'enabled') {
                    return 'machine-name-rename';
                } else {
                    return '';
                }
            };

            $scope.enableRename = function(name) {
                if($scope.features.instanceRename === 'enabled') {
                    $scope.changingName = true;
                    $scope.newInstanceName = name;
                }
            };

            $scope.cancelRename = function() {
                $scope.changingName = false;
            };

            $scope.clickRename = function() {
                if ($scope.machine.name === $scope.newInstanceName) {
                    return;
                }

                util.confirm(
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
                        $$track.event('machine', 'rename');
		                $scope.renaming = true;
                        var job = Machine.renameMachine($scope.machineid, $scope.newInstanceName);

                        job.getJob().done(function() {
                            $scope.machine.name = $scope.newInstanceName;
                            $scope.changingName = false;
	                        $scope.renaming = false;
                        });
                    }
                );
            };

            $scope.clickDelete = function () {
                util.confirm(
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
                            if($location.url() === '/compute/instance/'+ machineid) {
                                $location.url('/compute');
                                $location.replace();
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

            var ending = '-image-creation';
            $scope.canCreateImage = function (name) {
                return name &&
                    typeof name === 'string' &&
                    name.length >= ending.length &&
                    name.indexOf(ending, name.length - ending.length) !== -1;
            };

            $scope.tagsArray = [];
            // Tags
            function initTags(tags) {
                $scope.tagsArray = [];
                $scope.tagsave = false;
                Object.keys(tags).forEach(function (key) {
                    $scope.tagsArray.push({key: key, val: tags[key], conflict: false, edit: false});
                });
                $scope.tagsArray.push({key:'', val: '', edit: true, conflict:false});
            }

            // Enable features
            // Instance tagging
            if ($scope.features.instanceTagging === 'enabled') {
                Machine.tags(machineid).then(initTags);

                $scope.$watch('tagsArray', function (newVal, oldVal){
                    // Search for conflicts
                    var keyMap = {};
                    newVal.forEach(function (tag, index) {
                        if (keyMap[tag.key] && index !== (newVal.length - 1)) {
                            tag.conflict = true;
                            keyMap[tag.key].conflict = true;
                        } else if (!tag.key && index !== (newVal.length - 1)){
                            tag.conflict = true;
                        } else {
                            tag.conflict = false;
                            keyMap[tag.key] = tag;
                        }
                    });

                    // Add empty value at the end if necessary
                    var last = newVal[newVal.length - 1];
                    if (!last || last.key !== '' || last.val !== '') {
                        newVal.splice(newVal.length, 0, {key:'', val: '', edit: true, conflict: false });
                    }

                    // Remove empty value from the end if necessary
                    var nextToLast = newVal[newVal.length - 2];
                    if (nextToLast) {
                        // Last to values are empty
                        if (!last.key && !last.val && !nextToLast.key && !nextToLast.val) {
                            var oldLast = oldVal[newVal.length - 1];
                            // The last value hasn't changed so remove it
                            if (!oldLast.key && !oldLast.val) {
                                newVal.pop();
                            }
                        }
                    }

                }, true);

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
                        sequence: 1
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
                        sequence: 2
                    },
                    {
                        id: 'parsed',
                        id2: 'action',
                        name: 'Action',
                        getClass: function () {
                            return 'span2 padding-5';
                        },
                        sequence: 3
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
                        sequence: 4
                    }
                ];
            }
        }

    ]);
}(window.JP.getModule('Machine'), window.jQuery));
