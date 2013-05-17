'use strict';

(function (app) {

    app.directive('accountInfoEdit',
        ['Account', 'localization', '$q', '$http', '$location',
            function (Account, localization, $q, $http, $location) {

                return {
                    restrict: 'A',
                    replace: true,
                    scope: true,
                    link: function ($scope) {
                        $scope.countries = null;
                        $scope.allStates = null;
                        $scope.countryCodes = null;
                        $scope.stateSel = null;
                        $scope.phone = null;
                        $scope.selectedCountryCode = null;
                        $scope.error = null;
                        $scope.loading = false;

                        $scope.setAccount = function() {
                            $q.when(Account.getAccount(true), function (account) {
                                $scope.account = account;

                                var phoneSplit = account.phone.split('-');

                                if(phoneSplit[1]) {
                                    $scope.selectedCountryCode = phoneSplit[0];
                                    $scope.phone = phoneSplit[1];
                                } else {
                                    $scope.phone = account.phone;
                                }
                            });
                        };

                        $scope.setAccount();

                        $scope.countryStyle = {
                            width: '100px'
                        };

                        $http.get('billing/countries').success(function (data) {
                            $scope.countries = data;
                        });

                        $http.get('billing/states').success(function (data) {
                            $scope.allStates = data;
                        });

                        $http.get('account/countryCodes').success(function (data) {
                            $scope.countryCodes = data;
                        });

                        $scope.filterUndefinedAreas = function (country) {
                            return !!country.areaCode;
                        };

                        $scope.$watch('account.country', function (newVal, oldVal) {
                            if (oldVal === 'USA' || oldVal === 'CAN'){
                                $scope.account.state = '';
                            }

                            if (newVal === 'USA') {
                                $scope.stateSel = $scope.allStates.us.obj;
                            } else if (newVal === 'CAN') {
                                $scope.stateSel = $scope.allStates.canada.obj;
                            } else {
                                $scope.stateSel = undefined;
                            }
                        }, true);


                        /* phone number handling */
                        $scope.$watch('phone', function(newVal, oldVal) {
                            if(oldVal !== newVal) {
                                $scope.account.phone = $scope.selectedCountryCode +'-'+ newVal;
                            }
                        }, true);

                        $scope.$watch('selectedCountryCode', function(newVal, oldVal) {
                            if(oldVal !== newVal) {
                                $scope.account.phone = newVal +'-'+ $scope.phone;
                            }
                            if(!newVal) {
                                $scope.countryStyle.width = '100px';
                            } else {
                                var width = '';
                                switch((newVal + '').length){
                                    case 3:
                                        width = '50px';
                                        break;
                                    case 2:
                                        width = '58px';
                                        break;
                                    case 1:
                                        width = '66px';
                                        break;
                                }
                                $scope.countryStyle.width = width;
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
                            $scope.loading = true;
                            Account.updateAccount($scope.account).then(function () {
                                $scope.loading = false;
                                $scope.error = null;

                                if ($scope.nextStep) {
                                    $scope.setAccount();
                                    $scope.nextStep();
                                }
                            }, function (err) {
                                $scope.error = null;
                                $scope.loading = false;
                            });
                        };

                        window.jQuery('.icon-info-sign').tooltip();
                    },
                    templateUrl: 'account/static/partials/account-info-edit.html'
                };
            }]);
}(window.JP.getModule('Account')));