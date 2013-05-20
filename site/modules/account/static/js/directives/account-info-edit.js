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
                                // Set default country if not set
                                if (!account.country) {
                                    account.country = 'USA';
                                }

                                $scope.account = account;

                                var phoneSplit = account.phone.split('-');

                                if (phoneSplit.length === 2) {
                                    $scope.selectedCountryCode = phoneSplit[0];
                                    $scope.phone = phoneSplit[1];
                                } else {
                                    $scope.selectedCountryCode = 1; // Default country code
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

                        var statesP = $http.get('billing/states');

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
                                statesP.then(function(res) {
                                    $scope.stateSel = res.data.us.obj;
                                });
                            } else if (newVal === 'CAN') {
                                statesP.then(function(res) {
                                    $scope.stateSel = res.data.canada.obj;
                                });
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

                        $scope.changePassword = function() {
                            window.open('account/changepassword/' + $scope.account.id ,'1369071355773','width=700,height=500,toolbar=0,menubar=0,location=1,status=1,scrollbars=1,resizable=1,left=100,top=100');
                        };

                        window.jQuery('.icon-info-sign').tooltip();
                    },
                    templateUrl: 'account/static/partials/account-info-edit.html'
                };
            }]);
}(window.JP.getModule('Account')));