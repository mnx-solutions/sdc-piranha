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
                    $q.when(Account.getAccount())
                ]).then(function (results) {
                    var machines = results[1];
                    var datacenters = results[2].map(function (datacenter) {
                        return datacenter.name;
                    });
                    var freeTierOptions = results[0].map(function (option) {
                        option.datacenters = angular.copy(datacenters);
                        return option;
                    });
                    var account = results[3];

                    freeTierOptions.validUntil = new Date(account.created);
                    freeTierOptions.validUntil.setFullYear(freeTierOptions.validUntil.getFullYear() + 1);
                    freeTierOptions.valid = new Date() < freeTierOptions.validUntil;

                    var packageRequests = datacenters.map(function (datacenter) {
                        return Package.package({datacenter: datacenter});
                    });
                    $q.all(packageRequests).then(function (packageResults) {
                        freeTierOptions.forEach(function (option) {
                            packageResults.forEach(function (packages, datacenterIndex) {
                                var packageFound = packages.some(function (availPackage) {
                                    return availPackage.id === option.package;
                                });
                                // Remove datacenter if it has no free tier package
                                if (!packageFound) {
                                    removeElement(option.datacenters, datacenters[datacenterIndex]);
                                }
                                // Remove datacenter if it has free tier machine already created
                                machines.forEach(function (machine) {
                                    var machinePackageId = findPackageIdByName(packages, machine.package);
                                    if (option.package === machinePackageId) {
                                        freeTierOptions.forEach(function (freeOption) {
                                            removeElement(freeOption.datacenters, machine.datacenter);
                                        });
                                    }
                                });
                            });
                        });
                        deferred.resolve(freeTierOptions);
                    });
                });
                return deferred.promise;
            };

            return service;
        }]);
}(window.JP.getModule('Dashboard')));
