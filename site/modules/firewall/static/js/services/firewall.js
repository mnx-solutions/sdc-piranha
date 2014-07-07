'use strict';


(function (ng, app) {
    app.factory('firewall', [
        'serverTab',
        '$rootScope',
        '$q',
        'Machine',
        'localization',
        'notification',
        'PopupDialog',

        function (serverTab, $rootScope, $q, Machine, localization, notification, PopupDialog) {

            var service = {};
            var jobs = {};

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
                                if(error) {
                                    PopupDialog.error(
                                        localization.translate(
                                            $rootScope,
                                            null,
                                            'Error'
                                        ), err.restCode === 'NotAuthorized' ? err.message :
                                        localization.translate(
                                            $rootScope,
                                            null,
                                            'Failed to enable firewall for instance ' + id + '.'
                                        ), function () {
                                    });
                                }
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
                                var error = err || data.err;if(error) {
                                    PopupDialog.error(
                                        localization.translate(
                                            $rootScope,
                                            null,
                                            'Error'
                                        ),
                                        localization.translate(
                                            $rootScope,
                                            null,
                                            'Failed to disable firewall for instance ' + id
                                        ), function () {
                                    });
                                }
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
