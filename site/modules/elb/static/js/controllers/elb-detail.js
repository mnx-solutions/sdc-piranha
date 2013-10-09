'use strict';

(function (app) {
    app.controller(
        'elb.DetailController',
        ['$scope', 'requestContext', 'localization', 'elb.Service', '$location',
                function ($scope, requestContext, localization, service, $location) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.detail', $scope, {
                title: localization.translate(null, 'elb', 'Load Balancer Details')
            });

            var balancerId = requestContext.getParam('balancerId');
            $scope.server = {};
            service.getBalancer(balancerId).then(function (data) {
                $scope.server = data;
            });

            $scope.edit = function () {
                $location.path('/elb/edit/' + balancerId);
            };

        }]);
}(window.JP.getModule('elb')));
