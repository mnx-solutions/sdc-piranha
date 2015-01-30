'use strict';

(function (app, ng) {
    app.controller('Machine.ProvisionController', ['$scope',
        '$filter',
        'requestContext',
        '$timeout',
        'Machine',
        'Datacenter',
        'Package',
        'Account',
        'Network',
        'Image',
        '$location',
        'localization',
        '$q',
        '$qe',
        '$$track',
        'PopupDialog',
        '$cookies',
        '$rootScope',
        'FreeTier',
        'loggingService',
        'util',
        'Limits',
        'errorContext',
        function ($scope, $filter, requestContext, $timeout, Machine, Datacenter, Package, Account, Network, Image, $location, localization, $q, $qe, $$track, PopupDialog, $cookies, $rootScope, FreeTier, loggingService, util, Limits, errorContext) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.provision', $scope, {
                title: localization.translate(null, 'machine', 'Create Instances on Joyent')
            });
            var CHOOSE_IMAGE_STEP = 0;
            var SELECT_PACKAGE_STEP = 1;
            var REVIEW_STEP = 2;
            var REVIEW_STEP_NAME = 'Review';
            var ACCOUNT_STEP_NAME = 'Account Information';
            var SSH_STEP_NAME = 'SSH Key';
            var DOCKERHOST_MINIMUM_MEMORY = 1024;

            $scope.preSelectedImageId = (requestContext.getParam('imageid') === 'custom') ? null : requestContext.getParam('imageid');
            $scope.isDockerHost = $scope.preSelectedImageId && $location.search().specification === 'dockerhost';
            $scope.preSelectedImage = null;

            $scope.setCreateInstancePage = Machine.setCreateInstancePage;
            $scope.provisionSteps = [
                {
                    name: 'Choose Image',
                    template: 'machine/static/partials/wizard-choose-image.html',
                    hide: $scope.isDockerHost
                },
                {
                    name: 'Select Package',
                    template: 'machine/static/partials/wizard-select-package.html'
                },
                {
                    name: REVIEW_STEP_NAME,
                    template: 'machine/static/partials/wizard-review.html'
                }
            ];
            $scope.reviewModel = {};
            $scope.filterModel = {};
            $scope.sshModel = {isSSHStep: false};
            $scope.provisionStep = true;
            $scope.campaignId = ($cookies.campaignId || 'default');
            $scope.preSelectedData = $rootScope.popCommonConfig('preSelectedData');

            $scope.instanceType = ($scope.preSelectedImageId || $location.path().indexOf('/custom') > -1) ? 'Saved' : 'Public';
            if ($scope.preSelectedData && $scope.preSelectedData.preSelectedImageId) {
                $scope.preSelectedImageId = $scope.preSelectedData.preSelectedImageId;
            }

            $scope.instanceMetadataEnabled = $scope.features.instanceMetadata === 'enabled';
            $scope.metadataArray = [
                {key: '', val: '', edit: true, conflict: false}
            ];
            $scope.key = {};

            $scope.isProvisioningLimitsEnable = $scope.features.provisioningLimits === 'enabled';


            $scope.keys = [];
            $scope.datacenters = [];
            $scope.networks = [];
            $scope.datacenterForNetworks = '';
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
                vcpus: [],
                memory: [],
                disk: []
            };

            $scope.isMantaEnabled = $scope.features.manta === 'enabled';
            $scope.isRecentInstancesEnabled = $scope.features.recentInstances === 'enabled';

            $scope.filterProps = Object.keys($scope.filterValues);

            $scope.freeTierOptions = [];

            $scope.data = {};
            $scope.data.tags = {};
            $scope.data.metadata = {};
            $scope.selectedDataset = null;
            $scope.selectedPackage = null;
            $scope.selectedNetworks = [];
            $scope.previousPos = 0;

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
                return $scope.currentSlidePageIndex === $scope.provisionSteps.length - 1 ? 'Create Instance' : 'Next';
            };

            var addProvisionStep = function (step) {
                var isExists = $scope.provisionSteps.some(function (item) {
                    return item.name === step.name;
                });

                if (!isExists) {
                    $scope.provisionSteps.push(step);
                }
            };

            var getUserLimits = function () {
                var deferred = $q.defer();
                Limits.getUserLimits(function (error, limits) {
                    if (error) {
                        PopupDialog.error('Error', error);
                        deferred.resolve([]);
                    }
                    deferred.resolve(limits);
                });
                return deferred.promise;
            };

            var setDatacenter = function () {
                if ($rootScope.commonConfig('datacenter')) {
                    $scope.data.datacenter = $rootScope.commonConfig('datacenter');
                } else {
                    $scope.selectDatacenter();
                }
            };

            var checkLimit = function (dataset) {
                return $scope.isProvisioningLimitsEnable && $scope.limits.some(function (limit) {
                    return (limit.dataset === dataset && limit.limit < 1);
                });
            };

            var filterSelectedNetworks = function (selectedNetworks, callback) {
                Network.network($scope.data.datacenter).then(function (dcNetworks) {
                    callback(selectedNetworks.filter(function (selectedNetwork) {
                        return dcNetworks.some(function (dcNetwork) {
                            return dcNetwork.id === selectedNetwork;
                        });
                    }));
                }, function (err) {
                    PopupDialog.errorObj(err);
                });
            };

            $scope.provisioningInProgress = false;

            var waitForCreatingMachinesToFinish = function (callback) {
                Machine.listAllMachines().then(function (machines) {
                    $scope.machines = machines;
                    var hasCreating = $scope.machines.some(function (machine) {
                        return machine.state === 'creating';
                    });
                    if (hasCreating) {
                        setTimeout(function () {
                            waitForCreatingMachinesToFinish(callback);
                        }, 1000);
                    } else {
                        callback();
                    }
                });
            };

            var provision = function (machine) {
                var finalProvision = function () {
                    if (machine && !machine.dataset) {
                        PopupDialog.message('Error', 'Instance not found.');
                        return;
                    }
                    var machineData = machine || $scope.data;
                    //we can return this back when make ssh not required for windows
                    if ($scope.keys.length === 0) {
                        $rootScope.commonConfig('provisionBundle', {
                            manualCreate: false,
                            allowCreate: false,
                            machine: machineData
                        });
                        $location.path('/compute/ssh');
                    } else if (!$scope.provisioningInProgress) {
                        //add flag for docker host
                        if ($scope.isDockerHost) {
                            machineData.specification = 'docker';
                        }

                        $scope.provisioningInProgress = true;
                        waitForCreatingMachinesToFinish(function () {
                            Machine.provisionMachine(machineData).done(function (err, job) {
                                $scope.provisioningInProgress = false;
                                var quotaExceededHeader = 'QuotaExceeded: ';

                                if (err && err.message && err.message.indexOf('Free tier') > -1) {
                                    var freeDatacenters = [];
                                    var messagePart2 = '.';
                                    $scope.datacenters.forEach(function (datacenter) {
                                        var isFreeDatacenter = $scope.freeTierOptions.some(function (freeImage) {
                                            return freeImage.datacenters.indexOf(datacenter.name) !== -1;
                                        });
                                        if (isFreeDatacenter) {
                                            freeDatacenters.push(datacenter.name);
                                        }
                                    });
                                    if (freeDatacenters.length > 0) {
                                        freeDatacenters = freeDatacenters.join(', ');
                                        messagePart2 = ', and you still have the capacity for free tier instances in ' + freeDatacenters + '.';
                                    }
                                    err.message = err.message + ' This limitation applies per data center' + messagePart2;
                                }

                                if (err && err.message && err.message.indexOf(quotaExceededHeader) === 0) {
                                    var redirectUrl = '/compute/create/simple';
                                    PopupDialog.error(null, err.message.substr(quotaExceededHeader.length), function () {
                                        if (err.message.indexOf('Free tier offering is limited') === -1) {
                                            redirectUrl = '/dashboard';
                                            $scope.zenboxDialog({
                                                request_subject: 'Please raise my provisioning limits'
                                            });
                                        }
                                        $location.path(redirectUrl);
                                    });
                                    return;
                                }

                                var newMachine = job.__read();
                                if (newMachine.id && machineData.freetier) {
                                    var freeTierMachine = $scope.machines.find(function (machine) {
                                        return machine.id === newMachine.id;
                                    });
                                    if (freeTierMachine) {
                                        freeTierMachine.freetier = true;
                                    }
                                }
                                $q.when(Machine.machine(), function (listMachines) {
                                    if (newMachine.id && $scope.features.marketo === 'enabled') {
                                        $q.when(Machine.checkFirstInstanceCreated(newMachine.id), function (uuid) {
                                            if (!uuid || typeof (uuid) === 'object') {
                                                $$track.marketo_machine_provision($scope.account);
                                            }
                                        });
                                    }
                                    if (err && listMachines.length === 0) {
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
                                                var listedMachine = config.createdMachines.find(function (m) {
                                                    return m.dataset === machineData.dataset &&
                                                        m.package === machineData.package;
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

                            $location.url('/compute');
                        });
                    }
                };
                var submitBillingInfo = {btnTitle: 'Next'};
                if ($scope.keys.length > 0) {
                    submitBillingInfo.btnTitle = 'Submit and Create Instance';
                    submitBillingInfo.appendPopupMessage = 'Provisioning will now commence.';
                }
                if (machine && machine.freetier) {
                    submitBillingInfo.beforeBillingMessage = ' Note: Free Dev Tier customers will not be billed until the promotional term expires as this is merely a validation step.';
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
                            $scope.features.billing === 'enabled' ?
                                'Billing will start once this instance is created' :
                                'Instance will be created and started'
                    );
                    var title = 'Confirm: Create Instance';
                    var popupContent = billingStartMessage;
                    if (dataset && dataset.eula || description && description.indexOf('Stingray') > -1 ||
                        description && description.indexOf('SteelApp') > -1) {
                        title = 'Accept End-User License Agreement';
                        popupContent = {
                            templatePath: dataset.eula || 'slb/static/templates/eula.html',
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
                                deleteProvisionStep(ACCOUNT_STEP_NAME);
                                if (stepsSize !== $scope.provisionSteps.length) {
                                    $scope.reconfigure($scope.currentSlidePageIndex - 1);
                                }
                            }
                    );
                }, function () {
                    if (!machine) {
                        $rootScope.commonConfig('provisionBundle', {
                            datacenters: $scope.datacenters,
                            datasetType: $scope.datasetType,
                            selectedDataset: $scope.selectedDataset,
                            filterModel: $scope.filterModel,
                            filterProps: $scope.filterProps,
                            filterValues: $scope.filterValues,
                            selectedPackageInfo: $scope.selectedPackageInfo,
                            packages: $scope.packages,
                            packageTypes: $scope.packageTypes,
                            indexPackageTypes: $scope.indexPackageTypes,
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
            };

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

            function setupSimpleImages (simpleImages, networks, isFree) {
                if (simpleImages && simpleImages.length > 0) {
                    if ($scope.datacenters && $scope.datacenters.length > 0) {
                        $scope.datacenters.forEach(function (datacenter) {
                            Package.package({ datacenter: datacenter.name }).then(function (packages) {
                                var packagesByName = {};
                                packages.forEach(function (pkg) {
                                    packagesByName[pkg.name] = pkg.id;
                                });
                                ng.copy(simpleImages).forEach(function (image) {
                                    var params = {
                                        datacenter: datacenter.name
                                    };
                                    params.name = image.datasetName;
                                    params.forceMajorVersion = image.forceMajorVersion;
                                    if (isFree && image.datacenters.indexOf(datacenter.name) === -1) {
                                        return;
                                    }
                                    Image.simpleImage(params).then(function (dataset) {
                                        if (dataset) {
                                            var simpleImage = {};
                                            if (isFree) {
                                                simpleImage.imageData = image;
                                                simpleImage.name = image.name;
                                                simpleImage.description = {
                                                    text: image.original.description,
                                                    memory: image.original.memory / 1024,
                                                    cpu: image.original.vcpus,
                                                    disk: image.original.disk / 1024,
                                                    price: image.original.price
                                                };
                                                var smallLogoClass = $filter('logo')(simpleImage.imageData.name);
                                                simpleImage.className = smallLogoClass.indexOf('default') === -1 ?
                                                    smallLogoClass + '-logo' : 'joyent-logo';
                                                simpleImage.imageData.freetier = true;
                                                simpleImage.imageData.freeTierValidUntil = $scope.freeTierOptions.validUntil;
                                            } else {
                                                simpleImage = image;
                                                simpleImage.imageData = {};
                                                simpleImage.imageData.package = packagesByName[simpleImage.packageName];
                                                simpleImage.imageData.networks = networks;
                                            }
                                            simpleImage.imageData.dataset = dataset;
                                            simpleImage.imageData.datacenter = datacenter.name;
                                            simpleImage.imageData.name = '';
                                            delete simpleImage.packageName;
                                            delete simpleImage.datasetName;
                                            if (simpleImage.imageData.package) {
                                                simpleImage.limit = checkLimit(simpleImage.imageData.dataset);
                                                $scope.simpleImages.push(simpleImage);
                                            }
                                        }
                                    });
                                });
                            });
                        });
                    }
                }
            }
            var tasks =[
                $q.when(Account.getKeys()),
                $q.when(Datacenter.datacenter()),
                $q.when(Machine.getSimpleImgList()),
                $q.when(Machine.machine())
            ];
            tasks.push($q.when($scope.isProvisioningLimitsEnable ? getUserLimits(): []));
            tasks.push($q.when($scope.features.freetier === 'enabled' ? FreeTier.freetier(): []));
            tasks.push($q.when(Account.getAccount(true)));

            $qe.every(tasks).then(function (result) {
                $scope.simpleImages = [];
                $scope.datasetsInfo = [];
                $scope.keys = [];
                $scope.datacenters = [];
                $scope.account = result[6];
                var simpleImages = [];
                var networks = [];
                var keysResult = result[0];
                var datacentersResult = result[1];
                var simpleImagesResult = result[2];
                var machinesResult = result[3];
                var limitsResult = result[4];
                var freeTierOptionsResult = result[5];

                if (($scope.account.error && !datacentersResult.error) || (keysResult.error && !datacentersResult.error)) {
                    $scope.loading = false;
                    PopupDialog.errorObj(keysResult.error ? keysResult.error : {error: 'SDC call timed out. Please refresh the page.'});
                    return;
                }

                if (!keysResult.error) {
                    $scope.keys = keysResult;
                }
                if (datacentersResult.error) {
                    PopupDialog.errorObj(datacentersResult.error);
                } else {
                    $scope.datacenters = datacentersResult;
                }
                if (simpleImagesResult.error) {
                    PopupDialog.errorObj(simpleImagesResult.error);
                } else {
                    simpleImages = simpleImagesResult.images;
                    networks = simpleImagesResult.networks;
                }

                if (!$scope.account.provisionEnabled) {
                    addProvisionStep({
                        name: ACCOUNT_STEP_NAME,
                        template: 'machine/static/partials/wizard-account-info.html'
                    });
                }

                if ($scope.keys.length <= 0) {
                    addProvisionStep({
                        name: SSH_STEP_NAME,
                        template: 'machine/static/partials/wizard-ssh-key.html'
                    });
                }
                if ($scope.isProvisioningLimitsEnable) {
                    $scope.machines = [];
                    if (machinesResult.error) {
                        PopupDialog.errorObj(machinesResult.error);
                    } else {
                        $scope.machines = machinesResult;
                    }
                    $scope.machines.forEach(function (machine) {
                        Image.image(machine.image).then(function (dataset) {
                            $scope.limits.forEach(function (limit) {
                                if (limit.datacenter === machine.datacenter && limit.name === dataset.name) {
                                    limit.limit--;
                                    limit.dataset = dataset.id;
                                }
                            });

                        });
                    });
                }
                if($scope.isProvisioningLimitsEnable) {
                    $scope.limits = [];
                    if (limitsResult.error) {
                        PopupDialog.errorObj(limitsResult.error);
                    } else {
                        $scope.limits = limitsResult;
                    }

                }
                if ($scope.features.freetier === 'enabled') {
                    $scope.freeTierOptions = [];
                    if (freeTierOptionsResult.error) {
                        PopupDialog.errorObj(freeTierOptionsResult.error);
                    } else {
                        $scope.freeTierOptions = freeTierOptionsResult;
                    }
                    if ($scope.freeTierOptions.valid) {
                        setupSimpleImages($scope.freeTierOptions, networks, true);
                    }
                }
                setupSimpleImages(simpleImages, networks);
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
                    $scope.preSelectedImage = Image.image({id: $scope.preSelectedImageId, datacenter: $rootScope.commonConfig('datacenter')});
                    $q.when($scope.preSelectedImage).then(function (image) {
                        var datacenter = null;
                        if (externalInstanceParams) {
                            datacenter = requestContext.getParam('dc');
                        } else if (image && image.datacenter) {
                            datacenter = image.datacenter;
                        }
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
                    if (provisionBundle.manualCreate) {
                        $scope.data = provisionBundle.machine;
                        $scope.indexPackageTypes = provisionBundle.indexPackageTypes;
                        $scope.packageTypes = provisionBundle.packageTypes;
                        $scope.packages = provisionBundle.packages;

                        $scope.datacenters = provisionBundle.datacenters;
                        $scope.selectedDataset = provisionBundle.selectedDataset;
                        $scope.datasetType = provisionBundle.datasetType;

                        $scope.selectedPackage = $scope.data.package;
                        $scope.selectedNetworks = $scope.data.networks;

                        $scope.showFinishConfiguration = true;
                        $scope.selectedPackageInfo = provisionBundle.selectedPackageInfo;

                        $scope.instanceType = 'Public';
                        $scope.filterModel = provisionBundle.filterModel;
                        $scope.filterProps = provisionBundle.filterProps;
                        $scope.filterValues = provisionBundle.filterValues;
                        $scope.reconfigure(REVIEW_STEP);
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
                        deleteProvisionStep(ACCOUNT_STEP_NAME);
                        if ($scope.sshModel.isSSHStep) {
                            sshStepIndex = 3;
                            $scope.setCurrentStep(sshStepIndex);
                        }
                    }, 600);
                }

            });

            $scope.$on('ssh-form:onKeyUpdated', function (event, keys) {
                $scope.keys = keys;
                if (keys.length > 0 && $scope.currentStep !== REVIEW_STEP_NAME && $scope.currentStep !== SSH_STEP_NAME) {
                    deleteProvisionStep(SSH_STEP_NAME);
                } else {
                    addProvisionStep({
                        name: SSH_STEP_NAME,
                        template: 'machine/static/partials/wizard-ssh-key.html'
                    });
                }
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


            var nextStep = function (step) {
                var isNextStep = step - $scope.currentSlidePageIndex === 1;
                if (isNextStep) {
                    $scope.setCurrentStep(step);
                    $scope.slideCarousel();
                }
                return isNextStep;
            };

            var prepareProvision = function () {
                $scope.sshModel.isSSHStep = $scope.keys.length === 0;
                if (!$scope.account.provisionEnabled || $scope.sshModel.isSSHStep) {
                    nextStep(3);
                    return;
                }
                provision();
            };

            $scope.clickProvision = function () {
                // add networks to data
                $scope.data.networks = ($scope.selectedNetworks.length > 0) ? $scope.selectedNetworks : '';

                if ($scope.preSelectedImageId && $location.search().specification === 'dockerhost') {
                    var isPublicNetworkChecked = $scope.networks.some(function (network) {
                        return network.public && network.active;
                    });
                    if (!isPublicNetworkChecked) {
                        PopupDialog.message('Message', 'Cannot create Docker host without Public network. Please select Public network.');
                        return;
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
                        $rootScope.commonConfig('datacenter', datacenterName);
                    }
                });
            };

            $scope.selectOpsys = function (name) {
                if (name && (name !== $scope.data.opsys)) {
                    $scope.data.opsys = name;
                }
            };

            $scope.sortPackages = function (pkg) {
                return parseInt(pkg.memory, 10);
            };

            function setNetworks (datacenter) {
                function configureNetworks (val) {
                    $scope.networks = ['',''];
                    $scope.selectedNetworks.length = 0;
                    var confNetwork = {
                        'Joyent-SDC-Private': 0,
                        'Joyent-SDC-Public': 1
                    };
                    val.forEach(function (network) {
                        var orderedNetwork = confNetwork[network.name];
                        network.active = orderedNetwork > -1;
                        if (orderedNetwork > -1) {
                            $scope.networks[orderedNetwork] = network;
                            $scope.selectNetwork(network.id);
                        } else {
                            $scope.networks.push(network);
                        }
                    });
                    $scope.networks = $scope.networks.filter(function(e){return e;});
                }

                if ($scope.datacenterForNetworks === datacenter && $scope.networks.length > 0) {
                    configureNetworks($scope.networks);
                } else {
                    $scope.datacenterForNetworks = datacenter;
                    Network.network(datacenter).then(function (result) {
                        configureNetworks(result);
                        if ($scope.networks.length === 0) {
                            loggingService.log('warn', 'Networks are not loaded for datacenter: ' + datacenter);
                        }
                    }, function (err) {
                        PopupDialog.errorObj(err);
                    });
                }
            }

            $scope.reconfigure = function (step) {
                $scope.showReConfigure = false;
                $scope.showFinishConfiguration = false;
                if (step === CHOOSE_IMAGE_STEP) {
                    ng.element('#filterProperty').val('No filter');
                    $scope.preSelectedImage = null;
                    $scope.preSelectedImageId = null;
                    $location.search('specification', null);
                }
                if (step !== REVIEW_STEP) {
                    if ($scope.networks && $scope.networks.length) {
                        setNetworks($scope.data.datacenter);
                    }

                    var provisionForm = $scope.$$childTail.$$childTail && $scope.$$childTail.$$childTail.provisionForm;
                    if (provisionForm) {
                        provisionForm.machineName.$setValidity('machineName', true);
                        provisionForm.machineName.$setValidity('machineUnique', true);
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
                $scope.setCurrentStep(step);
                ng.element('.carousel-inner').scrollTop($scope.previousPos);
                if ($scope.features.instanceMetadata === 'enabled') {
                    ng.element('#metadata-configuration').fadeOut('fast');
                }
                ng.element('#network-configuration').fadeOut('fast');
                ng.element('.carousel').carousel(step);
                if ($scope.keys.length > 0) {
                    deleteProvisionStep(SSH_STEP_NAME);
                }
                $scope.preSelectedData = null;
            };

            function getNr(el) {
                el = String(el).replace(/,/g, '');
                if (!el || isNaN(el)) {
                    return false;
                }
                return Number(el);
            }

            $scope.setCurrentStep = function (index) {
                $scope.currentSlidePageIndex = index;
                $scope.currentStep = ng.element('.active-step').find('.current-step').eq(0).text();
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

            $scope.selectLastDataset = function (dataset) {
                var datasetVisibility = dataset.public ? 'public' : 'custom';
                var versions = $scope.versions[datasetVisibility][dataset.name];
                $scope.selectDataset(versions[$scope.listVersions[datasetVisibility][dataset.name].slice(-1)[0]].id);
            };

            $scope.selectDataset = function (id, changeDataset) {
                Image.image({ id: id, datacenter: $scope.data.datacenter }).then(function (dataset) {
                    if (dataset.type == 'virtualmachine') {
                        $scope.datasetType = 'kvm';
                    } else if (dataset.type == 'smartmachine') {
                        $scope.datasetType = 'smartos';
                    } else {
                        $scope.datasetType = dataset.type;
                    }

                    ng.element('#next').trigger('click');
                    ng.element('#step-configuration').fadeIn('fast');
                    dataset.visibility = dataset.public ? 'public' : 'custom';
                    $scope.selectedDataset = dataset;
                    ng.element('#pricing').removeClass('alert-muted');
                    ng.element('#pricing').addClass('alert-info');

                    $scope.data.dataset = dataset.id;
                    $scope.filterModel.searchText = '';

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
                        $q.when($scope.freeTierOptions).then(function (freeTierOptions) {
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
                        $scope.setCurrentStep(SELECT_PACKAGE_STEP);
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
                        $scope.filterModel.key = $scope.filterProps[0];
                        $scope.onFilterChange($scope.filterModel.key);
                    }

                    var datasetVisibility = dataset.public ? 'public' : 'custom';
                    var listVersions = $scope.listVersions[datasetVisibility][dataset.name];
                    var versions = $scope.versions[datasetVisibility][dataset.name];
                    var filteredVersions = [];
                    listVersions.forEach(function (version) {
                        if (versions[version].public === dataset.public) {
                            filteredVersions.push(versions[version]);
                        }
                    });
                    $scope.filteredVersions = filteredVersions.reverse();
                });
            };

            $scope.selectVersion = function (version) {
                if (typeof (version) === 'string') {
                    version = JSON.parse(version);
                }
                $scope.selectDataset(version.id, true);
            };

            $scope.selectPackageType = function (packageType) {
                $scope.packageType = packageType;
            };

            $scope.filterDatasets = function (item) {
                if (!$scope.filterModel.searchText) {
                    return true;
                }
                var props = [ 'name', 'description' ];
                return props.some(function (prop) {
                    if (item[prop] && item[prop].toLowerCase().indexOf($scope.filterModel.searchText.toLowerCase()) !== -1) {
                        return true;
                    }
                    return false;
                });
            };

            $scope.filterDatasetsByOS = function (item) {
                if ($scope.data.opsys !== 'All' && !item.os.match($scope.data.opsys)) {
                    return false;
                }
                return true;
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
                    Machine.setCreateInstancePage('');
                } else if (type === 'Saved') {
                    $location.path('/compute/create/custom');
                    Machine.setCreateInstancePage('custom');
                }
            };

            $scope.selectPackage = function (id) {
                $scope.data.name = null;
                Package.package({ id: id, datacenter: $scope.data.datacenter }).then(function (pkg) {
                    $scope.showFinishConfiguration = true;
                    $scope.selectedPackage = id;
                    $scope.selectedPackageInfo = pkg;

                    $scope.data.package = pkg.id;
                });
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
                if ($scope.preSelectedData && $scope.preSelectedData.selectedPackageInfo && $scope.selectedPackage !== $scope.preSelectedData.selectedPackageInfo.id) {
                    $scope.selectedPackageInfo = $scope.preSelectedData.selectedPackageInfo;
                    if (!$scope.selectedPackage) {
                        $scope.selectPackage($scope.preSelectedData.selectedPackageInfo.id);
                    } else {
                        $scope.selectPackage($scope.selectedPackage);
                    }
                    $scope.reviewPage();
                } else if (!$scope.preSelectedData) {
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
                            accordion.find('.panel-collapse.collapse').has('div.active').addClass('in').parent().find('a.collapsed').removeClass('collapsed');
                        } else {
                            $scope.collapsedPackageTypes = [];
                            accordion.find('.collapse').addClass('in').end()
                                .find('a.collapsed').removeClass('collapsed');
                        }
                    });
                }
            };


            $scope.selectFilterType = function (name) {
                if (name && (name !== $scope.filterModel.key)) {
                    $scope.filterModel.key = name;
                    $scope.preSelectedData = null;
                    $scope.onFilterChange(name);
                }
            };
            $scope.selectFilterValue = function (name) {
                if (name && (name !== $scope.filterModel.value)) {
                    $scope.filterModel.value = name;
                    $scope.onFilterChange();
                }
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

            function processDatasets(datasets) {
                var listVersions = {
                    public: {},
                    custom: {}
                };
                var versions = {
                    public: {},
                    custom: {}
                };
                var selectedVersions = {
                    public : {},
                    custom : {}
                };
                var manyVersions = {
                    public : {},
                    custom : {}
                };
                var operating_systems = {All: 1};

                $scope.datasetsLoading = false;

                datasets.forEach(function (dataset) {
                    operating_systems[dataset.os] = 1;

                    var datasetName = dataset.name;
                    var datasetVersion = dataset.version;
                    var datasetVisibility = dataset.public ? 'public' : 'custom';
                    dataset.limit = checkLimit(dataset.id);
                    var datasetListVersions = listVersions[datasetVisibility][datasetName] = listVersions[datasetVisibility][datasetName] || [];
                    var datasetVersions = versions[datasetVisibility][datasetName];

                    if (!datasetVersions) {
                        datasetVersions = versions[datasetVisibility][datasetName] = {};
                        datasetVersions[datasetVersion] = dataset;
                        datasetListVersions = listVersions[datasetVisibility][datasetName] = [];
                        datasetListVersions.push(datasetVersion);
                    } else {
                        if (!datasetVersions[datasetVersion]) {
                            manyVersions[datasetVisibility][datasetName] = true;
                            datasetVersions[datasetVersion] = dataset;
                            datasetListVersions.push(datasetVersion);
                        }
                    }
                    if (datasetListVersions.length > 1) {
                        datasetListVersions.sort(function (a, b) {
                            return util.cmpVersion(a, b);
                        });
                    }

                    var filterVersions = function (imageName, isPublic) {
                        var result = [];
                        var visibility = isPublic ? 'public' : 'custom';
                        if (!listVersions[visibility][imageName]) {
                            return result;
                        }
                        listVersions[visibility][imageName].forEach(function (value) {
                            result.push(versions[visibility][imageName][value]);
                        });

                        return result;
                    };
                    selectedVersions.public[datasetName] = filterVersions(datasetName, true);
                    selectedVersions.custom[datasetName] = filterVersions(datasetName, false);
                });

                var customDatasets = Object.keys(selectedVersions.custom)
                    .map(function (item) { return selectedVersions.custom[item].pop(); });

                var publicDatasets = Object.keys(selectedVersions.public)
                    .map(function (item) { return selectedVersions.public[item].pop(); });

                $scope.operating_systems = Object.keys(operating_systems);
                $scope.datasets = publicDatasets.concat(customDatasets).filter(function (n) { return n; });
                $scope.versions = versions;
                $scope.listVersions = listVersions;
                $scope.manyVersions = manyVersions;
                $scope.selectedVersions = selectedVersions;

                if ($scope.preSelectedImage) {
                    $scope.preSelectedImage.then(function (image) {
                        $scope.selectVersion(image);
                    })
                }
            }

            function processPackages(newDatacenter, packages) {
                if (newDatacenter !== $scope.data.datacenter) {
                    return;
                }

                if ($scope.isDockerHost && $scope.features.dockerMemoryLimit === 'enabled') {
                    packages = packages.filter(function (p) {
                        return p.memory >= DOCKERHOST_MINIMUM_MEMORY;
                    });
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
                    $scope.selectDataset($scope.preSelectedImageId, externalInstanceParams);

                    if (externalInstanceParams) {
                        $scope.selectPackage(requestContext.getParam('package'));
                        $scope.reconfigure(REVIEW_STEP);
                    }
                }
            }

            function processRecentInstances(recentInstances, datasets) {
                recentInstances = ng.copy(recentInstances);
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
                    var instanceDataset = datasets.find(function (image) {
                        return image.id === instance.dataset;
                    });

                    var datasetVisibility = instanceDataset && (instanceDataset.public ? 'public' : 'custom');
                    if (instanceDataset && $scope.manyVersions[datasetVisibility][instance.datasetName]) {
                        var datasetId = null;
                        var datasetDescription = '';
                        var publishedAt = 0;
                        var latestVersion = 0;
                        var versions = $scope.versions[datasetVisibility][instance.datasetName];

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

                    if (instanceDataset && instanceDataset.state === 'active' && (!unique[instance.dataset] || unique[instance.dataset].package !== instance.package)) {
                        uniqueRecentInstances.push(instance);
                        unique[instance.dataset] = instance;
                    }
                });

                $scope.recentInstances = uniqueRecentInstances.filter(function (instance) {
                    return instance.memory !== undefined;
                });
            }

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
                                'CloudAPI is not responding in the {{name}} data center. Our operations team is investigating.',
                                { name: datacenter }
                            )
                        );
                        if (!err || (err && err.restCode !== 'NotAuthorized')) {
                            $scope.data.datacenter = firstNonSelected.name;
                            $('#selectDatacenter').select2('val', firstNonSelected.name);
                        }
                    }
                }
            };

            // Watch datacenter change
            $scope.$watch('data.datacenter', function (newVal, oldVal) {
                if (newVal && newVal !== oldVal) {
                    $scope.reloading = true;
                    $scope.datasetsLoading = true;
                    $qe.every([
                        $q.when(Image.image({ datacenter: newVal })),
                        $q.when(Package.package({ datacenter: newVal })),
                        $q.when(getCreatedMachines())
                    ]).then(function (result) {
                        var datasetsResult = result[0];
                        var packagesResult = result[1];
                        var packages;
                        var datasets;
                        var isAvailableSwitchDatacenter = true;
                        if (datasetsResult.error) {
                            isAvailableSwitchDatacenter = datasetsResult.error.restCode !== 'NotAuthorized';
                            PopupDialog.errorObj(datasetsResult.error);
                            datasets = [];
                        } else {
                            datasets = datasetsResult;
                        }
                        if (packagesResult.error) {
                            isAvailableSwitchDatacenter = packagesResult.error.restCode !== 'NotAuthorized';
                            PopupDialog.errorObj(packagesResult.error);
                            packages = [];
                        } else {
                            packages = packagesResult;
                        }
                        processDatasets(datasets);
                        processPackages(newVal, packages);
                        if (isAvailableSwitchDatacenter && datasets.length === 0 && packages.length === 0) {
                            switchToOtherDatacenter(newVal);
                        } else {
                            setNetworks(newVal);
                        }
                        if ($scope.isRecentInstancesEnabled) {
                            processRecentInstances(result[2], datasets);
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

            ng.element('#provisionCarousel').bind({
                slide: function () {
                    $scope.reConfigurable = !$scope.reConfigurable;
                    if ($scope.reConfigurable) {
                        $timeout(function () {
                            $scope.showReConfigure = true;
                        });
                    }
                }
            });


            $scope.slideCarousel = function () {
                $scope.previousPos = ng.element('.carousel-inner').scrollTop();
                ng.element('.carousel-inner').scrollTop(0);
                ng.element('.carousel').carousel('next');
            };

            $scope.zenboxDialog = function (params) {
                var props = ng.extend({}, $rootScope.zenboxParams, params);
                window.Zenbox.show(null, props);
            };

            $scope.reviewPage = function () {
                setTimeout(function () {
                    ng.element('input[name="machineName"]').focus();
                }, 5);
                if ($scope.selectedPackageInfo && $scope.selectedPackageInfo.createdBySupport) {
                    var returnUrl = $location.path();
                    Account.checkProvisioning({btnTitle: 'Submit and Create Instance'}, function () {
                        var el = $scope.selectedPackageInfo;
                        $scope.zenboxDialog({
                            dropboxID: $rootScope.zenboxParams.dropboxOrderPackageId || $rootScope.zenboxParams.dropboxID,
                            request_subject: 'I want to order ' + el.description + ' compute instance',
                            request_description: 'API Name: ' + el.name
                        });
                        loggingService.log('info', 'User is ordering instance package from support', el);
                    }, ng.noop, function (isSuccess) {
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
                Machine.setCreateInstancePage('simple');
            };

            $scope.goTo = function (path) {
                $location.path(path);
                $location.replace();
            };

            $scope.selectDataValue = function (name) {
                var dataValue = 'No matches found';
                if (name === 'os' && $scope.operating_systems) {
                    dataValue = $scope.data.opsys;
                }
                return dataValue;
            };

        }

    ]);
}(window.JP.getModule('Machine'), window.angular));
