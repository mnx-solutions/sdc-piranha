'use strict';

(function (app) {
    app.controller(
        'elb.ListController',
        ['$scope', 'requestContext', 'localization', '$resource', function ($scope, requestContext, localization, $resource) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.list', $scope, {
                title: localization.translate(null, 'elb', 'Load Balancers List')
            });

            var resource = $resource('elb/:id', {id:'@id'});
            $scope.clients = resource.query();

        }]);
}(window.JP.getModule('elb')));
