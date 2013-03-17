'use strict';

(function (app) {
// app.directive('mainMenu', ['$timeout', 'Menu', function ($timeout, Menu) {
    app.directive('mainMenu', ['Menu', function (Menu) {
            return {
//			link: function (scope, element, attrs) {
                link: function (scope) {
                    scope.mainMenu = Menu.getMenu();
                },

                controller: function ($scope, requestContext) {
                    $scope.$on('requestContextChanged', function () {
                        $scope.mainMenu.forEach(function (item) {
                            item.active = requestContext.startsWith(item.link);
                        });
                    });
                },
                template: '<ul class="nav nav-list">' +
                        '<li data-ng-repeat="item in mainMenu"'+
                        ' class="menuitem"'+
                        ' data-ng-class="{active: item.active}">' +
                        '<a href="#!/{{item.link}}">{{item.name}}</a>' +
                        '</li>' +
                        '</ul>'
            };
        }]);
}(window.JP.getModule('Menu')));