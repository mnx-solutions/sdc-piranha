'use strict';

(function (app, ng) {
    app.controller('Machine.ProvisionController', ['$scope',
        '$filter',
        'requestContext',
        '$timeout',
        'Provision',
        'Machine',
        'Datacenter',
        'Package',
        'Account',
        'Image',
        '$location',
        'localization',
        '$q',
        '$qe',
        'PopupDialog',
        '$rootScope',
        'loggingService',
        'util',
        'errorContext',
        function ($scope, $filter, requestContext, $timeout, Provision, Machine, Datacenter, Package, Account, Image,
            $location, localization, $q, $qe, PopupDialog, $rootScope, loggingService, util, errorContext) {

            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.provision', $scope, {
                title: localization.translate(null, 'machine', 'Create Instances on Joyent')
            });
            if ($rootScope.features && $rootScope.features.manta === 'enabled') {
                Account.getUserConfig().$child('createInstancePage').$load(function (error, config) {
                    Machine.initCreateInstancePageConfig(config);
                });
            }
            var CHOOSE_IMAGE_STEP = 0;
            var SELECT_PACKAGE_STEP = 1;
            var REVIEW_STEP = 2;
            var WizardSteps = {
                CHOOSE_IMAGE: 'Choose Image',
                SELECT_PACKAGE: 'Select Package',
                REVIEW: 'Review',
                ACCOUNT: 'Account Information',
                SSH: 'SSH Key'
            };

            var BILLING_START_MESSAGE = $scope.features.billing === 'enabled' ?
                'Billing will start once this instance is created' :
                'Instance will be created and started';

            var TITLE_CREATE_INSTANCE = 'Confirm: Create Instance';
            var FilterValues = {
                'No filter': [],
                vcpus: [],
                memory: [],
                disk: []
            };
            var PROVISION_BUNDLE_KEYS = ['datacenters', 'datasetType', 'selectedDataset', 'filterModel', 'filterProps',
                'filterValues', 'selectedPackageInfo', 'packages', 'packageTypes', 'indexPackageTypes'];

            var preSelectedImageId = requestContext.getParam('imageid') === 'custom' ? null :
                requestContext.getParam('imageid');

            var hostSpecification = preSelectedImageId && $location.search().specification;

            var preSelectedData = $rootScope.popCommonConfig('preSelectedData');
            var datacenterConfig;

            var PROVISION_CREATING_IN_PROGRESS = 'Another machine is being created, please let it become provisioning.';

            $scope.setCreateInstancePage = Machine.setCreateInstancePage;
            $scope.provisionSteps = [
                {
                    name: WizardSteps.CHOOSE_IMAGE,
                    template: 'machine/static/partials/wizard-choose-image.html',
                    hide: hostSpecification
                },
                {
                    name: WizardSteps.SELECT_PACKAGE,
                    template: 'machine/static/partials/wizard-select-package.html'
                },
                {
                    name: WizardSteps.REVIEW,
                    template: 'machine/static/partials/wizard-review.html'
                }
            ];

            $scope.filterModel = {};
            $scope.sshModel = {isSSHStep: false};
            $scope.instanceType = (preSelectedImageId || $location.path().indexOf('/custom') > -1) ?
                'Saved' : 'Public';

            if (preSelectedData && preSelectedData.preSelectedImageId) {
                preSelectedImageId = preSelectedData.preSelectedImageId;
            }

            $scope.instanceMetadataEnabled = $scope.features.instanceMetadata === 'enabled';

            $scope.keys = [];
            $scope.datacenters = [];
            $scope.networks = [];
            $scope.packages = [];
            $scope.packageTypes = [];
            $scope.packageType = null;
            $scope.loading = true;

            $scope.currentPageIndex = 0;
            $scope.currentStep = '';
            $scope.datasetsLoading = false;
            $scope.filterValues = ng.copy(FilterValues);

            $scope.isMantaEnabled = $scope.features.manta === 'enabled';
            $scope.isRecentInstancesEnabled = $scope.features.recentInstances === 'enabled';

            $scope.filterProps = Object.keys($scope.filterValues);

            $scope.data = {
                tags: {},
                metadata: {}
            };

            $scope.selectedDataset = null;
            $scope.selectedPackage = null;
            var selectedNetworks = [];
            var indexPackageTypes = {};
            var freeTierOptions = [];

            var externalInstanceParams = requestContext.getParam('dc') && requestContext.getParam('package');
            var provisionBundle = $rootScope.popCommonConfig('provisionBundle');
            if (provisionBundle) {
                $rootScope.commonConfig('datacenter', provisionBundle.machine.datacenter);
            }

            $scope.filterSimpleImagesByDatacenter = function (image) {
                return image.imageData.datacenter === $scope.data.datacenter;
            };

            var deleteProvisionStep = function (stepName) {
                $scope.provisionSteps = $scope.provisionSteps.filter(function (item) {
                    return item.name !== stepName;
                });
            };

            $scope.getCreateTitle = function () {
                return $scope.currentPageIndex === $scope.provisionSteps.length - 1 ? 'Create Instance' : 'Next';
            };
            // TODO: need get better structure for storing steps
            var addProvisionStep = function (name, template) {
                var isExists = $scope.provisionSteps.some(function (item) {
                    return item.name === name;
                });

                if (!isExists) {
                    $scope.provisionSteps.push({name: name, template: template});
                }
            };

            var setDatacenter = function () {
                if ($rootScope.commonConfig('datacenter')) {
                    $scope.data.datacenter = $rootScope.commonConfig('datacenter');
                } else {
                    $scope.selectDatacenter();
                }
            };

            $scope.provisioningInProgress = false;

            var provision = function (machine) {
                var submitBillingInfo = {btnTitle: 'Next'};
                if ($scope.keys.length > 0) {
                    submitBillingInfo.btnTitle = 'Submit and Create Instance';
                    submitBillingInfo.appendPopupMessage = 'Provisioning will now commence.';
                }
                if (machine && machine.freetier) {
                    submitBillingInfo.beforeBillingMessage = ' Note: Free Dev Tier customers will not be billed until' +
                        'the promotional term expires as this is merely a validation step.';
                }
                if ($scope.provisioningInProgress) {
                    return;
                }
                $scope.provisioningInProgress = submitBillingInfo.noPopupCallback = true;
                Account.checkProvisioning(submitBillingInfo, function () {
                    $scope.account.provisionEnabled = true;
                    var finalProvision = function (data) {
                        $scope.provisioningInProgress = true;
                        // we can return this back when make ssh not required for windows
                        if ($scope.keys.length === 0) {
                            $rootScope.commonConfig('provisionBundle', {
                                simpleImage: false,
                                ready: false,
                                machine: machine
                            });
                            return $location.path('/compute/ssh');
                        }
                        Provision.finalProvision(data, $scope.datacenters, $scope.account, hostSpecification, function () {
                            $scope.provisioningInProgress = false;
                        });
                    };
                    if (machine) {
                        Provision.filterNetworks($scope.data.datacenter, machine.networks || [], function (filteredNetworks) {
                            machine.networks = filteredNetworks.length > 0 ? filteredNetworks : '';
                            finalProvision(machine);
                        });
                        return;
                    }

                    var dataset = $scope.selectedDataset;
                    var description = dataset && dataset.description;
                    var popupContent = BILLING_START_MESSAGE;
                    if (dataset && dataset.eula || description && description.indexOf('Stingray') > -1 ||
                        description && description.indexOf('SteelApp') > -1) {
                        TITLE_CREATE_INSTANCE = 'Accept End-User License Agreement';
                        popupContent = {
                            templatePath: dataset.eula || 'slb/static/templates/eula.html',
                            footer: BILLING_START_MESSAGE
                        };
                    }
                    $scope.provisioningInProgress = false;
                    PopupDialog.confirm(
                        TITLE_CREATE_INSTANCE,
                        popupContent,
                        function () {
                            finalProvision($scope.data);
                        },
                        function () {
                            var stepsCount = $scope.provisionSteps.length;
                            deleteProvisionStep(WizardSteps.ACCOUNT);
                            $scope.provisioningInProgress = false;
                            if (stepsCount !== $scope.provisionSteps.length) {
                                $scope.reconfigure($scope.currentPageIndex - 1);
                            }
                        }
                    );
                }, function () {
                    var data = {simpleImage: false, ready: false};
                    if (!machine) {
                        PROVISION_BUNDLE_KEYS.forEach(function (key) {
                            data[key] = $scope[key];
                        });
                        data.machine = $scope.data;
                    } else {
                        data.simpleImage = true;
                        data.machine = machine;
                    }
                    $rootScope.commonConfig('provisionBundle', data);
                });
            };

            var tasks = [
                $q.when(Account.getKeys()),
                $q.when(Datacenter.datacenter()),
                $q.when(Account.getAccount(true))
            ];
            $qe.every(tasks).then(function (result) {
                var keysResult = result[0];
                var datacentersResult = result[1];
                $scope.account = result[2];
                $scope.simpleImages = [];
                $scope.datacenters = [];

                if (!datacentersResult.error && ($scope.account.error || keysResult.error)) {
                    $scope.loading = false;
                    return PopupDialog.errorObj(keysResult.error ? keysResult.error :
                        {error: 'SDC call timed out. Please refresh the page.'});
                }

                $scope.keys = !keysResult.error ? keysResult : [];
                if (!$scope.account.provisionEnabled) {
                    addProvisionStep(WizardSteps.ACCOUNT, 'machine/static/partials/wizard-account-info.html');
                }
                if ($scope.keys.length <= 0) {
                    addProvisionStep(WizardSteps.SSH, 'machine/static/partials/wizard-ssh-key.html');
                }

                function completeSetup() {
                    if ($scope.isMantaEnabled && !$scope.data.datacenter) {
                        // TODO: Handle all other DC drop-downs
                        $scope.userConfig = Account.getUserConfig().$child('datacenter');
                        $scope.userConfig.$load(function (error, config) {
                            if (config.value && !$scope.data.datacenter && !preSelectedImageId) {
                                $scope.selectDatacenter(config.value);
                            }
                            datacenterConfig = config;
                        });
                    }
                    if (externalInstanceParams) {
                        $scope.selectDatacenter(requestContext.getParam('dc'));
                    } else if (preSelectedImageId) {
                        Image.image({
                            id: preSelectedImageId, datacenter: $rootScope.commonConfig('datacenter')
                        }).then(function (image) {
                            var datacenter = image && image.datacenter;
                            if (datacenter) {
                                $scope.selectDatacenter(datacenter);
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
                        if (!provisionBundle.simpleImage) {
                            PROVISION_BUNDLE_KEYS.forEach(function (key) {
                                $scope[key] = provisionBundle[key];
                            });
                            $scope.data = provisionBundle.machine;
                            $scope.selectedPackage = $scope.data.package;
                            selectedNetworks = $scope.data.networks;

                            $scope.instanceType = 'Public';
                            $scope.reconfigure(REVIEW_STEP);
                            if (provisionBundle.ready) {
                                provision();
                            }
                        } else if (provisionBundle.ready) {
                            provision(provisionBundle.machine);
                        }
                    } else if (!$scope.data.opsys) {
                        $scope.data.opsys = 'All';
                    }
                    $scope.loading = provisionBundle && provisionBundle.simpleImage && provisionBundle.ready;
                }

                if (datacentersResult.error) {
                    PopupDialog.errorObj(datacentersResult.error);
                } else {
                    $scope.datacenters = datacentersResult;
                    Provision.setupSimpleImages($scope.datacenters).then(function (data) {
                        $scope.simpleImages = data.simpleImages;
                        freeTierOptions = data.freeTierOptions || [];
                        completeSetup();
                    }, function (error) {
                        PopupDialog.errorObj(error);
                        completeSetup();
                    });
                }
            }, function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            });

            $scope.$on('creditCardUpdate', function () {
                $scope.account.provisionEnabled = true;
                if ($scope.keys.length > 0) {
                    $scope.clickProvision();
                } else {
                    var sshStepIndex = 4;
                    $scope.sshModel.isSSHStep = nextStep(sshStepIndex);
                    $timeout(function () {
                        deleteProvisionStep(WizardSteps.ACCOUNT);
                        if ($scope.sshModel.isSSHStep) {
                            sshStepIndex = 3;
                            $scope.setCurrentStep(sshStepIndex);
                        }
                    }, 600);
                }

            });

            $scope.$on('ssh-form:onKeyUpdated', function (event, keys) {
                $scope.keys = keys;
                if (keys.length > 0 && $scope.currentStep !== WizardSteps.REVIEW &&
                    $scope.currentStep !== WizardSteps.SSH) {
                    deleteProvisionStep(WizardSteps.SSH);
                } else {
                    addProvisionStep(WizardSteps.SSH, 'machine/static/partials/wizard-ssh-key.html');
                }
            });

            var selectNetwork = function (id, doToggle) {
                if (selectedNetworks.indexOf(id) > -1) {
                    doToggle && selectedNetworks.splice(selectedNetworks.indexOf(id), 1);
                } else {
                    selectedNetworks.push(id);
                }
            };

            $scope.selectNetworkCheckbox = function (id) {
                $scope.networks.forEach(function (el) {
                    if (el.id === id) {
                        el.active = (el.active) ? false : true;
                    }
                });
                selectNetwork(id, true);
            };

            var nextStep = function (step) {
                var isNextStep = step - $scope.currentPageIndex === 1;
                if (isNextStep) {
                    $scope.setCurrentStep(step);
                    $scope.slideCarousel();
                }
                return isNextStep;
            };

            var prepareProvision = function () {
                $scope.sshModel.isSSHStep = $scope.keys.length === 0;
                if (!$scope.account.provisionEnabled || $scope.sshModel.isSSHStep) {
                    return nextStep(3);
                }
                provision();
            };

            $scope.clickProvision = function () {
                // add networks to data
                $scope.data.networks = (selectedNetworks.length > 0) ? selectedNetworks : '';

                var instanceType = '';
                var specification = $location.search().specification;

                if (specification === 'dtracehost') {
                    instanceType = 'DTrace';
                } else if (specification === 'dockerhost') {
                    instanceType = 'Docker';
                }

                if (preSelectedImageId && instanceType) {
                    var isPublicNetworkChecked = $scope.networks.some(function (network) {
                        return network.public && network.active;
                    });
                    if (!isPublicNetworkChecked) {
                        return PopupDialog.message('Message', 'Cannot create ' + instanceType +
                            ' host without Public network. Please select Public network.');
                    }
                }

                if (!$scope.data.datacenter) {
                    Datacenter.datacenter().then(function (datacenters) {
                        var datacenterNames = Object.keys(datacenters || {});
                        if (datacenterNames.length > 0) {
                            $scope.data.datacenter = datacenterNames[0];
                            prepareProvision();
                        } else {
                            loggingService.log('error', 'Unable to retrieve datacenters list.');
                            errorContext.emit(new Error(localization.translate(null,
                                'machine',
                                'Unable to retrieve datacenters list'
                            )));
                        }
                    });
                } else {
                    prepareProvision();
                }
            };

            var provisionWithConfirm = function (data) {
                PopupDialog.confirm(TITLE_CREATE_INSTANCE, BILLING_START_MESSAGE, function () {
                    provision(data);
                });
            };

            $scope.createSimple = function (data) {
                Machine.hasMachineCreatingInProgress(function (result) {
                    if (result.hasCreating) {
                        return PopupDialog.message('Message', PROVISION_CREATING_IN_PROGRESS);
                    } else {
                        if (data.freetier) {
                            return provision(data);
                        }
                        provisionWithConfirm(data);
                    }
                });
            };

            $scope.createRecent = function (data) {
                Machine.hasMachineCreatingInProgress(function (result) {
                    if (result.hasCreating) {
                        return PopupDialog.message('Message', PROVISION_CREATING_IN_PROGRESS);
                    } else {
                        data.name = '';
                        data.datacenter = $scope.data.datacenter;
                        data.networks = $scope.networks.map(function (network) {
                            return network.id;
                        });
                        provisionWithConfirm(data);
                    }
                });
            };

            $scope.selectDatacenter = function (name) {
                Provision.selectDatacenter(name, function (datacenterName) {
                    if (datacenterName) {
                        $scope.data.datacenter = datacenterName;
                        $rootScope.commonConfig('datacenter', datacenterName);
                    }
                });
            };

            $scope.selectOpsys = function (name) {
                if (name !== $scope.data.opsys) {
                    $scope.data.opsys = name;
                }
            };

            $scope.sortPackages = function (pkg) {
                return parseInt(pkg.memory, 10);
            };

            function setNetworks(datacenter) {
                selectedNetworks = [];
                Provision.getNetworks(datacenter).then(function (networks) {
                    networks.forEach(function (network) {
                        if (network.active) {
                            selectNetwork(network.id);
                        }
                    });
                    $scope.networks = networks.filter(function (net) {
                        var pkg = $scope.selectedPackageInfo;
                        return net && (pkg && pkg.name.substr(0, 3) === 't4-' || !net.hasOwnProperty('fabric') ||
                                net.fabric !== true && net.public !== false);
                    });
                });
            }

            $scope.reconfigure = function (step) {
                if (step === CHOOSE_IMAGE_STEP) {
                    ng.element('#filterProperty').val('No filter');
                    preSelectedImageId = null;
                    externalInstanceParams = null;
                    $location.search('specification', null);
                }
                if (step !== REVIEW_STEP) {
                    if ($scope.networks && $scope.networks.length) {
                        setNetworks($scope.data.datacenter);
                    }

                    var provisionForm = $scope.$$childTail.$$childTail && $scope.$$childTail.$$childTail.provisionForm;
                    if (provisionForm) {
                        ['machineName', 'machineUnique'].forEach(function (key) {
                            provisionForm.machineName.$setValidity(key, true);
                        });
                    }
                    var instancePackage = $scope.data.package;

                    $scope.data = {
                        datacenter: $scope.data.datacenter,
                        opsys: $scope.data.opsys,
                        name: null,
                        dataset: $scope.data.dataset,
                        metadata: {},
                        tags: {}
                    };

                    if (step === SELECT_PACKAGE_STEP) {
                        $scope.data.package = instancePackage;
                    } else {
                        $scope.selectedPackage = null;
                        $scope.selectedPackageInfo = null;
                        $scope.packageType = null;
                    }
                }
                if ($scope.keys.length > 0) {
                    ng.element('.carousel').on('slid.bs.carousel', function () {
                        if ($scope.$$phase) {
                            deleteProvisionStep(WizardSteps.SSH);
                        } else {
                            $scope.$apply(function () {deleteProvisionStep(WizardSteps.SSH)});
                        }
                        ng.element('.carousel').off('slid.bs.carousel');
                    });
                }
                $scope.setCurrentStep(step);
                $scope.slideCarousel(step);
                if ($scope.features.instanceMetadata === 'enabled') {
                    ng.element('#metadata-configuration').fadeOut('fast');
                }
                ng.element('#network-configuration').fadeOut('fast');
                preSelectedData = null;
            };

            $scope.setCurrentStep = function (index) {
                $scope.currentPageIndex = index;
                $scope.currentStep = ng.element('.active-step').find('.current-step').eq(0).text();
            };

            $scope.selectLastDatasetVersion = function (dataset) {
                var datasetId = Provision.getLastDatasetId(dataset);
                selectDataset(datasetId);
            };

            var selectDataset = function (id, changeDataset) {
                Image.image({id: id, datacenter: $scope.data.datacenter}).then(function (dataset) {
                    if (dataset.type === 'virtualmachine') {
                        $scope.datasetType = 'kvm';
                    } else if (dataset.type === 'smartmachine') {
                        $scope.datasetType = 'smartos';
                    } else {
                        $scope.datasetType = dataset.type;
                    }

                    ng.element('#next').trigger('click');
                    ng.element('#step-configuration').fadeIn('fast');
                    ng.element('#pricing').removeClass('alert-muted');
                    ng.element('#pricing').addClass('alert-info');

                    $scope.data.dataset = dataset.id;
                    $scope.selectedDataset = dataset;
                    $scope.filterModel.searchText = '';
                    dataset.visibility = dataset.public ? 'public' : 'custom';

                    if ($scope.packages && dataset['license_price']) {
                        var lPrice = util.getNr(dataset['license_price']);
                        if (lPrice !== false) {
                            $scope.packages.forEach(function (p) {
                                if (p.price) {
                                    p['full_price'] = lPrice + util.getNr(p.price);
                                    p['full_price'] = p['full_price'].toFixed(3);
                                }

                                if (p['price_month']) {
                                    p['full_price_month'] = util.getNr(p['price_month']) + (lPrice * 730);
                                    p['full_price_month'] = p['full_price_month'].toFixed(2);
                                }
                            });
                        }
                    } else if (!dataset['license_price']) {
                        $scope.packages.forEach(function (p) {
                            delete(p['full_price']);
                            delete(p['full_price_month']);
                        });
                    }

                    if ($scope.features.freetier === 'enabled') {
                        $scope.packages.forEach(function (p) {
                            p.freeTierHidden = freeTierOptions.some(function (option) {
                                var packageMatches = p.id === option.package;
                                var datacenterMatches = option.datacenters.length > 0 &&
                                        option.datacenters.indexOf($scope.data.datacenter) >= -1;
                                return packageMatches && !datacenterMatches;
                            });
                        });
                    }

                    if (!changeDataset) {
                        $scope.setCurrentStep(SELECT_PACKAGE_STEP);
                        $scope.slideCarousel(SELECT_PACKAGE_STEP);
                    }

                    if ($scope.packages && !externalInstanceParams) {
                        var filterValues = ng.copy(FilterValues);
                        $scope.packages.forEach(function (p) {
                            if ($scope.filterPackages()(p) && p.price) {
                                var addFilterValue = function(key, value) {
                                    if (filterValues[key].indexOf(value) === -1) {
                                        filterValues[key].push(value);
                                    }
                                }
                                addFilterValue('vcpus', Number(p.vcpus));
                                addFilterValue('memory', p.memory);
                                addFilterValue('disk', p.disk);
                            }
                        });
                        $scope.filterValues = filterValues;
                        $scope.filterProps.forEach(function (prop) {
                            $scope.filterValues[prop].sort(function (a, b) {
                                return a - b;
                            });
                        });
                        $scope.filterModel.key = $scope.filterProps[0];
                        $scope.onFilterChange($scope.filterModel.key);
                    }
                    $scope.filteredVersions = Provision.filterVersions(dataset, hostSpecification).reverse();
                });
            };

            $scope.selectVersion = function (versionId) {
                if (!versionId) {
                    versionId = $scope.data.dataset;
                }
                selectDataset(versionId, true);
            };

            $scope.selectPackageType = function (packageType) {
                $scope.packageType = packageType;
            };

            $scope.filterDatasets = function (item) {
                if (!$scope.filterModel.searchText) {
                    return true;
                }
                var props = ['id', 'name', 'description'];
                var term = $scope.filterModel.searchText.toLowerCase();
                return props.some(function (prop) {
                    return item[prop] && item[prop].toLowerCase().indexOf(term) !== -1;
                });
            };

            $scope.filterDatasetsByOS = function (item) {
                return $scope.data.opsys === 'All' || item.os.match($scope.data.opsys);
            };

            $scope.filterDatasetsByVisibility = function (item) {
                var result = item.public;
                if ($scope.features.imageUse !== 'disabled') {
                    result = item.state === 'active' &&
                        ($scope.instanceType === 'Public' || !item.public) &&
                        ($scope.instanceType === 'Saved' || item.public);
                }
                return result;
            };

            $scope.selectInstanceType = function (type) {
                $scope.instanceType = type;
                if (type === 'Public') {
                    $location.path('/compute/create');
                    $scope.setCreateInstancePage('');
                } else if (type === 'Saved') {
                    $location.path('/compute/create/custom');
                    $scope.setCreateInstancePage('custom');
                }
            };

            $scope.selectPackage = function (id) {
                $scope.data.name = null;
                Package.package({id: id, datacenter: $scope.data.datacenter}).then(function (pkg) {
                    $scope.selectedPackage = id;
                    $scope.selectedPackageInfo = pkg;
                    setNetworks($scope.data.datacenter);
                    $scope.data.package = pkg.id;
                });
            };
            // TODO: need review this function
            $scope.filterPackages = function (packageType, isPackageTypeCollapsed) {
                return function (item) {
                    var result = true;
                    if ($scope.datasetType !== item.type || item.freeTierHidden ||
                        isPackageTypeCollapsed && packageType === item.group) {
                        result = false;
                    } else if (packageType && packageType !== item.group) {
                        result = isPackageTypeCollapsed && $scope.collapsedPackageTypes.indexOf(item.group) === -1;
                    } else if ($scope.selectedDataset && $scope.selectedDataset.requirements) {
                        var memory = item.memory && parseInt(item.memory, 10);
                        if (memory) {
                            var requirements = $scope.selectedDataset.requirements;
                            if (requirements['min_memory'] && memory < parseInt(requirements['min_memory'], 10) ||
                                requirements['max_memory'] && memory > parseInt(requirements['max_memory'], 10)) {
                                result = false;
                            }
                        }
                    }

                    if (packageType && packageType !== item.group) {
                        result = false;
                    }

                    return result;
                };
            };

            $scope.filterPackageTypes = function (datasetType) {
                return function (packageType) {
                    return indexPackageTypes[packageType].indexOf(datasetType) > -1 &&
                        $scope.packages.filter($scope.filterPackagesByProp).some($scope.filterPackages(packageType));
                };
            };

            $scope.filterPackagesByProp = function (obj) {
                if (!$scope.filterModel.key || !$scope.filterModel.value) {
                    return obj;
                }
                return String(obj[$scope.filterModel.key]) === String($scope.filterModel.value);
            };

            $scope.formatFilterValue = function (value) {
                if ($scope.filterModel.key === 'vcpus') {
                    return value + ' vCPUs';
                }
                return $filter('sizeFormat')(value);
            };

            function selectMinimalPackage(packageType, isPackageCollapsed) {
                $scope.selectPackageType(packageType);
                var preSelectedPackageInfo = preSelectedData && preSelectedData.selectedPackageInfo;

                if (preSelectedPackageInfo && $scope.selectedPackage !== preSelectedPackageInfo.id) {
                    $scope.selectedPackageInfo = preSelectedPackageInfo;
                    $scope.selectPackage($scope.selectedPackage || $scope.selectedPackageInfo.id);
                    $scope.reviewPage();
                    setNetworks($scope.data.datacenter);
                } else if (!preSelectedData) {
                    var minimalPackage;
                    $scope.packages
                        .filter($scope.filterPackagesByProp)
                        .filter($scope.filterPackages(packageType, isPackageCollapsed))
                        .forEach(function (pkg) {
                            if (!minimalPackage || minimalPackage.memory > pkg.memory ||
                                minimalPackage.memory === pkg.memory && pkg.group === 'Standard') {
                                minimalPackage = pkg;
                            }
                        });
                    if (minimalPackage) {
                        $scope.selectPackage(minimalPackage.id);
                    }
                }
            }

            var setDefaultAccordionBehavior = function (accordion) {
                accordion.find('.panel-collapse').addClass('collapse').end()
                    .find('a').addClass('collapsed').end()
                    .find('.collapse.in').removeClass('in');
            };

            $scope.onFilterChange = function (newVal, packageType) {
                if (newVal) {
                    $scope.filterModel.value = $scope.filterValues[newVal][0];
                }
                if ($scope.packages) {
                    selectMinimalPackage(packageType || '');
                    $timeout(function () {
                        var accordion = ng.element('#packagesAccordion');
                        if ($scope.filterModel.key === 'No filter') {
                            setDefaultAccordionBehavior(accordion);
                            accordion.find('.panel-collapse.collapse').has('div.active').addClass('in').parent()
                                .find('a.collapsed').removeClass('collapsed');
                        } else {
                            $scope.collapsedPackageTypes = [];
                            accordion.find('.collapse').addClass('in').end()
                                .find('a.collapsed').removeClass('collapsed');
                        }
                    });
                }
            };

            var selectFilter = function (key, name, callback) {
                if (name !== $scope.filterModel[key]) {
                    $scope.filterModel[key] = name;
                    if (key === 'value') {
                        $scope.onFilterChange();
                    } else {
                        $scope.onFilterChange(name);
                    }
                    callback();
                }
            };
            $scope.selectFilterType = function (name) {
                selectFilter('key', name, function () {
                    preSelectedData = null;
                })
            };
            $scope.selectFilterValue = function (name) {
                selectFilter('value', name, function () {})
            };

            $scope.changeSelectedPackage = function (event, packageType) {
                $timeout(function () {
                    var accordion = ng.element('#packagesAccordion');
                    var elementsLength = accordion.find('.collapse.in').length;
                    if (elementsLength >= 1) {
                        setDefaultAccordionBehavior(accordion);
                    }
                });
                if ($scope.packageType) {
                    return;
                }
                if (!event.target.classList.contains('collapsed')) {
                    if ($scope.filterModel.key !== 'No filter') {
                        $scope.collapsedPackageTypes.push(packageType);
                        selectMinimalPackage(packageType, true);
                    }
                    return;
                }
                if ($scope.filterModel.key === 'No filter') {
                    selectMinimalPackage(packageType);
                } else {
                    $scope.collapsedPackageTypes.splice($scope.collapsedPackageTypes.indexOf(packageType), 1);
                    selectMinimalPackage(true, true);
                }
            };

            var switchToOtherDatacenter = function (datacenter, err) {
                if ($scope.datacenters && $scope.datacenters.length > 0) {
                    var firstNonSelected = $scope.datacenters.find(function (dc) { return dc.name != datacenter; });
                    if (firstNonSelected) {
                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ), err && err.restCode === 'NotAuthorized' ? err.message :
                            localization.translate(
                                null,
                                'machine',
                                'CloudAPI is not responding in the {{name}} data center.' +
                                    ' Our operations team is investigating.',
                                {name: datacenter}
                            )
                        );
                        if (!err || err.restCode !== 'NotAuthorized') {
                            $scope.data.datacenter = firstNonSelected.name;
                            $('#selectDatacenter').select2('val', firstNonSelected.name);
                        }
                    }
                }
            };

            // Watch datacenter change
            var firstLoad = true;
            $scope.$watch('data.datacenter', function (newVal, oldVal) {
                if (datacenterConfig && datacenterConfig.value !== newVal) {
                    datacenterConfig.value = newVal;
                    datacenterConfig.dirty(true);
                    datacenterConfig.$save();
                }
                if (newVal && (newVal !== oldVal || firstLoad)) {
                    $scope.reloading = true;
                    $scope.datasetsLoading = true;
                    firstLoad = false;
                    $qe.every([
                        $q.when(Image.image({datacenter: newVal})),
                        $q.when(Package.package({datacenter: newVal})),
                        $q.when(Provision.getCreatedMachines())
                    ]).then(function (result) {
                        var isAvailableSwitchDatacenter = true;
                        function checkErrorResult(result) {
                            if (result.error) {
                                isAvailableSwitchDatacenter = result.error.restCode !== 'NotAuthorized';
                                PopupDialog.errorObj(result.error);
                                return true;
                            }
                            return false;
                        }
                        function getEmptyOnError(list) {
                            var result = list;
                            if (list.error) {
                                isAvailableSwitchDatacenter = list.error.restCode !== 'NotAuthorized';
                                PopupDialog.errorObj(list.error);
                                result = [];
                            }
                            return result;
                        }
                        var datasets = getEmptyOnError(result[0]);
                        var packages = getEmptyOnError(result[1]);

                        Provision.processDatasets(datasets, function (result) {
                            $scope['operating_systems'] = result.operatingSystems;
                            $scope.datasets = result.datasets;
                            $scope.manyVersions = result.manyVersions;
                            $scope.selectedVersions = result.selectedVersions;
                            $scope.datasetsLoading = false;
                            if (newVal === $scope.data.datacenter) {
                                Provision.processPackages(packages, hostSpecification, function (result) {
                                    indexPackageTypes = result.indexPackageTypes;
                                    $scope.packageTypes = result.packageTypes;
                                    $scope.packages = result.packages;
                                    if (preSelectedImageId) {
                                        selectDataset(preSelectedImageId, externalInstanceParams);
                                        if (externalInstanceParams) {
                                            $scope.selectPackage(requestContext.getParam('package'));
                                            $scope.reconfigure(REVIEW_STEP);
                                        }
                                    }
                                });
                            } else if (preSelectedImageId) {
                                selectDataset(preSelectedImageId);
                            }
                        });

                        if (isAvailableSwitchDatacenter && datasets.length === 0 && packages.length === 0) {
                            switchToOtherDatacenter(newVal);
                        } else {
                            setNetworks(newVal);
                        }
                        if ($scope.isRecentInstancesEnabled) {
                            $scope.recentInstances = Provision.processRecentInstances(result[2], datasets, $scope.packages);
                        }
                    }, function (err) {
                        switchToOtherDatacenter(newVal, err);
                        $scope.datasetsLoading = false;
                    });
                }
                $scope.reloading = false;
            });

            ng.element('#provisionCarousel').carousel({
                interval: false
            });

            $scope.slideCarousel = function (step) {
                ng.element('.carousel-inner').scrollTop(step || 0);
                ng.element('.carousel').carousel(typeof step === 'number' ? step : 'next');
            };

            $scope.reviewPage = function () {
                setTimeout(function () {
                    ng.element('input[name="machineName"]').focus();
                }, 5);
                if ($scope.selectedPackageInfo && $scope.selectedPackageInfo.createdBySupport) {
                    var returnUrl = $location.path();
                    Account.checkProvisioning({btnTitle: 'Submit and Create Instance'}, function () {
                        var el = $scope.selectedPackageInfo;
                        Provision.zenboxDialog({
                            dropboxID: $rootScope.zenboxParams.dropboxOrderPackageId ||
                                $rootScope.zenboxParams.dropboxID,
                            'request_subject': 'I want to order ' + el.description + ' compute instance',
                            'request_description': 'API Name: ' + el.name
                        });
                        loggingService.log('info', 'User is ordering instance package from support', el);
                    }, function (isSuccess) {
                        $location.path(returnUrl);
                        if (isSuccess) {
                            $rootScope.commonConfig('preSelectedData', {
                                selectedPackageInfo: $scope.selectedPackageInfo,
                                preSelectedImageId: $scope.selectedDataset.id
                            });
                        }
                    });
                } else {
                    $scope.slideCarousel();
                    $scope.setCurrentStep(REVIEW_STEP);
                }
            };

            $scope.clickBackToQuickStart = function () {
                $location.path('/compute/create/simple');
                $scope.setCreateInstancePage('simple');
            };

            $scope.goTo = function (path) {
                $location.path(path);
                $location.replace();
            };

            $scope.selectDataValue = function (name) {
                var dataValue = 'No matches found';
                if (name === 'os' && $scope['operating_systems']) {
                    dataValue = $scope.data.opsys;
                }
                return dataValue;
            };

            $scope.isChangeImageDenied = function () {
                return hostSpecification === 'dockerhost' || hostSpecification === 'dtracehost';
            };
        }
    ]);
}(window.JP.getModule('Machine'), window.angular));
