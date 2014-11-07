'use strict';

(function (app, ng) {
    app.directive('mainLeft', ['$rootScope', 'Support', 'requestContext', function ($rootScope, Support, requestContext) {
        return {
            templateUrl: 'left/static/partials/menu.html',
            scope: true,
            controller: function ($scope, $location) {
                $scope.location = $location;
                $scope.sideBarMin = false;
                var supportPackagesCallback = function (error, supportPackages) {
                    $scope.supportPackages = supportPackages;
                };

                var loadSupportPackages = function () {
                    Support.support(supportPackagesCallback, true);
                };

                if ($scope.features.support === 'enabled') {
                    $rootScope.$on('creditCardUpdate', function () {
                        if (!$scope.supportPackages || $scope.supportPackages <= 0) {
                            loadSupportPackages();
                        }
                    });
                    loadSupportPackages();
                    $scope.isActive = function (link) {
                        return '/support' + link === $location.path();
                    };

                    $scope.clickSupportMenu = function (link) {
                        $location.path('/support' + link);
                    };
                }

                $scope.toggleSideBar = function () {
                    $scope.sideBarMin = !$scope.sideBarMin;
                };

                $scope.clickUsage = function (usageType) {
                    var now = new Date();
                    var year = parseInt(requestContext.getParam('year'), 10) || now.getFullYear();
                    var month = parseInt(requestContext.getParam('month'), 10) || now.getMonth() + 1;
                    usageType = usageType ? (usageType + '/') : '';
                    $location.path('/usage/' + usageType + year + '/' + month);
                };

                $scope.currentYear = (new Date()).getFullYear();

                $rootScope.dockerHostsAvailable = false;
            }
        };
    }]);

}(window.JP.getModule('Left')));