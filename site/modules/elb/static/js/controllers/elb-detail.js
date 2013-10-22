'use strict';

(function (app) {
    app.controller(
        'elb.DetailController',
        ['$scope', 'requestContext', 'localization', 'elb.Service', '$location', '$q',
                function ($scope, requestContext, localization, service, $location, $q) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.detail', $scope, {
                title: localization.translate(null, 'elb', 'Load Balancer Details')
            });

            var balancerId = requestContext.getParam('balancerId');
            $scope.detailLoaded = false;
            $scope.server = {};
            $q.all([service.getBalancer(balancerId), service.getMachines(), service.getBalancerUsage(balancerId)]).then(function (results) {
                $scope.server = results[0];
                var hostNames = {}, machines = results[1][0].machines;
                var usage = results[2];
                console.log(usage); //TODO: Bind this to graphs available
                machines.forEach(function (machine) {
                    hostNames[machine.primaryIp] = machine.name;
                    hostNames[machine.name] = machine.id;
                    hostNames[machine.dc] = machine.datacenter;
                });
                $scope.server.machines = ($scope.server.machines || []).map(function (machine) {
                    machine.name = hostNames[machine.host] || '';
                    machine.id = hostNames[machine.name] || '';
                    machine.datacenter = hostNames[machine.dc] || '';
                    return machine;
                });
                $scope.detailLoaded = true;
            });

            $scope.edit = function () {
                $location.path('/elb/edit/' + balancerId);
            };

        }]);
}(window.JP.getModule('elb')));
