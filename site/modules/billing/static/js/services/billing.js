'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('BillingService', ['$http','$q', 'serverTab', '$$track', function ($http, $q, serverTab, $$track) {
        var service = {};

        var creditCard = {};

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

                    }
                });
                return call.deferred;
            } else {
                return creditCard;
            }
        };

        service.addPaymentMethod = function (data, callback) {
            var call = serverTab.call({
                name: 'addPaymentMethod',
                data: data,
                done: callback
            });
            return call;
        };

        service.getInvoices = function (data, callback) {
            var call = serverTab.call({
                name: 'listInvoices',
                data: data,
                done: callback
            });
            return call.deferred;
        };

        service.getLastInvoice = function (data, callback) {
            var call = serverTab.call({
                name: 'getLastInvoice',
                data: data,
                done: callback
            });
            return call.deferred;
        };

        return service;
    }]);
}(window.JP.getModule('Billing')));