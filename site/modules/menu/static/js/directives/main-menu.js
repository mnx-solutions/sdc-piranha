'use strict';

(function (app) {
    app.directive('mainMenu', ['Menu', '$rootScope', '$$track', 'PopupDialog', '$location', function (Menu, $rootScope, $$track, PopupDialog, $location) {
        return {
            link: function (scope) {
                scope.mainMenu = Menu.getMenu();
            },

            controller: function ($scope, requestContext, localization, Account) {
                localization.bind('menu', $scope);

                Account.getAccount(true).then(function (account) {
                    $scope.account = account;
                });

                $scope.$on('accountUpdated', function (event, account) {
                    $scope.account = account;
                });

                $scope.$on('creditCardUpdate', function () {
                    $scope.account.provisionEnabled = true;
                });

                $scope.skinChange = function () {
                    window.location.href = 'menu/skinChange';
                };

                $scope.changePassword = function () {
                    if ($scope.account.isSubuser) {
                        return;
                    }
                    $$track.event('Window Open', 'Change Password');
                    var dialogWidth = $scope.features.useBrandingOrange === 'enabled' ? 580 : 980;
                    window.open('account/changepassword/' + $scope.account.id, 'change_password', 'width=' + dialogWidth +
                        ',height=580,toolbar=0,menubar=0,location=1,status=1,scrollbars=1,resizable=1,left=100,top=100');
                };

                $scope.changeTfa = function () {
                    if ($scope.account.isSubuser) {
                        return;
                    }
                    var opts = {
                        templateUrl: 'account/static/template/dialog/tfa-modal.html'
                    };
                    PopupDialog.custom(opts);
                };

                $scope.$on('requestContextChanged', function () {
                    $scope.mainMenu.forEach(function (item) {
                        item.active = requestContext.startsWith(item.link);
                    });
                });
                $scope.trackingSuccess = false;
                $rootScope.$on('trackingSuccess', function () {
                    $scope.trackingSuccess = true;
                });

                $scope.completeAccount = function () {
                    var submitBillingInfo = {
                        btnTitle: 'Save Changes'
                    };
                    var currentPath = $location.path();
                    Account.checkProvisioning(submitBillingInfo, null, angular.noop, function (isSuccess) {
                        $location.path(isSuccess ? '/account' : currentPath);
                        if (isSuccess) {
                            $scope.account.provisionEnabled = true;
                        }
                    }, false);
                };

            },

            templateUrl: 'menu/static/partials/menu.html'
        };
    }]);
}(window.JP.getModule('Menu')));