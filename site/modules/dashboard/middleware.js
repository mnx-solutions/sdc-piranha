'use strict';
var config = require('easy-config');

module.exports = function dashboardMiddleware(req, res, next) {
    res.locals.currentYear = new Date().getFullYear();
    res.locals.userId = req.session.userId;

    if (!res.locals.jss) {
        res.locals.jss = [];
    }
    var campaigns = config.ns['campaigns'];
    var marketing = config.marketing;
    marketing.campaigns = [];
    Object.keys(campaigns).forEach(function (campaignId) {
        if (campaigns[campaignId].dashboardAd) {
            marketing.campaigns.push(campaignId);
        }
    });
    res.locals.jss.push('window.JP.set("marketing", ' + JSON.stringify(marketing) + ')');

    return next();
};
