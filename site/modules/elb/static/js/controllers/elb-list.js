'use strict';

(function (app) {
    app.controller(
        'elb.ListController',
        ['$scope', 'requestContext', 'localization', 'elb.Service', function ($scope, requestContext, localization, service) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.list', $scope, {
                title: localization.translate(null, 'elb', 'Load Balancers List')
            });

            $scope.servers = [];
            service.getBalancers().then(function (data) {
                $scope.servers = data;
            });

        }]);
}(window.JP.getModule('elb')));
