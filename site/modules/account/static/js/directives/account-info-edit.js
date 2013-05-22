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
                        $scope.countryCodes = null;
                        $scope.selectedCountryCode = null;
                        $scope.error = null;
                        $scope.loading = false;

                        $scope.setAccount = function() {
                            $q.when(Account.getAccount(true), function (account) {
                                $q.when($http.get('account/countryCodes'), function(data) {
                                    $scope.countryCodes = data.data;

                                    $scope.account = account;

                                    $scope.account.country = $scope.isoToObj(account.country);
                                });

                            });
                        };

                        $scope.setAccount();

                        $scope.isoToObj = function(iso) {
                            if(!$scope.countryCodes){
                                return;
                            }
                            var selected = null;
                            var usa = null;
                            $scope.countryCodes.some(function (el) {
                                if(el.iso3 === 'USA') {
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
                            width: '100px'
                        };

                        $scope.filterUndefinedAreas = function (country) {
                            return !!country.areaCode;
                        };

                        $scope.$watch('account.country', function(newVal, oldVal) {
                            if(newVal != oldVal) {
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
                            var account = angular.copy($scope.account);
                            account.country = account.country.iso3;

                            $scope.loading = true;
                            Account.updateAccount(account).then(function (acc) {
                                $scope.loading = false
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
                            window.open('account/changepassword/' + $scope.account.id ,'1369071355773','width=980,height=580,toolbar=0,menubar=0,location=1,status=1,scrollbars=1,resizable=1,left=100,top=100');
                        };

                        window.jQuery('.icon-info-sign').tooltip();
                    },
                    templateUrl: 'account/static/partials/account-info-edit.html'
                };
            }]);
}(window.JP.getModule('Account')));