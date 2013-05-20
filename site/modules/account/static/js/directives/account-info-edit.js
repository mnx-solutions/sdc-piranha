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

                                    // Set default country if not set
                                    if (!account.country) {
                                        account.country = 'United States';
                                    }

                                    $scope.account = account;
                                    $scope.selectedCountryCode = $scope.nameToCode(account.country);
                                });

                            });
                        };

                        $scope.setAccount();

                        $scope.nameToCode = function(countryName) {
                            if(!$scope.countryCodes)
                                return;

                            for(var country in $scope.countryCodes){
                                if($scope.countryCodes[country].name === countryName) {
                                    return $scope.countryCodes[country].areaCode;
                                }
                            }
                        }

                        $scope.countryStyle = {
                            width: '100px'
                        };

                        $scope.filterUndefinedAreas = function (country) {
                            return !!country.areaCode;
                        };

                        $scope.$watch('account.country', function(newVal, oldVal) {
                            if(newVal)
                                newVal = $scope.nameToCode(newVal);

                            if(newVal != oldVal) {
                                $scope.selectedCountryCode = newVal;
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
                            // clean the phone number
                            $scope.account.phone = $scope.account.phone.replace(new RegExp(/\s+/g), '').replace(new RegExp(/-/g), '');

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