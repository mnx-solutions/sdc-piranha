'use strict';

var zuora = require('zuora');
var config = require('easy-config');
var zuoraHelpers = require('./lib/zuora-helpers');

module.exports = function execute(scope, app) {
    var campaignPromoMap = {};
    var defaultPromos = [];
    if (config.features.promocode !== 'disabled' && config.ns['promo-codes']) {
        Object.keys(config.ns['promo-codes']).forEach(function (promoKey) {
            var promo = config.ns['promo-codes'][promoKey];
            if (promo.campaignId) {
                promo.code = promoKey;
                campaignPromoMap[promo.campaignId] = promo;
            }
        });
        defaultPromos = Object.keys(config.ns['promo-codes'])
            .map(function (promoKey) {
                var promo = config.ns['promo-codes'][promoKey];
                promo.code = promoKey;
                return promo;
            })
            .filter(function (promo) {
                return promo.defaultDate && (!promo.expirationDate || (new Date()) < (new Date(promo.expirationDate)));
            })
            .sort(function (promo1, promo2) {
                return (new Date(promo2.defaultDate)).getTime() - (new Date(promo1.defaultDate)).getTime();
            });
    }

    app.get('/countries', function (req, res, next) {
        var data = zuora.countries.getArray(config.zuora.rest.validation.countries);
        data.forEach(function (el) {
            if( [ 'USA','CAN','GBR' ].indexOf(el.iso3) >= 0) {
                el.group = 'Default';
            } else {
                el.group = 'All countries';
            }
        });
        res.json(data);
    });

    app.get('/states', function (req, res, next) {
        res.json(zuora.states);
    });

    app.get('/promocode', function (req, res, next) {
        function end(code) {
            req.log.debug({campaignId: req.cookies.campaignId, promocode: code}, 'Requested default promocode');
            res.send(code);
        }
        if(req.cookies.campaignId) {
            var promo = campaignPromoMap[req.cookies.campaignId];
            if (promo
                && (promo.startDate && (new Date()) > (new Date(promo.startDate)))
                && (promo.expirationDate && (new Date()) < (new Date(promo.expirationDate)))) {
                end(promo.code);
                return;
            }
        }
        if (defaultPromos.length < 1) {
            end('');
            return;
        }
        var i = 0;
        var promo = defaultPromos[i];
        while (promo && ((new Date()) < (new Date(promo.defaultDate))) && i < 10) {
            i++;
            promo = defaultPromos[i];
        }
        end(promo && promo.code || '');
    });

    app.get('/invoice/:account/:id', zuoraHelpers.getInvoicePDF);
};