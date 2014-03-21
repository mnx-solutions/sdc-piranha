'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('BillingService', [
        '$http',
        '$q',
        'serverTab',
        'localization',
        'PopupDialog',
        function ($http, $q, serverTab, localization, PopupDialog) {
        var service = {};

        var creditCard = null;

        service.getPaymentMethods = function () {
            var call = serverTab.call({
                name: 'listPaymentMethods',
                data: {},
                done: function (err, job) {

                }
            });
            return call.deferred;
        };

        service.getDefaultCreditCard = function () {
            if(!creditCard) {
                var call = serverTab.call({
                    name: 'defaultCreditCard',
                    data: {},
                    done: function (err, job) {
                        if(err) {
                            PopupDialog.error(
                                localization.translate(
                                    null,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    null,
                                    'billing',
                                    'Unable to retrieve defaultCreditCard.'
                                ),
                                function(){}
                            );
                        }
                    }
                });
                return call.deferred;
            }
            return creditCard;
        };

        service.addPaymentMethod = function (data, callback) {
            var call = serverTab.call({
                name: 'addPaymentMethod',
                data: data,
                done: callback
            });
            return call;
        };

        service.getInvoices = function (callback) {
            var call = serverTab.call({
                name: 'listInvoices',
                data: {},
                done: callback || function (err, job) {
                    if(err && err !== 'Not Implemented') {
                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                null,
                                'billing',
                                'Unable to retrieve invoices.'
                            ),
                            function(){}
                        );
                    }
                }
            });
            return call.deferred;
        };

        service.getSubscriptions = function (callback) {
            var call = serverTab.call({
                name: 'getSubscriptions',
                data: {},
                done: callback || function (err, job) {
                    if(err && err !== 'Not Implemented') {
                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                null,
                                'billing',
                                'Unable to retrieve subscriptions.'
                            ),
                            function(){}
                        );
                    }
                }
            });
            return call.deferred;
        };

        service.createSupportSubscription = function (ratePlanId, callback) {
            var call = serverTab.call({
                name: 'BillingSubscriptionCreate',
                data: {
                    ratePlanId: ratePlanId
                },
                done: callback || function (err) {
                    if (err) {
                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                null,
                                'billing',
                                'Unable to retrieve subscriptions'
                            ),
                            function(){}
                        );
                    }
                }
            });
            return call.deferred;
        };

        service.cancelSupportSubscription = function (subscriptionId, callback) {
            var call = serverTab.call({
                name: 'BillingSubscriptionCancel',
                data: {
                    id: subscriptionId
                },
                done: callback || function (err) {
                    if (err) {
                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                null,
                                'billing',
                                'Unable to unsubscribe'
                            ),
                            function(){}
                        );
                    }
                }
            });
            return call.deferred;
        };

        service.getLastInvoice = function (callback) {
            var call = serverTab.call({
                name: 'getLastInvoice',
                data: {},
                done: callback || function (err, job) {
                    if(err) {
                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                null,
                                'billing',
                                'Unable to retrieve latest invoice.'
                            ),
                            function(){}
                        );
                    }
                }
            });
            return call.deferred;
        };

        return service;
    }]);
}(window.JP.getModule('Billing')));