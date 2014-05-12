'use strict';

(function (app) {

    app.directive('addCreditCard', [
        'BillingService',
        '$q',
        '$http',
        '$rootScope',
        'Account',
        'util',
        'notification',
        'localization',
        'PopupDialog',
        '$location',

        function (BillingService, $q, $http, $rootScope, Account, util, notification, localization, PopupDialog, $location) {
            return {
                restrict: 'A',
                replace: true,
                scope: {
                    submitTitle: '@',
                    submitFn: '@',
                    cancelVisible: '@',
                    showPhone: '@',
                    promocodeVisible: '@',
                    skipBillingVisible: '@',
                    skipPromoConfirmation: '@',
                    billingUpdatePopup: '@',
                    isSignUpForm: '@',
                    skipBillingFn: '&'
                },

                controller: function ($scope, $element, $attrs, $transclude) {
                    localization.bind('billing', $scope);
                },

                link: function ($scope, $element, $attrs) {
                    $scope.phoneVisible = true;
                    $scope.billingUpdatePopup = true;

                    $scope.phone = {};
                    $scope.selectedCountryCode = '1'; // default to USA
                    var submitBillingInfo = $rootScope.popCommonConfig('submitBillingInfo') || {btnTitle: 'Save Changes', appendPopupMessage: ''};
                    var addedMessageText = submitBillingInfo.appendPopupMessage;

                    $scope.promoCodeValue = '';
                    $scope.form = {
                        cardHolderInfo: {
                        },
                        promoCode: ''
                    };

                    $http.get('billing/campaign').then(function (code) {
                        if (!$scope.form.promoCode && code.data) {
                            $scope.promoCodeValue = code.data.code;
                            if (!code.data.hideCode) {
                                $scope.form.promoCode = $scope.promoCodeValue;
                            }
                        }
                    });

                    if (!$scope.skipPromoConfirmation && window.location.href.indexOf('/signup/') !== -1) {
                        $http.get('billing/promoamount').then(function (amount) {
                            if (amount && amount.data && amount.data > 0) {
                                var fAmount = parseFloat(amount.data);
                                amount = parseInt(amount.data, 10);
                                var opts = {
                                    title: 'Billing confirmation',
                                    question: 'Your credit card is about to be billed for $' + fAmount.toFixed(2),
                                    btns: [
                                        {
                                            result: 'cancel',
                                            label: 'Take me out',
                                            cssClass: 'btn pull-left grey-new effect-orange-button',
                                            setFocus: false
                                        },
                                        {
                                            result: 'ok',
                                            label: 'I\'m ready',
                                            cssClass: 'btn orange',
                                            setFocus: true
                                        }
                                    ]
                                };
                                PopupDialog.custom(
                                        opts,
                                        function (result) {
                                            if (result === 'cancel') {
                                                window.location = '/landing/forgetToken';
                                            }
                                        }
                                );
                            }
                        });
                    }

                    $scope.loading = false;
                    $scope.months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
                    $scope.years = [];
                    $scope.prev = $scope.prev || BillingService.getDefaultCreditCard();
                    $scope.formSubmitted = false;

                    $scope.countries = $http.get('billing/countries');
                    var statesPromise = $http.get('billing/states');

                    $scope.$watch('submitTitle', function () {
                        $scope.submitBtnTitle = $scope.submitTitle || submitBillingInfo.btnTitle;
                    });
                    $scope.$watch('isSignUpForm', function (data) {
                        $scope.isSignUpForm = util.parseBoolean(data);
                    });
                    $scope.$watch('showPhone', function (data) {
                        $scope.showPhone = util.parseBoolean(data);
                    });
                    $scope.$watch('promocodeVisible', function (data) {
                        $scope.promocodeVisible = util.parseBoolean(data);
                    });
                    $scope.$watch('skipBillingVisible', function (data) {
                        $scope.skipBillingVisible = util.parseBoolean(data);
                    });
                    $scope.$watch('cancelVisible', function (data) {
                        $scope.cancelVisible = util.parseBoolean(data);
                    });
                    $scope.$watch('billingUpdatePopup', function (data) {
                        $scope.billingUpdatePopup = util.parseBoolean(data);
                    });
                    $scope.$watch('showPhone + skipBilling', function () {
                        $scope.phoneVisible = $scope.showPhone || $scope.skipBilling;
                    });

                    function getCardType(number) {
                        if (!number) {
                            return '';
                        }

                        if (number.match(/^4/) !== null) {
                            return 'Visa';
                        }

                        if (number.match(/^(34|37)/) !== null) {
                            return 'AmericanExpress';
                        }

                        if (number.match(/^5[1-5]/) !== null) {
                            return 'MasterCard';
                        }

                        if (number.match(/^6011/) !== null) {
                            return 'Discover';
                        }

                        return '';
                    }

                    function usePrevious(prev) {
                        $scope.prev = prev;
                        if (prev && prev.cardHolderInfo) {
                            $scope.form.expirationMonth = prev.expirationMonth < 10 ? '0' + prev.expirationMonth : prev.expirationMonth.toString();
                            $scope.form.expirationYear = prev.expirationYear;
                            $scope.form.creditCardNumber = prev.cardNumber;
                            $scope.form.securityCode = prev.securityCode;
                            var nameSpaceIndex = prev.cardHolderInfo.cardHolderName.indexOf(' ');
                            if (nameSpaceIndex > 0) {
                                $scope.form.firstName = prev.cardHolderInfo.cardHolderName.substring(0, nameSpaceIndex);
                                $scope.form.lastName = prev.cardHolderInfo.cardHolderName.substring(nameSpaceIndex + 1);
                            }

                            [ 'addressLine1', 'addressLine2', 'country', 'state', 'city', 'zipCode' ].forEach(function (key) {
                                $scope.form.cardHolderInfo[key] = prev.cardHolderInfo[key];
                            });

                            $scope.countries.then(function (countries) {
                                countries.data.some(function (country) {
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

                        } else {
                            $q.when(Account.getAccount(), function (account) {
                                var form = $scope.form.cardHolderInfo;
                                form.zipCode = account.postalCode;
                                form.city = account.city;
                                form.state = account.state;
                                form.addressLine1 = account.address;

                                if (!$scope.form.firstName && !$scope.form.lastName) {
                                    $scope.form.firstName = account.firstName;
                                    $scope.form.lastName = account.lastName;
                                }

                                if (account.country.length === 3) {
                                    form.country = account.country;
                                } else {
                                    form.country = 'USA';
                                }

                            });
                        }
                    }

                    $q.when($scope.prev, usePrevious);

                    var c = (new Date()).getFullYear();
                    var i = c;
                    for (i; i < c + 20; i++) {
                        $scope.years.push(i);
                    }

                    $scope.$watch('form.cardHolderInfo.country', function (newVal, oldVal) {
                        if (oldVal === 'USA' || oldVal === 'CAN') {
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
                        $q.when($http.get('account/countryCodes'), function (data) {
                            $scope.countryCodes = data.data;

                            account.country = $scope.isoToObj(account.country);
                            $scope.selectedCountryCode = account.country.areaCode;

                            $scope.phone = {
                                number: account.phone.replace(new RegExp(/[^\+0-9#\*]/g), ''),
                                country: account.country
                            };

                            $scope.account = account;
                        });
                    });

                    $scope.isoToObj = function (iso) {
                        if (!$scope.countryCodes) {
                            return;
                        }

                        var selected = null;
                        var usa = null;

                        $scope.countryCodes.some(function (el) {
                            if (el.iso3 === 'USA') {
                                usa = el;
                            }

                            if (el.iso3 === iso) {
                                selected = el;
                                return true;
                            }
                        });

                        return selected || usa;
                    };

                    $scope.$watch('phone.country', function (newVal) {
                        $scope.selectedCountryCode = (newVal && newVal.areaCode) || '1';
                    });

                    var returnCb = $rootScope.popCommonConfig('returnCb') || function () {
                        $location.path('/account');
                    };

                    $scope.cancelForm = function () {
                        returnCb(false);
                    };

                    $scope.submitForm = function () {
                        $scope.loading = true;
                        $scope.formSubmitted = true;
                        if ($scope.paymentForm.$invalid || !isCCNumberValid()) {
                            validateCCNumber();
                            $scope.loading = false;
                            return;
                        }

                        $scope.invalidCCNumber = $scope.missingCCNumber = false;

                        // remove state from submittable form fields to avoid Zuora error on empty state
                        if ($scope.form.cardHolderInfo.state === '') {
                            delete $scope.form.cardHolderInfo.state;
                        }
                        $scope.form.workPhone = $scope.phone.number;
                        var formData = angular.copy($scope.form);
                        formData.promoCode = formData.promoCode || $scope.promoCodeValue;
                        BillingService.addPaymentMethod(formData, function (errs, job) {
                            if (!errs) {
                                Account.updateAccount({
                                    country: $scope.phone.country.iso3,
                                    phone: $scope.phone.number
                                }).then(function (account) {
                                    if ($scope.billingUpdatePopup) {
                                        PopupDialog.message(
                                                localization.translate(
                                                        $scope,
                                                        null,
                                                        'Message'
                                                ),
                                                localization.translate(
                                                        null,
                                                        'billing',
                                                                'Billing information updated.' + addedMessageText
                                                ),
                                                function () {
                                                    var provisionBundle = $rootScope.commonConfig('provisionBundle');
                                                    if (provisionBundle) {
                                                        provisionBundle.allowCreate = true;
                                                    }
                                                    returnCb(true);
                                                }
                                        );
                                        window.scrollTo(0, 0);
                                    }
                                    $scope.errs = null;
                                    $q.when(BillingService.getDefaultCreditCard(), function (credit) {
                                        $scope.loading = false;
                                        $rootScope.$broadcast('creditCardUpdate', credit);
                                    });
                                }, function () {
                                    PopupDialog.message(
                                            localization.translate(
                                                    $scope,
                                                    null,
                                                    'Message'
                                            ),
                                            localization.translate(
                                                    null,
                                                    'billing',
                                                    'Billing information not updated.'
                                            ),
                                            function () {
                                            }
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

                            PopupDialog.message(
                                    localization.translate(
                                            $scope,
                                            null,
                                            'Message'
                                    ),
                                    message + addedMessage
                            );
                            window.scrollTo(0, 0);
                        });
                    };

                    function isCCNumberValid() {
                        return (/^[0-9\*]{15,16}$/gi).test($scope.form.creditCardNumber);
                    }

                    function validateCCNumber() {
                        $scope.missingCCNumber = $scope.isError('creditCard.creditCardNumber', 'required') ||
                                $scope.isError('creditCardNumber', 'submitRequired');

                        $scope.invalidCCNumber = !isCCNumberValid() && !$scope.missingCCNumber;

                        if (!$scope.invalidCCNumber || !$scope.missingCCNumber) {
                            window.scrollTo(0, 0);
                        }
                    }

                },
                templateUrl: 'billing/static/partials/add-credit-card.html'
            };
        }
    ]);
}(window.JP.getModule('Billing')));