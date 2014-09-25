'use strict';

(function (ng, app) {
    app.directive('accountTfa', [
        'TFAService',
        'Account',
        function (TFAService, Account) {

            return {
                restrict: 'A',
                replace: true,
                scope: true,

                link: function ($scope) {
                    $scope.tfaEnabled = false;

                    Account.getAccount(true).then(function (account) {
                        $scope.tfaEnabled = account.tfaEnabled;
                    });

                    $scope.enableTwoFactorAuth = function () {
                        $scope.tfaLoading = true;
                        TFAService.setup().then(function (qr) {
                            $scope.qrImage = qr;
                            $scope.otpass = '';
                            $scope.tfaLoading = false;
                            setTimeout(function () {
                                ng.element('#otpass').focus();
                            }, 5);
                        }, function () {
                            //Unauthorized
                            //It should redirect automatically
                        });
                    };

                    $scope.testTwoFactorAuth = function () {
                        $scope.tfaLoading = true;
                        TFAService.setupTest($scope.otpass).then(function (data){
                            if (data.status === 'ok') {
                                $scope.qrImage = false;
                                $scope.tfaEnabled = true;
                                Account.setTfaCache(true);
                            } else {
                                $scope.tfaError = true;
                            }
                            $scope.tfaLoading = false;
                        }, function () {
                            //Unauthorized
                            //It should redirect automatically
                        });
                    };

                    $scope.disableTwoFactorAuth = function () {
                        $scope.tfaLoading = true;
                        TFAService.remove().then(function () {
                            $scope.tfaEnabled = false;
                            Account.setTfaCache(false);
                            $scope.tfaLoading = false;
                        }, function (data) {
                            //Unauthorized should already redirect
                            $scope.tfaDisableError = data.err;
                            $scope.tfaLoading = false;
                        });
                    };
                },
                templateUrl: 'account/static/partials/account-tfa.html'
            };
        }]);
}(window.angular, window.JP.getModule('Account')));