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
                // TODO: use dialog
                util.message(
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
                    type: 'firewall_enabled',
                    _getter: function (object) {
                        var state = '';

                        if (object.firewall_enabled) {
                            state = '<span class="fw-enabled-text">On</span>';
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
//                    disabled: function (object) {
//                        return object.state === 'running' || (object.job && !object.job.finished);
//                    },
                    action: function (object) {
                        if($scope.actionButton()) {
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Start instances'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Start selected instances'
                                ), function () {
                                    $scope.machines.forEach(function (el) {
                                        if(el.checked){
                                            $$track.event('machine', 'start');
                                            Machine.startMachine(el.id);
                                            el.checked = false;
                                        }
                                    });
                                });
                        }else $scope.noCheckBoxChecked();
                    },
//                    tooltip: 'Instance configuration and data is preserved when instances are stopped. Use start to restart your instance.',
                    sequence: 1
                },
                {
                    label: 'Stop',
//                    disabled: function (object) {
//                        return object.state === 'stopped' || (object.job && !object.job.finished);
//                    },
                    action: function (object) {
                        if($scope.actionButton()) {
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Stop instance'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Stopping selected instances does not stop billing, your instance can be started after it is stopped.'
                                ), function () {
                                    $scope.machines.forEach(function (el) {
                                        if(el.checked){
                                            $$track.event('machine', 'stop');
                                            Machine.stopMachine(el.id);
                                            el.checked = false;
                                        }
                                    });
                                });
                        }else $scope.noCheckBoxChecked();
                    },
//                    tooltip: 'Stopping an instance does not stop billing. You can restart your instance after you stop your machine.',
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
                                            console.log('Enable FW ready');
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
//                    disabled: function (object) {
//                        return object.state !== 'stopped' || (object.job && !object.job.finished);
//                    },
                    action: function (object) {
                        if($scope.actionButton()) {
                            var checkedInstances = [];
                            var message = '';
                            $scope.machines.forEach(function (el) {
                                if (el.checked) {
                                    checkedInstances.push(el);
                                }
                            });
                            message = checkedInstances.length > 1 ?
                                'Destroy the information on these instances and stop billing for them.' :
                                'Destroy the information on this instance and stop billing for selected instances.';
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Delete instance'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    message
                                ), function () {
                                    checkedInstances.forEach(function (el) {
                                        if (el.state === 'running') {
                                            $$track.event('machine', 'stop');
                                            Machine.stopMachine(el.id).getJob().done(function () {
                                                $scope.deleteInstance(el);
                                            });
                                        } else {
                                            $scope.deleteInstance(el);
                                        }
                                    });
                                });
                        }else $scope.noCheckBoxChecked();
                    },
//                    tooltip: 'You will lose all information and data on this instance if you delete an instance. Deleting an instance also stops billing.',
                    sequence: 5
                },
                {
                    label: 'Reboot',
//                    disabled: function (object) {
//                        return object.state !== 'running' || (object.job && !object.job.finished);
//                    },

                    action: function (object) {
                        if($scope.actionButton()) {
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Restart instance'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Restart selected instances'
                                ), function() {
                                    $scope.machines.forEach(function (el) {
                                        if (el.checked) {
                                            if (el.state != "stopped") {
                                                Machine.rebootMachine (el.id);
                                                $$track.event ('machine', 'reboot');
                                            }
                                            el.checked = false;
                                        }
                                    });
                                });
                        }else $scope.noCheckBoxChecked();
                    },
//                    tooltip: 'Click here to reboot your instance.',
                    sequence: 6
                }
            ];

            $scope.exportFields = {
                ignore: ['metadata']
            };

            $scope.columnsButton = true;
            $scope.actionsButton = true;
            $scope.instForm = true;
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
