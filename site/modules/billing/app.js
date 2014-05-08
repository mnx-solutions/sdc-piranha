'use strict';

var zuora = require('zuora');
var config = require('easy-config');
var zuoraHelpers = require('./lib/zuora-helpers');

module.exports = function execute(scope, app) {
    var campaignPromoMap = {};
    var defaultPromos = [];
    if (config.features.promocode !== 'disabled' && config.ns['promo-codes']) {
        Object.keys(config.ns['campaigns']).forEach(function (campaignId) {
            var campaign = config.ns['campaigns'][campaignId];
            var promo = config.ns['promo-codes'][campaign.promoCode];
            if (campaign.promoCode) {
                promo.code = campaign.promoCode;
                promo.hideCode = campaign.hideCode;
                campaignPromoMap[campaignId] = promo;
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

    function getPromoDetail(campaignId) {
        if (campaignId) {
            var promo = campaignPromoMap[campaignId];
            if (promo && (promo.startDate && (new Date()) > (new Date(promo.startDate))) &&
                    (promo.expirationDate && (new Date()) < (new Date(promo.expirationDate)))) {
                return promo;
            }
        }
        if (defaultPromos.length < 1) {
            return null;
        }
        var i = 0;
        var defPromo = defaultPromos[i];
        while (defPromo && ((new Date()) < (new Date(defPromo.defaultDate))) && i < 10) {
            i += 1;
            defPromo = defaultPromos[i];
        }
        defPromo.hideCode = true;
        return defPromo;
    }

    app.get('/promocode', function (req, res, next) {
        var promo = getPromoDetail(req.cookies.campaignId);
        var result = {code: '', hideCode: false};
        if (promo) {
            result.code = promo.code ? promo.code : '';
            result.hideCode = promo.hideCode;
        }
        req.log.debug({campaignId: req.cookies.campaignId, promocode: result}, 'Requested default promocode');
        res.json(result);
    });

    app.get('/promoamount', function (req, res) {
        var promo = getPromoDetail(req.cookies.campaignId);
        var amount = promo && promo.amount ? promo.amount : 0;
        req.log.debug({campaignId: req.cookies.campaignId, amount: amount}, 'Requested default promocode amount');
        res.send(200, String(amount));
    });

    app.get('/invoice/:account/:id', zuoraHelpers.getInvoicePDF);
};