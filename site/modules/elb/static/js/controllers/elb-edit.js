'use strict';

(function (app) {
    app.controller(
        'elb.EditController',
        ['$scope', 'requestContext', 'localization', '$resource', '$location', 'serverTab', 'util',
                function ($scope, requestContext, localization, $resource, $location, serverTab, util) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.edit', $scope, {
                title: localization.translate(null, 'elb', 'Create/Edit Load Balancer')
            });

            var balancerId = requestContext.getParam('balancerId');
            var resource = $resource('elb/item/:id', {id:'@id'});

            $scope.protocols = ['HTTP', 'HTTPS', 'TCP', 'TCPS'];

            $scope.server = resource.get({id: balancerId}, function () {
                $scope.server.protocol = $scope.server.protocol || 'HTTP';
                $scope.server.health = $scope.server.health || {};
                //$scope.server.health.failThreshold = $scope.server.health.failThreshold || 5;
                $scope.server.health.timeout = $scope.server.health.timeout || 2;
                $scope.server.health.timeout = $scope.server.health.timeout || 2;
                $scope.server.machines = $scope.server.machines || [];
                var elbMachines = $scope.server.machines.map(function (machine) {
                    return machine.host;
                });
                serverTab.call({
                    name: 'MachineList',
                    progress: function machineProgress(err, job) {
                        var data = job.__read();
                        //TODO: We should only list machines form current DC
                        $scope.machines = data[0].machines.map(function (machine) {
                            machine.created = machine.created.substring(0, 10);
                            if (elbMachines.indexOf(machine.primaryIp) != -1) {
                                machine.selected = true;
                            }
                            return machine;
                        });
                    }
                });
            });

            $scope.hc_delays = ['1','3','5','10'];
            $scope.hc_delaySelected = $scope.hc_delays[2]; //default

            $scope.timeouts = ['1','2','5','10','20'];
            $scope.timeoutSelected = $scope.timeouts[1]; //default

            $scope.server = resource.get({id: balancerId});

            $scope.save = function () {
                var selectedMachines = $scope.machines.filter(function (machine) {
                    return machine.selected;
                }).map(function (machine) {
                    return machine.primaryIp;
                });
                $scope.server.machines = selectedMachines;
                //$scope.server.toPort = $scope.server.fromPort;
                $scope.server.$save();
                $location.path('/elb/list');
            };

            $scope.deleteLB = function(){
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete Load Balacer'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Are you sure you want to delete?'
                    ), function () {
                        //delete function
                    });
            };
            $scope.protocolSelect = function (name) {
                $scope.server.protocol = name;
            };
            $scope.hc_delaySelect = function (name) {
                $scope.hc_delaySelected = name;
            };
            $scope.timeoutSelect = function (name) {
                $scope.timeoutSelected = name;
            };

        }]);
}(window.JP.getModule('elb')));
