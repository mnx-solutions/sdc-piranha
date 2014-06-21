'use strict';

(function (app) {
    app.controller('Machine.IndexController', [
        '$scope',
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

        function ($scope, $$track, $q, requestContext, Machine, Dataset, Package, localization, PopupDialog, $location, firewall, $rootScope, Account, FreeTier) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.index', $scope, {
                title: localization.translate(null, 'machine', 'See my Joyent Instances')
            });
            var currentLocation = $location.path();
            $scope.loading = true;
            $scope.datasetsInfo = {};

            // Pagination
            $scope.machines = Machine.machine();
            $scope.packages = Package.package();
            $scope.gotoCreatePage = Machine.gotoCreatePage;

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
                });
            }, true);

            $scope.$watch('machines.final', function (result) {
                if (result) {
                    $q.when($scope.machines, function (machines) {
                        machines.forEach(function (machine) {
                            Dataset.dataset({datacenter: machine.datacenter}).then(function (datasets) {
                                datasets.forEach(function (dataset) {
                                    $scope.datasetsInfo[dataset.id] = dataset.name + '/' + dataset.version;
                                });
                                var imageExists = datasets.some(function (image) { return image.id === machine.image; });
                                if (!imageExists && !$scope.datasetsInfo[machine.image]) {
                                    $scope.datasetsInfo[machine.image] = 'Image gone';
                                }
                                $scope.loading = false;
                            });
                        });

                        if (!$scope.machines.length) {
                            Machine.gotoCreatePage();
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
                    var checkedFreeMachines = true;
                    var checkedMachines = $scope.machines.filter(function (machine) {
                        if (machine.checked) {
                            if (!machine.freetier) {
                                checkedFreeMachines = false;
                            }
                            switch (action) {
                            case 'start':
                                if (machine.state === 'stopped') {
                                    return true;
                                }
                                machine.checked = false;
                                return false;
                            case 'stop':
                                if (machine.state === 'running') {
                                    return true;
                                }
                                machine.checked = false;
                                return false;
                            case 'reboot':
                                if (machine.state !== 'stopped') {
                                    return true;
                                }
                                machine.checked = false;
                                return false;
                            case 'delete':
                                return true;
                            default:
                                return false;
                            }
                        } else {
                            return false;
                        }
                        return false;
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
                            (function () {
                                var result = messageBody.single;
                                if (checkedInstances.length > 1) {
                                    result = checkedFreeMachines && messageBody.freetier_plural ?
                                        messageBody.freetier_plural : messageBody.plural;
                                } else if (checkedFreeMachines && messageBody.freetier_single) {
                                    result = messageBody.freetier_single;
                                }
                                return result;
                            }())
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
                var result = 0;
                if (object.primaryIp) {
                    var octets = object.primaryIp.split('.');
                    var buffer = new ArrayBuffer(4);
                    var dataView = new DataView(buffer);
                    for (var i = 0; i < 4; i++) {
                        dataView.setUint8(i, octets[i]);
                    }
                    result = dataView.getUint32(0);
                }
                return result;
            };

            $scope.gridOrder = [stateOrder, '-created'];
            $scope.fantomSort = {primary: {name: 'Status'} , secondary: {name: 'Created', order: 1}};
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
                            html += '<span> * FREE</span>';
                        }
                        return html;
                   }
                },
                {
                    id: 'primaryIp',
                    name: 'IP',
                    _order: ipToInt,
                    sequence: 2,
                    active: true
                },
                {
                    id: '',
                    name: 'Image',
                    sequence: 3,
                    active: true,
                    _getter: function (machine) {
                        if (machine.image && $scope.datasetsInfo) {
                            return $scope.datasetsInfo[machine.image];
                        }
                        return '';
                    }
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
                    id: 'datacenter',
                    name: 'Data Center',
                    sequence: 6,
                    active: false
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
                    id: 'type',
                    name: 'Type',
                    sequence: 10,
                    active: false
                },
                {
                    id: 'memory',
                    name: 'Memory',
                    sequence: 11,
                    active: false
                },
                {
                    id: 'disk',
                    name: 'Disk',
                    sequence: 12,
                    active: false
                },
                {
                    id: 'tags',
                    name: 'Tags',
                    sequence: 13,
                    active: false
                },
                {
                    id: 'credentials',
                    name: 'Credentials',
                    sequence: 14,
                    active: false
                },
                {
                    id: 'package',
                    name: 'Package',
                    sequence: 15,
                    active: false
                },
                {
                    id: 'image',
                    name: 'Image ID',
                    sequence: 16,
                    active: false
                },
                {
                    id: 'ips',
                    name: 'IPs',
                    sequence: 17,
                    active: false
                },
                {
                    id: 'compute_node',
                    name: 'CN UUID',
                    sequence: 18,
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
                    single: 'Please confirm that you want to stop this instance. Once stopped, you can delete the instance in order to halt billing.',
                    plural: 'Please confirm that you want to stop selected instances. Once stopped, you can delete the instances in order to halt billing.',
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
                    action: function () {
                        makeMachineAction('start', 'Confirm: Start instances', gridMessages.start);
                    },
                    sequence: 1
                },
                {
                    label: 'Stop',
                    action: function () {
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
                    if (!$scope.machines.length && currentLocation === $location.path()) {
                        Machine.gotoCreatePage();
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
}(window.JP.getModule('Machine')));
