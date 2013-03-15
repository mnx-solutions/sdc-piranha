'use strict';


(function (app) {
    app.factory('Machines', ['$resource', "serverCall", "$rootScope", "$q", function ($resource, serverCall, $rootScope, $q) {
        var service = {};

        var machineList = {job: null, machines: []};
        var packageList = {job: null, packages: []};

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
            onLoad.push(function() {
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
                    machineList.machines.length = 0;
                    machineList.machines.push.apply(machineList.machines, result);
                }
            }, function (data) {
                // handle progress
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

        // run updateMachines
        service.updateMachines();

        // run updatePackages
        service.updatePackages();

        // get reference to the machines list
        service.getMachines = function () {
            return machineList;
        };

        // find machine by uuid
        service.getMachine = function (uuid) {

            var machine = findMachine(uuid);

            // got the machine, return machine
            if (machine) {
                return machine;
            }

            // get the new machine list.
            var job = service.updateMachines();

            var deferred = $q.defer();
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

            return machine.job;
        }


        service.resizeMachine = function (uuid, sdcpackage) {
            var machine = findMachine(uuid);
            var data = {};
            data.machineid = uuid;
            console.log(sdcpackage);
            data.sdcpackage = sdcpackage;

            machine.job = serverCall("MachineResize", data, function (err, result) {
                if (!err) {
                    machine.state = result.state;
                    machine.memory = result.memory;
                }
            }, function (progress) {
                machine.state = progress.state;
            });

            return machine.job;
        }


        return service;
    }]);
}(window.JP.getModule('Machine')));
