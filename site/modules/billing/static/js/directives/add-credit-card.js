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
        'util',

        function (BillingService, $q, $http, $rootScope, Account, notification, localization, util) {
            return {
                restrict: 'A',
                replace: true,
                scope: true,

                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('billing', $scope);
                },

                link: function ($scope) {
                    function getCardType(number){
                        if (!number) {
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

                    $scope.phone = '';

                    $scope.form = {
                        cardHolderInfo: {
                        },
                        promoCode: ''
                    };

                    $http.get('billing/promocode').then(function (code) {
                        if(!$scope.form.promoCode && code.data) {
                            $scope.form.promoCode = code.data;
                        }
                    });

                    $scope.loading = false;
                    $scope.months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
                    $scope.years = [];
                    $scope.prev = $scope.prev || BillingService.getDefaultCreditCard();
                    $scope.useExisting = false;
                    $scope.formSubmitted = false;

                    $scope.saveButton = 'Submit';

                    if ($scope.nextStep) {
                        $scope.saveButton = 'Next';
                    }

                    $scope.countries = $http.get('billing/countries');
                    var statesPromise = $http.get('billing/states');

	                function usePrevious(prev) {
		                $scope.prev = prev;
		                if (prev && prev.cardHolderInfo) {
			                [ 'addressLine1','addressLine2','country','state','city','zipCode' ].forEach(function (key) {
				                $scope.form.cardHolderInfo[key] = prev.cardHolderInfo[key];
			                });

			                $scope.countries.then(function (countries) {
				                countries.data.some(function (country){
					                if (country.name === prev.cardHolderInfo.country) {
						                $scope.form.cardHolderInfo.country = country.iso3;
						                return true;
					                }
				                });

				                var country = $scope.form.cardHolderInfo.country;
				                if (country === 'CAN' || country === 'USA') {
					                statesPromise.then(function (allStates) {
						                var states = country === 'USA' ? allStates.data.us.obj : allStates.data.canada.obj;
						                Object.keys(states).some(function (state) {
							                if (states[state] === prev.cardHolderInfo.state) {
								                $scope.form.cardHolderInfo.state = state;
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

                                if (!$scope.form.firstName && !$scope.form.lastName) {
                                    $scope.form.firstName = account.firstName;
                                    $scope.form.lastName = account.lastName;
                                }

				                if (account.country && account.country.length === 3) {
					                form.country = account.country;
				                } else {
					                form.country = 'USA';
				                }

				                $scope.useExistingPossible = true;

				                [ 'zipCode','city','state','addressLine1','country' ].some(function (e) {
					                if(!form[e] || form[e] === '') {
						                $scope.useExistingPossible = false;
						                return true;
					                }
				                });

				                $scope.useExisting = $scope.useExistingPossible;
			                });
		                }
	                }

                    $q.when($scope.prev, usePrevious);

                    $scope.$watch('useExisting', function (newVal, oldVal) {
                        if (newVal === true) {
                            usePrevious($scope.prev);
                        }
                    });

                    var c = (new Date()).getFullYear();
                    var i = c;
                    for (i; i < c + 20; i++) {
                        $scope.years.push(i);
                    }

                    $scope.$watch('form.cardHolderInfo.country', function (newVal, oldVal) {
                        if (oldVal === 'USA' || oldVal === 'CAN'){
                            $scope.form.cardHolderInfo.state = '';
                        }

                        if (newVal === 'USA') {
                            statesPromise.then(function (res) {
                                $scope.stateSel = res.data.us.obj;
                            });
                        } else if (newVal === 'CAN') {
                            statesPromise.then(function (res) {
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
                        } else if ($scope.errs && ($scope.errs[field]) && !errorType) {
                            return true;
                        }

                        if ($scope.formSubmitted &&
                            $scope.paymentForm[field] &&
                            $scope.paymentForm[field].$error.required &&
                            errorType === 'submitRequired') {
                            return true;
                        }

                        // state validation fix
                        if (field === 'state' &&
                            errorType === 'submitRequired' &&
                            $scope.formSubmitted &&
                            $scope.paymentForm[field].$modelValue === '') {
                            return true;
                        }

                        //console.log($scope.paymentForm[field].$error);
                        if ($scope.paymentForm[field] && $scope.paymentForm[field].$dirty) {
                            Object.keys($scope.paymentForm[field].$error).some(function (key) {
                                if ($scope.paymentForm[field].$error[key] && key === errorType) {
                                    isPresent = true;
                                    return true;
                                }
                            });
                        }

                        return isPresent;
                    };

                    $q.when(Account.getAccount(true), function (account) {
                        $scope.account = account;
                    });

                    $scope.submitForm = function() {
                        $scope.loading = true;
                        $scope.formSubmitted = true;

                        if ($scope.paymentForm.$invalid) {
                            $scope.loading = false;
                            return;
                        }

                        // remove state from submittable form fields to avoid Zuora error on empty state
                        if ($scope.form.cardHolderInfo.state === '') {
                            delete $scope.form.cardHolderInfo.state;
                        }
						$scope.form.workPhone = $scope.account.phone;
                        BillingService.addPaymentMethod($scope.form, function (errs, job) {
                            if (!errs) {
                                Account.updateAccount({
                                    country: $scope.form.cardHolderInfo.country,
                                    phone: $scope.account.phone
                                }).then(function (account) {
                                    notification.replace('addPaymentMethod', { type: 'success' },
                                        localization.translate(null,
                                            'billing',
                                            'Billing information updated'
                                        )
                                    );

                                    window.scrollTo(0,0);
                                    $scope.errs = null;
                                    $q.when(BillingService.getDefaultCreditCard(), function (credit) {
                                        $scope.loading = false;
                                        $rootScope.$broadcast('creditCardUpdate', credit);
                                    });
                                }, function () {
                                    util.message(
                                        localization.translate(
                                            $scope,
                                            null,
                                            'Message'
                                        ),
                                        localization.translate(
                                            null,
                                            'billing',
                                            'Billing information not updated'
                                        ),
                                        function () {}
                                    );
                                    window.scrollTo(0, 0);
                                });
                                return;
                            }

                            if (errs.zuora) {
                                $scope.errs = errs.zuora.reasons;
                            } else {
                                $scope.errs = {};
                                Object.keys(errs)
                                    .filter(function (k) {
                                        //Ignore zuora errors and creditCardType (that is calculated by us)
                                        return typeof errs[k] !== 'object' && k !== 'creditCardType';
                                    })
                                    .forEach(function (k) {
                                        $scope.errs[k] = errs[k];
                                    });
                            }

                            $scope.loading = false;
                            var message = localization.translate(null, 'billing', 'Billing information not updated:');

                            var addedMessage = '';
                            var fieldErrors = '';
                            var generic = true;

                            Object.keys($scope.errs).forEach(function (key) {
                                var err = $scope.errs[key];

                                if (typeof err === 'object') {
                                    var translated = localization.translate(null, 'billing', err.message);
                                    if (translated === err.message) {
                                        return;
                                    }

                                    generic = false;
                                    addedMessage += (addedMessage === '' ? ' ' : '<br/>') + translated;

                                } else {
                                    var params = {};
                                    params[key] = $scope.form[key];
                                    var tKey = localization.translate(null, 'billing', key);
                                    var tMessage = localization.translate(null, 'billing', err, params);

                                    if (tKey.charAt(0) !== '_') {
                                        fieldErrors += (fieldErrors === '' ? ' ' : '<br/>') + (tKey.charAt(0) !== '?' ? tKey + ':' : '') + tMessage;
                                    }
                                }
                            });

                            if (generic && fieldErrors !== '') {
                                addedMessage = fieldErrors;
                            } else {
                                addedMessage = ' ' + localization.translate(null, 'billing', 'We are unable to verify your credit card details.');
                            }

//                            notification.replace('addPaymentMethod', { type: 'error' }, message + addedMessage);
                            util.message(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Message'
                                ),
                                message + addedMessage,
                                function () {}
                            );
                            window.scrollTo(0,0);
                        });
                    };
                },
                templateUrl: 'billing/static/partials/add-credit-card.html'
            };
        }
    ]);
}(window.JP.getModule('Billing')));