'use strict';

(function (app) {
    app.controller(
        'elb.DetailController',
        ['$scope', 'requestContext', 'localization', '$resource', '$location',
                function ($scope, requestContext, localization, $resource, $location) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.detail', $scope, {
                title: localization.translate(null, 'elb', 'Load Balancer Details')
            });

            var balancerId = requestContext.getParam('balancerId');
            var resource = $resource('elb/item/:id', {id:'@id'});
            $scope.server = resource.get({id: balancerId});

            $scope.edit = function () {
                $location.path('/elb/edit/' + $scope.server.id);
            };

        }]);
}(window.JP.getModule('elb')));
