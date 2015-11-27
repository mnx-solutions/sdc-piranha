'use strict';

(function (app, ng) {
    app.controller('Machine.ProvisionController', ['$scope',
        '$filter',
        '$route',
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
        'Docker',
        'PopupDialog',
        '$rootScope',
        'loggingService',
        'util',
        'errorContext',
        function ($scope, $filter, $route, requestContext, $timeout, Provision, Machine, Datacenter, Package, Account, Image,
            $location, localization, $q, $qe, Docker, PopupDialog, $rootScope, loggingService, util, errorContext) {

            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.provision', $scope, {
                title: localization.translate(null, 'machine', 'Create Instances on ' + $scope.company.name)
            });
            Machine.initCreateInstancePageConfig();
            var tritonDatacenters = window.JP.get('sdcDatacenters') || [];
            var publicSdc = $scope.features && $scope.features.privateSdc === 'disabled';
            var instanceTypesStepConfig = null;
            var sdcPackages = [];
            var packageGroupsCache = [];
            var packagesCache = [];

            var IMAGE_TYPES = {
                virtualmachine: ['virtualmachine'],
                smartmachine: ['smartmachine', 'zone-dataset', 'lx-dataset']
            };
            var INSTANCE_TYPES = {
                simple: 'simple',
                container: 'native-container',
                machine: 'virtual-machine',
                custom: 'custom',
                dockerContainer: 'container'
            };
            var ROUTES = {
                nativeContainer: '/compute/create/' + INSTANCE_TYPES.container,
                virtualMachine: '/compute/create/' + INSTANCE_TYPES.machine,
                custom: '/compute/create/' + INSTANCE_TYPES.custom,
                simple: '/compute/create/' + INSTANCE_TYPES.simple,
                container: '/compute/container/create'
            };

            var INSTANCE_TYPE_OPTIONS = [
                {
                    name: 'Quick Start',
                    description: 'Choose a popular image and start computing right away...',
                    type: INSTANCE_TYPES.simple
                },
                {
                    name: 'Saved Images',
                    description: 'Choose a saved image for computing...',
                    type: INSTANCE_TYPES.custom
                },
                {
                    name: 'Docker Container',
                    description: 'Launch a container with docker public or private repo...',
                    type: INSTANCE_TYPES.dockerContainer
                },
                {
                    name: 'Infrastructure Container',
                    description: 'Choose a linux or smartos image for container-native computing...',
                    type: INSTANCE_TYPES.container
                },
                {
                    name: 'Hardware Virtual Machine',
                    description: 'Create a KVM running on Windows or Linux guest OS...',
                    type: INSTANCE_TYPES.machine
                }
            ];

            var FilterValues = {
                'No filter': [],
                vcpus: [],
                memory: [],
                disk: []
            };
            var PROVISION_BUNDLE_KEYS = ['datacenters', 'datasetType', 'selectedImage', 'filterModel', 'filterProps',
                'filterValues', 'selectedPackageInfo', 'packages', 'packageGroups', 'indexPackageTypes'];

            var preSelectedImageId = requestContext.getParam('imageid') === INSTANCE_TYPES.custom ? null :
                requestContext.getParam('imageid');

            var hostSpecification = preSelectedImageId && $location.search().specification;

            var preSelectedData = $rootScope.popCommonConfig('preSelectedData');
            var datacenterConfig;
            var isAvailableSwitchDatacenter;

            var PROVISION_CREATING_IN_PROGRESS = 'Another machine is being created, please let it become provisioning.';

            $scope.setCreateInstancePage = Machine.setCreateInstancePage;
            $scope.isCurrentLocation = Provision.isCurrentLocation;
            $scope.provisionSteps = [
                {
                    name: 'Instance Type',
                    template: 'machine/static/partials/wizard-instance-type.html',
                    hidden: Boolean(hostSpecification)
                },
                {
                    name: 'Choose Image',
                    template: 'machine/static/partials/wizard-choose-image.html',
                    hidden: Boolean(hostSpecification)
                },
                {
                    name: 'Select Package',
                    template: 'machine/static/partials/wizard-select-package.html',
                    hidden: false
                },
                {
                    name: 'Review',
                    template: 'machine/static/partials/wizard-review.html',
                    hidden: false
                },
                {
                    name: 'Attributes',
                    template: 'docker/static/partials/container-create.html',
                    hidden: true
                },
                {
                    name: 'Account Information',
                    template: 'machine/static/partials/wizard-account-info.html',
                    hidden: true
                },
                {
                    name: 'SSH Key',
                    template: 'machine/static/partials/wizard-ssh-key.html',
                    hidden: true
                }
            ];

            $scope.STEP_INDEX = {
                type: 0,
                image: 1,
                package: 2,
                review: 3,
                attributes: 4,
                account: 5,
                ssh: 6
            };

            $scope.filterModel = {};
            $scope.selectedInstanceType = {};
            $scope.provisionForm = {form: {}};
            $scope.sshModel = {isSSHStep: false};
            $scope.instanceType = INSTANCE_TYPES.machine;
            if ($location.path() === ROUTES.simple) {
                $scope.instanceType = INSTANCE_TYPES.simple;
            } else if ($location.path() === ROUTES.nativeContainer) {
                $scope.instanceType = INSTANCE_TYPES.container;
            } else if ($location.path() === ROUTES.container) {
                $scope.instanceType = INSTANCE_TYPES.dockerContainer;
            } else if (preSelectedImageId || $location.path() === ROUTES.custom) {
                $scope.instanceType = INSTANCE_TYPES.custom;
            }

            if (preSelectedData && preSelectedData.preSelectedImageId) {
                preSelectedImageId = preSelectedData.preSelectedImageId;
            }

            $scope.instanceMetadataEnabled = $scope.features.instanceMetadata === 'enabled';

            $scope.keys = [];
            $scope.datacenters = [];
            $scope.networks = [];
            $scope.packages = [];
            $scope.packageGroups = [];
            $scope.popularImages = [];
            $scope.packageGroup = null;
            $scope.isInstanceTypeStepDisabled = $scope.isFirstSlideActive = true;
            $scope.showSimpleType = false;
            $scope.loading = true;

            $scope.currentStepIndex = $scope.STEP_INDEX.type;
            $scope.currentStepName = '';
            $scope.datasetsLoading = true;
            $scope.filterValues = ng.copy(FilterValues);

            $scope.isMantaEnabled = $scope.features.manta === 'enabled';
            $scope.isRecentInstancesEnabled = $scope.features.recentInstances === 'enabled';

            $scope.filterProps = Object.keys($scope.filterValues);

            $scope.data = {
                tags: {},
                metadata: {}
            };

            $scope.selectedImage = null;
            $scope.selectedPackage = null;
            var selectedNetworks = [];
            var indexPackageTypes = {};
            var freeTierOptions = [];
            var unreachableDatacenters = [];
            var firstLoad = true;

            var externalInstanceParams = requestContext.getParam('dc') && requestContext.getParam('package');
            var provisionBundle = $rootScope.popCommonConfig('provisionBundle');
            if (provisionBundle) {
                $rootScope.commonConfig('datacenter', provisionBundle.machine.datacenter);
            }

            var setDatacenter = function () {
                if ($rootScope.commonConfig('datacenter')) {
                    $scope.data.datacenter = $rootScope.commonConfig('datacenter');
                } else {
                    $scope.selectDatacenter();
                }
            };

            var provision = function (machine) {
                var submitBillingInfo = {btnTitle: 'Next'};
                var instanceFromPublicImage = ng.copy($scope.data);
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
                            var bundleData = {
                                simpleImage: false,
                                ready: false,
                                machine: machine
                            };
                            PROVISION_BUNDLE_KEYS.forEach(function (key) {
                                bundleData[key] = $scope[key];
                            });
                            $rootScope.commonConfig('provisionBundle', bundleData);
                            return $location.path('/compute/ssh');
                        }
                        $rootScope.commonConfig('datacenter', $scope.data.datacenter);
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

                    var image = $scope.selectedImage;
                    var description = image && image.description;
                    $scope.provisioningInProgress = false;
                    if (image && image.eula || description && description.indexOf('Stingray') > -1 ||
                        description && description.indexOf('SteelApp') > -1) {
                        PopupDialog.confirm(
                            'Accept End-User License Agreement',
                            {
                                templatePath: image.eula || 'slb/static/templates/eula.html'
                            },
                            function () {
                                finalProvision(instanceFromPublicImage);
                            },
                            function () {
                                $scope.provisioningInProgress = false;
                            }
                        );
                    } else {
                        finalProvision(instanceFromPublicImage);
                    }
                }, function () {
                    var data = {simpleImage: false, ready: false};
                    if (!machine) {
                        PROVISION_BUNDLE_KEYS.forEach(function (key) {
                            data[key] = $scope[key];
                        });
                        data.machine = instanceFromPublicImage;
                    } else {
                        data.simpleImage = true;
                        data.machine = machine;
                    }
                    $rootScope.commonConfig('provisionBundle', data);
                });
            };

            var selectNetwork = function (id, doToggle) {
                if (selectedNetworks.indexOf(id) > -1 && doToggle) {
                    selectedNetworks.splice(selectedNetworks.indexOf(id), 1);
                } else {
                    selectedNetworks.push(id);
                }
            };

            var goToStep = function (step) {
                $scope.currentStepName = $scope.provisionSteps[$scope.currentStepIndex].name;
                $scope.currentStepIndex = step || 0;
                ng.element('html, body').scrollTop(0);
                ng.element('.carousel-inner').scrollTop($scope.currentStepIndex);
                ng.element('.carousel').carousel(typeof step === 'number' ? step : 'next');
            };

            var prepareProvision = function () {
                $scope.sshModel.isSSHStep = $scope.keys.length === 0;
                if (!$scope.account.provisionEnabled) {
                    return goToStep($scope.STEP_INDEX.account);
                } else if ($scope.sshModel.isSSHStep) {
                    return goToStep($scope.STEP_INDEX.ssh);
                }
                provision();
            };

            var selectImage = function (id, changeImage) {
                Image.image({id: id, datacenter: $scope.data.datacenter}).then(function (image) {
                    if (IMAGE_TYPES.virtualmachine.indexOf(image.type) > -1) {
                        $scope.datasetType = 'kvm';
                    } else if (IMAGE_TYPES.smartmachine.indexOf(image.type) > -1) {
                        $scope.datasetType = 'smartos';
                    } else {
                        $scope.datasetType = image.type;
                    }

                    ng.element('#next').trigger('click');
                    ng.element('#step-configuration').fadeIn('fast');

                    $scope.data.dataset = image.id;
                    $scope.selectedImage = image;
                    image.visibility = image.public ? 'public' : INSTANCE_TYPES.custom;

                    setPackagesPrice(image);
                    setFreeTierHidden(freeTierOptions);

                    if (!changeImage) {
                        goToStep($scope.STEP_INDEX.package);
                    }

                    if ($scope.packages && !externalInstanceParams) {
                        setFilterValues(FilterValues);
                    }
                    $scope.filteredVersions = Provision.filterVersions(image, hostSpecification).reverse();
                });
            };

            var filterImages = function (image) {
                if (!$scope.filterModel.searchText) {
                    return true;
                }
                var props = ['id', 'name', 'description'];
                if ($scope.instanceType === INSTANCE_TYPES.dockerContainer) {
                    props = props.concat(['created', 'virtualSize']);
                }
                var term = $scope.filterModel.searchText.toLowerCase();
                return props.some(function (prop) {
                    return image[prop] && image[prop].toLowerCase().indexOf(term) !== -1;
                });
            };

            var filterImagesByOS = function (image) {
                return $scope.data.opsys === 'All' || image.os && image.os.match($scope.data.opsys);
            };

            var filterImagesByVisibility = function (image) {
                var result = false;
                if ($scope.instanceType === INSTANCE_TYPES.container) {
                    result = image.public && IMAGE_TYPES.smartmachine.indexOf(image.type) > -1;
                } else if ($scope.instanceType === INSTANCE_TYPES.machine) {
                    result = image.public && IMAGE_TYPES.virtualmachine.indexOf(image.type) > -1;
                } else if ($scope.instanceType === INSTANCE_TYPES.custom) {
                    result = !image.public;
                }
                if ($scope.features.imageUse !== 'disabled') {
                    result = image.state === 'active' && result;
                }
                return result;
            };

            var getReveiwStep = function () {
                return $scope.instanceType === INSTANCE_TYPES.dockerContainer ? $scope.STEP_INDEX.attributes : $scope.STEP_INDEX.review;
            };

            var getFilteredImages = function (images) {
                return (images || []).filter(function (image) {
                    var foundImage = ($scope.images || []).find(function (dataset) {
                        return image.imageData && dataset.id === image.imageData.dataset || dataset.id === image.dataset;
                    });
                    return foundImage ? filterImages(foundImage) && filterImagesByOS(foundImage) : false;
                });
            };

            var setDefaultAccordionBehavior = function (accordion) {
                accordion.find('.panel-collapse').addClass('collapse').end()
                    .find('.collapse.in').removeClass('in').removeAttr('style');
            };

            var onFilterChange = function (newVal) {
                if (newVal) {
                    $scope.filterModel.value = $scope.filterValues[newVal][0];
                }
                if ($scope.packages) {
                    selectMinimalPackage('');
                    $timeout(function () {
                        var accordion = ng.element('#packagesAccordion');
                        if ($scope.filterModel.key === 'No filter') {
                            setDefaultAccordionBehavior(accordion);
                            accordion.find('.panel-collapse').has('div.active').addClass('in').removeAttr('style');
                        } else {
                            $scope.collapsedPackageGroups = [];
                            accordion.find('.collapse').addClass('in');
                        }
                    });
                }
            };

            var selectFilter = function (key, name, callback) {
                if (key === 'value') {
                    onFilterChange();
                } else {
                    onFilterChange(name);
                }
                callback();
            };

            var switchToAliveDatacenter = function (datacenter, err) {
                if (unreachableDatacenters.indexOf(datacenter) === -1) {
                    unreachableDatacenters.push(datacenter);
                }
                if ($scope.datacenters && $scope.datacenters.length > 0) {
                    var firstNonSelected = $scope.datacenters.find(function (dc) {
                        return unreachableDatacenters.indexOf(dc.name) === -1;
                    });
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
                        }
                    }
                }
            };

            var getTritonDatacenterId = function (datacenter) {
                $scope.tritonDatacenter = tritonDatacenters.find(function (tritonDatacenter) {
                    return tritonDatacenter.datacenter === datacenter;
                });
                $scope.isTritonDatacenter = Boolean($scope.tritonDatacenter);
                return $scope.tritonDatacenter && $scope.tritonDatacenter.id;
            };

            var getImagesInfo = function (datacenter) {
                if ($rootScope.dockerHostsAvailable) {
                    $scope.loading = true;
                    Provision.getDockerImagesInfo(datacenter).then(function (result) {
                        $scope.dockerImages = result.dockerImages;
                        sdcPackages = result.sdcPackages;
                        $scope.getSearchedDockerImages();
                    }).finally(function () {
                        $scope.loading = false;
                    });
                }
            };

            $scope.filterSimpleImagesByDatacenter = function (image) {
                return image.imageData.datacenter === $scope.data.datacenter;
            };

            $scope.filterPopularImages = function (image) {
                return $scope.popularImages.indexOf(image.name) !== -1;
            };

            $scope.getCreateTitle = function () {
                return $scope.currentStepIndex === $scope.STEP_INDEX.review ? 'Create Instance' : 'Next';
            };

            $scope.provisioningInProgress = false;

            var tasks = [
                $q.when(Account.getKeys()),
                $q.when(Datacenter.datacenter()),
                $q.when(Account.getAccount(true)),
                $q.when(Provision.getCreatedMachines()),
                $q.when(Image.getPopularImageList())
            ];
            $qe.every(tasks).then(function (result) {
                var keysResult = result[0];
                var datacentersResult = result[1];
                $scope.account = result[2];
                $scope.simpleImages = [];
                $scope.datacenters = [];
                $scope.popularImages = result[4] || [];

                if (!datacentersResult.error && ($scope.account.error || keysResult.error)) {
                    $scope.datacenters = datacentersResult;
                    $scope.data.datacenter = datacentersResult[0].name;
                    $scope.loading = false;
                    return PopupDialog.errorObj(keysResult.error ? keysResult.error :
                        {error: 'SDC call timed out. Please refresh the page.'});
                }

                $scope.keys = !keysResult.error ? keysResult : [];
                if (!$scope.account.provisionEnabled) {
                    $scope.provisionSteps[$scope.STEP_INDEX.account].hidden = false;
                }
                if ($scope.keys.length <= 0) {
                    $scope.provisionSteps[$scope.STEP_INDEX.ssh].hidden = false;
                }

                function selectDatacenterByImage(imageId) {
                    Image.image({
                        id: imageId, datacenter: $rootScope.commonConfig('datacenter')
                    }).then(function (image) {
                        var datacenter = image && image.datacenter;
                        if (datacenter) {
                            $scope.selectDatacenter(datacenter);
                        } else {
                            $location.url(ROUTES.simple);
                            $location.replace();
                            setDatacenter();
                        }
                    });
                }

                function processProvisionBundle(bundle) {
                    if (!bundle.simpleImage) {
                        PROVISION_BUNDLE_KEYS.forEach(function (key) {
                            $scope[key] = bundle[key];
                        });
                        $scope.data = bundle.machine;
                        $scope.selectedPackage = $scope.data.package;
                        selectedNetworks = $scope.data.networks;

                        $scope.instanceType = INSTANCE_TYPES.container;
                        $scope.reconfigure(getReveiwStep());
                    }
                    if (bundle.ready) {
                        provision(bundle.machine);
                    }
                }

                function selectDatacenterByUserConfig() {
                    // TODO: Handle all other DC drop-downs
                    Account.getUserConfig('datacenter', function (config) {
                        $scope.userConfig = config;
                        if (config.value && !$scope.data.datacenter && !preSelectedImageId) {
                            $scope.selectDatacenter(config.value);
                        }
                        datacenterConfig = config;
                    });
                }

                function completeSetup() {
                    if ($scope.isMantaEnabled && !$scope.data.datacenter) {
                        selectDatacenterByUserConfig();
                    }
                    if (externalInstanceParams) {
                        $scope.selectDatacenter(requestContext.getParam('dc'));
                    } else if (preSelectedImageId) {
                        selectDatacenterByImage(preSelectedImageId);
                    } else {
                        setDatacenter();
                    }

                    if (provisionBundle) {
                        processProvisionBundle(provisionBundle);
                    } else if (!$scope.data.opsys) {
                        $scope.data.opsys = 'All';
                    }
                    $scope.loading = provisionBundle && provisionBundle.machine && provisionBundle.ready;
                }

                if (datacentersResult.error) {
                    $scope.loading = false;
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
                    if ($scope.isRecentInstancesEnabled) {
                        Image.image({datacenter: $scope.data.datacenter}).then(function (images) {
                            $scope.recentInstances = Provision.processRecentInstances(result[3], getEmptyOnError(images), $scope.packages);
                        });
                    }
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
                    $scope.sshModel.isSSHStep = !$scope.provisionSteps[$scope.STEP_INDEX.ssh].hidden;
                    goToStep($scope.STEP_INDEX.ssh);
                    $scope.provisionSteps[$scope.STEP_INDEX.account].hidden = true;
                }
            });

            $scope.$on('ssh-form:onKeyUpdated', function (event, keys) {
                $scope.keys = keys;
                if (keys.length > 0 && $scope.currentStepIndex !== $scope.STEP_INDEX.ssh) {
                    $scope.provisionSteps[$scope.STEP_INDEX.ssh].hidden = true;
                } else {
                    $scope.provisionSteps[$scope.STEP_INDEX.ssh].hidden = false;
                }
            });

            $scope.isProvisionEnabled = function () {
                return $scope.account && $scope.account.provisionEnabled;
            };

            $scope.selectNetworkCheckbox = function (network) {
                $scope.networks.forEach(function (el) {
                    if (el.id === network.id) {
                        el.active = (el.active) ? false : true;
                    } else if (network.public && el.public && el.active) {
                        el.active = false;
                        selectNetwork(el.id, true);
                    }
                });
                selectNetwork(network.id, true);
            };

            $scope.clickProvision = function () {
                // add networks to data
                if (selectedNetworks.length > 0) {
                    $scope.data.networks = selectedNetworks;
                }

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

            $scope.createSimple = function (data) {
                Machine.hasMachineCreatingInProgress(function (result) {
                    if (result.hasCreating) {
                        return PopupDialog.message('Message', PROVISION_CREATING_IN_PROGRESS);
                    } else {
                        if (data.freetier) {
                            return provision(data);
                        }
                        provision(data);
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
                        provision(data);
                    }
                });
            };

            $scope.selectDatacenter = function (name) {
                Provision.selectDatacenter(name, function (datacenterName) {
                    if (datacenterName) {
                        $scope.data.datacenter = datacenterName;
                        getTritonDatacenterId(datacenterName);
                        $rootScope.commonConfig('datacenter', datacenterName);
                        if (!requestContext.getParam('imageid') && !$location.search().specification &&
                            $scope.instanceType === INSTANCE_TYPES.container && !$scope.isTritonDatacenter) {
                            $scope.selectInstanceType(INSTANCE_TYPES.machine);
                        }
                    }
                });
            };

            $scope.selectOpsys = function (name) {
                if (name !== $scope.data.opsys) {
                    $scope.data.opsys = name;
                }
            };

            $scope.sortPackages = function (pkg) {
                return parseInt(pkg.memory || 0, 10);
            };

            function setNetworks(datacenter) {
                Provision.getNetworks(datacenter).then(function (networks) {
                    selectedNetworks = [];
                    networks.forEach(function (network) {
                        if (network.active) {
                            selectNetwork(network.id);
                        }
                    });
                    // TODO cleanup when G4 packages will be implemented
                    $scope.networks = networks.filter(function (net) {
                        var pkgName = $scope.selectedPackageInfo && $scope.selectedPackageInfo.name;
                        var isTriton = pkgName && (pkgName.substr(0, 3) === 't4-' || pkgName.substr(0, 3) === 'g4-');
                        var isKvmImage = $scope.selectedDataset && $scope.selectedDataset.type === 'virtualmachine';
                        return net && (!isKvmImage && isTriton || !net.hasOwnProperty('fabric') ||
                                net.fabric !== true && net.public !== false);
                    });
                });
            }

            var resetSelectedData = function (step, instancePackage) {
                $scope.data = {
                    datacenter: $scope.data.datacenter,
                    opsys: 'All',
                    name: null,
                    dataset: $scope.data.dataset,
                    metadata: {},
                    tags: {}
                };

                if (instancePackage && (step === $scope.STEP_INDEX.package || $scope.selectedPackage &&
                    $scope.selectedImage.id === $scope.data.dataset)) {
                    $scope.data.package = instancePackage;
                } else {
                    $scope.selectedPackage = null;
                    $scope.selectedPackageInfo = null;
                    $scope.packageGroup = null;
                    $scope.selectedImage = null;
                }
            };

            $scope.reconfigure = function (step) {
                if (step === $scope.STEP_INDEX.image) {
                    ng.element('#filterProperty').val('No filter');
                    preSelectedImageId = null;
                    externalInstanceParams = null;
                    $location.search('specification', null);
                    if (requestContext.getParam('imageid')) {
                        $location.path(ROUTES.custom);
                    }
                }
                if (step !== $scope.STEP_INDEX.review && step !== $scope.STEP_INDEX.attributes) {
                    if ($scope.networks && $scope.networks.length) {
                        setNetworks($scope.data.datacenter);
                    }

                    if ($scope.provisionForm.form.machineName) {
                        ['machineName', 'machineUnique'].forEach(function (key) {
                            $scope.provisionForm.form.machineName.$setValidity(key, true);
                        });
                    }
                    if (!$scope.selectedImage || $scope.selectedImage.id !== $scope.data.dataset &&
                        $scope.instanceType !== INSTANCE_TYPES.dockerContainer) {
                        resetSelectedData(step, $scope.data.package);
                    }
                }
                if ($scope.keys.length > 0) {
                    ng.element('.carousel').on('slid.bs.carousel', function () {
                        if ($scope.$$phase) {
                            $scope.provisionSteps[$scope.STEP_INDEX.ssh].hidden = true;
                        } else {
                            $scope.$apply(function () {
                                $scope.provisionSteps[$scope.STEP_INDEX.ssh].hidden = true;
                            });
                        }
                        ng.element('.carousel').off('slid.bs.carousel');
                    });
                }
                goToStep(step);
                if ($scope.features.instanceMetadata === 'enabled') {
                    ng.element('#metadata-configuration').fadeOut('fast');
                }
                ng.element('#network-configuration').fadeOut('fast');
                preSelectedData = null;
            };

            $scope.selectLastDatasetVersion = function (image) {
                var imageId = Provision.getLastDatasetId(image);
                selectImage(imageId);
            };

            function setPackagesPrice(image) {
                if ($scope.packages && image['license_price']) {
                    var lPrice = util.getNr(image['license_price']);
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
                } else if (!image['license_price']) {
                    $scope.packages.forEach(function (p) {
                        delete(p['full_price']);
                        delete(p['full_price_month']);
                    });
                }
            }

            function setFreeTierHidden(freeTierOptions) {
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
            }

            function setFilterValues(values) {
                var filterValues = ng.copy(values);
                $scope.packages.forEach(function (p) {
                    if ($scope.filterPackages()(p) && (!publicSdc || p.price)) {
                        var addFilterValue = function(key, value) {
                            if (filterValues[key].indexOf(value) === -1) {
                                filterValues[key].push(value);
                            }
                        };
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
                onFilterChange($scope.filterModel.key);
            }

            $scope.selectVersion = function () {
                selectImage($scope.data.dataset, true);
            };

            $scope.selectPackageGroup = function (packageGroup) {
                $scope.packageGroup = packageGroup;
            };

            $scope.getAllFilteredImages = function () {
                $scope.filteredImages = ($scope.images || []).filter(function (image) {
                    return filterImages(image) && filterImagesByOS(image) && filterImagesByVisibility(image);
                });
            };

            $scope.setInstanceType = function () {
                $scope.selectedInstanceType.data = $scope.instanceTypeOptions.find(function (instanceType) {
                    return instanceType.type === $scope.instanceType;
                });
            };

            var setAccountSshStepsVisibility = function (type) {
                var isTypeDocker = type === INSTANCE_TYPES.dockerContainer;
                $scope.provisionSteps[$scope.STEP_INDEX.account].hidden = isTypeDocker || $scope.account.provisionEnabled;
                $scope.provisionSteps[$scope.STEP_INDEX.ssh].hidden = isTypeDocker || $scope.loading || $scope.keys.length > 0;
            };

            $scope.selectInstanceType = function (type) {
                $scope.provisionSteps[$scope.STEP_INDEX.review].hidden = true;
                if (type !== INSTANCE_TYPES.dockerContainer) {
                    $scope.provisionSteps[$scope.STEP_INDEX.review].hidden = false;
                    $scope.packageGroups = packageGroupsCache;
                    $scope.packages = packagesCache;
                }
                $scope.provisionSteps[$scope.STEP_INDEX.attributes].hidden = !$scope.provisionSteps[$scope.STEP_INDEX.review].hidden;
                setAccountSshStepsVisibility(type);
                if (type !== $scope.instanceType) {
                    resetSelectedData();
                }
                $scope.instanceType = type;
                $scope.showSimpleType = false;
                if (type === INSTANCE_TYPES.simple) {
                    $location.path(ROUTES.simple);
                    $scope.setCreateInstancePage(INSTANCE_TYPES.simple);
                    $scope.setInstanceType();
                    $scope.showSimpleType = true;
                    return;
                }
                $scope.getAllFilteredImages();
                $scope.reconfigure($scope.STEP_INDEX.image);
                if (type === INSTANCE_TYPES.machine) {
                    $location.path(ROUTES.virtualMachine);
                    $scope.setCreateInstancePage(INSTANCE_TYPES.machine);
                } else if (type === INSTANCE_TYPES.container) {
                    $location.path(ROUTES.nativeContainer);
                    $scope.setCreateInstancePage(INSTANCE_TYPES.container);
                } else if (type === INSTANCE_TYPES.dockerContainer) {
                    $location.path(ROUTES.container);
                    $scope.setCreateInstancePage(INSTANCE_TYPES.dockerContainer);
                } else if (type === INSTANCE_TYPES.custom) {
                    $location.path(ROUTES.custom);
                    $scope.setCreateInstancePage(INSTANCE_TYPES.custom);
                }
                $scope.setInstanceType();
            };

            $scope.instanceTypeOptions = angular.copy(INSTANCE_TYPE_OPTIONS);

            $scope.setInstanceType();

            $scope.goToNextStep = function () {
                if ($scope.currentStepIndex === $scope.STEP_INDEX.package) {
                    $scope.goToReviewPage();
                } else if ($scope.currentStepIndex === $scope.STEP_INDEX.image) {
                    $scope.reconfigure($scope.STEP_INDEX.package);
                }
            };

            $scope.goToInstances = function () {
                var machine = Machine.machine();
                if (machine && machine.length) {
                    $location.path('/compute');
                } else {
                    $location.path('/dashboard');
                }
            };

            $scope.goToPreviousStep = function () {
                if ($scope.currentStepIndex) {
                    var step = $scope.currentStepIndex - 1;
                    if ($scope.currentStepIndex === $scope.STEP_INDEX.account ||
                        $scope.currentStepIndex === $scope.STEP_INDEX.ssh &&
                        $scope.provisionSteps[$scope.STEP_INDEX.account].hidden) {
                        step = getReveiwStep();
                    } else if ($scope.currentStepIndex === $scope.STEP_INDEX.attributes) {
                        step = $scope.STEP_INDEX.package;
                    }
                    $scope.reconfigure(step);
                } else if ($scope.instanceType === INSTANCE_TYPES.simple || !$scope.currentStepIndex) {
                    $scope.goToInstances();
                }
            };

            $scope.skipInstanceTypeStep = function () {
                $scope.isInstanceTypeStepDisabled = !$scope.isInstanceTypeStepDisabled;
                if ($scope.features.manta === 'enabled') {
                    if (!instanceTypesStepConfig) {
                        Account.getUserConfig('instanceTypeStep', function (config) {
                            instanceTypesStepConfig = config;
                            $scope.isInstanceTypeStepDisabled = $scope.isFirstSlideActive = instanceTypesStepConfig.isTypeCheckboxActive;
                            if ($scope.isInstanceTypeStepDisabled) {
                                $scope.selectInstanceType($scope.instanceType);
                            }
                        });
                    } else {
                        instanceTypesStepConfig.isTypeCheckboxActive = $scope.isInstanceTypeStepDisabled;
                        Account.saveUserConfig();
                    }
                }
            };
            if (!preSelectedImageId) {
                $scope.skipInstanceTypeStep();
            }

            $scope.getFilteredSimpleImages = function () {
                $scope.filteredRecentInstances = getFilteredImages($scope.recentInstances);
                $scope.filteredSimpleImages = getFilteredImages($scope.simpleImages);
            };

            $scope.getSearchedDockerImages = function () {
                $scope.filteredDockerImages = ($scope.dockerImages || []).filter(function (image) {
                    return filterImages(image);
                });
            };

            $scope.selectDockerImage = function (image) {
                $scope.packageGroups = [];
                $scope.datasetType = 'smartos';
                $scope.selectedImage = image;
                $scope.packages = sdcPackages;
                $scope.packages.forEach(function (pkg) {
                    if ($scope.packageGroups.indexOf(pkg.group) === -1) {
                        $scope.packageGroups.push(pkg.group);
                    }
                });
                $scope.packageGroup = $scope.packageGroups[0];
                $scope.filterModel.key = $scope.filterProps[0];
                goToStep($scope.STEP_INDEX.package);
                onFilterChange($scope.filterModel.key);
            };

            $rootScope.$on('closeSearchDialog', function () {
                getImagesInfo($scope.data.datacenter);
            });

            $scope.checkLimit = function (image) {
                if (image.limit && image.limit.$$v) {
                    $scope.goTo('/limits');
                } else {
                    $scope.selectLastDatasetVersion(image);
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
            $scope.filterPackages = function (packageGroup, isPackageGroupCollapsed) {
                return function (item) {
                    var result = true;
                    if (publicSdc && ($scope.datasetType !== item.type || item.freeTierHidden ||
                        isPackageGroupCollapsed && packageGroup === item.group)) {
                        result = false;
                    } else if (packageGroup && packageGroup !== item.group) {
                        result = isPackageGroupCollapsed && $scope.collapsedPackageGroups.indexOf(item.group) === -1;
                    } else if ($scope.selectedImage && $scope.selectedImage.requirements) {
                        var memory = item.memory && parseInt(item.memory, 10);
                        if (memory) {
                            var requirements = $scope.selectedImage.requirements;
                            if (requirements['min_memory'] && memory < parseInt(requirements['min_memory'], 10) ||
                                requirements['max_memory'] && memory > parseInt(requirements['max_memory'], 10)) {
                                result = false;
                            }
                        }
                    }
                    return result;
                };
            };

            $scope.filterPackageGroups = function (datasetType) {
                return function (packageGroup) {
                    return !publicSdc || indexPackageTypes[packageGroup].indexOf(datasetType) > -1 &&
                        $scope.packages.filter($scope.filterPackagesByProp).some($scope.filterPackages(packageGroup));
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

            function selectMinimalPackage(packageGroup, isPackageCollapsed) {
                $scope.selectPackageGroup(packageGroup);
                var preSelectedPackageInfo = preSelectedData && preSelectedData.selectedPackageInfo;

                if (preSelectedPackageInfo && $scope.selectedPackage !== preSelectedPackageInfo.id) {
                    $scope.selectedPackageInfo = preSelectedPackageInfo;
                    $scope.selectPackage($scope.selectedPackage || $scope.selectedPackageInfo.id);
                    $scope.goToReviewPage();
                    setNetworks($scope.data.datacenter);
                } else if (!preSelectedData) {
                    var minimalPackage;
                    $scope.packages
                        .filter($scope.filterPackagesByProp)
                        .filter($scope.filterPackages(packageGroup, isPackageCollapsed))
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

            $scope.selectFilterType = function (name) {
                selectFilter('key', name, function () {
                    preSelectedData = null;
                });
            };
            $scope.selectFilterValue = function (name) {
                selectFilter('value', name, function () {});
            };

            $scope.changeSelectedPackage = function (event, packageGroup) {
                $timeout(function () {
                    var accordion = ng.element('#packagesAccordion');
                    var elementsLength = accordion.find('.collapse.in').length;
                    if (elementsLength >= 1) {
                        setDefaultAccordionBehavior(accordion);
                    }
                });
                if ($scope.packageGroup) {
                    return;
                }
                if (!event.target.classList.contains('collapsed')) {
                    if ($scope.filterModel.key !== 'No filter') {
                        $scope.collapsedPackageGroups.push(packageGroup);
                        selectMinimalPackage(packageGroup, true);
                    }
                    return;
                }
                if ($scope.filterModel.key === 'No filter') {
                    selectMinimalPackage(packageGroup);
                } else {
                    $scope.collapsedPackageGroups.splice($scope.collapsedPackageGroups.indexOf(packageGroup), 1);
                    selectMinimalPackage(true, true);
                }
            };

            function getEmptyOnError(list) {
                var result = list;
                if (list.error) {
                    isAvailableSwitchDatacenter = list.error.restCode !== 'NotAuthorized';
                    PopupDialog.errorObj(list.error);
                    result = [];
                }
                return result;
            }

            // Watch datacenter change
            $scope.$watch('data.datacenter', function (newVal, oldVal) {
                if (datacenterConfig && datacenterConfig.value !== newVal) {
                    datacenterConfig.value = newVal;
                    Account.saveUserConfig();
                }
                if (newVal && (newVal !== oldVal || firstLoad)) {
                    $scope.reloading = true;
                    $scope.datasetsLoading = true;
                    firstLoad = false;
                    $scope.instanceTypeOptions = angular.copy(INSTANCE_TYPE_OPTIONS);
                    resetSelectedData();
                    getTritonDatacenterId(newVal);
                    if ($scope.isTritonDatacenter) {
                        getImagesInfo(newVal);
                        $rootScope.$emit('tritonDatacenterId', getTritonDatacenterId(newVal));
                    }
                    var tasks = [
                        $q.when(Image.image({datacenter: newVal})),
                        $q.when(Package.package({datacenter: newVal})),
                        $q.when(Provision.getCreatedMachines())
                    ];
                    $qe.every(tasks).then(function (result) {
                        isAvailableSwitchDatacenter = true;
                        var images = getEmptyOnError(result[0]);
                        var packages = getEmptyOnError(result[1]);

                        Provision.processDatasets(images, function (result) {
                            $scope['operating_systems'] = result.operatingSystems;
                            $scope.images = result.datasets;
                            $scope.filteredSimpleImages = getFilteredImages($scope.simpleImages);
                            $scope.hasVmImages = Provision.hasVmImages($scope.images, IMAGE_TYPES.virtualmachine);
                            if (!$scope.hasVmImages) {
                                if ($location.path() === ROUTES.virtualMachine) {
                                    $scope.selectInstanceType(INSTANCE_TYPES.container);
                                }
                                $scope.instanceTypeOptions = $scope.instanceTypeOptions.filter(function (instanceType) {
                                    return instanceType.type !== INSTANCE_TYPES.machine;
                                });
                            }
                            if (!$rootScope.dockerHostsAvailable) {
                                $scope.instanceTypeOptions = $scope.instanceTypeOptions.filter(function (instanceType) {
                                    return instanceType.type !== INSTANCE_TYPES.dockerContainer;
                                });
                            }
                            $scope.getAllFilteredImages();
                            $scope.manyVersions = result.manyVersions;
                            $scope.selectedVersions = result.selectedVersions;
                            $scope.datasetsLoading = false;
                            if (newVal === $scope.data.datacenter) {
                                Provision.processPackages(packages, hostSpecification, function (result) {
                                    indexPackageTypes = result.indexPackageTypes;
                                    $scope.packageGroups = packageGroupsCache = result.packageGroups;
                                    $scope.packages = packagesCache = result.packages;
                                    if (preSelectedImageId) {
                                        selectImage(preSelectedImageId, externalInstanceParams);
                                        if (externalInstanceParams) {
                                            $scope.selectPackage(requestContext.getParam('package'));
                                            $scope.reconfigure(getReveiwStep());
                                        }
                                    }
                                });
                            } else if (preSelectedImageId) {
                                selectImage(preSelectedImageId);
                            }
                        });

                        if (isAvailableSwitchDatacenter && images.length === 0 && packages.length === 0) {
                            switchToAliveDatacenter(newVal);
                        } else {
                            setNetworks(newVal);
                        }
                        if ($scope.isRecentInstancesEnabled) {
                            $scope.recentInstances = Provision.processRecentInstances(result[2], images, $scope.packages);
                            $scope.filteredRecentInstances = getFilteredImages($scope.recentInstances);
                        }
                    }, function (err) {
                        switchToAliveDatacenter(newVal, err);
                        $scope.datasetsLoading = false;
                    });
                }
                $scope.reloading = false;
            });

            ng.element('#provisionCarousel').carousel({
                interval: false
            });

            $scope.goToReviewPage = function () {
                setTimeout(function () {
                    ng.element('input[name="machineName"]').focus();
                }, 800);
                if ($scope.selectedPackageInfo && $scope.selectedPackageInfo.createdBySupport) {
                    var returnUrl = $location.path();
                    Account.checkProvisioning({btnTitle: 'Submit and Create Instance'}, function () {
                        var el = $scope.selectedPackageInfo;
                        Provision.zenboxDialog({
                            dropboxID: $rootScope.zenboxParams.dropboxOrderPackageId ||
                                $rootScope.zenboxParams.dropboxID,
                            'request_subject': 'I want to order ' + el.description + ' compute instance',
                            'request_description': 'API Name: ' + el.name + ', Datacenter: ' +
                                $scope.data.datacenter + ', Image: ' + $scope.selectedDataset.name
                        });
                        loggingService.log('info', 'User is ordering instance package from support', el);
                    }, function (isSuccess) {
                        $location.path(returnUrl);
                        if (isSuccess) {
                            $rootScope.commonConfig('preSelectedData', {
                                selectedPackageInfo: $scope.selectedPackageInfo,
                                preSelectedImageId: $scope.selectedImage.id
                            });
                        }
                    });
                } else {
                    goToStep(getReveiwStep());
                }
                if ($scope.instanceType === INSTANCE_TYPES.dockerContainer) {
                    $rootScope.$emit('createContainer', {
                        hostId: getTritonDatacenterId($scope.data.datacenter),
                        image: $scope.selectedImage.repository,
                        pkg: $scope.selectedPackageInfo
                    });
                }
            };

            $rootScope.$on('containerLaunchButton', function (event, launchButtonData) {
                $scope.isLaunchDisabled = launchButtonData.isButtonDisabled;
                $scope.createContainer = launchButtonData.createContainer;
            });

            $scope.goTo = function (path) {
                $location.path(path);
                $location.replace();
            };

            $scope.selectDataValue = function (name, isSimpleImages) {
                var dataValue = 'No matches found';
                if (name === 'os' && $scope['operating_systems']) {
                    dataValue = $scope.data.opsys;
                    if (isSimpleImages) {
                        $scope.getFilteredSimpleImages();
                    } else {
                        $scope.getAllFilteredImages();
                    }
                }
                return dataValue;
            };

            $scope.isChangeImageDenied = function () {
                return hostSpecification === 'dockerhost' || hostSpecification === 'dtracehost';
            };
        }
    ]);
}(window.JP.getModule('Machine'), window.angular));
