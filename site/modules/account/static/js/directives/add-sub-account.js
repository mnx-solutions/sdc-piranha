'use strict';

(function (ng, app) {
    app.directive('addSubAccount', [
        'Account',
        'localization',
        'PopupDialog',
        '$q',
        '$http',
        '$location',
        'TFAService',
        '$$track',
        '$rootScope',
        function (Account, localization, PopupDialog, $q, $http, $location, TFAService, $$track, $rootScope) {

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
                    $scope.countries = $http.get('billing/countries');

                    $scope.countries.then(function (countries) {
                        countries.data.some(function (country) {
                            $scope.subAccountForm.country = country.iso3;
                            return true;
                        });
                    });


                    $scope.isError = function (field, errorType) {
                        var isPresent = false;

                        if ($scope.subAccountForm[field].$dirty) {
                            Object.keys($scope.subAccountForm[field].$error).some(function (key) {
                                if ($scope.subAccountForm[field].$error[key] && (!errorType || key === errorType)) {
                                    isPresent = true;
                                    return true;
                                }
                            });
                        }

                        return isPresent;
                    };

                    $scope.submitForm = function () {
                        if ($scope.subAccountForm.$invalid) {
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

                        $scope.loading = true;
                        Account.updateAccount(account).then(function (acc) {
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
                                    'Account update failed.'
                                ),
                                function () {}
                            );
                        });
                    };

                    window.jQuery('.glyphicon.glyphicon-info-sign').tooltip();
                },
                templateUrl: 'account/static/partials/add-sub-account.html'
            };
        }]);
}(window.angular, window.JP.getModule('Account')));