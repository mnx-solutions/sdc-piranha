'use strict';

(function (app) {
    app.controller(
        'Utilization.IndexController',
        ['$scope', 'requestContext', 'localization', 'Utilization', '$location', function ($scope, requestContext, localization, Utilization, $location) {
            $scope.loading = true;
            localization.bind('utilization', $scope);
            requestContext.setUpRenderContext('utilization.index', $scope);

            Utilization.utilization(function (error, utilizationData) {
                $scope.utilizationData = utilizationData;
                $scope.loading = false;
            });

            $scope.clickUtilization = function (name) {
                $location.path('/utilization/' + name);
            };

            $scope.days = [];
            for (var i = 1; i <= 30; i++) {
                $scope.days.push(i);
            };

        }]);
}(window.JP.getModule('utilization')));
