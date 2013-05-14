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
            'util',
            function ($scope, requestContext, Dataset, Machine, Package, $dialog, $$track, localization, $q, util) {
                localization.bind('machine', $scope);
                requestContext.setUpRenderContext('machine.details', $scope);

                var machineid = requestContext.getParam('machineid');

                var confirm = function (question, callback) {
                    var title = 'Confirm';
                    var btns = [{result:'cancel', label: 'Cancel'}, {result:'ok', label: 'OK', cssClass: 'btn-primary'}];

                    $dialog.messageBox(title, question, btns)
                        .open()
                        .then(function(result){
                            if(result ==='ok'){
                                callback();
                            }
                        });
                };

                $scope.machineid = machineid;
                $scope.machine = Machine.machine(machineid);
                $scope.tagnr = 0;
                $scope.visiblePasswords = {};

                $scope.jobRunning = '';

                $q.when($scope.machine, function (m) {
                    m.primaryIps = m.ips.filter(function (ip) {
                        return !util.isPrivateIP(ip);
                    });
                });


                function tagcloud(tags) {
                    if(!tags) {
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
                    if(val) {
                        var keys = Object.keys(val);
                        var map = {};
                        keys.forEach(function (k) {
                            delete val[k].conflict;

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
                            var nextToLast = keys[keys.length -2];
                            if(!val[nextToLast].key && !val[nextToLast].val && !val[$scope.tagnr].val && !val[$scope.tagnr].key) {
                                delete val[$scope.tagnr];
                                $scope.tagnr = +nextToLast;
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
                        Machine.machine(machineid).then(function(m){
                            $scope.machine = m;
                        });
                    }
                );

                $scope.packages = Package.package();

                $q.when($scope.machine, function (m) {
                    console.log('packages', $scope.packages);
                    $scope.dataset = Dataset.dataset(m.image);
                    $scope.package = Package.package(m.package);

                    $scope.dataset.then(function(ds){
                        if(!$scope.datasetType) {
                            if(ds.type == 'virtualmachine') {
                                $scope.datasetType = 'kvm';
                            } else if(ds.type == 'smartmachine'){
                                $scope.datasetType = 'smartos';
                            }
                        }
                    })
                    Package.package(m.package).then(function (pkg) {
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
                    confirm(localization.translate($scope, null, 'Are you sure you want to start the machine'), function () {
                        $$track.event('machine', 'start');
                        var job = Machine.startMachine(machineid);
                    });
                };

                $scope.clickStop = function () {
                    confirm(localization.translate($scope, null, 'Are you sure you want to stop the machine'), function () {
                        var job = Machine.stopMachine(machineid);
                        $$track.event('machine', 'stop');
                    });
                };

                $scope.clickReboot = function () {
                    confirm(localization.translate($scope, null, 'Are you sure you want to reboot the machine'), function () {
                        $$track.event('machine', 'reboot');
                        var job  = Machine.rebootMachine(machineid);
                    });
                };

                $scope.clickResize = function () {
                    confirm(localization.translate($scope, null, 'Are you sure you want to resize the machine'), function () {
                        $scope.isResizing = true;
                        $$track.event('machine', 'resize');
                        $scope.retinfo = Machine.resizeMachine(machineid, $scope.selectedPackage);
                        console.log($scope.retinfo);
                        var job = $scope.retinfo.getJob();
                        job.done(function () {
                            $scope.isResizing = false;
                            $scope.currentPackageName = $scope.selectedPackageName;
                            $scope.currentPackage = $scope.selectedPackage;
                        });
                    });
                };

                $scope.clickDelete = function () {
                    confirm(localization.translate($scope, null, 'Are you sure you want to delete the machine'), function () {
                        $$track.event('machine', 'delete');
                        $scope.retinfo = Machine.deleteMachine(machineid);
                    });
                };

                $scope.clickSaveTags = function () {
                    $$track.event('machine', 'saveTags');
                    var data = {};
                    var tags = $scope.tagcloud.$$v;
                    var i;
                    for(i = 0; i < $scope.tagnr; i++) {
                        if(tags[i] && tags[i].key && tags[i].val){
                            data[tags[i].key] = tags[i].val;
                        }
                    }
                    $scope.tagsave = true;
                    $scope.retinfo = Machine.tags(machineid, data);
                    $scope.retinfo.then(function(tags) {
                        $scope.tagcloud = tagcloud(tags);
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
                    return parseInt(pkg.memory);
                };

                $scope.filterPackages = function (item) {
                    var dstype = $scope.datasetType ? item.type == $scope.datasetType : true;
                    if(dstype){
                        return true;
                    }
                    return false;

                };
            }

        ]);
}(window.JP.getModule('Machine'), window.jQuery));