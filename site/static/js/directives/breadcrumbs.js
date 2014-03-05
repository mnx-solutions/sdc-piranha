'use strict';

window.JP.main.directive('breadcrumbs', [ 'route', 'requestContext',
    function (route, requestContext) {
        return {
            priority: 10,
            restrict: 'EA',
            replace: true,
            template: '<ul class="breadcrumb">' +
                        '<li data-ng-class="{active: $last}" ' +
                             'data-ng-repeat="item in navigationPath">' +
                          '<span data-ng-show="!$last">' +
                            '<a href="#!{{item.path}}" data-translate data-translate-expression="true">' +
                              '{{item.title}}' +
                            '</a>' +
                          '</span>' +
                          '<span data-ng-show="!$last" class="divider">/</span>' +
                          '<span data-ng-show="$last">' +
                              ' {{item.title}}' +
                          '</span>' +
                        '</li>' +
                      '</ul>',

            controller: function ($scope, $routeParams, $attrs, route, localization) {
                localization.bind('dashboard', $scope);

                function updateItems() {
                    $scope.navigationPath = route.resolveNavigation($routeParams);

                    $scope.navigationPath.forEach(function (item) {
                        item.path = $scope.resolveLink(item.path);
                    });
                }

                $scope.resolveLink = function (path) {
                    var keys = Object.keys($routeParams);

                    for (var i = 0, c = keys.length; i < c; i++) {
                        var key = keys[i];
                        path = path.replace(':' + key, $routeParams[key]);
                    }

                    return path;
                };

                $scope.$on(
                    'requestContextChanged',
                    function () {
                        updateItems();
                    }
                );

                updateItems();
            }
        };
    }]);
