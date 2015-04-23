'use strict';

var zuora = require('zuora-rest');
var zuoraHelpers = require('./lib/zuora-helpers');

module.exports = function execute(app, log, config) {
    var campaignPromoMap = {};
    var campaigns = [];
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
        campaigns = Object.keys(config.ns['campaigns'])
            .map(function (campaignID) {
                var campaign = config.ns['campaigns'][campaignID];
                campaign.campaignId = campaignID;
                return campaign;
            })
            .filter(function (campaign) {
                return campaign.defaultDate && (!campaignPromoMap[campaign.campaignId].expirationDate ||
                    (new Date()) < (new Date(campaignPromoMap[campaign.campaignId].expirationDate)));
            })
            .sort(function (campaign1, campaign2) {
                return (new Date(campaign2.defaultDate)).getTime() - (new Date(campaign1.defaultDate)).getTime();
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
        if (campaigns.length < 1) {
            return null;
        }
        var i = 0;
        var defCampaign = campaigns[i];
        while (defCampaign && ((new Date()) < (new Date(defCampaign.defaultDate))) && i < 10) {
            i += 1;
            defCampaign = campaigns[i];
        }
        defCampaign.hideCode = true;
        return defCampaign;
    }

    app.get('/campaign', function (req, res, next) {
        var promo = getPromoDetail(req.cookies.campaignId);
        var result = {code: '', hideCode: false};
        var campaignId = req.cookies.campaignId;
        if (promo) {
            result.code = promo.code ? promo.code : '';
            result.hideCode = promo.hideCode;
            campaignId = result.campaignId = promo.campaignId;
        }
        req.log.debug({campaignId: campaignId, promocode: result}, 'Requested default promocode');
        res.json(result);
    });

    app.get('/promoamount', function (req, res) {
        var promo = getPromoDetail(req.cookies.campaignId);
        var amount = promo && promo.amount ? promo.amount : 0;
        req.log.debug({campaignId: req.cookies.campaignId, amount: amount}, 'Requested default promocode amount');
        res.sendStatus(200).send(String(amount));
    });

    app.get('/invoice/:account/:id', zuoraHelpers.getInvoicePDF);
};