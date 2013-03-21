'use strict';


(function (app) {
    app.factory('Machines', ['$resource', "serverCall", "$rootScope", "$q", function ($resource, serverCall, $rootScope, $q) {
        var service = {};

        var machineList = {job: null, machines: []};
        var packageList = {job: null, packages: []};
        var datasetList = {job: null, datasets: []};
        var datacenterList = {job: null, datacenters: {}};

        var findMachine = function (id) {
            var filtered = machineList.machines.filter(function (machine) {
                return machine.id === id;
            });

            if (filtered.length == 1) {
                return filtered[0];
            }
            return null;
        }

        /* find machine by uuid */
        service.getMachine = function (uuid) {
            if (loaded) {
                var tmp = machines.filter(function (machine) {
                    return machine.id === uuid;
                });
                return tmp[0];
            } else {
                var deferred = $q.defer();
                onLoad.push(function () {
                    var tmp = machines.filter(function (machine) {
                        return machine.id === uuid;
                    });
                    deferred.resolve(tmp[0]);
                });

                return deferred.promise;
            }
        };

        // load machines
        service.updateMachines = function (callback) {

            if (machineList.job && !machineList.job.finished) {
                machineList.job.addCallback(callback);
                return machineList.job;
            }

            machineList.job = serverCall("MachineList", null, function (err, result) {
                if (!err) {
                    //machineList.machines.length = 0;
                    //machineList.machines.push.apply(machineList.machines, result);
                }
            }, function (data) {
                data.forEach(function (res) {
                    console.log(res);
                    if (res.machines) {
                        machineList.machines.push.apply(machineList.machines, res.machines);
                    }
                });
            });

            machineList.job.addCallback(callback);
        };

        // list packages
        service.getPackages = function () {

            if (packageList.packages.length) {
                return packageList.packages;
            }

            // get the new machine list.
            var job = service.updatePackages();
            var deferred = $q.defer();
            job.addCallback(function () {
                deferred.resolve(packageList.packages);
            });

            return deferred.promise;
        };

        var findPackage = function (packageName) {
            var found = packageList.packages.filter(function (pack) {
                if (pack.name === packageName) {
                    return pack;
                }
            });
            if (found.length === 1) {
                return found[0];
            }
            return null;
        }

        // list packages
        service.getPackage = function (name) {

            if (packageList.packages.length) {
                return findPackage(name);
            }

            // get the new machine list.
            var job = service.updatePackages();

            var deferred = $q.defer();
            job.addCallback(function () {
                deferred.resolve(findPackage(name));
            });

            return deferred.promise;
        };

        // load packages
        service.updatePackages = function (callback) {

            if (packageList.job && !packageList.job.finished) {
                packageList.job.addCallback(callback);
                return packageList.job;
            }

            packageList.job = serverCall("PackageList", null, function (err, result) {
                if (!err) {
                    packageList.packages.length = 0;
                    packageList.packages.push.apply(packageList.packages, result);
                }
            }, function (data) {
                // handle progress
            });

            packageList.job.addCallback(callback);
        };

        // list datasets
        service.getDatasets = function () {

            if (datasetList.datasets.length) {
                return datasetList.datasets;
            }

            // get the new machine list.
            var job = service.updateDatasets();
            var deferred = $q.defer();
            job.addCallback(function () {
                deferred.resolve(datasetList.datasets);
            });

            return deferred.promise;
        };

        // load datasets
        service.updateDatasets = function (callback) {

            if (datasetList.job && !datasetList.job.finished) {
                datasetList.job.addCallback(callback);
                return datasetList.job;
            }

            datasetList.job = serverCall("DatasetList", null, function (err, result) {
                if (!err) {
                    datasetList.datasets.length = 0;
                    datasetList.datasets.push.apply(datasetList.datasets, result);
                }
            }, function (data) {
                // handle progress
            });

            datasetList.job.addCallback(callback);
        };

        // list datacenters
        service.getDatacenters = function () {

            if (datacenterList.datacenters.length) {
                return datacenterList.datacenters;
            }

            // get the new machine list.
            var job = service.updateDatacenters();
            var deferred = $q.defer();
            job.addCallback(function () {
                deferred.resolve(datacenterList.datacenters);
            });

            return deferred.promise;
        };

        // load datacenters
        service.updateDatacenters = function (callback) {

            if (datacenterList.job && !datacenterList.job.finished) {
                datacenterList.job.addCallback(callback);
                return datacenterList.job;
            }

            datacenterList.job = serverCall("DatacenterList", null, function (err, result) {
                if (!err) {
                    datacenterList.datacenters = {};
                    datacenterList.datacenters = result;
                }
            }, function (data) {
                // handle progress
            });

            datacenterList.job.addCallback(callback);
        };

        // run updateMachines
        service.updateMachines();

        // run updatePackages
        service.updatePackages();

        // run updateDatasets
        //service.updateDatasets();

        // run updateDatacenters
        //service.updateDatacenters();

        // get reference to the machines list
        service.getMachines = function () {
            return machineList;
        };

        // find machine by uuid
        service.getMachine = function (uuid) {
            var deferred = $q.defer();

            var machine = findMachine(uuid);

            // got the machine, return machine
            if (machine) {
                deferred.resolve(machine);
                return deferred.promise;
            }

            // get the new machine list.
            var job = service.updateMachines();

            job.addCallback(function () {
                var machine = findMachine(uuid);
                deferred.resolve(machine);
            });

            return deferred.promise;
        };

        service.startMachine = function (uuid) {
            //XXX check for running jobs
            var machine = findMachine(uuid);

            machine.job = serverCall("MachineStart", uuid, function (err, result) {
                if (!err) {
                    machine.state = result.state;
                }
            }, function (progress) {
                machine.state = progress.state;
            });

            machine.job.name = "starting";

            return machine.job;
        }

        service.stopMachine = function (uuid) {
            //XXX check for running jobs
            var machine = findMachine(uuid);

            machine.job = serverCall("MachineStop", uuid, function (err, result) {
                if (!err) {
                    machine.state = result.state;
                }
            }, function (progress) {
                machine.state = progress.state;
            });

            machine.job.name = "stopping";


            return machine.job;
        }

        service.deleteMachine = function (uuid) {
            //XXX check for running jobs
            var machine = findMachine(uuid);

            machine.job = serverCall("MachineDelete", uuid, function (err, result) {

                if (!err) {
                    delete machineList.machines[machineList.machines.indexOf(machine)];
                }
            }, function (progress) {
                machine.state = progress.state;
            });

            machine.job.name = "deleting";

            return machine.job;
        }

        service.rebootMachine = function (uuid) {
            var machine = findMachine(uuid);

            machine.job = serverCall("MachineReboot", uuid, function (err, result) {
                if (!err) {
                    machine.state = result.state;
                }
            }, function (progress) {
                machine.state = progress.state;
            });

            machine.job.name = "rebooting";


            return machine.job;
        }


        service.resizeMachine = function (uuid, sdcpackage) {
            var machine = findMachine(uuid);
            var data = {};
            data.machineid = uuid;
            data.sdcpackage = sdcpackage;

            machine.job = serverCall("MachineResize", data, function (err, result) {
                if (!err) {
                    machine.state = result.state;
                    machine.memory = result.memory;
                }
            }, function (progress) {
                machine.state = progress.state;
            });

            machine.job.name = "resizing";

            return machine.job;
        }

        service.provisionMachine = function (name, sdcpackage, dataset) {
            var data = {};
            data.name = name;
            data.sdcpackage = sdcpackage;
            data.dataset = dataset;
            var machine = {
                state: "creating",
                name: name
            }

            machineList.machines.push(machine);

            var job = serverCall("MachineCreate", data, function (err, result) {

                if (!err) {
                    angular.copy(newMachine, machine);
                    machine.job = job;
                }
            }, function (results) {
                results.forEach(function (result) {
                    if (result.machine) {
                        console.log("adding new machine");
                        angular.copy(result.machine, machine);
                        machine.job = job;
                    }
                });
            });

            machine.job = job;
            job.name = "provisioning";

            return job;
        }

        return service;
    }]);
}(window.JP.getModule('Machine')));
