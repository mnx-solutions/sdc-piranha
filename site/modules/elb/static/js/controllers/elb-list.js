'use strict';

(function (app) {
    app.controller(
        'elb.ListController',
        ['$scope', 'requestContext', 'localization', 'elb.Service', '$location',
                function ($scope, requestContext, localization, service, $location) {
            $scope.listLoaded = false;
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.list', $scope, {
                title: localization.translate(null, 'elb', 'Load Balancers List')
            });

            $scope.disableLb = function () {
                service.deleteController().then(function () {
                    $location.path('/elb');
                });
            };

            $scope.servers = [];

            service.getBalancers().then(function (data) {
                $scope.servers = data;
                $scope.listLoaded = true;
            });

        }]);
}(window.JP.getModule('elb')));
