'use strict';

(function (ng, app) {
    app.controller('Machine.IndexController', [
        '$scope',
        '$cookieStore',
        '$filter',
        '$$track',
        '$q',
        'requestContext',
        'Machine',
        'Dataset',
        'Package',
        'localization',
        'PopupDialog',
        '$location',
        'firewall',
        '$rootScope',

        function ($scope, $cookieStore, $filter, $$track, $q, requestContext, Machine, Dataset, Package, localization, PopupDialog, $location, firewall, $rootScope) {
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

                        if (!$scope.machines.length) {
                            $location.path("compute/create");
                            return;
                        }
                    });
                }
            });

            $scope.actionButton = function(){
                var flag = false;
                $scope.machines.forEach(function (el) {
                    if(el.checked){
                        flag = true;
                    }
                });
                return flag;
            };

            $scope.noCheckBoxChecked = function(){
                PopupDialog.error(
                    localization.translate(
                        $scope,
                        null,
                        'Error'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'No instance selected for the action.'
                    ), function() {
                    }
                );
            };

            $scope.notSupportedFirewallMessage = function () {
                PopupDialog.message(
                    localization.translate(
                        $scope,
                        null,
                        'Message'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Some of the instances selected are virtualmachine instances which are not yet supported by the FWAPI.'
                    ),
                    function () {}
                );
            };

            function makeMachineAction (action, messageTitle, messageBody) {
                if ($scope.actionButton()) {
                    var message = '';
                    var checkedWrong = [];
                    var checkedMachines = $scope.machines.filter(function (machine) {
                        if (machine.checked) {
                            if (action === 'start') {
                                if (machine.state === 'stopped') {
                                    return machine.checked;
                                } else {
                                    checkedWrong.push(machine);
                                }
                            } else if (action === 'stop') {
                                if (machine.state === 'running') {
                                    return machine.checked;
                                } else {
                                    checkedWrong.push(machine);
                                }
                            } else if (action === 'reboot') {
                                if (machine.state !== 'stopped') {
                                    return machine.checked;
                                } else {
                                    checkedWrong.push(machine);
                                }
                            } else if (action === 'delete') {
                                return machine.checked;
                            }
                        }
                    });

                    PopupDialog.confirm(
                        localization.translate(
                            $scope,
                            null,
                            messageTitle
                        ),
                        localization.translate(
                            $scope,
                            null,
                            message = ((checkedWrong.length + checkedMachines.length) > 1) ? messageBody[1] : messageBody[0]
                        ), function () {
                            checkedMachines.forEach(function (el) {
                                if (action === 'delete') {
                                    if (el.state === 'running') {
                                        $$track.event('machine', 'stop');
                                        Machine.stopMachine(el.id).getJob().done(function () {
                                            $scope.deleteInstance(el);
                                        });
                                    } else {
                                        $scope.deleteInstance(el);
                                    }
                                } else if (action === 'start' || action === 'stop' || action === 'reboot') {
                                    $$track.event('machine', action);
                                    Machine[action + 'Machine'](el.id);
                                }
                            });
                            checkedWrong.forEach(function (el) {
                                el.checked = false;
                            });
                        }
                    );
                } else {
                    $scope.noCheckBoxChecked();
                }
            }

            $scope.gridOrder = ['created'];
            $scope.gridProps = [
                {
                    id: 'label',
                    name: 'Name',
                    sequence: 1,
                    active: true
                },
                {
                    id: 'datacenter',
                    name: 'Data Center',
                    sequence: 2,
                    active: true
                },
                {
                    id: '',
                    name: 'Image',
                    sequence: 3,
                    active: true,
                    _getter: function (object) {
                        var datasetName = '';
                        var dataset = object.dataset;

                        if (dataset) {
                            var prefixLength = 'sdc:sdc:'.length;
                            datasetName = dataset.slice(prefixLength).replace(':', ' - ');
                        }

                        return datasetName;
                    }
                },
                {
                    id: 'created',
                    name: 'Created',
                    sequence: 5,
                    active: true
                },
                {
                    id: 'primaryIp',
                    name: 'IP',
                    sequence: 6,
                    active: true
                },
                {
                    id: 'state',
                    name: 'Status',
                    sequence: 7,
                    active: true
                },
                {
                    id: 'updated',
                    name: 'Updated',
                    sequence: 8,
                    active: true
                },
                {
                    id: 'id',
                    name: 'ID',
                    sequence: 9,
                    active: false
                },
                {
                    id: 'dataset',
                    name: 'Dataset',
                    sequence: 10,
                    active: false
                },
                {
                    id: 'type',
                    name: 'Type',
                    sequence: 11,
                    active: false
                },
                {
                    id: 'memory',
                    name: 'Memory',
                    sequence: 12,
                    active: false
                },
                {
                    id: 'disk',
                    name: 'Disk',
                    sequence: 13,
                    active: false
                },
                {
                    id: 'tags',
                    name: 'Tags',
                    sequence: 14,
                    active: false
                },
                {
                    id: 'credentials',
                    name: 'Credentials',
                    sequence: 15,
                    active: false
                },
                {
                    id: 'package',
                    name: 'Package',
                    sequence: 16,
                    active: false
                },
                {
                    id: 'image',
                    name: 'Image ID',
                    sequence: 17,
                    active: false
                },
                {
                    id: '$$hashKey',
                    name: '$$hashKey',
                    sequence: 18,
                    active: false
                },
                {
                    id: 'ips',
                    name: 'IP-s',
                    sequence: 19,
                    active: false
                }
            ];

            if ($scope.features.firewall === 'enabled') {
                var firewallColumn = {
                    id: 'firewall',
                    name: 'Firewall',
                    sequence: 4,
                    active: true,
                    type: 'firewall_state',
                    _getter: function (object) {
                        var state = '';

                        if (object.firewall_enabled) {
                            state = '<span class="grid-enabled-text">On</span>';
                        } else if ("virtualmachine" === object.type || !object.hasOwnProperty("firewall_enabled")) {
                            state = 'N/A';
                        } else {
                            state = 'Off';
                        }
                        return state;
                    }
                };
                $scope.gridProps.splice(2, 0, firewallColumn);
            }

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
                    action: function (object) {
                        var messageBody = [
                            'Start selected instance',
                            'Start selected instances'
                        ];
                        makeMachineAction('start', 'Confirm: Start instances', messageBody);
                    },
                    sequence: 1
                },
                {
                    label: 'Stop',
                    action: function (object) {
                        var messageBody = [
                            'Stopping this instance does not stop billing, your instance can be started after it is stopped.',
                            'Stopping selected instances does not stop billing, your instance can be started after it is stopped.'
                        ];
                        makeMachineAction('stop', 'Confirm: Stop instances', messageBody);
                    },
                    sequence: 2
                },
                {
                    label: 'Enable FW',
                    show: function () {
                        return $rootScope.features.firewall !== 'disabled';
                    },
                    action: function (object) {
                        var isFirewallNonSupported = false;
                        if ($scope.actionButton()) {
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Enable Firewall'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Enable firewall for selected instances?'
                                ), function () {
                                    // TODO: one method for enable and disable
                                    $scope.machines.forEach(function (el) {
                                        if (el.checked) {
                                            if ("virtualmachine" !== el.type && !el.firewall_enabled) {
                                                $scope.toggleFirewallEnabled(el);
//                                                el.firewall_enabled = true;
                                            } else {
                                                isFirewallNonSupported = true;
                                            }
                                            el.checked = false;
                                        }
                                    });
                                    if (isFirewallNonSupported) {
                                        $scope.notSupportedFirewallMessage();
                                    }
                                });
                        } else {
                            $scope.noCheckBoxChecked();
                        }
                    },
                    sequence: 3
                },
                {
                    label: 'Disable FW',
                    show: function () {
                        return $rootScope.features.firewall !== 'disabled';
                    },
                    action: function (object) {
                        var isFirewallNonSupported = false;
                        if ($scope.actionButton()) {
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Disable Firewall'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Disable firewall for selected instances?'
                                ), function () {
                                    $scope.machines.forEach(function (el) {
                                        if (el.checked) {
                                            if ("virtualmachine" !== el.type && el.firewall_enabled) {
                                                $scope.toggleFirewallEnabled(el);
//                                                el.firewall_enabled = false;
                                            } else {
                                                isFirewallNonSupported = true;
                                            }
                                            el.checked = false;
                                            console.log('Disable FW ready');
                                        }
                                    });
                                    if (isFirewallNonSupported) {
                                        $scope.notSupportedFirewallMessage();
                                    }
                                });
                        } else {
                            $scope.noCheckBoxChecked();
                        }
                    },
                    sequence: 4
                },
                {
                    label: 'Delete',
                    action: function () {
                        var messageBody = [
                            'Destroy the information on these instances and stop billing for them.',
                            'Destroy the information on this instance and stop billing for selected instances.'
                        ];
                        makeMachineAction('delete', 'Confirm: Delete instances', messageBody);
                    },
                    sequence: 5
                },
                {
                    label: 'Reboot',
                    action: function () {
                        var messageBody = [
                            'Restart this instance.',
                            'Restart selected instances.'
                        ];
                        makeMachineAction('reboot', 'Confirm: Restart instances', messageBody);
                    },
                    sequence: 6
                }
            ];

            $scope.exportFields = {
                ignore: ['metadata']
            };

            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter instances';

            $scope.deleteInstance = function(el) {
                $$track.event('machine', 'delete');
                Machine.deleteMachine(el.id).getJob().done(function () {
                    if (!$scope.machines.length) {
                        $location.path("compute/create");
                    }
                    el.checked = false;
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
        }

    ]);
}(window.angular, window.JP.getModule('Machine')));
