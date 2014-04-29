'use strict';

(function (app, ng) {
    app.directive('mainLeft', ['$rootScope', 'localization', 'Support', function ($rootScope, localization, Support) {
        return {
            templateUrl: 'left/static/partials/menu.html',
            scope: true,
            controller: function ($scope, $location) {
                $scope.location = $location;
                $scope.sideBarMin = false;
                var loadSupportPackages = function() {
                    Support.support(function (error, supportPackages) {
                        $scope.supportPackages = supportPackages;
                    });
                };

                if ($scope.features.support === 'enabled') {
                    $rootScope.$on('event:provisionChanged', function () {
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
                    if ($scope.sideBarMin) {
                        ng.element('.footer').addClass('leftpanel-small');
                    } else {
                        ng.element('.footer').removeClass('leftpanel-small');
                    }
                };
                var now = new Date();
                var year = now.getFullYear();
                var month = now.getMonth() + 1;
                $scope.usageUrl = '#!/usage/' + year + '/' + month;
                $scope.usageDramUrl = '#!/usage/dram/' + year + '/' + month;
                $scope.usageBandwidthUrl = '#!/usage/bandwidth/' + year + '/' + month;
            }
        };
    }]);

}(window.JP.getModule('Left'), angular));