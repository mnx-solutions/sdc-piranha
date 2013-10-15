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
            var firewall = { job: null };

            service.enable = function (id, cb) {
                if (!firewall.job || firewall.job.finished) {
	                cb = cb || ng.noop;
                    $q.when(Machine.machine(id)).then(function (machine) {
                        firewall.job = serverTab.call({
                            name: 'MachineFirewallEnable',
                            data: { machineId: machine.id },
                            done: function(err, job) {
                                var data = job.__read();

	                            cb(err || data.err);
                            }
                        });
                    });
                } else if (cb) {
					setTimeout(cb, 1); // Async
                }
            };

            service.disable = function (id, cb) {
                if (!firewall.job || firewall.job.finished) {
	                cb = cb || ng.noop;
                    $q.when(Machine.machine(id)).then(function (machine) {
                        firewall.job = serverTab.call({
                            name: 'MachineFirewallDisable',
                            data: { machineId: machine.id },
                            done: function(err, job) {
                                var data = job.__read();

	                            cb(err || data.err);
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
