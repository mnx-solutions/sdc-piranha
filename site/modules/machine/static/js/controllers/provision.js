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
        '$rootScope',
        'FreeTier',
        '$compile',
        'loggingService',

        function ($scope, $filter, requestContext, $timeout, Machine, Dataset, Datacenter, Package, Account, Network, Image, $location, localization, $q, $$track, PopupDialog, $cookies, $rootScope, FreeTier, $compile, loggingService) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.provision', $scope, {
                title: localization.translate(null, 'machine', 'Create Instances on Joyent')
            });

            $scope.campaignId = ($cookies.campaignId || 'default');

            $scope.preSelectedImageId = requestContext.getParam('imageid');
            $scope.preSelectedImage = null;

            $scope.instanceType = $scope.preSelectedImageId || $location.path().indexOf('/custom') > -1 ? 'Saved' : 'Public';

            $scope.instanceMetadataEnabled = $scope.features.instanceMetadata === 'enabled';
            $scope.metadataArray = [
                {key: '', val: '', edit: true, conflict: false}
            ];

            Account.getAccount(true).then(function (account) {
                $scope.account = account;
            });
            $scope.keys = Account.getKeys();
            $scope.datacenters = [];
            $scope.networks = [];
            $scope.indexPackageTypes = {};
            $scope.packageTypes = [];
            $scope.packageType = null;
            $scope.loading = true;

            $scope.reConfigurable = false;
            $scope.showReConfigure = false;
            $scope.showFinishConfiguration = false;
            $scope.currentSlidePageIndex = 0;
            $scope.currentStep = '';
            $scope.datasetsLoading = false;

            $scope.filterValues = {
                'No filter': [],
                'vcpus': [],
                'memory': [],
                'disk': []
            };

            $scope.filterProps = Object.keys($scope.filterValues);

            if ($scope.features.freetier === 'enabled') {
                $scope.freeTierOptions = FreeTier.freetier();
            }

            $q.all([
                $q.when($scope.keys),
                $q.when(Datacenter.datacenter()),
                $q.when($scope.preSelectedImage),
                $q.when(Machine.getSimpleImgList()),
                $q.when($scope.freeTierOptions)
            ]).then(function (result) {
                $scope.datacenters = result[1];
                $scope.simpleImages = [];
                var simpleImages = result[3]['images'];
                var networks = result[3]['networks'];
                if (simpleImages && simpleImages.length > 0) {
                    if ($scope.datacenters && $scope.datacenters.length > 0) {
                        $scope.datacenters.forEach(function (datacenter) {
                            Package.package({ datacenter: datacenter.name }).then(function (packages) {
                                var packagesByName = {};
                                packages.forEach(function (pkg) {
                                    packagesByName[pkg.name] = pkg.id;
                                });
                                angular.copy(simpleImages).forEach(function (simpleImage) {
                                    simpleImage.imageData = {};
                                    simpleImage.imageData.dataset = simpleImage.dataset;
                                    simpleImage.imageData.datacenter = datacenter.name;
                                    simpleImage.imageData.name = '';
                                    simpleImage.imageData.package = packagesByName[simpleImage.packageName];
                                    simpleImage.imageData.networks = networks;
                                    delete simpleImage.dataset;
                                    delete simpleImage.packageName;
                                    if (simpleImage.imageData.package) {
                                        $scope.simpleImages.push(simpleImage);
                                    }
                                });
                            });
                        });

                    }
                }
                if ($scope.features.freetier === 'enabled') {
                    var freeImages = result[4];
                    var convertedFreeImages = [];
                    if (freeImages.valid) {
                        freeImages.forEach(function (freeImage) {
                            freeImage.datacenters.forEach(function (datacenter) {
                                var simpleImage = ng.copy({imageData: freeImage});
                                simpleImage.imageData.datacenter = datacenter;
                                simpleImage.name = freeImage.name;
                                simpleImage.description = {
                                    text: freeImage.original.description,
                                    memory: freeImage.original.memory / 1024,
                                    cpu: freeImage.original.vcpus,
                                    disk: freeImage.original.disk / 1024,
                                    price: freeImage.original.price
                                };
                                var smallLogoClass = $filter('logo')(simpleImage.imageData.name);
                                simpleImage.className = smallLogoClass.indexOf('default') === -1 ?
                                        smallLogoClass + '-logo' : 'joyent-logo';
                                simpleImage.imageData.name = ''; // Name will be autogenerated
                                simpleImage.imageData.freetier = true;
                                simpleImage.imageData.freeTierValidUntil = freeImages.validUntil;
                                delete simpleImage.imageData.datacenters;
                                delete simpleImage.imageData.original;
                                convertedFreeImages.push(simpleImage);
                            });
                        });
                    }
                    $scope.simpleImages = convertedFreeImages.concat($scope.simpleImages);
                }
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

            $scope.selectNetwork = function (id) {
                if ($scope.selectedNetworks.indexOf(id) > -1) {
                    $scope.selectedNetworks.splice($scope.selectedNetworks.indexOf(id), 1);
                } else {
                    $scope.selectedNetworks.push(id);
                }
            };

            $scope.selectNetworkCheckbox = function (id) {
                $scope.networks.forEach(function (el) {
                    if (el.id == id) {
                        el.active = (el.active) ? false : true;
                    }
                });
                $scope.selectNetwork(id);
            };

            var filterSelectedNetworks = function (selectedNetworks, callback) {
                Network.network($scope.data.datacenter).then(function (dcNetworks) {
                    callback(selectedNetworks.filter(function (selectedNetwork) {
                        return dcNetworks.some(function (dcNetwork) {
                            return dcNetwork.id === selectedNetwork;
                        });
                    }));
                });
            };

            function provision(machine) {
                var finalProvision = function () {
                    if (machine && !machine.dataset) {
                        PopupDialog.message('Error', 'Instance not found.', function () {
                        });
                        return;
                    }
                    Machine.provisionMachine(machine || $scope.data).done(function (err, job) {
                        var newMachine = job.__read();
                        if ($scope.features.freetier === 'enabled') {
                            $scope.freetier = FreeTier.freetier();
                        }
                        $q.when(Machine.machine(), function (listMachines) {
                            if (newMachine.id && listMachines.length === 1) {
                                $$track.marketo_machine_provision($scope.account);
                            } else if (err && listMachines.length === 0) {
                                $location.path('/compute/create/simple');
                            }
                        });
                    });

                    $location.path('/compute');
                };
                var submitBillingInfo = {
                    btnTitle: 'Submit and Create Instance',
                    appendPopupMessage: 'Provisioning will now commence.'
                };
                Account.checkProvisioning(submitBillingInfo, function () {
                    if (machine) {
                        filterSelectedNetworks(machine.networks || [], function (filteredNetworks) {
                            machine.networks = filteredNetworks.length > 0 ? filteredNetworks : '';
                            finalProvision();
                        });
                        return;
                    }

                    var dataset = $scope.selectedDataset;
                    var description = dataset && dataset.description;
                    var billingStartMessage = localization.translate(
                            $scope,
                            'machine',
                            'Billing will start once this instance is created'
                    );
                    var title = 'Confirm: Create Instance';
                    var popupContent = billingStartMessage;
                    if (dataset && dataset.eula || description && description.indexOf('Stingray') > -1) {
                        title = 'Accept End-User License Agreement';

                        var eulaLink = dataset.eula || 'slb/static/templates/eula.html';
                        var popupTpl = document.createElement("div");
                        popupTpl.setAttribute("ng-include", '"' + eulaLink + '"');

                        popupContent = {
                            body: $compile(popupTpl)($scope),
                            footer: billingStartMessage
                        };
                    }

                    PopupDialog.confirm(
                            localization.translate(
                                    $scope,
                                    null,
                                    title
                            ),
                            popupContent,
                            finalProvision
                    );
                }, function () {
                    if (!machine) {
                        $rootScope.commonConfig('provisionBundle', {
                            datacenters: $scope.datacenters,
                            datacenter: $scope.data.datacenter,
                            datasetType: $scope.datasetType,
                            selectedDataset: $scope.selectedDataset,
                            filterProperty: $scope.filterProperty,
                            filterProps: $scope.filterProps,
                            filterValues: $scope.filterValues,
                            selectedPackageInfo: $scope.selectedPackageInfo,
                            filterPropertyValue: $scope.filterPropertyValue,
                            packages: $scope.packages,
                            packageTypes: $scope.packageTypes,
                            indexPackageTypes: $scope.indexPackageTypes,
                            metadata: $scope.metadata,
                            tags: $scope.tags,
                            manualCreate: true,
                            allowCreate: false,
                            machine: $scope.data

                        });
                    } else {
                        $rootScope.commonConfig('provisionBundle', {
                            manualCreate: false,
                            allowCreate: false,
                            machine: machine
                        });
                    }

                });
            }

            $scope.clickProvision = function () {
                // add networks to data
                $scope.data.networks = ($scope.selectedNetworks.length > 0) ? $scope.selectedNetworks : '';
                $scope.data.metadata = $scope.metadata || {};
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

            if ($scope.features.manta === 'enabled' && !$scope.data.datacenter) {
                //TODO: Handle all other DC drop-downs
                $scope.userConfig = Account.getUserConfig().$child('datacenter');
                $scope.userConfig.$load(function (error, config) {
                    if (config.value && !$scope.data.datacenter && !preSelectedImage) {
                        $scope.selectDatacenter(config.value);
                    }
                    $scope.$watch('data.datacenter', function (dc) {
                        if (config.value !== dc) {
                            config.value = dc;
                            config.dirty(true);
                            config.$save();
                        }
                    });
                });
            }
            $scope.selectDatacenter = function (name) {
                Datacenter.datacenter().then(function (datacenters) {
                    var datacenterName = null;
                    if (datacenters.length > 0) {
                        var hasSpecifiedDatacenter = datacenters.some(function (datacenter) {
                            return datacenter.name === name;
                        });
                        if (name && hasSpecifiedDatacenter) {
                            datacenterName = name;
                        } else {
                            datacenterName = datacenters[0].name;
                        }
                    }
                    if (datacenterName) {
                        $scope.data.datacenter = datacenterName;
                    }
                });
            };

            $scope.selectOpsys = function (name) {
                if (name && (name !== $scope.data.opsys)) {
                    $scope.data.opsys = name;
                }
            };

            $scope.sortPackages = function (pkg) {
                return parseInt(pkg.memory);
            };

            var expandLastSection = function () {
                var lastSectionHeader = ng.element('#packagesAccordion .accordion-toggle:last');
                if (lastSectionHeader.hasClass('collapsed')) {
                    lastSectionHeader.click();
                }
            };

            $scope.reconfigure = function (goto) {
                $scope.showReConfigure = false;
                $scope.showFinishConfiguration = false;
                // TODO: Change magic numbers to constants
                if (goto !== 1 && goto !== 2) {
                    $scope.selectedPackage = null;
                    $scope.selectedPackageInfo = null;
                    $scope.packageType = null;
                }

                if (goto !== 2) {
                    if ($scope.networks && $scope.networks.length) {
                        $scope.selectedNetworks = [];
                        $scope.networks.forEach(function (network) {
                            $scope.selectedNetworks.push(network.id);
                            network.active = true;
                        });
                        $scope.metadata = [];
                        $scope.tags = [];
                    }
                    $scope.provisionForm.machineName.$setValidity('machineName', true);
                    $scope.provisionForm.machineName.$setValidity('machineUnique', true);

                    var instancePackage = $scope.data.package;

                    $scope.data = {
                        datacenter: $scope.data.datacenter,
                        opsys: $scope.data.opsys,
                        name: null,
                        dataset: $scope.data.dataset
                    };
                }
                if (goto === 1) {
                    $scope.data.package = instancePackage;
                }
                if (goto === 1) {
                    expandLastSection();
                }
                $scope.setCurrentStep(goto);
                ng.element('.carousel-inner').scrollTop($scope.previousPos);
                if ($scope.features.instanceMetadata === 'enabled') {
                    ng.element('#metadata-configuration').fadeOut('fast');
                }
                ng.element('#network-configuration').fadeOut('fast');
                ng.element('.carousel').carousel(goto);
            };

            function getNr(el) {
                if (!el || !(el === el)) {
                    return false;
                }

                return +((el + '').replace(/,/g, ''));
            }

            $scope.setCurrentStep = function (index) {
                ng.element('.wizard-steps')
                        .children('div')
                        .removeClass('active-step')
                        .eq(index).
                        addClass('active-step');

                $scope.currentStep = ng.element('.active-step').find('.current-step').eq(0).text();
                $scope.currentSlidePageIndex = index;
            };

            $scope.processPackages = function () {
                var packageId = '';
                var sortPackage = '';
                var filterValues = {
                    'No filter': [],
                    vcpus: [],
                    memory: [],
                    disk: []
                };

                $scope.packages.forEach(function (pkg) {
                    if ($scope.filterPackages()(pkg)) {
                        if (!sortPackage || (sortPackage && sortPackage > parseInt(pkg.memory, 10))) {
                            sortPackage = parseInt(pkg.memory, 10);
                            packageId = pkg.id;
                        }
                        if (pkg.price) {
                            var cpu = Number(pkg.vcpus);
                            if (filterValues.vcpus.indexOf(cpu) === -1) {
                                filterValues.vcpus.push(cpu);
                            }
                            if (filterValues.memory.indexOf(pkg.memory) === -1) {
                                filterValues.memory.push(pkg.memory);
                            }
                            if (filterValues.disk.indexOf(pkg.disk) === -1) {
                                filterValues.disk.push(pkg.disk);
                            }
                        }
                    }
                });
                return {
                    minimalPackage: packageId,
                    filterValues: filterValues
                };
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
                        $scope.packages.forEach(function (p) {
                            delete(p.full_price);
                            delete(p.full_price_month);
                        });
                    }

                    if ($scope.features.freetier === 'enabled') {
                        $scope.freeTierOptions.then(function (freeTierOptions) {
                            $scope.packages.forEach(function (p) {
                                p.freeTierHidden = freeTierOptions.some(function (option) {
                                    var packageMatches = p.id === option.package;
                                    var datacenterMatches = option.datacenters.length > 0 &&
                                            option.datacenters.indexOf($scope.data.datacenter) >= -1;
                                    return packageMatches && (!datacenterMatches || !freeTierOptions.valid);
                                });
                            });
                        });
                    }

                    if (!changeDataset) {
                        $scope.setCurrentStep(1);
                        $scope.slideCarousel();
                    }

                    if ($scope.packages) {
                        var processedPackages = $scope.processPackages();
                        var packageId = processedPackages.minimalPackage;
                        $scope.filterValues = processedPackages.filterValues;

                        if (packageId) {
                            $scope.selectPackage(packageId);
                        }

                        $scope.filterProps.forEach(function (prop) {
                            $scope.filterValues[prop].sort(function (a, b) {
                                return a - b;
                            });
                        });

                        $scope.filterProperty = $scope.filterProps[0];
                        $scope.onFilterChange($scope.filterProperty);
                    }

                    setTimeout(expandLastSection, 600);
                    ng.element('.carousel').one('slid', expandLastSection);
                });
            };

            $scope.selectVersion = function (name, version) {
                $scope.selectedVersions[name] = version;
                $scope.selectDataset($scope.selectedVersions[name].id, true);
            };

            $scope.selectPackageType = function (packageType) {
                $scope.packageType = packageType;
            };

            $scope.filterDatasets = function (item) {
                if (!$scope.searchText) {
                    return true;
                }
                var props = [ 'name', 'description' ];
                return props.some(function (prop) {
                    if (item[prop] && item[prop].toLowerCase().indexOf($scope.searchText.toLowerCase()) !== -1) {
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

            $scope.filterDatasetsByVisibility = function (item) {
                if ($scope.features.imageUse !== 'disabled') {
                    if ((item.public && $scope.instanceType === 'Saved') ||
                            (!item.public && $scope.instanceType === 'Public')) {
                        return false;
                    }
                }
                return true;
            };

            $scope.selectInstanceType = function (type) {
                $scope.instanceType = type;
                if (type === 'Public') {
                    $location.path('/compute/create');
                } else if (type === 'Saved') {
                    $location.path('/compute/create/custom');
                }
            };

            $scope.selectPackage = function (id) {
                $scope.data.name = null;
                Package.package({ id: id, datacenter: $scope.data.datacenter }).then(function (pkg) {
                    $scope.showFinishConfiguration = true;
                    $scope.selectedPackage = id;
                    $scope.selectedPackageInfo = pkg;

                    $scope.data.package = pkg.id;
                    ng.element('#network-configuration').fadeIn('fast');
                    if ($scope.features.instanceMetadata === 'enabled') {
                        ng.element('#metadata-configuration').fadeIn('fast');
                    }
                });
            };

            $scope.filterPackages = function (packageType) {
                return function (item) {
                    if ($scope.datasetType !== item.type) {
                        return false;
                    }

                    if (item.freeTierHidden) {
                        return false;
                    }

                    if (packageType && packageType !== item.group) {
                        return false;
                    }

                    return true;
                };
            };

            $scope.filterPackageTypes = function (datasetType) {
                return function (packageType) {
                    return $scope.indexPackageTypes[packageType].indexOf(datasetType) > -1 && $scope.packages.filter($scope.filterPackagesByProp).some($scope.filterPackages(packageType));
                };
            };

            $scope.filterPackagesByProp = function (obj) {
                if (!$scope.filterProperty || !$scope.filterPropertyValue) {
                    return obj;
                }
                return String(obj[$scope.filterProperty]) === String($scope.filterPropertyValue);
            };

            $scope.formatFilterValue = function (value) {
                if ($scope.filterProperty === 'vcpus') {
                    return value + ' vCPUs';
                }
                return $filter('sizeFormat')(value);
            };

            function selectMinimalPackage(packageType) {
                var minimalPkg;
                $scope.packages.filter($scope.filterPackagesByProp).filter($scope.filterPackages(packageType)).forEach(function (pkg) {
                    if (!minimalPkg || minimalPkg.memory > pkg.memory) {
                        minimalPkg = pkg;
                    }
                });
                if (minimalPkg) {
                    $scope.selectPackage(minimalPkg.id);
                }
            }

            $scope.onFilterChange = function (newVal) {
                if (newVal) {
                    $scope.filterPropertyValue = $scope.filterValues[newVal][0];
                }
                selectMinimalPackage();
                setTimeout(function () {
                    ng.element('.accordion-group').has('div.active').find('a.collapsed').click();
                }, 200);
            };
            $scope.changeSelectedPackage = function (event, packageType) {
                if (!event.target.classList.contains('collapsed')) {
                    return;
                }
                selectMinimalPackage(packageType);
            };
            // Watch datacenter change
            $scope.$watch('data.datacenter', function (newVal) {
                if (newVal) {
                    $scope.reloading = true;
                    $scope.datasetsLoading = true;
                    $scope.networks = [];
                    var count = 2;

                    Dataset.dataset({ datacenter: newVal }).then(function (datasets) {
                        var unique_datasets = [];
                        var dataset_names = [];
                        var versions = {};
                        var selectedVersions = {};
                        var manyVersions = {};
                        var operating_systems = {'All': 1};

                        $scope.datasetsLoading = false;
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

                        if ($scope.preSelectedImage) {
                            $scope.selectedVersions[$scope.preSelectedImage.name] = $scope.preSelectedImage;
                        }
                    });

                    Network.network(newVal).then(function (networks) {
                        if (newVal === $scope.data.datacenter) {
                            $scope.networks = networks;
                            $scope.selectedNetworks.length = 0;
                            $scope.networks.forEach(function (network) {
                                $scope.selectNetworkCheckbox(network.id);
                            });
                        }
                    });

                    Package.package({ datacenter: newVal }).then(function (packages) {
                        if (newVal !== $scope.data.datacenter) {
                            return;
                        }

                        var indexPackageTypes = {};
                        var packageTypes = [];
                        packages.forEach(function (p) {
                            if (p.group && p.price) {
                                var indexPackageType = indexPackageTypes[p.group];
                                if (!indexPackageType) {
                                    indexPackageTypes[p.group] = [p.type];
                                    packageTypes.push(p.group);
                                } else if (!indexPackageType[p.type]) {
                                    indexPackageTypes[p.group].push(p.type);
                                }
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
                        $scope.indexPackageTypes = indexPackageTypes;
                        $scope.packageTypes = packageTypes;
                        $scope.packages = packages;
                        $scope.reloading = (--count > 0);

                        if ($scope.preSelectedImageId) {
                            $scope.selectDataset($scope.preSelectedImageId);
                        }
                    });

                }
            });

            function setDatacenter () {
                if ($rootScope.commonConfig('datacenter')) {
                    $scope.data.datacenter = $rootScope.commonConfig('datacenter');
                } else {
                    $scope.selectDatacenter();
                }
            }

            if ($scope.preSelectedImageId) {
                $scope.preSelectedImage = Image.image($scope.preSelectedImageId);
                $q.when($scope.preSelectedImage).then(function (image) {
                    if (image && image.datacenter) {
                        $scope.selectDatacenter(image.datacenter);
                    } else {
                        $location.url('/compute/create');
                        $location.replace();
                        setDatacenter();
                    }
                });
            } else {
                setDatacenter();
            }
            var provisionBundle = $rootScope.popCommonConfig('provisionBundle');
            if (provisionBundle) {
                if (provisionBundle.manualCreate) {
                    $scope.data = provisionBundle.machine;
                    $scope.indexPackageTypes = provisionBundle.indexPackageTypes;
                    $scope.packageTypes = provisionBundle.packageTypes;
                    $scope.packages = provisionBundle.packages;
                    $scope.metadata = provisionBundle.metadata;
                    $scope.tags = provisionBundle.tags;

                    $scope.datacenters = provisionBundle.datacenters;
                    $scope.selectedDataset = provisionBundle.selectedDataset;
                    $scope.datasetType = provisionBundle.datasetType;

                    $scope.selectedPackage = $scope.data.package;
                    $scope.selectedNetworks = $scope.data.networks;

                    $scope.showFinishConfiguration = true;
                    $scope.selectedPackageInfo = provisionBundle.selectedPackageInfo;

                    $scope.instanceType = 'Public';
                    $scope.filterProperty = provisionBundle.filterProperty;
                    $scope.filterProps = provisionBundle.filterProps;
                    $scope.filterValues = provisionBundle.filterValues;
                    $scope.filterPropertyValue = provisionBundle.filterPropertyValue;
                    $scope.reconfigure(2);
                    if (provisionBundle.allowCreate) {
                        provision();
                    }
                } else {
                    if (provisionBundle.allowCreate) {
                        provision(provisionBundle.machine);
                    }
                }
            } else {
                if (!$scope.data.opsys) {
                    $scope.data.opsys = 'All';
                }
            }

            ng.element('#provisionCarousel').carousel({
                interval: false
            });

            ng.element('#provisionCarousel').bind({
                slide: function () {
                    $scope.reConfigurable = !$scope.reConfigurable;
                    if ($scope.reConfigurable) {
                        $timeout(function () {
                            $scope.showReConfigure = true;
                        }, 600);
                    }
                }
            });


            $scope.slideCarousel = function () {
                $scope.previousPos = ng.element('.carousel-inner').scrollTop();
                ng.element('.carousel-inner').scrollTop(0);
                ng.element('.carousel').carousel('next');
            };

            $scope.reviewPage = function () {
                var props = ng.copy($rootScope.zenboxParams);

                if ($scope.selectedPackageInfo.createdBySupport) {
                    var el = $scope.selectedPackageInfo;
                    props.dropboxID = props.dropboxOrderPackageId || props.dropboxID;
                    props.request_subject = 'I want to order ' + el.description + ' compute instance';
                    props.request_description = 'API Name: ' + el.name;
                    props.requester_name = $scope.account.firstName;
                    props.requester_email = $scope.account.email;
                    loggingService.log('info', 'User is ordering instance package from support', el);
                    Zenbox.show(null, props);
                } else {
                    $scope.slideCarousel();
                    $scope.setCurrentStep(2);
                }
            };

            $scope.clickBackToQuickStart = function () {
                $location.path('/compute/create/simple');
            };
        }

    ]);
}(window.JP.getModule('Machine'), window.angular));
