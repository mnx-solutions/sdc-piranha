'use strict';

(function (app) {
    app.controller(
        'elb.ListController',
        ['$scope', 'requestContext', 'localization', 'elb.Service', function ($scope, requestContext, localization, service) {
                function ($scope, requestContext, localization, $location, service) {
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
