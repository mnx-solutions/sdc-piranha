'use strict';

(function (app) {
    app.controller(
        'elb.EditController',
        ['$scope', 'requestContext', 'localization', '$location', 'util', '$q', 'elb.Service',
                function ($scope, requestContext, localization, $location, util, $q, service) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.edit', $scope, {
                title: localization.translate(null, 'elb', 'Create/Edit Load Balancer')
            });

            $scope.balancerId = requestContext.getParam('balancerId');

            $scope.server = {};
            $scope.hc_delays = [1, 3, 5, 10];
            $scope.timeouts = [1, 2, 5, 10, 20];
            $scope.allLoading = false;

            $q.all([service.getBalancer($scope.balancerId), service.getBalancers(), service.getMachines()]).then(function (results) {
                var currentBalancer = results[0], balancers = results[1], machines = results[2];
                $scope.server = currentBalancer;
                $scope.protocolSelect($scope.server.protocol);
                $scope.server.fromPort = $scope.server.fromPort || 80;
                $scope.server.toPort = $scope.server.toPort || 80;
                $scope.server.health = $scope.server.health || {};
                $scope.server.health.timeout = $scope.server.health.timeout || 2;
                $scope.server.health.delay = $scope.server.health.delay || 5;
                $scope.server.health.failThreshold = $scope.server.health.failThreshold || 5;
                $scope.server.machines = $scope.server.machines || [];
                var elbMachines = $scope.server.machines.map(function (machine) {
                    return machine.host;
                });
                var hosts = {};
                balancers.forEach(function (balancer) {
                    (balancer.machines || []).forEach(function (machine) {
                        hosts[machine.host] = hosts[machine.host] || [];
                        hosts[machine.host].push({id: balancer.id, name: balancer.name});
                    });
                });
                //TODO: We should only list machines form current DC
                $scope.machines = machines[0].machines.map(function (machine) {
                    if (elbMachines.indexOf(machine.primaryIp) != -1) {
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
                $scope.protocolSelected = $scope.protocols.filter(function (protocol) {
                    return protocol.value === protocolValue;
                })[0] || $scope.protocols[0];
            };

            $scope.hc_delaySelect = function (name) {
                $scope.server.health.delay = name;
            };
            $scope.timeoutSelect = function (name) {
                $scope.server.health.timeout = name;
            };

            $scope.save = function () {
                var selectedMachines = $scope.machines.filter(function (machine) {
                    return machine.selected;
                }).map(function (machine) {
                    return machine.primaryIp;
                });
                $scope.server.protocol = $scope.protocolSelected.value;
                var operations = [];
                if ($scope.balancerId) {
                    var existingMachines = $scope.server.machines.map(function (machine) {
                        return machine.host;
                    });
                    var machinesToAdd = selectedMachines.filter(function (machine) {
                        return existingMachines.indexOf(machine) == -1;
                    });
                    var machinesToDelete = existingMachines.filter(function (machine) {
                        return selectedMachines.indexOf(machine) == -1;
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
                    $location.path('/elb/list');
                })
            };

            $scope.delete = function(){
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete Load Balancer'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Are you sure you want to delete this load balancer?'
                    ), function () {
                        service.deleteBalancer($scope.balancerId).then(function () {
                            $location.path('/elb/list');
                        });
                    });
            };
        }]);
}(window.JP.getModule('elb')));
