'use strict';

(function (app) {
    app.controller(
        'elb.EditController',
        ['$scope', 'requestContext', 'localization', function ($scope, requestContext, localization) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.list', $scope, {
                title: localization.translate(null, 'elb', 'Load Balancers List')
            });

        }]);
}(window.JP.getModule('elb')));
