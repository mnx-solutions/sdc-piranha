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
                            '<a href="#!/dashboard/"><div class="brand pull-left"></div></a>' +
                            '<div class="pull-right top-menu">' +
									'<span><a href="http://joyent.com/developers/support" target="_blank">Support</a></span>' +
									'<span><a href="http://wiki.joyent.com/wiki/display/jpc2/JoyentCloud+Home" target="_blank">Docs</a></span>' +
									'<span><a href="#!/account">My Account</a></span>' +
									'<span class="last"><a href="/landing/forgetToken">Log Out</a></span>' +
                            		'<div class="clearfix"></div>' +
                        	'</div>' +
						'</div>' +
                      '</div>'
        };
    }]);
}(window.JP.getModule('Menu')));