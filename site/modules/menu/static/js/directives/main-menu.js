'use strict';

(function (app) {
// app.directive('mainMenu', ['$timeout', 'Menu', function ($timeout, Menu) {
    app.directive('mainMenu', ['Menu', 'localization', function (Menu, localization) {
        return {
//			link: function (scope, element, attrs) {
            link: function (scope) {
                scope.mainMenu = Menu.getMenu();
            },

            controller: function ($scope, requestContext, localization, Account) {
                localization.bind('menu', $scope);

                $scope.account = Account.getAccount();

                $scope.$on('requestContextChanged', function () {
                    $scope.mainMenu.forEach(function (item) {
                        item.active = requestContext.startsWith(item.link);
                    });
                });
            },

            template: '<div class="navbar-inner">' +
                        '<div class="container">' +
                            '<a href="#!/machine/"><div class="brand pull-left"></div></a>' +
                            '<div class="pull-right" style="margin-top:25px">' +
                                '<div class="btn-group pull-left">' +
                                    '<button class="btn btn-small" data-translate>Settings</button>' +
                                    '<button class="btn btn-small dropdown-toggle" data-toggle="dropdown">' +
                                        '<span class="caret"></span>' +
                                    '</button>' +
                                    '<ul class="dropdown-menu">' +
										'<li><a href="#!/account" data-translate><b>{{account.login}}</b></a></li>'+
										'<li class="divider"></li>' +
                                        '<li data-ng-repeat="item in mainMenu">' +
                                            '<a href="#!/{{item.link}}" ' +
                                                'data-translate ' +
                                                'data-translate-expression="true" ' +
                                                'data-translate-module="{{item.link}}" ' +
                                            '>{{item.name}}</a>' +
                                        '</li>' +
										'<li><a href="#!/account/payment" data-translate>Credit Card Info</a></li>' +
										'<li class="divider"></li>' +
										'<li><a href="/landing/forgetToken" data-translate>Logout</a></li>'+
                                    '</ul>' +
                                '</div>' +
                                // '<div class="logged-in-as">Logged in as: </div>'+
                            '</div>' +
                            '<div class="clearfix"></div>' +

                        '</div>' +
                      '</div>'
        };
    }]);
}(window.JP.getModule('Menu')));