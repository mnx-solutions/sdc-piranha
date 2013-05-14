'use strict';

(function (app) {

    app.directive('accountInfoEdit',
        ['Account', 'localization', '$q', '$http',
            function (Account, localization, $q, $http) {

                return {
                    restrict: 'A',
                    replace: true,
                    scope: true,
                    link: function ($scope) {
                        $scope.countries = null;
                        $scope.allStates = null;
                        $scope.countryCodes = null;
                        $scope.stateSel = null;
                        $scope.error = null;
                        $scope.saving = false;
                        $scope.account = Account.getAccount(true);

                        $http.get('billing/countries').success(function (data) {
                            $scope.countries = data;
                        });

                        $http.get('billing/states').success(function (data) {
                            $scope.allStates = data;
                        });

                        $http.get('account/countryCodes').success(function (data) {
                            $scope.countryCodes = data;
                        });

                        $scope.$watch('account["country"]', function (newVal, oldVal) {
                            if (oldVal === 'United States' || oldVal === 'Canada'){
                                $scope.account.$$v['state'] = '';
                            }

                            if (newVal === 'United States') {
                                $scope.stateSel = $scope.allStates.us.obj;
                            } else if (newVal === 'Canada') {
                                $scope.stateSel = $scope.allStates.canada.obj;
                            } else {
                                $scope.stateSel = undefined;
                            }
                        }, true);

                        $scope.iso2ToName = function(iso2) {
                            for(country in $scope.countries) {
                                if($scope.countries[country].iso2 === iso2)
                                    return $scope.countries[country].name;
                            }
                        }


                        /* phone number handling */
                        $scope.$watch('phone', function(newVal, oldVal) {
                            if(oldVal != newVal) {
                                $scope.account.$$v['phone'] = $scope.selectedCountryCode + newVal;
                            }
                        }, true);

                        $scope.$watch('selectedCountryCode', function(newVal, oldVal) {
                            if(oldVal != newVal) {
                                $scope.account.$$v['phone'] = newVal + $scope.phone;
                            }
                        }, true);


                        $scope.setAccount = function() {
                            $scope.account = Account.getAccount(true);
                        };

                        $scope.cancelChanges = function () {
                            window.location = '/main/#!/account/';
                        };

                        $scope.isErrorOf = function (field, errorType) {
                            var isPresent = false;

                            if ($scope.accountForm[field].$dirty) {
                                Object.keys($scope.accountForm[field].$error).some(function (key) {
                                    if ($scope.accountForm[field].$error[key] && key === errorType) {
                                        isPresent = true;
                                        return true;
                                    }
                                });
                            }

                            return isPresent;
                        };

                        $scope.isErrorPresent = function (field) {
                            var isPresent = false;

                            if ($scope.accountForm[field].$dirty) {
                                Object.keys($scope.accountForm[field].$error).some(function (key) {
                                    if ($scope.accountForm[field].$error[key]) {
                                        isPresent = true;
                                        return true;
                                    }
                                });
                            }

                            return isPresent;
                        };

                        $scope.submitForm = function () {
                            Account.updateAccount($scope.account).then(function () {
                                $scope.saving = false;
                                $scope.error = null;

                                if ($scope.nextStep) {
                                    $scope.setAccount();
                                    $scope.nextStep();
                                }
                            }, function (err) {
                                $scope.error = null;
                                $scope.saving = false;
                            });
                        };
                    },
                    templateUrl: 'account/static/partials/account-info-edit.html'
                };
            }]);
}(window.JP.getModule('Account')));