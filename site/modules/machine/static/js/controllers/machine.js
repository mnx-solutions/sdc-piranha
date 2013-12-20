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

        function ($scope, requestContext, Dataset, Machine, Package, Network, rule, firewall, $filter, $dialog, $$track, localization, $q, $location, util, Image) {
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
                var selected = $scope.selectedPackage;
                if(!selected) {
                    return;
                }
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
                if ($scope.machine.state !== 'stopped') {
                    var title = 'Message';
                    var message = 'Please stop the instance before trying to create an image';
                    var btns = [
                        {
                            result: 'stop',
                            label: 'Stop instance now',
                            cssClass: 'pull-left'
                        },
                        {
                            result: 'ok',
                            label: 'OK',
                            cssClass: 'btn-joyent-blue'
                        }
                    ];

                    return $dialog.messageBox(title, message, btns)
                        .open()
                        .then(function (result) {
                            if (result === 'stop') {
                                Machine.stopMachine(machineid);
                                $$track.event('machine', 'stop');
                            }
                        });
                } else {
                    $scope.imageName = $scope.imageName || (Math.random() + 1).toString(36).substr(2, 7);
                    $scope.imageJob = Image.createImage($scope.machineid, $scope.machine.datacenter, $scope.imageName, $scope.imageDescription);
                    $scope.imageJob.done(function () {
                        $scope.imageName = $scope.imageDescription = '';
                        $scope.imageForm.$pristine = true;
                        $scope.imageForm.$dirty = false;
                    });
                }
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
}(window.JP.getModule('Machine'), window.jQuery));
