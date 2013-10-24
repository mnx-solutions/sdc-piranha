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
                $scope.listLoaded = false;
                service.deleteController().then(function () {
                    $location.path('/elb');
                }, function (err) {
                    console.log(err);
                    $scope.listLoaded = true;
                });
            };

            $scope.servers = [];

            service.getController().then(function (isEnabled) {
                if (!isEnabled || $scope.features.elb !== 'enabled') {
                    $location.path('/elb');
                    return;
                }
                service.getBalancers().then(function (data) {
                    $scope.servers = data;
                    $scope.listLoaded = true;
                });
            });
        }]);
}(window.JP.getModule('elb')));
