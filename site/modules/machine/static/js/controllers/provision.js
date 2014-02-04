'use strict';

(function (app, ng) {
    app.controller('Machine.ProvisionController', ['$scope',
        '$filter',
        'requestContext',
        '$timeout',
        'Machine',
        'Dataset',
        'Datacenter',
        'Package',
        'Account',
        'Network',
        'Image',
        '$location',
        'localization',
        '$q',
        '$$track',
        'PopupDialog',
        '$cookies',

        function ($scope, $filter, requestContext, $timeout, Machine, Dataset, Datacenter, Package, Account, Network,
                  Image, $location, localization, $q, $$track, PopupDialog, $cookies) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.provision', $scope, {
                title: localization.translate(null, 'machine', 'Create Instances on Joyent')
            });

            $scope.campaignId = ($cookies.campaignId || 'default');

            $scope.preSelectedImageId = requestContext.getParam('imageid');
            $scope.preSelectedImage = null;

            if ($scope.preSelectedImageId) {
                $scope.preSelectedImage = Image.image($scope.preSelectedImageId);
            }

            $scope.account = Account.getAccount();
            $scope.keys = Account.getKeys();
            $scope.datacenters = Datacenter.datacenter();
            $scope.networks = [];
            $scope.packageTypes = [];
            $scope.packageType = null;
            $scope.loading = true;
            $scope.basicCreateInstance = !$scope.preSelectedImageId;

            $scope.reConfigurable = false;
            $scope.showReConfigure = false;
            $scope.showFinishConfiguration = false;
            $scope.visibilityFilter = 'Public';
            $scope.currentSlidePageIndex = 0;
            $scope.currentStep = '';

            Machine.getSimpleImgList(function (err, data) {
                if (err) {
                    console.error(err);
                    return;
                }

                $scope.simpleImages = data;
            });

            $q.all([
                    $q.when($scope.keys),
                    $q.when($scope.datacenters),
                    $q.when($scope.preSelectedImage)
                ]).then(function () {
                    $scope.loading = false;
                });

            $scope.data = {};
            $scope.selectedDataset = null;
            $scope.selectedPackage = null;
            $scope.selectedNetworks = [];
            $scope.selectedVisibility = true; // defaults to Public true
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

            $scope.selectNetworkCheckbox = function(id){
                $scope.networks.forEach(function (el) {
                    if(el.id == id){
                        el.active = (el.active) ? false : true;
                    }
                });
                $scope.selectNetwork(id);
            };

            function provision(machine) {
                    PopupDialog.confirm(
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
                        if (machine && !machine.dataset) {
                            PopupDialog.message('Error', 'Instance not found', function () {});
                            return;
                        }
                        $scope.retinfo = Machine.provisionMachine( machine || $scope.data);
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

                        $location.path('/compute');
                    });
                }

            $scope.clickProvision = function () {

                // add networks to data
                $scope.data.networks = ($scope.selectedNetworks.length > 0) ? $scope.selectedNetworks : '';
                $scope.data.tags = $scope.tags || {};

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

            $scope.createSimple = function (data) {
                provision(data);
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

            $scope.reconfigure = function (goto) {
                $scope.showReConfigure = false;
                $scope.showFinishConfiguration = false;
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
                $scope.setCurrentStep(goto);
                ng.element('.carousel-inner').scrollTop($scope.previousPos);
                ng.element('#network-configuration').fadeOut('fast');
                ng.element('.carousel').carousel(goto);
            };

            function getNr(el) {
                if (!el || !(el === el)) {
                    return false;
                }

                return +((el + '').replace(/,/g, ''));
            }

            $scope.setCurrentStep = function(index) {
                ng.element('.wizard-steps')
                    .children('div')
                    .removeClass('active-step')
                    .eq(index).
                    addClass('active-step');

                $scope.currentStep = ng.element('.active-step').find('.current-step').eq(0).text();
                $scope.currentSlidePageIndex = index;
            };

            $scope.selectDataset = function (id, changeDataset) {
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

                    if (!changeDataset) {
                        $scope.setCurrentStep(1);
                        $scope.slideCarousel();
                    }
                });

                $scope.collapseTrigger2($scope.packageTypes.length-1, $scope.packageTypes.length);
            };

            $scope.selectVersion = function (name, version) {
                $scope.selectedVersions[name] = version;
                $scope.selectDataset($scope.selectedVersions[name].id, true);
            };

            $scope.selectPackageType = function (packageType) {
                $scope.packageType = packageType;
            };

            $scope.filterDatasets = function (item) {
                if(!$scope.searchText) {
                    return true;
                }
                var props = [ 'name', 'description' ];
                return props.some(function (prop) {
                    if(item[prop] && item[prop].toLowerCase().indexOf($scope.searchText.toLowerCase()) !== -1) {
                        return true;
                    }
                });
            };

            $scope.filterDatasetsByOS = function (item) {
                if ($scope.data.opsys !== 'All' && !item.os.match($scope.data.opsys)) {
                    return false;
                }
                return true;
            };

            $scope.filterDatasetsByVisibility = function(item) {
                if($scope.features.imageUse !== 'disabled'
                    && ($scope.selectedVisibility === false
                    || $scope.selectedVisibility === true)
                    && item.public !== $scope.selectedVisibility) {
                    return false;
                }

                return true;
            };

            $scope.selectVisibility = function(type) {
                if(type === null) {
                    $scope.visibilityFilter = 'All';
                } else if(type === true) {
                    $scope.visibilityFilter = 'Public';
                } else if(type === false) {
                    $scope.visibilityFilter = 'Saved';
                }

                $scope.selectedVisibility = type;
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

                if(!$scope.searchPackages) {
                    return true;
                }
                
                var props = [ 'name', 'description', 'memory', 'disk', 'vcpus' ];
                return props.some(function (prop) {
                    if(!item[prop]) {
                        return false;
                    }
                    var val = item[prop];
                    if(typeof val !== 'string') {
                        if(typeof val === 'object') {
                            val = JSON.stringify(val);
                        } else {
                            val += '';
                        }
                    }
                    if (val.toLowerCase().indexOf($scope.searchPackages.toLowerCase()) !== -1) {
                        return true;
                    }
                });
            };

            // Watch datacenter change
            $scope.$watch('data.datacenter', function (newVal) {
                if (newVal) {
                    $scope.reloading = true;
                    $scope.networks = [];
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
                        if(newVal === $scope.data.datacenter) {
                            $scope.networks = networks;
                            $scope.networks.forEach(function(network) {
                                $scope.selectNetworkCheckbox(network.id);
                            });
                        }
                    });

                    Package.package({ datacenter: newVal }).then(function (packages) {
                        if(newVal !== $scope.data.datacenter) {
                            return;
                        }

                        var packageTypes = [];
                        packages.forEach(function (p) {
                            if (p.group && packageTypes.indexOf(p.group) === -1 && p.price) {
                                packageTypes.push(p.group);
                            }
                            var price = getNr(p.price);
                            var priceMonth = getNr(p.price_month);
                            p.price = (price || price === 0) && price.toFixed(3) || undefined;
                            p.price_month = (priceMonth || priceMonth === 0) && priceMonth.toFixed(2) || undefined;
                        });


                        var standardIndex = packageTypes.indexOf('Standard');
                        if (standardIndex !== -1) {
                            packageTypes.splice(standardIndex, 1);
                            packageTypes.push('Standard');
                        }

                        $scope.packageTypes = packageTypes;
                        $scope.packages = packages;
                        $scope.searchPackages = '';
                        $scope.reloading = (--count > 0);


                        if($scope.preSelectedImageId)
                            $scope.selectDataset($scope.preSelectedImageId);
                    });

                }
            });

            // if we have pre-selected image, select correct datacenter
            if (!$scope.data.datacenter) {
                if($scope.preSelectedImageId) {
                    // wait until we have the pre-selected image (loading will not finish before it anyway)
                    $q.when($scope.preSelectedImage).then(function(image) {
                        $scope.selectDatacenter(image.datacenter);
                    });
                } else {
                    $scope.selectDatacenter();
                }
            }

            if (!$scope.data.opsys) {
                $scope.data.opsys = 'All';
            }

            ng.element('#provisionCarousel').carousel({
                interval:false
            });

            ng.element('#provisionCarousel').bind({
                slide: function() {
                    $scope.reConfigurable = !$scope.reConfigurable;
                    if($scope.reConfigurable) {
                        $timeout(function(){
                            $scope.showReConfigure = true;
                        }, 600);
                    }
                }
            });


            $scope.slideCarousel = function() {
                $scope.previousPos = ng.element('.carousel-inner').scrollTop();
                ng.element('.carousel-inner').scrollTop(0);
                ng.element('.carousel').carousel('next');
            };

            $scope.accordionIcon2 = {};
            $scope.collapseTrigger2 = function(item, items){
                for(var i = 0; i < items; i++){
                    $scope.accordionIcon2[i] = false;
                }

                $scope.accordionIcon2[item] = true;

                return $scope.accordionIcon2[item];
            };

            $scope.reviewPage = function () {
                $scope.slideCarousel();
                $scope.setCurrentStep(2);
            };

            $scope.simpleCreateInstance = function(){
                $scope.reconfigure(0);
                $scope.basicCreateInstance = true;
            }
        }

    ]);
}(window.JP.getModule('Machine'), window.angular));
