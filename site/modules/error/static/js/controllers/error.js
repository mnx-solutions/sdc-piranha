'use strict';

(function (ng, app) {
    console.log('LISTEN LISTEN!')
    app.controller(
        'error.IndexController',
        [ '$scope', '$rootScope', '$route', '$routeParams', 'requestContext', 'errorContext',

            function ($scope, $rootScope, $route, $routeParams, requestContext, errorContext) {
                requestContext.setUpRenderContext('error.index', $scope);

            }
        ]);
}(window.angular, window.JP.getModule('error')));
