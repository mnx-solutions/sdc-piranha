'use strict';

(function (app, ng) {
    app.controller('Machine.ProvisionController', ['$scope',
        '$filter',
        'requestContext',
        'Machine',
        'Dataset',
        'Datacenter',
        'Package',
        'Account',
        'Network',
        '$dialog',
        '$location',
        'localization',
        '$q',
        '$$track',
        'util',

        function ($scope, $filter, requestContext, Machine, Dataset, Datacenter, Package, Account, Network, $dialog, $location, localization, $q, $$track, util) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.provision', $scope, {
                title: localization.translate(null, 'machine', 'Create Instances on Joyent')
            });

            $scope.account = Account.getAccount();
            $scope.keys = Account.getKeys();
            $scope.datacenters = Datacenter.datacenter();
            $scope.networks = [];
            $scope.packageTypes = [];
            $scope.packageType = null;
            $scope.loading = true;

            $scope.showReConfigure = false;
            $scope.showFinishConfiguration = false;

            $q.all([
                    $q.when($scope.keys),
                    $q.when($scope.datacenters)
                ]).then(function () {
                    $scope.loading = false;
                });

            $scope.data = {};
            $scope.selectedDataset = null;
            $scope.selectedPackage = null;
            $scope.selectedNetworks = [];
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
            };

            $scope.selectNetwork = function(id) {
                if($scope.selectedNetworks.indexOf(id) > -1) {
                    $scope.selectedNetworks.splice($scope.selectedNetworks.indexOf(id), 1);
                } else {
                    $scope.selectedNetworks.push(id);
                }
            };

            $scope.clickProvision = function () {
                function provision() {
                    util.confirm(
                        localization.translate(
                            $scope,
                            null,
                            'Confirm: Create Instance'
                        ),
                        localization.translate(
                            $scope,
                            'machine',
                            'Billing will start once this instance is created'
                        ), function () {
                            // add networks to data
                            $scope.data.networks = ($scope.selectedNetworks.length > 0) ? $scope.selectedNetworks : '';
                            $scope.retinfo = Machine.provisionMachine($scope.data);
                            $scope.retinfo.done(function(err, job) {
                                var newMachine = job.__read();
                                if(newMachine.id) {
                                    var listMachines = Machine.machine();
                                    $q.when(listMachines, function() {
                                        if(listMachines.length == 1) {
                                            $$track.marketo_machine_provision($scope.account);
                                        }
                                    });
                                }
                            });

                            $location.path('/instance');
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

            $scope.selectOpsys = function (name) {
                if (name && (name !== $scope.data.opsys)) {
                    $scope.data.opsys = name;
                }
            };

            $scope.sortPackages = function (pkg) {
                return parseInt(pkg.memory);
            };

            $scope.reconfigure = function () {
                $scope.showReConfigure = false;
                $scope.showFinishConfiguration = false;
                $scope.selectedDataset = null;
                $scope.selectedPackage = null;
                $scope.selectedPackageInfo = null;
                $scope.packageType = null;
                $scope.selectedNetworks = [];

                var ds = $scope.data.datacenter;
                var opsys = $scope.data.opsys;

                $scope.data = {
                    datacenter: ds,
                    opsys: opsys
                };

                ng.element('.carousel-inner').scrollTop($scope.previousPos);
                ng.element('#network-configuration').fadeOut('fast');
            };

            function getNr(el) {
                if (!el || !(el === el)) {
                    return false;
                }

                return +((el + '').replace(/,/g, ''));
            }

            $scope.selectDataset = function (id) {
                Dataset.dataset({ id: id, datacenter: $scope.data.datacenter }).then(function (dataset) {
                    if (dataset.type == 'virtualmachine') {
                        $scope.datasetType = 'kvm';
                    } else if (dataset.type == 'smartmachine') {
                        $scope.datasetType = 'smartos';
                    } else {
                        $scope.datasetType = dataset.type;
                    }

                    ng.element('#next').trigger('click');
                    ng.element('#step-configuration').fadeIn('fast');

                    $scope.selectedDataset = dataset;
                    ng.element('#pricing').removeClass('alert-muted');
                    ng.element('#pricing').addClass('alert-info');

                    $scope.data.dataset = dataset.id;
                    $scope.searchText = '';

                    if ($scope.packages && dataset.license_price) {
                        var lPrice = getNr(dataset.license_price);
                        if (lPrice !== false) {
                            $scope.packages.forEach(function (p) {
                                if (p.price) {
                                    p.full_price = lPrice + getNr(p.price);
                                    p.full_price = p.full_price.toFixed(3);
                                }

                                if (p.price_month) {
                                    p.full_price_month = getNr(p.price_month) + (lPrice * 730);
                                    p.full_price_month = p.full_price_month.toFixed(2);
                                }
                            });
                        }
                    } else if (!dataset.license_price) {
                        $scope.packages.forEach(function(p) {
                            delete(p.full_price);
                            delete(p.full_price_month);
                        });
                    }

                    $scope.showReConfigure = true;
                    $scope.slideCarousel();
                });


            };

            $scope.selectVersion = function (name, version) {
                $scope.selectedVersions[name] = version;
            };

            $scope.selectPackageType = function (packageType) {
                $scope.packageType = packageType;
            };

            $scope.filterDatasets = function (item) {
                var props = [ 'name', 'description' ];
                for (var i = 0, c = props.length; i < c; i++) {
                    var val = item[props[i]];
                    if (val && val.match($scope.searchText)) {
                        return true;
                    }
                }

                return false;
            };

            $scope.filterDatasetsByOS = function (item) {
                if ($scope.data.opsys != 'All') {
                    var val = item['os'];
                    if (val.match($scope.data.opsys)) {
                        return true;
                    }
                } else {
                    return true;
                }

                return false;
            };

            $scope.selectPackage = function (id) {
                $scope.data.name = null;
                Package.package({ id: id, datacenter: $scope.data.datacenter }).then(function (pkg) {
                    $scope.showFinishConfiguration = true;
                    $scope.selectedPackage = id;
                    $scope.selectedPackageInfo = pkg;

                    $scope.data.package = pkg.id;
                    ng.element('#network-configuration').fadeIn('fast');
                });
            };

            $scope.filterPackages = function (item) {
                if ($scope.datasetType !== item.type) {
                    return false;
                }

                if($scope.selectedDataset && $scope.selectedDataset.requirements) {
                    var requirements = $scope.selectedDataset.requirements;
                    for (var requirement in requirements) {
                        var value = parseInt(requirements[requirement]);

                        if (requirement === 'min_memory' &&
                            item['memory'] &&
                            parseInt(item['memory']) < value) {
                            return false;
                        }

                        if (requirement == 'max_memory' &&
                            item['memory'] &&
                            parseInt(item['memory']) > value) {
                            return false;
                        }
                    }
                }

                if ($scope.packageType && $scope.packageType !== item.group) {
                    return false;
                }

                var props = [ 'name', 'description', 'memory', 'disk', 'vcpus' ];
                for (var i = 0, c = props.length; i < c; i++) {
                    var val = item[props[i]];

                    if (val && (typeof val === 'string')) {
                        if (val.match($scope.searchPackages)) {
                            return true;
                        }
                    } else if (val === $scope.searchPackages) {
                        return true;
                    }
                }

                return false;
            };

            // Watch datacenter change
            $scope.$watch('data.datacenter', function (newVal) {
                if (newVal) {
                    $scope.reloading = true;
                    var count = 2;

                    Dataset.dataset({ datacenter: newVal }).then(function (datasets) {
                        var unique_datasets = [];
                        var dataset_names = [];
                        var versions = {};
                        var selectedVersions = {};
                        var manyVersions = {};
                        var operating_systems = {'All': 1};

                        datasets.forEach(function (dataset) {
                            operating_systems[dataset.os] = 1;

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

                                if (isVersionHigher(dataset.version, selectedVersions[dataset.name].version)) {
                                    selectedVersions[dataset.name] = dataset;
                                }
                            }
                        });

                        $scope.operating_systems = Object.keys(operating_systems);
                        $scope.datasets = unique_datasets;
                        $scope.versions = versions;
                        $scope.manyVersions = manyVersions;
                        $scope.selectedVersions = selectedVersions;
                        $scope.reloading = (--count > 0);
                    });

                    Network.network(newVal).then(function(networks) {
                        $scope.networks = networks;
                    });

                    Package.package({ datacenter: newVal }).then(function (packages) {
                        var packageTypes = [];
                        packages.forEach(function (p) {
                            if (packageTypes.indexOf(p.group) === -1){
                                packageTypes.push(p.group);
                            }

                            var price = getNr(p.price);
                            var priceMonth = getNr(p.price_month);
                            p.price = price && price.toFixed(3) || undefined;
                            p.price_month = priceMonth && priceMonth.toFixed(2) || undefined;
                        });

                        $scope.packageTypes = packageTypes;
                        $scope.packages = packages;
                        $scope.searchPackages = '';
                        $scope.reloading = (--count > 0);
                    });
                }
            });

            if (!$scope.data.datacenter) {
                $scope.selectDatacenter();
            }

            if (!$scope.data.opsys) {
                $scope.data.opsys = 'All';
            }

            ng.element('.carousel').carousel({
                interval:false
            });

            ng.element('.carousel').bind({
                slide: function() {
                    // ng.element('.item .header').hide();
                },
                slid:function(){
                    // ng.element('.item .header').show();
                }
            });

            $scope.slideCarousel = function() {
                $scope.previousPos = ng.element('.carousel-inner').scrollTop();

                ng.element('.carousel-inner').scrollTop(0);
                ng.element('.carousel').carousel('next');
            };
        }

    ]);
}(window.JP.getModule('Machine'), window.angular));
