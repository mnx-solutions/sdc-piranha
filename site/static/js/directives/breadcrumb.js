'use strict';

window.JP.main.directive('breadcrumb', [ 'route', 'requestContext',
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
						'<li class="pull-right"><a class="add-machine" href="#!/compute/create">Create Instance</a>&nbsp;&nbsp;<i class="icon-plus-sign"></i></li>' +
                      '</ul>',

            controller: function ($scope, $routeParams, route, localization) {
                localization.bind('dashboard', $scope);

                function updateItems() {
                    $scope.navigationPath = route.resolveNavigation();
                    $scope.navigationPath.forEach(function (item) {
                        item.path = $scope.resolveLink(item.path);
                    });
                    $scope.navigationPath = $scope.navigationPath.filter(function (item) {
                        return item.path;
                    });
                }

                $scope.resolveLink = function (path) {
                    var keys = Object.keys($routeParams);

                    for (var i = 0, c = keys.length; i < c; i++) {
                        var key = keys[i];
                        path = path.replace(':' + key, $routeParams[key]);
                    }
                    if (path.indexOf(':') !== -1) {
                        return false;
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
