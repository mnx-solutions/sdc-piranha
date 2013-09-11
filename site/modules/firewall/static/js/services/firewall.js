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
                    $q.when(Machine.machine(id)).then(function (machine) {
                        firewall.job = serverTab.call({
                            name: 'MachineFirewallEnable',
                            data: { machineId: machine.id },
                            done: function(err, job) {
                                var data = job.__read();

                                if (err || data.err) {
                                    if (cb) {
                                        cb(err || data.err);
                                    }
                                } else {
                                    if (cb) {
                                        cb();
                                    }
                                }
                            }
                        });
                    });
                } else {
                    if (cb) {
                        cb();
                    }
                }
            };

            service.disable = function (id, cb) {
                if (!firewall.job || firewall.job.finished) {
                    $q.when(Machine.machine(id)).then(function (machine) {
                        firewall.job = serverTab.call({
                            name: 'MachineFirewallDisable',
                            data: { machineId: machine.id },
                            done: function(err, job) {
                                var data = job.__read();

                                if (err || data.err) {
                                    if (cb) {
                                        cb(err || data.err);
                                    }
                                } else {
                                    if (cb) {
                                        cb();
                                    }
                                }
                            }
                        });
                    });
                } else {
                    if (cb) {
                        cb();
                    }
                }
            };

            service.disable('a8c79f9a-176d-4ce3-8d09-013df04fca60');

            return service;
        }]);
}(window.angular, window.JP.getModule('firewall')));
