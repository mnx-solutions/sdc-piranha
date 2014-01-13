'use strict';

(function (app) {
    app.directive('mainMenu', ['Menu', function (Menu) {
        return {
            link: function (scope) {
                scope.mainMenu = Menu.getMenu();
            },

            controller: function ($scope, requestContext, localization, Account) {
                localization.bind('menu', $scope);

                $scope.account = Account.getAccount();

                $scope.skinChange = function () {
                    window.location.href = 'menu/skinChange';
                };

                $scope.$on('requestContextChanged', function () {
                    $scope.mainMenu.forEach(function (item) {
                        item.active = requestContext.startsWith(item.link);
                    });
                });
            },

            templateUrl: 'menu/static/partials/menu.html'
        };
    }]);
}(window.JP.getModule('Menu')));