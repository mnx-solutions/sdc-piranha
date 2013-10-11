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
            $q.all([service.getBalancer(balancerId), service.getMachines()]).then(function (results) {
                $scope.server = results[0];
                var hostNames = {}, machines = results[1][0].machines;
                machines.forEach(function (machine) {
                    hostNames[machine.primaryIp] = machine.name;
                    hostNames[machine.name] = machine.id;
                });
                $scope.server.machines = ($scope.server.machines || []).map(function (machine) {
                    machine.name = hostNames[machine.host] || '';
                    machine.id = hostNames[machine.name] || '';
                    return machine;
                });
                $scope.detailLoaded = true;
            });

            $scope.edit = function () {
                $location.path('/elb/edit/' + balancerId);
            };

        }]);
}(window.JP.getModule('elb')));
