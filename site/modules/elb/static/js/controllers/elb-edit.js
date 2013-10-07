'use strict';

(function (app) {
    app.controller(
        'elb.EditController',
        ['$scope', 'requestContext', 'localization', '$resource', '$location', function ($scope, requestContext, localization, $resource, $location) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.edit', $scope, {
                title: localization.translate(null, 'elb', 'Create/Edit Load Balancer')
            });

            var balancerId = requestContext.getParam('balancerId');
            var resource = $resource('elb/item/:id', {id:'@id'});

            $scope.protocols = ['HTTP', 'HTTPS', 'FTP', 'FTPS'];
            $scope.protocolSelected = $scope.protocols[0];

            $scope.server = resource.get({id: balancerId});

            $scope.save = function () {
                $scope.server.toPort = $scope.server.fromPort;
                $scope.server.$save();
                $location.path('/elb/list');
            };
            $scope.protocolSelect = function (name) {
                $scope.protocolSelected = name;
            };

        }]);
}(window.JP.getModule('elb')));
