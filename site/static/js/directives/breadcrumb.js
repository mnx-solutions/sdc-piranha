'use strict';

window.JP.main.directive('breadcrumb', [ 'route', 'requestContext',
    function (route, requestContext) {
        return {
            priority: 10,
            restrict: 'EA',
            replace: true,
            template: '<ul class="breadcrumb">' +
                        '<li data-ng-class="{active: navigationPath.length - 1 == $index}" ' +
                             'data-ng-repeat="item in navigationPath">' +
                          '<span data-ng-show="navigationPath.length - 1 != $index">' +
                            '<a href="#!{{item.path}}" data-translate data-translate-expression="true">' +
                              '{{item.title}}' +
                            '</a>' +
                          '</span>' +
                          '<span data-ng-show="navigationPath.length - 1 != $index" class="divider">/</span>' +
                          '<span data-ng-show="navigationPath.length - 1 == $index">' +
                              ' {{item.title}}' +
                          '</span>' +
                        '</li>' +
						'<li class="pull-right"><a class="add-machine" href="#!/compute/create">Create Instance</a>&nbsp;&nbsp;<i class="icon-plus-sign"></i></li>' +
                      '</ul>',

            controller: function ($scope, $routeParams, route, localization) {
                localization.bind('dashboard', $scope);

                function updateItems() {
                    $scope.navigationPath = route.resolveNavigation();
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
