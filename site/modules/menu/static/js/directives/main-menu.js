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
            template: '<div class="navbar">' +
                        '<div class="navbar-inner">' +
                            '<a class="brand" href="#">Joyent Portal</a>' +
                            '<ul class="nav">' +
                            '<li data-ng-repeat="item in mainMenu"'+
                            'class="menuitem"'+
                            'data-ng-class="{active: item.active}">' +
                            '<a href="#!/{{item.link}}">{{item.name}}</a>' +
                            '</li>'+
                        '</ul>' +
                        '</div>' +
                      '</div>'
        };
    }]);
}(window.JP.getModule('Menu')));