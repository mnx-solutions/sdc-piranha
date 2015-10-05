'use strict';
(function (app, ng) {
    app.factory('Provision', ['$rootScope', '$q', '$filter', '$location', '$$track', 'Datacenter', 'Account', 'Machine',
        'Package', 'Image', 'FreeTier', 'Network', 'PopupDialog', 'Limits', 'loggingService', 'util',
        function ($rootScope, $q, $filter, $location, $$track, Datacenter, Account, Machine,
                  Package, Image, FreeTier, Network, PopupDialog, Limits, loggingService, util) {
            var service = {};

            var DOCKERHOST_MINIMUM_MEMORY = 512;
            var DTRACE_MINIMUM_HDD = 6144;
            var MAX_DTRACE_VERSION = '14.4.0';
            var QUOTA_EXCEEDED_HEADER = 'QuotaExceeded: ';

            var IsEnabled = {
                manta: $rootScope.features.manta === 'enabled',
                recentInstances: $rootScope.features.recentInstances === 'enabled',
                provisioningLimits: $rootScope.features.provisioningLimits === 'enabled',
                dockerMemoryLimit: $rootScope.features.dockerMemoryLimit === 'enabled',
                dtraceHDDLimit: $rootScope.features.dtraceHDDLimit === 'enabled'
            };

            var datacenterForNetworks = '';
            var networks = [];
            var limits = [];
            var freeTierOptions = [];

            var commonVersions = {
                public: {},
                custom: {}
            };

            var listVersions;
            var versions;
            var selectedVersions;
            var manyVersions;
            var limitsLoadingJob = null;

            function clearVersionsObjects () {
                listVersions = ng.copy(commonVersions);
                versions = ng.copy(commonVersions);
                selectedVersions = ng.copy(commonVersions);
                manyVersions = ng.copy(commonVersions);
            }
            clearVersionsObjects();

            var getUserLimits = function () {
                if (limitsLoadingJob) {
                    return limitsLoadingJob.promise;
                }

                limitsLoadingJob = $q.defer();
                Limits.getUserLimits(function (error, result) {
                    if (error) {
                        PopupDialog.errorObj(error);
                        limitsLoadingJob.resolve([]);
                    } else {
                        limits = result;
                        Machine.machine().forEach(function (machine) {
                            Image.image(machine.image).then(function (dataset) {
                                limits.forEach(function (limit) {
                                    if (limit.datacenter === machine.datacenter && limit.name === dataset.name) {
                                        limit.limit -= 1;
                                        limit.dataset = dataset.id;
                                    }
                                });
                            });
                        });
                        limitsLoadingJob.resolve(limits);
                    }
                });

                return limitsLoadingJob.promise;
            };

            var checkLimit = function (dataset, loaded) {
                if (limits.length || loaded) {
                    return IsEnabled.provisioningLimits && limits.some(function (limit) {
                        return (limit.dataset === dataset && limit.limit < 1);
                    });
                } else {
                    return IsEnabled.provisioningLimits && getUserLimits().then(function () {
                        return checkLimit(dataset, true);
                    });
                }
            };

            service.getCreatedMachines = function () {
                var deferred = $q.defer();
                if (IsEnabled.manta && IsEnabled.recentInstances) {
                    Account.getUserConfig('createdMachines', function (config) {
                        var recentInstances = config.createdMachines || [];
                        if (recentInstances.length > 0) {
                            recentInstances.sort(function (a, b) {
                                // if provisionsCount are equal take the newer one
                                return b.provisionsCount - a.provisionsCount || b.creationDate - a.creationDate;
                            });
                        }
                        deferred.resolve(recentInstances);
                    });
                } else {
                    deferred.resolve([]);
                }
                return deferred.promise;
            };

            service.setupSimpleImages = function (datacenters) {
                var setup = function (simpleImages, networks, isFree) {
                    var def = $q.defer();
                    var result = [];
                    if (simpleImages && simpleImages.length > 0 && datacenters && datacenters.length > 0) {
                        datacenters.forEach(function (datacenter) {
                            Package.package({datacenter: datacenter.name}).then(function (packages) {
                                var packagesByName = {};
                                packages.forEach(function (pkg) {
                                    packagesByName[pkg.name] = pkg.id;
                                });
                                var promises = [];
                                ng.copy(simpleImages).forEach(function (image) {
                                    var deferred = $q.defer();
                                    var params = {
                                        datacenter: datacenter.name
                                    };
                                    params.name = image.datasetName;
                                    params.type = image.datasetType;
                                    params.forceMajorVersion = image.forceMajorVersion;
                                    if (isFree && image.datacenters.indexOf(datacenter.name) === -1) {
                                        return;
                                    }
                                    Image.simpleImage(params).then(function (dataset) {
                                        if (dataset && dataset.id) {
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
                                                simpleImage.imageData.freeTierValidUntil = simpleImages.validUntil;
                                                simpleImage.order = 0;
                                            } else {
                                                simpleImage = image;
                                                simpleImage.description.text = dataset.description || simpleImage.description.text;
                                                simpleImage.imageData = {};
                                                simpleImage.imageData.package = packagesByName[simpleImage.packageName];
                                                simpleImage.imageData.networks = networks;
                                            }
                                            simpleImage.imageData.dataset = dataset.id;
                                            simpleImage.imageData.datacenter = datacenter.name;
                                            simpleImage.imageData.name = '';
                                            delete simpleImage.packageName;
                                            delete simpleImage.datasetName;
                                            if (simpleImage.imageData.package) {
                                                simpleImage.limit = checkLimit(simpleImage.imageData.dataset);
                                                result.push(simpleImage);
                                            }
                                            deferred.resolve();
                                        } else {
                                            deferred.resolve();
                                        }
                                    });
                                    promises.push(deferred.promise);
                                });
                                $q.all(promises).then(function () {
                                    def.resolve(result);
                                }, function (error) {
                                    def.reject(error);
                                });
                            });
                        });
                    } else {
                        def.resolve(result);
                    }
                    return def.promise;
                };

                var deferred = $q.defer();
                var task = [Machine.getSimpleImgList()];
                if ($rootScope.features.freetier === 'enabled') {
                    task.push(FreeTier.freetier());
                }

                function errorTask (error) {
                    deferred.reject(error);
                }

                $q.all(task).then(function (taskResult) {
                    var networks = taskResult[0].networks;
                    freeTierOptions = taskResult[1] || [];
                    var setupTask = [setup(taskResult[0].images, networks)];

                    if (freeTierOptions.length && freeTierOptions.valid) {
                        setupTask.push(setup(freeTierOptions, networks, true));
                    }

                    $q.all(setupTask).then(function (simpleImages) {
                        deferred.resolve({
                            simpleImages: simpleImages.length > 1 ? simpleImages[1].concat(simpleImages[0]) : simpleImages[0],
                            freeTierOptions: freeTierOptions
                        });
                    }, errorTask);
                }, errorTask);
                return deferred.promise;
            };

            service.processRecentInstances = function (recentInstances, datasets, packages) {
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

                    packages.forEach(function (pack) {
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
                    if (instanceDataset && manyVersions[datasetVisibility][instance.datasetName]) {
                        var datasetId = null;
                        var datasetDescription = '';
                        var publishedAt = 0;
                        var latestVersion = 0;

                        var versionsByDataset = versions[datasetVisibility][instance.datasetName];

                        for (var version in versionsByDataset) {
                            if (versionsByDataset[version].public) {
                                var currentVersion = versionsByDataset[version].version;
                                if (util.cmpVersion(latestVersion, currentVersion) < 0) {
                                    latestVersion = currentVersion;
                                    datasetId = versionsByDataset[version].id;
                                    datasetDescription = versionsByDataset[version].description;
                                }
                            } else {
                                var convertedDate = new Date(versionsByDataset[version]['published_at']).getTime();
                                if (convertedDate > publishedAt) {
                                    publishedAt = convertedDate;
                                    datasetId = versionsByDataset[version].id;
                                    datasetDescription = versionsByDataset[version].description;
                                }
                            }
                        }
                        instance.dataset = datasetId;
                        instance.description = datasetDescription;
                    }

                    if (instanceDataset && instanceDataset.state === 'active' &&
                        (!unique[instance.dataset] || unique[instance.dataset].package !== instance.package)) {

                        uniqueRecentInstances.push(instance);
                        unique[instance.dataset] = instance;
                    }
                });

                return uniqueRecentInstances.filter(function (instance) {
                    return instance.memory !== undefined;
                });
            };

            service.getNetworks = function (datacenter) {
                var deferred = $q.defer();
                function configureNetworks(val) {
                    networks = ['', ''];
                    var confNetwork = {
                        'Joyent-SDC-Private': 0,
                        'Joyent-SDC-Public': 1
                    };
                    val.forEach(function (network) {
                        if (!network) {
                            return;
                        }
                        var orderedNetwork = confNetwork[network.name];
                        network.active = orderedNetwork > -1;
                        if (orderedNetwork > -1) {
                            networks[orderedNetwork] = network;
                        } else {
                            networks.push(network);
                        }
                    });
                    deferred.resolve(networks);
                }

                if (datacenterForNetworks === datacenter && networks.length > 0) {
                    configureNetworks(networks);
                } else {
                    datacenterForNetworks = datacenter;
                    Network.network(datacenter).then(function (result) {
                        configureNetworks(result);
                        if (networks.length === 0) {
                            loggingService.log('warn', 'Networks are not loaded for data center: ' + datacenter);
                        }
                    }, function (err) {
                        PopupDialog.errorObj(err);
                        deferred.resolve([]);
                    });
                }
                return deferred.promise;
            };

            service.filterNetworks = function (datacenter, networks, callback) {
                Network.network(datacenter).then(function (dcNetworks) {
                    callback(networks.filter(function (network) {
                        return dcNetworks.some(function (dcNetwork) {
                            return dcNetwork.id === network;
                        });
                    }));
                }, function (err) {
                    PopupDialog.errorObj(err);
                });
            };

            service.processDatasets = function (datasets, callback) {
                clearVersionsObjects();
                var operatingSystems = {All: 1};

                datasets.forEach(function (dataset) {
                    var name = dataset.name;
                    var type = dataset.type;
                    var version = dataset.version;
                    var key = name + '-' + type;
                    var visibility = dataset.public ? 'public' : 'custom';
                    var datasetListVersions = listVersions[visibility][key] =
                        listVersions[visibility][key] || [];
                    var datasetVersions = versions[visibility][name];

                    if (dataset.os) {
                        operatingSystems[dataset.os] = 1;
                    }
                    dataset.limit = checkLimit(dataset.id);

                    if (!datasetVersions) {
                        datasetVersions = versions[visibility][name] = {};
                        datasetVersions[version] = dataset;
                        datasetListVersions = listVersions[visibility][key] = [];
                        datasetListVersions.push(version);
                    } else if (!datasetVersions[version]) {
                        manyVersions[visibility][name] = true;
                        datasetVersions[version] = dataset;
                        datasetListVersions.push(version);
                    }
                    if (datasetListVersions.length > 1) {
                        datasetListVersions.sort(util.cmpVersion);
                    }

                    var filterVersions = function (imageName, imageKey, isPublic) {
                        var result = [];
                        var visibility = isPublic ? 'public' : 'custom';
                        if (!listVersions[visibility][imageKey]) {
                            return result;
                        }
                        listVersions[visibility][imageKey].forEach(function (value) {
                            result.push(versions[visibility][imageName][value]);
                        });

                        return result;
                    };
                    selectedVersions.public[key] = filterVersions(name, key, true);
                    selectedVersions.custom[key] = filterVersions(name, key, false);
                });

                var customDatasets = Object.keys(selectedVersions.custom)
                    .map(function (item) { return selectedVersions.custom[item].pop(); });

                var publicDatasets = Object.keys(selectedVersions.public)
                    .map(function (item) { return selectedVersions.public[item].pop(); });

                callback({
                    operatingSystems: Object.keys(operatingSystems),
                    datasets: publicDatasets.concat(customDatasets).filter(function (n) { return n; }),
                    manyVersions: manyVersions,
                    selectedVersions: selectedVersions
                });
            };

            service.filterVersions = function (dataset, hostSpecification) {
                var datasetVisibility = dataset.public ? 'public' : 'custom';
                var listVersionsByDataset = listVersions[datasetVisibility][dataset.name + '-' + dataset.type];
                var versionsByDataset = versions[datasetVisibility][dataset.name];
                var filteredVersions = [];

                listVersionsByDataset.forEach(function (version) {
                    if (versionsByDataset[version].public === dataset.public &&
                        (hostSpecification !== 'dtracehost' || util.cmpVersion(MAX_DTRACE_VERSION, version) > 0)) {
                        filteredVersions.push(versionsByDataset[version]);
                    }
                });

                return filteredVersions;
            };

            service.getLastDatasetId = function (dataset) {
                var datasetVisibility = dataset.public ? 'public' : 'custom';
                var versionsByDataset = versions[datasetVisibility][dataset.name];
                return versionsByDataset[listVersions[datasetVisibility][dataset.name + '-' + dataset.type].slice(-1)[0]].id;
            };

            service.processPackages = function (packages, hostSpecification, callback) {
                if (hostSpecification === 'dockerhost' && IsEnabled.dockerMemoryLimit) {
                    packages = packages.filter(function (p) {
                        return p.memory >= DOCKERHOST_MINIMUM_MEMORY;
                    });
                } else if (hostSpecification === 'dtracehost') {
                    packages = packages.filter(function (p) {
                        return p.disk >= DTRACE_MINIMUM_HDD;
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
                    var price = util.getNr(p.price);
                    var priceMonth = util.getNr(p['price_month']);
                    p.price = (price || price === 0) && price.toFixed(3) || undefined;
                    p['price_month'] = (priceMonth || priceMonth === 0) && priceMonth.toFixed(2) || undefined;
                });

                var standardIndex = packageTypes.indexOf('Standard');
                if (standardIndex !== -1) {
                    packageTypes.splice(standardIndex, 1);
                    packageTypes.push('Standard');
                }

                callback({
                    indexPackageTypes: indexPackageTypes,
                    packageTypes: packageTypes,
                    packages: packages
                });
            };

            // TODO: need review
            service.selectDatacenter = function (name, callback) {
                Datacenter.datacenter().then(function (datacenters) {
                    var datacenterName = null;
                    if (datacenters.length > 0) {
                        var hasSpecifiedDatacenter = datacenters.some(function (datacenter) {
                            return datacenter.name === name;
                        });
                        if (hasSpecifiedDatacenter) {
                            datacenterName = name;
                        } else {
                            datacenterName = datacenters[0].name;
                        }
                    }
                    callback(datacenterName);
                });
            };

            service.isCurrentLocation = function (path) {
                return $location.path().search(path) > -1;
            };

            service.finalProvision = function (machine, datacenters, account, hostSpecification, callback) {
                if (machine && !machine.dataset) {
                    return PopupDialog.message('Error', 'Instance not found.');
                }
                // add flag for docker host
                if (hostSpecification) {
                    machine.specification = hostSpecification;
                    loggingService.log('info', 'Provisioning ' + machine.specification);
                }
                Machine.waitForCreatingMachinesToFinish(function (machines) {
                    Machine.provisionMachine(machine).done(function (err, job) {
                        callback();

                        if (err && err.message && err.message.indexOf('Free tier') > -1) {
                            var freeDatacenters = [];
                            var messagePart2 = '.';
                            datacenters.forEach(function (datacenter) {
                                var isFreeDatacenter = freeTierOptions.some(function (freeImage) {
                                    return freeImage.datacenters.indexOf(datacenter.name) !== -1;
                                });
                                if (isFreeDatacenter) {
                                    freeDatacenters.push(datacenter.name);
                                }
                            });
                            if (freeDatacenters.length > 0) {
                                freeDatacenters = freeDatacenters.join(', ');
                                messagePart2 = ', and you still have the capacity for free tier instances in ' +
                                    freeDatacenters + '.';
                            }
                            err.message = err.message + ' This limitation applies per data center' +
                                messagePart2;
                        }

                        if (err && err.message && err.message.indexOf(QUOTA_EXCEEDED_HEADER) === 0) {
                            var redirectUrl = '/compute/create/simple';
                            PopupDialog.error(null, err.message.substr(QUOTA_EXCEEDED_HEADER.length),
                                function () {
                                    if (err.message.indexOf('Free tier offering is limited') === -1) {
                                        redirectUrl = '/dashboard';
                                        service.zenboxDialog({
                                            'request_subject': 'Please raise my provisioning limits'
                                        });
                                    }
                                    $location.path(redirectUrl);
                                }
                            );
                            return;
                        }

                        var newMachine = job.__read();
                        if (newMachine.id && machine.freetier) {
                            var freeTierMachine = machines.find(function (machine) {
                                return machine.id === newMachine.id;
                            });
                            if (freeTierMachine) {
                                freeTierMachine.freetier = true;
                            }
                        }
                        $q.when(Machine.machine(), function (listMachines) {
                            if (newMachine.id && $rootScope.features.marketo === 'enabled') {
                                $q.when(Machine.checkFirstInstanceCreated(newMachine.id), function (uuid) {
                                    if (!uuid || typeof uuid === 'object') {
                                        $$track['marketo_machine_provision'](account);
                                    }
                                });
                            }
                            if (err && listMachines.length === 0) {
                                $location.path('/compute/create/simple');
                            }
                        });

                        if (!err && IsEnabled.manta && IsEnabled.recentInstances && !machine.freetier) {
                            Account.getUserConfig('createdMachines', function (config) {
                                config.createdMachines = config.createdMachines || [];
                                var creationDate = new Date(newMachine.created).getTime();
                                var listedMachine = config.createdMachines.find(function (m) {
                                    return m.dataset === machine.dataset &&
                                        m.package === machine.package;
                                });

                                if (listedMachine) {
                                    listedMachine.provisionsCount += 1;
                                    listedMachine.creationDate = creationDate;
                                } else {
                                    var createdMachine = {
                                        dataset: machine.dataset,
                                        package: machine.package,
                                        provisionsCount: 1,
                                        creationDate: creationDate
                                    };
                                    config.createdMachines.push(createdMachine);
                                }

                                Account.saveUserConfig();
                            });
                        }
                    });

                    $location.url('/compute');
                });
            };

            service.zenboxDialog = function (params) {
                var props = ng.extend({}, $rootScope.zenboxParams, params);
                window.Zenbox.show(null, props);
            };

            return service;
        }
    ]);
}(window.JP.getModule('Machine'), window.angular));
