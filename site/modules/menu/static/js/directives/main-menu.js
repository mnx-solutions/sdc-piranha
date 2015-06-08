'use strict';

(function (app) {
    app.directive('mainMenu', ['Menu', '$rootScope', '$$track', 'PopupDialog', '$location', 'rbac.User', function (Menu, $rootScope, $$track, PopupDialog, $location, RbacUser) {
        return {
            link: function (scope) {
                scope.mainMenu = Menu.getMenu();
            },

            controller: function ($scope, requestContext, localization, Account, Zendesk) {
                localization.bind('menu', $scope);

                $scope.subuserAccountName = null;
                $scope.systemStatusTopics = [];

                function getSystemStatusTopics () {
                    Zendesk.getSystemStatusTopics().then(function (topics) {
                        $scope.systemStatusTopics = $scope.systemStatusTopics.filter(function (topic) {
                            return new Date().getTime() < (new Date(topic['created_at']).getTime() + 2 * 24 * 3600 * 1000);
                        });
                        $scope.systemStatusTopics.forEach(function (topic) {
                            if (topic.title.indexOf('[RESOLVED]') === 0) {
                                topic.title = topic.title.replace('[RESOLVED]', '');
                                topic.resolved = true;
                            }
                        });
                    });
                }
                if ($scope.features.zendesk === 'enabled' && $scope.features.systemStatus === 'enabled') {
                    var updateSystemStatusTopics = setInterval(function () {
                        $scope.$apply(function () {
                            getSystemStatusTopics();
                        });
                    }, 60000);

                    getSystemStatusTopics();

                    $scope.$on('$destroy', function () {
                        clearInterval(updateSystemStatusTopics);
                    });
                }

                Account.getAccount(true).then(function (account) {
                    $scope.account = account;
                    if (account.isSubuser) {
                        Account.getParentAccount().then(function (parentAccount) {
                            $scope.subuserAccountName = parentAccount.login + ' / ' + $scope.account.login;
                        }, function (error) {
                            if (error) {
                                PopupDialog.errorObj(error);
                            }
                        });
                    }
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
                        RbacUser.changeUserPassword($scope.account.id, $scope, 'Your password was changed. Next time you sign in use your new password.');
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
                    Account.checkProvisioning(submitBillingInfo, null, function (isSuccess) {
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