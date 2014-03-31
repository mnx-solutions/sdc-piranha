'use strict';

(function (app) {
    app.controller(
        'Utilization.IndexController',
        ['$scope', 'requestContext', 'localization', 'Utilization', '$location', function ($scope, requestContext, localization, Utilization, $location) {
            $scope.loading = true;
            localization.bind('utilization', $scope);
            requestContext.setUpRenderContext('utilization.index', $scope);

            Utilization.utilization(function (error, utilizationData) {
                $scope.dramChartData = utilizationData.dram.amount;
                $scope.bandwidthChartData = utilizationData.bandwidth.amount;
                $scope.loading = false;
            });

            $scope.clickUtilization = function (name) {
                $location.path('/utilization/' + name);
            };
        }]);
}(window.JP.getModule('utilization')));
