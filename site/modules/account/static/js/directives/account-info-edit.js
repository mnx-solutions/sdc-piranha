'use strict';

(function (ng, app) {
    app.directive('accountInfoEdit', [
        'Account',
        'localization',
        'notification',
        '$q',
        '$http',
        '$location',
        'TFAService',
        function (Account, localization, notification, $q, $http, $location, TFAService) {

            return {
                restrict: 'A',
                replace: true,
                scope: true,

                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);
                },

                link: function ($scope) {
                    $scope.countryCodes = null;
                    $scope.selectedCountryCode = null;
                    $scope.error = null;
                    $scope.loading = false;

                    $scope.setAccount = function() {
                        $q.when(Account.getAccount(true), function (account) {
                            $q.when($http.get('account/countryCodes'), function(data) {
                                $scope.countryCodes = data.data;

                                account.country = $scope.isoToObj(account.country.iso3  || account.country);
                                $scope.selectedCountryCode = account.country.areaCode;

                                $scope.account = account;
                            });

                        });
                    };

                    $scope.setAccount();

                    $scope.isoToObj = function(iso) {
                        if (!$scope.countryCodes){
                            return;
                        }

                        var selected = null;
                        var usa = null;

                        $scope.countryCodes.some(function (el) {
                            if (el.iso3 === 'USA') {
                                usa = el;
                            }

                            if(el.iso3 === iso) {
                                selected = el;
                                return true;
                            }
                        });

                        return selected || usa;
                    };

                    $scope.countryStyle = {
                        width: '100%'
                    };

                    $scope.filterUndefinedAreas = function (country) {
                        return !!country.areaCode;
                    };

                    $scope.$watch('account.country', function(newVal, oldVal) {
                        if (newVal !== oldVal) {
                            $scope.selectedCountryCode = (newVal && newVal.areaCode) || '1';
                        }
                    }, true);

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
                        account.country = $scope.account.country.iso3;
                        account.phone = $scope.account.phone.replace(new RegExp(/[^0-9#\*]/g), '');


                        $scope.loading = true;
                        Account.updateAccount(account).then(function (acc) {
                            $scope.loading = false;
                            $scope.error = null;

                            if ($scope.nextStep) {
                                $scope.setAccount();
                                $scope.nextStep();
                            } else {
                                notification.push(null, { type: 'success' },
                                    localization.translate(null, 'account',
                                        'Account updated'
                                    )
                                );
                            }
                        }, function (err) {
                            $scope.error = null;
                            $scope.loading = false;

                            notification.push(null, { type: 'error' },
                                localization.translate(null, 'account',
                                    'Account update failed'
                                )
                            );
                        });
                    };

                    $scope.changePassword = function() {
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