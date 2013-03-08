'use strict';


(function (app) {
    app.factory('Machines', ['$resource',"serverCall", function ($resource, serverCall) {
        var service = {};

        var machines = [];

        // load machines
        service.updateMachines = function () {
            serverCall("MachineList", null, function (err, machineList) {
                if (!err) {
                    machines.length = 0;
                    machines.push.apply(machines, machineList);
                }
            }, function (data) {
                console.log('progress: ' + data);
            });
        };

        service.updateMachines();

        // get reference to the machines list
        service.getMachines = function () {
            return machines;
        };

        // find machine by uuid
        service.getMachine = function (uuid) {
            return machines.filter(function (machine) {
                return machine.id === uuid;
            });
        };

        return service;
    }]);

    app.factory('MachineInfo', ['$resource', '$timeout', '$q',"serverCall", function ($resource, $timeout, $q, serverCall) {
        var service = {};

        service.getMachine = function (uuid) {
            var deferred = $q.defer();
            var machine = null;

            serverCall("MachineDetails", uuid, function (err, result) {
                if (!err){
                    deferred.resolve(result);
                }
            });

            return deferred.promise;
        }

        service.startMachine = function (uuid) {
            var deferred = $q.defer();
            var machine = null;

            serverCall("MachineStart", uuid, function (err, result) {
                if (!err){
                    deferred.resolve(result);
                }
            });

            return deferred.promise;
        }
        service.stopMachine = function (uuid) {
            var deferred = $q.defer();
            var machine = null;

            serverCall("MachineStop", uuid, function (err, result) {
                if (!err){
                    deferred.resolve(result);
                }
            });

            return deferred.promise;
        }

        service.rebootMachine = function (uuid) {
            var deferred = $q.defer();
            var machine = null;

            serverCall("MachineReboot", uuid, function (err, result) {
                if (!err){
                    deferred.resolve(result);
                }
            });

            return deferred.promise;
        }

        return service;
    }]);

}(window.JP.getModule('Machine')));
