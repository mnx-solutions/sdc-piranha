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
        'util',

        function ($scope, $filter, requestContext, $timeout, Machine, Dataset, Datacenter, Package, Account, Network, Image, $location, localization, $q, $$track, PopupDialog, $cookies, $rootScope, FreeTier, $compile, loggingService, util) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.provision', $scope, {
                title: localization.translate(null, 'machine', 'Create Instances on Joyent')
            });

            $scope.provisionSteps = [
                {
                    name:'Choose Image',
                    template:'machine/static/partials/wizard-choose-image.html'
                },
                {
                    name:'Select Package',
                    template:'machine/static/partials/wizard-select-package.html'
                },
                {
                    name:'Review',
                    template:'machine/static/partials/wizard-review.html'
                }
            ];
            $scope.provisionStep = true;
            $scope.campaignId = ($cookies.campaignId || 'default');

            $scope.preSelectedImageId = requestContext.getParam('imageid');
            $scope.preSelectedImage = null;

            $scope.instanceType = $scope.preSelectedImageId || $location.path().indexOf('/custom') > -1 ? 'Saved' : 'Public';

            $scope.instanceMetadataEnabled = $scope.features.instanceMetadata === 'enabled';
            $scope.metadataArray = [
                {key: '', val: '', edit: true, conflict: false}
            ];
            $scope.key = {};
            Account.getAccount(true).then(function (account) {
                $scope.account = account;
                if (!account.provisionEnabled) {
                    $scope.provisionSteps.push(
                            {
                                name:'Account Information',
                                template:'machine/static/partials/wizard-account-info.html'
                            }
                    );
                }
            });
            $scope.keys = [];
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
            var osByDatasets = {};

            $scope.filterValues = {
                'No filter': [],
                'vcpus': [],
                'memory': [],
                'disk': []
            };

            $scope.isMantaEnabled = $scope.features.manta === 'enabled';
            $scope.isRecentInstancesEnabled = $scope.features.recentInstances === 'enabled';

            $scope.filterProps = Object.keys($scope.filterValues);

            $scope.freeTierOptions = [];
            if ($scope.features.freetier === 'enabled') {
                $scope.freeTierOptions = FreeTier.freetier();
            }
            var provisionBundle = $rootScope.popCommonConfig('provisionBundle');
            if (provisionBundle) {
                $rootScope.commonConfig('datacenter', provisionBundle.machine.datacenter);
            }
            function getCreatedMachines() {
                var deferred = $q.defer();
                if ($scope.isMantaEnabled && $scope.isRecentInstancesEnabled) {
                    var createdMachines = Account.getUserConfig().$child('createdMachines');
                    createdMachines.$load(function (error, config) {
                        var recentInstances = config.createdMachines || [];
                        if (recentInstances.length > 0) {
                            recentInstances.sort(function (a, b) {
                                // if provisionTimes are equal take the newer one
                                return b.provisionTimes - a.provisionTimes || b.creationDate - a.creationDate;
                            });
                        }
                        deferred.resolve(recentInstances);
                    });
                } else {
                    deferred.resolve([]);
                }
                return deferred.promise;
            }

            var recentInstances = getCreatedMachines();

            $q.all([
                $q.when(Account.getKeys()),
                $q.when(Datacenter.datacenter()),
                $q.when($scope.preSelectedImage),
                $q.when(Machine.getSimpleImgList()),
                $q.when($scope.freeTierOptions),
                $q.when(recentInstances)
            ]).then(function (result) {
                $scope.keys = result[0];
                if ($scope.keys.length <= 0) {
                    $scope.provisionSteps.push(
                            {
                                name:'SSH Key',
                                template:'machine/static/partials/wizard-ssh-key.html'
                            }
                    );
                }
                $scope.submitTitle = $scope.keys.length > 0 ? 'Create Instance' : 'Next';
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
                                    Dataset.datasetByName({ datacenter: datacenter.name, name: simpleImage.datasetName }).then(function (dataset) {
                                        if (dataset) {
                                            simpleImage.imageData = {};
                                            simpleImage.imageData.dataset = dataset;
                                            simpleImage.imageData.datacenter = datacenter.name;
                                            simpleImage.imageData.name = '';
                                            simpleImage.imageData.package = packagesByName[simpleImage.packageName];
                                            simpleImage.imageData.networks = networks;
                                            delete simpleImage.packageName;
                                            delete simpleImage.datasetName;
                                            if (simpleImage.imageData.package) {
                                                $scope.simpleImages.push(simpleImage);
                                            }
                                        }
                                    });
                                });
                            });
                        });
                    }
                }
                if ($scope.features.freetier === 'enabled') {
                    var freeImages = result[4];
                    if (freeImages.valid) {
                        freeImages.forEach(function (freeImage) {
                            freeImage.datacenters.forEach(function (datacenter) {
                                var simpleImage = ng.copy({imageData: freeImage});
                                Dataset.datasetByName({ datacenter: datacenter, name: simpleImage.imageData.datasetName }).then(function (dataset) {
                                    if (dataset) {
                                        simpleImage.imageData.datacenter = datacenter;
                                        simpleImage.name = freeImage.name;
                                        simpleImage.imageData.dataset = dataset;
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
                                        delete simpleImage.imageData.datasetName;
                                        $scope.simpleImages.push(simpleImage);
                                    }
                                });
                            });
                        });
                    }
                }
                if ($scope.isMantaEnabled && !$scope.data.datacenter) {
                    //TODO: Handle all other DC drop-downs
                    $scope.userConfig = Account.getUserConfig().$child('datacenter');
                    $scope.userConfig.$load(function (error, config) {
                        if (config.value && !$scope.data.datacenter && !$scope.preSelectedImage) {
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
                $scope.loading = provisionBundle && provisionBundle.manualCreate === false && provisionBundle.allowCreate === true;
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

            $scope.$on('creditCardUpdate', function (event, cc) {
                $scope.account.provisionEnabled = true;
                if ($scope.keys.length > 0) {
                    $scope.clickProvision();
                } else {
                    $scope.setCurrentStep(4);
                    $scope.slideCarousel();
                    $timeout(function () {
                        $scope.provisionSteps = $scope.provisionSteps.filter(function (item) {
                            return item.name != 'Account Information';
                        });
                        $scope.setCurrentStep(3);
                    }, 600);
                }

            });

            $scope.$on('ssh-form:onKeyUpdated', function (event, keys) {
                $scope.keys = keys;
            });

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
                    var machineData = machine || $scope.data;
                    if ($scope.keys.length === 0 && osByDatasets[machineData.dataset] !== 'windows') {
                        $rootScope.commonConfig('provisionBundle', {
                            manualCreate: false,
                            allowCreate: false,
                            machine: machineData
                        });
                        $location.path('/compute/ssh');
                    } else {
                        Machine.provisionMachine(machineData).done(function (err, job) {
                            var newMachine = job.__read();
                            if ($scope.features.freetier === 'enabled') {
                                // TODO It seems like an extra call because we already have $scope.freetierOptions. Need to get rid of extra calls
                                $scope.freetier = FreeTier.freetier();
                            }
                            $q.when(Machine.machine(), function (listMachines) {
                                if (newMachine.id && listMachines.length === 1) {
                                    $$track.marketo_machine_provision($scope.account);
                                } else if (err && listMachines.length === 0) {
                                    $location.path('/compute/create/simple');
                                }
                            });

                            if (!err && $scope.isMantaEnabled && $scope.isRecentInstancesEnabled) {
                                $q.when($scope.freeTierOptions).then(function () {
                                    if (!machineData.freetier) {
                                        $scope.createdMachines = Account.getUserConfig().$child('createdMachines');
                                        $scope.createdMachines.$load(function (error, config) {
                                            config.createdMachines = config.createdMachines || [];
                                            var creationDate = new Date(newMachine.created).getTime();
                                            var listedMachine = config.createdMachines.find(function (machine) {
                                                return machine.dataset === machineData.dataset &&
                                                        machine.package === machineData.package;
                                            });

                                            if (listedMachine) {
                                                listedMachine.provisionTimes += 1;
                                                listedMachine.creationDate = creationDate;
                                            } else {
                                                var createdMachine = {
                                                    dataset: machineData.dataset,
                                                    package: machineData.package,
                                                    provisionTimes: 1,
                                                    creationDate: creationDate
                                                };
                                                config.createdMachines.push(createdMachine);
                                            }

                                            config.dirty(true);
                                            config.$save();
                                        });
                                    }
                                });
                            }
                        });

                        $location.path('/compute');
                    }
                };
                var submitBillingInfo = {btnTitle: 'Next'};
                if ($scope.keys.length > 0) {
                    submitBillingInfo.btnTitle = 'Submit and Create Instance';
                    submitBillingInfo.appendPopupMessage = 'Provisioning will now commence.'
                }
                Account.checkProvisioning(submitBillingInfo, function () {
                    $scope.account.provisionEnabled = true;
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
                            finalProvision,
                            function () {
                                var stepsSize = $scope.provisionSteps.length;
                                $scope.provisionSteps = $scope.provisionSteps.filter(function (item) {
                                    return item.name != 'Account Information';
                                });
                                if (stepsSize !== $scope.provisionSteps.length) {
                                    $scope.reconfigure($scope.currentSlidePageIndex - 1);
                                    $scope.createInstanceTitle = null;
                                }
                            }
                    );
                }, function () {
                    if (!machine) {
                        $rootScope.commonConfig('provisionBundle', {
                            datacenters: $scope.datacenters,
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

            var nextStep = function (step) {
                $scope.setCurrentStep(step);
                $scope.slideCarousel();
            };

            $scope.clickProvision = function () {
                // add networks to data
                $scope.data.networks = ($scope.selectedNetworks.length > 0) ? $scope.selectedNetworks : '';
                $scope.data.metadata = this.metadata || {};
                $scope.data.tags = this.tags || {};

                if (!$scope.data.datacenter) {
                    Datacenter.datacenter().then(function (datacenters) {
                        var keys = Object.keys(datacenters);
                        if (keys.length > 0) {
                            $scope.data.datacenter = keys[0];
                            if (!$scope.account.provisionEnabled || $scope.keys.length <= 0) {
                                nextStep(3);
                                return;
                            }
                            provision();
                        } else {
                            // TODO: Throw an error
                        }
                    });
                } else {
                    if (!$scope.account.provisionEnabled || $scope.keys.length <= 0) {
                        nextStep(3);
                        return;
                    }
                    provision();
                }

            };

            $scope.createSimple = function (data) {
                provision(data);
            };

            $scope.createRecent = function (data) {
                data.name = '';
                data.datacenter = $scope.data.datacenter;
                data.networks = $scope.networks.map(function (network) {
                    return network.id;
                });
                provision(data);
            };

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
                    var provisionForm = $scope.this.provisionForm;
                    if (provisionForm) {
                        provisionForm.machineName.$setValidity('machineName', true);
                        provisionForm.machineName.$setValidity('machineUnique', true);
                    }
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
                if ($scope.keys.length > 0) {
                    $scope.provisionSteps = $scope.provisionSteps.filter(function (item) {
                        return item.name != 'SSH Key';
                    });
                }
                if ($scope.currentSlidePageIndex === $scope.provisionSteps.length - 1) {
                    $scope.createInstanceTitle = null;
                }
            };

            function getNr(el) {
                if (!el || !(el === el)) {
                    return false;
                }

                return +((el + '').replace(/,/g, ''));
            }

            $scope.setCurrentStep = function (index) {
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
                if (!$scope.account.provisionEnabled || $scope.keys.length <= 0) {
                    $scope.createInstanceTitle = 'Next';
                }
            };

            $scope.filterPackages = function (packageType, isPackageTypeCollapsed) {
                return function (item) {
                    //TODO: improve to have one exit point
                    if ($scope.datasetType !== item.type || item.freeTierHidden
                        || isPackageTypeCollapsed && packageType === item.group) {
                        return false;
                    }
                    else if (packageType && packageType !== item.group) {
                        return isPackageTypeCollapsed && $scope.collapsedPackageTypes.indexOf(item.group) === -1;
                    }

                    if ($scope.selectedDataset && $scope.selectedDataset.requirements) {
                        var memory = item.memory && parseInt(item.memory, 10);
                        if (memory) {
                            var requirements = $scope.selectedDataset.requirements;
                            if (requirements.min_memory && memory < parseInt(requirements.min_memory, 10)) {
                                return false;
                            }
                            if (requirements.max_memory && memory > parseInt(requirements.max_memory, 10)) {
                                return false;
                            }
                        }
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

            function selectMinimalPackage(packageType, isPackageCollapsed) {
                var minimalPackage;
                $scope.packages
                    .filter($scope.filterPackagesByProp)
                    .filter($scope.filterPackages(packageType, isPackageCollapsed))
                    .forEach(function (pkg) {
                        if (!minimalPackage || minimalPackage.memory > pkg.memory || (minimalPackage.memory === pkg.memory && pkg.group === "Standard")) {
                            minimalPackage = pkg;
                        }
                    });
                if (minimalPackage) {
                    $scope.selectPackage(minimalPackage.id);
                }
            }

            $scope.onFilterChange = function (newVal) {
                if (newVal) {
                    $scope.filterPropertyValue = $scope.filterValues[newVal][0];
                }
                selectMinimalPackage();
       
                setTimeout(function () {
                    var accordionGroup = ng.element('.accordion-group');
                    if ($scope.filterProperty === 'No filter') {
                        accordionGroup.not('div.active').find('.collapse').removeClass('in').css('height', 0).end()
                            .find('.accordion-toggle').addClass('collapsed').end()
                            .has('div.active').find('a.collapsed').click();
                    } else {
                        $scope.collapsedPackageTypes = [];
                        accordionGroup.find('a.collapsed').removeClass('collapsed').end()
                            .find('.collapse').addClass('in');
                    }
                }, 200);
            };
            $scope.changeSelectedPackage = function (event, packageType) {
                if (!event.target.classList.contains('collapsed')) {
                    if ($scope.filterProperty !== 'No filter') {
                        $scope.collapsedPackageTypes.push(packageType);
                        selectMinimalPackage(packageType, true);
                    }
                    return;
                }
                if ($scope.filterProperty === 'No filter') {
                    selectMinimalPackage(packageType);
                } else {
                    $scope.collapsedPackageTypes.splice($scope.collapsedPackageTypes.indexOf(packageType), 1);
                    selectMinimalPackage(true, true);
                }
            };

            function processDatasets(datasets) {
                var unique_datasets = [];
                var customDatasets = [];
                var dataset_names = [];
                var versions = {};
                var selectedVersions = {};
                var manyVersions = {};
                var operating_systems = {'All': 1};

                $scope.datasetsLoading = false;
                datasets.forEach(function (dataset) {
                    operating_systems[dataset.os] = 1;
                    osByDatasets[dataset.id] = dataset.os;

                    var datasetName = dataset.name;
                    var datasetVersion = dataset.version;

                    if (!dataset_names[datasetName] && dataset.public) {
                        dataset_names[datasetName] = true;
                        unique_datasets.push(dataset);
                    }

                    if (!dataset.public) {
                        customDatasets.push(dataset);
                    }

                    if (!versions[datasetName]) {
                        versions[datasetName] = {};
                        versions[datasetName][datasetVersion] = dataset;
                        selectedVersions[datasetName] = dataset;
                    } else {
                        if (!versions[datasetName][datasetVersion]) {
                            manyVersions[datasetName] = true;
                            versions[datasetName][datasetVersion] = dataset;
                        }

                        if (isVersionHigher(datasetVersion, selectedVersions[datasetName].version)) {
                            selectedVersions[datasetName] = dataset;
                        }
                    }
                });
                $scope.operating_systems = Object.keys(operating_systems);
                $scope.datasets = unique_datasets.concat(customDatasets);
                $scope.versions = versions;
                $scope.manyVersions = manyVersions;
                $scope.selectedVersions = selectedVersions;

                if ($scope.preSelectedImage) {
                    $scope.selectedVersions[$scope.preSelectedImage.name] = $scope.preSelectedImage;
                }
            }

            function processPackages(newDatacenter, packages) {
                if (newDatacenter !== $scope.data.datacenter) {
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

                if ($scope.preSelectedImageId) {
                    $scope.selectDataset($scope.preSelectedImageId);
                }
            }

            function processRecentInstances(recentInstances, datasets) {
                if (recentInstances.length > 0) {
                    datasets.forEach(function (dataset) {
                        recentInstances = recentInstances.map(function (instance) {
                            if (instance && instance.dataset === dataset.id) {
                                instance.datasetName = dataset.name;
                                instance.description = dataset.description;
                            }
                            return instance;
                        });
                    });

                    $scope.packages.forEach(function (pack) {
                        recentInstances = recentInstances.map(function (instance) {
                            if (instance && instance.package === pack.id) {
                                instance.memory = pack.memory;
                                instance.disk = pack.disk;
                                instance.vcpus = pack.vcpus;
                                instance.price = pack.price;
                            }
                            return instance;
                        });
                    });
                }

                var uniqueRecentInstances = [];
                var unique = {};

                recentInstances.forEach(function (instance) {
                    if ($scope.manyVersions[instance.datasetName]) {
                        var datasetId = null;
                        var datasetDescription = '';
                        var publishedAt = 0;
                        var latestVersion = 0;
                        var versions = $scope.versions[instance.datasetName];

                        for (var version in versions) {
                            if (versions[version].public) {
                                var currentVersion = versions[version].version;
                                if (util.cmpVersion(latestVersion, currentVersion) < 0) {
                                    latestVersion = currentVersion;
                                    datasetId = versions[version].id;
                                    datasetDescription = versions[version].description;
                                }
                            } else {
                                var convertedDate = new Date(versions[version].published_at).getTime();
                                if (convertedDate > publishedAt) {
                                    publishedAt = convertedDate;
                                    datasetId = versions[version].id;
                                    datasetDescription = versions[version].description;
                                }
                            }
                        }
                        instance.dataset = datasetId;
                        instance.description = datasetDescription;
                    }
                    if (!unique[instance.dataset] || unique[instance.dataset].package !== instance.package) {
                        uniqueRecentInstances.push(instance);
                        unique[instance.dataset] = instance;
                    }
                });

                $scope.recentInstances = uniqueRecentInstances.filter(function (instance) {
                    return instance.memory !== undefined;
                });
            }

            // Watch datacenter change
            $scope.$watch('data.datacenter', function (newVal) {
                if (newVal) {
                    $scope.reloading = true;
                    $scope.datasetsLoading = true;
                    $scope.networks = [];

                    Network.network(newVal).then(function (networks) {
                        if (newVal === $scope.data.datacenter) {
                            $scope.networks = networks;
                            $scope.selectedNetworks.length = 0;
                            $scope.networks.forEach(function (network) {
                                $scope.selectNetworkCheckbox(network.id);
                            });
                        }
                    });

                    $q.all([
                        $q.when(Dataset.dataset({ datacenter: newVal })),
                        $q.when(Package.package({ datacenter: newVal })),
                        $q.when(getCreatedMachines())
                    ]).then(function (result) {
                        $scope.reloading = false;
                        var datasets = result[0];
                        processDatasets(datasets);
                        processPackages(newVal, result[1]);
                        if ($scope.isRecentInstancesEnabled) {
                            processRecentInstances(result[2], datasets);
                        }
                    });
                }
            });

            function setDatacenter() {
                if ($rootScope.commonConfig('datacenter')) {
                    $scope.data.datacenter = $rootScope.commonConfig('datacenter');
                } else {
                    $scope.selectDatacenter();
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
