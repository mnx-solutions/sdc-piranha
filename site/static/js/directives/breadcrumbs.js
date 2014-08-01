'use strict';

window.JP.main.directive('breadcrumbs', [ 'route', 'requestContext', '$rootScope',
    function (route, requestContext, $rootScope) {
        return {
            priority: 10,
            restrict: 'EA',
            replace: true,
            template: '<ul class="breadcrumb">' +
                        '<li data-ng-class="{active: $last}" ' +
                             'data-ng-repeat="item in navigationPath" ' +
                             'data-ng-show="(!$last || $last && !item.showText && item.showLatest) || ' +
                             '($last && item.showText && item.showLatest)">' +
                          '<span data-ng-show="!$last || $last && !item.showText && item.showLatest">' +
                            '<a href="#!{{item.path}}" data-translate data-translate-expression="true">' +
                              '{{item.title}}' +
                            '</a>' +
                          '</span>' +
                          '<span data-ng-show="$last && item.showText && item.showLatest" data-translate data-translate-expression="true">' +
                          ' {{item.title}}' +
                          '</span>' +
                        '</li>' +
                      '</ul>',

            controller: function ($scope, $routeParams, $attrs, route, localization) {
                localization.bind('dashboard', $scope);

                function resolveLink(path) {
                    var keys = Object.keys($routeParams);

                    for (var i = 0, c = keys.length; i < c; i++) {
                        var key = keys[i];
                        path = path.replace(':' + key, $routeParams[key]);
                    }

                    return path;
                };

                function setBreadcrumbs () {
                    $scope.navigationPath = route.resolveNavigation($routeParams);
                    $scope.navigationPath.forEach(function (item) {
                        item.path = resolveLink(item.path);
                    });
                }

                $scope.$on('$routeChangeSuccess', setBreadcrumbs);

                $rootScope.pageTitle = route.$route.current.$$route.title;
                setBreadcrumbs();
            }
        };
    }]);
