'use strict';

(function (app) {

    app.directive('accountInfoEdit',
        ['Account', 'localization', '$q',
            function (Account, localization, $q) {

                return {
                    restrict: 'A',
                    replace: true,
                    scope: true,
                    link: function ($scope) {
                        $scope.fields = {
                            basic: {
                                email: {
                                    title: localization.translate(null, 'account', 'Email'),
                                    type: 'email',
                                    validate: 'email',
                                    required: true
                                },

                                firstName: {
                                    title: localization.translate(null, 'account', 'First name'),
                                    type: 'text',
                                    required: true
                                },

                                lastName: {
                                    title: localization.translate(null, 'account', 'Last name'),
                                    type: 'text',
                                    required: true
                                },

                                phone: {
                                    title: localization.translate(null, 'account', 'Phone'),
                                    type: 'number',
                                    validate: 'phone',
                                    required: true
                                },

                                companyName: {
                                    title: localization.translate(null, 'account', 'Company name'),
                                    type: 'text',
                                    required: true
                                }
                            },

                            address: {
                                address: {
                                    title: localization.translate(null, 'account', 'Address'),
                                    type: 'text',
                                    required: true
                                },

                                postalCode: {
                                    title: localization.translate(null, 'account', 'Postal code'),
                                    type: 'number',
                                    required: true
                                },

                                city: {
                                    title: localization.translate(null, 'account', 'City'),
                                    type: 'text',
                                    required: true
                                },

                                state: {
                                    title: localization.translate(null, 'account', 'State'),
                                    type: 'text',
                                    required: true
                                },

                                country: {
                                    title: localization.translate(null, 'account', 'Country'),
                                    type: 'text',
                                    required: true
                                }
                            }
                        };

                        $scope.error = null;
                        $scope.saving = false;
                        $scope.account = Account.getAccount(true);

                        $scope.setAccount = function() {
                            $scope.account = Account.getAccount(true);
                        };

                        $scope.updateAccount = function () {
                            console.log($scope.account);
                            function required(fields) {
                                for(var field in fields) {
                                    if (fields[field].required && !$scope.account.$$v[field]) {
                                        return false;
                                    }
                                }

                                return true;
                            }

                            if (required($scope.fields.basic) &&
                                required($scope.fields.address)) {
                                $scope.saving = true;

                                Account.updateAccount($scope.account).then(function () {
                                    $scope.setAccount();
                                    $scope.saving = false;
                                    $scope.error = null;

                                    $scope.nextStep();
                                }, function (err) {
                                    $scope.error = null;
                                    $scope.saving = false;
                                });
                            } else {
                                $scope.error = localization.translate(null, 'account', 'Please fill all the required fields');
                            }
                        };
                    },
                    templateUrl: 'account/static/partials/account-info-edit.html'
                };
            }]);
}(window.JP.getModule('Account')));