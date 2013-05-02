'use strict';

(function (ng, app) {
    app.controller(
        'error.IndexController',
        [ '$scope', '$rootScope', '$route', '$routeParams', 'requestContext', 'errorContext',

            function ($scope, $rootScope, $route, $routeParams, requestContext, errorContext) {
                requestContext.setUpRenderContext('error.index', $scope);

                $scope.$on('errorContextChanged', function (scope, context) {
                    $scope.error = context.getContext().err;
                });

                $scope.error = errorContext.getContext().err;

            }
        ]);
}(window.angular, window.JP.getModule('error')));
