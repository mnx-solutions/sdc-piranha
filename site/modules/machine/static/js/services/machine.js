'use strict';


(function (app) {
    app.factory('Machines', [ 'Jobs', '$http', "serverCall", function ( Jobs, $http, serverCall) {
        var service = {};

        var machines = [];

        // load machines
        Jobs.runJob({
            name: "getMachines",
            task: function (cb) {
                serverCall("MachineList", null, cb)
            },
            onSuccess: function (data) {
                console.log("success called")
                machines.length = 0;
                machines.push.apply(machines, data);
            },
            onError: function(err){
                // XXX
                console.log("error called")
            }
        });

        /* get reference to the machines list */
        service.getMachines = function () {
            return machines;
        };

        /* find machine by uuid */
        service.getMachine = function (uuid) {
            return machines.filter(function (machine) {
                return machine.id === uuid;
            });
        };

        /* start machine by uuid */
        service.startMachine = function (uuid, success, error) {
            return Jobs.runJob({
                name: "startMachine",
                task: function (cb) {
                    serverCall("startMachine", uuid, cb);
                },
                onSuccess: function (result) {
                    machines[result.uuid] = result;
                    success || success();
                },
                onError: function (err, result) {
                    error || error();
                }
            });
        };

        return service;
    }]);
}(window.JP.getModule('Machine')));
