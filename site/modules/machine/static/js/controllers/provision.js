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
        'Limits',
        'errorContext',

        function ($scope, $filter, requestContext, $timeout, Machine, Dataset, Datacenter, Package, Account, Network, Image, $location, localization, $q, $$track, PopupDialog, $cookies, $rootScope, FreeTier, $compile, loggingService, util, Limits, errorContext) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.provision', $scope, {
                title: localization.translate(null, 'machine', 'Create Instances on Joyent')
            });
            var SELECT_PACKAGE_STEP = 1;
            var REVIEW_STEP = 2;
            var REVIEW_STEP_NAME = 'Review';
            var ACCOUNT_STEP_NAME = 'Account Information';
            var SSH_STEP_NAME = 'SSH Key';

            $scope.setCreateInstancePage = Machine.setCreateInstancePage;
            $scope.provisionSteps = [
                {
                    name: 'Choose Image',
                    template: 'machine/static/partials/wizard-choose-image.html'
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
            $scope.filterModel = {};
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
                                name: ACCOUNT_STEP_NAME,
                                template:'machine/static/partials/wizard-account-info.html'
                            }
                    );
                }
            });
            $scope.isProvisioningLimitsEnable = $scope.features.provisioningLimits === 'enabled';
            $scope.getLimits = [];

            function getUserLimits () {
                var deferred = $q.defer();
                Limits.getUserLimits(function (error, limits) {
                    if (error) {
                        PopupDialog.error('Error', error);
                        deferred.resolve([]);
                    }
                    deferred.resolve(limits);
                });
                return deferred.promise;
            }

            if ($scope.isProvisioningLimitsEnable) {
                $scope.getLimits = getUserLimits();
            }

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
            var externalInstanceParams = requestContext.getParam('dc') && requestContext.getParam('package');

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

            var recentMachines = getCreatedMachines();

            function setupSimpleImages (simpleImages, networks, isFree) {
                if (simpleImages && simpleImages.length > 0) {
                    if ($scope.datacenters && $scope.datacenters.length > 0) {
                        $scope.datacenters.forEach(function (datacenter) {
                            Package.package({ datacenter: datacenter.name }).then(function (packages) {
                                var packagesByName = {};
                                packages.forEach(function (pkg) {
                                    packagesByName[pkg.name] = pkg.id;
                                });
                                angular.copy(simpleImages).forEach(function (image) {
                                    var params = {
                                        datacenter: datacenter.name
                                    };
                                    params.name = image.datasetName;
                                    params.forceMajorVersion = image.forceMajorVersion;
                                    if (isFree && image.datacenters.indexOf(datacenter.name) === -1) {
                                        return;
                                    }
                                    Dataset.datasetBySimpleImage(params).then(function (dataset) {
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

            function checkLimit (dataset) {
                return $scope.isProvisioningLimitsEnable && $scope.limits.some(function (limit) {
                    return (limit.dataset === dataset && limit.limit < 1);
                });
            }

            $q.all([
                $q.when(Account.getKeys()),
                $q.when(Datacenter.datacenter()),
                $q.when($scope.preSelectedImage),
                $q.when(Machine.getSimpleImgList()),
                $q.when($scope.freeTierOptions),
                $q.when(recentMachines),
                $q.when(Machine.machine()),
                $q.when($scope.getLimits)
            ]).then(function (result) {
                $scope.keys = result[0];
                if ($scope.keys.length <= 0) {
                    $scope.provisionSteps.push(
                            {
                                name: SSH_STEP_NAME,
                                template: 'machine/static/partials/wizard-ssh-key.html'
                            }
                    );
                }
                $scope.submitTitle = $scope.keys.length > 0 ? 'Create Instance' : 'Next';
                $scope.datacenters = result[1];
                $scope.simpleImages = [];
                $scope.freeTierOptions = result[4];
                $scope.datasetsInfo = [];
                $scope.limits = result[7];
                if ($scope.isProvisioningLimitsEnable) {
                    $scope.machines = result[6];
                    $scope.machines.forEach(function (machine) {
                        Dataset.dataset(machine.image).then(function (dataset) {
                            $scope.limits.forEach(function (limit) {
                                if (limit.datacenter === machine.datacenter && limit.name === dataset.name) {
                                    limit.limit--;
                                    limit.dataset = dataset.id;
                                }
                            });

                        });
                    });
                }
                var simpleImages = result[3].images;
                var networks = result[3].networks;
                if ($scope.features.freetier === 'enabled') {
                    var freeImages = result[4];
                    if (freeImages.valid) {
                        setupSimpleImages(freeImages, networks, true);
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
                    $scope.preSelectedImage = Image.image($scope.preSelectedImageId);
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

            function deleteProvisionStep(stepName) {
                $scope.provisionSteps = $scope.provisionSteps.filter(function (item) {
                    return item.name !== stepName;
                });
            }

            $scope.$on('creditCardUpdate', function () {
                $scope.account.provisionEnabled = true;
                if ($scope.keys.length > 0) {
                    $scope.clickProvision();
                } else {
                    $scope.setCurrentStep(4);
                    $scope.slideCarousel();
                    $timeout(function () {
                        deleteProvisionStep(ACCOUNT_STEP_NAME);
                        $scope.setCurrentStep(3);
                    }, 600);
                }

            });

            $scope.$on('ssh-form:onKeyUpdated', function (event, keys) {
                var sshStepExists = $scope.provisionSteps.some(function (step) {
                    return step.name === SSH_STEP_NAME;
                });

                if (!sshStepExists && keys.length === 0) {
                    $scope.provisionSteps.push(
                        {
                            name: SSH_STEP_NAME,
                            template: 'machine/static/partials/wizard-ssh-key.html'
                        }
                    );
                }
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
                    //we can return this back when make ssh not required for windows
                    if ($scope.keys.length === 0 /* && osByDatasets[machineData.dataset] !== 'windows' */) {
                        $rootScope.commonConfig('provisionBundle', {
                            manualCreate: false,
                            allowCreate: false,
                            machine: machineData
                        });
                        $location.path('/compute/ssh');
                    } else {
                        Machine.provisionMachine(machineData).done(function (err, job) {
                            var quotaExceededHeader = 'QuotaExceeded: ';
                            if (err && err.message && err.message.indexOf(quotaExceededHeader) === 0) {
                                $location.path('/dashboard');
                                PopupDialog.error(null, err.message.substr(quotaExceededHeader.length), function () {
                                    $scope.zenboxDialog({
                                        request_subject: 'Please raise my provisioning limits'
                                    });
                                });
                                return;
                            }

                            var newMachine = job.__read();
                            if ($scope.features.freetier === 'enabled') {
                                // TODO It seems like an extra call because we already have $scope.freetierOptions. Need to get rid of extra calls
                                $scope.freetier = FreeTier.freetier();
                            }
                            $q.when(Machine.machine(), function (listMachines) {
                                if (newMachine.id) {
                                    $q.when(Machine.checkFirstInstanceCreated(newMachine.id), function (uuid) {
                                        if (!uuid || typeof (uuid) === 'object') {
                                            $$track.marketo_machine_provision($scope.account);
                                        }
                                    });
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

                        $location.path('/compute');
                    }
                };
                var submitBillingInfo = {btnTitle: 'Next'};
                if ($scope.keys.length > 0) {
                    submitBillingInfo.btnTitle = 'Submit and Create Instance';
                    submitBillingInfo.appendPopupMessage = 'Provisioning will now commence.';
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
                                deleteProvisionStep(ACCOUNT_STEP_NAME);
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
                            filterModel: $scope.filterModel,
                            filterProps: $scope.filterProps,
                            filterValues: $scope.filterValues,
                            selectedPackageInfo: $scope.selectedPackageInfo,
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
                            loggingService.log('error', 'Unable to retrieve datacenters list.');
                            errorContext.emit(new Error(localization.translate(null,
                                'machine',
                                'Unable to retrieve datacenters list'
                            )));
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
                Network.network(datacenter).then(function (result){
                    $scope.networks = ['',''];
                    var confNetwork = {
                        'Joyent-SDC-Private': 0,
                        'Joyent-SDC-Public': 1
                    };
                    result.forEach(function (network) {
                        var orederedNetwork = confNetwork[network.name];
                        network.active = orederedNetwork > -1;
                        if (orederedNetwork > -1) {
                            $scope.networks[orederedNetwork] = network;
                            $scope.selectNetwork(network.id);
                        } else {
                            $scope.networks.push(network);
                        }
                    });
                    $scope.networks = $scope.networks.filter(function(e){return e;});
                    if ($scope.networks.length === 0) {
                        loggingService.log('warn', 'Networks are not loaded for datacenter: ' + datacenter);
                    }
                    $scope.selectedNetworks.length = 0;
                });
            }

            $scope.reconfigure = function (step) {
                $scope.showReConfigure = false;
                $scope.showFinishConfiguration = false;
                if (step !== REVIEW_STEP) {
                    if ($scope.networks && $scope.networks.length) {
                        $scope.networks.forEach(function (network) {
                            network.active = false;
                        });
                    }
                    $scope.metadata = [];
                    $scope.tags = [];

                    var provisionForm = $scope.$$childTail.$$childTail.provisionForm;
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
                if ($scope.currentSlidePageIndex === $scope.provisionSteps.length - 1) {
                    $scope.createInstanceTitle = null;
                }
            };

            function getNr(el) {
                el = String(el).replace(/,/g, '');
                if (!el || isNaN(el)) {
                    return false;
                }
                return Number(el);
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
                        $scope.filterModel.key = $scope.filterProps[0];
                        $scope.onFilterChange($scope.filterModel.key);
                    }


                    var listVersions = $scope.listVersions[dataset.name];
                    var versions = $scope.versions[dataset.name];
                    var filteredVersions = [];
                    listVersions.forEach(function (version) {
                        if (versions[version].public === dataset.public) {
                            filteredVersions.push(versions[version]);
                        }
                    });
                    $scope.filteredVersions = filteredVersions.reverse();

                    if (!$scope.networks.length) {
                        setNetworks($scope.data.datacenter);
                    }
                });
            };

            $scope.selectVersion = function (version) {
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
                    $scope.filterModel.value = $scope.filterValues[newVal][0];
                }
                selectMinimalPackage();

                setTimeout(function () {
                    var accordionGroup = ng.element('.accordion-group');
                    if ($scope.filterModel.key === 'No filter') {
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
                var listVersions = {};
                var versions = {};
                var selectedVersions = {
                    public : {},
                    custom : {}
                };
                var manyVersions = {};
                var operating_systems = {All: 1};

                $scope.datasetsLoading = false;
                datasets.forEach(function (dataset) {
                    operating_systems[dataset.os] = 1;
                    osByDatasets[dataset.id] = dataset.os;

                    var datasetName = dataset.name;
                    var datasetVersion = dataset.version;

                    dataset.limit = checkLimit(dataset.id);

                    if (!versions[datasetName]) {
                        versions[datasetName] = {};
                        versions[datasetName][datasetVersion] = dataset;
                        listVersions[datasetName] = [];
                        listVersions[datasetName].push(datasetVersion)
                    } else {
                        if (!versions[datasetName][datasetVersion]) {
                            manyVersions[datasetName] = true;
                            versions[datasetName][datasetVersion] = dataset;
                            listVersions[datasetName].push(datasetVersion)
                        }
                    }
                    if (listVersions[datasetName].length > 1) {
                        listVersions[datasetName].sort(function (a, b) {
                            return util.cmpVersion(a, b);
                        });
                    }

                    var filterVersions = function (datasetName, isPublic) {
                        var result = [];
                        listVersions[datasetName].forEach(function (value) {
                            if (versions[datasetName][value].public === isPublic) {
                                result.push(versions[datasetName][value]);
                            }
                        });
                        if (result.length > 0) {
                            result = result.slice(-1);
                        }
                        return result;
                    };
                    selectedVersions.public[datasetName] = filterVersions(datasetName, true);
                    selectedVersions.custom[datasetName] = filterVersions(datasetName, false);
                });

                var customDatasets = Object.keys(selectedVersions.custom)
                    .map(function (item) { return selectedVersions.custom[item][0]; });

                var publicDatasets = Object.keys(selectedVersions.public)
                    .map(function (item) { return selectedVersions.public[item][0]; });

                $scope.operating_systems = Object.keys(operating_systems);
                $scope.datasets = publicDatasets.concat(customDatasets).filter(function (n) { return n; });
                $scope.versions = versions;
                $scope.listVersions = listVersions;
                $scope.manyVersions = manyVersions;
                $scope.selectedVersions = selectedVersions;

                if ($scope.preSelectedImage) {
                    $scope.selectVersion($scope.preSelectedImage);
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
                    $scope.selectDataset($scope.preSelectedImageId, externalInstanceParams);
                    if (externalInstanceParams) {
                        $scope.selectPackage(requestContext.getParam('package'));
                        $scope.reconfigure(REVIEW_STEP);
                    }
                }
            }

            function processRecentInstances(recentInstances, datasets) {
                recentInstances = angular.copy(recentInstances);
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

                    $q.all([
                        $q.when(Dataset.dataset({ datacenter: newVal })),
                        $q.when(Package.package({ datacenter: newVal })),
                        $q.when(getCreatedMachines())
                    ]).then(function (result) {
                        var datasets = result[0];
                        processDatasets(datasets);
                        processPackages(newVal, result[1]);
                        if ($scope.isRecentInstancesEnabled) {
                            processRecentInstances(result[2], datasets);
                        }
                        setNetworks(newVal);
                    });
                }
                $scope.reloading = false;
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
            
            $scope.zenboxDialog = function (params) {
                var props = angular.extend({}, $rootScope.zenboxParams, params, {
                    requester_name: $scope.account.firstName,
                    requester_email: $scope.account.email
                });
                window.Zenbox.show(null, props);
            };

            $scope.reviewPage = function () {
                if ($scope.selectedPackageInfo.createdBySupport) {
                    var el = $scope.selectedPackageInfo;
                    $scope.zenboxDialog({
                        dropboxID: $rootScope.zenboxParams.dropboxOrderPackageId || $rootScope.zenboxParams.dropboxID,
                        request_subject: 'I want to order ' + el.description + ' compute instance',
                        request_description: 'API Name: ' + el.name
                    });
                    loggingService.log('info', 'User is ordering instance package from support', el);
                } else {
                    $scope.slideCarousel();
                    $scope.setCurrentStep(2);
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

        }

    ]);
}(window.JP.getModule('Machine'), window.angular));
