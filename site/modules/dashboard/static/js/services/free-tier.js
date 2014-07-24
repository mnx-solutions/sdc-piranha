'use strict';
(function (app) {
    app.factory('FreeTier', [
        'serverTab',
        '$q',
        'Machine',
        'Datacenter',
        'Package',
        'Account',
        function (serverTab, $q, Machine, Datacenter, Package, Account) {
            var service = {};

            var freeTierOptionsCache = false;
            var freeTierOptions = function () {
                var deferred = $q.defer();
                if (!freeTierOptionsCache) {
                    serverTab.call({
                        name: 'ListFreeTierOptions',
                        done: function (err, job) {
                            freeTierOptionsCache = job.__read();
                            deferred.resolve(freeTierOptionsCache);
                        }
                    });
                } else {
                    deferred.resolve(freeTierOptionsCache);
                }
                return deferred.promise;
            };

            var listAllMachines = function () {
                var deferred = $q.defer();
                var pollMachines = function () {
                    var machines = Machine.machine();
                    if (machines.final) {
                        deferred.resolve(machines);
                    } else {
                        setTimeout(pollMachines, 100);
                    }
                };
                pollMachines();
                return deferred.promise;
            };

            var findPackageIdByName = function (packages, name) {
                var result = null;
                packages.forEach(function (packageObj) {
                    if (packageObj.name === name) {
                        result = packageObj.id;
                    }
                });
                return result;
            };

            var removeElement = function (arr, element) {
                var elementIndex = arr.indexOf(element);
                if (elementIndex > -1) {
                    arr.splice(elementIndex, 1);
                }
            };

            service.freetier = function () {
                var deferred = $q.defer();
                $q.all([
                    $q.when(freeTierOptions()),
                    $q.when(listAllMachines()),
                    $q.when(Datacenter.datacenter()),
                    $q.when(Account.getAccountCreated())
                ]).then(function (results) {
                    var machines = results[1];
                    var datacenters = [];
                    if (results[2] && Array.isArray(results[2])) {
                        datacenters = results[2].map(function (datacenter) {
                            return datacenter.name;
                        });
                    }

                    var freeTierOptionsResult = results[0].map(function (option) {
                        option.datacenters = angular.copy(datacenters);
                        return option;
                    });
                    var accountCreated = results[3];

                    // from Mar 1, 2014
                    var freeTierAvailableDate = new Date(2014, 2, 1);
                    freeTierOptionsResult.valid = !!accountCreated;
                    if (freeTierOptionsResult.valid) {
                        var createdDate = new Date(accountCreated);
                        freeTierOptionsResult.validUntil = new Date(createdDate.getFullYear() + 1, createdDate.getMonth(), createdDate.getDate());
                        freeTierOptionsResult.valid = createdDate > freeTierAvailableDate && new Date() < freeTierOptionsResult.validUntil;
                    }
                    var packageRequests = datacenters.map(function (datacenter) {
                        return $q.when(Package.package({datacenter: datacenter}));
                    });
                    if (packageRequests.length === 0) {
                        deferred.resolve([]);
                        return;
                    }
                    packageRequests.forEach(function (packageRequest, datacenterIndex) {
                        $q.when(packageRequest).then(function (packages) {
                            freeTierOptionsResult.forEach(function (option) {
                                var matchingPackages = packages.filter(function (availPackage) {
                                    return availPackage.id === option.package;
                                });
                                // Remove datacenter if it has no free tier package
                                if (matchingPackages.length === 0) {
                                    removeElement(option.datacenters, datacenters[datacenterIndex]);
                                } else {
                                    option.original = matchingPackages[0];
                                }
                                // Remove datacenter if it has free tier machine already created
                                machines.forEach(function (machine) {
                                    var machinePackageId = findPackageIdByName(packages, machine.package);
                                    if (option.package === machinePackageId) {
                                        machine.freetier = true;
                                        freeTierOptionsResult.forEach(function (freeOption) {
                                            removeElement(freeOption.datacenters, machine.datacenter);
                                        });
                                    }
                                });
                            });
                            deferred.resolve(freeTierOptionsResult);
                        }, function () {
                            deferred.resolve([]);
                        });
                    });
                }, function (err) {
                    deferred.reject(err);
                });
                return deferred.promise;
            };

            return service;
        }]);
}(window.JP.getModule('Dashboard')));
