'use strict';

(function (app) {
    app.controller(
        'elb.ListController',
        ['$scope', 'requestContext', 'localization', '$http', function ($scope, requestContext, localization, $http) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.list', $scope, {
                title: localization.translate(null, 'elb', 'Load Balancers List')
            });

            $scope.clients = $http.get('elb/list');

        }]);
}(window.JP.getModule('elb')));
