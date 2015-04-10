'use strict';

(function (ng, app) {
    app.directive('accountInfoEdit', [
        'Account',
        'localization',
        'PopupDialog',
        '$q',
        '$location',
        '$rootScope',
        function (Account, localization, PopupDialog, $q, $location, $rootScope) {

            return {
                restrict: 'A',
                replace: true,
                scope: true,

                controller: function ($scope) {
                    localization.bind('account', $scope);
                },

                link: function ($scope) {
                    $scope.error = null;
                    $scope.loading = false;
                    $scope.formSubmitted = false;

                    $scope.setAccount = function () {
                        Account.getAccount(true).then(function (account) {
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

                        if ($scope.formSubmitted &&
                            $scope.accountForm[field].$invalid &&
                            $scope.accountForm[field].$error.required &&
                            errorType === 'required') {
                            return true;
                        }
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
                        if ($scope.accountForm.$invalid) {
                            $scope.formSubmitted = true;
                            PopupDialog.message(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Message'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Please validate your input.'
                                ),
                                function () {}
                            );
                            return;
                        }
                        // clean the phone number
                        var account = ng.copy($scope.account);
                        if (typeof account.country !== 'string') {
                            account.country = account.country.iso3;
                        }

                        $scope.loading = true;
                        Account.updateAccount(account).then(function (acc) {
                            $scope.formSubmitted = false;
                            $scope.loading = false;
                            $scope.error = null;

                            if ($scope.nextStep) {
                                $scope.setAccount();
                                $scope.nextStep();
                            } else {
                                $rootScope.$broadcast("accountUpdated", acc);

                                PopupDialog.message(
                                    localization.translate(
                                        $scope,
                                        null,
                                        'Message'
                                    ),
                                    localization.translate(
                                        $scope,
                                        'account',
                                        'Account updated.'
                                    ),
                                    function () {
                                        $location.url('/account');
                                        $location.replace();
                                    }
                                );
                            }
                        }, function (err) {
                            $scope.formSubmitted = false;
                            $scope.error = null;
                            $scope.loading = false;
                            var message = 'Account update failed.';
                            if (err) {
                                if (err.restCode === 'NotAuthorized') {
                                    message = err.message;
                                } else if (err.restCode === "InvalidArgument" && err.message.search('email') > 0) {
                                    message = 'This email address is already in use.';
                                }
                            }
                            PopupDialog.error(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    $scope,
                                    'account',
                                    message
                                )
                            );
                        });
                    };

                    window.jQuery('.glyphicon.glyphicon-info-sign').tooltip();
                },
                templateUrl: 'account/static/partials/account-info-edit.html'
            };
        }]);
}(window.angular, window.JP.getModule('Account')));