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
            $rootScope.features = window.JP.get('features') || {};

            $scope.windowTitle = 'Joyent Cloud';

            $scope.setWindowTitle = function (title) {
                $scope.windowTitle = title;
            };

            $rootScope.zenboxParams = window.JP.get('zendesk') || {};
            if (typeof(window.Zenbox) !== "undefined") {
                window.Zenbox.init($rootScope.zenboxParams);
                window.angular.element("#zenbox_tab").click(function () {
                    if (typeof(window._gaq) !== "undefined") {
                        window._gaq.push(["_trackEvent", "Window Open", "Zenbox Support"]);
                    }
                });
            }

            // Get the render context local to this controller (and relevant params).
            var renderContext = requestContext.getRenderContext();

            var commonConfig = {};

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

                    $scope.currentHref = encodeURIComponent($location.absUrl());

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
                    // Appropriate redirect for signup steps
                    var currentStep = $('#signupStep').val();
                    if (currentStep
                        && !(currentStep === 'complete' || currentStep === 'completed')
                        && $route.current.action.indexOf('signup') === -1) {
                        requestContext.setContext('signup.'+currentStep, $routeParams);
                    } else if ($scope.features.slb !== 'enabled' && $route.current.action.indexOf('slb') === 0) {
                        requestContext.setContext('dashboard.index', $routeParams);
                    } else {
                        // Update the current request action change.
                        requestContext.setContext($route.current.action, $routeParams);
                    }

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

            $rootScope.commonConfig = function (name, value) {
                if (!name) {
                    return commonConfig;
                }

                if (!value) {
                    return commonConfig[name];
                }

                commonConfig[name] = value;
            };

            $rootScope.clearCommonConfig = function (name) {
                if (name) {
                    delete commonConfig[name];
                } else {
                    commonConfig = {};
                }
            };
        }
    ]);
}(window.JP.main));
