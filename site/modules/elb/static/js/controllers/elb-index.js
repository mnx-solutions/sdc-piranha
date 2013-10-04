'use strict';

(function (app) {
    app.controller(
        'elb.IndexController',
        ['$scope', 'requestContext', 'localization', '$location', function ($scope, requestContext, localization, $location) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.index', $scope, {
                title: localization.translate(null, 'elb', 'Enable Load Balancing')
            });

            $scope.enableElb = function () {
                $location.path('/elb/list');
            };

        }]);
}(window.JP.getModule('elb')));
