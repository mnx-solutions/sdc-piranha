'use strict';

(function (app) {
    app.directive('mainMenu', ['Menu', '$$track', '$dialog', function (Menu, $$track, $dialog) {
        return {
            link: function (scope) {
                scope.mainMenu = Menu.getMenu();
            },

            controller: function ($scope, requestContext, localization, Account) {
                localization.bind('menu', $scope);

                Account.getAccount(true).then(function (account) {
                    $scope.account = account;
                });

                $scope.skinChange = function () {
                    window.location.href = 'menu/skinChange';
                };

                $scope.changePassword = function () {
                    $$track.event('Window Open', 'Change Password');
                    var dialogWidth = $scope.features.useBrandingOrange === 'enabled' ? 580 : 980;
                    window.open('account/changepassword/' + $scope.account.id, 'change_password', 'width=' + dialogWidth +
                        ',height=580,toolbar=0,menubar=0,location=1,status=1,scrollbars=1,resizable=1,left=100,top=100');
                };

                $scope.changeTfa = function () {
                    var templateUrl = 'account/static/template/dialog/tfa-modal.html';
                    $dialog.messageBox('', '', [], templateUrl).open();
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