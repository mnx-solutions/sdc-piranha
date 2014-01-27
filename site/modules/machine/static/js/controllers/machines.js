'use strict';

(function (ng, app) {
    app.controller('Machine.IndexController', [
        '$scope',
        '$cookieStore',
        '$filter',
        '$$track',
        '$dialog',
        '$q',
        'requestContext',
        'Machine',
        'Dataset',
        'Package',
        'localization',
        'util',
        'firewall',

        function ($scope, $cookieStore, $filter, $$track, $dialog, $q, requestContext, Machine, Dataset, Package, localization, util, firewall) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.index', $scope, {
                title: localization.translate(null, 'machine', 'See my Joyent Instances')
            });

            $scope.loading = true;

            // Pagination
            $scope.machines = Machine.machine();
            $scope.packages = Package.package();

            $scope.$on(
                'event:forceUpdate',
                function () {
                    $scope.machines = Machine.machine();
                }
            );

            $scope.$watch('machines', function (machines) {
                machines.forEach(function (machine) {
                    machine.label = machine.name || machine.id;
                });
            }, true);

            $scope.$watch('machines.final', function (final) {
                if(final) {
                    $q.when($scope.packages, function () {
                        $scope.loading = false;
                    });
                }
            });

            $scope.startMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Start instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Restart this instance'
                    ), function () {
                        $$track.event('machine', 'start');
                        Machine.startMachine(id);
                    });
            };

            $scope.stopMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Stop instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Stopping an instance does not stop billing, your instance can be restarted after it is stopped.'
                    ), function () {
                        Machine.stopMachine(id);
                        $$track.event('machine', 'stop');
                    });
            };

            $scope.deleteMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Destroy the information on this instance and stop billing for this instance.'
                    ), function () {
                        $$track.event('machine', 'delete');
                        Machine.deleteMachine(id);
                    });
            };

            $scope.rebootMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Restart instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Restart this instance'
                    ), function() {
                        $$track.event('machine', 'reboot');
                        Machine.rebootMachine(id);
                    });
            };

            $scope.toggleFirewallEnabled = function (m) {
                m.fireWallActionRunning = true;
                var fn = m.firewall_enabled ? 'disable' : 'enable';
                var expected = !m.firewall_enabled;
                firewall[fn](m.id, function (err) {
                    if(!err) {
                        m.firewall_enabled = expected;
                    }
                    m.fireWallActionRunning = false;
                });
            };

            $scope.gridOrder = ['created'];
            $scope.gridProps = [
                {
                    id: 'label',
                    name: 'Name',
                    sequence: 1
                },
                {
                    id: 'datacenter',
                    name: 'Data Center',
                    sequence: 2
                },
                {
                    id: 'ips',
                    name: 'IP',
                    type: 'html',
                    _getter: function (machine) {
                        if (!ng.isArray(machine.ips)) {
                            return '';
                        }

                        if (ng.isArray(machine.publicIps)) {
                            return machine.publicIps
                                .concat(machine.privateIps)
                                .slice(0,2)
                                .join('<br/>');
                        } else {
                            return '';
                        }

                    },
                    sequence: 5
                },
                {
                    id: 'state',
                    name: 'Status',
                    sequence: 6
                }
            ];

            var thirdColumn = {
                id: 'created',
                name: 'Created',
                getClass: function (type) {
                    if(type === 'header') {
                        return 'span3';
                    }
                    return 'span3 machine-list-content';
                },

                sequence: 3
            };

            if ($scope.features.firewall === 'enabled') {
                thirdColumn = {
                    id: 'firewall',
                    name: 'Firewall',
                    sequence: 3,
                    _getter: function (object) {
                        var state = '';

                        if (object.firewall_enabled) {
                            state = 'FWAPI';
                        } else if ("virtualmachine" === object.type || !object.hasOwnProperty("firewall_enabled")) {
                            state = 'N/A';
                        } else if ("virtualmachine" !== object.type && !object.compute_node) {
                            state = 'N/A';
                        } else {
                            state = 'Off';
                        }
                        return state;
                    }
                };
            }

            $scope.gridProps.splice(2, 0, thirdColumn);

            $scope.gridDetailProps = [
                {
                    id: 'memory',
                    name: 'Memory',
                    sequence: 1
                },
                {
                    id: 'disk',
                    name: 'Disk',
                    sequence: 2
                },
                {
                    id: '_Dataset',
                    id2: 'name',
                    name: "Image Name",
                    sequence: 3
                },
                {
                    id: 'ips',
                    name: 'IP',
                    sequence: 4
                }
            ];

            $scope.gridActionButtons = [
                {
                    label: 'Start',
                    disabled: function (object) {
                        return object.state === 'running' || (object.job && !object.job.finished);
                    },
                    action: function (object) {
                        $scope.startMachine(object.id);
                    },
                    tooltip: 'Instance configuration and data is preserved when instances are stopped. Use start to restart your instance.',
                    sequence: 1
                },
                {
                    label: 'Stop',
                    disabled: function (object) {
                        return object.state === 'stopped' || (object.job && !object.job.finished);
                    },
                    action: function (object) {
                        $scope.stopMachine(object.id);
                    },
                    tooltip: 'Stopping an instance does not stop billing. You can restart your instance after you stop your machine.',
                    sequence: 2
                },
                {
                    label: 'Delete',
                    disabled: function (object) {
                        return object.state !== 'stopped' || (object.job && !object.job.finished);
                    },
                    action: function (object) {
                        $scope.deleteMachine(object.id);
                    },
                    tooltip: 'You will lose all information and data on this instance if you delete an instance. Deleting an instance also stops billing.',
                    sequence: 3
                },
                {
                    label: 'Reboot',
                    disabled: function (object) {
                        return object.state !== 'running' || (object.job && !object.job.finished);
                    },
                    action: function (object) {
                        $scope.rebootMachine(object.id);
                    },
                    tooltip: 'Click here to reboot your instance.',
                    sequence: 4
                }
            ];

            $scope.exportFields = {
                ignore: ['metadata']
            };

        }


    ]);
}(window.angular, window.JP.getModule('Machine')));
