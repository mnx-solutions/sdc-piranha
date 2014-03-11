'use strict';

(function (app, ng) {
    app.directive('mainLeft', ['localization', 'Support', function (localization, Support) {
        return {
            templateUrl: 'left/static/partials/menu.html',
            scope: true,
            controller: function ($scope, $location) {
                $scope.location = $location;
                $scope.sideBarMin = false;
                if ($scope.features.support === 'enabled') {
                    Support.support(function (error, supportPackages) {
                        $scope.supportPackages = supportPackages;
                    });

                    $scope.isActive = function (link) {
                        return '/support' + link === $location.path();
                    }

                    $scope.clickSupportMenu = function (link) {
                        $location.path('/support' + link);
                    };
                }

                $scope.toggleSideBar = function () {
                    $scope.sideBarMin = ($scope.sideBarMin == false) ? true : false;
                    if ($scope.sideBarMin) {
                        ng.element('.footer').addClass('leftpanel-small');
                    } else {
                        ng.element('.footer').removeClass('leftpanel-small');
                    }
                };
            }
        };
    }]);

}(window.JP.getModule('Left'), angular));