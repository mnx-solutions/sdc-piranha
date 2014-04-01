'use strict';

(function (app) {
    app.controller(
        'Utilization.IndexController',
        ['$scope', 'requestContext', 'localization', 'Utilization', '$location', function ($scope, requestContext, localization, Utilization, $location) {
            $scope.loading = true;
            localization.bind('utilization', $scope);
            requestContext.setUpRenderContext('utilization.index', $scope);
            var loadData = function () {
                Utilization.utilization(requestContext.getParam('year'), requestContext.getParam('month'), function (error, utilizationData) {
                    $scope.dramChartData = utilizationData.dram;
                    $scope.bandwidthChartData = utilizationData.bandwidth;
                    $scope.loading = false;
                });
            };
            $scope.$on('requestContextChanged', loadData);
            loadData();

            $scope.clickUtilization = function (name) {
                $location.path('/utilization/' + name);
            };
        }]);
}(window.JP.getModule('utilization')));
