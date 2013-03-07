'use strict';


(function (app) {
    app.factory('Machines', [ 'Jobs', '$http', "serverCall", function (Jobs, $http, serverCall) {
        var service = {};

        var machines = [];

        service.updateMachines = function () {
            serverCall("MachineList", null, function (err, result) {
                if (!err) {
                    console.log("success called")
                    machines.length = 0;
                    machines.push.apply(machines, data);
                }
            });
        };

        service.updateMachines();

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


        return service;
    }
    ])
    ;
}
    (window.JP.getModule('Machine'))
    )
;
