'use strict';

(function (ng, app) {
    app.directive('accountInfoEdit', [
        'Account',
        'localization',
        'util',
        '$q',
        '$http',
        '$location',
        'TFAService',
        '$$track',
        function (Account, localization, util, $q, $http, $location, TFAService, $$track) {

            return {
                restrict: 'A',
                replace: true,
                scope: true,

                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);
                },

                link: function ($scope) {
                    $scope.error = null;
                    $scope.loading = false;

                    $scope.setAccount = function() {
                        $q.when(Account.getAccount(true), function (account) {
                            $scope.account = account;
                            if ($scope.account.phone && $scope.account.phone.indexOf('+') !== 0) {
                                $scope.account.phone = '+' + $scope.account.phone;
                            }
                        });
                    };

                    $scope.setAccount();

                    $scope.cancelChanges = function () {
                        $location.path('/account/');
                    };

                    $scope.isError = function (field, errorType) {
                        var isPresent = false;

                        if ($scope.accountForm[field].$dirty) {
                            Object.keys($scope.accountForm[field].$error).some(function (key) {
                                if ($scope.accountForm[field].$error[key] && (!errorType || key === errorType)) {
                                    isPresent = true;
                                    return true;
                                }
                            });
                        }

                        return isPresent;
                    };

                    $scope.submitForm = function () {
                        // clean the phone number
                        var account = ng.copy($scope.account);

                        $scope.loading = true;
                        Account.updateAccount(account).then(function (acc) {
                            $scope.loading = false;
                            $scope.error = null;

                            if ($scope.nextStep) {
                                $scope.setAccount();
                                $scope.nextStep();
                            } else {
                                util.message(
                                    localization.translate(
                                        $scope,
                                        null,
                                        'Message'
                                    ),
                                    localization.translate(
                                        $scope,
                                        'account',
                                        'Account updated'
                                    ),
                                    function () {}
                                );
                            }
                        }, function (err) {
                            $scope.error = null;
                            $scope.loading = false;

                            util.error(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    $scope,
                                    'account',
                                    'Account update failed'
                                ),
                                function () {}
                            );
                        });
                    };

                    $scope.changePassword = function() {
                        $$track.event('Window Open', 'Change Password');
                        window.open('account/changepassword/' + $scope.account.id ,'1369071355773','width=980,height=580,toolbar=0,menubar=0,location=1,status=1,scrollbars=1,resizable=1,left=100,top=100');
                    };

                    $scope.enableTwoFactorAuth = function () {
                        $scope.tfaLoading = true;
                        TFAService.setup().then(function (qr) {
                            $scope.qrImage = qr;
                            $scope.otpass = '';
                            $scope.tfaLoading = false;
                        }, function () {
                            //Unauthorized
                            //It should redirect automatically
                        });
                    };

                    $scope.testTwoFactorAuth = function () {
                        $scope.tfaTestLoading = true;
                        TFAService.setupTest($scope.otpass).then(function (data){
                            if(data.status === 'ok') {
                                $scope.qrImage = false;
                                $scope.account.tfaEnabled = true;
                            } else {
                                $scope.tfaError = true;
                            }
                            $scope.tfaTestLoading = false;
                        }, function () {
                            //Unauthorized
                            //It should redirect automatically
                        });
                    };

                    $scope.disableTwoFactorAuth = function () {
                        $scope.tfaLoading = true;
                        TFAService.remove().then(function () {
                            $scope.account.tfaEnabled = false;
                            $scope.tfaLoading = false;
                        }, function (data) {
                            //Unauthorized should already redirect
                            $scope.tfaDisableError = data.err;
                            $scope.tfaLoading = false;
                        });
                    };

                    window.jQuery('.icon-info-sign').tooltip();
                },
                templateUrl: 'account/static/partials/account-info-edit.html'
            };
        }]);
}(window.angular, window.JP.getModule('Account')));