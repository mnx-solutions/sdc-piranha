'use strict';

(function (app, ng) {
    app.controller(
        'Machine.ProvisionController',
        [   '$scope',
            '$filter',
            'requestContext',
            'Machine',
            'Dataset',
            'Datacenter',
            'Package',
            'Account',
            '$dialog',
            '$location',
            'localization',
            '$q',
            function ($scope, $filter, requestContext, Machine, Dataset, Datacenter, Package, Account, $dialog, $location, localization, $q) {
                localization.bind('machine', $scope);
                requestContext.setUpRenderContext('machine.provision', $scope);

                $scope.keys = Account.getKeys();
                $scope.datacenters = Datacenter.datacenter();
                $scope.packageTypes = [];
                $scope.packageType = null;

                var confirm = function (question, callback) {
                    var title = 'Confirm';
                    var btns = [{result:'cancel', label: 'Cancel'}, {result:'ok', label: 'OK', cssClass: 'btn-primary'}];

                    $dialog.messageBox(title, question, btns)
                        .open()
                        .then(function(result){
                            if(result === 'ok'){
                                callback();
                            }
                        });
                };

                $scope.data = {};
                $scope.selectedDataset = null;
                $scope.selectedPackage = null;
                $scope.previousPos = 0;

                // version number comparison
                var isVersionHigher = function (v1, v2) {
                    var v1parts = v1.split('.');
                    var v2parts = v2.split('.');

                    for (var i = 0; i < v1parts.length; ++i) {
                        if (v2parts.length == i) {
                            return true;
                        }

                        if (v1parts[i] == v2parts[i]) {
                            continue;
                        }
                        else if (v1parts[i] > v2parts[i]) {
                            return true;
                        }
                        else {
                            return false;
                        }
                    }

                    if (v1parts.length != v2parts.length) {
                        return false;
                    }

                    return false;
                }

                $scope.clickProvision = function () {
                    function provision() {
                        confirm(localization.translate($scope, 'machine', 'Are you sure it works?'), function () {
                            $scope.retinfo = Machine.provisionMachine($scope.data);

                            $location.path('/machine');
                        });
                    }

                    if (!$scope.data.datacenter) {
                        Datacenter.datacenter().then(function (datacenters) {
                            var keys = Object.keys(datacenters);
                            if (keys.length > 0) {
                                $scope.data.datacenter = keys[0];
                                provision();
                            } else {
                                // TODO: Throw an error
                            }
                        });
                    } else {
                        provision();
                    }
                };

                $scope.selectDatacenter = function (name) {

                    if (!name && !$scope.data.datacenter) {
                        Datacenter.datacenter().then(function (datacenters) {
                            if (datacenters.length > 0) {
                                $scope.data.datacenter = datacenters[0].name;
                            }
                        });
                    } else if (name && (name !== $scope.data.datacenter)) {
                        $scope.data.datacenter = name;
                    }

                };

                $scope.sortPackages = function (pkg) {
                    return parseInt(pkg.memory);
                };

                $scope.reconfigure = function () {

                    $scope.selectedDataset = null;
                    $scope.selectedPackage = null;
                    $scope.selectedPackageInfo = null;
                    $scope.data = {};
                    $scope.packageType = null;

                    ng.element('.carousel-inner').scrollTop($scope.previousPos);
					ng.element('#finish-configuration').fadeOut('fast');

                };

                $scope.selectDataset = function (id) {
                    Dataset.dataset({ id: id, datacenter: $scope.data.datacenter }).then(function (dataset) {
                        if(dataset.type == 'virtualmachine') {
                            $scope.datasetType = 'kvm';
                        } else if(dataset.type == 'smartmachine'){
                            $scope.datasetType = 'smartos';
                        }

                        ng.element('#next').trigger('click');
                        ng.element('#step-configuration').fadeIn('fast');
                        
                        $scope.selectedDataset = dataset;
                        ng.element('#pricing').removeClass('alert-muted');
                        ng.element('#pricing').addClass('alert-info');
                        
                        $scope.data.dataset = dataset.id;
                        $scope.searchText = '';
                    });

                };

                $scope.filterDatasets = function (item) {
                    var props = [ 'name', 'description' ];
                    for (var i = 0, c = props.length; i < c; i++) {
                        var val = item[props[i]];
                        if (val.match($scope.searchText)) {
                            return true;
                        }
                    }

                    return false;
                };

                $scope.selectPackage = function (id) {
                    $scope.data.name = null;
                    Package.package({ id: id, datacenter: $scope.data.datacenter }).then(function (pkg) {
                        ng.element('#finish-configuration').fadeIn('fast');

                        $scope.selectedPackage = id;
                        $scope.selectedPackageInfo = pkg;

                        $scope.data.package = pkg.id;
                    });
                };

                $scope.filterPackages = function (item) {
                    var props = [ 'name', 'description', 'memory', 'disk', 'vcpus' ];
                    for (var i = 0, c = props.length; i < c; i++) {
                        var val = item[props[i]];

                        var dstype = $scope.datasetType ? item.type == $scope.datasetType : true;

                        if (val.match($scope.searchPackages) && dstype && ($scope.packageType === null || $scope.packageType === item.group)) {
                            return true;
                        }
                    }
                    return false;
                };

                // Watch datacenter change
                $scope.$watch('data.datacenter', function (newVal) {

                    if (newVal) {
                        Dataset.dataset({ datacenter: newVal }).then(function (datasets) {
                            var unique_datasets = [];
                            var dataset_names = [];
                            var versions = {};
                            var selectedVersions = {};
                            var manyVersions = {};

                            datasets.forEach(function (dataset) {
                                if (!dataset_names[dataset.name]) {
                                    dataset_names[dataset.name] = true;
                                    unique_datasets.push(dataset);
                                }
                                if (!versions[dataset.name]) {
                                    versions[dataset.name] = {};
                                    versions[dataset.name][dataset.version] = dataset;

                                    selectedVersions[dataset.name] = dataset;

                                } else {
                                    if (!versions[dataset.name][dataset.version]) {
                                        manyVersions[dataset.name] = true;
                                        versions[dataset.name][dataset.version] = dataset;
                                    }
                                    // if version is more recent, use as default
                                    if(isVersionHigher(dataset.version, selectedVersions[dataset.name].version)) {
                                        selectedVersions[dataset.name] = dataset;
                                    }
                                }
                            });
                            $scope.datasets = unique_datasets;
                            $scope.versions = versions;
                            $scope.manyVersions = manyVersions;
                            $scope.selectedVersions = selectedVersions;
                        });

                        Package.package({ datacenter: newVal }).then(function (packages) {
                            var packageTypes = [];
                            packages.forEach(function (p) {
                                // if price is below 0.005 we don't want to
                                // show a 0.00 price.
                                var price = parseFloat(p.price);
                                if(price === 0) {
                                    price = 0.01;
                                }
                                p.price = price.toFixed(2);
                                var price_month = parseFloat(p.price_month).toFixed(2);
                                p.price_month = price_month;
                                if(packageTypes.indexOf(p.group) === -1){
                                    packageTypes.push(p.group);
                                }
                            });

                            $scope.packageTypes = packageTypes;
                            $scope.packages = packages;
                            $scope.searchPackages = '';
                        });
                    }
                });

                if (!$scope.data.datacenter) {
                    $scope.selectDatacenter();
                }

                ng.element('.carousel').carousel({
                    interval:false
                });
				ng.element('.carousel').bind({
					slide: function() {
						ng.element('.item .header').hide();
					},
					slid:function(){
						ng.element('.item .header').show();
					}
				  });
                $scope.slideCarousel = function() {
                  $scope.previousPos = ng.element('.carousel-inner').scrollTop();
                  ng.element('.carousel-inner').scrollTop(0);
                  ng.element('.carousel').carousel('next');
				  
                }
            }

        ]);
}(window.JP.getModule('Machine'), window.angular));
