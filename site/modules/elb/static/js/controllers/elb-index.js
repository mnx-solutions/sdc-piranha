'use strict';

(function (app) {
    app.controller(
        'elb.IndexController',
        ['$scope', 'requestContext', 'localization', function ($scope, requestContext, localization) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.index', $scope, {
                title: localization.translate(null, 'elb', 'Enable Load Balancing')
            });

        }]);
}(window.JP.getModule('elb')));
