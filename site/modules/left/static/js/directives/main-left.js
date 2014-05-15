'use strict';

(function (app, ng) {
    app.directive('mainLeft', ['$rootScope', 'localization', 'Support', 'requestContext', function ($rootScope, localization, Support, requestContext) {
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

                $scope.clickUsage = function (usageType) {
                    var now = new Date();
                    var year = parseInt(requestContext.getParam('year'), 10) || now.getFullYear();
                    var month = parseInt(requestContext.getParam('month'), 10) || now.getMonth() + 1;
                    usageType = usageType ? (usageType + '/') : '';
                    window.location = '#!/usage/' + usageType + year + '/' + month;
                };
            }
        };
    }]);

}(window.JP.getModule('Left'), angular));