'use strict';

(function (ng, app) {
    app.controller(
        'error.IndexController',
        [ '$scope', '$rootScope', '$route', '$routeParams', 'requestContext', 'errorContext',

            function ($scope, $rootScope, $route, $routeParams, requestContext, errorContext) {
                requestContext.setUpRenderContext('error.index', $scope);

                $scope.pageReload = function () {
                    $rootScope.checkConnection();
                };

                $scope.$on('errorContextChanged', function (scope, context) {
                    if (context) {
                        $scope.error = context.err || context.getContext().err;
                        $scope.error.isMantaNotAvailable = context.err.isMantaNotAvailable || false;
                    }
                });

                $scope.error = errorContext.getContext().err;

            }
        ]);
}(window.angular, window.JP.getModule('error')));
