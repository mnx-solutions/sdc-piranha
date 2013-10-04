'use strict';

(function (app) {
    app.controller(
        'elb.EditController',
        ['$scope', 'requestContext', 'localization', '$resource', function ($scope, requestContext, localization, $resource) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.edit', $scope, {
                title: localization.translate(null, 'elb', 'Create/Edit Load Balancer')
            });

            var balancerId = requestContext.getParam('balancerId');
            var resource = $resource('elb/item/:id', {id:'@id'});

            $scope.server = resource.get({id: balancerId});

            $scope.save = function () {
                $scope.server.$save();
            };

        }]);
}(window.JP.getModule('elb')));
