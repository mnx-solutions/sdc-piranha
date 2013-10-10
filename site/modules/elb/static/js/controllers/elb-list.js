'use strict';

(function (app) {
    app.controller(
        'elb.ListController',
        ['$scope', 'requestContext', 'localization', 'elb.Service', function ($scope, requestContext, localization, service) {
            $scope.listLoaded = false;
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.list', $scope, {
                title: localization.translate(null, 'elb', 'Load Balancers List')
            });

            $scope.servers = [];

            service.getBalancers().then(function (data) {
                $scope.servers = data;
                $scope.listLoaded = true;
            });

        }]);
}(window.JP.getModule('elb')));
