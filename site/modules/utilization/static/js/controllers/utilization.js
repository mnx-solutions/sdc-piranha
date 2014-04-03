'use strict';

(function (app) {
    app.controller(
        'Utilization.IndexController',
        ['$scope', 'requestContext', 'localization', 'Utilization', '$location', 'loggingService', function ($scope, requestContext, localization, Utilization, $location, loggingService) {
            $scope.loading = true;
            localization.bind('utilization', $scope);
            requestContext.setUpRenderContext('utilization.index', $scope);
            var loadData = function (event, context) {
                if (context && !context.startsWith('utilization.index')) {
                    return;
                }
                Utilization.utilization(requestContext.getParam('year'), requestContext.getParam('month'), function (error, utilizationData) {
                    $scope.dramChartData = utilizationData.dram;
                    $scope.bandwidthChartData = utilizationData.bandwidth;
                    $scope.loading = false;
                });
                loggingService.log('info', 'User navigated to ' + $location.$$path);
            };
            $scope.$on('requestContextChanged', loadData);
            loadData();

            $scope.clickUtilization = function (name) {
                $location.path('/utilization/' + name);
            };
        }]);
}(window.JP.getModule('utilization')));
