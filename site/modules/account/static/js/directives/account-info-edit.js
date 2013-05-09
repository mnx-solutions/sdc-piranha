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
                        function required(fields) {
                            for(var field in fields) {
                                if (fields[field].required && !$scope.account.$$v[field]) {
                                    return false;
                                }
                            }

                            return true;
                        }

                        function sanitize(fields) {
                            for(var field in fields) {
                                if (!fields[field].pattern) {
                                    fields[field].pattern = /^+$/;
                                }
                            }
                        }

                        $scope.fields = {
                            basic: {
                                email: {
                                    title: localization.translate(null, 'account', 'Email'),
                                    type: 'email',
                                    pattern: /^(.*)$/,
                                    required: true
                                },

                                firstName: {
                                    title: localization.translate(null, 'account', 'First name'),
                                    type: 'text',
                                    pattern: /^(.*)$/,
                                    required: true
                                },

                                lastName: {
                                    title: localization.translate(null, 'account', 'Last name'),
                                    type: 'text',
                                    pattern: /^(.*)$/,
                                    required: true
                                },

                                phone: {
                                    title: localization.translate(null, 'account', 'Phone'),
                                    type: 'text',
                                    pattern: /^(\d+)$/,
                                    required: true
                                },

                                companyName: {
                                    title: localization.translate(null, 'account', 'Company name'),
                                    type: 'text',
                                    pattern: /^(.*)$/,
                                    required: true
                                }
                            },

                            address: {
                                address: {
                                    title: localization.translate(null, 'account', 'Address'),
                                    type: 'text',
                                    pattern: /^(.*)$/,
                                    required: true
                                },

                                postalCode: {
                                    title: localization.translate(null, 'account', 'Postal code'),
                                    type: 'number',
                                    pattern: /^(.*)$/,
                                    required: true
                                },

                                city: {
                                    title: localization.translate(null, 'account', 'City'),
                                    type: 'text',
                                    pattern: /^(.*)$/,
                                    required: true
                                },

                                state: {
                                    title: localization.translate(null, 'account', 'State'),
                                    type: 'text',
                                    pattern: /^(.*)$/,
                                    required: true
                                },

                                country: {
                                    title: localization.translate(null, 'account', 'Country'),
                                    type: 'text',
                                    pattern: /^(.*)$/,
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
                            if (required($scope.fields.basic) &&
                                required($scope.fields.address)) {
                                $scope.saving = true;

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
                            } else {
                                $scope.error = localization.translate(null, 'account', 'Please fill all the required fields');
                            }
                        };
                    },
                    templateUrl: 'account/static/partials/account-info-edit.html'
                };
            }]);
}(window.JP.getModule('Account')));