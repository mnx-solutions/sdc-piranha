'use strict';

(function (app) {
    app.controller(
        'Support.IndexController',
        ['$scope', 'requestContext', 'localization', 'Support', '$location', function ($scope, requestContext, localization, Support, $location) {
            $scope.loading = true;
            localization.bind('support', $scope);
            requestContext.setUpRenderContext('support.index', $scope);

            Support.support(function (error, supportPackages) {
                $scope.supportPackages = supportPackages;
                $scope.loading = false;
            });

            $scope.clickHolder = function (link) {
                $location.path('/support' + link);
            };
        }]);
}(window.JP.getModule('support')));
