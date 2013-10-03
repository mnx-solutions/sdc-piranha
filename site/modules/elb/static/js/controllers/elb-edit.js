'use strict';

(function (app) {
    app.controller(
        'elb.EditController',
        ['$scope', 'requestContext', 'localization', function ($scope, requestContext, localization) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.edit', $scope, {
                title: localization.translate(null, 'elb', 'Create/Edit Load Balancer')
            });

        }]);
}(window.JP.getModule('elb')));
