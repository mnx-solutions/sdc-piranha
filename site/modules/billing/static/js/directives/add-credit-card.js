'use strict';

(function (app) {

    app.directive('addCreditCard', [
        'BillingService',
        '$q',
        '$http',
        '$rootScope',
        'Account',
        'notification',
        'localization',

        function (BillingService, $q, $http, $rootScope, Account, notification, localization) {
            return {
                restrict: 'A',
                replace: true,
                scope: true,

                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('billing', $scope);
                },

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

                    $scope.phone = {};
                    $scope.selectedCountryCode = '1'; // default to USA

                    $scope.form = {
                        cardHolderInfo: {
                        }
                    };

                    $scope.loading = false;
                    $scope.months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
                    $scope.years = [];
                    $scope.prev = BillingService.getDefaultCreditCard();
                    $scope.useExisting = false;

                    $scope.saveButton = 'Submit';

                    if($scope.nextStep) {
                        $scope.saveButton = 'Next';
                    }
                    $scope.countries = $http.get('billing/countries');
                    var statesP = $http.get('billing/states');

                    $q.when($scope.prev, function (prev) {
                        if(prev && prev.cardHolderInfo) {
                            ['addressLine1','addressLine2','country','state','city','zipCode'].forEach(function (key) {
                                $scope.form.cardHolderInfo[key] = prev.cardHolderInfo[key];
                            });

                            $scope.countries.then(function (cs) {
                                cs.data.some(function (el){
                                    if(el.name === prev.cardHolderInfo.country) {
                                        $scope.form.cardHolderInfo.country = el.iso3;
                                        return true;
                                    }
                                });
                                var country = $scope.form.cardHolderInfo.country;
                                if(country === 'CAN' || country === 'USA') {
                                    statesP.then(function (allStates) {
                                        var states = country === 'USA' ? allStates.data.us.obj : allStates.data.canada.obj;
                                        Object.keys(states).some(function (el) {
                                            if(states[el] === prev.cardHolderInfo.state) {
                                                $scope.form.cardHolderInfo.state = el;
                                                return true;
                                            }
                                        });
                                    });
                                }
                            });

                            $scope.useExistingPossible = $scope.useExisting = true;
                        } else {

                            $q.when(Account.getAccount(), function(account) {

                                var form = $scope.form.cardHolderInfo;
                                form.zipCode = account.postalCode;
                                form.city = account.city;
                                form.state = account.state;
                                form.addressLine1 = account.address;
                                if(account.country.length === 3) {
                                    form.country = account.country;
                                } else {
                                    form.country = 'USA';
                                }

                                $scope.useExistingPossible = true;
                                ['zipCode','city','state','addressLine1','country'].some(function (e) {
                                    if(!form[e] || form[e] === '') {
                                        $scope.useExistingPossible = false;
                                        return true;
                                    }
                                });
                                $scope.useExisting = $scope.useExistingPossible;
                            });
                        }
                    });



                    var c = (new Date()).getFullYear();
                    var i = c;
                    for(i; i < c + 20; i++) {
                        $scope.years.push(i);
                    }

                    $scope.$watch('form.cardHolderInfo.country', function (newVal, oldVal) {
                        if(oldVal === 'USA' || oldVal === 'CAN'){
                            $scope.form.cardHolderInfo.state = '';
                        }
                        if(newVal === 'USA') {
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

                    $scope.$watch('form.creditCardNumber', function (newVal) {
                        $scope.form.creditCardType = getCardType(newVal ? newVal.toString() : '');
                    }, true);

                    $scope.isError = function (field, errorType) {
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

                    // begin temp tropo removal
                    $q.when(Account.getAccount(true), function (account) {
                    $q.when($http.get('account/countryCodes'), function(data) {
                        $scope.countryCodes = data.data;

                        account.country = $scope.isoToObj(account.country);
                        $scope.selectedCountryCode = account.country.areaCode;

                        $scope.phone = {
                            number: account.phone.replace(new RegExp(/[^0-9#\*]/g), ''),
                            country: account.country
                        };

                        $scope.account = account;
                    })
                    });

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

                    $http.get('account/countryCodes').success(function (data) {
                        $scope.countryCodes = data;
                    });

                    $scope.$watch('phone.country', function(newVal) {
                        $scope.selectedCountryCode = (newVal && newVal.areaCode) || '1';
                    });

                    // end temp tropo fix

                    $scope.submitForm = function() {
                        $scope.loading = true;

                        BillingService.addPaymentMethod($scope.form, function (errs, job) {
                            if (errs) {
                                $scope.errs = errs.reasons;
                                $scope.loading = false;
                                var message = localization.translate(null,
                                    'billing',
                                    'Payment information not updated:'
                                );

                                var addedMessage = '';
                                var generic = false;

                                Object.keys(errs).forEach(function (key) {
                                    var err = errs[key];
                                    var translated = localization.translate(null,
                                        'billing',
                                        err.message
                                    );
                                    if(translated === err.message) {
                                        generic = true;
                                    }
                                    if(addedMessage !== '') {
                                        generic = false;
                                        addedMessage += '<br/>' + translated;
                                    } else {
                                        addedMessage += ' ' + translated;
                                    }
                                });

                                if(generic) {
                                    addedMessage = ' we are unable to verify your credit card details.';
                                }

                                notification.push(null, { type: 'error' }, message + addedMessage);
                                window.scrollTo(0,0);
                            } else {
                                Account.updateAccount({
                                    country: $scope.phone.country.iso3,
                                    phone: $scope.phone.number
                                }).then(function () {
                                    notification.push(null, { type: 'success' },
                                        localization.translate(null,
                                            'billing',
                                            'Payment information updated'
                                        )
                                    );

                                    $scope.errs = null;
                                    var cc = BillingService.getDefaultCreditCard();

                                    $q.when(cc, function (credit) {
                                        $scope.loading = false;
                                        $rootScope.$broadcast('creditCardUpdate', credit);
                                    });
                                }, function () {
                                    notification.push(null, { type: 'error' },
                                        localization.translate(null,
                                            'billing',
                                            'Payment information not updated'
                                        )
                                    );
                                });
                            }
                        });
                    };
                },
                templateUrl: 'billing/static/partials/add-credit-card.html'
            };
        }
    ]);
}(window.JP.getModule('Billing')));