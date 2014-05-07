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
        'Account',
        'FreeTier',

        function ($scope, $cookieStore, $filter, $$track, $q, requestContext, Machine, Dataset, Package, localization, PopupDialog, $location, firewall, $rootScope, Account, FreeTier) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.index', $scope, {
                title: localization.translate(null, 'machine', 'See my Joyent Instances')
            });

            $scope.loading = true;

            // Pagination
            $scope.machines = Machine.machine();
            $scope.packages = Package.package();

            if ($scope.features.freetier === 'enabled') {
                $scope.freetier = FreeTier.freetier();
            }

            $scope.$on(
                'event:forceUpdate',
                function () {
                    $scope.machines = Machine.machine();
                }
            );

            $scope.$watch('machines', function (machines) {
                machines.forEach(function (machine) {
                    machine.label = machine.name || machine.id;
                    if (machine.image) {
                        Dataset.dataset({id: machine.image}).then(function (dataset){
                            machine.datasetInfo = dataset.name + '/' + dataset.version;
                        })
                    }
                });
            }, true);

            $scope.$watch('machines.final', function (final) {
                if(final) {
                    $q.when($scope.packages, function () {
                        $scope.loading = false;

                        if (!$scope.machines.length) {
                            $location.path("compute/create/simple");
                        }
                    });
                }
            });

            $scope.getCheckedItems = function () {
                return $scope.machines.filter(function (el) {
                    return el.checked;
                });
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
                    ), function () {
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

            function makeMachineAction(action, messageTitle, messageBody) {
                var checkedInstances = $scope.getCheckedItems();
                if (checkedInstances.length) {
                    var message = '';
                    var checkedFreeMachines = true;
                    var checkedMachines = $scope.machines.filter(function (machine) {
                        if (machine.checked) {
                            if (!machine.freetier) {
                                checkedFreeMachines = false
                            }
                            switch (action) {
                            case 'start':
                                if (machine.state === 'stopped') {
                                    return true;
                                }
                                machine.checked = false;
                                break;
                            case 'stop':
                                if (machine.state === 'running') {
                                    return true;
                                }
                                machine.checked = false;
                                break;
                            case 'reboot':
                                if (machine.state !== 'stopped') {
                                    return true;
                                }
                                machine.checked = false;
                                break;
                            case 'delete':
                                return true;
                                break;
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
                            message = function () {
                                var result = messageBody.single;
                                if (checkedInstances.length > 1) {
                                    result = checkedFreeMachines && messageBody.freetier_plural ?
                                        messageBody.freetier_plural : messageBody.plural;
                                } else if (checkedFreeMachines && messageBody.freetier_single) {
                                    result = messageBody.freetier_single;
                                }
                                return result;
                            }
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
                                } else {
                                    $$track.event('machine', action);
                                    Machine[action + 'Machine'](el.id);
                                }
                                el.checked = false;
                            });
                        }
                    );
                } else {
                    $scope.noCheckBoxChecked();
                }
            }

            var stateOrder = function (object) {
                var statuses = {stopped: 4, running: 3, provisioning: 2, creating: 1};
                return statuses[object.state];
            };

            var ipToInt = function (object) {
                var octets = object.primaryIp.split('.');
                var buffer = new ArrayBuffer(4);
                var dataView = new DataView(buffer);
                for (var i = 0; i < 4; i++) {
                    dataView.setUint8(i, octets[i]);
                }
                return dataView.getUint32(0);
            };

            $scope.gridOrder = [stateOrder, '-created'];
            $scope.gridProps = [
                {
                    id: 'label',
                    name: 'Name',
                    sequence: 1,
                    active: true,
                    type: 'html',
                    _getter: function (machine) {
                        var html = '<a href="#!/compute/instance/' + machine.id + '" style="min-width: 140px;">' + machine.label + '</a>';
                        if (machine.freetier) {
                            html += '<span> *</span>'
                        }
                        return html;
                   }
                },
                {
                    id: 'datacenter',
                    name: 'Data Center',
                    sequence: 2,
                    active: false
                },
                {
                    id: 'datasetInfo',
                    name: 'Image',
                    sequence: 3,
                    active: true
                },
                {
                    id: 'created',
                    name: 'Created',
                    type: 'date',
                    sequence: 5,
                    active: true,
                    reverseSort: true
                },
                {
                    id: 'primaryIp',
                    name: 'IP',
                    _order: ipToInt,
                    sequence: 6,
                    active: true
                },
                {
                    id: 'state',
                    name: 'Status',
                    sequence: 7,
                    active: true,
                    _getter: stateOrder
                },
                {
                    id: 'updated',
                    name: 'Updated',
                    type: 'date',
                    sequence: 8,
                    active: true,
                    reverseSort: true
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
                    id: 'ips',
                    name: 'IPs',
                    sequence: 18,
                    active: false
                },
                {
                    id: 'compute_node',
                    name: 'CN UUID',
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

            if ($scope.features.manta === 'enabled') {
                $scope.gridUserConfig = Account.getUserConfig().$child('machines');
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

            var gridMessages = {
                start: {
                    single: 'Start selected instance?',
                    plural: 'Start selected instances?'
                },
                stop : {
                    single: 'Stopping this instance does not stop billing, your instance can be started after it is stopped.',
                    plural: 'Stopping selected instances does not stop billing, your instances can be started after they are stopped.',
                    freetier_single: 'Your instance can be started after it is stopped.',
                    freetier_plural: 'Your instances can be started after they are stopped.'
                },
                delete: {
                    single: 'Destroy the information on this instance and stop billing for this instance?',
                    plural: 'Destroy the information on these instances and stop billing for them?',
                    freetier_single: 'Destroying this instance.',
                    freetier_plural: 'Destroying selected instances.'
                },
                reboot: {
                    single: 'Restart this instance.',
                    plural: 'Restart selected instances.'
                }
            };

            var doFirewallAction = function (action) {
                var isFirewallNonSupported = false;
                var checkedInstances = $scope.getCheckedItems();
                var checkedInstancesQuantity = checkedInstances.length;

                if (checkedInstancesQuantity) {
                    var message = action + ' firewall for selected instance';
                    message += checkedInstancesQuantity > 1 ? 's?' : '?';

                    PopupDialog.confirm(
                        localization.translate(
                            $scope,
                            null,
                            'Confirm: ' + action + ' Firewall'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            message
                        ),
                        function () {
                            checkedInstances.forEach(function (machine) {
                                if ("virtualmachine" === machine.type) {
                                    isFirewallNonSupported = true;
                                } else if (action === 'Enable' !== machine.firewall_enabled) {
                                    $scope.toggleFirewallEnabled(machine);
                                }
                                machine.checked = false;
                            });
                            if (isFirewallNonSupported) {
                                $scope.notSupportedFirewallMessage();
                            }
                        }
                    );
                } else {
                    $scope.noCheckBoxChecked();
                }
            };

            $scope.gridActionButtons = [
                {
                    label: 'Start',
                    action: function (object) {
                        makeMachineAction('start', 'Confirm: Start instances', gridMessages.start);
                    },
                    sequence: 1
                },
                {
                    label: 'Stop',
                    action: function (object) {
                        makeMachineAction('stop', 'Confirm: Stop instances', gridMessages.stop);
                    },
                    sequence: 2
                },
                {
                    label: 'Enable Firewall',
                    show: function () {
                        return $rootScope.features.firewall !== 'disabled';
                    },
                    action: function () {
                        doFirewallAction('Enable');
                    },
                    sequence: 3
                },
                {
                    label: 'Disable Firewall',
                    show: function () {
                        return $rootScope.features.firewall !== 'disabled';
                    },
                    action: function () {
                        doFirewallAction('Disable');
                    },
                    sequence: 4
                },
                {
                    label: 'Delete',
                    action: function () {
                        makeMachineAction('delete', 'Confirm: Delete instances', gridMessages.delete);
                    },
                    sequence: 5
                },
                {
                    label: 'Reboot',
                    action: function () {
                        var messages = {
                            single: 'Restart this instance?',
                            plural: 'Restart selected instances?'
                        };
                        makeMachineAction('reboot', 'Confirm: Restart instances', messages);
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
                        $location.path("compute/create/simple");
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

            $scope.freeTierFound = function () {
                return $scope.machines.some(function (machine) {
                    return machine.freetier === true;
                });
            };

            $scope.tabFilterField = 'datacenter';
            $scope.tabFilterDefault = $rootScope.commonConfig($scope.tabFilterField);
            $scope.$on('gridViewChangeTab', function (event, tab) {
                if (tab === 'all') {
                    $rootScope.clearCommonConfig($scope.tabFilterField);
                } else {
                    $rootScope.commonConfig($scope.tabFilterField, tab);
                }
            });
        }

    ]);
}(window.angular, window.JP.getModule('Machine')));
