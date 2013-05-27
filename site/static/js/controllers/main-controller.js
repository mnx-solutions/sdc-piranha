'use strict';

(function (app) {
    app.controller('MainController', [
        '$scope',
        '$rootScope',
        '$route',
        '$routeParams',
        '$window',
        '$$track',
        'requestContext',
        '$location',

        function ($scope, $rootScope, $route, $routeParams, $window, $$track, requestContext, $location) {
            $scope.windowTitle = 'Joyent Portal';

            $scope.setWindowTitle = function (title) {
                $scope.windowTitle = title;
            };

            // Get the render context local to this controller (and relevant params).
            var renderContext = requestContext.getRenderContext();

            // The subview indicates which view is going to be rendered on the page.
            $scope.subview = renderContext.getNextSection();

            // I handle changes to the request context.
            $scope.$on(
                'requestContextChanged',
                function () {
                    // track page change
                    $$track.page();

                    // Make sure this change is relevant to this controller.
                    if (!renderContext.isChangeRelevant()) {
                        return;
                    }


                    // Update the view that is being rendered.
                    $scope.subview = renderContext.getNextSection();
                });

            // Listen for route changes so that we can
            // trigger request-context change events.
            $scope.$on(
                '$routeChangeSuccess',
                function () {

                    // If this is a redirect directive,
                    // then there's no action to be taken.
                    if (!$route.current.action) {
                        return;
                    }

                    // Update the current request action change.
                    requestContext.setContext($route.current.action, $routeParams);

                    // Announce the change in render conditions.
                    $scope.$broadcast('requestContextChanged', requestContext);
                });

            $scope.$on('errorContextChanged', function (scope, context) {
                requestContext.setContext('error.index', $routeParams);
                $scope.subview = renderContext.getNextSection();
            });

            $rootScope.$on(
                'forceUpdate',
                function (){
                    console.log('broadcasting - update');
                    $scope.$broadcast('event:forceUpdate');
                }
            );

            $scope.requireLogin = function () {
                $rootScope.$broadcast('event:auth-loginRequired');
            };

            var oldLocation;
            $scope.cancelLogin = function () {
                $scope.subview = oldLocation;
            };

            $rootScope.$on('event:auth-loginRequired', function () {
                oldLocation = $window.location;
                $window.location = '/landing/forgetToken';
            });

            $rootScope.$on('event:auth-loginConfirmed', function () {
                $window.location.href = oldLocation;
            });

            $scope.changeLocation = function(path) {
                $location.path(path);
            };
        }
    ]);
}(window.JP.main));
