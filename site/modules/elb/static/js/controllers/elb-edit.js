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

            var balancerId = requestContext.getParam('balancerId');

            $q.all([service.getBalancer(balancerId), service.getBalancers(), service.getMachines()]).then(function (results) {
                var balancer = results[0], balancers = results[1], machines = results[2];
                $scope.server = balancer;
                $scope.protocolSelect($scope.server.protocol);
                $scope.server.health = $scope.server.health || {};
                $scope.server.health.timeout = $scope.server.health.timeout || 2;
                $scope.server.machines = $scope.server.machines || [];
                var elbMachines = $scope.server.machines.map(function (machine) {
                    return machine.host;
                });
                //TODO: We should only list machines form current DC
                $scope.machines = machines[0].machines.map(function (machine) {
                    machine.created = machine.created.substring(0, 10);
                    if (elbMachines.indexOf(machine.primaryIp) != -1) {
                        machine.selected = true;
                    }
                    return machine;
                });
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

            $scope.server = {};

            $scope.hc_delays = ['1','3','5','10'];
            $scope.hc_delaySelected = $scope.hc_delays[2]; //default

            $scope.timeouts = [1, 2, 5, 10, 20];

            $scope.save = function () {
                var selectedMachines = $scope.machines.filter(function (machine) {
                    return machine.selected;
                }).map(function (machine) {
                    return machine.primaryIp;
                });
                $scope.server.machines = selectedMachines;
                $scope.server.protocol = $scope.protocolSelected.value;
                $scope.server.$save();
                $location.path('/elb/list');
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
                        $scope.server.$remove();
                        $location.path('/elb/list');
                    });
            };
            $scope.hc_delaySelect = function (name) {
                $scope.hc_delaySelected = name;
            };
            $scope.timeoutSelect = function (name) {
                $scope.server.health.timeout = name;
            };

        }]);
}(window.JP.getModule('elb')));
