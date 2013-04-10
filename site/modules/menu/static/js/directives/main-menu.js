'use strict';

(function (app) {
// app.directive('mainMenu', ['$timeout', 'Menu', function ($timeout, Menu) {
    app.directive('mainMenu', ['Menu', 'localization', function (Menu, localization) {
        return {
//			link: function (scope, element, attrs) {
            link: function (scope) {
                scope.mainMenu = Menu.getMenu();
            },

            controller: function ($scope, requestContext, localization) {
                localization.bind('menu', $scope);

                $scope.$on('requestContextChanged', function () {
                    $scope.mainMenu.forEach(function (item) {
                        item.active = requestContext.startsWith(item.link);
                    });
                });
            },

            template: '<div class="navbar-inner">' +
                        '<div class="container">' +
                            '<a href="/"><div class="brand pull-left"></div></a>' +
                            '<div class="pull-right" style="margin-top:25px">' +
                                '<div class="btn-group pull-left">' +
                                    '<button class="btn btn-small" data-translate>Settings</button>' +
                                    '<button class="btn btn-small dropdown-toggle" data-toggle="dropdown">' +
                                        '<span class="caret"></span>' +
                                    '</button>' +
                                    '<ul class="dropdown-menu">' +
                                        '<li data-ng-repeat="item in mainMenu">' +
                                            '<a href="#!/{{item.link}}" ' +
                                                'data-translate ' +
                                                'data-translate-expression="true" ' +
                                                'data-translate-module="{{item.link}}" ' +
                                            '>{{item.name}}</a>' +
                                        '</li>' +
                                    '</ul>' +
                                '</div>' +
                            '</div>' +
                            '<div class="clearfix"></div>' +

                        '</div>' +
                        '<a href="/landing/forgetToken" class="logout-right" data-translate>Logout</a>'+
                      '</div>'
        };
    }]);
}(window.JP.getModule('Menu')));