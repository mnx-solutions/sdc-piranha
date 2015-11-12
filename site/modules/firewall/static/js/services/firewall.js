'use strict';


(function (ng, app) {
    app.factory('firewall', [
        'serverTab',
        '$rootScope',
        '$q',
        'Machine',
        'localization',
        'notification',

        function (serverTab, $rootScope, $q, Machine, localization, notification) {

            var service = {};
            var jobs = {};
            var INSTANCES_PATH = '/compute';

            function showMessage(error, machineName, action) {
                var message = 'Firewall for instance "' + machineName + '" has successfully ' + action + 'd.';
                var isError = false;
                if (error) {
                    message = 'Failed to ' + action + ' firewall for instance "' + machineName + '".';
                    if (error.restCode === 'NotAuthorized') {
                        message = error.message;
                    }
                    isError = true;
                }
                notification.popup(isError, isError, INSTANCES_PATH, null, message);
            }
            service.enable = function (id, cb) {
                if (!jobs[id] || jobs[id].finished) {
	                cb = cb || ng.noop;
                    $q.when(Machine.machine(id)).then(function (machine) {
                        jobs[id] = serverTab.call({
                            name: 'MachineFirewallEnable',
                            data: {
                                machineId: machine.id,
                                datacenter: machine.datacenter
                            },
                            done: function(err, job) {
                                var data = job.__read();
                                var error = err || data.err;
                                if (Machine.isMachineDeleted(machine, error)) {
                                    return cb(error);
                                }
                                showMessage(error, machine.name, 'enable');
                                cb(error);
                            }
                        });
                    });
                } else if (cb) {
					setTimeout(cb, 1); // Async
                }
            };

            service.disable = function (id, cb) {
                if (!jobs[id] || jobs[id].finished) {
	                cb = cb || ng.noop;
                    $q.when(Machine.machine(id)).then(function (machine) {
                        jobs[id] = serverTab.call({
                            name: 'MachineFirewallDisable',
                            data: {
                                machineId: machine.id,
                                datacenter: machine.datacenter
                            },
                            done: function(err, job) {
                                var data = job.__read();
                                var error = err || data.err;
                                if (Machine.isMachineDeleted(machine, error)) {
                                    return cb(error);
                                }
                                showMessage(error, machine.name, 'disable');
                                cb(error);
                            }
                        });
                    });
                } else if (cb) {
	                setTimeout(cb, 1); // Async
                }
            };

            //service.disable('a8c79f9a-176d-4ce3-8d09-013df04fca60');

            return service;
        }]);
}(window.angular, window.JP.getModule('firewall')));
