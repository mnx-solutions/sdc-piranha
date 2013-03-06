'use strict';


(function (app) {
    app.factory('Machines', ['Events', 'Jobs', '$http', "serverCall", function (Events, Jobs, $http, serverCall) {
        var service = {};

        var machines = [];

        // load machines

        Jobs.runJob({
            name: "getMachines",
            task: function (cb) {
                Events.send("getMachineList");
                Events.on("MachineList", function (data) {
                    cb(null, data);
                });
            },
            onSuccess: function (data) {
                machines = data;
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
                    serverCall("startMachine", cb);
                },
                success: function (result) {
                    machines[result.uuid] = result;
                    success || success();
                },
                error: function (err, result) {
                    error || error();
                }
            });
        };

        return service;
    }]);
}(window.JP.getModule('Machine')));
