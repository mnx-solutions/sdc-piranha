'use strict';

(function (app, $) {
    app.controller(
        'Machine.DetailsController',
        [   '$scope',
            'requestContext',
            'Dataset',
            'Machine',
            'Package',
            '$dialog',
            '$$track',
            'localization',
            '$q',
            '$location',
            'util',
            function ($scope, requestContext, Dataset, Machine, Package, $dialog, $$track, localization, $q, $location, util) {
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

                // Handle case when machine loading fails or machine uuid is invalid
                $q.when($scope.machine).then(
                    function () {
                        $scope.loading = false;
                        $scope.newInstanceName = $scope.machine.name;
                    }, function () {
                        $location.url('/instance');
                        $location.replace();
                    }
                );

                $scope.tagnr = 0;
                $scope.visiblePasswords = {};

                function tagcloud(tags) {
                    if (!tags) {
                        tags = Machine.tags(machineid);
                    }

                    var d = $q.defer();
                    var cloud = {};

                    function addVal(k, val, edit) {
                        var id = ++$scope.tagnr;
                        cloud[id] = {key: k, val: val, edit: edit};
                    }

                    function split() {
                        $scope.tagnr = -1;
                        Object.keys(tags).forEach(function(k) {
                            addVal(k, tags[k], false);
                        });

                        addVal('', '', true);
                        d.resolve(cloud);
                    }

                    $q.when(tags).then(function (t) {
                        tags = t;
                        split();
                    });

                    return d.promise;
                }

                $scope.tagcloud = tagcloud();

                function checkTags (val, old) {
                    if (val) {
                        var keys = Object.keys(val);
                        var map = {};
                        keys.forEach(function (k) {
                            delete val[k].conflict;

                            // Delete the element if there is no key and value and it is not the last tag row
                            if (!val[k].key && !val[k].val && old && old[k] && !old[k].key && !old[k].val && +k !== +$scope.tagnr) {
                                delete val[k];
                            } else if (val[k].key) {
                                if (map[val[k].key] !== undefined){
                                    val[map[val[k].key]].conflict = true;
                                    val[k].conflict = true;
                                }

                                map[val[k].key] = k;
                            }
                        });

                        if (val[$scope.tagnr] && (val[$scope.tagnr].key || val[$scope.tagnr].val)) {
                            val[++$scope.tagnr] = {key: '', val: '', edit: true};
                        }

                        if(keys.length > 1) {
                            var nextToLastKey = keys[keys.length - 2];
                            var nextToLast = val[nextToLastKey];
                            var last = val[$scope.tagnr];
                            // Remove last tag if both nextToLast and last tag element have missing keys and values
                            if(!nextToLast.key && !nextToLast.val && !last.val && !last.key) {
                                delete val[$scope.tagnr];
                                $scope.tagnr = +nextToLastKey;
                            }
                        }
                    }
                }

                $q.when($scope.tagcloud).then(function (){
                    $scope.$watch('tagcloud', checkTags, true);
                });

                $scope.$on(
                    'event:forceUpdate',
                    function (){
                        Machine.updateMachines();
                        Machine.machine(machineid).then(function (m) {
                            $scope.machine = m;
                        });
                    }
                );

                $scope.packages = Package.package();

                $q.when($scope.machine, function (m) {
                    m.primaryIps = m.ips.filter(function (ip) {
                        return !util.isPrivateIP(ip);
                    });

                    $scope.dataset = Dataset.dataset(m.image);
                    $scope.package = Package.package(m.package);

                    $scope.dataset.then(function(ds){
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

                $scope.enableRename = function(name) {
                    $scope.changingName = true;
                    $scope.newInstanceName = name;
                };

                $scope.cancelRename = function() {
                    $scope.newInstanceName = name;
                    $scope.changingName = false;
                };

                $scope.clickRename = function() {
                    if ($scope.machine.name == $scope.newInstanceName) {
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
                            var job = Machine.renameMachine($scope.machineid, $scope.newInstanceName);

                            job.getJob().done(function() {
                               $scope.machine.name = $scope.newInstanceName;
                               $scope.changingName = false;
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
                                if($location.url() === '/instance/details/'+ machineid) {
                                    $location.url('/instance');
                                    $location.replace();
                                }
                            });
                        });
                };

                $scope.clickSaveTags = function () {
                    $$track.event('machine', 'saveTags');
                    var data = {};
                    var tags = $scope.tagcloud.$$v;

                    for (var i = 0; i < $scope.tagnr; i++) {
                        if (tags[i] && tags[i].key && tags[i].val){
                            data[tags[i].key] = tags[i].val;
                        }
                    }

                    $scope.tagsave = true;
                    $scope.retinfo = Machine.tags(machineid, data);
                    $scope.retinfo.then(function(tags) {
                        $scope.tagcloud = tagcloud(tags);
                        $scope.tagsave = false;
                    }, function (err) {
                        $scope.tagsave = false;
                    });
                };

                $scope.editTag = function (k) {
                    $scope.tagcloud.$$v[k].edit = true;
                };

                $scope.removeTag = function(k) {
                    delete $scope.tagcloud.$$v[k];
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

                    if($scope.currentPackage && item.type && item.type === 'smartos' && item.memory >= $scope.currentPackage.memory) {
                        //Old images don't have currentPackage.type
                        return (!$scope.currentPackage.type && item.group === 'High CPU') || (item.group === $scope.currentPackage.group);
                    }
                    return false;
                };
            }

        ]);
}(window.JP.getModule('Machine'), window.jQuery));