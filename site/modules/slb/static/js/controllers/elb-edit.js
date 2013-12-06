'use strict';

(function (app) {
    app.controller(
        'slb.EditController',
        ['$scope', 'requestContext', 'localization', '$location', 'util', '$q', 'slb.Service', 'Datacenter', 'notification',
            function ($scope, requestContext, localization, $location, util, $q, service, Datacenter, notification) {
                localization.bind('slb', $scope);
                requestContext.setUpRenderContext('slb.edit', $scope, {
                    title: localization.translate(null, 'slb', 'Create/Edit Load Balancer')
                });

                $scope.balancerId = requestContext.getParam('balancerId');
                $scope.server = {};
                $scope.hcDelays = [1, 3, 5, 10];
                $scope.timeouts = [1, 2, 5, 10, 20];
                $scope.allLoading = false;

                $q.all([service.getBalancer($scope.balancerId), service.getBalancers(), service.getMachines()]).then(function (results) {
                    var server = results[0];
                    var balancers = results[1];
                    var machines = results[2];

                    // Set defaults
                    server.fromPort = server.fromPort || 1024;
                    server.toPort = server.toPort || 80;
                    server.health = server.health || {};
                    server.health.timeout = server.health.timeout || 2;
                    server.health.delay = server.health.delay || 5;
                    server.health.failThreshold = server.health.failThreshold || 5;
                    server.machines = server.machines || [];

                    var slbMachines = server.machines.map(function (machine) {
                        return machine.host;
                    });
                    var hosts = {};
                    balancers.forEach(function (balancer) {
                        (balancer.machines || []).forEach(function (machine) {
                            hosts[machine.host] = hosts[machine.host] || [];
                            hosts[machine.host].push({id: balancer.id, name: balancer.name});
                        });
                    });

                    $scope.server = server;
                    $scope.protocolSelect(server.protocol);
                    Datacenter.datacenter().then(function (datacenters) {
                        $scope.datacenters = datacenters;
                        $scope.datacenterSelect(server.datacenter);
                    });

                    $scope.machines = machines.map(function (machine) {
                        if (slbMachines.indexOf(machine.primaryIp) !== -1) {
                            machine.selected = true;
                        }
                        machine.balancers = hosts[machine.primaryIp] || [];
                        return machine;
                    });
                    $scope.allLoading = true;
                });

                $scope.protocols = [
                    {name: 'HTTP', value: 'http'},
                    {name: 'HTTPS', value: 'https'},
                    {name: 'TCP', value: 'tcp'},
                    {name: 'TCPS', value: 'tcps'}
                ];

                $scope.protocolSelect = function (protocolValue) {
                    $scope.protocolSelected = $scope.protocols[0];
                    $scope.protocols.some(function (protocol) {
                        if (protocol.value === protocolValue) {
                            $scope.protocolSelected = protocol;
                            return true;
                        }
                        return false;
                    });
                };

                $scope.datacenterSelect = function (datacenterName) {
                    $scope.datacenterSelected = $scope.datacenters[0];
                    $scope.datacenters.some(function (datacenter) {
                        if (datacenter.name === datacenterName) {
                            $scope.datacenterSelected = datacenter;
                            return true;
                        }
                        return false;
                    });
                };

                $scope.hcDelaySelect = function (name) {
                    $scope.server.health.delay = name;
                };
                $scope.timeoutSelect = function (name) {
                    $scope.server.health.timeout = name;
                };

                $scope.validateSelected = function () {
                    $scope.hasMachineSelected = $scope.machines.some(function (machine) {
                        return machine.selected;
                    });
                };

                $scope.save = function () {
                    $scope.saving = true;
                    $scope.server.protocol = $scope.protocolSelected.value;
                    $scope.server.datacenter = $scope.datacenterSelected.name;
                    var selectedMachines = $scope.machines.filter(function (machine) {
                        return machine.selected;
                    }).map(function (machine) {
                        return machine.primaryIp;
                    });
                    var operations = [];
                    if ($scope.balancerId) {
                        var existingMachines = $scope.server.machines.map(function (machine) {
                            return machine.host;
                        });
                        var machinesToAdd = selectedMachines.filter(function (machine) {
                            return existingMachines.indexOf(machine) === -1;
                        });
                        var machinesToDelete = existingMachines.filter(function (machine) {
                            return selectedMachines.indexOf(machine) === -1;
                        });
                        machinesToAdd.forEach(function (machine) {
                            operations.push(service.addMachine($scope.balancerId, machine));
                        });
                        machinesToDelete.forEach(function (machine) {
                            operations.push(service.deleteMachine($scope.balancerId, machine));
                        });
                        operations.push(service.updateBalancer($scope.balancerId, $scope.server));
                    } else {
                        $scope.server.machines = selectedMachines;
                        operations.push(service.addBalancer($scope.server));
                    }
                    $q.all(operations).then(function () {
                        $location.path('/slb/list');
                    }, function (err) {
                        notification.replace('slb', { type: 'error' }, err);
                        $scope.saving = false;
                    });
                };

                $scope.validatePort = function (name, min, max) {
                    var input = $scope.editForm[name];
                    var value = input.$viewValue;
                    var reservedPorts = ['9070', '9080', '9090'];

                    min = min || 1024;
                    max = max || 65535; // max tcp port value
                    var isInteger = (value % 1) === 0;
                    input.$setValidity('port', isInteger && value >= min && value <= max && (reservedPorts.indexOf(value) === -1));
                };

                $scope.delete = function () {
                    util.confirm(
                        localization.translate(
                            $scope,
                            null,
                            'Confirm: Delete Load Balancer'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'Are you sure you want to delete this load balancer? You will be charged for Simple Load Balancer until you uninstall the feature.'
                        ),
                        function () {
                            $scope.saving = true;
                            service.deleteBalancer($scope.balancerId).then(function () {
                                $location.path('/slb/list');
                            }, function (err) {
                                notification.replace('slb', { type: 'error' }, err);
                                $scope.saving = false;
                            });
                        }
                    );
                };
            }]
    );
}(window.JP.getModule('slb')));
