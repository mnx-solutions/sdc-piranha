'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('BillingService', [
        'serverTab',
        'localization',
        'PopupDialog',
        function (serverTab, localization, PopupDialog) {
        var service = {};

        var creditCard = null;

        service.getPaymentMethods = function () {
            var call = serverTab.call({
                name: 'listPaymentMethods',
                data: {},
                done: function () {}
            });
            return call.deferred;
        };

        service.getDefaultCreditCard = function () {
            if(!creditCard) {
                var call = serverTab.call({
                    name: 'defaultCreditCard',
                    data: {},
                    done: function (err) {
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

        var billingResponseHandler = function (err, errMessage) {
            if (err && err !== 'Not Implemented' && err.message.indexOf('Cannot find entity by key') === -1) {
                PopupDialog.error(
                    localization.translate(
                        null,
                        null,
                        'Error'
                    ),
                    localization.translate(
                        null,
                        'billing',
                        errMessage
                    ),
                    function(){}
                );
            }
        };

        service.getInvoices = function (callback) {
            var call = serverTab.call({
                name: 'listInvoices',
                data: {},
                done: callback || function (err) {
                    billingResponseHandler(err, 'Unable to retrieve invoices.');
                }
            });
            return call.deferred;
        };

        service.getSubscriptions = function (callback) {
            var call = serverTab.call({
                name: 'getSubscriptions',
                data: {},
                done: callback || function (err) {
                    billingResponseHandler(err, 'Unable to retrieve subscriptions.');
                }
            });
            return call.deferred;
        };

        service.getProductRatePlans = function (sku, callback) {
            var call = serverTab.call({
                name: 'BillingProductRatePlans',
                data: {
                    sku: sku
                },
                done: callback || function () {}
            });
            return call.deferred;
        };

        service.createSupportSubscription = function (ratePlanId, productId, callback) {
            serverTab.call({
                name: 'BillingSubscriptionCreate',
                data: {
                    ratePlanId: ratePlanId,
                    productId: productId
                },
                done: function (err, job) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    callback(null, job.__read());
                },
                error: function (err) {
                    if (err) {
                        callback(err);
                    }
                }
            });
        };

        service.getLastInvoice = function (callback) {
            var call = serverTab.call({
                name: 'getLastInvoice',
                data: {},
                done: callback || function (err) {
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