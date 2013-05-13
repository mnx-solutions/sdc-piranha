'use strict';

(function (app) {

    app.directive('addCreditCard',['BillingService', '$q','$http', '$rootScope', function (BillingService, $q, $http, $rootScope) {

        return {
            restrict: 'A',
            replace: true,
            scope: true,
            link: function ($scope) {

                function getCardType(number){
                    if(!number) {
                        return '';
                    }

                    if (number.match(/^4/) !== null){
                        return 'Visa';
                    }

                    if (number.match(/^(34|37)/) !== null){
                        return 'AmericanExpress';
                    }

                    if (number.match(/^5[1-5]/) !== null){
                        return 'MasterCard';
                    }

                    if (number.match(/^6011/) !== null){
                        return 'Discover';
                    }

                    return '';
                }

                $scope.form = {
                    cardHolderInfo: {}
                };

                $scope.isSaving = false;
                $scope.months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
                $scope.years = [];

                var c = (new Date()).getFullYear();
                var i = c;
                for(i; i < c + 20; i++) {
                    $scope.years.push(i);
                }

                $http.get('billing/countries').success(function (data) {
                    $scope.countries = data;
                });

                $http.get('billing/states').success(function (data) {
                    $scope.allStates = data;
                });

                $scope.$watch('form.cardHolderInfo.country', function (newVal, oldVal) {
                    if(oldVal === 'USA' || oldVal === 'CAN'){
                        $scope.form.cardHolderInfo.state = '';
                    }
                    if(newVal === 'USA') {
                        $scope.stateSel = $scope.allStates.us.obj;
                    } else if (newVal === 'CAN') {
                        $scope.stateSel = $scope.allStates.canada.obj;
                    } else {
                        $scope.stateSel = undefined;
                    }
                }, true);

                $scope.$watch('form.creditCardNumber', function (newVal) {
                    $scope.form.creditCardType = getCardType(newVal ? newVal.toString() : '');
                }, true);

                $scope.isErrorOf = function (field, errorType) {
                    var isPresent = false;
                    var fieldAtoms = field.split('.');

                    if (fieldAtoms.length > 1) {
                        field = fieldAtoms[1];

                        if (!errorType) {
                            if ($scope.errs && ($scope.errs[fieldAtoms[1]] ||
                                $scope.errs[fieldAtoms[0] + '.' + fieldAtoms[1]])) {
                                return true;
                            }
                        }
                    } else {
                        if ($scope.errs && ($scope.errs[field])) {
                            return true;
                        }
                    }

                    if ($scope.paymentForm[field].$dirty) {
                        Object.keys($scope.paymentForm[field].$error).some(function (key) {
                            if ($scope.paymentForm[field].$error[key] && key === errorType) {
                                isPresent = true;
                                return true;
                            }
                        });
                    }

                    return isPresent;
                };

                $scope.isErrorPresent = function (field) {
                    var isPresent = false;
                    var fieldAtoms = field.split('.');

                    if (fieldAtoms.length > 1) {
                        field = fieldAtoms[1];

                        if ($scope.errs && ($scope.errs[fieldAtoms[1]] ||
                            $scope.errs[fieldAtoms[0] + '.' + fieldAtoms[1]])) {
                            return true;
                        }
                    } else {
                        if ($scope.errs && ($scope.errs[field])) {
                            return true;
                        }
                    }

                    if ($scope.paymentForm[field].$dirty) {
                        Object.keys($scope.paymentForm[field].$error).some(function (key) {
                            if ($scope.paymentForm[field].$error[key]) {
                                isPresent = true;
                                return true;
                            }
                        });
                    }

                    return isPresent;
                };

                $scope.submitForm = function() {
                    $scope.isSaving = true;

                    BillingService.addPaymentMethod($scope.form, function (errs, job) {
                        if(errs) {
                            $scope.errs = errs;
                            $scope.isSaving = false;
                        } else {
                            $scope.errs = null;
                            var cc = BillingService.getDefaultCreditCard();

                            $q.when(cc, function (credit) {
                                $scope.isSaving = false;
                                $rootScope.$broadcast('creditCardUpdate', credit);
                            });
                        }
                    });
                };
            },
            templateUrl: 'billing/static/partials/add-credit-card.html'
        };
    }]);
}(window.JP.getModule('Billing')));