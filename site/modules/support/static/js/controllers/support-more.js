'use strict';

(function (app) {
    app.controller(
        'Support.MoreController',
        ['$scope', '$location', 'Support', '$route', function ($scope, $location, Support, $route) {

            var headLink = '/support';
            $scope.getPageData = function () {
                var supportPackages = $scope.supportPackages;
                for (var packageName in supportPackages ) {
                    if (headLink + supportPackages[packageName].link === $location.path()) {
                        $scope.pageTitle = supportPackages[packageName].title;
                        $scope.template = supportPackages[packageName].template;
                    }
                }
            }

            Support.support(function (error, supportPackages) {
                $scope.supportPackages = supportPackages;
                $scope.loading = false;
                $scope.getPageData();
            });

            $scope.$on('$routeChangeStart', function(e, next, last) {
                if (next.$$route.controller === last.$$route.controller) {
                    e.preventDefault();
                    $route.current = last.$$route;
                    $scope.getPageData();
                }
            });

        }]);
}(window.JP.getModule('support')));
