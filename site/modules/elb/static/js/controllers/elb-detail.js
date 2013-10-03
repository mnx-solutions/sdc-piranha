'use strict';

(function (app) {
    app.controller(
        'elb.EditController',
        ['$scope', 'requestContext', 'localization', function ($scope, requestContext, localization) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.detail', $scope, {
                title: localization.translate(null, 'elb', 'Load Balancer Details')
            });

        }]);
}(window.JP.getModule('elb')));
