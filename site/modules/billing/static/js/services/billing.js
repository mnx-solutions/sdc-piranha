'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('BillingService', [
        '$http',
        '$q',
        'serverTab',
        'notification',
        'localization',
        function ($http, $q, serverTab, notification, localization) {
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
                            notification.push('defaultCreditCard', { type: 'error' },
                                localization.translate(null,
                                    'billing',
                                    'Unable to retrieve defaultCreditCard'
                                )
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
                        notification.push('invoices', { type: 'error' },
                            localization.translate(null,
                                'billing',
                                'Unable to retrieve invoices'
                            )
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
                        notification.push('subscriptions', { type: 'error' },
                            localization.translate(null,
                                'billing',
                                'Unable to retrieve subscriptions'
                            )
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
                        notification.push('lastInvoice', { type: 'error' },
                            localization.translate(null,
                                'billing',
                                'Unable to retrieve latest invoice'
                            )
                        );
                    }
                }
            });
            return call.deferred;
        };

        return service;
    }]);
}(window.JP.getModule('Billing')));