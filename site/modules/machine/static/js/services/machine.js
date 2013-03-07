'use strict';


(function (app) {

    app.factory('Machines', ['$resource', function ($resource) {
        var service = {};

        var machines = [];

        // load machines
        machines = $resource('/machine', {}, {}).query();

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

    app.factory('MachineInfo', ['$resource', '$timeout', '$q', function ($resource, $timeout, $q) {
        var service = {};

        service.getMachine = function (uuid) {
            var deferred = $q.defer();
            var machine = null;

            deferred.resolve($resource('/machine/' + uuid, {}, {}).get());

            return deferred.promise;
        }

        service.startMachine = function (uuid) {
            var deferred = $q.defer();
            var machine = null;

            deferred.resolve($resource('/machine/' + uuid + '/start', {}, {}).get());

            return deferred.promise;
        }
        service.stopMachine = function (uuid) {
            var deferred = $q.defer();
            var machine = null;

            deferred.resolve($resource('/machine/' + uuid + '/stop', {}, {}).get());

            return deferred.promise;
        }
        service.rebootMachine = function (uuid) {
            var deferred = $q.defer();
            var machine = null;

            deferred.resolve($resource('/machine/' + uuid + '/reboot', {}, {}).get());

            return deferred.promise;
        }

        return service;
    }]);

}(window.JP.getModule('Machine')));
