'use strict';

(function (app) {
    app.controller('Machine.IndexController', [
        '$scope',
        '$$track',
        '$q',
        'util',
        'requestContext',
        'Machine',
        'Image',
        'Package',
        'localization',
        'PopupDialog',
        '$location',
        'firewall',
        '$rootScope',
        'Account',
        'FreeTier',
        'Docker',
        function ($scope, $$track, $q, util, requestContext, Machine, Image, Package, localization, PopupDialog, $location, firewall, $rootScope, Account, FreeTier, Docker) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.index', $scope, {
                title: localization.translate(null, 'machine', 'See my ' + $scope.company.name + ' Instances')
            });
            var currentLocation = $location.path();
            $scope.loading = true;
            $scope.datasetsInfo = {};

            // Pagination
            function loadMachines() {
                var type = requestContext.getParam('type') || '';
                $scope.machines = Machine.machine();
                if (type) {
                    $scope.machines = $scope.machines.filter(function (machine) {
                        return machine.tags.JPC_tag === type;
                    });
                    $scope.forceTabActive = 'all';
                }
                $scope.machinesFilter = Machine.getTagFilter(type, $scope.machines);
            }
            loadMachines();
            $scope.$on('$routeChangeSuccess', loadMachines);
            $scope.packages = Package.package();
            $scope.gotoCreatePage = Machine.gotoCreatePage;

            if ($scope.features.freetier === 'enabled') {
                FreeTier.freetier().then(function (data) {
                    $scope.freetier = data;
                }, function (err) {
                    PopupDialog.errorObj(err, function () {
                        $location.url('/compute/create/simple');
                        $location.replace();
                    });
                });
            }

            $scope.$watch('machines', function (machines) {
                if (!machines.length && machines.final) {
                    Machine.gotoCreatePage();
                }
                machines.forEach(function (machine) {
                    machine.label = machine.name || machine.id;
                });
            }, true);

            var isDockerContainer = function (machine) {
                return machine && machine.tags && machine.tags.sdc_docker;
            };

            function setImageName(image, machine) {
                var imageId = image && image.id || image;
                var imageName = 'Image deleted';
                if (image && typeof image !== 'string') {
                    imageName = image.name + '/' + image.version;
                } else if (isDockerContainer(machine)) {
                    imageName = 'Triton image';
                }
                $scope.datasetsInfo[imageId] = imageName;
            }

            var trackDeletingMachines = function () {
                var timeout = 1000; //ms
                var deletingMachines = $scope.machines.filter(function (machine) {
                    return machine.state === 'deleting';
                });
                if (deletingMachines.length) {
                    setTimeout(function () {
                        Machine.pollMachines(timeout, true);
                        trackDeletingMachines();
                    }, timeout);
                }
                if (!$scope.machines.length) {
                    Machine.gotoCreatePage();
                }
            };

            $scope.$watch('machines.final', function (result) {
                if (result) {
                    $q.when($scope.machines, function (machines) {
                        var isRemoval = false;
                        machines.forEach(function (machine) {
                            Image.image({datacenter: machine.datacenter}).then(function (datasets) {
                                datasets.forEach(function (dataset) {
                                    setImageName(dataset, machine);
                                });
                                var imageExists = datasets.some(function (image) { return image.id === machine.image; });
                                if (machine.image && !imageExists && !$scope.datasetsInfo[machine.image]) {
                                    setImageName(machine.image, machine);
                                }
                                if (isDockerContainer(machine) && $scope.features.docker === 'enabled' &&
                                    machine.state !== 'deleting') {
                                    Docker.hasLinkedContainers(machine).then(function (res) {
                                        machine.isLinkedContainer = res;
                                    });
                                }
                                $scope.loading = false;
                            }, function (err) {
                                $scope.loading = false;
                                PopupDialog.errorObj(err);
                            });
                            if (machine.state === 'deleting') {
                                machine.deleteJob = true;
                                isRemoval = true;
                            }
                        });
                        if (isRemoval) {
                            trackDeletingMachines();
                        }

                        if (!$scope.machines.length) {
                            Machine.gotoCreatePage();
                        }
                    });
                    var permissionErrors = Machine.getCacheErrors() || [];
                    permissionErrors.forEach(function (errorMessage) {
                        PopupDialog.errorObj({message: errorMessage});
                    });
                    Machine.clearCacheErrors();
                }
            });

            $scope.noCheckBoxChecked = function() {
                PopupDialog.noItemsSelectedError('instance');
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
                var linkedContainerMessage = '';
                if ($scope.checkedInstances.length) {
                    var checkedFreeMachines = true;
                    var checkedMachines = $scope.machines.filter(function (machine) {
                        if (machine.checked) {
                            if ((action === 'stop' || action === 'delete') && machine.isLinkedContainer) {
                                linkedContainerMessage = 'Instance has Docker containers linked. ';
                            }
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
                                var showFreeMessage = checkedFreeMachines || $scope.features.billing === 'disabled';
                                var result = linkedContainerMessage + messageBody.single;
                                if ($scope.checkedInstances.length > 1) {
                                    result = showFreeMessage && messageBody.freetier_plural ?
                                        messageBody.freetier_plural : linkedContainerMessage + messageBody.plural;
                                } else if (showFreeMessage && messageBody.freetier_single) {
                                    result = messageBody.freetier_single;
                                }
                                return result;
                            }())
                        ), function () {
                            checkedMachines.forEach(function (el) {
                                if (action === 'delete') {
                                    $$track.event('machine', 'delete');
                                    var resolvedDeleteAction = function (el, isDeletedDockerMachine) {
                                        if ($location.path() === '/compute/instance/' + el.id) {
                                            PopupDialog.message('Message', 'Your instance "' + el.name + '" has been successfully deleted.');
                                            $location.path('/compute');
                                        }
                                        if (!$scope.machines.length && currentLocation === $location.path()) {
                                            Machine.gotoCreatePage();
                                        }
                                        Machine.gotoDockerDashboard($scope.machines, isDeletedDockerMachine);
                                        el.checked = false;
                                    };
                                    if (el.tags && el.tags.JPC_tag === 'DockerHost' && $scope.features.docker === 'enabled') {
                                        Machine.deleteDockerMachine(el).then(function () {
                                            resolvedDeleteAction(el, true);
                                        });
                                    } else {
                                        Machine.deleteMachine(el.id).then(function () {
                                            resolvedDeleteAction(el);
                                        });
                                    }

                                } else {
                                    $$track.event('machine', action);
                                    Machine[action + 'Machine'](el.id);
                                }
                                el.checked = false;
                            });
                            $scope.checkedInstances = [];
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

            $scope.gridOrder = [stateOrder, '-created'];
            $scope.fantomSort = {primary: {name: 'Status'} , secondary: {name: 'Created', order: 1}};
            $scope.gridProps = [
                {
                    id: 'label',
                    name: 'Name',
                    _order: 'name',
                    sequence: 1,
                    active: true,
                    type: 'html',
                    _getter: function (machine) {
                        var html = !machine.image ? machine.label : '<a href="#!/compute/instance/' + machine.id + '" style="min-width: 140px;">' + machine.label + '</a>';
                        if (machine.freetier) {
                            html += '<span> * FREE</span>';
                        }
                        return html;
                   }
                },
                {
                    id: 'primaryIp',
                    name: 'IP',
                    entryType: 'ipAddress',
                    sequence: 2,
                    active: true,
                    _getter: function (machine) {
                        return machine.primaryIp || machine.privateIps && machine.privateIps[0];
                    }
                },
                {
                    id: '',
                    name: 'Image',
                    sequence: 3,
                    active: true,
                    type: 'tooltip',
                    _export: function (machine) {
                        return this._getter(machine).data;
                    },
                    _getter: function (machine) {
                        if (machine.image && $scope.datasetsInfo) {
                            var machineImage = {data: $scope.datasetsInfo[machine.image]};
                            if (machineImage.data === 'Image deleted') {
                                machineImage.tooltip = 'The image is no longer accessible because the image has been deleted, is inactive, or access privileges have been removed.';
                            }
                            if (isDockerContainer(machine) && $scope.features.combinedInstances === 'enabled' &&
                                $location.path() === '/compute/combined-instances') {
                                machineImage.data += ': ' + machine.imageName;
                            }
                            return machineImage;
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
                    _export: function (object) {
                        return object.state;
                    },
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
                    entryType: Number,
                    sequence: 11,
                    active: false
                },
                {
                    id: 'disk',
                    name: 'Disk',
                    entryType: Number,
                    sequence: 12,
                    active: false
                },
                {
                    id: 'tags',
                    name: 'Tags',
                    _order: function (machine) {
                        return JSON.stringify(machine.tags);
                    },
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
                    type: 'progress',
                    _export: function (object) {
                        var state = this._getter(object);
                        return state === 'N/A' ? state : angular.element(state).text() || state;
                    },
                    _inProgress: function (object) {
                        return object.fireWallActionRunning;
                    },
                    _getter: function (object) {
                        var state = '';

                        if (object.firewall_enabled) {
                            state = '<span class="grid-enabled-text">On</span>';
                        } else if (!object.firewall_supported || !object.hasOwnProperty("firewall_enabled")) {
                            state = 'N/A';
                        } else {
                            state = 'Off';
                        }
                        return state;
                    }
                };
                $scope.gridProps.splice(2, 0, firewallColumn);
            }

            $scope.gridPropsV2 = [];
            if ($scope.features.combinedInstances === 'enabled') {
                $scope.gridPropsV2 = angular.copy($scope.gridProps);
                var columnType = $scope.gridPropsV2.find(function (prop) {
                    return prop.id === 'type';
                });
                if (columnType) {
                    $scope.gridPropsV2.splice($scope.gridPropsV2.indexOf(columnType), 1);
                }
                $scope.loading = true;
                if ($scope.features.docker === 'enabled' && $scope.features.sdcDocker === 'enabled') {
                    Docker.listContainers({host: 'All', cache: true, options: {all: true}, suppressErrors: true}).then(function (containers) {
                        if (containers && containers.length) {
                            $scope.machines.forEach(function (machine) {
                                if (isDockerContainer(machine)) {
                                    var container = containers.find(function (container) {
                                        return util.idToUuid(container.Id) === machine.id;
                                    });
                                    if (container) {
                                        machine.imageName = container.Image;
                                        machine.Command = container.Command;
                                        machine.Status = container.Status;
                                        machine.Ports = container.Ports;
                                        machine.Names = container.Names;
                                    }
                                }
                            });
                        }
                    }, function (err) {
                        PopupDialog.errorObj(err);
                    }).finally(function () {
                        $scope.loading = false;
                    });
                }
                var additionalDockerColumns = [
                    {
                        id: 'Command',
                        name: 'Command',
                        sequence: 19
                    },
                    {
                        id: 'Status',
                        name: 'Duration',
                        sequence: 20,
                        active: true
                    },
                    {
                        id: 'Ports',
                        name: 'Ports',
                        sequence: 21
                    },
                    {
                        id: 'Names',
                        name: 'Links',
                        type: 'html',
                        _getter: function (container) {
                            var html = '';
                            var length = container.Names && container.Names.length || 0;
                            if (length > 1) {
                                for (var i = 1; i < length; i++) {
                                    html += '<span>' + container.Names[i].substring(1) + '</span>';
                                    html += i !== length - 1 ? '<span>, </span>' : '';
                                }
                            }
                            return html;
                        },
                        sequence: 22
                    }
                ];
                $scope.gridPropsV2 = $scope.gridPropsV2.concat(additionalDockerColumns);
            }

            if ($scope.features.manta === 'enabled') {
                $scope.gridUserConfig = 'machines';
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
                var checkedInstancesQuantity = $scope.checkedInstances.length;

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
                            $scope.checkedInstances.forEach(function (machine) {
                                if (!machine.firewall_supported) {
                                    isFirewallNonSupported = true;
                                } else if (action === 'Enable' !== machine.firewall_enabled) {
                                    $scope.toggleFirewallEnabled(machine);
                                }
                                machine.checked = false;
                            });
                            $scope.checkedInstances = [];
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
                if (tab === 'all' || $scope.forceTabActive) {
                    $rootScope.clearCommonConfig($scope.tabFilterField);
                } else {
                    $rootScope.commonConfig($scope.tabFilterField, tab);
                }
            });
        }

    ]);
}(window.JP.getModule('Machine')));
