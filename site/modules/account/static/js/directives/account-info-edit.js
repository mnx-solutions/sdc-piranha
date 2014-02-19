'use strict';

(function (ng, app) {
    app.directive('accountInfoEdit', [
        'Account',
        'localization',
        'PopupDialog',
        '$q',
        '$http',
        '$location',
        'TFAService',
        '$$track',
        function (Account, localization, PopupDialog, $q, $http, $location, TFAService, $$track) {

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
                            $scope.account = ng.copy(account);
                            if ($scope.account.phone && $scope.account.phone.indexOf('+') !== 0) {
                                $scope.account.phone = '+' + $scope.account.phone;
                            }
                        });
                    };

                    $scope.setAccount();

                    $scope.cancelChanges = function () {
                        $scope.setAccount();
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
                                PopupDialog.message(
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
                                    function () {
                                        $location.url('/account');
                                        $location.replace();
                                    }
                                );
                            }
                        }, function (err) {
                            $scope.error = null;
                            $scope.loading = false;

                            PopupDialog.error(
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

                    window.jQuery('.icon-info-sign').tooltip();
                },
                templateUrl: 'account/static/partials/account-info-edit.html'
            };
        }]);
}(window.angular, window.JP.getModule('Account')));